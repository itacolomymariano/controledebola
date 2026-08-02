# Controle de Bola

Rede social do futebol amador — Ionic + Angular + Capacitor + Back4App (Parse Server).

## Pré-requisitos

- Node.js 20+
- Conta no [Back4App](https://www.back4app.com/) com app criado via **Build a Backend**

## Configurar Back4App

### 1. Chaves do app

No dashboard Back4App: **App Settings → Security & Keys**

1. Copie `environment.local.ts.example` para `environment.local.ts`
2. Cole o **Application ID** e a **JavaScript Key** (nunca use a Master Key no app)

```bash
cp src/environments/environment.local.ts.example src/environments/environment.local.ts
```

Edite `src/environments/environment.local.ts`:

```typescript
export const parseLocal = {
  appId: 'SEU_APPLICATION_ID',
  javascriptKey: 'SUA_JAVASCRIPT_KEY',
};
```

### 2. Classe `Event` no Parse

Em **Database → Browser**, crie a classe `Event` com os campos:

| Campo      | Tipo     | Observação                          |
|-----------|----------|-------------------------------------|
| `name`    | String   | Nome do evento                      |
| `type`    | String   | `pelada`, `racha` ou `team_match`   |
| `startTime` | Date   | Início                              |
| `endTime` | Date     | Término                             |
| `address` | Object   | `{ state, city, neighborhood, zipCode, street }` |
| `admin`   | Pointer  | → `_User` (criador do evento)       |

### 3. Permissões (CLP) sugeridas para Fase 1

Classe `Event`:

- **Get**: autenticado
- **Find**: autenticado
- **Create**: autenticado
- **Update/Delete**: apenas o admin (ajustar depois com Cloud Code)

Classe `_User` (padrão Parse): permitir **Create** público para cadastro.

## Executar

```bash
npm install
npm start
```

Abra `http://localhost:8100`.

## Build

```bash
npm run build
```

## Fluxo do app

1. Splash → Onboarding (1ª vez) → Login/Cadastro
2. Após login: abas **Eventos**, **Buscar**, **Mural Geral**, **Meu Perfil**
3. Lista de eventos (prioriza sócio → já participei → mesma cidade) + botão **+** para criar
4. Toque no evento → **Detalhe** → **Participar** → escolha perfil + compromisso
5. Perfil **Atleta** é criado sob demanda na inscrição (ou em Meu Perfil)

Ver também [docs/back4app-fase2.md](docs/back4app-fase2.md) para classes `AthleteProfile` e `EventRegistration`.

## Estrutura

```
src/app/
  core/           # models, services, guards
  pages/          # splash, login, register, events, event-create, ...
  tabs/           # navegação principal
```

## Capacitor (mobile)

```bash
npx cap add android
npx cap sync
```
