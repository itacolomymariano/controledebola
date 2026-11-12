# Sequência de versão iOS / App Store Connect — fonte da verdade

Documento para **humanos e agents**: evita dois IPA com o mesmo **build number** ou marketing version inconsistente com o TestFlight.

**Ambientes:** IPA/TestFlight é sempre **produção** (MinhaPelada). Não há IPA sandbox — ver [BUILD-ENVIRONMENTS-AGENTS.md](BUILD-ENVIRONMENTS-AGENTS.md).

**Atualize este arquivo** sempre que subir build à Apple ou reservar o próximo número.

---

## Regras Apple (resumo)

| Campo | Onde no repo | Regra |
|-------|----------------|-------|
| **Versão de loja** (marketing) | `package.json` → `"version"` | Até **3** segmentos (`1.0.9`). É o `CFBundleShortVersionString` no IPA. |
| **Build** (número interno) | `.app-release-state.json` → `versionCode` | Inteiro **estritamente maior** que o último build **já enviado** ao TestFlight/App Store Connect. É o `CFBundleVersion` (iOS). |
| **Label Android** | `versionName` em `android/app/build.gradle` | Label `2026.*` / bump; **não** usar como versão iOS na Apple. |

Workflow iOS: [`.github/workflows/ios-capacitor-build.yml`](../.github/workflows/ios-capacitor-build.yml) lê `package.json` + `.app-release-state.json` no step de archive (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`).

---

## Armadilha para agents: AAB Play e IPA no mesmo `package.json`

**Cenário real (2026-10-30):** AAB Android gerado com `package.json` **1.0.8** e enviado à Play. Em seguida, `release-ipa` com o **mesmo** `1.0.8` falhou no `altool`:

- **`90062`** — `CFBundleShortVersionString [1.0.8]` must be **higher** than previously **approved** `1.0.8`
- **`90186`** — Pre-Release Train **1.0.8** is **closed** for new build submissions

**Causa:** No App Store Connect, a trilha **1.0.8** já estava **aprovada/fechada**. A Apple **não** aceita novo build nessa trilha, mesmo que o `versionCode` (281) seja novo.

**O que fazer (iOS):**

1. **Não** re-run do workflow antigo.
2. Subir **só** marketing: `package.json` (+ `package-lock.json`) → próximo patch, ex. **`1.0.9`**.
3. **Não** é obrigatório bump de `versionCode` se **281** (ou o atual) já for **>** último build no TestFlight.
4. **Commit + push** na `main`.
5. **Run workflow** novo → `release-ipa`; log esperado: `iOS version 1.0.9 (281)`.
6. No Connect: criar/selecionar versão **1.0.9** ao anexar o build.

**Play (Android):** o AAB já publicado pode permanecer na faixa **1.0.8** na Play Console. **`package.json` não precisa** ser igual entre Play e App Store — no repo, após bump iOS, `package.json` fica na versão **iOS** (fonte do IPA). Alinhar marketing na Play é opcional/operacional.

**Checklist antes de todo `release-ipa`:**

1. App Store Connect → **TestFlight** → última **versão de marketing** aprovada ou fechada.
2. Se `package.json` `"version"` **≤** essa versão → bump patch **antes** do workflow.
3. TestFlight → último **Build** (inteiro) → `versionCode` no repo **>** esse número.
4. **Commit + push** (CI não vê estado só local).

Detalhes em [AGENTS.md](../AGENTS.md) (TestFlight, seção **C**) e [IOS_GITHUB_ACTIONS.md](IOS_GITHUB_ACTIONS.md) (tabela de erros altool).

---

## Armadilha para agents: `main` desatualizada → build duplicado (409)

**Cenário real (2026-11-02):** `release-ipa` falhou no `altool --validate-app`:

- `The bundle version must be higher than the previously uploaded version: '282'`
- `ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE` / `previousBundleVersion: 282`

**Causa:** A **`main` no GitHub** ainda tinha `.app-release-state.json` com `versionCode: 281`. O workflow roda `npm run build` (com **prebuild** → +1) **antes** do archive. O IPA saiu com **282**, mas o **282 já estava no TestFlight**. Builds locais (ex. **294**) no laptop **não contam** até **commit + push**.

**Número efetivo do IPA no CI:**

```text
CFBundleVersion = versionCode em .app-release-state.json na main (após push) + 1
```

(porque `npm run build` incrementa o JSON no runner antes do step que lê `IOS_BUILD`).

**O que fazer (obrigatório antes de todo `release-ipa`):**

1. App Store Connect → **TestFlight** → anote o último **Build** (inteiro), ex. **282**.
2. Local: `.app-release-state.json` → `versionCode` **estritamente maior** que esse build (ex. **294** se 282 já foi enviado).
3. Alinhar `src/app/core/constants/app-release.ts` e `android/app/build.gradle` (`versionCode` / `versionName`).
4. **Commit + push na `main`** desses arquivos (e demais alterações do release).
5. **Run workflow** novo (não Re-run). No log: `iOS version 1.0.9 (295)` se o repo tinha **294** antes do prebuild do CI.
6. Play/AAB: pode usar o mesmo `versionCode` commitado; Android não soma +1 no CI da mesma forma, mas o label segue o bump local.

**Agents:** nunca dispare `release-ipa` só com bump local ou só AAB gerado na máquina — a Apple e o Actions leem o **Git remoto**.

---

## Histórico e próximo livre (App Store Connect)

| Data | Marketing | Build (CFBundle) | Situação Connect | Notas |
|------|-----------|------------------|------------------|-------|
| 2026-10-20 | 1.0.7 | 268 | Pronto para distribuição | Não reutilizar |
| 2026-10-21 | 1.0.7 | 271 | TestFlight | — |
| 2026-10-22+ | 1.0.8 | 272+ | Trilha **1.0.8 fechada/aprovada** | Não enviar mais IPA `1.0.8` |
| **2026-10-30** | **1.0.9** | **281** | Enviado / trilha 1.0.9 | Falha 90062/90186 corrigida com bump marketing |
| **2026-11-02** | 1.0.9 | **282** | TestFlight | Upload OK; próximo IPA precisa **> 282** |
| **2026-11-02** | 1.0.9 | **294** (repo) → **295** (CI) | Enviado / reservado | — |
| **2026-11-07** | 1.0.11 | 313→314 (CI) | Trilha **1.0.11 fechada** | altool **90062** + **90186** |
| **2026-11-07** | **1.0.12** | **313** (repo) → **314** (CI) | Trilha fechada | — |
| **2026-11-12** | **1.0.14** | 357 (CI) | Trilha **1.0.14 fechada** (90062/90186) | Validacao altool falhou; nao subiu |
| **2026-11-12** | **1.0.15** | **356** (repo) → **357** (CI) | **Proximo `release-ipa` apos push** | Bump so marketing |

### Próximo build iOS (agents: leia antes de bump)

- **Marketing no repo:** `1.0.15` (`package.json`)
- **Trilha 1.0.14:** fechada/aprovada — nao enviar mais IPAs `1.0.14`
- **`versionCode` commitado na main:** **356** — CI gera IPA **357** (validacao anterior nao concluiu upload)
- **Se 90062/90186 de novo:** bump **só** `package.json` patch, push, novo workflow

---

## Como bumpar (agents)

1. Conferir **TestFlight** → último **Build** (número inteiro).
2. Conferir **TestFlight / versão em preparação** → última marketing **aprovada ou fechada**.
3. Garantir `versionCode` **>** último build enviado.
4. Garantir `package.json` `"version"` **>** marketing aprovada/fechada na mesma trilha.
5. Alinhar `.app-release-state.json`, `app-release.ts`, `android/app/build.gradle` quando mudar `versionCode`.
6. **Commit + push** na `main` **antes** do workflow.
7. Registrar nova linha na tabela **Histórico** acima.

`npm run build` / `npm run build:android:aab` executam `prebuild` → bump automático (+1) em `versionCode`. **Cuidado:** não consumir número reservado sem enviar o IPA correspondente.

---

## Subir IPA (operador)

1. Checklist **Armadilha** e **Próximo build** acima.
2. **Commit + push** na `main`.
3. Workflow:  
   **https://github.com/itacolomymariano/controledebola/actions/workflows/ios-capacitor-build.yml**
4. **Run workflow** → branch **`main`** → **build_target:** **`release-ipa`**
5. No log, confirmar: `iOS version 1.0.9 (281)` (números conforme repo)
6. TestFlight → versão **1.0.9** → anexar build **281**
7. Export compliance: [APP-STORE-EXPORT-COMPLIANCE.md](APP-STORE-EXPORT-COMPLIANCE.md)

Artefato: Actions → run → **ios-release-ipa** (se upload altool falhar).

---

## Android (referência)

Mesmo `versionCode` **281** / label `2026.10.30.0281` no Gradle após bump. Play usa AAB separado; marketing na Play Console pode diferir do `package.json` usado pelo iOS — ver **Armadilha** acima.
