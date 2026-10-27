import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { emptyProject, newPort, validateProject } from "./model";
import { exampleProject, makeDevice, makeCable } from "./devices";
import {
  addDevicePort,
  applyPortTemplate,
  applyTemplateToDevice,
  duplicatePort,
  savePortTemplate,
  starterPortTemplates,
} from "./portSpecs";
import { gpuPresets, makeGpuDevice, replaceGpuOutputs } from "./gpuPresets";
import {
  compatibleChoices,
  connectionLibrary,
  materializeConnection,
} from "./connections";
import {
  loadProject,
  saveProject,
  parseProject,
  serializeProject,
} from "./persistence";
import { simulate } from "./engine";

describe("fast port authoring", () => {
  it("adds repeated ports with unique names and IDs without changing previous ports", () => {
    const d = makeDevice("computer");
    const before = structuredClone(d);
    const a = addDevicePort(d, "out", "HDMI"),
      b = addDevicePort(a, "out", "HDMI");
    expect(b.ports.map((p) => p.name)).toEqual([
      "DP 1",
      "HDMI 1",
      "HDMI out 1",
      "HDMI out 2",
    ]);
    expect(new Set(b.ports.map((p) => p.id)).size).toBe(4);
    expect(d).toEqual(before);
  });
  it("deep-copies specifications and signal while leaving the original cable attached", () => {
    const p = exampleProject(),
      d = p.devices[0],
      original = d.ports[0];
    const next = duplicatePort(d, original.id),
      copied = next.ports[1];
    expect(copied.id).not.toBe(original.id);
    expect(copied.caps).toEqual(original.caps);
    expect(copied.signal).toEqual(original.signal);
    copied.caps.version = "changed";
    copied.signal.refresh = 75;
    expect(original.caps.version).not.toBe("changed");
    expect(original.signal.refresh).toBe(144);
    expect(p.cables[0].sourcePort).toBe(original.id);
    const twice = duplicatePort(next, original.id);
    expect(new Set(twice.ports.map((p) => p.name)).size).toBe(
      twice.ports.length,
    );
  });
  it("refuses to add or duplicate beyond the supported port count", () => {
    const d = makeDevice("computer");
    d.ports = Array.from({ length: 64 }, () => newPort("out"));
    expect(() => addDevicePort(d, "out", "HDMI")).toThrow("64");
    expect(() => duplicatePort(d, d.ports[0].id)).toThrow("64");
  });
  it("applies custom specs to every matching port with independent snapshots and stable wiring", () => {
    const p = exampleProject(),
      d = p.devices[0];
    d.ports.push(newPort("out", "DisplayPort", "Second DP"));
    const t = savePortTemplate(d.ports[0], "My gaming DP");
    t.spec.caps.version = "Custom DP";
    const next = applyTemplateToDevice(d, t);
    expect(next.ports[0].id).toBe(d.ports[0].id);
    expect(next.ports[0].name).toBe(d.ports[0].name);
    expect(next.ports[1]).toBe(d.ports[1]);
    expect(next.ports[2].caps.version).toBe("Custom DP");
    next.ports[2].caps.version = "Independent";
    expect(next.ports[0].caps.version).toBe("Custom DP");
    expect(t.spec.caps.version).toBe("Custom DP");
    expect(
      validateProject({
        ...p,
        devices: [next, ...p.devices.slice(1)],
        portTemplates: [t],
      }).cables,
    ).toEqual(p.cables);
  });
  it("preserves an existing transmitted mode for transport-only starter templates", () => {
    const p = exampleProject().devices[0].ports[0],
      t = starterPortTemplates.find((t) => t.id === "builtin:dp20")!;
    const after = applyPortTemplate(p, t);
    expect(after.signal).toEqual(p.signal);
    expect(after.caps.link).toBe("uhbr20");
    expect(() => applyPortTemplate(newPort("in", "HDMI"), t)).toThrow(
      "same connector",
    );
  });
  it("round-trips port templates and migrates old v1 project files without them", async () => {
    const p = exampleProject();
    p.portTemplates.push(savePortTemplate(p.devices[0].ports[0], "Work DP"));
    expect(parseProject(serializeProject(p)).portTemplates).toEqual(
      p.portTemplates,
    );
    await saveProject(p);
    expect((await loadProject())?.portTemplates).toEqual(p.portTemplates);
    const legacy = JSON.parse(serializeProject(p));
    delete legacy.portTemplates;
    expect(parseProject(JSON.stringify(legacy)).portTemplates).toEqual([]);
    p.portTemplates[0].spec.protocol = "HDMI";
    expect(() => parseProject(serializeProject(p))).toThrow("inconsistent");
  });
});

describe("context-sensitive connections", () => {
  it("offers only the correct connector/protocol/direction and excludes occupied and same-device ports", () => {
    const p = exampleProject();
    p.cables = [];
    const d = p.devices[0],
      origin = { deviceId: d.id, portId: d.ports[1].id };
    const choices = compatibleChoices(p, origin, connectionLibrary([]));
    expect(choices.length).toBeGreaterThan(0);
    expect(
      choices.every(
        (c) => c.port.direction === "in" && c.port.protocol === "HDMI",
      ),
    ).toBe(true);
    expect(choices.some((c) => !c.create && c.device.id === d.id)).toBe(false);
    expect(
      choices.some(
        (c) =>
          c.create &&
          c.device.kind === "adapter" &&
          c.port.connector === "HDMI",
      ),
    ).toBe(true);
    const taken = choices.find((c) => !c.create)!;
    const change = materializeConnection(p, origin, taken, { x: 500, y: 300 });
    expect(
      compatibleChoices(change.project, origin, connectionLibrary([])),
    ).toHaveLength(0);
  });
  it("creates a node plus cable atomically and selects the matching new input", () => {
    const computer = makeDevice("computer"),
      p = { ...emptyProject(), devices: [computer] },
      origin = { deviceId: computer.id, portId: computer.ports[1].id };
    const choice = compatibleChoices(p, origin, connectionLibrary([])).find(
      (c) => c.create && c.device.kind === "monitor",
    )!;
    const result = materializeConnection(p, origin, choice, { x: 500, y: 100 });
    expect(result.project.devices).toHaveLength(2);
    expect(result.project.cables).toHaveLength(1);
    expect(p.devices).toHaveLength(1);
    expect(p.cables).toHaveLength(0);
    expect(result.device.selectedInput).toBe(result.port.id);
    expect(result.port.connector).toBe("HDMI");
    expect(result.cable.targetPort).toBe(result.port.id);
    expect(result.device.id).not.toBe(choice.device.id);
    expect(() => validateProject(result.project)).not.toThrow();
  });
  it("supports starting from an input and spawning an upstream GPU computer", () => {
    const display = makeDevice("monitor"),
      p = { ...emptyProject(), devices: [display] },
      origin = { deviceId: display.id, portId: display.ports[0].id };
    const choice = compatibleChoices(p, origin, connectionLibrary([])).find(
      (c) => c.group === "GPU computers" && c.port.connector === "DisplayPort",
    )!;
    const result = materializeConnection(p, origin, choice, { x: 50, y: 100 });
    expect(result.cable.sourceDevice).toBe(result.device.id);
    expect(result.cable.targetDevice).toBe(display.id);
    expect(result.port.direction).toBe("out");
  });
  it("excludes routes that would create a physical cycle", () => {
    const a = makeDevice("switch"),
      b = makeDevice("switch");
    const p = {
      ...emptyProject(),
      devices: [a, b],
      cables: [makeCable(a, 2, b, 0)],
    };
    const choices = compatibleChoices(
      p,
      { deviceId: b.id, portId: b.ports[2].id },
      [],
    );
    expect(choices.some((c) => c.device.id === a.id)).toBe(false);
  });
});

describe("GPU output layouts", () => {
  it("ships sourced board-specific profiles with independent ports", () => {
    for (const preset of gpuPresets) {
      const a = makeGpuDevice(preset),
        b = makeGpuDevice(preset);
      expect(a.ports.length).toBeGreaterThan(0);
      expect(preset.sourceUrl).toMatch(/^https:/);
      expect(a.ports[0].id).not.toBe(b.ports[0].id);
      expect(a.maxStreams).toBe(preset.maxDisplays);
    }
    const amd = makeGpuDevice(
      gpuPresets.find((g) => g.id === "sapphire-pulse-9070xt")!,
    );
    expect(amd.ports.filter((p) => p.connector === "HDMI")).toHaveLength(2);
    expect(amd.ports[0].caps.link).toBe("unknown");
    const nv = makeGpuDevice(gpuPresets[0]);
    expect(nv.ports[0].caps.link).toBe("uhbr20");
    expect(nv.ports[0].caps.modes).toBeNull();
  });
  it("retains inputs, matching cabled output IDs, custom names and source modes", () => {
    const p = exampleProject(),
      pc = p.devices[0];
    const extra = newPort("in", "HDMI", "Capture input");
    pc.ports.push(extra);
    pc.selectedInput = extra.id;
    const old = structuredClone(pc);
    const result = replaceGpuOutputs(p, pc.id, gpuPresets[0]);
    const updated = result.project.devices[0];
    expect(result.disconnected).toBe(0);
    expect(updated.ports.find((o) => o.id === old.ports[0].id)?.signal).toEqual(
      old.ports[0].signal,
    );
    expect(updated.ports[0]).toEqual(extra);
    expect(updated.selectedInput).toBe(extra.id);
    expect(result.project.cables).toEqual(p.cables);
    expect(p.devices[0]).toEqual(old);
  });
  it("removes only cables on excess outputs when replacing a layout", () => {
    const pc = makeDevice("computer");
    pc.ports = Array.from({ length: 4 }, (_, i) =>
      newPort("out", "DisplayPort", `DP ${i + 1}`),
    );
    const display = makeDevice("monitor");
    const p = {
      ...emptyProject(),
      devices: [pc, display],
      cables: [makeCable(pc, 3, display, 0)],
    };
    const result = replaceGpuOutputs(p, pc.id, gpuPresets[0]);
    expect(result.disconnected).toBe(1);
    expect(result.project.cables).toHaveLength(0);
    expect(p.cables).toHaveLength(1);
  });
  it("enforces declared GPU stream limits without counting splitter copies twice", () => {
    const pc = makeDevice("console"),
      split = makeDevice("splitter"),
      a = makeDevice("projector"),
      b = makeDevice("projector");
    pc.maxStreams = 1;
    const p = {
      ...emptyProject(),
      devices: [pc, split, a, b],
      cables: [
        makeCable(pc, 0, split, 0),
        makeCable(split, 1, a, 0),
        makeCable(split, 2, b, 0),
      ],
    };
    expect(
      simulate(p).findings.some(
        (f) => f.title === "Source display stream limit exceeded",
      ),
    ).toBe(false);
    const second = newPort("out", "HDMI", "Second source");
    pc.ports.push(second);
    p.cables[2] = makeCable(pc, 1, b, 0);
    expect(
      simulate(p).findings.some(
        (f) => f.title === "Source display stream limit exceeded",
      ),
    ).toBe(true);
  });
});
