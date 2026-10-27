import { describe, expect, it } from "vitest";
import {
  makeDevice,
  makeCable,
  movePort,
  removePort,
  exampleProject,
} from "./devices";
import { emptyProject, newPort } from "./model";
import { simulate } from "./engine";
import { parseProject, serializeProject } from "./persistence";

describe("port list editing", () => {
  it("reorders only the matching column without changing IDs, signals, or selected input", () => {
    const d = makeDevice("switch");
    d.ports = [
      d.ports[0],
      d.ports[2],
      d.ports[1],
      newPort("out", "HDMI", "Second out"),
    ];
    const before = structuredClone(d);
    const moved = movePort(d, d.ports[3].id, -1);
    expect(
      moved.ports.filter((p) => p.direction === "out").map((p) => p.id),
    ).toEqual([d.ports[3].id, d.ports[1].id]);
    expect(moved.ports.filter((p) => p.direction === "in")).toEqual(
      d.ports.filter((p) => p.direction === "in"),
    );
    expect(moved.selectedInput).toBe(d.selectedInput);
    expect(d).toEqual(before);
    expect(movePort(moved, d.ports[3].id, 1)).toEqual(d);
  });

  it("keeps cables and simulation unchanged after reordering and JSON restoration", () => {
    const project = exampleProject();
    const before = simulate(project);
    project.devices[0] = movePort(
      project.devices[0],
      project.devices[0].ports[1].id,
      -1,
    );
    expect(simulate(project)).toEqual(before);
    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it("ignores attempts to move past a column boundary or a missing port", () => {
    const d = makeDevice("computer");
    expect(movePort(d, d.ports[0].id, -1)).toBe(d);
    expect(movePort(d, d.ports[1].id, 1)).toBe(d);
    expect(movePort(d, "missing", 1)).toBe(d);
  });

  it("removes a connected selected input and picks the remaining input without mutating the undo snapshot", () => {
    const pc = makeDevice("computer"),
      monitor = makeDevice("monitor");
    const project = {
      ...emptyProject(),
      devices: [pc, monitor],
      cables: [makeCable(pc, 0, monitor, 0)],
    };
    const snapshot = structuredClone(project);
    const after = removePort(project, monitor.id, monitor.ports[0].id);
    expect(after.cables).toHaveLength(0);
    expect(after.devices[1].selectedInput).toBe(monitor.ports[1].id);
    expect(project).toEqual(snapshot);
  });
});
