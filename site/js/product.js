import { esc } from "/js/site.js";
import { createProductDetailStore, ONE_TIME_PLAN } from "/js/wix/product-detail-store.js";

const root = document.getElementById("pdp-root");
const slug = new URLSearchParams(location.search).get("slug");
const store = createProductDetailStore({ slug });
let built = false;
let shownGalleryKey = "";

function build(p) {
  const crumbs = p.breadcrumbs.map((b, i) =>
    i === p.breadcrumbs.length - 1 ? "<span>" + esc(b.name) + "</span>"
      : b.slug && i > 0 ? '<a href="/shop.html?collection=' + encodeURIComponent(b.slug) + '">' + esc(b.name) + "</a>"
      : '<a href="' + (i === 0 ? "/" : "/shop.html") + '">' + esc(b.name) + "</a>").join("<span>/</span>");
  const textMods = p.modifiers.filter((m) => m.type === "text");
  root.innerHTML =
    '<div style="padding:28px var(--gutter) 0"><nav class="crumbs" aria-label="Breadcrumb">' + (crumbs || '<a href="/shop.html">Boutique</a>') + "</nav></div>" +
    '<div class="pdp"><div class="gallery" id="gallery"></div>' +
    '<div class="buy">' +
    "<div>" + (p.ribbons.length ? '<p class="kicker">' + p.ribbons.map(esc).join(" · ") + "</p>" : '<p class="kicker">Beni Paris</p>') +
    "<h1>" + esc(p.name) + '</h1></div><div class="price-line" id="price"></div>' +
    '<div id="opts"></div>' +
    textMods.map((m) => '<label class="opt" style="display:grid;gap:8px"><span class="kicker" style="margin:0">' + esc(m.title) + (m.mandatory ? "" : " (optional)") + '</span><input class="notify-input" data-text-mod="' + esc(m.key) + '"' + (m.maxChars ? ' maxlength="' + m.maxChars + '"' : "") + ' style="font:inherit;padding:12px;border:1px solid var(--line);background:transparent;border-radius:0"></label>').join("") +
    '<div id="buy-row"></div>' +
    '<div id="notify-box" hidden><p class="note">Leave your email and we will write when this piece returns.</p><form class="notify" id="notify-form"><input type="email" id="notify-email" required placeholder="Email address" aria-label="Email address"><button type="submit" class="btn">Notify me</button></form><p class="note" id="notify-msg" role="status"></p></div>' +
    (p.descriptionHtml ? '<div class="desc">' + p.descriptionHtml + "</div>" : "") +
    (p.infoSections.length ? '<div class="accordion">' + p.infoSections.map((s, i) => "<details" + (i === 0 ? " open" : "") + "><summary>" + esc(s.title) + '</summary><div class="body">' + s.html + "</div></details>").join("") + "</div>" : "") +
    "</div></div>";
  document.title = p.name + " — Beni Paris";
  const tmp = document.createElement("div");
  tmp.innerHTML = p.descriptionHtml || "";
  const first = (tmp.textContent || "").trim().split("\n")[0].slice(0, 160);
  if (first) document.querySelector('meta[name="description"]').setAttribute("content", first);
}

function render(s) {
  if (!s.product) {
    root.innerHTML = s.notFound
      ? '<div class="state"><h3>This piece is not available</h3><p>It may have left the collection.</p><a class="link" href="/shop.html">Return to the boutique</a></div>'
      : '<p class="state">Loading…</p>';
    built = false;
    return;
  }
  const p = s.product;
  if (!built) { build(p); built = true; }

  // gallery — the picked choice's image leads when the merchant linked one
  const main = s.imageUrl || p.gallery[0] || "";
  const imgs = main ? [main].concat(p.gallery.filter((u) => u !== main)) : p.gallery;
  const gKey = imgs.join("|");
  if (gKey !== shownGalleryKey) {
    shownGalleryKey = gKey;
    document.getElementById("gallery").innerHTML = imgs.length
      ? imgs.map((u, i) => '<div class="frame"><img src="' + esc(u) + '" alt="' + (i === 0 ? esc(p.name) : "") + '"' + (i ? ' loading="lazy"' : "") + "></div>").join("")
      : '<div class="frame" style="display:grid;place-items:center"><img src="/img/bp.png" alt="" style="width:70px;height:auto;opacity:.35"></div>';
  }

  document.getElementById("price").innerHTML =
    (s.compareAtPrice ? "<s>" + esc(s.compareAtPrice) + "</s>" : "") + "<span>" + esc(s.price) + "</span>" +
    (s.pricePerUnit ? '<span class="meta">' + esc(s.pricePerUnit) + "</span>" : "");

  let html = "";
  s.optionGroups.forEach((g) => {
    const picked = g.choices.find((c) => c.selected);
    html += '<fieldset class="opt"><legend>' + esc(g.name) + (picked ? '<span class="sel">' + esc(picked.name) + "</span>" : "") + "</legend>";
    g.choices.forEach((c) => {
      const off = !c.inStock || !c.exists;
      if (g.isColor) html += '<button type="button" class="swatch" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" style="background:' + esc(c.colorCode || "#ccc") + '" data-option="' + esc(g.id) + '" data-choice="' + esc(c.choiceId) + '" aria-pressed="' + c.selected + '"' + (off ? " disabled" : "") + "></button>";
      else html += '<button type="button" class="chip" data-option="' + esc(g.id) + '" data-choice="' + esc(c.choiceId) + '" aria-pressed="' + c.selected + '"' + (off ? " disabled" : "") + ">" + esc(c.name) + "</button>";
    });
    html += "</fieldset>";
  });
  p.modifiers.filter((m) => m.type === "choices").forEach((m) => {
    html += '<fieldset class="opt"><legend>' + esc(m.name) + (m.mandatory ? "" : " (optional)") + "</legend>";
    m.choices.forEach((c) => {
      html += '<button type="button" class="chip" data-mod="' + esc(m.key) + '" data-mod-val="' + esc(c.key) + '" aria-pressed="' + (s.modifierValues[m.key] === c.key) + '">' + esc(c.name) + "</button>";
    });
    html += "</fieldset>";
  });
  if (s.plans.length) {
    html += '<fieldset class="opt"><legend>Purchase</legend>';
    if (p.allowOneTimePurchase) html += '<button type="button" class="chip" data-plan="' + ONE_TIME_PLAN + '" aria-pressed="' + !s.subscriptionPlanId + '">One-time purchase</button>';
    s.plans.forEach((pl) => { html += '<button type="button" class="chip" data-plan="' + esc(pl.id) + '" aria-pressed="' + pl.selected + '">' + esc(pl.name) + " · " + esc(pl.terms) + " · " + esc(pl.price) + "</button>"; });
    html += "</fieldset>";
  }
  document.getElementById("opts").innerHTML = html;

  const label = s.adding ? "Adding…" : s.isPreorder ? "Pre-order" : "Add to bag";
  document.getElementById("buy-row").innerHTML =
    '<div class="buy-row"><div class="qty"><button type="button" aria-label="Decrease quantity" data-step="-1"' + (s.quantity <= 1 ? " disabled" : "") + ">−</button><span>" + s.quantity +
    '</span><button type="button" aria-label="Increase quantity" data-step="1"' + (s.quantity >= s.maxQuantity ? " disabled" : "") + ">+</button></div>" +
    '<button type="button" class="btn" data-add' + (s.canAdd && !s.adding ? "" : " disabled") + ">" + label + "</button></div>" +
    (s.isPreorder && s.preorderMessage ? '<p class="note">' + esc(s.preorderMessage) + "</p>" : "") +
    (!s.canAdd && s.blockedReason ? '<p class="note" style="margin-top:12px">' + esc(s.blockedReason) + "</p>" : "") +
    (s.remaining != null && s.remaining > 0 && s.remaining <= 3 ? '<p class="note" style="margin-top:12px">Only ' + s.remaining + " left</p>" : "") +
    (s.error ? '<p class="error-text" role="alert" style="margin-top:12px">' + esc(s.error) + "</p>" : "");

  const nb = document.getElementById("notify-box");
  nb.hidden = !s.canNotify;
  nb.querySelector("button").disabled = s.notifying;
  document.getElementById("notify-msg").textContent = s.notifyError
    ? s.notifyError
    : s.notifyResult === "created" ? "Thank you — we will let you know."
    : s.notifyResult === "already-subscribed" ? "You are already on the list for this piece." : "";
}

root.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.option) store.selectOption(b.dataset.option, b.dataset.choice);
  else if (b.dataset.mod) store.setModifier(b.dataset.mod, b.dataset.modVal);
  else if (b.dataset.plan) store.selectPlan(b.dataset.plan);
  else if (b.dataset.step) store.setQuantity(store.getState().quantity + Number(b.dataset.step));
  else if ("add" in b.dataset) store.add().catch(() => {});
});
root.addEventListener("input", (e) => {
  const k = e.target.dataset && e.target.dataset.textMod;
  if (k) store.setModifier(k, e.target.value);
});
root.addEventListener("submit", (e) => {
  if (e.target.id !== "notify-form") return;
  e.preventDefault();
  store.notify(document.getElementById("notify-email").value).catch(() => {});
});

store.subscribe(render);
render(store.getState());
store.start();
