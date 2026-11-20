import { useState, useEffect } from 'react';
import { api, ApiError } from '../core/api.js';
import { UI_STRINGS } from '../core/i18n.js';

// Вкладка администратора: создание пользователей и их список.
export default function UsersPanel({ locale, currentUserId }) {
  const t = UI_STRINGS[locale];
  const [users, setUsers] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [message, setMessage] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // кого сейчас подтверждаем к удалению

  const reload = async () => {
    try { setUsers(await api.listUsers()); } catch (e) { setMessage({ kind: 'error', text: explain(e) }); }
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const explain = (e) => {
    if (e instanceof ApiError && e.status === 0) return t.authOffline;
    if (e instanceof ApiError && e.status === 409) return t.authTaken;
    return e?.message || String(e); // 400 — требования к логину/паролю текстом сервера
  };

  const create = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setMessage({ kind: 'error', text: t.authNeedBoth }); return; }
    try {
      const { user } = await api.createUser(username.trim(), password, role);
      setMessage({ kind: 'ok', text: t.usersCreated(user.username) });
      setUsername(''); setPassword(''); setRole('editor');
      reload();
    } catch (err) { setMessage({ kind: 'error', text: explain(err) }); }
  };

  const remove = async (u) => {
    try {
      await api.deleteUser(u.id);
      setMessage({ kind: 'ok', text: t.usersDeleted(u.username) });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof ApiError && e.status === 404 ? '' : explain(e) }); // 404 — уже удалён другим админом
    }
    setConfirmId(null);
    reload();
  };

  return (
    <div className="users-panel">
      <p className="dictionary-hint">{t.usersHint}</p>
      <form className="users-add" onSubmit={create}>
        <input type="text" autoComplete="off" placeholder={t.authUsername} aria-label={t.authUsername} value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" autoComplete="new-password" placeholder={t.authPassword} aria-label={t.authPassword} value={password} onChange={(e) => setPassword(e.target.value)} />
        <select aria-label={t.usersRole} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="editor">{t.roleEditor}</option>
          <option value="admin">{t.roleAdmin}</option>
        </select>
        <button type="submit">{t.usersCreate}</button>
      </form>
      {message && <p className={message.kind === 'ok' ? 'server-ok' : 'server-error'} role="status">{message.text}</p>}
      {users && users.length === 0 && <p className="dictionary-empty">{t.usersEmpty}</p>}
      {users && users.length > 0 && (
        <table className="dictionary-table users-table">
          <thead><tr><th>{t.authUsername}</th><th>{t.usersRole}</th><th>{t.usersCreatedAt}</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}><td><code>{u.username}</code></td><td>{u.role}</td><td>{new Date(u.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB')}</td>
                <td>
                  {u.id === currentUserId ? <span className="dictionary-hint">{t.usersYou}</span>
                    : confirmId === u.id ? (
                      <span className="users-confirm" role="group" aria-label={t.usersConfirmDelete(u.username)}>
                        <span>{t.usersConfirmDelete(u.username)}</span>
                        <button type="button" className="danger" onClick={() => remove(u)}>{t.usersConfirmYes}</button>
                        <button type="button" className="secondary" onClick={() => setConfirmId(null)}>{t.usersCancel}</button>
                      </span>
                    ) : <button type="button" className="secondary" aria-label={`${t.usersDelete} ${u.username}`} onClick={() => setConfirmId(u.id)}>{t.usersDelete}</button>}
                </td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
