import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ToastrService } from 'ngx-toastr';
import { ConfirmService } from 'src/app/services/confirm.service';
import { FoodService } from 'src/app/services/food.service';
import { Food } from 'src/app/shared/models/Food';

type SortMode = 'manual' | 'priceAsc' | 'priceDesc';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  foods: Food[] = [];
  form!: FormGroup;
  editingId: string | null = null;

  sortMode: SortMode = 'manual';
  discountedOnly = false;
  sortOptions = [
    { value: 'manual', label: 'Manual order' },
    { value: 'priceAsc', label: 'Price: Low → High' },
    { value: 'priceDesc', label: 'Price: High → Low' },
  ];

  constructor(
    private fb: FormBuilder,
    private foodService: FoodService,
    private confirmService: ConfirmService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.load();
  }

  buildForm(food?: Food): void {
    this.form = this.fb.group({
      name: [food?.name || '', Validators.required],
      price: [food?.price ?? 0, [Validators.required, Validators.min(0)]],
      discount: [food?.discount ?? 0, [Validators.min(0), Validators.max(90)]],
      cookTime: [food?.cookTime || '', Validators.required],
      stars: [food?.stars ?? 0, [Validators.required, Validators.min(0), Validators.max(5)]],
      imageUrl: [food?.imageUrl || '', Validators.required],
      tags: [food?.tags?.join(', ') || ''],
      origins: [food?.origins?.join(', ') || ''],
      favorite: [food?.favorite || false],
    });
  }

  get f() {
    return this.form.controls;
  }

  load(): void {
    this.foodService.getAll().subscribe((foods) => (this.foods = foods));
  }

  // ----- pricing helpers -----
  salePrice(food: Food): number {
    return food.price * (1 - (food.discount || 0) / 100);
  }

  // ----- list view (sort + filter) -----
  get displayedFoods(): Food[] {
    let list = [...this.foods];
    if (this.discountedOnly) list = list.filter((f) => (f.discount || 0) > 0);
    if (this.sortMode === 'priceAsc') list.sort((a, b) => this.salePrice(a) - this.salePrice(b));
    else if (this.sortMode === 'priceDesc') list.sort((a, b) => this.salePrice(b) - this.salePrice(a));
    return list;
  }

  // ----- reorder (manual) -----
  move(food: Food, dir: number): void {
    const i = this.foods.findIndex((f) => f.id === food.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.foods.length) return;
    [this.foods[i], this.foods[j]] = [this.foods[j], this.foods[i]];
    this.persistOrder();
  }

  onSort(value: string): void {
    this.sortMode = value as SortMode;
  }

  drop(event: CdkDragDrop<Food[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.foods, event.previousIndex, event.currentIndex);
    this.persistOrder();
  }

  private persistOrder(): void {
    this.foods.forEach((f, idx) => (f.sortOrder = idx));
    const items = this.foods.map((f, idx) => ({ id: f.id, sortOrder: idx }));
    this.foodService.reorderFoods(items).subscribe({
      error: () => this.toastr.error('Could not save the new order', 'Error'),
    });
  }

  // ----- form actions -----
  edit(food: Food): void {
    this.editingId = food.id;
    this.buildForm(food);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  newFood(): void {
    this.editingId = null;
    this.buildForm();
  }

  get imagePreview(): string {
    return this.form?.get('imageUrl')?.value || '';
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toastr.error('Please choose an image file.', 'Invalid file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.toastr.warning('Image is larger than 2MB; consider a smaller one.', 'Large image');
    }
    const reader = new FileReader();
    reader.onload = () => this.form.patchValue({ imageUrl: reader.result as string });
    reader.readAsDataURL(file);
    input.value = '';
  }

  private toList(value: string): string[] {
    return value ? value.split(',').map((t) => t.trim()).filter((t) => !!t) : [];
  }

  save(): void {
    if (this.form.invalid) {
      this.toastr.warning('Please fill in all required fields.', 'Invalid');
      return;
    }
    const v = this.form.value;
    const food: any = {
      name: v.name,
      price: +v.price,
      discount: +v.discount || 0,
      cookTime: v.cookTime,
      stars: +v.stars,
      imageUrl: v.imageUrl,
      favorite: v.favorite,
      tags: this.toList(v.tags),
      origins: this.toList(v.origins),
    };

    if (this.editingId) {
      food.id = this.editingId;
      this.foodService.updateFood(food).subscribe(() => {
        this.toastr.success(`${food.name} updated`, 'Saved');
        this.newFood();
        this.load();
      });
    } else {
      this.foodService.createFood(food).subscribe(() => {
        this.toastr.success(`${food.name} added to the menu`, 'Created');
        this.newFood();
        this.load();
      });
    }
  }

  async remove(food: Food): Promise<void> {
    const ok = await this.confirmService.ask(
      `"${food.name}" will be removed from the menu.`,
      { title: 'Delete item?', confirmText: 'Delete', danger: true }
    );
    if (!ok) return;
    this.foodService.deleteFood(food.id).subscribe(() => {
      this.toastr.success('Item deleted', 'Done');
      this.foods = this.foods.filter((x) => x.id !== food.id);
      if (this.editingId === food.id) this.newFood();
    });
  }
}
