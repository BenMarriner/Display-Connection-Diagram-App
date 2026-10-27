import { describe, expect, it } from "vitest";
import { gpuPresets, makeGpuDevice, replaceGpuOutputs } from "./gpuPresets";
import { defaultSignal, emptyProject, newPort, validateProject } from "./model";
import { makeCable, makeDevice } from "./devices";
import { links } from "./presets";
import { parseProject, serializeProject } from "./persistence";
import { simulate } from "./engine";
import {
  compatibleChoices,
  connectionLibrary,
  materializeConnection,
} from "./connections";

function preset(id: string) {
  const found = gpuPresets.find((p) => p.id === id);
  if (!found) throw new Error(`Missing GPU preset: ${id}`);
  return found;
}

describe("GPU catalogue integrity", () => {
  it("keeps distinct board identities and the original preset IDs", () => {
    expect(new Set(gpuPresets.map((p) => p.id)).size).toBe(gpuPresets.length);
    expect(new Set(gpuPresets.map((p) => p.name)).size).toBe(gpuPresets.length);
    for (const id of [
      "nvidia-rtx-5090",
      "nvidia-rtx-5080",
      "nvidia-rtx-5070",
      "nvidia-rtx-4090",
      "sapphire-pulse-9070xt",
      "intel-arc-b580-le",
    ]) expect(preset(id)).toBeDefined();
    for (const p of gpuPresets) {
      expect(new URL(p.sourceUrl).protocol).toBe("https:");
      expect(p.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.notes.length).toBeGreaterThan(0);
      expect(p.name).not.toContain("exact board variant");
      expect(Number.isInteger(p.maxDisplays)).toBe(true);
      expect(p.maxDisplays).toBeGreaterThan(0);
    }
  });

  it("creates independent editable ports and valid devices for every board", () => {
    const ids = new Set<string>();
    for (const p of gpuPresets) {
      const a = makeGpuDevice(p),
        b = makeGpuDevice(p);
      expect(a.maxStreams).toBe(p.maxDisplays);
      expect(a.specUrl).toBe(p.sourceUrl);
      expect(new Set(a.ports.map((port) => port.name)).size).toBe(a.ports.length);
      for (const [i, port] of a.ports.entries()) {
        expect(ids.has(port.id)).toBe(false);
        ids.add(port.id);
        expect(port.id).not.toBe(b.ports[i].id);
        expect(port.direction).toBe("out");
        expect(port.caps).not.toBe(b.ports[i].caps);
        expect(port.signal).not.toBe(b.ports[i].signal);
        expect(port.signal).toEqual(defaultSignal());
        expect(port.caps.modes).toBeNull();
        expect(port.caps.depths).toBeNull();
        expect(port.caps.formats).toBeNull();
        port.caps.version = "edited";
        port.caps.depths = [10];
        port.signal.refresh = 75;
        expect(b.ports[i].caps.version).not.toBe("edited");
        expect(b.ports[i].caps.depths).toBeNull();
        expect(b.ports[i].signal.refresh).toBe(60);
      }
      expect(() =>
        validateProject({ ...emptyProject(), devices: [a, b] }),
      ).not.toThrow();
    }
  });

  it("keeps connector counts and version labels consistent with each summary", () => {
    for (const p of gpuPresets) {
      const ports = p.ports();
      let total = 0;
      for (const match of p.summary.matchAll(/(\d+) × (DP|HDMI)(?: ([\d.ab]+))?/g)) {
        const connector = match[2] === "DP" ? "DisplayPort" : "HDMI";
        const group = ports.filter((port) => port.connector === connector);
        expect(group, p.id).toHaveLength(Number(match[1]));
        for (const port of group)
          expect(port.caps.version, p.id).toBe(match[3] ?? "");
        total += Number(match[1]);
      }
      expect(total, p.id).toBe(ports.length);
    }
  });

  it("preserves varying layouts and simultaneous-display limits", () => {
    const cases = [
      ["asus-rog-astral-rtx5090-o32g-gaming", 3, 2, 4],
      ["msi-rtx5090-32g-ventus-3x-oc", 3, 1, 4],
      ["asus-rtx5060-o8g-lp-brk", 1, 2, 3],
      ["gigabyte-rtx3060-gaming-oc-gv-n3060gaming-oc-12gd", 2, 2, 4],
      ["gigabyte-rtx5050-windforce-gv-n5050wf2-8gd", 2, 2, 4],
      ["sapphire-pulse-9070xt", 2, 2, 4],
      ["sapphire-pulse-rx9060xt-8g", 1, 2, 3],
      ["asus-tuf-rx9060xt-o16g-gaming", 2, 1, 3],
    ] as const;
    for (const [id, dp, hdmi, max] of cases) {
      const device = makeGpuDevice(preset(id));
      expect(
        device.ports.filter((p) => p.connector === "DisplayPort"), id,
      ).toHaveLength(dp);
      expect(
        device.ports.filter((p) => p.connector === "HDMI"), id,
      ).toHaveLength(hdmi);
      expect(device.maxStreams, id).toBe(max);
    }
  });

  it("uses ASRock's documented primary UHBR13.5 and secondary UHBR10 rates", () => {
    for (const id of [
      "asrock-arc-b580-challenger-12go",
      "asrock-arc-b580-steel-legend-12go",
      "asrock-arc-b570-challenger-10go",
    ]) {
      const ports = preset(id).ports();
      expect(ports.map((p) => p.caps.link)).toEqual([
        "uhbr13", "uhbr10", "uhbr10", "unknown",
      ]);
      expect(links[ports[0].caps.link].raw).toBe(13.5);
    }
    // A different board's rates cannot establish the Limited Edition's port mapping.
    expect(
      preset("intel-arc-b580-le").ports().every((p) => p.caps.link === "unknown"),
    ).toBe(true);
    const sapphire = preset("sapphire-pulse-rx9060xt-8g");
    expect(
      sapphire.ports().filter((p) => p.connector === "HDMI").every(
        (p) => p.caps.version === "" && p.caps.link === "unknown",
      ),
    ).toBe(true);
  });

  it("round-trips all GPU instances and independent saved device templates", () => {
    const project = {
      ...emptyProject(),
      devices: gpuPresets.map((p, i) => makeGpuDevice(p, { x: i * 100, y: 80 })),
      templates: gpuPresets.map((p) => makeGpuDevice(p)),
    };
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
});

describe("expanded GPU layouts in the editor and simulation", () => {
  it("reports five active streams on a five-connector, four-display board", () => {
    const pc = makeGpuDevice(preset("asus-rog-astral-rtx5090-o32g-gaming"));
    const displays = pc.ports.map((port) => {
      const display = makeDevice("monitor");
      display.ports = [newPort("in", port.connector, "Display input")];
      display.selectedInput = display.ports[0].id;
      return display;
    });
    const project = {
      ...emptyProject(),
      devices: [pc, ...displays],
      cables: displays.map((display, i) => makeCable(pc, i, display, 0)),
    };
    const limit = (p: typeof project) => simulate(p).findings.filter(
      (f) => f.title === "Source display stream limit exceeded",
    );
    expect(limit(project)).toHaveLength(1);
    displays[4].enabled = false;
    expect(limit(project)).toHaveLength(0);
    expect(project.cables).toHaveLength(5);
  });

  it("replaces five outputs with three while retaining matching cables and source settings", () => {
    const pc = makeGpuDevice(preset("asus-rog-astral-rtx5090-o32g-gaming"));
    const displays = Array.from({ length: 3 }, () => makeDevice("monitor"));
    pc.ports[0].name = "Main DP";
    pc.ports[0].signal.refresh = 120;
    const project = {
      ...emptyProject(),
      devices: [pc, ...displays],
      cables: [
        makeCable(pc, 0, displays[0], 0),
        makeCable(pc, 1, displays[1], 0),
        makeCable(pc, 4, displays[2], 1),
      ],
    };
    const result = replaceGpuOutputs(
      project, pc.id, preset("asus-rtx5060-o8g-lp-brk"),
    );
    const updated = result.project.devices[0];
    expect(result.disconnected).toBe(1);
    expect(updated.ports).toHaveLength(3);
    expect(updated.maxStreams).toBe(3);
    expect(updated.ports[0]).toMatchObject({
      id: pc.ports[0].id, name: "Main DP", signal: { refresh: 120 },
    });
    expect(result.project.cables.map((c) => c.id)).toEqual([
      project.cables[0].id, project.cables[2].id,
    ]);
    expect(project.devices[0].ports).toHaveLength(5);
    expect(() => validateProject(result.project)).not.toThrow();
  });

  it("offers each compatible GPU output in the cable-drop picker and materializes it", () => {
    const display = makeDevice("monitor");
    const project = { ...emptyProject(), devices: [display] };
    const origin = { deviceId: display.id, portId: display.ports[1].id };
    const choices = compatibleChoices(project, origin, connectionLibrary([]));
    for (const p of gpuPresets) {
      expect(
        choices.filter((c) => c.group === "GPU computers" && c.label === p.name),
        p.id,
      ).toHaveLength(p.ports().filter((port) => port.connector === "HDMI").length);
    }
    const choice = choices.find(
      (c) => c.label === preset("asus-rog-astral-rtx5090-o32g-gaming").name
        && c.port.name === "HDMI 2",
    )!;
    const result = materializeConnection(project, origin, choice, { x: 100, y: 100 });
    expect(result.device.ports).toHaveLength(5);
    expect(result.device.maxStreams).toBe(4);
    expect(result.port.name).toBe("HDMI 2");
    expect(() => validateProject(result.project)).not.toThrow();
  });
});
