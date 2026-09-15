import { evaluateSafeExpression, extractIdentifiers } from './expression.js';

// Строит граф зависимостей: source -> [{ name, kind }] — какие поля зависят
// от изменения данного поля через bind.optionsSource/computed/visibleWhen.
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

// Пересчитывает всех, кто каскадно зависит от changedName.
// Возвращает { values, dynamicOptions, visibility }.
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
        // Сбрасываем значение, только если оно реально пропало из нового списка.
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
          visibility[name] = Boolean(evaluateSafeExpression(targetEl.bind.visibleWhen, newValues));
        } catch {
          visibility[name] = true; // при ошибке лучше показать поле, чем скрыть данные пользователя
        }
        if (!visibility[name]) newValues[name] = undefined;
      }

      queue.push(name);
    }
  }

  return { values: newValues, dynamicOptions, visibility };
}
