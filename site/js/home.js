import { esc, tileHtml, observeReveals } from "/js/site.js";
import { fetchCategories, fetchProducts, fetchAllProductsCategoryId } from "/js/wix/catalog.js";
import { addLine, subscribeCart, getCartState } from "/js/wix/cart-store.js";

const colEl = document.getElementById("collections");
const featEl = document.getElementById("featured");

Promise.all([fetchCategories(), fetchAllProductsCategoryId().catch(() => null)]).then(([cats, allId]) => {
  const list = cats.filter((c) => c.id !== allId && !c.parentId && c.productCount !== 0);
  if (!list.length) { colEl.closest("section").hidden = true; return; }
  colEl.innerHTML = list.map((c) =>
    '<a class="collection reveal" href="/shop.html?collection=' + encodeURIComponent(c.slug) + '">' +
    (c.imageUrl ? '<img src="' + esc(c.imageUrl) + '" alt="" loading="lazy">' : "") +
    '<div class="label"><h3>' + esc(c.name) + "</h3>" +
    (c.description ? "<p>" + esc(c.description) + "</p>" : "") +
    '<span class="link">Shop ' + esc(c.name) + "</span></div></a>").join("");
  observeReveals(colEl);
}).catch(() => { colEl.closest("section").hidden = true; });

let products = null;
function renderProducts() {
  if (!products) return;
  if (!products.length) { featEl.innerHTML = '<p class="state">New pieces are on their way.</p>'; return; }
  featEl.innerHTML = products.map((p) => tileHtml(p, getCartState().pendingProductId)).join("");
  observeReveals(featEl);
  featEl.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
}
fetchProducts({ limit: 8 }).then((ps) => { products = ps; renderProducts(); })
  .catch((e) => { featEl.innerHTML = '<p class="state error-text">The collection could not be loaded. Please refresh the page.</p>'; console.error(e); });

let lastPending = null;
subscribeCart((s) => { if (s.pendingProductId !== lastPending) { lastPending = s.pendingProductId; renderProducts(); } });

featEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-add]");
  if (!b || b.disabled) return;
  addLine(b.dataset.add, b.dataset.variant, 1).catch(() => {});
});
