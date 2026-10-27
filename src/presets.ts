import type { Signal, Capabilities } from "./model";

export const timings = [
  {
    id: "720p60",
    label: "720p · 60 Hz",
    width: 1280,
    height: 720,
    refresh: 60,
    clock: 74.25,
    basis: "CTA VIC 4",
  },
  {
    id: "1080p60",
    label: "1080p · 60 Hz",
    width: 1920,
    height: 1080,
    refresh: 60,
    clock: 148.5,
    basis: "CTA VIC 16",
  },
  {
    id: "1080p120",
    label: "1080p · 120 Hz",
    width: 1920,
    height: 1080,
    refresh: 120,
    clock: 297,
    basis: "CTA VIC 63",
  },
  {
    id: "1440p60",
    label: "1440p · 60 Hz",
    width: 2560,
    height: 1440,
    refresh: 60,
    clock: 241.5,
    basis: "VESA reduced blanking, nominal 60 Hz",
  },
  {
    id: "1440p120",
    label: "1440p · 120 Hz",
    width: 2560,
    height: 1440,
    refresh: 120,
    clock: 497.75,
    basis: "VESA reduced blanking, nominal 120 Hz",
  },
  {
    id: "1440p144",
    label: "1440p · 144 Hz",
    width: 2560,
    height: 1440,
    refresh: 144,
    clock: 586,
    basis: "Display timing example, nominal 143.9 Hz; verify device clock",
  },
  {
    id: "4k30",
    label: "4K · 30 Hz",
    width: 3840,
    height: 2160,
    refresh: 30,
    clock: 297,
    basis: "CTA VIC 95",
  },
  {
    id: "4k60",
    label: "4K · 60 Hz",
    width: 3840,
    height: 2160,
    refresh: 60,
    clock: 594,
    basis: "CTA VIC 97",
  },
  {
    id: "4k120",
    label: "4K · 120 Hz",
    width: 3840,
    height: 2160,
    refresh: 120,
    clock: 1188,
    basis: "CTA VIC 118",
  },
] as const;
export function applyTiming(signal: Signal, timingId: string): Signal {
  const t = timings.find((t) => t.id === timingId);
  return t
    ? {
        ...signal,
        timingId,
        width: t.width,
        height: t.height,
        refresh: t.refresh,
        pixelClockMHz: null,
      }
    : { ...signal, timingId: "custom" };
}
export const links: Record<
  Capabilities["link"],
  {
    label: string;
    family: "unknown" | "tmds" | "frl" | "dp";
    raw: number;
    efficiency: number | null;
  }
> = {
  unknown: {
    label: "Unknown link capability",
    family: "unknown",
    raw: 0,
    efficiency: 0,
  },
  tmds5: {
    label: "HDMI TMDS · 4.95 Gbps (legacy)",
    family: "tmds",
    raw: 4.95,
    efficiency: 0.8,
  },
  tmds10: {
    label: "HDMI TMDS · 10.2 Gbps",
    family: "tmds",
    raw: 10.2,
    efficiency: 0.8,
  },
  tmds18: {
    label: "HDMI TMDS · 18 Gbps",
    family: "tmds",
    raw: 18,
    efficiency: 0.8,
  },
  frl24: {
    label: "HDMI FRL · 24 + TMDS 18",
    family: "frl",
    raw: 24,
    efficiency: 16 / 18,
  },
  frl32: {
    label: "HDMI FRL · 32 + TMDS 18",
    family: "frl",
    raw: 32,
    efficiency: 16 / 18,
  },
  frl40: {
    label: "HDMI FRL · 40 + TMDS 18",
    family: "frl",
    raw: 40,
    efficiency: 16 / 18,
  },
  frl48: {
    label: "HDMI FRL · 48 + TMDS 18",
    family: "frl",
    raw: 48,
    efficiency: 16 / 18,
  },
  // Public HDMI 2.2 sources establish these raw rates. Higher-rate payload
  // coding/packing is not assumed from HDMI 2.1's profiles.
  frl64: {
    label: "HDMI FRL · 64 + TMDS 18",
    family: "frl",
    raw: 64,
    efficiency: null,
  },
  frl80: {
    label: "HDMI FRL · 80 + TMDS 18",
    family: "frl",
    raw: 80,
    efficiency: null,
  },
  frl96: {
    label: "HDMI FRL · 96 + TMDS 18",
    family: "frl",
    raw: 96,
    efficiency: null,
  },
  rbr: {
    label: "DisplayPort RBR · 1.62/lane",
    family: "dp",
    raw: 1.62,
    efficiency: 0.8,
  },
  hbr: {
    label: "DisplayPort HBR · 2.7/lane",
    family: "dp",
    raw: 2.7,
    efficiency: 0.8,
  },
  hbr2: {
    label: "DisplayPort HBR2 · 5.4/lane",
    family: "dp",
    raw: 5.4,
    efficiency: 0.8,
  },
  hbr3: {
    label: "DisplayPort HBR3 · 8.1/lane",
    family: "dp",
    raw: 8.1,
    efficiency: 0.8,
  },
  uhbr10: {
    label: "DisplayPort UHBR10 · 10/lane",
    family: "dp",
    raw: 10,
    efficiency: (128 / 132) * 0.997,
  },
  uhbr13: {
    label: "DisplayPort UHBR13.5 · 13.5/lane",
    family: "dp",
    raw: 13.5,
    efficiency: (128 / 132) * 0.997,
  },
  uhbr20: {
    label: "DisplayPort UHBR20 · 20/lane",
    family: "dp",
    raw: 20,
    efficiency: (128 / 132) * 0.997,
  },
};
// Selecting a link profile explicitly declares its included lower-rate modes.
export const hdmiFrlRates = [9, 18, 24, 32, 40, 48, 64, 80, 96] as const;
export const sourceLinks = {
  hdmi: "https://www.hdmi.org/download/savefile?fileKey=Marketing%2Fformat-data-rate-tables-2021.pdf",
  tmds: "https://www.ti.com/lit/an/slla263/slla263.pdf",
  legacyHdmi: "https://www.ti.com/product/TS3DV520E",
  hdmi22: "https://www.hdmi.org/spec/hdmi2",
  dp11: "https://www.intel.com/content/www/us/en/support/articles/000023004.html",
  dp: "https://www.usb.org/sites/default/files/D2T1-4%20-%20VESA%20DP%20Alt%20Mode%20over%20USB%20Type-C.pdf",
};
