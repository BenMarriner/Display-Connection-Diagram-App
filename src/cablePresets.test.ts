import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { applyCablePreset, cablePresetMatches, cablePresets, cableProtocol } from "./cablePresets";
import { makeCable, makeDevice } from "./devices";
import { emptyProject, newPort, type Port } from "./model";
import { applyTiming, timings } from "./presets";
import { bandwidthFor, simulate } from "./engine";
import { loadProject, parseProject, saveProject, serializeProject } from "./persistence";

function preset(id: string) {
  const found = cablePresets.find((p) => p.id === id);
  if (!found) throw new Error(`Missing cable preset: ${id}`);
  return found;
}

function direct(protocol: Port["protocol"] = "DisplayPort") {
  const pc = makeDevice("computer"), screen = makeDevice("monitor");
  pc.ports = [newPort("out", protocol)];
  screen.ports = [newPort("in", protocol)];
  screen.selectedInput = screen.ports[0].id;
  for (const p of [pc.ports[0], screen.ports[0]]) {
    p.caps = { ...p.caps, link: protocol === "HDMI" ? "frl96" : "uhbr20",
      modes: timings.map((t) => t.id), depths: [8, 10, 12], formats: ["RGB"],
      hdr: "yes", vrr: "yes", dsc: "yes" };
  }
  const cable = makeCable(pc, 0, screen, 0);
  cable.name = "My desk cable";
  cable.lengthM = 1.5;
  cable.notes = "Runs behind the desk.";
  cable.features = { hdr: "yes", vrr: "unknown", dsc: "no" };
  return { ...emptyProject(), devices: [pc, screen], cables: [cable] };
}

describe("standard HDMI and DisplayPort cable templates", () => {
  it("provides official categories with separate raw and per-lane ratings", () => {
    expect(new Set(cablePresets.map((p) => p.id)).size).toBe(cablePresets.length);
    expect(cablePresets.filter((p) => p.protocol === "HDMI")).toHaveLength(5);
    expect(cablePresets.filter((p) => p.protocol === "DisplayPort")).toHaveLength(6);
    expect(preset("hdmi-standard").ratingGbps).toBeNull();
    expect(preset("hdmi-standard").description).toContain("4.95");
    expect(["hdmi-high-speed", "hdmi-premium", "hdmi-ultra", "hdmi-ultra96"].map((id) => preset(id).ratingGbps))
      .toEqual([10.2, 18, 48, 96]);
    expect(preset("dp40").description).toContain("validated existing DP40 cables for DP54");
    for (const p of cablePresets.filter((p) => p.protocol === "DisplayPort"))
      expect(p.ratingGbps).toBeCloseTo(p.dpLaneGbps! * 4);
    expect(cablePresets.every((p) => p.sourceUrl.startsWith("https://"))).toBe(true);
  });

  it("keeps wiring, custom labels, lengths, notes and entered features intact in one change", () => {
    const project = direct(), before = structuredClone(project);
    const result = applyCablePreset(project, project.cables[0], preset("dp8k"));
    expect(result).toEqual({ ...before.cables[0], presetId: "dp8k", ratingGbps: 32.4, dpLaneGbps: 8.1 });
    expect(project).toEqual(before);
    expect(cablePresetMatches(result, preset("dp8k"))).toBe(true);
    expect(cablePresetMatches({ ...result, ratingGbps: 80 }, preset("dp8k"))).toBe(false);
    expect(cablePresetMatches({ ...result, dpLaneGbps: 20 }, preset("dp8k"))).toBe(false);
    expect(cablePresetMatches({ ...result, presetId: null }, preset("dp8k"))).toBe(false);
    expect(() => applyCablePreset(project, project.cables[0], preset("hdmi-premium"))).toThrow("protocol");
    expect(cableProtocol({ ...project, devices: [] }, project.cables[0])).toBeNull();
  });

  it("limits two-lane USB-C links by the cable's lane rate as well as its full-width rating", () => {
    const project = direct(), [a, b] = project.devices.map((d) => d.ports[0]);
    a.connector = b.connector = "USB-C";
    a.caps.lanes = b.caps.lanes = 2;
    for (const [id, rate] of [["dp-standard", 10.8], ["dp8k", 16.2], ["dp40", 20], ["dp54", 27], ["dp80", 40], ["dp80ll", 40]] as const) {
      const c = applyCablePreset(project, project.cables[0], preset(id));
      const result = bandwidthFor(a.signal, a, b, c.ratingGbps, c.dpLaneGbps);
      expect(result.rawGbps).toBeCloseTo(rate);
      if (id === "dp8k") {
        expect(result.capacityGbps).toBeCloseTo(12.96);
        expect(result.basis).toContain("8b/10b");
      }
      project.cables[0] = c;
      expect(simulate(project).cables[c.id].rawGbps).toBeCloseTo(rate);
    }
  });

  it("identifies the cable bottleneck and clears it when an adequate DP template is applied", () => {
    const project = direct(), output = project.devices[0].ports[0];
    output.signal = applyTiming(output.signal, "4k120");
    const requested = structuredClone(output.signal);
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("dp8k"));
    let result = simulate(project);
    expect(result.findings.some((f) => f.componentId === project.cables[0].id && f.title === "Connection bandwidth exceeded")).toBe(true);
    expect(result.displays[0].status).toBe("incompatible");
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("dp54"));
    result = simulate(project);
    expect(result.findings.some((f) => f.title === "Connection bandwidth exceeded")).toBe(false);
    expect(result.displays[0].status).toBe("supported");
    expect(output.signal).toEqual(requested);
  });

  it("handles HDMI categories without inventing Standard cable bandwidth or optional features", () => {
    const project = direct("HDMI"), output = project.devices[0].ports[0];
    output.signal = applyTiming(output.signal, "4k60");
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("hdmi-high-speed"));
    expect(simulate(project).displays[0].status).toBe("incompatible");
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("hdmi-premium"));
    expect(simulate(project).displays[0].status).toBe("supported");
    project.cables[0].features = { hdr: "unknown", vrr: "unknown", dsc: "unknown" };
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("hdmi-ultra96"));
    expect(project.cables[0].features).toEqual({ hdr: "unknown", vrr: "unknown", dsc: "unknown" });
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("hdmi-standard"));
    const result = simulate(project);
    expect(result.findings.some((f) => f.title === "Cable rating unknown")).toBe(true);
    expect(result.displays[0].status).toBe("uncertain");
    expect(output.signal.timingId).toBe("4k60");
  });

  it("round-trips templates and lane limits while retaining support for older version-1 projects", async () => {
    const project = direct();
    project.cables[0] = applyCablePreset(project, project.cables[0], preset("dp80ll"));
    expect(parseProject(serializeProject(project))).toEqual(project);
    await saveProject(project);
    expect(await loadProject()).toEqual(project);
    const legacy = structuredClone(project);
    delete legacy.cables[0].presetId;
    delete legacy.cables[0].dpLaneGbps;
    expect(parseProject(serializeProject(legacy))).toEqual(legacy);
    const invalid = direct("HDMI");
    invalid.cables[0].dpLaneGbps = 8.1;
    expect(() => parseProject(serializeProject(invalid))).toThrow("DisplayPort");
    invalid.cables[0].dpLaneGbps = 25;
    expect(() => parseProject(serializeProject(invalid))).toThrow("Invalid project");
  });
});
