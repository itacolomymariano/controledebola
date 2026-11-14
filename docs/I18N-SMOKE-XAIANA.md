# Smoke i18n — Xaiana (pré-AAB Play)

**Objetivo:** com idioma **en-GB** ou **es-ES**, não deve aparecer parágrafo em português nas telas abaixo. Cards playful e ajudas devem seguir o idioma escolhido. **TTS:** balão **Ouvir** deve falar no mesmo idioma.

## Preparação

1. Build recente (APK debug ou release interno).
2. Perfil → bandeiras → alternar **pt-BR**, **en-GB**, **es-ES**.
3. Opcional: `npm run check:i18n` já passou no CI local antes do AAB.

## Matriz por idioma (en-GB e es-ES)

| # | Tela | O que verificar |
|---|------|-----------------|
| 0 | **Splash** (entrada) | Título + tagline no idioma escolhido (antes do login) |
| 1 | **Início** (6 portas) | Títulos das portas; **?** → texto de ajuda no idioma; **Ouvir** 1 frase |
| 2 | **Peladas** | Lista e empty states |
| 3 | **Mural → Geral** | Cards playful (`mural.playful.*`); hero Craque; filtros |
| 4 | **Mural → Explorar** | Resultados por período — abas Semana/Mês/Ano e métricas |
| 5 | **Evento → detalhe** | Overview (Início/Término, chip inscrições, taxa, admin); **Participar**; painel Participantes (busca, papéis, cancelar); datas em formato en-GB |
| 5b | **Pelada → Arena Fire** | Lista de eventos (chips inscrição/vagas); aba **Members** — CTA sócio e mensalidades |
| 5c | **Sobre** | Versão do build, Release, contacto — tudo no idioma ativo |
| 6 | **Perfil** | Idioma/paleta; itens de perfil e **Convidar Amigos** |
| 7 | **Meus dados** | Título e botão Voltar |
| 8 | **Voltar** | Em 3 telas deep (ex.: pelada → detalhe, mural explorar, evento): rótulo **Back** / **Volver** no `ion-back-button` |

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