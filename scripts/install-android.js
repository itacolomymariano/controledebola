/**
 * Build, sync e instala APK release assinado no dispositivo Android conectado.
 * Release reduz falsos positivos de antivirus vs APK debug (installDebug).
 * Marca o release como instalado via APP_RELEASE_INSTALL.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const cacheRoot = path.join(root, '.gradle-home');
const tempRoot = path.join(root, '.tmp');
const keystoreProps = path.join(root, 'android', 'keystore.properties');

fs.mkdirSync(cacheRoot, { recursive: true });
fs.mkdirSync(tempRoot, { recursive: true });

process.env.JAVA_HOME = javaHome;
process.env.PATH = `${javaHome}\\bin;${process.env.PATH}`;
process.env.GRADLE_USER_HOME = cacheRoot;
process.env.TEMP = tempRoot;
process.env.TMP = tempRoot;
process.env.APP_RELEASE_INSTALL = '1';

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

if (!fs.existsSync(keystoreProps)) {
  run('node scripts/setup-android-signing.js');
}

run('npm run build');
run('npx cap sync android');
run('.\\gradlew.bat --stop', path.join(root, 'android'));
run('.\\gradlew.bat installRelease', path.join(root, 'android'));
