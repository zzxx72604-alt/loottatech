import { Router } from 'express';
import { sample_foods, sample_tags } from '../data';
import asyncHandler from 'express-async-handler';
import { FoodModel } from '../models/food.model';
import auth from '../middlewares/auth.mid';
import admin from '../middlewares/admin.mid';
const router = Router();

router.get(
  '/seed',
  asyncHandler(async (req, res) => {
    const force = req.query.force === 'true';
    const foodsCount = await FoodModel.countDocuments();

    if (foodsCount > 0 && !force) {
      res.send(
        'Seed is already done! Add ?force=true to reload the menu (e.g. /api/foods/seed?force=true).'
      );
      return;
    }

    await FoodModel.deleteMany({});
    await FoodModel.create(sample_foods);
    res.send(`Seed Is Done! Reloaded ${sample_foods.length} items.`);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const foods = await FoodModel.find().sort({ sortOrder: 1, createdAt: -1 });
    res.send(foods);
  })
);

router.get(
  '/search/:searchTerm',
  asyncHandler(async (req, res) => {
    const searchRegex = new RegExp(req.params.searchTerm, 'i');
    const foods = await FoodModel.find({ name: { $regex: searchRegex } })
      .sort({ sortOrder: 1, createdAt: -1 });
    res.send(foods);
  })
);

router.get(
  '/tags',
  asyncHandler(async (req, res) => {
    const tags = await FoodModel.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $project: { _id: 0, name: '$_id', count: '$count' } },
    ]).sort({ count: -1 });

    const all = {
      name: 'All',
      count: await FoodModel.countDocuments(),
    };

    tags.unshift(all);
    res.send(tags);
  })
);

router.get(
  '/tag/:tagName',
  asyncHandler(async (req, res) => {
    const foods = await FoodModel.find({ tags: req.params.tagName })
      .sort({ sortOrder: 1, createdAt: -1 });
    res.send(foods);
  })
);

// ---------- Admin-only menu management ----------
router.post(
  '/',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    const { name, price, tags, favorite, stars, imageUrl, origins, cookTime, discount } = req.body;

    // New items go to the top of the list.
    const top = await FoodModel.findOne().sort({ sortOrder: 1 });
    const sortOrder = top ? (top.sortOrder || 0) - 1 : 0;

    const food = await FoodModel.create({
      name, price, tags, favorite, stars, imageUrl, origins, cookTime,
      discount: discount || 0,
      sortOrder,
    });
    res.send(food);
  })
);

router.put(
  '/',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    const { id, name, price, tags, favorite, stars, imageUrl, origins, cookTime, discount } = req.body;
    await FoodModel.updateOne(
      { _id: id },
      { name, price, tags, favorite, stars, imageUrl, origins, cookTime, discount: discount || 0 }
    );
    res.send();
  })
);

// Bulk reorder: body { items: [{ id, sortOrder }] }
router.put(
  '/reorder',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    const items: { id: string; sortOrder: number }[] = req.body.items || [];
    await Promise.all(
      items.map((it) => FoodModel.updateOne({ _id: it.id }, { sortOrder: it.sortOrder }))
    );
    res.send('Order saved');
  })
);

router.delete(
  '/:foodId',
  auth,
  admin,
  asyncHandler(async (req, res) => {
    await FoodModel.deleteOne({ _id: req.params.foodId });
    res.send();
  })
);

router.get(
  '/:foodId',
  asyncHandler(async (req, res) => {
    const food = await FoodModel.findById(req.params.foodId);
    res.send(food);
  })
);

export default router;
