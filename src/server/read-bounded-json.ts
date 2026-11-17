type JsonRead = { ok: true; data: unknown } | { ok: false; status: 400 | 413 };

export async function readBoundedJson(request: Request, limit: number): Promise<JsonRead> {
  if (Number(request.headers.get('content-length')) > limit) return { ok: false, status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}
