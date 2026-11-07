// Vercel serverless function: POST /api/checkout
// Sends one email to the customer and one to the shop (Outlook / domain email).

const PRODUCTS = {
  1: { name: "Dried mangoes", price: 180 },
  2: { name: "Otap biscuits", price: 120 },
  3: { name: "Rosquillos", price: 150 },
  4: { name: "Sinamay tote bag", price: 450 },
  5: { name: "Mini guitar keychain", price: 95 },
  6: { name: "Cebu t-shirt", price: 350 },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + n.toLocaleString("en-PH");

async function sendEmail(payload) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { name, email, phone, address, items } = req.body || {};
  if (![name, email, phone, address].every((v) => typeof v === "string" && v.trim()) ||
      !/^\S+@\S+\.\S+$/.test(email) || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Missing or invalid order details." });
  }

  // Prices come from the server, not the browser, so totals can't be tampered with.
  const lines = [];
  let total = 0;
  for (const it of items) {
    const p = PRODUCTS[it.id], qty = Math.floor(Number(it.qty));
    if (!p || !(qty > 0 && qty <= 99)) return res.status(400).json({ error: "Invalid item in cart." });
    total += p.price * qty;
    lines.push({ name: p.name, qty, sub: p.price * qty });
  }

  const orderNo = "ORD-" + Date.now().toString(36).toUpperCase();
  const rows = lines.map((l) => `<tr><td>${esc(l.name)}</td><td align="center">${l.qty}</td><td align="right">${peso(l.sub)}</td></tr>`).join("");
  const table = `<table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#cbd9dc">
    <tr><th align="left">Item</th><th>Qty</th><th align="right">Subtotal</th></tr>${rows}
    <tr><td colspan="2"><strong>Total</strong></td><td align="right"><strong>${peso(total)}</strong></td></tr></table>`;
  const details = `<p><strong>Name:</strong> ${esc(name)}<br><strong>Email:</strong> ${esc(email)}<br>
    <strong>Phone:</strong> ${esc(phone)}<br><strong>Address:</strong> ${esc(address)}</p>`;

  const from = process.env.FROM_EMAIL || "Pasalubong Corner <onboarding@resend.dev>";

  try {
    await Promise.all([
      sendEmail({ from, to: email.trim(), subject: `Your order ${orderNo}`,
        html: `<h2>Thanks for your order, ${esc(name)}!</h2><p>Order <strong>${orderNo}</strong></p>${table}${details}<p>We will contact you about delivery.</p>` }),
      sendEmail({ from, to: process.env.SHOP_EMAIL, reply_to: email.trim(), subject: `New order ${orderNo} from ${name}`,
        html: `<h2>New order ${orderNo}</h2>${table}${details}` }),
    ]);
    return res.status(200).json({ ok: true, orderNo });
  } catch (err) {
    console.error("Email error:", err.message);
    return res.status(500).json({ error: "We could not send the confirmation email." });
  }
};
