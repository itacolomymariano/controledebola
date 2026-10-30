/**
 * APK release assinado apontando para Back4App Clone_MinhaPelada (pacote .sandbox).
 * Nao executa prebuild / bump de release de loja.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const releasesDir = path.join(root, 'releases');
const sandboxLocal = path.join(root, 'src', 'environments', 'environment.sandbox.local.ts');
const sandboxExample = path.join(root, 'src', 'environments', 'environment.sandbox.local.ts.example');
const studioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const javaHome = fs.existsSync(studioJbr) ? studioJbr : process.env.JAVA_HOME || studioJbr;
const keystoreProps = path.join(androidDir, 'keystore.properties');
const gradlePath = path.join(androidDir, 'app', 'build.gradle');
const googleServicesPath = path.join(androidDir, 'app', 'google-services.json');
const PROD_APP_ID = 'com.minhapelada.app';
const SANDBOX_APP_ID = 'com.minhapelada.app.sandbox';
const SANDBOX_APP_LABEL = 'Controle de Bola (Sandbox)';
const stringsPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');

/** Gradle exige client com package sandbox; push FCM ideal exige app registrado no Firebase. */
function patchGoogleServicesForSandbox() {
  const original = fs.readFileSync(googleServicesPath, 'utf8');
  const data = JSON.parse(original);
  const clients = Array.isArray(data.client) ? data.client : [];
  const hasSandbox = clients.some(
    (c) => c?.client_info?.android_client_info?.package_name === SANDBOX_APP_ID
  );
  if (hasSandbox) {
    return { original: null };
  }
  const prod = clients.find(
    (c) => c?.client_info?.android_client_info?.package_name === PROD_APP_ID
  );
  if (!prod) {
    throw new Error(`google-services.json sem cliente Android ${PROD_APP_ID}`);
  }
  const sandboxClient = JSON.parse(JSON.stringify(prod));
  sandboxClient.client_info.android_client_info.package_name = SANDBOX_APP_ID;
  data.client.push(sandboxClient);
  fs.writeFileSync(googleServicesPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { original };
}

process.env.JAVA_HOME = javaHome;
process.env.PATH = `${javaHome}\\bin;${process.env.PATH}`;
process.env.GRADLE_USER_HOME = path.join(root, '.gradle-home');
process.env.TEMP = path.join(root, '.tmp');
process.env.TMP = path.join(root, '.tmp');

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

if (!fs.existsSync(sandboxLocal)) {
  console.error('Arquivo ausente:', sandboxLocal);
  console.error('Copie o example e preencha com as chaves do Clone_MinhaPelada:');
  console.error('  copy src\\environments\\environment.sandbox.local.ts.example src\\environments\\environment.sandbox.local.ts');
  console.error('Ver docs/SANDBOX-CLONE-APK.md');
  process.exit(1);
}

if (!fs.existsSync(keystoreProps)) {
  run('node scripts/setup-android-signing.js');
}

run('npm run build:sandbox');

const mainCapConfig = path.join(root, 'capacitor.config.ts');
const sandboxCapConfig = path.join(root, 'capacitor.config.sandbox.ts');
const capBackup = path.join(root, 'capacitor.config.ts.production-backup');
if (!fs.existsSync(sandboxCapConfig)) {
  console.error('Ausente:', sandboxCapConfig);
  process.exit(1);
}
const gradleBackup = path.join(androidDir, 'app', 'build.gradle.production-backup');
fs.copyFileSync(mainCapConfig, capBackup);
fs.copyFileSync(gradlePath, gradleBackup);
try {
  fs.copyFileSync(sandboxCapConfig, mainCapConfig);
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(
    new RegExp(`applicationId "${PROD_APP_ID.replace(/\./g, '\\.')}"`),
    `applicationId "${SANDBOX_APP_ID}"`
  );
  if (!gradle.includes(SANDBOX_APP_ID)) {
    throw new Error(`Nao foi possivel definir applicationId ${SANDBOX_APP_ID} em build.gradle`);
  }
  fs.writeFileSync(gradlePath, gradle, 'utf8');
  run('npx cap sync android');
} finally {
  fs.copyFileSync(capBackup, mainCapConfig);
  fs.unlinkSync(capBackup);
}
const stringsBackup = path.join(androidDir, 'strings.xml.production-backup');
fs.copyFileSync(stringsPath, stringsBackup);
let stringsXml = fs.readFileSync(stringsPath, 'utf8');
stringsXml = stringsXml.replace(
  /<string name="app_name">[^<]*<\/string>/,
  `<string name="app_name">${SANDBOX_APP_LABEL}</string>`
);
stringsXml = stringsXml.replace(
  /<string name="title_activity_main">[^<]*<\/string>/,
  `<string name="title_activity_main">${SANDBOX_APP_LABEL}</string>`
);
fs.writeFileSync(stringsPath, stringsXml, 'utf8');
const googleServicesBackup = patchGoogleServicesForSandbox();
try {
  run('.\\gradlew.bat --stop', androidDir);
  run('.\\gradlew.bat assembleRelease', androidDir);
} finally {
  if (googleServicesBackup.original) {
    fs.writeFileSync(googleServicesPath, googleServicesBackup.original, 'utf8');
  }
  if (fs.existsSync(stringsBackup)) {
    fs.copyFileSync(stringsBackup, stringsPath);
    fs.unlinkSync(stringsBackup);
  }
  if (fs.existsSync(gradleBackup)) {
    fs.copyFileSync(gradleBackup, gradlePath);
    fs.unlinkSync(gradleBackup);
  }
}

const apkSource = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apkSource)) {
  console.error('APK release nao encontrado:', apkSource);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 10);
fs.mkdirSync(releasesDir, { recursive: true });
const apkDest = path.join(releasesDir, `ControleDeBola-sandbox-${stamp}.apk`);
fs.copyFileSync(apkSource, apkDest);
console.log('APK sandbox exportado:', apkDest);
console.log('Pacote: com.minhapelada.app.sandbox — re-sync producao: npm run build && npx cap sync android');
