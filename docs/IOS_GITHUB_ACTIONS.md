# Build iOS com GitHub Actions — Controle de Bola

Workflow: [`.github/workflows/ios-capacitor-build.yml`](../.github/workflows/ios-capacitor-build.yml)

Executa em **macos-15** (Xcode 16+): build Angular/Ionic → Capacitor `ios/` → CocoaPods → `xcodebuild`.

Nao e necessario Mac local para compilar. A pasta `ios/` e gerada no runner (esta no `.gitignore`).

## 1. Publicar o codigo no GitHub

Esta pasta precisa ser um repositorio Git com remote no GitHub.

Se ainda nao houver `.git` / remote:

```powershell
cd D:\Ita\git\minhapelada
git init
git add .
git commit -m "Initial commit: Controle de Bola App"
```

No GitHub: **New repository** (ex.: `ControleDeBola` ou `minhapelada`), sem README. Depois:

```powershell
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

**Nao commitar:** `src/environments/environment.local.ts`, keystores Android, `/ios/`, `/www/`, `/exports/`.

## 2. Secrets (Settings → Secrets and variables → Actions)

### Obrigatorio para qualquer build (simulator ou IPA)

| Secret | Descricao |
|--------|-----------|
| `ENVIRONMENT_LOCAL_TS` | Conteudo **inteiro** de `src/environments/environment.local.ts` (chaves Back4App). O arquivo e gitignored; o CI reescreve a partir deste secret. |

Como cadastrar:

1. Abra `src/environments/environment.local.ts` no editor.
2. Copie o arquivo inteiro (incluindo `export const parseLocal = { ... }`).
3. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**.
4. Name: `ENVIRONMENT_LOCAL_TS` · Value: cole o conteudo.

Modelo: [`src/environments/environment.local.ts.example`](../src/environments/environment.local.ts.example).

### Release IPA (somente build `release-ipa`)

Exige [Apple Developer Program](https://developer.apple.com/programs/enroll/) (~US$ 99/ano) e certificados.

| Secret | Descricao |
|--------|-----------|
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Certificado `.p12` (Apple Distribution) em Base64 |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | Senha do `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Perfil **App Store** (`.mobileprovision`) em Base64 |

Bundle ID do app: **`com.minhapelada.app`** (igual ao Android / `capacitor.config.ts`).

PowerShell para gerar Base64 (no Windows):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\distribution.p12"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\ControleDeBola_AppStore.mobileprovision"))
```

Cole cada valor **em uma unica linha** no secret correspondente.

#### Checklist pos-conta Apple (antes do 1º IPA)

1. Inscrever e ativar o Apple Developer Program.
2. Em [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list):
   - Criar App ID com Bundle ID `com.minhapelada.app`.
   - Criar certificado **Apple Distribution** e exportar `.p12` (pode precisar de Mac ou CSR no portal).
   - Criar perfil **App Store** ligado a esse App ID e certificado; baixar `.mobileprovision`.
3. Em [App Store Connect](https://appstoreconnect.apple.com): criar o app **Controle de Bola** com o mesmo Bundle ID.
4. Cadastrar os tres secrets `IOS_DISTRIBUTION_*` no GitHub.
5. Actions → **iOS Capacitor Build** → Run workflow → `release-ipa`.

## 3. Como disparar

| Gatilho | Build |
|---------|--------|
| Push/PR em `main`/`master` (paths do workflow) | **Simulator** (valida compilacao) |
| Actions → **iOS Capacitor Build** → Run workflow | Escolher `simulator` ou `release-ipa` |

## 4. Artefatos

Apos o job, em **Summary → Artifacts**:

- `ios-simulator-build` — `.app` de simulador (teste de compile; ~14 dias)
- `ios-release-ipa` — IPA assinado (se secrets de signing OK; ~30 dias)

Upload para **TestFlight** ainda e manual: baixe o IPA → [Transporter](https://apps.apple.com/app/transporter/id1450874784) (Mac) ou App Store Connect API (workflow futuro).

## 5. Script local / CI

```bash
# No runner (apos `npx cap add ios`): build web + sync Capacitor
npm run build:ios:ci
```

No Windows, `npx cap add ios` / `xcodebuild` **nao** funcionam; use sempre o GitHub Actions.

## 6. Limitacoes

- Sem Mac local: use este workflow.
- Push notifications no iPhone (APNs / Firebase iOS) **ainda nao** estao neste passo — o app Android ja usa FCM; iOS push e fase seguinte.
- Pasta `ios/` nao versionada; gerada a cada run.
- Conta Apple Developer obrigatoria apenas para `release-ipa` / TestFlight / App Store.

## 7. Troubleshooting

| Erro | Acao |
|------|------|
| `ENVIRONMENT_LOCAL_TS ausente` | Cadastrar o secret com o conteudo de `environment.local.ts` |
| Code signing / provisioning | Conferir os tres secrets `IOS_DISTRIBUTION_*` e Bundle ID `com.minhapelada.app` |
| `cap add ios` / CocoaPods | Reexecutar; runner usa `macos-15` + CocoaPods 1.16.2 |
| Run falha em 0s | YAML invalido; ver log de validacao do workflow no GitHub |
| IPA nao aparece no artifact | Abrir log do step `Build iOS (Release IPA)`; conferir Team ID do perfil |

## 8. Proximos passos (fora deste workflow)

1. Conta Apple Developer + secrets de signing.
2. Primeiro IPA → TestFlight (testers internos).
3. Ficha App Store (screenshots, privacidade, conta demo).
4. Depois: APNs / push iOS; upload automatico TestFlight; eventualmente versionar `ios/` se precisar customizar nativo.
