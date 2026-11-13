# Aquisição e engajamento — Controle de Bola

Matriz de ações para crescer a base de usuários (produção), combinando **app**, **site** e **lojas**.

## Já implementado no app

| Recurso | Onde |
|---------|------|
| Convite com landing | `AppInviteShareService` → `https://controledebola.com/app` |
| Deep links / App Links | `DeepLinkService`, `docs/DEEP-LINKS-APP-LINKS.md` |
| UTM no convite | `formatAppInviteShareText({ src: 'invite' })` — rastreio na URL |
| UTM pós-evento | Detalhe do evento encerrado → **Chame a galera** (`utm_source=event`) |
| Atribuição cadastro | `signupSource` / utm em `_User` via `registerUser` + `SignupAttributionService` |
| KPI semanal | [`GROWTH-KPI-WEEKLY.md`](GROWTH-KPI-WEEKLY.md) + Cloud `getGrowthSignupStats` |

## Fase 30 dias (baixo custo dev)

1. **Nicole — Play Console:** revisar vitals (ANR/crash), screenshots reais de pelada, palavras-chave (futebol amador, pelada, súmula).
2. **Site (`controledebolasite`):** OG image em `/app`, página `/download` com links Play + App Store.
3. **App:** CTA pós-evento “Chame a galera” (share com UTM `src=event`) — **implementado** em `event-detail`.
4. **Teste interno → aberto:** atualizar `APP_INSTALL_ANDROID_URL` quando a listagem pública estiver ativa.

## Fase 90 dias

| Canal | Ação | Dono |
|-------|------|------|
| Google Play | Custom store listing / A-B de ícone | Nicole |
| Google Ads UAC | Landing `controledebola.com/app?utm_source=google` | Marketing |
| App Store | Custom Product Pages, otimização de metadados | Nicole |
| SEO local | Posts “organizar pelada em [cidade]” | Site |
| Influenciadores | Bilhetes TestFlight / código Play | Nicole |

## Opcional (produto)

- ~~Campo `signupSource`~~ **Feito:** Cloud `04-auth-signup.js` + deep link (`SignupAttributionService`).
- Cloudflare Web Analytics no site (`PUBLIC_CF_WEB_ANALYTICS_TOKEN`) — ver `controledebolasite` BaseLayout.
- Firebase / GA4 no app (instalação, cadastro, 1ª pelada) — opcional futuro.

## Métricas de sucesso

- Instalações/semana (Play Console + App Store Connect)
- Cadastros completos (`profile-setup` concluído)
- Convites enviados (`src=invite` na landing)
- Retenção D7 (usuários que voltam após 1ª pelada)
