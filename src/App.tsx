import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  useUpdateNodeInternals,
  MarkerType,
  type Node,
  type NodeProps,
  type EdgeProps,
  type Connection,
  type Edge,
  type OnConnectEnd,
} from "@xyflow/react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  Maximize,
  X,
  MousePointer2,
  FolderPlus,
  CircleHelp,
  ArrowUpRight,
  Layers,
  Play,
  LayoutGrid,
  Trash2,
  Pencil,
  Settings2,
  Cable as CableIcon,
  ImageDown,
} from "lucide-react";
import {
  type Device,
  type Project,
  type Cable,
  type Kind,
  type Port,
  type Status,
  kinds,
  id,
  emptyProject,
  connectionError,
  statusLabels,
  modeLabel,
} from "./model";
import {
  makeDevice,
  cloneDevice,
  makeCable,
  kindLabels,
  kindDescriptions,
  exampleProject,
  removePort,
} from "./devices";
import {
  simulate,
  type SimulationResult,
  type DisplayResult,
  type Bandwidth,
} from "./engine";
import {
  loadProject,
  saveProject,
  parseProject,
  serializeProject,
} from "./persistence";
import { links } from "./presets";
import { downloadDiagramPng, renderGraphPng } from "./graphExport";
import { DeviceIcon, StatusIcon } from "./components";
import Inspector, { type Selection } from "./Inspector";
import InlineName from "./InlineName";
import ConnectionMenu, { type ConnectionMenuState } from "./ConnectionMenu";
import {
  connectionLibrary,
  materializeConnection,
  type ConnectionChoice,
  type ConnectionOrigin,
} from "./connections";
import { gpuPresets, makeGpuDevice, replaceGpuOutputs } from "./gpuPresets";
import { dockPresets, makeDockDevice, matchesDockPreset } from "./dockPresets";
import {
  consoleFamilies,
  consolePresets,
  makeConsoleDevice,
  matchesConsolePreset,
} from "./consolePresets";
import {
  interfaceSizes,
  readInterfaceSize,
  rememberInterfaceSize,
  type InterfaceSize,
} from "./uiPreferences";

type NodeData = {
  device: Device;
  display?: DisplayResult;
  result: SimulationResult;
  editingPortId?: string;
  layoutKey: string;
  onLayoutReady: (deviceId: string, key: string) => void;
  occupiedPorts: string[];
  connectingPortId?: string;
  [key: string]: unknown;
};
const EditorContext = createContext<{
  select: (s: Selection) => void;
  update: (d: Device) => void;
  connectFrom: (
    deviceId: string,
    portId: string,
    point: { x: number; y: number },
  ) => void;
}>({ select: () => {}, update: () => {}, connectFrom: () => {} });

function DeviceNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const d = data.device,
    { select, update, connectFrom } = useContext(EditorContext);
  const updateInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    updateInternals(d.id);
    // updateNodeInternals schedules its DOM measurement on the next frame.
    // Only expose new/restored cables after those handles have been measured.
    const frame = requestAnimationFrame(() =>
      data.onLayoutReady(d.id, data.layoutKey),
    );
    return () => cancelAnimationFrame(frame);
  }, [d.id, data.layoutKey, data.onLayoutReady, updateInternals]);
  const inputs = d.ports.filter((p) => p.direction === "in"),
    outputs = d.ports.filter((p) => p.direction === "out");
  const activeInput = inputs.find((p) => p.id === d.selectedInput);
  const source = ["computer", "console", "dock"].includes(d.kind);
  const renderPort = (p: Port) => (
    <div
      className={`node-port ${p.direction} ${d.selectedInput === p.id ? "chosen" : ""} ${data.editingPortId === p.id ? "editing" : ""} ${data.connectingPortId === p.id ? "connecting" : ""}`}
      data-editing={data.editingPortId === p.id || undefined}
      key={p.id}
    >
      <Handle
        type={p.direction === "in" ? "target" : "source"}
        position={p.direction === "in" ? Position.Left : Position.Right}
        id={p.id}
        isConnectable={!data.occupiedPorts.includes(p.id)}
        className={`${p.connector === "HDMI" ? "hdmi-handle" : "dp-handle"} ${data.editingPortId === p.id ? "editing-handle" : ""}`}
        title={`${d.name} / ${p.name} (${p.direction})`}
      />
      <div className="node-port-line">
        <span
          className={`port-shape ${p.connector === "HDMI" ? "hdmi" : "dp"}`}
        />
        <InlineName
          value={p.name}
          label={`${d.name} / ${p.name} port name`}
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
          className="node-port-action nodrag nopan"
          aria-label={`Edit ${d.name} / ${p.name} specifications`}
          title={`Edit ${p.name} specifications`}
          aria-pressed={data.editingPortId === p.id}
          onClick={(e) => {
            e.stopPropagation();
            select({ type: "device", id: d.id, portId: p.id });
          }}
        >
          <Settings2 size={10} />
        </button>
        <button
          className="node-port-action nodrag nopan"
          aria-label={`Connect ${d.name} / ${p.name}`}
          title="Connect to a compatible port or add a device"
          disabled={data.occupiedPorts.includes(p.id)}
          onClick={(e) => {
            e.stopPropagation();
            const box = e.currentTarget.getBoundingClientRect();
            connectFrom(d.id, p.id, { x: box.right + 8, y: box.bottom + 8 });
          }}
        >
          <CableIcon size={10} />
        </button>
      </div>
      <small>
        {data.editingPortId === p.id && (
          <span className="port-editing-tag">Editing · </span>
        )}
        {p.caps.link === "unknown"
          ? "Specs unknown"
          : p.caps.version || (p.protocol === "HDMI" ? "HDMI" : "DP")}
      </small>
    </div>
  );
  return (
    <div
      className={`device-node ${selected ? "selected" : ""} ${!d.enabled ? "powered-off" : ""}`}
    >
      <div className="node-header">
        <div className={`device-glyph ${d.kind}`}>
          <DeviceIcon kind={d.kind} size={20} />
        </div>
        <div>
          <small>{kindLabels[d.kind]}</small>
          <strong>{d.name}</strong>
        </div>
        <span
          className={`power-dot ${d.enabled ? "on" : ""}`}
          title={d.enabled ? "Powered on" : "Powered off"}
        />
      </div>
      {d.model && <div className="node-model">{d.model}</div>}
      <div className="node-ports">
        <div className="ports-column">
          <div className="port-column-label">
            {inputs.length ? "INPUTS" : "SOURCE"}
          </div>
          {inputs.map(renderPort)}
          {!inputs.length && (
            <div className="source-symbol">
              <Activity size={25} strokeWidth={1.3} />
            </div>
          )}
        </div>
        <div className="ports-column">
          <div className="port-column-label">
            {outputs.length ? "OUTPUTS" : "DISPLAY"}
          </div>
          {outputs.map(renderPort)}
          {!outputs.length && (
            <div className="source-symbol">
              <DeviceIcon kind={d.kind} size={25} />
            </div>
          )}
        </div>
      </div>
      {source && outputs.length > 0 && (
        <button
          className="node-signal nodrag"
          onClick={(e) => {
            e.stopPropagation();
            select({ type: "device", id: d.id, portId: outputs[0].id });
          }}
        >
          <Activity size={12} />
          <span>{modeLabel(outputs[0].signal)}</span>
          <ArrowUpRight size={12} />
        </button>
      )}
      {d.kind === "console" && inputs.length > 0 && (
        <div className="node-console-input-note">HDMI input · wiring only</div>
      )}
      {d.kind !== "console" && inputs.length > 0 && (
        <div className="node-channel nodrag">
          <span>
            {["monitor", "projector"].includes(d.kind) ? "Input" : "Channel"}
          </span>
          <select
            aria-label={`${d.name} selected input`}
            value={d.selectedInput ?? ""}
            onChange={(e) =>
              update({ ...d, selectedInput: e.target.value || null })
            }
          >
            <option value="">Off / no input</option>
            {inputs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className={`channel-light ${activeInput ? "on" : ""}`} />
        </div>
      )}
      {data.display && (
        <div className={`node-status ${data.display.status}`}>
          <StatusIcon status={data.display.status} />
          <span>
            {data.display.status === "supported"
              ? "Signal supported"
              : statusLabels[data.display.status]}
          </span>
          {data.display.signal && (
            <small>{data.display.signal.refresh} Hz</small>
          )}
        </div>
      )}
    </div>
  );
}
const statusColors: Record<Status, string> = {
  supported: "#88d9bd",
  uncertain: "#d7b979",
  incompatible: "#e18c8c",
  inactive: "#49515f",
};
function CableEdge(props: EdgeProps<Edge<{ bw: Bandwidth; name: string }>>) {
  const { select } = useContext(EditorContext);
  const [path, x, y] = getSmoothStepPath({
    ...props,
    borderRadius: 18,
    offset: 36,
  });
  const bw = props.data?.bw,
    status = bw?.status ?? "inactive";
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke: statusColors[status],
          strokeWidth: props.selected ? 3 : 1.6,
          strokeDasharray:
            status === "inactive"
              ? "5 6"
              : status === "supported"
                ? "8 6"
                : undefined,
        }}
        className={`cable-path ${status}`}
        interactionWidth={22}
      />
      <EdgeLabelRenderer>
        <button
          aria-label={`Inspect ${props.data?.name || "cable"} connection`}
          onClick={(e) => {
            e.stopPropagation();
            select({ type: "cable", id: props.id });
          }}
          className={`cable-label nodrag nopan ${status} ${props.selected ? "selected" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
            pointerEvents: "all",
          }}
        >
          <span className="tiny-dot" />
          {props.data?.name || "Cable"}
          {bw?.utilization !== null && bw?.utilization !== undefined && (
            <small>{Math.round(bw.utilization * 100)}%</small>
          )}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
const nodeTypes = { device: DeviceNode },
  edgeTypes = { cable: CableEdge };

function Workspace() {
  const [interfaceSize, setInterfaceSize] =
    useState<InterfaceSize>(readInterfaceSize);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--ui-scale",
      String(interfaceSize / 100),
    );
    rememberInterfaceSize(interfaceSize);
  }, [interfaceSize]);
  const [history, setHistory] = useState<{
    past: Project[];
    present: Project;
    future: Project[];
  }>({ past: [], present: emptyProject(), future: [] });
  const project = history.present;
  const [nameDraft, setNameDraft] = useState(project.name);
  useEffect(() => setNameDraft(project.name), [project.name]);
  const [selection, setSelection] = useState<Selection>(null);
  const [connectionMenu, setConnectionMenu] =
    useState<ConnectionMenuState | null>(null);
  const connectionOrigin = useRef<ConnectionOrigin | null>(null);
  const [ready, setReady] = useState(false),
    [saveState, setSaveState] = useState("Loading workspace…");
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const pngExportInProgress = useRef(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [search, setSearch] = useState(""),
    [showHelp, setShowHelp] = useState(false),
    [monitorOpen, setMonitorOpen] = useState(true);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [readyPortLayouts, setReadyPortLayouts] = useState<
    Record<string, string>
  >({});
  const markLayoutReady = useCallback((deviceId: string, key: string) => {
    setReadyPortLayouts((previous) =>
      previous[deviceId] === key ? previous : { ...previous, [deviceId]: key },
    );
  }, []);
  const fileRef = useRef<HTMLInputElement>(null),
    canvasRef = useRef<HTMLDivElement>(null);
  const writes = useRef(Promise.resolve());
  const flow = useReactFlow();
  const deviceLibrary = useMemo(
    () => connectionLibrary(project.templates),
    [project.templates],
  );
  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  const openConnectionMenu = useCallback(
    (deviceId: string, portId: string, point: { x: number; y: number }) => {
      if (
        project.cables.some(
          (c) => c.sourcePort === portId || c.targetPort === portId,
        )
      ) {
        notify("That port already has a cable. Disconnect it first.", true);
        return;
      }
      setConnectionMenu({
        origin: { deviceId, portId },
        screen: point,
        position: flow.screenToFlowPosition(point),
      });
    },
    [project.cables, flow, notify],
  );
  const commit = useCallback(
    (recipe: (p: Project) => Project) =>
      setHistory((h) => ({
        past: [...h.past.slice(-49), h.present],
        present: recipe(h.present),
        future: [],
      })),
    [],
  );
  const undo = useCallback(
    () =>
      setHistory((h) =>
        h.past.length
          ? {
              past: h.past.slice(0, -1),
              present: h.past[h.past.length - 1],
              future: [h.present, ...h.future],
            }
          : h,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setHistory((h) =>
        h.future.length
          ? {
              past: [...h.past, h.present],
              present: h.future[0],
              future: h.future.slice(1),
            }
          : h,
      ),
    [],
  );
  const updateDevice = useCallback(
    (d: Device) =>
      commit((p) =>
        p.templates.some((t) => t.id === d.id)
          ? {
              ...p,
              templates: p.templates.map((old) => (old.id === d.id ? d : old)),
            }
          : {
              ...p,
              devices: p.devices.map((old) => (old.id === d.id ? d : old)),
            },
      ),
    [commit],
  );
  const updateCable = useCallback(
    (c: Cable) =>
      commit((p) => ({
        ...p,
        cables: p.cables.map((old) => (old.id === c.id ? c : old)),
      })),
    [commit],
  );
  // Layout is excluded from the simulation dependency so dragging never reruns the engine.
  const simulationKey = JSON.stringify({
    devices: project.devices.map(({ position: _position, ...d }) => d),
    cables: project.cables,
  });
  const result = useMemo(() => simulate(project), [simulationKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    loadProject()
      .then((p) => {
        if (!cancelled && p) {
          setHistory({ past: [], present: p, future: [] });
          flow.setViewport(p.viewport);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRestoreFailed(true);
          setSaveState("Restore failed · import or start new");
          notify(
            `Could not restore workspace: ${e instanceof Error ? e.message : "Browser storage error"}. The stored copy is preserved. Import a backup or start a new diagram to resume autosave.`,
            true,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready || restoreFailed) return;
    setSaveState("Saving…");
    let current = true;
    const timer = setTimeout(() => {
      writes.current = writes.current
        .catch(() => {})
        .then(() => saveProject(project));
      writes.current
        .then(() => {
          if (current) setSaveState("Saved on this browser");
        })
        .catch(() => {
          if (current) {
            setSaveState("Save failed · export a backup");
            notify(
              "Browser autosave failed. Your diagram is still open; export a JSON backup.",
              true,
            );
          }
        });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [project, ready, restoreFailed, notify]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (
      selection &&
      !(
        selection.type === "device"
          ? selection.template
            ? project.templates
            : project.devices
          : project.cables
      ).some((d) => d.id === selection.id)
    )
      setSelection(null);
  }, [project.devices, project.cables, project.templates, selection]);
  const deleteSelection = useCallback(() => {
    if (!selection) return;
    commit((p) =>
      selection.type === "cable"
        ? { ...p, cables: p.cables.filter((c) => c.id !== selection.id) }
        : selection.template
          ? {
              ...p,
              templates: p.templates.filter((d) => d.id !== selection.id),
            }
          : {
              ...p,
              devices: p.devices.filter((d) => d.id !== selection.id),
              cables: p.cables.filter(
                (c) =>
                  c.sourceDevice !== selection.id &&
                  c.targetDevice !== selection.id,
              ),
            },
    );
    setSelection(null);
  }, [selection, commit]);
  const add = (kind: Kind, template?: Device) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const point = rect
      ? flow.screenToFlowPosition({
          x: rect.left + rect.width / 2 - 120,
          y: rect.top + rect.height / 2 - 110,
        })
      : { x: 60, y: 60 };
    let freePoint = point;
    const direction = ["computer", "console"].includes(kind) ? -1 : 1;
    const columns = [0, direction, -direction, 2 * direction, -2 * direction];
    for (let index = 0; index < 60; index++) {
      const column = columns[index % 5],
        row = Math.floor(index / 5);
      const candidate =
        index === 0
          ? point
          : { x: point.x + column * 310, y: point.y + row * 280 };
      if (
        !project.devices.some(
          (d) =>
            Math.abs(d.position.x - candidate.x) < 285 &&
            Math.abs(d.position.y - candidate.y) < 250,
        )
      ) {
        freePoint = candidate;
        break;
      }
    }
    const d = template
      ? cloneDevice(template, freePoint)
      : makeDevice(kind, freePoint);
    commit((p) => ({ ...p, devices: [...p.devices, d] }));
    setSelection({ type: "device", id: d.id });
    setTimeout(
      () => flow.fitView({ padding: 0.2, maxZoom: 1, duration: 250 }),
      80,
    );
  };
  const duplicate = useCallback(
    (d: Device) => {
      const next = cloneDevice(d);
      next.name = `${d.name} copy`;
      commit((p) => ({ ...p, devices: [...p.devices, next] }));
      setSelection({ type: "device", id: next.id });
    },
    [commit],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (connectionMenu) {
        if (e.key === "Escape") setConnectionMenu(null);
        return;
      }
      if (e.key === "Escape") {
        setSelection(null);
        setShowHelp(false);
        return;
      }
      if (showHelp) return;
      if (
        (e.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable]",
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "d" &&
        selection?.type === "device"
      ) {
        e.preventDefault();
        const d = project.devices.find((d) => d.id === selection.id);
        if (d) duplicate(d);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    undo,
    redo,
    deleteSelection,
    selection,
    project.devices,
    duplicate,
    showHelp,
    connectionMenu,
  ]);
  function connect(c: Connection) {
    const error = connectionError(
      project,
      c.source,
      c.sourceHandle ?? "",
      c.target,
      c.targetHandle ?? "",
    );
    if (error) return notify(error, true);
    const a = project.devices.find((d) => d.id === c.source)!,
      b = project.devices.find((d) => d.id === c.target)!;
    const cable = makeCable(
      a,
      a.ports.findIndex((p) => p.id === c.sourceHandle),
      b,
      b.ports.findIndex((p) => p.id === c.targetHandle),
    );
    commit((p) => ({ ...p, cables: [...p.cables, cable] }));
    setSelection({ type: "cable", id: cable.id });
    notify("Cable connected. Choose a cable spec template or enter its rating in the inspector.");
  }
  const endConnection: OnConnectEnd = (event, state) => {
    const origin = connectionOrigin.current;
    connectionOrigin.current = null;
    if (!origin || state.isValid || state.toHandle) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      !target?.closest(".react-flow__pane") ||
      target.closest(
        ".react-flow__node,.react-flow__controls,.react-flow__minimap",
      )
    )
      return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    if (point)
      openConnectionMenu(origin.deviceId, origin.portId, {
        x: point.clientX,
        y: point.clientY,
      });
  };
  function chooseConnection(choice: ConnectionChoice) {
    if (!connectionMenu) return;
    try {
      const change = materializeConnection(
        project,
        connectionMenu.origin,
        choice,
        connectionMenu.position,
      );
      commit(() => change.project);
      setConnectionMenu(null);
      setSelection(
        choice.create
          ? { type: "device", id: change.device.id }
          : { type: "cable", id: change.cable.id },
      );
      notify(
        choice.create
          ? `Added ${change.device.name} and connected ${change.port.name}.`
          : `Connected ${change.device.name} / ${change.port.name}.`,
      );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not connect this port.",
        true,
      );
    }
  }

  const focusComponent = useCallback(
    (id: string) => {
      const d = project.devices.find(
        (d) => d.id === id || d.ports.some((p) => p.id === id),
      );
      if (d) {
        setSelection({
          type: "device",
          id: d.id,
          ...(d.id !== id ? { portId: id } : {}),
        });
        flow.fitView({
          nodes: [{ id: d.id }],
          padding: 0.6,
          maxZoom: 1.1,
          duration: 300,
        });
      } else {
        const c = project.cables.find((c) => c.id === id);
        if (c) setSelection({ type: "cable", id });
      }
    },
    [project.devices, project.cables, flow],
  );
  function fit() {
    flow.fitView({ padding: 0.18, duration: 350, maxZoom: 1 });
  }
  function loadExample() {
    setRestoreFailed(false);
    commit((p) => ({
      ...exampleProject(),
      templates: p.templates,
      portTemplates: p.portTemplates,
    }));
    setSelection(null);
    setTimeout(fit, 80);
    notify("Example loaded. All specifications are illustrative and editable.");
  }
  function exportFile() {
    const blob = new Blob([serializeProject(project)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "display-setup"}.signalpath.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Project exported, including your device and port templates.");
  }
  async function exportPng() {
    if (!canvasRef.current || pngExportInProgress.current) return;
    pngExportInProgress.current = true;
    setExportingPng(true);
    try {
      const image = await renderGraphPng(canvasRef.current, {
        nodes: project.devices.length, edges: project.cables.length,
      });
      downloadDiagramPng(image.blob, project.name);
      notify(`Diagram exported as PNG (${image.width} × ${image.height}).${image.reduced ? " Resolution was reduced to fit the whole diagram." : ""}`);
    } catch (error) {
      notify(`PNG export failed: ${error instanceof Error ? error.message : "Please try again."}`, true);
    } finally {
      pngExportInProgress.current = false;
      setExportingPng(false);
    }
  }
  const portLayouts = Object.fromEntries(
    project.devices.map((d) => [
      d.id,
      JSON.stringify([
        d.name,
        d.model,
        d.ports.map((p) => [
          p.id,
          p.direction,
          p.name,
          p.connector,
          p.caps.version,
          p.caps.link,
        ]),
      ]),
    ]),
  );
  const nodes: Node<NodeData>[] = project.devices.map((d) => ({
    id: d.id,
    type: "device",
    position: positions[d.id] ?? d.position,
    measured: measurements[d.id],
    selected: selection?.type === "device" && selection.id === d.id,
    data: {
      device: d,
      occupiedPorts: project.cables.flatMap((c) => [
        c.sourcePort,
        c.targetPort,
      ]),
      connectingPortId:
        connectionMenu?.origin.deviceId === d.id
          ? connectionMenu.origin.portId
          : undefined,
      layoutKey: portLayouts[d.id],
      onLayoutReady: markLayoutReady,
      editingPortId:
        selection?.type === "device" &&
        !selection.template &&
        selection.id === d.id
          ? selection.portId
          : undefined,
      display: result.displays.find((r) => r.deviceId === d.id),
      result,
    },
  }));
  const edges: Edge<{ bw: Bandwidth; name: string }>[] = project.cables
    .filter(
      (c) =>
        readyPortLayouts[c.sourceDevice] === portLayouts[c.sourceDevice] &&
        readyPortLayouts[c.targetDevice] === portLayouts[c.targetDevice],
    )
    .map((c) => ({
      id: c.id,
      source: c.sourceDevice,
      sourceHandle: c.sourcePort,
      target: c.targetDevice,
      targetHandle: c.targetPort,
      type: "cable",
      selected: selection?.type === "cable" && selection.id === c.id,
      data: { bw: result.cables[c.id], name: c.name },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: statusColors[result.cables[c.id]?.status ?? "inactive"],
      },
    }));
  const supported = result.displays.filter(
    (d) => d.status === "supported",
  ).length;
  const active = result.displays.filter((d) => d.status !== "inactive").length;
  const errors = result.findings.filter((f) => f.severity === "error").length;
  const filteredKinds = kinds.filter((k) =>
    `${kindLabels[k]} ${kindDescriptions[k]}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <EditorContext.Provider
      value={{
        select: setSelection,
        update: updateDevice,
        connectFrom: openConnectionMenu,
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              setSelection(null);
            }}
          >
            <div className="brand-mark">
              <Activity size={24} strokeWidth={2} />
            </div>
            <div>
              signalpath<span>DISPLAY CONNECTION PLANNER</span>
            </div>
          </a>
          <div className="header-divider" />
          <div className="workspace-context">
            <span>PERSONAL WORKSPACE</span>
            <div>
              <span className="local-dot" />
              Local project
              <ChevronDown size={12} />
            </div>
          </div>
          <div className="header-actions">
            <label
              className="ui-size-control"
              title="Resize the interface without changing diagram zoom"
            >
              <span>UI size</span>
              <select
                aria-label="Interface size"
                value={interfaceSize}
                onChange={(e) =>
                  setInterfaceSize(Number(e.target.value) as InterfaceSize)
                }
              >
                {interfaceSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}%
                  </option>
                ))}
              </select>
            </label>
            <span className="local-tag">
              <span className="tiny-dot" />
              Your data stays here
            </span>
            <button
              className="header-help icon-button"
              title="Help & keyboard shortcuts"
              onClick={() => setShowHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="secondary-button"
              onClick={() => fileRef.current?.click()}
            >
              <ArrowUpFromLine size={15} />
              Import
            </button>
            <button className="primary-button" onClick={exportFile}>
              <ArrowDownToLine size={15} />
              Export project
            </button>
          </div>
        </header>
        <main className="workspace">
          <aside className="library">
            <div className="library-intro">
              <div className="eyebrow">BUILD YOUR SETUP</div>
              <h2>Device library</h2>
              <p>Every connection starts here.</p>
            </div>
            <label className="search-box">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a device…"
                aria-label="Search device library"
              />
              <kbd>/</kbd>
            </label>
            <div className="library-scroll">
              <div className="section-label">
                DEVICES <span>{kinds.length}</span>
              </div>
              <div className="device-palette">
                {filteredKinds.map((k) => (
                  <button
                    className="palette-item"
                    key={k}
                    title={kindDescriptions[k]}
                    onClick={() => add(k)}
                  >
                    <div className={`palette-icon ${k}`}>
                      <DeviceIcon kind={k} size={20} />
                    </div>
                    <div>
                      <strong>{kindLabels[k]}</strong>
                      <small>
                        {k === "computer" || k === "console"
                          ? "Source"
                          : k === "monitor" || k === "projector"
                            ? "Display"
                            : k === "adapter"
                              ? "Conversion"
                              : "Routing"}
                      </small>
                    </div>
                    <Plus size={15} />
                  </button>
                ))}
                {!filteredKinds.length && (
                  <p className="muted small">No devices match your search.</p>
                )}
              </div>
              <details className="library-presets dock-library">
                <summary>
                  Dock presets <span>{dockPresets.length}</span>
                </summary>
                <div>
                  {dockPresets.filter((p) => matchesDockPreset(p, search)).map((p) => (
                    <button
                      className="gpu-library-item"
                      key={p.id}
                      title={p.notes}
                      onClick={() => add("dock", makeDockDevice(p))}
                    >
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.summary}</small>
                      </div>
                      <Plus size={14} />
                    </button>
                  ))}
                  {!dockPresets.some((p) => matchesDockPreset(p, search)) && (
                    <p className="muted small">No dock presets match your search.</p>
                  )}
                </div>
              </details>
              <details className="library-presets console-library">
                <summary>
                  Console presets <span>{consolePresets.length}</span>
                </summary>
                <div>
                  {consoleFamilies.map((family) => {
                    const matches = consolePresets.filter(
                      (p) => p.family === family && matchesConsolePreset(p, search),
                    );
                    return matches.length ? (
                      <div key={family}>
                        <div className="console-family-label">{family}</div>
                        {matches.map((p) => (
                          <button
                            className="gpu-library-item"
                            key={p.id}
                            title={p.notes}
                            onClick={() => add("console", makeConsoleDevice(p))}
                          >
                            <div>
                              <strong>{p.name}</strong>
                              <small>{p.summary}</small>
                            </div>
                            <Plus size={14} />
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })}
                  {!consolePresets.some((p) => matchesConsolePreset(p, search)) && (
                    <p className="muted small">No console presets match your search.</p>
                  )}
                </div>
              </details>
              <details className="library-presets gpu-library">
                <summary>
                  GPU output presets <span>{gpuPresets.length}</span>
                </summary>
                <div>
                  {gpuPresets
                    .filter((g) =>
                      `${g.name} ${g.summary}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((g) => (
                      <button
                        className="gpu-library-item"
                        key={g.id}
                        onClick={() => add("computer", makeGpuDevice(g))}
                      >
                        <div>
                          <strong>{g.name}</strong>
                          <small>{g.summary}</small>
                        </div>
                        <Plus size={14} />
                      </button>
                    ))}
                </div>
              </details>
              <details className="library-presets">
                <summary>
                  Your port spec templates{" "}
                  <span>{project.portTemplates.length}</span>
                </summary>
                <div>
                  {project.portTemplates.length ? (
                    project.portTemplates.map((t) => (
                      <div className="saved-port-template" key={t.id}>
                        <div>
                          <strong>{t.name}</strong>
                          <small>
                            {t.spec.connector} ·{" "}
                            {t.includeSignal ? "Specs + signal" : "Specs only"}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Delete port template ${t.name}`}
                          title="Delete saved template (existing ports stay unchanged)"
                          onClick={() =>
                            commit((p) => ({
                              ...p,
                              portTemplates: p.portTemplates.filter(
                                (v) => v.id !== t.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="port-list-help">
                      Save specs from any port inspector, then reuse them
                      individually or across a device.
                    </p>
                  )}
                </div>
              </details>
              <div className="section-label saved-label">
                YOUR TEMPLATES <span>{project.templates.length}</span>
              </div>
              {project.templates.length ? (
                <div className="template-list">
                  {project.templates
                    .filter((t) =>
                      `${t.name} ${t.model}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((t) => (
                      <div key={t.id}>
                        <button
                          className="template-add"
                          onClick={() => add(t.kind, t)}
                        >
                          <DeviceIcon kind={t.kind} size={16} />
                          <span>{t.name}</span>
                          <Plus size={13} />
                        </button>
                        <button
                          className="icon-button"
                          title={`Edit template ${t.name}`}
                          onClick={() =>
                            setSelection({
                              type: "device",
                              id: t.id,
                              template: true,
                            })
                          }
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="icon-button"
                          title={`Delete template ${t.name}`}
                          onClick={() =>
                            commit((p) => ({
                              ...p,
                              templates: p.templates.filter(
                                (v) => v.id !== t.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="templates-empty">
                  <Layers size={19} />
                  <p>Your hardware, reusable.</p>
                  <small>Configure a device, then save it as a template.</small>
                </div>
              )}
            </div>
            <button className="library-example" onClick={loadExample}>
              <span className="example-icon">
                <Play size={15} />
              </span>
              <div>
                <strong>Explore an example</strong>
                <small>PC, console & projector</small>
              </div>
              <ArrowUpRight size={15} />
            </button>
            <div className="library-foot">
              <span className="tiny-dot" />
              Private by design. Saved locally.
            </div>
          </aside>
          <section className="diagram-workspace">
            <div className="diagram-toolbar">
              <div className="diagram-title">
                <span className="diagram-icon">
                  <LayoutGrid size={16} />
                </span>
                <div>
                  <input
                    aria-label="Project name"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      const name = nameDraft.trim() || "Untitled setup";
                      if (name !== project.name)
                        commit((p) => ({ ...p, name }));
                      else setNameDraft(name);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <span>
                    DIAGRAM <span className="toolbar-dot">·</span>{" "}
                    {project.devices.length} devices{" "}
                    <span className="toolbar-dot">·</span>{" "}
                    {project.cables.length} cables
                  </span>
                </div>
              </div>
              <div className="canvas-actions">
                <button
                  className="secondary-button canvas-export-button"
                  onClick={exportPng}
                  disabled={exportingPng || !ready || !project.devices.length || edges.length !== project.cables.length}
                  title={project.devices.length ? "Download the whole diagram as a PNG" : "Add a device to export a PNG"}
                  aria-label="Export diagram as PNG"
                  aria-busy={exportingPng}
                >
                  <ImageDown size={15} />
                  <span>{exportingPng ? "Exporting…" : "Export PNG"}</span>
                </button>
                <button
                  className="icon-button"
                  onClick={undo}
                  disabled={!history.past.length}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className="icon-button"
                  onClick={redo}
                  disabled={!history.future.length}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 size={17} />
                </button>
                <span className="action-divider" />
                <button
                  className="icon-button"
                  onClick={fit}
                  title="Fit diagram to view"
                >
                  <Maximize size={16} />
                </button>
                <button
                  className="icon-button"
                  title="New empty diagram (undoable)"
                  onClick={() => {
                    setRestoreFailed(false);
                    commit((p) => ({
                      ...emptyProject(),
                      templates: p.templates,
                      portTemplates: p.portTemplates,
                    }));
                    setSelection(null);
                  }}
                >
                  <FolderPlus size={17} />
                </button>
              </div>
            </div>
            <div className="canvas-container" ref={canvasRef}>
              <div className="canvas-caption">
                <span className="tiny-dot" />
                {project.devices.length
                  ? "LIVE SIGNAL ROUTING"
                  : "YOUR CONNECTION WORKSPACE"}
              </div>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                colorMode="dark"
                minZoom={0.2}
                maxZoom={1.8}
                onConnect={connect}
                isValidConnection={(c) =>
                  !connectionError(
                    project,
                    c.source,
                    c.sourceHandle ?? "",
                    c.target,
                    c.targetHandle ?? "",
                  )
                }
                onConnectStart={(_, params) => {
                  setConnectionMenu(null);
                  connectionOrigin.current =
                    params.nodeId && params.handleId
                      ? { deviceId: params.nodeId, portId: params.handleId }
                      : null;
                }}
                onConnectEnd={endConnection}
                onNodeClick={(_, node) =>
                  setSelection({ type: "device", id: node.id })
                }
                onEdgeClick={(_, edge) =>
                  setSelection({ type: "cable", id: edge.id })
                }
                onPaneClick={() => {
                  setSelection(null);
                }}
                onNodesChange={(changes) => {
                  const dimensions = changes.filter(
                    (c) => c.type === "dimensions" && c.dimensions,
                  );
                  if (dimensions.length)
                    setMeasurements((prev) => {
                      const next = { ...prev };
                      let changed = false;
                      for (const c of dimensions)
                        if (
                          c.type === "dimensions" &&
                          c.dimensions &&
                          (next[c.id]?.width !== c.dimensions.width ||
                            next[c.id]?.height !== c.dimensions.height)
                        ) {
                          next[c.id] = c.dimensions;
                          changed = true;
                        }
                      return changed ? next : prev;
                    });
                  const updates = changes.filter(
                    (c) => c.type === "position" && c.position,
                  );
                  if (updates.length)
                    setPositions((prev) => {
                      const next = { ...prev };
                      for (const c of updates)
                        if (c.type === "position" && c.position)
                          next[c.id] = c.position;
                      return next;
                    });
                }}
                onNodeDragStop={(_, node) => {
                  commit((p) => ({
                    ...p,
                    devices: p.devices.map((d) =>
                      d.id === node.id ? { ...d, position: node.position } : d,
                    ),
                  }));
                  setPositions({});
                }}
                onMoveEnd={(_, viewport) =>
                  setHistory((h) => ({
                    ...h,
                    present: { ...h.present, viewport },
                  }))
                }
                defaultViewport={project.viewport}
                deleteKeyCode={null}
                nodesConnectable
                nodesFocusable
                edgesFocusable
                selectionKeyCode="Shift"
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={24}
                  size={1}
                  color="#30353d"
                />
                <Controls showInteractive={false} position="bottom-left" />
                {project.devices.length > 3 && (
                  <MiniMap
                    position="top-right"
                    style={{ width: 105, height: 65 }}
                    nodeColor="#526c65"
                    maskColor="rgba(14,17,22,.8)"
                    pannable
                    zoomable
                  />
                )}
              </ReactFlow>
              {!project.devices.length && (
                <div className="empty-canvas">
                  <div className="empty-diagram">
                    <div className="empty-mini-device first">
                      <DeviceIcon kind="computer" size={26} />
                      <span>Source</span>
                      <i />
                    </div>
                    <div className="empty-wire">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="empty-mini-device last">
                      <DeviceIcon kind="monitor" size={29} />
                      <span>Display</span>
                      <i />
                    </div>
                  </div>
                  <div className="eyebrow">LESS GUESSWORK. MORE CLARITY.</div>
                  <h1>
                    Your setup,
                    <br />
                    <em>connected.</em>
                  </h1>
                  <p>
                    Map your devices. Follow the signal.
                    <br />
                    Find out what’s possible before you plug it in.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => add("computer")}
                  >
                    <Plus size={16} />
                    Add your first device
                  </button>
                  <button className="empty-example" onClick={loadExample}>
                    Or explore an example <ChevronRight size={14} />
                  </button>
                  <div className="empty-hint">
                    <MousePointer2 size={13} />
                    Click any device in the library to add it
                  </div>
                </div>
              )}
              {project.devices.length > 0 && (
                <div className="canvas-legend">
                  {(
                    [
                      "supported",
                      "uncertain",
                      "incompatible",
                      "inactive",
                    ] as Status[]
                  ).map((s) => (
                    <span key={s} className={s}>
                      <i />
                      {s === "supported"
                        ? "Supported"
                        : s === "uncertain"
                          ? "Verify"
                          : s === "incompatible"
                            ? "Blocked"
                            : "Inactive"}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <section
              className={`signal-monitor ${monitorOpen ? "expanded" : ""}`}
            >
              <button
                className="monitor-heading"
                onClick={() => setMonitorOpen((v) => !v)}
              >
                <Activity size={15} />
                <strong>SIGNAL MONITOR</strong>
                <span className="monitor-count">{result.displays.length}</span>
                <span className="monitor-live">
                  <span className="tiny-dot" />
                  Simulation active
                </span>
                <ChevronDown
                  size={15}
                  className={!monitorOpen ? "rotated" : ""}
                />
              </button>
              {monitorOpen && (
                <div className="monitor-content">
                  {!result.displays.length ? (
                    <div className="monitor-empty">
                      <DeviceIcon kind="monitor" size={22} />
                      <div>
                        <strong>Your displays will appear here</strong>
                        <span>
                          Add a monitor or projector to see its incoming signal
                          and compatibility.
                        </span>
                      </div>
                      <span className="monitor-idle">WAITING FOR DISPLAY</span>
                    </div>
                  ) : (
                    result.displays.map((r) => {
                      const d = project.devices.find(
                        (d) => d.id === r.deviceId,
                      )!;
                      return (
                        <button
                          className={`monitor-tile ${r.status}`}
                          key={r.deviceId}
                          onClick={() => focusComponent(d.id)}
                        >
                          <div className="monitor-tile-title">
                            <DeviceIcon kind={d.kind} size={16} />
                            <strong>{d.name}</strong>
                            <ArrowUpRight size={13} />
                          </div>
                          <div className="monitor-mode">
                            {r.signal
                              ? modeLabel(r.signal)
                              : "No incoming signal"}
                          </div>
                          <div className="monitor-tile-status">
                            <StatusIcon status={r.status} />
                            {r.status === "supported"
                              ? "Supported by entered specs"
                              : statusLabels[r.status]}
                            {r.findings.length > 0 && (
                              <span>{r.findings.length}</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </section>
          </section>
          <Inspector
            project={project}
            result={result}
            selection={selection}
            select={setSelection}
            updateDevice={updateDevice}
            updateCable={updateCable}
            deleteSelection={deleteSelection}
            duplicate={duplicate}
            notify={notify}
            savePortTemplate={(t) =>
              commit((p) => ({ ...p, portTemplates: [...p.portTemplates, t] }))
            }
            gpuLayout={(presetId) => {
              const preset = gpuPresets.find((g) => g.id === presetId);
              if (selection?.type !== "device" || !preset) return;
              try {
                const change = replaceGpuOutputs(project, selection.id, preset);
                commit(() => change.project);
                notify(
                  `Applied ${preset.name}${change.disconnected ? `; disconnected ${change.disconnected} extra cable(s)` : ""}.`,
                );
              } catch (e) {
                notify(
                  e instanceof Error
                    ? e.message
                    : "Could not apply GPU layout.",
                  true,
                );
              }
            }}
            saveTemplate={(d) => {
              const next = cloneDevice(d, { x: 0, y: 0 });
              commit((p) => ({ ...p, templates: [...p.templates, next] }));
              notify(`“${d.name}” saved as an independent template.`);
            }}
            deletePort={(d, port) => {
              commit((p) =>
                p.templates.some((t) => t.id === d.id)
                  ? {
                      ...p,
                      templates: p.templates.map((t) =>
                        t.id !== d.id
                          ? t
                          : {
                              ...t,
                              ports: t.ports.filter((v) => v.id !== port.id),
                              selectedInput:
                                t.selectedInput === port.id
                                  ? (t.ports.find(
                                      (v) =>
                                        v.direction === "in" &&
                                        v.id !== port.id,
                                    )?.id ?? null)
                                  : t.selectedInput,
                            },
                      ),
                    }
                  : removePort(p, d.id, port.id),
              );
              setSelection({
                type: "device",
                id: d.id,
                ...(selection?.type === "device" && selection.template
                  ? { template: true }
                  : {}),
              });
            }}
            focusComponent={focusComponent}
          />
        </main>
        <footer className="status-bar">
          <span className={saveState.includes("failed") ? "save-error" : ""}>
            <span className="tiny-dot" />
            {saveState}
          </span>
          <span className="status-shortcuts">
            <kbd>Scroll</kbd> zoom <span>·</span>
            <kbd>Del</kbd> remove <span>·</span>
            <kbd>Ctrl Z</kbd> undo
          </span>
          <div>
            <span>
              {active} active {active === 1 ? "display" : "displays"}
            </span>
            <span className={errors ? "error-text" : ""}>
              {errors ? `${errors} issues` : `${supported} supported`}
            </span>
            <span className="version">v1.0</span>
          </div>
        </footer>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              if (f.size > 10_000_000)
                throw new Error("Project is too large (10 MB maximum).");
              const imported = parseProject(await f.text());
              setRestoreFailed(false);
              commit(() => imported);
              setSelection(null);
              flow.setViewport(imported.viewport);
              notify(
                "Project imported. Your previous diagram is available with Undo.",
              );
            } catch (error) {
              notify(
                error instanceof Error ? error.message : "Import failed.",
                true,
              );
            }
          }}
        />
        {toast && (
          <div role="status" className={`toast ${toast.error ? "error" : ""}`}>
            <StatusIcon status={toast.error ? "incompatible" : "supported"} />
            <span>{toast.text}</span>
            <button
              className="icon-button"
              onClick={() => setToast(null)}
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {showHelp && (
          <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
            <div
              className="help-modal"
              role="dialog"
              aria-modal="true"
              aria-label="How Signalpath works"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key !== "Tab") return;
                const controls =
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button, a[href]",
                  );
                const first = controls[0],
                  last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }}
            >
              <button
                className="modal-close icon-button"
                onClick={() => setShowHelp(false)}
                title="Close help"
                autoFocus
              >
                <X size={18} />
              </button>
              <div className="brand-mark">
                <Activity size={24} />
              </div>
              <h2>Follow the signal.</h2>
              <p>
                Add devices, then drag from a port on the right (output) to a
                port on the left (input). Use a port’s settings icon to enter
                capabilities or configure a source signal.
              </p>
              <p>
                Use channel selectors to change routes. Splitters mirror a
                single mode; dock outputs carry independent streams over a
                shared upstream budget.
              </p>
              <p>
                Unknown specifications produce “Needs verification.” The app
                models entered specifications, not hardware handshakes, cable
                signal loss, EDID or HDCP.
              </p>
              <div className="help-shortcuts">
                <span>Undo / redo</span>
                <kbd>Ctrl Z / Ctrl Shift Z</kbd>
                <span>Duplicate device</span>
                <kbd>Ctrl D</kbd>
                <span>Delete selection</span>
                <kbd>Delete</kbd>
                <span>Clear selection / close</span>
                <kbd>Esc</kbd>
              </div>
              <p className="small muted">
                Autosave belongs to this browser and local server address.
                Export a JSON project to back it up or move it to another
                browser.
              </p>
              <a
                href="https://www.hdmi.org/download/savefile?fileKey=Marketing%2Fformat-data-rate-tables-2021.pdf"
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                HDMI format / link-rate reference <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        )}
        {connectionMenu && (
          <ConnectionMenu
            menu={connectionMenu}
            project={project}
            library={deviceLibrary}
            close={() => setConnectionMenu(null)}
            choose={chooseConnection}
          />
        )}
        {!ready && (
          <div className="loading-overlay">
            <Activity size={28} />
            <span>Opening your workspace…</span>
          </div>
        )}
      </div>
    </EditorContext.Provider>
  );
}
export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
