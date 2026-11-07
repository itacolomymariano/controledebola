# Identidade visual — Controle de Bola (app)

**Data:** 2026-11-03 · Feedback Nicole/Xaiana · Alinhar app ao site [controledebola.com](https://controledebola.com)

---

## Paleta padrão

| Token | Valor | Uso |
|-------|--------|-----|
| Primary (verde) | `#1d7a3e` | Botões/CTAs e tokens `--ion-color-primary` (marca no site) |
| Tertiary (ouro) | `#f5c400` | Destaques (tokens Ionic) |
| Toolbar / fundo claro (mock Home) | Ver `THEME_LIGHT_SURFACES.controle_de_bola` | `ThemePaletteService` aplica `--ion-toolbar-background` + `--ion-toolbar-color`; alinhado ao hero roxo (`THEME_HOME_HUB_*`) e tab bar |

- **ID:** `controle_de_bola` em [`theme-palette.model.ts`](../src/app/core/models/theme-palette.model.ts)
- **CSS:** [`src/theme/variables.scss`](../src/theme/variables.scss) — **único lugar** para hex de paleta (+ model para superfícies)
- **Default:** `DEFAULT_THEME_PALETTE = 'controle_de_bola'` (usuários antigos podem ter `default` salvo no storage)

---

## Onde agents alteram tema

| Arquivo | Papel |
|---------|--------|
| `theme-palette.model.ts` | IDs, `THEME_LIGHT_SURFACES`, `THEME_DARK_SURFACES`, `THEME_HOME_HUB_LIGHT` / `THEME_HOME_HUB_DARK`, swatches |
| `theme-palette.service.ts` | `apply()` — `data-palette`, `data-surface`, `--ion-background-color`, `--ion-toolbar-*`, `--cb-home-*` (hero), `--cb-playful-*` |
| `variables.scss` | `--ion-color-primary/tertiary`, `--cb-card-accent`, `--cb-header-tint` |
| `global.scss` | Labels longos (input/select stacked); **não** cores de marca |

**Modo claro vs escuro:** ambos aplicam superfície via `ThemePaletteService`; paleta muda tokens primary. Testar sempre os dois.

---

## Navegação Home

- **Início** = 1ª aba do rodapé (`/tabs/home`) — não duplicar ícone casa no [`user-bar`](../src/app/shared/components/user-bar/user-bar.component.html).
- **Peladas** = 2ª aba → `/tabs/peladas/lista`.

### Exceção temporária — mock Nicole (2026-11)

A tela **Início** (`/tabs/home`, `PeladasPage`) usa paleta **roxo/lilás + grid 2×2** alinhada ao mock ChatGPT, com tokens `--cb-home-*` e `--cb-door-*` em `variables.scss` (escopo local). A partir de 2026-11-06, o **design system playful** (`--cb-playful-*`, `app-playful-page`) estende fundos e cartões ao restante do app em ondas — ver [UI-PLAYFUL-DESIGN-SYSTEM-2026-11.md](UI-PLAYFUL-DESIGN-SYSTEM-2026-11.md). Roadmap: [UI-REDESIGN-NICOLE-2026-11.md](UI-REDESIGN-NICOLE-2026-11.md).

---

## Labels longos em formulários

Padrão global: `ion-input` / `ion-select` com `labelPlacement="stacked"` + classe `form-label-wrap` quando o texto passa de uma linha. Ver [`global.scss`](../src/global.scss).

---

## Smoke

Itens **#1**, **#1b**, **#1c** em [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md).
