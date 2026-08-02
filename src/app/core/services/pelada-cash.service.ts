import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  CashFlowSummary,
  CreateCashEntryPayload,
  PeladaCashEntry,
} from '../models/pelada-cash.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

const CLASS = 'PeladaCashEntry';

@Injectable({ providedIn: 'root' })
export class PeladaCashService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async getCashFlow(
    peladaId: string,
    startDate?: Date,
    endDate?: Date,
    initialBalance = 0
  ): Promise<CashFlowSummary> {
    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const query = new Parse.Query(CLASS);
    query.equalTo('pelada', peladaPtr);
    query.include('createdBy');
    if (startDate) query.greaterThanOrEqualTo('date', startDate);
    if (endDate) query.lessThanOrEqualTo('date', endDate);
    query.ascending('date');
    const results = await query.find();
    const entries = results.map((obj) => this.toEntry(obj));

    let totalIn = 0;
    let totalOut = 0;
    for (const entry of entries) {
      if (entry.type === 'in') totalIn += entry.amount;
      else totalOut += entry.amount;
    }

    return {
      initialBalance,
      totalIn,
      totalOut,
      finalBalance: initialBalance + totalIn - totalOut,
      entries,
    };
  }

  async create(peladaId: string, payload: CreateCashEntryPayload): Promise<PeladaCashEntry> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode registrar movimentacoes.');
    }

    const entry = new Parse.Object(CLASS);
    entry.set('pelada', peladaObj);
    entry.set('date', payload.date);
    entry.set('type', payload.type);
    entry.set('amount', Math.max(0, payload.amount));
    entry.set('description', payload.description.trim());
    entry.set('createdBy', user);

    if (payload.cotinhaId) {
      const cotinha = Parse.Object.extend('PeladaCotinha');
      entry.set('cotinha', cotinha.createWithoutData(payload.cotinhaId));
    }

    if (payload.refereeInvitationId) {
      const invitation = Parse.Object.extend('RefereeInvitation');
      entry.set('refereeInvitation', invitation.createWithoutData(payload.refereeInvitationId));
    }

    if (payload.membershipFeeId) {
      const fee = Parse.Object.extend('PeladaMembershipFee');
      entry.set('membershipFee', fee.createWithoutData(payload.membershipFeeId));
    }

    try {
      const saved = await entry.save();
      await saved.fetchWithInclude('createdBy');
      return this.toEntry(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async deleteEntry(entryId: string, peladaId: string): Promise<void> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode excluir movimentacoes.');
    }

    const query = new Parse.Query(CLASS);
    const entry = await query.get(entryId);
    await entry.destroy();
  }

  async updateEntry(
    entryId: string,
    peladaId: string,
    payload: Partial<CreateCashEntryPayload>
  ): Promise<PeladaCashEntry> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode alterar movimentacoes.');
    }

    const query = new Parse.Query(CLASS);
    query.include('createdBy');
    const entry = await query.get(entryId);
    if (payload.date) entry.set('date', payload.date);
    if (payload.type) entry.set('type', payload.type);
    if (payload.amount !== undefined) entry.set('amount', Math.max(0, payload.amount));
    if (payload.description !== undefined) entry.set('description', payload.description.trim());

    const saved = await entry.save();
    await saved.fetchWithInclude('createdBy');
    return this.toEntry(saved);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  private toEntry(obj: Parse.Object): PeladaCashEntry {
    const createdBy = obj.get('createdBy') as Parse.User | undefined;
    const cotinha = obj.get('cotinha') as Parse.Object | undefined;
    const refereeInvitation = obj.get('refereeInvitation') as Parse.Object | undefined;
    const membershipFee = obj.get('membershipFee') as Parse.Object | undefined;
    return {
      objectId: obj.id!,
      peladaId: (obj.get('pelada') as Parse.Object)?.id ?? '',
      date: (obj.get('date') as Date) ?? new Date(),
      type: obj.get('type') as 'in' | 'out',
      amount: Number(obj.get('amount') ?? 0),
      description: (obj.get('description') as string) ?? '',
      createdById: createdBy?.id ?? '',
      createdByName: (createdBy?.get('name') as string) || createdBy?.getUsername() || 'Admin',
      cotinhaId: cotinha?.id,
      refereeInvitationId: refereeInvitation?.id,
      membershipFeeId: membershipFee?.id,
    };
  }
}
