import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { dockPresets, makeDockDevice, matchesDockPreset } from "./dockPresets";
import { cloneDevice, makeCable, makeDevice } from "./devices";
import { emptyProject, newPort, validateProject } from "./model";
import { compatibleChoices, connectionLibrary, materializeConnection } from "./connections";
import { applyTiming } from "./presets";
import { simulate } from "./engine";
import { loadProject, parseProject, saveProject, serializeProject } from "./persistence";

const preset = dockPresets[0];

function setup() {
  const pc = makeDevice("computer");
  pc.ports = [newPort("out", "USB-C", "USB-C video")];
  pc.ports[0].caps.link = "hbr3";
  const dock = makeDockDevice(preset), a = makeDevice("monitor"), b = makeDevice("monitor");
  const upstream = makeCable(pc, 0, dock, 0);
  upstream.ratingGbps = 16.2;
  const project = {
    ...emptyProject(), devices: [pc, dock, a, b],
    cables: [upstream, makeCable(dock, 1, a, 0), makeCable(dock, 2, b, 0)],
  };
  return { project, pc, dock, upstream };
}

describe("Lenovo ThinkPad USB-C Dock Gen 2 preset", () => {
  it("uses the physical video ports and declared upstream without inventing downstream specs", () => {
    const a = makeDockDevice(preset), b = makeDockDevice(preset);
    expect(a.model).toContain("40AS0090");
    expect(a.ports.map((p) => [p.name, p.direction, p.connector])).toEqual([
      ["USB-C upstream", "in", "USB-C"], ["DP 1", "out", "DisplayPort"],
      ["DP 2", "out", "DisplayPort"], ["HDMI out", "out", "HDMI"],
    ]);
    expect(a.ports[0].caps).toMatchObject({ version: "1.4", link: "hbr3", lanes: 2, dsc: "yes" });
    expect(a.sharedGbps).toBeCloseTo(12.96);
    expect(a.maxStreams).toBe(3);
    expect(a.selectedInput).toBe(a.ports[0].id);
    expect(a.conversion).toBe("yes");
    expect(a.ports.slice(1).map((p) => p.caps.version)).toEqual(["1.4", "1.4", "2.0"]);
    expect(a.ports.slice(1).every((p) => p.caps.link === "unknown")).toBe(true);
    expect(a.ports.every((p) => p.caps.modes === null && p.caps.depths === null && p.caps.hdr === "unknown" && p.caps.vrr === "unknown")).toBe(true);
    expect(a.ports.every((p) => p.signal.timingId === "1080p60" && !p.signal.dsc)).toBe(true);
    expect(new Set([a.id, b.id, ...a.ports.map((p) => p.id), ...b.ports.map((p) => p.id)]).size).toBe(10);
    a.ports[0].caps.dsc = "no";
    a.ports[1].signal.refresh = 144;
    expect(b.ports[0].caps.dsc).toBe("yes");
    expect(makeDockDevice(preset).ports[1].signal.refresh).toBe(60);
    for (const query of ["40AS0090", "40AS0090AU", "40AS0090EU", "Lenovo Gen 2", "03X7609"])
      expect(matchesDockPreset(preset, query)).toBe(true);
    expect(matchesDockPreset(preset, "40AY")).toBe(false);
  });

  it("offers the upstream and each appropriate output in cable-drop choices", () => {
    const pc = makeDevice("computer");
    pc.ports = [newPort("out", "USB-C")];
    const project = { ...emptyProject(), devices: [pc] };
    const origin = { deviceId: pc.id, portId: pc.ports[0].id };
    const choices = compatibleChoices(project, origin, connectionLibrary([])).filter((c) => c.group === "Dock templates");
    expect(choices).toHaveLength(1);
    expect(choices[0].port.name).toBe("USB-C upstream");
    expect(choices[0].keywords).toContain("40AS0090AU");
    const result = materializeConnection(project, origin, choices[0], { x: 500, y: 160 });
    expect(result.device.kind).toBe("dock");
    expect(result.device.selectedInput).toBe(result.port.id);
    expect(result.cable.targetPort).toBe(result.port.id);
    expect(result.device.sharedGbps).toBeCloseTo(12.96);
    expect(() => validateProject(result.project)).not.toThrow();

    const screen = makeDevice("monitor"), p = { ...emptyProject(), devices: [screen] };
    for (const [portIndex, count] of [[0, 2], [1, 1]]) {
      const matches = compatibleChoices(p, { deviceId: screen.id, portId: screen.ports[portIndex].id }, connectionLibrary([]))
        .filter((c) => c.group === "Dock templates");
      expect(matches).toHaveLength(count);
      expect(matches.every((c) => c.port.direction === "out")).toBe(true);
    }
    const console = makeDevice("console");
    expect(compatibleChoices({ ...emptyProject(), devices: [console] }, {
      deviceId: console.id, portId: console.ports[0].id,
    }, connectionLibrary([])).some((c) => c.group === "Dock templates")).toBe(false);
  });

  it("counts independent streams against the shared budget and a slower host without changing their modes", () => {
    const { project, pc, dock, upstream } = setup();
    for (const port of dock.ports.slice(1, 3)) port.signal = applyTiming(port.signal, "4k30");
    const before = structuredClone(project);
    let result = simulate(project);
    expect(result.cables[upstream.id]).toMatchObject({ streamCount: 2, rawGbps: 16.2 });
    expect(result.cables[upstream.id].capacityGbps).toBeCloseTo(12.96);
    expect(result.cables[upstream.id].demandGbps).toBeCloseTo(14.256);
    expect(result.findings.some((f) => f.componentId === dock.id && f.title === "Dock shared bandwidth exceeded")).toBe(true);
    expect(project).toEqual(before);
    dock.ports[2].signal = applyTiming(dock.ports[2].signal, "1080p60");
    result = simulate(project);
    expect(result.findings.some((f) => f.title === "Dock shared bandwidth exceeded")).toBe(false);
    pc.ports[0].caps.link = "hbr2";
    result = simulate(project);
    expect(result.cables[upstream.id].capacityGbps).toBeCloseTo(8.64);
    expect(result.findings.some((f) => f.componentId === upstream.id && f.title === "Connection bandwidth exceeded")).toBe(true);
    expect(dock.ports[1].signal.timingId).toBe("4k30");
  });

  it("leaves DSC rates and downstream behavior unverified instead of assuming 3:1 compression", () => {
    const { project, dock, upstream } = setup();
    for (const p of dock.ports.slice(1, 3)) p.signal = { ...applyTiming(p.signal, "4k60"), dsc: true };
    const before = structuredClone(project);
    const result = simulate(project);
    expect(result.cables[upstream.id].demandGbps).toBeNull();
    expect(result.cables[upstream.id].utilization).toBeNull();
    expect(result.findings.some((f) => f.title === "DSC parameters missing")).toBe(true);
    expect(result.findings.some((f) => f.title === "Dock shared bandwidth exceeded")).toBe(false);
    expect(result.displays.every((d) => d.status === "uncertain")).toBe(true);
    expect(project).toEqual(before);
  });

  it("preserves ports, routing, specifications and personal copies through JSON and browser storage", async () => {
    const { project, dock } = setup();
    dock.position = { x: 400, y: 250 };
    project.templates.push(cloneDevice(dock));
    expect(parseProject(serializeProject(project))).toEqual(project);
    await saveProject(project);
    expect(await loadProject()).toEqual(project);
    project.templates[0].ports[0].caps.lanes = 4;
    expect(dock.ports[0].caps.lanes).toBe(2);
  });
});
