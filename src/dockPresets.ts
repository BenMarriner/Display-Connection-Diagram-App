import { makeDevice } from "./devices";
import { newPort, type Device, type Port } from "./model";
import { matchesLibrarySearch } from "./librarySearch";
import { prefillTemplatePort } from "./templateDefaults";

export type DockPreset = {
  id: string;
  name: string;
  model: string;
  aliases: string[];
  summary: string;
  sourceUrl: string;
  checked: string;
  notes: string;
  sharedGbps: number;
  maxStreams: number;
  ports: () => Port[];
};

function thinkPad40asPorts(): Port[] {
  const upstream = newPort("in", "USB-C", "USB-C upstream");
  // Lenovo explicitly specifies two HBR3 video lanes, not a USB data-rate budget.
  upstream.caps = {
    ...upstream.caps,
    version: "1.4",
    link: "hbr3",
    lanes: 2,
    dsc: "yes",
  };
  const outputs = [
    newPort("out", "DisplayPort", "DP 1"),
    newPort("out", "DisplayPort", "DP 2"),
    newPort("out", "HDMI", "HDMI out"),
  ];
  for (const p of outputs) {
    p.caps.version = p.protocol === "HDMI" ? "2.0" : "1.4";
    // Version and peak resolution alone do not establish downstream link rates,
    // exhaustive timing/depth combinations, or DSC pass-through capabilities.
  }
  return [upstream, ...outputs].map(prefillTemplatePort);
}

export const dockPresets: DockPreset[] = [
  {
    id: "lenovo-thinkpad-usbc-dock-gen2-40as",
    name: "Lenovo ThinkPad USB-C Dock Gen 2",
    model: "40AS0090 (Type 40AS)",
    aliases: ["40AS", "40AS0090", "03X7609", ...[
      "US", "AR", "BR", "JP", "EU", "DK", "IN", "SA", "UK", "CH", "IT", "IS", "AU", "CN", "TW",
    ].map((region) => `40AS0090${region}`)],
    summary: "40AS0090 · USB-C upstream · 2 × DP 1.4 + HDMI 2.0 · up to 3 displays",
    sourceUrl: "https://support.lenovo.com/au/en/accessories/acc500106-thinkpad-usb-c-dock-gen-2-overview-and-service-parts",
    checked: "2026-10-27",
    sharedGbps: 2 * 8.1 * 0.8,
    maxStreams: 3,
    ports: thinkPad40asPorts,
    notes: [
      "USB-C DisplayPort Alt Mode / MST dock. Regional 40AS0090 suffixes share the same dock hardware.",
      "The declared upstream is two HBR3 lanes: 16.2 Gbps raw and 12.96 Gbps after 8b/10b encoding. A slower host or cable can reduce that shared video capacity; the USB data rate is not the video budget.",
      "Lenovo's higher multi-display modes require a compatible HBR3 host, MST and DSC. DSC is accepted at the upstream, but is not enabled automatically. Dock DSC decoding into uncompressed downstream signals is not simulated; verify those configurations against Lenovo's host-specific display matrix. Timing and blanking also affect whether an uncompressed 4K60 signal fits.",
      "Downstream raw link rates, complete mode/depth lists, HDR, VRR and DSC pass-through remain unknown. The front USB-C port is for USB data/power, not an additional display output. USB peripherals, Ethernet, audio and charging are outside this display diagram.",
      "Display matrix: https://support.lenovo.com/us/en/solutions/pd029622-display-and-video-output-configurations-docking-stations",
    ].join("\n\n"),
  },
];

export function dockPresetSearchText(preset: DockPreset): string {
  return [preset.name, preset.model, preset.summary, ...preset.aliases].join(" ");
}

export function matchesDockPreset(preset: DockPreset, query: string): boolean {
  return matchesLibrarySearch(dockPresetSearchText(preset), query);
}

export function makeDockDevice(
  preset: DockPreset,
  position = { x: 80, y: 80 },
): Device {
  const ports = preset.ports();
  return {
    ...makeDevice("dock", position),
    name: preset.name,
    model: preset.model,
    ports,
    selectedInput: ports.find((p) => p.direction === "in")?.id ?? null,
    sharedGbps: preset.sharedGbps,
    maxStreams: preset.maxStreams,
    conversion: "yes",
    specUrl: preset.sourceUrl,
    notes: `${preset.notes}\n\nSpecifications checked ${preset.checked}.`,
  };
}
