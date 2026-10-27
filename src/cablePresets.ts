import type { Cable, Port, Project } from "./model";

export type CablePreset = {
  id: string;
  name: string;
  protocol: Port["protocol"];
  ratingGbps: number | null;
  dpLaneGbps: number | null;
  description: string;
  sourceUrl: string;
};

const hdmiCables = "https://www.hdmi.org/resource/cables";
const dpCables = "https://www.displayport.org/how-to-choose-a-displayport-cable-and-not-get-a-bad-one/";
const dpUhbr = "https://www.displayport.org/pr/vesa-readies-displayport-uhbr-ultra-high-bit-rate-device-certification-and-begins-certification-of-uhbr-cables/";
const dp54 = "https://www.displayport.org/pr/vesa-announces-displayport-updates-and-extensions-for-gaming-and-automotive-market-at-ces/";

/** Cable certification categories, not port specification versions. Checked 2026-10-27. */
export const cablePresets: CablePreset[] = [
  {
    id: "hdmi-standard", name: "Standard HDMI · 720p / 1080i", protocol: "HDMI",
    ratingGbps: null, dpLaneGbps: null, sourceUrl: hdmiCables,
    description: "Standard HDMI is tested for 720p/1080i. Its category alone does not establish a raw Gbps rating; verify the actual cable before entering one. The legacy 4.95 Gbps port rate is not a cable certification rating. Ethernet variants share this video category.",
  },
  {
    id: "hdmi-high-speed", name: "High Speed HDMI · 10.2 Gbps", protocol: "HDMI",
    ratingGbps: 10.2, dpLaneGbps: null, sourceUrl: hdmiCables,
    description: "High Speed HDMI cable category, rated to 10.2 Gbps. The With Ethernet variant has the same video bandwidth. Use the category printed on the cable or its packaging.",
  },
  {
    id: "hdmi-premium", name: "Premium High Speed HDMI · 18 Gbps", protocol: "HDMI",
    ratingGbps: 18, dpLaneGbps: null, sourceUrl: "https://www.hdmi.org/spec/premiumcable",
    description: "Premium High Speed HDMI certification tests the full 18 Gbps link rate. The With Ethernet variant uses the same video rating. Check the certification label for your exact cable model and length.",
  },
  {
    id: "hdmi-ultra", name: "Ultra High Speed HDMI · 48 Gbps", protocol: "HDMI",
    ratingGbps: 48, dpLaneGbps: null, sourceUrl: "https://www.hdmi.org/spec21sub/ultrahighspeedcable",
    description: "Ultra High Speed HDMI certification for up to 48 Gbps. Check the official cable label; a port's HDMI version does not establish the cable's rating.",
  },
  {
    id: "hdmi-ultra96", name: "Ultra96 HDMI · 96 Gbps", protocol: "HDMI",
    ratingGbps: 96, dpLaneGbps: null, sourceUrl: "https://www.hdmi.org/spec21sub/ultrahighspeedcable",
    description: "Ultra96 HDMI cable certification for up to 96 Gbps, including HDMI 2.2 links at 64/80/96 Gbps. Higher-rate transport calculations still require verification in the simulator.",
  },
  {
    id: "dp-standard", name: "Certified DisplayPort (HBR2) · 21.6 Gbps", protocol: "DisplayPort",
    ratingGbps: 21.6, dpLaneGbps: 5.4, sourceUrl: dpCables,
    description: "VESA-certified standard DisplayPort cables support HBR2: 5.4 Gbps per lane, 21.6 Gbps over four lanes. The profile includes lower legacy link rates.",
  },
  {
    id: "dp8k", name: "DP8K (HBR3) · 32.4 Gbps", protocol: "DisplayPort",
    ratingGbps: 32.4, dpLaneGbps: 8.1,
    sourceUrl: "https://www.displayport.org/wp-content/uploads/2018/07/DP_Marketing_Guidelines_R14.pdf",
    description: "DP8K certification validates HBR3 at 8.1 Gbps per lane, 32.4 Gbps over four lanes, with lower legacy rates included. The 8K name does not guarantee a particular resolution on every device.",
  },
  {
    id: "dp40", name: "DP40 (original rating) · 40 Gbps", protocol: "DisplayPort",
    ratingGbps: 40, dpLaneGbps: 10, sourceUrl: dp54,
    description: "Uses the original DP40 declaration: UHBR10, 40 Gbps over four lanes, plus legacy rates. VESA subsequently validated existing DP40 cables for DP54; choose the DP54 template to use that updated 54 Gbps rating.",
  },
  {
    id: "dp54", name: "DP54 · 54 Gbps", protocol: "DisplayPort",
    ratingGbps: 54, dpLaneGbps: 13.5, sourceUrl: dp54,
    description: "DP54 supports UHBR13.5 at 13.5 Gbps per lane and UHBR10, plus legacy rates. VESA replaced DP40 with DP54 and confirmed existing DP40-certified cables meet the updated rating.",
  },
  {
    id: "dp80", name: "DP80 · 80 Gbps", protocol: "DisplayPort",
    ratingGbps: 80, dpLaneGbps: 20, sourceUrl: dpUhbr,
    description: "DP80 certification supports UHBR20, UHBR13.5 and UHBR10, plus legacy rates: up to 20 Gbps per lane and 80 Gbps over four lanes. Enter the actual cable length separately.",
  },
  {
    id: "dp80ll", name: "DP80LL (active low loss) · 80 Gbps", protocol: "DisplayPort",
    ratingGbps: 80, dpLaneGbps: 20,
    sourceUrl: "https://vesa.org/press/vesa-to-update-displayport-2-1-with-new-active-cable-specification-for-up-to-3x-longer-dp80-cables/",
    description: "Active low-loss DP80 cable specification for UHBR20 at up to 80 Gbps. Check the actual cable's source/display orientation, length and feature support; electrical loss and active cable electronics are not simulated.",
  },
];

export function cableProtocol(project: Project, cable: Cable): Port["protocol"] | null {
  const source = project.devices.find((d) => d.id === cable.sourceDevice)?.ports.find((p) => p.id === cable.sourcePort);
  const target = project.devices.find((d) => d.id === cable.targetDevice)?.ports.find((p) => p.id === cable.targetPort);
  return source && target && source.protocol === target.protocol ? source.protocol : null;
}

export function cablePresetMatches(cable: Cable, preset: CablePreset): boolean {
  return cable.presetId === preset.id && cable.ratingGbps === preset.ratingGbps &&
    (cable.dpLaneGbps ?? null) === preset.dpLaneGbps;
}

export function cablePresetFeatures(preset: CablePreset): Partial<Cable["features"]> {
  // These describe transport pass-through, not source/display feature support.
  if (preset.protocol === "DisplayPort" || ["hdmi-ultra", "hdmi-ultra96"].includes(preset.id))
    return { hdr: "yes", vrr: "yes", dsc: "yes" };
  if (preset.id === "hdmi-premium") return { hdr: "yes" };
  return {};
}

/** A single undoable specification change; wiring and entered hardware details stay intact. */
export function applyCablePreset(project: Project, cable: Cable, preset: CablePreset): Cable {
  if (cableProtocol(project, cable) !== preset.protocol)
    throw new Error("Choose a cable template matching the connection's video protocol.");
  const features = { ...cable.features };
  for (const [key, value] of Object.entries(cablePresetFeatures(preset)))
    if (features[key as keyof typeof features] === "unknown") features[key as keyof typeof features] = value;
  return { ...cable, features, presetId: preset.id, ratingGbps: preset.ratingGbps, dpLaneGbps: preset.dpLaneGbps };
}
