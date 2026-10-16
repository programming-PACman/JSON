import { useState } from 'react';
import ElementList from './ElementList.jsx';
import ElementEditor from './ElementEditor.jsx';
import { addElement, duplicateElement, deleteElement, moveElement, updateElement, renameElement, selectionAfterMove } from './builderUtils.js';

// Конструктор редактирует spec как обычный JS-объект (не текст!) — это и есть
// принцип "состояние конструктора есть спецификация", JSON получается из него
// через JSON.stringify только при передаче наружу (onChange).
export default function BuilderPanel({ spec, errors, onChange }) {
  const [selected, setSelected] = useState(spec.elements.length > 0 ? 0 : null);

  const handleAdd = (type) => {
    const { spec: next, index } = addElement(spec, type);
    onChange(next);
    setSelected(index);
  };
  const handleDuplicate = (index) => {
    const { spec: next, index: newIndex } = duplicateElement(spec, index);
    onChange(next);
    setSelected(newIndex);
  };
  const handleDelete = (index) => {
    onChange(deleteElement(spec, index));
    setSelected((s) => (s === index ? null : s > index ? s - 1 : s));
  };
  const handleMove = (from, to) => {
    onChange(moveElement(spec, from, to));
    setSelected((s) => selectionAfterMove(s, from, to));
  };
  const handleElementChange = (index, newElement) => onChange(updateElement(spec, index, newElement));
  const handleRename = (index, newName) => onChange(renameElement(spec, index, newName));

  const selectedElement = selected !== null ? spec.elements[selected] : null;
  const otherElements = selected !== null ? spec.elements.filter((_, i) => i !== selected) : spec.elements;

  return (
    <div className="builder-panel">
      <div className="builder-meta">
        <div className="field">
          <label>Название формы (title)</label>
          <input value={spec.title ?? ''} onChange={(e) => onChange({ ...spec, title: e.target.value })} />
        </div>
      </div>

      <div className="builder-columns">
        <div className="builder-column">
          <ElementList
            spec={spec}
            errors={errors}
            selectedIndex={selected}
            onSelect={setSelected}
            onAdd={handleAdd}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        </div>
        <div className="builder-column">
          {selectedElement ? (
            <ElementEditor
              element={selectedElement}
              otherElements={otherElements}
              onChange={(el) => handleElementChange(selected, el)}
              onRename={(name) => handleRename(selected, name)}
            />
          ) : (
            <p className="field-hint">Выберите элемент слева, чтобы редактировать его свойства.</p>
          )}
        </div>
      </div>
    </div>
  );
}
