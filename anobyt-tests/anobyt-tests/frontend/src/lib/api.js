const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

export const getToken = () => localStorage.getItem('anobyt_token');
export const setToken = (t) => (t ? localStorage.setItem('anobyt_token', t) : localStorage.removeItem('anobyt_token'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries on 429/503/network errors with jittered backoff, so a burst of 300 students settles itself.
export async function api(path, { method = 'GET', body } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(BASE + path, {
        method,
        headers: { 'content-type': 'application/json', ...(getToken() && { authorization: `Bearer ${getToken()}` }) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if ((r.status === 429 || r.status === 503) && attempt < 4) {
        await sleep(400 * 2 ** attempt + Math.random() * 600);
        continue;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) setToken(null);
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } catch (e) {
      if (e instanceof TypeError && attempt < 4) { await sleep(400 * 2 ** attempt + Math.random() * 600); continue; }
      throw e;
    }
  }
}
