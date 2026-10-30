import en from '../i18n/en.json';
import ta from '../i18n/ta.json';

export type TranslationKey = keyof typeof en;
export type SupportedLang = 'en' | 'ta';

/**
 * Checks whether Tamil beta pages and navigation are enabled.
 * Default is false unless TAMIL_ENABLED environment variable is explicitly 'true'.
 */
export function isTamilEnabled(): boolean {
  return process.env.TAMIL_ENABLED === 'true';
}

/**
 * Retrieves a translated string and interpolates variables formatted as {name}.
 *
 * @param key The stable translation key
 * @param vars Optional dictionary of variable replacements
 * @param lang Language ('en' or 'ta', default 'en')
 * @param fallback Optional fallback string if key is not found
 * @returns The translated string with variables interpolated
 */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  lang: SupportedLang = 'en',
  fallback?: string
): string {
  const dictionary = (lang === 'ta' ? ta : en) as Record<string, string>;
  let template = dictionary[key];
  if (template === undefined) {
    template = (en as Record<string, string>)[key];
  }
  if (template === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`[i18n] Missing translation key: "${key}"`);
  }
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    return paramName in vars ? String(vars[paramName]) : match;
  });
}

export default t;
