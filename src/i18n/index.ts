import { EN } from './en';

/**
 * Zwei Sprachen: Deutsch (Ausgangssprache im Code) und Englisch. Texte werden mit `tr('deutscher Text')` übersetzt –
 * der deutsche Satz ist zugleich der Schlüssel. Platzhalter stehen in {geschweiften Klammern}.
 * Die Oberfläche merkt sich die Sprache in den Einstellungen und baut sich bei einem Wechsel neu auf.
 */
export type Lang = 'de' | 'en';

let current: Lang = 'de';

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Sprache des Geräts: Deutsch für deutsche Browser, sonst Englisch */
export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'de';
  return /^de\b/i.test(nav ?? '') ? 'de' : 'en';
}

export function tr(de: string, vars?: Record<string, string | number>): string {
  // „Text|kontext“: gleicher deutscher Text, verschiedene englische Übersetzungen (der Zusatz wird nicht angezeigt)
  let text = current === 'en' ? (EN[de] ?? de.replace(/\|\w+$/, '')) : de.replace(/\|\w+$/, '');
  if (vars) text = text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
  return text;
}

/** Wählt je nach Sprache einen von zwei Werten (für Grammatik, die sich nicht Wort für Wort übersetzen lässt) */
export function pick<T>(de: T, en: T): T {
  return current === 'en' ? en : de;
}
