const fs = require('fs');
const path = require('path');
const os = require('os');

const DB_DIR = path.join(os.homedir(), '.prompt-builder');
const STORE_PATH = path.join(DB_DIR, 'sessions.json');

function ensureStoreDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function emptyStore() {
  return { sessions: [], turns: [], artifacts: [] };
}

function loadStore() {
  ensureStoreDir();
  if (!fs.existsSync(STORE_PATH)) return emptyStore();
  try {
    const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return {
      sessions: Array.isArray(store.sessions) ? store.sessions : [],
      turns: Array.isArray(store.turns) ? store.turns : [],
      artifacts: Array.isArray(store.artifacts) ? store.artifacts : [],
    };
  } catch (_) {
    return emptyStore();
  }
}

function saveStore(store) {
  ensureStoreDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSession(task, mode, stack, id) {
  const store = loadStore();
  const sessionId = id || generateSessionId();
  const now = new Date().toISOString();
  const existing = store.sessions.find(session => session.id === sessionId);
  if (existing) {
    existing.task = task;
    existing.mode = mode || null;
    existing.stack = stack || null;
    existing.updated_at = now;
  } else {
    store.sessions.push({
      id: sessionId,
      task,
      mode: mode || null,
      stack: stack || null,
      created_at: now,
      updated_at: now,
    });
  }
  saveStore(store);
  return sessionId;
}

function saveTurn(sessionId, prompt, output, score) {
  const store = loadStore();
  const now = new Date().toISOString();
  store.turns.push({
    id: store.turns.length + 1,
    session_id: sessionId,
    prompt: prompt || null,
    output: output || null,
    validation_score: score != null ? score : null,
    timestamp: now,
  });
  const session = store.sessions.find(item => item.id === sessionId);
  if (session) session.updated_at = now;
  saveStore(store);
}

function getSession(sessionId) {
  const store = loadStore();
  const session = store.sessions.find(item => item.id === sessionId);
  if (!session) return null;

  const turns = store.turns
    .filter(item => item.session_id === sessionId)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  const artifacts = store.artifacts
    .filter(item => item.session_id === sessionId)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  return { ...session, turns, artifacts };
}

function listSessions(limit = 10) {
  const store = loadStore();
  return [...store.sessions]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, limit);
}

function resumeSession(sessionId) {
  const store = loadStore();
  const session = store.sessions.find(item => item.id === sessionId);
  if (!session) return null;

  const lastTurn = store.turns
    .filter(item => item.session_id === sessionId)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0];

  return {
    session,
    lastTurn: lastTurn || null,
  };
}

function close() {
  return true;
}

function getDb() {
  return loadStore();
}

module.exports = {
  createSession,
  saveTurn,
  getSession,
  listSessions,
  resumeSession,
  close,
  getDb,
};
