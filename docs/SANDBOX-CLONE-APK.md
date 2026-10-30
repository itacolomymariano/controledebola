# APK de apresentação (Back4App Clone_MinhaPelada)

Visão geral **produção vs sandbox** (APK, AAB, IPA): [BUILD-ENVIRONMENTS-AGENTS.md](BUILD-ENVIRONMENTS-AGENTS.md).

Build Android **sandbox** que aponta para o app **Clone_MinhaPelada** (cópia pré-purge), instalável **ao lado** do app de produção (`com.minhapelada.app` → **MinhaPelada**).

Produção limpa: [PROD-DATA-PURGE.md](PROD-DATA-PURGE.md). **Não** rodar `prodDataPurge` no clone.

---

## Pré-requisitos

| Item | Onde |
|------|------|
| App Back4App **Clone_MinhaPelada** | Dashboard → Security & Keys → **Application ID** + **JavaScript Key** |
| JDK 21 | `JAVA_HOME` = Android Studio JBR (ver [AGENTS.md](../AGENTS.md)) |
| Assinatura release | `android/keystore.properties` (`npm run setup:android-signing`) |
| Cloud Code no clone | Herda do clone; se login/cadastro falhar, publique o mesmo `cloud/main.js` no **clone** |

Opcional no clone: **Environment Variables** `SMTP_*` (reset de senha / contato). Sem isso, fluxos de e-mail falham — OK para demo só com contas já existentes no clone.

---

## Configurar chaves (uma vez)

PowerShell, na raiz do repo:

```powershell
copy src\environments\environment.sandbox.local.ts.example src\environments\environment.sandbox.local.ts
```

Edite `environment.sandbox.local.ts` com as chaves do **Clone_MinhaPelada** (não use as da MinhaPelada produção).

**Nunca** commite `environment.sandbox.local.ts`.

---

## Gerar APK

```powershell
cd D:\Ita\git\minhapelada
npm run build:android:sandbox-apk
```

Saída: `releases/ControleDeBola-sandbox-YYYY-MM-DD.apk`  
Pacote Android: **`com.minhapelada.app.sandbox`**  
Nome no launcher: **Controle de Bola (Sandbox)**

Instale pelo gerenciador de arquivos ou:

```powershell
adb install -r releases\ControleDeBola-sandbox-YYYY-MM-DD.apk
```

---

## Voltar o projeto Android para produção

O script aplica `capacitor.config.sandbox.ts` **só durante** o `cap sync` (Capacitor 8 não tem `--config` no sync) e restaura `capacitor.config.ts` em seguida. Mesmo assim, `android/` fica com `com.minhapelada.app.sandbox` até o próximo sync de produção.

Antes de Play/AAB release:

```powershell
npm run build
npx cap sync android
```

(Usa [`capacitor.config.ts`](../capacitor.config.ts) → `com.minhapelada.app`.)

---

## Verificação

1. Celular com **Controle de Bola** (Play) **e** **Controle de Bola (Demo)** instalados.
2. Demo: login com usuário que existe **no clone** (dados pré-purge).
3. Play: base **MinhaPelada** zerada pós-purge — contas antigas podem não existir na produção.

---

## Limitações

| Recurso | Demo sandbox |
|---------|----------------|
| Deep links `controledebola.com` | Podem abrir o app **produção**, não o Demo |
| Push FCM | Configurado para o pacote produção |
| Mesmo keystore | OK; pacotes diferentes |

---

## Referência técnica

| Arquivo | Papel |
|---------|--------|
| [`environment.sandbox.ts`](../src/environments/environment.sandbox.ts) | Parse + flag `sandboxBuild` |
| [`capacitor.config.sandbox.ts`](../capacitor.config.sandbox.ts) | `appId` / nome Demo |
| [`scripts/build-android-sandbox-apk.js`](../scripts/build-android-sandbox-apk.js) | Pipeline sem bump de release |
| `angular.json` → config **sandbox** | `npm run build:sandbox` |
