// Нагрузочная проверка ядра: большая спецификация + цепочка зависимостей.
// Пороги намеренно щедрые (в разы выше реальных значений) — тест ловит деградацию
// «на порядок» (например, случайно квадратичный алгоритм), а не мелкие колебания машины.
import { performance } from 'node:perf_hooks';
import { validateSpec } from '../src/core/validateSpec.js';
import { buildDependencyGraph, propagateChange, computeInitialState } from '../src/core/bindingEngine.js';

let failed = 0;
const check = (name, cond, info = '') => { console.log((cond ? 'ok:   ' : 'FAIL: ') + name + (info ? `  [${info}]` : '')); if (!cond) failed++; };
const time = (fn) => { const t = performance.now(); const r = fn(); return [r, Math.round(performance.now() - t)]; };

const N = 1000;
// Цепочка: f0 (число) → f1 = f0 + 1 → f2 = f1 + 1 → … ; плюс обычные поля
const elements = [{ name: 'f0', label: 'f0', type: 'number', default: 0 }];
for (let i = 1; i < N; i++) {
  elements.push({ name: `f${i}`, label: `f${i}`, type: 'number', bind: { computed: `f${i - 1} + 1` } });
}
for (let i = 0; i < 500; i++) elements.push({ name: `t${i}`, label: `t${i}`, type: 'text' });
const spec = { title: 'Big', elements };

const [errors, tValidate] = time(() => validateSpec(spec));
check(`validateSpec: ${elements.length} полей без ошибок`, errors.length === 0, `${tValidate} мс`);
check('validateSpec < 2000 мс', tValidate < 2000);

const [graph, tGraph] = time(() => buildDependencyGraph(spec.elements));
check('buildDependencyGraph < 2000 мс', tGraph < 2000, `${tGraph} мс`);

const [init, tInit] = time(() => computeInitialState(spec.elements, graph));
check('computeInitialState: вся цепочка посчитана', init.values[`f${N - 1}`] === N - 1, `f${N - 1} = ${init.values[`f${N - 1}`]}`);
// Известное ограничение: начальный расчёт запускает пересчёт от каждого источника → ~O(n²) на длинной цепочке.
// На реальных формах (десятки полей) это миллисекунды; порог ловит только «зависание».
check('computeInitialState (цепочка 1000, O(n²)) < 10000 мс', tInit < 10000, `${tInit} мс`);

const [res, tProp] = time(() => propagateChange('f0', graph, { ...init.values, f0: 10 }));
check('propagateChange: изменение f0 доходит до конца цепочки', res.values[`f${N - 1}`] === 10 + N - 1);
check('propagateChange (1000 звеньев) < 2000 мс', tProp < 2000, `${tProp} мс`);

// Цикл в большой спецификации должен находиться, а не зависать
const cyc = { title: 'C', elements: elements.map((e) => (e.name === 'f0' ? { ...e, bind: { computed: `f${N - 1} + 1` } } : e)) };
const [cerr, tCyc] = time(() => validateSpec(cyc));
check('цикл на 1000 звеньев найден', cerr.some((e) => /цикл|cycl/i.test(e.message)), `${tCyc} мс`);
check('поиск цикла < 2000 мс', tCyc < 2000);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
