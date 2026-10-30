import { BreakoutInputError, MAX_CSV_BYTES, MAX_CSV_ROWS } from "./breakout";
import type { BreakoutUpload, BreakoutSelection } from "./breakout-store";

/** Bound the stream even when Content-Length is missing or dishonest. */
export async function readBoundedBody(request: Request, limit = MAX_CSV_BYTES + 16_384): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new BreakoutInputError("Upload is too large.");
  if (!request.body) throw new BreakoutInputError("Choose a CSV file.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new BreakoutInputError("Upload is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export function readBreakoutUpload(request: Request, mode: "confirm"): Promise<BreakoutUpload & BreakoutSelection>;
export function readBreakoutUpload(request: Request, mode?: "preview"): Promise<BreakoutUpload>;
export async function readBreakoutUpload(request: Request, mode: "preview" | "confirm" = "preview"): Promise<BreakoutUpload | (BreakoutUpload & BreakoutSelection)> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw new BreakoutInputError("Choose a CSV using the upload form.");
  const bytes = await readBoundedBody(request, MAX_CSV_BYTES + 16_384 + (mode === "confirm" ? MAX_CSV_ROWS * 70 : 0));
  let form: FormData;
  try { form = await new Response(bytes as BodyInit, { headers: { "content-type": type } }).formData(); }
  catch { throw new BreakoutInputError("Invalid upload form. No records were saved."); }
  const expected = ["file", "accountId", ...(mode === "confirm" ? ["fileSha256", "revision", "selectedKeys"] : [])];
  if ([...form.keys()].some(key => !expected.includes(key)) || expected.some(key => form.getAll(key).length !== 1)) throw new BreakoutInputError("Invalid upload fields.");
  const file = form.get("file");
  const accountId = form.get("accountId");
  if (!(file instanceof File) || typeof accountId !== "string" ||
    file.size > MAX_CSV_BYTES || !["text/csv", "application/csv", "text/plain", "application/octet-stream", ""].includes(file.type)) throw new BreakoutInputError("Upload an original CSV smaller than 2 MB.");
  const input = { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name, accountId };
  if (mode === "preview") return input;
  const fileSha256 = form.get("fileSha256"), revision = form.get("revision"), selection = form.get("selectedKeys");
  if (typeof fileSha256 !== "string" || !/^[a-f0-9]{64}$/.test(fileSha256) || typeof revision !== "string" || !/^\d{1,15}$/.test(revision) ||
    !Number.isSafeInteger(Number(revision)) || typeof selection !== "string" || selection.length > MAX_CSV_ROWS * 70) throw new BreakoutInputError("Preview the file and select positions before importing.");
  let selectedKeys: unknown;
  try { selectedKeys = JSON.parse(selection); } catch { throw new BreakoutInputError("Invalid trade selection."); }
  if (!Array.isArray(selectedKeys) || !selectedKeys.length || selectedKeys.length > MAX_CSV_ROWS || selectedKeys.some(key => typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key)) || new Set(selectedKeys).size !== selectedKeys.length) throw new BreakoutInputError("Select at least one position from the preview.");
  return { ...input, fileSha256, revision: Number(revision), selectedKeys: selectedKeys as string[] };
}
