import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { sample_foods, sample_tags } from 'src/data';
import { FOODS_BY_SEARCH_URL, FOODS_BY_TAG_URL, FOODS_TAGS_URL, FOODS_URL, FOOD_BY_ID_URL } from '../shared/constants/urls';
import { Food } from '../shared/models/Food';
import { Tag } from '../shared/models/Tag';
import { PrefsService } from './prefs.service';

@Injectable({
  providedIn: 'root'
})
export class FoodService {

  constructor(private http:HttpClient, private prefs: PrefsService) { }

  getAll(): Observable<Food[]> {
    return this.http.get<Food[]>(FOODS_URL).pipe(
      map(foods => this.prefs.applyToFoods(foods))
    );
  }

  getAllFoodsBySearchTerm(searchTerm: string) {
    return this.http.get<Food[]>(FOODS_BY_SEARCH_URL + searchTerm).pipe(
      map(foods => this.prefs.applyToFoods(foods))
    );
  }

  getAllTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(FOODS_TAGS_URL);
  }

  getAllFoodsByTag(tag: string): Observable<Food[]> {
    return tag === "All" ?
      this.getAll() :
      this.http.get<Food[]>(FOODS_BY_TAG_URL + tag).pipe(
        map(foods => this.prefs.applyToFoods(foods))
      );
  }

  getAllFavorites(): Observable<Food[]> {
    return this.getAll().pipe(
      map(foods => foods.filter(f => f.favorite))
    );
  }

  getFoodById(foodId:string):Observable<Food>{
    return this.http.get<Food>(FOOD_BY_ID_URL + foodId).pipe(
      map(food => this.prefs.applyToFood(food))
    );
  }

  // ---------- Admin CRUD ----------
  createFood(food: Food): Observable<Food> {
    return this.http.post<Food>(FOODS_URL, food);
  }

  updateFood(food: Food): Observable<any> {
    return this.http.put(FOODS_URL, food, { responseType: 'text' });
  }

  deleteFood(foodId: string): Observable<any> {
    return this.http.delete(FOOD_BY_ID_URL + foodId, { responseType: 'text' });
  }

  reorderFoods(items: { id: string; sortOrder: number }[]): Observable<any> {
    return this.http.put(FOODS_URL + '/reorder', { items }, { responseType: 'text' });
  }

}
