import {
  id,
  newPort,
  emptyProject,
  type Kind,
  type Device,
  type Project,
  type Cable,
} from "./model";
import { applyTiming, timings } from "./presets";

export const kindLabels: Record<Kind, string> = {
  computer: "Computer",
  console: "Console",
  monitor: "Monitor",
  projector: "Projector",
  switch: "HDMI switch",
  splitter: "HDMI splitter",
  dock: "USB-C dock",
  adapter: "Adapter",
};
export const kindDescriptions: Record<Kind, string> = {
  computer: "Independent display outputs",
  console: "A video source for your setup",
  monitor: "Display with selectable inputs",
  projector: "Bring the big screen into the loop",
  switch: "Choose one of several sources",
  splitter: "Mirror one signal to many displays",
  dock: "Multiple streams, one upstream link",
  adapter: "Explicit, directional conversion",
};

export function makeDevice(kind: Kind, position = { x: 80, y: 80 }): Device {
  const ports =
    kind === "computer"
      ? [
          newPort("out", "DisplayPort", "DP 1"),
          newPort("out", "HDMI", "HDMI 1"),
        ]
      : kind === "console"
        ? [newPort("out", "HDMI", "HDMI out")]
        : kind === "monitor"
          ? [
              newPort("in", "DisplayPort", "DP in"),
              newPort("in", "HDMI", "HDMI in"),
            ]
          : kind === "projector"
            ? [newPort("in", "HDMI", "HDMI in")]
            : kind === "switch"
              ? [
                  newPort("in", "HDMI", "Input 1"),
                  newPort("in", "HDMI", "Input 2"),
                  newPort("out", "HDMI", "Output"),
                ]
              : kind === "splitter"
                ? [
                    newPort("in", "HDMI", "Input"),
                    newPort("out", "HDMI", "Output 1"),
                    newPort("out", "HDMI", "Output 2"),
                  ]
                : kind === "dock"
                  ? [
                      newPort("in", "USB-C", "Upstream"),
                      newPort("out", "DisplayPort", "DP out"),
                      newPort("out", "HDMI", "HDMI out"),
                    ]
                  : [
                      newPort("in", "DisplayPort", "DP input"),
                      newPort("out", "HDMI", "HDMI output"),
                    ];
  return {
    id: id(),
    kind,
    name: kindLabels[kind],
    model: "",
    notes: "",
    specUrl: "",
    ports,
    position,
    selectedInput: ports.find((p) => p.direction === "in")?.id ?? null,
    enabled: true,
    sharedGbps: null,
    maxStreams: null,
    conversion: "unknown",
  };
}
export function cloneDevice(
  d: Device,
  position = { x: d.position.x + 60, y: d.position.y + 60 },
): Device {
  const cloned = structuredClone(d);
  cloned.id = id();
  cloned.position = position;
  cloned.ports = cloned.ports.map((p) => {
    const next = id();
    if (p.id === cloned.selectedInput) cloned.selectedInput = next;
    return { ...p, id: next };
  });
  return cloned;
}
export function makeCable(
  a: Device,
  aPort: number,
  b: Device,
  bPort: number,
): Cable {
  return {
    id: id(),
    name: `${a.ports[aPort].protocol} cable`,
    sourceDevice: a.id,
    sourcePort: a.ports[aPort].id,
    targetDevice: b.id,
    targetPort: b.ports[bPort].id,
    ratingGbps: null,
    lengthM: null,
    notes: "",
    features: { vrr: "unknown", hdr: "unknown", dsc: "unknown" },
  };
}
/** Reorder within the visible input/output column, preserving port identities and routes. */
export function movePort(
  device: Device,
  portId: string,
  offset: -1 | 1,
): Device {
  const index = device.ports.findIndex((p) => p.id === portId);
  if (index < 0) return device;
  const siblings = device.ports
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.direction === device.ports[index].direction);
  const siblingIndex = siblings.findIndex(({ p }) => p.id === portId);
  const target = siblings[siblingIndex + offset];
  if (!target) return device;
  const ports = [...device.ports];
  [ports[index], ports[target.i]] = [ports[target.i], ports[index]];
  return { ...device, ports };
}

export function removePort(
  project: Project,
  deviceId: string,
  portId: string,
): Project {
  return {
    ...project,
    cables: project.cables.filter(
      (c) => c.sourcePort !== portId && c.targetPort !== portId,
    ),
    devices: project.devices.map((d) =>
      d.id !== deviceId
        ? d
        : {
            ...d,
            ports: d.ports.filter((p) => p.id !== portId),
            selectedInput:
              d.selectedInput === portId
                ? (d.ports.find((p) => p.direction === "in" && p.id !== portId)
                    ?.id ?? null)
                : d.selectedInput,
          },
    ),
  };
}
export function exampleProject(): Project {
  const pc = makeDevice("computer", { x: 40, y: 80 });
  pc.name = "Desktop PC";
  pc.model = "Example • dual video outputs";
  const console = makeDevice("console", { x: 40, y: 420 });
  console.name = "Game console";
  console.model = "Example • 4K capable";
  const monitor = makeDevice("monitor", { x: 450, y: 60 });
  monitor.name = "Main display";
  monitor.model = "Example • 1440p / 144 Hz";
  const sw = makeDevice("switch", { x: 450, y: 350 });
  sw.name = "HDMI switch";
  sw.model = "Example • 2 inputs → 1 output";
  const proj = makeDevice("projector", { x: 860, y: 370 });
  proj.name = "Living room projector";
  proj.model = "Example • 1080p / 60 Hz";
  const devices = [pc, console, monitor, sw, proj];
  for (const d of devices)
    for (const p of d.ports)
      p.caps = {
        ...p.caps,
        link: p.protocol === "HDMI" ? "tmds18" : "hbr3",
        modes: timings.map((t) => t.id),
        depths: [8, 10, 12],
        formats: ["RGB", "4:4:4", "4:2:2", "4:2:0"],
        hdr: "no",
        vrr: "no",
        dsc: "no",
      };
  pc.ports[0].signal = applyTiming(pc.ports[0].signal, "1440p144");
  monitor.ports[0].caps.vrr = pc.ports[0].caps.vrr = "yes";
  monitor.ports[0].caps.vrrMin = 48;
  monitor.ports[0].caps.vrrMax = 144;
  proj.ports[0].caps.modes = ["720p60", "1080p60"];
  const cables = [
    makeCable(pc, 0, monitor, 0),
    makeCable(pc, 1, sw, 0),
    makeCable(console, 0, sw, 1),
    makeCable(sw, 2, proj, 0),
  ];
  for (const c of cables) {
    c.ratingGbps = c.sourcePort === pc.ports[0].id ? 32.4 : 18;
    c.lengthM = 2;
    c.features = { vrr: "yes", hdr: "yes", dsc: "no" };
  }
  return {
    ...emptyProject(),
    name: "Example · desk + projector",
    devices,
    cables,
  };
}
