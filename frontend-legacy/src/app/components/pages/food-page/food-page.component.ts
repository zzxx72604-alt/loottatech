import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CartService } from 'src/app/services/cart.service';
import { FoodService } from 'src/app/services/food.service';
import { PrefsService } from 'src/app/services/prefs.service';
import { Food } from 'src/app/shared/models/Food';

@Component({
  selector: 'app-food-page',
  templateUrl: './food-page.component.html',
  styleUrls: ['./food-page.component.css']
})
export class FoodPageComponent implements OnInit {
  food!: Food;
  userRating?: number;
  related: Food[] = [];

  constructor(activatedRoute:ActivatedRoute, private foodService:FoodService,
    private cartService:CartService, private router: Router,
    private prefs: PrefsService, private toastr: ToastrService) {
    activatedRoute.params.subscribe((params) => {
      if(params.id)
      this.foodService.getFoodById(params.id).subscribe(serverFood => {
        this.food = serverFood;
        this.userRating = this.prefs.getRating(this.food.id);
        this.loadRelated(this.food.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    })
   }

  ngOnInit(): void {
  }

  private loadRelated(currentId: string): void {
    this.foodService.getAll().subscribe((all) => {
      const others = all.filter((f) => f.id !== currentId);
      // shuffle (Fisher–Yates) then take a few
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      this.related = others.slice(0, 4);
    });
  }

  salePrice(food: Food): number {
    return food.price * (1 - (food.discount || 0) / 100);
  }

  toggleFavorite(){
    this.food.favorite = this.prefs.toggleFavorite(this.food.id);
  }

  onRate(stars: number){
    this.prefs.setRating(this.food.id, stars);
    this.userRating = stars;
    this.toastr.success(`You rated ${this.food.name} ${stars} star${stars > 1 ? 's' : ''}!`);
  }

  addToCart(){
    const item = { ...this.food } as Food;
    if (this.food.discount) {
      item.price = Math.round(this.food.price * (1 - this.food.discount / 100) * 100) / 100;
    }
    this.cartService.addToCart(item);
    this.router.navigateByUrl('/cart-page');
  }
}
