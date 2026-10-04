import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { authenticate } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', college: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await authenticate(mode, form); nav('/dashboard'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const input = 'w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-(--color-fg) outline-none focus:border-(--color-accent)';
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold text-(--color-fg)">{mode === 'login' ? 'Log in to take tests' : 'Create your student account'}</h1>
      <p className="mt-2 text-(--color-fg-muted)">Take coding tests, see your rank, and climb the leaderboard.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === 'register' && (
          <>
            <input className={input} placeholder="Full name" value={form.name} onChange={set('name')} required />
            <input className={input} placeholder="College" value={form.college} onChange={set('college')} />
          </>
        )}
        <input className={input} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input className={input} type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set('password')} required />
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-(--color-accent) px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="mt-4 text-sm text-(--color-fg-muted) underline">
        {mode === 'login' ? 'New here? Create an account' : 'Already registered? Log in'}
      </button>
    </main>
  );
}
