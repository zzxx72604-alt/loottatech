import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { UserService } from './user.service';
import {
  ArcadeState,
  GameResult,
  GameStart,
  RewardState,
  SpinResult,
  Voucher,
} from '../../shared/models/arcade';

@Injectable({ providedIn: 'root' })
export class ArcadeService {
  private readonly api = inject(ApiService);
  private readonly users = inject(UserService);

  state(): Observable<ArcadeState> {
    return this.api.get<ArcadeState>('game').pipe(tap((s) => this.users.setCoins(s.balance)));
  }

  spin(): Observable<SpinResult> {
    return this.api.post<SpinResult>('game/spin', {}).pipe(tap((r) => this.users.setCoins(r.balance)));
  }

  /** Consumes a play and returns the round token. */
  startRound(): Observable<GameStart> {
    return this.api.post<GameStart>('game/start', {});
  }

  finishRound(token: string, score: number): Observable<GameResult> {
    return this.api
      .post<GameResult>('game/finish', { token, score })
      .pipe(tap((r) => this.users.setCoins(r.balance)));
  }

  rewards(): Observable<RewardState> {
    return this.api.get<RewardState>('rewards').pipe(tap((r) => this.users.setCoins(r.balance)));
  }

  redeem(key: string): Observable<Voucher> {
    return this.api.post<Voucher>('rewards/redeem', { key });
  }
}
