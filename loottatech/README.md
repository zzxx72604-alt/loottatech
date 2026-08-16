# LoottaTech

A second-hand electronics store — tested phones, laptops, wearables and accessories
at the best low price. Xianyu-style dense catalogue, built as a Web III midterm project.

**Stack:** Angular 20 (standalone, signals, NgRx) · Express + TypeScript · MongoDB

---

## First run

```bash
cd loottafood
npm install          # installs root + frontend + backend
```

Make sure MongoDB is running, and that `backend/src/.env` exists:

```env
MONGO_URI=mongodb://localhost:27017/loottatech
JWT_SECRET=change-me-to-a-long-random-string
PORT=5000
```

Then start both servers with one command:

```bash
npm run dev          # API on :5000, frontend on :4200
```

Open **http://localhost:4200**.

### Seed the data (first run only)

Visit these once in the browser:

- `http://localhost:5000/api/products/seed` — loads the 10-item catalogue
- `http://localhost:5000/api/users/seed` — creates the sample accounts

Reload the catalogue after editing `backend/src/data/products.ts`:
`http://localhost:5000/api/products/seed?force=true`

### Sample accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@loottatech.com` | `12345` |
| Customer | `dara@gmail.com` | `12345` |

---

## Project layout

```
loottafood/
├── frontend/            Angular 20, standalone — no NgModules anywhere
│   ├── public/products/ product photos at 480w/800w webp + jpg fallback
│   └── src/app/
│       ├── core/        singleton services (api, product, cart, theme)
│       ├── shared/      models, pipes, reusable dumb components
│       ├── layout/      header, footer
│       └── features/    one lazy-loaded folder per page
├── backend/             Express + TypeScript + Mongoose
│   └── src/
│       ├── models/      product, user, order
│       ├── routers/     product, user, order
│       ├── data/        seed catalogue + seed users
│       └── _legacy/     old food-app files, deleted before submission
└── frontend-legacy/     the previous Angular 16 app, kept for reference
```

---

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Whole catalogue |
| GET | `/api/products/seed` | Load sample products (`?force=true` to reload) |
| GET | `/api/products/search/:term` | Search title, brand and category |
| GET | `/api/products/categories` | Category list with counts |
| GET | `/api/products/category/:name` | Products in one category |
| GET | `/api/products/:id` | One product |
| POST | `/api/products` | Create (admin) |
| PUT | `/api/products/:id` | Update (admin) |
| DELETE | `/api/products/:id` | Delete (admin) |
| POST | `/api/users/login` | Log in |
| POST | `/api/users/register` | Register |
| GET | `/api/users/seed` | Create sample users |

---

## Images — adding your own product photos

Drop your photos into the **`image/`** folder, then run:

```bash
npm run images
```

That reads every photo in `image/` and writes three files per photo into
`frontend/public/products/`:

```
thinkpad-e14-1-480.webp    ~10 kB   phones
thinkpad-e14-1-800.webp    ~20 kB   tablet & desktop
thinkpad-e14-1.jpg         ~46 kB   fallback
```

**The filename becomes the image path.** So rename the photo before running:

| File you drop in `image/` | Path to use in the product |
| --- | --- |
| `iphone-13-1.jpg` | `/products/iphone-13-1` |
| `iphone-13-2.jpg` | `/products/iphone-13-2` |

Use `-1`, `-2`, `-3` suffixes for multiple angles of the same item.

Then reference them in `backend/src/data/products.ts`:

```ts
images: ['/products/iphone-13-1', '/products/iphone-13-2'],
```

…and reload the catalogue with `/api/products/seed?force=true`.

MongoDB stores only the base path — the frontend appends the size, and the
browser picks from the `srcset`. Across the current catalogue that's **87% less
image data** than the originals (592 kB → 78 kB on a phone).

> Photos are never stored in the database as base64. Only the path is.

---

## Testing on a phone

`npm run dev` already binds the frontend to `0.0.0.0`. Find your machine's IPv4
(`ipconfig`) and open `http://YOUR-IP:4200` on a phone on the same Wi-Fi.
Everything runs through port 4200 — the dev server proxies `/api` to the backend,
so no CORS changes are needed.
