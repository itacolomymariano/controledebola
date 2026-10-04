/**
 * Build, sync e instala APK debug no dispositivo Android conectado.
 * Debug e inspecionavel no chrome://inspect/#devices (release nao e).
 * Nao incrementa versao (usa ng build, sem prebuild).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const studioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const javaHome = fs.existsSync(studioJbr) ? studioJbr : process.env.JAVA_HOME || studioJbr;
const cacheRoot = path.join(root, '.gradle-home');
const tempRoot = path.join(root, '.tmp');

fs.mkdirSync(cacheRoot, { recursive: true });
fs.mkdirSync(tempRoot, { recursive: true });

process.env.JAVA_HOME = javaHome;
process.env.PATH = `${javaHome}\\bin;${process.env.PATH}`;
process.env.GRADLE_USER_HOME = cacheRoot;
process.env.TEMP = tempRoot;
process.env.TMP = tempRoot;

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: 'inherit', shell: true });
}

run('npx ng build');
run('npx cap sync android');
run('.\\gradlew.bat --stop', path.join(root, 'android'));
run('.\\gradlew.bat installDebug', path.join(root, 'android'));
