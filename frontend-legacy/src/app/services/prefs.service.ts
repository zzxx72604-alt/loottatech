import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Food } from '../shared/models/Food';

const FAV_KEY = 'lootta_favorites';
const RATING_KEY = 'lootta_ratings';

@Injectable({
  providedIn: 'root',
})
export class PrefsService {
  private favsSubject: BehaviorSubject<string[]>;
  public favorites$;

  constructor() {
    this.favsSubject = new BehaviorSubject<string[]>(this.loadFavorites());
    this.favorites$ = this.favsSubject.asObservable();
  }

  private loadFavorites(): string[] {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    } catch {
      return [];
    }
  }

  getFavorites(): string[] {
    return this.favsSubject.value;
  }

  isFavorite(id: string): boolean {
    return this.favsSubject.value.includes(id);
  }

  toggleFavorite(id: string): boolean {
    const favs = [...this.favsSubject.value];
    const idx = favs.indexOf(id);
    if (idx === -1) favs.push(id);
    else favs.splice(idx, 1);
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    this.favsSubject.next(favs);
    return favs.includes(id);
  }

  private loadRatings(): { [id: string]: number } {
    try {
      return JSON.parse(localStorage.getItem(RATING_KEY) || '{}');
    } catch {
      return {};
    }
  }

  getRating(id: string): number | undefined {
    return this.loadRatings()[id];
  }

  setRating(id: string, stars: number): void {
    const ratings = this.loadRatings();
    ratings[id] = stars;
    localStorage.setItem(RATING_KEY, JSON.stringify(ratings));
  }

  applyToFood(food: Food): Food {
    food.favorite = this.isFavorite(food.id);
    const userRating = this.getRating(food.id);
    if (userRating !== undefined) {
      food.stars = Math.round(((food.stars + userRating) / 2) * 10) / 10;
    }
    return food;
  }

  applyToFoods(foods: Food[]): Food[] {
    return foods.map((f) => this.applyToFood(f));
  }
}
