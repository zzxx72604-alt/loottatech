import { Component } from '@angular/core';
import { ConfirmService } from 'src/app/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css'],
})
export class ConfirmDialogComponent {
  constructor(public confirmService: ConfirmService) {}

  respond(value: boolean): void {
    this.confirmService.resolve(value);
  }
}
