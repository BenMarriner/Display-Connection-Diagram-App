import {
  id,
  newPort,
  type Device,
  type Port,
  type PortTemplate,
} from "./model";
import { links, sourceLinks } from "./presets";

export function nextPortName(ports: Port[], base: string): string {
  const names = new Set(ports.map((p) => p.name.toLowerCase()));
  let number = 1;
  while (names.has(`${base} ${number}`.toLowerCase())) number++;
  return `${base} ${number}`;
}
export function addDevicePort(
  device: Device,
  direction: Port["direction"],
  connector: Port["connector"],
  template?: PortTemplate,
): Device {
  if (device.ports.length >= 64)
    throw new Error("A device can have at most 64 ports.");
  const p = newPort(
    direction,
    connector,
    nextPortName(
      device.ports,
      `${connector === "DisplayPort" ? "DP" : connector} ${direction === "in" ? "in" : "out"}`,
    ),
  );
  const port =
    template && template.spec.connector === connector
      ? applyPortTemplate(p, template)
      : p;
  return {
    ...device,
    ports: [...device.ports, port],
    selectedInput:
      direction === "in"
        ? (device.selectedInput ?? port.id)
        : device.selectedInput,
  };
}
export function duplicatePort(device: Device, portId: string): Device {
  if (device.ports.length >= 64)
    throw new Error("A device can have at most 64 ports.");
  const index = device.ports.findIndex((p) => p.id === portId);
  if (index < 0) return device;
  const original = device.ports[index];
  const copy = {
    ...structuredClone(original),
    id: id(),
    name: nextPortName(device.ports, `${original.name} copy`),
  };
  const ports = [...device.ports];
  ports.splice(index + 1, 0, copy);
  return { ...device, ports };
}
export function savePortTemplate(port: Port, name: string): PortTemplate {
  const {
    id: _id,
    name: _name,
    direction: _direction,
    ...spec
  } = structuredClone(port);
  return {
    id: id(),
    name: name.trim() || `${port.name} specs`,
    spec,
    description: "Personal port specification and default signal.",
    sourceUrl: "",
    includeSignal: true,
  };
}
export function templateMatches(port: Port, template: PortTemplate): boolean {
  return (
    port.connector === template.spec.connector &&
    port.protocol === template.spec.protocol
  );
}
export function applyPortTemplate(port: Port, template: PortTemplate): Port {
  if (!templateMatches(port, template))
    throw new Error(
      "Choose a template with the same connector and video protocol.",
    );
  return {
    ...port,
    caps: structuredClone(template.spec.caps),
    signal: template.includeSignal
      ? structuredClone(template.spec.signal)
      : port.signal,
  };
}
export function applyTemplateToDevice(
  device: Device,
  template: PortTemplate,
): Device {
  return {
    ...device,
    ports: device.ports.map((p) =>
      templateMatches(p, template) ? applyPortTemplate(p, template) : p,
    ),
  };
}

type StarterProfile = [
  key: string,
  connector: Port["connector"],
  link: Port["caps"]["link"],
  version: string,
  lanes: Port["caps"]["lanes"],
];
const starterProfiles: StarterProfile[] = [
  ["hdmi5", "HDMI", "tmds5", "1.0–1.2a", 4],
  ["hdmi10", "HDMI", "tmds10", "1.4", 4],
  ["hdmi18", "HDMI", "tmds18", "2.0", 4],
  ["hdmi40", "HDMI", "frl40", "2.1", 4],
  ["hdmi48", "HDMI", "frl48", "2.1", 4],
  ["hdmi64", "HDMI", "frl64", "2.2", 4],
  ["hdmi80", "HDMI", "frl80", "2.2", 4],
  ["hdmi96", "HDMI", "frl96", "2.2", 4],
  ["dp27", "DisplayPort", "hbr", "1.1", 4],
  ["dp54", "DisplayPort", "hbr2", "1.2", 4],
  ["dp81", "DisplayPort", "hbr3", "1.4", 4],
  ["dp81a", "DisplayPort", "hbr3", "1.4a", 4],
  ["dp135", "DisplayPort", "uhbr13", "2.1", 4],
  ["dp20", "DisplayPort", "uhbr20", "2.1", 4],
  ["usbc2", "USB-C", "hbr3", "1.4", 2],
  ["usbc4", "USB-C", "hbr3", "1.4", 4],
];
export const starterPortTemplates: PortTemplate[] = starterProfiles.map(
  ([key, connector, link, version, lanes]) => {
    const p = newPort("out", connector);
    p.caps.link = link;
    p.caps.version = version;
    p.caps.lanes = lanes;
    const bandwidth = Number(
      (links[link].raw * (p.protocol === "DisplayPort" ? lanes : 1)).toFixed(2),
    );
    const label = connector === "USB-C"
      ? `USB-C (DP ${version})`
      : `${connector} ${version}`;
    const name = `${label} · ${bandwidth} Gbps`;
    const template = savePortTemplate(p, name);
    return {
      ...template,
      id: `builtin:${key}`,
      includeSignal: false,
      sourceUrl: key === "hdmi5"
        ? sourceLinks.legacyHdmi
        : key === "dp27" ? sourceLinks.dp11
        : version === "2.2" ? sourceLinks.hdmi22 : template.sourceUrl,
      description:
        (key === "hdmi5"
          ? "Legacy HDMI port bandwidth. Standard HDMI is a cable category tested for 720p/1080i; this template does not certify a cable. "
          : "") +
        `${connector === "USB-C" ? `Uses ${lanes} DisplayPort video lanes over USB-C. ` : ""}` +
        "Sets the version label and total link bandwidth before encoding. Choose the bandwidth listed for your device; the version alone does not determine it. Display modes, color depth and optional features still need the device's specifications.",
    };
  },
);
