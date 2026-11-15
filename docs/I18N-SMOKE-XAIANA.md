# Smoke i18n — Xaiana (pré-AAB Play)

**Objetivo:** com idioma **en-GB** ou **es-ES**, não deve aparecer parágrafo em português nas telas abaixo. Cards playful e ajudas devem seguir o idioma escolhido. **TTS:** balão **Ouvir** deve falar no mesmo idioma.

## Preparação

1. Build recente (APK debug ou release interno).
2. **Troca de idioma (obrigatório):** menu lateral ☰ → **Language** → action sheet (PT / EN / ES); repetir em **Perfil → bandeiras**. Ciclo **EN → ES → PT** sem fechar o app; abas do rodapé devem atualizar **sem** trocar de tela.
3. Opcional: `npm run check:i18n` e `npm run check:i18n:scan` (meta: **0** hits) antes do AAB.
4. **Regressão searchbar:** com locale **en-GB**, abra Participantes e confira placeholder **Search participant**; troque para **es-ES** na mesma tela e confira atualização sem sair do evento (remount `ion-searchbar`).

## Matriz smoke (marque pt / en / es)

| # | Tela | pt-BR | en-GB | es-ES |
|---|------|:-----:|:-----:|:-----:|
| 0 | Splash | | | |
| 1 | Início (portas + Ouvir) | | | |
| 2 | Peladas | | | |
| 3 | Buscar | | | |
| 4 | Mural Geral / Explorar | | | |
| 5 | Evento detalhe | | | |
| 5a | Evento → Participantes (placeholder busca + lista confirmados) | | | |
| 5a2 | Evento → **JOIN** (wizard `event-register`, 2 passos) | | | |
| 5b | Pelada detalhe (cotinhas/caixa) | | | |
| 5c | Sobre | | | |
| 6 | Perfil + menu idioma (action sheet) | | | |
| 7 | Meus dados | | | |
| 8 | `ion-back-button` (Voltar / Back / Volver) | | | |

## Critério de aprovação

- **Zero** bloco de texto claramente em PT com locale en/es ativo (exceto nomes próprios, nomes de pelada/evento).
- Cards do mural **100%** no idioma escolhido.
- Ouvir: voz coerente com en-GB / es-ES (não ler português por fallback de chave).

## Regressão rápida pt-BR

Repetir itens 1–4 em pt-BR após voltar a bandeira BR. Conferir acentuação em rótulos do sistema (**Inscrições**, **Versão**, **participação**) — `npm run audit:i18n:pt-accents`.

## Referências

- [`AUDITORIA-PLAY-I18N-2026-10-08.md`](AUDITORIA-PLAY-I18N-2026-10-08.md)
- [`SMOKE-TEST-PRE-INSTALL.md`](SMOKE-TEST-PRE-INSTALL.md)

**Assinatura:** __________ Data: __________ Idiomas testados: [ ] en-GB [ ] es-ES [ ] pt-BR