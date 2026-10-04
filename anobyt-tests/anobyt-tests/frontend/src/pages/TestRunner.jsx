import { useEffect, useRef, useState, useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TESTS } from '../data/tests';
import { runCode } from '../lib/runner';

export default function TestRunner() {
  const { testId } = useParams();
  const test = TESTS[testId];
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState('loading'); // loading | running | submitting | error
  const [error, setError] = useState('');
  const [left, setLeft] = useState(test?.durationSec ?? 0);
  const [active, setActive] = useState(0);
  const [code, setCode] = useState(() => Object.fromEntries((test?.questions ?? []).map((q) => [q.id, q.starter])));
  const [results, setResults] = useState({}); // qid -> {passed,total,error}
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  const submitted = useRef(false);
  const codeRef = useRef(code); codeRef.current = code;

  useEffect(() => {
    if (!user || !test) return;
    api('/tests/start', { method: 'POST', body: { testId } })
      .then((d) => {
        deadline.current = Date.now() + (d.startedAt + d.durationSec * 1000 - d.serverNow); // anchored to the server clock
        const saved = sessionStorage.getItem(`draft:${testId}`);
        if (saved) setCode((c) => ({ ...c, ...JSON.parse(saved) }));
        setState('running');
      })
      .catch((e) => { setError(e.message); setState('error'); });
  }, [user, test, testId]);

  useEffect(() => { if (state === 'running') sessionStorage.setItem(`draft:${testId}`, JSON.stringify(code)); }, [code, state, testId]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setState('submitting');
    try {
      // re-run every question so the score reflects the final code
      const answers = {};
      for (const q of test.questions) {
        const r = await runCode(codeRef.current[q.id], q.fn, q.cases);
        answers[q.id] = { passed: r.passed, total: r.total, code: codeRef.current[q.id] };
      }
      await api('/tests/submit', { method: 'POST', body: { testId, answers } });
      sessionStorage.removeItem(`draft:${testId}`);
      nav(`/leaderboard/${testId}`, { replace: true });
    } catch (e) { submitted.current = false; setError(e.message); setState('error'); }
  }, [nav, test, testId]);

  useEffect(() => {
    if (state !== 'running') return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit();
    }, 500);
    return () => clearInterval(t);
  }, [state, submit]);

  if (!test) return <p className="p-8 text-(--color-fg)">Test not found.</p>;
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (state === 'error') return (
    <main className="mx-auto max-w-md p-8">
      <p role="alert" className="text-red-500">{error}</p>
      <button onClick={() => nav('/dashboard')} className="mt-4 underline text-(--color-fg)">Back to dashboard</button>
      {submitted.current === false && /busy|wrong|failed|network/i.test(error) && <button onClick={submit} className="ml-4 underline text-(--color-fg)">Try submitting again</button>}
    </main>
  );
  if (state === 'loading' || state === 'submitting') return <p className="p-8 text-(--color-fg-muted)">{state === 'loading' ? 'Starting test…' : 'Submitting your answers…'}</p>;

  const q = test.questions[active];
  const run = async () => {
    setRunning(true);
    const r = await runCode(code[q.id], q.fn, q.cases);
    setResults((x) => ({ ...x, [q.id]: r }));
    setRunning(false);
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  const r = results[q.id];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-(--color-fg)">{test.title}</h1>
        <p className={`font-mono text-lg ${left < 120 ? 'text-red-500' : 'text-(--color-fg)'}`}>{mm}:{ss}</p>
      </div>
      <div className="mt-4 flex gap-2">
        {test.questions.map((x, i) => (
          <button key={x.id} onClick={() => setActive(i)} className={`rounded-lg border px-3 py-1.5 text-sm ${i === active ? 'border-(--color-accent) text-(--color-fg)' : 'border-(--color-border) text-(--color-fg-muted)'}`}>
            Q{i + 1}{results[x.id] && ` · ${results[x.id].passed}/${results[x.id].total}`}
          </button>
        ))}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-(--color-fg)">{q.title} <span className="text-sm font-normal text-(--color-fg-muted)">({q.points} points)</span></h2>
      <p className="mt-1 text-(--color-fg-muted)">{q.prompt}</p>
      <textarea
        value={code[q.id]} onChange={(e) => setCode({ ...code, [q.id]: e.target.value })}
        spellCheck={false} rows={12}
        onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; setCode({ ...code, [q.id]: t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd) }); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); } }}
        className="mt-4 w-full rounded-lg border border-(--color-border) bg-(--color-surface) p-3 font-mono text-sm text-(--color-fg) outline-none focus:border-(--color-accent)"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running} className="rounded-lg border border-(--color-border) px-4 py-2 text-(--color-fg) disabled:opacity-60">{running ? 'Running…' : 'Run tests'}</button>
        <button onClick={() => { if (confirm('Submit now? You cannot retake this test.')) submit(); }} className="rounded-lg bg-(--color-accent) px-4 py-2 font-semibold text-white">Submit test</button>
      </div>
      {r && (
        <div className="mt-4 rounded-lg border border-(--color-border) bg-(--color-card) p-4 text-sm">
          {r.error ? <p className="text-red-500">{r.error}</p> : (
            <>
              <p className="font-semibold text-(--color-fg)">{r.passed} of {r.total} test cases passed</p>
              <ul className="mt-2 space-y-1 text-(--color-fg-muted)">
                {r.results.map((x, i) => <li key={i}>{x.ok ? 'Passed' : 'Failed'} · input {JSON.stringify(q.cases[i].input).slice(0, 60)}{!x.ok && ` · got ${JSON.stringify(x.got)?.slice(0, 60)}`}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </main>
  );
}
