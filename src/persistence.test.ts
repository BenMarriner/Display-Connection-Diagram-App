import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  saveProject,
  loadProject,
  parseProject,
  serializeProject,
} from "./persistence";
import { exampleProject, cloneDevice } from "./devices";
import { simulate } from "./engine";

describe("project persistence", () => {
  it("round-trips positions, definitions, signals, channels and independent templates", async () => {
    const p = exampleProject();
    p.templates.push(cloneDevice(p.devices[0]));
    p.viewport = { x: 123, y: -50, zoom: 0.8 };
    const imported = parseProject(serializeProject(p));
    expect(imported).toEqual(p);
    expect(simulate(imported)).toEqual(simulate(p));
    await saveProject(p);
    const restored = await loadProject();
    expect(restored).toEqual(p);
  });
  it("rejects malformed JSON, unsupported schemas and invalid values", () => {
    expect(() => parseProject("{ broken")).toThrow("valid JSON");
    const p = exampleProject();
    expect(() =>
      parseProject(JSON.stringify({ ...p, schemaVersion: 2 })),
    ).toThrow("unsupported version");
    p.devices[0].ports[0].signal.width = -1;
    expect(() => parseProject(serializeProject(p))).toThrow("Invalid project");
  });
  it("rejects duplicate IDs, dangling cables, occupied ports and broken input selections", () => {
    const p = exampleProject();
    p.cables.push({ ...p.cables[0], id: crypto.randomUUID() });
    expect(() => parseProject(serializeProject(p))).toThrow("already");
    p.cables.pop();
    p.cables[0].targetPort = "missing";
    expect(() => parseProject(serializeProject(p))).toThrow("existing port");
    const duplicate = exampleProject();
    duplicate.devices.push(structuredClone(duplicate.devices[0]));
    expect(() => parseProject(serializeProject(duplicate))).toThrow(
      "duplicate",
    );
    const broken = exampleProject();
    broken.devices[2].selectedInput = "missing";
    expect(() => parseProject(serializeProject(broken))).toThrow(
      "Selected input",
    );
  });
  it("keeps the existing stored project after an invalid import fails", async () => {
    const p = exampleProject();
    await saveProject(p);
    expect(() => parseProject('{"schemaVersion":99}')).toThrow();
    expect(await loadProject()).toEqual(p);
  });
  it("rejects inconsistent protocol / profile combinations", () => {
    const p = exampleProject();
    p.devices[0].ports[0].caps.link = "tmds18";
    expect(() => parseProject(serializeProject(p))).toThrow("profile");
  });
});
