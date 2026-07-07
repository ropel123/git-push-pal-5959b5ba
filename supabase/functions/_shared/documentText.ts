// _shared/documentText.ts — extraction de texte depuis des documents
// bureautiques (PDF, DOCX, XLSX) pour alimenter l'assistant IA.
// Les images ne sont pas océrisées : on renvoie une note explicite.

import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const MAX_OUTPUT_CHARS = 12_000;

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_OUTPUT_CHARS);
}

/** Récupère le texte de toutes les balises XML données. */
function xmlText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out.join(" ");
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return collapse(Array.isArray(text) ? text.join(" ") : text);
}

function extractDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const docXml = files["word/document.xml"];
  if (!docXml) return "";
  // Les paragraphes <w:p> deviennent des sauts de ligne ; <w:t> porte le texte.
  const xml = strFromU8(docXml).replace(/<\/w:p>/g, "\n");
  return collapse(xmlText(xml, "w:t").replace(/<[^>]+>/g, ""));
}

function extractXlsx(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const parts: string[] = [];

  // Chaînes partagées (cellules texte)
  const shared = files["xl/sharedStrings.xml"];
  if (shared) {
    const xml = strFromU8(shared);
    parts.push(xmlText(xml, "t").replace(/<[^>]+>/g, ""));
  }
  // Valeurs inline / numériques des feuilles
  for (const name of Object.keys(files)) {
    if (name.startsWith("xl/worksheets/") && name.endsWith(".xml")) {
      const xml = strFromU8(files[name]);
      parts.push(xmlText(xml, "t").replace(/<[^>]+>/g, ""));
    }
  }
  return collapse(parts.join(" "));
}

export async function extractDocumentText(fileName: string, bytes: Uint8Array): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return await extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
    case "xlsx":
      return extractXlsx(bytes);
    case "jpg":
    case "jpeg":
    case "png":
      return "[Image reçue — son contenu visuel n'est pas analysé automatiquement. Demandez à l'utilisateur de décrire ce qu'elle montre si c'est important.]";
    default:
      return "";
  }
}
