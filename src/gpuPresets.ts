import { makeDevice } from "./devices";
import { newPort, type Port, type Project, type Device } from "./model";

/**
 * Curated desktop GPU output layouts.
 *
 * Verification scope for this pass (2026-10-27):
 * - Current NVIDIA GeForce RTX 50-series desktop boards with exact manufacturer
 *   sources found for the variants below, plus the RTX 4090 FE and GIGABYTE
 *   RTX 3060 GAMING OC 12G presets.
 * - Current AMD Radeon RX 9000-series desktop boards with exact manufacturer
 *   sources found for the variants below.
 * - Current Intel Arc B-series desktop boards with exact manufacturer
 *   sources found for the variants below.
 *
 * This intentionally does not claim to be a historical catalogue of every
 * retail graphics card ever produced. A board is omitted rather than guessed
 * when an exact board source, physical DP/HDMI layout, or simultaneous-display
 * limit could not be established. Boards with additional output connector types
 * that the current simulator connector model cannot faithfully represent are
 * also omitted from this file.
 */

export type GpuPreset = {
  id: string;
  name: string;
  summary: string;
  sourceUrl: string;
  checked: string;
  notes: string;
  maxDisplays: number;
  ports: () => Port[];
};

const CHECKED = "2026-10-27";
const nvidiaBase = "https://www.nvidia.com/en-us/geforce/graphics-cards/";

function gpuPort(
  name: string,
  connector: Port["connector"],
  version: string,
  link: Port["caps"]["link"] = "unknown",
  features: Partial<Port["caps"]> = {},
): Port {
  const port = newPort("out", connector, name);
  port.caps = { ...port.caps, version, link, ...features };
  return port;
}

function nvidia50Ports(): Port[] {
  return [1, 2, 3]
    .map((n) =>
      gpuPort(`DP ${n}`, "DisplayPort", "2.1b", "uhbr20", {
        hdr: "yes",
        dsc: "yes",
      }),
    )
    .concat(
      gpuPort("HDMI 1", "HDMI", "2.1b", "unknown", {
        vrr: "yes",
        hdr: "yes",
        dsc: "yes",
      }),
    );
}

function nvidia50AibPorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1b"),
    gpuPort("DP 2", "DisplayPort", "2.1b"),
    gpuPort("DP 3", "DisplayPort", "2.1b"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
  ];
}

function msi50Ports(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1b"),
    gpuPort("DP 2", "DisplayPort", "2.1b"),
    gpuPort("DP 3", "DisplayPort", "2.1b"),
    gpuPort("HDMI 1", "HDMI", "2.1b", "unknown", {
      vrr: "yes",
      hdr: "yes",
      dsc: "yes",
    }),
  ];
}

function zotac50Ports(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1b", "uhbr20"),
    gpuPort("DP 2", "DisplayPort", "2.1b", "uhbr20"),
    gpuPort("DP 3", "DisplayPort", "2.1b", "uhbr20"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
  ];
}

function nvidia50FiveOutputPorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1b"),
    gpuPort("DP 2", "DisplayPort", "2.1b"),
    gpuPort("DP 3", "DisplayPort", "2.1b"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
    gpuPort("HDMI 2", "HDMI", "2.1b"),
  ];
}

function asus5060LowProfilePorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1a"),
    gpuPort("HDMI 1", "HDMI", "2.1"),
    gpuPort("HDMI 2", "HDMI", "2.1"),
  ];
}

function radeon9000ThreeDpOneHdmiPorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1a"),
    gpuPort("DP 2", "DisplayPort", "2.1a"),
    gpuPort("DP 3", "DisplayPort", "2.1a"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
  ];
}

function radeon9000TwoDpTwoHdmiPorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1a"),
    gpuPort("DP 2", "DisplayPort", "2.1a"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
    gpuPort("HDMI 2", "HDMI", "2.1b"),
  ];
}

function radeon9060TwoDpOneHdmiPorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1a"),
    gpuPort("DP 2", "DisplayPort", "2.1a"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
  ];
}

function sapphire9070XtPulsePorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1a"),
    gpuPort("DP 2", "DisplayPort", "2.1a"),
    gpuPort("HDMI 1", "HDMI", ""),
    gpuPort("HDMI 2", "HDMI", ""),
  ];
}

function sapphire9060Ports(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1a"),
    gpuPort("HDMI 1", "HDMI", ""),
    gpuPort("HDMI 2", "HDMI", ""),
  ];
}

function gigabyte5050Ports(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1b"),
    gpuPort("DP 2", "DisplayPort", "2.1b"),
    gpuPort("HDMI 1", "HDMI", "2.1b"),
    gpuPort("HDMI 2", "HDMI", "2.1b"),
  ];
}

function intelArcBPartnerPorts(): Port[] {
  return [
    // ASRock documents distinct rates for the primary and secondary DP ports.
    gpuPort("DP primary", "DisplayPort", "2.1", "uhbr13"),
    gpuPort("DP 2", "DisplayPort", "2.1", "uhbr10"),
    gpuPort("DP 3", "DisplayPort", "2.1", "uhbr10"),
    gpuPort("HDMI 1", "HDMI", "2.1a"),
  ];
}

function intelArcBGenericPorts(): Port[] {
  return [
    gpuPort("DP 1", "DisplayPort", "2.1"),
    gpuPort("DP 2", "DisplayPort", "2.1"),
    gpuPort("DP 3", "DisplayPort", "2.1"),
    gpuPort("HDMI 1", "HDMI", "2.1"),
  ];
}

type BoardSeed = {
  id: string;
  name: string;
  sourceUrl: string;
  notes?: string;
};

function boardPresets(
  boards: readonly BoardSeed[],
  summary: string,
  maxDisplays: number,
  ports: () => Port[],
  commonNotes: string,
): GpuPreset[] {
  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    summary,
    sourceUrl: board.sourceUrl,
    checked: CHECKED,
    maxDisplays,
    notes: `${commonNotes}${board.notes ? ` ${board.notes}` : ""}`,
    ports,
  }));
}

const asusFiveOutputBoards: BoardSeed[] = [
  {
    id: "asus-rog-astral-rtx5090-o32g-gaming",
    name: "ASUS ROG Astral RTX 5090 · ROG-ASTRAL-RTX5090-O32G-GAMING",
    sourceUrl:
      "https://rog.asus.com/au/graphics-cards/graphics-cards/rog-astral/rog-astral-rtx5090-o32g-gaming/spec/",
  },
  {
    id: "asus-tuf-rtx5090-o32g-gaming",
    name: "ASUS TUF Gaming RTX 5090 · TUF-RTX5090-O32G-GAMING",
    sourceUrl:
      "https://www.asus.com/ea/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5090-o32g-gaming/techspec/",
  },
  {
    id: "asus-rog-astral-rtx5080-o16g-gaming",
    name: "ASUS ROG Astral RTX 5080 · ROG-ASTRAL-RTX5080-O16G-GAMING",
    sourceUrl:
      "https://rog.asus.com/au/graphics-cards/graphics-cards/rog-astral/rog-astral-rtx5080-o16g-gaming/spec/",
  },
  {
    id: "asus-tuf-rtx5080-o16g-gaming",
    name: "ASUS TUF Gaming RTX 5080 · TUF-RTX5080-O16G-GAMING",
    sourceUrl:
      "https://www.asus.com/au/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5080-o16g-gaming/techspec/",
  },
  {
    id: "asus-tuf-rtx5070ti-o16g-gaming",
    name: "ASUS TUF Gaming RTX 5070 Ti · TUF-RTX5070TI-O16G-GAMING",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5070ti-o16g-gaming/techspec/",
  },
];

const asusStandardNvidiaBoards: BoardSeed[] = [
  {
    id: "asus-tuf-rtx5060ti-8g-gaming",
    name: "ASUS TUF Gaming RTX 5060 Ti · TUF-RTX5060TI-8G-GAMING",
    sourceUrl:
      "https://www.asus.com/us/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx5060ti-8g-gaming/techspec/",
  },
  {
    id: "asus-prime-rtx5050-8g",
    name: "ASUS Prime RTX 5050 · PRIME-RTX5050-8G",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rtx5050-8g/techspec/",
  },
];

const msiNvidiaBoards: BoardSeed[] = [
  {
    id: "msi-rtx5090-32g-ventus-3x-oc",
    name: "MSI RTX 5090 VENTUS 3X OC · G5090-32V3C",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5090-32G-VENTUS-3X-OC/Specification",
  },
  {
    id: "msi-rtx5090-32g-suprim-soc",
    name: "MSI RTX 5090 SUPRIM SOC · G5090-32SPS",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5090-32G-SUPRIM-SOC/Specification",
  },
  {
    id: "msi-rtx5080-16g-suprim-liquid-soc",
    name: "MSI RTX 5080 SUPRIM LIQUID SOC · G5080-16SLS",
    sourceUrl:
      "https://www.msi.com/Graphics-Card/GeForce-RTX-5080-16G-SUPRIM-LIQUID-SOC/Specification",
  },
  {
    id: "msi-rtx5080-16g-suprim-draco-epic",
    name: "MSI RTX 5080 SUPRIM DRACO EPIC EDITION · 16G",
    sourceUrl:
      "https://in.msi.com/Graphics-Card/GeForce-RTX-5080-16G-SUPRIM-DRACO-EPIC-EDITION/Specification",
  },
  {
    id: "msi-rtx5080-16g-shadow-3x-oc",
    name: "MSI RTX 5080 SHADOW 3X OC · G5080-16S3C",
    sourceUrl:
      "https://de.msi.com/Graphics-Card/GeForce-RTX-5080-16G-SHADOW-3X-OC/Specification",
  },
  {
    id: "msi-rtx5080-16g-ventus-3x-oc-plus",
    name: "MSI RTX 5080 VENTUS 3X OC PLUS · G5080-16V3CP",
    sourceUrl:
      "https://in.msi.com/Graphics-Card/GeForce-RTX-5080-16G-VENTUS-3X-OC-PLUS/Specification",
  },
  {
    id: "msi-rtx5070ti-16g-ventus-3x-pz",
    name: "MSI RTX 5070 Ti VENTUS 3X PZ · G507T-16V3Z",
    sourceUrl:
      "https://kh.msi.com/Graphics-Card/GeForce-RTX-5070-Ti-16G-VENTUS-3X-PZ/Specification",
  },
  {
    id: "msi-rtx5070ti-16g-expert-oc",
    name: "MSI RTX 5070 Ti EXPERT OC · 16G",
    sourceUrl:
      "https://storage-asset.msi.com/datasheet/vga/in/GeForce-RTX-5070-Ti-16G-EXPERT-OC.pdf",
  },
  {
    id: "msi-rtx5070-12g-ventus-2x-oc",
    name: "MSI RTX 5070 VENTUS 2X OC · G5070-12V2C",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5070-12G-VENTUS-2X-OC/Specification",
  },
  {
    id: "msi-rtx5060ti-16g-gaming-trio-oc",
    name: "MSI RTX 5060 Ti GAMING TRIO OC · G506T-16GTC",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-16G-GAMING-TRIO-OC/Specification",
  },
  {
    id: "msi-rtx5060ti-16g-gaming",
    name: "MSI RTX 5060 Ti GAMING · G506T-16G",
    sourceUrl:
      "https://de.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-16G-GAMING/Specification",
  },
  {
    id: "msi-rtx5060ti-16g-gaming-oc",
    name: "MSI RTX 5060 Ti GAMING OC · G506T-16GC",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-16G-GAMING-OC/Specification",
  },
  {
    id: "msi-rtx5060ti-8g-ventus-2x-oc-plus",
    name: "MSI RTX 5060 Ti VENTUS 2X OC PLUS · G506T-8V2CP",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-8G-VENTUS-2X-OC-PLUS/Specification",
  },
  {
    id: "msi-rtx5060-8g-inspire-2x-oc",
    name: "MSI RTX 5060 INSPIRE 2X OC · G506-8I2C",
    sourceUrl:
      "https://uk.msi.com/Graphics-Card/GeForce-RTX-5060-8G-INSPIRE-2X-OC/Specification",
  },
  {
    id: "msi-rtx5060-8g-gaming",
    name: "MSI RTX 5060 GAMING · G5060-8G",
    sourceUrl:
      "https://storage-asset.msi.com/datasheet/vga/id/GeForce-RTX-5060-8G-GAMING.pdf",
  },
];

const gigabyteNvidiaBoards: BoardSeed[] = [
  {
    id: "gigabyte-rtx5090-windforce-gv-n5090wf3-32gd",
    name: "GIGABYTE RTX 5090 WINDFORCE · GV-N5090WF3-32GD",
    sourceUrl:
      "https://www.gigabyte.com/au/Graphics-Card/GV-N5090WF3-32GD/sp",
  },
  {
    id: "gigabyte-rtx5090-gaming-oc-gv-n5090gaming-oc-32gd",
    name: "GIGABYTE RTX 5090 GAMING OC · GV-N5090GAMING-OC-32GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5090GAMING-OC-32GD/sp",
  },
  {
    id: "gigabyte-rtx5080-aorus-infinity-gv-n5080aorus-if-16gd",
    name: "GIGABYTE AORUS RTX 5080 INFINITY · GV-N5080AORUS-IF-16GD",
    sourceUrl:
      "https://www.gigabyte.com/au/Graphics-Card/GV-N5080AORUS-IF-16GD/sp",
  },
  {
    id: "gigabyte-rtx5080-aero-oc-gv-n5080aero-oc-16gd",
    name: "GIGABYTE RTX 5080 AERO OC SFF · GV-N5080AERO-OC-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5080AERO-OC-16GD/sp",
  },
  {
    id: "gigabyte-rtx5080-gaming-gv-n5080gaming-16gd",
    name: "GIGABYTE RTX 5080 GAMING · GV-N5080GAMING-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5080GAMING-16GD/sp",
  },
  {
    id: "gigabyte-rtx5070-gaming-gv-n5070gaming-12gd",
    name: "GIGABYTE RTX 5070 GAMING · GV-N5070GAMING-12GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5070GAMING-12GD/sp",
  },
  {
    id: "gigabyte-rtx5070-gaming-oc-gv-n5070gaming-oc-12gd",
    name: "GIGABYTE RTX 5070 GAMING OC · GV-N5070GAMING-OC-12GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5070GAMING-OC-12GD/sp",
  },
  {
    id: "gigabyte-rtx5070-aero-gv-n5070aero-12gd",
    name: "GIGABYTE RTX 5070 AERO · GV-N5070AERO-12GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5070AERO-12GD/sp",
  },
  {
    id: "gigabyte-rtx5060-gaming-gv-n5060gaming-8gd",
    name: "GIGABYTE RTX 5060 GAMING · GV-N5060GAMING-8GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5060GAMING-8GD/sp",
  },
  {
    id: "gigabyte-rtx5060-windforce-gv-n5060wf2-8gd",
    name: "GIGABYTE RTX 5060 WINDFORCE · GV-N5060WF2-8GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5060WF2-8GD/sp",
  },
  {
    id: "gigabyte-rtx5060-windforce-max-oc-gv-n5060wf2max-oc-8gd",
    name: "GIGABYTE RTX 5060 WINDFORCE MAX OC · GV-N5060WF2MAX-OC-8GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5060WF2MAX-OC-8GD/sp",
  },
  {
    id: "gigabyte-rtx5060-windforce-oc-gv-n5060wf2oc-8gd",
    name: "GIGABYTE RTX 5060 WINDFORCE OC · GV-N5060WF2OC-8GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5060WF2OC-8GD/sp",
  },
];

const zotacNvidiaBoards: BoardSeed[] = [
  {
    id: "zotac-rtx5090-solid-oc-zt-b50900j-10p",
    name: "ZOTAC GAMING RTX 5090 SOLID OC · ZT-B50900J-10P",
    sourceUrl:
      "https://www.zotac.com/au/product/graphics_card/zotac-gaming-geforce-rtx-5090-solid-oc",
  },
  {
    id: "zotac-rtx5080-solid-oc",
    name: "ZOTAC GAMING RTX 5080 SOLID OC · ZT-B50800J-10P",
    sourceUrl:
      "https://www.zotac.com/au/product/graphics_card/zotac-gaming-geforce-rtx-5080-solid-oc",
  },
  {
    id: "zotac-rtx5080-solid-core-oc",
    name: "ZOTAC GAMING RTX 5080 SOLID CORE OC · ZT-B50800J2-10P",
    sourceUrl:
      "https://www.zotac.com/vg/product/graphics_card/zotac-gaming-geforce-rtx-5080-solid-core-oc",
  },
  {
    id: "zotac-rtx5070ti-solid-core-oc",
    name: "ZOTAC GAMING RTX 5070 Ti SOLID CORE OC · ZT-B50710J2-10P",
    sourceUrl:
      "https://www.zotac.com/vg/product/graphics_card/zotac-gaming-geforce-rtx-5070-ti-solid-core-oc",
  },
  {
    id: "zotac-rtx5070-solid-oc",
    name: "ZOTAC GAMING RTX 5070 SOLID OC · ZT-B50700J-10P",
    sourceUrl:
      "https://www.zotac.com/us/us-store/product/graphics_card/zotac-gaming-geforce-rtx-5070-solid-oc",
  },
  {
    id: "zotac-rtx5070-solid-zt-b50700d-10p",
    name: "ZOTAC GAMING RTX 5070 SOLID · ZT-B50700D-10P",
    sourceUrl:
      "https://www.zotac.com/us/product/graphics_card/zotac-gaming-geforce-rtx-5070-solid",
  },
  {
    id: "zotac-rtx5060ti-8gb-twin-edge",
    name: "ZOTAC GAMING RTX 5060 Ti 8GB Twin Edge",
    sourceUrl:
      "https://www.zotac.com/au/product/graphics_card/zotac-gaming-geforce-rtx-5060-ti-8gb-twin-edge",
  },
  {
    id: "zotac-rtx5060-twin-edge",
    name: "ZOTAC GAMING RTX 5060 Twin Edge · ZT-B50600E-10M",
    sourceUrl:
      "https://www.zotac.com/au/product/graphics_card/zotac-gaming-geforce-rtx-5060-twin-edge",
  },
];

const pnyNvidiaBoards: BoardSeed[] = [
  {
    id: "pny-rtx5090-triple-fan-vcg509032tfxpb1",
    name: "PNY RTX 5090 Triple Fan · VCG509032TFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5090-models?isCommercial=true&sku=VCG509032TFXPB1",
  },
  {
    id: "pny-rtx5090-argb-oc-vcg509032tfxxpb1-o",
    name: "PNY RTX 5090 ARGB EPIC-X RGB OC Triple Fan · VCG509032TFXXPB1-O",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5090-models?sku=VCG509032TFXXPB1-O",
  },
  {
    id: "pny-rtx5080-triple-fan-vcg508016tfxpb1",
    name: "PNY RTX 5080 Triple Fan · VCG508016TFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5080-models?isCommercial=true&sku=VCG508016TFXPB1",
  },
  {
    id: "pny-rtx5080-argb-vcg508016tfxxpb1",
    name: "PNY RTX 5080 ARGB EPIC-X RGB Triple Fan · VCG508016TFXXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5080-models?sku=VCG508016TFXXPB1",
  },
  {
    id: "pny-rtx5080-argb-oc-vcg508016tfxxpb1-o",
    name: "PNY RTX 5080 ARGB EPIC-X RGB OC Triple Fan · VCG508016TFXXPB1-O",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5080-models?sku=VCG508016TFXXPB1-O",
  },
  {
    id: "pny-rtx5070ti-triple-fan-vcg5070t16tfxpb1",
    name: "PNY RTX 5070 Ti Triple Fan · VCG5070T16TFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5070-ti-models?sku=VCG5070T16TFXPB1",
  },
  {
    id: "pny-rtx5070ti-oc-vcg5070t16tfxpb1-o",
    name: "PNY RTX 5070 Ti OC Triple Fan · VCG5070T16TFXPB1-O",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5070-ti-models?sku=VCG5070T16TFXPB1-O",
  },
  {
    id: "pny-rtx5070ti-argb-vcg5070t16tfxxpb1",
    name: "PNY RTX 5070 Ti ARGB EPIC-X RGB Triple Fan · VCG5070T16TFXXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5070-ti-models?sku=VCG5070T16TFXXPB1",
  },
  {
    id: "pny-rtx5070ti-argb-oc-vcg5070t16tfxxpb1-o",
    name: "PNY RTX 5070 Ti ARGB EPIC-X RGB OC Triple Fan · VCG5070T16TFXXPB1-O",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5070-ti-models?sku=VCG5070T16TFXXPB1-O",
  },
  {
    id: "pny-rtx5070-triple-fan-vcg507012tfxpb1",
    name: "PNY RTX 5070 Triple Fan · VCG507012TFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5070-models?sku=VCG507012TFXPB1",
  },
  {
    id: "pny-rtx5060ti-16-dual-vcg5060t16dfxpb1",
    name: "PNY RTX 5060 Ti 16GB Dual Fan · VCG5060T16DFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5060-ti-16gb-models?sku=VCG5060T16DFXPB1",
  },
  {
    id: "pny-rtx5060ti-16-argb-oc-vcg5060t16tfxxpb1-o",
    name: "PNY RTX 5060 Ti 16GB EPIC-X RGB OC Triple Fan · VCG5060T16TFXXPB1-O",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5060-ti-16gb-models?sku=VCG5060T16TFXXPB1-O",
  },
  {
    id: "pny-rtx5060-dual-vcg50608dfxpb1",
    name: "PNY RTX 5060 Dual Fan · VCG50608DFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5060-8gb-models?sku=VCG50608DFXPB1",
  },
  {
    id: "pny-rtx5050-dual-vcg50508dfxpb1",
    name: "PNY RTX 5050 Dual Fan · VCG50508DFXPB1",
    sourceUrl:
      "https://www.pny.com/geforce-rtx-5050-models?sku=VCG50508DFXPB1",
  },
];

const palitNvidiaBoards: BoardSeed[] = [
  {
    id: "palit-rtx5090-gamerock-oc-5335",
    name: "Palit RTX 5090 GameRock OC · NE75090S19R5-GB2020G",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5335&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5080-gamerock-5355",
    name: "Palit RTX 5080 GameRock · NE75080019T2-GB2030G",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5355&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5080-gamingpro-oc-v1-5655",
    name: "Palit RTX 5080 GamingPro OC V1 · NE75080S19T2-GB2031Y",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5655&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5080-infinity3-oc-5798",
    name: "Palit RTX 5080 Infinity 3 OC · NE75080U19T2-GB2035S",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5798&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5070ti-gamerock-5375",
    name: "Palit RTX 5070 Ti GameRock · NE7507T019T2-GB2030G",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5375&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5070ti-gamingpro-oc-5415",
    name: "Palit RTX 5070 Ti GamingPro OC · NE7507TS19T2-GB2031A",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5415&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5070ti-gamingpro-s-5605",
    name: "Palit RTX 5070 Ti GamingPro-S · NE7507T019T2-GB2031U",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5605&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5070-infinity3-5455",
    name: "Palit RTX 5070 Infinity 3 · NE75070019K9-GB2050S",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5455&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5060ti-infinity3-8gb-5515",
    name: "Palit RTX 5060 Ti Infinity 3 8GB · NE7506T019P1-GB2062S",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5515&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5060-infinity3-5595",
    name: "Palit RTX 5060 Infinity 3 · NE75060019P1-GB2063S",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5595&lang=en&tab=sp",
  },
  {
    id: "palit-rtx5050-stormx-5695",
    name: "Palit RTX 5050 StormX · NE65050019P1-GB2070F",
    sourceUrl:
      "https://www.palit.com/palit/vgapro.php?id=5695&lang=en&tab=sp",
  },
];

const inno3dNvidiaBoards: BoardSeed[] = [
  {
    id: "inno3d-rtx5090-ichill-x3",
    name: "INNO3D RTX 5090 iCHILL X3 · C50903-32D7X-175967H",
    sourceUrl: "https://inno3d.com/product/inno3d-geforce-rtx-5090-ichill-x3",
  },
  {
    id: "inno3d-rtx5090-ichill-frostbite",
    name: "INNO3D RTX 5090 iCHILL Frostbite · C50903-32D7X-1759FB",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5090-ichill-frostbite",
  },
  {
    id: "inno3d-rtx5090-ichill-frostbite-pro",
    name: "INNO3D RTX 5090 iCHILL Frostbite Pro · C50903-32D7X-1759FBP",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5090-ichill-frostbite-pro",
  },
  {
    id: "inno3d-rtx5090-x3-oc",
    name: "INNO3D RTX 5090 X3 OC · N50903-32D7X-17593928",
    sourceUrl: "https://inno3d.com/product/inno3d-geforce-rtx-5090-x3-oc",
  },
  {
    id: "inno3d-rtx5090-x3",
    name: "INNO3D RTX 5090 X3 · N50903-32D7-17593928",
    sourceUrl: "https://inno3d.com/product/inno3d-geforce-rtx-5090-x3",
  },
  {
    id: "inno3d-rtx5080-ichill-x3-h",
    name: "INNO3D RTX 5080 iCHILL X3 H · C50803-16D7X-176069H",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5080-ichill-x3-h",
  },
  {
    id: "inno3d-rtx5080-ichill-frostbite",
    name: "INNO3D RTX 5080 iCHILL Frostbite · C50803-16D7X-1760FB",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5080-ichill-frostbite",
  },
  {
    id: "inno3d-rtx5080-x3-gaming-oc",
    name: "INNO3D RTX 5080 X3 Gaming OC · G50803-16D7X-17603930",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5080-x3-gaming-oc",
  },
  {
    id: "inno3d-rtx5080-x3-oc",
    name: "INNO3D RTX 5080 X3 OC · N50803-16D7X-17603930",
    sourceUrl: "https://inno3d.com/product/inno3d-geforce-rtx-5080-x3-oc",
  },
  {
    id: "inno3d-rtx5070ti-x3-oc",
    name: "INNO3D RTX 5070 Ti X3 OC · N507T3-16D7X-176068N",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5070-ti-x3-oc",
  },
  {
    id: "inno3d-rtx5070ti-x3",
    name: "INNO3D RTX 5070 Ti X3 · N507T3-16D7-176068N",
    sourceUrl: "https://inno3d.com/product/inno3d-geforce-rtx-5070-ti-x3",
  },
  {
    id: "inno3d-rtx5070-ichill-x3",
    name: "INNO3D RTX 5070 iCHILL X3 · C50703-12D7X-195065H",
    sourceUrl:
      "https://inno3d.com/product/inno3d-geforce-rtx-5070-ichill-x3",
  },
  {
    id: "inno3d-rtx5070-x3-oc",
    name: "INNO3D RTX 5070 X3 OC · N50703-12D7X-195064L",
    sourceUrl: "https://inno3d.com/product/inno3d-geforce-rtx-5070-x3-oc",
  },
];

const asusRadeonFourOutputBoards: BoardSeed[] = [
  {
    id: "asus-prime-rx9070xt-o16g",
    name: "ASUS Prime RX 9070 XT · PRIME-RX9070XT-O16G",
    sourceUrl:
      "https://www.asus.com/au/motherboards-components/graphics-cards/prime/prime-rx9070xt-o16g/techspec/",
  },
  {
    id: "asus-tuf-rx9070xt-o16g-gaming",
    name: "ASUS TUF Gaming RX 9070 XT · TUF-RX9070XT-O16G-GAMING",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rx9070xt-o16g-gaming/techspec/",
  },
  {
    id: "asus-prime-rx9070-o16g",
    name: "ASUS Prime RX 9070 · PRIME-RX9070-O16G",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rx9070-o16g/techspec/",
  },
  {
    id: "asus-tuf-rx9070-o16g-gaming",
    name: "ASUS TUF Gaming RX 9070 · TUF-RX9070-O16G-GAMING",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rx9070-o16g-gaming/techspec/",
  },
];

const asrockRadeonFourOutputBoards: BoardSeed[] = [
  {
    id: "asrock-rx9070xt-taichi-16go",
    name: "ASRock RX 9070 XT Taichi 16GB OC · RX9070XT TC 16GO",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209070%20XT%20Taichi%2016GB%20OC/",
  },
  {
    id: "asrock-rx9070xt-steel-legend-16g",
    name: "ASRock RX 9070 XT Steel Legend 16GB",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209070%20XT%20Steel%20Legend%2016GB/",
  },
  {
    id: "asrock-rx9070xt-steel-legend-dark-16g",
    name: "ASRock RX 9070 XT Steel Legend Dark 16GB · RX9070XT SLD16G",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209070%20XT%20Steel%20Legend%20Dark%2016GB/",
  },
  {
    id: "asrock-rx9070xt-challenger-16g",
    name: "ASRock RX 9070 XT Challenger 16GB · RX9070XT CL16G",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/AMD/Radeon%20RX%209070%20XT%20Challenger%2016GB/",
  },
];

const gigabyteRadeonFourOutputBoards: BoardSeed[] = [
  {
    id: "gigabyte-rx9070xt-aorus-elite-gv-r9070xtaorus-e-16gd",
    name: "GIGABYTE AORUS RX 9070 XT ELITE · GV-R9070XTAORUS-E-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-R9070XTAORUS-E-16GD/sp",
  },
  {
    id: "gigabyte-rx9070xt-gaming-oc-gv-r9070xtgaming-oc-16gd",
    name: "GIGABYTE RX 9070 XT GAMING OC · GV-R9070XTGAMING-OC-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-R9070XTGAMING-OC-16GD/sp",
  },
  {
    id: "gigabyte-rx9070xt-gaming-gv-r9070xtgaming-16gd",
    name: "GIGABYTE RX 9070 XT GAMING · GV-R9070XTGAMING-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-R9070XTGAMING-16GD/sp",
  },
  {
    id: "gigabyte-rx9070xt-gaming-oc-ice-gv-r907xgamingocice-16gd",
    name: "GIGABYTE RX 9070 XT GAMING OC ICE · GV-R907XGAMINGOCICE-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-R907XGAMINGOCICE-16GD/sp",
  },
  {
    id: "gigabyte-rx9070-gaming-oc-gv-r9070gaming-oc-16gd",
    name: "GIGABYTE RX 9070 GAMING OC · GV-R9070GAMING-OC-16GD",
    sourceUrl:
      "https://www.gigabyte.com/au/Graphics-Card/GV-R9070GAMING-OC-16GD/sp",
  },
  {
    id: "gigabyte-rx9070-gaming-gv-r9070gaming-16gd",
    name: "GIGABYTE RX 9070 GAMING · GV-R9070GAMING-16GD",
    sourceUrl:
      "https://www.gigabyte.com/au/Graphics-Card/GV-R9070GAMING-16GD/sp",
  },
];

const gigabyteRadeonThreeOutputBoards: BoardSeed[] = [
  {
    id: "gigabyte-rx9060xt-gaming-oc-16g-gv-r9060xtgaming-oc-16gd",
    name: "GIGABYTE RX 9060 XT GAMING OC 16G · GV-R9060XTGAMING-OC-16GD",
    sourceUrl:
      "https://www.gigabyte.com/au/Graphics-Card/GV-R9060XTGAMING-OC-16GD/sp",
  },
  {
    id: "gigabyte-rx9060xt-gaming-16g-gv-r9060xtgaming-16gd",
    name: "GIGABYTE RX 9060 XT GAMING 16G · GV-R9060XTGAMING-16GD",
    sourceUrl:
      "https://www.gigabyte.com/au/Graphics-Card/GV-R9060XTGAMING-16GD/sp",
  },
  {
    id: "gigabyte-rx9060xt-gaming-oc-ice-16g-gv-r906xgamingocice-16gd",
    name: "GIGABYTE RX 9060 XT GAMING OC ICE 16G · GV-R906XGAMINGOCICE-16GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-R906XGAMINGOCICE-16GD/sp",
  },
  {
    id: "gigabyte-rx9060xt-gaming-8g-gv-r9060xtgaming-8gd",
    name: "GIGABYTE RX 9060 XT GAMING 8G · GV-R9060XTGAMING-8GD",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-R9060XTGAMING-8GD/sp",
  },
  {
    id: "gigabyte-rx9060xt-gaming-oc-8g-gv-r9060xtgaming-oc-8gd",
    name: "GIGABYTE RX 9060 XT GAMING OC 8G · GV-R9060XTGAMING-OC-8GD",
    sourceUrl:
      "https://www.gigabyte.com/ca/Graphics-Card/GV-R9060XTGAMING-OC-8GD/sp",
  },
];

const asusRadeonThreeOutputBoards: BoardSeed[] = [
  {
    id: "asus-tuf-rx9060xt-o16g-gaming",
    name: "ASUS TUF Gaming RX 9060 XT · TUF-RX9060XT-O16G-GAMING",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/tuf-gaming/tuf-rx9060xt-o16g-gaming/techspec/",
  },
];

const asrockIntelBoards: BoardSeed[] = [
  {
    id: "asrock-arc-b580-challenger-12go",
    name: "ASRock Arc B580 Challenger 12GB OC · B580 CL12GO",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/Intel/Intel%20Arc%20B580%20Challenger%2012GB%20OC/",
  },
  {
    id: "asrock-arc-b580-steel-legend-12go",
    name: "ASRock Arc B580 Steel Legend 12GB OC · B580 SL12GO",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/Intel/Intel%20Arc%20B580%20Steel%20Legend%2012GB%20OC/index.asp",
  },
  {
    id: "asrock-arc-b570-challenger-10go",
    name: "ASRock Arc B570 Challenger 10GB OC · B570 Challenger 10GB OC",
    sourceUrl:
      "https://www.asrock.com/Graphics-Card/Intel/Intel%20Arc%20B570%20Challenger%2010GB%20OC/",
  },
];

const sparkleIntelBoards: BoardSeed[] = [
  {
    id: "sparkle-arc-b580-titan-oc-sb580t-12goc",
    name: "SPARKLE Arc B580 TITAN OC · SB580T-12GOC",
    sourceUrl: "https://www.sparkle.com.tw/files/20241203213858182.pdf",
    notes:
      "SPARKLE documents the four physical outputs; Intel documents four displays supported for Arc B580. Additional source: https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
  },
  {
    id: "sparkle-arc-b580-guardian-sb580g-12g",
    name: "SPARKLE Arc B580 GUARDIAN · SB580G-12G",
    sourceUrl: "https://www.sparkle.com.tw/files/20250121144118157.pdf",
    notes:
      "SPARKLE documents the four physical outputs; Intel documents four displays supported for Arc B580. Additional source: https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
  },
  {
    id: "sparkle-arc-b570-guardian-oc-sb570g-10goc",
    name: "SPARKLE Arc B570 GUARDIAN OC · SB570G-10GOC",
    sourceUrl: "https://www.sparkle.com.tw/files/20250121144415363.pdf",
    notes:
      "SPARKLE documents the four physical outputs; Intel documents four displays supported for Arc B570. Additional source: https://www.intel.com/content/www/us/en/products/details/discrete-gpus/arc/desktop/b-series.html",
  },
  {
    id: "sparkle-arc-b570-eclipse-oc-sb570gb-10goc",
    name: "SPARKLE Arc B570 Eclipse OC · SB570GB-10GOC",
    sourceUrl: "https://www.sparkle.com.tw/files/20250821145959612.pdf",
    notes:
      "The PDF header uses part number SB570GB-10GOC while descriptive body text also shows SB570B-10GOC. SPARKLE documents the four physical outputs; Intel documents four displays supported for Arc B570. Additional source: https://www.intel.com/content/www/us/en/products/details/discrete-gpus/arc/desktop/b-series.html",
  },
  {
    id: "sparkle-arc-b580-roc-luna-oc-ultra-sb580rw-12goc",
    name: "SPARKLE Arc B580 ROC Luna OC Ultra · SB580RW-12GOC",
    sourceUrl: "https://www.sparkle.com.tw/files/20250519101812700.pdf",
    notes:
      "SPARKLE documents the four physical outputs; Intel documents four displays supported for Arc B580. Additional source: https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
  },
];

export const gpuPresets: GpuPreset[] = [
  ...(["5090", "5080", "5070"] as const).map((model) => ({
    id: `nvidia-rtx-${model}`,
    name: `NVIDIA RTX ${model} · Founders Edition`,
    summary: "3 × DP 2.1b UHBR20 + 1 × HDMI 2.1b",
    sourceUrl: `${nvidiaBase}50-series/${model === "5070" ? "rtx-5070-family" : `rtx-${model}`}/`,
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "NVIDIA reference/Founders Edition layout. Partner boards can differ. NVIDIA explicitly documents DP 2.1b UHBR20. High-refresh multi-display configurations have additional documented limits. HDMI raw link rate and unspecified color-format details remain unknown.",
    ports: nvidia50Ports,
  })),
  {
    id: "nvidia-rtx-4090",
    name: "NVIDIA RTX 4090 · Founders Edition",
    summary: "3 × DP 1.4a + 1 × HDMI 2.1a",
    sourceUrl: `${nvidiaBase}40-series/rtx-4090/`,
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Previous-generation reference layout retained from the original file. Partner-board port counts can differ. Raw transport rates and mode-specific optional capabilities remain unknown unless separately documented.",
    ports: () =>
      [1, 2, 3]
        .map((n) => gpuPort(`DP ${n}`, "DisplayPort", "1.4a"))
        .concat(gpuPort("HDMI 1", "HDMI", "2.1a")),
  },

  ...boardPresets(
    asusFiveOutputBoards,
    "3 × DP 2.1b + 2 × HDMI 2.1b",
    4,
    nvidia50FiveOutputPorts,
    "Exact ASUS board variant. ASUS documents five physical display connectors but a maximum of four simultaneous displays. Raw DP/HDMI link rates are not stated on the board specification page, so links remain unknown.",
  ),
  ...boardPresets(
    asusStandardNvidiaBoards,
    "3 × DP 2.1b + 1 × HDMI 2.1b",
    4,
    nvidia50AibPorts,
    "Exact ASUS board variant. ASUS documents the connector versions and four simultaneous displays. Raw transport rates and optional per-port features are not inferred from the version labels.",
  ),
  {
    id: "asus-rtx5060-o8g-lp-brk",
    name: "ASUS RTX 5060 LP BRK · RTX5060-O8G-LP-BRK",
    summary: "1 × DP 2.1a + 2 × HDMI 2.1",
    sourceUrl:
      "https://www.asus.com/motherboards-components/graphics-cards/asus/rtx5060-o8g-lp-brk/techspec/",
    checked: CHECKED,
    maxDisplays: 3,
    notes:
      "Exact ASUS low-profile board. ASUS documents one DP 2.1a, two HDMI 2.1 connectors and three simultaneous displays. Raw link rates and optional per-port features are not inferred.",
    ports: asus5060LowProfilePorts,
  },

  ...boardPresets(
    msiNvidiaBoards,
    "3 × DP 2.1b + 1 × HDMI 2.1b",
    4,
    msi50Ports,
    "Exact MSI board variant. MSI documents three DP 2.1b ports, one HDMI 2.1b port and four displays. MSI explicitly documents HDMI Gaming VRR, HDR and DSC; no raw DP or HDMI link rate is stated, so link remains unknown.",
  ),
  ...boardPresets(
    gigabyteNvidiaBoards,
    "3 × DP 2.1b + 1 × HDMI 2.1b",
    4,
    nvidia50AibPorts,
    "Exact GIGABYTE board variant. GIGABYTE documents three DP 2.1b ports, one HDMI 2.1b port and Multi-view 4. Raw transport rates and undocumented optional features remain unknown.",
  ),
  {
    id: "gigabyte-rtx3060-gaming-oc-gv-n3060gaming-oc-12gd",
    name: "GIGABYTE RTX 3060 GAMING OC 12G · GV-N3060GAMING OC-12GD",
    summary: "2 × DP 1.4a + 2 × HDMI 2.1",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N3060GAMING-OC-12GD-rev-10/sp",
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Exact GIGABYTE GV-N3060GAMING OC-12GD board. Both revisions 1.0 and 2.0 document two DisplayPort 1.4a ports, two HDMI 2.1 ports and Multi-view 4. Raw transport rates, optional per-port features and exact supported modes remain unknown; version labels do not establish those capabilities. Revision 2.0 source: https://www.gigabyte.com/Graphics-Card/GV-N3060GAMING-OC-12GD-rev-20/sp",
    ports: () => [
      gpuPort("DP 1", "DisplayPort", "1.4a"),
      gpuPort("DP 2", "DisplayPort", "1.4a"),
      gpuPort("HDMI 1", "HDMI", "2.1"),
      gpuPort("HDMI 2", "HDMI", "2.1"),
    ],
  },
  {
    id: "gigabyte-rtx5050-windforce-gv-n5050wf2-8gd",
    name: "GIGABYTE RTX 5050 WINDFORCE · GV-N5050WF2-8GD",
    summary: "2 × DP 2.1b + 2 × HDMI 2.1b",
    sourceUrl:
      "https://www.gigabyte.com/Graphics-Card/GV-N5050WF2-8GD/sp",
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Exact GIGABYTE board variant. This RTX 5050 board differs from the common 3-DP/1-HDMI RTX 50 layout: GIGABYTE documents two DP 2.1b, two HDMI 2.1b and Multi-view 4. Raw link rates remain unknown.",
    ports: gigabyte5050Ports,
  },
  ...boardPresets(
    zotacNvidiaBoards,
    "3 × DP 2.1b UHBR20 + 1 × HDMI 2.1b",
    4,
    zotac50Ports,
    "Exact ZOTAC board variant. ZOTAC explicitly documents DP 2.1b UHBR20 and quad-display support. HDMI is documented as 2.1b, but its raw link rate is not stated, so it remains unknown.",
  ),
  ...boardPresets(
    pnyNvidiaBoards,
    "3 × DP 2.1b + 1 × HDMI 2.1b",
    4,
    nvidia50AibPorts,
    "Exact PNY board/SKU page. PNY documents three DP 2.1b ports, one HDMI 2.1b port and Multi-Screen 4. PNY also advertises HDR/DSC-dependent high-resolution modes, but this preset does not synthesize mode lists or infer raw link rates from those claims.",
  ),
  ...boardPresets(
    palitNvidiaBoards,
    "3 × DP 2.1b + 1 × HDMI 2.1b",
    4,
    nvidia50AibPorts,
    "Exact Palit product variant page. Palit documents three DP 2.1b ports, one HDMI 2.1b port and four-monitor support. Raw transport rates and optional capability flags are left unknown unless explicitly documented per port.",
  ),
  ...boardPresets(
    inno3dNvidiaBoards,
    "3 × DP 2.1b + 1 × HDMI 2.1b",
    4,
    nvidia50AibPorts,
    "Exact INNO3D product variant page. INNO3D documents three DP 2.1b ports, one HDMI 2.1b port and up to four monitors. Advertised DSC-dependent maximum resolutions are not converted into synthetic mode lists or raw link rates.",
  ),

  ...boardPresets(
    asusRadeonFourOutputBoards,
    "3 × DP 2.1a + 1 × HDMI 2.1b",
    4,
    radeon9000ThreeDpOneHdmiPorts,
    "Exact ASUS Radeon board variant. ASUS documents three DP 2.1a ports, one HDMI 2.1b port and four simultaneous displays. Raw transport rates are not inferred from the connector versions.",
  ),
  ...boardPresets(
    asrockRadeonFourOutputBoards,
    "3 × DP 2.1a + 1 × HDMI 2.1b",
    4,
    radeon9000ThreeDpOneHdmiPorts,
    "Exact ASRock Radeon board variant. ASRock documents three DP 2.1a ports, one HDMI 2.1b port and Multi-view 4. Raw transport rates and optional feature flags remain unknown unless explicitly stated.",
  ),
  {
    id: "sapphire-pulse-9070xt",
    name: "Sapphire PULSE RX 9070 XT · 11348-03",
    summary: "2 × DP 2.1a + 2 × HDMI",
    sourceUrl:
      "https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-9070-xt-16g-gddr6",
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Specific Sapphire PULSE board, not a universal RX 9070 XT layout. Sapphire specifies two DisplayPort 2.1a ports, two HDMI ports and four displays. The exact HDMI version/raw rate and unpublished per-mode details remain unknown.",
    ports: sapphire9070XtPulsePorts,
  },
  ...boardPresets(
    gigabyteRadeonFourOutputBoards,
    "2 × DP 2.1a + 2 × HDMI 2.1b",
    4,
    radeon9000TwoDpTwoHdmiPorts,
    "Exact GIGABYTE Radeon board variant. GIGABYTE documents two DP 2.1a ports, two HDMI 2.1b ports and Multi-view 4. Raw transport rates are not inferred from the version labels.",
  ),
  ...boardPresets(
    asusRadeonThreeOutputBoards,
    "2 × DP 2.1a + 1 × HDMI 2.1b",
    3,
    radeon9060TwoDpOneHdmiPorts,
    "Exact ASUS RX 9060 XT board variant. ASUS documents two DP 2.1a ports, one HDMI 2.1b port and three simultaneous displays. Raw transport rates remain unknown.",
  ),
  ...boardPresets(
    gigabyteRadeonThreeOutputBoards,
    "2 × DP 2.1a + 1 × HDMI 2.1b",
    3,
    radeon9060TwoDpOneHdmiPorts,
    "Exact GIGABYTE RX 9060 XT board variant. GIGABYTE documents two DP 2.1a ports, one HDMI 2.1b port and Multi-view 3. Raw transport rates remain unknown.",
  ),
  {
    id: "sapphire-pulse-rx9060xt-8g",
    name: "Sapphire PULSE RX 9060 XT OC 8GB · 11350-04-20G",
    summary: "1 × DP 2.1a + 2 × HDMI",
    sourceUrl:
      "https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-9060-xt-8g-gddr6",
    checked: CHECKED,
    maxDisplays: 3,
    notes:
      "Exact Sapphire PULSE RX 9060 XT OC 8GB SKU 11350-04-20G. Sapphire documents one DP 2.1a, two HDMI outputs and three displays. The exact HDMI specification version and all raw transport rates remain unknown.",
    ports: sapphire9060Ports,
  },

  {
    id: "intel-arc-b580-le",
    name: "Intel Arc B580 · Limited Edition",
    summary: "3 × DP 2.1 + 1 × HDMI 2.1a",
    sourceUrl:
      "https://www.intel.com/content/www/us/en/support/articles/000091128/graphics/intel-arc-dedicated-graphics-family.html",
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Intel Limited Edition layout. The black-outlined primary DP has different documented mode limits from the other DP ports. Intel lists UHBR13.5 and UHBR10 at GPU level; the per-port raw rate mapping remains unverified for this Limited Edition board. Additional source: https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
    ports: () => [
      gpuPort("DP primary (black outline)", "DisplayPort", "2.1"),
      gpuPort("DP 2", "DisplayPort", "2.1"),
      gpuPort("DP 3", "DisplayPort", "2.1"),
      gpuPort("HDMI 1", "HDMI", "2.1a", "unknown", { vrr: "yes" }),
    ],
  },
  ...boardPresets(
    asrockIntelBoards,
    "3 × DP 2.1 + 1 × HDMI 2.1a",
    4,
    intelArcBPartnerPorts,
    "Exact ASRock Arc B-series board variant. ASRock documents one primary DP 2.1 port up to UHBR13.5, two DP 2.1 ports up to UHBR10, one HDMI 2.1a port and Multi-view 4. The primary DP uses the simulator's UHBR13.5 profile; secondary DP ports use UHBR10. HDMI raw rate remains unknown.",
  ),
  {
    id: "acer-nitro-arc-b580-oc-an-b580-oca",
    name: "Acer Nitro Arc B580 OC 12GB · AN-B580-OCA",
    summary: "3 × DP 2.1 + 1 × HDMI 2.1",
    sourceUrl:
      "https://news.acer.com/acer-boosts-gaming-lineup-with-new-nitro-intel-arc-b-series-graphics-cards",
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Acer's launch specification identifies this exact model, three DP 2.1 outputs, one HDMI 2.1 output and four simultaneous displays. Per-port UHBR rates and optional feature flags are not stated by Acer, so they remain unknown.",
    ports: intelArcBGenericPorts,
  },
  {
    id: "acer-nitro-arc-b570-oc-an-b570-ocd",
    name: "Acer Nitro Arc B570 OC 10GB · AN-B570-OCD",
    summary: "3 × DP 2.1 + 1 × HDMI 2.1",
    sourceUrl:
      "https://news.acer.com/acer-boosts-gaming-lineup-with-new-nitro-intel-arc-b-series-graphics-cards",
    checked: CHECKED,
    maxDisplays: 4,
    notes:
      "Acer's launch specification identifies this exact model, three DP 2.1 outputs, one HDMI 2.1 output and four simultaneous displays. Per-port UHBR rates and optional feature flags are not stated by Acer, so they remain unknown.",
    ports: intelArcBGenericPorts,
  },
  ...boardPresets(
    sparkleIntelBoards,
    "3 × DP 2.1 + 1 × HDMI 2.1",
    4,
    intelArcBGenericPorts,
    "Exact SPARKLE product datasheet. SPARKLE documents HDMI 2.1 plus three DP 2.1 connectors. Per-port raw rates are not stated in the board datasheet, so links remain unknown.",
  ),
];

export function makeGpuDevice(
  preset: GpuPreset,
  position = { x: 80, y: 80 },
): Device {
  return {
    ...makeDevice("computer", position),
    name: `PC · ${preset.name.split(" · ")[0]}`,
    model: preset.name,
    ports: preset.ports(),
    maxStreams: preset.maxDisplays,
    notes: `${preset.notes}\nSpecifications checked ${preset.checked}.`,
    specUrl: preset.sourceUrl,
  };
}

export function replaceGpuOutputs(
  project: Project,
  deviceId: string,
  preset: GpuPreset,
): { project: Project; disconnected: number } {
  const device =
    project.devices.find((d) => d.id === deviceId) ??
    project.templates.find((d) => d.id === deviceId);
  if (!device || device.kind !== "computer")
    throw new Error("Choose a computer for a GPU output layout.");
  const pool = device.ports.filter((p) => p.direction === "out");
  const inputs = device.ports.filter((p) => p.direction === "in");
  const outputs = preset.ports().map((port) => {
    const match = pool.findIndex(
      (p) => p.connector === port.connector && p.protocol === port.protocol,
    );
    if (match < 0) return port;
    const old = pool.splice(match, 1)[0];
    return {
      ...port,
      id: old.id,
      name: old.name,
      signal: structuredClone(old.signal),
    };
  });
  if (inputs.length + outputs.length > 64)
    throw new Error("This layout would exceed the 64-port limit.");
  const removed = new Set(pool.map((p) => p.id));
  const cables = project.cables.filter((c) => !removed.has(c.sourcePort));
  const updated = {
    ...device,
    ports: [...inputs, ...outputs],
    maxStreams: preset.maxDisplays,
    model: device.model || preset.name,
    specUrl: preset.sourceUrl,
    notes: `${device.notes}${device.notes ? "\n\n" : ""}GPU output layout: ${preset.name}. ${preset.notes}\nSpecifications checked ${preset.checked}.`,
  };
  return {
    project: {
      ...project,
      devices: project.devices.map((d) => (d.id === deviceId ? updated : d)),
      templates: project.templates.map((d) =>
        d.id === deviceId ? updated : d,
      ),
      cables,
    },
    disconnected: project.cables.length - cables.length,
  };
}
