// Хранилище на файлах (JSON). Без внешних зависимостей, запись атомарная
// (сначала во временный файл, потом rename) — обрыв посреди записи не портит данные.
import { mkdir, readFile, writeFile, rename, readdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const ID_RE = /^[a-f0-9]{12}$/;
export const newId = () => randomBytes(6).toString('hex');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJsonAtomic(file, data, mode = 0o644) {
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode });
  await rename(tmp, file);
}

// Очередь: записи, меняющие один и тот же файл, выполняются строго по одной
// (иначе два одновременных PUT словаря потеряют одно из изменений).
function makeLock() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

export async function createStorage(dataDir) {
  const specsDir = path.join(dataDir, 'specs');
  const dictFile = path.join(dataDir, 'dictionary.json');
  await mkdir(specsDir, { recursive: true });
  const dictLock = makeLock();
  const usersFile = path.join(dataDir, 'users.json');
  const sessionsFile = path.join(dataDir, 'sessions.json');
  const usersLock = makeLock();
  const sessionsLock = makeLock();
  const specLock = makeLock();

  const specFile = (id) => path.join(specsDir, `${id}.json`);

  return {
    // ---- спецификации ----
    async saveSpec(spec, ownerId = null) {
      return specLock(async () => {
        const id = newId();
        const now = new Date().toISOString();
        const record = { id, ownerId, createdAt: now, updatedAt: now, spec };
        await writeJsonAtomic(specFile(id), record);
        return record;
      });
    },
    async getSpec(id) {
      if (!ID_RE.test(id)) return null; // защита от выхода за пределы папки (../)
      return readJson(specFile(id), null);
    },
    async updateSpec(id, spec) {
      if (!ID_RE.test(id)) return null;
      return specLock(async () => {
        const current = await readJson(specFile(id), null);
        if (!current) return null;
        const record = { ...current, updatedAt: new Date().toISOString(), spec };
        await writeJsonAtomic(specFile(id), record);
        return record;
      });
    },
    async deleteSpec(id) {
      if (!ID_RE.test(id)) return false;
      return specLock(async () => {
        try { await unlink(specFile(id)); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
      });
    },
    // Список не должен ломаться из-за одного плохого файла (битый JSON, запись старого формата,
    // посторонний файл в папке): такие файлы пропускаются/достраиваются, а в лог пишется предупреждение.
    async listSpecs() {
      const files = (await readdir(specsDir)).filter((f) => f.endsWith('.json'));
      const items = await Promise.all(files.map(async (f) => {
        const id = f.slice(0, -5);
        const file = path.join(specsDir, f);
        try {
          const r = await readJson(file, null);
          if (!ID_RE.test(id) || !r || typeof r !== 'object' || !r.spec || typeof r.spec !== 'object') {
            console.warn(`[storage] пропущен файл, не похожий на спецификацию: ${f}`);
            return null;
          }
          const mtime = (await stat(file)).mtime.toISOString();
          return {
            id, ownerId: r.ownerId ?? null, title: typeof r.spec.title === 'string' ? r.spec.title : '',
            createdAt: typeof r.createdAt === 'string' ? r.createdAt : mtime,
            updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : (typeof r.createdAt === 'string' ? r.createdAt : mtime),
          };
        } catch (e) {
          console.warn(`[storage] не удалось прочитать ${f}: ${e.message}`);
          return null;
        }
      }));
      return items.filter(Boolean).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
    },

    // ---- пользователи и сессии (файлы доступны только владельцу процесса: режим 0600) ----
    async getUsers() { return readJson(usersFile, []); },
    // update(текущий список) -> новый список; вся операция атомарна (проверка уникальности логина без гонок)
    async updateUsers(update) {
      return usersLock(async () => {
        const next = update(await readJson(usersFile, []));
        await writeJsonAtomic(usersFile, next, 0o600);
        return next;
      });
    },
    async getSessions() { return readJson(sessionsFile, {}); },
    async updateSessions(update) {
      return sessionsLock(async () => {
        const next = update(await readJson(sessionsFile, {}));
        await writeJsonAtomic(sessionsFile, next, 0o600);
        return next;
      });
    },

    // ---- общий словарь: читаем/меняем только под блокировкой ----
    async getDictionary() {
      return readJson(dictFile, {});
    },
    // update(текущий) -> новый словарь; вся операция атомарна относительно других записей
    async updateDictionary(update) {
      return dictLock(async () => {
        const current = await readJson(dictFile, {});
        const next = update(current);
        await writeJsonAtomic(dictFile, next);
        return next;
      });
    },
  };
}
