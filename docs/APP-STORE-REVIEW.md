# App Store Review — Controle de Bola

## Status atual (01/09/2026) — **nao reenviar ainda**

A Apple reviu a **1.0 (92)** e rejeitou so as screenshots (2.3.3): iPhone 6.5" e iPad 13" nao mostravam o app em uso.

Sem Mac e sem iPad, o binario passa a ser **somente iPhone** (`TARGETED_DEVICE_FAMILY = 1`). Assim o Connect **nao exige** screenshot de iPad. No iPad o app ainda abre no modo "feito para iPhone".

Proximo IPA: **1.0.3 (93)**.

**Pode reenviar** somente depois de:

1. Commit/push + **novo** `release-ipa` (1.0.3 / 93).
2. TestFlight processar a 93.
3. Media Manager: **apagar** as imagens de iPad 13" e as antigas de iPhone 6.5".
4. Enviar **5 capturas reais do iPhone** (TestFlight, ja logado). Ver lista abaixo.
5. Responder a thread com o texto 2.3.3 e **Submit for Review**.

---

## 2.3.3 — Screenshots so no iPhone

### O que a Apple recusa

- Banner, mockup, texto promocional
- Splash, onboarding e **login**
- Captura de **Android**
- Print de iPhone no slot de iPad (esse slot some no binario iPhone-only)

### As 5 telas (no seu iPhone, TestFlight 1.0.3)

| # | Tela | Como chegar |
|---|------|-------------|
| 1 | Lista de peladas | Tabs → **Peladas** (com peladas na lista) |
| 2 | Detalhe de um evento | Abrir um evento com data, local e inscricao |
| 3 | Mural / rankings | Tabs → **Mural** |
| 4 | Busca | Tabs → **Buscar** com resultados |
| 5 | Perfil com papeis | Tabs → **Perfil** (nao a tela de excluir conta) |

### Onde enviar

1. [Ficha da versao](https://appstoreconnect.apple.com/apps/6801505260/distribution/ios/version/inflight)
2. **Compilacao** → escolher **1.0.3 (93)**, nao a 92 nem a 79
3. **View All Sizes in Media Manager**
4. **6.5" Display:** apagar tudo; enviar as 5 capturas
5. **13" Display (iPad):** apagar tudo. Se o Connect ainda pedir iPad antes da 93, espere o binario iPhone-only processar

Tamanho iPhone 6.5": **1242 × 2688** ou **1284 × 2778**. PNG da captura nativa (volume + power). Se o Connect recusar o tamanho do seu aparelho, envie tambem no slot **6.9"** (o Connect costuma aceitar 1290 × 2796 / 1320 × 2868).

---

## Texto para a thread (2.3.3) — so depois das imagens e da compilacao 93

```
Ola,

A compilacao agora e a 1.0.3 (93), somente iPhone. Por isso nao ha mais screenshots de iPad.

As screenshots de iPhone 6.5" foram substituidas por capturas reais da interface, ja autenticado:

- lista de peladas;
- detalhe de evento (inscricao e local);
- mural / rankings;
- busca;
- perfil com papeis.

Nao ha splash, login nem material promocional.

Conta de demonstracao:
E-mail: [preencha]
Senha: [preencha]
```

Cole em: App Store Connect → **Reply to App Review**. Depois **Submit for Review**.

---

## Historico — ja no binario 92 (nao voltaram nesta rejeicao)

| Guideline | Situacao |
|-----------|----------|
| 5.1.1 endereco | Obrigatorio: eventos proximos e rankings locais |
| 2.3.8 icone | Logo no IPA |
| 5.1.1 exclusao | **Meu Perfil → Excluir conta** |
| 2.1(a) foto | Capacitor Camera |
| 2.3.3 iPad | Resolvido tornando o app iPhone-only na 1.0.3 |

CI: `scripts/apply-ios-review-config.js` define `TARGETED_DEVICE_FAMILY = 1` apos `cap add ios`.
