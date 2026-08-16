# LoottaTech

Affordable new and second-hand electronics. Three parts:

```
Customer Angular (:4200)  ─┐
                           ├─→  ASP.NET Core API (:5197)  →  SQL Server
Admin Angular    (:4300)  ─┘
```

Angular never touches the database. Only the API does.

---

## Running it

Three terminals, each left open. **Start the API first.**

```bash
# 1 — API
cd API/lootta/lootta
dotnet run
```

```bash
# 2 — customer site
cd loottatech
npm run dev
```

```bash
# 3 — admin site
cd loottaAdmin
npm start
```

| | |
| --- | --- |
| Customer | http://localhost:4200 |
| Admin | http://localhost:4300 |
| API docs | http://localhost:5197/swagger |

First run only: `npm install` in `loottatech/frontend` and `loottaAdmin`.

The database is created and seeded automatically on first start — 9 categories,
10 products, and two accounts.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@loottatech.com` | `Admin123` |
| Customer | `dara@gmail.com` | `Dara123` |

> Change the admin password before deploying anywhere. It is in this file, so
> it is not a secret.

---

## Testing the whole system in 5 minutes

**1. Shop as a customer**

Open http://localhost:4200 → add a product to the cart → checkout →
you get an order number like `LT-7K3QA2`.

**2. See it as the admin**

Open http://localhost:4300 → the order appears within 10 seconds, on its own.
Change its status; the customer's tracker updates.

**3. Change a price**

Admin → Products → edit → save. Refresh the customer site: the new price is
there. One database, two apps.

---

## Testing the arcade

The arcade is a gacha loop with a real coin sink:

```
spend $1  →  earn coins  →  PAY coins to play  →  win coins  →  buy vouchers
```

Plays per day are earned by buying, so nothing can be farmed for free. That
makes it awkward to test — which is what the admin tools below are for.

### Give yourself plays and coins

Sign in to Swagger as the admin first (see **Using Swagger** below), then:

`POST /api/Rewards/admin/grant`

```json
{
  "userId": 2,
  "coins": 5000,
  "plays": 999,
  "reason": "testing"
}
```

Now open the customer site → **Arcade** → you can play 999 rounds without
buying anything. Bonus plays are a finite pool, not a daily refill.

### Generate a promo voucher

`POST /api/Rewards/admin/generate`

```json
{
  "value": 5,
  "minSpend": 20,
  "expiryDays": 30,
  "count": 1
}
```

Leave `userId` out and the code works for **anyone** — paste it at checkout to
see the discount applied. Set `userId` and it belongs to that customer only.

### Retune the economy

`PUT /api/Config` changes every number live — no rebuild, no restart:

| Setting | Default | What it does |
| --- | --- | --- |
| `coinsPerDollar` | 40 | Coins earned per $1 spent |
| `playCost` | 50 | Coins deducted per round |
| `flyerCoinsPerPoint` | 8 | Coins per shelf passed |
| `coinsPerVoucherDollar` | 300 | Coins per $1 of voucher value |
| `bronzePlays` / `silverPlays` / `goldPlays` | 1 / 2 / 4 | Daily plays per tier |

Set `playCost` to 0 and every round is free — handy while testing the games.

---

## Managing accounts

All of these need an admin token.

| Action | Endpoint |
| --- | --- |
| Create an admin | `POST /api/Auth/admin` |
| List / search accounts | `GET /api/Auth/users?search=dara` |
| One customer in full | `GET /api/Auth/users/{id}` |
| Change your own password | `PUT /api/Auth/password` |
| Reset someone's password | `PUT /api/Auth/users/{id}/password` |
| Promote or demote | `PUT /api/Auth/users/{id}/role` |
| Disable an account | `PUT /api/Auth/users/{id}/active?value=false` |

Registration always creates a **Customer** — `RegisterDto` has no role field at
all, so nobody can promote themselves by editing the request. The first admin
exists only because the seeder creates it.

You cannot demote or disable **your own** account; that guard exists so one
wrong click can't lock you out.

---

## Using Swagger

Protected endpoints need a token.

1. `POST /api/Auth/login` → **Try it out** → use the admin credentials → **Execute**
2. Copy the `token` value from the response (long, starts with `eyJ`)
3. Click **Authorize** at the top of the page, paste it, **Authorize**, **Close**
4. The padlocks close and protected endpoints now work

Swagger forgets the token when the page reloads. Tokens last 7 days.

**Worth demonstrating:** call `DELETE /api/Products/1` with no token (401), then
with a customer token (403), then with an admin token (works). Three outcomes,
all decided by the server.

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
