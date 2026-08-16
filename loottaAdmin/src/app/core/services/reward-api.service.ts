import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { EconomyConfig, GrantResult, RedeemCode, Voucher } from '../../shared/models/reward';

@Injectable({ providedIn: 'root' })
export class RewardApi {
  private readonly api = inject(ApiService);

  // ---- economy settings ----
  config(): Observable<EconomyConfig> {
    return this.api.get<EconomyConfig>('config');
  }

  saveConfig(config: EconomyConfig): Observable<EconomyConfig> {
    return this.api.put<EconomyConfig>('config', config);
  }

  // ---- discount vouchers, used at checkout ----
  vouchers(): Observable<Voucher[]> {
    return this.api.get<Voucher[]>('rewards/admin/all');
  }

  generateVouchers(body: {
    value: number;
    minSpend: number;
    expiryDays: number;
    count: number;
    userId?: number | null;
  }): Observable<Voucher[]> {
    return this.api.post<Voucher[]>('rewards/admin/generate', body);
  }

  // ---- arcade codes, used in the game ----
  codes(): Observable<RedeemCode[]> {
    return this.api.get<RedeemCode[]>('rewards/admin/codes');
  }

  createCode(body: {
    coins: number;
    plays: number;
    maxUses: number;
    label: string;
    expiryDays: number;
    code?: string | null;
  }): Observable<RedeemCode> {
    return this.api.post<RedeemCode>('rewards/admin/codes', body);
  }

  setCodeActive(id: number, value: boolean): Observable<void> {
    return this.api.put<void>(`rewards/admin/codes/${id}/active?value=${value}`, {});
  }

  // ---- direct top-up ----
  grant(body: { userId: number; coins: number; plays: number; reason: string }): Observable<GrantResult> {
    return this.api.post<GrantResult>('rewards/admin/grant', body);
  }
}
