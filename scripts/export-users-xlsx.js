/**
 * Exporta usuarios Parse para Excel.
 * Colunas: Nome, email, phone, senha, Perfil cadastrado, Estado, Cidade, Bairro, Posicao
 *
 * Uso (PowerShell):
 *   $env:PARSE_MASTER_KEY = "sua-master-key"
 *   node scripts/export-users-xlsx.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'exports');
const serverURL = 'https://parseapi.back4app.com';

const PROFILE_ROLE_LABELS = {
  athlete: 'Atleta',
  referee: 'Juiz',
  scout: 'Scout / Mesario',
  journalist: 'Jornalista',
  cameraman: 'Cinegrafista',
  narrator: 'Narrador',
  coach: 'Treinador',
  physical_trainer: 'Preparador Fisico',
  masseur: 'Massagista',
  kitman: 'Ropeiro',
  gandula: 'Gandula',
  gatekeeper: 'Porteiro',
  fan: 'Torcedor',
};

function loadParseLocal() {
  const localPath = path.join(root, 'src', 'environments', 'environment.local.ts');
  const text = fs.readFileSync(localPath, 'utf8');
  const appId = (text.match(/appId:\s*'([^']+)'/) || [])[1];
  if (!appId) {
    throw new Error('appId nao encontrado em environment.local.ts');
  }
  return { appId };
}

function parseRequest(pathname, { appId, masterKey }) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, serverURL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': appId,
          'X-Parse-Master-Key': masterKey,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          let json;
          try {
            json = JSON.parse(body || '{}');
          } catch {
            reject(new Error(`Resposta invalida (${res.statusCode}): ${body.slice(0, 200)}`));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `Parse HTTP ${res.statusCode}: ${json.error || json.message || body.slice(0, 200)}`
              )
            );
            return;
          }
          resolve(json);
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllClass(classPath, creds, keys) {
  const pageSize = 1000;
  const rows = [];
  let skip = 0;
  const keysParam = keys ? `&keys=${encodeURIComponent(keys)}` : '';
  for (;;) {
    const data = await parseRequest(
      `/${classPath}?limit=${pageSize}&skip=${skip}${keysParam}`,
      creds
    );
    const batch = Array.isArray(data.results) ? data.results : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return rows;
}

function userIdFromPointer(row) {
  const user = row.user;
  if (!user) return '';
  if (typeof user === 'string') return user;
  return String(user.objectId || user.id || '').trim();
}

function roleLabel(role) {
  return PROFILE_ROLE_LABELS[role] || String(role || '').trim();
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colName(index) {
  let n = index;
  let name = '';
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

function writeXlsx(filePath, rows) {
  const sheetRows = rows
    .map((row, index) => {
      const r = index + 1;
      return (
        `<row r="${r}">` +
        row
          .map((cell, colIdx) => {
            const col = colName(colIdx);
            return `<c r="${col}${r}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
          })
          .join('') +
        `</row>`
      );
    })
    .join('');

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Usuarios" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  const tmp = path.join(outDir, `.xlsx-tmp-${Date.now()}`);
  fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'xl', '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'xl', 'worksheets'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '[Content_Types].xml'), contentTypesXml);
  fs.writeFileSync(path.join(tmp, '_rels', '.rels'), relsXml);
  fs.writeFileSync(path.join(tmp, 'xl', 'workbook.xml'), workbookXml);
  fs.writeFileSync(path.join(tmp, 'xl', '_rels', 'workbook.xml.rels'), workbookRelsXml);
  fs.writeFileSync(path.join(tmp, 'xl', 'worksheets', 'sheet1.xml'), sheetXml);

  const zipPath = `${filePath}.zip`;
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${tmp}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
  fs.renameSync(zipPath, filePath);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function athletePosition(profile) {
  const parts = [
    profile.primaryPosition,
    profile.secondaryPosition,
    profile.thirdPosition,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

async function main() {
  const masterKey = String(process.env.PARSE_MASTER_KEY || '').trim();
  if (!masterKey) {
    console.error('Defina PARSE_MASTER_KEY (Back4App → App Settings → Security & Keys).');
    console.error('Ex.: $env:PARSE_MASTER_KEY = "sua-chave"; node scripts/export-users-xlsx.js');
    process.exit(1);
  }

  const { appId } = loadParseLocal();
  const creds = { appId, masterKey };

  console.log('Buscando usuarios...');
  const users = await fetchAllClass(
    'users',
    creds,
    'name,apelido,email,phone,username,address,primaryRole'
  );

  console.log('Buscando perfis de atleta...');
  const athleteProfiles = await fetchAllClass(
    'classes/AthleteProfile',
    creds,
    'user,primaryPosition,secondaryPosition,thirdPosition'
  );

  console.log('Buscando perfis profissionais...');
  const roleProfiles = await fetchAllClass('classes/RoleProfile', creds, 'user,role');

  console.log('Buscando perfis de torcedor...');
  let fanProfiles = [];
  try {
    fanProfiles = await fetchAllClass('classes/FanProfile', creds, 'user');
  } catch (error) {
    console.warn('FanProfile indisponivel:', error instanceof Error ? error.message : error);
  }

  /** @type {Map<string, Set<string>>} */
  const rolesByUser = new Map();
  /** @type {Map<string, string>} */
  const positionByUser = new Map();

  const addRole = (userId, role) => {
    if (!userId || !role) return;
    if (!rolesByUser.has(userId)) rolesByUser.set(userId, new Set());
    rolesByUser.get(userId).add(role);
  };

  for (const profile of athleteProfiles) {
    const userId = userIdFromPointer(profile);
    addRole(userId, 'athlete');
    const position = athletePosition(profile);
    if (position) positionByUser.set(userId, position);
  }

  for (const profile of roleProfiles) {
    const userId = userIdFromPointer(profile);
    addRole(userId, String(profile.role || '').trim());
  }

  for (const profile of fanProfiles) {
    const userId = userIdFromPointer(profile);
    addRole(userId, 'fan');
  }

  const header = [
    'Nome',
    'email',
    'phone',
    'senha',
    'Perfil cadastrado',
    'Estado',
    'Cidade',
    'Bairro',
    'Posicao',
  ];
  const rows = [header];

  for (const user of users) {
    const userId = String(user.objectId || '').trim();
    const nome =
      String(user.name || '').trim() ||
      String(user.apelido || '').trim() ||
      String(user.username || '').trim() ||
      '';

    const roleSet = rolesByUser.get(userId) || new Set();
    const primaryRole = String(user.primaryRole || '').trim();
    if (primaryRole) roleSet.add(primaryRole);

    const profiles = [...roleSet]
      .map(roleLabel)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const address = user.address && typeof user.address === 'object' ? user.address : {};
    const hasAthlete = roleSet.has('athlete');
    const position = hasAthlete ? positionByUser.get(userId) || '' : '';

    rows.push([
      nome,
      String(user.email || '').trim(),
      String(user.phone || '').trim(),
      '',
      profiles.join(', '),
      String(address.state || '').trim(),
      String(address.city || '').trim(),
      String(address.neighborhood || '').trim(),
      position,
    ]);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const filePath = path.join(outDir, `usuarios-controle-de-bola-${stamp}.xlsx`);
  writeXlsx(filePath, rows);

  // CSV complementar (abre facil no Excel / WhatsApp)
  const csvPath = path.join(outDir, `usuarios-controle-de-bola-${stamp}.csv`);
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? '');
          if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
          return text;
        })
        .join(',')
    )
    .join('\r\n');
  fs.writeFileSync(csvPath, `\uFEFF${csv}`, 'utf8');

  console.log(`Usuarios: ${users.length}`);
  console.log(`Planilha Excel: ${filePath}`);
  console.log(`Planilha CSV:   ${csvPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
