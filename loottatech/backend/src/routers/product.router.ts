import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { sample_products } from '../data/products';
import { ProductModel } from '../models/product.model';
import auth from '../middlewares/auth.mid';
import admin from '../middlewares/admin.mid';

const router = Router();

/* ------------------------------------------------------------------ public */

router.get(
  '/seed',
  asyncHandler(async (req, res) => {
    const force = req.query.force === 'true';
    const count = await ProductModel.countDocuments();

    if (count > 0 && !force) {
      res.send(
        `Seed already done (${count} products). Add ?force=true to reload — /api/products/seed?force=true`,
      );
      return;
    }

    await ProductModel.deleteMany({});
    await ProductModel.create(sample_products);
    res.send(`Seed done. Loaded ${sample_products.length} products.`);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await ProductModel.find().sort({ sortOrder: 1, createdAt: -1 });
    res.send(products);
  }),
);

router.get(
  '/search/:searchTerm',
  asyncHandler(async (req, res) => {
    const regex = new RegExp(req.params.searchTerm, 'i');
    const products = await ProductModel.find({
      $or: [{ title: regex }, { brand: regex }, { category: regex }],
    }).sort({ sortOrder: 1, createdAt: -1 });
    res.send(products);
  }),
);

/** Category list with counts — feeds the sidebar. */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await ProductModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { _id: 0, name: '$_id', count: '$count' } },
      { $sort: { count: -1 } },
    ]);

    categories.unshift({ name: 'All', count: await ProductModel.countDocuments() });
    res.send(categories);
  }),
);

router.get(
  '/category/:name',
  asyncHandler(async (req, res) => {
    const products = await ProductModel.find({ category: req.params.name }).sort({
      sortOrder: 1,
      createdAt: -1,
    });
    res.send(products);
  }),
);

/* ------------------------------------------------------------ admin only */

router.post(
  '/',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    const top = await ProductModel.findOne().sort({ sortOrder: 1 });
    const sortOrder = top ? (top.sortOrder || 0) - 1 : 0;

    const product = await ProductModel.create({ ...req.body, sortOrder });
    res.send(product);
  }),
);

router.put(
  '/:productId',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    const product = await ProductModel.findByIdAndUpdate(req.params.productId, req.body, {
      new: true,
    });
    res.send(product);
  }),
);

router.delete(
  '/:productId',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    await ProductModel.deleteOne({ _id: req.params.productId });
    res.send();
  }),
);

/* Keep the wildcard LAST so it never swallows /seed, /search or /categories. */
router.get(
  '/:productId',
  asyncHandler(async (req, res) => {
    const product = await ProductModel.findById(req.params.productId);
    res.send(product);
  }),
);

export default router;
