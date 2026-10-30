import en from '../i18n/en.json';

export type TranslationKey = keyof typeof en;

/**
 * Retrieves a translated string from en.json and interpolates variables formatted as {name}.
 *
 * @param key The stable translation key
 * @param vars Optional dictionary of variable replacements
 * @returns The translated string with variables interpolated
 */
export function t(
  key: string,
  vars?: Record<string, string | number>
): string {
  const template = (en as Record<string, string>)[key];
  if (template === undefined) {
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
