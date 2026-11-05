# Integração site — JPEGs do manual → Cloudflare

Executar **depois** que os arquivos estiverem em `imagens\Manual\Novas` com nome canônico.

## 1. Copiar arquivos

```powershell
$src = "D:\Ita\Projetos\Minha_Pelada_Controle_de_Bola\imagens\Manual\Novas"
$dst = "D:\Ita\git\controledebolasite\public\guia"
Copy-Item "$src\p23-home-portas.jpeg" $dst -Force
# ... repetir para cada p-*.jpeg
```

## 2. Substituir placeholders MDX

Em `controledebolasite/src/content/guia/`, trocar cada `{/* print ... */}` por:

```mdx
![Descrição curta](/guia/NOME-ARQUIVO.jpeg)
```

Mapa placeholder → arquivo: [MANUAL-MDX-INVENTORY-2026-11.md](MANUAL-MDX-INVENTORY-2026-11.md)

## 3. Figuras desatualizadas (opcional)

| MDX | Trocar referência |
|-----|-------------------|
| `01-primeiros-passos.mdx` | `03-criar-conta.jpeg` → `p-register-wizard-step.jpeg` |
| `01` / `11` | `p27-montagem-perfil.jpeg` → wizard ou manter se preferir Pix |

## 4. Limpeza CDN (opcional)

Remover órfãos/ obsoletos se ainda existirem em `public/guia`:

- `02-esqueci-senha.jpeg`, `05-peladas.jpeg`, `13-mural-app.jpeg`, `14-perfil.jpeg`
- Obsoletos citados em [MANUAL-SCREENSHOTS-PEDIDOS.md](MANUAL-SCREENSHOTS-PEDIDOS.md)

## 5. Verificar

```powershell
cd D:\Ita\git\minhapelada
node scripts/check-manual-guia-images.js
# missing deve ser []
```

```powershell
cd D:\Ita\git\controledebolasite
rg "{/\* print" src/content/guia
# ideal: 0 matches
```

## 6. Deploy

Commit + push `controledebolasite` → deploy Cloudflare automático.

## Status

Ver [MANUAL-CAPTURA-STATUS.md](MANUAL-CAPTURA-STATUS.md) — integração MDX **bloqueada** até capturas humanas.
