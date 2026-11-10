const PRODUCTS = [
  { id: 1, name: "Dried mangoes", desc: "Sweet, chewy, 200g pack", price: 180, cat: "Snacks", img: "images/01.jpg", badge: "Bestseller" },
  { id: 2, name: "Otap biscuits", desc: "Flaky puff pastry, box of 10", price: 120, cat: "Snacks", img: "images/02.jpg" },
  { id: 3, name: "Rosquillos", desc: "Crisp butter cookies, 250g", price: 150, cat: "Snacks", img: "images/03.jpg" },
  { id: 4, name: "Sinamay tote bag", desc: "Handwoven, fits a laptop", price: 450, cat: "Crafts", img: "images/04.jpg", badge: "Handmade", cover: true },
  { id: 5, name: "Mini guitar keychain", desc: "Handmade in Mactan", price: 95, cat: "Crafts", img: "images/05.jpg" },
  { id: 6, name: "Cebu t-shirt", desc: "Cotton, sizes S to XL", price: 350, cat: "Apparel", img: "images/06.jpg" },
];
const CATS = ["All", "Snacks", "Crafts", "Apparel"];
const CAT_IMG = { Snacks: "images/01.jpg", Crafts: "images/05.jpg", Apparel: "images/06.jpg" };

const $ = (s, r = document) => r.querySelector(s);
const peso = (n) => "₱" + n.toLocaleString("en-PH");
const byId = (id) => PRODUCTS.find((p) => p.id === Number(id));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (e) { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let cart = read("cart", {}), query = "", cat = "All", sort = "featured";
const save = () => write("cart", cart);

const ICON_PLUS = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_BAG = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`;
const ICON_ARROW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

let toastTimer;
function toast(text) {
  const t = $("#toast"); t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
}

/* ---------- Shop rendering ---------- */
function renderCats() {
  $("#cats").innerHTML = CATS.slice(1).map((c) => {
    const n = PRODUCTS.filter((p) => p.cat === c).length;
    return `<button class="cat ${c.toLowerCase()}" data-cat="${c}" aria-label="Shop ${c}, ${n} ${n === 1 ? "item" : "items"}">
      <img src="${CAT_IMG[c]}" alt="" loading="lazy">
      <div class="cat-bar"><b>${c}</b><small>${n} ${n === 1 ? "item" : "items"} →</small></div>
    </button>`;
  }).join("");
}

function renderChips() {
  $("#chips").innerHTML = CATS.map((c) => {
    const n = c === "All" ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c).length;
    return `<button class="chip" data-cat="${c}" aria-pressed="${c === cat}">${c}<span class="n">${n}</span></button>`;
  }).join("");
}

function buyControl(p) {
  const q = cart[p.id] || 0;
  if (!q) return `<button class="add" data-id="${p.id}" aria-label="Add ${esc(p.name)} to cart">${ICON_PLUS}</button>`;
  return `<div class="stepper" role="group" aria-label="${esc(p.name)} quantity">
      <button data-step="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">−</button>
      <span aria-live="polite">${q}</span>
      <button data-step="inc" data-id="${p.id}" aria-label="Add one more ${esc(p.name)}">+</button>
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
      <strong>No products match “${esc(query)}”.</strong>
      <p>Try another word or category.</p>
      <button class="link-btn" id="clearFilters">Clear filters</button>
    </div>`;
    return;
  }
  $("#products").innerHTML = list.map((p, i) => `
    <article class="card ${p.cat.toLowerCase()}" data-id="${p.id}" style="--i:${i}">
      <div class="pic">
        <img class="${p.cover ? "cover" : ""}" src="${p.img}" alt="${esc(p.name)}" loading="lazy">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
        <div class="ctl">${buyControl(p)}</div>
      </div>
      <div class="meta">
        <span class="cat-tag">${p.cat}</span>
        <h3>${p.name}</h3><p>${p.desc}</p>
        <span class="price">${peso(p.price)}</span>
      </div>
    </article>`).join("");
}

// Update only the controls on visible cards so images don't re-render.
function syncCards() {
  document.querySelectorAll(".card").forEach((card) => {
    const p = byId(card.dataset.id);
    card.querySelector(".ctl").innerHTML = buyControl(p);
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
      <div class="row-info"><strong>${p.name}</strong><small>${peso(p.price)} each</small></div>
      <span class="row-sub">${peso(p.price * q)}</span>
      <div class="qty">
        <div class="stepper sm">
          <button data-act="dec" data-id="${id}" aria-label="Less ${esc(p.name)}">−</button><span>${q}</span>
          <button data-act="inc" data-id="${id}" aria-label="More ${esc(p.name)}">+</button>
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

/* ---------- Drawer + dialogs ---------- */
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

function showCategory(c) {
  cat = c; renderChips(); renderProducts(); syncCards();
  $("#shop").scrollIntoView({ behavior: "smooth" });
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
$("#cats").addEventListener("click", (e) => {
  const b = e.target.closest(".cat"); if (b) showCategory(b.dataset.cat);
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

$("#footCats").innerHTML = CATS.slice(1).map((c) => `<li><a href="#shop" data-cat="${c}">${c}</a></li>`).join("");
$("#footCats").addEventListener("click", (e) => {
  const a = e.target.closest("a[data-cat]"); if (!a) return;
  cat = a.dataset.cat; renderChips(); renderProducts(); syncCards();
});
$("#year").textContent = new Date().getFullYear();

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
// Link each error line to its input, and re-check a field on blur once flagged.
document.querySelectorAll("form").forEach((form) => {
  form.querySelectorAll("[data-err]").forEach((p) => {
    p.id = `${form.id}-e-${p.dataset.err}`;
    const input = form.elements[p.dataset.err];
    if (input) input.setAttribute("aria-describedby", p.id);
  });
  form.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.name || el.getAttribute("aria-invalid") !== "true" || !VALIDATORS[form.id]) return;
    const all = VALIDATORS[form.id](formData(form));
    const p = form.querySelector(`[data-err="${el.name}"]`);
    const m = all[el.name] || "";
    p.textContent = m; el.setAttribute("aria-invalid", String(!!m));
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
  const e = {}; validName(d, e);
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
  const e = {}; validName(d, e);
  if (!d.email.trim()) e.email = "Enter your email.";
  else if (!reEmail.test(d.email.trim())) e.email = "Enter a valid email, like you@email.com.";
  if (!d.password) e.password = "Create a password.";
  else if (d.password.length < 8) e.password = "Use at least 8 characters.";
  return e;
};
VALIDATORS.profileForm = (d) => {
  const e = {}; validName(d, e); validPhone(d, e, false); return e;
};

/* ---------- Accounts (stored in this browser) ---------- */
// Note: accounts live in localStorage on this device only. There is no server database,
// so they are not shared across devices and are not a substitute for real authentication.
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
async function hashPw(pw, saltHex) {
  if (!window.crypto || !crypto.subtle) throw new Error("Accounts need a secure connection (https).");
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return { salt: toHex(salt), hash: toHex(bits) };
}

const getUsers = () => read("pc_users", {});
const setUsers = (u) => write("pc_users", u);
const currentEmail = () => read("pc_session", null);
const currentUser = () => { const e = currentEmail(); return e ? getUsers()[e] || null : null; };
const ordersKey = (email) => "pc_orders_" + email;
const initial = (name) => (name.trim()[0] || "?").toUpperCase();

function renderAuthUI() {
  const u = currentUser();
  const av = $("#acctAvatar");
  if (u) {
    av.textContent = initial(u.name); av.classList.add("on");
    $("#acctLabel").textContent = u.name.trim().split(/\s+/)[0];
    $("#acctBtn").setAttribute("aria-label", `My account, ${u.name}`);
  } else {
    av.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>`;
    av.classList.remove("on");
    $("#acctLabel").textContent = "Log in";
    $("#acctBtn").setAttribute("aria-label", "Log in or create account");
  }
  $("#guestNudge").hidden = !!u;
  prefillCheckout();
}

function prefillCheckout() {
  const u = currentUser(), f = $("#checkoutForm");
  if (!u) return;
  const fill = (n, v) => { if (v && !f.elements[n].value) f.elements[n].value = v; };
  fill("name", u.name); fill("email", currentEmail()); fill("phone", u.phone); fill("address", u.address);
}

function openDlg(dlg) { if (!dlg.open) dlg.showModal(); }
document.querySelectorAll(".dlg").forEach((d) => {
  d.querySelector("[data-close]").addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); }); // click on backdrop
});

function setAuthTab(tab) {
  const login = tab === "login";
  $("#tabLogin").setAttribute("aria-selected", String(login));
  $("#tabSignup").setAttribute("aria-selected", String(!login));
  $("#loginForm").hidden = !login; $("#signupForm").hidden = login;
  $("#authTitle").textContent = login ? "Welcome back" : "Create your account";
  $("#authSub").textContent = login ? "Log in to see your orders and check out faster." : "Save your details and track your orders on this device.";
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
  const b = e.target.closest("[data-open-auth]"); if (b) openAuth(b.dataset.openAuth);
});

function startSession(email) { write("pc_session", email); renderAuthUI(); }

$("#signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, d = formData(f), btn = f.querySelector(".primary");
  const errs = VALIDATORS.signupForm(d); setErrors(f, errs); setMsg(f, "");
  const bad = Object.keys(errs)[0]; if (bad) { f.elements[bad].focus(); return; }
  const email = d.email.trim().toLowerCase(), users = getUsers();
  if (users[email]) {
    setErrors(f, { email: "An account with this email already exists. Try logging in." });
    f.elements.email.focus(); return;
  }
  btn.disabled = true; btn.classList.add("loading");
  try {
    const { salt, hash } = await hashPw(d.password);
    users[email] = { name: d.name.trim(), salt, hash, phone: "", address: "", created: Date.now() };
    setUsers(users); startSession(email);
    f.reset(); $("#authDlg").close(); toast(`Welcome, ${d.name.trim().split(/\s+/)[0]}!`);
  } catch (err) { setMsg(f, err.message, "err"); }
  finally { btn.disabled = false; btn.classList.remove("loading"); }
});

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, d = formData(f), btn = f.querySelector(".primary");
  const errs = VALIDATORS.loginForm(d); setErrors(f, errs); setMsg(f, "");
  const bad = Object.keys(errs)[0]; if (bad) { f.elements[bad].focus(); return; }
  const email = d.email.trim().toLowerCase(), u = getUsers()[email];
  btn.disabled = true; btn.classList.add("loading");
  try {
    const h = u ? await hashPw(d.password, u.salt) : null;
    if (!u || h.hash !== u.hash) { setMsg(f, "Incorrect email or password.", "err"); return; }
    startSession(email);
    f.reset(); $("#authDlg").close(); toast(`Welcome back, ${u.name.trim().split(/\s+/)[0]}!`);
  } catch (err) { setMsg(f, err.message, "err"); }
  finally { btn.disabled = false; btn.classList.remove("loading"); }
});

function renderOrders() {
  const orders = read(ordersKey(currentEmail()), []);
  $("#orders").innerHTML = orders.length ? orders.map((o) => `
    <div class="order">
      <div class="order-top"><span>${esc(o.no)}</span><span>${peso(o.total)}</span></div>
      <small>${new Date(o.date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</small>
      <ul>${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}</ul>
    </div>`).join("") : `<p class="orders-empty">No orders yet. Your orders will show up here after checkout.</p>`;
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

$("#profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, d = formData(f);
  const errs = VALIDATORS.profileForm(d); setErrors(f, errs);
  const bad = Object.keys(errs)[0]; if (bad) { f.elements[bad].focus(); return; }
  const users = getUsers(), email = currentEmail();
  Object.assign(users[email], { name: d.name.trim(), phone: d.phone.trim(), address: d.address.trim() });
  setUsers(users); renderAuthUI();
  $("#acctAvatarLg").textContent = initial(d.name);
  setMsg(f, "Details saved.", "ok");
});
$("#logoutBtn").onclick = () => {
  write("pc_session", null); $("#acctDlg").close(); renderAuthUI();
  $("#checkoutForm").reset(); toast("You’ve been logged out");
};

/* ---------- Checkout ---------- */
$("#checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, btn = $("#placeBtn");
  const data = formData(f);
  setMsg(f, "");
  const errs = VALIDATORS.checkoutForm(data); setErrors(f, errs);
  const bad = Object.keys(errs)[0];
  if (bad) { setMsg(f, "Please fix the highlighted fields.", "err"); f.elements[bad].focus(); return; }
  data.items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
  const snapshot = data.items.map((i) => ({ name: byId(i.id).name, qty: i.qty, price: byId(i.id).price }));
  const total = snapshot.reduce((s, i) => s + i.price * i.qty, 0);
  btn.disabled = true; btn.classList.add("loading"); setMsg(f, "Placing your order…");
  try {
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Something went wrong.");
    const email = currentEmail();
    if (email) {
      const orders = read(ordersKey(email), []);
      orders.unshift({ no: out.orderNo || "ORDER", date: Date.now(), items: snapshot, total });
      write(ordersKey(email), orders.slice(0, 50));
      const users = getUsers();
      if (users[email]) { users[email].phone = data.phone.trim(); users[email].address = data.address.trim(); setUsers(users); }
    }
    setMsg(f, `Order ${out.orderNo || ""} placed! Check your email for the receipt.`.replace("  ", " "), "ok");
    cart = {}; renderCart(); f.reset(); setErrors(f, {}); prefillCheckout();
  } catch (err) {
    setMsg(f, err.message + " Your cart is saved, try again.", "err");
    btn.disabled = false;
  } finally {
    btn.classList.remove("loading");
  }
});

renderCats(); renderChips(); renderProducts(); renderCart(); renderAuthUI();
