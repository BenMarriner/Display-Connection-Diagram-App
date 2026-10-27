import {
  type Project,
  type Device,
  type Port,
  type Signal,
  type Status,
  type Cable,
  modeLabel,
  modeKey,
} from "./model";
import { hdmiFrlRates, links, timings } from "./presets";

export type Finding = {
  severity: "error" | "warning";
  componentId: string;
  title: string;
  detail: string;
  suggestion: string;
  streamId?: string;
};
export type Bandwidth = {
  cableId: string;
  activeVideoGbps: number;
  demandGbps: number | null;
  capacityGbps: number | null;
  rawGbps: number | null;
  utilization: number | null;
  basis: string;
  status: Status;
  streamCount: number;
};
export type DisplayResult = {
  deviceId: string;
  status: Status;
  sourceName: string;
  signal: Signal | null;
  cableIds: string[];
  findings: Finding[];
};
export type SimulationResult = {
  displays: DisplayResult[];
  cables: Record<string, Bandwidth>;
  findings: Finding[];
};
type Trace = {
  streamId: string;
  sourceName: string;
  signal: Signal;
  ports: { device: Device; port: Port }[];
  cables: Cable[];
};
export function activeVideo(s: Signal): number {
  return (
    (s.width *
      s.height *
      s.refresh *
      (s.dsc && s.dscBpp
        ? s.dscBpp
        : s.bpc *
          (s.chroma === "4:2:0" ? 1.5 : s.chroma === "4:2:2" ? 2 : 3))) /
    1e9
  );
}
export function timingClock(s: Signal): number | null {
  if (s.pixelClockMHz) return s.pixelClockMHz;
  const t = timings.find(
    (t) =>
      t.id === s.timingId &&
      t.width === s.width &&
      t.height === s.height &&
      t.refresh === s.refresh,
  );
  return t?.clock ?? null;
}

/** Transport result: demand/capacity are ALWAYS expressed in the same basis. */
export function bandwidthFor(
  s: Signal,
  a: Port,
  b: Port,
  cableRating: number | null,
  cableDpLaneGbps: number | null = null,
): Omit<Bandwidth, "cableId" | "status" | "streamCount"> {
  const la = links[a.caps.link],
    lb = links[b.caps.link];
  const active = activeVideo(s),
    clock = timingClock(s);
  const empty = {
    activeVideoGbps: active,
    demandGbps: null,
    capacityGbps: null,
    rawGbps: cableRating,
    utilization: null,
    basis: "Link or timing information is missing",
  };
  if (la.family === "unknown" || lb.family === "unknown") return empty;
  if (a.protocol !== b.protocol)
    return { ...empty, basis: "Protocol conversion requires an adapter" };
  let raw: number,
    capacity: number | null,
    demand: number | null,
    basis: string;
  if (a.protocol === "DisplayPort") {
    // Profile presets explicitly include lower DP rates. Mixed UHBR/HBR uses HBR3.
    const aUhbr = a.caps.link.startsWith("uhbr"),
      bUhbr = b.caps.link.startsWith("uhbr");
    const maxPerLane =
      aUhbr !== bUhbr
        ? Math.min(aUhbr ? 8.1 : la.raw, bUhbr ? 8.1 : lb.raw)
        : Math.min(la.raw, lb.raw);
    const lanes = Math.min(a.caps.lanes, b.caps.lanes);
    const available = [1.62, 2.7, 5.4, 8.1, 10, 13.5, 20].filter(
      (rate) => rate <= maxPerLane && rate <= (cableDpLaneGbps ?? Infinity) &&
        rate * lanes <= (cableRating ?? Infinity),
    );
    const perLane = available.at(-1) ?? 0;
    raw = perLane * lanes;
    const efficiency = perLane >= 10 ? (128 / 132) * 0.997 : 0.8;
    capacity = raw * efficiency;
    demand =
      clock && !(s.dsc && !s.dscBpp)
        ? (clock *
            (s.dsc && s.dscBpp
              ? s.dscBpp
              : s.bpc *
                (s.chroma === "4:2:0" ? 1.5 : s.chroma === "4:2:2" ? 2 : 3))) /
          1000
        : null;
    basis = `${perLane >= 10 ? "UHBR with coding/FEC allowance" : "DP 8b/10b payload"} · ${clock ? `${clock} MHz timing` : "timing unknown"}`;
  } else {
    // First try explicit backwards-compatible TMDS. YCbCr 4:2:2 uses 12-bit containers.
    const tmdsDemand =
      clock && !s.dsc
        ? ((clock * 30) / 1000) *
          (s.chroma === "4:2:2" ? 1 : s.bpc / 8) *
          (s.chroma === "4:2:0" ? 0.5 : 1)
        : null;
    const tmdsCap = Math.min(
      la.family === "frl" ? 18 : la.raw,
      lb.family === "frl" ? 18 : lb.raw,
      cableRating ?? Infinity,
    );
    if (
      la.family !== "frl" ||
      lb.family !== "frl" ||
      (tmdsDemand !== null && tmdsDemand <= tmdsCap)
    ) {
      raw = tmdsCap;
      capacity = tmdsCap;
      demand = tmdsDemand;
      basis = "HDMI TMDS wire rate · timing, packing and deep color included";
    } else {
      const limit = Math.min(la.raw, lb.raw, cableRating ?? Infinity);
      raw = hdmiFrlRates.filter((rate) => rate <= limit).at(-1) ?? 0;
      capacity = null;
      demand = null;
      // HDMI LA published format table: uncompressed CTA 4K100/120 minimum FRL rates.
      const isCta4k120 =
        s.timingId === "4k120" &&
        !s.pixelClockMHz &&
        s.width === 3840 &&
        s.height === 2160 &&
        s.refresh === 120 &&
        !s.dsc;
      const minimum = isCta4k120
        ? s.chroma === "RGB" || s.chroma === "4:4:4"
          ? { 8: 32, 10: 40, 12: 48, 16: null }[s.bpc]
          : s.chroma === "4:2:2"
            ? s.bpc <= 12
              ? 32
              : null
            : { 8: 24, 10: 24, 12: 32, 16: null }[s.bpc]
        : null;
      if (minimum) {
        demand = minimum;
        // This lookup verifies HDMI 2.1 FRL rates, so use a declared lower-rate
        // fallback rather than treating a 2.2 raw rate as a validated payload.
        capacity = Math.min(raw, 48);
        basis = raw > 48
          ? "HDMI LA minimum FRL link class · verified legacy FRL fallback"
          : "HDMI LA minimum FRL link class · not continuous payload utilization";
      } else
        basis = raw > 48
          ? "HDMI 2.2 FRL packing not verified; raw link ceiling only"
          : "FRL packing not verified for this combination; active-video rate is a lower bound";
    }
  }
  const utilization =
    demand !== null &&
    capacity !== null &&
    capacity > 0 &&
    cableRating !== null &&
    !basis.includes("link class") &&
    !s.dsc
      ? demand / capacity
      : null;
  return {
    activeVideoGbps: active,
    demandGbps: demand,
    capacityGbps: capacity,
    rawGbps: raw,
    utilization,
    basis,
  };
}

export function simulate(project: Project): SimulationResult {
  const devices = new Map(project.devices.map((d) => [d.id, d]));
  function into(d: Device, port: Port, visited: Set<string>): Trace | null {
    const cable = project.cables.find(
      (c) => c.targetDevice === d.id && c.targetPort === port.id,
    );
    if (!cable) return null;
    const src = devices.get(cable.sourceDevice),
      out = src?.ports.find((p) => p.id === cable.sourcePort);
    if (!src || !out) return null;
    const trace = from(src, out, visited);
    return trace
      ? {
          ...trace,
          ports: [...trace.ports, { device: d, port }],
          cables: [...trace.cables, cable],
        }
      : null;
  }
  function from(d: Device, port: Port, visited: Set<string>): Trace | null {
    if (!d.enabled || visited.has(port.id)) return null;
    const next = new Set(visited).add(port.id);
    if (d.kind === "computer" || d.kind === "console")
      return {
        streamId: port.id,
        sourceName: `${d.name} / ${port.name}`,
        signal: port.signal,
        ports: [{ device: d, port }],
        cables: [],
      };
    const input = d.ports.find(
      (p) => p.direction === "in" && p.id === d.selectedInput,
    );
    if (!input) return null;
    const incoming = into(d, input, next);
    if (!incoming) return null;
    return {
      ...incoming,
      ...(d.kind === "dock"
        ? {
            streamId: port.id,
            sourceName: `${d.name} / ${port.name}`,
            signal: port.signal,
          }
        : {}),
      ports: [...incoming.ports, { device: d, port }],
    };
  }
  const traces = new Map<string, Trace>();
  for (const d of project.devices.filter(
    (d) => d.kind === "monitor" || d.kind === "projector",
  )) {
    const input = d.ports.find(
      (p) => p.id === d.selectedInput && p.direction === "in",
    );
    const trace = d.enabled && input ? into(d, input, new Set()) : null;
    if (trace) traces.set(d.id, trace);
  }
  const findings: Finding[] = [];
  let checkingStream: string | undefined;
  function add(
    severity: Finding["severity"],
    componentId: string,
    title: string,
    detail: string,
    suggestion: string,
  ) {
    if (
      !findings.some(
        (f) =>
          f.componentId === componentId &&
          f.title === title &&
          f.detail === detail &&
          f.streamId === checkingStream,
      )
    )
      findings.push({
        severity,
        componentId,
        title,
        detail,
        suggestion,
        ...(checkingStream ? { streamId: checkingStream } : {}),
      });
  }
  function featureCheck(
    value: "yes" | "no" | "unknown",
    enabled: boolean,
    component: string,
    label: string,
    name: string,
  ) {
    if (!enabled || value === "yes") return;
    add(
      value === "no" ? "error" : "warning",
      component,
      `${label} ${value === "no" ? "unsupported" : "unknown"}`,
      `${name}: ${label} ${value === "no" ? "is not supported" : "capability has not been entered"}.`,
      value === "no"
        ? `Disable ${label} on the source or use a component that supports it.`
        : `Check the datasheet and enter ${label} support.`,
    );
  }
  const uniqueChecks = new Set<string>();
  for (const trace of traces.values()) {
    checkingStream = trace.streamId;
    const s = trace.signal;
    if (s.dsc && !s.dscBpp)
      add(
        "warning",
        trace.streamId,
        "DSC parameters missing",
        "Compression is enabled without a compressed bits-per-pixel value.",
        "Enter the source DSC operating rate; no compression multiplier is assumed.",
      );
    if (s.dsc)
      add(
        "warning",
        trace.streamId,
        "DSC operating profile needs verification",
        "Payload is estimated from the entered rate. Slice, codec and transport packing limits are not negotiated.",
        "Verify the exact DSC configuration across the complete route.",
      );
    if (!timingClock(s))
      add(
        "warning",
        trace.streamId,
        "Timing information missing",
        `${modeLabel(s)} has no pixel clock. Active-picture bandwidth is only a lower bound.`,
        "Select a documented timing preset or enter the device pixel clock.",
      );
    if (s.timingId === "1440p144" && !s.pixelClockMHz)
      add(
        "warning",
        trace.streamId,
        "Verify the 144 Hz timing",
        "The 586 MHz preset is a device timing example. Actual 1440p144 clocks vary.",
        "Confirm the pixel clock from the device timing table and enter it in Advanced.",
      );
    for (const { device: d, port: p } of trace.ports) {
      const key = `${trace.streamId}:${p.id}`;
      if (uniqueChecks.has(key)) continue;
      uniqueChecks.add(key);
      const caps = p.caps,
        name = `${d.name} / ${p.name}`;
      if (caps.modes === null)
        add(
          "warning",
          p.id,
          "Supported modes unknown",
          `${name} has no declared mode list.`,
          "Enter supported modes from the manufacturer specifications.",
        );
      else if (
        !(caps.modes.includes(s.timingId) && s.timingId !== "custom") &&
        !caps.modes.includes(modeKey(s))
      )
        add(
          "error",
          p.id,
          "Display mode not declared",
          `${name} does not declare ${modeLabel(s)}.`,
          "Select a mode declared along the whole route, or verify and add it to the port.",
        );
      if (caps.depths === null)
        add(
          "warning",
          p.id,
          "Color depths unknown",
          `${name} has no declared color depths.`,
          "Enter supported bits per color component.",
        );
      else if (!caps.depths.includes(s.bpc))
        add(
          "error",
          p.id,
          "Color depth unsupported",
          `${name} does not support ${s.bpc}-bit color.`,
          "Choose a declared color depth at the source output.",
        );
      if (caps.formats === null)
        add(
          "warning",
          p.id,
          "Color formats unknown",
          `${name} has no declared color formats.`,
          "Enter RGB / YCbCr formats supported by the port.",
        );
      else if (!caps.formats.includes(s.chroma))
        add(
          "error",
          p.id,
          "Color format unsupported",
          `${name} does not support ${s.chroma}.`,
          "Choose a color format supported along the route.",
        );
      featureCheck(caps.vrr, s.vrr, p.id, "VRR", name);
      featureCheck(caps.hdr, s.hdr, p.id, "HDR", name);
      featureCheck(caps.dsc, s.dsc, p.id, "DSC", name);
      if (
        s.vrr &&
        caps.vrr === "yes" &&
        ((caps.vrrMin !== null && s.refresh < caps.vrrMin) ||
          (caps.vrrMax !== null && s.refresh > caps.vrrMax))
      )
        add(
          "error",
          p.id,
          "Outside VRR range",
          `${name}: ${s.refresh} Hz is outside the declared VRR range.`,
          "Use a refresh rate inside the common VRR range or disable VRR.",
        );
      if (
        (d.kind === "adapter" || d.kind === "dock") &&
        d.conversion !== "yes" &&
        trace.ports.some(
          (entry) =>
            entry.device.id === d.id && entry.port.protocol !== p.protocol,
        )
      )
        add(
          d.conversion === "no" ? "error" : "warning",
          d.id,
          "Protocol conversion not verified",
          `${d.name} requires an explicit conversion capability in this direction.`,
          "Verify conversion direction and set the device conversion capability.",
        );
    }
  }
  checkingStream = undefined;
  const cableStreams = new Map<string, Map<string, Trace>>();
  for (const trace of traces.values())
    for (const c of trace.cables) {
      if (!cableStreams.has(c.id)) cableStreams.set(c.id, new Map());
      cableStreams.get(c.id)!.set(trace.streamId, trace);
    }
  const cableResults: Record<string, Bandwidth> = {};
  for (const c of project.cables) {
    const streams = cableStreams.get(c.id);
    if (!streams) {
      cableResults[c.id] = {
        cableId: c.id,
        status: "inactive",
        activeVideoGbps: 0,
        demandGbps: null,
        capacityGbps: null,
        rawGbps: c.ratingGbps,
        utilization: null,
        basis: "Not part of a selected display route",
        streamCount: 0,
      };
      continue;
    }
    const a = devices
      .get(c.sourceDevice)!
      .ports.find((p) => p.id === c.sourcePort)!;
    const b = devices
      .get(c.targetDevice)!
      .ports.find((p) => p.id === c.targetPort)!;
    const entries = [...streams.values()].map((t) =>
      bandwidthFor(t.signal, a, b, c.ratingGbps, c.dpLaneGbps ?? null),
    );
    const first = entries[0];
    const sameBasis = entries.every(
      (e) => e.basis.split(" · ")[0] === first.basis.split(" · ")[0],
    );
    const sumDemand =
      entries.every((e) => e.demandGbps !== null) &&
      sameBasis &&
      !(entries.length > 1 && first.basis.includes("link class"))
        ? entries.reduce((sum, e) => sum + e.demandGbps!, 0)
        : null;
    const capacity = first.capacityGbps;
    if (c.ratingGbps === null)
      add(
        "warning",
        c.id,
        "Cable rating unknown",
        `${c.name || "Cable"} has no declared bandwidth rating.`,
        "Enter the cable rated bandwidth.",
      );
    for (const t of streams.values()) {
      checkingStream = t.streamId;
      featureCheck(c.features.vrr, t.signal.vrr, c.id, "VRR", c.name);
      featureCheck(c.features.hdr, t.signal.hdr, c.id, "HDR", c.name);
      featureCheck(c.features.dsc, t.signal.dsc, c.id, "DSC", c.name);
    }
    checkingStream = undefined;
    if (sumDemand === null || capacity === null)
      add(
        "warning",
        c.id,
        "Transport bandwidth needs verification",
        `${c.name}: ${first.basis}.`,
        "Enter missing link/timing capabilities or verify this exact operating mode.",
      );
    if (sumDemand !== null && capacity !== null && sumDemand > capacity + 0.001)
      add(
        "error",
        c.id,
        "Connection bandwidth exceeded",
        `${c.name} needs ${sumDemand.toFixed(2)} Gbps on a ${capacity.toFixed(2)} Gbps ${first.basis.includes("link class") ? "link class" : "budget"}.`,
        "Lower the source refresh rate, color depth or resolution, or upgrade the limiting link.",
      );
    const activeSum = entries.reduce((sum, e) => sum + e.activeVideoGbps, 0);
    if (
      c.ratingGbps !== null &&
      activeSum > c.ratingGbps + 0.001 &&
      [...streams.values()].every((t) => !t.signal.dsc)
    )
      add(
        "error",
        c.id,
        "Cable raw ceiling exceeded",
        `${c.name}: the active-picture lower bound alone exceeds its ${c.ratingGbps} Gbps raw rating.`,
        "Lower the source mode or use a higher-rated cable.",
      );
    // The HDMI 2.1 payload factor is not a verified HDMI 2.2 packing model.
    // At higher FRL rates, use only the raw ceiling to prove impossibility.
    const hdmiPayloadFactor = first.basis.includes("TMDS")
      ? 0.8
      : first.rawGbps !== null && first.rawGbps <= 48 ? 16 / 18 : 1;
    const payloadLimit =
      a.protocol === "DisplayPort"
        ? capacity
        : first.rawGbps === null
          ? null
          : first.rawGbps * hdmiPayloadFactor;
    if (
      sumDemand === null &&
      payloadLimit !== null &&
      activeSum > payloadLimit + 0.001 &&
      [...streams.values()].every((t) => !t.signal.dsc)
    )
      add(
        "error",
        c.id,
        "Active video exceeds payload ceiling",
        `${c.name}: even the active-picture lower bound exceeds available payload.`,
        "Lower the source mode or increase link capacity.",
      );
    cableResults[c.id] = {
      ...first,
      cableId: c.id,
      activeVideoGbps: activeSum,
      demandGbps: sumDemand,
      capacityGbps: capacity,
      streamCount: streams.size,
      utilization:
        sumDemand !== null &&
        capacity !== null &&
        entries.every((e) => e.utilization !== null)
          ? sumDemand / capacity
          : null,
      status: "supported",
    };
  }
  for (const source of project.devices.filter(
    (d) =>
      (d.kind === "computer" || d.kind === "console") && d.maxStreams !== null,
  )) {
    const streams = new Set(
      [...traces.values()]
        .filter((t) => t.ports.some((entry) => entry.device.id === source.id))
        .map((t) => t.streamId),
    );
    if (streams.size > source.maxStreams!)
      add(
        "error",
        source.id,
        "Source display stream limit exceeded",
        `${source.name} carries ${streams.size} independent display streams; its declared limit is ${source.maxStreams}.`,
        "Disconnect a display stream or check the GPU simultaneous-display limits.",
      );
  }
  for (const dock of project.devices.filter((d) => d.kind === "dock")) {
    const streams = new Map<string, Trace>();
    for (const trace of traces.values())
      if (trace.ports.some((e) => e.device.id === dock.id))
        streams.set(trace.streamId, trace);
    if (!streams.size) continue;
    if (dock.maxStreams === null)
      add(
        "warning",
        dock.id,
        "Dock stream limit unknown",
        `${dock.name} has no declared simultaneous display limit.`,
        "Enter the dock display stream limit.",
      );
    else if (streams.size > dock.maxStreams)
      add(
        "error",
        dock.id,
        "Dock stream count exceeded",
        `${streams.size} streams are active; ${dock.name} allows ${dock.maxStreams}.`,
        "Disconnect a display or use a dock that supports more streams.",
      );
    const demands = [...streams.values()].map((t) => {
      const clock = timingClock(t.signal);
      return clock && !(t.signal.dsc && !t.signal.dscBpp)
        ? (clock *
            (t.signal.dsc && t.signal.dscBpp
              ? t.signal.dscBpp
              : t.signal.bpc *
                (t.signal.chroma === "4:2:0"
                  ? 1.5
                  : t.signal.chroma === "4:2:2"
                    ? 2
                    : 3))) /
            1000
        : null;
    });
    const sum = demands.every((d) => d !== null)
      ? demands.reduce<number>((s, n) => s + n!, 0)
      : null;
    if (dock.sharedGbps === null)
      add(
        "warning",
        dock.id,
        "Dock shared budget unknown",
        `${dock.name} has no declared usable video payload budget.`,
        "Enter usable video payload Gbps, not the USB marketing rate.",
      );
    else if (sum !== null && sum > dock.sharedGbps + 0.001)
      add(
        "error",
        dock.id,
        "Dock shared bandwidth exceeded",
        `${dock.name}: ${sum.toFixed(2)} Gbps of display demand exceeds its ${dock.sharedGbps} Gbps payload budget.`,
        "Lower a dock output mode, disconnect a display, or increase the declared upstream capacity.",
      );
    else if (sum === null)
      add(
        "warning",
        dock.id,
        "Dock aggregate demand unknown",
        `${dock.name} carries a stream without timing information.`,
        "Enter timing information for each active dock output.",
      );
  }
  const resultDisplays: DisplayResult[] = project.devices
    .filter((d) => d.kind === "monitor" || d.kind === "projector")
    .map((d) => {
      const trace = traces.get(d.id);
      if (!trace)
        return {
          deviceId: d.id,
          status: "inactive",
          sourceName: "",
          signal: null,
          cableIds: [],
          findings: [],
        };
      const components = new Set([
        trace.streamId,
        ...trace.ports.flatMap((e) => [e.device.id, e.port.id]),
        ...trace.cables.map((c) => c.id),
      ]);
      const own = findings.filter(
        (f) =>
          components.has(f.componentId) &&
          (!f.streamId || f.streamId === trace.streamId),
      );
      return {
        deviceId: d.id,
        status: own.some((f) => f.severity === "error")
          ? "incompatible"
          : own.length
            ? "uncertain"
            : "supported",
        sourceName: trace.sourceName,
        signal: trace.signal,
        cableIds: trace.cables.map((c) => c.id),
        findings: own,
      };
    });
  for (const c of project.cables) {
    if (cableResults[c.id].status === "inactive") continue;
    const related = resultDisplays.filter((d) => d.cableIds.includes(c.id));
    cableResults[c.id].status = related.some((d) => d.status === "incompatible")
      ? "incompatible"
      : related.some((d) => d.status === "uncertain")
        ? "uncertain"
        : "supported";
  }
  return { displays: resultDisplays, cables: cableResults, findings };
}
