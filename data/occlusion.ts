export type OcclusionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function toAbsoluteRect(rect: OcclusionRect, width: number, height: number) {
  return {
    left: rect.x * width,
    top: rect.y * height,
    width: rect.width * width,
    height: rect.height * height,
  };
}

export function pickRandomOcclusion(rects: OcclusionRect[], seed = Math.random()): OcclusionRect | null {
  if (!rects.length) return null;
  const idx = Math.floor(Math.abs(seed % 1) * rects.length);
  return rects[idx] ?? rects[0];
}

export function createOcclusionAtPoint(x: number, y: number, width: number, height: number): OcclusionRect {
  const defaultW = 0.2;
  const defaultH = 0.14;
  return {
    x: clamp01(x / width - defaultW / 2),
    y: clamp01(y / height - defaultH / 2),
    width: defaultW,
    height: defaultH,
  };
}
