# Nicole — validar Home mock pós-build (Android)

Checklist paralelo a [XAIANA-VALIDACAO-UX-POS-BUILD.md](XAIANA-VALIDACAO-UX-POS-BUILD.md) (iOS wizard). Foco: **Início** `/tabs/home` após redesign mock ChatGPT.

---

## Antes de abrir a Home

1. Play **teste interno** — instalar build **novo** (não reutilizar APK antigo com lista branca de cards).
2. **Sobre** (menu ou Perfil): marketing **≥ 1.0.11** e release label **≥ `2026.11.05`** (ou mais recente que o último enviado ao teste interno).
3. Se a Home ainda parecer lista vertical verde/branca → build desatualizado; subir AAB de novo.

---

## O que conferir na Home

| Item | Esperado |
|------|----------|
| Layout | **Grid 2×2** (Peladas, Confrontos, Times, Usuários), simétrico |
| Hero | Faixa **roxa** com avatar, apelido, “Bem-vindo de volta”; chips de local se endereço cadastrado |
| Cores | Cards pastéis distintos + botão circular com seta em cada porta |
| Preenchimento | Sem faixa vazia grande entre portas e tab bar |
| Navegação | Cada porta abre o mesmo destino de antes (lista / confrontos / times / usuarios) |
| Rodapé | 6 abas; **Início** = 1ª aba |

---

## Wizard cadastro (fluxo separado)

Não validar wizard na mesma sessão mental da Home. Para wizard: logout → **Criar conta** — exige build com commits wizard (`5ea684d+`). Ver smoke **#0** em [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md).

---

## Build / release (maintainers)

| Plataforma | Comando / ação |
|------------|----------------|
| Android | `npm run build:android:aab` → Play teste interno |
| iOS | GitHub Actions `release-ipa` na `main` (marketing **1.0.11+**) — Xaiana/TestFlight |

Referência visual: [UI-REDESIGN-NICOLE-2026-11.md](UI-REDESIGN-NICOLE-2026-11.md).

Captura manual: `p23-home-portas.jpeg` — [MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt](MANUAL-CAPTURA-WHATSAPP-PRODUCAO.txt).
