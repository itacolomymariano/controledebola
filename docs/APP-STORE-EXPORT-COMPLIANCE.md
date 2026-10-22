# Conformidade de exportação (criptografia) — App Store Connect

Guia operacional para **Controle de Bola** (`com.minhapelada.app`, Apple ID [6801505260](https://appstoreconnect.apple.com/apps/6801505260)).

Referência Apple: [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).

---

## Resumo técnico

| Uso | Implementação | Exportação |
|-----|---------------|------------|
| API / backend | HTTPS → Back4App (`Parse.serverURL` no app nativo) | **Isento** (TLS padrão) |
| Mídia / arquivos | URLs HTTPS | Isento |
| App Links | Associated Domains (`controledebola.com`) | Não é criptografia extra |
| “Biometria” / digital | Credenciais em **Ionic Storage** (conveniência local); **não** cifra com algoritmo próprio nem Keychain | Não caracteriza criptografia **não isenta** |
| Dependências | Sem libs de criptografia custom em `package.json` / `src/` | — |

**Conclusão:** o app usa **somente** criptografia isenta (HTTPS/TLS e APIs padrão). **Não** enviar CCATS/ERN. **Não** marcar criptografia proprietária.

Builds geradas no CI incluem `ITSAppUsesNonExemptEncryption = false` no `Info.plist` ([scripts/apply-ios-review-config.js](../scripts/apply-ios-review-config.js)).

---

## Por que a versão 1.0.7 não mostra compilação?

**Você não faz upload na tela da versão.** O texto *“Faça o upload das suas compilações…”* aparece quando **nenhuma build está elegível** para aquela ficha — não é um botão de envio novo. O fluxo normal é: IPA já no TestFlight → **Distribuição** → versão → **Compilação** → botão **+** → escolher **271** → **Concluído** → **Salvar**.

Guia Apple: [Choose a build to submit](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/).

### Build 271 no TestFlight mas Compilação vazia na versão

| O que verificar | Onde | Ação |
|-----------------|------|------|
| **Criptografia não isenta = Não** | TestFlight → clique na build **271** → Informações gerais | Conformidade **da build** OK; siga abaixo |
| Lista de builds (não só Uploads) | TestFlight → barra lateral **Compilações → iOS** (tabela com ícones) | Se **271** tiver aviso **Missing Compliance**, **Manage** / **Fornecer informações…** |
| Documentação **no app** (primeira vez) | **Distribuição → Informações do app** → Documentação sobre criptografia → **Carregar** | PDF [encryption-self-classification-en.txt](export-compliance/encryption-self-classification-en.txt); aguarde processamento (pode levar horas). A faixa azul na versão costuma sumir depois |
| Botão **+** | Ficha **Versão 1.0.7** → seção **Compilação** (canto direito do título) | Se **+** não aparece, ainda não há build elegível — PDF acima ou aguardar |
| Duas linhas **1.0.7 (268)** e **1.0.7 (271)** no menu | Barra lateral **App para iOS** | **Não** são duas versões de loja distintas — é a mesma **1.0.7**; o número é a build **já ligada** à ficha. Use só a ficha onde o **+** funciona (268), **remova** a build 268 e **adicione** a 271. A linha **271 Prepar…** vazia pode ser ficha duplicada: ignore ou remova se o Connect permitir. Ver [Trocar build 268 → 271](#trocar-build-268--271-na-mesma-versão-107) |
| Build “só TestFlight interno” | Raro com `altool --upload-app` no CI | Builds internal-only **não** entram na versão da loja ([fórum Apple](https://developer.apple.com/forums/thread/733505)) |

Faixa azul sobre criptografia pode permanecer mesmo com **Criptografia não isenta: Não** na build — trate como aviso genérico até anexar a compilação ou carregar a documentação no app.

---

## Checklist operador — Fase 1 (TestFlight build 271)

**Já resolvido?** Na ficha da build (TestFlight → clique na compilação **271** → **Informações gerais**), se **Criptografia não isenta** = **Não**, a conformidade **desta build** já está registrada (equivalente a “só HTTPS / isento”). **Não** procure outro menu — vá direto à [Fase 2](#checklist-operador--fase-2-anexar-build-e-revisão).

O questionário **Fornecer informações de conformidade de exportação** só aparece enquanto falta compliance (aviso **Missing Compliance** na lista de builds ou no topo da build). Depois de respondido, some e fica só o campo acima.

- [ ] App Store Connect → **TestFlight** → **Controle de Bola**
- [ ] Abrir build **1.0.7 (271)** (status **Pronto para teste** / processada)
- [ ] Confirmar **Criptografia não isenta: Não** **ou** clicar **Fornecer informações…** / **Missing Compliance**
- [ ] Responder:
  - O app **usa** criptografia? → **Sim**
  - Limita-se a criptografia isenta (HTTPS, etc.)? → **Sim** / qualifica para isenção
  - Precisa de documentação ERN/CCATS? → **Não**
- [ ] Salvar e aguardar ~minutos; atualizar a página da versão

Se **não** houver questionário na build 271, use o fallback PDF (seção abaixo) em [Informações do app → Documentação sobre criptografia](https://appstoreconnect.apple.com/apps/6801505260/distribution/info).

**Build 271** foi enviada **antes** do `ITSAppUsesNonExemptEncryption` no CI — o questionário manual nesta build continua necessário. Builds **272+** (após merge deste repo) tendem a exigir menos passos manuais.

---

## Trocar build 268 → 271 na mesma versão 1.0.7

Objetivo: enviar **271**, não **268**.

1. **Distribuição** → barra lateral → clique **1.0.7 (268)** (a ficha onde **Compilação** tem **+** e funciona).
2. Seção **Compilação**:
   - Se já aparecer **268** anexada: passe o mouse → **−** (remover) → **Salvar**.
   - Clique **+** → escolha **271** → **Concluído** → **Salvar**.
3. **Não** use a ficha **1.0.7 (271) Prepar…** se o bloco Compilação só mostra texto de upload — ela costuma ser entrada duplicada ou rascunho sem build elegível.
4. Se **271** **não** aparecer no diálogo do **+** (lista vazia ou 271 cinza):
   - TestFlight → **Compilações → iOS** → status da **271** (processamento / compliance).
   - **Informações do app** → documentação de criptografia (PDF), se ainda não enviou.
   - Aguarde algumas horas após upload da 271.
5. Só **Adicionar para revisão** depois de **271** fixada na ficha **1.0.7 (268)** (o rótulo do menu passa a mostrar **(271)** após salvar).

Apple: [Remove a build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/) / [Add a build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/).

### Não aparece **−** para remover a build 268

O **−** na Compilação só existe enquanto a versão está **Preparar para envio** (antes de **Adicionar para revisão**) e você tem papel Admin/App Manager. Se **não** há **−**, a ficha **1.0.7 (268)** provavelmente **não** está editável:

| Status da versão (topo da página) | O que fazer |
|-----------------------------------|-------------|
| **Aguardando revisão** / **Em revisão** | **Geral → Revisão de apps (App Review)** → envio iOS → passe o mouse na versão/build → **−** *Remover do envio* → volte à ficha 1.0.7 → aí pode trocar a build |
| **Pronto para distribuição** / **Lançamento pendente do desenvolvedor** / já **aprovada** | **Não** dá para trocar a 268 nessa ficha. Próximo passo: **nova versão de loja** **1.0.8** + IPA com `1.0.8` no `package.json` + `release-ipa` (build **272+**), ou publicar a **268** se aceitar esse binário |
| **Preparar para envio** e mesmo assim sem **−** | Passe o mouse **no ícone da build** ou **na data de upload** (extremo direito da linha); tente outro navegador; confirme permissão **Admin** |

Para usar **271** com marketing **1.0.7**: desbloqueie a ficha (remover do envio) **ou** corrija a ficha **1.0.7 (271) Prepar…** (documentação de criptografia no app + elegibilidade da build) — **não** tente remover 268 de uma versão já **Pronta para distribuição**.

---

## Checklist operador — Fase 2 (anexar build e revisão)

- [ ] [Versão iOS em preparação](https://appstoreconnect.apple.com/apps/6801505260/distribution/ios/version/inflight) → seção **Compilação** → botão **+** (não é upload) → marcar **271** → **Concluído** → **Salvar** no topo
- [ ] Preencher demais campos da versão (o que faltar)
- [ ] Screenshots / Media Manager conforme [APP-STORE-REVIEW.md](APP-STORE-REVIEW.md) (iPhone 6.5", sem login/splash promocional)
- [ ] Conta demo para revisão (cadastro novo pós-purge, se aplicável)
- [ ] **Adicionar para revisão** / **Submit for Review**

---

## Fallback — PDF para “Carregar” documentação

1. Abra [docs/export-compliance/encryption-self-classification-en.txt](export-compliance/encryption-self-classification-en.txt) (inglês — padrão para exportação EUA).
2. Preencha data, nome, cargo, organização; assine (digital ou escaneado).
3. Gere PDF (Word, Google Docs ou imprimir → PDF).
4. App Store Connect → **Informações do app** → **Documentação sobre a criptografia do app** → **Carregar**.

### Carta de autorrelato (PT — referência)

Use o mesmo conteúdo do arquivo EN traduzido, ou o bloco abaixo:

> **Autorrelato de criptografia isenta — Controle de Bola**  
> App: Controle de Bola | Bundle ID: com.minhapelada.app | Apple ID: 6801505260  
>  
> Declaro que o aplicativo comunica-se com servidores apenas via **HTTPS (TLS)** (Back4App/Parse), utiliza mídia por HTTPS e **não** implementa algoritmos de criptografia proprietários, mensageria E2E customizada ou módulos criptográficos além dos permitidos como **isentos** pelas regras de exportação da Apple e EAR (Category 5 Part 2 — software de mass market com criptografia isenta).  
>  
> Não solicitamos CCATS/ERN para este app. Builds futuras declaram `ITSAppUsesNonExemptEncryption = false` no Info.plist.  
>  
> Local, data: __________  
> Nome e assinatura do responsável: __________

---

## O que não fazer

- Não marcar “criptografia proprietária” ou algoritmos custom sem evidência no código.
- Não enviar CCATS/ERN para um app só-HTTPS (atraso desnecessário).
- Não confundir **Documentação sobre criptografia** (upload formal) com o **questionário da build** no TestFlight — tente TestFlight primeiro.

---

## Builds futuras (CI)

Após `npx cap sync ios`, o workflow roda `apply-ios-review-config.js`, que define:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Checklist iOS: [IOS_GITHUB_ACTIONS.md](IOS_GITHUB_ACTIONS.md). Revisão App Store: [APP-STORE-REVIEW.md](APP-STORE-REVIEW.md).

---

## English summary (for App Review notes)

Controle de Bola is an Ionic/Capacitor app. Network traffic uses standard HTTPS to Back4App only. No proprietary encryption, no custom crypto libraries. Export: exempt; ITSAppUsesNonExemptEncryption is false in Info.plist for CI-built IPAs.
