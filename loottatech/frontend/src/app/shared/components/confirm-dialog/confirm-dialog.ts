import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  afterNextRender,
  viewChild,
} from '@angular/core';

/**
 * A yes/no question the customer has to answer before something happens.
 *
 * Written once and reused rather than copied per feature, so every
 * confirmation in the shop behaves the same way: Escape cancels, the backdrop
 * cancels, and the safe choice is the one already focused.
 *
 * The confirming button is focused on open, not the cancel button, because
 * confirmations reached deliberately (pressing "Sign out") should not need a
 * second reach for the mouse. Escape is always one key away if it was a slip.
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  @Input({ required: true }) title!: string;
  @Input() message = '';

  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';

  /** Paints the confirm button red, for anything destructive. */
  @Input() danger = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');

  constructor() {
    // afterNextRender, not a constructor call: the button does not exist in
    // the DOM until the template has been rendered once.
    afterNextRender(() => this.confirmButton()?.nativeElement.focus());
  }
}
