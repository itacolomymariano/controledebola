/**
 * Gera keystore de desenvolvimento e keystore.properties para builds release.
 * APK release assinado reduz falsos positivos de antivirus (ex.: Norton) vs installDebug.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const keystoreFile = 'controle-de-bola-dev.keystore';
const keystorePath = path.join(androidDir, keystoreFile);
const propsPath = path.join(androidDir, 'keystore.properties');
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Android\\Android Studio\\jbr';
const keytool = path.join(javaHome, 'bin', 'keytool.exe');

const DEV_STORE_PASSWORD = 'ControleDeBolaDev2026';
const DEV_KEY_ALIAS = 'controledebola';

if (fs.existsSync(propsPath) && fs.existsSync(keystorePath)) {
  console.log('Assinatura Android ja configurada:', propsPath);
  process.exit(0);
}

if (!fs.existsSync(keytool)) {
  console.error('keytool nao encontrado em', keytool);
  console.error('Defina JAVA_HOME (Android Studio JBR) e tente novamente.');
  process.exit(1);
}

if (!fs.existsSync(keystorePath)) {
  console.log('Gerando keystore de desenvolvimento...');
  const dname = 'CN=Controle de Bola, OU=Dev, O=MinhaPelada, L=Brasil, ST=BR, C=BR';
  execSync(
    `"${keytool}" -genkeypair -v -storetype PKCS12 -keystore "${keystorePath}" ` +
      `-alias ${DEV_KEY_ALIAS} -keyalg RSA -keysize 2048 -validity 10000 ` +
      `-storepass ${DEV_STORE_PASSWORD} -keypass ${DEV_STORE_PASSWORD} ` +
      `-dname "${dname}"`,
    { stdio: 'inherit', shell: true }
  );
}

const props = [
  `# Gerado por scripts/setup-android-signing.js — nao commitar`,
  `storeFile=${keystoreFile}`,
  `storePassword=${DEV_STORE_PASSWORD}`,
  `keyAlias=${DEV_KEY_ALIAS}`,
  `keyPassword=${DEV_STORE_PASSWORD}`,
  '',
].join('\n');

fs.writeFileSync(propsPath, props, 'utf8');
console.log('Keystore e keystore.properties criados em android/');
console.log('Use npm run install:android para instalar APK release assinado.');
