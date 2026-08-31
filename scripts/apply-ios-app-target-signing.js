/**
 * Aplica assinatura Manual so no target App (bundle com.minhapelada.app).
 * Pacotes SPM (IONCameraLib, Capacitor*, etc.) nao aceitam PROVISIONING_PROFILE
 * passado no xcodebuild — o Xcode aplica a todos os targets e o archive falha.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pbxPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const team = String(process.env.DEVELOPMENT_TEAM || '').trim();
const profileName = String(process.env.PROVISIONING_PROFILE_NAME || '').trim();

if (!fs.existsSync(pbxPath)) {
  throw new Error(`project.pbxproj nao encontrado: ${pbxPath}`);
}
if (!team || !profileName) {
  throw new Error('DEVELOPMENT_TEAM e PROVISIONING_PROFILE_NAME sao obrigatorios.');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertSetting(block, key, value) {
  const pattern = new RegExp(`^(\\t+)${escapeRegExp(key)} = [^;]+;`, 'm');
  if (pattern.test(block)) {
    return block.replace(pattern, `$1${key} = ${value};`);
  }
  return block.replace(/\n(\t+)\};(\s*)$/, `\n$1\t${key} = ${value};\n$1};$2`);
}

let pbx = fs.readFileSync(pbxPath, 'utf8');
if (!pbx.includes('PRODUCT_BUNDLE_IDENTIFIER = com.minhapelada.app;')) {
  throw new Error('Bundle ID com.minhapelada.app nao encontrado no project.pbxproj.');
}

const settings = [
  ['CODE_SIGN_STYLE', 'Manual'],
  ['DEVELOPMENT_TEAM', team],
  ['CODE_SIGN_IDENTITY', '"Apple Distribution"'],
  ['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"', '"Apple Distribution"'],
  ['PROVISIONING_PROFILE_SPECIFIER', `"${profileName.replace(/"/g, '\\"')}"`],
];

let patched = 0;
pbx = pbx.replace(
  /[0-9A-F]{24} \/\* (?:Debug|Release) \*\/ = \{[\s\S]*?\n\t\t\};/g,
  (block) => {
    if (
      !block.includes('isa = XCBuildConfiguration;') ||
      !block.includes('PRODUCT_BUNDLE_IDENTIFIER = com.minhapelada.app;') ||
      !block.includes('INFOPLIST_FILE = App/Info.plist;')
    ) {
      return block;
    }
    const settingsMatch = block.match(/buildSettings = \{[\s\S]*?\n\t\t\t\};/);
    if (!settingsMatch) {
      throw new Error('buildSettings do target App nao encontrado.');
    }
    let nextSettings = settingsMatch[0];
    for (const [key, value] of settings) {
      nextSettings = upsertSetting(nextSettings, key, value);
    }
    patched += 1;
    return block.replace(settingsMatch[0], nextSettings);
  }
);

if (patched < 2) {
  throw new Error(
    `Esperava assinar Debug e Release do target App; configs alteradas: ${patched}.`
  );
}

if (pbx.includes('ProvisioningStyle = Automatic;')) {
  pbx = pbx.replace(/ProvisioningStyle = Automatic;/g, 'ProvisioningStyle = Manual;');
}

fs.writeFileSync(pbxPath, pbx, 'utf8');
console.log(
  `Assinatura Manual aplicada so ao target App (${patched} configs, team=${team}, profile=${profileName}).`
);
