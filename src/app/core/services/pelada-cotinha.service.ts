import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  CreateCotinhaPayload,
  CreateCotinhaPaymentPayload,
  PeladaCotinha,
  PeladaCotinhaPayment,
  PeladaCotinhaStatus,
  UpdateCotinhaPaymentPayload,
} from '../models/pelada-cotinha.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import {
  applyPayerDisplayFields,
  payerDisplayFromObject,
} from '../utils/cotinha-display.util';
import { PeladaCashService } from './pelada-cash.service';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const COTINHA_CLASS = 'PeladaCotinha';
const PAYMENT_CLASS = 'PeladaCotinhaPayment';

@Injectable({ providedIn: 'root' })
export class PeladaCotinhaService {
  constructor(
    private readonly parseService: ParseService,
    private readonly cashService: PeladaCashService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async listForPelada(peladaId: string): Promise<PeladaCotinha[]> {
    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const query = new Parse.Query(COTINHA_CLASS);
    query.equalTo('pelada', peladaPtr);
    query.include('createdBy');
    query.descending('createdAt');
    const results = await query.find();

    const cotinhas = results.map((obj) => this.toCotinha(obj));
    for (const cotinha of cotinhas) {
      cotinha.confirmedTotal = await this.getConfirmedTotal(cotinha.objectId);
    }
    return cotinhas;
  }

  async create(peladaId: string, payload: CreateCotinhaPayload): Promise<PeladaCotinha> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode criar cotinhas.');
    }

    const cotinha = new Parse.Object(COTINHA_CLASS);
    cotinha.set('pelada', peladaObj);
    cotinha.set('title', payload.title.trim());
    cotinha.set('description', payload.description?.trim() ?? '');
    cotinha.set('targetAmount', Math.max(0, payload.targetAmount));
    cotinha.set('status', 'open');
    cotinha.set('createdBy', user);
    cotinha.set('createdAt', new Date());

    try {
      const saved = await cotinha.save();
      await saved.fetchWithInclude('createdBy');
      const result = this.toCotinha(saved);
      result.confirmedTotal = 0;
      return result;
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async listPayments(cotinhaId: string): Promise<PeladaCotinhaPayment[]> {
    const cotinha = Parse.Object.extend(COTINHA_CLASS);
    const cotinhaPtr = cotinha.createWithoutData(cotinhaId);

    const query = new Parse.Query(PAYMENT_CLASS);
    query.equalTo('cotinha', cotinhaPtr);
    query.include('user');
    query.descending('paidAt');
    const results = await query.find();
    return results.map((obj) => this.toPayment(obj));
  }

  async addPayment(payload: CreateCotinhaPaymentPayload): Promise<PeladaCotinhaPayment> {
    const currentUser = Parse.User.current();
    if (!currentUser) throw new Error('Faca login.');

    const cotinhaQuery = new Parse.Query(COTINHA_CLASS);
    cotinhaQuery.include('pelada');
    const cotinhaObj = await cotinhaQuery.get(payload.cotinhaId);
    const pelada = cotinhaObj.get('pelada') as Parse.Object;
    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(pelada.id!);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    const isAdmin = admin?.id === currentUser.id;

    const payer =
      payload.userId && isAdmin
        ? Parse.User.createWithoutData(payload.userId)
        : currentUser;

    const payment = new Parse.Object(PAYMENT_CLASS);
    payment.set('cotinha', cotinhaObj);
    payment.set('user', payer);
    payment.set('amount', Math.max(0, payload.amount));
    payment.set('paidAt', payload.paidAt ?? new Date());
    applyPayerDisplayFields(payment, payer as Parse.User, this.parseFileService, payload.display);

    if (isAdmin) {
      payment.set('confirmedByAdmin', true);
      payment.set('confirmedAt', new Date());
      payment.set('confirmedBy', currentUser);
    } else {
      payment.set('confirmedByAdmin', false);
    }

    try {
      const saved = await payment.save();
      if (isAdmin) {
        await this.createCashEntryForPayment(saved, pelada.id!);
        await saved.save();
      }
      return this.toPayment(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async updatePayment(
    paymentId: string,
    payload: UpdateCotinhaPaymentPayload
  ): Promise<PeladaCotinhaPayment> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const query = new Parse.Query(PAYMENT_CLASS);
    query.include(['user', 'cotinha']);
    const payment = await query.get(paymentId);
    const peladaId = await this.assertAdminForPayment(payment, user);

    if (payload.userId) {
      payment.set('user', Parse.User.createWithoutData(payload.userId));
    }
    if (payload.amount !== undefined) {
      payment.set('amount', Math.max(0, payload.amount));
    }
    if (payload.paidAt) {
      payment.set('paidAt', payload.paidAt);
    }

    const saved = await payment.save();
    await saved.fetchWithInclude('user');

    const cashEntryId = saved.get('cashEntryId') as string | undefined;
    if (cashEntryId && saved.get('confirmedByAdmin')) {
      const cotinha = saved.get('cotinha') as Parse.Object;
      const cotinhaTitle = (cotinha.get('title') as string) || 'Cotinha';
      const display = payerDisplayFromObject(
        saved,
        saved.get('user') as Parse.User | undefined,
        this.parseFileService
      );
      await this.cashService.updateEntry(cashEntryId, peladaId, {
        amount: Number(saved.get('amount') ?? 0),
        date: saved.get('paidAt') as Date,
        description: this.buildCotinhaCashDescription(
          cotinhaTitle,
          display.displayName || 'Participante'
        ),
      });
    }

    return this.toPayment(saved);
  }

  async deletePayment(paymentId: string): Promise<void> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const query = new Parse.Query(PAYMENT_CLASS);
    query.include(['cotinha']);
    const payment = await query.get(paymentId);
    const peladaId = await this.assertAdminForPayment(payment, user);

    const cashEntryId = payment.get('cashEntryId') as string | undefined;
    if (cashEntryId) {
      await this.cashService.deleteEntry(cashEntryId, peladaId);
    }

    await payment.destroy();
  }

  async confirmPayment(paymentId: string, confirmed: boolean): Promise<PeladaCotinhaPayment> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const query = new Parse.Query(PAYMENT_CLASS);
    query.include(['user', 'cotinha']);
    const payment = await query.get(paymentId);
    const peladaId = await this.assertAdminForPayment(payment, user);
    const wasConfirmed = !!payment.get('confirmedByAdmin');
    const cashEntryId = payment.get('cashEntryId') as string | undefined;

    payment.set('confirmedByAdmin', confirmed);
    if (confirmed) {
      payment.set('confirmedAt', new Date());
      payment.set('confirmedBy', user);
    } else {
      payment.set('confirmedAt', null);
      payment.set('confirmedBy', null);
    }

    if (confirmed && !wasConfirmed) {
      await this.createCashEntryForPayment(payment, peladaId);
    } else if (!confirmed && wasConfirmed && cashEntryId) {
      await this.createCashReversalEntryForPayment(payment, peladaId);
      payment.set('cashEntryId', null);
    }

    const saved = await payment.save();
    await saved.fetchWithInclude('user');
    return this.toPayment(saved);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  private async assertAdminForPayment(payment: Parse.Object, user: Parse.User): Promise<string> {
    const cotinha = payment.get('cotinha') as Parse.Object;
    const peladaId = (cotinha.get('pelada') as Parse.Object)?.id;
    if (!peladaId) throw new Error('Cotinha invalida.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode gerenciar contribuicoes.');
    }
    return peladaId;
  }

  private async getConfirmedTotal(cotinhaId: string): Promise<number> {
    const cotinha = Parse.Object.extend(COTINHA_CLASS);
    const cotinhaPtr = cotinha.createWithoutData(cotinhaId);

    const query = new Parse.Query(PAYMENT_CLASS);
    query.equalTo('cotinha', cotinhaPtr);
    query.equalTo('confirmedByAdmin', true);
    const payments = await query.find();
    return payments.reduce((sum, p) => sum + Number(p.get('amount') ?? 0), 0);
  }

  private toCotinha(obj: Parse.Object): PeladaCotinha {
    const createdBy = obj.get('createdBy') as Parse.User | undefined;
    return {
      objectId: obj.id!,
      peladaId: (obj.get('pelada') as Parse.Object)?.id ?? '',
      title: obj.get('title') as string,
      description: (obj.get('description') as string) ?? '',
      targetAmount: Number(obj.get('targetAmount') ?? 0),
      status: (obj.get('status') as PeladaCotinhaStatus) ?? 'open',
      createdById: createdBy?.id ?? '',
      createdByName: (createdBy?.get('name') as string) || createdBy?.getUsername() || 'Admin',
      createdAt: (obj.get('createdAt') as Date) ?? new Date(),
      confirmedTotal: 0,
    };
  }

  private async createCashEntryForPayment(payment: Parse.Object, peladaId: string): Promise<void> {
    const cotinha = payment.get('cotinha') as Parse.Object;
    const cotinhaTitle = (cotinha.get('title') as string) || 'Cotinha';
    const display = payerDisplayFromObject(
      payment,
      payment.get('user') as Parse.User | undefined,
      this.parseFileService
    );
    const entry = await this.cashService.create(peladaId, {
      date: (payment.get('paidAt') as Date) ?? new Date(),
      type: 'in',
      amount: Number(payment.get('amount') ?? 0),
      description: this.buildCotinhaCashDescription(
        cotinhaTitle,
        display.displayName || 'Participante'
      ),
      cotinhaId: cotinha.id,
    });
    payment.set('cashEntryId', entry.objectId);
  }

  private async createCashReversalEntryForPayment(
    payment: Parse.Object,
    peladaId: string
  ): Promise<void> {
    const cotinha = payment.get('cotinha') as Parse.Object;
    const cotinhaTitle = (cotinha.get('title') as string) || 'Cotinha';
    const display = payerDisplayFromObject(
      payment,
      payment.get('user') as Parse.User | undefined,
      this.parseFileService
    );
    await this.cashService.create(peladaId, {
      date: new Date(),
      type: 'out',
      amount: Number(payment.get('amount') ?? 0),
      description: this.buildCotinhaReversalDescription(
        cotinhaTitle,
        display.displayName || 'Participante'
      ),
      cotinhaId: cotinha.id,
    });
  }

  private buildCotinhaCashDescription(cotinhaTitle: string, payerName: string): string {
    return `Cotinha ${cotinhaTitle} - contribuicao de ${payerName}`;
  }

  private buildCotinhaReversalDescription(cotinhaTitle: string, payerName: string): string {
    return `Estorno cotinha ${cotinhaTitle} - ${payerName}`;
  }

  private toPayment(obj: Parse.Object): PeladaCotinhaPayment {
    const user = obj.get('user') as Parse.User | undefined;
    const display = payerDisplayFromObject(obj, user, this.parseFileService);
    return {
      objectId: obj.id!,
      cotinhaId: (obj.get('cotinha') as Parse.Object)?.id ?? '',
      userId: display.userId,
      userName: display.displayName || 'Participante',
      avatarUrl: display.avatarUrl,
      amount: Number(obj.get('amount') ?? 0),
      paidAt: (obj.get('paidAt') as Date) ?? new Date(),
      confirmedByAdmin: !!obj.get('confirmedByAdmin'),
      confirmedAt: obj.get('confirmedAt') as Date | undefined,
      cashEntryId: obj.get('cashEntryId') as string | undefined,
    };
  }
}
