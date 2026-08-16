import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Condition, CONDITION_LABEL } from '../../models/product';

/**
 * Tiny presentational component. Takes a condition in, renders a coloured
 * pill out. No logic, no service, no state — safe to use anywhere.
 */
@Component({
  selector: 'app-condition-badge',
  imports: [],
  template: `<span class="badge" [class]="'c-' + condition">{{ label }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      padding: 1px 7px;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      line-height: 17px;
      color: #fff;
      white-space: nowrap;
    }
    .c-new { background: var(--cond-new); }
    .c-like-new { background: var(--cond-like-new); }
    .c-good { background: var(--cond-good); }
    .c-fair { background: var(--cond-fair); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionBadge {
  @Input({ required: true }) condition!: Condition;

  get label(): string {
    return CONDITION_LABEL[this.condition] ?? this.condition;
  }
}
