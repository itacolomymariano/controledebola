# Gaps manual site (fase 2) — build app ≥356

**Data:** 2026-11-13 · Repo site: `d:\Ita\git\controledebolasite` · App referência: Android **1.0.14 / 356**

O app foi alinhado neste ciclo (i18n `screen.help.*`, bugs lightbox/período mural). **Deploy Cloudflare pendente** até JPEGs + commits no site.

## P0 — texto contradiz o app

| ID | Arquivo MDX | Problema | Ação fase 2 |
|----|-------------|----------|--------------|
| S-P0-01 | `01-primeiros-passos.mdx` § Home | Diz **4 portas** e rodapé sem aba **Início** | Reescrever: **6 portas** 2×3, 6 abas (Início, Peladas, Buscar, Confrontos, Mural, Perfil) |
| S-P0-02 | `06-mural-e-rankings.mdx` § Explorar | Lista conteúdo **legado** (desempenho, top local, mídia top) | Alinhar a **Explorar / Curiosidades** (scout, altura, mapa) + acordeão **Resultados por período** |
| S-P0-03 | `06-mural-e-rankings.mdx` | Falta hero **Craque do App** + grade **Conquistas** | Novo parágrafo + prints `p-mural-hero-conquistas.jpeg` |
| S-P0-04 | `06-mural-e-rankings.mdx` | Falta local **UF · cidade · bairro** nos cards | Texto curto + print `p-mural-local-linha.jpeg` |

## P1 — figuras / placeholders

| ID | JPEG / placeholder | Status |
|----|-------------------|--------|
| S-P1-01 | `p23-home-portas` (6 portas) | missing — ver [MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt](MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt) |
| S-P1-02 | `p52-1-explorar`, `p52-2-explorar` | **refazer** ou substituir por `p-mural-explorar-curiosidades` |
| S-P1-03 | `p49-mural-geral` | **refazer** (hero + conquistas) |
| S-P1-04 | 28× `{/* print */}` em 10 MDX | Aguardam matriz [MANUAL-SCREENSHOT-MATRIX-2026-10.md](MANUAL-SCREENSHOT-MATRIX-2026-10.md) |

## P2 — melhorias

| ID | Onde | Nota |
|----|------|------|
| S-P2-01 | Cap. 01 | Seção “ampliar foto” (`p-home-lightbox.jpeg`) |
| S-P2-02 | `00-ciclo-de-vida.mdx` | Conferir menção às 6 abas após editar cap. 01 |
| S-P2-03 | `public/guia` órfãos | Ver [MANUAL-MDX-INVENTORY-2026-11.md](MANUAL-MDX-INVENTORY-2026-11.md) |

## Checklist fase 2 (adulto/agent)

1. Colar JPEGs em `controledebolasite/public/guia/`
2. Atualizar MDX 01 e 06 (mínimo) + trocar `{/* print */}`
3. `node scripts/check-manual-guia-images.js` (repo site)
4. Deploy Cloudflare
5. Smoke: Sobre → Manual → `controledebola.com/guia` vs build 356

## Já OK no app (este PR)

- `screen.help.home`, `screen.help.mural`, `screen.help.peladas`, `mural.app.help`
- Chaves `screen.help.legend-*-edit` / `legend-team-view` em en/es
- Correções: lightbox toque para fechar; período mural ao mudar filtro UF
