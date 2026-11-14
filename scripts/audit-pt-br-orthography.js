#!/usr/bin/env node
/** Lista valores em pt-BR.json com padrões ASCII típicos de falta de acento (somente chaves do app). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PT = path.join(ROOT, 'src', 'assets', 'i18n', 'pt-BR.json');
const EXTRA = path.join(__dirname, 'i18n-wave3-extra.js');

const SUSPECT = [
  { re: /\bInscricoes\b/, suggest: 'Inscrições' },
  { re: /\bInscricao\b/, suggest: 'Inscrição' },
  { re: /\bVersao\b/, suggest: 'Versão' },
  { re: /\bTermino\b/, suggest: 'Término' },
  { re: /\bInicio\b/, suggest: 'Início' },
  { re: /\bopcoes\b/i, suggest: 'opções' },
  { re: /\bvalido\b/i, suggest: 'válido' },
  { re: /\bConfiguracoes\b/, suggest: 'Configurações' },
  { re: /\bparticipacao\b/i, suggest: 'participação' },
  { re: /\bSolicitacoes\b/, suggest: 'Solicitações' },
  { re: /\bContratacao\b/, suggest: 'Contratação' },
  { re: /\bDescricao\b/, suggest: 'Descrição' },
  { re: /\bTitulo\b/, suggest: 'Título' },
  { re: /\bNao\b/, suggest: 'Não' },
  { re: /\bVoce\b/, suggest: 'Você' },
  { re: /\bSocio\b/, suggest: 'Sócio' },
  { re: /\bIsencao\b/, suggest: 'Isenção' },
];

const data = JSON.parse(fs.readFileSync(PT, 'utf8'));
const findings = [];

for (const [key, value] of Object.entries(data)) {
  if (typeof value !== 'string') continue;
  for (const { re, suggest } of SUSPECT) {
    if (re.test(value)) {
      findings.push({ key, value, pattern: re.toString(), suggest });
      break;
    }
  }
}

const out = path.join(ROOT, 'docs', 'I18N-PT-BR-ORTHOGRAPHY.md');
const lines = [
  '# pt-BR — auditoria de acentuação (automática)',
  '',
  `Gerado: ${new Date().toISOString()}`,
  '',
  `Total de chaves suspeitas: **${findings.length}**`,
  '',
  '| Chave | Valor (trecho) | Sugestão |',
  '|-------|----------------|----------|',
];
for (const row of findings.slice(0, 200)) {
  const excerpt = row.value.replace(/\|/g, '\\|').slice(0, 80);
  lines.push(`| \`${row.key}\` | ${excerpt} | ${row.suggest} |`);
}
if (findings.length > 200) lines.push(`\n… +${findings.length - 200} entradas`);
fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');

console.log('Wrote', out);
console.log('Suspect keys:', findings.length);

if (process.argv.includes('--fix-extra')) {
  console.log('Use correção manual em pt-BR.json / triplas extra (--fix-extra não altera JSON automaticamente).');
}

if (process.argv.includes('--fail') && findings.length > 0) {
  process.exit(1);
}