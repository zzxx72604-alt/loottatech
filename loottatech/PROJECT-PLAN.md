# LoottaTech — Midterm Build Plan (final)

**What it is:** a second-hand electronics store. One shop, best low prices.
Xianyu (闲鱼) visual style, scaled down.

**Stack:** Angular 20 standalone frontend (new) + your existing Express + TypeScript +
MongoDB backend (reused).

**Deadline:** ~10 working days.

---

## The real rubric

Your professor's class log *is* the grading criteria. He is checking whether you used
what he taught. Every topic below must appear somewhere real in the app — not in a
demo page, in an actual working feature.

### Concept → where it lives

| # | He taught | Where it lives in LoottaTech | Why it fits naturally |
| --- | --- | --- | --- |
| 1 | Standalone + `app.config.ts` | The entire app | No NgModules anywhere |
| 2 | `@Output` + `EventEmitter` | `ProductCard` emits `addToCart` and `toggleFavorite` up to the grid | Card is dumb, parent owns state |
| 3 | `@defer` | Related products (`on viewport`), full spec sheet (`on interaction`), gacha wheel (`on idle`) | This *is* your "smooth, no lag" requirement |
| 4 | `ngSrc` + `srcset` + `sizes` + webp | Every product image | Fixes the biggest mobile lag source |
| 5 | Template-driven form | Login page | Small form, `ngModel` + `#ngForm` is the right tool |
| 6 | Reactive form + `FormArray` + custom validator | Admin product form (**specs as FormArray**) + register (password strength) | See note below |
| 7 | `signal()` state service | `CartService`, `ThemeService`, `FavoritesService` | Cart badge updates everywhere instantly |
| 8 | **NgRx** store/actions/reducer/selectors | Catalog filters + coins & gacha | Real shared state, not a toy counter |
| 9 | `HttpClient` CRUD service | `ApiService` → products, orders, auth | Straight from his `api.service.ts` |
| 10 | `OnPush` + `ChangeDetectorRef` | Product list/grid | Where re-render cost actually matters |

**The FormArray detail matters.** Second-hand electronics have *variable* specs — a
phone has storage and battery health, a laptop has RAM and CPU. So the admin form
needs a dynamic "add spec" row list. That is exactly his `phones` FormArray example,
applied to something real instead of a demo. Point this out in your presentation.

---

## Data model

```ts
Product {
  title, brand, category,
  condition: 'new' | 'like-new' | 'good' | 'fair',
  price, originalPrice,
  images: string[],                    // file paths, NOT base64
  specs: { key: string, value: string }[],   // ← the FormArray
  stock, warrantyMonths, tested: boolean, wantCount
}

User   { name, email, password, role: 'customer'|'admin', coins }
Order  { user, items, totalPrice, address, status, coupon? }
Coupon { code, user, type, value, minSpend, expiresAt, usedAt }
```

`condition` is the heart of a second-hand store — it mirrors Xianyu's 全新 / 几乎全新
badges directly, and it's what justifies the low price next to the strikethrough
original.

**Categories:** Phones · Laptops · Tablets · Cameras · Audio · Gaming · Wearables ·
Components · Accessories · Drones

---

## Xianyu design, translated

| Xianyu | LoottaTech |
| --- | --- |
| Yellow header + fat search bar | Same, keep the yellow |
| Left category list (手机/数码/电脑…) | The 10 categories above |
| Chip row (猜你喜欢 / 个人闲置…) | All · Under $50 · Like New · Tested · On Sale |
| Dense card grid, 5 across | CSS Grid `auto-fill, minmax(180px,1fr)` → 2 phone / 3 tablet / 5 desktop |
| ¥368 big orange, ¥929 struck through | Same, in dollars |
| 15人想要 ("15 people want") | "12 people watching" |
| 卖家信用优秀 (seller credit) badge | **"Tested ✓"** / warranty badge |
| 几乎全新 (almost new) | The `condition` badge |

Information-dense, restrained, fast. No decoration that costs a frame.

---

## Fun feature: Coins & Gacha — built on NgRx

Deliberately built with NgRx rather than a signal service, because your professor
spent a class on NgRx and needs to see it applied to real state.

- `rewards.actions.ts` — `spin`, `spinSuccess`, `spinFailure`, `loadCoins`
- `rewards.reducer.ts` — coins, spinning flag, last prize, coupon list
- `rewards.effects.ts` — calls `POST /api/rewards/spin`
- `rewards.selectors.ts` — `selectCoins`, `selectIsSpinning`

**Server decides the prize.** The API picks from a weighted table, deducts coins,
creates the coupon, returns the result. The wheel animates *to an outcome it was
already given* — so it can't be cheated from DevTools, and coin deduction can't be
double-spent. Animation is pure CSS `transform` → GPU-composited, 60fps on a cheap phone.

Coins earned: 1 per $1 on delivered orders. Spin costs 10.

| Prize | Weight |
| --- | --- |
| 5% off | 35 |
| 10% off | 25 |
| $2 off | 20 |
| Free delivery | 12 |
| 25% off | 6 |
| Free accessory | 2 |

---

## Smoothness — and how it doubles as marks

Every item here is also a graded topic. That's the point.

1. `@defer (on viewport)` for anything below the fold → **graded topic 3**
2. `ngSrc` + `srcset` + webp → **graded topic 4**
3. `OnPush` + `trackBy` on the grid → **graded topic 10**
4. Lazy routes via `loadComponent` → **graded topic 1**
5. Skeletons live in `@placeholder` / `@loading` blocks — never a spinner
6. Animate only `transform` and `opacity`
7. Debounce search 250ms
8. Respect `prefers-reduced-motion` (3 lines, free accessibility marks)

---

## Day-by-day

| Day | Work | Done when |
| --- | --- | --- |
| **1** | `ng new` Angular 20 standalone. `app.config.ts`, `app.routes.ts`, proxy to backend, `ApiService`, header/footer shell | Frontend loads and hits the old backend |
| **2** | Backend: `Food` → `Product` schema, seed ~30 electronics, product CRUD routes | `/api/products` returns real data |
| **3** | Xianyu UI: header, search, category sidebar, chip row, grid + `ProductCard` (`@Output`, `ngSrc`, `OnPush`) | Grid correct at 360px and 1440px |
| **4** | NgRx catalog store: filter / sort / search actions, reducer, selectors | Filters change URL-free state via dispatch |
| **5** | Product detail page + `@defer` on related products, specs, reviews | Nothing below the fold loads early |
| **6** | Login (**template-driven**), Register (**reactive + custom password validator**), guards, JWT | Both form styles working, both graded |
| **7** | Cart + favorites as **signal services**, checkout reactive form | Cart badge updates instantly everywhere |
| **8** | Admin: separate `/admin` login, product form with **specs FormArray**, image upload to disk | Add a laptop with 6 spec rows |
| **9** | Coins + gacha through NgRx, coupon applied at checkout | Spin → coupon → discount, end to end |
| **10** | Buffer, seed data, README, `ARCHITECTURE.md`, test on your real phone | No jank on a real device |

**Cut order if you slip:** reviews → drone/component categories → gacha wheel becomes
a scratch card (same backend, far less frontend) → admin image upload becomes a URL field.

**Never cut:** Days 1, 3, 4, 6. Those carry six of the ten graded topics.

---

## Backend changes (small — this is why we keep it)

- `food.model.ts` → `product.model.ts` with the fields above
- `food.router.ts` → `product.router.ts`, same shape
- `isAdmin: boolean` → `role: 'customer' | 'admin'` + `coins: number`
- New: `coupon.model.ts`, `rewards.router.ts`
- Images written to `/uploads` on disk, path stored — **stop putting base64 in MongoDB**
- Delete or `NODE_ENV`-gate the `makeAdmin` / `setPassword` dev routes before you submit

---

## Cheap marks

- `ARCHITECTURE.md` — one sentence per folder
- Meaningful commit messages; git history reads as code quality
- A short section in the README listing **which taught topic lives in which file**.
  Make it impossible for him to miss that you used all ten.

---

## Appendix — the C# / ASP.NET Core question

**Decision: ship the midterm on Express. Build the C# API afterwards.**
Not because Express is better, but because 2–3 of your 8 remaining days belong to
the ten graded Angular topics, and none of those topics care what language the
backend is written in.

### What already makes the swap cheap

Every HTTP call in the app goes through one class, `core/services/api.service.ts`,
and that class reads its base path from `environments/environment.ts`. No component,
no feature service and no template knows a backend exists. To point Angular at an
ASP.NET Core API you change:

1. `proxy.conf.json` → `"target": "http://localhost:5165"`
2. nothing else

That is the whole swap — *provided the JSON shape matches*.

### The contract-first trick — do this on Day 10

Write an **OpenAPI 3 spec** for the API and serve it with `swagger-ui-express`.
Half a day, and it pays three times:

- You get the interactive Swagger docs page to show your professor **now**.
- The spec becomes the *contract*. Your C# API is then not a rewrite from memory —
  it is "make this spec true."
- `openapi-generator-cli generate -g aspnetcore` scaffolds the C# controllers and
  models straight from it, so you start from working stubs instead of a blank file.

Then the portfolio piece writes itself: **one Angular frontend, two backends, one
line of config between them.** That demonstrates something most student projects
cannot — that the frontend is genuinely decoupled.

### Design gotchas when Mongo becomes SQL Server

Document shapes do not map cleanly onto tables. You will hit these:

| MongoDB (now) | EF Core / SQL Server (later) |
| --- | --- |
| `specs: [{ key, value }]` embedded array | child table `ProductSpec`, or a JSON column |
| `images: string[]` | child table `ProductImage`, or a JSON column |
| `_id` ObjectId, exposed as virtual `id` string | `int` or `Guid` — **serialize it as a string named `id`** |
| Mongoose `timestamps: true` | `CreatedAt` / `UpdatedAt` columns you maintain yourself |

The important one is the third. If C# starts returning `"id": 7` as a number while
Angular's `Product.id` is typed `string`, you get silent routing bugs. Keep `id` a
string in the JSON on both sides and the frontend never notices the change.

Alternatively skip EF Core and use the **MongoDB.Driver** NuGet package from C# —
then the data model stays identical and only the language changes. Less to relearn,
and the swap becomes almost purely mechanical.
