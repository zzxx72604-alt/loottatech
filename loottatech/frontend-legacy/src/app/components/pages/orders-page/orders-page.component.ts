import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { take } from 'rxjs';
import { CartService } from 'src/app/services/cart.service';
import { ConfirmService } from 'src/app/services/confirm.service';
import { OrderService } from 'src/app/services/order.service';
import { Order } from 'src/app/shared/models/Order';

@Component({
  selector: 'app-orders-page',
  templateUrl: './orders-page.component.html',
  styleUrls: ['./orders-page.component.css'],
})
export class OrdersPageComponent implements OnInit {
  orders: Order[] = [];
  loading = true;

  constructor(
    private orderService: OrderService,
    private cartService: CartService,
    private confirmService: ConfirmService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.orderService.getAll().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  itemCount(order: Order): number {
    return order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
  }

  async reorder(order: Order): Promise<void> {
    const ok = await this.confirmService.ask(
      'These items will be added to your cart.',
      { title: 'Order again?', confirmText: 'Add to cart' }
    );
    if (!ok) return;

    order.items.forEach((item) => {
      this.cartService.addToCart(item.food);
      this.cartService.changeQuantity(item.food.id, item.quantity);
    });
    this.toastr.success('Items added to your cart', 'Re-order');
    this.router.navigateByUrl('/cart-page');
  }

  async remove(order: Order): Promise<void> {
    const ok = await this.confirmService.ask(
      'This order will be removed. You can undo right after.',
      { title: 'Delete order?', confirmText: 'Delete', danger: true }
    );
    if (!ok) return;

    this.orderService.deleteOrder(order.id.toString()).subscribe({
      next: () => {
        this.orders = this.orders.filter((o) => o.id !== order.id);
        const toast = this.toastr.info('Order deleted. Tap here to undo.', 'Deleted', {
          timeOut: 6000,
        });
        toast.onTap.pipe(take(1)).subscribe(() => this.undo(order));
      },
      error: () => this.toastr.error('Could not delete order', 'Error'),
    });
  }

  private undo(order: Order): void {
    this.orderService.restoreOrder(order.id.toString()).subscribe({
      next: () => {
        this.toastr.success('Order restored', 'Undo');
        this.load();
      },
      error: () => this.toastr.error('Could not restore order', 'Error'),
    });
  }
}
