# REST API сервера

Запуск: `npm run server` (порт 3001, переменные `PORT`, `DATA_DIR`; по умолчанию данные в `server/data/`).
Без внешних зависимостей (только Node.js 18+). Все ответы — JSON, кодировка UTF-8.
При `npm run dev` Vite проксирует `/api` на `http://localhost:3001`.

| Метод и путь | Что делает | Ответы |
|---|---|---|
| `GET /api/health` | проверка работоспособности | 200 `{status:"ok"}` |
| `POST /api/validate` | проверить спецификацию, ничего не сохраняя | 200 `{valid, errors[]}` |
| `POST /api/spec` | сохранить спецификацию | 201 `{id, url}`; 400 битый JSON; 413 больше 1 МБ; 422 `{error, errors[]}` |
| `GET /api/spec/:id` | получить `{id, createdAt, updatedAt, spec}` | 200; 404 |
| `PUT /api/spec/:id` | заменить спецификацию | 200; 404; 422 |
| `DELETE /api/spec/:id` | удалить | 204; 404 |
| `GET /api/specs` | список `[{id, title, createdAt, updatedAt}]`, новые сверху | 200 |
| `GET /api/dictionary` | весь общий словарь `{ru:{…}, en:{…}}` | 200 |
| `PUT /api/dictionary/entries/:key` | задать переводы ключа: `{"ru":"…","en":"…"}`; пустая строка удаляет перевод этого языка | 200 (весь словарь); 400 |
| `DELETE /api/dictionary/entries/:key` | удалить ключ во всех языках | 200 (весь словарь) |
| `POST /api/dictionary/merge` | влить словарь `{ru:{…},en:{…}}` (входящее побеждает) | 200 (весь словарь) |

`id` — 12 символов `[a-f0-9]`; всё, что на него не похоже, получает 404 (защита от `../`).
Ключ словаря: латиница, цифры, `_`, не с цифры.

## Примеры (curl)

```
curl http://localhost:3001/api/health

curl -X POST http://localhost:3001/api/validate \
  -H 'Content-Type: application/json' \
  -d '{"title":"T","elements":[{"name":"a","label":"A","type":"text"}]}'

curl -X POST http://localhost:3001/api/spec -H 'Content-Type: application/json' -d @example-spec.json
curl http://localhost:3001/api/spec/<id>

curl -X PUT http://localhost:3001/api/dictionary/entries/save_btn \
  -H 'Content-Type: application/json' -d '{"ru":"Сохранить","en":"Save"}'
curl http://localhost:3001/api/dictionary
```

## Как устроено
- Валидация — тот же `src/core/validateSpec.js`, что и в браузере: правила не дублируются.
- Файлы пишутся атомарно (временный файл → `rename`), записи словаря идут через очередь —
  одновременные правки не теряются (проверено тестом на 30 параллельных запросов).
- Клиент словаря шлёт **операции над отдельными ключами**, а не весь словарь, и накладывает
  ответ сервера поверх своих неотправленных правок — чужие изменения не затираются.

## Ограничения (осознанные)
- Нет авторизации и разграничения прав: сервер рассчитан на доверенную внутреннюю сеть.
- Если два человека одновременно правят **один и тот же** ключ — побеждает последняя запись.
- Хранилище — файлы; для сотен тысяч записей понадобится БД.
