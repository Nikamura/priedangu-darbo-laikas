import { en } from "./en.ts";
import { type Dict, lt } from "./lt.ts";
import { pl } from "./pl.ts";
import { ru } from "./ru.ts";
import { uk } from "./uk.ts";

export const LANGS = { lt, en, uk, ru, pl } as const satisfies Record<string, Dict>;
export type Lang = keyof typeof LANGS;
export type { Dict };

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && v in LANGS;
}

/**
 * Lithuanian unless the visitor chose otherwise: ?lang= in the link, then the
 * language they picked before. The browser's language is deliberately ignored.
 */
export function detectLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem("lang");
    if (isLang(saved)) return saved;
  } catch {}
  return "lt";
}

/** Replaces {name} placeholders. */
export function fmt(s: string, params: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
