#!/usr/bin/env node
/** Mescla docs/i18n-missing-en.json e docs/i18n-missing-es.json em en-GB / es-ES (ordem pt-BR). */
const fs = require('fs');
const path = require('path');

const I18N = path.join(__dirname, '../src/assets/i18n');
const pt = JSON.parse(fs.readFileSync(path.join(I18N, 'pt-BR.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(I18N, 'en-GB.json'), 'utf8'));
const es = JSON.parse(fs.readFileSync(path.join(I18N, 'es-ES.json'), 'utf8'));
const addEn = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/i18n-missing-en.json'), 'utf8'));
const addEs = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/i18n-missing-es.json'), 'utf8'));

Object.assign(en, addEn);
Object.assign(es, addEs);

function reorder(dict) {
  const out = {};
  for (const k of Object.keys(pt)) {
    if (dict[k] !== undefined) out[k] = dict[k];
  }
  for (const k of Object.keys(dict)) {
    if (!(k in out)) out[k] = dict[k];
  }
  return out;
}

fs.writeFileSync(path.join(I18N, 'en-GB.json'), JSON.stringify(reorder(en), null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(I18N, 'es-ES.json'), JSON.stringify(reorder(es), null, 2) + '\n', 'utf8');
console.log('Merged', Object.keys(addEn).length, 'EN and', Object.keys(addEs).length, 'ES keys.');
