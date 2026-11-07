# Design system “playful” (pós-Home Nicole)

**Data:** 2026-11-06 · Alinha telas do app ao estilo colorido da Home (hero + cartões pastéis), com suporte às paletas e ao modo claro/escuro.

---

## Objetivo

- **Tokens** `--cb-playful-*` injetados por [`ThemePaletteService`](../src/app/core/services/theme-palette.service.ts) a partir de [`theme-playful.model.ts`](../src/app/core/models/theme-playful.model.ts) (fundos, cartão, orbes).
- **Tons “porta” (mock Nicole)** por paleta × claro/escuro: `THEME_PLAYFUL_DOOR_LIGHT` / `THEME_PLAYFUL_DOOR_DARK` — expostos como `--cb-playful-tone-peladas-bg|fg`, … `users`, e espelho `--cb-door-*` (Home `home-door-card`).
- **Primitivas** no [`SharedModule`](../src/app/shared/shared.module.ts):
  - `app-playful-page` — fundo com gradiente/orbes + safe-area inferior
  - `app-playful-card` — shell com ondas leves, cantos arredondados; em `tone` peladas|confrontos|times|users e `[interactive]="true"` mostra **círculo + seta** (decoração; clique continua no host). CSS base em [`global.scss`](../src/global.scss) (`.cb-playful-card`).
  - `app-playful-grid` — grid 2 colunas (1 col em telas estreitas)

---

## Quando usar grid 2 colunas

| Sim | Não |
|-----|-----|
| Atalhos, cartões de igual hierarquia (portas, times, usuários em modo resumo) | Formulários longos, wizards campo a campo |
| Listas homogêneas com poucas linhas por item | Inbox, mural denso, painéis admin com muitos controles |

---

## Temas

- Trocar **Cores e temas** no menu continua a atualizar `--cb-playful-page-bg`, `--cb-playful-card-surface`, orbes (`--cb-playful-orb-a/b`), **tons porta** (`--cb-playful-tone-*`, `--cb-door-*`) e `--ion-*`.
- **Tab bar**: [`tabs.page.scss`](../src/app/tabs/tabs.page.scss) — aba selecionada com fundo em cápsula (`border-radius` alto + primary suave).

## Listas em páginas playful

- Classe `playful-elevated-list` em `ion-list` (global): cada `ion-item` vira cartão elevado — ver [`global.scss`](../src/global.scss). Usado em Perfil, Inbox (mensagens), filtros do Mural.

---

## Ficheiros-chave

| Ficheiro | Papel |
|----------|--------|
| [`theme-playful.model.ts`](../src/app/core/models/theme-playful.model.ts) | Hex por paleta × superfície |
| [`variables.scss`](../src/theme/variables.scss) | Raio, sombra, texto playful, tons portas |
| [`global.scss`](../src/global.scss) | `ion-content.cb-playful-ion-content` → `--background: transparent` |

---

## Migração

Roadmap de telas em [UI-REDESIGN-NICOLE-2026-11.md](UI-REDESIGN-NICOLE-2026-11.md). Smoke: [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md).
