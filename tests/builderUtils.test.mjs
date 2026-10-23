import {
  addElement, duplicateElement, deleteElement, moveElement, renameElement, setBind,
  downstreamOf, dependencySources, supportsProp, coerceDefault, moveItem, nextOptionValue,
  expressionProblem, appendToExpression, listDependencies, fileSafeName,
} from '../src/builder/builderUtils.js';
import { validateSpec } from '../src/core/validateSpec.js';
import { buildDependencyGraph, computeInitialState } from '../src/core/bindingEngine.js';

let failed = 0;
const check = (n, c) => { console.log((c ? 'ok:   ' : 'FAIL: ') + n); if (!c) failed++; };

// --- базовые операции над спецификацией ---
let spec = { title: 'T', elements: [] };
for (const t of ['number', 'number', 'text', 'checkbox', 'array', 'select']) spec = addElement(spec, t).spec;
check('addElement: 6 элементов с уникальными именами', new Set(spec.elements.map((e) => e.name)).size === 6);
check('созданная форма валидна', validateSpec(spec).length === 0);
const dup = duplicateElement(spec, 0);
check('duplicateElement: копия после оригинала, имя уникально', dup.spec.elements.length === 7 && dup.index === 1 && dup.spec.elements[1].name !== dup.spec.elements[0].name);
check('deleteElement', deleteElement(spec, 0).elements.length === 5);
check('moveElement', moveElement(spec, 0, 2).elements[2].name === spec.elements[0].name);
check('moveElement: границы не ломают', moveElement(spec, 0, 99) === spec);

// --- зависимости, циклы и кандидаты ---
// number_1 ← number_2 (computed), text_1 видим по checkbox_1
const [n1, n2, tx, cb, arr, sel] = spec.elements.map((e) => e.name);
spec = { ...spec, elements: spec.elements.map((e) => {
  if (e.name === n2) return setBind(e, 'computed', `${n1} * 2`);
  if (e.name === tx) return setBind(e, 'visibleWhen', `${cb} == true`);
  if (e.name === sel) return setBind(e, 'optionsSource', arr);
  return e;
}) };
check('listDependencies видит 3 связи', listDependencies(spec).length === 3);
check('downstreamOf(number_1) = {number_2}', [...downstreamOf(spec, n1)].join() === n2);
const iN1 = spec.elements.findIndex((e) => e.name === n1);
const srcN1 = dependencySources(spec, iN1);
check('кандидаты для number_1 НЕ содержат number_2 (иначе цикл) и себя', !srcN1.scalar.some((e) => e.name === n2 || e.name === n1));
check('кандидаты — только скалярные поля (нет array/select-варианта)', srcN1.scalar.every((e) => e.type !== 'array'));
check('arrays-кандидаты — только type=array', dependencySources(spec, spec.elements.findIndex((e) => e.name === sel)).arrays.map((e) => e.name).join() === arr);
// транзитивность: A→B→C: у A нельзя выбрать ни B, ни C
let chain = { title: 'T', elements: [
  { name: 'a', label: 'A', type: 'number' }, { name: 'b', label: 'B', type: 'number', bind: { computed: 'a + 1' } }, { name: 'c', label: 'C', type: 'number', bind: { computed: 'b + 1' } } ] };
check('транзитивно: downstreamOf(a) = {b, c}', [...downstreamOf(chain, 'a')].sort().join() === 'b,c');
check('кандидаты для a пусты', dependencySources(chain, 0).scalar.length === 0);
// любая цепочка, собранная только из кандидатов, не даёт ошибок цикла
const cyc = validateSpec({ title: 'T', elements: [
  { name: 'a', label: 'A', type: 'number', bind: { computed: 'b' } }, { name: 'b', label: 'B', type: 'number', bind: { computed: 'a' } } ] });
check('валидатор по-прежнему ловит цикл, нарисованный вручную в JSON', cyc.some((e) => /Циклическая/.test(e.message)));

// --- общие свойства ---
check('supportsProp: placeholder только у текстовых/числовых', supportsProp('text', 'placeholder') && !supportsProp('select', 'placeholder') && !supportsProp('array', 'placeholder'));
check('supportsProp: default/disabled не у коллекций', !supportsProp('matrix', 'default') && supportsProp('checkbox', 'default') && !supportsProp('list', 'disabled'));
check('coerceDefault: number', coerceDefault({ type: 'number' }, '3.5') === 3.5 && coerceDefault({ type: 'number' }, 'abc') === undefined);
check('coerceDefault: пусто → не задано', coerceDefault({ type: 'text' }, '') === undefined);
check('coerceDefault: checkbox', coerceDefault({ type: 'checkbox' }, true) === true && coerceDefault({ type: 'checkbox' }, false) === false);
check('coerceDefault: select — строка', coerceDefault({ type: 'select' }, 'a') === 'a');

// --- варианты ---
check('moveItem', JSON.stringify(moveItem([1, 2, 3], 2, 0)) === '[3,1,2]' && JSON.stringify(moveItem([1, 2], 0, 5)) === '[1,2]');
check('nextOptionValue не совпадает с существующими', nextOptionValue([{ value: 'option_2' }, { value: 'x' }]) === 'option_3');
check('nextOptionValue: после удаления/переименования нет дубля', nextOptionValue([{ value: 'option_1' }, { value: 'option_3' }]) === 'option_4');

// --- выражения computed ---
check('expressionProblem: пусто — ок', expressionProblem('', ['a']) === null);
check('expressionProblem: ок', expressionProblem('a * 2', ['a']) === null);
check('expressionProblem: неизвестное поле', /Нет такого поля/.test(expressionProblem('zzz * 2', ['a'])));
check('expressionProblem: синтаксис', /Некорректное/.test(expressionProblem('a *', ['a'])));
check('appendToExpression', appendToExpression('', 'a') === 'a' && appendToExpression('a', '*') === 'a *');

// --- переименование чинит ссылки ---
const renamed = renameElement(spec, iN1, 'w');
check('renameElement чинит computed в чужом поле', renamed.elements.find((e) => e.name === n2).bind.computed === 'w * 2');
check('после переименования спецификация валидна', validateSpec(renamed).length === 0);

check('fileSafeName: транслит и безопасные символы', fileSafeName('Пример формы') === 'Primer_formy' && fileSafeName('a/b:c?') === 'A_b_c' && fileSafeName('') === 'form' && fileSafeName('???') === 'form' && fileSafeName(undefined) === 'form');

// --- БАГ: начальное состояние (visibleWhen от пустого источника) ---
const vs = { title: 'T', elements: [
  { name: 'kind', label: 'K', type: 'select', options: [{ value: 'a', label: 'A' }, { value: 'other', label: 'O' }] },
  { name: 'comment', label: 'C', type: 'text', bind: { visibleWhen: 'kind == "other"' } } ] };
const init = computeInitialState(vs.elements, buildDependencyGraph(vs.elements));
check('visibleWhen от НЕзаполненного select: поле скрыто с самого начала', init.visibility.comment === false);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
