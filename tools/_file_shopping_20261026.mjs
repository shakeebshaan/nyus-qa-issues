// 26 Oct 2026 (Governor 03:00 UTC): two cards found by dev while fixing the shopping list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'issues.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const IMG = 'images/2026-10-26-shopping-list/';
const COMMIT = process.argv[2];
if (!COMMIT) throw new Error('usage: node tools/_file_shopping_20261026.mjs <image-commit-sha>');
const common = 'Reproduced 26 Oct 2026 in the web build of app main (C:/tmp/qa-app-dist-p2, 390 x 844 at 2x, seeded Edge) with EVERY /api call answered locally: the 114 rows are MOCK data shaped like the real ones (base name + a 12-character code, quantity as a string), not the QA account. The live QA account could not be read: its saved login now answers 401 "Token has been revoked" on GET /auth/me and on GET /diet/shopping-list, and a fresh session needs Shaan\'s yes (ops/qa_mint_session.py). Nothing was written to prod. ';
const cards = [
  {
    id: 'i-20261026-shopping-list-duplicate-ingredient-rows',
    tags: ['shopping-list', 'diet', 'backend', 'p3'],
    route: 'app: src/components/nutrition/ShoppingListModal.tsx (name rendered as-is, :64) and src/pages/ShoppingList.tsx; backend: GET /api/v1/diet/shopping-list (backend.py:9311 aggregates on ingredient.name.lower()); cause: app/services/plan_generator.py:3427 (unique_name = food + uuid hex[:12])',
    images: ['shopping-list-modal-suffix-rows.png'],
    description: '[P3 / data shape + usability] ' + common + 'SYMPTOM (dev, on the QA account): the shopping list shows 114 separate rows, and each row carries a code in its name, e.g. "Tomato (Raw) 60b984a49095", so the same food appears many times and its quantities are never added up (the screenshot shows the Nutrition Shopping List pop-up; every row ends in the code; the whole list sits in one OTHER group). CAUSE (inspected, not run): plan_generator.py:3427-3429 creates a NEW Ingredient row for every food in every meal ("Always create a new ingredient with exact macros for this food", name = food name + uuid4 hex[:12], category "other"). The shopping-list endpoint merges only rows whose ingredient.name matches exactly (backend.py:9311-9333), and no two of these names match, so nothing merges and the code leaks into the visible name. NOT MEASURED: how many of the 114 live rows would merge by base name. That needs one GET of /diet/shopping-list on the QA account (this card will get the number once a session exists: rows -> distinct base name + unit). WHICH FIX: display-side (strip a trailing 12-hex token in nutrition.service normalizeShoppingList and sum by base name + unit) repairs the pop-up and /shopping-list at once, but checkedItems is keyed by ingredient_id (Nutrition.tsx, Set<number>) and the cost estimate posts per-item ids, so the merged row needs a stable id and the estimate must use the merged quantity. Backend-side (aggregate on the base name in backend.py:9311, strip the token) fixes every client and every EXISTING plan in one place and is the smaller change; stopping the per-plan copies at plan_generator.py:3427 only fixes plans generated after the change. Suggested: backend aggregation now, then stop appending the token to the stored name (keep a separate unique column if one is needed). Also note category is "other" for all generated copies, so the grouping by category in the pop-up is lost.',
  },
  {
    id: 'i-20261026-shopping-list-modal-under-nav-and-coach-fab',
    tags: ['shopping-list', 'nutrition', 'layout', 'p2'],
    route: 'app: src/components/RefreshableScreen.tsx:45 (className "bg-background relative z-[1]" wraps the Nutrition page, so the z-50 pop-up inside it cannot rise above the root-level coach button z-30 and bottom nav); src/components/FloatingCoachButton.tsx:270; src/components/nutrition/ShoppingListModal.tsx',
    images: ['shopping-list-modal-end-under-nav-fab.png', 'shopping-list-modal-suffix-rows.png'],
    description: '[P2 / content unreachable] ' + common + 'REPRO: Nutrition -> the ... menu -> Shopping list, scroll the list to the end. RESULT at 390 x 844: the bottom sheet runs to y 844, but the bottom nav (top y 766) and the coach button (the "Chat with <coach name>" circle, y 676-732, right edge) are painted OVER it. At the end of the list the last two rows are under the nav (rows at y 737-782 and 782-827, nav from 766): the final row is not visible at all and cannot be ticked, and the coach button covers the quantity of the two rows above (quantities of the 3rd and 4th from last). So with this list the hidden items are the last two, "Egg (Boiled)" and "Oats" in the mock; on any list it is whatever the last two rows are, 78 px of the sheet (about 1.7 rows) is lost. CAUSE (inspected + measured): the pop-up overlay is z-50 and the button is z-30 (FloatingCoachButton.tsx:36-38 says it must stay below sheets), but RefreshableScreen.tsx:45 gives the whole page a stacking context (relative z-[1]), so the overlay competes inside that z-1 context while the button and the nav are root-level siblings above it. Measured ancestors of the pop-up: overlay fixed z-50 -> "bg-background relative z-[1]". Expect the same for every other sheet opened from a RefreshableScreen page (not tested). FIX options: render the pop-up through a portal at body level (best, also covers the other sheets), or drop the z-[1] on RefreshableScreen, or hide the coach button and nav while a sheet is open; and add bottom padding to the list equal to the nav height + safe area so the last row can be scrolled clear.',
  },
];
const now = new Date().toISOString();
for (const c of cards) {
  if (db.issues.some((i) => i.id === c.id)) { console.log('exists', c.id); continue; }
  const imgs = c.images.map((f) => IMG + f);
  db.issues.unshift({
    id: c.id, createdAt: now, author: 'qa', tags: c.tags, route: c.route,
    imagePath: imgs[0], imageCommit: COMMIT, imagePaths: imgs, imageCommits: imgs.map(() => COMMIT),
    imagePrivate: false, status: 'open', fix: null, history: [], description: c.description,
  });
  console.log('added', c.id);
}
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
