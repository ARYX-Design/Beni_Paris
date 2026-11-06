// Shared chrome: header, footer, cart drawer, scroll reveals.
import {
  subscribeCart, getCartState, setCartOpen, updateLineQuantity, removeCartLine,
  applyCartCoupon, removeCartCoupon, goToCheckout,
} from "/js/wix/cart-store.js";

export function esc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const page = document.body.dataset.page || "";
const cur = (p) => (page === p ? ' aria-current="page"' : "");

const header = document.createElement("div");
header.innerHTML =
  '<a class="skip" href="#main">Skip to content</a>' +
  '<div class="announce">Maison parisienne · Made in Paris</div>' +
  '<header class="site-header"><div class="bar">' +
  '<nav class="nav" id="nav" aria-label="Main">' +
  '<a href="/shop.html"' + cur("shop") + ">Boutique</a>" +
  '<a href="/shop.html?collection=pret-a-porter">Prêt-à-porter</a>' +
  '<a href="/shop.html?collection=accessoires">Accessoires</a>' +
  '<a href="/maison.html"' + cur("maison") + ">La Maison</a>" +
  "</nav>" +
  '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>' +
  '<a class="brand" href="/" aria-label="Beni Paris — home"><img src="/img/bp.png" alt="" width="119" height="140"><span>Beni Paris</span></a>' +
  '<div class="header-actions"><a class="hide-sm" href="/shop.html">Shop</a>' +
  '<button type="button" id="cart-btn" aria-label="Open bag">Bag (<span class="cart-count" id="cart-count">0</span>)</button></div>' +
  "</div></header>";
document.body.prepend(...header.childNodes);

const toggle = document.querySelector(".menu-toggle");
toggle.addEventListener("click", () => {
  const nav = document.getElementById("nav");
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});

const year = new Date().getFullYear();
const footer = document.createElement("footer");
footer.className = "site-footer";
footer.innerHTML =
  '<div class="top"><div><img class="mark" src="/img/bp.png" alt="Beni Paris"><p>Beni Paris is a Parisian clothing house making tailored ready-to-wear and accessories in small, considered runs.</p></div>' +
  '<div><h4>Boutique</h4><ul><li><a href="/shop.html">All pieces</a></li><li><a href="/shop.html?collection=pret-a-porter">Prêt-à-porter</a></li><li><a href="/shop.html?collection=accessoires">Accessoires</a></li></ul></div>' +
  '<div><h4>La Maison</h4><ul><li><a href="/maison.html">Our story</a></li><li><a href="/maison.html#atelier">The atelier</a></li><li><a href="/maison.html#care">Client care</a></li></ul></div></div>' +
  '<div class="bottom"><span>© ' + year + " Beni Paris</span><span>Paris · France</span></div>";
document.body.append(footer);

// ---------- Cart drawer ----------
const backdrop = document.createElement("div");
backdrop.className = "cart-backdrop";
backdrop.hidden = true;
const panel = document.createElement("aside");
panel.className = "cart-panel";
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-modal", "true");
panel.setAttribute("aria-label", "Shopping bag");
panel.hidden = true;
panel.tabIndex = -1;
panel.innerHTML =
  '<header><h2>Your bag</h2><button type="button" class="close" data-close>Close</button></header>' +
  '<div class="cart-lines" id="cart-lines"></div>' +
  '<div class="cart-foot" id="cart-foot"></div>';
document.body.append(backdrop, panel);

const cartBtn = document.getElementById("cart-btn");
cartBtn.addEventListener("click", () => setCartOpen(true));
backdrop.addEventListener("click", () => setCartOpen(false));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && getCartState().open) setCartOpen(false); });

let wasOpen = false;
let lastFocus = null;
let couponDraft = "";

panel.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if ("close" in b.dataset) setCartOpen(false);
  else if (b.dataset.line && b.dataset.qty) updateLineQuantity(b.dataset.line, Number(b.dataset.qty)).catch(() => {});
  else if (b.dataset.remove) removeCartLine(b.dataset.remove).catch(() => {});
  else if ("checkout" in b.dataset) goToCheckout().catch(() => {});
  else if ("applyCoupon" in b.dataset) { const v = couponDraft.trim(); if (v) applyCartCoupon(v).catch(() => {}); }
  else if ("removeCoupon" in b.dataset) removeCartCoupon().catch(() => {});
});
panel.addEventListener("input", (e) => { if (e.target.id === "coupon-input") couponDraft = e.target.value; });

function renderCart(s) {
  const n = s.cart ? s.cart.itemCount : 0;
  document.getElementById("cart-count").textContent = String(n);

  if (s.open !== wasOpen) {
    wasOpen = s.open;
    if (s.open) {
      lastFocus = document.activeElement;
      backdrop.hidden = false; panel.hidden = false;
      requestAnimationFrame(() => { backdrop.classList.add("show"); panel.classList.add("show"); panel.focus(); });
      document.body.classList.add("locked");
    } else {
      backdrop.classList.remove("show"); panel.classList.remove("show");
      document.body.classList.remove("locked");
      setTimeout(() => { if (!getCartState().open) { backdrop.hidden = true; panel.hidden = true; } }, 450);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }

  const linesEl = document.getElementById("cart-lines");
  const footEl = document.getElementById("cart-foot");
  const lines = s.cart ? s.cart.lines : [];
  const busy = s.busy ? " disabled" : "";
  let html = s.error ? '<p class="error-text" role="alert">' + esc(s.error) + "</p>" : "";
  if (!s.cart) html += '<p class="cart-empty">Loading your bag…</p>';
  else if (!lines.length) html += '<div class="cart-empty"><img src="/img/bp.png" alt=""><p>Your bag is empty.</p><a class="link" href="/shop.html">Discover the collection</a></div>';
  lines.forEach((l) => {
    const max = l.availableQuantity == null ? Infinity : l.availableQuantity;
    html += '<div class="cart-line">' +
      (l.imageUrl ? '<img src="' + esc(l.imageUrl) + '" alt="">' : '<img src="/img/bp.png" alt="">') +
      "<div><h3>" + esc(l.productName) + "</h3>" +
      (l.descriptionLines.length ? '<p class="meta">' + l.descriptionLines.map(esc).join(" · ") + "</p>" : "") +
      (l.subscription ? '<p class="meta">' + esc(l.subscription) + "</p>" : "") +
      (l.status !== "IN_STOCK" ? '<p class="meta error-text">This piece is no longer available in this quantity.</p>' : "") +
      '<div class="row"><div class="qty"><button type="button" aria-label="Decrease" data-line="' + esc(l.lineItemId) + '" data-qty="' + (l.quantity - 1) + '"' + (l.quantity <= 1 ? " disabled" : busy) + ">−</button><span>" + l.quantity +
      '</span><button type="button" aria-label="Increase" data-line="' + esc(l.lineItemId) + '" data-qty="' + (l.quantity + 1) + '"' + (l.quantity >= max ? " disabled" : busy) + ">+</button></div>" +
      '<span class="price-line">' + (l.compareAtLinePrice ? "<s>" + esc(l.compareAtLinePrice) + "</s>" : "") + "<span>" + esc(l.linePrice) + "</span></span></div>" +
      '<button type="button" class="remove" data-remove="' + esc(l.lineItemId) + '"' + busy + ">Remove</button></div></div>";
  });
  linesEl.innerHTML = html;

  if (!s.cart || !lines.length) { footEl.innerHTML = ""; return; }
  const c = s.cart;
  let foot = "";
  if (c.coupon) foot += '<div class="sum"><span>Code ' + esc(c.coupon.code) + '</span><button type="button" class="remove" data-remove-coupon' + busy + ">Remove code</button></div>";
  else if (!document.getElementById("coupon-input")) foot += '<div class="coupon"><input id="coupon-input" placeholder="Gift or promo code" aria-label="Promo code"><button type="button" data-apply-coupon' + busy + ">Apply</button></div>";
  foot += '<div class="sum"><span>Subtotal</span><span>' + esc(c.subtotal) + "</span></div>";
  c.discounts.forEach((d) => { foot += '<div class="sum"><span>' + esc(d.name) + "</span><span>−" + esc(d.amount) + "</span></div>"; });
  c.fees.forEach((d) => { foot += '<div class="sum"><span>' + esc(d.name) + "</span><span>" + esc(d.amount) + "</span></div>"; });
  if (c.taxes.length) c.taxes.forEach((d) => { foot += '<div class="sum"><span>' + esc(d.name) + "</span><span>" + esc(d.amount) + "</span></div>"; });
  foot += '<div class="sum"><span>Delivery' + (c.taxes.length || c.pricesIncludeTax ? "" : " &amp; taxes") + '</span><span>Calculated at checkout</span></div>';
  if (c.total) foot += '<div class="sum total"><span>Total</span><span>' + esc(c.total) + "</span></div>";
  foot += '<button type="button" class="btn block" data-checkout' + busy + ">Proceed to checkout</button>";
  // keep a coupon input the visitor is typing in
  const existing = document.getElementById("coupon-input");
  if (existing && !c.coupon) {
    const keep = existing.closest(".coupon");
    footEl.innerHTML = foot;
    footEl.prepend(keep);
    keep.querySelector("button").disabled = !!s.busy;
  } else footEl.innerHTML = foot;
}
subscribeCart(renderCart);
renderCart(getCartState());

// ---------- Scroll reveal ----------
export function observeReveals(root = document) {
  const els = root.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => io.observe(el));
}
observeReveals();

// ---------- Product tile ----------
export function tileHtml(p, pendingId) {
  let price;
  if (p.fromPrice) price = "From " + esc(p.price);
  else if (p.price !== p.maxPrice) price = esc(p.price) + " – " + esc(p.maxPrice);
  else price = (p.compareAtPrice ? "<s>" + esc(p.compareAtPrice) + "</s> " : "") + "<span>" + esc(p.price) + "</span>";
  const href = "/product.html?slug=" + encodeURIComponent(p.slug);
  const ribbons = p.ribbons.length ? '<div class="ribbons">' + p.ribbons.map((r) => '<span class="ribbon">' + esc(r) + "</span>").join("") + "</div>" : "";
  const media = p.imageUrl
    ? '<img class="main" src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" loading="lazy">' +
      (p.hoverImageUrl ? '<img class="hover" src="' + esc(p.hoverImageUrl) + '" alt="" loading="lazy">' : "")
    : '<span class="placeholder"><img src="/img/bp.png" alt=""></span>';
  let action;
  if (p.availability === "OUT_OF_STOCK" && !p.preorder) action = '<a class="link quick" href="' + href + '">Sold out · View</a>';
  else if (p.quickAddable) action = '<button type="button" class="link quick" data-add="' + esc(p.id) + '" data-variant="' + esc(p.minPriceVariantId || "") + '"' + (pendingId === p.id ? " disabled" : "") + ">" + (pendingId === p.id ? "Adding…" : p.preorder ? "Pre-order" : "Add to bag") + "</button>";
  else action = '<a class="link quick" href="' + href + '">Choose size</a>';
  return '<article class="tile reveal"><a class="media" href="' + href + '">' + ribbons + media + "</a>" +
    '<div class="info"><a href="' + href + '"><h3>' + esc(p.name) + "</h3></a>" +
    '<div class="price-line">' + price + "</div>" +
    (p.discountNames.length ? '<div class="meta">' + p.discountNames.map(esc).join(" · ") + "</div>" : "") +
    (p.swatches.length ? '<div class="swatches">' + p.swatches.map((c) => '<i style="background:' + esc(c) + '"></i>').join("") + "</div>" : "") +
    (p.optionsSummary ? '<div class="meta">' + esc(p.optionsSummary) + "</div>" : "") +
    action + "</div></article>";
}
