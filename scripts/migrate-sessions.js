#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createSession, saveTurn, getDb, close } = require('../src/session-store');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');

function migrate() {
  if (!fs.existsSync(MEMORY_DIR)) {
    console.log('No memory directory found; nothing to migrate.');
    process.exit(0);
  }

  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No JSON session files found; nothing to migrate.');
    process.exit(0);
  }

  // Ensure schema is initialized
  getDb();

  let migrated = 0;
  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.warn(`  ⚠ Skipping invalid JSON: ${file}`);
      continue;
    }

    const sessionId = data.sessionId || file.replace('.json', '');
    const task = data.task || 'Migrated session';
    const mode = data.mode || null;
    const stack = data.stack || null;

    // Check if already migrated (by id collision)
    const { getSession } = require('../src/session-store');
    if (getSession(sessionId)) {
      console.log(`  ⏭ Already migrated: ${sessionId}`);
      continue;
    }

    const db = getDb();
    const insert = db.prepare(
      'INSERT INTO sessions (id, task, mode, stack, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insert.run(
      sessionId,
      task,
      mode,
      stack,
      data.createdAt || new Date().toISOString(),
      data.lastUpdated || new Date().toISOString()
    );

    // Save a synthetic turn with whatever state we have
    const output = JSON.stringify({
      iteration: data.iteration,
      verified: data.verified,
      completed: data.completed,
      findings: data.findings,
      agents: data.agents,
    });
    saveTurn(sessionId, null, output, null);

    migrated++;
    console.log(`  ✓ Migrated: ${sessionId}`);
  }

  close();
  console.log(`\nMigration complete: ${migrated} session(s) migrated.`);
}

migrate();
