# Validação UX — Xaiana e Nicole (pós-build correto)

**Problema reportado (nov/2025):** iPhone na **Sobre** com `1.0.9 (295)` e release **`2026.11.02.0295`** — binário **sem** wizard de cadastro/profile-setup (anterior ao commit `5ea684d`).

**Código em `main`:** wizard implementado; marketing **`1.0.11`**, `versionCode` **299+** no repo.

---

## 1. Antes de testar UX

Menu → **Sobre** (ou Perfil → Sobre):

| Campo | Mínimo para wizard |
|-------|-------------------|
| Versão do build | **1.0.11** (ou superior se a trilha 1.0.10 já fechou no Connect) |
| Número entre parênteses | **> 295** (ex. 299+) |
| Release do app | **≥ 2026.11.04.0298** |

Se ainda aparecer **295** ou **1.0.9**, atualize pelo **TestFlight** (iOS) ou teste interno Play (Android) — não adianta refazer cadastro no build antigo.

---

## 2. iOS — obter build certo

1. GitHub → [iOS Capacitor Build — Run workflow](https://github.com/itacolomymariano/controledebola/actions/workflows/ios-capacitor-build.yml)
2. Branch **`main`**, tipo **`release-ipa`**, **Run workflow** (não Re-run de job falho).
3. Log: `iOS version 1.0.11 (301)` ou superior (prebuild CI = versionCode commitado + 1).
4. App Store Connect → **TestFlight** → versão **1.0.11** → instalar no iPhone.
5. Trilhas **1.0.9** e **1.0.10** fechadas (90186/90062) — usar marketing **maior** que a última aprovada no Connect.

---

## 3. Android — paridade

- AAB produção gerado após `5ea684d`: **`versionCode` 298**, label **`2026.11.04.0298`**.
- Caminho local: `android/app/build/outputs/bundle/release/app-release.aab`.
- Play Console → teste interno → mesma versão na **Sobre** do aparelho.

---

## 4. Roteiro Xaiana (cadastro novo)

1. **Logout** (se logada).
2. **Criar conta** → deve aparecer **Passo 1 de 5**, barra de progresso, **Continuar** (não formulário longo único).
3. Ícone **?** ao lado de apelido, CPF, celular, endereço (passos correspondentes).
4. Concluir cadastro → **Montando seu perfil** em passos (atleta: posições → medidas → extras), não lista única.
5. **Completar depois** ou salvar → Home.

**Nicole (mesmo build):**

- Aba rodapé **Início** → quatro portas; **Peladas** no rodapé abre **lista**.
- Menu → **Cores e tema** → paleta marca; **Restaurar padrão do app**.
- Profile-setup passo extras: labels taxas pelada/confronto legíveis (i18n).

---

## 5. O que não muda (esperado)

- **Perfil → editar atleta:** formulário completo (não wizard) — só a **1ª montagem** usa passos.
- Conta **antiga** já montada: não repete profile-setup salvo “Completar depois” na 1ª vez.

---

## 6. Verificação técnica (repo)

| Item | Onde |
|------|------|
| Wizard register | `src/app/pages/register/` |
| Wizard profile-setup | `src/app/pages/profile-setup/` |
| Rascunhos | `register_draft_v1`, `profile_setup_draft_v1` |
| Commit UX | `5ea684d` |
| Marketing iOS | `1.0.11` |
