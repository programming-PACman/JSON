import {
  emptyDictionary, mergeTranslations, withSharedDictionary, setEntry, removeKey, renameKey,
  allKeys, collectSpecKeys, findMissingKeys, normalizeDictionary, parseDictionary,
  serializeDictionary, mergeDictionaries, loadDictionary, saveDictionary,
} from '../src/core/dictionary.js';
import { resolveText } from '../src/core/i18n.js';
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (name, cond) => { console.log((cond ? 'ok:   ' : 'FAIL: ') + name); if (!cond) failed++; };

const spec = JSON.parse(readFileSync(new URL('../example-spec.json', import.meta.url)));
const shared = { ru: { username_label: 'Логин' }, en: { username_label: 'Login', width_label: 'W (shared)', extra: 'Extra' } };

// приоритет: локальный перевод > общий словарь > label
const eff = withSharedDictionary(spec, shared);
const el = (n) => spec.elements.find((e) => e.name === n);
check('локальный перевод перекрывает общий (width_label не в spec? нет — берётся из spec)', resolveText(el('width'), 'label', 'en', eff.translations) === 'Width');
check('общий словарь перекрывается локальным: username_label en = Username', resolveText(el('username'), 'label', 'en', eff.translations) === 'Username');
check('общий словарь используется, если локального нет (ru)', resolveText(el('username'), 'label', 'ru', eff.translations) === 'Логин');
check('fallback на label, если нигде нет', resolveText({ label: 'X', labelKey: 'nope' }, 'label', 'en', eff.translations) === 'X');
check('исходная spec не мутируется', spec.translations.en.username_label === 'Username' && !('ru' in spec.translations));

// setEntry / removeKey / renameKey неизменяемость
const d0 = emptyDictionary();
const d1 = setEntry(d0, 'save', 'ru', 'Сохранить');
const d2 = setEntry(d1, 'save', 'en', 'Save');
check('setEntry не мутирует исходный', Object.keys(d0.ru).length === 0);
check('setEntry пишет значение', d2.ru.save === 'Сохранить' && d2.en.save === 'Save');
check('пустой текст удаляет запись', !('save' in setEntry(d2, 'save', 'en', '').en));
check('removeKey удаляет из всех локалей', !('save' in removeKey(d2, 'save').ru) && !('save' in removeKey(d2, 'save').en));
const rn = renameKey(d2, 'save', 'store');
check('renameKey переносит во все локали', rn.dict.ru.store === 'Сохранить' && rn.dict.en.store === 'Save' && !('save' in rn.dict.ru));
check('renameKey: дубликат отклоняется', renameKey(setEntry(d2, 'x', 'ru', '1'), 'save', 'x').error === 'duplicateKey');
check('renameKey: плохой ключ отклоняется', renameKey(d2, 'save', '1bad key').error === 'invalidKey');
check('allKeys по алфавиту', JSON.stringify(allKeys({ ru: { b: '1' }, en: { a: '2', b: '3' } })) === '["a","b"]');

// ключи спецификации и «недостающие переводы»
const keys = collectSpecKeys(spec);
check('collectSpecKeys находит titleKey и labelKey (в т.ч. колонки matrix)', keys.includes('form_title') && keys.includes('col_ip') && keys.includes('username_label'));
check('findMissingKeys en: всё переведено в spec', findMissingKeys(spec, emptyDictionary(), 'en').length === 0);
const ruMissing = findMissingKeys(spec, emptyDictionary(), 'ru');
check('findMissingKeys ru: нет ru-переводов → все ключи missing', ruMissing.length === keys.length);
check('общий словарь закрывает пропуск', !findMissingKeys(spec, shared, 'ru').includes('username_label'));

// нормализация и импорт
check('normalize отбрасывает мусор', JSON.stringify(normalizeDictionary({ ru: { 'bad key': 'x', ok: 'y', n: 5 }, en: 'oops' })) === '{"ru":{"ok":"y"},"en":{}}');
check('parse: невалидный JSON → error', 'error' in parseDictionary('{oops'));
check('parse: массив → error', 'error' in parseDictionary('[]'));
check('round-trip serialize/parse', JSON.stringify(parseDictionary(serializeDictionary(d2)).dict) === JSON.stringify(d2));
check('merge: incoming побеждает', mergeDictionaries({ ru: { a: '1' } }, { ru: { a: '2', b: '3' } }).ru.a === '2');

// localStorage-обёртка (подмена + бросающий storage)
const fake = (() => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; })();
check('save/load через storage', saveDictionary(d2, fake) && loadDictionary(fake).en.save === 'Save');
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
check('сломанный storage: load → пустой словарь, save → false', loadDictionary(broken).ru && saveDictionary(d2, broken) === false);
check('без storage вообще не падает', loadDictionary(undefined).ru !== undefined);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
