import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { FoodService } from 'src/app/services/food.service';
import { PrefsService } from 'src/app/services/prefs.service';
import { Food } from 'src/app/shared/models/Food';

type SortMode = 'default' | 'priceAsc' | 'priceDesc' | 'rating';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  foods: Food[] = [];
  sortMode: SortMode = 'default';
  onSaleOnly = false;
  sortOptions = [
    { value: 'default', label: 'Sort: Recommended' },
    { value: 'priceAsc', label: 'Price: Low → High' },
    { value: 'priceDesc', label: 'Price: High → Low' },
    { value: 'rating', label: 'Top rated' },
  ];

  constructor(private foodService: FoodService, private prefs: PrefsService,
    activatedRoute: ActivatedRoute) {
    let foodsObservalbe:Observable<Food[]>;
    activatedRoute.params.subscribe((params) => {
      if (params.searchTerm)
        foodsObservalbe = this.foodService.getAllFoodsBySearchTerm(params.searchTerm);
      else if (params.tag)
        foodsObservalbe = this.foodService.getAllFoodsByTag(params.tag);
      else
        foodsObservalbe = foodService.getAll();

        foodsObservalbe.subscribe((serverFoods) => {
          this.foods = serverFoods;
        })
    })
  }

  ngOnInit(): void {
  }

  salePrice(food: Food): number {
    return food.price * (1 - (food.discount || 0) / 100);
  }

  get displayedFoods(): Food[] {
    let list = [...this.foods];
    if (this.onSaleOnly) list = list.filter(f => (f.discount || 0) > 0);
    if (this.sortMode === 'priceAsc') list.sort((a, b) => this.salePrice(a) - this.salePrice(b));
    else if (this.sortMode === 'priceDesc') list.sort((a, b) => this.salePrice(b) - this.salePrice(a));
    else if (this.sortMode === 'rating') list.sort((a, b) => b.stars - a.stars);
    return list;
  }

  onSort(value: string){
    this.sortMode = value as SortMode;
  }

  toggleFavorite(food: Food, event: Event){
    event.preventDefault();
    event.stopPropagation();
    food.favorite = this.prefs.toggleFavorite(food.id);
  }

}
