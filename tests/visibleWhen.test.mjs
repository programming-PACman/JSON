import { setBind, initialCondition, parseCondition, buildCondition } from '../src/builder/builderUtils.js';
import { validateSpec } from '../src/core/validateSpec.js';
import { buildDependencyGraph, propagateChange } from '../src/core/bindingEngine.js';

let failed = 0;
const check = (n, c) => { console.log((c ? 'ok:   ' : 'FAIL: ') + n); if (!c) failed++; };

const others = {
  checkbox: [{ name: 'hasComment', label: 'Есть?', type: 'checkbox' }],
  number: [{ name: 'width', label: 'W', type: 'number' }],
  select: [{ name: 'kind', label: 'K', type: 'select', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }],
  text: [{ name: 'title', label: 'T', type: 'text' }],
};
const el = { name: 'comment', label: 'К', type: 'textarea' };

// ровно то, что делает чекбокс «Показывать по условию»
for (const [type, list] of Object.entries(others)) {
  const cond = initialCondition(list);
  const next = setBind(el, 'visibleWhen', cond);
  check(`${type}: включение даёт непустое условие "${cond}" и оно сохраняется в bind`, cond !== '' && next.bind?.visibleWhen === cond);
  check(`${type}: условие разбирается визуальным редактором (parseCondition ≠ null)`, parseCondition(cond) !== null);
  const spec = { title: 'T', elements: [...list, next] };
  check(`${type}: спецификация с таким условием валидна`, validateSpec(spec).length === 0);
}
check('нет других полей → пустое условие (чекбокс блокируется в UI)', initialCondition([]) === '' && initialCondition(undefined) === '');

// условие реально работает в движке: comment виден только при hasComment == true
const cond = initialCondition(others.checkbox);
const spec = { title: 'T', elements: [others.checkbox[0], setBind(el, 'visibleWhen', cond)] };
const g = buildDependencyGraph(spec.elements);
check('hasComment=true → comment виден', propagateChange('hasComment', g, { hasComment: true }).visibility.comment === true);
check('hasComment=false → comment скрыт', propagateChange('hasComment', g, { hasComment: false }).visibility.comment === false);

// снятие галочки убирает bind полностью
check('выключение удаляет bind.visibleWhen (и пустой bind)', setBind(setBind(el, 'visibleWhen', cond), 'visibleWhen', undefined).bind === undefined);
check('round-trip build/parse', JSON.stringify(parseCondition(buildCondition({ field: 'x', op: '>=', value: 3 }))) === '{"field":"x","op":">=","value":3}');

process.exit(failed ? 1 : 0);
