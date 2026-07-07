import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&#34;": '"',
  "&#39;": "'",
  "&#160;": " ",
};

/** Decode HTML entities, including double-encoded ones (e.g. "&amp;quot;" → '"'). */
export function decodeHtml(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  for (let i = 0; i < 3; i++) {
    const prev = s;
    s = s.replace(/&(amp|quot|apos|lt|gt|nbsp|#34|#39|#160);/g, (m) => ENTITY_MAP[m] ?? m)
         .replace(/&#(\d+);/g, (_, n) => {
           try { return String.fromCodePoint(Number(n)); } catch { return _; }
         })
         .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
           try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _; }
         });
    if (s === prev) break;
  }
  return s;
}

