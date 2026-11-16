import test from "node:test";
import assert from "node:assert/strict";
import { chartDateTicks, smoothChartPath, splitChartPathAtY } from "./chart-geometry";

test("smoothing preserves the data endpoints and stays within each segment's extrema", () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 5 }, { x: 2, y: 1 }, { x: 20, y: 2 }, { x: 21, y: 2 }];
  const path = smoothChartPath(points);
  assert.ok(path.startsWith("M0.000,0.000")); assert.ok(path.endsWith("21.000,2.000"));
  const segments = [...path.matchAll(/C([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)/g)];
  assert.equal(segments.length, points.length - 1);
  for (let i = 0; i < segments.length; i++) {
    const values = segments[i].slice(1).map(Number), a = points[i], b = points[i + 1];
    for (let n = 0; n <= 100; n++) {
      const t = n / 100, u = 1 - t;
      const y = u ** 3 * a.y + 3 * u ** 2 * t * values[1] + 3 * u * t ** 2 * values[3] + t ** 3 * b.y;
      assert.ok(y >= Math.min(a.y, b.y) - .001 && y <= Math.max(a.y, b.y) + .001);
    }
  }
});
test("same-timestamp changes remain vertical without invalid curve coordinates", () => {
  const path = smoothChartPath([{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 3 }]);
  assert.ok(path.includes("L0.000,2.000")); assert.ok(!/NaN|Infinity/.test(path));
});
test("date ticks remain evenly spaced even when trade timestamps are clustered", () => {
  const ticks = chartDateTicks(0, 1000, 1000), gaps = ticks.slice(1).map((t, i) => t.time - ticks[i].time);
  assert.ok(gaps.every(g => Math.abs(g - gaps[0]) < 1e-9));
  assert.equal(chartDateTicks(0, 1000, 220).length, 2);
});

test("flat zero-return runs use one whole stroke instead of two clipped half-strokes", () => {
  const flat = [{ x: 0, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 10 }];
  const paths = splitChartPathAtY(flat, 10);
  assert.equal(paths.above, smoothChartPath(flat));
  assert.equal(paths.below, "");
  const falling = splitChartPathAtY([...flat, { x: 3, y: 12 }], 10);
  assert.equal(falling.above, smoothChartPath(flat));
  assert.ok(falling.below.startsWith("M2.000,10.000"));
});

test("colour crossings divide smooth curves at the baseline and retain their data endpoints", () => {
  const paths = splitChartPathAtY([{ x: 0, y: 5 }, { x: 10, y: 15 }, { x: 20, y: 5 }], 10);
  for (const [side, path] of Object.entries(paths)) {
    const commands = [...path.matchAll(/([MC])([\d., -]+)/g)];
    let previous = { x: 0, y: 0 };
    for (const command of commands) {
      const values = command[2].trim().split(/[ ,]+/).map(Number);
      if (command[1] === "M") { previous = { x: values[0], y: values[1] }; continue; }
      for (let n = 0; n <= 100; n++) {
        const t = n / 100, u = 1 - t;
        const value = u ** 3 * previous.y + 3 * u ** 2 * t * values[1] + 3 * u * t ** 2 * values[3] + t ** 3 * values[5];
        assert.ok(side === "above" ? value <= 10.001 : value >= 9.999);
      }
      previous = { x: values[4], y: values[5] };
    }
  }
  assert.ok(paths.above.startsWith("M0.000,5.000"));
  assert.ok(paths.above.endsWith("20.000,5.000"));
  assert.equal((paths.below.match(/M/g) ?? []).length, 1);
});

test("same-timestamp baseline crossings keep a continuous vertical path", () => {
  const paths = splitChartPathAtY([{ x: 1, y: 5 }, { x: 1, y: 15 }], 10);
  assert.equal(paths.above, "M1.000,5.000 L1.000,10.000");
  assert.equal(paths.below, "M1.000,10.000 L1.000,15.000");
});
