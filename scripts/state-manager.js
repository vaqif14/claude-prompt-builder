#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'session.json');

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function loadState(sessionId = 'default') {
  ensureMemoryDir();
  const file = path.join(MEMORY_DIR, `${sessionId}.json`);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  return {
    sessionId,
    createdAt: new Date().toISOString(),
    iteration: 0,
    verified: false,
    customerId: null,
    filesSeen: [],
    filesModified: [],
    errors: [],
    agents: {},
    findings: [],
    completed: false
  };
}

function saveState(state, sessionId = 'default') {
  ensureMemoryDir();
  const file = path.join(MEMORY_DIR, `${sessionId}.json`);
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

function updateState(sessionId, updates) {
  const state = loadState(sessionId);
  Object.assign(state, updates);
  saveState(state, sessionId);
  return state;
}

function getState(sessionId = 'default') {
  return loadState(sessionId);
}

function logAudit(entry, sessionId = 'default') {
  ensureMemoryDir();
  const logFile = path.join(MEMORY_DIR, `${sessionId}.log`);
  const line = `[${new Date().toISOString()}] ${entry}\n`;
  fs.appendFileSync(logFile, line);
}

if (require.main === module) {
  const cmd = process.argv[2];
  const sessionId = process.argv[3] || 'default';
  
  if (cmd === 'load') {
    console.log(JSON.stringify(loadState(sessionId), null, 2));
  } else if (cmd === 'init') {
    saveState(loadState(sessionId), sessionId);
    console.log(`State initialized for session: ${sessionId}`);
  } else if (cmd === 'update') {
    const key = process.argv[4];
    const val = process.argv[5];
    if (!key) {
      console.error('Usage: state-manager.js update <sessionId> <key> <value>');
      process.exit(1);
    }
    const updates = {};
    updates[key] = isNaN(val) ? val : Number(val);
    updateState(sessionId, updates);
    console.log(`Updated ${key} = ${val}`);
  } else {
    console.log('Usage: state-manager.js [load|init|update] [sessionId] [key] [value]');
  }
}

const loadSession = loadState;
const saveSession = saveState;

module.exports = { loadState, saveState, updateState, getState, logAudit, loadSession, saveSession };
