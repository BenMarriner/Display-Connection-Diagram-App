import { z } from "zod";

export const kinds = [
  "computer",
  "console",
  "monitor",
  "projector",
  "switch",
  "splitter",
  "dock",
  "adapter",
] as const;
export const connectors = ["HDMI", "DisplayPort", "USB-C"] as const;
export const formats = ["RGB", "4:4:4", "4:2:2", "4:2:0"] as const;
export const linkIds = [
  "unknown",
  "tmds5",
  "tmds10",
  "tmds18",
  "frl24",
  "frl32",
  "frl40",
  "frl48",
  "frl64",
  "frl80",
  "frl96",
  "rbr",
  "hbr",
  "hbr2",
  "hbr3",
  "uhbr10",
  "uhbr13",
  "uhbr20",
] as const;
const positive = z.number().finite().positive();
const nullablePositive = positive.nullable();
const feature = z.enum(["unknown", "yes", "no"]);
export const signalSchema = z.object({
  width: positive.int().max(32768),
  height: positive.int().max(32768),
  refresh: positive.max(2000),
  timingId: z.string(),
  pixelClockMHz: nullablePositive,
  bpc: z.union([z.literal(8), z.literal(10), z.literal(12), z.literal(16)]),
  chroma: z.enum(formats),
  hdr: z.boolean(),
  vrr: z.boolean(),
  dsc: z.boolean(),
  dscBpp: nullablePositive,
});
export const capsSchema = z.object({
  version: z.string(),
  link: z.enum(linkIds),
  lanes: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  modes: z.array(z.string()).nullable(),
  depths: z.array(positive).nullable(),
  formats: z.array(z.enum(formats)).nullable(),
  // A partial list confirms its entries; unlisted values still need verification.
  modesComplete: z.boolean().optional(),
  depthsComplete: z.boolean().optional(),
  formatsComplete: z.boolean().optional(),
  vrr: feature,
  hdr: feature,
  dsc: feature,
  vrrMin: nullablePositive,
  vrrMax: nullablePositive,
});
export const portSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  direction: z.enum(["in", "out"]),
  connector: z.enum(connectors),
  protocol: z.enum(["HDMI", "DisplayPort"]),
  caps: capsSchema,
  signal: signalSchema,
});
export const portSpecSchema = portSchema.omit({
  id: true,
  name: true,
  direction: true,
});
export const portTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  spec: portSpecSchema,
  description: z.string().default(""),
  sourceUrl: z.string().default(""),
  includeSignal: z.boolean().default(true),
});
const deviceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(kinds),
  name: z.string().min(1),
  model: z.string(),
  notes: z.string(),
  specUrl: z.string(),
  ports: z.array(portSchema).max(64),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  selectedInput: z.string().nullable(),
  enabled: z.boolean(),
  sharedGbps: nullablePositive,
  maxStreams: positive.int().nullable(),
  conversion: z.enum(["unknown", "yes", "no"]),
});
export const cableSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  sourceDevice: z.string(),
  sourcePort: z.string(),
  targetDevice: z.string(),
  targetPort: z.string(),
  ratingGbps: nullablePositive,
  // Optional so older version-1 projects retain their original entered specs.
  presetId: z.string().min(1).max(100).nullable().optional(),
  dpLaneGbps: positive.max(20).nullable().optional(),
  lengthM: nullablePositive,
  notes: z.string(),
  features: z.object({ vrr: feature, hdr: feature, dsc: feature }),
});
export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  devices: z.array(deviceSchema).max(500),
  cables: z.array(cableSchema).max(2000),
  templates: z.array(deviceSchema).max(500),
  portTemplates: z.array(portTemplateSchema).max(500).default([]),
  viewport: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    zoom: positive,
  }),
});
export type Signal = z.infer<typeof signalSchema>;
export type Capabilities = z.infer<typeof capsSchema>;
export type Port = z.infer<typeof portSchema>;
export type PortSpec = z.infer<typeof portSpecSchema>;
export type PortTemplate = z.infer<typeof portTemplateSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type Cable = z.infer<typeof cableSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Kind = Device["kind"];
export type Feature = Capabilities["vrr"];
export type Status = "supported" | "incompatible" | "uncertain" | "inactive";
export const statusLabels: Record<Status, string> = {
  supported: "Supported by entered specs",
  incompatible: "Incompatible",
  uncertain: "Needs verification",
  inactive: "No active signal",
};
export const id = () => crypto.randomUUID();
export function defaultSignal(): Signal {
  return {
    width: 1920,
    height: 1080,
    refresh: 60,
    timingId: "1080p60",
    pixelClockMHz: null,
    bpc: 8,
    chroma: "RGB",
    hdr: false,
    vrr: false,
    dsc: false,
    dscBpp: null,
  };
}
export function unknownCaps(): Capabilities {
  return {
    version: "",
    link: "unknown",
    lanes: 4,
    modes: null,
    depths: null,
    formats: null,
    vrr: "unknown",
    hdr: "unknown",
    dsc: "unknown",
    vrrMin: null,
    vrrMax: null,
  };
}
export function newPort(
  direction: Port["direction"],
  connector: Port["connector"] = "HDMI",
  name: string = connector,
): Port {
  return {
    id: id(),
    name,
    direction,
    connector,
    protocol: connector === "HDMI" ? "HDMI" : "DisplayPort",
    caps: unknownCaps(),
    signal: defaultSignal(),
  };
}
export function emptyProject(): Project {
  return {
    schemaVersion: 1,
    name: "My display setup",
    devices: [],
    cables: [],
    templates: [],
    portTemplates: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
export function modeLabel(s: Signal) {
  return `${s.width} × ${s.height} · ${s.refresh} Hz`;
}
export function modeKey(s: Signal) {
  return `${s.width}x${s.height}@${s.refresh}`;
}

export function connectionError(
  project: Project,
  sourceDevice: string,
  sourcePort: string,
  targetDevice: string,
  targetPort: string,
): string | null {
  const a = project.devices
    .find((d) => d.id === sourceDevice)
    ?.ports.find((p) => p.id === sourcePort);
  const b = project.devices
    .find((d) => d.id === targetDevice)
    ?.ports.find((p) => p.id === targetPort);
  if (!a || !b) return "Select an existing port at each end.";
  if (sourceDevice === targetDevice)
    return "A device cannot connect to itself.";
  if (a.direction !== "out" || b.direction !== "in")
    return "Connect an output to an input.";
  if (a.protocol !== b.protocol)
    return "Use an explicit adapter to convert between HDMI and DisplayPort.";
  if (
    a.connector !== b.connector &&
    !(
      [a.connector, b.connector].includes("USB-C") &&
      a.protocol === "DisplayPort"
    )
  )
    return "These connectors need an explicit adapter.";
  if (
    project.cables.some(
      (c) => c.sourcePort === sourcePort || c.targetPort === targetPort,
    )
  )
    return "That port already has a cable. Disconnect it first.";
  const seen = new Set<string>();
  function reaches(current: string): boolean {
    if (current === sourceDevice) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    return project.cables
      .filter((c) => c.sourceDevice === current)
      .some((c) => reaches(c.targetDevice));
  }
  return reaches(targetDevice)
    ? "This connection would create a signal loop."
    : null;
}

export function validateProject(value: unknown): Project {
  const parsed = projectSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "Invalid project or unsupported version. Expected a Signalpath version 1 project.",
    );
  const p = parsed.data;
  const ids = new Set<string>();
  for (const d of [...p.devices, ...p.templates]) {
    for (const key of [d.id, ...d.ports.map((port) => port.id)]) {
      if (ids.has(key))
        throw new Error("Project contains duplicate device or port IDs.");
      ids.add(key);
    }
    if (
      d.selectedInput &&
      !d.ports.some(
        (port) => port.id === d.selectedInput && port.direction === "in",
      )
    )
      throw new Error("Selected input does not exist.");
    for (const port of d.ports) {
      const hdmiLink =
        port.caps.link.startsWith("tmds") || port.caps.link.startsWith("frl");
      if (port.connector === "HDMI" && port.protocol !== "HDMI")
        throw new Error("An HDMI port must use HDMI transport.");
      if (port.connector !== "HDMI" && port.protocol !== "DisplayPort")
        throw new Error(
          "DisplayPort and USB-C ports must use DisplayPort transport.",
        );
      if (
        port.caps.link !== "unknown" &&
        hdmiLink !== (port.protocol === "HDMI")
      )
        throw new Error("A link profile does not match its port protocol.");
    }
  }
  const partial = { ...p, cables: [] as Cable[] };
  for (const t of p.portTemplates) {
    if (ids.has(t.id))
      throw new Error("Project contains duplicate port template IDs.");
    ids.add(t.id);
    const hdmi = t.spec.connector === "HDMI";
    const hdmiLink =
      t.spec.caps.link.startsWith("tmds") || t.spec.caps.link.startsWith("frl");
    if (
      hdmi !== (t.spec.protocol === "HDMI") ||
      (t.spec.caps.link !== "unknown" && hdmi !== hdmiLink)
    )
      throw new Error(
        "A port template contains an inconsistent connector or link profile.",
      );
  }
  for (const cable of p.cables) {
    if (ids.has(cable.id))
      throw new Error("Project contains duplicate cable IDs.");
    ids.add(cable.id);
    const error = connectionError(
      partial,
      cable.sourceDevice,
      cable.sourcePort,
      cable.targetDevice,
      cable.targetPort,
    );
    if (error) throw new Error(`Invalid cable: ${error}`);
    if (cable.dpLaneGbps != null) {
      const source = p.devices.find((d) => d.id === cable.sourceDevice)?.ports.find((port) => port.id === cable.sourcePort);
      if (source?.protocol !== "DisplayPort")
        throw new Error("A DP cable lane limit requires DisplayPort transport.");
    }
    partial.cables.push(cable);
  }
  return p;
}
