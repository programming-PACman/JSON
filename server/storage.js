// Хранилище на файлах (JSON). Без внешних зависимостей, запись атомарная
// (сначала во временный файл, потом rename) — обрыв посреди записи не портит данные.
import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
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

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
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
  const specLock = makeLock();

  const specFile = (id) => path.join(specsDir, `${id}.json`);

  return {
    // ---- спецификации ----
    async saveSpec(spec) {
      return specLock(async () => {
        const id = newId();
        const now = new Date().toISOString();
        const record = { id, createdAt: now, updatedAt: now, spec };
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
        const record = { ...current, updatedAt: current, spec };
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
    async listSpecs() {
      const files = (await readdir(specsDir)).filter((f) => f.endsWith('.json'));
      const records = await Promise.all(files.map((f) => readJson(path.join(specsDir, f), null)));
      return records
        .filter(Boolean)
        .map((r) => ({ id: r.id, title: r.spec?.title ?? '', createdAt: r.createdAt, updatedAt: r.updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
