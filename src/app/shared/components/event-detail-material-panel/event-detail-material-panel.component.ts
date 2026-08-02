import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  EventMaterialSession,
  EventMaterialSource,
  EventMaterialStatus,
  MaterialInventoryItem,
  materialLineDisplayLabel,
} from '../../../core/models/material-inventory.model';

@Component({
  selector: 'app-event-detail-material-panel',
  templateUrl: './event-detail-material-panel.component.html',
  styleUrls: ['./event-detail-material-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventDetailMaterialPanelComponent implements OnChanges {
  @Input({ required: true }) session!: EventMaterialSession | null;
  @Input() inventory: MaterialInventoryItem[] = [];
  @Input() isAdmin = false;
  @Input() isKitman = false;
  @Input() busy = false;
  @Input() partialQuantities: Record<string, number> = {};
  @Input() blindCounts: Record<string, number> = {};
  @Input() blindDamagedCounts: Record<string, number> = {};

  @Output() back = new EventEmitter<void>();
  @Output() sourceChange = new EventEmitter<EventMaterialSource>();
  @Output() loadAll = new EventEmitter<void>();
  @Output() loadPartial = new EventEmitter<void>();
  @Output() send = new EventEmitter<void>();
  @Output() receiveReturn = new EventEmitter<void>();
  @Output() submitBlindCount = new EventEmitter<void>();
  @Output() applyLosses = new EventEmitter<void>();
  @Output() partialQuantityChange = new EventEmitter<{ id: string; quantity: number }>();
  @Output() blindCountChange = new EventEmitter<{ key: string; quantity: number }>();
  @Output() blindDamagedChange = new EventEmitter<{ key: string; quantity: number }>();

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(_changes: SimpleChanges): void {
    this.cdr.markForCheck();
  }

  get source(): EventMaterialSource {
    return this.session?.materialSource || 'none';
  }

  get canConfigureSource(): boolean {
    return this.isAdmin || this.isKitman;
  }

  /** Admin ja fixou material da pelada: ropeiro nao pode trocar a origem. */
  get sourceLockedForKitman(): boolean {
    return !this.isAdmin && this.isKitman && this.source === 'pelada';
  }

  get canSelectKitmanSource(): boolean {
    if (this.busy || this.sourceLockedForKitman) return false;
    return this.canConfigureSource;
  }

  get canSelectNoneSource(): boolean {
    if (this.busy || this.sourceLockedForKitman) return false;
    return this.canConfigureSource;
  }

  get hasKitmanCounterparty(): boolean {
    return !!this.session?.counterpartyUserId;
  }

  /** Inventario da origem selecionada ainda nao cadastrado. */
  get hasEmptyInventory(): boolean {
    return this.source !== 'none' && this.inventory.length === 0;
  }

  get showMissingPeladaInventoryHint(): boolean {
    return this.source === 'pelada' && this.isAdmin && this.hasEmptyInventory;
  }

  get showMissingKitmanHint(): boolean {
    return (
      this.source === 'pelada' &&
      this.isAdmin &&
      !this.hasEmptyInventory &&
      !this.hasKitmanCounterparty
    );
  }

  get canLoad(): boolean {
    if (!this.session || this.source === 'none') return false;
    if (this.hasEmptyInventory) return false;
    if (this.source === 'pelada') return this.isAdmin;
    return this.isKitman;
  }

  get canSend(): boolean {
    if (!this.session || this.session.status !== 'loaded') return false;
    if (this.source === 'pelada') {
      return this.isAdmin && this.hasKitmanCounterparty;
    }
    return this.isKitman;
  }

  get sendButtonLabel(): string {
    if (this.source === 'pelada') {
      const name = (this.session?.counterpartyName || 'Ropeiro').trim();
      return `Enviar material ao Ropeiro (${name})`;
    }
    return 'Enviar material ao Administrador';
  }

  get canBlindCount(): boolean {
    if (!this.session || this.session.status !== 'sent') return false;
    if (this.source === 'kitman') return this.isAdmin;
    return this.isKitman;
  }

  get canReceiveReturn(): boolean {
    return (
      this.isAdmin &&
      this.source === 'pelada' &&
      !!this.session &&
      (this.session.status === 'sent' || this.session.status === 'received')
    );
  }

  get showConferenceInputs(): boolean {
    return this.canBlindCount || (this.canReceiveReturn && this.session?.status === 'sent');
  }

  get canApplyLosses(): boolean {
    return (
      this.isAdmin &&
      this.source === 'pelada' &&
      !!this.session &&
      this.session.status === 'reconciled' &&
      !this.session.lossesApplied &&
      this.session.divergences.some((d) => d.delta < 0)
    );
  }

  eventQtyFor(item: MaterialInventoryItem): number {
    const raw = this.partialQuantities[item.objectId];
    if (raw == null) {
      return item.availableQuantity;
    }
    return Number(raw) || 0;
  }

  lineLabel(itemType: string, color: string): string {
    return materialLineDisplayLabel(itemType as never, color);
  }

  lineKey(itemType: string, color: string): string {
    return `${itemType}::${(color || '').trim().toLowerCase()}`;
  }

  statusLabel(status: EventMaterialStatus): string {
    switch (status) {
      case 'loaded':
        return 'Material carregado';
      case 'sent':
        return 'Material enviado — aguardando conferencia';
      case 'received':
        return 'Conferencia registrada';
      case 'reconciled':
        return 'Devolucao conciliada';
      default:
        return 'Aguardando carga';
    }
  }

  onSourceSelect(source: EventMaterialSource): void {
    this.sourceChange.emit(source);
  }

  onPartialInput(itemId: string, event: CustomEvent): void {
    this.partialQuantityChange.emit({
      id: itemId,
      quantity: Number((event.detail as { value?: string | number })?.value || 0),
    });
  }

  onBlindInput(key: string, event: CustomEvent): void {
    this.blindCountChange.emit({
      key,
      quantity: Number((event.detail as { value?: string | number })?.value || 0),
    });
  }

  onBlindDamagedInput(key: string, event: CustomEvent): void {
    this.blindDamagedChange.emit({
      key,
      quantity: Number((event.detail as { value?: string | number })?.value || 0),
    });
  }
}
