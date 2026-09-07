# E-mail de reset de senha — Zoho + Back4App

O app ja tem o botao **Esqueci minha senha** (`login.page`). A flag `passwordResetEnabled` foi ligada. Sem Email Adapter no Back4App o Parse nao envia o e-mail.

## 1. Zoho Mail (humano)

1. Conta no dominio `controledebola.com` (Cloudflare DNS apontando ao Zoho).
2. Criar caixa `noreply@controledebola.com` (ou usar uma existente).
3. Ativar **App Password** (autenticacao de duas etapas).
4. SMTP: `smtp.zoho.com`, porta **587** (STARTTLS), usuario = e-mail completo.

## 2. Back4App (dois passos)

O painel novo (`backend.back4app.com`) **nao tem** campo SMTP. O suporte configura o `emailAdapter` no Parse Server **depois** que o modulo existir no Cloud Code.

### 2.1 Voce — instalar o modulo

Arquivo no repo: `cloud/package.json` (`parse-mail-smtp-adapter` + `nodemailer`). **Sem senha.**

1. Back4App → app **MinhaPelada** → menu **… More** (ou Cloud Code) → **Functions & Web Hosting**.
   URL tipica: `backend.back4app.com/apps/…/cloud_code`
   Nao usar App Settings → Advanced Options → Server Settings (isso e so upload de arquivo).
2. **Add** o arquivo `cloud/package.json` na pasta Cloud (ao lado de `main.js`).
3. **Nao apague** `main.js`.
4. **Deploy** e espere o build dos NPM modules terminar.

### 2.2 Suporte Back4App — ligar o adapter

Responda o ticket do Charles com o modulo `parse-mail-smtp-adapter` e o Application ID (App Settings → **Security & Keys**). Eles gravam SMTP Zoho no servidor. Nao cole senha no Git.

## 3. Teste

1. App (iOS e Android): login → Esqueci minha senha → e-mail cadastrado.
2. Abrir o link do Parse, definir senha nova, voltar ao app e entrar.

O link padrao do Parse e pagina web hospedada. Se o iOS bloquear, abrir o mesmo link no Safari.

## 4. Senha de aplicativo

A senha antiga (exposta no chat) ja foi revogada. A senha nova foi enviada **so** ao Charles. **Nao precisa trocar de novo** depois do teste, salvo se a senha nova vazar.

Aguardando o suporte ligar o `emailAdapter`. So entao testar Esqueci minha senha.
