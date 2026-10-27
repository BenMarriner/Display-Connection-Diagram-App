import { makeDevice } from "./devices";
import { newPort, type Capabilities, type Device } from "./model";
import { applyTiming, type timings } from "./presets";
import { matchesLibrarySearch } from "./librarySearch";
import { prefillTemplatePort } from "./templateDefaults";

export const consoleFamilies = ["Nintendo", "PlayStation", "Xbox", "Retro HDMI"] as const;
export type ConsolePreset = {
  id: string;
  name: string;
  family: (typeof consoleFamilies)[number];
  aliases: string[];
  summary: string;
  sourceUrl: string;
  additionalSources?: string[];
  checked: string;
  notes: string;
  caps?: Partial<Capabilities>;
  defaultTiming?: (typeof timings)[number]["id"];
  hdmiInput?: boolean;
  portName?: string;
};

const CHECKED = "2026-10-27";
const sdr: Partial<Capabilities> = { hdr: "no", vrr: "no", dsc: "no" };
const hdr: Partial<Capabilities> = { hdr: "yes", vrr: "no", dsc: "unknown" };
const modern: Partial<Capabilities> = { hdr: "yes", vrr: "yes", dsc: "unknown" };
const ps3Source = "https://manuals.playstation.net/document/en/ps3/current/settings/videooutput.html";
const ps4Hdr = "https://www.playstation.com/en-us/support/hardware/ps4-how-to-enable-hdr/";
const ps5Video = "https://www.playstation.com/en-us/support/hardware/ps5-4k-resolution-guide/";
const xboxOneSpecs = "https://news.xbox.com/wp-content/uploads/sites/2/Xbox_One_Spec_Sheet.pdf";
const xbox120 = "https://news.xbox.com/en-us/2018/05/17/may-xbox-update-available/";
const xboxVrr = "https://news.xbox.com/en-us/2018/04/24/xbox-april-update/";
const switchSpecs = "https://www.nintendo.com/us/gaming-systems/switch/tech-specs/";

type Seed = Omit<ConsolePreset, "checked">;
const seeds: Seed[] = [
  {
    id: "nintendo-wii-u", name: "Nintendo Wii U", family: "Nintendo",
    aliases: ["WiiU", "Basic", "Premium", "Deluxe", "WUP-001"],
    summary: "1 × HDMI · up to 1080p",
    sourceUrl: "https://www.nintendo.com/en-gb/Wii-U/Hardware-Features/Specifications/Specifications-664742.html",
    caps: sdr,
    notes: "Basic/Premium/Deluxe Wii U systems. Nintendo lists 1080p, 1080i, 720p, 480p and 480i across its video connections. Analogue AV and the wireless GamePad screen are outside this HDMI profile. Interlaced timings are not modeled by this planner. This is not an original Wii with an HDMI adapter.",
  },
  {
    id: "nintendo-switch-docked", name: "Nintendo Switch · docked", family: "Nintendo",
    aliases: ["HAC-001", "HAC-001(-01)", "original", "V1", "V2", "2017", "2019"],
    summary: "Dock HDMI · up to 1080p60",
    sourceUrl: switchSpecs,
    additionalSources: ["https://www.nintendo.com/en-gb/Support/Troubleshooting/How-to-Adjust-the-TV-Settings-on-Nintendo-Switch-1508497.html"],
    caps: { ...sdr, formats: ["RGB"] },
    notes: "Combined Switch plus compatible powered dock, represented as one HDMI source. Covers original and battery-revised Switch systems; the HDMI socket is on the dock, not the handheld. TV settings list 480p, 720p and 1080p. Switch Lite has no TV output and is excluded. A separate USB-C upstream cable is not implied by this combined profile.",
  },
  {
    id: "nintendo-switch-oled-docked", name: "Nintendo Switch OLED · docked", family: "Nintendo",
    aliases: ["HEG-001", "HEG-007", "OLED Model"],
    summary: "Dock HDMI · up to 1080p60",
    sourceUrl: "https://www.nintendo.com/jp/hardware/switch/modal/specs/body_oled.html",
    additionalSources: [switchSpecs],
    caps: { ...sdr, formats: ["RGB"] },
    notes: "Combined OLED Switch plus compatible powered dock. Nintendo documents 1920×1080 at 60 fps in TV mode. The OLED handheld screen does not make HDMI output HDR or 4K. The LAN dock's HDMI connector is the physical output represented here.",
  },
  {
    id: "nintendo-switch-2-docked", name: "Nintendo Switch 2 · docked", family: "Nintendo",
    aliases: ["Switch2", "BEE-001", "BEE-005"],
    summary: "Dock HDMI · 4K60 / 1080p or 1440p120 · HDR / VRR",
    sourceUrl: "https://www.nintendo.com/au/hardware/nintendo-switch-2/tech-specs/",
    additionalSources: ["https://www.nintendo.com/us/gaming-systems/switch-2/tech-specs/"],
    caps: { ...modern, vrrMax: 120 },
    notes: "Combined Switch 2 plus its powered Switch 2 dock. Current Nintendo specifications list TV output up to 3840×2160 at 60 fps, 120 fps at 1920×1080 or 2560×1440, HDR10 and VRR up to 120 Hz. Check system software, game and TV support. Do not substitute the handheld panel's limits or infer 4K120, a minimum VRR frequency, HDMI version or raw link rate.",
  },

  ...[
    ["ps3-original", "Sony PlayStation 3 (PS3) · original", ["PS3 fat", "PS3 phat", "CECH original"]],
    ["ps3-slim", "Sony PlayStation 3 (PS3) Slim", ["PS3 slim", "CECH-2000", "CECH-3000"]],
    ["ps3-super-slim", "Sony PlayStation 3 (PS3) Super Slim", ["PS3 super slim", "CECH-4000"]],
  ].map(([id, name, aliases]) => ({
    id: id as string, name: name as string, aliases: aliases as string[], family: "PlayStation" as const,
    summary: "1 × HDMI · up to 1080p",
    sourceUrl: id === "ps3-super-slim"
      ? "https://sonyinteractive.com/en/press-releases/2012/new-smaller-and-lighter-playstation3-to-hit-the-worldwide-market/"
      : ps3Source,
    additionalSources: [ps3Source], caps: sdr,
    notes: "Retail PS3 HDMI output. Sony documents 480p/576p, 720p, 1080i and 1080p; available modes depend on region, content and display. Blu-ray 1080p24 and stereoscopic 3D require additional timing/format verification. Analogue outputs and interlaced/3D transport are outside this profile. Deep Color is not HDR10.",
  })),
  ...[
    ["ps4-original", "Sony PlayStation 4 (PS4) · original", ["PS4", "CUH-1000", "CUH-1100", "CUH-1200"]],
    ["ps4-slim", "Sony PlayStation 4 (PS4) Slim", ["PS4 slim", "CUH-2000", "CUH-2100", "CUH-2200"]],
  ].map(([id, name, aliases]) => ({
    id: id as string, name: name as string, aliases: aliases as string[], family: "PlayStation" as const,
    summary: "1 × HDMI · up to 1080p · HDR10", sourceUrl: ps4Hdr, caps: hdr,
    additionalSources: ["https://blog.playstation.com/2013/10/30/ps4-the-ultimate-faq-north-america/"],
    notes: "Standard PS4 display capability, including HDR10 with supported system software, content and display. This is not PS4 Pro: it does not provide Pro's 4K output. Sony's HDMI standards include 480p, 720p, 1080i and 1080p. Full mode/depth/format combinations are not inferred from HDR support.",
  })),
  {
    id: "ps4-pro", name: "Sony PlayStation 4 (PS4) Pro", family: "PlayStation",
    aliases: ["PS4 pro", "CUH-7000", "CUH-7100", "CUH-7200"],
    summary: "1 × HDMI · up to 4K60 · HDR10",
    sourceUrl: "https://www.playstation.com/en-gb/support/hardware/ps4-pro-4k-and-hdr-guide/",
    additionalSources: [ps4Hdr, "https://blog.playstation.com/2016/09/08/ps4-pro-the-ultimate-faq/"],
    caps: hdr,
    notes: "PS4 Pro adds 2160p output up to 60 Hz and HDR10 to standard PS4 video modes. RGB versus YCbCr and color depth depend on the selected mode and the complete HDMI chain. Rendering resolution varies by game; 4K output does not guarantee native 4K rendering. Raw HDMI rate remains unverified.",
  },
  ...[
    ["ps5-original", "Sony PlayStation 5 (PS5) · original disc", ["PS5", "CFI-1000", "CFI-1100", "CFI-1200", "disc"]],
    ["ps5-digital", "Sony PlayStation 5 (PS5) · original Digital Edition", ["PS5 digital", "CFI-1000B", "CFI-1100B", "CFI-1200B"]],
    ["ps5-slim", "Sony PlayStation 5 (PS5) Slim · disc", ["PS5 slim", "CFI-2000", "disc"]],
    ["ps5-slim-digital", "Sony PlayStation 5 (PS5) Slim · Digital Edition", ["PS5 slim digital", "CFI-2000B", "CFI-2100B"]],
  ].map(([id, name, aliases]) => ({
    id: id as string, name: name as string, aliases: aliases as string[], family: "PlayStation" as const,
    summary: "1 × HDMI 2.1 · up to 4K120 · HDR / VRR",
    sourceUrl: ps5Video, caps: { ...modern, version: "2.1" },
    additionalSources: ["https://blog.playstation.com/2020/11/09/ps5-the-ultimate-faq/"],
    notes: "PS5 HDMI output supports compatible 120 Hz games, HDR and HDMI VRR. Sony documents 1440p SDR/HDR at 60/120 Hz as well as 4K output. Disc versus digital and chassis size do not add display connectors. Do not infer 8K output from early packaging: Sony's current 8K setting is limited to PS5 Pro's CFI-7000 group. Optional feature ranges, per-mode color combinations and raw link rate remain unverified.",
  })),
  {
    id: "ps5-pro", name: "Sony PlayStation 5 (PS5) Pro", family: "PlayStation",
    aliases: ["PS5 pro", "CFI-7000", "CFI-7100"],
    summary: "1 × HDMI · 4K120 / 8K60 with DSC · HDR / VRR",
    sourceUrl: ps5Video,
    caps: { ...modern, dsc: "yes" },
    notes: "PS5 Pro adds an 8K60 output option requiring a compatible 8K60 display and DSC. HDR and VRR remain mode/content/display dependent. DSC is capability only: it is disabled in the default signal and no compression ratio is assumed. 8K needs a custom timing and verified compression settings. Do not infer an exhaustive timing table or HDMI wire rate.",
  },
  {
    id: "playstation-tv", name: "Sony PlayStation TV / PS Vita TV", family: "PlayStation",
    aliases: ["PSTV", "PS TV", "Vita TV", "VTE-1000"],
    summary: "1 × HDMI · 480p / 720p / 1080i",
    sourceUrl: "https://blog.playstation.com/2014/10/07/playstation-tv-the-ultimate-faq-2/",
    caps: sdr, defaultTiming: "720p60",
    notes: "Sony documents 480p, 720p and 1080i output, not 1080p or 4K. The planner starts this profile at 720p60. 1080i cannot be represented as progressive 1080p; interlaced timings are outside v1. The handheld PS Vita itself is not an HDMI source.",
  },

  ...[
    ["xbox-360-hdmi", "Microsoft Xbox 360 · HDMI-equipped models", ["Xbox 360 Elite", "Xbox 360 Arcade", "Xbox360", "later Premium", "Falcon", "Jasper"]],
    ["xbox-360-s", "Microsoft Xbox 360 S", ["Xbox 360 slim", "Xbox360S"]],
    ["xbox-360-e", "Microsoft Xbox 360 E", ["Xbox360E"]],
  ].map(([id, name, aliases]) => ({
    id: id as string, name: name as string, aliases: aliases as string[], family: "Xbox" as const,
    summary: "1 × HDMI · HD output", caps: sdr,
    sourceUrl: id === "xbox-360-e"
      ? "https://download.microsoft.com/download/8/8/D/88D92039-75C9-4D00-B114-E3676982BD7A/x188017502MNL%28JP%29.PDF"
      : id === "xbox-360-s"
        ? "https://download.microsoft.com/download/E/0/6/E06A913C-1EFC-4A62-85F3-F0A6E0A261F3/360_S_EN.pdf"
        : "https://download.microsoft.com/download/8/4/4/84423F99-7A70-4517-B241-58B442CAC766/X166949802bro.pdf",
    notes: "Only Xbox 360 systems with a physical HDMI AV socket are covered. Launch/Core and other non-HDMI revisions require separate external conversion and must not use this template as native HDMI hardware. Game rendering and output resolution are different; verify the exact dashboard mode. The cable's advertised HDMI rating does not establish the console's raw transport rate.",
  })),
  {
    id: "xbox-one", name: "Microsoft Xbox One · original", family: "Xbox",
    aliases: ["Xbox One 2013", "XboxOne", "original Xbox One"],
    summary: "HDMI 1.4b out + HDMI 1.4b in · up to 1080p60",
    sourceUrl: xboxOneSpecs, hdmiInput: true,
    caps: { ...sdr, version: "1.4b" },
    notes: "Microsoft documents one HDMI 1.4b output, one HDMI 1.4b input and output up to 1080p60; HDR10 is not supported. The HDMI input is for set-top-box/live-TV wiring, not an additional output. The input's complete display limits are not assumed from its version label.",
  },
  ...[
    ["xbox-one-s", "Microsoft Xbox One S", ["XboxOneS", "One S"]],
    ["xbox-one-s-all-digital", "Microsoft Xbox One S · All-Digital Edition", ["Xbox One S All Digital", "SAD", "disc-free"]],
    ["xbox-one-x", "Microsoft Xbox One X", ["XboxOneX", "One X", "Scorpio"]],
  ].map(([id, name, aliases]) => ({
    id: id as string, name: name as string, aliases: aliases as string[], family: "Xbox" as const,
    summary: "HDMI out + HDMI in · 4K60 / 1080p or 1440p120 · HDR / VRR",
    sourceUrl: xboxOneSpecs,
    additionalSources: [xbox120, xboxVrr, ...(id === "xbox-one-s-all-digital"
      ? ["https://news.xbox.com/en-us/2019/04/16/introducing-the-newest-member-of-the-xbox-one-family-the-xbox-one-s-all-digital-edition/"]
      : [])],
    hdmiInput: true,
    caps: { ...modern, version: id === "xbox-one-x" ? "2.0b" : "2.0a", dsc: "no" as const },
    notes: "The HDMI input is 1.4b and separate from the display output. Microsoft added 1080p/1440p 120 Hz output and FreeSync support through system updates; verify the installed firmware and display. 4K60 output on One S includes video/upscaling and is not a claim of native 4K game rendering. All-Digital Edition removes the disc drive. Exact per-mode formats, depths and link rates remain unverified.",
  })),
  ...[
    ["xbox-series-x", "Microsoft Xbox Series X · disc", ["Series X", "XSX", "Carbon Black", "Galaxy Black", "1TB", "2TB"]],
    ["xbox-series-x-digital", "Microsoft Xbox Series X · Digital Edition", ["Series X digital", "Robot White", "1TB"]],
    ["xbox-series-s", "Microsoft Xbox Series S", ["Series S", "XSS", "512GB", "1TB", "Carbon Black", "Robot White"]],
  ].map(([id, name, aliases]) => ({
    id: id as string, name: name as string, aliases: aliases as string[], family: "Xbox" as const,
    summary: "1 × HDMI 2.1 · up to 120 Hz · HDR / VRR",
    sourceUrl: id === "xbox-series-s"
      ? "https://www.xbox.com/en-us/consoles/xbox-series-s"
      : "https://www.xbox.com/en-us/consoles/xbox-series-x",
    additionalSources: ["https://www.xbox.com/en-us/consoles/compare/"],
    caps: { ...modern, version: "2.1" },
    notes: id === "xbox-series-s"
      ? "Series S targets 1440p gaming up to 120 fps and supports 4K video/upscaling. Rendering targets are not exhaustive HDMI output mode lists. Storage/color revisions share this one-output profile. No HDMI input. HDR and HDMI VRR support require compatible content/display; no raw lane rate or universal 4K120/8K capability is inferred from the port version."
      : "Series X supports 4K gaming with up to 120 fps, HDR and HDMI VRR. This profile covers the named disc or digital variant; storage/color revisions do not add HDMI sockets. No HDMI input. Do not treat an advertised 8K hardware target as a verified selectable firmware mode or assume a raw HDMI transport rate.",
  })),

  {
    id: "nes-classic", name: "Nintendo NES Classic / Famicom Mini", family: "Retro HDMI",
    aliases: ["NES Mini", "Nintendo Classic Mini NES", "CLV", "Famicom"],
    summary: "1 × HDMI · official NES-era re-release",
    sourceUrl: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/17344/",
    additionalSources: ["https://support-jp.nintendo.com/app/answers/detail/a_id/33641"],
    caps: sdr, defaultTiming: "720p60",
    notes: "Official HDMI miniature re-release, not an original NES/Famicom with an HDMI modification. Regional game libraries and controllers differ. Nintendo's setup source documents HDMI but not an exhaustive mode table; 720p60 is an editable planning starter, not an assertion of every supported timing.",
  },
  {
    id: "snes-classic", name: "Nintendo SNES Classic / Super Famicom Mini", family: "Retro HDMI",
    aliases: ["Super NES Classic", "SNES Mini", "Nintendo Classic Mini Super Nintendo", "Super Famicom"],
    summary: "1 × HDMI · official SNES-era re-release",
    sourceUrl: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/27246/",
    additionalSources: ["https://www.nintendo.co.jp/clvs/spec/index.html"],
    caps: sdr, defaultTiming: "720p60",
    notes: "Official HDMI miniature re-release, not original SNES/Super Famicom hardware. Regional shells and game libraries differ. The manufacturer setup guide documents an HDMI OUT port; unspecified timing, color and transport details remain unknown. 720p60 is an editable planning starter.",
  },
  {
    id: "playstation-classic", name: "Sony PlayStation Classic", family: "Retro HDMI",
    aliases: ["PS Classic", "PS1 Mini", "PlayStation Mini", "SCPH-1000R"],
    summary: "1 × HDMI · 720p / 480p",
    sourceUrl: "https://blog.playstation.com/2018/11/26/playstation-classic-the-miniature-ultimate-faq/",
    caps: sdr, defaultTiming: "720p60",
    notes: "Official PlayStation-era miniature. Sony specifies 720p or 480p over HDMI only. This is not a PS1/PSone with a converter, and is not a 1080p source. Exact refresh/timing and color tables are not provided by the FAQ.",
  },
  {
    id: "sega-genesis-mini", name: "SEGA Genesis Mini / Mega Drive Mini", family: "Retro HDMI",
    aliases: ["MD Mini", "MegaDrive", "Genesis Mini 1"],
    summary: "1 × HDMI · official Mega Drive / Genesis re-release",
    sourceUrl: "https://www.sega.jp/mdmini/outline.html",
    caps: sdr, defaultTiming: "720p60",
    notes: "Official first-generation miniature. Regional names and game libraries differ. HDMI video output is distinct from the original console's analogue ports. Verify the actual regional mode/timing table; no color-depth or HDMI wire-rate assumptions are made.",
  },
  {
    id: "sega-genesis-mini-2", name: "SEGA Genesis Mini 2 / Mega Drive Mini 2", family: "Retro HDMI",
    aliases: ["MD Mini 2", "MegaDrive2", "Mega CD Mini", "Sega CD Mini"],
    summary: "1 × HDMI · 720p / 480p",
    sourceUrl: "https://www.sega.jp/genesismini2/jp/outline.html",
    caps: sdr, defaultTiming: "720p60",
    notes: "Second-generation official miniature, with Genesis/Mega Drive and SEGA CD/Mega-CD titles. SEGA specifies 720p and 480p output. This profile does not imply native HDMI on the original Mega Drive or Mega-CD accessory. Regional title libraries differ.",
  },
  {
    id: "turbografx-mini", name: "Konami TurboGrafx-16 / PC Engine / CoreGrafx mini", family: "Retro HDMI",
    aliases: ["TG16", "TG-16 Mini", "TurboGrafx", "PC Engine Mini", "Core Grafx"],
    summary: "1 × HDMI · 720p / 480p",
    sourceUrl: "https://dds.konami.com/games/manual/pcemini/tgx16_manual.pdf",
    caps: sdr, defaultTiming: "720p60",
    notes: "Official miniature family recreating the TurboGrafx-16/PC Engine platform. The manufacturer manual lists HDMI output at 720p or 480p. Regional shells and included titles differ; original consoles require external conversion. Exact refresh/timing and transport-rate details remain unverified.",
  },
  {
    id: "atari-2600-plus", name: "Atari 2600+", family: "Retro HDMI",
    aliases: ["Atari 2600 Plus", "Atari+", "PAC-MAN Edition"],
    summary: "1 × HDMI · 2600 / 7800 cartridge re-release",
    sourceUrl: "https://atari.com/products/atari-2600-plus",
    caps: sdr, defaultTiming: "720p60",
    notes: "Modern Atari cartridge console with HDMI output, not the original RF/analogue 2600. The cited product page does not specify a full resolution/refresh table or raw HDMI rate. 720p60 is an editable starting signal and needs verification on the actual unit.",
  },
  {
    id: "atari-7800-plus", name: "Atari 7800+", family: "Retro HDMI",
    aliases: ["Atari 7800 Plus", "Atari+"],
    summary: "1 × HDMI · 2600 / 7800 cartridge re-release",
    sourceUrl: "https://support.atari.com/hc/en-us/articles/31506155704987-Atari-7800-FAQs",
    caps: sdr, defaultTiming: "720p60",
    notes: "Modern Atari cartridge console with HDMI output. The manufacturer FAQ does not provide complete resolution/refresh or transport specifications; leave these unknown until checked. This profile is not an original Atari 7800. 720p60 is an editable planning starter.",
  },
  {
    id: "atari-vcs", name: "Atari VCS (modern)", family: "Retro HDMI",
    aliases: ["Atari VCS 800", "Atari VCS Onyx", "Atari VCS Black Walnut"],
    summary: "1 × HDMI 2.0 · 4K video capability",
    sourceUrl: "https://support.atari.com/hc/en-us/articles/17386531014043-Technical-Specifications",
    caps: { version: "2.0" },
    notes: "Modern AMD-based Atari VCS gaming/PC system, not the original Atari 2600/VCS. Atari specifies HDMI 2.0 and 4K video support with HDCP 2.2. OS, PC mode and content affect video modes; no 4K refresh rate, HDR, VRR, color table or raw transport rate is inferred.",
  },
  {
    id: "neogeo-mini", name: "SNK NEOGEO mini / International", family: "Retro HDMI",
    aliases: ["Neo Geo Mini", "NeoGeo Mini International"],
    summary: "1 × mini-HDMI output · external TV mode",
    sourceUrl: "https://www.snk-corp.co.jp/us/press/2018/061101/",
    additionalSources: ["https://www.snk-corp.co.jp/faq/"],
    caps: sdr, defaultTiming: "720p60", portName: "Mini-HDMI out",
    notes: "External TV output from the official NEOGEO miniature; the built-in screen is not a separate output stream. Requires a mini-HDMI-to-HDMI cable. The planner models the HDMI connector family and does not validate Type-A versus Type-C shell sizes. Source does not establish an exhaustive output timing/format table; 720p60 is an editable planning starter. Regional libraries differ.",
  },
  {
    id: "neogeo-arcade-stick-pro", name: "SNK NEOGEO Arcade Stick Pro", family: "Retro HDMI",
    aliases: ["Neo Geo ASP", "Arcade Stick PRO", "NeoGeo ASP"],
    summary: "1 × HDMI · standalone console mode",
    sourceUrl: "https://www.snk-corp.co.jp/us/neogeoarcadestickpro/index.html",
    caps: sdr, defaultTiming: "720p60",
    notes: "Use in standalone console mode with external power and HDMI output. USB controller mode is not HDMI video input or pass-through. SNK does not state an exhaustive mode table on the cited product page; 720p60 is an editable starting signal, not a verified maximum.",
  },
];

export const consolePresets: ConsolePreset[] = seeds.map((p) => ({ ...p, checked: CHECKED }));

export function consolePresetSearchText(preset: ConsolePreset): string {
  return [preset.name, preset.family, preset.summary, ...preset.aliases].join(" ");
}

export function matchesConsolePreset(preset: ConsolePreset, query: string): boolean {
  return matchesLibrarySearch(consolePresetSearchText(preset), query);
}

/** Verified common output modes; the list is intentionally non-exhaustive. */
function consoleModes(preset: ConsolePreset): string[] | null {
  const key = preset.id;
  if (key.startsWith("ps5")) return ["720p60", "1080p60", "1080p120", "1440p60", "1440p120", "4k30", "4k60", "4k120"];
  if (key === "ps4-pro" || key.startsWith("xbox-one-s") || key === "xbox-one-x")
    return ["720p60", "1080p60", ...(key === "ps4-pro" ? [] : ["1080p120", "1440p120"]), "4k30", "4k60"];
  if (key.startsWith("xbox-series")) return ["1080p60", "1080p120", "1440p60", "1440p120", "4k60", ...(key === "xbox-series-s" ? [] : ["4k120"])];
  if (key === "nintendo-switch-2-docked") return ["1080p60", "1080p120", "1440p60", "1440p120", "4k60"];
  if (key.startsWith("ps3") || key.startsWith("ps4") || key.startsWith("xbox-360") || key === "xbox-one" ||
    key === "nintendo-wii-u" || key.startsWith("nintendo-switch")) return ["720p60", "1080p60"];
  if (["nes-classic", "snes-classic", "playstation-classic", "sega-genesis-mini", "sega-genesis-mini-2", "playstation-tv"].includes(key)) return ["720p60"];
  return null;
}

export function makeConsoleDevice(
  preset: ConsolePreset,
  position = { x: 80, y: 80 },
): Device {
  const output = newPort("out", "HDMI", preset.portName ?? "HDMI out");
  output.caps = { ...output.caps, ...structuredClone(preset.caps ?? {}) };
  const knownModes = consoleModes(preset);
  if (output.caps.modes === null && knownModes) {
    output.caps.modes = knownModes;
    output.caps.modesComplete = false;
  }
  if (preset.defaultTiming) output.signal = applyTiming(output.signal, preset.defaultTiming);
  const inputs = preset.hdmiInput ? [newPort("in", "HDMI", "HDMI in (TV)")] : [];
  for (const input of inputs) input.caps.version = "1.4b";
  return {
    ...makeDevice("console", position),
    name: preset.name,
    model: preset.name,
    ports: [...inputs, output].map(prefillTemplatePort),
    selectedInput: null,
    maxStreams: 1,
    specUrl: preset.sourceUrl,
    notes: [
      preset.summary,
      preset.notes,
      preset.hdmiInput ? "HDMI input is shown for physical wiring only. Live-TV/OneGuide pass-through is not simulated; HDMI out uses this console's configured source signal." : "",
      "Unpublished transport rates and complete timing/depth/format matrices remain unknown. Peak output descriptions do not establish a complete mode list or native game rendering resolution.",
      ...(preset.additionalSources ?? []).map((url) => `Additional source: ${url}`),
      `Specifications checked ${preset.checked}.`,
    ].filter(Boolean).join("\n\n"),
  };
}
