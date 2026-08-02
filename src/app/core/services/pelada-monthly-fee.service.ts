import { Injectable } from '@angular/core';
import Parse from 'parse';
import { PeladaMembership } from '../models/pelada-membership.model';
import { PeladaMembershipFee } from '../models/pelada-monthly-fee.model';
import { membershipDisplayFromObject } from '../utils/membership-display.util';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';
import { PeladaCashService } from './pelada-cash.service';
import { PeladaMembershipService } from './pelada-membership.service';

const CLASS = 'PeladaMembershipFee';
const MEMBERSHIP_CLASS = 'PeladaMembership';

@Injectable({ providedIn: 'root' })
export class PeladaMonthlyFeeService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService,
    private readonly membershipService: PeladaMembershipService,
    private readonly cashService: PeladaCashService
  ) {
    this.parseService.init();
  }

  async listForPeladaMonth(
    peladaId: string,
    year: number,
    month: number,
    options?: { onlyUserId?: string }
  ): Promise<PeladaMembershipFee[]> {
    const start = new Date(year, month - 1, 1);

    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const memberships = await this.membershipService.listActiveForDisplay(peladaId);

    const feeQuery = new Parse.Query(CLASS);
    feeQuery.equalTo('pelada', peladaPtr);
    feeQuery.greaterThanOrEqualTo('referenceMonth', start);
    feeQuery.lessThan('referenceMonth', new Date(year, month, 1));
    const fees = await feeQuery.find();

    const feeByMembership = new Map<string, Parse.Object>();
    for (const fee of fees) {
      const membership = fee.get('membership') as Parse.Object;
      if (membership?.id) feeByMembership.set(membership.id, fee);
    }

    const peladaQuery = new Parse.Query('Pelada');
    const peladaObj = await peladaQuery.get(peladaId);
    const monthlyFee = Number(peladaObj.get('monthlyFee') ?? 0);

    const results: PeladaMembershipFee[] = [];

    for (const membership of memberships) {
      if (options?.onlyUserId && membership.userId !== options.onlyUserId) {
        continue;
      }
      const existingFee = feeByMembership.get(membership.objectId);
      results.push(
        existingFee
          ? this.toFee(existingFee, peladaId, membership)
          : this.placeholderFee(membership, peladaId, year, month, monthlyFee)
      );
    }

    return results.sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
  }

  async isSocioInGoodStanding(
    peladaId: string,
    userId: string,
    year = new Date().getFullYear(),
    month = new Date().getMonth() + 1
  ): Promise<boolean> {
    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const membershipQuery = new Parse.Query(MEMBERSHIP_CLASS);
    membershipQuery.equalTo('pelada', peladaPtr);
    membershipQuery.equalTo('user', Parse.User.createWithoutData(userId));
    membershipQuery.equalTo('status', 'active');
    const membership = await membershipQuery.first();
    if (!membership) {
      return false;
    }

    const start = new Date(year, month - 1, 1);
    const feeQuery = new Parse.Query(CLASS);
    feeQuery.equalTo('pelada', peladaPtr);
    feeQuery.equalTo('membership', membership);
    feeQuery.greaterThanOrEqualTo('referenceMonth', start);
    feeQuery.lessThan('referenceMonth', new Date(year, month, 1));
    const fee = await feeQuery.first();
    if (!fee) {
      return false;
    }

    return !!fee.get('paymentConfirmed');
  }

  async generateFeesForMonth(peladaId: string, year: number, month: number): Promise<void> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode gerar mensalidades.');
    }

    const monthlyFee = Number(peladaObj.get('monthlyFee') ?? 0);
    if (monthlyFee <= 0) {
      throw new Error('Configure o valor da mensalidade na pelada.');
    }

    const start = new Date(year, month - 1, 1);
    const peladaPtr = peladaObj;

    const membershipQuery = new Parse.Query(MEMBERSHIP_CLASS);
    membershipQuery.equalTo('pelada', peladaPtr);
    membershipQuery.equalTo('status', 'active');
    const memberships = await membershipQuery.find();

    for (const membership of memberships) {
      const existingQuery = new Parse.Query(CLASS);
      existingQuery.equalTo('membership', membership);
      existingQuery.greaterThanOrEqualTo('referenceMonth', start);
      existingQuery.lessThan('referenceMonth', new Date(year, month, 1));
      const existing = await existingQuery.first();
      if (existing) continue;

      const fee = new Parse.Object(CLASS);
      fee.set('membership', membership);
      fee.set('pelada', peladaPtr);
      fee.set('referenceMonth', start);
      fee.set('amount', monthlyFee);
      fee.set('dueDate', new Date(year, month - 1, 10));
      fee.set('paymentConfirmed', false);
      await fee.save();
    }
  }

  async confirmFee(feeId: string, confirmed: boolean): Promise<PeladaMembershipFee> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const query = new Parse.Query(CLASS);
    query.include(['membership', 'pelada']);
    const fee = await query.get(feeId);
    const pelada = fee.get('pelada') as Parse.Object;
    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(pelada.id!);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode confirmar mensalidades.');
    }

    const wasConfirmed = !!fee.get('paymentConfirmed');
    const membership = fee.get('membership') as Parse.Object;
    const membershipDisplay = await this.membershipDisplayFor(membership);

    fee.set('paymentConfirmed', confirmed);
    if (confirmed) {
      fee.set('confirmedAt', new Date());
      fee.set('confirmedBy', user);
    } else {
      fee.set('confirmedAt', null);
      fee.set('confirmedBy', null);
    }

    if (confirmed && !wasConfirmed) {
      await this.createCashEntryForFee(fee, pelada.id!, membershipDisplay);
    } else if (!confirmed && wasConfirmed) {
      await this.createCashReversalEntryForFee(fee, pelada.id!, membershipDisplay);
      fee.set('cashEntryId', null);
    }

    try {
      const saved = await fee.save();
      const savedMembership = saved.get('membership') as Parse.Object;
      return this.toFee(saved, pelada.id!, await this.membershipDisplayFor(savedMembership));
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async upsertFeeAmount(
    membershipId: string,
    peladaId: string,
    year: number,
    month: number,
    amount: number
  ): Promise<PeladaMembershipFee> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode alterar mensalidades.');
    }

    const membership = Parse.Object.extend(MEMBERSHIP_CLASS);
    const membershipPtr = membership.createWithoutData(membershipId);
    const start = new Date(year, month - 1, 1);

    const existingQuery = new Parse.Query(CLASS);
    existingQuery.equalTo('membership', membershipPtr);
    existingQuery.equalTo('pelada', peladaObj);
    existingQuery.greaterThanOrEqualTo('referenceMonth', start);
    existingQuery.lessThan('referenceMonth', new Date(year, month, 1));
    let feeObj = await existingQuery.first();

    if (!feeObj) {
      feeObj = new Parse.Object(CLASS);
      feeObj.set('membership', membershipPtr);
      feeObj.set('pelada', peladaObj);
      feeObj.set('referenceMonth', start);
      feeObj.set('dueDate', new Date(year, month - 1, 10));
      feeObj.set('paymentConfirmed', false);
    }

    feeObj.set('amount', Math.max(0, amount));
    const saved = await feeObj.save();
    const membershipObj = await new Parse.Query(MEMBERSHIP_CLASS)
      .include('user')
      .get(membershipId);
    const membershipDisplay = await this.membershipDisplayFor(membershipObj);

    const linkedCashEntryId = saved.get('cashEntryId') as string | undefined;
    if (saved.get('paymentConfirmed') && linkedCashEntryId) {
      await this.cashService.updateEntry(linkedCashEntryId, peladaId, {
        amount: Math.max(0, amount),
        description: this.buildFeeCashDescription(
          membershipDisplay.userApelido || membershipDisplay.userName,
          saved.get('referenceMonth') as Date
        ),
      });
    }

    return this.toFee(saved, peladaId, membershipDisplay);
  }

  async createAndConfirmFee(
    membershipId: string,
    peladaId: string,
    year: number,
    month: number,
    amount: number
  ): Promise<PeladaMembershipFee> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode confirmar mensalidades.');
    }

    const membership = Parse.Object.extend(MEMBERSHIP_CLASS);
    const membershipPtr = membership.createWithoutData(membershipId);
    const start = new Date(year, month - 1, 1);

    const existingQuery = new Parse.Query(CLASS);
    existingQuery.equalTo('membership', membershipPtr);
    existingQuery.greaterThanOrEqualTo('referenceMonth', start);
    existingQuery.lessThan('referenceMonth', new Date(year, month, 1));
    let feeObj = await existingQuery.first();

    if (!feeObj) {
      feeObj = new Parse.Object(CLASS);
      feeObj.set('membership', membershipPtr);
      feeObj.set('pelada', peladaObj);
      feeObj.set('referenceMonth', start);
      feeObj.set('dueDate', new Date(year, month - 1, 10));
    }

    feeObj.set('amount', Math.max(0, amount));
    feeObj.set('paymentConfirmed', true);
    feeObj.set('confirmedAt', new Date());
    feeObj.set('confirmedBy', user);

    const saved = await feeObj.save();
    const membershipObj = await new Parse.Query(MEMBERSHIP_CLASS)
      .include('user')
      .get(membershipId);
    const membershipDisplay = await this.membershipDisplayFor(membershipObj);

    if (!saved.get('cashEntryId')) {
      await this.createCashEntryForFee(saved, peladaId, membershipDisplay);
      await saved.save();
    }

    return this.toFee(saved, peladaId, membershipDisplay);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  private async createCashEntryForFee(
    feeObj: Parse.Object,
    peladaId: string,
    membership: PeladaMembership
  ): Promise<void> {
    const confirmedAt = (feeObj.get('confirmedAt') as Date) ?? new Date();
    const referenceMonth = (feeObj.get('referenceMonth') as Date) ?? confirmedAt;
    const participantName = membership.userApelido || membership.userName;
    const entry = await this.cashService.create(peladaId, {
      date: confirmedAt,
      type: 'in',
      amount: Number(feeObj.get('amount') ?? 0),
      description: this.buildFeeCashDescription(participantName, referenceMonth),
      membershipFeeId: feeObj.id,
    });
    feeObj.set('cashEntryId', entry.objectId);
  }

  private async createCashReversalEntryForFee(
    feeObj: Parse.Object,
    peladaId: string,
    membership: PeladaMembership
  ): Promise<void> {
    const reversedAt = new Date();
    const referenceMonth = (feeObj.get('referenceMonth') as Date) ?? reversedAt;
    const participantName = membership.userApelido || membership.userName;
    await this.cashService.create(peladaId, {
      date: reversedAt,
      type: 'out',
      amount: Number(feeObj.get('amount') ?? 0),
      description: this.buildFeeReversalCashDescription(participantName, referenceMonth),
      membershipFeeId: feeObj.id,
    });
  }

  private buildFeeCashDescription(participantName: string, referenceMonth: Date): string {
    const monthLabel = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(referenceMonth);
    return `Mensalidade ${monthLabel} - ${participantName}`;
  }

  private buildFeeReversalCashDescription(participantName: string, referenceMonth: Date): string {
    const monthLabel = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(referenceMonth);
    return `Estorno mensalidade ${monthLabel} - ${participantName}`;
  }

  private placeholderFee(
    membership: PeladaMembership,
    peladaId: string,
    year: number,
    month: number,
    monthlyFee: number
  ): PeladaMembershipFee {
    const start = new Date(year, month - 1, 1);
    return {
      objectId: '',
      membershipId: membership.objectId,
      peladaId,
      userId: membership.userId,
      userName: membership.userApelido || membership.userName,
      avatarUrl: membership.avatarUrl,
      referenceMonth: start,
      amount: monthlyFee,
      dueDate: new Date(year, month - 1, 10),
      paymentConfirmed: false,
    };
  }

  private async membershipDisplayFor(membership: Parse.Object): Promise<PeladaMembership> {
    const user = membership.get('user') as Parse.User | undefined;
    const display = membershipDisplayFromObject(membership, user, this.parseFileService);
    return {
      objectId: membership.id!,
      peladaId: (membership.get('pelada') as Parse.Object)?.id ?? '',
      userId: display.userId,
      userName: display.displayName || 'Socio',
      userApelido: display.apelido,
      userFullName: display.fullName,
      avatarUrl: display.avatarUrl,
      status: (membership.get('status') as PeladaMembership['status']) ?? 'active',
      role: (membership.get('role') as PeladaMembership['role']) ?? 'socio',
      joinedAt: (membership.get('joinedAt') as Date) ?? new Date(),
    };
  }

  private toFee(
    obj: Parse.Object,
    peladaId: string,
    membership?: PeladaMembership
  ): PeladaMembershipFee {
    const membershipPtr = obj.get('membership') as Parse.Object | undefined;
    const confirmedBy = obj.get('confirmedBy') as Parse.User | undefined;
    const userName = membership?.userApelido || membership?.userName || 'Socio';

    return {
      objectId: obj.id ?? '',
      membershipId: membership?.objectId ?? membershipPtr?.id ?? '',
      peladaId,
      userId: membership?.userId ?? '',
      userName,
      avatarUrl: membership?.avatarUrl,
      referenceMonth: (obj.get('referenceMonth') as Date) ?? new Date(),
      amount: Number(obj.get('amount') ?? 0),
      dueDate: (obj.get('dueDate') as Date) ?? new Date(),
      paymentConfirmed: !!obj.get('paymentConfirmed'),
      confirmedAt: obj.get('confirmedAt') as Date | undefined,
      confirmedById: confirmedBy?.id,
      cashEntryId: obj.get('cashEntryId') as string | undefined,
    };
  }
}
