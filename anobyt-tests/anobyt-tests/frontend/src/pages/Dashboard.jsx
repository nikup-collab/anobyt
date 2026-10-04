import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TESTS } from '../data/tests';

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { if (user) api('/me').then(setData).catch((e) => setError(e.message)); }, [user]);
  if (loading) return <p className="p-8 text-(--color-fg-muted)">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  const attemptOf = (id) => data?.attempts.find((a) => a.testId === id);
  const best = data?.attempts.reduce((m, a) => (a.rank && (!m || a.rank < m) ? a.rank : m), null);
  const totalScore = data?.attempts.reduce((s, a) => s + a.score, 0) ?? 0;
  const card = 'rounded-xl border border-(--color-border) bg-(--color-card) p-5';

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-(--color-fg)">Hi {user.name.split(' ')[0]}</h1>
          <p className="text-(--color-fg-muted)">{user.college || 'Student'}</p>
        </div>
        <button onClick={logout} className="text-sm text-(--color-fg-muted) underline">Log out</button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className={card}><p className="text-sm text-(--color-fg-muted)">Tests taken</p><p className="text-3xl font-bold text-(--color-fg)">{data?.attempts.length ?? '–'}</p></div>
        <div className={card}><p className="text-sm text-(--color-fg-muted)">Total points</p><p className="text-3xl font-bold text-(--color-fg)">{Math.round(totalScore)}</p></div>
        <div className={card}><p className="text-sm text-(--color-fg-muted)">Best rank</p><p className="text-3xl font-bold text-(--color-fg)">{best ? `#${best}` : '–'}</p></div>
      </div>

      {error && <p role="alert" className="mt-4 text-red-500">{error}</p>}

      <h2 className="mt-10 text-xl font-semibold text-(--color-fg)">Tests</h2>
      <div className="mt-3 space-y-3">
        {Object.entries(TESTS).map(([id, t]) => {
          const a = attemptOf(id);
          return (
            <div key={id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className="font-semibold text-(--color-fg)">{t.title}</p>
                <p className="text-sm text-(--color-fg-muted)">{t.blurb}</p>
                {a && <p className="mt-1 text-sm text-(--color-fg)">Score {a.score} · Rank #{a.rank} of {a.participants} · {Math.floor(a.timeSec / 60)}m {a.timeSec % 60}s</p>}
              </div>
              <div className="flex gap-2">
                <Link to={`/leaderboard/${id}`} className="rounded-lg border border-(--color-border) px-4 py-2 text-(--color-fg)">Leaderboard</Link>
                {!a && <Link to={`/test/${id}`} className="rounded-lg bg-(--color-accent) px-4 py-2 font-semibold text-white">{data?.started.some((s) => s.testId === id) ? 'Resume test' : 'Start test'}</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
