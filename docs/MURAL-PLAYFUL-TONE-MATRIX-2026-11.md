# Matriz de tons — Mural playful (2026-11)

Referência: [UI-PLAYFUL-DESIGN-SYSTEM-2026-11.md](UI-PLAYFUL-DESIGN-SYSTEM-2026-11.md)

## Regras

- **Não** usar `surface` / `muted` em destaques, Top 10 ou rankings.
- Rotacionar entre `peladas` | `confrontos` | `times` | `users` via `muralPlayfulToneForSection(key, index)`.
- Rank rows dentro de cartão colorido: usar **`app-mural-rank-entry`** com tom **diferente** do pai (`muralPlayfulNestedTone`).
- Acordeões: header pastel; conteúdo com `mural-playful-accordion-content` + `mural-playful-screen`; filhos com `playfulChrome="true"`.

## Card dentro de card (ondas 2+)

| Pai (`app-playful-card`) | Filho (`app-mural-rank-entry`) |
|--------------------------|--------------------------------|
| Tom T | `muralPlayfulNestedTone(T, index)` — nunca repetir T |
| `ion-card` dentro de acordeão | `nth-of-type` pastel até migrar para `app-playful-card` |

Offset: `childIndex % 3` + 1 posição na rotação `peladas → confrontos → times → users`.

## Mapa por seção

| Seção | Tom padrão |
|--------|------------|
| Craque / torcedores / faixas etárias | `users` |
| Goleador / palpites / scout | `confrontos` |
| Pelada / melhor pelada / período | `peladas` |
| Times / mídia / ataque/defesa | `times` |
| Top 10 por perfil (loop) | `TONES[index % 4]` |
| Confrontos dashboard | alternar por card |
| Participantes por localização | `users` (+ drilldown `muralPlayfulToneByIndex`) |
| Desempenho qualitativo / quantitativo / gráfico / tipos de gol | `users` / `confrontos` / `times` / `peladas` |
| Explorar — mapa (UF / cidade / bairro) | `times` / `peladas` / `confrontos` |
| Explorar — curiosidades (gols, idade, altura) | `muralPlayfulToneByIndex(index)` |
| Master (destaque) | `confrontos` (nunca `muted`) |
| Top 10 peladas/times/coaches (interno) | `match-rank-card--child-*` via `muralPlayfulNestedTone` |