#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadAgents(dataDir = path.join(__dirname, '..', 'data')) {
  const file = path.join(dataDir, 'agents.csv');
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (parts[i] || '').trim());
    return obj;
  });
}

function matchAgents(taskDescription, agents) {
  const task = taskDescription.toLowerCase();
  // Multi-language keyword mapping
  const keywordMap = {
    'design': ['design', 'dizayn', 'tasarim', 'ui', 'ux', 'layout', 'color', 'typography'],
    'security': ['security', 'auth', 'validation', 'secret', 'cve', 'xss', 'csrf', 'input'],
    'test': ['test', 'testing', 'coverage', 'jest', 'playwright', 'e2e', 'unit'],
    'performance': ['performance', 'bundle', 'render', 'query', 'cache', 'slow', 'optimize'],
    'frontend': ['frontend', 'component', 'react', 'nextjs', 'vue', 'hook', 'state'],
    'backend': ['backend', 'java', 'spring', 'api', 'controller', 'service', 'repository'],
    'database': ['database', 'migration', 'schema', 'flyway', 'liquibase', 'sql'],
    'infrastructure': ['docker', 'k8s', 'kubernetes', 'nginx', 'infra', 'deploy']
  };
  
  const scores = agents.map(agent => {
    let score = 0;
    const triggers = agent.triggers.toLowerCase().split(' ');
    for (const trigger of triggers) {
      if (task.includes(trigger)) score += 1;
    }
    // Domain-specific boosts with keyword mapping
    for (const [domainKey, keywords] of Object.entries(keywordMap)) {
      for (const kw of keywords) {
        if (task.includes(kw)) {
          if (agent.domain === domainKey) score += 3;
          if (agent.domain.startsWith(domainKey)) score += 2;
        }
      }
    }
    return { ...agent, score };
  });
  
  return scores.filter(a => a.score > 0).sort((a, b) => b.score - a.score);
}

function generateAgentPrompts(taskDescription, context = {}) {
  const agents = loadAgents();
  const matched = matchAgents(taskDescription, agents);
  
  const prompts = matched.map(agent => ({
    domain: agent.domain,
    skill: agent.skill_name,
    type: agent.agent_type,
    prompt: `You are a ${agent.domain} specialist agent. Task: Analyze ${taskDescription}.

Context:
- Project stack: ${context.stack || 'unknown'}
- Relevant files: ${context.files || 'to be discovered'}
- Patterns: ${context.patterns || 'follow project conventions'}

Skill to follow:
Read ${agent.skill_name}/SKILL.md and follow its workflow.

Output format: ${agent.output_format}
- SUMMARY: one-line outcome
- FINDINGS: issues with file:line references  
- SEVERITY: Critical / High / Medium / Low
- RECOMMENDATIONS: concrete fixes

Return findings immediately. Do not ask questions.`
  }));
  
  return { matched: matched.map(m => m.domain), prompts, count: prompts.length };
}

if (require.main === module) {
  const task = process.argv.slice(2).join(' ') || 'design update for auction page';
  const result = generateAgentPrompts(task, { stack: 'Next.js + Spring Boot' });
  
  console.log(`Task: "${task}"`);
  console.log(`Matched ${result.count} agents: ${result.matched.join(', ')}\n`);
  
  for (const p of result.prompts) {
    console.log(`--- ${p.domain.toUpperCase()} AGENT ---`);
    console.log(`Skill: ${p.skill}`);
    console.log(`Type: ${p.type}`);
    console.log(`Prompt:\n${p.prompt}\n`);
  }
}

module.exports = { loadAgents, matchAgents, generateAgentPrompts };
