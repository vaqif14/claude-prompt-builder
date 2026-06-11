const path = require('path');
const { loadCsv, validateRows } = require('./data-loader');
const { selectModel } = require('./model-router');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');
const REQUIRED = [
  'id', 'role', 'core_belief', 'scope', 'out_of_scope',
  'required_evidence', 'primary_skill', 'triggers',
];

function loadAgentCards(dataDir = DEFAULT_DATA_DIR) {
  const file = path.join(dataDir, 'agents.csv');
  const rows = loadCsv(file, { header: true, requiredColumns: REQUIRED });
  validateRows(rows, { required: REQUIRED, unique: 'id' }, file);
  return rows;
}

function selectAgentCards(task, mode, complexity, options = {}, surface = {}, platforms = [], dataDir) {
  const lower = String(task).toLowerCase();
  const cards = loadAgentCards(dataDir);
  const byId = new Map(cards.map(card => [card.id, card]));
  const selected = [];
  const add = id => {
    const card = byId.get(id);
    if (card && !selected.some(item => item.id === id)) selected.push(card);
  };

  const ids = new Set(platforms.map(platform => platform.id));
  const nativeMobile = ['ios', 'android', 'flutter', 'react-native'].some(id => ids.has(id));
  const hasWeb = ids.has('web');

  if (/\b(?:design|ui|ux|dashboard|pages?|screen|visual|layout)\b/.test(lower)) {
    add('design-lead');
    if (hasWeb || ids.size === 0 || /\b(?:admin|dashboard|enterprise)\b/.test(lower)) add('enterprise-ui');
  }

  let platformAdded = false;
  for (const id of ids) {
    const cardId = `platform-${id}`;
    if (byId.has(cardId)) {
      add(cardId);
      platformAdded = true;
    }
  }
  if (!platformAdded) add(surface.isService && !surface.isUi ? 'platform-backend' : 'platform-web');

  if (mode === 'audit' || /\b(?:review|audit|verify|confirm|working|qa)\b/.test(lower)) {
    add(nativeMobile && !hasWeb ? 'qa-device' : 'qa-browser');
    add('verification');
  }
  if (mode === 'security-review' || /\b(?:security|auth|jwt|xss|csrf)\b/.test(lower)) add('security');
  if (mode === 'performance-review' || /\b(?:performance|slow|optimize|lag)\b/.test(lower)) add('performance');
  if (mode === 'architecture-review' || /\b(?:architecture|hexagonal|clean|domain)\b/.test(lower)) add('architecture');
  if (/\b(?:database|db|migrations?|schema|sql|postgres|mongo(?:db)?|redis|prisma|typeorm|jpa)\b/.test(lower)) add('platform-db');
  if (/\b(?:microservices?|grpc|kafka|rabbitmq|events?|integration|webhook)\b/.test(lower)) add('integration');
  if (/\b(?:devops|deploy|ci|cd|pipeline|docker|kubernetes|infra)\b/.test(lower)) add('platform-devops');

  return selected.map(card => ({
    id: card.id,
    name: card.role,
    role: card.role,
    mission: card.scope,
    scope: card.scope,
    coreBelief: card.core_belief,
    outOfScope: card.out_of_scope,
    output: card.required_evidence,
    requiredEvidence: card.required_evidence,
    primarySkill: card.primary_skill,
    model: selectModel(task, complexity, options),
  }));
}

module.exports = { loadAgentCards, selectAgentCards, REQUIRED };
