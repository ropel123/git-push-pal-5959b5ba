// domPreprocessor.ts
// Nettoie un HTML brut pour le passer à un LLM (Scout) avec un budget tokens raisonnable.
// Pas de parser DOM lourd : on travaille en regex (suffisant pour les portails marchés publics).

const MAX_CLEAN_DOM_BYTES = 30_000;
const MAX_TEXT_SAMPLE = 3_000;
const MAX_LINKS = 200;

export type PreprocessedPage = {
  url: string;
  clean_dom: string;
  links: string[];
  text_sample: string;
  structural_hints: {
    has_table: boolean;
    has_pagination_widget: boolean;
    form_count: number;
    raw_size_bytes: number;
  };
};

function stripTag(html: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi");
  return html.replace(re, "");
}

function stripAttrs(html: string): string {
  // Supprime les attributs bruyants (style, on*, data-*, srcset, integrity, nonce)
  return html.replace(/\s(style|on\w+|data-[\w-]+|srcset|integrity|nonce|aria-[\w-]+|role)="[^"]*"/gi, "");
}

function absolutize(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const abs = absolutize(m[1], baseUrl);
    if (!abs) continue;
    if (abs.startsWith("javascript:") || abs.startsWith("mailto:") || abs.startsWith("tel:")) continue;
    out.add(abs);
    if (out.size >= MAX_LINKS) break;
  }
  return Array.from(out);
}

export function extractText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function preprocess(html: string, baseUrl: string): PreprocessedPage {
  const rawSize = html.length;

  // 1. Extraire <body> (si possible)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let work = bodyMatch ? bodyMatch[1] : html;

  // 2. Supprimer les blocs inutiles
  for (const tag of ["script", "style", "svg", "noscript", "iframe", "header", "footer", "nav"]) {
    work = stripTag(work, tag);
  }

  // 3. Supprimer commentaires
  work = work.replace(/<!--[\s\S]*?-->/g, "");

  // 4. Supprimer attributs bruyants
  work = stripAttrs(work);

  // 5. Compacter les espaces
  work = work.replace(/\s{2,}/g, " ").replace(/>\s+</g, "><").trim();

  // 6. Tronquer
  if (work.length > MAX_CLEAN_DOM_BYTES) {
    work = work.slice(0, MAX_CLEAN_DOM_BYTES) + "\n<!-- truncated -->";
  }

  return {
    url: baseUrl,
    clean_dom: work,
    links: extractLinks(html, baseUrl),
    text_sample: extractText(work).slice(0, MAX_TEXT_SAMPLE),
    structural_hints: {
      has_table: /<table\b/i.test(work),
      has_pagination_widget: /pagination|page-link|next|suivant|page-item|page=|PageNumber/i.test(html),
      form_count: (html.match(/<form\b/gi) || []).length,
      raw_size_bytes: rawSize,
    },
  };
}
