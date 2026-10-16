import { evaluateSafeExpression, extractIdentifiers } from './expression.js';

export function buildDependencyGraph(elements) {
  const dependents = {};
  const byName = {};
  elements.forEach((el) => (byName[el.name] = el));

  function addEdge(source, targetName, kind) {
    if (!dependents[source]) dependents[source] = [];
    dependents[source].push({ name: targetName, kind });
  }

  elements.forEach((el) => {
    if (!el.bind) return;
    if (el.bind.optionsSource) addEdge(el.bind.optionsSource, el.name, 'options');
    if (el.bind.computed) {
      extractIdentifiers(el.bind.computed).filter((id) => byName[id]).forEach((s) => addEdge(s, el.name, 'computed'));
    }
    if (el.bind.visibleWhen) {
      extractIdentifiers(el.bind.visibleWhen).filter((id) => byName[id]).forEach((s) => addEdge(s, el.name, 'visibility'));
    }
  });

  return { dependents, byName };
}

export function propagateChange(changedName, graph, values) {
  const newValues = { ...values };
  const dynamicOptions = {};
  const visibility = {};
  const queue = [changedName];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    for (const { name, kind } of graph.dependents[current] || []) {
      if (visited.has(name)) continue;
      visited.add(name);
      const targetEl = graph.byName[name];

      if (kind === 'options') {
        const sourceValue = newValues[current];
        const options = Array.isArray(sourceValue)
          ? sourceValue.map((v) => (typeof v === 'object' ? v : { value: v, label: String(v) }))
          : [];
        dynamicOptions[name] = options;
        if (!options.some((opt) => opt.value === newValues[name])) newValues[name] = undefined;
      }

      if (kind === 'computed' && targetEl?.bind?.computed) {
        try {
          newValues[name] = evaluateSafeExpression(targetEl.bind.computed, newValues);
        } catch {
          newValues[name] = undefined;
        }
      }

      if (kind === 'visibility' && targetEl?.bind?.visibleWhen) {
        try {
          // Ещё не заполненное поле — это не "неизвестный идентификатор", а пустое
          // значение (null): условие "тип == \"other\"" при невыбранном типе просто
          // ложно, и зависимое поле должно быть скрыто с самого начала.
          const scope = { ...emptyScope(graph), ...newValues };
          visibility[name] = Boolean(evaluateSafeExpression(targetEl.bind.visibleWhen, scope));
        } catch {
          visibility[name] = true;
        }
        // Скрытость поля НЕ уничтожает его значение (default/введённое) —
        // значение должно пережить переключение видимости туда-обратно.
      }

      queue.push(name);
    }
  }

  return { values: newValues, dynamicOptions, visibility };
}

function emptyScope(graph) {
  const scope = {};
  Object.keys(graph.byName).forEach((n) => { scope[n] = null; });
  return scope;
}

// Стартовое состояние формы: default'ы + первичный прогон ВСЕХ зависимостей
// (а не только тех, чей источник уже имеет значение) — иначе поля с visibleWhen
// от пустого источника оказались бы видимыми до первого действия пользователя.
export function computeInitialState(elements, graph) {
  let values = {};
  elements.forEach((el) => { if (el.default !== undefined) values[el.name] = el.default; });
  let dynamicOptions = {};
  let visibility = {};
  Object.keys(graph.dependents).forEach((sourceName) => {
    const r = propagateChange(sourceName, graph, values);
    values = r.values;
    dynamicOptions = { ...dynamicOptions, ...r.dynamicOptions };
    visibility = { ...visibility, ...r.visibility };
  });
  return { values, dynamicOptions, visibility };
}
