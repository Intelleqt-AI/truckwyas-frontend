// A blob request (PDF, file download) that fails gets its error body as a
// Blob too, so the server's JSON ({error, code, warnings, …}) never reached
// the message. Read it back. Pure (no "@/" imports) so node tests it.

export interface BlobErrorBody { message: string | null; data: unknown }

export async function readBlobError(body: unknown): Promise<BlobErrorBody | null> {
  if (!body || typeof (body as Blob).text !== "function") return null;
  let text = "";
  try { text = await (body as Blob).text(); } catch { return null; }
  const t = text.trim();
  if (!t || t.startsWith("<")) return { message: null, data: null };
  try {
    const data = JSON.parse(t) as Record<string, unknown>;
    let message: string | null = null;
    // A blocked send / PDF: the first block warning's title (QUOTE-RULES §10).
    if (data && data.code === "quote_send_blocked" && Array.isArray(data.warnings)) {
      const w = (data.warnings as { severity?: string; title?: string }[]).find((x) => x && x.severity === "block" && typeof x.title === "string");
      if (w) message = w.title as string;
    }
    if (!message) {
      const first = data.error ?? data.detail ?? data[Object.keys(data)[0]];
      message = typeof first === "string" ? first : Array.isArray(first) && typeof first[0] === "string" ? first[0] : null;
    }
    return { message, data };
  } catch {
    return { message: t.slice(0, 200), data: t };
  }
}
