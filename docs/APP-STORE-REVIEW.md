# App Store Review — Controle de Bola

Procedimentos para a rejeicao de 22/08/2026 (versao 1.0 build 79, iPhone 17 Pro Max / iOS 26.6).

Apos o codigo desta correcao, a proxima compilacao iOS deve ir como **1.0.1** (`package.json`) com `versionCode` novo (o `prebuild` incrementa sozinho).

## O que o codigo ja corrige

| Guideline | Problema da Apple | O que mudou no app |
|-----------|-------------------|--------------------|
| 2.3.8 | Icones de placeholder | Logo final em Android e, no CI iOS, `ios-config/AppIcon.appiconset` via `scripts/apply-ios-review-config.js` |
| 5.1.1(v) dados | Telefone, nascimento e endereco obrigatorios | So o **e-mail** e obrigatorio no cadastro e em Meus dados. Os tres campos sao opcionais |
| 2.1(a) | Crash ao tirar foto de perfil | Textos de camera/galeria no `Info.plist` + compressao de imagem a prova de HEIC |
| 5.1.1(v) exclusao | Sem exclusao de conta | Perfil / Meus dados → **Excluir conta**. Cloud `deleteMyAccount` apaga o usuario de forma permanente |

## O que voce precisa fazer (nao e codigo)

### 1. Publicar o Cloud Code no Back4App

Sem isso, cadastro/edicao e exclusao de conta falham no aparelho da Apple.

1. Rode `npm run build:cloud` (ja gera `cloud/main.js`).
2. Back4App → Server Settings → Cloud Code → cole/publique o `cloud/main.js` novo.
3. Teste no app: criar conta **so com e-mail** (sem celular, nascimento e endereco) e excluir essa conta.

### 2. Gerar IPA novo e enviar ao TestFlight

1. Commit e push destas alteracoes na `main`.
2. GitHub Actions → **iOS Capacitor Build** → Run workflow → `release-ipa` (nao use Re-run de um job antigo).
3. Espere o upload automatico para o TestFlight.
4. No App Store Connect, selecione a compilacao **1.0.1** na versao e envie para revisao.

### 3. Guideline 2.3.10 — screenshots (so App Store Connect)

A Apple viu **barra de status de Android** (ou de outro SO) nas imagens.

1. Abra o app em um **iPhone fisico** (ou simulador iOS) da compilacao nova.
2. Capture telas das funcoes principais: peladas, evento, mural, perfil.
3. App Store Connect → a versao do app → **Previews and Screenshots** → **View All Sizes in Media Manager**.
4. Substitua **todas** as screenshots de iPhone. Nao use prints do Android, da Play nem de navegador desktop.
5. A barra de status deve ser a do iOS (ou use o recorte sem barra de outro sistema).

### 4. Gravacao de exclusao de conta (obrigatoria na resposta)

A Apple pede um video em **aparelho fisico**:

1. Criar uma conta nova (ou entrar com a conta demo).
2. Ir em **Meu Perfil** → **Excluir conta** (ou **Meus dados** → **Excluir conta**).
3. Confirmar o aviso, digitar a senha e concluir ate a tela de conta excluida / login.

Coloque o video em **App Store Connect → App Review Information → Notes** (campo Notas).

### 5. Texto para responder a App Review

Responda na thread da rejeicao (pode colar em portugues ou ingles). Sugestao:

```
Hello,

We addressed every issue from the August 22 review of version 1.0 (79).

2.3.8 Icons
The previous binary used Capacitor placeholder icons. This build uses our final Controle de Bola logo for the App Store / home-screen icon on iOS and Android.

5.1.1(v) Required personal data
Phone number, date of birth and full address are now optional. New accounts only require name, nickname, email and password. Users can add the other fields later in Meus dados.

2.1(a) Crash taking a profile photo
The crash happened because iOS had no camera / photo-library usage strings, and some camera files (HEIC) were not handled. This build adds NSCameraUsageDescription and NSPhotoLibraryUsageDescription, and the image pipeline no longer crashes on those files.

5.1.1(v) Account deletion
Users can permanently delete the account in Profile → Excluir conta (also in Meus dados). They confirm, type their password, and the server deletes the user. A screen recording of the full flow on a physical device is attached in the Review Notes.

2.3.10 Screenshots
We replaced the screenshots with captures from iOS so they no longer show a non-iOS status bar.

Demo account: [preencha e-mail e senha da conta de teste]
```

Complete o e-mail/senha da conta demo e anexe o video nas Notes.

## Checklist antes de clicar em Submit

- [ ] `cloud/main.js` publicado no Back4App
- [ ] Conta nova criada so com e-mail (sem telefone/nascimento/endereco)
- [ ] Foto de perfil (camera e galeria) sem crash no iPhone
- [ ] Exclusao de conta concluida de ponta a ponta
- [ ] Screenshots so de iOS, em todos os tamanhos do Media Manager
- [ ] Video da exclusao nas Notes
- [ ] Compilacao 1.0.1 selecionada na versao
