/**
 * Extrai modulos tail de cloud/source/02-core.js (push, auth, legends, gate).
 * Execute uma vez apos editar limites; depois edite os modulos diretamente.
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'cloud', 'source');
const corePath = path.join(sourceDir, '02-core.js');

const slices = [
  {
    file: '03-push-notifications.js',
    header: '/** Push notifications, hooks e sync de avatar */',
    start: 7372,
    end: 7667,
  },
  {
    file: '04-auth-signup.js',
    header: '/** Cadastro de usuario e anti-bot */',
    start: 7669,
    end: 7828,
  },
  {
    file: '05-legends.js',
    header: '/** Legendas amadoras e profissionais */',
    start: 7830,
    end: 8422,
  },
  {
    file: '06-gate-tickets.js',
    header: '/** Controle de portaria e ingressos */',
    start: 8424,
    end: 8764,
  },
];

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function writeModule(name, header, lines) {
  const body = lines.join('\n').trimEnd();
  const content = `${header}\n\n${body}\n`;
  fs.writeFileSync(path.join(sourceDir, name), content, 'utf8');
}

const lines = readLines(corePath);
const maxEnd = Math.max(...slices.map((s) => s.end));

if (lines.length < maxEnd) {
  console.error(`02-core.js tem ${lines.length} linhas; esperado pelo menos ${maxEnd}.`);
  process.exit(1);
}

for (const slice of slices) {
  const chunk = lines.slice(slice.start - 1, slice.end);
  writeModule(slice.file, slice.header, chunk);
  console.log(`Criado ${slice.file} (${chunk.length} linhas)`);
}

const trimmedHeader = `/**
 * Cloud Code — nucleo (pelada, eventos, mural, scout, etc.)
 * Modulos complementares em cloud/source/03-*.js … 06-*.js
 */`;

const trimmed = lines.slice(0, 7370);
writeModule('02-core.js', trimmedHeader, trimmed);
console.log(`02-core.js reduzido para ${trimmed.length} linhas`);
