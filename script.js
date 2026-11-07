const PRODUCTS = [
  { id: 1, name: "Dried mangoes", desc: "Sweet, chewy, 200g pack", price: 180, cat: "Snacks", img: "images/mango.svg" },
  { id: 2, name: "Otap biscuits", desc: "Flaky puff pastry, box of 10", price: 120, cat: "Snacks", img: "images/02.jpg" },
  { id: 3, name: "Rosquillos", desc: "Crisp butter cookies, 250g", price: 150, cat: "Snacks", img: "images/03.jpg" },
  { id: 4, name: "Sinamay tote bag", desc: "Handwoven, fits a laptop", price: 450, cat: "Crafts", img: "images/04.jpg" },
  { id: 5, name: "Mini guitar keychain", desc: "Handmade in Mactan", price: 95, cat: "Crafts", img: "images/05.jpg" },
  { id: 6, name: "Cebu t-shirt", desc: "Cotton, sizes S to XL", price: 350, cat: "Apparel", img: "images/06.jpg" },
];
const CATS = ["All", "Snacks", "Crafts", "Apparel"];

const $ = (s) => document.querySelector(s);
const peso = (n) => "₱" + n.toLocaleString("en-PH");
const byId = (id) => PRODUCTS.find((p) => p.id === Number(id));
let cart = {}, query = "", cat = "All";
try { cart = JSON.parse(localStorage.getItem("cart")) || {}; } catch (e) {}
const save = () => { try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {} };

let toastTimer;
function toast(text) {
  const t = $("#toast"); t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

function renderChips() {
  $("#chips").innerHTML = CATS.map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${c === cat}">${c}</button>`).join("");
}

function renderProducts() {
  const term = query.trim().toLowerCase();
  const list = PRODUCTS.filter((p) => (cat === "All" || p.cat === cat) && (p.name + " " + p.desc).toLowerCase().includes(term));
  if (!list.length) {
    $("#products").innerHTML = `<p class="none">No products match your search. Try another word or category.</p>`; return;
  }
  $("#products").innerHTML = list.map((p) => `
    <article class="card">
      <div class="pic"><img src="${p.img}" alt="${p.name}" loading="lazy"><span class="tag">${p.cat}</span></div>
      <div class="body">
        <h3>${p.name}</h3><p>${p.desc}</p>
        <div class="buy"><span class="price">${peso(p.price)}</span>
        <button class="add" data-id="${p.id}" aria-label="Add ${p.name} to cart">+ Add</button></div>
      </div>
    </article>`).join("");
}

function renderCart() {
  const ids = Object.keys(cart).filter((id) => byId(id));
  let total = 0, count = 0;
  $("#items").innerHTML = ids.length ? ids.map((id) => {
    const p = byId(id), q = cart[id];
    total += p.price * q; count += q;
    return `<div class="row">
      <img src="${p.img}" alt=""><strong>${p.name}</strong><span>${peso(p.price * q)}</span>
      <div class="qty">
        <button data-act="dec" data-id="${id}" aria-label="Less">−</button><span>${q}</span>
        <button data-act="inc" data-id="${id}" aria-label="More">+</button>
        <button class="rm" data-act="rm" data-id="${id}">Remove</button>
      </div></div>`;
  }).join("") : `<p class="empty">Your cart is empty. Add something from the shop.</p>`;
  $("#total").textContent = peso(total);
  $("#count").textContent = count;
  $("#placeBtn").disabled = !ids.length;
  save();
}

function openCart(open) {
  $("#drawer").classList.toggle("open", open);
  $("#overlay").classList.toggle("show", open);
  $("#drawer").setAttribute("aria-hidden", String(!open));
}

$("#products").addEventListener("click", (e) => {
  const b = e.target.closest(".add"); if (!b) return;
  cart[b.dataset.id] = (cart[b.dataset.id] || 0) + 1;
  renderCart(); toast(`Added ${byId(b.dataset.id).name}`);
});
$("#chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  cat = b.dataset.cat; renderChips(); renderProducts();
});
$("#search").addEventListener("input", (e) => { query = e.target.value; renderProducts(); });

$("#items").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === "inc") cart[id]++;
  if (b.dataset.act === "dec") cart[id]--;
  if (b.dataset.act === "rm" || cart[id] <= 0) delete cart[id];
  renderCart();
});

$("#cartBtn").onclick = () => openCart(true);
$("#closeCart").onclick = () => openCart(false);
$("#overlay").onclick = () => openCart(false);
document.addEventListener("keydown", (e) => e.key === "Escape" && openCart(false));

$("#checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, msg = $("#msg"), btn = $("#placeBtn");
  const data = Object.fromEntries(new FormData(f));
  msg.className = "";
  if (!data.name.trim() || !data.phone.trim() || !data.address.trim() || !/^\S+@\S+\.\S+$/.test(data.email)) {
    msg.className = "err"; msg.textContent = "Fill in every field and use a valid email address."; return;
  }
  data.items = Object.entries(cart).map(([id, qty]) => ({ id: Number(id), qty }));
  btn.disabled = true; msg.textContent = "Placing your order…";
  try {
    const res = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Something went wrong.");
    cart = {}; renderCart(); f.reset();
    msg.className = "ok"; msg.textContent = "Order placed. Check your email for the receipt.";
  } catch (err) {
    msg.className = "err"; msg.textContent = err.message + " Your cart is saved, try again.";
    btn.disabled = false;
  }
});

renderChips(); renderProducts(); renderCart();
