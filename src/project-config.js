/**
 * Project Config
 * Tiny persistent per-project preferences in `.prompt-builder/config.json`:
 *   - discoverEnabled: has the user opted into ecosystem discovery for this project?
 *   - dismissedSkills: skill names the user told us to stop suggesting.
 * Best-effort, atomic (temp+rename), 0600. Never throws on a read/write failure — a missing or
 * unreadable config degrades to defaults so prompt generation is never blocked on local storage.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CACHE_DIR = '.prompt-builder';
const CONFIG_FILE = 'config.json';

function configPath(cwd, cacheDir = DEFAULT_CACHE_DIR) {
  return path.join(cwd || process.cwd(), cacheDir, CONFIG_FILE);
}

function readConfig(cwd, cacheDir) {
  const p = configPath(cwd, cacheDir);
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      discoverEnabled: Boolean(raw.discoverEnabled),
      dismissedSkills: Array.isArray(raw.dismissedSkills) ? raw.dismissedSkills.map(String) : [],
      updatedAt: raw.updatedAt || null,
    };
  } catch (_) {
    return { discoverEnabled: false, dismissedSkills: [], updatedAt: null };
  }
}

function writeConfig(cwd, patch, cacheDir) {
  const p = configPath(cwd, cacheDir);
  const current = readConfig(cwd, cacheDir);
  const next = {
    discoverEnabled: patch.discoverEnabled !== undefined ? Boolean(patch.discoverEnabled) : current.discoverEnabled,
    dismissedSkills: patch.dismissedSkills !== undefined ? [...new Set(patch.dismissedSkills.map(String))] : current.dismissedSkills,
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch (_) { /* best-effort */ }
  return next;
}

function setDiscoverEnabled(cwd, enabled, cacheDir) {
  return writeConfig(cwd, { discoverEnabled: enabled }, cacheDir);
}

function dismissSkill(cwd, skillName, cacheDir) {
  const cfg = readConfig(cwd, cacheDir);
  if (!skillName) return cfg;
  const set = new Set(cfg.dismissedSkills);
  set.add(String(skillName));
  return writeConfig(cwd, { dismissedSkills: [...set] }, cacheDir);
}

function isDismissed(cwd, skillName, cacheDir) {
  if (!skillName) return false;
  return readConfig(cwd, cacheDir).dismissedSkills.includes(String(skillName));
}

module.exports = { configPath, readConfig, writeConfig, setDiscoverEnabled, dismissSkill, isDismissed };
