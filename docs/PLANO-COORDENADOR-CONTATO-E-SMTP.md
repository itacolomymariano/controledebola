# Coordenador — contato, imprensa no guia, SMTP sem env vars

Data: 2026-09-10

## Decisao no item 4 (Charles)

Back4App **nao** aceita credenciais do email adapter em Environment Variables. O Cloud Code tambem nao pode depender disso.

**Caminho que nao espera o Charles:** classe Parse `MailSettings` (1 objeto), leitura so com Master Key. Voce cria no dashboard. O nodemailer usa esses campos.

Pedido opcional ao Charles (adapter nativo, nao env vars) fica como plano B.

## Delegacao

| Item | Quem | Motivo |
|------|------|--------|
| 1–2 Formularios + Cloud `sendContactMessage` | Coordenador (este chat) | Mesma infra de e-mail do reset; um so contexto |
| 4 SMTP via `MailSettings` | Coordenador | Desbloqueia reset e os formularios |
| 3 Guia jornalista/narrador | Agent no site | MDX isolado, baixo acoplamento |
