# Plano de refinamentos pos App Store — Coordenador

A iOS 1.0 foi aprovada (Pronto para distribuicao). Este documento e o indice das ondas. Nao substitui `AGENTS.md` nem o guia de arquitetura.

**Codigo Ionic e unico para iOS e Android.** Excecoes humanas: icone da ficha App Store e SMTP Zoho no Back4App.

## Ondas

| Onda | Escopo | Agent sugerido |
|------|--------|----------------|
| 0 | Este plano + cache | Coordenador |
| 1 | Icone 1024, reset de senha, memo PIX Inter (sem API) | inherit / explore |
| 2 | i18n pt-BR acentuado (login, tabs, erros, cadastro) | um agent forte |
| 2b | JSON `es-ES` e `en-GB` | composer-fast |
| 3 | 10 paletas CSS + persistencia | inherit |
| 4 | Coach contextual (sem Lottie v1) | um agent forte, apos chaves `coach.*` |
| 5 | CTA do manual no app + site `/guia` | inherit |

## Regras

- Nao misturar i18n + paletas + wizards no mesmo PR mental; regressao alta.
- PIX Inter: so pesquisa em `docs/VIABILIDADE-PIX-INTER.md` ate o Coordenador autorizar API.
- Reset de senha: UI ja existia; depende de Email Adapter no Back4App (Zoho SMTP).
- Cloud Code: editar so `cloud/source/`. Icone de marca: `ios-config/AppIcon.appiconset/AppIcon-1024.png`.
- Manual ilustrado: screenshots reais do usuario; nao gerar mockup promocional.

## Status (2026-09-07)

| Onda | Estado |
|------|--------|
| 0 docs | Feita |
| 1 icone + reset | Flag ligada; SMTP Zoho e icone Connect = humano |
| 1 PIX | Memo: manter P2P; sem API |
| 2 / 2b i18n | Infra + catalogo login/tabs/erros/cadastro + es/en |
| 3 paletas | 10 mapas CSS + seletor no Perfil |
| 4 coach | Card Peladas + overlays nas rotas; sem Lottie |
| 5 manual | CTA menu/Perfil/Peladas; site `/guia`; prints do usuario |

## Icone na ficha (humano)

App Store Connect → Controle de Bola → Informacoes do app → icone 1024 = `ios-config/AppIcon.appiconset/AppIcon-1024.png`.
