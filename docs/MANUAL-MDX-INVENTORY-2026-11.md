# Inventário manual — MDX, placeholders e `public/guia`

**Data:** 2026-11-05 · **Ambiente alvo das fotos:** produção (`com.minhapelada.app`, MinhaPelada)

Script: [`scripts/check-manual-guia-images.js`](../scripts/check-manual-guia-images.js)

## Resumo

| Métrica | Valor |
|---------|--------|
| Referências `/guia/*.jpeg` nos MDX | **88** |
| Arquivos em `controledebolasite/public/guia` | **92** |
| Referências **quebradas** (MDX → arquivo ausente) | **0** |
| JPEG em `public/guia` **sem** referência MDX | **4** |
| Comentários `{/* print */}` pendentes | **28** (10 arquivos MDX) |

## Placeholders por capítulo

| MDX | Qtd | IDs canônicos esperados |
|-----|-----|-------------------------|
| `01-primeiros-passos.mdx` | 8 | reset, register wizard, profile-setup, wizard→lista, home portas, lista peladas, menu idioma/tema |
| `02-peladas-e-eventos.mdx` | 1 | `p-lista-peladas.jpeg` |
| `05-dia-do-evento.mdx` | 3 | participantes confirmado, `p39`, `p46` |
| `06-mural-e-rankings.mdx` | 6 | confiança, melhor pelada, top peladas (2), `p50`, votação contador 10 |
| `07-contratacao-profissionais.mdx` | 1 | `p56-caixa-card` |
| `08-imprensa-jornal-e-radio.mdx` | 2 | `p57`, `p58` |
| `10-confrontos.mdx` | 3 | `p60`, `p62`, `p-aceite-ida-volta` |
| `11-minha-conta.mdx` | 2 | menu tema (dup cap. 01) |
| `14-times-e-caixa-de-entrada.mdx` | 2 | `p56`, `p62` |
| `15-busca-lendas-e-convite.mdx` | 1 | usuarios busca + ficha (2 telas → 2 arquivos) |

Lista canônica completa: [MANUAL-SCREENSHOTS-PEDIDOS.md](MANUAL-SCREENSHOTS-PEDIDOS.md) · roteiro WhatsApp: [MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt](MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt)

## Órfãos em `public/guia` (não linkados no MDX)

| Arquivo | Nota |
|---------|------|
| `02-esqueci-senha.jpeg` | Substituído por `p21-esqueci-senha.jpeg` no cap. 01 |
| `05-peladas.jpeg` | Layout antigo; cap. 02 aguarda `p-lista-peladas.jpeg` |
| `13-mural-app.jpeg` | Possível legado; mural usa `p49` / `11-*` |
| `14-perfil.jpeg` | Substituído por `p34-perfil-papeis.jpeg` |

Remoção opcional na fase de integração ([MANUAL-SITE-INTEGRATE.md](MANUAL-SITE-INTEGRATE.md)) para reduzir confusão na CDN.

## Imagens no MDX desatualizadas (texto já descreve wizard)

| Arquivo publicado | Problema |
|-------------------|----------|
| `03-criar-conta.jpeg` | Formulário monolítico; texto cap. 01 descreve wizard 5 passos |
| `p27-montagem-perfil.jpeg` | Formulário longo; texto descreve wizard profile-setup |

Substituir quando existirem `p-register-wizard-step.jpeg` e `p-profile-setup-atleta-step.jpeg` (e opcionalmente novo print de profile-setup final).

## Pasta local `D:\Ita\Projetos\...\imagens\Manual`

~100 JPEGs; **Novas** cobre confrontos/caixa/imprensa. **Não** cobre os 27+ canônicos pendentes (ver matriz). **Não reutilizar:** `Novas/23-Lista de peladas com as 5 abas.jpeg`, `56-1-...`, `62-Desafio...`, `50-Mural - aba Confrontos - Top Times.jpeg`.
