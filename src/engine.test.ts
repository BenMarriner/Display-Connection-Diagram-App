import { describe, it, expect } from "vitest";
import { simulate, bandwidthFor, activeVideo } from "./engine";
import {
  makeDevice,
  makeCable,
  exampleProject,
  cloneDevice,
  removePort,
} from "./devices";
import {
  emptyProject,
  connectionError,
  newPort,
  type Device,
  type Project,
} from "./model";
import { applyTiming, timings } from "./presets";

function known(...devices: Device[]) {
  for (const d of devices) {
    d.conversion = "yes";
    for (const p of d.ports)
      p.caps = {
        ...p.caps,
        link: p.protocol === "HDMI" ? "tmds18" : "hbr3",
        modes: timings.map((t) => t.id),
        depths: [8, 10, 12, 16],
        formats: ["RGB", "4:4:4", "4:2:2", "4:2:0"],
        vrr: "yes",
        hdr: "yes",
        dsc: "yes",
      };
  }
}
function cable(a: Device, ai: number, b: Device, bi: number) {
  const c = makeCable(a, ai, b, bi);
  c.ratingGbps = a.ports[ai].protocol === "HDMI" ? 18 : 32.4;
  c.features = { vrr: "yes", hdr: "yes", dsc: "yes" };
  return c;
}
function direct(): Project {
  const a = makeDevice("computer"),
    b = makeDevice("monitor");
  known(a, b);
  return { ...emptyProject(), devices: [a, b], cables: [cable(a, 0, b, 0)] };
}
describe("display simulation", () => {
  it("supports a declared direct path and pinpoints a cable bottleneck", () => {
    const p = direct();
    expect(simulate(p).displays[0].status).toBe("supported");
    p.cables[0].ratingGbps = 1;
    const r = simulate(p);
    expect(r.displays[0].status).toBe("incompatible");
    expect(
      r.findings.some(
        (f) =>
          f.componentId === p.cables[0].id &&
          f.title === "Connection bandwidth exceeded",
      ),
    ).toBe(true);
  });
  it("changes source and inactive cables when a switch changes channel", () => {
    const p = exampleProject(),
      sw = p.devices.find((d) => d.kind === "switch")!;
    const original = simulate(p);
    expect(
      original.displays.find((d) => d.deviceId === p.devices[4].id)!.sourceName,
    ).toContain("Desktop PC");
    sw.selectedInput = sw.ports[1].id;
    const next = simulate(p);
    expect(
      next.displays.find((d) => d.deviceId === p.devices[4].id)!.sourceName,
    ).toContain("Game console");
    expect(next.cables[p.cables[1].id].status).toBe("inactive");
    expect(next.cables[p.cables[2].id].status).not.toBe("inactive");
  });
  it("deactivates a display when selecting an unconnected input or powering off", () => {
    const p = direct();
    p.devices[1].selectedInput = p.devices[1].ports[1].id;
    expect(simulate(p).displays[0].status).toBe("inactive");
    p.devices[1].selectedInput = p.devices[1].ports[0].id;
    p.devices[0].enabled = false;
    expect(simulate(p).displays[0].status).toBe("inactive");
  });
  it("mirrors a splitter without double-counting its upstream stream", () => {
    const pc = makeDevice("console"),
      split = makeDevice("splitter"),
      m = makeDevice("projector"),
      p = makeDevice("projector");
    known(pc, split, m, p);
    const setup = {
      ...emptyProject(),
      devices: [pc, split, m, p],
      cables: [
        cable(pc, 0, split, 0),
        cable(split, 1, m, 0),
        cable(split, 2, p, 0),
      ],
    };
    let r = simulate(setup);
    expect(r.cables[setup.cables[0].id].streamCount).toBe(1);
    expect(r.displays.every((d) => d.status === "supported")).toBe(true);
    pc.ports[0].signal = applyTiming(pc.ports[0].signal, "4k60");
    p.ports[0].caps.modes = ["1080p60"];
    r = simulate(setup);
    expect(r.displays[0].signal).toEqual(r.displays[1].signal);
    expect(r.displays[1].status).toBe("incompatible");
    expect(pc.ports[0].signal.refresh).toBe(60);
  });
  it("aggregates independent dock streams and enforces shared capacity", () => {
    const pc = makeDevice("computer");
    pc.ports = [newPort("out", "USB-C")];
    const dock = makeDevice("dock"),
      a = makeDevice("monitor"),
      b = makeDevice("monitor");
    b.selectedInput = b.ports[1].id;
    known(pc, dock, a, b);
    dock.maxStreams = 2;
    dock.sharedGbps = 6;
    const p = {
      ...emptyProject(),
      devices: [pc, dock, a, b],
      cables: [
        cable(pc, 0, dock, 0),
        cable(dock, 1, a, 0),
        cable(dock, 2, b, 1),
      ],
    };
    const r = simulate(p);
    expect(r.cables[p.cables[0].id].streamCount).toBe(2);
    expect(
      r.findings.some((f) => f.title === "Dock shared bandwidth exceeded"),
    ).toBe(true);
    b.enabled = false;
    expect(
      simulate(p).findings.some(
        (f) => f.title === "Dock shared bandwidth exceeded",
      ),
    ).toBe(false);
  });
  it("does not confirm an unknown cable rating", () => {
    const p = direct();
    p.cables[0].ratingGbps = null;
    const r = simulate(p);
    expect(r.displays[0].status).toBe("uncertain");
    expect(r.findings.some((f) => f.title === "Cable rating unknown")).toBe(
      true,
    );
    expect(r.cables[p.cables[0].id].utilization).toBeNull();
  });
  it("reports VRR / HDR failures, VRR ranges and incomplete DSC parameters", () => {
    const p = direct(),
      s = p.devices[0].ports[0].signal;
    s.vrr = true;
    s.hdr = true;
    p.devices[1].ports[0].caps.vrr = "no";
    p.cables[0].features.hdr = "no";
    let r = simulate(p);
    expect(r.findings.map((f) => f.title)).toContain("VRR unsupported");
    expect(r.findings.map((f) => f.title)).toContain("HDR unsupported");
    p.devices[1].ports[0].caps.vrr = "yes";
    p.devices[1].ports[0].caps.vrrMin = 100;
    expect(simulate(p).findings.map((f) => f.title)).toContain(
      "Outside VRR range",
    );
    s.vrr = false;
    s.hdr = false;
    s.dsc = true;
    r = simulate(p);
    expect(r.displays[0].status).toBe("uncertain");
    expect(r.findings.map((f) => f.title)).toContain("DSC parameters missing");
  });
  it("clears stale findings when a source mode is reduced", () => {
    const p = direct();
    p.devices[0].ports[0].signal = applyTiming(
      p.devices[0].ports[0].signal,
      "4k120",
    );
    p.cables[0].ratingGbps = 18;
    expect(simulate(p).displays[0].status).toBe("incompatible");
    p.devices[0].ports[0].signal = applyTiming(
      p.devices[0].ports[0].signal,
      "1080p60",
    );
    expect(simulate(p).displays[0].status).toBe("supported");
    expect(simulate(p).findings).toHaveLength(0);
  });
  it("keeps custom timing results uncertain without a pixel clock", () => {
    const p = direct();
    const s = p.devices[0].ports[0].signal;
    s.timingId = "custom";
    s.width = 3440;
    s.refresh = 100;
    for (const d of p.devices)
      for (const port of d.ports) port.caps.modes!.push("3440x1080@100");
    let r = simulate(p);
    expect(r.displays[0].status).toBe("uncertain");
    expect(r.cables[p.cables[0].id].utilization).toBeNull();
    s.pixelClockMHz = 400;
    r = simulate(p);
    expect(r.displays[0].status).toBe("supported");
  });
  it("does not hard-fail an unknown DSC rate against uncompressed demand", () => {
    const p = direct();
    p.devices[0].ports[0].signal = {
      ...applyTiming(p.devices[0].ports[0].signal, "4k120"),
      dsc: true,
    };
    const r = simulate(p);
    expect(r.displays[0].status).toBe("uncertain");
    expect(r.cables[p.cables[0].id].demandGbps).toBeNull();
    expect(r.findings.some((f) => f.severity === "error")).toBe(false);
  });
  it("keeps stream-specific failures from poisoning another dock stream", () => {
    const pc = makeDevice("computer");
    pc.ports = [newPort("out", "USB-C")];
    const dock = makeDevice("dock"),
      a = makeDevice("monitor"),
      b = makeDevice("monitor");
    b.selectedInput = b.ports[1].id;
    known(pc, dock, a, b);
    dock.maxStreams = 2;
    dock.sharedGbps = 25;
    pc.ports[0].caps.modes = ["1080p60"];
    dock.ports[2].signal = applyTiming(dock.ports[2].signal, "4k30");
    const p = {
      ...emptyProject(),
      devices: [pc, dock, a, b],
      cables: [
        cable(pc, 0, dock, 0),
        cable(dock, 1, a, 0),
        cable(dock, 2, b, 1),
      ],
    };
    const r = simulate(p);
    expect(r.displays[0].status).toBe("supported");
    expect(r.displays[1].status).toBe("incompatible");
  });
  it("validates explicit adapter conversion along a complete route", () => {
    const pc = makeDevice("computer"),
      adapter = makeDevice("adapter"),
      display = makeDevice("projector");
    known(pc, adapter, display);
    const p = {
      ...emptyProject(),
      devices: [pc, adapter, display],
      cables: [cable(pc, 0, adapter, 0), cable(adapter, 1, display, 0)],
    };
    expect(simulate(p).displays[0].status).toBe("supported");
    adapter.conversion = "no";
    expect(simulate(p).displays[0].status).toBe("incompatible");
  });
});
describe("bandwidth accounting", () => {
  it("uses timing and coding overhead for TMDS; 1080p60 8-bit is 4.455 Gbps", () => {
    const a = makeDevice("console"),
      b = makeDevice("projector");
    known(a, b);
    const bw = bandwidthFor(a.ports[0].signal, a.ports[0], b.ports[0], 18);
    expect(bw.demandGbps).toBeCloseTo(4.455);
    expect(bw.activeVideoGbps).toBeCloseTo(2.985984);
    expect(bw.utilization).toBeCloseTo(4.455 / 18);
  });
  it("updates rate with depth/chroma and keeps HDMI 4:2:2 transport packing separate", () => {
    const a = makeDevice("console"),
      b = makeDevice("projector");
    known(a, b);
    const s = a.ports[0].signal;
    s.bpc = 10;
    expect(bandwidthFor(s, a.ports[0], b.ports[0], 18).demandGbps).toBeCloseTo(
      5.56875,
    );
    s.chroma = "4:2:0";
    expect(bandwidthFor(s, a.ports[0], b.ports[0], 18).demandGbps).toBeCloseTo(
      2.784375,
    );
    s.chroma = "4:2:2";
    expect(bandwidthFor(s, a.ports[0], b.ports[0], 18).demandGbps).toBeCloseTo(
      4.455,
    );
  });
  it("uses explicit compressed bpp without inventing a multiplier", () => {
    const p = direct(),
      s = p.devices[0].ports[0].signal;
    const before = activeVideo(s);
    s.dsc = true;
    expect(activeVideo(s)).toBe(before);
    s.dscBpp = 8;
    expect(activeVideo(s)).toBeCloseTo(before / 3);
    expect(simulate(p).displays[0].status).toBe("uncertain");
  });
  it("uses the documented 4K120 FRL class and withholds payload utilization", () => {
    const a = makeDevice("console"),
      b = makeDevice("projector");
    known(a, b);
    a.ports[0].caps.link = b.ports[0].caps.link = "frl40";
    const s = applyTiming(a.ports[0].signal, "4k120");
    s.bpc = 10;
    const bw = bandwidthFor(s, a.ports[0], b.ports[0], 48);
    expect(bw.demandGbps).toBe(40);
    expect(bw.capacityGbps).toBe(40);
    expect(bw.utilization).toBeNull();
    s.pixelClockMHz = 1188;
    expect(bandwidthFor(s, a.ports[0], b.ports[0], 48).demandGbps).toBeNull();
  });
  it("halves a DP Alt Mode link budget when allocated two instead of four lanes", () => {
    const p = direct();
    const a = p.devices[0].ports[0],
      b = p.devices[1].ports[0];
    const four = bandwidthFor(a.signal, a, b, 32.4);
    a.caps.lanes = 2;
    expect(bandwidthFor(a.signal, a, b, 32.4).capacityGbps).toBeCloseTo(
      four.capacityGbps! / 2,
    );
  });
  it("negotiates actual DP rates rather than inventing a continuous link speed", () => {
    const p = direct();
    const a = p.devices[0].ports[0],
      b = p.devices[1].ports[0];
    expect(bandwidthFor(a.signal, a, b, 18).rawGbps).toBe(10.8);
  });
});
describe("physical editing invariants", () => {
  it("rejects occupied ports, wrong direction, implicit conversions and reversed adapters", () => {
    const p = direct(),
      a = p.devices[0],
      b = p.devices[1];
    expect(
      connectionError(p, a.id, a.ports[0].id, b.id, b.ports[0].id),
    ).toContain("already");
    expect(
      connectionError(p, b.id, b.ports[0].id, a.id, a.ports[0].id),
    ).toContain("output to an input");
    const adapter = makeDevice("adapter");
    p.devices.push(adapter);
    expect(
      connectionError(
        { ...p, cables: [] },
        a.id,
        a.ports[1].id,
        adapter.id,
        adapter.ports[0].id,
      ),
    ).toContain("explicit adapter");
  });
  it("rejects directed cycles", () => {
    const a = makeDevice("switch"),
      b = makeDevice("switch");
    const p = {
      ...emptyProject(),
      devices: [a, b],
      cables: [cable(a, 2, b, 0)],
    };
    expect(
      connectionError(p, b.id, b.ports[2].id, a.id, a.ports[0].id),
    ).toContain("loop");
  });
  it("removes attached cables with a port, keeps stable IDs and clones independently", () => {
    const p = direct(),
      a = p.devices[0],
      old = a.ports[1].id;
    const next = removePort(p, a.id, a.ports[0].id);
    expect(next.cables).toHaveLength(0);
    expect(next.devices[0].ports[0].id).toBe(old);
    expect(p.cables).toHaveLength(1);
    const copy = cloneDevice(a);
    copy.ports[0].caps.version = "Changed";
    expect(a.ports[0].caps.version).toBe("");
    expect(copy.id).not.toBe(a.id);
    expect(copy.ports[0].id).not.toBe(a.ports[0].id);
  });
});
