import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

export interface GlassOption {
  value: string;
  label: string;
}

@Component({
  selector: 'glass-select',
  templateUrl: './glass-select.component.html',
  styleUrls: ['./glass-select.component.css'],
})
export class GlassSelectComponent {
  @Input() options: GlassOption[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  open = false;

  constructor(private el: ElementRef) {}

  get selectedLabel(): string {
    return this.options.find((o) => o.value === this.value)?.label ?? '';
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  choose(option: GlassOption): void {
    this.value = option.value;
    this.valueChange.emit(option.value);
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.el.nativeElement.contains(event.target)) this.open = false;
  }
}
