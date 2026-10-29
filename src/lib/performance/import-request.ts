import { BreakoutInputError, MAX_CSV_BYTES } from "./breakout";

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

export async function readBreakoutUpload(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw new BreakoutInputError("Choose a CSV using the upload form.");
  const bytes = await readBoundedBody(request);
  let form: FormData;
  try { form = await new Response(bytes as BodyInit, { headers: { "content-type": type } }).formData(); }
  catch { throw new BreakoutInputError("Invalid upload form. No records were saved."); }
  const expected = ["file", "accountId"];
  if ([...form.keys()].some(key => !expected.includes(key)) || expected.some(key => form.getAll(key).length !== 1)) throw new BreakoutInputError("Invalid upload fields.");
  const file = form.get("file");
  const accountId = form.get("accountId");
  if (!(file instanceof File) || typeof accountId !== "string" ||
    file.size > MAX_CSV_BYTES || !["text/csv", "application/csv", "text/plain", "application/octet-stream", ""].includes(file.type)) throw new BreakoutInputError("Upload an original CSV smaller than 2 MB.");
  return { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name, accountId };
}
