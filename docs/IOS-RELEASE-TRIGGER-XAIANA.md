# Disparar IPA 1.0.10 (TestFlight) — Xaiana UX

**Pré-requisitos:** `main` com `package.json` **1.0.10** e `.app-release-state.json` **versionCode 298** (ou maior que o último build no Connect).

## Passos

1. Abra: https://github.com/itacolomymariano/controledebola/actions/workflows/ios-capacitor-build.yml
2. **Run workflow** → branch **`main`** → **release-ipa**
3. Aguarde ~30–60 min; confira log *Upload IPA to TestFlight* sem 90186/90062/409
4. Connect → TestFlight → versão **1.0.10** → instalar no iPhone
5. Validar com [XAIANA-VALIDACAO-UX-POS-BUILD.md](XAIANA-VALIDACAO-UX-POS-BUILD.md)

**Não usar** Re-run do job que falhou em 1.0.9.

**Secrets:** `ENVIRONMENT_LOCAL_TS`, `APP_STORE_CONNECT_*` (ver AGENTS.md TestFlight B).

**Nota:** commit local com fix `post-auth-navigation` (cadastro direto → profile-setup) precisa estar na `main` antes do workflow para entrar no IPA.
