import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import express from 'express';
import cors from 'cors';
import productRouter from './routers/product.router';
import userRouter from './routers/user.router';
import orderRouter from './routers/order.router';
import { dbConnect } from './configs/database.config';

dbConnect();

const app = express();

// Product images are base64-free now, but spec tables and descriptions
// still make for chunky payloads — 5mb is comfortable headroom.
app.use(express.json({ limit: '5mb' }));

app.use(
  cors({
    credentials: true,
    origin: true,
  }),
);

app.use('/api/products', productRouter);
app.use('/api/users', userRouter);
app.use('/api/orders', orderRouter);

// Admin-uploaded product photos are written to disk, not into MongoDB.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(express.static('public'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log('LoottaTech API on http://localhost:' + port);
});
