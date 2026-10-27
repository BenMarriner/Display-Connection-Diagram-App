import { useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Settings2,
  ChevronUp,
  ChevronDown,
  BookmarkPlus,
  ArrowUpRight,
} from "lucide-react";
import {
  type Device,
  type Port,
  type Project,
  type PortTemplate,
  connectors,
} from "./model";
import { links } from "./presets";
import { movePort } from "./devices";
import {
  addDevicePort,
  duplicatePort,
  starterPortTemplates,
  applyPortTemplate,
  applyTemplateToDevice,
  savePortTemplate,
  templateMatches,
} from "./portSpecs";
import { gpuPresets, replaceGpuOutputs } from "./gpuPresets";
import { Field, Toggle } from "./components";
import InlineName from "./InlineName";

function TemplateOptions({
  templates,
  connector,
}: {
  templates: PortTemplate[];
  connector?: Port["connector"];
}) {
  return (
    <>
      <optgroup label="Built-in spec templates">
        {starterPortTemplates
          .filter((t) => !connector || t.spec.connector === connector)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </optgroup>
      <optgroup label="Your saved port specs">
        {templates
          .filter((t) => !connector || t.spec.connector === connector)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </optgroup>
    </>
  );
}
export function PortSpecTools({
  port,
  templates,
  update,
  save,
  notify,
}: {
  port: Port;
  templates: PortTemplate[];
  update: (p: Port) => void;
  save: (t: PortTemplate) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [selected, setSelected] = useState("");
  const [name, setName] = useState(`${port.name} specs`);
  const [includeSignal, setIncludeSignal] = useState(true);
  const template = [...starterPortTemplates, ...templates].find(
    (t) => t.id === selected,
  );
  return (
    <details className="advanced template-tools" open>
      <summary>Reusable port specifications</summary>
      <div className="details-content">
        <Field label="Port spec template">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a template…</option>
            <TemplateOptions templates={templates} connector={port.connector} />
          </select>
        </Field>
        {template && (
          <>
            <p className="inline-note">
              {template.description}{" "}
              {template.includeSignal
                ? "Includes source signal settings."
                : "Keeps the current source signal."}
            </p>
            <button
              className="secondary-button full-width"
              onClick={() => {
                update(applyPortTemplate(port, template));
                notify(`Applied “${template.name}” to ${port.name}.`);
              }}
            >
              Apply to this port
            </button>
          </>
        )}
        <div className="save-port-template">
          <Field label="Save current settings as">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
            />
          </Field>
          <Toggle
            label="Include source signal defaults"
            checked={includeSignal}
            onChange={setIncludeSignal}
          />
          <button
            className="secondary-button full-width"
            disabled={!name.trim() || templates.length >= 500}
            onClick={() => {
              save({ ...savePortTemplate(port, name), includeSignal });
              notify(`Saved “${name.trim()}” for reuse on matching ports.`);
            }}
          >
            <BookmarkPlus size={14} />
            Save port spec template
          </button>
        </div>
      </div>
    </details>
  );
}

export function PortListEditor({
  device: d,
  project,
  update,
  edit,
  remove,
  gpuLayout,
  notify,
}: {
  device: Device;
  project: Project;
  update: (d: Device) => void;
  edit: (p: Port) => void;
  remove: (p: Port) => void;
  gpuLayout: (id: string) => void;
  notify: (text: string, error?: boolean) => void;
}) {
  const [connector, setConnector] = useState<Port["connector"]>("HDMI");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [gpuId, setGpuId] = useState("");
  const template = [...starterPortTemplates, ...project.portTemplates].find(
    (t) => t.id === selectedTemplate,
  );
  const matches = template
    ? d.ports.filter((p) => templateMatches(p, template)).length
    : 0;
  const gpu = gpuPresets.find((g) => g.id === gpuId);
  const impact = gpu
    ? (() => {
        try {
          return replaceGpuOutputs(project, d.id, gpu);
        } catch {
          return null;
        }
      })()
    : null;
  const change = (action: () => Device) => {
    try {
      update(action());
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not change this port.",
        true,
      );
    }
  };
  return (
    <>
      <div className="section-label">
        INPUTS & OUTPUTS <span>{d.ports.length} ports</span>
      </div>
      <details className="advanced template-tools">
        <summary>Set up ports faster</summary>
        <div className="details-content">
          <Field label="Reusable port specs">
            <select
              value={selectedTemplate}
              onChange={(e) => {
                setSelectedTemplate(e.target.value);
                const t = [
                  ...starterPortTemplates,
                  ...project.portTemplates,
                ].find((t) => t.id === e.target.value);
                if (t) setConnector(t.spec.connector);
              }}
            >
              <option value="">Unknown specs / no template</option>
              <TemplateOptions templates={project.portTemplates} />
            </select>
          </Field>
          {template && (
            <>
              <p className="inline-note">
                {template.description}{" "}
                {template.includeSignal
                  ? "Applies signal defaults too."
                  : "Source signals stay unchanged."}
              </p>
              <button
                className="secondary-button full-width"
                disabled={!matches}
                onClick={() => {
                  change(() => applyTemplateToDevice(d, template));
                  notify(
                    `Applied “${template.name}” to ${matches} matching ports.`,
                  );
                }}
              >
                Apply to all {template.spec.connector} ports ({matches})
              </button>
            </>
          )}
          {d.kind === "computer" && (
            <div className="gpu-layout-tools">
              <Field label="GPU output layout">
                <select
                  value={gpuId}
                  onChange={(e) => setGpuId(e.target.value)}
                >
                  <option value="">Choose a GPU / board…</option>
                  {gpuPresets.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              {gpu && (
                <>
                  <p className="inline-note">
                    {gpu.summary}. Up to {gpu.maxDisplays} display streams.{" "}
                    {gpu.notes}
                  </p>
                  <a
                    className="text-link"
                    href={gpu.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manufacturer specifications · checked {gpu.checked}
                    <ArrowUpRight size={12} />
                  </a>
                  <button
                    className="secondary-button full-width"
                    disabled={!impact}
                    onClick={() => gpuLayout(gpu.id)}
                  >
                    Use GPU output layout
                    {impact?.disconnected
                      ? ` · disconnects ${impact.disconnected} cable(s)`
                      : ""}
                  </button>
                  <p className="port-list-help">
                    Replaces outputs, keeps inputs and matching cabled port
                    identities. Undo restores the previous layout.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </details>
      <div className="add-ports-toolbar">
        <Field label="New port connector">
          <select
            value={connector}
            onChange={(e) => setConnector(e.target.value as Port["connector"])}
          >
            {connectors.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <div className="field-pair">
          <button
            className="secondary-button"
            disabled={d.ports.length >= 64}
            onClick={() =>
              change(() => addDevicePort(d, "in", connector, template))
            }
          >
            <Plus size={14} />
            Input
          </button>
          <button
            className="secondary-button"
            disabled={d.ports.length >= 64}
            onClick={() =>
              change(() => addDevicePort(d, "out", connector, template))
            }
          >
            <Plus size={14} />
            Output
          </button>
        </div>
      </div>
      <div className="port-list">
        {(["in", "out"] as const).map((direction) => {
          const ports = d.ports.filter((p) => p.direction === direction);
          if (!ports.length) return null;
          return (
            <section
              className="port-group"
              key={direction}
              aria-label={direction === "in" ? "Inputs" : "Outputs"}
            >
              <h3>
                {direction === "in" ? "Inputs" : "Outputs"}{" "}
                <span>{ports.length}</span>
              </h3>
              {ports.map((p, index) => {
                const connected = project.cables.some(
                  (c) => c.sourcePort === p.id || c.targetPort === p.id,
                );
                return (
                  <div className="port-list-row" key={p.id} data-port-id={p.id}>
                    <div className="port-open">
                      <span
                        className={`port-shape ${p.connector === "HDMI" ? "hdmi" : "dp"}`}
                      />
                      <div>
                        <InlineName
                          value={p.name}
                          label={`Rename ${p.name}`}
                          onCommit={(name) =>
                            update({
                              ...d,
                              ports: d.ports.map((old) =>
                                old.id === p.id ? { ...old, name } : old,
                              ),
                            })
                          }
                        />
                        <button
                          className="port-spec-link"
                          onClick={() => edit(p)}
                          title={`Edit ${p.name} specifications`}
                        >
                          <Settings2 size={12} />
                          {p.connector} ·{" "}
                          {p.caps.link === "unknown"
                            ? "Specs unknown"
                            : links[p.caps.link].label.split(" · ")[1]}
                        </button>
                      </div>
                    </div>
                    <div className="port-row-actions">
                      <button
                        className="icon-button"
                        title={`Duplicate ${p.name} and its settings`}
                        aria-label={`Duplicate ${p.name}`}
                        disabled={d.ports.length >= 64}
                        onClick={() => change(() => duplicatePort(d, p.id))}
                      >
                        <Copy size={14} />
                      </button>
                      <div className="port-order-actions">
                        <button
                          className="icon-button"
                          aria-label={`Move ${p.name} up`}
                          title={`Move ${p.name} up`}
                          disabled={index === 0}
                          onClick={() => update(movePort(d, p.id, -1))}
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Move ${p.name} down`}
                          title={`Move ${p.name} down`}
                          disabled={index === ports.length - 1}
                          onClick={() => update(movePort(d, p.id, 1))}
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                      <button
                        className="icon-button port-remove"
                        aria-label={`Remove ${p.name}`}
                        title={`Remove ${p.name}${connected ? " and attached cable" : ""} (undoable)`}
                        onClick={() => remove(p)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="port-list-help">
        Rename here or on the node. Copy duplicates all settings. Removing a
        connected port also removes its cable; Undo restores both.
      </p>
    </>
  );
}
