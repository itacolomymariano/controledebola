/**
 * Gera APK release assinado em releases/ para instalacao manual no dispositivo.
 * Alguns antivirus (ex.: Norton) interferem menos quando o usuario instala o APK pelo gerenciador de arquivos.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const releasesDir = path.join(root, 'releases');
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const keystoreProps = path.join(androidDir, 'keystore.properties');

process.env.JAVA_HOME = javaHome;
process.env.PATH = `${javaHome}\\bin;${process.env.PATH}`;
process.env.GRADLE_USER_HOME = path.join(root, '.gradle-home');
process.env.TEMP = path.join(root, '.tmp');
process.env.TMP = path.join(root, '.tmp');

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

if (!fs.existsSync(keystoreProps)) {
  run('node scripts/setup-android-signing.js');
}

run('npm run build');
run('npx cap sync android');
run('.\\gradlew.bat --stop', androidDir);
run('.\\gradlew.bat assembleRelease', androidDir);

const apkSource = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!fs.existsSync(apkSource)) {
  console.error('APK release nao encontrado:', apkSource);
  process.exit(1);
}

const releaseFile = path.join(
  root,
  'src',
  'app',
  'core',
  'constants',
  'app-release.ts'
);
const labelMatch = fs.readFileSync(releaseFile, 'utf8').match(/label:\s*'([^']+)'/);
const label = labelMatch ? labelMatch[1] : 'release';

fs.mkdirSync(releasesDir, { recursive: true });
const apkDest = path.join(releasesDir, `ControleDeBola-${label}.apk`);
fs.copyFileSync(apkSource, apkDest);
console.log('APK exportado:', apkDest);
