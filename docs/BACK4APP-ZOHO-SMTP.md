# E-mail (reset + contato) — Zoho no Back4App

O app **nao** usa o emailAdapter nativo do Parse. O Cloud Code (`nodemailer`) envia o codigo de reset e as mensagens de contato.

## Charles vs a tela que voce achou

O Charles estava certo **no recorte dele**: o suporte **nao liga** o `emailAdapter` do Parse Server com Environment Variables.

A tela **App Settings → Environment Variables** (`Add variable`, Key / Value) e **outra coisa**: o Parse Server expoe essas chaves em `process.env`. O nosso Cloud Code **ja le** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM`. Use esta tela.

Plano B (se as env vars nao chegarem no Cloud): classe `MailSettings` no Database.

## 1. Zoho

1. Caixa de envio: `noreply@controledebola.com` (App Password com 2FA).
2. Destinos: `contato@controledebola.com.br` e `suporte@controledebola.com.br`.
3. SMTP: `smtp.zoho.com`, porta **587**.

## 2. Cadastrar as variaveis (preferido)

Dashboard → MinhaPelada → App Settings → **Environment Variables** → **Add variable**. Uma de cada vez:

| Key | Value |
|-----|--------|
| `SMTP_HOST` | `smtp.zoho.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `noreply@controledebola.com` |
| `SMTP_PASS` | App Password do Zoho (nao cole no chat) |
| `SMTP_FROM` | `Controle de Bola <noreply@controledebola.com>` |

Opcional: `SMTP_REPLY_TO` = `contato@controledebola.com.br`.

Depois do Create, o servidor costuma reiniciar. Espere 1–2 minutos.

Tambem e obrigatorio: `cloud/main.js` novo **e** `cloud/package.json` com `nodemailer` publicados no Cloud Code.

## 3. Teste

Login (versao no header) → Esqueci minha senha → e-mail cadastrado. No Hotmail veja Spam e Outros. Depois digite o codigo de 6 digitos no app.

## 4. Resposta curta ao Charles (opcional)

```
Hi Charles,

Understood — we will not use env vars for the Parse emailAdapter.

We found App Settings → Environment Variables and will use those for our
Cloud Code (nodemailer), not for the native adapter.

Thanks,
Itacolomy
```
