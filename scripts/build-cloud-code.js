/**
 * Concatena cloud/source/*.js em cloud/main.js para deploy no Back4App.
 * Edite os modulos em cloud/source/ e execute: npm run build:cloud
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'cloud', 'source');
const outputFile = path.join(rootDir, 'cloud', 'main.js');

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error('Pasta cloud/source/ nao encontrada.');
    process.exit(1);
  }

  const builtAt = new Date().toISOString();
  const header = `/**
 * Cloud Code — gerado por npm run build:cloud
 * Gerado em: ${builtAt}
 * Copie o conteudo deste arquivo no Back4App (Server Settings > Cloud Code).
 * Fontes modulares em cloud/source/
 * NAO edite este arquivo direto — edite cloud/source/ e rode npm run build:cloud
 */

`;

  const modules = fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b));

  if (!modules.length) {
    console.error('Nenhum modulo .js em cloud/source/.');
    process.exit(1);
  }

  const parts = [header.trimEnd()];
  for (const moduleName of modules) {
    const filePath = path.join(sourceDir, moduleName);
    const content = fs.readFileSync(filePath, 'utf8').trimEnd();
    parts.push(`// --- ${moduleName} ---`, content);
  }

  const output = `${parts.join('\n\n')}\n`;
  fs.writeFileSync(outputFile, output, 'utf8');

  const lineCount = output.split(/\r?\n/).length;
  const hasSearchFix =
    output.includes('fullNameProfileQuery') && output.includes('matchedUsers');
  console.log(`Cloud Code gerado: ${outputFile} (${modules.length} modulos)`);
  console.log(`Linhas: ${lineCount}`);
  console.log(`Busca de perfis (fullNameProfileQuery/matchedUsers): ${hasSearchFix ? 'OK' : 'FALTANDO'}`);
  if (!hasSearchFix) {
    process.exitCode = 1;
  }
}

main();
