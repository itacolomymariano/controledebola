#!/usr/bin/env node
/**
 * Verifica se getGrowthSignupStats está publicada no Back4App (Master Key em env).
 * Uso: PARSE_MASTER_KEY=... PARSE_SERVER_URL=... node scripts/verify-growth-cloud-deployed.js
 */
const serverUrl = process.env.PARSE_SERVER_URL || process.env.B4A_PARSE_SERVER_URL;
const masterKey = process.env.PARSE_MASTER_KEY || process.env.B4A_MASTER_KEY;

if (!serverUrl || !masterKey) {
  console.error('Defina PARSE_SERVER_URL e PARSE_MASTER_KEY (ou B4A_*).');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${serverUrl.replace(/\/$/, '')}/functions/getGrowthSignupStats`, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': process.env.PARSE_APP_ID || process.env.B4A_APP_ID || '',
      'X-Parse-Master-Key': masterKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ since: '2026-11-10T00:00:00.000Z' }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Falhou:', res.status, text.slice(0, 500));
    console.error('Publique cloud/main.js no Back4App e tente de novo.');
    process.exit(1);
  }
  console.log('OK getGrowthSignupStats:', text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
