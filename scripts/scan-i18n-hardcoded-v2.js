#!/usr/bin/env node
/** Scan ampliado (onda 6): alertCtrl, loadingCtrl, tags extras, PT sem acento. */
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

const I18N_OK =
  /\|\s*t\b|textKey|titleKey|bodyKey|\{\{\s*['"][a-zA-Z0-9_.]+['"]\s*\|\s*t|i18n\.t|this\.t\(|this\.i18n\.t\(/;

const PT_HINT =
  /[àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]|\b(Entrar|Voltar|Editar|Eventos|Socios|Sem dados|Buscar|Pelada|Mural|Local|Idade|Perfil|Nao|nao|apos|Informe|Selecione|Erro|Cancelar|Confirmar|Excluir|Salvando|Grave|titulo|descricao|Nenhum|Nenhuma|disponivel|indisponivel|participantes|participante|palpite|Palpite|conteudo|conteúdo|faixa|etaria|etária|visualizacao|Autor|Maiores|Ver Top|por estado|por cidade|por bairro|Operacao|Treinador|Massagista|Torcida)\b/i;

const HTML_TAG =
  /<(ion-title|ion-label|ion-button|ion-card-title|ion-note|ion-searchbar|ion-select-option|ion-segment-button|h[1-4]|p)[^>]*>([^<{]+)</gi;
const PLACEHOLDER = /(?:placeholder|label|okText|cancelText)=["']([^"'{]+)["']/g;
const ATTR_LITERAL = /\[attr\.(?:aria-label|title)\]="['"]([^'"]+)['"]"/g;
const BIND_PLACEHOLDER = /\[placeholder\]="['"]([^'"]+)['"]/g;

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

function lineHasI18n(line) {
  return I18N_OK.test(line);
}

function scanHtml(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (lineHasI18n(line)) return;
    let matched = false;
    if (PT_HINT.test(line) || /placeholder=|label=|okText=|cancelText=/.test(line)) {
      if (HTML_TAG.test(line) || PLACEHOLDER.test(line) || BIND_PLACEHOLDER.test(line)) matched = true;
      HTML_TAG.lastIndex = 0;
      PLACEHOLDER.lastIndex = 0;
      BIND_PLACEHOLDER.lastIndex = 0;
    }
    if (ATTR_LITERAL.test(line) && PT_HINT.test(line)) matched = true;
    ATTR_LITERAL.lastIndex = 0;
    if (matched) {
      const trimmed = line.trim().slice(0, 140);
      if (trimmed && !trimmed.includes('assets/') && !trimmed.includes('http')) {
        hits.push({ line: i + 1, snippet: trimmed, kind: 'html' });
      }
    }
  });
  return hits;
}

function scanTs(file, rel) {
  if (rel === 'core/config/mural-app-sections.config.ts') return [];
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  const ctx =
    /showError\(|showSuccess\(|alertCtrl\.create|loadingCtrl\.create|header:\s*['"`]|message:\s*['"`]|text:\s*['"`]|placeholder:\s*['"`]|buttons:\s*\[['"`]|return\s+['"`]/;
  lines.forEach((line, i) => {
    if (lineHasI18n(line)) return;
    if (!ctx.test(line)) return;
    if (/return\s+['"`]mural\.rule/.test(line)) return;
    if (/return\s*`?\([^`]*\.slice\(/.test(line)) return;
    if (/['"`][^'"`]{4,}['"`]/.test(line) && PT_HINT.test(line)) {
      hits.push({ line: i + 1, snippet: line.trim().slice(0, 140), kind: 'ts' });
    }
  });
  return hits;
}

const files = walk(APP);
const report = {
  generatedAt: new Date().toISOString(),
  version: 2,
  files: [],
  summary: { p0: 0, p1: 0, p2: 0, p3: 0, totalHits: 0 },
};

for (const file of files) {
  const rel = relFromApp(file);
  const hits = file.endsWith('.html') ? scanHtml(file) : scanTs(file, rel);
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

const outJson = path.join(ROOT, 'docs', 'I18N-SCAN-V2-REPORT.json');
fs.writeFileSync(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');

const tierMap = {
  'pages/event-detail/': 'T1',
  'pages/account-edit/': 'T1',
  'pages/athlete-profile-view/': 'T2',
  'pages/profile-view/': 'T2',
  'pages/profile/': 'T3',
  'pages/login/': 'T3',
  'pages/event-narrator-radio/': 'T4',
  'pages/event-journalist-journal/': 'T4',
  'pages/event-cameraman-coverage/': 'T4',
  'pages/event-masseur-treatments/': 'T4',
  'pages/event-coach-board/': 'T4',
  'pages/event-sumula/': 'T4',
  'pages/confronto-create/': 'T5',
  'pages/team-form/': 'T5',
  'pages/team-profile/': 'T5',
  'shared/components/event-role-hiring-panel/': 'T6',
  'shared/components/user-bar/': 'T6',
};

function tierFor(rel) {
  for (const [prefix, tier] of Object.entries(tierMap)) {
    if (rel.startsWith(prefix)) return tier;
  }
  return '—';
}

const md = [];
md.push('# i18n onda 6 — backlog (scan v2)\n');
md.push(`Gerado: ${report.generatedAt}\n`);
md.push('| Prioridade | Ocorrências |');
md.push('|------------|-------------|');
for (const k of ['p0', 'p1', 'p2', 'p3']) {
  md.push(`| ${k.toUpperCase()} | ${report.summary[k]} |`);
}
md.push(`| **Total** | ${report.summary.totalHits} |\n`);
md.push('| Arquivo | Tier | Hits |');
md.push('|---------|------|------|');
for (const row of report.files) {
  md.push(`| \`${row.file}\` | ${tierFor(row.file)} | ${row.hits.length} |`);
}
fs.writeFileSync(path.join(ROOT, 'docs', 'I18N-WAVE6-BACKLOG.md'), md.join('\n') + '\n', 'utf8');

console.log('Wrote', outJson, 'and docs/I18N-WAVE6-BACKLOG.md');
console.log('Summary v2:', report.summary);

if (STRICT && report.summary.p0 + report.summary.p1 > 0) {
  console.error(`check:i18n:scan:v2 strict: P0+P1=${report.summary.p0 + report.summary.p1} (must be 0)`);
  process.exit(1);
}