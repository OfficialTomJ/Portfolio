import { z } from "zod";
import { portfolioEditorialNoteSchema, portfolioStoriesSchema } from "./stories";

const decimal = z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,12})?$/, "Use a non-negative decimal, up to 12 places.");
const positive = decimal.refine(v => Number(v) > 0, "Enter an amount greater than zero.");
const id = z.string().min(1).max(80);
const at = z.iso.datetime({ offset: true }).transform(v => new Date(v).toISOString());
const publicText = z.string().trim().min(1).refine(v => !/(?:\$|\b(?:USD[T]?|AUD|dollars?|sats?|satoshis?)\b|\b\d[\d,.]*\s*(?:BTC|XBT|ETH|SOL|HYPE)\b)/i.test(v), "Keep monetary amounts and quantities out of public text.");
export const accounts = ["cold", "margin"] as const;
export const labels = { cold: "Cold Storage", margin: "Margin Account" } as const;
export const assets = ["BTC", "ETH", "SOL", "HYPE", "USDT", "USD"] as const;
export const kinds = ["opening", "buy", "sell", "deposit", "withdrawal", "transfer", "margin-open", "margin-close", "fee"] as const;
export const eventSchema = z.object({
  id, at, sequence: z.number().int().nonnegative().max(100000), kind: z.enum(kinds), account: z.enum(accounts),
  asset: z.enum(assets), quantity: positive, price: positive, fee: decimal, feeAsset: z.enum(assets),
  direction: z.enum(["long", "short"]), leverage: z.number().min(1).max(5), positionId: z.string().max(80),
  publicReason: publicText.max(600),
  privateNote: z.string().max(2000), correctionReason: z.string().max(300), sourceId: z.string().max(100),
  articleUrl: z.string().max(500).refine(v => { if (!v) return true; try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && !u.port && (u.hostname === "substack.com" || u.hostname.endsWith(".substack.com")) && /^\/p\/[^/]+/.test(u.pathname); } catch { return false; } }, "Use an HTTPS Substack article URL."),
  voided: z.boolean(), campaignId: z.string().max(80),
}).strict();
export const campaignSchema = z.object({ id, name: publicText.max(80), asset: z.enum(["BTC", "ETH", "SOL"]), startAt: at, durationDays: z.number().int().min(1).max(365), cadenceDays: z.number().int().min(1).max(365), amount: positive, status: z.enum(["active", "paused", "completed"]), reason: publicText.max(600) }).strict();
export const ledgerSchema = z.object({ mode: z.enum(["mock", "reconstructed"]), currency: z.enum(["USDT", "USD"]).default("USDT"), inceptionAt: at, asOf: at,
  events: z.array(eventSchema).max(2000), campaigns: z.array(campaignSchema).max(30),
  marks: z.array(z.object({ asset: z.enum(assets), at, price: positive }).strict()).max(12000),
}).strict();
export type PortfolioEvent = z.infer<typeof eventSchema>;
export type Ledger = z.infer<typeof ledgerSchema>;
export type Account = typeof accounts[number];
const base = { revision: z.number().int().nonnegative(), requestId: z.uuid() };
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("save-event"), event: eventSchema }).strict(),
  z.object({ ...base, action: z.literal("import"), events: z.array(eventSchema).min(1).max(200) }).strict(),
  z.object({ ...base, action: z.literal("void"), id, reason: z.string().trim().min(1).max(300) }).strict(),
  z.object({ ...base, action: z.literal("save-campaign"), campaign: campaignSchema }).strict(),
  z.object({ ...base, action: z.literal("publish"), fingerprint: z.string().length(64) }).strict(),
  z.object({ ...base, action: z.literal("restore"), release: z.number().int().positive() }).strict(),
  z.object({ ...base, action: z.literal("replay") }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;

const finite = z.number().finite();
/** Only relative, sanitized facts may cross the public boundary. No monetary DCA field exists. */
export const publicSchema = z.object({
  mode: z.enum(["mock", "reconstructed"]), currency: z.enum(["USDT", "USD"]).default("USDT"), inceptionAt: at, asOf: at, lastActivityAt: at, publishedAt: at.nullable(), release: z.number().int().positive(),
  points: z.array(z.object({ at, portfolioIndex: finite.positive(), btcIndex: finite.positive(), weights: z.record(z.string(), finite) }).strip()),
  allocation: z.array(z.object({ account: z.enum(accounts), asset: z.string(), weight: finite, type: z.enum(["spot", "margin", "cash"]), direction: z.enum(["long", "short"]) }).strip()),
  cashPct: finite, investedPct: finite.nonnegative(), netPct: finite,
  stories: portfolioStoriesSchema.optional(),
  editorialNotes: z.array(portfolioEditorialNoteSchema).max(200).optional(),
  privacy: z.object({ publication: z.enum(["held-for-review", "localhost-preview", "staging-preview"]), walletHistory: z.enum(["withheld", "curve-only"]), tradeRecords: z.literal("private-only"), tradeLinkedIdeas: z.literal("private-only") }).strict().optional(),
  performanceCoverage: z.object({ method: z.literal("spot-and-closed-prop-results"), propThrough: at, propTradeCount: z.number().int().positive(), openPropPnlIncluded: z.literal(false) }).strict().optional(),
  history: z.object({ method: z.literal("linked-performance"), priorAsOf: at, currentInceptionAt: at, cashBridgeAssumed: z.literal(true) }).strict().optional(),
  activity: z.array(z.object({ id, at, kind: z.enum(kinds), account: z.enum(accounts), asset: z.enum(assets), reason: publicText, articleUrl: z.string(), campaignId: z.string(), weightBefore: finite, weightAfter: finite,
    allocationChanges: z.array(z.object({ asset: z.enum(["BTC", "ETH", "SOL", "HYPE", "CASH"]), deltaPct: finite }).strip()).default([]),
  }).strip()),
  campaigns: z.array(z.object({ id, name: publicText, asset: z.enum(assets), startAt: at, durationDays: z.number(), cadenceDays: z.number(), status: z.enum(["active", "paused", "completed"]), reason: publicText, recordedFills: z.number() }).strip()),
}).strip();
export type PublicPortfolio = z.infer<typeof publicSchema>;
export interface PrivateSummary {
  equity: string; openingEquity: string; btcEquivalent: string; btcHeld: string; cash: string; netContributions: string;
  pnl: string; fees: string; financing: string; realised: string; unrealised: string; initialMargin: string;
  passiveBtc: string | null; passiveValue: string | null; passiveGap: string | null;
  holdings: { account: Account; asset: string; quantity: string; value: string }[];
  positions: { id: string; asset: string; direction: "long" | "short"; quantity: string; entry: string; mark: string; pnl: string; leverage: number }[];
}
export interface ReplayResult { publicData: PublicPortfolio; summary: PrivateSummary; checks: { name: string; passed: boolean; detail: string }[] }
export interface Workspace {
  _id: string; revision: number; draft: Ledger; published: PublicPortfolio;
  releases: { release: number; at: string; revision: number; data: PublicPortfolio }[];
  audit: { at: string; actor: string; action: string; revision: number; before?: PortfolioEvent; after?: PortfolioEvent }[];
  operations: string[]; replay: { fingerprint: string; at: string; checks: ReplayResult["checks"] } | null;
}
export interface AdminSnapshot {
  revision: number; fingerprint: string; draft: Ledger; preview: PublicPortfolio; published: PublicPortfolio; summary: PrivateSummary;
  releases: { release: number; at: string; revision: number }[]; audit: Workspace["audit"]; replay: Workspace["replay"]; checks: ReplayResult["checks"];
}
