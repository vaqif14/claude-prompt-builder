const path = require('path');
const { loadJson } = require('./data-loader');

function average(values) {
  const nums = values.filter(value => Number.isFinite(value));
  return nums.length ? Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 100) / 100 : 0;
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function buildStats(store) {
  const db = store.getDb();
  const outcomes = db.events.filter(event => event.type === 'outcome');
  return {
    sessions: db.sessions.length,
    generations: db.turns.length,
    perMode: countBy(db.sessions, session => session.mode),
    averageValidationScore: average(db.turns.map(turn => turn.validation_score)),
    averageEstimatedPromptTokens: average(db.turns.map(turn => turn.estimated_tokens)),
    outcomes: countBy(outcomes, event => event.outcome),
  };
}

function buildFeedbackReport(store, options = {}) {
  const dataDir = options.dataDir || path.join(__dirname, '..', 'data');
  const config = loadJson(path.join(dataDir, 'telemetry.json'));
  const windowMs = config.regeneration_window_minutes * 60_000;
  const minSamples = config.minimum_correlation_samples;
  const db = store.getDb();
  const failures = new Set(
    db.events.filter(event => event.type === 'outcome' && event.outcome === 'fail').map(event => event.session_id)
  );
  const failedSessions = db.sessions.filter(session => failures.has(session.id));
  const correlations = {
    mode: countBy(failedSessions, session => session.mode),
    stack: countBy(failedSessions, session => session.stack),
    template: countBy(failedSessions, session => session.template),
  };
  for (const group of Object.values(correlations)) {
    for (const [key, count] of Object.entries(group)) if (count < minSamples) delete group[key];
  }

  const regenerations = [];
  for (const session of db.sessions) {
    const turns = db.turns.filter(turn => turn.session_id === session.id)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    for (let i = 1; i < turns.length; i++) {
      const delta = Date.parse(turns[i].timestamp) - Date.parse(turns[i - 1].timestamp);
      if (delta >= 0 && delta <= windowMs) regenerations.push({ sessionId: session.id, minutes: Math.round(delta / 60_000) });
    }
  }

  const sectionCounts = {};
  for (const turn of db.turns) {
    if (!failures.has(turn.session_id) && !regenerations.some(item => item.sessionId === turn.session_id)) continue;
    for (const section of turn.sections || []) sectionCounts[section] = (sectionCounts[section] || 0) + 1;
  }
  const sectionsToRevisit = Object.entries(sectionCounts)
    .map(([section, signals]) => ({ section, signals }))
    .sort((a, b) => b.signals - a.signals);

  return {
    sampleCounts: {
      sessions: db.sessions.length,
      failures: failedSessions.length,
      regenerations: regenerations.length,
    },
    regenerationWindowMinutes: config.regeneration_window_minutes,
    minimumCorrelationSamples: minSamples,
    failureCorrelations: correlations,
    regenerations,
    dismissedSkillSuggestions: [],
    sectionsToRevisit,
    note: 'Correlation is not causation. This report never modifies templates automatically.',
  };
}

module.exports = { buildStats, buildFeedbackReport };
