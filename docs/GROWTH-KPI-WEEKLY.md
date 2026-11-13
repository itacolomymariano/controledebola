# KPI semanal — aquisição e engajamento

Baseline oficial: **10/11/2026** (pós-plano growth). Atualizar toda **segunda-feira**.

## Onda 0 — planilha (Nicole + Primeiro Coordenador)

Copie a tabela abaixo para Excel/Sheets ou preencha inline.

### Semana de ___/___/2026

| KPI | Fonte | Baseline (27/10–09/11) | Esta semana | Meta (8 sem.) | Notas |
|-----|-------|------------------------|-------------|---------------|-------|
| Instalações Android | Play Console → Statistics | | | Estável ou ↑ | Teste interno |
| Instalações iOS | App Store Connect → Analytics | | | Estável ou ↑ | TestFlight |
| Novos cadastros `_User` | Back4App ou `getGrowthSignupStats` | | | +20% vs. baseline | |
| Por origem (`signupSource`) | `getGrowthSignupStats` → `bySource` | — | | invite/event/google… | Após deploy Cloud |
| Profile-setup em 7d | Amostra manual / query | | | ≥50% dos novos | |
| Convites enviados | Qualitativo (família) | | | ≥5/semana piloto | |
| Visitas `/app` | Cloudflare Web Analytics | | | ↑ após OG | Token no site |
| Visitas `/guia` | Cloudflare Web Analytics | | | — | |
| Votos mural (semana) | Back4App `MuralVote` count | | | Estável com # eventos | |

### Smoke rápido (5 min, produção build ≥357)

| # | Teste | OK? |
|---|--------|-----|
| S1 | Menu **Convidar amigos** → link contém `utm_source=invite` | |
| S2 | Mural → compartilhar 1 card → PNG + legenda | |
| S3 | Evento **encerrado** → **Chame a galera** → `utm_source=event` | |
| S4 | [controledebola.com/app](https://controledebola.com/app) abre no Android | |
| S5 | Guia cap. 01 — 6 portas | |

Referência smoke completo: [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md) itens 1, 1a, L1–L5.

## Back4App — cadastros por semana (API Console)

Cloud Function **`getGrowthSignupStats`** (Master Key, REST POST `/functions/getGrowthSignupStats`):

```json
{ "since": "2026-11-10T00:00:00.000Z" }
```

Resposta: totais por semana ISO e contagem por `signupSource`.

Ver [BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md](BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md).

**Publicar Cloud Code (após cada bump em `cloud/main.js`):**

1. Back4App → app **MinhaPelada** → **Cloud Code** → colar `cloud/main.js` → Deploy.
2. Local: `npm run verify:growth-cloud` (com `PARSE_SERVER_URL`, `PARSE_APP_ID`, `PARSE_MASTER_KEY` no ambiente).

## Play / App Store — onde clicar

| Loja | Caminho |
|------|---------|
| Google Play | Play Console → app → **Statistics** / **Store performance** |
| App Store | App Store Connect → app → **Analytics** → Installs |

## Critério “satisfatório” (resumo)

Ver plano growth §6: instalações estáveis, cadastros +20%, 50% profile-setup D7, 5 convites/semana piloto.

## Docs relacionados

- [USER-ACQUISITION-GROWTH.md](USER-ACQUISITION-GROWTH.md)
- [GROWTH-DELIVERY-AUDIT-2026-11-13.md](GROWTH-DELIVERY-AUDIT-2026-11-13.md)
