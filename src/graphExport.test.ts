import { describe, expect, it } from "vitest";
import { diagramPngFilename, graphImageLayout, type GraphRect } from "./graphExport";

function expectEntireGraphInside(rects: GraphRect[]) {
  const layout = graphImageLayout(rects);
  for (const r of rects) {
    expect(r.x * layout.scale + layout.x).toBeGreaterThanOrEqual(0);
    expect(r.y * layout.scale + layout.y).toBeGreaterThanOrEqual(0);
    expect((r.x + r.width) * layout.scale + layout.x).toBeLessThanOrEqual(layout.width);
    expect((r.y + r.height) * layout.scale + layout.y).toBeLessThanOrEqual(layout.height);
  }
  return layout;
}

describe("whole-graph PNG framing", () => {
  it("includes negative positions, disconnected offscreen devices and cable labels beyond node bounds", () => {
    const rectangles = [
      { x: -500, y: -320, width: 280, height: 240 },
      { x: 1000, y: 500, width: 280, height: 460 },
      { x: -700, y: -370, width: 220, height: 28 },
    ];
    const before = structuredClone(rectangles);
    const layout = expectEntireGraphInside(rectangles);
    expect(layout.scale).toBe(2);
    expect(layout.reduced).toBe(false);
    expect(layout.width).toBe((1280 + 700 + 112) * 2);
    expect(rectangles).toEqual(before);
  });

  it("uses a crisp 2x image for a single device, independent of screen DPI", () => {
    const layout = graphImageLayout([{ x: 80, y: 80, width: 280, height: 240 }]);
    expect(layout).toMatchObject({ width: 784, height: 704, scale: 2, reduced: false });
    expect(80 * layout.scale + layout.x).toBe(112);
    expect(graphImageLayout([{ x: 80, y: 80, width: 280.25, height: 240.25 }]).reduced).toBe(false);
  });

  it("scales large, wide and tall graphs to browser-safe sizes without cropping", () => {
    for (const [width, height] of [[9000, 9000], [30000, 500], [500, 30000], [20000, 10000]]) {
      const layout = expectEntireGraphInside([{ x: -5000, y: -3000, width, height }]);
      expect(layout.width).toBeLessThanOrEqual(8192);
      expect(layout.height).toBeLessThanOrEqual(8192);
      expect(layout.width * layout.height).toBeLessThanOrEqual(16_000_000);
      expect(layout.reduced).toBe(true);
    }
  });

  it("rejects empty or invalid geometry rather than producing a blank download", () => {
    expect(() => graphImageLayout([])).toThrow("Add a device");
    for (const r of [
      { x: NaN, y: 0, width: 280, height: 240 },
      { x: 0, y: Infinity, width: 280, height: 240 },
      { x: 0, y: 0, width: -1, height: 240 },
      { x: 1e308, y: 0, width: 1.7e308, height: 240 },
    ]) expect(() => graphImageLayout([r])).toThrow();
  });

  it("creates PNG filenames from the project name without path characters", () => {
    expect(diagramPngFilename("My desk setup")).toBe("My desk setup.png");
    expect(diagramPngFilename('Desk: PC/TV\\Projector?*<>|"')).toBe("Desk PCTVProjector.png");
    expect(diagramPngFilename("  ... ")).toBe("display-setup.png");
    expect(diagramPngFilename("Gaming setup... ")).toBe("Gaming setup.png");
    expect(diagramPngFilename("a".repeat(300)).length).toBeLessThanOrEqual(154);
  });
});
