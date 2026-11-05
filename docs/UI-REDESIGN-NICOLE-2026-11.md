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

**Não alterado:** login, register wizard, profile-setup, tema global default, Cloud Code, [`peladas-list.page`](../src/app/pages/peladas/peladas-list.page.html).

---

## Fases futuras

| Fase | Escopo | Esforço |
|------|--------|---------|
| 2 | Login, register wizard, profile-setup — skin roxo/arredondado | Médio |
| 3 | Listas (`home-directory`, `peladas-list`) — cards coloridos leves | Médio |
| 4 | Restante do app | Alto — após design system estável |

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
2. Smoke **#1** em [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md).
3. Captura manual `p23-home-portas` em [MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt](MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt).
4. Android: `npm run build:android:aab` → teste interno.
5. iOS: workflow `release-ipa` na `main` (marketing **1.0.11+**). Ver [XAIANA-VALIDACAO-UX-POS-BUILD.md](XAIANA-VALIDACAO-UX-POS-BUILD.md) para checklist paralelo TestFlight.
