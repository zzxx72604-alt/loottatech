import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CartService } from 'src/app/services/cart.service';
import { OrderService } from 'src/app/services/order.service';
import { Order } from 'src/app/shared/models/Order';

interface PayMethod {
  id: string;
  name: string;
  short: string;
  color: string;
  note: string;
}

@Component({
  selector: 'payment-options',
  templateUrl: './payment-options.component.html',
  styleUrls: ['./payment-options.component.css'],
})
export class PaymentOptionsComponent {
  @Input()
  order!: Order;

  methods: PayMethod[] = [
    { id: 'ABA', name: 'ABA Pay', short: 'ABA', color: '#0072BC', note: 'ABA Mobile app' },
    { id: 'KHQR', name: 'KHQR', short: 'KH', color: '#E21F26', note: 'Scan with any bank' },
    { id: 'WING', name: 'Wing', short: 'W', color: '#00A94F', note: 'Wing Money' },
    { id: 'WECHAT', name: 'WeChat Pay', short: '微', color: '#07C160', note: '微信支付' },
    { id: 'ALIPAY', name: 'Alipay', short: '支', color: '#1677FF', note: '支付宝' },
    { id: 'ACLEDA', name: 'ACLEDA', short: 'AC', color: '#00529B', note: 'ACLEDA mobile' },
  ];

  selected?: PayMethod;
  reference = '';
  qrCells: boolean[] = [];
  processing = false;

  constructor(
    private orderService: OrderService,
    private cartService: CartService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  choose(m: PayMethod) {
    this.selected = m;
    this.reference = m.id + '-' + Date.now().toString().slice(-8);
    this.qrCells = this.makeQr();
  }

  cancel() {
    if (this.processing) return;
    this.selected = undefined;
  }

  private makeQr(): boolean[] {
    const cells: boolean[] = [];
    for (let i = 0; i < 441; i++) cells.push(Math.random() > 0.5);
    return cells;
  }

  confirm() {
    if (!this.selected || this.processing) return;
    this.processing = true;
    this.order.paymentId = this.reference;
    this.orderService.pay(this.order).subscribe({
      next: (orderId) => {
        this.cartService.clearCart();
        this.toastr.success(`Paid with ${this.selected!.name}`, 'Success');
        this.router.navigateByUrl('/track/' + orderId);
      },
      error: () => {
        this.processing = false;
        this.toastr.error('Payment Save Failed', 'Error');
      },
    });
  }
}
