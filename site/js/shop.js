import { esc, tileHtml, observeReveals } from "/js/site.js";
import { createShopStore, SORTS } from "/js/wix/shop-store.js";
import { fetchCategories, fetchAllProductsCategoryId } from "/js/wix/catalog.js";
import { addLine, subscribeCart, getCartState } from "/js/wix/cart-store.js";

const $ = (id) => document.getElementById(id);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const params = new URLSearchParams(location.search);
const wanted = params.get("collection");

const [cats, allId] = await Promise.all([
  fetchCategories().catch(() => []),
  fetchAllProductsCategoryId().catch(() => null),
]);
const collections = cats.filter((c) => c.id !== allId && !c.parentId);
const initial = wanted ? collections.find((c) => norm(c.slug) === norm(wanted)) || null : null;

const shop = createShopStore({ initialCategoryId: initial ? initial.id : null, initialCategories: cats });

Object.keys(SORTS).forEach((k) => $("sort").add(new Option(SORTS[k].label, k)));
$("sort").addEventListener("change", () => shop.setSort($("sort").value));
$("more").addEventListener("click", () => shop.loadMore());
$("clear").addEventListener("click", () => { $("search").value = ""; shop.clearFilters(); });
$("filter-toggle").addEventListener("click", () => {
  const open = $("filters").classList.toggle("open");
  $("filter-toggle").setAttribute("aria-expanded", String(open));
});
let t;
$("search").addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(() => shop.setFilters({ ...shop.getState().filters, search: $("search").value }), 300);
});

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cat]");
  if (!b) return;
  const id = b.dataset.cat || null;
  shop.setActiveCategoryId(id);
  const c = collections.find((x) => x.id === id);
  const u = new URL(location.href);
  if (c) u.searchParams.set("collection", c.slug); else u.searchParams.delete("collection");
  history.replaceState(history.state, "", u);
});

$("filters").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-choice]");
  if (b) shop.toggleChoice(b.dataset.choice);
});
$("filters").addEventListener("change", (e) => {
  const f = { ...shop.getState().filters };
  if (e.target.id === "min") f.minPrice = e.target.value;
  else if (e.target.id === "max") f.maxPrice = e.target.value;
  else if (e.target.id === "instock") f.inStockOnly = e.target.checked;
  else return;
  shop.setFilters(f);
});

$("results").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-add]");
  if (b && !b.disabled) addLine(b.dataset.add, b.dataset.variant, 1).catch(() => {});
  if (e.target.closest("button[data-retry]")) shop.retry();
});

let filtersBuilt = "";
function renderFilters(s) {
  // Rebuild only when the facet set changes, so typed price values survive renders.
  const key = JSON.stringify([s.facets.map((f) => f.id + f.choices.map((c) => c.id + c.count).join()), s.priceRange, s.selectedChoiceIds, s.filters.inStockOnly]);
  if (key === filtersBuilt) return;
  filtersBuilt = key;
  const sel = new Set(s.selectedChoiceIds);
  let html = "";
  s.facets.forEach((f) => {
    html += "<fieldset><legend>" + esc(f.name) + "</legend>";
    f.choices.forEach((c) => {
      html += '<button type="button" class="chip" data-choice="' + esc(c.id) + '" aria-pressed="' + sel.has(c.id) + '">' +
        (f.isColor && c.colorCode ? '<span class="dot" style="background:' + esc(c.colorCode) + '"></span>' : "") +
        esc(c.name) + " <span class=\"meta\">(" + c.count + ")</span></button>";
    });
    html += "</fieldset>";
  });
  if (s.priceRange) {
    const minV = document.getElementById("min") ? document.getElementById("min").value : (s.filters.minPrice ?? "");
    const maxV = document.getElementById("max") ? document.getElementById("max").value : (s.filters.maxPrice ?? "");
    html += '<fieldset><legend>Price</legend><div class="price-pair"><input id="min" type="number" inputmode="decimal" min="' + s.priceRange.min + '" max="' + s.priceRange.max + '" placeholder="' + s.priceRange.min + '" value="' + esc(minV) + '" aria-label="Minimum price"><span>—</span><input id="max" type="number" inputmode="decimal" min="' + s.priceRange.min + '" max="' + s.priceRange.max + '" placeholder="' + s.priceRange.max + '" value="' + esc(maxV) + '" aria-label="Maximum price"></div></fieldset>';
  }
  html += '<fieldset><legend>Availability</legend><label class="check"><input type="checkbox" id="instock"' + (s.filters.inStockOnly ? " checked" : "") + "> In stock only</label></fieldset>";
  $("filters").innerHTML = html;
}

function render(s) {
  const active = collections.find((c) => c.id === s.activeCategoryId);
  $("shop-title").textContent = active ? active.name : "La Boutique";
  $("shop-desc").textContent = active ? (active.description || "Pieces from the " + active.name + " collection.") : "Browse every piece from the house — tailoring, silk and cashmere, made in Paris.";
  document.title = (active ? active.name : "Boutique") + " — Beni Paris";

  $("tabs").innerHTML = '<button type="button" data-cat="" aria-pressed="' + !s.activeCategoryId + '">All pieces</button>' +
    collections.map((c) => '<button type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (c.id === s.activeCategoryId) + '">' + esc(c.name) + "</button>").join("");

  if ($("sort").value !== s.sort) $("sort").value = s.sort;
  $("count").textContent = s.total == null ? "" : s.total + (s.total === 1 ? " piece" : " pieces");
  $("clear").hidden = !s.hasActiveFilters;
  $("more").hidden = !s.hasMore;
  $("more").disabled = s.loadingMore;
  $("more").textContent = s.loadingMore ? "Loading…" : "Show more pieces";
  renderFilters(s);

  const r = $("results");
  if (s.error && !s.products) { r.innerHTML = '<div class="state"><h3>Something went wrong</h3><p class="error-text">' + esc(s.error) + '</p><button type="button" class="btn" data-retry>Try again</button></div>'; return; }
  if (!s.products) { r.innerHTML = '<p class="state">Loading the collection…</p>'; return; }
  if (!s.products.length) {
    r.innerHTML = s.hasActiveFilters
      ? '<div class="state"><h3>No pieces match</h3><p>Try removing a filter or two.</p></div>'
      : '<div class="state"><h3>Coming soon</h3><p>New pieces are being finished in the atelier.</p></div>';
    return;
  }
  const pending = getCartState().pendingProductId;
  r.innerHTML = (s.error ? '<p class="error-text" role="alert">' + esc(s.error) + "</p>" : "") +
    '<div class="grid' + (s.loading ? " dim" : "") + '">' + s.products.map((p) => tileHtml(p, pending)).join("") + "</div>";
  r.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
}

shop.subscribe(render);
render(shop.getState());
shop.start();
let lastPending = null;
subscribeCart((c) => { if (c.pendingProductId !== lastPending) { lastPending = c.pendingProductId; render(shop.getState()); } });
observeReveals();
