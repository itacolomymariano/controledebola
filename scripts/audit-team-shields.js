/**
 * Audita resolucao de escudos (Wikimedia + bundled) para times do picker.
 * Uso: node scripts/audit-team-shields.js
 * Saida: docs/TEAM-SHIELD-AUDIT.md
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const teamsFile = path.join(root, 'src/app/core/data/brazilian-teams.data.ts');
const shieldFiles = path.join(root, 'src/app/core/data/team-shield-files.data.ts');
const bundledFile = path.join(root, 'src/app/core/data/team-shield-bundled.data.ts');
const outFile = path.join(root, 'docs/TEAM-SHIELD-AUDIT.md');

function extractTeams() {
  const source = fs.readFileSync(teamsFile, 'utf8');
  const names = [];
  const re = /name:\s*'([^']+)'/g;
  let match;
  while ((match = re.exec(source))) {
    names.push(match[1]);
  }
  return names;
}

function teamSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hasShieldMapping(slug) {
  const mapping = fs.readFileSync(shieldFiles, 'utf8');
  return new RegExp(`\\b${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(mapping);
}

function hasBundled(slug) {
  const bundled = fs.readFileSync(bundledFile, 'utf8');
  return new RegExp(`\\b${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(bundled);
}

async function headOk(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return response.ok;
  } catch {
    return false;
  }
}

function wikimediaUrl(file) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=64`;
}

function extractFirstWikimediaFile(slug) {
  const mapping = fs.readFileSync(shieldFiles, 'utf8');
  const blockRe = new RegExp(`${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^,\\n]+)`);
  const match = mapping.match(blockRe);
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.startsWith('[')) {
    const inner = raw.match(/'([^']+)'/);
    return inner ? inner[1] : null;
  }
  return raw.replace(/['"]/g, '');
}

async function main() {
  const teams = extractTeams();
  const lines = ['# Auditoria de escudos (gerado automaticamente)', '', `Data: ${new Date().toISOString()}`, '', '| Time | Slug | Bundled | Wikimedia | Status |', '|------|------|---------|-----------|--------|'];
  const failures = [];

  for (const name of teams) {
    const slug = teamSlug(name);
    const bundled = hasBundled(slug);
    let wikimediaStatus = '—';
    let status = 'ok';

    if (bundled) {
      const assetPath = path.join(root, 'src/assets/team-shields', `${slug}.svg`);
      if (!fs.existsSync(assetPath)) {
        status = 'bundled_missing_file';
        failures.push(`${name}: arquivo bundado ausente`);
      }
      wikimediaStatus = 'skip';
    } else if (hasShieldMapping(slug)) {
      const file = extractFirstWikimediaFile(slug);
      if (file) {
        const ok = await headOk(wikimediaUrl(file));
        wikimediaStatus = ok ? 'ok' : '404';
        if (!ok) {
          status = 'wikimedia_fail';
          failures.push(`${name}: Wikimedia ${file}`);
        }
      } else {
        status = 'no_file_entry';
        failures.push(`${name}: entrada invalida`);
      }
    } else {
      status = 'no_mapping';
      failures.push(`${name}: sem mapeamento em TEAM_SHIELD_FILES`);
    }

    lines.push(`| ${name} | ${slug} | ${bundled ? 'sim' : 'nao'} | ${wikimediaStatus} | ${status} |`);
  }

  lines.push('', '## Falhas', '', failures.length ? failures.map((f) => `- ${f}`).join('\n') : '_Nenhuma falha critica._');

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outFile} (${teams.length} teams, ${failures.length} failures)`);
  process.exit(failures.length ? 1 : 0);
}

void main();
