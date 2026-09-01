/**
 * Aplica icone de marca, entitlements e textos de privacidade iOS
 * depois de `npx cap add ios` (a pasta ios/ nao e versionada).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const iosAppDir = path.join(root, 'ios', 'App', 'App');

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} nao encontrado: ${filePath}`);
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function upsertPlistString(plist, key, value) {
  const keyXml = `<key>${key}</key>`;
  const valueXml = `<string>${value}</string>`;
  if (plist.includes(keyXml)) {
    return plist.replace(
      new RegExp(`${keyXml}\\s*<string>[\\s\\S]*?<\\/string>`),
      `${keyXml}\n\t${valueXml}`
    );
  }
  if (!plist.includes('</dict>')) {
    throw new Error('Info.plist sem </dict>; nao foi possivel inserir chaves de privacidade.');
  }
  return plist.replace(
    '</dict>',
    `\t${keyXml}\n\t${valueXml}\n</dict>`
  );
}

function main() {
  mustExist(iosAppDir, 'Pasta nativa iOS');

  const entitlementsSrc = path.join(root, 'ios-config', 'App.entitlements');
  const entitlementsDest = path.join(iosAppDir, 'App.entitlements');
  mustExist(entitlementsSrc, 'Entitlements');
  fs.copyFileSync(entitlementsSrc, entitlementsDest);

  const iconSrc = path.join(root, 'ios-config', 'AppIcon.appiconset');
  const iconDest = path.join(iosAppDir, 'Assets.xcassets', 'AppIcon.appiconset');
  mustExist(path.join(iconSrc, 'AppIcon-1024.png'), 'App Icon 1024');
  fs.rmSync(iconDest, { recursive: true, force: true });
  copyDir(iconSrc, iconDest);

  const plistPath = path.join(iosAppDir, 'Info.plist');
  mustExist(plistPath, 'Info.plist');
  let plist = fs.readFileSync(plistPath, 'utf8');
  const privacy = {
    NSCameraUsageDescription:
      'O Controle de Bola usa a camera para voce escolher uma foto de perfil e, quando for porteiro, ler o QR Code do ingresso.',
    NSPhotoLibraryUsageDescription:
      'O Controle de Bola acessa sua galeria para voce escolher a foto de perfil e imagens de peladas, times e lendas.',
    NSPhotoLibraryAddUsageDescription:
      'O Controle de Bola pode salvar imagens que voce gerar no aparelho, como convites e compartilhamentos.',
  };
  for (const [key, value] of Object.entries(privacy)) {
    plist = upsertPlistString(plist, key, value);
  }
  fs.writeFileSync(plistPath, plist, 'utf8');

  // Universal (iPhone+iPad) obriga screenshot 13" no Connect. Sem Mac/iPad,
  // o binario fica iPhone-only; no iPad o app abre em compatibilidade.
  const pbxPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  mustExist(pbxPath, 'project.pbxproj');
  let pbx = fs.readFileSync(pbxPath, 'utf8');
  if (!/TARGETED_DEVICE_FAMILY = /.test(pbx)) {
    throw new Error('TARGETED_DEVICE_FAMILY nao encontrado no project.pbxproj.');
  }
  pbx = pbx.replace(/TARGETED_DEVICE_FAMILY = [^;]+;/g, 'TARGETED_DEVICE_FAMILY = 1;');
  if (pbx.includes('TARGETED_DEVICE_FAMILY = "1,2"') || !pbx.includes('TARGETED_DEVICE_FAMILY = 1;')) {
    throw new Error('Nao foi possivel restringir o target a iPhone.');
  }
  fs.writeFileSync(pbxPath, pbx, 'utf8');

  console.log('iOS review config aplicado: icone, entitlements, textos de camera/galeria, iPhone-only.');
}

main();
