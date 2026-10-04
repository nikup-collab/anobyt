import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { TESTS } from './tests.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE;
const SECRET = process.env.JWT_SECRET;
const scryptP = promisify(scrypt);
const GRACE_SEC = 30;

// ---------- tiny helpers ----------
const res = (status, body, extra = {}) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', ...extra },
  body: JSON.stringify(body),
});
const fail = (status, error) => { const e = new Error(error); e.status = status; throw e; };

const b64 = (b) => Buffer.from(b).toString('base64url');
function signToken(email, name) {
  const payload = b64(JSON.stringify({ email, name, exp: Date.now() + 7 * 864e5 }));
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(header) {
  const token = (header || '').replace(/^Bearer /i, '');
  const [payload, sig] = token.split('.');
  if (!payload || !sig) fail(401, 'Please log in again');
  const good = createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) fail(401, 'Please log in again');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.exp < Date.now()) fail(401, 'Session expired, please log in again');
  return data;
}
async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scryptP(pw, salt, 32);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}
async function checkPassword(pw, stored) {
  const [salt, key] = stored.split(':');
  const test = await scryptP(pw, Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(test, Buffer.from(key, 'hex'));
}
const clean = (s, max) => String(s ?? '').trim().slice(0, max);

// ---------- leaderboard (cached per warm container to protect DynamoDB) ----------
const boardCache = new Map(); // testId -> { at, rows }
async function getBoard(testId) {
  const hit = boardCache.get(testId);
  if (hit && Date.now() - hit.at < 8000) return hit.rows;
  const out = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `LB#${testId}` },
    Limit: 1000,
  }));
  const rows = (out.Items || []).map((it, i) => ({
    rank: i + 1, email: it.email, name: it.name, college: it.college,
    score: it.score, timeSec: it.timeSec,
  }));
  boardCache.set(testId, { at: Date.now(), rows });
  return rows;
}
const publicRow = ({ email, ...r }) => r;

// ---------- route handlers ----------
async function register(body) {
  const email = clean(body.email, 120).toLowerCase();
  const name = clean(body.name, 60);
  const college = clean(body.college, 80);
  const password = String(body.password ?? '');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'Enter a valid email');
  if (!name) fail(400, 'Enter your name');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters');
  try {
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: { PK: `USER#${email}`, SK: 'PROFILE', email, name, college,
              passHash: await hashPassword(password), createdAt: Date.now() },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') fail(409, 'This email is already registered');
    throw e;
  }
  return { token: signToken(email, name), user: { email, name, college } };
}

async function login(body) {
  const email = clean(body.email, 120).toLowerCase();
  const out = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${email}`, SK: 'PROFILE' } }));
  const u = out.Item;
  if (!u || !(await checkPassword(String(body.password ?? ''), u.passHash))) fail(401, 'Wrong email or password');
  return { token: signToken(email, u.name), user: { email, name: u.name, college: u.college } };
}

async function me(auth) {
  const out = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${auth.email}` },
  }));
  const items = out.Items || [];
  const profile = items.find((i) => i.SK === 'PROFILE');
  if (!profile) fail(401, 'Please log in again');
  const attempts = [];
  for (const it of items.filter((i) => i.SK.startsWith('ATTEMPT#'))) {
    const board = await getBoard(it.testId);
    const mine = board.find((r) => r.email === auth.email);
    attempts.push({ testId: it.testId, score: it.score, timeSec: it.timeSec, submittedAt: it.submittedAt,
                    rank: mine?.rank ?? null, participants: board.length });
  }
  const started = items.filter((i) => i.SK.startsWith('START#'))
    .map((i) => ({ testId: i.testId, startedAt: i.startedAt }));
  return { user: { email: profile.email, name: profile.name, college: profile.college }, attempts, started };
}

function getTest(testId) {
  const t = TESTS[testId];
  if (!t) fail(404, 'Test not found');
  const now = Date.now();
  if (t.opensAt && now < Date.parse(t.opensAt)) fail(403, 'This test has not opened yet');
  if (t.closesAt && now > Date.parse(t.closesAt)) fail(403, 'This test is closed');
  return t;
}

async function startTest(auth, body) {
  const testId = clean(body.testId, 40);
  const t = getTest(testId);
  const done = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${auth.email}`, SK: `ATTEMPT#${testId}` } }));
  if (done.Item) fail(409, 'You have already submitted this test');
  const startedAt = Date.now();
  try {
    await db.send(new PutCommand({
      TableName: TABLE,
      Item: { PK: `USER#${auth.email}`, SK: `START#${testId}`, testId, startedAt },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  } catch (e) {
    if (e.name !== 'ConditionalCheckFailedException') throw e;
    const prev = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${auth.email}`, SK: `START#${testId}` } }));
    return { startedAt: prev.Item.startedAt, durationSec: t.durationSec, serverNow: Date.now() }; // resume after refresh
  }
  return { startedAt, durationSec: t.durationSec, serverNow: Date.now() };
}

async function submitTest(auth, body) {
  const testId = clean(body.testId, 40);
  const t = getTest(testId);
  const startItem = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${auth.email}`, SK: `START#${testId}` } }));
  if (!startItem.Item) fail(400, 'Start the test before submitting');
  const now = Date.now();
  const elapsed = Math.round((now - startItem.Item.startedAt) / 1000);
  if (elapsed > t.durationSec + GRACE_SEC) fail(403, 'Time is over for this test');
  const timeSec = Math.min(elapsed, t.durationSec);

  // score = points * passed/total, per question, using only known question ids
  let score = 0;
  const saved = {};
  for (const [qid, points] of Object.entries(t.questions)) {
    const a = (body.answers || {})[qid];
    if (!a) continue;
    const total = Math.max(1, Math.min(50, parseInt(a.total, 10) || 1));
    const passed = Math.max(0, Math.min(total, parseInt(a.passed, 10) || 0));
    score += (points * passed) / total;
    saved[qid] = { passed, total, code: clean(a.code, 5000) };
  }
  score = Math.round(score * 100) / 100;

  const inv = String(1_000_000 - Math.round(score * 100)).padStart(7, '0'); // higher score sorts first
  const lbSk = `${inv}#${String(timeSec).padStart(6, '0')}#${auth.email}`; // faster time breaks ties
  const profile = await db.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${auth.email}`, SK: 'PROFILE' } }));
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: TABLE, ConditionExpression: 'attribute_not_exists(PK)',
          Item: { PK: `USER#${auth.email}`, SK: `ATTEMPT#${testId}`, testId, score, timeSec,
                  submittedAt: now, answers: saved } } },
      { Put: { TableName: TABLE,
          Item: { PK: `LB#${testId}`, SK: lbSk, email: auth.email, name: auth.name,
                  college: profile.Item?.college || '', score, timeSec } } },
    ] }));
  } catch (e) {
    if (e.name === 'TransactionCanceledException') fail(409, 'You have already submitted this test');
    throw e;
  }
  boardCache.delete(testId);
  const board = await getBoard(testId);
  const mine = board.find((r) => r.email === auth.email);
  return { score, timeSec, rank: mine?.rank ?? null, participants: board.length };
}

async function leaderboard(auth, query) {
  const testId = clean(query.testId, 40);
  if (!TESTS[testId]) fail(404, 'Test not found');
  const board = await getBoard(testId);
  const mine = board.find((r) => r.email === auth.email);
  return {
    testId, title: TESTS[testId].title, participants: board.length,
    top: board.slice(0, 50).map(publicRow),
    me: mine ? publicRow(mine) : null,
  };
}

// ---------- entry point ----------
export const handler = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath.replace(/\/+$/, '') || '/';
    const body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {};
    const key = `${method} ${path}`;
    const authed = () => verifyToken(event.headers?.authorization);

    switch (key) {
      case 'POST /register': return res(200, await register(body));
      case 'POST /login': return res(200, await login(body));
      case 'GET /me': return res(200, await me(authed()));
      case 'POST /tests/start': return res(200, await startTest(authed(), body));
      case 'POST /tests/submit': return res(200, await submitTest(authed(), body));
      case 'GET /leaderboard':
        return res(200, await leaderboard(authed(), event.queryStringParameters || {}),
          { 'cache-control': 'private, max-age=5' });
      default: return res(404, { error: 'Not found' });
    }
  } catch (e) {
    if (e.status) return res(e.status, { error: e.message });
    if (e.name === 'ProvisionedThroughputExceededException') return res(503, { error: 'Busy, retrying' }, { 'retry-after': '1' });
    console.error(e);
    return res(500, { error: 'Something went wrong' });
  }
};
