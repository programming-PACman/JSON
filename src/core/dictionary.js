// Общий словарь переводов — третий слой текстов (после UI_STRINGS и translations
// самой спецификации). Формат: { ru: { ключ: 'текст' }, en: { ключ: 'text' } }.
//
// Порядок поиска перевода для поля с labelKey:
//   1. spec.translations[locale][key]   — локальный перевод конкретной формы (приоритет)
//   2. sharedDictionary[locale][key]    — общий словарь, общий для всех форм
//   3. element.label                    — исходный текст (fallback, как и раньше)
//
// Благодаря слиянию на уровне translations остальной код (resolveText и все
// компоненты) менять не нужно.

export const LOCALES = ['ru', 'en'];

// Базовый язык: на нём написаны исходные тексты (label, title и т.д.) в самой
// спецификации, поэтому для него отдельный перевод не нужен — fallback на
// исходный текст и есть «перевод». «Не хватает перевода» имеет смысл
// только для остальных языков.
export const BASE_LOCALE = 'ru';

export function emptyDictionary() {
  return Object.fromEntries(LOCALES.map((l) => [l, {}]));
}

// Локальные переводы спецификации перекрывают общий словарь.
export function mergeTranslations(shared, local) {
  const result = {};
  const locales = new Set([...Object.keys(shared || {}), ...Object.keys(local || {})]);
  locales.forEach((locale) => {
    result[locale] = { ...(shared?.[locale] || {}), ...(local?.[locale] || {}) };
  });
  return result;
}

// Возвращает копию spec, в которой translations уже слиты с общим словарём.
export function withSharedDictionary(spec, shared) {
  if (!spec) return spec;
  return { ...spec, translations: mergeTranslations(shared, spec.translations) };
}

// Задать/изменить перевод одного ключа для одной локали (неизменяемо).
export function setEntry(dict, key, locale, text) {
  const next = { ...dict, [locale]: { ...(dict?.[locale] || {}) } };
  if (text === '' || text === undefined || text === null) delete next[locale][key];
  else next[locale][key] = text;
  return next;
}

// Удалить ключ целиком (из всех локалей).
export function removeKey(dict, key) {
  const next = {};
  Object.keys(dict || {}).forEach((locale) => {
    const { [key]: _removed, ...rest } = dict[locale] || {};
    next[locale] = rest;
  });
  return next;
}

// Переименовать ключ во всех локалях. Возвращает { dict } или { error }.
export function renameKey(dict, oldKey, newKey) {
  if (!isValidKey(newKey)) return { error: 'invalidKey' };
  if (oldKey === newKey) return { dict };
  if (allKeys(dict).includes(newKey)) return { error: 'duplicateKey' };
  const next = {};
  Object.keys(dict || {}).forEach((locale) => {
    const entries = {};
    Object.entries(dict[locale] || {}).forEach(([k, v]) => { entries[k === oldKey ? newKey : k] = v; });
    next[locale] = entries;
  });
  return { dict: next };
}

export function isValidKey(key) {
  return typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

// Все ключи словаря (объединение по локалям), по алфавиту.
export function allKeys(dict) {
  const keys = new Set();
  Object.values(dict || {}).forEach((entries) => Object.keys(entries || {}).forEach((k) => keys.add(k)));
  return [...keys].sort();
}

// Все ключи, которые использует спецификация (titleKey, labelKey, descriptionKey,
// placeholderKey у элементов, а также у опций, колонок matrix и полей template).
export function collectSpecKeys(spec) {
  const keys = [];
  const add = (owner) => {
    if (!owner || typeof owner !== 'object') return;
    ['label', 'description', 'placeholder', 'title'].forEach((f) => {
      const k = owner[`${f}Key`];
      if (typeof k === 'string' && k && !keys.includes(k)) keys.push(k);
    });
  };
  add(spec);
  (spec?.elements || []).forEach((el) => {
    add(el);
    (el.options || []).forEach(add);
    (el.columns || []).forEach(add);
    (el.template || []).forEach(add);
  });
  return keys;
}

// Ключи, которым нет перевода для locale ни в локальных translations, ни в общем словаре.
// Для базового языка всегда [] (см. BASE_LOCALE).
export function findMissingKeys(spec, shared, locale) {
  if (locale === BASE_LOCALE) return [];
  const merged = mergeTranslations(shared, spec?.translations);
  return collectSpecKeys(spec).filter((k) => merged[locale]?.[k] === undefined);
}

// Проверка структуры словаря, пришедшего из файла/localStorage.
export function normalizeDictionary(raw) {
  const result = emptyDictionary();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  Object.keys(raw).forEach((locale) => {
    const entries = raw[locale];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return;
    result[locale] = result[locale] || {};
    Object.entries(entries).forEach(([k, v]) => {
      if (isValidKey(k) && typeof v === 'string') result[locale][k] = v;
    });
  });
  return result;
}

export function parseDictionary(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { error: e.message }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'not-object' };
  return { dict: normalizeDictionary(raw) };
}

export function serializeDictionary(dict) {
  return JSON.stringify(dict, null, 2);
}

// Импорт: записи из incoming добавляются поверх текущих (incoming побеждает).
export function mergeDictionaries(current, incoming) {
  return mergeTranslations(current, incoming);
}

// ── Хранение в localStorage (каждый вызов в try/catch: в приватном режиме может бросать) ──
const STORAGE_KEY = 'jgb.sharedDictionary';

export function loadDictionary(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyDictionary();
    return normalizeDictionary(JSON.parse(raw));
  } catch {
    return emptyDictionary();
  }
}

export function saveDictionary(dict, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(dict));
    return true;
  } catch {
    return false;
  }
}
