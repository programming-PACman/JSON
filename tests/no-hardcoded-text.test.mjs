// Страж: в компонентах формы (src/components) не должно быть захардкоженного
// русского текста — все тексты интерфейса идут через UI_STRINGS (i18n.js),
// иначе при переключении на EN они остаются русскими.
import { readdirSync, readFileSync } from 'node:fs';
import { UI_STRINGS } from '../src/core/i18n.js';

let failed = 0;
const dir = new URL('../src/components/', import.meta.url);
for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsx'))) {
  const lines = readFileSync(new URL(f, dir), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, ''); // комментарии можно писать по-русски
    if (/[А-Яа-яЁё]/.test(code)) { console.log(`FAIL: ${f}:${i + 1} захардкожен русский текст: ${line.trim()}`); failed++; }
  });
}
// у обоих языков одинаковый набор ключей интерфейса
const ru = Object.keys(UI_STRINGS.ru).sort(), en = Object.keys(UI_STRINGS.en).sort();
const diff = [...ru.filter((k) => !en.includes(k)), ...en.filter((k) => !ru.includes(k))];
if (diff.length) { console.log('FAIL: ключи UI_STRINGS различаются между ru и en:', diff); failed++; }
if (!failed) console.log('ok:   в components нет захардкоженного текста, наборы ключей ru/en совпадают');
process.exit(failed ? 1 : 0);
