// Vercel serverless function: POST /api/checkout
// Sends one email to the customer and one to the shop (Outlook / domain email).

const DEFAULT_PRODUCTS = {
  1: { name: "Dried mangoes", img: "images/01.jpg", price: 180, cat: "sweets" },
  2: { name: "Otap biscuits", img: "images/02.jpg", price: 120, cat: "sweets" },
  3: { name: "Rosquillos", img: "images/03.jpg", price: 150, cat: "sweets" },
  4: { name: "Sinamay tote bag", img: "images/04.jpg", price: 450, cat: "crafts" },
  5: { name: "Mini guitar keychain", img: "images/05.jpg", price: 95, cat: "crafts" },
  6: { name: "Cebu t-shirt", img: "images/06.jpg", price: 350, cat: "apparel" },
};

const PAYMENT_METHODS = {
  COD: "Cash on Delivery (COD)",
  "Cash on Delivery": "Cash on Delivery (COD)",
  GCash: "GCash",
  "Bank Transfer": "Bank Transfer",
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH");

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function resolveSafeEmailImg(img, siteUrl, fallbackImg = "images/01.jpg") {
  const raw = typeof img === "string" && img.trim() ? img.trim() : fallbackImg;
  const safe = /^data:/i.test(raw) ? fallbackImg : raw;
  if (/^https?:\/\//i.test(safe)) return safe;
  const base = String(siteUrl || "https://goarcana.com").replace(/\/+$/, "");
  return `${base}/${safe.replace(/^\/+/, "")}`;
}

function formatPaymentMethod(method) {
  const raw = typeof method === "string" && method.trim() ? method.trim() : "COD";
  return PAYMENT_METHODS[raw] || raw;
}

function buildEmailHtml({
  orderNo = "ORD-0000",
  orderDate = "",
  name = "",
  email = "",
  phone = "",
  address = "",
  lines = [],
  subtotal,
  discount = 0,
  couponCode = "",
  deliveryFee = 0,
  total = 0,
  paymentMethod = "COD",
  notes = "",
  siteUrl = "https://goarcana.com",
  supportEmail = "onboarding@resend.dev",
  isShopCopy = false,
} = {}) {
  const computedSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : Number(total) || 0;
  const computedDiscount = Math.max(0, Number(discount) || 0);
  const computedDelivery = Math.max(0, Number(deliveryFee) || 0);
  const computedTotal = Number.isFinite(Number(total))
    ? Number(total)
    : Math.max(0, computedSubtotal - computedDiscount + computedDelivery);
  const cleanCoupon = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
  const cleanNotes = typeof notes === "string" ? notes.trim() : "";
  const paymentDisplay = formatPaymentMethod(paymentMethod);
  const deliveryDisplay = computedDelivery === 0 ? "Free" : peso(computedDelivery);
  const discountLabel = cleanCoupon ? `Discount (${cleanCoupon})` : "Discount";

  const preheader = isShopCopy
    ? `New order ${orderNo} from ${name} (${peso(computedTotal)})`
    : `We received your order ${orderNo} and we'll let you know when it's on the way.`;

  const heading = isShopCopy ? "New Order Received" : "Order Confirmation";
  const subheading = isShopCopy
    ? `Order placed by ${esc(name)} on ${esc(orderDate)}.`
    : "We received your order and we’ll contact you shortly when we prepare it for delivery.";

  const itemRowsHtml = lines
    .map((l) => {
      const imgUrl = resolveSafeEmailImg(l.img, siteUrl);
      const lineSub = Number.isFinite(Number(l.sub)) ? Number(l.sub) : Number(l.price || 0) * Number(l.qty || 1);
      return `
      <tr>
        <td width="44" valign="middle" style="padding:18px 0;border-bottom:1px solid #ececec;font-family:${FONT_STACK};font-size:14px;color:#555555;white-space:nowrap;">
          ${esc(l.qty)}&nbsp;&nbsp;x
        </td>
        <td width="104" valign="middle" style="padding:18px 20px 18px 4px;border-bottom:1px solid #ececec;">
          <img src="${esc(imgUrl)}" width="96" height="68" alt="${esc(l.name)}" style="display:block;width:96px;height:68px;object-fit:contain;background-color:#f7f7f7;border:1px solid #eeeeee;border-radius:2px;padding:4px;box-sizing:border-box;">
        </td>
        <td valign="middle" style="padding:18px 12px 18px 0;border-bottom:1px solid #ececec;font-family:${FONT_STACK};font-size:14px;font-weight:500;color:#222222;line-height:1.4;">
          ${esc(l.name)}
        </td>
        <td valign="middle" align="right" style="padding:18px 0;border-bottom:1px solid #ececec;font-family:${FONT_STACK};font-size:14px;font-weight:500;color:#222222;white-space:nowrap;">
          ${peso(lineSub)}
        </td>
      </tr>`;
    })
    .join("");

  const discountRowHtml =
    computedDiscount > 0
      ? `
                      <tr>
                        <td style="padding:2px 0;color:#2f9e5a;">${esc(discountLabel)}</td>
                        <td align="right" style="padding:2px 0;color:#2f9e5a;">-${peso(computedDiscount)}</td>
                      </tr>`
      : "";

  const notesBlockHtml = cleanNotes
    ? `
                    <div style="font-weight:700;color:#12242a;margin-top:20px;margin-bottom:6px;">Delivery Notes</div>
                    <div style="color:#555555;font-size:13px;white-space:pre-line;">${esc(cleanNotes)}</div>`
    : `
                    <div style="font-weight:700;color:#12242a;margin-top:20px;margin-bottom:6px;">Delivery Note</div>
                    <div style="color:#555555;font-size:13px;">We will contact you once your order is packed and ready for dispatch.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(heading)} · ${esc(orderNo)}</title>
  <style>
    @media only screen and (max-width: 560px) {
      .email-card { padding: 28px 20px !important; }
      .col-split { display: block !important; width: 100% !important; padding-right: 0 !important; }
      .col-split-right { display: block !important; width: 100% !important; padding-top: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:${FONT_STACK};color:#222222;-webkit-font-smoothing:antialiased;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#ffffff;">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;padding:28px 12px 48px;">
    <tr>
      <td align="center">

        <!-- Top Centered Brand Logo (outside the bordered card) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
          <tr>
            <td valign="middle" style="padding-right:8px;">
              <div style="width:18px;height:18px;border:2px solid #12242a;border-radius:50% 50% 50% 4px;background-color:#ffc21a;box-shadow:inset -4px -4px 0 #0a6c74;"></div>
            </td>
            <td valign="middle" style="font-family:${FONT_STACK};font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#12242a;">
              <a href="${esc(siteUrl)}" style="color:#12242a;text-decoration:none;">PASALUBONG CORNER</a>
            </td>
          </tr>
        </table>

        <!-- Main Bordered Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e4e4;padding:44px 42px;">
          <tr>
            <td>

              <!-- Title & Subtitle -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;border-bottom:1px solid #ececec;">
                    <h1 style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:28px;font-weight:400;color:#12242a;letter-spacing:-0.01em;">
                      ${esc(heading)}
                    </h1>
                    <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.55;color:#444444;">
                      ${subheading}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Your Order (#ORD-XXXX) Header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:20px 0 14px 0;border-bottom:1px solid #ececec;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#12242a;">
                    Your Order (#${esc(orderNo)}):
                  </td>
                </tr>
              </table>

              <!-- Order Items Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRowsHtml}
              </table>

              <!-- Shipping Address & Details (2 Columns) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:28px 0 26px 0;border-bottom:1px solid #ececec;">
                <tr>
                  <!-- Left Column: Shipping Address & Delivery Notes -->
                  <td width="52%" valign="top" class="col-split" style="padding-right:20px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:#333333;">
                    <div style="font-weight:700;color:#12242a;margin-bottom:8px;">Shipping Address</div>
                    <div>${esc(name)}</div>
                    <div style="white-space:pre-line;">${esc(address)}</div>
                    <div style="margin-top:4px;">${esc(phone)}</div>
                    <div><a href="mailto:${esc(email)}" style="color:#333333;text-decoration:none;">${esc(email)}</a></div>
                    ${notesBlockHtml}
                  </td>

                  <!-- Right Column: Details -->
                  <td width="48%" valign="top" class="col-split-right" style="font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:#333333;">
                    <div style="font-weight:700;color:#12242a;margin-bottom:8px;">Details</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT_STACK};font-size:14px;color:#333333;">
                      <tr>
                        <td style="padding:2px 0;">Subtotal</td>
                        <td align="right" style="padding:2px 0;">${peso(computedSubtotal)}</td>
                      </tr>${discountRowHtml}
                      <tr>
                        <td style="padding:2px 0;">Delivery</td>
                        <td align="right" style="padding:2px 0;color:#333333;">${esc(deliveryDisplay)}</td>
                      </tr>
                      <tr>
                        <td style="padding:2px 0;">Payment Method</td>
                        <td align="right" style="padding:2px 0;color:#333333;">${esc(paymentDisplay)}</td>
                      </tr>
                      <tr>
                        <td style="padding:2px 0;">Order Date</td>
                        <td align="right" style="padding:2px 0;color:#777777;">${esc(orderDate)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Centered Order Total -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:30px 0;border-bottom:1px solid #ececec;">
                    <div style="font-family:${FONT_STACK};font-size:13px;color:#888888;margin-bottom:6px;">
                      Order Total
                    </div>
                    <div style="font-family:${FONT_STACK};font-size:32px;font-weight:700;color:#12242a;letter-spacing:-0.02em;">
                      ${peso(computedTotal)}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Keep in Touch Footer -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:28px 0 4px 0;font-family:${FONT_STACK};">
                    <div style="font-size:18px;font-weight:400;color:#12242a;margin-bottom:12px;">
                      Keep in Touch
                    </div>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#444444;">
                      If you have any questions, concerns, or suggestions,<br>
                      please email us: <a href="mailto:${esc(supportEmail)}" style="color:#1a56db;text-decoration:underline;">${esc(supportEmail)}</a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailText({
  orderNo = "ORD-0000",
  orderDate = "",
  name = "",
  email = "",
  phone = "",
  address = "",
  lines = [],
  subtotal,
  discount = 0,
  couponCode = "",
  deliveryFee = 0,
  total = 0,
  paymentMethod = "COD",
  notes = "",
  supportEmail = "onboarding@resend.dev",
  isShopCopy = false,
} = {}) {
  const computedSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : Number(total) || 0;
  const computedDiscount = Math.max(0, Number(discount) || 0);
  const computedDelivery = Math.max(0, Number(deliveryFee) || 0);
  const computedTotal = Number.isFinite(Number(total))
    ? Number(total)
    : Math.max(0, computedSubtotal - computedDiscount + computedDelivery);
  const cleanCoupon = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
  const cleanNotes = typeof notes === "string" ? notes.trim() : "";
  const paymentDisplay = formatPaymentMethod(paymentMethod);
  const deliveryDisplay = computedDelivery === 0 ? "Free" : peso(computedDelivery);
  const discountLabel = cleanCoupon ? `Discount (${cleanCoupon})` : "Discount";

  const header = isShopCopy ? `New Order Received (#${orderNo})` : `Order Confirmation (#${orderNo})`;
  const itemLines = lines
    .map((l) => {
      const lineSub = Number.isFinite(Number(l.sub)) ? Number(l.sub) : Number(l.price || 0) * Number(l.qty || 1);
      return `${l.qty} x ${l.name} — ${peso(lineSub)}`;
    })
    .join("\n");

  const detailLines = [
    `Subtotal: ${peso(computedSubtotal)}`,
    ...(computedDiscount > 0 ? [`${discountLabel}: -${peso(computedDiscount)}`] : []),
    `Delivery: ${deliveryDisplay}`,
    `Payment Method: ${paymentDisplay}`,
    `Order Date: ${orderDate}`,
    `Order Total: ${peso(computedTotal)}`,
  ];

  const sections = [
    "PASALUBONG CORNER",
    header,
    "",
    `Your Order (#${orderNo}):`,
    itemLines,
    "",
    "Shipping Address:",
    name,
    address,
    phone,
    email,
  ];

  if (cleanNotes) {
    sections.push("", `Delivery Notes: ${cleanNotes}`);
  }

  sections.push("", "Details:", ...detailLines, "", `Questions? Email us: ${supportEmail}`);

  return sections.join("\n");
}

async function sendEmail(payload) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
}

const handler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const body = req.body || {};
  const { name, email, phone, address, items } = body;
  if (
    ![name, email, phone, address].every((v) => typeof v === "string" && v.trim()) ||
    !/^\S+@\S+\.\S+$/.test(email.trim()) ||
    !Array.isArray(items) ||
    !items.length
  ) {
    return res.status(400).json({ error: "Missing or invalid order details." });
  }

  const lines = [];
  let subtotal = 0;

  for (const it of items) {
    if (!it || typeof it !== "object") {
      return res.status(400).json({ error: "Invalid item in cart." });
    }

    const fallback = it.id != null ? DEFAULT_PRODUCTS[it.id] : undefined;
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || !(qty >= 1 && qty <= 99)) {
      return res.status(400).json({ error: "Invalid item quantity in cart." });
    }

    const rawName = it.name ?? fallback?.name;
    if (typeof rawName !== "string" || !rawName.trim()) {
      return res.status(400).json({ error: "Invalid item name in cart." });
    }
    const itemName = rawName.trim();

    const price = Number(it.price ?? fallback?.price);
    if (!Number.isFinite(price) || !(price > 0 && price <= 100000)) {
      return res.status(400).json({ error: "Invalid item price in cart." });
    }

    const fallbackImg = fallback?.img || "images/01.jpg";
    const rawImg = typeof it.img === "string" && it.img.trim() ? it.img.trim() : fallbackImg;
    const img = /^data:/i.test(rawImg) ? "images/01.jpg" : rawImg;
    const cat = typeof it.cat === "string" && it.cat.trim() ? it.cat.trim() : (fallback?.cat || "sweets");
    const sub = price * qty;

    subtotal += sub;
    lines.push({
      id: it.id,
      name: itemName.trim(),
      img,
      cat,
      price,
      qty,
      sub,
    });
  }

  const discount = Math.max(0, Math.min(subtotal, Number(body.discount) || 0));
  const deliveryFee = Math.max(0, Math.min(5000, Number(body.deliveryFee) || 0));
  const total = subtotal - discount + deliveryFee;

  const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
  const rawPaymentMethod = typeof body.paymentMethod === "string" && body.paymentMethod.trim()
    ? body.paymentMethod.trim()
    : "COD";
  const paymentMethod = ["COD", "GCash", "Bank Transfer"].includes(rawPaymentMethod) ? rawPaymentMethod : "COD";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";

  const customOrderNo = typeof body.orderNo === "string" && body.orderNo.trim()
    ? body.orderNo.trim().replace(/^#/, "")
    : "";
  const orderNo = customOrderNo || "ORD-" + Date.now().toString(36).toUpperCase();

  const orderDate = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const headers = req.headers || {};
  const proto = headers["x-forwarded-proto"] || "https";
  const host = headers["x-forwarded-host"] || headers.host;
  const siteUrl = (process.env.SITE_URL || (host ? `${proto}://${host}` : "https://goarcana.com")).replace(/\/+$/, "");

  const from = process.env.FROM_EMAIL || "Pasalubong Corner <onboarding@resend.dev>";
  const fromMatch = from.match(/<([^>]+)>/);
  const supportEmail = process.env.SHOP_EMAIL || (fromMatch ? fromMatch[1] : from);

  const sharedData = {
    orderNo,
    orderDate,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    address: address.trim(),
    lines,
    subtotal,
    discount,
    couponCode,
    deliveryFee,
    total,
    paymentMethod,
    notes,
    siteUrl,
    supportEmail,
  };

  const customerHtml = buildEmailHtml({ ...sharedData, isShopCopy: false });
  const customerText = buildEmailText({ ...sharedData, isShopCopy: false });
  const shopHtml = buildEmailHtml({ ...sharedData, isShopCopy: true });
  const shopText = buildEmailText({ ...sharedData, isShopCopy: true });

  const apiKey = typeof process.env.RESEND_API_KEY === "string" ? process.env.RESEND_API_KEY.trim() : "";
  if (!apiKey) {
    console.log(`[checkout] RESEND_API_KEY not set; skipping email dispatch for order ${orderNo}.`);
    return res.status(200).json({
      ok: true,
      orderNo,
      emailSent: false,
      total,
      subtotal,
      discount,
      deliveryFee,
    });
  }

  try {
    const emailTasks = [
      sendEmail({
        from,
        to: email.trim(),
        subject: `Order Confirmation (${orderNo})`,
        html: customerHtml,
        text: customerText,
      }),
    ];

    if (process.env.SHOP_EMAIL && String(process.env.SHOP_EMAIL).trim()) {
      emailTasks.push(
        sendEmail({
          from,
          to: String(process.env.SHOP_EMAIL).trim(),
          reply_to: email.trim(),
          subject: `New order ${orderNo} from ${name.trim()}`,
          html: shopHtml,
          text: shopText,
        })
      );
    }

    await Promise.all(emailTasks);
    return res.status(200).json({
      ok: true,
      orderNo,
      emailSent: true,
      total,
      subtotal,
      discount,
      deliveryFee,
    });
  } catch (err) {
    console.error("Email error:", err.message);
    return res.status(500).json({ error: "We could not send the confirmation email." });
  }
};

handler.DEFAULT_PRODUCTS = DEFAULT_PRODUCTS;
handler.PRODUCTS = DEFAULT_PRODUCTS;
handler.buildEmailHtml = buildEmailHtml;
handler.buildEmailText = buildEmailText;

module.exports = handler;
