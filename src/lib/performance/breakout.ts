import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import type { PerformanceTrade } from "./types";

const Money = Decimal.clone({ precision: 80 });
export const BREAKOUT_ACCOUNT_ID = "breakout-1";
export const BREAKOUT_BASE_R = "1000";
export const MAX_CSV_BYTES = 2_000_000;
export const MAX_CSV_ROWS = 5_000;
export const BREAKOUT_HEADERS = ["instrument", "side", "quantity", "entry_price", "exit_price", "entry_time", "exit_time", "realized_pnl", "fees", "net_pnl"] as const;
type Field = typeof BREAKOUT_HEADERS[number];
export type BreakoutValues = Record<Field, string>;
export interface BreakoutRow {
  key: string;
  identity: string;
  line: number;
  values: BreakoutValues;
  original: BreakoutValues;
  trade: PerformanceTrade;
}
export interface BreakoutFile {
  sha256: string;
  rows: BreakoutRow[];
  firstEntry: string;
  lastExit: string;
}
export class BreakoutInputError extends Error {}
export const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function timestamp(value: string, line: number): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) throw new BreakoutInputError(`Line ${line}: use ISO timestamps with a timezone.`);
  const [, y, m, d, h, min, sec, fraction = "", zone] = parts;
  const day = new Date(Date.UTC(+y, +m - 1, +d));
  const offset = zone === "Z" ? "00:00" : zone.slice(1);
  if (day.getUTCFullYear() !== +y || day.getUTCMonth() !== +m - 1 || day.getUTCDate() !== +d ||
    +h > 23 || +min > 59 || +sec > 59 || +offset.slice(0, 2) > 14 || +offset.slice(3) > 59 ||
    (+offset.slice(0, 2) === 14 && +offset.slice(3) !== 0)) throw new BreakoutInputError(`Line ${line}: invalid timestamp.`);
  const date = new Date(`${y}-${m}-${d}T${h}:${min}:${sec}${zone}`);
  if (!Number.isFinite(date.getTime()) || +y < 2020 || date.getTime() > Date.now() + 300_000) throw new BreakoutInputError(`Line ${line}: invalid or future timestamp.`);
  return `${date.toISOString().slice(0, 19)}.${fraction.padEnd(9, "0")}Z`;
}

/** All validation completes before the caller opens a transaction or initializes indexes. */
export function parseBreakoutCsv(bytes: Uint8Array): BreakoutFile {
  if (!bytes.length || bytes.length > MAX_CSV_BYTES) throw new BreakoutInputError("Choose a nonempty CSV smaller than 2 MB.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new BreakoutInputError("The CSV must use UTF-8 text."); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new BreakoutInputError("The file contains unsupported control characters.");
  let records: { record: string[]; info: { lines: number } }[];
  // csv-parse's sync typing omits the documented info:true wrapper.
  try { records = parse(text, { bom: true, skip_empty_lines: true, info: true, max_record_size: 2048 }) as unknown as typeof records; }
  catch { throw new BreakoutInputError("The file is not a well-formed CSV. No records were saved."); }
  const headers = records.shift()?.record;
  if (!headers || headers.length !== BREAKOUT_HEADERS.length || new Set(headers).size !== headers.length ||
    BREAKOUT_HEADERS.some(name => !headers.includes(name))) throw new BreakoutInputError("Unsupported columns. Upload the original Breakout closed-positions CSV.");
  if (!records.length || records.length > MAX_CSV_ROWS) throw new BreakoutInputError("Upload between 1 and 5,000 closed positions.");
  const keys = new Set<string>();
  const rows = records.map(({ record, info }): BreakoutRow => {
    const line = info.lines;
    if (record.length !== headers.length || record.some(value => !value || value.length > 100 || value !== value.trim())) throw new BreakoutInputError(`Line ${line}: missing or incompatible values.`);
    const original = Object.fromEntries(headers.map((name, index) => [name, record[index]])) as BreakoutValues;
    const values = { ...original };
    if (!/^[A-Z0-9]{2,20}\/USD$/.test(values.instrument) || !["long", "short"].includes(values.side)) throw new BreakoutInputError(`Line ${line}: expected a USD instrument and long/short side.`);
    for (const name of ["quantity", "entry_price", "exit_price", "realized_pnl", "fees", "net_pnl"] as const) {
      if (!/^-?\d{1,16}(?:\.\d{1,30})?$/.test(values[name])) throw new BreakoutInputError(`Line ${line}: invalid ${name}.`);
      const number = new Money(values[name]);
      if (number.abs().gte("1000000000000000") || (["quantity", "entry_price", "exit_price"].includes(name) && number.lte(0)) || (name === "fees" && number.lt(0))) throw new BreakoutInputError(`Line ${line}: invalid ${name}.`);
      values[name] = number.toFixed();
    }
    values.entry_time = timestamp(values.entry_time, line);
    values.exit_time = timestamp(values.exit_time, line);
    if (values.exit_time < values.entry_time) throw new BreakoutInputError(`Line ${line}: the exit precedes the entry.`);
    if (!new Money(values.realized_pnl).minus(values.fees).eq(values.net_pnl)) throw new BreakoutInputError(`Line ${line}: net P&L does not equal realized P&L minus fees.`);
    const resultR = new Money(values.net_pnl).div(BREAKOUT_BASE_R).toNumber();
    if (!Number.isFinite(resultR) || Math.abs(resultR) > 100) throw new BreakoutInputError(`Line ${line}: result exceeds the journal's supported range.`);
    const identity = digest(JSON.stringify([BREAKOUT_ACCOUNT_ID, values.instrument, values.side, values.entry_time]));
    const key = digest(JSON.stringify([BREAKOUT_ACCOUNT_ID, ...BREAKOUT_HEADERS.map(name => values[name])]));
    if (keys.has(key)) throw new BreakoutInputError(`Line ${line}: indistinguishable duplicate rows. Re-export or reconcile before uploading.`);
    keys.add(key);
    const id = `trade-${key.slice(0, 20)}`;
    return { key, identity, line, values, original, trade: {
      id, source: "breakout", symbol: values.instrument.replace("/USD", "USDT"), direction: values.side === "long" ? "Long" : "Short",
      openedAt: new Date(values.entry_time).toISOString(), closedAt: new Date(values.exit_time).toISOString(),
      entryPrice: Number(values.entry_price), exitPrice: Number(values.exit_price), resultR,
    } };
  });
  return { sha256: digest(bytes), rows, firstEntry: rows.reduce((a, b) => a < b.values.entry_time ? a : b.values.entry_time, rows[0].values.entry_time),
    lastExit: rows.reduce((a, b) => a > b.values.exit_time ? a : b.values.exit_time, rows[0].values.exit_time) };
}

export interface BreakoutRecord extends BreakoutRow {
  _id: string;
  accountId: string;
  batchId: string;
  importedAt: Date;
  status: "pending_review" | "reconciliation" | "published";
  reason?: string;
  riskConfirmed: boolean;
  fingerprint: string;
}
export function breakoutFingerprint(row: BreakoutRow): string {
  return digest(JSON.stringify({ parser: 1, account: BREAKOUT_ACCOUNT_ID, key: row.key, values: row.values, baseR: BREAKOUT_BASE_R, trade: row.trade }));
}

/** Same-symbol overlap is uncertainty, never permission to merge or match Bybit. */
export function breakoutConflicts(rows: BreakoutRow[]): Set<string> {
  const held = new Set<string>();
  const groups = new Map<string, BreakoutRow[]>();
  for (const row of rows) {
    const group = `${row.values.instrument}:${row.values.side}`;
    const entries = groups.get(group);
    if (entries) entries.push(row); else groups.set(group, [row]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.values.entry_time.localeCompare(b.values.entry_time));
    let end = "";
    let longest: BreakoutRow | undefined;
    for (const row of group) {
      if (longest && row.values.entry_time <= end) { held.add(longest.key); held.add(row.key); }
      if (row.values.exit_time >= end) { end = row.values.exit_time; longest = row; }
    }
  }
  return held;
}

export interface BreakoutAccount {
  _id: string;
  historyFrom: string;
  firstImportedAt: Date;
  lastImportedAt: Date;
  historyThrough: string;
  importRevision: number;
  activatedAt?: Date;
  activatedFrom?: string;
}
export function activeBreakoutHistoryFrom(account: BreakoutAccount | null): string | null {
  return account?.activatedAt ? account.activatedFrom ?? account.historyFrom : null;
}
export function isLegacyHistory(trade: PerformanceTrade, account: Pick<BreakoutAccount, "historyFrom"> | null): boolean {
  return !account || (trade.openedAt < account.historyFrom && trade.closedAt < account.historyFrom);
}
