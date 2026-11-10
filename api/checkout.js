// Vercel serverless function: POST /api/checkout
// Sends one email to the customer and one to the shop (Outlook / domain email).

const PRODUCTS = {
  1: { name: "Dried mangoes", desc: "Sweet, chewy, 200g pack", cat: "Snacks", badge: "#ffc21a", img: "images/01.jpg", price: 180 },
  2: { name: "Otap biscuits", desc: "Flaky puff pastry, box of 10", cat: "Snacks", badge: "#ffc21a", img: "images/02.jpg", price: 120 },
  3: { name: "Rosquillos", desc: "Crisp butter cookies, 250g", cat: "Snacks", badge: "#ffc21a", img: "images/03.jpg", price: 150 },
  4: { name: "Sinamay tote bag", desc: "Handwoven, fits a laptop", cat: "Crafts", badge: "#ff8a1f", img: "images/04.jpg", price: 450 },
  5: { name: "Mini guitar keychain", desc: "Handmade in Mactan", cat: "Crafts", badge: "#ff8a1f", img: "images/05.jpg", price: 95 },
  6: { name: "Cebu t-shirt", desc: "Cotton, sizes S to XL", cat: "Apparel", badge: "#7fd1c9", img: "images/06.jpg", price: 350 },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + n.toLocaleString("en-PH");

const FONT_STACK = "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY_STACK = "'Bricolage Grotesque', 'Nunito', 'Trebuchet MS', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function buildEmailHtml({ orderNo, orderDate, name, email, phone, address, lines, total, totalQty, siteUrl, isShopCopy = false }) {
  const preheader = isShopCopy
    ? `New order ${orderNo} from ${name} (${totalQty} ${totalQty === 1 ? "item" : "items"} · ${peso(total)})`
    : `Thanks for your order, ${name}! Here is your Pasalubong Corner receipt for ${orderNo} (${peso(total)}).`;

  const kickerBg = isShopCopy ? "#d63a2b" : "#ffc21a";
  const kickerColor = isShopCopy ? "#ffffff" : "#12242a";
  const kickerText = isShopCopy ? "New Customer Order" : "Made in Cebu · Order Confirmed";

  const heroHeading = isShopCopy
    ? `New order from <span style="display:inline-block;padding:2px 10px;border-radius:10px;background:#ffc21a;color:#12242a;">${esc(name)}</span>`
    : `Thanks for your order, <span style="display:inline-block;padding:2px 10px;border-radius:10px;background:#ffc21a;color:#12242a;">${esc(name)}!</span>`;

  const heroLead = isShopCopy
    ? "A customer just placed an order on Pasalubong Corner. Reach out to confirm delivery details and any shipping fee."
    : "We’ve received your order and are getting your Cebu treats &amp; handmade goods ready. We’ll contact you shortly to confirm delivery.";

  const itemRowsHtml = lines.map((l) => {
    const imgUrl = `${siteUrl}/${l.img}`;
    return `
      <tr>
        <td style="padding:0 0 12px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:2.5px solid #12242a;border-radius:18px;box-shadow:3px 3px 0 #12242a;">
            <tr>
              <td width="72" valign="middle" style="padding:12px 0 12px 12px;">
                <div style="width:64px;height:64px;background:${l.badge};border:2px solid #12242a;border-radius:14px;padding:4px;box-sizing:border-box;text-align:center;">
                  <img src="${esc(imgUrl)}" width="52" height="52" alt="${esc(l.name)}" style="display:block;width:52px;height:52px;object-fit:contain;border-radius:8px;background:#ffffff;margin:0 auto;">
                </div>
              </td>
              <td valign="middle" style="padding:12px 10px 12px 12px;font-family:${FONT_STACK};color:#12242a;">
                <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#0a6c74;line-height:1.2;">${esc(l.cat)}</div>
                <div style="font-family:${DISPLAY_STACK};font-size:16px;font-weight:800;color:#12242a;line-height:1.25;margin-top:2px;">${esc(l.name)}</div>
                <div style="font-size:13px;font-weight:700;color:#4b5f64;margin-top:3px;">
                  ${peso(l.price)} each &nbsp;&middot;&nbsp;
                  <span style="display:inline-block;padding:1px 8px;background:#fff6e3;border:1.5px solid #12242a;border-radius:999px;font-size:12px;font-weight:800;color:#12242a;">Qty: ${l.qty}</span>
                </div>
              </td>
              <td valign="middle" align="right" style="padding:12px 14px 12px 6px;white-space:nowrap;">
                <span style="display:inline-block;padding:4px 12px;background:#ffc21a;border:2px solid #12242a;border-radius:10px;font-family:${DISPLAY_STACK};font-size:16px;font-weight:800;color:#12242a;">
                  ${peso(l.sub)}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order ${esc(orderNo)} · Pasalubong Corner</title>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#fff6e3;font-family:${FONT_STACK};color:#12242a;-webkit-font-smoothing:antialiased;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#fff6e3;">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff6e3;padding:24px 12px 40px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#fffdf8;border:3px solid #12242a;border-radius:26px;box-shadow:6px 6px 0 #12242a;overflow:hidden;">

          <!-- Top Announcement Bar -->
          <tr>
            <td align="center" style="background-color:#12242a;color:#ffc21a;padding:9px 16px;font-family:${FONT_STACK};font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
              Free email receipt on every order &middot; Handpicked from Cebu
            </td>
          </tr>

          <!-- Brand Header Bar -->
          <tr>
            <td style="background-color:#fff6e3;padding:16px 24px;border-bottom:3px solid #12242a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <a href="${esc(siteUrl)}" style="text-decoration:none;color:#12242a;display:inline-block;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td valign="middle" style="padding-right:10px;">
                            <div style="width:28px;height:28px;border:2.5px solid #12242a;border-radius:14px 14px 14px 4px;background-color:#ffc21a;box-shadow:inset -6px -6px 0 #0a6c74;"></div>
                          </td>
                          <td valign="middle" style="font-family:${DISPLAY_STACK};font-size:20px;font-weight:800;color:#12242a;letter-spacing:-0.02em;">
                            Pasalubong Corner
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td valign="middle" align="right">
                    <span style="display:inline-block;padding:5px 12px;background-color:#ffffff;border:2px solid #12242a;border-radius:999px;font-family:${DISPLAY_STACK};font-size:12px;font-weight:800;color:#12242a;box-shadow:2px 2px 0 #12242a;">
                      ${esc(orderNo)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fiesta Bunting Accent Strip -->
          <tr>
            <td style="padding:0;border-bottom:3px solid #12242a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="20%" height="10" style="background-color:#ffc21a;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="20%" height="10" style="background-color:#ff8a1f;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="20%" height="10" style="background-color:#d63a2b;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="20%" height="10" style="background-color:#0a6c74;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="20%" height="10" style="background-color:#2f9e5a;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Banner -->
          <tr>
            <td style="background-color:#0a6c74;background-image:linear-gradient(135deg,#0a6c74 0%,#063f45 100%);padding:32px 24px;border-bottom:3px solid #12242a;color:#fff6e3;">
              <div style="margin-bottom:14px;">
                <span style="display:inline-block;padding:5px 14px;background-color:${kickerBg};color:${kickerColor};border:2px solid #12242a;border-radius:999px;font-family:${FONT_STACK};font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;box-shadow:2px 2px 0 #12242a;">
                  ${kickerText}
                </span>
              </div>
              <h1 style="margin:0 0 12px 0;font-family:${DISPLAY_STACK};font-size:28px;line-height:1.12;font-weight:800;color:#fff6e3;letter-spacing:-0.02em;">
                ${heroHeading}
              </h1>
              <p style="margin:0 0 22px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.55;font-weight:600;color:#e6f3f1;">
                ${heroLead}
              </p>

              <!-- Order Meta Pills -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:8px;padding-bottom:6px;">
                    <span style="display:inline-block;padding:6px 14px;background-color:#fff6e3;border:2px solid #12242a;border-radius:999px;font-family:${FONT_STACK};font-size:12px;font-weight:800;color:#12242a;">
                      Receipt: <strong style="font-family:${DISPLAY_STACK};">${esc(orderNo)}</strong>
                    </span>
                  </td>
                  <td style="padding-right:8px;padding-bottom:6px;">
                    <span style="display:inline-block;padding:6px 14px;background-color:#fff6e3;border:2px solid #12242a;border-radius:999px;font-family:${FONT_STACK};font-size:12px;font-weight:800;color:#12242a;">
                      ${esc(orderDate)}
                    </span>
                  </td>
                  <td style="padding-bottom:6px;">
                    <span style="display:inline-block;padding:6px 14px;background-color:#ffc21a;border:2px solid #12242a;border-radius:999px;font-family:${FONT_STACK};font-size:12px;font-weight:800;color:#12242a;">
                      ${totalQty} ${totalQty === 1 ? "item" : "items"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="background-color:#fff6e3;padding:28px 24px;">

              <!-- Section Title: Your Cart -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                <tr>
                  <td valign="bottom">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#0a6c74;margin-bottom:4px;">Order Summary</div>
                    <h2 style="margin:0;font-family:${DISPLAY_STACK};font-size:22px;font-weight:800;color:#12242a;letter-spacing:-0.02em;">
                      Your <span style="display:inline-block;padding:0 8px;background-color:#ffc21a;border-radius:8px;">pasalubong</span> bag
                    </h2>
                  </td>
                </tr>
              </table>

              <!-- Items List -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRowsHtml}
              </table>

              <!-- Total Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;padding-top:16px;border-top:3px dashed #12242a;">
                <tr>
                  <td valign="middle" style="font-family:${DISPLAY_STACK};font-size:18px;font-weight:800;color:#12242a;">
                    Total
                  </td>
                  <td valign="middle" align="right" style="font-family:${DISPLAY_STACK};font-size:28px;font-weight:800;color:#12242a;letter-spacing:-0.02em;">
                    ${peso(total)}
                  </td>
                </tr>
              </table>

              <!-- Delivery Fee Note Nudge (matches .nudge in cart drawer) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;margin-bottom:24px;background-color:#ffe9a8;border:2px solid #12242a;border-radius:14px;">
                <tr>
                  <td style="padding:12px 16px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:#12242a;line-height:1.45;">
                    <strong>Note:</strong> Delivery fee, if any, is confirmed when we contact you via phone or email.
                  </td>
                </tr>
              </table>

              <!-- Delivery Details Card (matches #checkoutForm card) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:3px solid #12242a;border-radius:22px;box-shadow:4px 4px 0 #12242a;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#0a6c74;margin-bottom:2px;">Where it’s headed</div>
                    <h3 style="margin:0 0 14px 0;font-family:${DISPLAY_STACK};font-size:19px;font-weight:800;color:#12242a;">
                      Delivery details
                    </h3>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:10px 14px;background-color:#fffdf8;border:2px solid #12242a;border-radius:12px;">
                          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#4b5f64;">Full name</div>
                          <div style="font-size:15px;font-weight:800;color:#12242a;margin-top:2px;">${esc(name)}</div>
                        </td>
                      </tr>
                      <tr><td height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:#fffdf8;border:2px solid #12242a;border-radius:12px;">
                          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#4b5f64;">Email &amp; Phone</div>
                          <div style="font-size:14px;font-weight:700;color:#12242a;margin-top:2px;">
                            <a href="mailto:${esc(email)}" style="color:#0a6c74;text-decoration:underline;font-weight:800;">${esc(email)}</a>
                            &nbsp;&middot;&nbsp;
                            <a href="tel:${esc(phone)}" style="color:#12242a;text-decoration:none;font-weight:800;">${esc(phone)}</a>
                          </div>
                        </td>
                      </tr>
                      <tr><td height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td style="padding:10px 14px;background-color:#fffdf8;border:2px solid #12242a;border-radius:12px;">
                          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#4b5f64;">Delivery address</div>
                          <div style="font-size:15px;font-weight:700;color:#12242a;margin-top:2px;white-space:pre-line;">${esc(address)}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td align="center">
                    <a href="${esc(isShopCopy ? `mailto:${email}?subject=Your%20Pasalubong%20Corner%20order%20${orderNo}` : siteUrl)}"
                       style="display:inline-block;padding:14px 28px;background-color:#ffc21a;color:#12242a;border:3px solid #12242a;border-radius:999px;font-family:${DISPLAY_STACK};font-size:16px;font-weight:800;text-decoration:none;box-shadow:4px 4px 0 #12242a;">
                      ${isShopCopy ? `Reply to ${esc(name)} &rarr;` : "Visit Pasalubong Corner &rarr;"}
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer (matches .foot on website) -->
          <tr>
            <td style="background-color:#063f45;padding:26px 24px 22px;border-top:3px solid #12242a;color:#d8ebe9;text-align:center;">
              <div style="font-family:${DISPLAY_STACK};font-size:17px;font-weight:800;color:#fff6e3;margin-bottom:6px;">
                Pasalubong Corner
              </div>
              <p style="margin:0 auto 16px;max-width:360px;font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#d8ebe9;font-weight:600;">
                Cebu’s favorite treats and handmade goods, packed with care and sent your way.
              </p>
              <div style="padding-top:14px;border-top:2px dashed rgba(255,255,255,0.25);font-size:12px;color:#b5d6d2;font-weight:600;">
                &copy; ${new Date().getFullYear()} Pasalubong Corner &middot; Cebu City, Philippines
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailText({ orderNo, orderDate, name, email, phone, address, lines, total, isShopCopy = false }) {
  const header = isShopCopy
    ? `NEW ORDER ${orderNo} — PASALUBONG CORNER`
    : `THANKS FOR YOUR ORDER, ${name.toUpperCase()}!`;
  const itemLines = lines.map((l) => `- ${l.name} x ${l.qty} (${peso(l.price)} each) = ${peso(l.sub)}`).join("\n");
  return [
    header,
    `Order: ${orderNo} (${orderDate})`,
    "",
    "ORDER SUMMARY",
    itemLines,
    `Total: ${peso(total)}`,
    "(Note: Delivery fee, if any, is confirmed when we contact you.)",
    "",
    "DELIVERY DETAILS",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Address: ${address}`,
    "",
    "Pasalubong Corner · Cebu City, Philippines",
  ].join("\n");
}

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
  let totalQty = 0;
  for (const it of items) {
    const p = PRODUCTS[it.id], qty = Math.floor(Number(it.qty));
    if (!p || !(qty > 0 && qty <= 99)) return res.status(400).json({ error: "Invalid item in cart." });
    total += p.price * qty;
    totalQty += qty;
    lines.push({
      name: p.name,
      desc: p.desc,
      cat: p.cat,
      badge: p.badge,
      img: p.img,
      price: p.price,
      qty,
      sub: p.price * qty,
    });
  }

  const orderNo = "ORD-" + Date.now().toString(36).toUpperCase();
  const orderDate = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const siteUrl = (process.env.SITE_URL || (host ? `${proto}://${host}` : "https://goarcana.com")).replace(/\/+$/, "");

  const sharedData = {
    orderNo,
    orderDate,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    address: address.trim(),
    lines,
    total,
    totalQty,
    siteUrl,
  };

  const from = process.env.FROM_EMAIL || "Pasalubong Corner <onboarding@resend.dev>";

  try {
    await Promise.all([
      sendEmail({
        from,
        to: email.trim(),
        subject: `Your order ${orderNo} · Pasalubong Corner`,
        html: buildEmailHtml({ ...sharedData, isShopCopy: false }),
        text: buildEmailText({ ...sharedData, isShopCopy: false }),
      }),
      sendEmail({
        from,
        to: process.env.SHOP_EMAIL,
        reply_to: email.trim(),
        subject: `New order ${orderNo} from ${name.trim()}`,
        html: buildEmailHtml({ ...sharedData, isShopCopy: true }),
        text: buildEmailText({ ...sharedData, isShopCopy: true }),
      }),
    ]);
    return res.status(200).json({ ok: true, orderNo });
  } catch (err) {
    console.error("Email error:", err.message);
    return res.status(500).json({ error: "We could not send the confirmation email." });
  }
};
