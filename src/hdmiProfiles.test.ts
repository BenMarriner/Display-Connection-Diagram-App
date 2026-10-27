import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { makeCable, makeDevice } from "./devices";
import { applyPortTemplate, starterPortTemplates } from "./portSpecs";
import { emptyProject, newPort } from "./model";
import { applyTiming, links, timings } from "./presets";
import { bandwidthFor, simulate } from "./engine";
import { loadProject, parseProject, saveProject, serializeProject } from "./persistence";

function profile(key: string) {
  const template = starterPortTemplates.find((t) => t.id === `builtin:${key}`);
  if (!template) throw new Error(`Missing profile: ${key}`);
  return template;
}

function hdmiSetup(sourceKey: string, targetKey: string, ratingGbps: number | null) {
  const source = makeDevice("console"), screen = makeDevice("projector");
  source.ports[0] = applyPortTemplate(source.ports[0], profile(sourceKey));
  screen.ports[0] = applyPortTemplate(screen.ports[0], profile(targetKey));
  // Known test hardware separates transport validation from unentered specs.
  for (const device of [source, screen]) {
    device.ports[0].caps = {
      ...device.ports[0].caps,
      modes: [...timings.map((t) => t.id), "3840x2160@240", "3840x2160@300"],
      depths: [8, 10, 12], formats: ["RGB", "4:4:4", "4:2:2", "4:2:0"],
      hdr: "yes", vrr: "yes", dsc: "yes",
    };
  }
  const cable = makeCable(source, 0, screen, 0);
  cable.ratingGbps = ratingGbps;
  cable.features = { hdr: "yes", vrr: "yes", dsc: "yes" };
  return { ...emptyProject(), devices: [source, screen], cables: [cable] };
}

describe("legacy HDMI and HDMI 2.2 profiles", () => {
  it("keeps the 4.95 Gbps label exact and exposes separate 2.2 rates", () => {
    const legacy = profile("hdmi5");
    expect(legacy.name).toBe("HDMI 1.0–1.2a · 4.95 Gbps");
    expect(legacy.spec.caps).toMatchObject({ version: "1.0–1.2a", link: "tmds5" });
    expect(legacy.description).toContain("Standard HDMI is a cable category");
    expect(links.tmds5.raw).toBe(4.95);
    for (const rate of [64, 80, 96]) {
      const t = profile(`hdmi${rate}`);
      expect(t.name).toBe(`HDMI 2.2 · ${rate} Gbps`);
      expect(t.spec.caps.version).toBe("2.2");
      expect(links[t.spec.caps.link].raw).toBe(rate);
      expect(t.spec.caps).toMatchObject({ modes: null, depths: null, formats: null, vrr: "unknown", hdr: "unknown", dsc: "unknown" });
      expect(t.includeSignal).toBe(false);
    }
  });

  it("supports 1080p60 at 4.95 Gbps and rejects higher demand without changing the request", () => {
    const p = hdmiSetup("hdmi5", "hdmi96", 96);
    let result = simulate(p);
    const bw = result.cables[p.cables[0].id];
    expect(bw.rawGbps).toBe(4.95);
    expect(bw.demandGbps).toBeCloseTo(4.455);
    expect(bw.utilization).toBeCloseTo(4.455 / 4.95);
    expect(result.displays[0].status).toBe("supported");
    p.devices[0].ports[0].signal = applyTiming(p.devices[0].ports[0].signal, "4k30");
    const requested = structuredClone(p.devices[0].ports[0].signal);
    result = simulate(p);
    expect(result.displays[0].status).toBe("incompatible");
    expect(result.cables[p.cables[0].id].capacityGbps).toBe(4.95);
    expect(p.devices[0].ports[0].signal).toEqual(requested);
  });

  it("retains 64/80/96 Gbps ceilings and negotiates discrete rates across mixed links", () => {
    const a = applyPortTemplate(newPort("out", "HDMI"), profile("hdmi96"));
    const b = applyPortTemplate(newPort("in", "HDMI"), profile("hdmi80"));
    const signal = { ...applyTiming(a.signal, "4k120"), timingId: "custom", refresh: 240, pixelClockMHz: 2376 };
    expect(bandwidthFor(signal, a, b, 96).rawGbps).toBe(80);
    expect(bandwidthFor(signal, a, b, 64).rawGbps).toBe(64);
    expect(bandwidthFor(signal, a, b, 60).rawGbps).toBe(48);
    b.caps.link = "frl96";
    expect(bandwidthFor(signal, a, b, 96).rawGbps).toBe(96);
    b.caps.link = "frl40";
    expect(bandwidthFor(signal, a, b, 96).rawGbps).toBe(40);
  });

  it("uses the verified lower-rate FRL table for 4K120 without inventing utilization", () => {
    const p = hdmiSetup("hdmi96", "hdmi64", 96);
    const out = p.devices[0].ports[0];
    out.signal = { ...applyTiming(out.signal, "4k120"), bpc: 10 };
    let result = simulate(p);
    const bw = result.cables[p.cables[0].id];
    expect(bw.rawGbps).toBe(64);
    expect(bw.demandGbps).toBe(40);
    expect(bw.capacityGbps).toBe(48);
    expect(bw.basis).toContain("legacy FRL fallback");
    expect(bw.utilization).toBeNull();
    expect(result.displays[0].status).toBe("supported");
    p.cables[0].ratingGbps = 32;
    result = simulate(p);
    expect(result.displays[0].status).toBe("incompatible");
    expect(result.cables[p.cables[0].id].capacityGbps).toBe(32);
  });

  it("keeps higher-rate packing unverified instead of applying an old payload multiplier", () => {
    const p = hdmiSetup("hdmi64", "hdmi96", 96);
    p.devices[0].ports[0].signal = {
      ...applyTiming(p.devices[0].ports[0].signal, "4k120"),
      timingId: "custom", refresh: 240, pixelClockMHz: 2376, bpc: 10,
    };
    const result = simulate(p), bw = result.cables[p.cables[0].id];
    expect(bw.rawGbps).toBe(64);
    expect(bw.activeVideoGbps).toBeGreaterThan(64 * 16 / 18);
    expect(bw.activeVideoGbps).toBeLessThan(64);
    expect(bw.demandGbps).toBeNull();
    expect(bw.capacityGbps).toBeNull();
    expect(bw.utilization).toBeNull();
    expect(result.displays[0].status).toBe("uncertain");
    expect(result.findings.some((f) => f.severity === "error")).toBe(false);
    expect(result.findings.some((f) => f.title === "Transport bandwidth needs verification")).toBe(true);
    p.devices[0].ports[0].signal.refresh = 300;
    expect(simulate(p).findings.some((f) => f.title === "Active video exceeds payload ceiling")).toBe(true);
  });

  it("does not confirm unknown cable ratings or automatically enable optional features", () => {
    const p = hdmiSetup("hdmi96", "hdmi96", null);
    const result = simulate(p);
    expect(result.displays[0].status).toBe("uncertain");
    expect(result.cables[p.cables[0].id].utilization).toBeNull();
    const out = newPort("out", "HDMI");
    out.signal = { ...applyTiming(out.signal, "4k120"), bpc: 12, vrr: true };
    const before = structuredClone(out);
    const after = applyPortTemplate(out, profile("hdmi96"));
    expect(after.signal).toEqual(before.signal);
    expect(after.caps).toMatchObject({ vrr: "unknown", hdr: "unknown", dsc: "unknown" });
  });

  it("round-trips new profiles through JSON and IndexedDB with stable wiring", async () => {
    const p = hdmiSetup("hdmi5", "hdmi96", 4.95);
    for (const key of ["hdmi5", "hdmi64", "hdmi80", "hdmi96"]) {
      const device = makeDevice("console");
      device.ports[0] = applyPortTemplate(device.ports[0], profile(key));
      p.devices.push(device);
      p.portTemplates.push(structuredClone(profile(key)));
    }
    expect(parseProject(serializeProject(p))).toEqual(p);
    await saveProject(p);
    expect(await loadProject()).toEqual(p);
    const invalid = structuredClone(p);
    invalid.devices[2].ports[0].connector = "DisplayPort";
    invalid.devices[2].ports[0].protocol = "DisplayPort";
    expect(() => parseProject(serializeProject(invalid))).toThrow("profile");
  });
});
