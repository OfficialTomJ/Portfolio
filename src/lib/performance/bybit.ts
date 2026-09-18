import "server-only";

import { createHmac } from "crypto";

const RECV_WINDOW = "5000";

type BybitEnvironment = "demo" | "testnet" | "mainnet";
type QueryValue = string | number | boolean | undefined;

const HOSTS: Record<BybitEnvironment, string> = {
  demo: "https://api-demo.bybit.com",
  testnet: "https://api-testnet.bybit.com",
  mainnet: "https://api.bybit.com",
};

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

interface BybitListResult<T> {
  list: T[];
  nextPageCursor?: string;
}

export interface BybitPosition {
  symbol: string;
  side: "Buy" | "Sell" | "";
  size: string;
  avgPrice: string;
  positionIdx: number;
  stopLoss: string;
  takeProfit: string;
  leverage: string;
  createdTime: string;
  updatedTime: string;
  openTime?: string | number;
}

export interface BybitExecution {
  execId: string;
  orderId: string;
  orderLinkId: string;
  symbol: string;
  side: "Buy" | "Sell";
  execPrice: string;
  execQty: string;
  execValue: string;
  execFee: string;
  execTime: string;
  execType: string;
  orderType: string;
  stopOrderType: string;
  closedSize: string;
  seq: number;
}

export interface BybitOrder {
  orderId: string;
  orderLinkId: string;
  parentOrderLinkId?: string;
  symbol: string;
  side: "Buy" | "Sell";
  positionIdx: number;
  orderStatus: string;
  orderType: string;
  stopOrderType: string;
  triggerPrice: string;
  takeProfit: string;
  stopLoss: string;
  reduceOnly: boolean;
  closeOnTrigger: boolean;
  qty: string;
  cumExecQty: string;
  avgPrice: string;
  createdTime: string;
  updatedTime: string;
}

export interface BybitClosedPnl {
  orderId: string;
  symbol: string;
  side: "Buy" | "Sell";
  qty: string;
  closedSize: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  openFee?: string;
  closeFee?: string;
  execType: string;
  createdTime: string;
  updatedTime: string;
}

export interface BybitApiKeyInfo {
  userID: number;
  parentUid?: number;
  readOnly: number;
  deadlineDay?: number;
  expiredAt?: string;
}

export interface BybitAccountIdentity {
  environment: BybitEnvironment;
  serverTime: number;
  apiKey: BybitApiKeyInfo;
}

export interface BybitSnapshot {
  environment: BybitEnvironment;
  serverTime: number;
  apiKey: BybitApiKeyInfo;
  positions: BybitPosition[];
  executions: BybitExecution[];
  orders: BybitOrder[];
  closedPnl: BybitClosedPnl[];
}

function getConfig() {
  const environment = (process.env.BYBIT_ENV ?? "").toLowerCase() as BybitEnvironment;
  const host = HOSTS[environment];
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;

  if (!host || !apiKey || !apiSecret) {
    throw new Error("Bybit environment variables are missing or invalid");
  }

  return { environment, host, apiKey, apiSecret };
}

function queryString(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query.toString();
}

async function bybitGet<T>(
  path: string,
  params: Record<string, QueryValue> = {}
): Promise<BybitResponse<T>> {
  const { host, apiKey, apiSecret } = getConfig();
  const query = queryString(params);
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", apiSecret)
    .update(`${timestamp}${apiKey}${RECV_WINDOW}${query}`)
    .digest("hex");

  const response = await fetch(`${host}${path}${query ? `?${query}` : ""}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
    },
  });

  if (!response.ok) {
    throw new Error(`Bybit ${path} responded with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as BybitResponse<T>;
  if (payload.retCode !== 0) {
    throw new Error(`Bybit ${path} failed (${payload.retCode}): ${payload.retMsg}`);
  }
  return payload;
}

async function bybitList<T>(
  path: string,
  params: Record<string, QueryValue>,
  maxPages = 20
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await bybitGet<BybitListResult<T>>(path, {
      ...params,
      cursor: cursor ? decodeURIComponent(cursor) : undefined,
    });
    items.push(...(payload.result.list ?? []));
    cursor = payload.result.nextPageCursor || undefined;
    if (!cursor) return items;
  }

  throw new Error(`Bybit ${path} exceeded the pagination safety limit`);
}

export async function fetchBybitAccountIdentity(): Promise<BybitAccountIdentity> {
  const { environment } = getConfig();
  const response = await bybitGet<BybitApiKeyInfo>("/v5/user/query-api");

  if (response.result.readOnly !== 1) {
    throw new Error("Bybit API key must be read-only");
  }
  if (!response.result.userID) {
    throw new Error("Bybit account identity was not returned");
  }

  return {
    environment,
    serverTime: response.time,
    apiKey: response.result,
  };
}

export async function fetchBybitSnapshot(): Promise<BybitSnapshot> {
  const [apiKeyResponse, positions, executions, orders, closedPnl] = await Promise.all([
    fetchBybitAccountIdentity(),
    bybitList<BybitPosition>("/v5/position/list", {
      category: "linear",
      settleCoin: "USDT",
      limit: 200,
    }),
    bybitList<BybitExecution>("/v5/execution/list", {
      category: "linear",
      limit: 100,
    }),
    bybitList<BybitOrder>("/v5/order/history", {
      category: "linear",
      limit: 50,
    }),
    bybitList<BybitClosedPnl>("/v5/position/closed-pnl", {
      category: "linear",
      limit: 100,
    }),
  ]);

  return {
    environment: apiKeyResponse.environment,
    serverTime: apiKeyResponse.serverTime,
    apiKey: apiKeyResponse.apiKey,
    positions: positions.filter((item) => Number(item.size) > 0 && item.side),
    executions,
    orders,
    closedPnl,
  };
}
