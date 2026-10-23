import { useState } from 'react';
import { UI_STRINGS } from '../core/i18n.js';
import { fileSafeName } from './builderUtils.js';

// Кнопки работы с JSON-спецификацией: импорт из файла, копирование, скачивание.
// Нужны и в режиме «JSON», и в «Конструкторе»: построил форму визуально — забрал JSON.
// getText() возвращает актуальный JSON-текст; onImport(rawText) получает содержимое файла.
export default function JsonTools({ getText, onImport, locale, filename = 'form', showImport = true }) {
  const t = UI_STRINGS[locale];
  const [message, setMessage] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setMessage(t.copied);
    } catch {
      setMessage(t.copyFailed);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([getText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileSafeName(filename)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImport(reader.result);
      setMessage(ok === false ? t.importFailed : '');
    };
    reader.readAsText(file);
    e.target.value = ''; // чтобы тот же файл можно было выбрать повторно
  };

  return (
    <div className="json-tools">
      {showImport && (
        <label className="file-button">
          {t.importJson}
          <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
        </label>
      )}
      <button type="button" className="secondary" onClick={handleCopy}>{t.copyJson}</button>
      <button type="button" className="secondary" onClick={handleDownload}>{t.downloadJson}</button>
      {message && <span className="json-tools-message">{message}</span>}
    </div>
  );
}
