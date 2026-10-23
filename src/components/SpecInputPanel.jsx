import { UI_STRINGS } from '../core/i18n.js';

// Режим «JSON»: текстовое поле со спецификацией + загрузка/проверка.
// Вынесено из App.jsx, чтобы App отвечал только за состояние и связку режимов.
export default function SpecInputPanel({ text, onTextChange, onLoad, onCheck, onFile, locale }) {
  const t = UI_STRINGS[locale];
  return (
    <>
      <label htmlFor="spec-text">{t.specLabel}</label>
      <textarea
        id="spec-text"
        rows={14}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder='{"title": "...", "elements": [...]}'
      />
      <button type="button" onClick={onLoad}>{t.loadButton}</button>
      <button type="button" onClick={onCheck}>{t.checkButton}</button>
      <label className="file-button">
        {t.fileButton}
        <input type="file" accept=".json" onChange={onFile} hidden />
      </label>
    </>
  );
}
