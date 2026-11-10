const PRODUCTS = [
  { id: 1, name: "Dried mangoes", desc: "Sweet, chewy, 200g pack", price: 180, cat: "Snacks", img: "images/01.jpg", badge: "Bestseller" },
  { id: 2, name: "Otap biscuits", desc: "Flaky puff pastry, box of 10", price: 120, cat: "Snacks", img: "images/02.jpg" },
  { id: 3, name: "Rosquillos", desc: "Crisp butter cookies, 250g", price: 150, cat: "Snacks", img: "images/03.jpg" },
  { id: 4, name: "Sinamay tote bag", desc: "Handwoven, fits a laptop", price: 450, cat: "Crafts", img: "images/04.jpg", badge: "Handmade" },
  { id: 5, name: "Mini guitar keychain", desc: "Handmade in Mactan", price: 95, cat: "Crafts", img: "images/05.jpg" },
  { id: 6, name: "Cebu t-shirt", desc: "Cotton, sizes S to XL", price: 350, cat: "Apparel", img: "images/06.jpg" },
];
const CATS = ["All", "Snacks", "Crafts", "Apparel"];

const $ = (s) => document.querySelector(s);
const peso = (n) => "₱" + n.toLocaleString("en-PH");
const byId = (id) => PRODUCTS.find((p) => p.id === Number(id));
let cart = {}, query = "", cat = "All", sort = "featured";
try { cart = JSON.parse(localStorage.getItem("cart")) || {}; } catch (e) {}
const save = () => { try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {} };

const ICON_PLUS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_BAG = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`;

let toastTimer;
function toast(text) {
  const t = $("#toast"); t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

function renderChips() {
  $("#chips").innerHTML = CATS.map((c) => {
    const n = c === "All" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c).length;
    return `<button class="chip" data-cat="${c}" aria-pressed="${c === cat}">${c}<span class="n">${n}</span></button>`;
  }).join("");
}

function buyControl(p) {
  const q = cart[p.id] || 0;
  if (!q) return `<button class="add" data-id="${p.id}" aria-label="Add ${p.name} to cart">${ICON_PLUS}<span>Add</span></button>`;
  return `<div class="stepper" role="group" aria-label="${p.name} quantity">
      <button data-step="dec" data-id="${p.id}" aria-label="Remove one ${p.name}">−</button>
      <span aria-live="polite">${q}</span>
      <button data-step="inc" data-id="${p.id}" aria-label="Add one more ${p.name}">+</button>
    </div>`;
}

function renderProducts() {
  const term = query.trim().toLowerCase();
  let list = PRODUCTS.filter((p) => (cat === "All" || p.cat === cat) && (p.name + " " + p.desc + " " + p.cat).toLowerCase().includes(term));
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

  $("#resultCount").textContent = `${list.length} ${list.length === 1 ? "product" : "products"}`;
  if (!list.length) {
    $("#products").innerHTML = `<div class="none">
      <strong>No products match “${query.replace(/[<>&"]/g, "")}”.</strong>
      <p>Try another word or category.</p>
      <button class="link-btn" id="clearFilters">Clear filters</button>
    </div>`;
    return;
  }
  $("#products").innerHTML = list.map((p, i) => `
    <article class="card" data-id="${p.id}" style="--i:${i}">
      <div class="pic">
        <img src="${p.img}" alt="${p.name}" loading="lazy">
        <span class="tag">${p.cat}</span>
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
      </div>
      <div class="body">
        <h3>${p.name}</h3><p>${p.desc}</p>
        <div class="buy"><span class="price">${peso(p.price)}</span>
          <div class="buy-ctl">${buyControl(p)}</div>
        </div>
      </div>
    </article>`).join("");
}

// Update only the buttons on visible cards so images don't re-render.
function syncCards() {
  document.querySelectorAll(".card").forEach((card) => {
    const p = byId(card.dataset.id);
    card.querySelector(".buy-ctl").innerHTML = buyControl(p);
    card.classList.toggle("in-cart", !!cart[p.id]);
  });
}

function renderCart() {
  const ids = Object.keys(cart).filter((id) => byId(id));
  let total = 0, count = 0;
  $("#items").innerHTML = ids.length ? ids.map((id) => {
    const p = byId(id), q = cart[id];
    total += p.price * q; count += q;
    return `<div class="row">
      <img src="${p.img}" alt="">
      <div class="row-info">
        <strong>${p.name}</strong>
        <small>${peso(p.price)} each</small>
      </div>
      <span class="row-sub">${peso(p.price * q)}</span>
      <div class="qty">
        <div class="stepper sm">
          <button data-act="dec" data-id="${id}" aria-label="Less ${p.name}">−</button><span>${q}</span>
          <button data-act="inc" data-id="${id}" aria-label="More ${p.name}">+</button>
        </div>
        <button class="rm" data-act="rm" data-id="${id}">Remove</button>
      </div></div>`;
  }).join("") : `<div class="empty">
      <span class="empty-ico">${ICON_BAG}</span>
      <strong>Your cart is empty</strong>
      <p>Add something from the shop to get started.</p>
      <button class="link-btn" id="browseBtn">Browse products</button>
    </div>`;
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

function bump() {
  const b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
}

let lastFocus;
function openCart(open) {
  const d = $("#drawer");
  if (open === d.classList.contains("open")) return;
  d.classList.toggle("open", open);
  $("#overlay").classList.toggle("show", open);
  d.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("lock", open);
  if (open) { lastFocus = document.activeElement; setTimeout(() => $("#closeCart").focus(), 50); }
  else if (lastFocus) lastFocus.focus();
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
}

$("#products").addEventListener("click", (e) => {
  if (e.target.closest("#clearFilters")) {
    query = ""; cat = "All"; $("#search").value = ""; renderChips(); renderProducts(); syncCards(); return;
  }
  const add = e.target.closest(".add");
  const step = e.target.closest("button[data-step]");
  if (add) {
    changeQty(add.dataset.id, 1);
    renderCart(); bump(); toast(`Added ${byId(add.dataset.id).name}`);
    const s = document.querySelector(`.card[data-id="${add.dataset.id}"] [data-step="inc"]`); if (s) s.focus();
  } else if (step) {
    const id = step.dataset.id;
    changeQty(id, step.dataset.step === "inc" ? 1 : -1);
    renderCart();
    if (step.dataset.step === "inc") bump();
    const again = document.querySelector(`.card[data-id="${id}"] [data-step="${step.dataset.step}"]`)
      || document.querySelector(`.card[data-id="${id}"] .add`);
    if (again) again.focus();
  }
});
$("#chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  cat = b.dataset.cat; renderChips(); renderProducts(); syncCards();
});
$("#search").addEventListener("input", (e) => { query = e.target.value; renderProducts(); syncCards(); });
$("#sort").addEventListener("change", (e) => { sort = e.target.value; renderProducts(); syncCards(); });

$("#items").addEventListener("click", (e) => {
  if (e.target.closest("#browseBtn")) { openCart(false); location.hash = "#shop"; return; }
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === "inc") cart[id]++;
  if (b.dataset.act === "dec") cart[id]--;
  if (b.dataset.act === "rm" || cart[id] <= 0) delete cart[id];
  renderCart();
});

$("#cartBtn").onclick = () => openCart(true);
$("#miniCart").onclick = () => openCart(true);
$("#closeCart").onclick = () => openCart(false);
$("#overlay").onclick = () => openCart(false);
document.addEventListener("keydown", (e) => e.key === "Escape" && openCart(false));

// Footer category links
$("#footCats").innerHTML = CATS.slice(1).map((c) => `<li><a href="#shop" data-cat="${c}">${c}</a></li>`).join("");
$("#footCats").addEventListener("click", (e) => {
  const a = e.target.closest("a[data-cat]"); if (!a) return;
  cat = a.dataset.cat; renderChips(); renderProducts(); syncCards();
});
$("#year").textContent = new Date().getFullYear();

function validate(d) {
  const e = {};
  if (!d.name.trim()) e.name = "Enter your full name.";
  if (!d.email.trim()) e.email = "Enter your email so we can send the receipt.";
  else if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = "Enter a valid email, like you@email.com.";
  if (!d.phone.trim()) e.phone = "Enter a phone number we can reach you on.";
  else if (d.phone.replace(/\D/g, "").length < 7) e.phone = "That phone number looks too short.";
  if (!d.address.trim()) e.address = "Enter your delivery address.";
  return e;
}
function showErrors(errors, only) {
  ["name", "email", "phone", "address"].forEach((k) => {
    if (only && k !== only) return;
    const el = $("#checkoutForm").elements[k];
    el.setAttribute("aria-invalid", String(!!errors[k]));
    $(`#e-${k}`).textContent = errors[k] || "";
  });
}
// Re-check a field when the user leaves it, but only once it has been flagged.
$("#checkoutForm").addEventListener("focusout", (e) => {
  const el = e.target;
  if (!el.name || el.getAttribute("aria-invalid") !== "true") return;
  showErrors(validate(Object.fromEntries(new FormData($("#checkoutForm")))), el.name);
});

$("#checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, msg = $("#msg"), btn = $("#placeBtn");
  const data = Object.fromEntries(new FormData(f));
  msg.className = ""; msg.textContent = "";
  const errors = validate(data);
  showErrors(errors);
  const firstBad = Object.keys(errors)[0];
  if (firstBad) {
    msg.className = "err"; msg.textContent = "Please fix the highlighted fields.";
    f.elements[firstBad].focus(); return;
  }
  data.items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
  btn.disabled = true; btn.classList.add("loading"); msg.textContent = "Placing your order…";
  try {
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Something went wrong.");
    msg.className = "ok";
    msg.textContent = `Order ${out.orderNo || ""} placed! Check your email for the receipt.`.replace("  ", " ");
    cart = {}; renderCart(); f.reset(); showErrors({});
  } catch (err) {
    msg.className = "err"; msg.textContent = err.message + " Your cart is saved, try again.";
    btn.disabled = false;
  } finally {
    btn.classList.remove("loading");
  }
});

renderChips(); renderProducts(); renderCart();
