import { connectionError, type Device, type Port, type Project } from "./model";
import { makeDevice, kindLabels, cloneDevice, makeCable } from "./devices";
import { gpuPresets, makeGpuDevice } from "./gpuPresets";
import { dockPresets, dockPresetSearchText, makeDockDevice } from "./dockPresets";
import {
  consolePresets,
  consolePresetSearchText,
  makeConsoleDevice,
} from "./consolePresets";

export type ConnectionOrigin = { deviceId: string; portId: string };
export type LibraryItem = {
  key: string;
  label: string;
  device: Device;
  group: string;
  keywords?: string;
};
export type ConnectionChoice = {
  key: string;
  device: Device;
  port: Port;
  label: string;
  group: string;
  create: boolean;
  keywords?: string;
};
export function orientConnection(
  origin: ConnectionOrigin,
  originPort: Port,
  deviceId: string,
  portId: string,
) {
  return originPort.direction === "out"
    ? {
        source: origin.deviceId,
        sourceHandle: origin.portId,
        target: deviceId,
        targetHandle: portId,
      }
    : {
        source: deviceId,
        sourceHandle: portId,
        target: origin.deviceId,
        targetHandle: origin.portId,
      };
}
export function connectionLibrary(templates: Device[]): LibraryItem[] {
  const generic = (Object.keys(kindLabels) as Device["kind"][]).map((kind) => ({
    key: kind,
    label: kindLabels[kind],
    group: "Add a device",
    device: makeDevice(kind),
  }));
  const reverse = makeDevice("adapter");
  reverse.name = "HDMI → DisplayPort adapter";
  reverse.ports[0].connector = "HDMI";
  reverse.ports[0].protocol = "HDMI";
  reverse.ports[0].name = "HDMI input";
  reverse.ports[1].connector = "DisplayPort";
  reverse.ports[1].protocol = "DisplayPort";
  reverse.ports[1].name = "DP output";
  return [
    ...generic,
    {
      key: "hdmi-dp-adapter",
      label: reverse.name,
      group: "Add a device",
      device: reverse,
    },
    ...templates.map((t) => ({
      key: t.id,
      label: t.name,
      group: "Your device templates",
      device: t,
    })),
    ...dockPresets.map((p) => ({
      key: p.id,
      label: p.name,
      group: "Dock templates",
      keywords: dockPresetSearchText(p),
      device: makeDockDevice(p),
    })),
    ...consolePresets.map((p) => ({
      key: p.id,
      label: p.name,
      group: "Console templates",
      keywords: consolePresetSearchText(p),
      device: makeConsoleDevice(p),
    })),
    ...gpuPresets.map((p) => ({
      key: p.id,
      label: p.name,
      group: "GPU computers",
      device: makeGpuDevice(p),
    })),
  ];
}
export function compatibleChoices(
  project: Project,
  origin: ConnectionOrigin,
  library: LibraryItem[],
): ConnectionChoice[] {
  const originDevice = project.devices.find((d) => d.id === origin.deviceId);
  const port = originDevice?.ports.find((p) => p.id === origin.portId);
  if (
    !port ||
    project.cables.some(
      (c) => c.sourcePort === port.id || c.targetPort === port.id,
    )
  )
    return [];
  const items: Array<LibraryItem & { create: boolean }> = [
    ...project.devices.map((d) => ({
      key: d.id,
      label: d.name,
      group: "On your diagram",
      device: d,
      create: false,
    })),
    ...library.map((l) => ({ ...l, create: true })),
  ];
  const result: ConnectionChoice[] = [];
  for (const item of items) {
    const p = item.create
      ? { ...project, devices: [...project.devices, item.device] }
      : project;
    for (const candidate of item.device.ports) {
      const c = orientConnection(origin, port, item.device.id, candidate.id);
      if (
        !connectionError(p, c.source, c.sourceHandle, c.target, c.targetHandle)
      )
        result.push({
          key: `${item.key}:${candidate.id}`,
          device: item.device,
          port: candidate,
          label: item.label,
          group: item.group,
          keywords: item.keywords,
          create: item.create,
        });
    }
  }
  return result;
}

/** Materialize a menu choice in one edit, so Undo removes the new node and cable together. */
export function materializeConnection(
  project: Project,
  origin: ConnectionOrigin,
  choice: ConnectionChoice,
  position: { x: number; y: number },
) {
  const sourcePort = project.devices
    .find((d) => d.id === origin.deviceId)
    ?.ports.find((p) => p.id === origin.portId);
  if (!sourcePort) throw new Error("The starting port no longer exists.");
  let device = choice.device,
    port = choice.port,
    next = project;
  if (choice.create) {
    if (project.devices.length >= 500)
      throw new Error("This diagram already has 500 devices.");
    const index = device.ports.findIndex((p) => p.id === port.id);
    device = cloneDevice(device, {
      x: position.x + (sourcePort.direction === "out" ? 20 : -280),
      y: position.y - 70,
    });
    port = device.ports[index];
    if (!port) throw new Error("That library port no longer exists.");
    if (port.direction === "in") device.selectedInput = port.id;
    next = { ...project, devices: [...project.devices, device] };
  }
  const c = orientConnection(origin, sourcePort, device.id, port.id);
  const error = connectionError(
    next,
    c.source,
    c.sourceHandle,
    c.target,
    c.targetHandle,
  );
  if (error) throw new Error(error);
  const a = next.devices.find((d) => d.id === c.source)!,
    b = next.devices.find((d) => d.id === c.target)!;
  const cable = makeCable(
    a,
    a.ports.findIndex((p) => p.id === c.sourceHandle),
    b,
    b.ports.findIndex((p) => p.id === c.targetHandle),
  );
  return {
    project: { ...next, cables: [...next.cables, cable] },
    cable,
    device,
    port,
  };
}
