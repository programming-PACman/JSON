import { useState } from 'react';
import { summarize, errorsForElement, typeLabel } from './builderUtils.js';

// Список элементов спецификации: выбор, добавление, дублирование, удаление,
// перестановка (тот же drag-n-drop паттерн, что в ArrayField/MatrixField).
export default function ElementList({ spec, errors, selectedIndex, onSelect, onAdd, onDuplicate, onDelete, onMove }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [addType, setAddType] = useState('text');

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    onMove(dragIndex, targetIndex);
    setDragIndex(null);
  };

  return (
    <div className="element-list">
      {spec.elements.map((el, index) => {
        const elErrors = errorsForElement(errors, el, index);
        return (
          <div
            key={index}
            className={`element-row${index === selectedIndex ? ' selected' : ''}${dragIndex === index ? ' dragging' : ''}`}
            onClick={() => onSelect(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
          >
            <span className="drag-handle" draggable onDragStart={() => setDragIndex(index)} onDragEnd={() => setDragIndex(null)}>⠿</span>
            <div className="element-row-main">
              <div className="element-row-title">
                {el.label || <em>(без названия)</em>} <span className="element-row-type">{typeLabel(el.type)}</span>
                {elErrors.length > 0 && <span className="element-row-error-badge" title={elErrors.map((e) => e.message).join('; ')}>⚠ {elErrors.length}</span>}
              </div>
              <div className="element-row-summary">{summarize(el) || el.name}</div>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate(index); }} title="Дублировать">⎘</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(index); }} title="Удалить">✕</button>
          </div>
        );
      })}

      {spec.elements.length === 0 && <p className="field-hint">Элементов пока нет — добавьте первый.</p>}

      <div className="element-list-add">
        <select value={addType} onChange={(e) => setAddType(e.target.value)}>
          {['text', 'textarea', 'number', 'email', 'date', 'select', 'radio', 'checkbox', 'array', 'matrix', 'list'].map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <button type="button" onClick={() => onAdd(addType)}>+ Добавить элемент</button>
      </div>
    </div>
  );
}
