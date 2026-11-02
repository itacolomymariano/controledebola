/**
 * Verifica se funcoes existem no Back4App Clone (nao exige login).
 * Invalid function (141) = Cloud Code desatualizado no clone.
 * Outro erro (ex. 209 forbidden) = funcao publicada.
 *
 * Uso: node scripts/probe-sandbox-cloud-functions.js
 */
const fs = require('fs');
const path = require('path');

const LOCAL_TS = path.join(__dirname, '..', 'src', 'environments', 'environment.sandbox.local.ts');
const SERVER_URL = 'https://parseapi.back4app.com';

const PROBE_FUNCTIONS = [
  'listTeamMatchesForFeed',
  'listHomeDirectoryUsers',
  'listPeladasForFeed',
  'getMuralAppDashboard',
  'searchProfiles',
  'listHomeDirectoryTeams',
];

function readSandboxKeys() {
  if (!fs.existsSync(LOCAL_TS)) {
    console.error('Arquivo ausente:', LOCAL_TS);
    console.error('Copie environment.sandbox.local.ts.example e preencha chaves Clone_MinhaPelada.');
    process.exit(1);
  }
  const text = fs.readFileSync(LOCAL_TS, 'utf8');
  const appId = text.match(/appId\s*:\s*['"]([^'"]+)['"]/)?.[1];
  const javascriptKey = text.match(/javascriptKey\s*:\s*['"]([^'"]+)['"]/)?.[1];
  if (!appId || !javascriptKey) {
    console.error('Nao foi possivel ler appId/javascriptKey de environment.sandbox.local.ts');
    process.exit(1);
  }
  return { appId, javascriptKey };
}

async function probeFunction(name, keys) {
  const url = `${SERVER_URL}/functions/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': keys.appId,
      'X-Parse-JavaScript-Key': keys.javascriptKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'athlete', query: '' }),
  });
  const body = await res.json().catch(() => ({}));
  const code = body?.code ?? res.status;
  const error = body?.error ?? '';
  return { name, httpStatus: res.status, code, error };
}

async function main() {
  const keys = readSandboxKeys();
  console.log('Probe Clone_MinhaPelada (appId:', keys.appId.slice(0, 8) + '…)\n');

  let invalid = 0;
  for (const name of PROBE_FUNCTIONS) {
    const r = await probeFunction(name, keys);
    const isInvalid =
      r.code === 141 ||
      String(r.error).toLowerCase().includes('invalid function');
    if (isInvalid) {
      invalid += 1;
      console.log(`FAIL  ${name} — Invalid function (publique cloud/main.js no clone)`);
    } else {
      console.log(`OK    ${name} — publicada (resposta: ${r.error || 'result'})`);
    }
  }

  console.log('');
  if (invalid) {
    console.error(
      `${invalid} funcao(oes) ausente(s) no Cloud publicado. Deploy: Back4App → Clone_MinhaPelada → Cloud Code → cloud/main.js`
    );
    process.exit(1);
  }
  console.log('Todas as funcoes P0 probe existem no clone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
