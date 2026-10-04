// Runs student code inside a Web Worker so an infinite loop can't freeze the page.
const workerSource = `
self.onmessage = (e) => {
  const { code, fn, cases } = e.data;
  const results = [];
  let impl;
  try { impl = new Function(code + '\\n;return typeof ' + fn + ' === "function" ? ' + fn + ' : null;')(); }
  catch (err) { self.postMessage({ error: String(err) }); return; }
  if (!impl) { self.postMessage({ error: 'Function "' + fn + '" not found' }); return; }
  for (const c of cases) {
    try {
      const out = impl(...JSON.parse(JSON.stringify(c.input)));
      results.push({ ok: JSON.stringify(out) === JSON.stringify(c.expected), got: out });
    } catch (err) { results.push({ ok: false, got: String(err) }); }
  }
  self.postMessage({ results });
};`;

export function runCode(code, fn, cases, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    const w = new Worker(url);
    const done = (v) => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(v); };
    const timer = setTimeout(() => done({ error: 'Time limit exceeded (possible infinite loop)', passed: 0, total: cases.length }), timeoutMs);
    w.onmessage = (e) => {
      if (e.data.error) return done({ error: e.data.error, passed: 0, total: cases.length });
      const passed = e.data.results.filter((r) => r.ok).length;
      done({ results: e.data.results, passed, total: cases.length });
    };
    w.onerror = (e) => done({ error: e.message, passed: 0, total: cases.length });
    w.postMessage({ code, fn, cases });
  });
}
