import assert from "node:assert/strict";
import test from "node:test";
import { parseBinanceCandles, parseBybitCandles } from "./market-response";

test("Bybit linear candles are validated and sorted oldest first", () => {
  const candles = parseBybitCandles({
    retCode: 0,
    result: {
      category: "linear",
      symbol: "HYPEUSDT",
      list: [
        ["1790244000000", "90.46", "90.60", "89.77", "90.04"],
        ["1790240400000", "90.95", "91.10", "90.20", "90.46"],
      ],
    },
  }, "HYPEUSDT");

  assert.deepEqual(candles, [
    { time: 1790240400, open: 90.95, high: 91.1, low: 90.2, close: 90.46 },
    { time: 1790244000, open: 90.46, high: 90.6, low: 89.77, close: 90.04 },
  ]);
});

test("an empty Binance page is distinguishable from an invalid response", () => {
  assert.deepEqual(parseBinanceCandles([]), []);
  assert.throws(() => parseBinanceCandles({ code: -1121, msg: "Invalid symbol" }));
});

test("Bybit rejects the wrong market and malformed candles", () => {
  const response = {
    retCode: 0,
    result: {
      category: "linear",
      symbol: "HYPEUSDT",
      list: [["1790244000000", "90.46", "90.60", "89.77", "90.04"]],
    },
  };
  assert.throws(() => parseBybitCandles(response, "SOLUSDT"), /requested linear market/);
  assert.throws(() => parseBybitCandles({ ...response, retCode: 10001 }, "HYPEUSDT"));
  assert.throws(() => parseBybitCandles({
    ...response,
    result: { ...response.result, list: [["1790244000000", "90.46", "0", "89.77", "90.04"]] },
  }, "HYPEUSDT"), /Invalid market candle values/);
});
