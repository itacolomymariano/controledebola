# Auditoria documentação — manual (site) × operação (app produção)

**Data:** 2026-11-05 · Referência técnica: [GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md](GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md) · Testes: [FLUXO-TESTES-CICLO-DE-VIDA.md](FLUXO-TESTES-CICLO-DE-VIDA.md)

Escala: **P0** contradiz fluxo crítico · **P1** atrito ou visual desatualizado · **P2** cosmético / doc interna

## P0 — nenhum encontrado

Capítulos 00–15 do guia **não contradizem** auth, confirmação efetiva de inscrição, caixa/inbox, confrontos como `team_match`, ou exclusão de conta de forma que induza uso inseguro.

## P1 — alinhar manual ao app atual

| ID | Onde | Achado | Ação |
|----|------|--------|------|
| P1-01 | `01-primeiros-passos.mdx` + `03-criar-conta.jpeg` | Texto wizard cadastro; foto monolítica | Capturar `p-register-wizard-step.jpeg`; opcional trocar figura cadastro |
| P1-02 | `01` / `11` + `p27-montagem-perfil.jpeg` | Texto wizard profile-setup; foto formulário único | Capturar `p-profile-setup-atleta-step.jpeg` |
| P1-03 | `01`, `02`, `06`, `10`, `14` | **28** placeholders `{/* print */}` | Roteiro [MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt](MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt) |
| P1-04 | `00-ciclo-de-vida.mdx` | Cita abas rodapé corretas; Home “quatro portas” OK | Falta figura `p23-home-portas` (placeholder cap. 01) |
| P1-05 | `03-perfis-e-papeis.mdx` | 1ª montagem = wizard (nov/2026) | OK no texto; foto perfil OK (`p34`) |
| P1-06 | `04-inscricao-e-pagamento.mdx` | PIX, apresentação perfil, QR | Alinhado a `isEffectivelyConfirmed` e portaria |
| P1-07 | `08-imprensa-jornal-e-radio.mdx` | Hub mídia; prints 57/58 pendentes | Rotas: `/event/:id/cameraman-coverage`, `/event/:id/mural` → Abrir cobertura → `/event/:id/mural/media/video` |
| P1-08 | `10-confrontos.mdx` | Selo **Próximo**, ida/volta | Depende fixture produção; print `p60`, `p-aceite-ida-volta` |

## P2 — melhorias

| ID | Onde | Achado |
|----|------|--------|
| P2-01 | `public/guia` órfãos | 4 JPEG sem link MDX ([inventário](MANUAL-MDX-INVENTORY-2026-11.md)) |
| P2-02 | [MANUAL-SCREENSHOT-MATRIX-2026-10.md](MANUAL-SCREENSHOT-MATRIX-2026-10.md) | Estava sem entradas wizard nov/2026 — corrigido em nov/2025 passagem Coordenador |
| P2-03 | `05-peladas.jpeg` em public | Lista antiga; não referenciado no MDX atual |

## Coerência repo app (agents / smoke)

| Doc app | Manual | Status |
|---------|--------|--------|
| `SMOKE-TEST` #12b profile-setup wizard | Cap. 01 texto wizard | OK |
| `FLUXO-TESTES` A3/A4 | Cap. 01 cadastro/setup | OK |
| `AGENTS.md` domínios (Home Início, caixa AppMessage) | Cap. 14 caixa, cap. 01 Home | OK |
| `EVENT-MEDIA.md` | Cap. 08 | OK; falta só capturas 57/58 |

## Próxima revisão sugerida

Após integrar JPEGs (fase site): rerodar `node scripts/check-manual-guia-images.js`, grep `{/* print */}` = 0, smoke visual cap. 01 e 06.
