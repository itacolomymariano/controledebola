/**
 * Falha se algum Parse.Cloud.run('...') em src/app nao tiver Parse.Cloud.define no cloud/main.js.
 * Uso: node scripts/cloud-client-parity.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'src', 'app');
const MAIN_JS = path.join(ROOT, 'cloud', 'main.js');

const RUN_RE = /Parse\.Cloud\.run\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
const DEFINE_RE = /Parse\.Cloud\.define\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;

/** Funções P0 na demo sandbox (primeira navegação). */
const P0_DEMO = new Set([
  'resolveLoginUsername',
  'listPeladasForFeed',
  'listTeamMatchesForFeed',
  'listHomeDirectoryTeams',
  'listHomeDirectoryLegendTeams',
  'listHomeDirectoryUsers',
  'getHomeDirectoryUser',
  'searchProfiles',
  'getMuralAppDashboard',
  'getAmateurLegendTeam',
  'listMyLegendTeamJoinRequests',
  'listMyMatchChallenges',
  'listAppMessages',
  'countUnreadAppMessages',
]);

function walkTsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function collectMatches(text, re) {
  const set = new Set();
  let m;
  const copy = new RegExp(re.source, re.flags);
  while ((m = copy.exec(text)) !== null) {
    set.add(m[1]);
  }
  return set;
}

function main() {
  if (!fs.existsSync(MAIN_JS)) {
    console.error('cloud/main.js ausente. Rode: npm run build:cloud');
    process.exit(1);
  }

  const clientCalls = new Set();
  for (const file of walkTsFiles(APP_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const name of collectMatches(text, RUN_RE)) {
      clientCalls.add(name);
    }
  }

  const mainText = fs.readFileSync(MAIN_JS, 'utf8');
  const defined = collectMatches(mainText, DEFINE_RE);

  const missing = [...clientCalls].filter((name) => !defined.has(name)).sort();
  const p0Missing = missing.filter((name) => P0_DEMO.has(name));

  console.log(`Cliente: ${clientCalls.size} funcoes Cloud.run unicas`);
  console.log(`main.js: ${defined.size} Parse.Cloud.define`);
  console.log('');

  if (p0Missing.length) {
    console.error('P0 demo — faltam no main.js:', p0Missing.join(', '));
  } else {
    console.log('P0 demo — todas presentes no main.js (bundle local OK).');
  }

  if (missing.length) {
    console.error('\nFaltam no main.js (cliente chama, bundle nao define):');
    for (const name of missing) {
      console.error(`  - ${name}`);
    }
    process.exit(1);
  }

  console.log('\nParidade OK: todo Cloud.run do app tem define em cloud/main.js.');
}

main();
