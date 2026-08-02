/**
 * Extrai pelada e perfis/busca de cloud/source/02-core.js.
 * Execute: node scripts/split-cloud-pelada-profiles.js
 * Depois: npm run build:cloud
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'cloud', 'source');
const corePath = path.join(sourceDir, '02-core.js');
const peladaPath = path.join(sourceDir, '10-pelada.js');
const profilesPath = path.join(sourceDir, '11-profiles-search.js');

const peladaAssembly = [
  { start: 6, end: 88, comment: 'Participantes da pelada' },
  { start: 145, end: 325, comment: 'Socios e exibicao da pelada' },
  { start: 1618, end: 1688, comment: 'Coleta de participantes por escopo' },
  { start: 2043, end: 2079, comment: 'Helpers de administracao da pelada' },
  { start: 2081, end: 2140, comment: 'Revisao de participacao' },
  { start: 2142, end: 2291, comment: 'Apresentacao de perfil na pelada' },
  { start: 2293, end: 2375, comment: 'Perfil para revisao de participacao' },
];

const profilesAssembly = [
  { start: 327, end: 1388, comment: 'Busca de atletas e perfis publicos' },
  { start: 1701, end: 1887, comment: 'Escudo de times (SportsDB)' },
];

const removeFromCore = [
  { start: 6, end: 88 },
  { start: 145, end: 325 },
  { start: 327, end: 1388 },
  { start: 1618, end: 1688 },
  { start: 1701, end: 1887 },
  { start: 2043, end: 2375 },
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

function buildModule(header, lines, segments) {
  const parts = [header.trimEnd()];
  for (const segment of segments) {
    if (lines.length < segment.end) {
      throw new Error(`02-core.js tem ${lines.length} linhas; segmento ${segment.start}-${segment.end} invalido.`);
    }
    parts.push('', `// ${segment.comment}`);
    parts.push(...lines.slice(segment.start - 1, segment.end));
  }
  return `${parts.join('\n').trimEnd()}\n`;
}

function main() {
  const lines = readLines(corePath);

  fs.writeFileSync(
    peladaPath,
    buildModule('/** Pelada — socios, participantes e apresentacao de perfil */', lines, peladaAssembly),
    'utf8'
  );

  fs.writeFileSync(
    profilesPath,
    buildModule('/** Perfis — busca de atletas, funcoes e escudos de times */', lines, profilesAssembly),
    'utf8'
  );

  const trimmed = removeLineRanges(lines, removeFromCore);
  const coreBody = stripLeadingCommentBlocks(trimmed).join('\n').trimEnd();
  const coreHeader = `/**
 * Cloud Code — conta do usuario e login
 * Modulos: 10-pelada, 11-profiles-search, 07-mural, 08-scout, 09-events, ...
 */`;

  fs.writeFileSync(corePath, `${coreHeader}\n\n${coreBody}\n`, 'utf8');

  console.log(`Criado 10-pelada.js (${readLines(peladaPath).length} linhas)`);
  console.log(`Criado 11-profiles-search.js (${readLines(profilesPath).length} linhas)`);
  console.log(`02-core.js reduzido para ${readLines(corePath).length} linhas`);
}

main();
