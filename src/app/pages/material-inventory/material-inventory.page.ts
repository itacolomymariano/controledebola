import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import {
  MATERIAL_ITEM_DEFINITIONS,
  MATERIAL_UNIFORM_COLORS,
  MaterialInventoryItem,
  MaterialItemType,
  MaterialOwnerType,
  materialLineDisplayLabel,
} from '../../core/models/material-inventory.model';
import { MaterialInventoryService } from '../../core/services/material-inventory.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

interface DraftRow {
  objectId?: string;
  itemType: MaterialItemType;
  color: string;
  quantity: number;
  damagedQuantity: number;
}

@Component({
  selector: 'app-material-inventory',
  templateUrl: './material-inventory.page.html',
  styleUrls: ['./material-inventory.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MaterialInventoryPage {
  ownerType: MaterialOwnerType = 'pelada';
  peladaId = '';
  loading = true;
  saving = false;
  items: MaterialInventoryItem[] = [];
  readonly definitions = MATERIAL_ITEM_DEFINITIONS;
  readonly uniformTypes = MATERIAL_ITEM_DEFINITIONS.filter((d) => d.category === 'uniforme');
  readonly equipmentTypes = MATERIAL_ITEM_DEFINITIONS.filter((d) => d.category === 'equipamento');
  readonly uniformColors = MATERIAL_UNIFORM_COLORS;

  draftsByType: Partial<Record<MaterialItemType, DraftRow[]>> = {};

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly materialService: MaterialInventoryService,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const ownerType = String(this.route.snapshot.queryParamMap.get('ownerType') || 'pelada');
    this.ownerType = ownerType === 'kitman' ? 'kitman' : 'pelada';
    this.peladaId = String(this.route.snapshot.queryParamMap.get('peladaId') || '').trim();
    if (this.ownerType === 'pelada' && !this.peladaId) {
      await this.showError('Pelada nao informada.');
      void this.router.navigateByUrl('/tabs/peladas');
      return;
    }
    await this.reload();
  }

  get pageTitle(): string {
    return this.ownerType === 'kitman' ? 'Material do Ropeiro' : 'Material da Pelada';
  }

  rowsFor(type: MaterialItemType): DraftRow[] {
    return this.draftsByType[type] || [];
  }

  defHasColor(type: MaterialItemType): boolean {
    return !!this.definitions.find((d) => d.type === type)?.hasColor;
  }

  itemLabel(type: MaterialItemType): string {
    return materialLineDisplayLabel(type);
  }

  colorOptionsFor(row: DraftRow): string[] {
    const current = (row.color || '').trim();
    if (current && !this.uniformColors.includes(current)) {
      return [current, ...this.uniformColors];
    }
    return [...this.uniformColors];
  }

  addRow(type: MaterialItemType): void {
    const rows = [...this.rowsFor(type)];
    rows.push({
      itemType: type,
      color: this.defHasColor(type) ? '' : '',
      quantity: 0,
      damagedQuantity: 0,
    });
    this.draftsByType = { ...this.draftsByType, [type]: rows };
    this.cdr.markForCheck();
  }

  removeRow(type: MaterialItemType, index: number): void {
    const rows = [...this.rowsFor(type)];
    const [removed] = rows.splice(index, 1);
    this.draftsByType = { ...this.draftsByType, [type]: rows };
    this.cdr.markForCheck();
    if (removed?.objectId) {
      void this.deleteExisting(removed.objectId);
    }
  }

  async saveAll(): Promise<void> {
    this.saving = true;
    this.cdr.markForCheck();
    const loading = await this.loadingCtrl.create({ message: 'Salvando material...' });
    await loading.present();
    try {
      for (const def of this.definitions) {
        for (const row of this.rowsFor(def.type)) {
          if (def.hasColor && !row.color.trim() && (row.quantity > 0 || row.objectId)) {
            throw new Error(`Informe a cor para ${def.label}.`);
          }
          if (row.damagedQuantity > row.quantity) {
            throw new Error(`Avariadas maior que quantidade em ${def.label}.`);
          }
          if (!row.objectId && row.quantity <= 0 && row.damagedQuantity <= 0) {
            continue;
          }
          await this.materialService.upsertItem({
            objectId: row.objectId,
            ownerType: this.ownerType,
            peladaId: this.ownerType === 'pelada' ? this.peladaId : undefined,
            itemType: def.type,
            color: def.hasColor ? row.color.trim() : '',
            quantity: Number(row.quantity) || 0,
            damagedQuantity: Number(row.damagedQuantity) || 0,
          });
        }
      }
      await this.reload();
      await this.showMessage('Material salvo.');
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.saving = false;
      await loading.dismiss();
      this.cdr.markForCheck();
    }
  }

  private async deleteExisting(objectId: string): Promise<void> {
    try {
      await this.materialService.deleteItem(objectId);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
      await this.reload();
    }
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.items = await this.materialService.listInventory({
        ownerType: this.ownerType,
        peladaId: this.ownerType === 'pelada' ? this.peladaId : undefined,
      });
      this.draftsByType = {};
      for (const def of this.definitions) {
        const rows: DraftRow[] = this.items
          .filter((item) => item.itemType === def.type)
          .map((item) => ({
            objectId: item.objectId,
            itemType: item.itemType,
            color: item.color,
            quantity: item.quantity,
            damagedQuantity: item.damagedQuantity,
          }));
        if (!rows.length) {
          rows.push({
            itemType: def.type,
            color: '',
            quantity: 0,
            damagedQuantity: 0,
          });
        }
        this.draftsByType[def.type] = rows;
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }

  private async showMessage(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'OK', message, buttons: ['OK'] });
    await alert.present();
  }
}
