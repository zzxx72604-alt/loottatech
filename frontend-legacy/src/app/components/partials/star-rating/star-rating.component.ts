import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'star-rating',
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css']
})
export class StarRatingComponent {

  @Input()
  stars!: number;

  @Input()
  size: number = 1;

  @Input()
  editable: boolean = false;

  @Output()
  rate = new EventEmitter<number>();

  hovered: number = 0;

  get styles() {
    return {
      'width.rem': this.size,
      'height.rem': this.size,
      'marginRight.rem': this.size / 6,
      'cursor': this.editable ? 'pointer' : 'default',
    }
  }

  getStarImage(current: number): string{
    const value = this.editable && this.hovered ? this.hovered : this.stars;
    const previousHalf = current - 0.5;
    const imageName =
    value >= current
    ? 'star-full'
    : value >= previousHalf
    ? 'star-half'
    : 'star-empty';
    return `/assets/stars/${imageName}.svg`;
  }

  onHover(value: number){
    if (this.editable) this.hovered = value;
  }

  onLeave(){
    this.hovered = 0;
  }

  onClick(value: number){
    if (!this.editable) return;
    this.stars = value;
    this.rate.emit(value);
  }
}
