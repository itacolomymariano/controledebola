const fs = require('fs');
const path = require('path');
const Parse = require('parse/node');

const filePath = path.join(__dirname, '../src/environments/environment.local.ts');
const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
const appId = content.match(/appId:\s*['"]([^'"]+)['"]/)?.[1];
const javascriptKey = content.match(/javascriptKey:\s*['"]([^'"]+)['"]/)?.[1];

if (!appId || !javascriptKey || /COLE_SEU|COLE_SUA/.test(appId + javascriptKey)) {
  console.log('STATUS: NOT_CONFIGURED');
  process.exit(1);
}

Parse.initialize(appId, javascriptKey);
Parse.serverURL = 'https://parseapi.back4app.com';

(async () => {
  try {
    await new Parse.Query('Event').limit(1).find();
    console.log('STATUS: OK');
    console.log('MESSAGE: Conexao OK. Classe Event acessivel.');
  } catch (error) {
    const msg = String(error.message || error);
    const code = error.code;

    if (code === 119 || msg.includes('Permission denied')) {
      console.log('STATUS: OK_KEYS');
      console.log('MESSAGE: Chaves aceitas. Ajuste CLP da classe Event no Back4App.');
      return;
    }

    if (code === 101 || msg.includes('non-existent class') || msg.includes('does not exist')) {
      console.log('STATUS: OK_KEYS');
      console.log('MESSAGE: Chaves validas. Classe Event sera criada no primeiro save.');
      return;
    }

    console.log('STATUS: CHECK');
    console.log('CODE:', code);
    console.log('MESSAGE:', msg.slice(0, 200));
  }
})();
