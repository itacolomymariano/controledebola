# Back4App — Cloud Code

Gere o arquivo com `npm run build:cloud` e publique o conteudo de `cloud/main.js` no dashboard do Back4App:

**Server Settings → Cloud Code → main.js**

Sem publicar o Cloud Code, o app usa fallback local no cadastro, mas login por celular, inscricoes em eventos e outras funcoes podem falhar com `Invalid function`.

## Funcoes de cadastro

### `prepareSignupChallenge`

Gera a verificacao anti-bot (soma simples) antes do formulario de criar conta.

- Parametros: nenhum
- Retorno: `{ challengeId, question }`
- Cria um registro em `SignupChallenge` com `useMasterKey`

### `registerUser`

Cria o usuario com validacao de contato, endereco e anti-bot no `beforeSave` de `_User`.

- Parametros: `name`, `apelido`, `password`, `address`, `email?`, `phone?`, `birthDate?`, `signupChallengeId`, `signupCaptchaAnswer`, `signupStartedAt`, `signupHoneypot`
- Retorno: `{ sessionToken, objectId }`

## Funcao `resolveLoginUsername`

Usada no **login** quando o celular digitado nao e o username do Parse (ex.: username = e-mail, phone = celular).

- Parametro: `identifier` (e-mail ou celular digitado)
- Retorno: `{ username: string | null }` — username real para `Parse.User.logIn`
- Nao recebe senha; a senha continua validada apenas pelo `logIn` no cliente
- Usa `useMasterKey` (nao expoe dados sensiveis alem do username)

Publique junto com `listPeladaEventParticipants` em `cloud/main.js`.

## Funcao `getPeladaDisplayInfo`

Retorna `adminApelido`, `adminName` e `adminAvatarUrl` da pelada (para usuarios nao-admin verem o nome real do administrador).

## Funcao `listPeladaActiveSocios`

Lista socios ativos com nome, apelido e foto para a aba Socios (usuarios nao-admin). Atualiza campos denormalizados em `PeladaMembership` quando ausentes.

## Funcao `listPeladaMembershipsForAdmin`

Lista **todos** os vinculos de socio da pelada com `userId` e `status` para o admin marcar/desmarcar checkboxes na aba Socios (contorna CLP que limita a leitura client-side).

## Funcao `listPeladaEventParticipants`

Usada na aba **Socios** da pelada para listar todos os participantes de eventos (admin da pelada).

- Parametro: `peladaId` (String)
- Retorno: array de participantes com `userId`, `userName`, `apelido`, `roles`, `avatarUrl`
- Usa `useMasterKey` para ler todas as inscricoes (contorna CLP que limita leitura ao usuario logado)

Sem esta funcao, a aba Socios pode mostrar apenas o usuario logado.

## Login por celular

A CLP de `_User` deve permitir `find` nos campos `username` e `phone` para usuarios **nao autenticados** (public read limitado a esses campos), ou o login por celular depende do username ser igual ao celular digitado.
