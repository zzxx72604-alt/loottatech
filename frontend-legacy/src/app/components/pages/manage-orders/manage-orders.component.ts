import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ConfirmService } from 'src/app/services/confirm.service';
import { OrderService } from 'src/app/services/order.service';
import { Order } from 'src/app/shared/models/Order';

@Component({
  selector: 'app-manage-orders',
  templateUrl: './manage-orders.component.html',
  styleUrls: ['./manage-orders.component.css'],
})
export class ManageOrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;

  constructor(
    private orderService: OrderService,
    private confirmService: ConfirmService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.orderService.getAllOrders().subscribe({
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

  async complete(order: Order): Promise<void> {
    const ok = await this.confirmService.ask(
      `Mark order for "${order.name}" as delivered?`,
      { title: 'Complete order?', confirmText: 'Mark delivered' }
    );
    if (!ok) return;
    this.orderService.completeOrder(order.id.toString()).subscribe({
      next: () => {
        order.status = 'DELIVERED';
        this.toastr.success('Order marked as delivered', 'Done');
      },
      error: () => this.toastr.error('Could not update order', 'Error'),
    });
  }
}
