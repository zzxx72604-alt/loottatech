import { Component, OnInit } from '@angular/core';
import { FoodService } from 'src/app/services/food.service';
import { PrefsService } from 'src/app/services/prefs.service';
import { Food } from 'src/app/shared/models/Food';

@Component({
  selector: 'app-favorites-page',
  templateUrl: './favorites-page.component.html',
  styleUrls: ['./favorites-page.component.css'],
})
export class FavoritesPageComponent implements OnInit {
  foods: Food[] = [];

  constructor(private foodService: FoodService, private prefs: PrefsService) {
    this.load();
  }

  ngOnInit(): void {}

  load() {
    this.foodService.getAllFavorites().subscribe((foods) => {
      this.foods = foods;
    });
  }

  removeFavorite(food: Food, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.prefs.toggleFavorite(food.id);
    this.foods = this.foods.filter((f) => f.id !== food.id);
  }
}
