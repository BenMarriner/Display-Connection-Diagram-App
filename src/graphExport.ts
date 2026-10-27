export type GraphRect = { x: number; y: number; width: number; height: number };

const PADDING = 56;
const MAX_SIDE = 8192;
const MAX_PIXELS = 16_000_000;

/** Work in graph coordinates, independent of the user's viewport and screen DPI. */
export function graphImageLayout(rectangles: GraphRect[]) {
  if (!rectangles.length) throw new Error("Add a device before exporting a PNG.");
  if (rectangles.some((r) => !Object.values(r).every(Number.isFinite) || r.width < 0 || r.height < 0))
    throw new Error("The diagram has invalid bounds. Check the device positions.");
  const left = Math.min(...rectangles.map((r) => r.x));
  const top = Math.min(...rectangles.map((r) => r.y));
  const right = Math.max(...rectangles.map((r) => r.x + r.width));
  const bottom = Math.max(...rectangles.map((r) => r.y + r.height));
  const naturalWidth = right - left + PADDING * 2;
  const naturalHeight = bottom - top + PADDING * 2;
  const requestedScale = Math.min(2, MAX_SIDE / naturalWidth, MAX_SIDE / naturalHeight,
    Math.sqrt(MAX_PIXELS / naturalWidth / naturalHeight));
  const width = Math.max(1, Math.floor(naturalWidth * requestedScale));
  const height = Math.max(1, Math.floor(naturalHeight * requestedScale));
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error("The diagram is too spread out to export. Move the devices closer together.");
  return {
    width, height, scale,
    x: (PADDING - left) * scale,
    y: (PADDING - top) * scale,
    reduced: requestedScale < 1.999,
  };
}

export function diagramPngFilename(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().replace(/[. ]+$/, "").slice(0, 150);
  return `${safe || "display-setup"}.png`;
}

/** Framing styles apply only to html-to-image's clone, leaving the live graph untouched. */
export async function renderGraphPng(
  canvas: HTMLElement,
  expected: { nodes: number; edges: number },
) {
  const { toBlob } = await import("html-to-image");
  await document.fonts.ready;
  const viewport = canvas.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport || !expected.nodes) throw new Error("Add a device before exporting a PNG.");
  const nodes = viewport.querySelectorAll<HTMLElement>(".react-flow__node");
  const paths = viewport.querySelectorAll<SVGPathElement>(".react-flow__edge-path");
  if (nodes.length !== expected.nodes || paths.length !== expected.edges ||
      [...nodes].some((node) => !node.offsetWidth || !node.offsetHeight))
    throw new Error("The diagram is still updating. Try exporting again in a moment.");

  const origin = viewport.getBoundingClientRect();
  const zoom = origin.width / viewport.offsetWidth;
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error("The diagram is not visible yet.");
  const rectangles = [...viewport.querySelectorAll<HTMLElement | SVGElement>(
    ".react-flow__node, .react-flow__edge-path, .cable-label",
  )].map((element) => {
    const box = element.getBoundingClientRect();
    return { x: (box.left - origin.left) / zoom, y: (box.top - origin.top) / zoom,
      width: box.width / zoom, height: box.height / zoom };
  });
  const layout = graphImageLayout(rectangles);
  const blob = await toBlob(viewport, {
    width: layout.width, height: layout.height, pixelRatio: 1,
    backgroundColor: "#11151b", preferredFontFormat: "woff2",
    style: {
      position: "relative", left: "0", top: "0", margin: "0",
      transform: `translate(${layout.x}px, ${layout.y}px) scale(${layout.scale})`,
      transformOrigin: "0 0",
    },
  });
  if (!blob || !blob.size) throw new Error("The browser could not render this diagram as a PNG.");
  return { blob, ...layout };
}

export function downloadDiagramPng(blob: Blob, projectName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = diagramPngFilename(projectName);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
