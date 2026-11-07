# Redesign UI — mock Nicole / ChatGPT

**Data:** 2026-11-05 · Referência visual: `layout_sugerido_por_Nicole_e_ChaGPT.jpeg` (WhatsApp / projeto manual)

**Decisão:** Fase 1 implementa o mock **o mais fiel possível** na Home (`/tabs/home`). Divergência temporária da marca verde/ouro do site — documentada em [UI-BRAND-THEME-2026-11.md](UI-BRAND-THEME-2026-11.md).

---

## Fase 1 (implementada)

| Item | Detalhe |
|------|---------|
| Tela | [`peladas.page`](../src/app/pages/peladas/peladas.page.ts) em `/tabs/home` apenas |
| Hero | `app-home-hub-hero` — gradiente roxo, avatar, apelido, chips estado/cidade/bairro |
| Portas | `app-home-door-card` — grid 2×2, cores pastéis, botão circular com seta |
| Tokens | `--cb-home-*`, `--cb-door-*` em [`variables.scss`](../src/theme/variables.scss) |
| Navegação | Mesmos destinos: `openDoor()` → lista, confrontos, times, usuarios |
| Rodapé | 6 abas mantidas (produto inclui **Início**; mock omitia) |

---

## Fase A — Design system playful (2026-11-06)

| Item | Detalhe |
|------|---------|
| Doc | [UI-PLAYFUL-DESIGN-SYSTEM-2026-11.md](UI-PLAYFUL-DESIGN-SYSTEM-2026-11.md) |
| Modelo | [`theme-playful.model.ts`](../src/app/core/models/theme-playful.model.ts) — superfície por paleta × claro/escuro |
| Serviço | [`ThemePaletteService`](../src/app/core/services/theme-palette.service.ts) injeta `--cb-playful-page-bg`, `--cb-playful-card-surface`, `--cb-playful-orb-a/b` |
| Componentes | `app-playful-page`, `app-playful-card`, `app-playful-grid` no [`SharedModule`](../src/app/shared/shared.module.ts) |

---

## Fase B — Auth e hubs (2026-11-06)

- **Auth / onboarding:** [`login.page`](../src/app/pages/login/), [`register.page`](../src/app/pages/register/), [`splash.page`](../src/app/pages/splash/), [`onboarding.page`](../src/app/pages/onboarding/) — fundo playful + cartões.
- **Profile-setup:** [`profile-setup.page`](../src/app/pages/profile-setup/) — progresso em card; escolha de perfil em grid 2×2.
- **Listas:** [`peladas-list.page`](../src/app/pages/peladas/peladas-list.page.html), [`home-directory.page`](../src/app/pages/peladas/home-directory.page.html) — resultados em `app-playful-grid` + tons pastéis.
- **Detalhe usuário:** [`home-usuario.page`](../src/app/pages/peladas/home-usuario.page.html) — hero + grids.
- **Busca:** [`search.page`](../src/app/pages/search/search.page.html) — filtros em cartão; resultados em grid (times com histórico expansível no próprio card).

---

## Fase C — Tabs e formulários médios (2026-11-06)

- **Confrontos (tab):** [`events.page`](../src/app/pages/events/events.page.html) — grid de cartões.
- **Mural, Perfil, Inbox:** [`mural.page`](../src/app/pages/mural/mural.page.html), [`profile.page`](../src/app/pages/profile/profile.page.html), [`inbox.page`](../src/app/pages/inbox/inbox.page.html) — `app-playful-page` (fundo); cards Ionic herdam raio/sombra via [`global.scss`](../src/global.scss).
- **Formulários:** [`pelada-form`](../src/app/pages/pelada-form/), [`event-create`](../src/app/pages/event-create/), [`team-form`](../src/app/pages/team-form/), [`desafio-create`](../src/app/pages/desafio-create/), [`confronto-create`](../src/app/pages/confronto-create/) — conteúdo dentro de `app-playful-page`.

---

## Fase D — Suite evento (2026-11-06)

- [`event-detail.page`](../src/app/pages/event-detail/event-detail.page.html) — corpo principal + modal de revisão de perfil em `app-playful-page`.
- **Todas as subpáginas `event-*` listadas abaixo** usam `ion-content.cb-playful-ion-content` + `app-playful-page` como primeiro filho (painéis internos inalterados): inscrição (`event-register`), mural do evento (`event-mural`), `event-team-split`, scout/súmula/palpites (`event-scout-apontamento`, `event-sumula`, `event-predictions`), painéis de apoio (`event-coach-board`, `event-physical-trainer`, `event-masseur-treatments`, `event-fan-checkin`, `event-supplementary-hiring`), portaria (`event-gate-scan`, `event-gate-entries`), imprensa/mídia (`event-mural-media/*`, `event-journalist-journal`, `event-narrator-radio`, `event-cameraman-coverage`).

---

## Critérios de aceite (Nicole — Home)

- Quatro portas em **grid 2×2** simétrico, cores distintas como mock.
- **Hero roxo** com avatar e apelido; sem “Peladas colada no topo”.
- Área útil preenche entre header e tab bar (sem faixa vazia grande).
- Toques abrem os mesmos destinos de hoje.
- Wizard cadastro: logout → Criar conta (build **Sobre ≥ 1.0.11**, release recente) — fluxo separado da Home.

---

## QA e distribuição

1. Conferir **Sobre** no APK (Play teste interno): versão marketing e release label antes de validar Home ou wizard.
2. Smoke **#1**, **#15** em [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md).
3. Captura manual `p23-home-portas` em [MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt](MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt).
4. Android: `npm run build:android:aab` → teste interno.
5. iOS: workflow `release-ipa` na `main` (marketing **1.0.11+**). Ver [XAIANA-VALIDACAO-UX-POS-BUILD.md](XAIANA-VALIDACAO-UX-POS-BUILD.md) para checklist paralelo TestFlight.
