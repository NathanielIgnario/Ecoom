/* ==================== PASALUBONG CORNER — ADMIN DASHBOARD JS ==================== */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const ORDER_STATUSES = [
    "Pending",
    "Confirmed",
    "Packing",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
  ];

  const PRESET_IMAGES = [
    { path: "images/01.jpg", label: "Dried Mangoes (Photo)" },
    { path: "images/02.jpg", label: "Otap Biscuits (Photo)" },
    { path: "images/03.jpg", label: "Rosquillos (Photo)" },
    { path: "images/04.jpg", label: "Sinamay Tote (Photo)" },
    { path: "images/05.jpg", label: "Guitar Keychain (Photo)" },
    { path: "images/06.jpg", label: "Cebu T-Shirt (Photo)" },
    { path: "images/mango.svg", label: "Mango (SVG)" },
    { path: "images/otap.svg", label: "Otap (SVG)" },
    { path: "images/rosquillos.svg", label: "Rosquillos (SVG)" },
    { path: "images/tote.svg", label: "Tote Bag (SVG)" },
    { path: "images/guitar.svg", label: "Guitar (SVG)" },
    { path: "images/tshirt.svg", label: "T-Shirt (SVG)" },
  ];

  let activeTab = "overview";
  let prodQuery = "";
  let prodCat = "All";
  let prodStock = "all";
  let orderStatusFilter = "All";
  let orderQuery = "";
  let toastTimer = null;

  function db() {
    return window.PasalubongDB;
  }

  function toast(text) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function formatDate(ts) {
    if (!ts) return "Just now";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatIsoDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toISOString().replace("T", " ").slice(0, 16);
  }

  function getOrderCustomer(o) {
    const c = o.customer || {};
    return {
      name: c.name || o.name || "Guest Customer",
      email: c.email || o.email || "",
      phone: c.phone || o.phone || "",
      address: c.address || o.address || "",
    };
  }

  /* ==================== 1. AUTH GATE & HEADER ==================== */
  function syncAuthView() {
    const loggedIn = db().isAdminLoggedIn();
    const gate = $("#loginGate");
    const app = $("#adminApp");
    if (loggedIn) {
      gate.hidden = true;
      app.hidden = false;
      renderAll();
    } else {
      gate.hidden = false;
      app.hidden = true;
    }
  }

  function initAuthEvents() {
    $("#adminPwToggle").addEventListener("click", () => {
      const input = $("#adminPassword");
      const btn = $("#adminPwToggle");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", String(show));
    });

    $("#adminLoginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#adminEmail").value.trim();
      const password = $("#adminPassword").value;
      const msg = $("#adminLoginMsg");
      const res = db().loginAdmin(email, password);
      if (!res?.ok || !db().isAdminLoggedIn()) {
        msg.className = "form-msg err";
        msg.textContent = res?.ok
          ? "This browser couldn’t save your sign-in. Allow site data and try again."
          : res?.error || "Invalid admin email or password.";
        return;
      }
      msg.textContent = "";
      $("#adminLoginForm").reset();
      syncAuthView();
      toast("Signed in to Pasalubong Corner Admin");
    });

    $("#adminLogoutBtn").addEventListener("click", () => {
      db().logoutAdmin();
      syncAuthView();
      toast("Logged out of Admin Panel");
    });

  }

  /* ==================== 2. NAVIGATION TABS ==================== */
  function switchTab(tabName) {
    activeTab = tabName;
    $$(".admin-tab").forEach((btn) => {
      const isMatch = btn.dataset.tab === tabName;
      btn.setAttribute("aria-selected", String(isMatch));
    });
    ["overview", "products", "orders", "coupons"].forEach((t) => {
      const panel = $(`#tab-${t}`);
      if (panel) panel.hidden = t !== tabName;
    });
    renderAll();
  }

  function initTabs() {
    $$(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    $("#viewAllOrdersBtn").addEventListener("click", () => switchTab("orders"));
    $("#quickAddProdBtn").addEventListener("click", () => {
      switchTab("products");
      openProductModal(null);
    });
  }

  /* ==================== 3. RENDER ALL & HEADER STATUS ==================== */
  function renderDbConnectionBadge() {
    const state = db().getState();
    const badge = $("#dbStatusBadge");
    const text = $("#dbStatusText");

    const isCloud = state.firebaseMode === "cloud" || state.firebaseMode === "connected";
    if (isCloud && state.projectId) {
      badge.className = "db-badge cloud";
      text.textContent = `Firebase Cloud: ${state.projectId}`;
    } else if (state.firebaseMode === "error") {
      badge.className = "db-badge local";
      text.textContent = "Local DB (Firebase Fallback)";
    } else {
      badge.className = "db-badge local";
      text.textContent = "Local DB Synced";
    }
  }

  function renderNavCounts() {
    const allProds = db().getProducts(true);
    const orders = db().getOrders();
    const coupons = db().getCoupons();
    $("#navProdCount").textContent = allProds.length;
    $("#navOrderCount").textContent = orders.length;
    $("#navCouponCount").textContent = coupons.length;
  }

  /* ==================== 4. TAB 1: OVERVIEW & ANALYTICS ==================== */
  function renderOverview() {
    const allProds = db().getProducts(true);
    const orders = db().getOrders();
    const settings = db().getSettings();
    const lowThreshold = Number(settings.lowStockThreshold ?? 5);

    const activeOrders = orders.filter((o) => o.status !== "Cancelled");
    const totalRevenue = activeOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const pendingOrders = orders.filter((o) =>
      ["Pending", "Confirmed", "Packing", "Out for Delivery"].includes(o.status || "Pending")
    );

    const activeProds = allProds.filter((p) => p.active !== false);
    const totalStockUnits = allProds.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
    const lowStockProds = allProds.filter((p) => (Number(p.stock) || 0) <= lowThreshold);
    const outOfStockCount = allProds.filter((p) => (Number(p.stock) || 0) <= 0).length;

    $("#kpiRevenue").textContent = peso(totalRevenue);
    $("#kpiRevenueSub").textContent = `From ${activeOrders.length} non-cancelled ${activeOrders.length === 1 ? "order" : "orders"}`;

    $("#kpiOrders").textContent = String(orders.length);
    $("#kpiOrdersSub").textContent = `${pendingOrders.length} active in fulfillment`;

    $("#kpiProducts").textContent = `${activeProds.length} / ${allProds.length}`;
    $("#kpiProductsSub").textContent = `${totalStockUnits.toLocaleString("en-PH")} total units in stock`;

    $("#kpiLowStock").textContent = String(lowStockProds.length);
    $("#kpiLowStockSub").textContent = `${outOfStockCount} sold out · Threshold ≤ ${lowThreshold}`;

    // Status pipeline
    const counts = {};
    ORDER_STATUSES.forEach((s) => (counts[s] = 0));
    orders.forEach((o) => {
      const st = o.status || "Pending";
      counts[st] = (counts[st] || 0) + 1;
    });

    $("#statusPipeline").innerHTML = ORDER_STATUSES.map(
      (st) => `
      <button type="button" class="pipe-card" data-jump-status="${esc(st)}">
        <strong>${counts[st] || 0}</strong>
        <span>${esc(st)}</span>
      </button>`
    ).join("");

    // Top selling products
    const sortedBySold = [...allProds].sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0));
    const maxSold = Math.max(1, ...sortedBySold.map((p) => Number(p.sold) || 0));
    $("#topProductsList").innerHTML = sortedBySold.length
      ? sortedBySold
          .slice(0, 6)
          .map((p) => {
            const sold = Number(p.sold) || 0;
            const rev = sold * (Number(p.price) || 0);
            const pct = Math.min(100, Math.round((sold / maxSold) * 100));
            return `
            <div class="top-prod-row">
              <img src="${esc(p.img)}" alt="${esc(p.name)}">
              <div>
                <strong>${esc(p.name)}</strong>
                <div class="top-prod-bar-wrap">
                  <div class="top-prod-bar" style="width:${pct}%"></div>
                </div>
              </div>
              <div class="top-prod-metrics">
                <span>${sold} sold</span>
                <small>${peso(rev)} est.</small>
              </div>
            </div>`;
          })
          .join("")
      : `<p class="card-sub">No products in catalog yet.</p>`;

    // Low stock alerts
    $("#lowStockList").innerHTML = lowStockProds.length
      ? lowStockProds
          .sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))
          .map((p) => {
            const st = Number(p.stock) || 0;
            return `
            <div class="low-stock-row ${st <= 0 ? "out" : ""}">
              <div class="low-stock-info">
                <strong>${esc(p.name)}</strong>
                <small>${st <= 0 ? "OUT OF STOCK (0 left)" : `Only ${st} left in stock`}</small>
              </div>
              <button type="button" class="admin-btn sm sun" data-quick-restock="${p.id}">+5 Stock</button>
            </div>`;
          })
          .join("")
      : `<p class="card-sub">All products are well-stocked above ${lowThreshold} units!</p>`;

    // Recent orders table (latest 5)
    const recent = orders.slice(0, 5);
    $("#recentOrdersBody").innerHTML = recent.length
      ? recent
          .map((o) => {
            const cust = getOrderCustomer(o);
            const itemCount = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
            const st = o.status || "Pending";
            return `
            <tr>
              <td><strong>${esc(o.no)}</strong></td>
              <td><small>${esc(formatDate(o.date))}</small></td>
              <td>
                <strong>${esc(cust.name)}</strong>
                <br><small class="hint">${esc(cust.email)}</small>
              </td>
              <td>${itemCount} ${itemCount === 1 ? "item" : "items"}</td>
              <td><span class="pill-badge">${esc(o.paymentMethod || "COD")}</span></td>
              <td><strong>${peso(o.total)}</strong></td>
              <td>
                <select class="status-select" data-order-status="${esc(o.no)}" data-status="${esc(st)}" aria-label="Order status for ${esc(o.no)}">
                  ${ORDER_STATUSES.map(
                    (s) => `<option value="${esc(s)}" ${s === st ? "selected" : ""}>${esc(s)}</option>`
                  ).join("")}
                </select>
              </td>
              <td>
                <button type="button" class="admin-btn sm cream" data-view-order="${esc(o.no)}">Receipt</button>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" style="text-align:center;padding:28px;">No orders yet. Click <strong>+ Generate Sample Order</strong> above to test order workflows!</td></tr>`;
  }

  /* ==================== 5. TAB 2: PRODUCTS & INVENTORY ==================== */
  function getAvailableCategories(extraCat = "") {
    const allProds = db().getProducts(true);
    const settings = db().getSettings();
    const cats = new Set(["Snacks", "Crafts", "Apparel", ...(settings.categories || [])]);
    allProds.forEach((p) => {
      if (p.cat) cats.add(p.cat);
    });
    if (extraCat && extraCat !== "__custom__") {
      cats.add(extraCat);
    }
    return Array.from(cats);
  }

  function populateProductCategorySelect(selectedCat = "Snacks") {
    const catSelect = $("#pf-cat");
    if (!catSelect) return;
    const target = selectedCat && selectedCat !== "__custom__" ? selectedCat : "Snacks";
    const cats = getAvailableCategories(target);
    catSelect.innerHTML =
      cats
        .map((c) => `<option value="${esc(c)}" ${c === target ? "selected" : ""}>${esc(c)}</option>`)
        .join("") +
      `<option value="__custom__">+ Add new category…</option>`;
    catSelect.value = target;

    const customInput = $("#pf-catCustom");
    if (customInput) {
      customInput.hidden = true;
      customInput.required = false;
      customInput.value = "";
    }
  }

  function renderCategoryFilterOptions() {
    const cats = getAvailableCategories();

    const select = $("#prodCatFilter");
    const current = select.value || "All";
    select.innerHTML =
      `<option value="All">All Categories</option>` +
      cats
        .map((c) => `<option value="${esc(c)}" ${c === current ? "selected" : ""}>${esc(c)}</option>`)
        .join("");

    const catSelect = $("#pf-cat");
    if (catSelect && !$("#productModal")?.open) {
      populateProductCategorySelect(catSelect.value || "Snacks");
    }
  }

  function renderProductsTable() {
    renderCategoryFilterOptions();
    const allProds = db().getProducts(true);
    const settings = db().getSettings();
    const lowThreshold = Number(settings.lowStockThreshold ?? 5);
    const term = prodQuery.trim().toLowerCase();

    const filtered = allProds.filter((p) => {
      if (prodCat !== "All" && p.cat !== prodCat) return false;
      const st = Number(p.stock) || 0;
      if (prodStock === "in" && st <= lowThreshold) return false;
      if (prodStock === "low" && (st <= 0 || st > lowThreshold)) return false;
      if (prodStock === "out" && st > 0) return false;
      if (term) {
        const hay = `${p.name} ${p.sku || ""} ${p.cat} ${p.desc} ${p.badge || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    $("#prodTableBody").innerHTML = filtered.length
      ? filtered
          .map((p) => {
            const st = Number(p.stock) || 0;
            const stockClass = st <= 0 ? "out" : st <= lowThreshold ? "low" : "";
            const isActive = p.active !== false;
            return `
            <tr>
              <td>
                <div class="prod-cell">
                  <img class="prod-thumb ${p.cover ? "cover" : ""}" src="${esc(p.img)}" alt="${esc(p.name)}">
                  <div class="prod-cell-info">
                    <strong>${esc(p.name)}</strong>
                    <small>${esc(p.desc)}</small>
                    ${p.badge ? `<span class="pill-badge sun">${esc(p.badge)}</span>` : ""}
                  </div>
                </div>
              </td>
              <td><code>${esc(p.sku || `SKU-00${p.id}`)}</code></td>
              <td><span class="pill-badge">${esc(p.cat)}</span></td>
              <td>
                <strong>${peso(p.price)}</strong>
                ${p.comparePrice && Number(p.comparePrice) > Number(p.price) ? `<span class="compare-strike">${peso(p.comparePrice)}</span>` : ""}
              </td>
              <td>
                <div class="stock-stepper ${stockClass}">
                  <button type="button" data-stock-adj="-1" data-id="${p.id}" aria-label="Decrease stock for ${esc(p.name)}">−</button>
                  <span>${st}</span>
                  <button type="button" data-stock-adj="1" data-id="${p.id}" aria-label="Increase stock for ${esc(p.name)}">+</button>
                </div>
              </td>
              <td><strong>${Number(p.sold) || 0}</strong></td>
              <td>
                <span class="pill-badge ${isActive ? "leaf" : "muted"}">${isActive ? "Active" : "Hidden"}</span>
              </td>
              <td>
                <div class="row-actions">
                  <button type="button" class="admin-btn sm cream" data-edit-prod="${p.id}">Edit</button>
                  <button type="button" class="admin-btn sm danger" data-del-prod="${p.id}">Delete</button>
                </div>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" style="text-align:center;padding:30px;">No matching products found.</td></tr>`;
  }

  function initPresetGallery() {
    const gallery = $("#presetGallery");
    if (!gallery) return;
    gallery.innerHTML = PRESET_IMAGES.map(
      (item) => `
      <button type="button" class="preset-thumb" data-preset-img="${esc(item.path)}" title="${esc(item.label)}">
        <img src="${esc(item.path)}" alt="${esc(item.label)}">
      </button>`
    ).join("");

    gallery.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-preset-img]");
      if (!btn) return;
      const path = btn.dataset.presetImg;
      $("#pf-img").value = path;
      updateProductImagePreview(path);
    });
  }

  function updateProductImagePreview(src) {
    const img = $("#pf-imgPreview");
    const fallback = "images/01.jpg";
    img.src = src && src.trim() ? src.trim() : fallback;
    img.classList.toggle("cover", $("#pf-cover").checked);
    $$(".preset-thumb").forEach((b) => {
      b.classList.toggle("active", b.dataset.presetImg === src);
    });
  }

  function compressImageFile(file, maxDim = 480, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Invalid image file."));
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openProductModal(prodId = null) {
    const modal = $("#productModal");
    const form = $("#productForm");
    form.reset();
    $("#prodFormMsg").textContent = "";
    $("#pf-imgFile").value = "";

    const allProds = db().getProducts(true);
    const prod = prodId ? allProds.find((p) => Number(p.id) === Number(prodId)) : null;

    if (prod) {
      const targetCat = prod.cat || "Snacks";
      populateProductCategorySelect(targetCat);
      $("#prodModalTitle").textContent = `Edit Product: ${prod.name}`;
      $("#pf-id").value = prod.id;
      $("#pf-name").value = prod.name || "";
      $("#pf-sku").value = prod.sku || `CEB-00${prod.id}`;
      $("#pf-cat").value = targetCat;
      $("#pf-price").value = prod.price ?? 100;
      $("#pf-comparePrice").value = prod.comparePrice || "";
      $("#pf-stock").value = prod.stock ?? 20;
      $("#pf-badge").value = prod.badge || "";
      $("#pf-desc").value = prod.desc || "";
      $("#pf-longDesc").value = prod.longDesc || "";
      $("#pf-img").value = prod.img || "images/01.jpg";
      $("#pf-cover").checked = !!prod.cover;
      $("#pf-featured").checked = prod.featured !== false;
      $("#pf-active").checked = prod.active !== false;
      updateProductImagePreview(prod.img || "images/01.jpg");
    } else {
      const nextNum = allProds.length + 1;
      populateProductCategorySelect("Snacks");
      $("#prodModalTitle").textContent = "Add New Product";
      $("#pf-id").value = "";
      $("#pf-sku").value = `CEB-ITEM-${String(nextNum).padStart(3, "0")}`;
      $("#pf-cat").value = "Snacks";
      $("#pf-stock").value = 25;
      $("#pf-img").value = "images/01.jpg";
      $("#pf-cover").checked = false;
      $("#pf-featured").checked = true;
      $("#pf-active").checked = true;
      updateProductImagePreview("images/01.jpg");
    }

    if (!modal.open) modal.showModal();
  }

  /* ==================== 6. TAB 3: ORDERS MANAGER ==================== */
  function renderOrderStatusChips() {
    const orders = db().getOrders();
    const statuses = ["All", ...ORDER_STATUSES];
    $("#orderStatusChips").innerHTML = statuses
      .map((st) => {
        const count =
          st === "All"
            ? orders.length
            : orders.filter((o) => (o.status || "Pending") === st).length;
        return `<button type="button" class="chip" data-order-chip="${esc(st)}" aria-pressed="${st === orderStatusFilter}">
          ${esc(st)}<span class="n">${count}</span>
        </button>`;
      })
      .join("");
  }

  function renderOrdersTable() {
    renderOrderStatusChips();
    const orders = db().getOrders();
    const term = orderQuery.trim().toLowerCase();

    const filtered = orders.filter((o) => {
      const st = o.status || "Pending";
      if (orderStatusFilter !== "All" && st !== orderStatusFilter) return false;
      if (term) {
        const cust = getOrderCustomer(o);
        const hay = `${o.no} ${cust.name} ${cust.email} ${cust.phone} ${cust.address} ${o.paymentMethod || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    $("#ordersTableBody").innerHTML = filtered.length
      ? filtered
          .map((o) => {
            const cust = getOrderCustomer(o);
            const st = o.status || "Pending";
            const itemsSummary = (o.items || [])
              .map((i) => `${esc(i.name)} × ${i.qty}`)
              .join("<br>");
            return `
            <tr>
              <td class="ord-col-no">
                <strong>${esc(o.no)}</strong>
                <br><small class="hint">${esc(formatDate(o.date))}</small>
              </td>
              <td class="ord-col-cust">
                <strong>${esc(cust.name)}</strong>
                <br><small>${esc(cust.email)} · ${esc(cust.phone)}</small>
                <br><small class="hint">${esc(cust.address)}</small>
                ${o.notes ? `<br><small class="pill-badge sun">Note: ${esc(o.notes)}</small>` : ""}
              </td>
              <td class="ord-col-pay"><span class="pill-badge">${esc(o.paymentMethod || "COD")}</span></td>
              <td class="ord-col-items"><small>${itemsSummary || "—"}</small></td>
              <td class="ord-col-total">
                <small>Sub: ${peso(o.subtotal ?? o.total)}</small>
                ${o.discount ? `<br><small style="color:var(--leaf)">Disc (${esc(o.couponCode || "PROMO")}): −${peso(o.discount)}</small>` : ""}
                <br><small>Deliv: ${Number(o.deliveryFee) === 0 ? "Free" : peso(o.deliveryFee)}</small>
                <br><strong>Total: ${peso(o.total)}</strong>
              </td>
              <td class="ord-col-status">
                <select class="status-select" data-order-status="${esc(o.no)}" data-status="${esc(st)}" aria-label="Status for order ${esc(o.no)}">
                  ${ORDER_STATUSES.map(
                    (s) => `<option value="${esc(s)}" ${s === st ? "selected" : ""}>${esc(s)}</option>`
                  ).join("")}
                </select>
              </td>
              <td class="ord-col-actions">
                <select class="admin-select sm order-act-select" data-order-act="${esc(o.no)}" aria-label="Actions for ${esc(o.no)}">
                  <option value="">Action ▾</option>
                  <option value="view">📄 View Receipt</option>
                  <option value="delete">🗑️ Delete Order</option>
                </select>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="7" style="text-align:center;padding:30px;">No matching orders found.</td></tr>`;
  }

  function openOrderReceiptModal(orderNo) {
    const o = db().getOrderByNo(orderNo);
    if (!o) return;
    const cust = getOrderCustomer(o);
    const st = o.status || "Pending";
    $("#orderModalTitle").textContent = `Order ${o.no}`;
    $("#orderModalDate").textContent = `Placed on ${formatDate(o.date)} · Payment: ${o.paymentMethod || "COD"}`;

    $("#orderModalContent").innerHTML = `
      <div class="receipt-meta-grid">
        <div>
          <strong>Customer Details</strong>
          <p style="margin:4px 0 0">${esc(cust.name)}<br>${esc(cust.email)}<br>${esc(cust.phone)}</p>
        </div>
        <div>
          <strong>Delivery Address</strong>
          <p style="margin:4px 0 0">${esc(cust.address || "—")}</p>
          ${o.notes ? `<p style="margin:4px 0 0"><em>Notes: ${esc(o.notes)}</em></p>` : ""}
        </div>
      </div>

      <div class="field">
        <label for="modalOrderStatusSelect">Fulfillment Status</label>
        <select id="modalOrderStatusSelect" class="status-select" data-order-status="${esc(o.no)}" data-status="${esc(st)}">
          ${ORDER_STATUSES.map(
            (s) => `<option value="${esc(s)}" ${s === st ? "selected" : ""}>${esc(s)}</option>`
          ).join("")}
        </select>
      </div>

      <div class="receipt-lines">
        ${(o.items || [])
          .map(
            (it) => `
          <div class="receipt-line">
            <span><strong>${esc(it.name)}</strong> × ${it.qty} <small>(${peso(it.price)} each)</small></span>
            <strong>${peso((Number(it.price) || 0) * (Number(it.qty) || 1))}</strong>
          </div>`
          )
          .join("")}
      </div>

      <div class="receipt-totals">
        <div class="receipt-tot-row"><span>Subtotal</span><span>${peso(o.subtotal ?? o.total)}</span></div>
        ${
          o.discount
            ? `<div class="receipt-tot-row" style="color:var(--leaf)"><span>Promo Discount (${esc(o.couponCode || "PROMO")})</span><span>−${peso(o.discount)}</span></div>`
            : ""
        }
        <div class="receipt-tot-row"><span>Delivery Fee</span><span>${Number(o.deliveryFee) === 0 ? "Free" : peso(o.deliveryFee)}</span></div>
        <div class="receipt-tot-row grand"><span>Total Paid / Due</span><span>${peso(o.total)}</span></div>
      </div>
    `;

    const modal = $("#orderModal");
    if (!modal.open) modal.showModal();
  }

  async function generateSampleOrder() {
    const prods = db().getProducts(true);
    if (!prods.length) {
      toast("Add at least one product first");
      return;
    }
    const samples = [
      {
        name: "Maria Clara Santos",
        email: "maria.santos@cebumail.ph",
        phone: "0917 812 3341",
        address: "Unit 4B IT Park Tower, Lahug, Cebu City",
        paymentMethod: "GCash",
        notes: "Please leave at the lobby concierge.",
      },
      {
        name: "Carlo Miguel Reyes",
        email: "carlo.reyes@example.ph",
        phone: "0918 441 9082",
        address: "88 A.S. Fortuna St., Banilad, Mandaue City",
        paymentMethod: "COD",
        notes: "Call upon arrival at gate.",
      },
      {
        name: "Leah Mae Dizon",
        email: "leah.dizon@example.ph",
        phone: "0922 778 1234",
        address: "Punta Engaño Rd., Lapu-Lapu City, Mactan",
        paymentMethod: "Bank Transfer",
        notes: "Gift package — please pack with care!",
      },
    ];
    const cust = samples[Math.floor(Math.random() * samples.length)];
    const shuffled = [...prods].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, Math.min(2, shuffled.length));
    const items = picked.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price) || 100,
      qty: Math.floor(Math.random() * 2) + 1,
      img: p.img,
      cat: p.cat,
    }));
    const settings = db().getSettings();
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const deliveryFee =
      subtotal >= Number(settings.freeDeliveryThreshold ?? 500)
        ? 0
        : Number(settings.deliveryFee ?? 60);
    const orderNo =
      "ORD-" +
      Math.random().toString(36).substring(2, 6).toUpperCase() +
      "-" +
      String(Date.now()).slice(-3);

    const saved = await db().recordOrder({
      no: orderNo,
      date: Date.now(),
      status: "Pending",
      customer: {
        name: cust.name,
        email: cust.email,
        phone: cust.phone,
        address: cust.address,
      },
      items,
      subtotal,
      discount: 0,
      couponCode: "",
      deliveryFee,
      total: subtotal + deliveryFee,
      paymentMethod: cust.paymentMethod,
      notes: cust.notes,
    });

    renderAll();
    toast(`Sample order ${saved?.no || orderNo} created!`);
  }

  /* ==================== 7. TAB 4: PROMO CODES & DISCOUNTS ==================== */
  function renderCoupons() {
    const coupons = db().getCoupons();
    $("#couponsGrid").innerHTML = coupons.length
      ? coupons
          .map((c) => {
            const typeLabel =
              c.type === "percent"
                ? `${c.value}% OFF`
                : c.type === "fixed"
                ? `${peso(c.value)} OFF`
                : "FREE DELIVERY";
            const isActive = c.active !== false;
            return `
            <article class="coupon-card ${isActive ? "" : "inactive"}">
              <div>
                <div class="coupon-top">
                  <span class="coupon-code-pill">${esc(c.code)}</span>
                  <span class="pill-badge ${isActive ? "leaf" : "muted"}">${isActive ? "Active" : "Disabled"}</span>
                </div>
                <div class="coupon-body" style="margin-top:14px">
                  <strong>${esc(typeLabel)}</strong>
                  <p>${esc(c.desc || `Minimum order ${peso(c.minOrder || 0)}`)}</p>
                  <small class="hint">Min subtotal: ${peso(c.minOrder || 0)} · Used ${Number(c.usageCount) || 0} times</small>
                </div>
              </div>
              <div class="coupon-foot">
                <button type="button" class="admin-btn sm cream" data-toggle-coupon="${esc(c.code)}">
                  ${isActive ? "Disable" : "Activate"}
                </button>
                <div class="row-actions">
                  <button type="button" class="admin-btn sm outline" data-edit-coupon="${esc(c.code)}">Edit</button>
                  <button type="button" class="admin-btn sm danger" data-del-coupon="${esc(c.code)}">Delete</button>
                </div>
              </div>
            </article>`;
          })
          .join("")
      : `<div class="admin-card"><p>No promo codes configured. Click <strong>+ Create Promo Code</strong> to add one.</p></div>`;
  }

  function openCouponModal(code = null) {
    const modal = $("#couponModal");
    const form = $("#couponForm");
    form.reset();
    $("#couponFormMsg").textContent = "";

    const existing = code
      ? db()
          .getCoupons()
          .find((c) => c.code.toUpperCase() === code.toUpperCase())
      : null;

    if (existing) {
      $("#couponModalTitle").textContent = `Edit Promo Code: ${existing.code}`;
      $("#cf-code").value = existing.code;
      $("#cf-type").value = existing.type || "percent";
      $("#cf-value").value = existing.value ?? 10;
      $("#cf-minOrder").value = existing.minOrder ?? 0;
      $("#cf-desc").value = existing.desc || "";
      $("#cf-active").checked = existing.active !== false;
    } else {
      $("#couponModalTitle").textContent = "Create Promo Code";
      $("#cf-code").value = "";
      $("#cf-type").value = "percent";
      $("#cf-value").value = 10;
      $("#cf-minOrder").value = 200;
      $("#cf-desc").value = "";
      $("#cf-active").checked = true;
    }

    if (!modal.open) modal.showModal();
  }

  /* ==================== 8. CSV EXPORT ==================== */
  function csvCell(val) {
    const str = String(val ?? "").replace(/\r?\n/g, " ");
    if (/[",]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function triggerBlobDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportOrdersCsv() {
    const list = db().getOrders();
    const headers = [
      "Order No",
      "Date",
      "Customer Name",
      "Email",
      "Phone",
      "Address",
      "Payment Method",
      "Status",
      "Items Summary",
      "Items Qty",
      "Subtotal (PHP)",
      "Discount (PHP)",
      "Coupon",
      "Delivery Fee (PHP)",
      "Total (PHP)",
      "Notes",
    ];

    const rows = list.map((o) => {
      const cust = getOrderCustomer(o);
      const itemsSummary = (o.items || []).map((i) => `${i.name} x${i.qty}`).join("; ");
      const itemsQty = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
      return [
        o.no,
        formatIsoDate(o.date),
        cust.name,
        cust.email,
        cust.phone,
        cust.address,
        o.paymentMethod || "COD",
        o.status || "Pending",
        itemsSummary,
        itemsQty,
        Number(o.subtotal ?? o.total) || 0,
        Number(o.discount) || 0,
        o.couponCode || "",
        Number(o.deliveryFee) || 0,
        Number(o.total) || 0,
        o.notes || "",
      ];
    });

    const totalQty = list.reduce(
      (s, o) => s + (o.items || []).reduce((acc, i) => acc + (Number(i.qty) || 0), 0),
      0
    );
    const totalSub = list.reduce((s, o) => s + (Number(o.subtotal ?? o.total) || 0), 0);
    const totalDisc = list.reduce((s, o) => s + (Number(o.discount) || 0), 0);
    const totalDeliv = list.reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);
    const totalGrand = list.reduce((s, o) => s + (Number(o.total) || 0), 0);

    rows.push([
      "GRAND TOTAL",
      `${list.length} Orders`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totalQty,
      totalSub,
      totalDisc,
      "",
      totalDeliv,
      totalGrand,
      "",
    ]);

    const csv =
      "\uFEFF" +
      [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");

    const stamp = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(csv, `pasalubong-orders-report-${stamp}.csv`, "text/csv;charset=utf-8;");
    toast(`Exported ${list.length} orders to Excel CSV!`);
  }

  function exportInventoryCsv() {
    const allProds = db().getProducts(true);
    const settings = db().getSettings();
    const lowThreshold = Number(settings.lowStockThreshold ?? 5);

    const headers = [
      "ID",
      "SKU",
      "Product Name",
      "Category",
      "Unit Price (PHP)",
      "Compare Price (PHP)",
      "Current Stock",
      "Units Sold",
      "Gross Revenue (PHP)",
      "Stock Value (PHP)",
      "Status",
    ];

    const rows = allProds.map((p) => {
      const price = Number(p.price) || 0;
      const stock = Number(p.stock) || 0;
      const sold = Number(p.sold) || 0;
      const status =
        p.active === false
          ? "Hidden"
          : stock <= 0
          ? "Out of Stock"
          : stock <= lowThreshold
          ? "Low Stock"
          : "In Stock";
      return [
        p.id,
        p.sku || `SKU-00${p.id}`,
        p.name,
        p.cat,
        price,
        p.comparePrice || "",
        stock,
        sold,
        price * sold,
        price * stock,
        status,
      ];
    });

    const totalStock = allProds.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const totalSold = allProds.reduce((s, p) => s + (Number(p.sold) || 0), 0);
    const totalGross = allProds.reduce(
      (s, p) => s + (Number(p.price) || 0) * (Number(p.sold) || 0),
      0
    );
    const totalVal = allProds.reduce(
      (s, p) => s + (Number(p.price) || 0) * (Number(p.stock) || 0),
      0
    );

    rows.push([
      "TOTAL",
      `${allProds.length} Products`,
      "",
      "",
      "",
      "",
      totalStock,
      totalSold,
      totalGross,
      totalVal,
      "",
    ]);

    const csv =
      "\uFEFF" +
      [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");

    const stamp = new Date().toISOString().slice(0, 10);
    triggerBlobDownload(csv, `pasalubong-inventory-report-${stamp}.csv`, "text/csv;charset=utf-8;");
    toast(`Exported ${allProds.length} products to Excel CSV!`);
  }

  /* ==================== 9. EVENT LISTENERS ==================== */
  function initDashboardEvents() {
    // Sample order buttons
    $("#genSampleOrderBtn").addEventListener("click", generateSampleOrder);
    $("#genSampleOrderBtn2").addEventListener("click", generateSampleOrder);

    // Quick Excel export buttons in Products & Orders toolbars
    $("#quickExportProductsBtn").addEventListener("click", () => exportInventoryCsv());
    $("#quickExportOrdersBtn").addEventListener("click", exportOrdersCsv);

    // Delegated clicks in Overview
    $("#tab-overview").addEventListener("click", async (e) => {
      const pipe = e.target.closest("[data-jump-status]");
      if (pipe) {
        orderStatusFilter = pipe.dataset.jumpStatus;
        switchTab("orders");
        return;
      }
      const restock = e.target.closest("[data-quick-restock]");
      if (restock) {
        const id = Number(restock.dataset.quickRestock);
        await db().adjustStock(id, 5);
        renderAll();
        toast("Added +5 units to stock");
        return;
      }
      const viewBtn = e.target.closest("[data-view-order]");
      if (viewBtn) {
        openOrderReceiptModal(viewBtn.dataset.viewOrder);
      }
    });

    // Delegated status change & single Action dropdown across Overview, Orders table, and Order Modal
    document.addEventListener("change", async (e) => {
      const statusSel = e.target.closest("[data-order-status]");
      if (statusSel) {
        const orderNo = statusSel.dataset.orderStatus;
        const newStatus = statusSel.value;
        statusSel.dataset.status = newStatus;
        await db().updateOrderStatus(orderNo, newStatus);
        renderAll();
        toast(`Order ${orderNo} marked as ${newStatus}`);
        return;
      }

      const actSel = e.target.closest("[data-order-act]");
      if (actSel) {
        const orderNo = actSel.dataset.orderAct;
        const action = actSel.value;
        actSel.value = "";
        if (!action) return;

        if (action === "view") {
          openOrderReceiptModal(orderNo);
        } else if (action === "delete") {
          await db().deleteOrder(orderNo);
          renderAll();
          toast(`Deleted order ${orderNo}`);
        }
      }
    });

    // Products filter & actions
    $("#prodSearch").addEventListener("input", (e) => {
      prodQuery = e.target.value;
      renderProductsTable();
    });
    $("#prodCatFilter").addEventListener("change", (e) => {
      prodCat = e.target.value;
      renderProductsTable();
    });
    $("#prodStockFilter").addEventListener("change", (e) => {
      prodStock = e.target.value;
      renderProductsTable();
    });
    $("#addProductBtn").addEventListener("click", () => openProductModal(null));

    $("#prodTableBody").addEventListener("click", async (e) => {
      const stepBtn = e.target.closest("[data-stock-adj]");
      if (stepBtn) {
        const id = Number(stepBtn.dataset.id);
        const delta = Number(stepBtn.dataset.stockAdj);
        await db().adjustStock(id, delta);
        renderAll();
        return;
      }
      const editBtn = e.target.closest("[data-edit-prod]");
      if (editBtn) {
        openProductModal(Number(editBtn.dataset.editProd));
        return;
      }
      const delBtn = e.target.closest("[data-del-prod]");
      if (delBtn) {
        const id = Number(delBtn.dataset.delProd);
        const prod = db().getProductById(id);
        await db().deleteProduct(id);
        renderAll();
        toast(`Deleted ${prod ? prod.name : "product"}`);
      }
    });

    // Product Modal events
    $("#closeProdModal").addEventListener("click", () => $("#productModal").close());
    $("#cancelProdModal").addEventListener("click", () => $("#productModal").close());
    $("#pf-img").addEventListener("input", (e) => updateProductImagePreview(e.target.value));
    $("#pf-cover").addEventListener("change", () => updateProductImagePreview($("#pf-img").value));
    $("#pf-cat").addEventListener("change", (e) => {
      const customInput = $("#pf-catCustom");
      if (!customInput) return;
      const isCustom = e.target.value === "__custom__";
      customInput.hidden = !isCustom;
      customInput.required = isCustom;
      if (isCustom) {
        customInput.focus();
      } else {
        customInput.value = "";
      }
    });

    $("#pf-imgFile").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImageFile(file);
        $("#pf-img").value = dataUrl;
        updateProductImagePreview(dataUrl);
        toast("Image compressed and loaded!");
      } catch (err) {
        toast(err.message || "Could not process image");
      }
    });

    $("#productForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#pf-name").value.trim();
      const sku = $("#pf-sku").value.trim();
      const rawCat = $("#pf-cat").value;
      const customCat = $("#pf-catCustom") ? $("#pf-catCustom").value.trim() : "";
      const msg = $("#prodFormMsg");

      if (rawCat === "__custom__" && !customCat) {
        msg.className = "form-msg err";
        msg.textContent = "Please enter a new category name.";
        if ($("#pf-catCustom")) $("#pf-catCustom").focus();
        return;
      }

      const cat = (rawCat === "__custom__" ? customCat : rawCat.trim()) || "Snacks";
      const price = Number($("#pf-price").value);
      const compareRaw = $("#pf-comparePrice").value.trim();
      const comparePrice = compareRaw ? Number(compareRaw) : null;
      const stock = Math.max(0, Math.floor(Number($("#pf-stock").value) || 0));
      const badge = $("#pf-badge").value.trim();
      const desc = $("#pf-desc").value.trim();
      const longDesc = $("#pf-longDesc").value.trim();
      const img = $("#pf-img").value.trim() || "images/01.jpg";
      const cover = $("#pf-cover").checked;
      const featured = $("#pf-featured").checked;
      const active = $("#pf-active").checked;

      if (!name || !desc || !Number.isFinite(price) || price <= 0) {
        msg.className = "form-msg err";
        msg.textContent = "Please fill in Product Name, Short Description, and a valid Price.";
        return;
      }

      const idVal = $("#pf-id").value;
      const payload = {
        name,
        sku,
        cat,
        price,
        comparePrice,
        stock,
        badge,
        desc,
        longDesc: longDesc || desc,
        img,
        cover,
        featured,
        active,
      };
      if (idVal) payload.id = Number(idVal);

      await db().saveProduct(payload);
      $("#productModal").close();
      renderAll();
      toast(idVal ? `Updated "${name}"` : `Added "${name}" to catalog`);
    });

    // Orders Manager events
    $("#orderStatusChips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-order-chip]");
      if (!chip) return;
      orderStatusFilter = chip.dataset.orderChip;
      renderOrdersTable();
    });
    $("#orderSearch").addEventListener("input", (e) => {
      orderQuery = e.target.value;
      renderOrdersTable();
    });

    $("#closeOrderModal").addEventListener("click", () => $("#orderModal").close());
    $("#closeOrderModalBtn").addEventListener("click", () => $("#orderModal").close());

    // Promo Codes events
    $("#addCouponBtn").addEventListener("click", () => openCouponModal(null));
    $("#closeCouponModal").addEventListener("click", () => $("#couponModal").close());
    $("#cancelCouponModal").addEventListener("click", () => $("#couponModal").close());

    $("#couponsGrid").addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-coupon]");
      if (toggleBtn) {
        const code = toggleBtn.dataset.toggleCoupon;
        const c = db().getCoupons().find((x) => x.code === code);
        if (c) {
          await db().saveCoupon({ ...c, active: c.active === false });
          renderAll();
          toast(`Promo code ${code} ${c.active === false ? "activated" : "disabled"}`);
        }
        return;
      }
      const editBtn = e.target.closest("[data-edit-coupon]");
      if (editBtn) {
        openCouponModal(editBtn.dataset.editCoupon);
        return;
      }
      const delBtn = e.target.closest("[data-del-coupon]");
      if (delBtn) {
        const code = delBtn.dataset.delCoupon;
        await db().deleteCoupon(code);
        renderAll();
        toast(`Deleted promo code ${code}`);
      }
    });

    $("#couponForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = $("#cf-code").value.trim().toUpperCase();
      const type = $("#cf-type").value;
      const value = type === "freeship" ? 0 : Math.max(0, Number($("#cf-value").value) || 0);
      const minOrder = Math.max(0, Number($("#cf-minOrder").value) || 0);
      const desc = $("#cf-desc").value.trim();
      const active = $("#cf-active").checked;
      const msg = $("#couponFormMsg");

      if (!code) {
        msg.className = "form-msg err";
        msg.textContent = "Please enter a promo code.";
        return;
      }

      await db().saveCoupon({
        code,
        type,
        value,
        minOrder,
        desc:
          desc ||
          (type === "percent"
            ? `${value}% off orders ${peso(minOrder)}+`
            : type === "fixed"
            ? `${peso(value)} off orders ${peso(minOrder)}+`
            : `Free delivery on orders ${peso(minOrder)}+`),
        active,
      });

      $("#couponModal").close();
      renderAll();
      toast(`Saved promo code ${code}`);
    });

    // Close dialogs when clicking backdrop
    $$(".dlg").forEach((dlg) => {
      dlg.addEventListener("click", (e) => {
        if (e.target === dlg) dlg.close();
      });
    });
  }

  function renderAll() {
    if (!db()) return;
    renderDbConnectionBadge();
    renderNavCounts();
    renderOverview();
    renderProductsTable();
    renderOrdersTable();
    renderCoupons();
  }

  /* ==================== 10. INITIALIZATION ==================== */
  function init() {
    const address = new URL(window.location.href);
    if (address.searchParams.has("password")) {
      address.searchParams.delete("email");
      address.searchParams.delete("password");
      window.history.replaceState(window.history.state, "", address);
    }

    if (!db()) {
      console.error("PasalubongDB not loaded.");
      return;
    }
    initAuthEvents();
    initPresetGallery();
    initTabs();
    initDashboardEvents();
    db().subscribe(() => {
      if (db().isAdminLoggedIn()) {
        renderAll();
      }
    });
    syncAuthView();
    $("#adminLoginMsg").textContent = "";
    $("#adminLoginSubmit").disabled = false;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
