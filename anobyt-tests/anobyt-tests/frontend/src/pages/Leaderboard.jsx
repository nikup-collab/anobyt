import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Leaderboard() {
  const { testId } = useParams();
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let stop = false;
    const load = () => api(`/leaderboard?testId=${testId}`).then((d) => !stop && setData(d)).catch((e) => !stop && setError(e.message));
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000); // refresh every 20s
    return () => { stop = true; clearInterval(t); };
  }, [user, testId]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const medal = (r) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`);
  const fmt = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/dashboard" className="text-sm text-(--color-fg-muted) underline">Back to dashboard</Link>
      <h1 className="mt-3 text-3xl font-bold text-(--color-fg)">{data?.title ?? 'Leaderboard'}</h1>
      {data && <p className="text-(--color-fg-muted)">{data.participants} students have submitted. Ties are broken by faster time.</p>}
      {error && <p role="alert" className="mt-4 text-red-500">{error}</p>}
      {data?.me && <div className="mt-5 rounded-xl border border-(--color-accent) bg-(--color-card) p-4 text-(--color-fg)">You are {medal(data.me.rank)} with {data.me.score} points in {fmt(data.me.timeSec)}.</div>}
      {data && data.top.length === 0 && <p className="mt-6 text-(--color-fg-muted)">No submissions yet. Be the first on the board.</p>}
      <ol className="mt-6 divide-y divide-(--color-border) overflow-hidden rounded-xl border border-(--color-border) bg-(--color-card)">
        {data?.top.map((r) => (
          <li key={r.rank} className={`flex items-center gap-4 px-4 py-3 ${data.me?.rank === r.rank ? 'bg-(--color-surface)' : ''}`}>
            <span className="w-10 text-lg">{medal(r.rank)}</span>
            <span className="flex-1"><span className="font-medium text-(--color-fg)">{r.name}</span><span className="block text-sm text-(--color-fg-muted)">{r.college}</span></span>
            <span className="text-right"><span className="font-semibold text-(--color-fg)">{r.score}</span><span className="block text-sm text-(--color-fg-muted)">{fmt(r.timeSec)}</span></span>
          </li>
        ))}
      </ol>
    </main>
  );
}
