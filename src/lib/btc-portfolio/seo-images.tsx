import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import { ImageResponse } from "next/og";
import { publicPortfolioStorage } from "./public-repository";
import { PortfolioOpenGraphCard } from "./seo-card";
import type { PortfolioSeoModel } from "./seo-model";

interface StoredImage { _id: string; version: 1; width: 1200; height: 630; contentType: "image/png"; createdAt: Date; imageDay: string; asOf: string; sha256: string; payload: Binary }
const collection = () => publicPortfolioStorage().db.collection<StoredImage>("portfolio_public_social_images");
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export function validPortfolioPng(bytes: Buffer) { return bytes.length > 8 && bytes.length <= 4 * 1024 * 1024 && bytes.subarray(0, 8).equals(png); }
export async function loadPortfolioSocialImage(key: string) {
  const row = await collection().findOne({ _id: key });
  if (!row) return null;
  const bytes = Buffer.from(row.payload.buffer);
  if (row.version !== 1 || row.width !== 1200 || row.height !== 630 || row.contentType !== "image/png" || !validPortfolioPng(bytes) || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error("Invalid public portfolio image.");
  return { bytes, asOf: row.asOf, imageDay: row.imageDay };
}
export async function ensurePortfolioSocialImage(model: PortfolioSeoModel) {
  const existing = await loadPortfolioSocialImage(model.key);
  if (existing) return existing;
  const logo = "data:image/png;base64," + (await readFile(path.join(process.cwd(), "public/chronicles-c.png"))).toString("base64");
  const response = new ImageResponse(<PortfolioOpenGraphCard model={model} logo={logo}/>, { width: 1200, height: 630 });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!validPortfolioPng(bytes)) throw new Error("Portfolio image could not be generated.");
  await collection().updateOne({ _id: model.key }, { $setOnInsert: { _id: model.key, version: 1, width: 1200, height: 630, contentType: "image/png", createdAt: new Date(), imageDay: model.imageDay, asOf: model.asOf, sha256: createHash("sha256").update(bytes).digest("hex"), payload: new Binary(bytes) } }, { upsert: true });
  const stored = await loadPortfolioSocialImage(model.key);
  if (!stored) throw new Error("Portfolio image was not persisted.");
  return stored;
}
export function portfolioImageResponse(image: { bytes: Buffer; asOf: string; imageDay: string }, immutable = true) {
  return new Response(new Uint8Array(image.bytes), { headers: { "Content-Type": "image/png", "Content-Length": String(image.bytes.length), "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300, s-maxage=300, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff", "X-Portfolio-As-Of": image.asOf, "X-Portfolio-Image-Day": image.imageDay, ...(process.env.VERCEL_ENV === "production" ? {} : { "X-Robots-Tag": "noindex, nofollow" }) } });
}
