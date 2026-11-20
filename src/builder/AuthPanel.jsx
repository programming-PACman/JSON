import { useState } from 'react';
import { api, ApiError } from '../core/api.js';
import { UI_STRINGS } from '../core/i18n.js';

// Вход / регистрация / выход. Сам ничего не хранит: пользователь приходит сверху (App),
// а сессия живёт в HttpOnly-cookie, недоступной скриптам страницы.
export default function AuthPanel({ user, locale, onUser, registrationOpen }) {
  const t = UI_STRINGS[locale];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const explain = (e) => {
    if (e instanceof ApiError) {
      if (e.status === 0) return t.authOffline;
      if (e.status === 401) return t.authBad;
      if (e.status === 409) return t.authTaken;
      if (e.status === 403) return t.authClosed;
      return e.message; // 400 / 429 — текст сервера (требования к логину/паролю, время до повтора)
    }
    return String(e?.message || e);
  };

  const submit = async (mode) => {
    if (!username.trim() || !password) { setError(t.authNeedBoth); return; }
    setBusy(true); setError('');
    try {
      const { user: u } = mode === 'login' ? await api.login(username.trim(), password) : await api.register(username.trim(), password);
      setPassword(''); setUsername('');
      onUser(u);
    } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* сервер недоступен — всё равно выходим локально */ }
    onUser(null);
  };

  if (user) {
    return (
      <div className="auth-panel auth-user" data-auth="in">
        <span className="auth-name">{t.authHello(user.username, user.role)}</span>
        <button type="button" className="secondary" onClick={logout}>{t.authLogout}</button>
      </div>
    );
  }
  return (
    <form className="auth-panel" data-auth="out" onSubmit={(e) => { e.preventDefault(); submit('login'); }}>
      <input type="text" autoComplete="username" placeholder={t.authUsername} aria-label={t.authUsername} value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" autoComplete="current-password" placeholder={t.authPassword} aria-label={t.authPassword} value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit" disabled={busy}>{t.authLogin}</button>
      {registrationOpen && <button type="button" className="secondary" disabled={busy} onClick={() => submit('register')}>{t.authRegister}</button>}
      {error && <span className="auth-error" role="alert">{error}</span>}
    </form>
  );
}
