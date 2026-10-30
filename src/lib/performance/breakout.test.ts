import assert from "node:assert/strict";
import { test } from "node:test";
import { BREAKOUT_HEADERS, BreakoutInputError, activeBreakoutHistoryFrom, breakoutConflicts, parseBreakoutCsv, isLegacyHistory, type BreakoutAccount } from "./breakout";
import { readBoundedBody, readBreakoutUpload } from "./import-request";
import { rejectBybitAccountAccess } from "./source-policy";
import { planBreakoutImport } from "./breakout-preview";

const base = ["BTC/USD", "long", "0.5", "100", "110", "2025-01-01T00:00:00.123456789+00:00", "2025-01-01T01:00:00.987654321+00:00", "5.00000", "0.10000", "4.90000"];
const csv = (rows: string[][] = [base], headers: readonly string[] = BREAKOUT_HEADERS) => new TextEncoder().encode([headers.join(","), ...rows.map(row => row.join(","))].join("\n"));

test("exact decimal reconciliation, full nanosecond identity, net P&L once and base R", () => {
  const result = parseBreakoutCsv(csv());
  assert.equal(result.rows[0].trade.resultR, 0.0049);
  assert.equal(result.rows[0].values.entry_time, "2025-01-01T00:00:00.123456789Z");
  assert.equal(result.rows[0].trade.openedAt, "2025-01-01T00:00:00.123Z");
  assert.equal(result.rows[0].original.fees, "0.10000");
  assert.equal(result.rows[0].trade.source, "breakout");
});
test("BOM, CRLF, quoted fields, reordered columns and decimal/zone formatting preserve identity", () => {
  const a = parseBreakoutCsv(csv());
  const row = [...base]; row[2] = "0.50000000"; row[5] = "2025-01-01T01:00:00.123456789+01:00";
  const text = "\ufeff" + [[...BREAKOUT_HEADERS].reverse(), [...row].reverse()].map(fields => fields.map(value => `"${value}"`).join(",")).join("\r\n");
  assert.equal(parseBreakoutCsv(new TextEncoder().encode(text)).rows[0].key, a.rows[0].key);
});
test("rejects entire incompatible or damaged file, including a bad final row", () => {
  for (const [index, value] of [[0,"BTC/USDT"],[1,"buy"],[2,"0"],[3,"NaN"],[4,"Infinity"],[5,"2025-02-30T00:00:00Z"],[5,"2025-01-01T00:00:00"],[6,"2024-01-01T00:00:00Z"],[7,"6"],[8,"-1"],[9,"4.8"],[2,"=1+1"],[5,"2025-01-01T00:00:00+14:30"]] as [number,string][]) {
    const bad = [...base]; bad[index] = value;
    assert.throws(() => parseBreakoutCsv(csv([base, bad])), BreakoutInputError, `${index}: ${value}`);
  }
  for (const input of [new Uint8Array(), new Uint8Array(2_000_001), new TextEncoder().encode("not a csv"), new Uint8Array([0xff,0xfe]), csv([base,base])]) assert.throws(() => parseBreakoutCsv(input), BreakoutInputError);
  assert.throws(() => parseBreakoutCsv(csv([base], [...BREAKOUT_HEADERS.slice(0,-1), "unknown"])), BreakoutInputError);
  assert.throws(() => parseBreakoutCsv(csv(Array.from({ length: 5_001 }, () => base))), /5,000/);
});
test("distinct tiny positions stay distinct; overlapping lifetimes are held, never merged", () => {
  const tiny1 = [...base]; tiny1[5] = "2025-01-01T00:00:00.123456780Z";
  const tiny2 = [...base]; tiny2[5] = "2025-01-01T00:00:00.123456781Z";
  const rows = parseBreakoutCsv(csv([tiny1,tiny2])).rows;
  assert.notEqual(rows[0].key, rows[1].key);
  assert.equal(breakoutConflicts(rows).size, 2);
  const separate = [...base]; separate[5] = "2025-01-02T00:00:00Z"; separate[6] = "2025-01-02T01:00:00Z";
  assert.equal(breakoutConflicts(parseBreakoutCsv(csv([base,separate])).rows).size, 0);
});
test("earlier history survives; boundary-spanning legacy results are not double-counted", () => {
  const trade = parseBreakoutCsv(csv()).rows[0].trade;
  const account = { historyFrom: "2025-01-02T00:00:00.000Z" } as BreakoutAccount;
  assert.equal(isLegacyHistory(trade, account), true);
  assert.equal(isLegacyHistory({ ...trade, closedAt: "2025-01-03T00:00:00Z" }, account), false);
  assert.equal(isLegacyHistory(trade, null), true);
  assert.equal(activeBreakoutHistoryFrom(account), null);
  const active = { ...account, activatedAt: new Date(), activatedFrom: account.historyFrom };
  assert.equal(activeBreakoutHistoryFrom({ ...active, historyFrom: "2024-12-01T00:00:00.000Z" }), account.historyFrom);
  assert.equal(activeBreakoutHistoryFrom({ ...account, activatedAt: new Date() }), account.historyFrom);
});
test("CSV upload needs no history date and rejects obsolete or duplicate fields", async () => {
  const form = () => { const data = new FormData(); data.set("file", new File([csv()], "positions.csv", { type: "text/csv" })); data.set("accountId", "breakout-1"); return data; };
  const input = await readBreakoutUpload(new Request("https://example.com", { method: "POST", body: form() }));
  assert.equal(parseBreakoutCsv(input.bytes).rows.length, 1);
  assert.equal("historyFrom" in input, false);
  const obsolete = form(); obsolete.set("historyFrom", "2025-01-01");
  await assert.rejects(readBreakoutUpload(new Request("https://example.com", { method: "POST", body: obsolete })), /fields/);
  const duplicate = form(); duplicate.append("accountId", "breakout-1");
  await assert.rejects(readBreakoutUpload(new Request("https://example.com", { method: "POST", body: duplicate })), /fields/);
});
test("stream limit works without Content-Length; invalid multipart and foreign files fail", async () => {
  await assert.rejects(readBoundedBody(new Request("https://example.com", { method: "POST", body: "too long" }), 2), BreakoutInputError);
  await assert.rejects(readBoundedBody(new Request("https://example.com", { method: "POST", headers: { "content-length": "1" }, body: "too long" }), 2), BreakoutInputError);
  await assert.rejects(readBreakoutUpload(new Request("https://example.com", { method: "POST", body: "x" })), BreakoutInputError);
  const data = new FormData(); data.set("file",new File(["x"],"x.xlsx",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})); data.set("accountId","breakout-1");
  await assert.rejects(readBreakoutUpload(new Request("https://example.com",{method:"POST",body:data})),BreakoutInputError);
});
test("retired Bybit account access cannot be enabled by credentials", () => {
  assert.throws(rejectBybitAccountAccess, /retired/);
});

test("preview distinguishes clean, duplicate and held rows without hiding unchecked evidence", () => {
  const conflicting = [...base]; conflicting[5] = "2025-01-01T00:30:00Z";
  const file = parseBreakoutCsv(csv([base, conflicting]));
  const preview = planBreakoutImport(file, []);
  assert.ok(preview.rows.every(row => row.status === "reconciliation"));
  const single = parseBreakoutCsv(csv());
  assert.equal(planBreakoutImport(single, [], [file.rows[1]]).rows[0].status, "reconciliation");
});

test("confirmation requires a bounded, unique selection, CSV digest and preview revision", async () => {
  const file = parseBreakoutCsv(csv());
  const form = () => { const data = new FormData(); data.set("file", new File([csv()], "positions.csv", { type: "text/csv" })); data.set("accountId", "breakout-1"); data.set("fileSha256", file.sha256); data.set("revision", "0"); data.set("selectedKeys", JSON.stringify([file.rows[0].key])); return data; };
  const confirmed = await readBreakoutUpload(new Request("https://example.com", { method: "POST", body: form() }), "confirm");
  assert.deepEqual(confirmed.selectedKeys, [file.rows[0].key]); assert.equal(confirmed.revision, 0);
  for (const value of ["[]", "{}", "bad json", JSON.stringify([file.rows[0].key, file.rows[0].key]), JSON.stringify(["unknown"])]) {
    const data = form(); data.set("selectedKeys", value);
    await assert.rejects(readBreakoutUpload(new Request("https://example.com", { method: "POST", body: data }), "confirm"));
  }
  const missing = form(); missing.delete("selectedKeys");
  await assert.rejects(readBreakoutUpload(new Request("https://example.com", { method: "POST", body: missing }), "confirm"), /fields/);
});
