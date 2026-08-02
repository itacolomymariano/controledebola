/**
 * Extrai scout/sumula/predicoes e eventos/inscricoes de 02-core.js.
 * Execute: node scripts/split-cloud-scout-events.js
 * Depois: npm run build:cloud
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'cloud', 'source');
const corePath = path.join(sourceDir, '02-core.js');
const legendsPath = path.join(sourceDir, '05-legends.js');
const scoutPath = path.join(sourceDir, '08-scout-referee-performance.js');
const eventsPath = path.join(sourceDir, '09-events-registrations.js');

const scoutAssembly = [
  {
    file: legendsPath,
    start: 578,
    end: 595,
    comment: 'Janela de apontamento e sumula',
  },
  { start: 2684, end: 2699, comment: 'ACL e persistencia de EventPerformance' },
  { start: 2958, end: 4540, comment: 'Scout, sumula, predicoes e dashboard do atleta' },
];

const eventsAssembly = [
  { start: 1890, end: 2682, comment: 'Inscricoes, chegada e separacao de times' },
  { start: 2848, end: 2956, comment: 'Pagamento e inscricao anonima' },
  { start: 4543, end: 4691, comment: 'Contratacao suplementar' },
];

const removeFromCore = [
  { start: 1890, end: 2682 },
  { start: 2684, end: 2699 },
  { start: 2848, end: 2956 },
  { start: 2958, end: 4540 },
  { start: 4543, end: 4691 },
];

const removeFromLegends = [{ start: 578, end: 595 }];

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function writeModule(filePath, header, parts) {
  const body = parts.join('\n').trimEnd();
  fs.writeFileSync(filePath, `${header}\n\n${body}\n`, 'utf8');
}

function removeLineRanges(lines, ranges) {
  const drop = new Set();
  for (const { start, end } of ranges) {
    for (let index = start - 1; index < end; index += 1) {
      drop.add(index);
    }
  }
  return lines.filter((_, index) => !drop.has(index));
}

function stripLeadingCommentBlocks(lines) {
  let startIndex = 0;
  while (startIndex < lines.length && lines[startIndex].trim().startsWith('/**')) {
    startIndex += 1;
    while (startIndex < lines.length && !lines[startIndex].trim().endsWith('*/')) {
      startIndex += 1;
    }
    startIndex += 1;
    while (startIndex < lines.length && lines[startIndex].trim() === '') {
      startIndex += 1;
    }
  }
  return lines.slice(startIndex);
}

function buildAssemblyModule(allLinesByPath, segments, header) {
  const parts = [header.trimEnd()];
  for (const segment of segments) {
    const sourcePath = segment.file || corePath;
    const lines = allLinesByPath[sourcePath];
    if (!lines || lines.length < segment.end) {
      throw new Error(
        `${path.basename(sourcePath)} tem ${lines ? lines.length : 0} linhas; segmento ${segment.start}-${segment.end} invalido.`
      );
    }
    parts.push('', `// ${segment.comment}`);
    parts.push(...lines.slice(segment.start - 1, segment.end));
  }
  return parts;
}

function main() {
  const coreLines = readLines(corePath);
  const legendsLines = readLines(legendsPath);
  const allLinesByPath = {
    [corePath]: coreLines,
    [legendsPath]: legendsLines,
  };

  for (const segment of [...scoutAssembly, ...eventsAssembly]) {
    const sourcePath = segment.file || corePath;
    const lines = allLinesByPath[sourcePath];
    if (!lines || lines.length < segment.end) {
      throw new Error(
        `Segmento ${segment.start}-${segment.end} invalido em ${path.basename(sourcePath)}.`
      );
    }
  }

  writeModule(
    scoutPath,
    '/** Scout, sumula do juiz, predicoes e dashboard de performance */',
    buildAssemblyModule(allLinesByPath, scoutAssembly, '/** Scout, sumula do juiz, predicoes e dashboard de performance */')
  );

  writeModule(
    eventsPath,
    '/** Eventos — inscricoes, chegada, pagamento e contratacao suplementar */',
    buildAssemblyModule(allLinesByPath, eventsAssembly, '/** Eventos — inscricoes, chegada, pagamento e contratacao suplementar */')
  );

  const trimmedCore = removeLineRanges(coreLines, removeFromCore);
  const coreBody = stripLeadingCommentBlocks(trimmedCore).join('\n').trimEnd();
  writeModule(
    corePath,
    `/**
 * Cloud Code — nucleo (pelada, perfis, conta, apresentacao)
 * Modulos: 07-mural, 08-scout-referee-performance, 09-events-registrations
 */`,
    [coreBody]
  );

  const trimmedLegends = removeLineRanges(legendsLines, removeFromLegends);
  const legendsBody = trimmedLegends.join('\n').trimEnd();
  if (!legendsBody.includes("Parse.Cloud.define('createAmateurLegendAthlete'")) {
    throw new Error('05-legends.js ficou vazio apos remocao — abortando.');
  }
  writeModule(
    legendsPath,
    '/** Legendas amadoras e profissionais */',
    [legendsBody.replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '').trim()]
  );

  console.log(`Criado 08-scout-referee-performance.js (${readLines(scoutPath).length} linhas)`);
  console.log(`Criado 09-events-registrations.js (${readLines(eventsPath).length} linhas)`);
  console.log(`02-core.js reduzido para ${readLines(corePath).length} linhas`);
  console.log(`05-legends.js ajustado (${readLines(legendsPath).length} linhas)`);
}

main();
