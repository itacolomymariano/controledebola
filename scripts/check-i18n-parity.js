#!/usr/bin/env node
/**
 * Paridade de chaves i18n: pt-BR é fonte; en-GB e es-ES devem ter as mesmas chaves.
 * Uso: node scripts/check-i18n-parity.js [--report docs/I18N-PARITY-REPORT.json]
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/assets/i18n');
const BASE = 'pt-BR.json';
const TARGETS = ['en-GB.json', 'es-ES.json'];

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(I18N_DIR, file), 'utf8'));
}

function main() {
  const base = loadJson(BASE);
  const baseKeys = Object.keys(base).sort();
  const report = { base: BASE, baseCount: baseKeys.length, locales: {} };
  let failed = false;

  for (const file of TARGETS) {
    const dict = loadJson(file);
    const keys = new Set(Object.keys(dict));
    const missing = baseKeys.filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !(k in base)).sort();
    report.locales[file] = {
      count: keys.size,
      missingCount: missing.length,
      extraCount: extra.length,
      missing,
      extra,
    };
    if (missing.length) failed = true;
    console.log(`\n${file}: ${keys.size} keys, missing ${missing.length}, extra ${extra.length}`);
    if (missing.length) {
      for (const k of missing.slice(0, 40)) console.log(`  - ${k}`);
      if (missing.length > 40) console.log(`  ... +${missing.length - 40} more`);
    }
  }

  const reportArg = process.argv.indexOf('--report');
  if (reportArg !== -1 && process.argv[reportArg + 1]) {
    fs.writeFileSync(path.resolve(process.argv[reportArg + 1]), JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nReport: ${process.argv[reportArg + 1]}`);
  }

  if (failed) {
    console.error('\ncheck-i18n-parity: FAILED (missing keys in target locales)');
    process.exit(1);
  }
  console.log('\ncheck-i18n-parity: OK');
}

main();
