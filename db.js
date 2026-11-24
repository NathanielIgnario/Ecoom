/**
 * Pasalubong Corner — Unified Real-Time Data Layer (window.PasalubongDB)
 *
 * Architecture:
 * - Hybrid Cloud Firestore (Firebase JS SDK v10 ESM) + Real-Time Local Storage Engine
 * - Instant cross-tab synchronization via BroadcastChannel("pasalubong_db_sync") + window "storage" events
 * - Manages Products, Inventory/Stock, Customer Orders, Promo Coupons, Store Settings, and Admin Auth
 */
(function (root) {
  "use strict";

  const STORAGE_KEYS = {
    PRODUCTS: "pc_db_products_v2",
    ORDERS: "pc_db_orders_v2",
    COUPONS: "pc_db_coupons_v2",
    SETTINGS: "pc_db_settings_v2",
    FIREBASE_CFG: "pc_firebase_config_v2",
    ADMIN_SESSION: "pc_admin_session_v2",
    ADMIN_CREDS: "pc_admin_creds_v2"
  };

  const ORDER_STATUSES = [
    "Pending",
    "Confirmed",
    "Packing",
    "Out for Delivery",
    "Delivered",
    "Cancelled"
  ];

  const DEFAULT_PRODUCTS = [
    {
      id: 1,
      sku: "CEB-SNK-001",
      name: "Dried mangoes",
      desc: "Sweet, chewy, 200g pack",
      longDesc: "Sun-ripened Carabao mangoes from Cebu, sliced thick and gently dried to preserve their natural tropical sweetness and chewy bite. No artificial flavors — the ultimate Cebuano pasalubong.",
      price: 180,
      comparePrice: 220,
      cat: "Snacks",
      img: "images/01.jpg",
      badge: "Bestseller",
      cover: false,
      stock: 45,
      sold: 142,
      featured: true,
      active: true
    },
    {
      id: 2,
      sku: "CEB-SNK-002",
      name: "Otap biscuits",
      desc: "Flaky puff pastry, box of 10",
      longDesc: "Traditional Cebuano oval puff pastry cookies baked to golden crispness and dusted with caramelized sugar. Pairs perfectly with hot sikwate or morning coffee.",
      price: 120,
      comparePrice: 0,
      cat: "Snacks",
      img: "images/02.jpg",
      badge: "",
      cover: false,
      stock: 30,
      sold: 88,
      featured: true,
      active: true
    },
    {
      id: 3,
      sku: "CEB-SNK-003",
      name: "Rosquillos",
      desc: "Crisp butter cookies, 250g",
      longDesc: "Heirloom Liloan-style ring cookies made with farm-fresh eggs, butter, and a hint of citrus zest. Delicate, crumbly, and baked fresh daily.",
      price: 150,
      comparePrice: 175,
      cat: "Snacks",
      img: "images/03.jpg",
      badge: "Local Favorite",
      cover: false,
      stock: 25,
      sold: 64,
      featured: true,
      active: true
    },
    {
      id: 4,
      sku: "CEB-CRF-001",
      name: "Sinamay tote bag",
      desc: "Handwoven, fits a laptop",
      longDesc: "Woven by Cebuano artisans from natural abaca sinamay fibers with reinforced handles. Lightweight, durable, and spacious enough for a 14-inch laptop and daily essentials.",
      price: 450,
      comparePrice: 520,
      cat: "Crafts",
      img: "images/04.jpg",
      badge: "Handmade",
      cover: true,
      stock: 12,
      sold: 39,
      featured: true,
      active: true
    },
    {
      id: 5,
      sku: "CEB-CRF-002",
      name: "Mini guitar keychain",
      desc: "Handmade in Mactan",
      longDesc: "Hand-carved and hand-painted wooden miniature guitar crafted by luthier workshops in Lapu-Lapu City, Mactan — famous across the Philippines for world-class acoustic guitars.",
      price: 95,
      comparePrice: 0,
      cat: "Crafts",
      img: "images/05.jpg",
      badge: "",
      cover: false,
      stock: 4,
      sold: 115,
      featured: false,
      active: true
    },
    {
      id: 6,
      sku: "CEB-APP-001",
      name: "Cebu t-shirt",
      desc: "Cotton, sizes S to XL",
      longDesc: "Soft 100% combed cotton unisex tee featuring vintage Cebu island artwork screen-printed with water-based inks. Breathable tropical weight.",
      price: 350,
      comparePrice: 399,
      cat: "Apparel",
      img: "images/06.jpg",
      badge: "",
      cover: false,
      stock: 20,
      sold: 53,
      featured: true,
      active: true
    }
  ];

  const DEFAULT_COUPONS = [
    {
      code: "CEBU10",
      type: "percent",
      value: 10,
      minOrder: 200,
      active: true,
      usageCount: 14,
      desc: "10% off orders ₱200+"
    },
    {
      code: "PASALUBONG50",
      type: "fixed",
      value: 50,
      minOrder: 400,
      active: true,
      usageCount: 8,
      desc: "₱50 off orders ₱400+"
    },
    {
      code: "FREESHIP",
      type: "freeship",
      value: 0,
      minOrder: 250,
      active: true,
      usageCount: 19,
      desc: "Free delivery on orders ₱250+"
    }
  ];

  const DEFAULT_SETTINGS = {
    storeName: "Pasalubong Corner",
    announcement: "Free email receipt on every order · Handpicked from Cebu · Free delivery on orders ₱500+",
    deliveryFee: 60,
    freeDeliveryThreshold: 500,
    supportEmail: "orders@goarcana.com",
    supportPhone: "0917 555 0143",
    gcashNumber: "0917 555 0143 (Pasalubong Corner)",
    lowStockThreshold: 5,
    categories: ["Snacks", "Crafts", "Apparel"],
    catImages: {
      Snacks: "images/01.jpg",
      Crafts: "images/05.jpg",
      Apparel: "images/06.jpg"
    }
  };

  // Safe in-memory fallback if localStorage is unavailable (e.g. headless Node tests)
  const memoryStore = new Map();

  function getStorage() {
    try {
      if (typeof localStorage !== "undefined" && localStorage !== null) {
        return localStorage;
      }
    } catch (e) {}
    return {
      getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
      setItem: (k, v) => memoryStore.set(k, String(v)),
      removeItem: (k) => memoryStore.delete(k)
    };
  }

  function clone(val) {
    return JSON.parse(JSON.stringify(val));
  }

  function readLocal(key, fallback) {
    try {
      const raw = getStorage().getItem(key);
      if (!raw) return clone(fallback);
      const parsed = JSON.parse(raw);
      return parsed ?? clone(fallback);
    } catch (e) {
      return clone(fallback);
    }
  }

  function writeLocal(key, value) {
    try {
      getStorage().setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("[PasalubongDB] Storage write warning:", e);
    }
  }

  function removeLocal(key) {
    try {
      getStorage().removeItem(key);
    } catch (e) {}
  }

  // Normalize product record (matches firestore.rules isValidProduct schema)
  function normalizeProduct(p, indexFallback = 1) {
    const id = Math.max(0, Number(p.id) || indexFallback);
    const cat = String(p.cat || "Snacks").trim().slice(0, 100) || "Snacks";
    return {
      id,
      sku: String(p.sku || `CEB-${cat.slice(0, 3).toUpperCase()}-${String(id).padStart(3, "0")}`).trim().slice(0, 120),
      name: (String(p.name || "Untitled Product").trim() || "Untitled Product").slice(0, 300),
      desc: String(p.desc || "").trim().slice(0, 1000),
      longDesc: String(p.longDesc || p.desc || "").trim().slice(0, 5000),
      price: Math.max(0, Number(p.price) || 0),
      comparePrice: Math.max(0, Number(p.comparePrice) || 0),
      cat,
      img: (String(p.img || "images/01.jpg").trim() || "images/01.jpg").slice(0, 750000),
      badge: String(p.badge || "").trim().slice(0, 120),
      cover: Boolean(p.cover),
      stock: Math.max(0, Math.floor(Number(p.stock ?? 20))),
      sold: Math.max(0, Math.floor(Number(p.sold ?? 0))),
      featured: p.featured !== undefined ? Boolean(p.featured) : true,
      active: p.active !== undefined ? Boolean(p.active) : true
    };
  }

  // Normalize coupon record (matches firestore.rules isValidCoupon schema)
  function normalizeCoupon(c) {
    const code = (String(c?.code || "PROMO").trim().toUpperCase().replace(/\s+/g, "") || "PROMO").slice(0, 64);
    const type = ["percent", "fixed", "freeship"].includes(c?.type) ? c.type : "percent";
    return {
      code,
      type,
      value: Math.max(0, Number(c?.value) || 0),
      minOrder: Math.max(0, Number(c?.minOrder) || 0),
      active: c?.active !== undefined ? Boolean(c.active) : true,
      usageCount: Math.max(0, Math.floor(Number(c?.usageCount) || 0)),
      desc: (String(c?.desc || "").trim() || `${code} discount`).slice(0, 500)
    };
  }

  // Normalize settings record (matches firestore.rules isValidSettings schema)
  function normalizeSettings(s) {
    const merged = { ...clone(DEFAULT_SETTINGS), ...(s && typeof s === "object" ? s : {}) };
    const categories = Array.isArray(merged.categories) && merged.categories.length
      ? merged.categories.map((c) => String(c || "").trim()).filter(Boolean).slice(0, 100)
      : clone(DEFAULT_SETTINGS.categories);
    const rawCatImages = merged.catImages && typeof merged.catImages === "object" ? merged.catImages : {};
    const catImages = { ...clone(DEFAULT_SETTINGS.catImages) };
    for (const k of Object.keys(rawCatImages).slice(0, 100)) {
      if (rawCatImages[k]) catImages[k] = String(rawCatImages[k]);
    }
    return {
      storeName: (String(merged.storeName || DEFAULT_SETTINGS.storeName).trim() || DEFAULT_SETTINGS.storeName).slice(0, 200),
      announcement: String(merged.announcement ?? DEFAULT_SETTINGS.announcement).trim().slice(0, 1000),
      deliveryFee: Math.max(0, Number(merged.deliveryFee ?? DEFAULT_SETTINGS.deliveryFee) || 0),
      freeDeliveryThreshold: Math.max(0, Number(merged.freeDeliveryThreshold ?? DEFAULT_SETTINGS.freeDeliveryThreshold) || 0),
      supportEmail: String(merged.supportEmail ?? DEFAULT_SETTINGS.supportEmail).trim().slice(0, 320),
      supportPhone: String(merged.supportPhone ?? DEFAULT_SETTINGS.supportPhone).trim().slice(0, 100),
      gcashNumber: String(merged.gcashNumber ?? DEFAULT_SETTINGS.gcashNumber).trim().slice(0, 200),
      lowStockThreshold: Math.max(0, Number(merged.lowStockThreshold ?? DEFAULT_SETTINGS.lowStockThreshold) || 0),
      categories,
      catImages
    };
  }

  // Normalize order record (matches firestore.rules isValidOrder schema)
  function normalizeOrder(o) {
    const now = Date.now();
    const no = (String(o?.no || o?.orderNo || "ORD-" + now.toString(36).toUpperCase()).trim() || "ORD-" + now).slice(0, 120);
    const cust = o?.customer && typeof o.customer === "object" ? o.customer : {};
    const customer = {
      name: String(cust.name || o?.name || "Guest").trim().slice(0, 200),
      email: String(cust.email || o?.email || "").trim().toLowerCase().slice(0, 320),
      phone: String(cust.phone || o?.phone || "").trim().slice(0, 100),
      address: String(cust.address || o?.address || "").trim().slice(0, 1000)
    };
    const items = Array.isArray(o?.items)
      ? o.items.slice(0, 200).map((i) => ({
          id: Math.max(0, Number(i?.id) || 0),
          name: String(i?.name || "Item").trim(),
          price: Math.max(0, Number(i?.price) || 0),
          qty: Math.max(1, Math.floor(Number(i?.qty) || 1)),
          img: String(i?.img || "images/01.jpg").trim(),
          cat: String(i?.cat || "Snacks").trim()
        }))
      : [];
    const subtotal = Math.max(0, Number(o?.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0)) || 0);
    const discount = Math.max(0, Number(o?.discount) || 0);
    const deliveryFee = Math.max(0, Number(o?.deliveryFee) || 0);
    const total = Math.max(0, Number(o?.total ?? subtotal - discount + deliveryFee) || 0);
    return {
      no,
      date: o?.date || now,
      updatedAt: o?.updatedAt || now,
      status: ORDER_STATUSES.includes(o?.status) ? o.status : "Pending",
      customer,
      items,
      subtotal,
      discount,
      couponCode: String(o?.couponCode || "").trim().toUpperCase().slice(0, 64),
      deliveryFee,
      total,
      paymentMethod: String(o?.paymentMethod || "COD").trim().slice(0, 100),
      notes: String(o?.notes || "").trim().slice(0, 2000)
    };
  }

  // Initialize state from localStorage or seed with defaults
  let state = {
    products: [],
    orders: [],
    coupons: [],
    settings: clone(DEFAULT_SETTINGS),
    firebaseMode: "local", // "local" | "connecting" | "connected" | "error"
    firebaseError: null,
    projectId: (root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.projectId) ? String(root.FIREBASE_CONFIG.projectId).trim() : "pasalubong-54fb9"
  };

  const listeners = new Set();
  let bc = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("pasalubong_db_sync");
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === "SYNC") {
          reloadFromLocal(false);
          notifyListeners(ev.data.topic || "sync");
        }
      };
    }
  } catch (e) {}

  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", (ev) => {
      if (ev && Object.values(STORAGE_KEYS).includes(ev.key)) {
        reloadFromLocal(false);
        notifyListeners("storage");
      }
    });
  }

  function broadcast(topic) {
    if (bc) {
      try {
        bc.postMessage({ type: "SYNC", topic, ts: Date.now() });
      } catch (e) {}
    }
    notifyListeners(topic);
  }

  function notifyListeners(topic = "all") {
    const snapshot = getState();
    listeners.forEach((fn) => {
      try {
        fn(topic, snapshot);
      } catch (e) {
        console.error("[PasalubongDB] Listener error:", e);
      }
    });
  }

  function reloadFromLocal(ensureSeeded = true) {
    const storedProducts = readLocal(STORAGE_KEYS.PRODUCTS, null);
    if (!storedProducts || !Array.isArray(storedProducts) || storedProducts.length === 0) {
      state.products = clone(DEFAULT_PRODUCTS).map((p, i) => normalizeProduct(p, i + 1));
      if (ensureSeeded) writeLocal(STORAGE_KEYS.PRODUCTS, state.products);
    } else {
      state.products = storedProducts.map((p, i) => normalizeProduct(p, i + 1));
    }

    const storedOrders = readLocal(STORAGE_KEYS.ORDERS, null);
    if (!storedOrders || !Array.isArray(storedOrders)) {
      state.orders = [];
      if (ensureSeeded) writeLocal(STORAGE_KEYS.ORDERS, state.orders);
    } else {
      state.orders = storedOrders;
    }

    const storedCoupons = readLocal(STORAGE_KEYS.COUPONS, null);
    if (!storedCoupons || !Array.isArray(storedCoupons) || storedCoupons.length === 0) {
      state.coupons = clone(DEFAULT_COUPONS);
      if (ensureSeeded) writeLocal(STORAGE_KEYS.COUPONS, state.coupons);
    } else {
      state.coupons = storedCoupons;
    }

    const storedSettings = readLocal(STORAGE_KEYS.SETTINGS, null);
    if (!storedSettings || typeof storedSettings !== "object") {
      state.settings = clone(DEFAULT_SETTINGS);
      if (ensureSeeded) writeLocal(STORAGE_KEYS.SETTINGS, state.settings);
    } else {
      state.settings = {
        ...clone(DEFAULT_SETTINGS),
        ...storedSettings,
        categories: Array.isArray(storedSettings.categories) && storedSettings.categories.length
          ? storedSettings.categories
          : clone(DEFAULT_SETTINGS.categories),
        catImages: {
          ...clone(DEFAULT_SETTINGS.catImages),
          ...(storedSettings.catImages || {})
        }
      };
    }
  }

  reloadFromLocal(true);

  // ---------------- Firebase Cloud Firestore Integration ----------------
  let firestoreDb = null;
  let firebaseOps = null;
  let unsubscribes = [];

  function isPlaceholderVal(val) {
    const s = String(val || "").trim();
    if (!s) return true;
    return /^(YOUR_|REPLACE_|<|TODO|PLACEHOLDER)/i.test(s);
  }

  function normalizeFirebaseConfig(cfg) {
    if (!cfg || typeof cfg !== "object") return null;
    const projectId = String(cfg.projectId || (root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.projectId) || "pasalubong-54fb9").trim();
    const apiKey = String(cfg.apiKey || "").trim();
    const normalized = {
      apiKey,
      authDomain: String(cfg.authDomain || `${projectId}.firebaseapp.com`).trim(),
      projectId,
      storageBucket: String(cfg.storageBucket || `${projectId}.firebasestorage.app`).trim(),
      messagingSenderId: String(cfg.messagingSenderId || "").trim(),
      appId: String(cfg.appId || "").trim()
    };
    const measurementId = String(cfg.measurementId || (root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.measurementId) || "").trim();
    if (measurementId) {
      normalized.measurementId = measurementId;
    }
    return normalized;
  }

  function hasValidFirebaseConfig(cfg) {
    return Boolean(
      cfg &&
      typeof cfg === "object" &&
      !isPlaceholderVal(cfg.apiKey) &&
      !isPlaceholderVal(cfg.projectId)
    );
  }

  function getSavedFirebaseConfig() {
    // Clean up any outdated legacy cache key ("pc_firebase_config") or stale "pasalubong" projectId without apiKey
    const legacySaved = readLocal("pc_firebase_config", null);
    if (legacySaved && (legacySaved.projectId === "pasalubong" || !hasValidFirebaseConfig(legacySaved))) {
      removeLocal("pc_firebase_config");
    }

    const saved = readLocal(STORAGE_KEYS.FIREBASE_CFG, null);
    if (saved && (saved.projectId === "pasalubong" || !hasValidFirebaseConfig(saved))) {
      removeLocal(STORAGE_KEYS.FIREBASE_CFG);
    } else if (hasValidFirebaseConfig(saved)) {
      return normalizeFirebaseConfig(saved);
    }

    if (hasValidFirebaseConfig(root.FIREBASE_CONFIG)) {
      const activeCfg = normalizeFirebaseConfig(root.FIREBASE_CONFIG);
      writeLocal(STORAGE_KEYS.FIREBASE_CFG, activeCfg);
      return activeCfg;
    }

    if (saved && saved.projectId) return normalizeFirebaseConfig(saved);
    if (root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.projectId) {
      return normalizeFirebaseConfig(root.FIREBASE_CONFIG);
    }
    return null;
  }

  const getActiveFirebaseConfig = getSavedFirebaseConfig;

  function cleanupFirestoreListeners() {
    unsubscribes.forEach((u) => {
      try {
        if (typeof u === "function") u();
      } catch (e) {}
    });
    unsubscribes = [];
  }

  async function initFirebase(customConfig) {
    const rawCfg = customConfig || getSavedFirebaseConfig();
    const cfg = normalizeFirebaseConfig(rawCfg);
    cleanupFirestoreListeners();

      if (!hasValidFirebaseConfig(cfg)) {
      firestoreDb = null;
      firebaseOps = null;
      state.firebaseMode = "local";
      state.firebaseError = null;
      state.projectId = (cfg && cfg.projectId) ? cfg.projectId : "pasalubong-54fb9";
      notifyListeners("firebase");
      return { ok: false, mode: "local", projectId: state.projectId };
    }

    state.firebaseMode = "connecting";
    state.firebaseError = null;
    state.projectId = String(cfg.projectId).trim();
    notifyListeners("firebase");

    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
      const fsMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");

      if (typeof fsMod.setLogLevel === "function") {
        fsMod.setLogLevel("silent");
      }

      const existingApps = appMod.getApps ? appMod.getApps() : [];
      const appName = "pasalubong_" + cfg.projectId;
      let app = existingApps.find((a) => a.name === appName);
      if (!app) {
        app = appMod.initializeApp(cfg, appName);
      }

      // Softly initialize Firebase Analytics if measurementId is present in browser context
      if (cfg.measurementId && typeof window !== "undefined" && typeof document !== "undefined") {
        (async () => {
          try {
            const analyticsMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js");
            if (analyticsMod && typeof analyticsMod.isSupported === "function") {
              const supported = await analyticsMod.isSupported();
              if (supported && typeof analyticsMod.getAnalytics === "function") {
                analyticsMod.getAnalytics(app);
              }
            } else if (analyticsMod && typeof analyticsMod.getAnalytics === "function") {
              analyticsMod.getAnalytics(app);
            }
          } catch (analyticsErr) {
            // Never block or error if Analytics is blocked by browser/adblocker or offline
          }
        })();
      }

      const db = fsMod.getFirestore(app);
      firestoreDb = db;
      firebaseOps = fsMod;

      // Attach real-time listeners first so live updates work immediately
      const unsubProducts = fsMod.onSnapshot(
        fsMod.collection(db, "products"),
        (qSnap) => {
          if (!qSnap.empty) {
            const list = [];
            qSnap.forEach((d) => list.push(normalizeProduct(d.data(), Number(d.id) || 1)));
            list.sort((a, b) => a.id - b.id);
            state.products = list;
            writeLocal(STORAGE_KEYS.PRODUCTS, state.products);
            notifyListeners("products");
          }
        },
        (err) => {
          console.warn("[PasalubongDB] Firestore products listener warning:", err && err.message ? err.message : err);
        }
      );

      const unsubOrders = fsMod.onSnapshot(
        fsMod.collection(db, "orders"),
        (qSnap) => {
          if (!qSnap.empty) {
            const list = [];
            qSnap.forEach((d) => list.push(normalizeOrder(d.data())));
            list.sort((a, b) => (b.date || 0) - (a.date || 0));
            state.orders = list;
            writeLocal(STORAGE_KEYS.ORDERS, state.orders);
            notifyListeners("orders");
          }
        },
        (err) => {
          console.warn("[PasalubongDB] Firestore orders listener warning:", err && err.message ? err.message : err);
        }
      );

      const unsubCoupons = fsMod.onSnapshot(
        fsMod.collection(db, "coupons"),
        (qSnap) => {
          if (!qSnap.empty) {
            const list = [];
            qSnap.forEach((d) => list.push(normalizeCoupon(d.data())));
            state.coupons = list;
            writeLocal(STORAGE_KEYS.COUPONS, state.coupons);
            notifyListeners("coupons");
          }
        },
        (err) => {
          console.warn("[PasalubongDB] Firestore coupons listener warning:", err && err.message ? err.message : err);
        }
      );

      const unsubSettings = fsMod.onSnapshot(
        fsMod.doc(db, "settings", "store"),
        (dSnap) => {
          if (dSnap.exists()) {
            state.settings = normalizeSettings(dSnap.data());
            writeLocal(STORAGE_KEYS.SETTINGS, state.settings);
            notifyListeners("settings");
          }
        },
        (err) => {
          console.warn("[PasalubongDB] Firestore settings listener warning:", err && err.message ? err.message : err);
        }
      );

      unsubscribes.push(unsubProducts, unsubOrders, unsubCoupons, unsubSettings);
      state.firebaseMode = "connected";
      state.firebaseError = null;
      notifyListeners("firebase");

      // Check if products collection is empty in the background (with timeout guard) and seed defaults
      (async () => {
        try {
          const prodCol = fsMod.collection(db, "products");
          const snap = await Promise.race([
            fsMod.getDocs(prodCol),
            new Promise((_, reject) => setTimeout(() => reject(new Error("seed-check-timeout")), 4500))
          ]);
          if (snap && snap.empty) {
            await pushLocalToFirebase();
          }
        } catch (seedErr) {
          // Gracefully continue in hybrid cloud/local mode if Firestore database/rules are still initializing
        }
      })();

      return { ok: true, mode: "connected", projectId: state.projectId };
    } catch (err) {
      console.warn("[PasalubongDB] Running in local fallback mode (Firebase unavailable):", err);
      firestoreDb = null;
      firebaseOps = null;
      state.firebaseMode = "error";
      state.firebaseError = err && err.message ? err.message : "Could not connect to Firebase Firestore.";
      notifyListeners("firebase");
      return { ok: false, mode: "error", error: state.firebaseError };
    }
  }

  async function pushLocalToFirebase() {
    if (!firestoreDb || !firebaseOps) return false;
    const { doc, setDoc } = firebaseOps;
    const writes = [];

    for (const p of state.products) {
      const cleanProd = normalizeProduct(p, Number(p.id) || 1);
      writes.push(setDoc(doc(firestoreDb, "products", String(cleanProd.id)), cleanProd));
    }
    for (const o of state.orders) {
      if (o && (o.no || o.orderNo)) {
        const cleanOrd = normalizeOrder(o);
        writes.push(setDoc(doc(firestoreDb, "orders", String(cleanOrd.no)), cleanOrd));
      }
    }
    for (const c of state.coupons) {
      if (c && c.code) {
        const cleanCoup = normalizeCoupon(c);
        writes.push(setDoc(doc(firestoreDb, "coupons", String(cleanCoup.code)), cleanCoup));
      }
    }
    writes.push(setDoc(doc(firestoreDb, "settings", "store"), normalizeSettings(state.settings)));

    await Promise.all(writes);
    return true;
  }

  function parseFirebaseConfigInput(rawText) {
    if (!rawText) return null;
    if (typeof rawText === "object") {
      if (rawText.apiKey && rawText.projectId) {
        return normalizeFirebaseConfig(rawText);
      }
      return null;
    }

    const text = String(rawText).trim();
    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.apiKey && (parsed.projectId || (root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.projectId))) {
        return normalizeFirebaseConfig(parsed);
      }
    } catch (e) {}

    // Support pasting `const firebaseConfig = { apiKey: "...", projectId: "..." };`
    const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"];
    const out = {};
    for (const k of keys) {
      const re = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`);
      const m = text.match(re);
      if (m) out[k] = m[1].trim();
      else out[k] = "";
    }
    if (!out.projectId && root.FIREBASE_CONFIG && root.FIREBASE_CONFIG.projectId) {
      out.projectId = String(root.FIREBASE_CONFIG.projectId).trim();
    }
    if (out.apiKey && out.projectId) return normalizeFirebaseConfig(out);
    return null;
  }

  async function connectFirebaseConfig(rawInput) {
    const parsed = parseFirebaseConfigInput(rawInput);
    if (!parsed || !parsed.apiKey || !parsed.projectId) {
      throw new Error("Invalid Firebase configuration. Make sure apiKey and projectId are included.");
    }
    writeLocal(STORAGE_KEYS.FIREBASE_CFG, parsed);
    return await initFirebase(parsed);
  }

  function disconnectFirebase() {
    cleanupFirestoreListeners();
    removeLocal(STORAGE_KEYS.FIREBASE_CFG);
    firestoreDb = null;
    firebaseOps = null;
    state.firebaseMode = "local";
    state.firebaseError = null;
    state.projectId = null;
    broadcast("firebase");
    return { ok: true, mode: "local" };
  }

  // ---------------- Core Getters ----------------
  function getState() {
    return {
      products: clone(state.products),
      orders: clone(state.orders),
      coupons: clone(state.coupons),
      settings: clone(state.settings),
      firebaseMode: state.firebaseMode,
      firebaseError: state.firebaseError,
      projectId: state.projectId
    };
  }

  function getProducts(includeInactive = false) {
    const list = clone(state.products);
    return includeInactive ? list : list.filter((p) => p.active !== false);
  }

  function getProductById(id) {
    const numId = Number(id);
    const found = state.products.find((p) => Number(p.id) === numId);
    return found ? clone(found) : null;
  }

  function getOrders() {
    return clone(state.orders).sort((a, b) => (b.date || 0) - (a.date || 0));
  }

  function getOrdersByEmail(email) {
    if (!email) return [];
    const target = String(email).trim().toLowerCase();
    const globalMatches = state.orders.filter(
      (o) => (o.customer?.email || o.email || "").trim().toLowerCase() === target
    );
    // Also merge any legacy per-user orders stored under pc_orders_<email>
    const legacy = readLocal("pc_orders_" + target, []);
    const map = new Map();
    for (const o of legacy) {
      if (o && o.no) map.set(String(o.no).toUpperCase(), o);
    }
    for (const o of globalMatches) {
      if (o && o.no) map.set(String(o.no).toUpperCase(), o);
    }
    return Array.from(map.values()).sort((a, b) => (b.date || 0) - (a.date || 0));
  }

  function getOrderByNo(no) {
    if (!no) return null;
    const clean = String(no).trim().toUpperCase();
    const found = state.orders.find((o) => String(o.no || "").trim().toUpperCase() === clean);
    return found ? clone(found) : null;
  }

  function getCoupons() {
    return clone(state.coupons);
  }

  function getSettings() {
    return clone(state.settings);
  }

  // ---------------- Mutations: Products & Inventory ----------------
  async function saveProduct(productData) {
    const list = [...state.products];
    let id = Number(productData.id);
    const existingIdx = id ? list.findIndex((p) => Number(p.id) === id) : -1;

    if (!id || existingIdx === -1) {
      const maxId = list.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
      id = id || maxId + 1;
    }

    const prev = existingIdx >= 0 ? list[existingIdx] : {};
    const record = normalizeProduct(
      {
        ...prev,
        ...productData,
        id
      },
      id
    );

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.push(record);
    }

    // Ensure category exists in settings
    if (record.cat && !state.settings.categories.includes(record.cat)) {
      state.settings.categories.push(record.cat);
      if (!state.settings.catImages[record.cat]) {
        state.settings.catImages[record.cat] = record.img || "images/01.jpg";
      }
      writeLocal(STORAGE_KEYS.SETTINGS, state.settings);
      if (firestoreDb && firebaseOps) {
        try {
          await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "settings", "store"), state.settings);
        } catch (e) {}
      }
    }

    state.products = list;
    writeLocal(STORAGE_KEYS.PRODUCTS, state.products);
    broadcast("products");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "products", String(record.id)), record);
      } catch (e) {
        console.warn("[PasalubongDB] Firestore saveProduct warning:", e);
      }
    }
    return clone(record);
  }

  async function deleteProduct(id) {
    const numId = Number(id);
    state.products = state.products.filter((p) => Number(p.id) !== numId);
    writeLocal(STORAGE_KEYS.PRODUCTS, state.products);
    broadcast("products");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.deleteDoc(firebaseOps.doc(firestoreDb, "products", String(numId)));
      } catch (e) {
        console.warn("[PasalubongDB] Firestore deleteProduct warning:", e);
      }
    }
    return true;
  }

  async function adjustStock(id, delta) {
    const p = getProductById(id);
    if (!p) return null;
    const nextStock = Math.max(0, (Number(p.stock) || 0) + Number(delta));
    return await saveProduct({ ...p, stock: nextStock });
  }

  // ---------------- Mutations: Orders ----------------
  async function recordOrder(orderObj) {
    const now = Date.now();
    const orderNo = String(
      orderObj.no ||
      orderObj.orderNo ||
      "ORD-" + now.toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase()
    ).trim();

    const customer = {
      name: String(orderObj.customer?.name || orderObj.name || "Guest").trim(),
      email: String(orderObj.customer?.email || orderObj.email || "").trim().toLowerCase(),
      phone: String(orderObj.customer?.phone || orderObj.phone || "").trim(),
      address: String(orderObj.customer?.address || orderObj.address || "").trim()
    };

    const items = Array.isArray(orderObj.items)
      ? orderObj.items.map((i) => {
          const prod = getProductById(i.id);
          const qty = Math.max(1, Math.floor(Number(i.qty) || 1));
          const price = Number(i.price ?? prod?.price ?? 0);
          return {
            id: Number(i.id) || 0,
            name: String(i.name || prod?.name || "Item"),
            price,
            qty,
            img: String(i.img || prod?.img || "images/01.jpg"),
            cat: String(i.cat || prod?.cat || "Snacks")
          };
        })
      : [];

    const subtotal = Number(orderObj.subtotal ?? items.reduce((s, i) => s + i.price * i.qty, 0));
    const discount = Math.max(0, Number(orderObj.discount || 0));
    const deliveryFee = Math.max(0, Number(orderObj.deliveryFee ?? 0));
    const total = Math.max(0, Number(orderObj.total ?? subtotal - discount + deliveryFee));

    const record = {
      no: orderNo,
      date: orderObj.date || now,
      updatedAt: now,
      status: ORDER_STATUSES.includes(orderObj.status) ? orderObj.status : "Pending",
      customer,
      items,
      subtotal,
      discount,
      couponCode: String(orderObj.couponCode || "").trim().toUpperCase(),
      deliveryFee,
      total,
      paymentMethod: String(orderObj.paymentMethod || "COD").trim(),
      notes: String(orderObj.notes || "").trim()
    };

    // Decrement product stock and increment sold counter
    for (const item of items) {
      const idx = state.products.findIndex((p) => Number(p.id) === Number(item.id));
      if (idx >= 0) {
        state.products[idx].stock = Math.max(0, (Number(state.products[idx].stock) || 0) - item.qty);
        state.products[idx].sold = (Number(state.products[idx].sold) || 0) + item.qty;
      }
    }
    writeLocal(STORAGE_KEYS.PRODUCTS, state.products);

    // Increment coupon usage count if used
    if (record.couponCode) {
      const cIdx = state.coupons.findIndex((c) => c.code.toUpperCase() === record.couponCode);
      if (cIdx >= 0) {
        state.coupons[cIdx].usageCount = (Number(state.coupons[cIdx].usageCount) || 0) + 1;
        writeLocal(STORAGE_KEYS.COUPONS, state.coupons);
      }
    }

    // Prepend or update order in state.orders
    const existingOrderIdx = state.orders.findIndex((o) => String(o.no).toUpperCase() === orderNo.toUpperCase());
    if (existingOrderIdx >= 0) {
      state.orders[existingOrderIdx] = record;
    } else {
      state.orders.unshift(record);
    }
    writeLocal(STORAGE_KEYS.ORDERS, state.orders);

    // Keep per-email order history synced for customer account dialog compatibility
    if (customer.email) {
      const userOrdersKey = "pc_orders_" + customer.email;
      const userOrders = readLocal(userOrdersKey, []);
      const filtered = userOrders.filter((o) => String(o.no).toUpperCase() !== orderNo.toUpperCase());
      filtered.unshift(record);
      writeLocal(userOrdersKey, filtered.slice(0, 50));
    }

    broadcast("orders");
    broadcast("products");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "orders", record.no), normalizeOrder(record));
        for (const item of items) {
          const p = getProductById(item.id);
          if (p) {
            await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "products", String(p.id)), normalizeProduct(p, Number(p.id) || 1));
          }
        }
        if (record.couponCode) {
          const c = state.coupons.find((x) => x.code.toUpperCase() === record.couponCode);
          if (c) {
            await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "coupons", String(c.code)), normalizeCoupon(c));
          }
        }
      } catch (e) {
        console.warn("[PasalubongDB] Firestore recordOrder warning:", e);
      }
    }

    return clone(record);
  }

  async function updateOrderStatus(orderNo, newStatus) {
    if (!ORDER_STATUSES.includes(newStatus)) {
      throw new Error("Invalid order status: " + newStatus);
    }
    const clean = String(orderNo || "").trim().toUpperCase();
    const idx = state.orders.findIndex((o) => String(o.no || "").trim().toUpperCase() === clean);
    if (idx === -1) return null;

    const prevStatus = state.orders[idx].status;
    state.orders[idx].status = newStatus;
    state.orders[idx].updatedAt = Date.now();
    const updated = state.orders[idx];

    // If order is newly cancelled (and wasn't cancelled before), restore stock
    if (newStatus === "Cancelled" && prevStatus !== "Cancelled") {
      for (const item of updated.items || []) {
        const pIdx = state.products.findIndex((p) => Number(p.id) === Number(item.id));
        if (pIdx >= 0) {
          state.products[pIdx].stock = (Number(state.products[pIdx].stock) || 0) + (Number(item.qty) || 0);
          state.products[pIdx].sold = Math.max(0, (Number(state.products[pIdx].sold) || 0) - (Number(item.qty) || 0));
        }
      }
      writeLocal(STORAGE_KEYS.PRODUCTS, state.products);
    }

    writeLocal(STORAGE_KEYS.ORDERS, state.orders);

    // Sync customer's per-email local list
    const email = updated.customer?.email;
    if (email) {
      const userOrdersKey = "pc_orders_" + email;
      const userOrders = readLocal(userOrdersKey, []);
      const uIdx = userOrders.findIndex((o) => String(o.no || "").trim().toUpperCase() === clean);
      if (uIdx >= 0) {
        userOrders[uIdx].status = newStatus;
        userOrders[uIdx].updatedAt = updated.updatedAt;
        writeLocal(userOrdersKey, userOrders);
      }
    }

    broadcast("orders");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "orders", updated.no), normalizeOrder(updated));
        if (newStatus === "Cancelled" && prevStatus !== "Cancelled") {
          for (const item of updated.items || []) {
            const p = getProductById(item.id);
            if (p) {
              await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "products", String(p.id)), normalizeProduct(p, Number(p.id) || 1));
            }
          }
        }
      } catch (e) {}
    }

    return clone(updated);
  }

  async function deleteOrder(orderNo) {
    const clean = String(orderNo || "").trim().toUpperCase();
    const target = state.orders.find((o) => String(o.no || "").trim().toUpperCase() === clean);
    state.orders = state.orders.filter((o) => String(o.no || "").trim().toUpperCase() !== clean);
    writeLocal(STORAGE_KEYS.ORDERS, state.orders);

    if (target && target.customer?.email) {
      const userOrdersKey = "pc_orders_" + target.customer.email;
      const userOrders = readLocal(userOrdersKey, []);
      writeLocal(
        userOrdersKey,
        userOrders.filter((o) => String(o.no || "").trim().toUpperCase() !== clean)
      );
    }

    broadcast("orders");

    if (firestoreDb && firebaseOps && target) {
      try {
        await firebaseOps.deleteDoc(firebaseOps.doc(firestoreDb, "orders", target.no));
      } catch (e) {}
    }
    return true;
  }

  // ---------------- Coupons & Pricing Helpers ----------------
  function validateCoupon(code, subtotal) {
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return { valid: false, error: "Enter a promo code." };
    const coupon = state.coupons.find((c) => String(c.code || "").toUpperCase() === clean);
    if (!coupon || !coupon.active) {
      return { valid: false, error: "Invalid or expired promo code." };
    }
    const sub = Number(subtotal) || 0;
    if (sub < (Number(coupon.minOrder) || 0)) {
      return {
        valid: false,
        error: `Minimum order of ₱${Number(coupon.minOrder).toLocaleString("en-PH")} required for ${clean}.`
      };
    }

    let discount = 0;
    let freeShipping = false;
    if (coupon.type === "percent") {
      discount = Math.round((sub * Number(coupon.value)) / 100);
    } else if (coupon.type === "fixed") {
      discount = Math.min(sub, Number(coupon.value));
    } else if (coupon.type === "freeship") {
      freeShipping = true;
    }

    return {
      valid: true,
      coupon: clone(coupon),
      code: coupon.code,
      discount,
      freeShipping,
      desc: coupon.desc
    };
  }

  async function saveCoupon(couponData) {
    const code = String(couponData.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) throw new Error("Coupon code is required.");

    const record = {
      code,
      type: ["percent", "fixed", "freeship"].includes(couponData.type) ? couponData.type : "percent",
      value: Math.max(0, Number(couponData.value) || 0),
      minOrder: Math.max(0, Number(couponData.minOrder) || 0),
      active: couponData.active !== undefined ? Boolean(couponData.active) : true,
      usageCount: Math.max(0, Number(couponData.usageCount) || 0),
      desc: String(couponData.desc || "").trim() || `${code} discount`
    };

    const idx = state.coupons.findIndex((c) => c.code.toUpperCase() === code);
    if (idx >= 0) {
      state.coupons[idx] = record;
    } else {
      state.coupons.push(record);
    }

    writeLocal(STORAGE_KEYS.COUPONS, state.coupons);
    broadcast("coupons");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "coupons", record.code), record);
      } catch (e) {}
    }
    return clone(record);
  }

  async function deleteCoupon(code) {
    const clean = String(code || "").trim().toUpperCase();
    state.coupons = state.coupons.filter((c) => c.code.toUpperCase() !== clean);
    writeLocal(STORAGE_KEYS.COUPONS, state.coupons);
    broadcast("coupons");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.deleteDoc(firebaseOps.doc(firestoreDb, "coupons", clean));
      } catch (e) {}
    }
    return true;
  }

  // ---------------- Store Settings ----------------
  async function saveSettings(newSettings) {
    state.settings = normalizeSettings({
      ...state.settings,
      ...newSettings
    });
    writeLocal(STORAGE_KEYS.SETTINGS, state.settings);
    broadcast("settings");

    if (firestoreDb && firebaseOps) {
      try {
        await firebaseOps.setDoc(firebaseOps.doc(firestoreDb, "settings", "store"), state.settings);
      } catch (e) {}
    }
    return clone(state.settings);
  }

  async function resetToDefaults() {
    state.products = clone(DEFAULT_PRODUCTS).map((p, i) => normalizeProduct(p, i + 1));
    state.coupons = clone(DEFAULT_COUPONS);
    state.settings = clone(DEFAULT_SETTINGS);
    writeLocal(STORAGE_KEYS.PRODUCTS, state.products);
    writeLocal(STORAGE_KEYS.COUPONS, state.coupons);
    writeLocal(STORAGE_KEYS.SETTINGS, state.settings);
    broadcast("reset");

    if (firestoreDb && firebaseOps) {
      await pushLocalToFirebase();
    }
    return getState();
  }

  // ---------------- Admin Authentication ----------------
  function getAdminCredentials() {
    return readLocal(STORAGE_KEYS.ADMIN_CREDS, {
      email: "admin@pasalubong.ph",
      password: "admin123",
      name: "Cebu Shop Admin"
    });
  }

  function updateAdminCredentials({ email, password, name }) {
    const current = getAdminCredentials();
    const updated = {
      email: String(email || current.email).trim().toLowerCase(),
      password: String(password || current.password),
      name: String(name || current.name).trim()
    };
    writeLocal(STORAGE_KEYS.ADMIN_CREDS, updated);
    return { email: updated.email, name: updated.name };
  }

  function isAdminLoggedIn() {
    const sess = readLocal(STORAGE_KEYS.ADMIN_SESSION, null);
    return Boolean(sess && sess.email);
  }

  function loginAdmin(email, password) {
    const creds = getAdminCredentials();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (cleanEmail === creds.email.toLowerCase() && String(password) === creds.password) {
      const session = { email: creds.email, name: creds.name, loginAt: Date.now() };
      writeLocal(STORAGE_KEYS.ADMIN_SESSION, session);
      return { ok: true, session };
    }
    return { ok: false, error: "Invalid admin email or password." };
  }

  function logoutAdmin() {
    removeLocal(STORAGE_KEYS.ADMIN_SESSION);
    return true;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // Kick off Firebase auto-connect if config is already present (or auto-discover on Firebase Hosting)
  setTimeout(async () => {
    const cfg = getSavedFirebaseConfig();
    if (hasValidFirebaseConfig(cfg)) {
      initFirebase(cfg);
      return;
    }
    // If deployed on Firebase Hosting (*.web.app / *.firebaseapp.com), auto-load /__/firebase/init.json
    try {
      if (
        typeof fetch === "function" &&
        root.location &&
        /\.(web\.app|firebaseapp\.com)$/i.test(root.location.hostname || "")
      ) {
        const res = await fetch("/__/firebase/init.json");
        if (res && res.ok) {
          const hostedCfg = await res.json();
          if (hasValidFirebaseConfig(hostedCfg)) {
            writeLocal(STORAGE_KEYS.FIREBASE_CFG, normalizeFirebaseConfig(hostedCfg));
            await initFirebase(hostedCfg);
          }
        }
      }
    } catch (e) {}
  }, 0);

  root.PasalubongDB = {
    ORDER_STATUSES,
    DEFAULT_PRODUCTS,
    DEFAULT_COUPONS,
    DEFAULT_SETTINGS,
    getState,
    getProducts,
    getProductById,
    getOrders,
    getOrdersByEmail,
    getOrderByNo,
    getCoupons,
    getSettings,
    getSavedFirebaseConfig,
    getActiveFirebaseConfig,
    subscribe,
    initFirebase,
    connectFirebaseConfig,
    disconnectFirebase,
    pushLocalToFirebase,
    parseFirebaseConfigInput,
    saveProduct,
    deleteProduct,
    adjustStock,
    recordOrder,
    updateOrderStatus,
    deleteOrder,
    validateCoupon,
    saveCoupon,
    deleteCoupon,
    saveSettings,
    resetToDefaults,
    isAdminLoggedIn,
    loginAdmin,
    logoutAdmin,
    getAdminCredentials,
    updateAdminCredentials
  };
})(typeof window !== "undefined" ? window : globalThis);
