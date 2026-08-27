# Deep Links / App Links — Controle de Bola

Objetivo: compartilhar um **link** (como o YouTube) que:
1. Gera **card com preview** (Open Graph) nas redes sociais
2. Ao tocar, **abre o app** se instalado (Android App Links / iOS Universal Links)
3. Se nao instalado, abre o **site** (`/app` → `/download` / Play Store quando disponivel)

## URLs cobertas

| URL | Uso |
|-----|-----|
| `https://controledebola.com/app` | Convite (share do app) |
| `https://controledebola.com/invite` | Alias → redireciona para `/app` |
| `https://controledebola.com/download` | Pagina de download (tambem pode abrir o app) |

Pacote / Bundle ID: `com.minhapelada.app`

## O que ja esta no codigo (este repo)

- `AndroidManifest.xml`: `intent-filter` com `android:autoVerify="true"` para os paths acima
- `DeepLinkService`: trata cold start + `appUrlOpen` → `/tabs/peladas` ou `/login`
- `AppInviteShareService`: compartilha o link de **teste interno** da Google Play
  (`https://play.google.com/apps/internaltest/...`) ate a listagem publica. Landing do site
  permanece em `https://controledebola.com/app` (fallback / marketing).

## Site (`controledebolasite`)

Publicar e preencher:

1. `public/.well-known/assetlinks.json` — fingerprints SHA-256
2. `public/.well-known/apple-app-site-association` — `APPLE_TEAM_ID`
3. `public/_headers` — Content-Type JSON
4. Pagina `src/pages/app.astro` — landing + intent Android

### Preencher SHA-256 (Android)

No repo do app:

```powershell
.\scripts\print-android-app-link-sha256.ps1
```

Cole o valor em `assetlinks.json` no lugar de `REPLACE_WITH_UPLOAD_KEY_SHA256`.

Quando o app estiver na **Google Play** com Play App Signing, adicione tambem o SHA-256 da **App signing key** (Play Console → App integrity).

### Preencher Team ID (iOS)

1. Apple Developer → Membership → Team ID
2. Substitua `APPLE_TEAM_ID` em `apple-app-site-association`
3. No Xcode / Capacitor iOS: Associated Domains → `applinks:controledebola.com` e `applinks:www.controledebola.com`

Template de entitlement: `ios-config/App.entitlements` (aplicar quando a pasta `ios/` for gerada).

## Verificacao

### Android

```text
https://controledebola.com/.well-known/assetlinks.json
```

Deve retornar JSON puro (nao HTML).

No dispositivo:

```powershell
adb shell pm get-app-links com.minhapelada.app
```

Status esperado: `verified` para `controledebola.com`.

Teste manual:

```powershell
adb shell am start -a android.intent.action.VIEW -d "https://controledebola.com/app"
```

### iOS

```text
https://controledebola.com/.well-known/apple-app-site-association
```

JSON puro + Associated Domains no app.

### WhatsApp / redes

Compartilhar `https://controledebola.com/app` e confirmar o card (titulo/imagem OG). O toque no card abre o app ou o site.

## Limitacoes

- Sem Play Store publicada, quem nao tem o APK cai em `/download` (“Em breve”).
- Universal Links iOS so funcionam apos conta Apple + build com Associated Domains.
- A verificacao Android pode levar minutos apos publicar `assetlinks.json`; reinstalacao do app ajuda.
- O WhatsApp ainda pode mostrar a URL como texto editavel; o **card clicavel** e o comportamento tipo YouTube.
