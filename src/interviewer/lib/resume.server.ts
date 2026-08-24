/**
 * Extracts plain text from an uploaded resume without any paid service:
 * text files are decoded directly, PDFs are parsed with unpdf and DOCX/ODT
 * are unzipped and stripped of XML tags. Runs anywhere (Node, Workers, Bun).
 */
export async function extractResumeContent(
  dataUrl: string,
  mimeType: string,
  fileName: string,
): Promise<string> {
  if (!dataUrl) return "";

  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const bytes = base64ToBytes(base64);
  const name = fileName.toLowerCase();

  if (mimeType.startsWith("text/") || /\.(txt|md|markdown|csv|json|rtf)$/i.test(name)) {
    return decodeText(bytes).trim();
  }

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : text;
    if (!merged.trim()) {
      throw new Error(
        "This PDF has no selectable text (it looks like a scan). Paste your resume text instead.",
      );
    }
    return cleanup(merged);
  }

  if (
    /\.(docx|odt|pptx)$/i.test(name) ||
    mimeType.includes("officedocument") ||
    mimeType.includes("opendocument")
  ) {
    const { unzipSync } = await import("fflate");
    const files = unzipSync(bytes);
    const target =
      Object.keys(files).find((k) => k === "word/document.xml" || k === "content.xml") ??
      Object.keys(files).find((k) => k.endsWith(".xml") && k.includes("document"));
    if (!target || !files[target])
      throw new Error("Could not read that document. Paste your resume text instead.");
    return cleanup(xmlToText(decodeText(files[target])));
  }

  // Unknown binary: best-effort decode, otherwise ask for text.
  const printable = Array.from(decodeText(bytes), (ch) => {
    const code = ch.charCodeAt(0);
    const keep = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    return keep ? ch : " ";
  }).join("");
  const guess = cleanup(printable);
  if (guess.length > 200) return guess;
  throw new Error("Unsupported resume file. Upload a PDF, DOCX or TXT, or paste the text.");
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<\/w:p>|<\/text:p>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanup(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
