# Auditoria de entrega — growth (10/11/2026 → 13/11/2026)

Referência: [USER-ACQUISITION-GROWTH.md](USER-ACQUISITION-GROWTH.md) · baseline resultados **10/11/2026**

## Checklist técnico

| # | Teste | Status | Evidência |
|---|--------|--------|-----------|
| 1 | Convite com UTM | **OK** | `buildAppInviteLandingUrl` → `utm_source=invite&utm_medium=share` |
| 2 | Landing `/app` | **OK** | [`controledebolasite/src/pages/app.astro`](../../controledebolasite/src/pages/app.astro) + intent Android |
| 3 | Guia build 357 | **OK** | Site `98c6439`; caps. 01/06 com 6 portas e mural playful |
| 4 | Home 6 portas + convite | **OK** | [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md) #1, 1a |
| 5 | Mural share PNG | **OK** | `app-mural-share-button` no feed |
| 6 | OG dedicada `/app` | **OK** (13/11) | `image=/guia/p23-home-portas.jpeg` |
| 7 | Analytics site | **OK** (13/11) | Cloudflare Web Analytics em `BaseLayout` (token via env) |
| 8 | `signupSource` cadastro | **OK** (13/11) | Cloud `04-auth-signup.js` + `SignupAttributionService` |
| 9 | CTA pós-evento | **OK** (13/11) | `event-detail` → Chame a galera, `utm_source=event` |
| 10 | Relatório cadastros | **OK** (13/11) | Cloud `getGrowthSignupStats` (Master Key) |

## Fase 30 dias — pendências humanas (não código)

| Item | Dono | Status |
|------|------|--------|
| Play vitals + screenshots + keywords | Nicole | Pendente |
| Teste interno → listagem pública Play | Nicole | Pendente |
| KPI semanais na planilha | Coordenador | [GROWTH-KPI-WEEKLY.md](GROWTH-KPI-WEEKLY.md) |
| Publicar `cloud/main.js` após `signupSource` + stats | DevOps | **Necessário** pós-merge |

## Commits de referência

- App/site growth UX: AGENT-ACTIVITY-CACHE § 2026-11-10
- Guia Suiane: controledebolasite `98c6439`
- Medião+funnel 13/11: commit atual minhapelada + controledebolasite (deploy)

## Lacunas aceitas (fase 90d)

Google Ads UAC, SEO em lote, Custom Product Pages, chatbot IA — ver USER-ACQUISITION-GROWTH.md.
