const { createHash } = require("node:crypto");
const { sendEmail } = require("./checkout");

const stages = ["Pending", "Confirmed", "Packing", "Out for Delivery", "Delivered", "Cancelled"];
const project = process.env.FIREBASE_PROJECT_ID || "pasalubong-54fb9";
const database = `projects/${project}/databases/(default)`;
const documents = `https://firestore.googleapis.com/v1/${database}/documents`;

function getCaller(token) {
  try {
    const { sub } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof sub === "string" && sub.length <= 128 && !/[/?#]/.test(sub) ? sub : "";
  } catch {
    return "";
  }
}

async function firestore(token, path, { method = "GET", body } = {}) {
  const response = await fetch(documents + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) {
    throw Object.assign(new Error("Firestore request failed."), { status: response.status });
  }
  return response.json();
}

function orderState(doc) {
  const fields = doc.fields || {};
  return {
    status: fields.status?.stringValue || "Pending",
    updatedAt: Number(fields.updatedAt?.integerValue || 0),
    emailPending: fields.statusEmailPending?.booleanValue === true,
  };
}

function updateFields(doc, fields) {
  return {
    update: { name: doc.name, fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime: doc.updateTime },
  };
}

async function restoreStock(token, order) {
  const quantities = new Map();
  for (const row of order.fields?.items?.arrayValue?.values || []) {
    const fields = row.mapValue?.fields;
    const id = Number(fields?.id?.integerValue ?? fields?.id?.doubleValue);
    const qty = Number(fields?.qty?.integerValue ?? fields?.qty?.doubleValue);
    if (Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(qty) && qty > 0) {
      quantities.set(id, (quantities.get(id) || 0) + qty);
    }
  }
  const updates = await Promise.all([...quantities].map(async ([id, qty]) => {
    try {
      const product = await firestore(token, `/products/${id}`);
      const stock = Number(product.fields?.stock?.integerValue ?? product.fields?.stock?.doubleValue ?? 0);
      const sold = Number(product.fields?.sold?.integerValue ?? product.fields?.sold?.doubleValue ?? 0);
      return updateFields(product, {
        stock: { doubleValue: stock + qty },
        sold: { doubleValue: Math.max(0, sold - qty) },
      });
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }));
  return updates.filter(Boolean);
}

function recipientFor(order) {
  const address = (order.fields?.customer?.mapValue?.fields?.email?.stringValue ||
    order.fields?.email?.stringValue || "").trim();
  return /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(address) ? address : "";
}

async function deliverNotification(token, order, orderNo) {
  const state = orderState(order);
  const to = recipientFor(order);
  try {
    if (to) {
      const from = process.env.FROM_EMAIL || "Pasalubong Corner <onboarding@resend.dev>";
      const site = (process.env.SITE_URL || "https://goarcana.com").replace(/\/+$/, "");
      const key = createHash("sha256").update(`${project}/${orderNo}/${state.status}/${state.updatedAt}`).digest("hex");
      await sendEmail({
        from,
        to,
        subject: `Order ${orderNo} update: ${state.status}`,
        text: `Your Pasalubong Corner order ${orderNo} is now ${state.status}.\n\nTrack your order at ${site} using this order number.\n\nPasalubong Corner`,
      }, `order-status/${key}`);
    }
    await firestore(token, ":commit", {
      method: "POST", body: { writes: [updateFields(order, { statusEmailPending: { booleanValue: false } })] },
    });
    return { ...state, emailPending: false, notification: to ? "sent" : "no-email" };
  } catch {
    // A concurrent retry may already have delivered and acknowledged this transition.
    const current = await firestore(token, `/orders/${encodeURIComponent(orderNo)}`).catch(() => null);
    if (current && !orderState(current).emailPending) {
      return { ...orderState(current), notification: to ? "sent" : "no-email" };
    }
    return { ...state, notification: "pending" };
  }
}

module.exports = async (req, res) => {
  if (!["POST", "DELETE"].includes(req.method)) return res.status(405).json({ error: "Method not allowed." });
  const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || "")?.[1];
  const uid = token && getCaller(token);
  if (!uid) return res.status(401).json({ error: "Sign in with a Firebase staff account." });

  const { orderNo, status } = req.body || {};
  if (typeof orderNo !== "string" || !orderNo || orderNo.length > 120 ||
      orderNo === "." || orderNo === ".." || /[\u0000-\u001f\u007f/]/.test(orderNo) ||
      (req.method === "POST" && !stages.includes(status))) {
    return res.status(400).json({ error: "Invalid order number or status." });
  }

  try {
    const role = await firestore(token, `/orderStaff/${encodeURIComponent(uid)}`);
    if (role.fields?.enabled?.booleanValue !== true) {
      return res.status(403).json({ error: "Firebase staff access is required." });
    }
  } catch (error) {
    const forbidden = [401, 403, 404].includes(error.status);
    return res.status(forbidden ? 403 : 503).json({ error: forbidden ? "Firebase staff access is required." : "Staff access could not be checked. Try again." });
  }

  try {
    const path = `/orders/${encodeURIComponent(orderNo)}`;
    let order = await firestore(token, path);
    const current = orderState(order);
    if (req.method === "DELETE") {
      if (current.emailPending) return res.status(409).json({ error: "Send the pending customer notification before deleting the order." });
      await firestore(token, ":commit", {
        method: "POST",
        body: { writes: [{ delete: order.name, currentDocument: { updateTime: order.updateTime } }] },
      });
      return res.status(200).json({ deleted: true });
    }

    if (status !== current.status) {
      const currentIndex = stages.indexOf(current.status);
      if (currentIndex < 0 || currentIndex >= stages.indexOf("Delivered") || stages.indexOf(status) <= currentIndex) {
        return res.status(409).json({ error: "Order statuses can only move forward.", ...current });
      }
      if (current.emailPending) {
        return res.status(409).json({ error: "Send the pending customer notification before moving this order forward.", ...current });
      }
      if (recipientFor(order) && !process.env.RESEND_API_KEY?.trim()) {
        return res.status(503).json({ error: "Customer email is unavailable. The order status was not changed." });
      }
      const updatedAt = Date.now();
      const writes = [updateFields(order, {
        status: { stringValue: status },
        updatedAt: { integerValue: String(updatedAt) },
        statusEmailPending: { booleanValue: true },
      })];
      if (status === "Cancelled") writes.push(...await restoreStock(token, order));
      await firestore(token, ":commit", { method: "POST", body: { writes } });
      order = await firestore(token, path);
    }

    if (!orderState(order).emailPending) {
      return res.status(200).json({ ...orderState(order), notification: "unchanged" });
    }
    return res.status(200).json(await deliverNotification(token, order, orderNo));
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: "Order could not be found." });
    if ([400, 409, 412].includes(error.status)) {
      return res.status(409).json({ error: "The order changed while you were editing it. Refresh and try again." });
    }
    if ([401, 403].includes(error.status)) {
      return res.status(403).json({ error: "Firestore denied this update. Check the staff role and published rules." });
    }
    return res.status(503).json({ error: "Order update could not be confirmed. Refresh before trying again." });
  }
};
