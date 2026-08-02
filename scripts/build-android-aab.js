/**
 * Build web + sync Capacitor + gera AAB release assinado para Google Play Console.
 * Saida: android/app/build/outputs/bundle/release/app-release.aab
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const cacheRoot = path.join(root, '.gradle-home');
const tempRoot = path.join(root, '.tmp');
const androidDir = path.join(root, 'android');
const keystoreProps = path.join(androidDir, 'keystore.properties');
const aabPath = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab'
);

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

if (!fs.existsSync(keystoreProps)) {
  console.log('keystore.properties ausente — rodando setup:android-signing...');
  run('node scripts/setup-android-signing.js');
}

if (!fs.existsSync(keystoreProps)) {
  console.error('Falha: android/keystore.properties nao encontrado apos o setup.');
  console.error('Configure a upload key (keystore) antes de gerar o AAB.');
  process.exit(1);
}

run('npm run build');
run('npx cap sync android');
run('.\\gradlew.bat --stop', androidDir);
run('.\\gradlew.bat bundleRelease', androidDir);

if (!fs.existsSync(aabPath)) {
  console.error('bundleRelease terminou sem gerar o AAB em:', aabPath);
  process.exit(1);
}

const stats = fs.statSync(aabPath);
console.log('');
console.log('AAB gerado com sucesso:');
console.log(aabPath);
console.log(`Tamanho: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
console.log('');
console.log('Proximo passo: Play Console → Teste interno → Criar uma nova versao → upload deste arquivo.');
console.log('Guarde backup de android/*.keystore + keystore.properties (upload key).');
