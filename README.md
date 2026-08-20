# LoottaTech

> **Marking this project? Start here.** Everything below is a five-minute
> walkthrough. You do not need to install SQL Server, edit a config file, or
> read any code to see it working.

## For the examiner — read this first

### 1. Start it

Double-click **`START.bat`** in this folder. Wait about 30 seconds.

It checks .NET and Node are present, installs packages the first time, opens
three windows and then opens two browser tabs for you.

| What | Address |
| --- | --- |
| Customer shop | http://localhost:4200 |
| Admin site | http://localhost:4300 |
| API documentation | http://localhost:5197/swagger |

**No SQL Server?** It still runs. The API tries SQL Server, and if it cannot
reach one it creates a SQLite file next to itself instead. Nothing to install
and nothing to configure — the console prints which one it chose.

When you are finished, close the three windows, or run `STOP.bat`.

### 2. Sign in

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@loottatech.com` | `Admin123` |
| Customer | `dara@gmail.com` | `Dara123` |

These are demonstration accounts published in this file, so they are not
secrets. A real deployment would change them.

### 3. Things worth trying, in order

Each takes under a minute and shows a different part of the system.

**Search that tolerates typos** — customer site, click the search box.
With nothing typed it shows a trending list ranked by how many people are
watching each item. Type `ipho` and the matched letters are highlighted in the
suggestions. Now type `xioa` — deliberately misspelled — and Xiaomi still
comes back. That is Levenshtein edit distance running in the browser, so there
is no request per keystroke.

**Buy something** — add an item to the cart, check out, choose a payment
method. You get an order number like `LT-7K3QA2`.

> No money moves. The order records how the customer *intends* to pay — by bank,
> card or wallet — and the shop collects before the parcel leaves. There is no
> payment provider connected, and the project does not pretend otherwise.
> Cash on delivery is deliberately not offered: every item is guaranteed, and a
> refund needs something to give back.

**Watch the admin notice** — open the admin site. The order appears on its own
within ten seconds. Change its status and the customer's tracker follows.

**Ask for a refund** — on the order page, sign in as the buyer and click
**Request a refund**. The request lands on the admin's Orders page as a badge
with the customer's words behind **Details**; **Refund** approves it and
**Decline** turns it down. Approving cancels the order, puts the items back
into stock and takes back the coins it paid out — the customer gets a
notification either way. Nothing about it is automatic: a person decides.

**Edit the shop without touching code** — admin → **Store**. Add a shortcut to
the tag row, rename a category, change the home page headline, or switch a
payment method off. Reload the customer site: it is there. None of that text
lives in the Angular code.

**Try to break a rule** — in admin → Store → Categories, try deleting a
category that still holds products. The API refuses and says why. Same for
turning off every payment method at once.

**Check the privacy handling** — copy an order number and open
`http://localhost:5197/api/orders/number/LT-XXXXXX` in a private window.
You get the status and items, but the name is cut to `Dara K.`, the phone to
`0***-3457` and the address to `••• Phnom Penh`. Guest customers can track a
parcel without an account, but an order code alone is not proof of identity.
Sign in as the buyer and the same endpoint returns everything.

**Hover the avatar** — the account card only requests the profile the first
time you hover it, not on every page load.

**The arcade** — customer site → the coin icon. Coins are earned by spending
and paid to play. Prizes are decided by the server, never the browser.

### 4. Where the code is

| Looking for | Path |
| --- | --- |
| API endpoints | `API/lootta/lootta/Controllers/` |
| Database tables | `API/lootta/lootta/Models/` |
| Demo data | `API/lootta/lootta/seed-data.json` |
| Customer pages | `loottatech/frontend/src/app/features/` |
| Admin pages | `loottaAdmin/src/app/features/` |

The demo shop is a **JSON file**, not code. Edit `seed-data.json`, delete the
database, restart — a different shop, with no rebuild.

### 5. If something goes wrong

| Message | Cause | Fix |
| --- | --- | --- |
| `Invalid object name '...'` | Database is older than the code | `cd API/lootta/lootta` then `dotnet ef database update` |
| `Cannot reach the shop` on the site | API window closed | Restart it, or run `START.bat` again |
| `npm.ps1 cannot be loaded` | PowerShell blocks scripts by default | Use `START.bat`, which runs in CMD |
| Port already in use | A previous run is still going | Run `STOP.bat` |

---

Affordable new and second-hand electronics. Three parts:

```
Customer Angular (:4200)  ─┐
                           ├─→  ASP.NET Core API (:5197)  →  SQL Server
Admin Angular    (:4300)  ─┘
```

Angular never touches the database. Only the API does.

---

## Running it — more detail

Double-click **`START.bat`**.

It checks that .NET and Node are installed, runs `npm install` on first use,
opens the API and both websites in their own windows, and then opens the two
browser tabs for you.

`STOP.bat` frees the ports if a window was closed badly.

> The batch file runs in CMD rather than PowerShell on purpose. A fresh Windows
> install blocks `npm.ps1` by default, which looks like a broken project when it
> is only a security setting.

---

## Running it manually

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

### Demo accounts (repeated from the top)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@loottatech.com` | `Admin123` |
| Customer | `dara@gmail.com` | `Dara123` |

> Change the admin password before deploying anywhere. It is in this file, so
> it is not a secret.

---

## Customer to admin, step by step

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
