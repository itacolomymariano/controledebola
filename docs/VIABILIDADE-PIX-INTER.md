# Viabilidade PIX — Banco Inter (pesquisa, sem implementacao)

**Decisao desta onda:** nao integrar a API Pix Cob do Inter. Manter o fluxo atual (chave PIX do organizador/profissional + confirmacao manual). Custo zero para o Controle de Bola.

## O que o app ja faz

- Chaves `pixKey1/2/3` nos perfis profissionais e atletas.
- Copia PIX / cobranca na inscricao, cotinhas e contratacoes.
- Admin confirma pagamento (`isEffectivelyConfirmed` no client + Cloud `09`).

Isso e **PIX P2P**: o jogador paga a chave de outra pessoa. Nao passa pelo nosso CNPJ.

## O que a documentacao do Inter diz

Fontes: [API Pix Inter Empresas](https://inter.co/empresas/api-pix/), [Portal do desenvolvedor](https://developers.inter.co/), tabela de tarifas PJ.

| Item | Custo tipico | Serve para nos? |
|------|----------------|-----------------|
| Abrir conta Inter Empresas | Sem mensalidade na conta digital basica | Precisa de PJ |
| Usar o portal / criar aplicacao (OAuth + mTLS) | Integracao em si e gratuita | Sim, mas e projeto |
| PIX transferencia (enviar/receber chave) | Inter divulga PIX PJ ilimitado isento no Super App | Igual ao P2P atual |
| Recebimento **QR estatico** | Tabela PJ: isento | Parecido com chave/copia |
| **Pix Cob** (QR dinamico imediato via API) | Tabela PJ cobra por evento (faixas; marketing cita ~0,9% com piso/teto) | **Nao e de graca** |
| Pix CobV (com vencimento) | Tarifado | Nao e de graca |

“API gratuita” = nao pagar para ter credenciais. **Receber via Cob dinamico pode ter tarifa.**

## Exigencias tecnicas da API

- Conta **Inter Empresas** ativa.
- Aplicacao no Internet Banking → certificado **mTLS** + OAuth.
- Secrets **so no Cloud Code** (nunca no app). Webhook de liquidacao para marcar `isEffectivelyConfirmed`.
- Compliance PIX (conciliacao, contestacao, dados de cobranca).

## Recomendacao

1. **Agora:** continuar PIX P2P (custo zero para nos; o dinheiro vai ao admin/profissional).
2. **Depois (opcional):** API Cob so se houver CNPJ Inter, aceite de tarifa por QR dinamico, e demanda real de conciliacao automatica.
3. Nao implementar Inter nesta onda. Coach e manual devem descrever o PIX **atual**.
