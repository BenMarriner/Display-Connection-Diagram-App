import {
  ChevronLeft,
  Copy,
  Trash2,
  BookmarkPlus,
  X,
  ArrowUpRight,
  Cable as CableIcon,
  Info,
} from "lucide-react";
import {
  type Device,
  type Port,
  type Cable,
  type Project,
  type Signal,
  type Capabilities,
  type PortTemplate,
  connectors,
  formats,
  statusLabels,
  modeLabel,
} from "./model";
import { type SimulationResult, type Finding } from "./engine";
import { links, timings, applyTiming } from "./presets";
import { kindLabels } from "./devices";
import { duplicatePort } from "./portSpecs";
import { PortListEditor, PortSpecTools } from "./PortTools";
import CableSpecTools from "./CableSpecTools";
import { cableProtocol } from "./cablePresets";
import {
  Field,
  TextField,
  NumberField,
  FeatureField,
  Toggle,
  DeviceIcon,
  StatusIcon,
} from "./components";

export type Selection =
  | { type: "device"; id: string; portId?: string; template?: boolean }
  | { type: "cable"; id: string }
  | null;
type Props = {
  project: Project;
  result: SimulationResult;
  selection: Selection;
  select: (s: Selection) => void;
  updateDevice: (d: Device) => void;
  updateCable: (c: Cable) => void;
  deleteSelection: () => void;
  duplicate: (d: Device) => void;
  saveTemplate: (d: Device) => void;
  deletePort: (d: Device, p: Port) => void;
  focusComponent: (id: string) => void;
  savePortTemplate: (template: PortTemplate) => void;
  gpuLayout: (presetId: string) => void;
  notify: (text: string, error?: boolean) => void;
};
export function FindingList({
  findings,
  focus,
}: {
  findings: Finding[];
  focus: (id: string) => void;
}) {
  return (
    <div className="finding-list">
      {findings.map((f, i) => (
        <button
          className={`finding ${f.severity}`}
          key={`${f.componentId}-${f.title}-${i}`}
          onClick={() => focus(f.componentId)}
        >
          <div className="finding-title">
            <StatusIcon
              status={f.severity === "error" ? "incompatible" : "uncertain"}
            />
            <strong>{f.title}</strong>
            <ArrowUpRight size={13} />
          </div>
          <p>{f.detail}</p>
          <small>{f.suggestion}</small>
        </button>
      ))}
    </div>
  );
}

function SignalForm({
  signal: s,
  update,
}: {
  signal: Signal;
  update: (s: Signal) => void;
}) {
  const change = (patch: Partial<Signal>) => update({ ...s, ...patch });
  return (
    <div className="signal-form">
      <div className="section-label">
        TRANSMITTED SIGNAL <span>Source control</span>
      </div>
      <Field label="Resolution & refresh">
        <select
          value={s.timingId}
          onChange={(e) => update(applyTiming(s, e.target.value))}
        >
          {timings.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          <option value="custom">Custom mode</option>
        </select>
      </Field>
      {s.timingId === "custom" && (
        <>
          <div className="field-pair">
            <NumberField
              label="Width (px)"
              value={s.width}
              nullable={false}
              min={1}
              max={32768}
              onChange={(n) => n && change({ width: Math.floor(n) })}
            />
            <NumberField
              label="Height (px)"
              value={s.height}
              nullable={false}
              min={1}
              max={32768}
              onChange={(n) => n && change({ height: Math.floor(n) })}
            />
          </div>
          <NumberField
            label="Refresh rate (Hz)"
            value={s.refresh}
            nullable={false}
            max={2000}
            onChange={(n) => n && change({ refresh: n })}
          />
        </>
      )}
      <Field label="Color depth">
        <select
          value={s.bpc}
          onChange={(e) =>
            change({ bpc: Number(e.target.value) as Signal["bpc"] })
          }
        >
          {[8, 10, 12, 16].map((n) => (
            <option key={n} value={n}>
              {n}-bit per component
            </option>
          ))}
        </select>
      </Field>
      <Toggle
        label="Variable refresh rate"
        checked={s.vrr}
        onChange={(vrr) => change({ vrr })}
      />
      <details className="advanced">
        <summary>Advanced signal settings</summary>
        <div className="details-content">
          <Field label="Color format">
            <select
              value={s.chroma}
              onChange={(e) =>
                change({ chroma: e.target.value as Signal["chroma"] })
              }
            >
              {formats.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Toggle
            label="HDR signal"
            checked={s.hdr}
            onChange={(hdr) => change({ hdr })}
          />
          <NumberField
            label="Pixel clock override (MHz)"
            value={s.pixelClockMHz}
            onChange={(pixelClockMHz) => change({ pixelClockMHz })}
          />
          <p className="muted small">
            {timings.find((t) => t.id === s.timingId)?.basis ??
              "Custom timing: enter the actual device pixel clock."}
          </p>
          <Toggle
            label="DSC compression"
            checked={s.dsc}
            onChange={(dsc) => change({ dsc })}
          />
          {s.dsc && (
            <NumberField
              label="Compressed bits per pixel"
              value={s.dscBpp}
              onChange={(dscBpp) => change({ dscBpp })}
            />
          )}
        </div>
      </details>
    </div>
  );
}

function CapabilitiesForm({
  port: p,
  update,
}: {
  port: Port;
  update: (p: Port) => void;
}) {
  const c = p.caps;
  const caps = (patch: Partial<Capabilities>) =>
    update({ ...p, caps: { ...c, ...patch } });
  const toggleMode = (id: string) =>
    caps({
      modes: c.modes?.includes(id)
        ? c.modes.filter((m) => m !== id)
        : [...(c.modes ?? []), id],
    });
  return (
    <>
      <div className="section-label">PORT CAPABILITIES</div>
      <TextField
        label="Specification version"
        value={c.version}
        placeholder="e.g. HDMI 2.1 — label only"
        onChange={(version) => caps({ version })}
      />
      <Field
        label="Link bandwidth (advanced)"
        hint="Use the port spec templates above for familiar version names. These technical profiles also include lower link rates."
      >
        <select
          value={c.link}
          onChange={(e) =>
            caps({ link: e.target.value as Capabilities["link"] })
          }
        >
          {Object.entries(links)
            .filter(
              ([, l]) =>
                l.family === "unknown" ||
                (p.protocol === "HDMI" ? l.family !== "dp" : l.family === "dp"),
            )
            .map(([key, l]) => (
              <option key={key} value={key}>
                {l.label}
              </option>
            ))}
        </select>
      </Field>
      {p.protocol === "DisplayPort" && (
        <Field label="Video lanes">
          <select
            value={c.lanes}
            onChange={(e) =>
              caps({ lanes: Number(e.target.value) as Capabilities["lanes"] })
            }
          >
            <option value={1}>1 lane</option>
            <option value={2}>2 lanes · USB data retained</option>
            <option value={4}>4 lanes · full video allocation</option>
          </select>
        </Field>
      )}
      <details className="advanced">
        <summary>
          Supported display modes{" "}
          <span className="summary-value">
            {c.modes === null ? "Unknown" : `${c.modes.length} modes`}
          </span>
        </summary>
        <div className="details-content">
          <label className="check-row">
            <input
              type="checkbox"
              checked={c.modes === null}
              onChange={(e) => caps({ modes: e.target.checked ? null : [] })}
            />{" "}
            Not yet known
          </label>
          <button
            className="text-button"
            onClick={() => caps({ modes: timings.map((t) => t.id) })}
          >
            Declare all listed modes
          </button>
          {timings.map((t) => (
            <label className="check-row" key={t.id}>
              <input
                type="checkbox"
                checked={c.modes?.includes(t.id) ?? false}
                onChange={() => toggleMode(t.id)}
              />
              {t.label}
            </label>
          ))}
          <TextField
            label="Custom modes (WxH@Hz, comma separated)"
            placeholder="3440x1440@165, 1920x1080@75"
            value={(c.modes ?? [])
              .filter((m) => !timings.some((t) => t.id === m))
              .join(", ")}
            onChange={(value) =>
              caps({
                modes: [
                  ...(c.modes ?? []).filter((m) =>
                    timings.some((t) => t.id === m),
                  ),
                  ...value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                ],
              })
            }
          />
        </div>
      </details>
      <Field label="Supported color depths">
        <select
          value={c.depths === null ? "unknown" : c.depths.join(",")}
          onChange={(e) =>
            caps({
              depths:
                e.target.value === "unknown"
                  ? null
                  : e.target.value.split(",").map(Number),
            })
          }
        >
          <option value="unknown">Unknown</option>
          <option value="8">8-bit</option>
          <option value="8,10">8 / 10-bit</option>
          <option value="8,10,12">8 / 10 / 12-bit</option>
          <option value="8,10,12,16">8 / 10 / 12 / 16-bit</option>
        </select>
      </Field>
      <FeatureField
        label="VRR capability"
        value={c.vrr}
        onChange={(vrr) => caps({ vrr })}
      />
      {c.vrr === "yes" && (
        <div className="field-pair">
          <NumberField
            label="VRR min (Hz)"
            value={c.vrrMin}
            onChange={(vrrMin) => caps({ vrrMin })}
          />
          <NumberField
            label="VRR max (Hz)"
            value={c.vrrMax}
            onChange={(vrrMax) => caps({ vrrMax })}
          />
        </div>
      )}
      <details className="advanced">
        <summary>Advanced capabilities</summary>
        <div className="details-content">
          <FeatureField
            label="HDR capability"
            value={c.hdr}
            onChange={(hdr) => caps({ hdr })}
          />
          <FeatureField
            label="DSC encode / pass / decode"
            value={c.dsc}
            onChange={(dsc) => caps({ dsc })}
          />
          <div className="field">
            <span>Supported color formats</span>
            <label className="check-row">
              <input
                type="checkbox"
                checked={c.formats === null}
                onChange={(e) =>
                  caps({ formats: e.target.checked ? null : [] })
                }
              />
              Unknown
            </label>
            {formats.map((f) => (
              <label className="check-row" key={f}>
                <input
                  type="checkbox"
                  checked={c.formats?.includes(f) ?? false}
                  onChange={() =>
                    caps({
                      formats: c.formats?.includes(f)
                        ? c.formats.filter((v) => v !== f)
                        : [...(c.formats ?? []), f],
                    })
                  }
                />
                {f}
              </label>
            ))}
          </div>
        </div>
      </details>
    </>
  );
}

export default function Inspector(props: Props) {
  const { project, result, selection, updateDevice, updateCable } = props;
  const template = selection?.type === "device" && selection.template;
  const select = (s: Selection) =>
    props.select(
      s?.type === "device"
        ? { ...s, ...(template ? { template: true } : {}) }
        : s,
    );
  const d =
    selection?.type === "device"
      ? (template ? project.templates : project.devices).find(
          (d) => d.id === selection.id,
        )
      : undefined;
  const port =
    d && selection?.type === "device"
      ? d.ports.find((p) => p.id === selection.portId)
      : undefined;
  const cable =
    selection?.type === "cable"
      ? project.cables.find((c) => c.id === selection.id)
      : undefined;
  const displayResult = d && result.displays.find((r) => r.deviceId === d.id);
  const relevant = d
    ? result.findings.filter(
        (f) =>
          f.componentId === d.id || d.ports.some((p) => p.id === f.componentId),
      )
    : cable
      ? result.findings.filter((f) => f.componentId === cable.id)
      : [];
  const changePort = (p: Port) =>
    d &&
    updateDevice({
      ...d,
      ports: d.ports.map((old) => (old.id === p.id ? p : old)),
    });
  const setInput = (id: string) =>
    d && updateDevice({ ...d, selectedInput: id || null });
  return (
    <aside className="inspector">
      <div className="panel-heading">
        <span>
          {template
            ? "TEMPLATE INSPECTOR"
            : port
              ? "PORT INSPECTOR"
              : cable
                ? "CABLE INSPECTOR"
                : d
                  ? "DEVICE INSPECTOR"
                  : "INSPECTOR"}
        </span>
        {selection && (
          <button
            className="icon-button"
            title="Close inspector"
            onClick={() => select(null)}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <div
        className="inspector-content"
        key={port?.id ?? d?.id ?? cable?.id ?? "none"}
      >
        {!selection && (
          <>
            <div className="inspector-empty">
              <div className="inspect-illustration">
                <CableIcon size={28} />
              </div>
              <h3>A clearer connection.</h3>
              <p>
                Select a device, port or cable to inspect its specifications and
                signal path.
              </p>
            </div>
            <div className="info-box">
              <Info size={16} />
              <p>
                Start with what you know.
                <br />
                <span>
                  Unknown specs stay visible, so assumptions never become
                  guarantees.
                </span>
              </p>
            </div>
            <div className="section-label">WORKSPACE OVERVIEW</div>
            <div className="overview-stats">
              <div>
                <strong>{project.devices.length}</strong>
                <span>Devices</span>
              </div>
              <div>
                <strong>{project.cables.length}</strong>
                <span>Cables</span>
              </div>
              <div>
                <strong>{result.displays.length}</strong>
                <span>Displays</span>
              </div>
            </div>
            {result.findings.length > 0 && (
              <>
                <div className="section-label">
                  SETUP DIAGNOSTICS <span>{result.findings.length}</span>
                </div>
                <FindingList
                  findings={result.findings}
                  focus={props.focusComponent}
                />
              </>
            )}
            <div className="inspector-tips">
              <h4>Make it your setup</h4>
              <p>1. Add your devices from the library.</p>
              <p>2. Drag from an output to an input.</p>
              <p>3. Enter specs and configure source signals.</p>
              <p>4. Switch channels and trace the result.</p>
            </div>
          </>
        )}
        {d && (
          <>
            {port ? (
              <>
                <div
                  className="port-editing-context"
                  data-editing-port={port.id}
                >
                  <button
                    className="back-button"
                    onClick={() => select({ type: "device", id: d.id })}
                  >
                    <ChevronLeft size={15} />
                    {d.name}
                  </button>
                  <div className="editing-context-label">
                    <span />
                    Editing {port.direction === "in" ? "input" : "output"}
                    {template ? " template" : ""}
                  </div>
                  <h2 className="inspector-title">
                    {port.name}
                    <span
                      className={`connector-chip ${port.connector === "HDMI" ? "hdmi" : "dp"}`}
                    >
                      {port.connector}
                    </span>
                  </h2>
                </div>
                <TextField
                  label="Port name"
                  value={port.name}
                  onChange={(name) =>
                    changePort({ ...port, name: name.trim() || port.name })
                  }
                />
                <div className="field-pair">
                  <Field label="Direction">
                    <select
                      value={port.direction}
                      onChange={(e) => {
                        if (
                          project.cables.some(
                            (c) =>
                              c.sourcePort === port.id ||
                              c.targetPort === port.id,
                          )
                        )
                          return;
                        const direction = e.target.value as Port["direction"];
                        updateDevice({
                          ...d,
                          ports: d.ports.map((p) =>
                            p.id === port.id ? { ...p, direction } : p,
                          ),
                          selectedInput:
                            direction === "out" && d.selectedInput === port.id
                              ? null
                              : direction === "in" && !d.selectedInput
                                ? port.id
                                : d.selectedInput,
                        });
                      }}
                      disabled={project.cables.some(
                        (c) =>
                          c.sourcePort === port.id || c.targetPort === port.id,
                      )}
                    >
                      <option value="in">Input</option>
                      <option value="out">Output</option>
                    </select>
                  </Field>
                  <Field label="Connector">
                    <select
                      value={port.connector}
                      disabled={project.cables.some(
                        (c) =>
                          c.sourcePort === port.id || c.targetPort === port.id,
                      )}
                      onChange={(e) => {
                        const connector = e.target.value as Port["connector"];
                        changePort({
                          ...port,
                          connector,
                          protocol:
                            connector === "HDMI" ? "HDMI" : "DisplayPort",
                          caps: { ...port.caps, link: "unknown" },
                        });
                      }}
                    >
                      {connectors.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="port-inspector-quick-actions">
                  <button
                    className="secondary-button full-width"
                    disabled={d.ports.length >= 64}
                    onClick={() => updateDevice(duplicatePort(d, port.id))}
                  >
                    <Copy size={14} />
                    Duplicate port & settings
                  </button>
                </div>
                <PortSpecTools
                  key={port.id}
                  port={port}
                  templates={project.portTemplates}
                  update={changePort}
                  save={props.savePortTemplate}
                  notify={props.notify}
                />
                {port.direction === "out" &&
                  ["computer", "console", "dock"].includes(d.kind) && (
                    <SignalForm
                      signal={port.signal}
                      update={(signal) => changePort({ ...port, signal })}
                    />
                  )}
                <CapabilitiesForm port={port} update={changePort} />
                <button
                  className="danger-button"
                  onClick={() => props.deletePort(d, port)}
                >
                  <Trash2 size={14} />
                  Remove port & attached cable
                </button>
              </>
            ) : (
              <>
                <div className="inspector-device-heading">
                  <div className={`device-glyph ${d.kind}`}>
                    <DeviceIcon kind={d.kind} size={25} />
                  </div>
                  <div>
                    <small>{kindLabels[d.kind]}</small>
                    <h2>{d.name}</h2>
                  </div>
                </div>
                {template && (
                  <p className="inline-note">
                    Editing your reusable template. Changes are saved
                    automatically; devices already on the diagram stay
                    independent.
                  </p>
                )}
                <div className="inspector-actions">
                  <button onClick={() => props.duplicate(d)}>
                    <Copy size={13} />
                    Duplicate
                  </button>
                  <button onClick={() => props.saveTemplate(d)}>
                    <BookmarkPlus size={13} />
                    Save template
                  </button>
                </div>
                <TextField
                  label="Device name"
                  value={d.name}
                  onChange={(name) =>
                    updateDevice({ ...d, name: name.trim() || d.name })
                  }
                />
                <TextField
                  label="Model"
                  value={d.model}
                  placeholder="Your device model"
                  onChange={(model) => updateDevice({ ...d, model })}
                />
                <Toggle
                  label="Device powered on"
                  checked={d.enabled}
                  onChange={(enabled) => updateDevice({ ...d, enabled })}
                />
                {d.kind === "console" && d.ports.some((p) => p.direction === "in") && (
                  <p className="inline-note">
                    HDMI input is shown for wiring. Live-TV pass-through is not
                    simulated; the output uses this console’s configured signal.
                  </p>
                )}
                {d.kind !== "console" && d.ports.some((p) => p.direction === "in") && (
                  <Field
                    label={
                      ["monitor", "projector"].includes(d.kind)
                        ? "Selected display input"
                        : "Selected input / channel"
                    }
                  >
                    <select
                      value={d.selectedInput ?? ""}
                      onChange={(e) => setInput(e.target.value)}
                    >
                      <option value="">No input selected</option>
                      {d.ports
                        .filter((p) => p.direction === "in")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {d.kind === "splitter" && (
                  <p className="inline-note">
                    All outputs mirror the selected input signal. No scaling or
                    automatic EDID negotiation.
                  </p>
                )}
                {(d.kind === "adapter" || d.kind === "dock") && (
                  <FeatureField
                    label="Conversion in configured direction"
                    value={d.conversion}
                    onChange={(conversion) =>
                      updateDevice({ ...d, conversion })
                    }
                  />
                )}
                {d.kind === "adapter" && (
                  <p className="inline-note">
                    Signal travels from the configured input to outputs. Reverse
                    conversion requires a separately configured adapter.
                  </p>
                )}
                {d.kind === "computer" && (
                  <NumberField
                    label="Maximum simultaneous GPU display streams"
                    value={d.maxStreams}
                    min={1}
                    onChange={(maxStreams) =>
                      updateDevice({
                        ...d,
                        maxStreams:
                          maxStreams === null ? null : Math.floor(maxStreams),
                      })
                    }
                  />
                )}
                {d.kind === "dock" && (
                  <>
                    <NumberField
                      label="Shared usable video payload (Gbps)"
                      value={d.sharedGbps}
                      onChange={(sharedGbps) =>
                        updateDevice({ ...d, sharedGbps })
                      }
                    />
                    <NumberField
                      label="Maximum simultaneous streams"
                      value={d.maxStreams}
                      min={1}
                      onChange={(maxStreams) =>
                        updateDevice({
                          ...d,
                          maxStreams:
                            maxStreams === null ? null : Math.floor(maxStreams),
                        })
                      }
                    />
                    <p className="inline-note">
                      Set upstream DP lanes in port capabilities. Enter usable
                      video payload, not USB marketing bandwidth.
                    </p>
                  </>
                )}
                <PortListEditor
                  key={d.id}
                  device={d}
                  project={project}
                  update={updateDevice}
                  edit={(p) =>
                    select({ type: "device", id: d.id, portId: p.id })
                  }
                  remove={(p) => props.deletePort(d, p)}
                  gpuLayout={props.gpuLayout}
                  notify={props.notify}
                />
                {displayResult && (
                  <div className={`display-summary ${displayResult.status}`}>
                    <StatusIcon status={displayResult.status} />
                    <div>
                      <strong>{statusLabels[displayResult.status]}</strong>
                      <small>
                        {displayResult.signal
                          ? `${modeLabel(displayResult.signal)} · ${displayResult.signal.bpc}-bit ${displayResult.signal.chroma}`
                          : "Choose an input connected to an active source."}
                      </small>
                      {displayResult.sourceName && (
                        <small>From {displayResult.sourceName}</small>
                      )}
                    </div>
                  </div>
                )}
                <details className="advanced">
                  <summary>Notes & reference</summary>
                  <div className="details-content">
                    <TextField
                      label="Specification URL"
                      value={d.specUrl}
                      placeholder="https://manufacturer…"
                      onChange={(specUrl) => updateDevice({ ...d, specUrl })}
                    />
                    {d.specUrl.startsWith("https://") && (
                      <a
                        className="text-link"
                        href={d.specUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open specification <ArrowUpRight size={12} />
                      </a>
                    )}
                    <TextField
                      label="Notes"
                      value={d.notes}
                      multiline
                      onChange={(notes) => updateDevice({ ...d, notes })}
                    />
                  </div>
                </details>
                <button
                  className="danger-button"
                  onClick={props.deleteSelection}
                >
                  <Trash2 size={14} />
                  {template
                    ? "Delete template"
                    : "Delete device & attached cables"}
                </button>
              </>
            )}
            {relevant.length > 0 && (
              <>
                <div className="section-label">DIAGNOSTICS</div>
                <FindingList findings={relevant} focus={props.focusComponent} />
              </>
            )}
          </>
        )}
        {cable &&
          (() => {
            const c = cable;
            const bw = result.cables[c.id];
            const endpoint = (deviceId: string, portId: string) => {
              const dev = project.devices.find((d) => d.id === deviceId);
              return `${dev?.name} / ${dev?.ports.find((p) => p.id === portId)?.name}`;
            };
            return (
              <>
                <div className="inspector-device-heading">
                  <div className="device-glyph adapter">
                    <CableIcon size={25} />
                  </div>
                  <div>
                    <small>Physical connection</small>
                    <h2>{c.name || "Cable"}</h2>
                  </div>
                </div>
                <div className="cable-endpoints">
                  <span>FROM</span>
                  <strong>{endpoint(c.sourceDevice, c.sourcePort)}</strong>
                  <div className="endpoint-line" />
                  <span>TO</span>
                  <strong>{endpoint(c.targetDevice, c.targetPort)}</strong>
                </div>
                <CableSpecTools cable={c} project={project} update={updateCable} notify={props.notify} />
                <TextField
                  label="Cable label"
                  value={c.name}
                  onChange={(name) => updateCable({ ...c, name })}
                />
                <NumberField
                  label="Rated raw bandwidth (Gbps)"
                  value={c.ratingGbps}
                  onChange={(ratingGbps) => {
                    if (ratingGbps !== c.ratingGbps)
                      updateCable({ ...c, ratingGbps, presetId: null, dpLaneGbps: null });
                  }}
                />
                {c.dpLaneGbps != null && <p className="inline-note">DP cable limit: {c.dpLaneGbps} Gbps per lane. The simulation also applies the connected ports' lane allocation.</p>}
                <NumberField
                  label="Length (m)"
                  value={c.lengthM}
                  onChange={(lengthM) => updateCable({ ...c, lengthM })}
                />
                <p className="inline-note">
                  Length is a planning note. Electrical signal loss is not
                  simulated.
                </p>
                <div className="section-label">BANDWIDTH INSPECTOR</div>
                {bw && (
                  <>
                    <div className={`display-summary ${bw.status}`}>
                      <StatusIcon status={bw.status} />
                      <strong>{statusLabels[bw.status]}</strong>
                    </div>
                    <div className="bandwidth-table">
                      <div>
                        <span>
                          Active-picture{" "}
                          {bw.streamCount > 1
                            ? `(${bw.streamCount} streams)`
                            : "rate"}
                        </span>
                        <strong>
                          {bw.activeVideoGbps.toFixed(2)} <small>Gbps</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {bw.basis.includes("link class")
                            ? "Required link class"
                            : "Transport demand"}
                        </span>
                        <strong>
                          {bw.demandGbps?.toFixed(2) ?? "—"} <small>Gbps</small>
                        </strong>
                      </div>
                      <div>
                        <span>
                          {bw.basis.includes("TMDS") ||
                          bw.basis.includes("link class")
                            ? "Wire capacity"
                            : "Usable payload capacity"}
                        </span>
                        <strong>
                          {bw.capacityGbps?.toFixed(2) ?? "—"}{" "}
                          <small>Gbps</small>
                        </strong>
                      </div>
                      <div>
                        <span>Utilization</span>
                        <strong>
                          {bw.utilization === null
                            ? "Unverified"
                            : `${(bw.utilization * 100).toFixed(1)}%`}
                        </strong>
                      </div>
                    </div>
                    <p className="inline-note">
                      {bw.basis}. Active-picture rate is a lower bound, not
                      cable demand.
                    </p>
                  </>
                )}
                <details className="advanced">
                  <summary>Advanced cable settings & notes</summary>
                  <div className="details-content">
                    {cableProtocol(project, c) === "DisplayPort" && (
                      <NumberField
                        label="DP maximum rate per lane (Gbps)"
                        value={c.dpLaneGbps ?? null}
                        max={20}
                        onChange={(dpLaneGbps) => {
                          if (dpLaneGbps !== (c.dpLaneGbps ?? null))
                            updateCable({ ...c, dpLaneGbps, presetId: null });
                        }}
                      />
                    )}
                    <div className="section-label">RAW BANDWIDTH SHORTCUTS</div>
                    <div className="rating-shortcuts">
                      {(cableProtocol(project, c) === "DisplayPort" ? [10.8, 21.6, 32.4, 40, 54, 80] : [4.95, 10.2, 18, 40, 48, 64, 80, 96]).map((n) => (
                        <button key={n} onClick={() => updateCable({ ...c, ratingGbps: n, presetId: null, dpLaneGbps: null })}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {(["vrr", "hdr", "dsc"] as const).map((f) => (
                      <FeatureField
                        key={f}
                        label={`${f.toUpperCase()} pass-through`}
                        value={c.features[f]}
                        onChange={(v) =>
                          updateCable({
                            ...c,
                            features: { ...c.features, [f]: v },
                          })
                        }
                      />
                    ))}
                    <TextField
                      label="Notes"
                      value={c.notes}
                      multiline
                      onChange={(notes) => updateCable({ ...c, notes })}
                    />
                  </div>
                </details>
                <FindingList findings={relevant} focus={props.focusComponent} />
                <button
                  className="danger-button"
                  onClick={props.deleteSelection}
                >
                  <Trash2 size={14} />
                  Disconnect cable
                </button>
              </>
            );
          })()}
      </div>
    </aside>
  );
}
