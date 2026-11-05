# Verificação — wizard UX em `main` (build 295 vs código)

**Data:** 2026-11-05

## Conclusão

| Pergunta | Resposta |
|----------|----------|
| Wizard cadastro + profile-setup no código? | **Sim** — commit `5ea684d`, HEAD `1c1299a` |
| Build Xaiana (295 / 2026.11.02) inclui isso? | **Não** — IPA anterior ao merge |
| Falta reimplementar UI? | **Não** — falta **distribuir** IPA ≥299 / marketing 1.0.10 |

## Artefatos confirmados

- `src/app/shared/components/field-help/`
- `AppStorageService`: `REGISTER_DRAFT_KEY`, `PROFILE_SETUP_DRAFT_KEY`, `getWizardPath()`
- `register.page.html`: `@switch (currentStep)`, 5 passos
- `profile-setup.page.html`: `showWizardProgress`, `goWizardNext`

## Label mínima pós-UX

- Repositório: **2026.11.04.0298** (`versionCode` 298)
- CI iOS após push: prebuild → **299+** com **1.0.10**
