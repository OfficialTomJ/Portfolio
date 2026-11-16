export interface ChartCoordinate { x: number; y: number }

interface ChartSegment {
  start: ChartCoordinate;
  end: ChartCoordinate;
  controls?: [ChartCoordinate, ChartCoordinate];
}

/** Shape-preserving cubic interpolation: passes through every point without introducing extrema. */
function smoothChartSegments(points: ChartCoordinate[]): ChartSegment[] {
  const segments: ChartSegment[] = [];
  let start = 0;
  while (start < points.length - 1) {
    let end = start + 1;
    while (end < points.length && points[end].x > points[end - 1].x) end++;
    const run = points.slice(start, end);
    if (run.length > 1) {
      const h = run.slice(1).map((p, i) => p.x - run[i].x);
      const slope = run.slice(1).map((p, i) => (p.y - run[i].y) / h[i]);
      const tangent = run.map((_, i) => {
        if (!i) return slope[0];
        if (i === run.length - 1) return slope.at(-1)!;
        const a = slope[i - 1], b = slope[i];
        if (a * b <= 0) return 0;
        // Weighted harmonic mean for irregularly spaced timestamps.
        const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
        return (w1 + w2) / (w1 / a + w2 / b);
      });
      for (let i = 0; i < slope.length; i++) {
        if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue; }
        const a = tangent[i] / slope[i], b = tangent[i + 1] / slope[i], norm = Math.hypot(a, b);
        if (norm > 3) { const scale = 3 / norm; tangent[i] = scale * a * slope[i]; tangent[i + 1] = scale * b * slope[i]; }
      }
      for (let i = 0; i < run.length - 1; i++) {
        const a = run[i], b = run[i + 1], dx = h[i] / 3;
        segments.push({ start: a, end: b, controls: [{ x: a.x + dx, y: a.y + tangent[i] * dx }, { x: b.x - dx, y: b.y - tangent[i + 1] * dx }] });
      }
    }
    if (end < points.length) segments.push({ start: points[end - 1], end: points[end] });
    start = end;
  }
  return segments;
}

const coordinate = (p: ChartCoordinate) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const segmentCommand = (segment: ChartSegment) => segment.controls
  ? ` C${coordinate(segment.controls[0])} ${coordinate(segment.controls[1])} ${coordinate(segment.end)}`
  : ` L${coordinate(segment.end)}`;

export function smoothChartPath(points: ChartCoordinate[]): string {
  if (!points.length) return "";
  return `M${coordinate(points[0])}${smoothChartSegments(points).map(segmentCommand).join("")}`;
}

const interpolate = (a: ChartCoordinate, b: ChartCoordinate, t: number): ChartCoordinate => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** De Casteljau subdivision retains the original curve and tangents at colour crossings. */
function splitSegment(segment: ChartSegment, t: number): [ChartSegment, ChartSegment] {
  if (!segment.controls) {
    const middle = interpolate(segment.start, segment.end, t);
    return [{ start: segment.start, end: middle }, { start: middle, end: segment.end }];
  }
  const a = interpolate(segment.start, segment.controls[0], t);
  const b = interpolate(segment.controls[0], segment.controls[1], t);
  const c = interpolate(segment.controls[1], segment.end, t);
  const d = interpolate(a, b, t), e = interpolate(b, c, t), middle = interpolate(d, e, t);
  return [{ start: segment.start, controls: [a, d], end: middle }, { start: middle, controls: [e, c], end: segment.end }];
}

/** Colour whole strokes by the curve's value, including flat runs exactly on the baseline. */
export function splitChartPathAtY(points: ChartCoordinate[], baseline: number) {
  const result = { above: "", below: "" };
  let previousSide: keyof typeof result | undefined;
  for (const segment of smoothChartSegments(points)) {
    let pieces = [segment];
    if ((segment.start.y < baseline && segment.end.y > baseline) || (segment.start.y > baseline && segment.end.y < baseline)) {
      let low = 0, high = 1;
      for (let i = 0; i < 48; i++) {
        const t = (low + high) / 2, middle = splitSegment(segment, t)[0].end;
        if ((middle.y < baseline) === (segment.start.y < baseline)) low = t; else high = t;
      }
      pieces = splitSegment(segment, (low + high) / 2);
    }
    for (const piece of pieces) {
      const side = splitSegment(piece, .5)[0].end.y <= baseline ? "above" : "below";
      result[side] += `${side === previousSide ? "" : `M${coordinate(piece.start)}`}${segmentCommand(piece)}`;
      previousSide = side;
    }
  }
  return result;
}

/** Axis ticks follow elapsed time, with enough screen space for each date label. */
export function chartDateTicks(start: number, end: number, width: number) {
  const count = Math.max(2, Math.min(6, Math.floor(width / 130) + 1));
  return Array.from({ length: count }, (_, i) => ({ time: start + (end - start) * i / (count - 1), fraction: i / (count - 1) }));
}
