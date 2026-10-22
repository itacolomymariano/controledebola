# Sequência de versão iOS / App Store Connect — fonte da verdade

Documento para **humanos e agents**: evita dois IPA com o mesmo **build number** ou marketing version inconsistente com o TestFlight.

**Atualize este arquivo** sempre que subir build à Apple ou reservar o próximo número.

---

## Regras Apple (resumo)

| Campo | Onde no repo | Regra |
|-------|----------------|-------|
| **Versão de loja** (marketing) | `package.json` → `"version"` | Até **3** segmentos (`1.0.8`). É o `CFBundleShortVersionString` no iOS. |
| **Build** (número interno) | `.app-release-state.json` → `versionCode` | Inteiro **estritamente maior** que o último build **já enviado** ao TestFlight/App Store Connect. É o `CFBundleVersion` (iOS). |
| **Label Android** | `versionName` em `android/app/build.gradle` | Acompanha bump; **não** usar como versão iOS na Apple. |

Workflow iOS: [`.github/workflows/ios-capacitor-build.yml`](../.github/workflows/ios-capacitor-build.yml) lê `package.json` + `.app-release-state.json` no step de archive.

---

## Histórico e próximo livre (App Store Connect)

| Data | Marketing | Build (CFBundle) | Situação Connect | Notas |
|------|-----------|------------------|------------------|-------|
| 2026-10-20 | 1.0.7 | **268** | Pronto para distribuição | Não usar para nova submissão de loja |
| 2026-10-21 | 1.0.7 | **271** | TestFlight; ficha 1.0.7 travada pela 268 | Não anexar à loja na 1.0.7 |
| **2026-10-22** | **1.0.8** | **272** | **Reservado no repo — aguardando `release-ipa`** | Trilha correta pós-268 |

### Próximo build iOS (agents: leia antes de bump)

- **Marketing reservado:** `1.0.8` (`package.json`)
- **Último build enviado à Apple:** `271`
- **Próximo `versionCode` livre:** **`272`** (já aplicado no repo em 2026-10-22)
- **Após enviar 272:** incrementar com `node scripts/bump-app-release.js` **ou** editar `.app-release-state.json` para **`273`** antes do próximo `release-ipa`

**Não** reutilizar **271** nem **268** para App Store. **Não** criar IPA **1.0.7** para loja enquanto **268** estiver “Pronto para distribuição” na mesma trilha.

---

## Como bumpar (agents)

1. Conferir **TestFlight** → último **Build** (número inteiro).
2. Garantir `versionCode` **>** esse número.
3. Se mudar trilha de marketing (ex. 1.0.7 → 1.0.8): editar `package.json` `"version"`.
4. Alinhar arquivos (uma opção):
   - Editar `.app-release-state.json` + rodar `node scripts/bump-app-release.js` **somente** se o `versionCode` atual já for o último publicado; **ou**
   - Setar manualmente `versionCode`, `releaseNumber`, `label`, `app-release.ts`, `android/app/build.gradle` como neste commit **1.0.8 / 272**.
5. **Commit + push** na `main` **antes** do workflow (CI não vê estado só local).
6. Registrar nova linha na tabela **Histórico** acima.

`npm run build` executa `prebuild` → bump automático (+1). **Cuidado:** não rodar `npm run build` local só antes do iOS se isso consumir o número reservado sem enviar o IPA.

---

## Subir IPA (operador)

1. **Commit + push** de `package.json`, `.app-release-state.json`, `app-release.ts`, `android/app/build.gradle`, este doc se alterado.
2. Abrir workflow:  
   **https://github.com/itacolomymariano/controledebola/actions/workflows/ios-capacitor-build.yml**
3. **Run workflow** → branch **`main`** → **build_target:** **`release-ipa`**
4. No log, confirmar: `iOS version 1.0.8 (272)`
5. TestFlight processar → **Distribuição** → criar/selecionar versão **1.0.8** → **Compilação** → **+** → build **272**
6. Export compliance: [APP-STORE-EXPORT-COMPLIANCE.md](APP-STORE-EXPORT-COMPLIANCE.md)

Artefato: Actions → run → **ios-release-ipa** (se upload altool falhar).

---

## Android (referência)

Mesmo `versionCode` **272** / label `2026.10.22.0272` no Gradle após bump. Play usa AAB separado; não misturar regras com Apple.
