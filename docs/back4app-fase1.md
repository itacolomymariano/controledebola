# Back4App — setup Fase 1

## Classe Event

Crie manualmente no dashboard ou deixe o app criar no primeiro `save()` (com CLP adequada).

### Campos

```
name                String
type                String   // pelada | racha | team_match
startTime           Date
endTime             Date
address             Object
locationComplement  String   (opcional — ex.: Campo 2, Quadra 2)
participationFee    Number   (valor da participacao; 0 = gratuito)
pixKey1             String   (opcional)
pixKey2             String   (opcional)
pixKey3             String   (opcional)
admin               Pointer<_User>
```

### Exemplo de `address`

```json
{
  "state": "SP",
  "city": "Sao Paulo",
  "neighborhood": "Centro",
  "zipCode": "01001000",
  "street": "Rua Exemplo, 100"
}
```

## Classe _User (campos extras)

O cadastro do app grava:

```
name         String
apelido      String
primaryRole  String   (opcional — athlete, referee, scout, journalist, cameraman, narrator, fan)
avatar       File     (foto de perfil, opcional)
avatarUrl    String   (URL publica da foto; usada nas listas do app)
email    String   (opcional)
phone    String   (opcional)
birthDate           Date     (opcional)
proFootballIdol     String   (opcional — idolo do futebol profissional)
amateurFootballIdol String   (opcional — idolo do futebol amador)
address  Object   (street, neighborhood, city, state, zipCode, latitude, longitude)
```

Username no Parse = celular normalizado (11 digitos) quando informado no cadastro, ou e-mail em minusculas.

**Login por celular:** usuarios antigos com username = e-mail precisam entrar com e-mail ou atualizar o cadastro. Para busca por celular antes do login, a CLP de `_User` deve permitir `find` no campo `phone` e `username` para usuarios nao autenticados. O app compara o identificador digitado com `username` (e depois `phone`, apenas digitos) e valida a senha via `Parse.User.logIn`.

## CLP mínima para testar

| Classe | Get | Find | Create | Update | Delete |
|--------|-----|------|--------|--------|--------|
| _User  | auth | auth | **all** | owner | owner |
| Event  | auth | auth | auth | auth* | auth* |

\* Em produção, restrinja update/delete ao `admin` via Cloud Code.

## Próximas classes (Fase 2+)

- `EventRegistration`, `EventRules`, `EventLineup`
- Perfis: `AthleteProfile`, `EventAdminProfile`, etc.
