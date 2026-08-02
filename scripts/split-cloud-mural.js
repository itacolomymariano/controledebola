/**
 * Extrai codigo do mural de cloud/source/02-core.js para 07-mural.js.
 * Execute: node scripts/split-cloud-mural.js
 * Depois: npm run build:cloud
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'cloud', 'source');
const corePath = path.join(sourceDir, '02-core.js');
const muralPath = path.join(sourceDir, '07-mural.js');

/** Ordem de montagem do modulo (dependencias de helpers primeiro). */
const assemblySegments = [
  { start: 3052, end: 3946, comment: 'Motor de votos e rankings' },
  { start: 1704, end: 1932, comment: 'Perfis de participantes e times favoritos' },
  { start: 2122, end: 2256, comment: 'Estatisticas de localizacao' },
  { start: 3964, end: 4601, comment: 'Highlights, dashboards e votacao do evento' },
  { start: 4748, end: 4965, comment: 'Permissoes de classes e backfills' },
  { start: 6661, end: 6891, comment: 'Analytics de performance' },
];

/** Intervalos removidos do 02-core.js (qualquer ordem). */
const removeRanges = [
  { start: 1704, end: 1932 },
  { start: 2122, end: 2256 },
  { start: 3052, end: 3946 },
  { start: 3964, end: 4601 },
  { start: 4748, end: 4965 },
  { start: 6661, end: 6891 },
];

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
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

function buildMuralModule(lines) {
  const parts = ['/** Mural — votos, rankings, dashboards, perfis e analytics */'];
  for (const segment of assemblySegments) {
    if (lines.length < segment.end) {
      throw new Error(
        `02-core.js tem ${lines.length} linhas; segmento ${segment.start}-${segment.end} invalido.`
      );
    }
    parts.push('', `// ${segment.comment}`);
    parts.push(...lines.slice(segment.start - 1, segment.end));
  }
  return `${parts.join('\n').trimEnd()}\n`;
}

function main() {
  const lines = readLines(corePath);
  fs.writeFileSync(muralPath, buildMuralModule(lines), 'utf8');

  const trimmedHeader = `/**
 * Cloud Code — nucleo (pelada, eventos, perfis, scout, predicoes, etc.)
 * Mural em cloud/source/07-mural.js
 */`;

  const trimmed = removeLineRanges(lines, removeRanges);
  let startIndex = 0;
  while (startIndex < trimmed.length && trimmed[startIndex].trim().startsWith('/**')) {
    startIndex += 1;
    while (startIndex < trimmed.length && !trimmed[startIndex].trim().endsWith('*/')) {
      startIndex += 1;
    }
    startIndex += 1;
    while (startIndex < trimmed.length && trimmed[startIndex].trim() === '') {
      startIndex += 1;
    }
  }
  const coreBody = trimmed.slice(startIndex).join('\n').trimEnd();
  fs.writeFileSync(corePath, `${trimmedHeader}\n\n${coreBody}\n`, 'utf8');

  const removed = removeRanges.reduce((sum, range) => sum + (range.end - range.start + 1), 0);
  console.log(`Criado 07-mural.js (${readLines(muralPath).length} linhas)`);
  console.log(`02-core.js reduzido para ${readLines(corePath).length} linhas (~${removed} linhas movidas)`);
}

main();
