import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { verify } from 'jsonwebtoken';
import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from '../constants/http_status';
import { DELIVERY_FEE, DeliveryOption, OrderStatus } from '../constants/order_status';
import { OrderModel, makeOrderNumber } from '../models/order.model';
import { ProductModel } from '../models/product.model';
import auth from '../middlewares/auth.mid';
import admin from '../middlewares/admin.mid';

const router = Router();

/**
 * Reads the JWT if one was sent, but never rejects the request.
 *
 * Checkout is open to guests, yet a signed-in customer should still get the
 * order attached to their account. So we attach the user when we can and
 * carry on when we can't.
 */
function optionalAuth(req: any, _res: any, next: any) {
  const token = req.headers.access_token as string;
  if (token) {
    try {
      req.user = verify(token, process.env.JWT_SECRET!);
    } catch {
      // An invalid token is treated as "not signed in", not as an error.
    }
  }
  next();
}

/* ------------------------------------------------------------ create ---- */

router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req: any, res: any) => {
    const { items, customerName, phone, address, deliveryOption, note } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(HTTP_BAD_REQUEST).send('Your cart is empty.');
      return;
    }
    if (!customerName || !phone || !address) {
      res.status(HTTP_BAD_REQUEST).send('Name, phone and address are required.');
      return;
    }

    /*
     * Prices are recalculated from the DATABASE, never trusted from the
     * request body. Otherwise anyone could POST a $1 total for a $319 laptop.
     */
    let subtotal = 0;
    const lines = [];

    for (const line of items) {
      const product = await ProductModel.findById(line.productId);
      if (!product) {
        res.status(HTTP_BAD_REQUEST).send(`Product no longer available: ${line.productId}`);
        return;
      }

      const quantity = Math.max(1, Math.min(Number(line.quantity) || 1, product.stock));
      subtotal += product.price * quantity;

      lines.push({
        productId: String(product.id),
        title: product.title,
        image: product.images[0],
        condition: product.condition,
        price: product.price,
        quantity,
      });
    }

    const option: DeliveryOption = Object.values(DeliveryOption).includes(deliveryOption)
      ? deliveryOption
      : DeliveryOption.STANDARD;
    const deliveryFee = DELIVERY_FEE[option];

    const order = await OrderModel.create({
      orderNumber: makeOrderNumber(),
      items: lines,
      subtotal,
      deliveryFee,
      discount: 0,
      totalPrice: subtotal + deliveryFee,
      customerName,
      phone,
      address,
      deliveryOption: option,
      note: note ?? '',
      user: req.user?.id,
      status: OrderStatus.PENDING,
    });

    // Reduce stock so the same second-hand unit can't be sold twice.
    for (const line of lines) {
      await ProductModel.updateOne({ _id: line.productId }, { $inc: { stock: -line.quantity } });
    }

    res.send(order);
  }),
);

/* -------------------------------------------------------------- read ---- */

/** Orders belonging to the signed-in customer. */
router.get(
  '/mine',
  auth,
  asyncHandler(async (req: any, res) => {
    const orders = await OrderModel.find({ user: req.user.id, archived: { $ne: true } }).sort({
      createdAt: -1,
    });
    res.send(orders);
  }),
);

/** Admin: every order. Must come before /:id so it isn't read as an id. */
router.get(
  '/all',
  auth,
  admin,
  asyncHandler(async (_req, res) => {
    const orders = await OrderModel.find({ archived: { $ne: true } }).sort({ createdAt: -1 });
    res.send(orders);
  }),
);

/** Look up one order. Guests use the order number from their receipt. */
router.get(
  '/number/:orderNumber',
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findOne({ orderNumber: req.params.orderNumber.toUpperCase() });
    if (!order) {
      res.status(HTTP_NOT_FOUND).send('Order not found.');
      return;
    }
    res.send(order);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      res.status(HTTP_NOT_FOUND).send('Order not found.');
      return;
    }
    res.send(order);
  }),
);

/* ------------------------------------------------------------ update ---- */

/** Admin: move an order along the status flow. */
router.put(
  '/:id/status',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      res.status(HTTP_BAD_REQUEST).send(`Unknown status: ${status}`);
      return;
    }

    const order = await OrderModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!order) {
      res.status(HTTP_NOT_FOUND).send('Order not found.');
      return;
    }
    res.send(order);
  }),
);

export default router;
