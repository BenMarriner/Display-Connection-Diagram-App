# Signalpath — Display Connection Planner

A local, personal workspace for mapping computer, console, monitor, projector and routing-device connections. Built with React, TypeScript, Vite and React Flow. There is no backend, account system or telemetry.

## Run locally

On Windows, with the existing dependencies installed, double-click **Start Signalpath.cmd** in this folder. It starts the app without requiring `pnpm` on your PATH. Keep its console window open while using the app; press Ctrl+C to stop it.

You can also launch it from PowerShell:

```powershell
cd "D:\Game Engines\GitHub\Display-Connection-Diagram-App"
& ".\Start Signalpath.cmd"
```

The launcher uses the available bundled Node.js runtime or a Node.js installation on your PATH. It does not install software or change your PATH. On a fresh checkout without `node_modules`, install the development dependencies first using the commands below.

Requires Node.js 20.19+ or 22.12+ and pnpm. Node 24 is supported.

```sh
pnpm install
pnpm dev
```

Open **http://127.0.0.1:5173/**. Keep this server address consistent: browser storage is scoped to the origin. The development server listens on loopback only.

```sh
pnpm test        # Deterministic simulation and IndexedDB/import tests
pnpm typecheck  # TypeScript checks
pnpm build      # Type checking and production build to dist/
pnpm preview    # Serve the production build (separate browser-storage origin)
```

## Use the planner

1. Start with an empty canvas or choose **Explore an example**. Example hardware and capabilities are illustrative.
2. Add devices from the library. Select a device to name it, add/remove ports, set routing, or save an independent reusable template. The pencil next to a saved template edits the template without altering existing diagram devices.
3. Use the settings icon beside a port to configure its connector and capabilities. A specification version is metadata; enter actual link capability, supported modes and features separately. A missing specification stays **unknown**.
4. Drag from an output handle on the right to an input handle on the left. Alternatively, click an output handle, then an input handle. A port can have one cable. HDMI–DisplayPort conversion needs an adapter; USB-C DP Alt Mode–DisplayPort cables can use different connector ends.
5. Select a computer/console output or a dock output to set the transmitted signal. Switches and display input selectors change routing, keeping all physical cabling visible.
6. Select a cable and choose a **Cable spec template**, or enter its verified bandwidth manually. Inspect modeled demand, capacity and utilization. Diagnostics identify limits and suggest manual changes; the requested signal never silently changes.
7. Browser autosave uses IndexedDB. **Export project** downloads a portable `.signalpath.json` file with the project, layout, selected channels and personal templates. **Import** validates a complete replacement before changing anything; the previous project remains available through Undo.
8. **Export PNG** in the diagram toolbar downloads the whole graph, including offscreen devices, cable labels and signal states, on a dark background. It leaves the current view and project unchanged. Normal exports use 2× graph resolution; very large diagrams scale down to at most 8192 pixels per side and 16 megapixels, keeping the entire graph in the image. An empty diagram cannot be exported. PNGs are pictures; use **Export project** for an editable backup.

Text and numeric fields commit on blur or Enter. Use Ctrl+Z / Ctrl+Shift+Z for undo/redo, Ctrl+D to duplicate a selected device, Delete to remove it, and Escape to clear selection. Form fields retain their native keyboard editing behavior.

The **UI size** menu in the header scales interface text and controls independently of the diagram. Choose 100%, 115%, 130% or 150%; the browser remembers the setting separately from project files. Diagram zoom, device card sizes and node text stay unchanged.

In a device's **Inputs & outputs** list, use the arrows to reorder each input/output column and the trash button to remove a port directly. Port IDs and connections survive reordering; deleting a connected port removes its cable in the same undoable edit. The port currently being edited is highlighted on the diagram with an **Editing** label and a bright handle. Its device, direction and name remain pinned at the top of the port inspector while you scroll.

### Faster port setup and connections

- **Add without navigating:** choose a connector and use Input / Output in the device inspector. The list stays open so you can add and name several ports before entering specifications.
- **Inline naming:** type directly into a port name on the node or in its input/output list. Enter or blur commits the name; Escape cancels the edit. The small settings icon opens that port's detailed inspector.
- **Duplicate:** the copy button beside a port duplicates its capabilities and configured signal into a new port with its own ID and a unique name. It does not copy or move a cable. The port inspector also has Duplicate port & settings.
- **Spec templates:** in a port inspector, save the current configuration under a reusable name. Choose whether to include source signal defaults. In a device inspector, expand Set up ports faster and apply a saved template to all ports with the matching connector/protocol, or use it for newly added matching ports. Existing port names, IDs and cabling stay intact; every applied port gets an independent copy. The library lists saved port templates and lets you remove a definition without altering configured ports.
- **Built-in spec templates:** choose familiar version-first names such as **HDMI 2.1 · 48 Gbps**, **DisplayPort 1.4a · 32.4 Gbps**, or **USB-C (DP 1.4) · 16.2 Gbps**. The number is total link bandwidth before encoding; DisplayPort/USB-C labels account for all configured video lanes. Different bandwidth options for the same version remain separate. These templates set the version label and declared link capability, preserve source signals, and leave device-dependent modes, depths and optional features unknown. Technical TMDS/FRL/HBR/UHBR profiles remain under **Link bandwidth (advanced)**. A version number does not establish every optional feature or the actual bandwidth of a particular port.
- **Cable-drop picker:** drag from either an input or output handle onto empty canvas, or click the small cable icon beside a port. Search the resulting menu for existing free ports, generic device-library items, personal device templates, and GPU computer presets. Choices are filtered for connector/protocol, opposite direction, occupancy and cycles. Choosing a library entry creates a node and cable as one undoable edit. A new device selects the chosen input; existing devices keep their selected channels. Arrow keys browse, Enter connects and Escape cancels.
- Saved port templates are included in autosave and JSON exports. Older version-1 files without them still open with an empty port-template library.

Legacy **HDMI 1.0–1.2a · 4.95 Gbps** and **HDMI 2.2 · 64 / 80 / 96 Gbps** are available as built-in port templates. The legacy rate keeps its full precision. "Standard HDMI" is a cable certification category tested for 720p/1080i; selecting the 4.95 Gbps port profile does not certify a cable. Cable ratings are entered separately, with shortcuts for these additional rates. New profiles preserve the requested source signal and leave optional hardware features unknown.

**DisplayPort 1.1 · 10.8 Gbps** uses four HBR lanes at 2.7 Gbps each, giving an 8.64 Gbps payload budget after 8b/10b encoding. It uses the existing DisplayPort transport simulation and preserves source settings and unknown device capabilities. [Intel bandwidth reference](https://www.intel.com/content/www/us/en/support/articles/000023004.html).

### Standard cable templates

The cable inspector offers protocol-matched cable certification templates, checked **2026-10-27**:

| HDMI cable category | Raw bandwidth |
| --- | --- |
| Standard HDMI | Unknown; category tested for 720p/1080i |
| High Speed HDMI | 10.2 Gbps |
| Premium High Speed HDMI | 18 Gbps |
| Ultra High Speed HDMI | 48 Gbps |
| Ultra96 HDMI | 96 Gbps |

| DisplayPort cable category | Raw bandwidth over four lanes | Maximum per lane |
| --- | --- | --- |
| Certified DisplayPort (HBR2) | 21.6 Gbps | 5.4 Gbps |
| DP8K (HBR3) | 32.4 Gbps | 8.1 Gbps |
| DP40 (original rating) | 40 Gbps | 10 Gbps |
| DP54 | 54 Gbps | 13.5 Gbps |
| DP80 / DP80LL (active low loss) | 80 Gbps | 20 Gbps |

VESA has revalidated existing DP40 cables for DP54; choose DP54 to use the updated rating, or DP40 to retain the original declaration. HDMI With Ethernet variants share their category's video bandwidth. Each template includes an official reference link. Sources: [HDMI cable categories](https://www.hdmi.org/resource/cables), [standard DP cables](https://www.displayport.org/how-to-choose-a-displayport-cable-and-not-get-a-bad-one/), [DP8K](https://www.displayport.org/wp-content/uploads/2018/07/DP_Marketing_Guidelines_R14.pdf), [DP54 and DP40](https://www.displayport.org/pr/vesa-announces-displayport-updates-and-extensions-for-gaming-and-automotive-market-at-ces/), [DP80LL](https://vesa.org/press/vesa-to-update-displayport-2-1-with-new-active-cable-specification-for-up-to-3x-longer-dp80-cables/).

Applying a template changes bandwidth limits in one undoable edit and preserves wiring, label, length, notes and entered HDR/VRR/DSC settings. No feature flags or requested signals are automatically enabled. Standard HDMI does not assign the legacy 4.95 Gbps port rate to the cable. Manually changing raw bandwidth clears the template and its lane limit; per-lane limits can be edited under **Advanced cable settings & notes**. DP cable limits apply per lane as well as in total, so two-lane USB-C links cannot use an unsupported higher link rate just because their total fits. For USB-C, use a DP template only when the actual cable declares that video rating. Template choices and lane limits survive reload/JSON export; older version-1 files remain valid.

### GPU output presets

The device library, computer inspector and cable-drop picker include **120 curated GPU output presets**, checked against manufacturer sources on **2026-10-27**. The catalogue covers NVIDIA RTX 50-series boards, the RTX 4090 Founders Edition and GIGABYTE RTX 3060 GAMING OC 12G, AMD RX 9000-series boards, and Intel Arc B580/B570 boards. They are board/reference profiles, not a promise of retail stock or a universal layout for every card using that GPU.

Manufacturer variants have separate identities and source links. The catalogue includes ASUS, MSI, GIGABYTE, ZOTAC, PNY, Palit and INNO3D GeForce boards; ASUS, ASRock, GIGABYTE and Sapphire Radeon boards; and Intel, ASRock, Acer and SPARKLE Arc boards. For example:

| Profile                              | Output layout                          | Manufacturer source                                                                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NVIDIA RTX 5090 Founders Edition     | 3 DisplayPort 2.1b UHBR20, 1 HDMI 2.1b | [NVIDIA](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/)                                                                                                                                                    |
| NVIDIA RTX 5080 Founders Edition     | 3 DisplayPort 2.1b UHBR20, 1 HDMI 2.1b | [NVIDIA](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5080/)                                                                                                                                                    |
| NVIDIA RTX 5070 Founders Edition     | 3 DisplayPort 2.1b UHBR20, 1 HDMI 2.1b | [NVIDIA](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/)                                                                                                                                             |
| NVIDIA RTX 4090 Founders Edition     | 3 DisplayPort 1.4a, 1 HDMI 2.1a        | [NVIDIA](https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/)                                                                                                                                                    |
| GIGABYTE RTX 3060 GAMING OC 12G (GV-N3060GAMING OC-12GD, rev. 1.0 / 2.0) | 2 DisplayPort 1.4a, 2 HDMI 2.1 | [GIGABYTE rev. 1.0](https://www.gigabyte.com/Graphics-Card/GV-N3060GAMING-OC-12GD-rev-10/sp), [rev. 2.0](https://www.gigabyte.com/Graphics-Card/GV-N3060GAMING-OC-12GD-rev-20/sp) |
| Sapphire PULSE RX 9070 XT (11348-03) | 2 DisplayPort 2.1a, 2 HDMI             | [Sapphire](https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-9070-xt-16g-gddr6)                                                                                                                                               |
| Intel Arc B580 Limited Edition       | 3 DisplayPort 2.1, 1 HDMI 2.1a         | [Intel quick start](https://www.intel.com/content/www/us/en/support/articles/000091128/graphics.html), [GPU specifications](https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html) |

Use GPU output layout replaces a computer's outputs while retaining its inputs. Matching output identities, custom names, source modes and cables are preserved where possible. The button reports any excess connected outputs that would be disconnected; Undo restores the previous layout. The simulation checks each board's declared independent-display limit. Three-output layouts declare three displays; the five-output ASUS layouts have three DP and two HDMI connectors but support four simultaneous displays. Additional mode-dependent GPU limits are noted for manual verification.

Unpublished details remain unknown: notably exact mode/format lists and unconfirmed HDMI rates. Intel's Limited Edition primary DP port has different published limits from its other DP ports, but its raw lane-rate mapping remains unverified. ASRock explicitly documents one primary UHBR13.5 and two UHBR10 DP ports on its included Arc boards, so those presets use the corresponding transport profiles. Sapphire's RX 9060 XT PULSE OC 8GB preset records its exact SKU, one DP 2.1a port and two HDMI ports; the unpublished HDMI version remains unknown. Partner-board variations are described in each preset's notes. These curated profiles are editable starting points; they do not automatically update from the internet.

The canonical catalogue is `src/gpuPresets.ts`. Add exact board variants there with stable unique IDs, a manufacturer specification URL and the actual verification date. Port factories must return fresh IDs, capabilities and signal objects. Keep physical connector counts separate from simultaneous-display limits, and leave unsupported claims unknown rather than inferring rates or optional features from version labels. In the simulator's link IDs, `uhbr13` means UHBR13.5. The catalogue tests validate all devices and JSON round-trips, independent factories, summary consistency, representative layouts, mixed Arc port rates, display limits, cable preservation and cable-drop choices.

### Dock device templates

The library's **Dock presets** section and the cable-drop picker include **Lenovo ThinkPad USB-C Dock Gen 2 (40AS0090 / Type 40AS)**. The template provides one USB-C upstream input, two DisplayPort 1.4 outputs and one HDMI 2.0 output, with up to three independent streams. Regional part numbers such as 40AS0090AU are searchable aliases.

Lenovo explicitly lists a two-lane HBR3 source for its higher display configurations. The template declares 16.2 Gbps raw upstream bandwidth and a derived 12.96 Gbps shared payload budget, with slower hosts/cables further limiting the negotiated transport. Output link rates and optional features remain unknown where unpublished. Higher multi-display modes depend on host MST/DSC support; DSC is not enabled automatically, and decoding at the dock into uncompressed downstream signals is not modeled. The device notes retain these limits and a link to Lenovo's display matrix. Its USB data/power-only ports are not video outputs. [Lenovo specifications](https://support.lenovo.com/au/en/accessories/acc500106-thinkpad-usb-c-dock-gen-2-overview-and-service-parts).

### Console device templates

**37 console templates** appear under **Console presets** in the device library and under **Console templates** in the cable-drop picker. Search supports names, abbreviations such as PS5/PSTV/XSX, model aliases and regional names such as Famicom, Mega Drive and PC Engine. Each template creates an independent editable device, with a manufacturer reference and verification date in Notes & reference. Save a configured instance as a personal device template to reuse your changes.

| Family | Included HDMI systems |
| --- | --- |
| Nintendo (4) | Wii U; Switch original/battery-revised; Switch OLED; Switch 2 |
| PlayStation (12) | PS3 original, Slim and Super Slim; PS4 original, Slim and Pro; PS5 original disc/digital, Slim disc/digital and Pro; PlayStation TV / PS Vita TV |
| Xbox (10) | HDMI-equipped Xbox 360, 360 S and 360 E; Xbox One, One S, One S All-Digital and One X; Series X disc/digital and Series S |
| Retro HDMI (11) | NES Classic / Famicom Mini; SNES Classic / Super Famicom Mini; PlayStation Classic; Genesis / Mega Drive Mini and Mini 2; TurboGrafx-16 / PC Engine / CoreGrafx mini; Atari 2600+, 7800+ and modern VCS; SNK NEOGEO mini and Arcade Stick Pro |

Switch entries represent the **console plus its powered dock as one HDMI source**. They do not add a fictitious HDMI socket to the handheld. The original Wii, Switch Lite, original PS1/PS2, early non-HDMI Xbox 360 revisions and other analogue-only originals require separate conversion; they are not native HDMI templates. Retro profiles describe the modern HDMI re-release, not the original cartridge/CD hardware. Regional names share a profile where the documented display connection is equivalent; game libraries, colors and storage capacities do not create extra video ports.

Xbox One variants include both their physical HDMI input and HDMI output. The input is clearly marked **wiring only**: Live TV / OneGuide pass-through is outside the simulation, and no channel selector implies otherwise. HDMI output remains the console's configured signal. Series X/S have no HDMI input. NEOGEO mini needs a **mini-HDMI-to-HDMI cable**; v1 represents the HDMI connector family and does not validate plug shell sizes.

Published output descriptions, feature flags and version labels are captured without inventing raw bandwidth, exhaustive timing tables or color combinations. All current console profiles leave raw link rates, complete mode lists and color-depth tables unknown. Peak mode descriptions in summaries/notes are reference information; they are not automatic mode limits in the engine. Supply an explicit verified mode list or transport profile in the inspector when you have those details. Unverified routes correctly remain **Needs verification**. Internal game rendering resolution is separate from HDMI output resolution; for example, One S and Series S video/upscaling capabilities do not establish native 4K game rendering.

Signals start at 1080p60, RGB 8-bit SDR with VRR/DSC disabled. PlayStation TV and the low-resolution retro profiles start at 720p60. Where the manufacturer gives only a connector description, this is an editable planning starter and is identified as such in the notes. PS5 Pro's DSC capability does not enable compression or invent a ratio. Its documented 8K option needs custom timing and explicit DSC settings. Switch 2's current manufacturer specifications, checked **2026-10-27**, list HDMI TV-mode HDR10 and VRR up to 120 Hz; the profile follows those current specifications rather than assuming launch-era limitations.

The catalogue lives in `src/consolePresets.ts`. Add profiles with stable unique IDs, search aliases, exact source URLs, checked dates and only verified capability flags. `makeConsoleDevice` creates fresh ports, capability arrays and signals for each instance. Console tests cover every profile, HDMI input/output direction, default modes, feature diagnostics, cable-picker compatibility, independent snapshots and JSON/IndexedDB persistence.

Manufacturer references include [Nintendo Switch specifications](https://www.nintendo.com/us/gaming-systems/switch/tech-specs/), [Switch 2 specifications](https://www.nintendo.com/au/hardware/nintendo-switch-2/tech-specs/), [PlayStation video settings](https://www.playstation.com/en-us/support/hardware/ps5-4k-resolution-guide/), [Xbox One specifications](https://news.xbox.com/wp-content/uploads/sites/2/Xbox_One_Spec_Sheet.pdf), [Xbox Series specifications](https://www.xbox.com/en-us/consoles/compare/), and the individual retro manufacturer links retained in each device's notes.

## Simulation contract

`simulate(project) → { displays, cables, findings }` is a pure TypeScript function in `src/engine.ts`. It separates physical connections from logical streams. A splitter repeats one stream; independent dock output streams share upstream capacity. Disabled displays and unselected routes do not consume the modeled display budget.

`schemaVersion: 1` JSON contains device instances, stable port IDs, cable endpoints, signal and capability settings, routing selections, independent device templates and viewport. Simulation results are derived, not persisted. Invalid IDs, port occupancy, cyclic graphs, inconsistent protocols and unsupported schema versions are rejected on import. A new schema version will need an explicit migration before it can be opened.

### Bandwidth and confidence

- **Active picture:** width × height × refresh × bits per pixel. RGB/4:4:4 uses 3 × bits per component, 4:2:2 uses 2 ×, and 4:2:0 uses 1.5 ×. This is a lower bound and is never compared directly to a raw cable rating. When DSC is enabled with a declared compressed bpp, the active payload estimate uses that value.
- **HDMI TMDS:** timing pixel clock, transport packing, deep-color scaling and coding are included in the wire-rate demand. 4:2:2 uses the HDMI transport container, not its active-picture bit count. Known TMDS profiles are 4.95, 10.2 and 18 Gbps.
- **HDMI FRL:** explicit profiles for 24/32/40/48 Gbps include lower FRL rates and TMDS 18 support. For uncompressed CTA 4K120, a small lookup uses the HDMI LA published minimum link class. The result is a required link class, **not** a continuous utilization percentage. Other FRL packing combinations remain unverified rather than applying an invented overhead factor.
- **HDMI 2.2 FRL:** 64/80/96 Gbps profiles declare those raw ceilings and included lower-rate FRL/TMDS modes. The weakest port/cable limits the available discrete rate. Existing verified CTA 4K120 entries use a declared legacy FRL fallback of at most 48 Gbps, rather than treating a higher raw rate as a verified payload budget. Higher-rate format packing and coding efficiency are not yet validated; these combinations remain **Needs verification** with no invented demand, usable capacity or utilization percentage. An uncompressed active-picture lower bound exceeding the raw ceiling can still prove incompatibility. Do not assume HDMI 2.1's payload factor applies to HDMI 2.2.
- **DisplayPort:** explicit RBR through UHBR20 link presets include lower rates. The model negotiates a discrete common rate and lane count within the cable rating, then applies coding efficiency (and a conservative UHBR FEC allowance). Timing-based video demand is compared with that payload budget. Dock allocation can use two or four video lanes; an additional declared usable shared video budget can further limit its streams.
- **Timing presets:** 720p60 (74.25 MHz), 1080p60/120 (148.5/297 MHz), 1440p60/120 (241.5/497.75 MHz), 1440p144 (586 MHz device timing example), 4K30/60/120 (297/594/1188 MHz). Nominal refresh labels can differ slightly from physical timings. The 1440p144 example explicitly requires clock verification; enter the actual device timing in Advanced. Custom modes can be declared on each port with keys such as `3440x1440@165` and configured with a pixel-clock override.
- **DSC:** explicit compressed bpp and feature capability are required. Slice, codec and packing negotiation are outside v1, so DSC routes remain **Needs verification** even when estimated demand fits.
- Unknown cable ratings, mode lists, formats, depths, transport or shared dock budgets prevent a fully supported result. Utilization is withheld when its calculation basis is missing, compressed, or a discrete FRL link class.

**Supported by entered specs** means the declared capability model passes. It is not a hardware handshake or electrical certification. Device link presets explicitly declare the included lower rates; they are not inferred from version labels. Cable length is recorded for planning and does not impose an invented distance penalty.

### References

- [HDMI LA: optional features and version labels](https://www.hdmi.org/blog/detail/139)
- [HDMI LA: format data-rate / cable-class tables](https://www.hdmi.org/download/savefile?fileKey=Marketing%2Fformat-data-rate-tables-2021.pdf)
- [HDMI LA: HDMI 2.2 and 64/80/96 Gbps options](https://www.hdmi.org/spec/hdmi2)
- [HDMI LA: Standard HDMI and other cable categories](https://www.hdmi.org/resource/cables)
- [Texas Instruments: legacy HDMI 1.2a, 4.95 Gbps raw capacity](https://www.ti.com/product/TS3DV520E)
- [Texas Instruments: TMDS and deep-color signaling](https://www.ti.com/lit/an/slla263/slla263.pdf)
- [VESA / USB-IF: DisplayPort Alt Mode, lane rates and coding](https://www.usb.org/sites/default/files/D2T1-4%20-%20VESA%20DP%20Alt%20Mode%20over%20USB%20Type-C.pdf)
- [VESA: DSC source-device guidelines](https://vesa.org/wp-content/uploads/2020/08/VESA-DSC-Source-Device-Guidelines-r1.0.pdf)

## V1 boundaries

No automatic hardware discovery, automatically maintained or exhaustive product catalogue, EDID/HDCP negotiation, independent splitter scaling, electrical cable-loss model, USB4/Thunderbolt tunneling, cloud sync or deployment. Switch templates implement selected-input routing to their outputs, not independently selectable matrix crosspoints. Dock simultaneous-stream capability and video budgets must be entered explicitly.

All project data stays in the browser or exported files. The UI currently requests Google Fonts for typography, with system-font fallbacks when offline. External specification links open only when clicked.
