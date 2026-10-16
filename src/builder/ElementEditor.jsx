import { ELEMENT_TYPES, isValidName, withProp, setBind, changeType, initialCondition } from './builderUtils.js';
import OptionsEditor from './OptionsEditor.jsx';
import FieldListEditor from './FieldListEditor.jsx';
import ConditionEditor from './ConditionEditor.jsx';

// Редактирует ОДИН выбранный элемент. Переименование идёт через отдельный
// onRename (не через обычный onChange), потому что оно должно чинить ссылки
// в чужих bind — эта логика уже реализована в builderUtils.renameElement
// и вызывается на уровне BuilderPanel, у которого есть доступ ко всей спецификации.
export default function ElementEditor({ element, otherElements, onChange, onRename }) {
  const set = (key, value) => onChange(withProp(element, key, value));
  const setBindKey = (key, value) => onChange(setBind(element, key, value));

  return (
    <div className="element-editor">
      <div className="field">
        <label>Имя (name)</label>
        <input
          value={element.name}
          onChange={(e) => {
            const name = e.target.value;
            if (isValidName(name) || name === '') onRename(name);
          }}
        />
        {!isValidName(element.name) && <p className="field-error">Имя может содержать только латинские буквы, цифры и "_", не начинаться с цифры</p>}
      </div>

      <div className="field">
        <label>Подпись (label)</label>
        <input value={element.label ?? ''} onChange={(e) => set('label', e.target.value)} />
      </div>

      <div className="field">
        <label>Тип</label>
        <select value={element.type} onChange={(e) => onChange(changeType(element, e.target.value))}>
          {ELEMENT_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
      </div>

      <div className="field field-inline">
        <label><input type="checkbox" checked={!!element.required} onChange={(e) => set('required', e.target.checked || undefined)} /> Обязательное</label>
      </div>

      {(element.type === 'select' || element.type === 'radio') && (
        <div className="field">
          <label>Варианты</label>
          <OptionsEditor options={element.options} onChange={(opts) => set('options', opts)} />
        </div>
      )}

      {element.type === 'number' && (
        <div className="field-row">
          <div className="field"><label>min</label><input type="number" value={element.min ?? ''} onChange={(e) => set('min', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
          <div className="field"><label>max</label><input type="number" value={element.max ?? ''} onChange={(e) => set('max', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        </div>
      )}

      {(element.type === 'text' || element.type === 'textarea') && (
        <div className="field-row">
          <div className="field"><label>minLength</label><input type="number" value={element.minLength ?? ''} onChange={(e) => set('minLength', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
          <div className="field"><label>maxLength</label><input type="number" value={element.maxLength ?? ''} onChange={(e) => set('maxLength', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
        </div>
      )}

      {element.type === 'array' && (
        <>
          <div className="field">
            <label>Тип элементов (itemType)</label>
            <select value={element.itemType} onChange={(e) => set('itemType', e.target.value)}>
              {['text', 'number', 'email', 'date'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <CollectionLimits element={element} set={set} />
        </>
      )}

      {element.type === 'matrix' && (
        <>
          <div className="field">
            <label>Столбцы</label>
            <FieldListEditor fields={element.columns} onChange={(cols) => set('columns', cols)} namePlaceholder="имя столбца" />
          </div>
          <CollectionLimits element={element} set={set} />
        </>
      )}

      {element.type === 'list' && (
        <>
          <div className="field">
            <label>Поля записи (template)</label>
            <FieldListEditor fields={element.template} onChange={(tpl) => set('template', tpl)} namePlaceholder="имя поля" />
          </div>
          <CollectionLimits element={element} set={set} />
        </>
      )}

      {(element.type === 'select' || element.type === 'radio') && (
        <div className="field">
          <label>Источник вариантов из другого поля (bind.optionsSource)</label>
          <select value={element.bind?.optionsSource ?? ''} onChange={(e) => setBindKey('optionsSource', e.target.value || undefined)}>
            <option value="">— не использовать —</option>
            {otherElements.map((el) => <option key={el.name} value={el.name}>{el.label || el.name}</option>)}
          </select>
        </div>
      )}

      {!['array', 'matrix', 'list'].includes(element.type) && (
        <div className="field">
          <label>Вычисляемое значение (bind.computed)</label>
          <input
            placeholder={otherElements.length ? `например: ${otherElements[0].name} * 2` : 'выражение'}
            value={element.bind?.computed ?? ''}
            onChange={(e) => setBindKey('computed', e.target.value || undefined)}
          />
        </div>
      )}

      <div className="field">
        <label>Условная видимость (bind.visibleWhen)</label>
        <div className="field-inline" style={{ marginBottom: 6 }}>
          <label>
            <input
              type="checkbox"
              checked={!!element.bind?.visibleWhen}
              disabled={otherElements.length === 0 && !element.bind?.visibleWhen}
              onChange={(e) => setBindKey('visibleWhen', e.target.checked ? initialCondition(otherElements) : undefined)}
            />
            {' '}Показывать по условию
          </label>
        </div>
        {otherElements.length === 0 && !element.bind?.visibleWhen && (
          <p className="field-hint">Нет других полей, от которых можно зависеть.</p>
        )}
        {element.bind?.visibleWhen !== undefined && (
          <ConditionEditor
            expression={element.bind.visibleWhen}
            otherElements={otherElements}
            onChange={(expr) => setBindKey('visibleWhen', expr)}
          />
        )}
      </div>
    </div>
  );
}

function CollectionLimits({ element, set }) {
  return (
    <div className="field-row">
      <div className="field"><label>minItems</label><input type="number" value={element.minItems ?? ''} onChange={(e) => set('minItems', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
      <div className="field"><label>maxItems</label><input type="number" value={element.maxItems ?? ''} onChange={(e) => set('maxItems', e.target.value === '' ? undefined : Number(e.target.value))} /></div>
    </div>
  );
}
