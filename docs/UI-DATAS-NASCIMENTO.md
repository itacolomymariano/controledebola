# Datas de nascimento / fundacao — regra anti-regressao

**Ultima atualizacao:** 2026-07-22

## Regra obrigatoria

Para campos de **data de nascimento** (ou datas equivalentes em formularios de perfil/lendas), **nao use** `ion-input type="date"` nem o calendario nativo do SO.

Motivo: percorrer anos antigos (ex.: 1950, 1960) no calendario e inviavel no mobile.

## Componente padrao

Use sempre:

```html
<app-birth-date-picker formControlName="birthDate"></app-birth-date-picker>
```

| Artefato | Caminho |
|----------|---------|
| Componente | `src/app/shared/components/birth-date-picker/` |
| Utilitarios | `src/app/core/utils/birth-date.util.ts` |
| Declaracao | `SharedModule` |

O picker expoe **Dia / Mes / Ano** (`ion-select`), com action-sheet no mobile.

## Valor do FormControl

- Formato: string ISO `YYYY-MM-DD` (local, sem timezone drift).
- Ao salvar: `parseBirthDateIso(value)` → `Date | null` (nunca `new Date('YYYY-MM-DD')` cru, que pode mudar o dia por fuso).
- Ao carregar: `birthDateToIsoString(date)`.

## Telas que devem seguir esta regra

- `account-edit` (Meus dados) — **ja regressou uma vez** para `type="date"`; nao repetir
- `register` (Criar conta)
- Formularios de lendas (`legend-*-form`) quando pedirem nascimento/fundacao

## Checklist do agente

Antes de alterar formularios com data de nascimento:

1. [ ] Continua usando `app-birth-date-picker`?
2. [ ] Nao introduziu `type="date"` / `ion-datetime` para nascimento?
3. [ ] Persistencia usa `parseBirthDateIso` / `birthDateToIsoString`?

Se a tarefa “simplificar o formulario” ou “usar input nativo” surgir, **recusar** para este campo e apontar este documento.
