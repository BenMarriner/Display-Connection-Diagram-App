import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  consoleFamilies, consolePresets, makeConsoleDevice, matchesConsolePreset,
} from "./consolePresets";
import { emptyProject, validateProject } from "./model";
import { cloneDevice, makeCable, makeDevice } from "./devices";
import {
  compatibleChoices, connectionLibrary, materializeConnection,
} from "./connections";
import { loadProject, parseProject, saveProject, serializeProject } from "./persistence";
import { simulate } from "./engine";

function preset(id: string) {
  const p = consolePresets.find((p) => p.id === id);
  if (!p) throw new Error(`Missing console: ${id}`);
  return p;
}

describe("console device templates", () => {
  it("covers each major HDMI family and the official retro re-releases", () => {
    expect(new Set(consolePresets.map((p) => p.id)).size).toBe(consolePresets.length);
    expect(new Set(consolePresets.map((p) => p.name)).size).toBe(consolePresets.length);
    expect(consoleFamilies.map((family) => consolePresets.filter((p) => p.family === family).length))
      .toEqual([4, 12, 10, 11]);
    for (const id of [
      "ps3-original", "ps3-slim", "ps3-super-slim", "ps4-original", "ps4-slim", "ps4-pro",
      "ps5-original", "ps5-digital", "ps5-slim", "ps5-slim-digital", "ps5-pro", "playstation-tv",
      "xbox-360-hdmi", "xbox-360-s", "xbox-360-e", "xbox-one", "xbox-one-s",
      "xbox-one-s-all-digital", "xbox-one-x", "xbox-series-x", "xbox-series-x-digital", "xbox-series-s",
      "nintendo-wii-u", "nintendo-switch-docked", "nintendo-switch-oled-docked", "nintendo-switch-2-docked",
      "nes-classic", "snes-classic", "playstation-classic", "sega-genesis-mini", "sega-genesis-mini-2",
      "turbografx-mini", "atari-2600-plus", "atari-7800-plus", "atari-vcs", "neogeo-mini", "neogeo-arcade-stick-pro",
    ]) expect(preset(id)).toBeDefined();
    expect(consolePresets.some((p) => /Switch Lite|^Nintendo Wii$|^Sony PlayStation 2$/.test(p.name))).toBe(false);
  });

  it("creates independent, sourced, editable device snapshots without inferring link rates", () => {
    const allIds = new Set<string>();
    for (const p of consolePresets) {
      const a = makeConsoleDevice(p, { x: 200, y: 350 });
      const b = makeConsoleDevice(p);
      expect(a.kind).toBe("console");
      expect(a.position).toEqual({ x: 200, y: 350 });
      expect(a.maxStreams).toBe(1);
      expect(a.specUrl).toBe(p.sourceUrl);
      expect(new URL(a.specUrl).protocol).toBe("https:");
      expect(a.notes).toContain(p.checked);
      expect(a.ports.filter((port) => port.direction === "out")).toHaveLength(1);
      for (const [i, port] of a.ports.entries()) {
        expect(allIds.has(port.id)).toBe(false);
        allIds.add(port.id);
        expect(port.id).not.toBe(b.ports[i].id);
        expect(port.connector).toBe("HDMI");
        expect(port.protocol).toBe("HDMI");
        expect(port.caps.link).toBe("unknown");
        expect(port.caps.modes).toBeNull();
        expect(port.caps.depths).toBeNull();
        expect(port.signal).toMatchObject({ bpc: 8, chroma: "RGB", hdr: false, vrr: false, dsc: false });
        port.signal.refresh = 24;
        port.caps.version = "changed";
        expect(b.ports[i].signal.refresh).toBe(60);
        expect(b.ports[i].caps.version).not.toBe("changed");
      }
      expect(() => validateProject({ ...emptyProject(), devices: [a, b] })).not.toThrow();
    }
    const sw = preset("nintendo-switch-docked");
    makeConsoleDevice(sw).ports[0].caps.formats!.push("4:2:0");
    expect(makeConsoleDevice(sw).ports[0].caps.formats).toEqual(["RGB"]);
    expect(sw.caps?.formats).toEqual(["RGB"]);
  });

  it("captures model-specific HDR, VRR and DSC capabilities while preserving SDR defaults", () => {
    const output = (id: string) => makeConsoleDevice(preset(id)).ports.find((p) => p.direction === "out")!;
    expect(output("ps3-original").caps).toMatchObject({ hdr: "no", vrr: "no" });
    expect(output("ps4-original").caps.hdr).toBe("yes");
    expect(output("ps4-pro").caps).toMatchObject({ hdr: "yes", vrr: "no" });
    expect(output("xbox-one").caps).toMatchObject({ version: "1.4b", hdr: "no" });
    expect(output("xbox-one-s").caps).toMatchObject({ version: "2.0a", hdr: "yes", vrr: "yes" });
    expect(output("xbox-one-x").caps.version).toBe("2.0b");
    expect(output("xbox-series-s").caps).toMatchObject({ version: "2.1", hdr: "yes", vrr: "yes" });
    expect(output("ps5-original").caps.dsc).toBe("unknown");
    expect(output("ps5-pro").caps.dsc).toBe("yes");
    expect(output("ps5-pro").signal.dsc).toBe(false);
    expect(output("nintendo-switch-2-docked").caps).toMatchObject({ hdr: "yes", vrr: "yes", vrrMax: 120, vrrMin: null });
    expect(output("nintendo-switch-oled-docked").caps.hdr).toBe("no");
    expect(output("playstation-tv").signal).toMatchObject({ width: 1280, height: 720 });
    expect(output("playstation-classic").signal).toMatchObject({ width: 1280, height: 720 });
  });

  it("keeps Xbox One HDMI inputs distinct from independent console outputs", () => {
    for (const id of ["xbox-one", "xbox-one-s", "xbox-one-s-all-digital", "xbox-one-x"]) {
      const d = makeConsoleDevice(preset(id));
      expect(d.ports.map((p) => p.direction)).toEqual(["in", "out"]);
      expect(d.ports[0].caps.version).toBe("1.4b");
      expect(d.notes).toContain("pass-through is not simulated");
      expect(d.selectedInput).toBeNull();
    }
    for (const id of ["xbox-series-x", "xbox-series-s", "xbox-360-s"]) {
      expect(makeConsoleDevice(preset(id)).ports.map((p) => p.direction)).toEqual(["out"]);
    }
    const upstream = makeConsoleDevice(preset("ps5-original"));
    const xbox = makeConsoleDevice(preset("xbox-one"));
    const screen = makeDevice("monitor");
    screen.selectedInput = screen.ports[1].id;
    const project = {
      ...emptyProject(), devices: [upstream, xbox, screen],
      cables: [makeCable(upstream, 0, xbox, 0), makeCable(xbox, 1, screen, 1)],
    };
    expect(() => validateProject(project)).not.toThrow();
    const result = simulate(project);
    expect(result.cables[project.cables[0].id].status).toBe("inactive");
    expect(result.cables[project.cables[1].id].status).not.toBe("inactive");
  });

  it("supports common abbreviations and regional console names in library search", () => {
    for (const [query, id] of [
      ["PS5 slim digital", "ps5-slim-digital"], ["PSTV", "playstation-tv"],
      ["Famicom mini", "nes-classic"], ["Super NES Classic", "snes-classic"],
      ["Mega Drive Mini 2", "sega-genesis-mini-2"], ["TG16", "turbografx-mini"],
      ["HEG-001", "nintendo-switch-oled-docked"], ["Switch2", "nintendo-switch-2-docked"],
    ]) expect(matchesConsolePreset(preset(id), query)).toBe(true);
    expect(matchesConsolePreset(preset("ps4-original"), "PS5")).toBe(false);
    expect(matchesConsolePreset(preset("xbox-one-x"), "Xbox One X")).toBe(true);
    expect(matchesConsolePreset(preset("xbox-one-s"), "Xbox One X")).toBe(false);
    expect(matchesConsolePreset(preset("xbox-series-s"), "Series X")).toBe(false);
  });

  it("offers console outputs from display inputs, and only Xbox One TV inputs from HDMI sources", () => {
    const screen = makeDevice("monitor");
    const project = { ...emptyProject(), devices: [screen] };
    const origin = { deviceId: screen.id, portId: screen.ports[1].id };
    const choices = compatibleChoices(project, origin, connectionLibrary([]));
    expect(choices.filter((c) => c.group === "Console templates")).toHaveLength(consolePresets.length);
    const choice = choices.find((c) => c.label === preset("nintendo-switch-2-docked").name)!;
    expect(choice.keywords).toContain("Switch2");
    const result = materializeConnection(project, origin, choice, { x: 500, y: 100 });
    expect(result.device.kind).toBe("console");
    expect(result.port.caps.vrr).toBe("yes");
    expect(result.cable.targetPort).toBe(origin.portId);
    expect(() => validateProject(result.project)).not.toThrow();
    const computer = makeDevice("computer");
    const sourceProject = { ...emptyProject(), devices: [computer] };
    const inputs = compatibleChoices(sourceProject, {
      deviceId: computer.id, portId: computer.ports[1].id,
    }, connectionLibrary([])).filter((c) => c.group === "Console templates");
    expect(inputs).toHaveLength(4);
    expect(inputs.every((c) => c.port.direction === "in" && c.port.name === "HDMI in (TV)")).toBe(true);
  });

  it("reports unsupported requested features without changing a console's signal", () => {
    const ps3 = makeConsoleDevice(preset("ps3-original"));
    const screen = makeDevice("monitor");
    screen.selectedInput = screen.ports[1].id;
    ps3.ports[0].signal.vrr = true;
    const project = { ...emptyProject(), devices: [ps3, screen], cables: [makeCable(ps3, 0, screen, 1)] };
    const before = structuredClone(project);
    const result = simulate(project);
    expect(result.findings.some((f) => f.componentId === ps3.ports[0].id && f.title === "VRR unsupported")).toBe(true);
    expect(project).toEqual(before);
  });

  it("round-trips console wiring, notes, capabilities and independent personal templates", async () => {
    const devices = consolePresets.map((p, i) => makeConsoleDevice(p, { x: i * 150, y: 50 }));
    const templates = devices.map((d) => cloneDevice(d));
    const screen = makeDevice("monitor");
    screen.selectedInput = screen.ports[1].id;
    const xbox = devices.find((d) => d.model === preset("xbox-one-x").name)!;
    const project = {
      ...emptyProject(), devices: [...devices, screen], templates,
      cables: [makeCable(xbox, 1, screen, 1)],
    };
    expect(parseProject(serializeProject(project))).toEqual(project);
    await saveProject(project);
    expect(await loadProject()).toEqual(project);
    templates[0].ports[0].caps.hdr = "yes";
    expect(devices[0].ports[0].caps.hdr).toBe("no");
    expect(makeConsoleDevice(preset("nintendo-wii-u")).ports[0].caps.hdr).toBe("no");
  });
});
