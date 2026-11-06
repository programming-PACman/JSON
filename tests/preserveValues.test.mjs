import { carryOverValues } from '../src/builder/builderUtils.js';
import { buildDependencyGraph, computeInitialState } from '../src/core/bindingEngine.js';

let failed = 0;
const check = (n, c) => { console.log((c ? 'ok:   ' : 'FAIL: ') + n); if (!c) failed++; };

const els = [
  { name: 'w', label: 'W', type: 'number', default: 1 },
  { name: 'h', label: 'H', type: 'number', default: 1 },
  { name: 'area', label: 'S', type: 'number', bind: { computed: 'w * h' } },
  { name: 'name', label: 'N', type: 'text' },
  { name: 'note', label: 'Note', type: 'text', bind: { visibleWhen: 'w > 5' } },
];
const g = buildDependencyGraph(els);
const typed = { w: 10, h: 3, area: 30, name: 'Иван', note: 'x' };

const seeded = computeInitialState(els, g, carryOverValues(els, els, typed));
check('введённые значения сохраняются', seeded.values.w === 10 && seeded.values.name === 'Иван');
check('вычисляемое поле пересчитано по сохранённым значениям', seeded.values.area === 30);
check('видимость пересчитана (w=10 → note виден)', seeded.visibility.note === true);

// правка формулы: вычисляемое не «залипает» на старом значении
const els2 = els.map((e) => (e.name === 'area' ? { ...e, bind: { computed: 'w + h' } } : e));
const s2 = computeInitialState(els2, buildDependencyGraph(els2), carryOverValues(els, els2, typed));
check('после смены формулы area = w + h = 13, а не старые 30', s2.values.area === 13);

// смена типа / удаление поля
const els3 = els.map((e) => (e.name === 'name' ? { ...e, type: 'number' } : e)).filter((e) => e.name !== 'note');
const kept3 = carryOverValues(els, els3, typed);
check('смена типа сбрасывает значение, удалённое поле не переносится', !('name' in kept3) && !('note' in kept3) && kept3.w === 10);

// без seed поведение прежнее
check('без seed используются default', computeInitialState(els, g).values.w === 1);
check('seed с 0 и пустой строкой не игнорируется (hasOwnProperty, а не truthiness)', computeInitialState(els, g, { w: 0, name: '' }).values.w === 0 && computeInitialState(els, g, { name: '' }).values.name === '');

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
