# E-mail de reset de senha — Zoho + Back4App

O app ja tem o botao **Esqueci minha senha** (`login.page`). A flag `passwordResetEnabled` foi ligada. Sem Email Adapter no Back4App o Parse nao envia o e-mail.

## 1. Zoho Mail (humano)

1. Conta no dominio `controledebola.com` (Cloudflare DNS apontando ao Zoho).
2. Criar caixa `noreply@controledebola.com` (ou usar uma existente).
3. Ativar **App Password** (autenticacao de duas etapas).
4. SMTP: `smtp.zoho.com`, porta **587** (STARTTLS), usuario = e-mail completo.

## 2. Back4App

Dashboard → App Settings → **Email adapter** (ou Server Settings → Email):

- Tipo: SMTP
- Host `smtp.zoho.com` · Porta `587` · TLS/STARTTLS
- From: `Controle de Bola <noreply@controledebola.com>`
- Usuario / senha do App Password

Salvar e reiniciar o Parse Server se o painel pedir.

## 3. Teste

1. App (iOS e Android): login → Esqueci minha senha → e-mail cadastrado.
2. Abrir o link do Parse, definir senha nova, voltar ao app e entrar.

O link padrao do Parse e pagina web hospedada. Se o iOS bloquear, abrir o mesmo link no Safari.
