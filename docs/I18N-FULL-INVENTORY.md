# i18n — inventário de hardcoded (scan automático)

Gerado: 2026-11-14T13:24:11.909Z

| Prioridade | Ocorrências |
|------------|-------------|
| P0 | 44 |
| P1 | 44 |
| P2 | 98 |
| P3 | 158 |
| **Total** | 344 |

## P0 — telas do smoke Xaiana

### `pages/pelada-detail/pelada-detail.page.html` (23)
- L329: <ion-input label="Titulo" labelPlacement="stacked" formControlName="title"></ion-input>
- L332: <ion-input label="Descricao" labelPlacement="stacked" formControlName="description"></ion-input>
- L336: label="Valor alvo"
- L363: <ion-select label="Participante" labelPlacement="stacked" formControlName="userId">
- L370: <ion-input label="Valor da contribuicao" labelPlacement="stacked" type="number" formControlName="amount"></ion-input>
- L373: <ion-input label="Data e hora" labelPlacement="stacked" type="datetime-local" formControlName="paidAt"></ion-input>
- L390: <ion-button size="small" fill="clear" (click)="editCotinhaPayment(payment)">Editar</ion-button>
- L407: <ion-note>Fluxo de caixa visivel apenas para socios.</ion-note>
- … +15
### `shared/components/mural-highlights-panel/mural-highlights-panel.component.html` (19)
- L124: <ion-note>Sem dados para esta faixa etária.</ion-note>
- L139: <ion-note>Sem dados para esta faixa etária.</ion-note>
- L152: <ion-note>Sem dados para esta faixa etária.</ion-note>
- L182: <ion-note>Sem dados.</ion-note>
- L191: <ion-note>Sem dados.</ion-note>
- L199: <ion-note>Sem dados.</ion-note>
- L210: <ion-note>Sem dados para esta faixa etaria.</ion-note>
- L227: <ion-note>Sem dados para esta faixa etaria.</ion-note>
- … +11
### `core/config/mural-app-sections.config.ts` (1)
- L8: if (tab === 'peladas') return 'pelada';
### `pages/event-mural/event-mural.page.html` (1)
- L499: <ion-note>Sem dados ainda.</ion-note>

## P1 — mural / evento / pelada (amostra)

- `pages/pelada-form/pelada-form.page.html` — 17 hit(s)
- `shared/components/event-detail-convocation-panel/event-detail-convocation-panel.component.html` — 5 hit(s)
- `shared/components/event-detail-material-panel/event-detail-material-panel.component.html` — 4 hit(s)
- `pages/event-mural/event-mural.page.ts` — 3 hit(s)
- `shared/components/mural-period-rankings-card/mural-period-rankings-card.component.ts` — 3 hit(s)
- `shared/components/mural-share-button/mural-share-button.component.html` — 3 hit(s)
- `pages/pelada-form/pelada-form.page.ts` — 2 hit(s)
- `shared/components/mural-fan-highlights/mural-fan-highlights.component.html` — 2 hit(s)
- `shared/components/event-detail-participants-panel/event-detail-participants-panel.component.html` — 1 hit(s)
- `shared/components/event-detail-voting-panel/event-detail-voting-panel.component.html` — 1 hit(s)
- `shared/components/mural-app-feed/mural-app-feed.component.html` — 1 hit(s)
- `shared/components/mural-media-top-card/mural-media-top-card.component.html` — 1 hit(s)
- `shared/components/mural-prediction-rankings/mural-prediction-rankings.component.html` — 1 hit(s)
