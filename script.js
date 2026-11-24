const FALLBACK_PRODUCTS = [
  { id: 1, sku: "PC-001", name: "Dried mangoes", desc: "Sweet, chewy, 200g pack", longDesc: "Sun-ripened Carabao mangoes from Cebu, sliced thick and gently dried to keep their bright tropical sweetness and signature chewy bite.", price: 180, comparePrice: 210, cat: "Snacks", img: "images/01.jpg", badge: "Bestseller", stock: 38, sold: 142, featured: true, active: true },
  { id: 2, sku: "PC-002", name: "Otap biscuits", desc: "Flaky puff pastry, box of 10", longDesc: "Crisp, caramelized oval puff pastry baked in small batches by Cebuano bakers. Light, flaky layers dusted with cane sugar.", price: 120, comparePrice: 0, cat: "Snacks", img: "images/02.jpg", badge: "", stock: 24, sold: 98, featured: true, active: true },
  { id: 3, sku: "PC-003", name: "Rosquillos", desc: "Crisp butter cookies, 250g", longDesc: "Liloan-style ring cookies made with farm eggs, butter, and a hint of citrus. A classic Cebuano pairing for hot coffee or sikwate.", price: 150, comparePrice: 175, cat: "Snacks", img: "images/03.jpg", badge: "Local Favorite", stock: 19, sold: 84, featured: true, active: true },
  { id: 4, sku: "PC-004", name: "Sinamay tote bag", desc: "Handwoven, fits a laptop", longDesc: "Woven from natural abaca sinamay fibers by local artisans. Roomy enough for a 14-inch laptop, market finds, or beach essentials.", price: 450, comparePrice: 520, cat: "Crafts", img: "images/04.jpg", badge: "Handmade", cover: true, stock: 8, sold: 41, featured: true, active: true },
  { id: 5, sku: "PC-005", name: "Mini guitar keychain", desc: "Handmade in Mactan", longDesc: "Hand-carved miniature wooden guitar crafted by luthier families in Lapu-Lapu City, Mactan — the guitar capital of the Philippines.", price: 95, comparePrice: 0, cat: "Crafts", img: "images/05.jpg", badge: "", stock: 4, sold: 116, featured: true, active: true },
  { id: 6, sku: "PC-006", name: "Cebu t-shirt", desc: "Cotton, sizes S to XL", longDesc: "Combed 100% ringspun cotton tee screen-printed with vintage Cebu island graphics. Breathable, pre-shrunk, unisex fit.", price: 350, comparePrice: 390, cat: "Apparel", img: "images/06.jpg", badge: "New", stock: 15, sold: 53, featured: true, active: true },
];

const FALLBACK_SETTINGS = {
  storeName: "Pasalubong Corner",
  announcement: "Free email receipt on every order · Free delivery on orders ₱500+ · Handpicked from Cebu",
  deliveryFee: 60,
  freeDeliveryThreshold: 500,
  supportEmail: "orders@goarcana.com",
  supportPhone: "0917 555 0143",
  gcashNumber: "0917 555 0143 (Pasalubong Corner)",
  lowStockThreshold: 5,
  categories: ["Snacks", "Crafts", "Apparel"],
  catImages: { Snacks: "images/01.jpg", Crafts: "images/05.jpg", Apparel: "images/06.jpg" },
};

const $ = (s, r = document) => r.querySelector(s);
const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (e) { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function getDB() {
  return window.PasalubongDB || null;
}
function getProducts() {
  const db = getDB();
  return db && typeof db.getProducts === "function" ? db.getProducts(false) : FALLBACK_PRODUCTS;
}
function getSettings() {
  const db = getDB();
  return db && typeof db.getSettings === "function" ? { ...FALLBACK_SETTINGS, ...db.getSettings() } : FALLBACK_SETTINGS;
}
function byId(id) {
  const db = getDB();
  if (db && typeof db.getProductById === "function") {
    const p = db.getProductById(Number(id));
    if (p && p.active !== false) return p;
  }
  return getProducts().find((p) => p.id === Number(id)) || null;
}
function getCategories() {
  const settings = getSettings();
  const prods = getProducts();
  const base = Array.isArray(settings.categories) && settings.categories.length
    ? settings.categories
    : ["Snacks", "Crafts", "Apparel"];
  const extra = prods.map((p) => p.cat).filter((c) => c && !base.includes(c));
  return ["All", ...new Set([...base, ...extra])];
}
function getCatImage(c) {
  const settings = getSettings();
  if (settings.catImages && settings.catImages[c]) return settings.catImages[c];
  const match = getProducts().find((p) => p.cat === c && p.img);
  return match ? match.img : "images/01.jpg";
}

let cart = read("cart", {}), query = "", cat = "All", sort = "featured";
let appliedCouponCode = read("pc_coupon", "");
let activeQuickViewId = null;
let activeTrackOrderNo = "";

const save = () => {
  write("cart", cart);
  write("pc_coupon", appliedCouponCode);
};

const ICON_PLUS = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_BAG = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`;

let toastTimer;
function toast(text) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- Stock & helpers ---------- */
function getStockInfo(p) {
  const stock = Math.max(0, Math.floor(Number(p?.stock ?? 25)));
  const low = Math.max(1, Number(getSettings().lowStockThreshold ?? 5));
  if (stock <= 0) {
    return { status: "out", stock: 0, cardLabel: "Sold out", detailLabel: "Sold out" };
  }
  if (stock <= low) {
    return { status: "low", stock, cardLabel: `Only ${stock} left`, detailLabel: `Low stock (Only ${stock} left)` };
  }
  return { status: "in", stock, cardLabel: `${stock} in stock`, detailLabel: `In stock (${stock} available)` };
}

function sanitizeCartAgainstStock() {
  let changed = false;
  for (const id of Object.keys(cart)) {
    const p = byId(id);
    if (!p) {
      delete cart[id];
      changed = true;
      continue;
    }
    const max = Math.max(0, Math.floor(Number(p.stock ?? 99)));
    if (max <= 0) {
      delete cart[id];
      changed = true;
    } else if (cart[id] > max) {
      cart[id] = max;
      changed = true;
    }
  }
  if (changed) save();
}

/* ---------- Shop rendering ---------- */
function renderSettingsBanner() {
  const s = getSettings();
  if ($("#announceBar") && s.announcement) {
    $("#announceBar").textContent = s.announcement;
  }
  if ($("#storeBrandName") && s.storeName) {
    $("#storeBrandName").textContent = s.storeName;
  }
  if ($("#heroProductCount")) {
    $("#heroProductCount").textContent = String(getProducts().length);
  }
  updatePaymentHint();
}

function renderCats() {
  const prods = getProducts();
  const cats = getCategories().slice(1);
  if (!getCategories().includes(cat)) cat = "All";
  $("#cats").innerHTML = cats.map((c) => {
    const n = prods.filter((p) => p.cat === c).length;
    return `<button class="cat ${esc(c.toLowerCase())}" data-cat="${esc(c)}" type="button" aria-label="Shop ${esc(c)}, ${n} ${n === 1 ? "item" : "items"}">
      <img src="${esc(getCatImage(c))}" alt="" loading="lazy" decoding="async">
      <div class="cat-bar"><b>${esc(c)}</b><small>${n} ${n === 1 ? "item" : "items"} →</small></div>
    </button>`;
  }).join("");
}

function renderFootCats() {
  const cats = getCategories().slice(1);
  $("#footCats").innerHTML = cats.map((c) => `<li><a href="#shop" data-cat="${esc(c)}">${esc(c)}</a></li>`).join("");
}

function renderChips() {
  const prods = getProducts();
  const cats = getCategories();
  $("#chips").innerHTML = cats.map((c) => {
    const n = c === "All" ? prods.length : prods.filter((p) => p.cat === c).length;
    return `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}<span class="n">${n}</span></button>`;
  }).join("");
}

function buyControl(p) {
  const info = getStockInfo(p);
  const q = cart[p.id] || 0;
  if (info.status === "out") {
    return `<button class="add sold-out" type="button" data-id="${p.id}" disabled aria-label="${esc(p.name)} is sold out">Sold out</button>`;
  }
  if (!q) {
    return `<button class="add" type="button" data-id="${p.id}" aria-label="Add ${esc(p.name)} to cart">${ICON_PLUS}</button>`;
  }
  const atMax = q >= info.stock;
  return `<div class="stepper" role="group" aria-label="${esc(p.name)} quantity">
      <button type="button" data-step="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">−</button>
      <span aria-live="polite">${q}</span>
      <button type="button" data-step="inc" data-id="${p.id}" ${atMax ? "disabled" : ""} aria-label="Add one more ${esc(p.name)}">+</button>
    </div>`;
}

function renderProducts() {
  const prods = getProducts();
  const term = query.trim().toLowerCase();
  let list = prods.filter((p) =>
    (cat === "All" || p.cat === cat) &&
    (p.name + " " + p.desc + " " + (p.longDesc || "") + " " + p.cat + " " + (p.sku || "")).toLowerCase().includes(term)
  );
  if (sort === "featured") list = [...list].sort((a, b) => (Number(!!b.featured) - Number(!!a.featured)) || (a.id - b.id));
  if (sort === "popular") list = [...list].sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0));
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

  $("#resultCount").textContent = `${list.length} ${list.length === 1 ? "product" : "products"}`;
  if (!list.length) {
    $("#products").innerHTML = `<div class="none">
      <strong>No products match “${esc(query)}”.</strong>
      <p>Try another word or category.</p>
      <button class="link-btn" type="button" data-action="clear-filters">Clear filters</button>
    </div>`;
    return;
  }
  $("#products").innerHTML = list.map((p, i) => {
    const st = getStockInfo(p);
    const hasCompare = Number(p.comparePrice) > Number(p.price);
    return `
    <article class="card ${esc(p.cat.toLowerCase())} ${st.status === "out" ? "is-out" : ""} ${cart[p.id] ? "in-cart" : ""}" data-id="${p.id}" style="--i:${i}">
      <div class="pic" data-qv="${p.id}">
        <img class="${p.cover ? "cover" : ""}" src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" decoding="async">
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
        <span class="stock-pill ${st.status}">${esc(st.cardLabel)}</span>
        <div class="ctl">${buyControl(p)}</div>
      </div>
      <div class="meta">
        <div class="meta-top">
          <span class="cat-tag">${esc(p.cat)}</span>
          ${Number(p.sold) > 0 ? `<span class="sold-tag">${Number(p.sold)} sold</span>` : ""}
        </div>
        <h3><button type="button" class="card-title-btn" data-qv="${p.id}">${esc(p.name)}</button></h3>
        <p>${esc(p.desc)}</p>
        <div class="price-row">
          <span class="price">${peso(p.price)}</span>
          ${hasCompare ? `<del class="compare-price">${peso(p.comparePrice)}</del>` : ""}
        </div>
      </div>
    </article>`;
  }).join("");
}

function syncCards() {
  document.querySelectorAll(".card").forEach((card) => {
    const p = byId(card.dataset.id);
    if (!p) return;
    const st = getStockInfo(p);
    const ctl = card.querySelector(".ctl");
    if (ctl) ctl.innerHTML = buyControl(p);
    const pill = card.querySelector(".stock-pill");
    if (pill) {
      pill.className = `stock-pill ${st.status}`;
      pill.textContent = st.cardLabel;
    }
    card.classList.toggle("in-cart", !!cart[p.id]);
    card.classList.toggle("is-out", st.status === "out");
  });
  if ($("#productDlg")?.open && activeQuickViewId != null) {
    renderQuickViewControls(byId(activeQuickViewId));
  }
}

/* ---------- Coupon & Cart Totals ---------- */
function validatePromoLocalFallback(code, subtotal) {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) return { valid: false, error: "Enter a promo code." };
  if (clean === "CEBU10") {
    if (subtotal < 200) return { valid: false, error: "CEBU10 requires a minimum order of ₱200." };
    const discount = Math.round(subtotal * 0.1);
    return { valid: true, code: "CEBU10", discount, freeShipping: false, desc: "10% off orders ₱200+" };
  }
  if (clean === "PASALUBONG50") {
    if (subtotal < 400) return { valid: false, error: "PASALUBONG50 requires a minimum order of ₱400." };
    return { valid: true, code: "PASALUBONG50", discount: 50, freeShipping: false, desc: "₱50 off orders ₱400+" };
  }
  if (clean === "FREESHIP") {
    if (subtotal < 250) return { valid: false, error: "FREESHIP requires a minimum order of ₱250." };
    return { valid: true, code: "FREESHIP", discount: 0, freeShipping: true, desc: "Free delivery on orders ₱250+" };
  }
  return { valid: false, error: `Invalid promo code "${clean}".` };
}

function validatePromo(code, subtotal) {
  const db = getDB();
  if (db && typeof db.validateCoupon === "function") {
    return db.validateCoupon(code, subtotal);
  }
  return validatePromoLocalFallback(code, subtotal);
}

function computeCartTotals() {
  sanitizeCartAgainstStock();
  const ids = Object.keys(cart).filter((id) => byId(id));
  let subtotal = 0, count = 0;
  ids.forEach((id) => {
    const p = byId(id), q = cart[id];
    subtotal += p.price * q;
    count += q;
  });

  const s = getSettings();
  const baseFee = Math.max(0, Number(s.deliveryFee ?? 60));
  const threshold = Math.max(0, Number(s.freeDeliveryThreshold ?? 500));

  let discount = 0;
  let freeShipPromo = false;
  let couponRes = null;

  if (appliedCouponCode && subtotal > 0) {
    couponRes = validatePromo(appliedCouponCode, subtotal);
    if (couponRes && couponRes.valid) {
      discount = Math.min(subtotal, Math.max(0, Number(couponRes.discount) || 0));
      freeShipPromo = !!couponRes.freeShipping;
    }
  }

  let deliveryFee = 0;
  if (subtotal > 0) {
    if (freeShipPromo || (threshold > 0 && subtotal >= threshold)) {
      deliveryFee = 0;
    } else {
      deliveryFee = baseFee;
    }
  }

  const total = Math.max(0, subtotal - discount) + deliveryFee;
  return { ids, subtotal, count, discount, deliveryFee, baseFee, threshold, freeShipPromo, couponRes, total };
}

function renderCart() {
  const { ids, subtotal, count, discount, deliveryFee, baseFee, threshold, freeShipPromo, couponRes, total } = computeCartTotals();

  $("#items").innerHTML = ids.length ? ids.map((id) => {
    const p = byId(id), q = cart[id], st = getStockInfo(p);
    return `<div class="row">
      <img src="${esc(p.img)}" alt="">
      <div class="row-info">
        <strong>${esc(p.name)}</strong>
        <small>${peso(p.price)} each · ${esc(st.cardLabel)}</small>
      </div>
      <span class="row-sub">${peso(p.price * q)}</span>
      <div class="qty">
        <div class="stepper sm">
          <button type="button" data-act="dec" data-id="${id}" aria-label="Less ${esc(p.name)}">−</button>
          <span>${q}</span>
          <button type="button" data-act="inc" data-id="${id}" ${q >= st.stock ? "disabled" : ""} aria-label="More ${esc(p.name)}">+</button>
        </div>
        <button class="rm" type="button" data-act="rm" data-id="${id}">Remove</button>
      </div>
    </div>`;
  }).join("") : `<div class="empty">
      <span class="empty-ico">${ICON_BAG}</span>
      <strong>Your cart is empty</strong>
      <p>Add something from the shop to get started.</p>
      <button class="link-btn" type="button" data-action="browse-shop">Browse products</button>
    </div>`;

  // Free delivery progress bar
  if ($("#freeShipBox")) {
    let pct = 0;
    let text = `Free delivery on orders ${peso(threshold)}+ (Standard: ${peso(baseFee)})`;
    if (subtotal > 0) {
      if (freeShipPromo) {
        pct = 100;
        text = `Free delivery applied with code ${appliedCouponCode}!`;
      } else if (threshold > 0 && subtotal >= threshold) {
        pct = 100;
        text = `You unlocked FREE delivery! (Saved ${peso(baseFee)})`;
      } else if (threshold > 0) {
        pct = Math.min(100, Math.round((subtotal / threshold) * 100));
        text = `Add ${peso(threshold - subtotal)} more for FREE delivery!`;
      }
    }
    $("#freeShipText").textContent = text;
    $("#freeShipFill").style.width = `${pct}%`;
    $("#freeShipBox").classList.toggle("unlocked", pct >= 100);
  }

  // Promo code state
  if ($("#promoActive")) {
    if (appliedCouponCode && couponRes && couponRes.valid) {
      $("#promoActive").hidden = false;
      $("#promoCodeBadge").textContent = couponRes.code || appliedCouponCode;
      $("#promoDescText").textContent = couponRes.desc || (freeShipPromo ? "Free delivery" : `−${peso(discount)}`);
    } else {
      $("#promoActive").hidden = true;
      if (appliedCouponCode && subtotal > 0 && couponRes && !couponRes.valid) {
        setPromoMsg(couponRes.error || "Promo conditions not met.", "err");
      }
    }
  }

  // Breakdown
  $("#subtotal").textContent = peso(subtotal);
  if ($("#discountRow")) {
    const showDisc = (discount > 0 || freeShipPromo) && couponRes && couponRes.valid;
    $("#discountRow").hidden = !showDisc;
    if (showDisc) {
      $("#discountLabel").textContent = `Discount (${couponRes.code || appliedCouponCode})`;
      $("#discountVal").textContent = discount > 0 ? `−${peso(discount)}` : "Free delivery";
    }
  }
  $("#deliveryVal").textContent = subtotal === 0 ? peso(baseFee) : (deliveryFee === 0 ? "Free" : peso(deliveryFee));
  $("#total").textContent = peso(total);

  $("#count").textContent = count;
  $("#count").classList.toggle("has", count > 0);
  $("#cartSub").textContent = `${count} ${count === 1 ? "item" : "items"}`;
  $("#miniCount").textContent = `${count} ${count === 1 ? "item" : "items"}`;
  $("#miniTotal").textContent = peso(total);
  $("#miniCart").classList.toggle("show", count > 0);
  $("#checkoutWrap").classList.toggle("hidden", !ids.length && !$("#msg").classList.contains("ok"));
  $("#placeBtn").disabled = !ids.length;
  save();
  syncCards();
}

function setPromoMsg(text, kind = "") {
  const el = $("#promoMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "promo-msg" + (kind ? " " + kind : "");
}

function applyPromoCode(rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) {
    setPromoMsg("Enter a promo code first.", "err");
    return;
  }
  const { subtotal } = computeCartTotals();
  if (subtotal <= 0) {
    setPromoMsg("Add items to your cart before applying a promo code.", "err");
    return;
  }
  const res = validatePromo(code, subtotal);
  if (!res || !res.valid) {
    setPromoMsg(res?.error || "Invalid or inactive promo code.", "err");
    return;
  }
  appliedCouponCode = res.code || code;
  if ($("#promoInput")) $("#promoInput").value = "";
  setPromoMsg(`Promo code ${appliedCouponCode} applied!`, "ok");
  renderCart();
  toast(`Promo ${appliedCouponCode} applied`);
}

$("#applyPromoBtn")?.addEventListener("click", () => applyPromoCode($("#promoInput").value));
$("#promoInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    applyPromoCode($("#promoInput").value);
  }
});
$("#removePromoBtn")?.addEventListener("click", () => {
  appliedCouponCode = "";
  setPromoMsg("Promo code removed.");
  renderCart();
});
document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-promo]");
  if (chip) {
    applyPromoCode(chip.dataset.promo);
  }
});

function bump() {
  const b = $("#cartBtn");
  b.classList.remove("bump");
  void b.offsetWidth;
  b.classList.add("bump");
}

/* ---------- Drawer + dialogs ---------- */
let lastFocus;
function openCart(open) {
  const d = $("#drawer");
  if (open === d.classList.contains("open")) return;
  d.classList.toggle("open", open);
  $("#overlay").classList.toggle("show", open);
  d.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("lock", open);
  if (open) {
    lastFocus = document.activeElement;
    setTimeout(() => $("#closeCart").focus(), 50);
  } else if (lastFocus) {
    lastFocus.focus();
  }
}

function changeQty(id, delta) {
  const p = byId(id);
  if (!p) {
    delete cart[id];
    return false;
  }
  const st = getStockInfo(p);
  const cur = cart[id] || 0;
  if (delta > 0) {
    if (st.status === "out" || st.stock <= 0) {
      toast(`${p.name} is sold out`);
      return false;
    }
    if (cur + delta > st.stock) {
      cart[id] = st.stock;
      toast(`Only ${st.stock} ${p.name} available in stock`);
      return false;
    }
  }
  const next = cur + delta;
  if (next <= 0) delete cart[id];
  else cart[id] = next;
  return true;
}

function showCategory(c) {
  cat = c;
  renderChips();
  renderProducts();
  syncCards();
  $("#shop").scrollIntoView({ behavior: "smooth" });
}

/* ---------- Product Quick-View Dialog ---------- */
function renderQuickViewControls(p) {
  if (!p) return;
  const st = getStockInfo(p);
  $("#qvStock").className = `stock-badge ${st.status}`;
  $("#qvStock").textContent = st.detailLabel;

  const q = cart[p.id] || 0;
  if (st.status === "out") {
    $("#qvCtl").innerHTML = `<button class="primary" type="button" disabled>Sold out</button>`;
  } else if (!q) {
    $("#qvCtl").innerHTML = `<button class="primary qv-add-btn" type="button" data-qv-add="${p.id}">Add to cart · ${peso(p.price)}</button>`;
  } else {
    $("#qvCtl").innerHTML = `<div class="stepper lg" role="group" aria-label="${esc(p.name)} quantity">
      <button type="button" data-qv-step="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">−</button>
      <span aria-live="polite">${q} in cart</span>
      <button type="button" data-qv-step="inc" data-id="${p.id}" ${q >= st.stock ? "disabled" : ""} aria-label="Add one more ${esc(p.name)}">+</button>
    </div>`;
  }
}

function openQuickView(id) {
  const p = byId(id);
  if (!p) return;
  activeQuickViewId = p.id;
  $("#qvPicWrap").className = `qv-pic ${p.cat.toLowerCase()}`;
  $("#qvImg").src = p.img;
  $("#qvImg").alt = p.name;
  $("#qvImg").className = p.cover ? "cover" : "";
  if (p.badge) {
    $("#qvBadge").textContent = p.badge;
    $("#qvBadge").hidden = false;
  } else {
    $("#qvBadge").hidden = true;
  }
  $("#qvCat").textContent = p.cat;
  $("#qvSku").textContent = `SKU: ${p.sku || "PC-00" + p.id}`;
  $("#qvTitle").textContent = p.name;
  $("#qvPrice").textContent = peso(p.price);
  if (Number(p.comparePrice) > Number(p.price)) {
    $("#qvComparePrice").textContent = peso(p.comparePrice);
    $("#qvComparePrice").hidden = false;
  } else {
    $("#qvComparePrice").hidden = true;
  }
  $("#qvDesc").textContent = p.longDesc || p.desc;
  renderQuickViewControls(p);
  openDlg($("#productDlg"));
}

$("#productDlg")?.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-qv-add]");
  const stepBtn = e.target.closest("[data-qv-step]");
  if (addBtn) {
    const id = addBtn.dataset.qvAdd;
    if (changeQty(id, 1)) {
      renderCart();
      bump();
      toast(`Added ${byId(id).name}`);
    }
  } else if (stepBtn) {
    const id = stepBtn.dataset.id;
    const delta = stepBtn.dataset.qvStep === "inc" ? 1 : -1;
    changeQty(id, delta);
    renderCart();
    if (delta > 0) bump();
  }
});
$("#qvCartBtn")?.addEventListener("click", () => {
  $("#productDlg").close();
  openCart(true);
});

$("#products").addEventListener("click", (e) => {
  if (e.target.closest('[data-action="clear-filters"]')) {
    query = "";
    cat = "All";
    $("#search").value = "";
    renderChips();
    renderProducts();
    syncCards();
    return;
  }
  const add = e.target.closest(".add");
  const step = e.target.closest("button[data-step]");
  if (add) {
    if (add.disabled) return;
    const id = add.dataset.id;
    if (changeQty(id, 1)) {
      renderCart();
      bump();
      toast(`Added ${byId(id).name}`);
    }
    const s = document.querySelector(`.card[data-id="${id}"] [data-step="inc"]`);
    if (s) s.focus();
    return;
  }
  if (step) {
    const id = step.dataset.id;
    const isInc = step.dataset.step === "inc";
    changeQty(id, isInc ? 1 : -1);
    renderCart();
    if (isInc) bump();
    const again = document.querySelector(`.card[data-id="${id}"] [data-step="${step.dataset.step}"]`)
      || document.querySelector(`.card[data-id="${id}"] .add`);
    if (again && !again.disabled) again.focus();
    return;
  }
  // Open Quick-View when clicking product card image or title
  if (!e.target.closest(".ctl")) {
    const qvTarget = e.target.closest("[data-qv]");
    if (qvTarget) {
      openQuickView(qvTarget.dataset.qv);
    }
  }
});

$("#chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  cat = b.dataset.cat;
  renderChips();
  renderProducts();
  syncCards();
});
$("#cats").addEventListener("click", (e) => {
  const b = e.target.closest(".cat");
  if (b) showCategory(b.dataset.cat);
});
$("#search").addEventListener("input", (e) => {
  query = e.target.value;
  renderProducts();
  syncCards();
});
$("#sort").addEventListener("change", (e) => {
  sort = e.target.value;
  renderProducts();
  syncCards();
});

$("#items").addEventListener("click", (e) => {
  if (e.target.closest('[data-action="browse-shop"]')) {
    openCart(false);
    location.hash = "#shop";
    return;
  }
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === "inc") changeQty(id, 1);
  if (b.dataset.act === "dec") changeQty(id, -1);
  if (b.dataset.act === "rm") delete cart[id];
  renderCart();
});

$("#cartBtn").onclick = () => openCart(true);
$("#miniCart").onclick = () => openCart(true);
$("#closeCart").onclick = () => openCart(false);
$("#overlay").onclick = () => openCart(false);
document.addEventListener("keydown", (e) => e.key === "Escape" && openCart(false));

$("#footCats").addEventListener("click", (e) => {
  const a = e.target.closest("a[data-cat]");
  if (!a) return;
  cat = a.dataset.cat;
  renderChips();
  renderProducts();
  syncCards();
});
$("#year").textContent = new Date().getFullYear();

/* ---------- Payment Method Hint ---------- */
function updatePaymentHint() {
  const f = $("#checkoutForm");
  const hint = $("#paymentHint");
  if (!f || !hint) return;
  const method = f.elements.paymentMethod?.value || "COD";
  const s = getSettings();
  if (method === "GCash") {
    hint.textContent = `Send via GCash to ${s.gcashNumber || "0917 555 0143 (Pasalubong Corner)"}. Details included in your email receipt.`;
  } else if (method === "Bank Transfer") {
    hint.textContent = "Bank transfer instructions (BPI / BDO) will be sent with your order confirmation.";
  } else {
    hint.textContent = "Pay with cash upon doorstep delivery.";
  }
}
$("#checkoutForm")?.addEventListener("change", (e) => {
  if (e.target.name === "paymentMethod") updatePaymentHint();
});

/* ---------- Generic form helpers ---------- */
const VALIDATORS = {};
function setErrors(form, errs) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const p = form.querySelector(`[data-err="${el.name}"]`);
    if (!p) continue;
    const m = errs[el.name] || "";
    p.textContent = m;
    el.setAttribute("aria-invalid", String(!!m));
  }
}
const formData = (form) => Object.fromEntries(new FormData(form));
function setMsg(form, text, kind = "") {
  const m = form.querySelector("[data-msg]") || $("#msg");
  m.className = form.id === "checkoutForm" ? kind : "form-msg " + kind;
  m.textContent = text;
}
document.querySelectorAll("form").forEach((form) => {
  form.querySelectorAll("[data-err]").forEach((p) => {
    p.id = `${form.id}-e-${p.dataset.err}`;
    const input = form.elements[p.dataset.err];
    if (input && input.setAttribute) input.setAttribute("aria-describedby", p.id);
  });
  form.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.name || el.getAttribute("aria-invalid") !== "true" || !VALIDATORS[form.id]) return;
    const all = VALIDATORS[form.id](formData(form));
    const p = form.querySelector(`[data-err="${el.name}"]`);
    const m = all[el.name] || "";
    p.textContent = m;
    el.setAttribute("aria-invalid", String(!!m));
  });
});
document.querySelectorAll(".pw-toggle").forEach((b) => b.addEventListener("click", () => {
  const input = b.previousElementSibling, show = input.type === "password";
  input.type = show ? "text" : "password";
  b.textContent = show ? "Hide" : "Show";
  b.setAttribute("aria-pressed", String(show));
  b.setAttribute("aria-label", show ? "Hide password" : "Show password");
}));

const reEmail = /^\S+@\S+\.\S+$/;
const validName = (d, e) => { if (!d.name.trim()) e.name = "Enter your full name."; };
const validPhone = (d, e, required) => {
  if (!d.phone.trim()) { if (required) e.phone = "Enter a phone number we can reach you on."; }
  else if (d.phone.replace(/\D/g, "").length < 7) e.phone = "That phone number looks too short.";
};
VALIDATORS.checkoutForm = (d) => {
  const e = {};
  validName(d, e);
  if (!d.email.trim()) e.email = "Enter your email so we can send the receipt.";
  else if (!reEmail.test(d.email.trim())) e.email = "Enter a valid email, like you@email.com.";
  validPhone(d, e, true);
  if (!d.address.trim()) e.address = "Enter your delivery address.";
  return e;
};
VALIDATORS.loginForm = (d) => {
  const e = {};
  if (!d.email.trim()) e.email = "Enter your email.";
  else if (!reEmail.test(d.email.trim())) e.email = "Enter a valid email, like you@email.com.";
  if (!d.password) e.password = "Enter your password.";
  return e;
};
VALIDATORS.signupForm = (d) => {
  const e = {};
  validName(d, e);
  if (!d.email.trim()) e.email = "Enter your email.";
  else if (!reEmail.test(d.email.trim())) e.email = "Enter a valid email, like you@email.com.";
  if (!d.password) e.password = "Create a password.";
  else if (d.password.length < 8) e.password = "Use at least 8 characters.";
  if (d.name.trim().length > 200) e.name = "Use 200 characters or fewer.";
  return e;
};
VALIDATORS.profileForm = (d) => {
  const e = {};
  validName(d, e);
  validPhone(d, e, false);
  if (d.name.trim().length > 200) e.name = "Use 200 characters or fewer.";
  if (d.phone.trim().length > 100) e.phone = "Use 100 characters or fewer.";
  if (d.address.trim().length > 1000) e.address = "Use 1,000 characters or fewer.";
  return e;
};

/* ---------- Customer accounts ---------- */
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
async function getLegacyProfile(email, password) {
  const profile = read("pc_users", {})[email];
  if (!/^[a-f\d]{32}$/i.test(profile?.salt || "") || typeof profile.hash !== "string") return null;
  const salt = fromHex(profile.salt);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return toHex(bits) === profile.hash ? profile : null;
}

let customerAccountsPromise;
let customerSession = null;
let accountActionPending = false;
const currentEmail = () => customerSession?.user.email || null;
const currentUser = () => customerSession?.profile || null;
const ordersKey = (email) => "pc_orders_" + email;
const initial = (name) => (name.trim()[0] || "?").toUpperCase();

function setCustomerSession(user, profile) {
  if (customerSession && customerSession.user.uid !== user?.uid) {
    $("#acctDlg").close();
    $("#checkoutForm").reset();
    updatePaymentHint();
  }
  customerSession = user ? { user, profile } : null;
  renderAuthUI();
  prefillCheckout();
}

function loadCustomerAccounts() {
  if (!customerAccountsPromise) {
    customerAccountsPromise = (async () => {
      const [app, { connectCustomerAccounts }] = await Promise.all([
        getDB().getFirebaseApp(),
        import("./customer-accounts.js?v=1")
      ]);
      const accounts = connectCustomerAccounts(app);
      accounts.subscribe(async (user) => {
        if (accountActionPending) return;
        if (!user) {
          setCustomerSession(null);
          return;
        }
        if (customerSession && customerSession.user.uid !== user.uid) {
          setCustomerSession(null);
        }
        try {
          const profile = await accounts.getOrCreateProfile(user);
          if (!accountActionPending && accounts.currentUser()?.uid === user.uid) {
            setCustomerSession(user, profile);
          }
        } catch (err) {
          console.warn("Could not load the customer profile", err);
        }
      });
      return accounts;
    })().catch((err) => {
      customerAccountsPromise = null;
      throw err;
    });
  }
  return customerAccountsPromise;
}

const invalidCredentials = new Set([
  "auth/invalid-credential", "auth/invalid-login-credentials", "auth/user-not-found", "auth/wrong-password"
]);

function customerAccountError(err) {
  if (invalidCredentials.has(err.code)) return "Incorrect email or password.";
  if (err.code === "auth/email-already-in-use") return "An account with this email already exists. Try logging in.";
  if (err.code === "auth/weak-password" || err.code === "auth/password-does-not-meet-requirements") {
    return "Choose a stronger password and try again.";
  }
  if (err.code === "auth/invalid-email") return "Enter a valid email address.";
  if (err.code === "auth/too-many-requests") return "Too many attempts. Wait a moment and try again.";
  return "We couldn’t connect to your account. Please try again.";
}

function renderAuthUI() {
  const u = currentUser();
  const av = $("#acctAvatar");
  if (u) {
    av.textContent = initial(u.name);
    av.classList.add("on");
    $("#acctLabel").textContent = u.name.trim().split(/\s+/)[0];
    $("#acctBtn").setAttribute("aria-label", `My account, ${u.name}`);
  } else {
    av.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>`;
    av.classList.remove("on");
    $("#acctLabel").textContent = "Log in";
    $("#acctBtn").setAttribute("aria-label", "Log in or create account");
  }
  $("#guestNudge").hidden = !!u;
}

function prefillCheckout() {
  const u = currentUser(), f = $("#checkoutForm");
  if (!u || !f) return;
  const fill = (n, v) => { if (v && !f.elements[n].value) f.elements[n].value = v; };
  fill("name", u.name);
  fill("email", currentEmail());
  fill("phone", u.phone);
  fill("address", u.address);
}

function openDlg(dlg) { if (dlg && !dlg.open) dlg.showModal(); }
document.querySelectorAll(".dlg").forEach((d) => {
  d.querySelector("[data-close]")?.addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
});

function setAuthTab(tab) {
  const login = tab === "login";
  $("#tabLogin").setAttribute("aria-selected", String(login));
  $("#tabSignup").setAttribute("aria-selected", String(!login));
  $("#loginForm").hidden = !login;
  $("#signupForm").hidden = login;
  $("#authTitle").textContent = login ? "Welcome back" : "Create your account";
  $("#authSub").textContent = login ? "Log in to see your orders and check out faster." : "Save your delivery details and find your orders on any device.";
}
function openAuth(tab = "login") {
  if (currentUser()) return openAccount();
  openCart(false);
  setAuthTab(tab);
  [$("#loginForm"), $("#signupForm")].forEach((f) => { setErrors(f, {}); setMsg(f, ""); });
  openDlg($("#authDlg"));
  setTimeout(() => $(tab === "login" ? "#l-email" : "#s-name").focus(), 30);
}
$("#tabLogin").onclick = () => setAuthTab("login");
$("#tabSignup").onclick = () => setAuthTab("signup");
$("#acctBtn").onclick = () => openAuth("login");
$("#heroSignup").onclick = () => openAuth("signup");
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-open-auth]");
  if (b) openAuth(b.dataset.openAuth);
});

async function submitCustomerAccount(e) {
  e.preventDefault();
  if (accountActionPending) return;
  const f = e.target, d = formData(f), btn = f.querySelector(".primary");
  const signup = f.id === "signupForm";
  const errs = VALIDATORS[f.id](d); setErrors(f, errs); setMsg(f, "");
  const bad = Object.keys(errs)[0]; if (bad) { f.elements[bad].focus(); return; }
  const email = d.email.trim().toLowerCase();
  if (signup && Object.hasOwn(read("pc_users", {}), email)) {
    setMsg(f, "This email already has an account on this browser. Log in to move it online.", "err");
    return;
  }
  accountActionPending = true;
  btn.disabled = true; btn.classList.add("loading");
  let accounts;
  let user;
  let legacy;
  try {
    accounts = await loadCustomerAccounts();
    if (signup) {
      user = await accounts.create(email, d.password, d.name.trim());
    } else {
      legacy = await getLegacyProfile(email, d.password);
      try {
        user = await accounts.signIn(email, d.password);
      } catch (err) {
        if (!legacy || !invalidCredentials.has(err.code)) throw err;
        user = await accounts.create(email, d.password, legacy.name);
      }
    }
    const profile = await accounts.getOrCreateProfile(user, signup ? { name: d.name } : legacy || {});
    if (accounts.currentUser()?.uid !== user.uid) return;
    setCustomerSession(user, profile);
    if (legacy) {
      const users = read("pc_users", {});
      delete users[email];
      write("pc_users", users);
    }
    write("pc_session", null);
    f.reset(); $("#authDlg").close();
    toast(`${signup ? "Welcome" : "Welcome back"}, ${profile.name.trim().split(/\s+/)[0]}!`);
  } catch (err) {
    if (user && accounts.currentUser()?.uid === user.uid) await accounts.signOut().catch(() => {});
    const message = user
      ? "We couldn’t load your saved profile. Please log in again to retry."
      : customerAccountError(err);
    setMsg(f, message, "err");
  } finally {
    accountActionPending = false;
    btn.disabled = false; btn.classList.remove("loading");
  }
}
$("#signupForm").addEventListener("submit", submitCustomerAccount);
$("#loginForm").addEventListener("submit", submitCustomerAccount);

/* ---------- Order Status & Account Order History ---------- */
function statusSlug(status) {
  return String(status || "Pending").trim().toLowerCase().replace(/\s+/g, "-");
}

function getCustomerOrders(email) {
  if (!email) return [];
  const db = getDB();
  if (db && typeof db.getOrdersByEmail === "function") {
    return db.getOrdersByEmail(email);
  }
  return read(ordersKey(email), []);
}

function renderOrders() {
  const email = currentEmail();
  const orders = getCustomerOrders(email);
  $("#orders").innerHTML = orders.length ? orders.map((o) => {
    const st = o.status || "Pending";
    const orderNo = o.no || o.orderNo || "ORDER";
    const dateStr = new Date(o.date || Date.now()).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric"
    });
    return `
    <div class="order">
      <div class="order-top">
        <span class="order-no">${esc(orderNo)}</span>
        <span class="status-pill status-${esc(statusSlug(st))}">${esc(st)}</span>
        <span class="order-total">${peso(o.total)}</span>
      </div>
      <div class="order-meta">
        <small>${esc(dateStr)}${o.paymentMethod ? ` · ${esc(o.paymentMethod)}` : ""}</small>
        <button type="button" class="track-mini-btn" data-track-order="${esc(orderNo)}">Track →</button>
      </div>
      <ul>${(o.items || []).map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}</ul>
    </div>`;
  }).join("") : `<p class="orders-empty">No orders yet. Your orders will show up here after checkout.</p>`;
}

function openAccount() {
  const u = currentUser(); if (!u) return;
  openCart(false);
  $("#acctAvatarLg").textContent = initial(u.name);
  $("#acctEmail").textContent = currentEmail();
  const f = $("#profileForm");
  f.elements.name.value = u.name; f.elements.phone.value = u.phone || ""; f.elements.address.value = u.address || "";
  setErrors(f, {}); setMsg(f, "");
  renderOrders(); openDlg($("#acctDlg"));
}

async function saveCustomerDetails(session, details) {
  const accounts = await loadCustomerAccounts();
  if (accounts.currentUser()?.uid !== session.user.uid) return false;
  await accounts.updateDetails(session.user, details);
  if (customerSession?.user.uid === session.user.uid) {
    Object.assign(customerSession.profile, details);
    renderAuthUI();
    return true;
  }
  return false;
}

$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!customerSession) return;
  const f = e.target, d = formData(f);
  const errs = VALIDATORS.profileForm(d); setErrors(f, errs);
  const bad = Object.keys(errs)[0]; if (bad) { f.elements[bad].focus(); return; }
  const btn = f.querySelector(".primary");
  btn.disabled = true;
  try {
    const saved = await saveCustomerDetails(customerSession, {
      name: d.name.trim(),
      phone: d.phone.trim(),
      address: d.address.trim()
    });
    if (!saved) return;
    $("#acctAvatarLg").textContent = initial(d.name);
    setMsg(f, "Details saved.", "ok");
  } catch (err) {
    setMsg(f, "We couldn’t save your details. Please try again.", "err");
  } finally {
    btn.disabled = false;
  }
});
$("#logoutBtn").onclick = async () => {
  try {
    const accounts = await loadCustomerAccounts();
    await accounts.signOut();
    setCustomerSession(null);
    toast("You’ve been logged out");
  } catch (err) {
    toast("We couldn’t log you out. Please try again.");
  }
};

/* ---------- Order Tracking Modal (#trackDlg) ---------- */
const TRACK_STEPS = ["Pending", "Confirmed", "Packing", "Out for Delivery", "Delivered"];

function findOrderByNo(orderNo) {
  const clean = String(orderNo || "").trim().toUpperCase();
  if (!clean) return null;
  const db = getDB();
  if (db && typeof db.getOrderByNo === "function") {
    const found = db.getOrderByNo(clean);
    if (found) return found;
  }
  // Fallback scan in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("pc_orders_")) {
        const list = read(k, []);
        const match = list.find((o) => String(o.no || o.orderNo || "").toUpperCase() === clean);
        if (match) return match;
      }
    }
  } catch (e) {}
  return null;
}

function renderTrackOrderResult(order) {
  const box = $("#trackResult");
  if (!box) return;
  if (!order) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const orderNo = order.no || order.orderNo || "ORDER";
  const status = order.status || "Pending";
  const dateStr = new Date(order.date || Date.now()).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const cust = order.customer || {
    name: order.name || "",
    email: order.email || "",
    phone: order.phone || "",
    address: order.address || "",
  };
  const stepIdx = TRACK_STEPS.findIndex((s) => s.toLowerCase() === status.toLowerCase());
  const isCancelled = status.toLowerCase() === "cancelled";

  const pipelineHtml = isCancelled
    ? `<div class="track-cancelled">This order was <strong>Cancelled</strong>. If you have questions, please contact support.</div>`
    : `<div class="track-steps" aria-label="Order progress">
        ${TRACK_STEPS.map((s, idx) => {
          const state = idx < stepIdx ? "done" : (idx === stepIdx ? "current" : "todo");
          return `<div class="track-step ${state}">
            <span class="step-dot">${idx <= stepIdx ? "✓" : idx + 1}</span>
            <span class="step-label">${esc(s)}</span>
          </div>`;
        }).join("")}
      </div>`;

  const itemsHtml = (order.items || []).map((it) => `
    <div class="track-item">
      <span><strong>${esc(it.name)}</strong> × ${it.qty}</span>
      <span>${peso((Number(it.price) || 0) * (Number(it.qty) || 1))}</span>
    </div>
  `).join("");

  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const discount = Number(order.discount ?? 0);
  const deliveryFee = Number(order.deliveryFee ?? 0);

  box.innerHTML = `
    <div class="track-card">
      <div class="track-card-head">
        <div>
          <span class="kicker dark">Order #${esc(orderNo)}</span>
          <h3>Status: <span class="status-pill status-${esc(statusSlug(status))}">${esc(status)}</span></h3>
          <small>Placed on ${esc(dateStr)}</small>
        </div>
        <div class="track-total-pill">
          <small>Total</small>
          <strong>${peso(order.total)}</strong>
        </div>
      </div>

      ${pipelineHtml}

      <div class="track-cols">
        <div class="track-panel">
          <h4>Items ordered</h4>
          <div class="track-items-list">${itemsHtml}</div>
          <div class="track-summary">
            <div><span>Subtotal</span><span>${peso(subtotal)}</span></div>
            ${discount > 0 ? `<div class="disc"><span>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ""}</span><span>−${peso(discount)}</span></div>` : ""}
            <div><span>Delivery</span><span>${deliveryFee === 0 ? "Free" : peso(deliveryFee)}</span></div>
            <div class="tot"><span>Total</span><strong>${peso(order.total)}</strong></div>
          </div>
        </div>
        <div class="track-panel">
          <h4>Delivery details</h4>
          <p><strong>${esc(cust.name || "Customer")}</strong></p>
          ${cust.address ? `<p>${esc(cust.address)}</p>` : ""}
          ${cust.phone ? `<p>${esc(cust.phone)}</p>` : ""}
          ${cust.email ? `<p>${esc(cust.email)}</p>` : ""}
          <p class="track-pay">Payment: <strong>${esc(order.paymentMethod || "COD")}</strong></p>
          ${order.notes ? `<p class="track-notes">Notes: “${esc(order.notes)}”</p>` : ""}
        </div>
      </div>
    </div>
  `;
  box.hidden = false;
}

function openTrackModal(prefillNo = "") {
  openCart(false);
  if ($("#acctDlg")?.open) $("#acctDlg").close();
  const input = $("#trackInput");
  setMsg($("#trackForm"), "");
  if (prefillNo) {
    activeTrackOrderNo = prefillNo.trim().toUpperCase();
    input.value = activeTrackOrderNo;
    const found = findOrderByNo(activeTrackOrderNo);
    if (found) {
      renderTrackOrderResult(found);
    } else {
      renderTrackOrderResult(null);
      setMsg($("#trackForm"), `No order found matching "${activeTrackOrderNo}".`, "err");
    }
  } else if (!activeTrackOrderNo) {
    renderTrackOrderResult(null);
  }
  openDlg($("#trackDlg"));
  setTimeout(() => input?.focus(), 30);
}

$("#trackBtn")?.addEventListener("click", () => openTrackModal());
$("#footTrackBtn")?.addEventListener("click", () => openTrackModal());

$("#trackForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = ($("#trackInput").value || "").trim().toUpperCase();
  if (!code) {
    setMsg($("#trackForm"), "Please enter an order number (e.g. ORD-...).", "err");
    renderTrackOrderResult(null);
    return;
  }
  activeTrackOrderNo = code;
  const order = findOrderByNo(code);
  if (!order) {
    setMsg($("#trackForm"), `We couldn’t find order "${code}". Check the number and try again.`, "err");
    renderTrackOrderResult(null);
    return;
  }
  setMsg($("#trackForm"), "");
  renderTrackOrderResult(order);
});

document.addEventListener("click", (e) => {
  const trackBtn = e.target.closest("[data-track-order]");
  if (trackBtn) {
    openTrackModal(trackBtn.dataset.trackOrder);
  }
});

/* ---------- Checkout ---------- */
let checkoutConfirmationTimer;
$("#checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearTimeout(checkoutConfirmationTimer);
  const checkoutSession = customerSession;
  const f = e.target, btn = $("#placeBtn");
  const data = formData(f);
  setMsg(f, "");
  const errs = VALIDATORS.checkoutForm(data); setErrors(f, errs);
  const bad = Object.keys(errs)[0];
  if (bad) { setMsg(f, "Please fix the highlighted fields.", "err"); f.elements[bad].focus(); return; }

  const totals = computeCartTotals();
  if (!totals.ids.length) {
    setMsg(f, "Your cart is empty.", "err");
    return;
  }

  const fullItems = totals.ids.map((id) => {
    const p = byId(id), qty = cart[id];
    return {
      id: Number(p.id),
      name: p.name,
      price: Number(p.price),
      qty: Number(qty),
      img: p.img,
      cat: p.cat,
    };
  });

  const payload = {
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    paymentMethod: data.paymentMethod || "COD",
    notes: (data.notes || "").trim(),
    couponCode: (totals.couponRes && totals.couponRes.valid) ? (totals.couponRes.code || appliedCouponCode) : "",
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    total: totals.total,
    items: fullItems,
  };

  btn.disabled = true; btn.classList.add("loading"); setMsg(f, "Placing your order…");
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Something went wrong.");

    const orderNo = out.orderNo || ("ORD-" + Date.now().toString(36).toUpperCase());
    const orderRecord = {
      no: orderNo,
      orderNo,
      date: Date.now(),
      updatedAt: Date.now(),
      status: "Pending",
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      customer: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
      },
      paymentMethod: payload.paymentMethod,
      notes: payload.notes,
      couponCode: payload.couponCode,
      subtotal: payload.subtotal,
      discount: payload.discount,
      deliveryFee: payload.deliveryFee,
      total: payload.total,
      items: fullItems,
    };

    const db = getDB();
    if (db && typeof db.recordOrder === "function") {
      await db.recordOrder(orderRecord);
    } else {
      const targetEmail = checkoutSession?.user.email || payload.email.toLowerCase();
      const orders = read(ordersKey(targetEmail), []);
      orders.unshift(orderRecord);
      write(ordersKey(targetEmail), orders.slice(0, 50));
    }

    if (checkoutSession) {
      saveCustomerDetails(checkoutSession, {
        phone: payload.phone.slice(0, 100),
        address: payload.address.slice(0, 1000)
      }).catch((err) => console.warn("Could not save delivery details to the customer profile", err));
    }

    const msgEl = $("#msg");
    msgEl.className = "ok";
    msgEl.innerHTML = `Order <strong>${esc(orderNo)}</strong> placed! Check your email for the receipt. <button type="button" class="linkish" data-track-order="${esc(orderNo)}">Track order →</button>`;

    cart = {};
    appliedCouponCode = "";
    setPromoMsg("");
    renderCart();
    f.reset();
    ["name", "email", "phone", "address", "notes"].forEach((k) => {
      if (f.elements[k]) f.elements[k].value = "";
    });
    if ($("#couponInput")) $("#couponInput").value = "";
    if ($("#promoInput")) $("#promoInput").value = "";
    setErrors(f, {});
    updatePaymentHint();
    if ($("#drawer").classList.contains("open")) {
      msgEl.scrollIntoView({ block: "nearest" });
    }
    checkoutConfirmationTimer = setTimeout(() => {
      if (msgEl.contains(document.activeElement) && $("#drawer").classList.contains("open")) {
        $("#closeCart").focus();
      }
      setMsg(f, "");
      renderCart();
    }, 2000);
  } catch (err) {
    setMsg(f, err.message + " Your cart is saved, try again.", "err");
    btn.disabled = false;
  } finally {
    btn.classList.remove("loading");
  }
});

/* ---------- Live Database Subscription ---------- */
function refreshStorefront() {
  renderSettingsBanner();
  renderCats();
  renderFootCats();
  renderChips();
  renderProducts();
  renderCart();
  if ($("#acctDlg")?.open && currentUser()) {
    renderOrders();
  }
  if ($("#trackDlg")?.open && activeTrackOrderNo) {
    const updatedOrder = findOrderByNo(activeTrackOrderNo);
    if (updatedOrder) renderTrackOrderResult(updatedOrder);
  }
  if ($("#productDlg")?.open && activeQuickViewId != null) {
    const p = byId(activeQuickViewId);
    if (p) renderQuickViewControls(p);
  }
}

refreshStorefront();
renderAuthUI();
loadCustomerAccounts().catch((err) => console.warn("Could not connect customer accounts", err));

if (window.PasalubongDB && typeof window.PasalubongDB.subscribe === "function") {
  window.PasalubongDB.subscribe(() => {
    refreshStorefront();
  });
}
