#!/usr/bin/env node
/** Relatório heurístico de strings visíveis provavelmente sem i18n (não bloqueia por padrão). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'src', 'app');

const STRICT = process.argv.includes('--strict');

const P0_FILES = new Set([
  'pages/splash/splash.page.html',
  'pages/peladas/peladas-list.page.html',
  'pages/events/events.page.html',
  'pages/pelada-detail/pelada-detail.page.html',
  'pages/pelada-detail/pelada-detail.page.ts',
  'pages/mural/mural.page.html',
  'shared/components/mural-highlights-panel/mural-highlights-panel.component.html',
  'shared/components/mural-highlights-panel/mural-highlights-panel.component.ts',
  'shared/components/mural-participant-stats/mural-participant-stats.component.html',
  'shared/components/mural-performance-analytics/mural-performance-analytics.component.html',
  'pages/event-mural/event-mural.page.html',
]);

const HTML_TAG =
  /<(ion-title|ion-label|ion-button|ion-card-title|ion-note|ion-searchbar|h[1-4]|p|ion-select)[^>]*>([^<{]+)</gi;
const PLACEHOLDER = /placeholder="([^"|{]+)"/g;
const I18N_OK = /\|\s*t\b|textKey|titleKey|bodyKey|\{\{\s*['"][a-zA-Z0-9_.]+['"]\s*\|\s*t/;
const PT_HINT = /[àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]|\b(Entrar|Voltar|Editar|Eventos|Socios|Sem dados|Buscar|Pelada|Mural)\b/i;

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts')) acc.push(p);
  }
  return acc;
}

function relFromApp(file) {
  return path.relative(APP, file).replace(/\\/g, '/');
}

function scanHtml(file, rel) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (I18N_OK.test(line)) return;
    if (!PT_HINT.test(line) && !/(placeholder=|label=|okText=|cancelText=)/.test(line)) return;
    if (HTML_TAG.test(line) || PLACEHOLDER.test(line) || /label="|okText="|cancelText="/.test(line)) {
      const trimmed = line.trim().slice(0, 120);
      if (trimmed && !trimmed.includes('assets/') && !trimmed.includes('http')) {
        hits.push({ line: i + 1, snippet: trimmed });
      }
    }
    HTML_TAG.lastIndex = 0;
    PLACEHOLDER.lastIndex = 0;
  });
  return hits;
}

function scanTs(file, rel) {
  if (rel === 'core/config/mural-app-sections.config.ts') return [];
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  const inCoreModel =
    rel.startsWith('core/models/') &&
    (rel.includes('event.model') || rel.includes('profile-role'));
  const inCoreUtil =
    rel.startsWith('core/utils/') &&
    (rel.includes('event-detail-display') ||
      rel.includes('profile-role') ||
      rel.includes('team-match-result'));
  const legacyLabel =
    /getRegistrationStatusLabel|getVotingStatusLabel|formatRole\s*\(|PROFILE_ROLE_LABELS/;
  const ctx =
    /showError\(|showSuccess\(|header:\s*['"`]|label:\s*['"`]|message:\s*['"`]|placeholder:\s*['"`]|return\s+['"`]/;
  lines.forEach((line, i) => {
    if (line.includes('i18n.t') || line.includes("t('") || line.includes('this.t(')) return;
    if (/return\s+['"`]mural\.rule/.test(line)) return;
  if (!ctx.test(line) && !/label:\s*'/.test(line) && !(inCoreModel || inCoreUtil)) return;
    if (inCoreModel || inCoreUtil) {
      if (legacyLabel.test(line) || (line.includes('return') && PT_HINT.test(line))) {
        hits.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
      }
      return;
    }
    if (/['"`][^'"`]{8,}['"`]/.test(line) && PT_HINT.test(line)) {
      hits.push({ line: i + 1, snippet: line.trim().slice(0, 120) });
    }
  });
  return hits;
}

const files = walk(APP);
const report = { generatedAt: new Date().toISOString(), files: [], summary: { p0: 0, p1: 0, p2: 0, p3: 0, totalHits: 0 } };

for (const file of files) {
  const rel = relFromApp(file);
  const hits = file.endsWith('.html') ? scanHtml(file, rel) : scanTs(file, rel);
  if (!hits.length) continue;
  let priority = 'p3';
  if (P0_FILES.has(rel)) priority = 'p0';
  else if (rel.includes('mural') || rel.includes('pelada') || rel.includes('event-detail')) priority = 'p1';
  else if (rel.includes('form') || rel.includes('wizard') || rel.includes('register') || rel.includes('profile'))
    priority = 'p2';
  report.summary[priority] += hits.length;
  report.summary.totalHits += hits.length;
  report.files.push({ file: rel, priority, hits });
}

report.files.sort((a, b) => {
  const order = { p0: 0, p1: 1, p2: 2, p3: 3 };
  return order[a.priority] - order[b.priority] || b.hits.length - a.hits.length;
});

const outJson = path.join(ROOT, 'docs', 'I18N-SCAN-REPORT.json');
fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');

const md = [];
md.push('# i18n — inventário de hardcoded (scan automático)\n');
md.push(`Gerado: ${report.generatedAt}\n`);
md.push(`| Prioridade | Ocorrências |`);
md.push(`|------------|-------------|`);
for (const k of ['p0', 'p1', 'p2', 'p3']) {
  md.push(`| ${k.toUpperCase()} | ${report.summary[k]} |`);
}
md.push(`| **Total** | ${report.summary.totalHits} |\n`);
md.push('## P0 — telas do smoke Xaiana\n');
for (const row of report.files.filter((f) => f.priority === 'p0').slice(0, 25)) {
  md.push(`### \`${row.file}\` (${row.hits.length})`);
  for (const h of row.hits.slice(0, 8)) {
    md.push(`- L${h.line}: ${h.snippet}`);
  }
  if (row.hits.length > 8) md.push(`- … +${row.hits.length - 8}`);
}
md.push('\n## P1 — mural / evento / pelada (amostra)\n');
for (const row of report.files.filter((f) => f.priority === 'p1').slice(0, 20)) {
  md.push(`- \`${row.file}\` — ${row.hits.length} hit(s)`);
}
fs.writeFileSync(path.join(ROOT, 'docs', 'I18N-FULL-INVENTORY.md'), md.join('\n') + '\n', 'utf8');

console.log('Wrote', outJson, 'and docs/I18N-FULL-INVENTORY.md');
console.log('Summary:', report.summary);

if (STRICT && report.summary.p0 + report.summary.p1 > 0) {
  console.error(
    `check:i18n:strict: P0+P1=${report.summary.p0 + report.summary.p1} (must be 0)`
  );
  process.exit(1);
}