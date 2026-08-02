/**
 * Atualiza o identificador de release do app antes de cada build/instalacao.
 * Uso: node scripts/bump-app-release.js [--install]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const statePath = path.join(root, '.app-release-state.json');
const releaseTsPath = path.join(root, 'src/app/core/constants/app-release.ts');
const gradlePath = path.join(root, 'android/app/build.gradle');

function readState() {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return { releaseNumber: 0, versionCode: 0 };
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
}

function formatReleaseLabel(number, date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}.${String(number).padStart(4, '0')}`;
}

function main() {
  const isInstall = process.argv.includes('--install');
  const state = readState();
  const now = new Date();

  state.releaseNumber = (state.releaseNumber || 0) + 1;
  state.versionCode = (state.versionCode || 0) + 1;
  state.generatedAt = now.toISOString();
  state.label = formatReleaseLabel(state.releaseNumber, now);

  if (isInstall || process.env.APP_RELEASE_INSTALL === '1') {
    state.lastInstalledRelease = state.label;
    state.lastInstalledAt = now.toISOString();
  }

  writeState(state);

  const tsContent = `/** Gerado automaticamente por scripts/bump-app-release.js — nao editar manualmente */
export const APP_RELEASE = {
  label: '${state.label}',
  number: ${state.releaseNumber},
  generatedAt: '${state.generatedAt}',
};
`;
  fs.mkdirSync(path.dirname(releaseTsPath), { recursive: true });
  fs.writeFileSync(releaseTsPath, tsContent);

  if (fs.existsSync(gradlePath)) {
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${state.versionCode}`);
    gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${state.label}"`);
    fs.writeFileSync(gradlePath, gradle);
  }

  console.log(`App release: ${state.label}${isInstall ? ' (instalacao)' : ' (build)'}`);
}

main();
