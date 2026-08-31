# App Store Review — Controle de Bola

## Atencao: a Apple reviu a compilacao ERRADA

Em 31/08/2026 a Apple rejeitou de novo a versao **1.0 (79)** — o mesmo envio `b7990a57-c342-4ab4-8af4-e8cd234b66fc` de agosto. Essa binary **nao tem** as correcoes.

O proximo envio **tem** que usar a compilacao **1.0.2** (ou mais nova). Nao reenvie a 1.0 (79). Nao deixe a versao da ficha apontando para a 79.

## O que o codigo ja corrige (1.0.2+)

| Guideline | Problema | No app |
|-----------|----------|--------|
| 5.1.1(v) endereco | Endereco obrigatorio | Mantido: e essencial para eventos proximos e rankings por bairro/cidade/estado. A tela explica o motivo. Justificativa na resposta a App Review |
| 2.3.8 | Icone placeholder | Logo Controle de Bola no binario (CI + `ios-config/AppIcon.appiconset`). Tambem envie o PNG 1024 na ficha da App Store |
| 5.1.1(v) exclusao | Sem exclusao | **Meu Perfil → Excluir conta** (fluxo completo na hora). Tambem em Meus dados |
| 2.1(a) | Crash na foto de perfil | Capacitor Camera + textos de camera/galeria no `Info.plist` |

## Checklist do reenvio (obrigatorio)

1. Commit/push destas alteracoes e **novo** `release-ipa` (1.0.2).
2. TestFlight interno: gravar no iPhone fisico criar conta (com endereco) → Perfil → Excluir conta ate o login.
3. App Store Connect → a **versao** (nao o TestFlight) → **Compilacao** → escolher **1.0.2**, nunca 1.0 (79).
4. **App Icon** da ficha: enviar `ios-config/AppIcon.appiconset/AppIcon-1024.png` (logo final, nao o icone Capacitor).
5. Video da exclusao em **App Review Information → Notes**.
6. Responder a thread (texto abaixo) e so entao **Submit for Review**.

## Texto para a thread da App Review

```
Ola,

A revisao de 31/08/2026 analisou a compilacao 1.0 (79), que e o binario antigo. As correcoes estao na compilacao 1.0.2, agora selecionada nesta versao.

5.1.1(v) Endereco
O endereco e necessario para a funcionalidade central do Controle de Bola, nao para marketing:
- sugerir peladas e eventos mais proximos do usuario;
- identificar participantes por bairro, cidade e estado;
- montar no mural os rankings e o Top 10 por bairro, cidade e estado.

Sem localizacao essas funcoes ficam inoperantes. Pedimos apenas o endereco validado na lista (bairro, cidade, UF e coordenadas). Celular e data de nascimento continuam opcionais.

2.3.8 Icones
O icone desta compilacao e o logotipo final do Controle de Bola (chuteira e bola), nao o placeholder do Capacitor. O mesmo icone 1024 foi enviado na ficha.

2.1(a) Foto de perfil
A foto usa a camera nativa do iOS, com as descricoes de uso de camera e galeria. O fluxo nao deve mais encerrar o app.

5.1.1(v) Exclusao de conta
Em Meu Perfil ha o item Excluir conta. O usuario confirma, informa a senha e a conta e apagada de forma permanente. O video gravado em iPhone fisico esta nas Notes da revisao.

Conta de demonstracao:
E-mail: [preencha]
Senha: [preencha]
```

Cole em: App Store Connect → app → aviso de problemas nao resolvidos → **Resolve** → **Reply to App Review**.
