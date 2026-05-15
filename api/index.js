const crypto = require("crypto");
const { getDb } = require("../lib/firebase-admin");

const DEFAULT_MENU = [
  { id: "flavor-stick-gola", name: "Flavor Stick Gola", category: "Ice Gola", price: 50 },
  { id: "rabdi-stick-gola", name: "Rabdi Stick Gola", category: "Ice Gola", price: 70 },
  { id: "rainbow-stick-gola", name: "Rainbow Stick Gola", category: "Ice Gola", price: 60 },
  { id: "dry-fruit-rabdi-stick-gola", name: "Dry Fruit Rabdi Stick Gola", category: "Ice Gola", price: 80 },
  { id: "flavor-ice-dish", name: "Flavor Ice Dish", category: "Ice Dish", price: 60 },
  { id: "rabdi-ice-dish", name: "Rabdi Ice Dish", category: "Ice Dish", price: 100 },
  { id: "dry-fruit-rabdi-ice-dish", name: "Dry Fruit Rabdi Ice Dish", category: "Ice Dish", price: 150 },
  { id: "dry-fruit-rabdi-ice-cream-dish", name: "Dry Fruit Rabdi Ice Cream Dish", category: "Ice Dish", price: 180 },
  { id: "punjabi-lassi", name: "Punjabi Lassi", category: "Lassi", price: 50 },
  { id: "flavor-cream-lassi", name: "Flavor Cream Lassi", category: "Lassi", price: 60 },
  { id: "dry-fruit-flavor-cream-lassi", name: "Dry Fruit Flavor Cream Lassi", category: "Lassi", price: 80 },
  { id: "dry-fruit-ice-cream-lassi", name: "Dry Fruit Ice Cream Lassi", category: "Lassi", price: 100 },
  { id: "flavor-sharbat", name: "Flavor Sharbat", category: "Sharbat", price: 50 },
  { id: "rabdi-flavor-sharbat", name: "Rabdi Flavor Sharbat", category: "Sharbat", price: 70 },
  { id: "dry-fruit-rabdi-sharbat", name: "Dry Fruit Rabdi Sharbat", category: "Sharbat", price: 80 },
  { id: "dry-fruit-rabdi-ice-cream-sharbat", name: "Dry Fruit Rabdi Ice Cream Sharbat", category: "Sharbat", price: 100 },
  { id: "mix-fruit-juice-small", name: "Mix Fruit Juice Small", category: "Extras", price: 50 },
  { id: "mix-fruit-juice-large", name: "Mix Fruit Juice Large", category: "Extras", price: 60 },
  { id: "lemon-soda", name: "Lemon Soda", category: "Extras", price: 20 },
  { id: "lemon-sharbat", name: "Lemon Sharbat", category: "Extras", price: 30 },
  { id: "masala-chaas", name: "Masala Chaas", category: "Extras", price: 20 },
  { id: "extra-colour", name: "Extra Colour", category: "Extras", price: 10 },
  { id: "parcel-charge", name: "Parcel Charge", category: "Extras", price: 10 }
];

const DEFAULT_FLAVOURS = {
  sweet: ["Kaju Mava", "Watermelon", "Kesar Mava", "Vanilla Mava", "Choco Chocolate", "Guava", "Rajbhog", "Shahi Gulab", "Coconut", "Chikoo"],
  khataMitha: ["Orange", "Kala Khatta", "Kolthu", "Jamun", "Rimzim", "Blueberry", "Pineapple", "Mazza Mango", "Kacchi Keri", "Falsa"]
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatToken(number) {
  return String(number).padStart(3, "0");
}

function formatBill(number, date = todayKey()) {
  return `AID-${date}-${String(number).padStart(4, "0")}`;
}

function defaultDisplay() {
  return {
    mode: "idle",
    updatedAt: new Date().toISOString(),
    customerName: "",
    itemCount: 0,
    subtotal: 0,
    discount: 0,
    total: 0,
    items: [],
    message: "Welcome to Aaradhna Ice Dish & Gola",
    paymentQrText: "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR"
  };
}

function emptyData(nextBill = 1) {
  return {
    date: todayKey(),
    nextToken: 1,
    nextBill,
    bills: [],
    selfOrders: [],
    history: {},
    display: defaultDisplay()
  };
}

function cleanFlavourList(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function menuDoc(db) {
  return db.collection("aaradhna").doc("config-menu");
}

function flavourDoc(db) {
  return db.collection("aaradhna").doc("config-flavours");
}

function liveDataDoc(db) {
  return db.collection("aaradhna").doc("live-data");
}

function archiveDoc(db, date) {
  return db.collection("aaradhna_archives").doc(date);
}

async function getMenu(db) {
  const snap = await menuDoc(db).get();
  if (!snap.exists) {
    await menuDoc(db).set({ items: DEFAULT_MENU });
    return DEFAULT_MENU;
  }
  const items = snap.data().items;
  return Array.isArray(items) ? items : DEFAULT_MENU;
}

async function setMenu(db, incoming) {
  const list = Array.isArray(incoming) ? incoming : incoming.menu;
  const clean = (Array.isArray(list) ? list : [])
    .map((item) => ({
      id: String(item.id || item.name || crypto.randomUUID()).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: String(item.name || "").trim(),
      category: String(item.category || "Menu").trim(),
      price: Number(item.price || 0)
    }))
    .filter((item) => item.name && item.price >= 0);
  await menuDoc(db).set({ items: clean });
  return clean;
}

async function getFlavours(db) {
  const snap = await flavourDoc(db).get();
  if (!snap.exists) {
    await flavourDoc(db).set(DEFAULT_FLAVOURS);
    return DEFAULT_FLAVOURS;
  }
  const data = snap.data() || {};
  return {
    sweet: Array.isArray(data.sweet) ? data.sweet : DEFAULT_FLAVOURS.sweet,
    khataMitha: Array.isArray(data.khataMitha) ? data.khataMitha : DEFAULT_FLAVOURS.khataMitha
  };
}

async function setFlavours(db, incoming) {
  const flavours = {
    sweet: cleanFlavourList(incoming.sweet),
    khataMitha: cleanFlavourList(incoming.khataMitha)
  };
  await flavourDoc(db).set(flavours);
  return flavours;
}

async function getData(db) {
  const snap = await liveDataDoc(db).get();
  let data = snap.exists ? snap.data() : emptyData();
  data = {
    ...emptyData(data.nextBill || 1),
    ...data,
    bills: Array.isArray(data.bills) ? data.bills : [],
    selfOrders: Array.isArray(data.selfOrders) ? data.selfOrders : [],
    history: data.history || {},
    display: data.display || defaultDisplay()
  };

  if (data.date !== todayKey()) {
    if (data.bills.length) {
      await archiveDoc(db, data.date).set({
        date: data.date,
        bills: data.bills,
        closedAt: new Date().toISOString()
      });
    }
    data = emptyData(data.nextBill || 1);
    await liveDataDoc(db).set(data);
  } else if (!snap.exists) {
    await liveDataDoc(db).set(data);
  }

  return data;
}

async function saveData(db, data) {
  await liveDataDoc(db).set(data);
  return data;
}

async function closeDay(db) {
  const data = await getData(db);
  if (data.bills.length) {
    await archiveDoc(db, data.date).set({
      date: data.date,
      bills: data.bills,
      closedAt: new Date().toISOString()
    });
  }
  const next = emptyData(data.nextBill || 1);
  await saveData(db, next);
  return next;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const db = getDb();
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/api/menu") return sendJson(res, 200, await getMenu(db));
    if (req.method === "PUT" && pathname === "/api/menu") return sendJson(res, 200, await setMenu(db, await readBody(req)));

    if (req.method === "GET" && pathname === "/api/flavours") return sendJson(res, 200, await getFlavours(db));
    if (req.method === "PUT" && pathname === "/api/flavours") return sendJson(res, 200, await setFlavours(db, await readBody(req)));

    if (req.method === "GET" && pathname === "/api/data") return sendJson(res, 200, await getData(db));

    if (req.method === "PUT" && pathname === "/api/data") {
      const incoming = await readBody(req);
      const current = await getData(db);
      const next = {
        ...current,
        ...incoming,
        history: incoming.history || current.history || {},
        display: incoming.display || current.display || defaultDisplay()
      };
      await saveData(db, next);
      return sendJson(res, 200, next);
    }

    if (req.method === "GET" && pathname === "/api/display") {
      const data = await getData(db);
      return sendJson(res, 200, data.display || defaultDisplay());
    }

    if (req.method === "PUT" && pathname === "/api/display") {
      const patch = await readBody(req);
      const data = await getData(db);
      data.display = {
        ...(data.display || defaultDisplay()),
        ...patch,
        updatedAt: new Date().toISOString()
      };
      await saveData(db, data);
      return sendJson(res, 200, data.display);
    }

    if (req.method === "PUT" && pathname === "/api/qr-settings") {
      const settings = await readBody(req);
      const data = await getData(db);
      data.display = {
        ...(data.display || defaultDisplay()),
        paymentQrLabel: settings.paymentQrLabel || "Scan For UPI Payment",
        paymentQrText: settings.paymentQrText || "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR",
        paymentQrImage: settings.paymentQrImage || null,
        updatedAt: new Date().toISOString()
      };
      await saveData(db, data);
      return sendJson(res, 200, data.display);
    }

    if (req.method === "POST" && pathname === "/api/bills") {
      const draft = await readBody(req);
      const data = await getData(db);
      const bill = {
        id: crypto.randomUUID(),
        billNo: formatBill(data.nextBill, data.date),
        token: formatToken(data.nextToken),
        createdAt: new Date().toISOString(),
        customerName: draft.customerName || "",
        customerPhone: draft.customerPhone || "",
        items: draft.items || [],
        subtotal: Number(draft.subtotal || 0),
        discount: Number(draft.discount || 0),
        total: Number(draft.total || 0),
        paymentMode: draft.paymentMode || "Cash",
        status: "Pending"
      };
      data.bills.push(bill);
      data.nextBill += 1;
      data.nextToken += 1;
      await saveData(db, data);
      return sendJson(res, 201, { bill, data });
    }

    if (req.method === "POST" && pathname === "/api/self-orders") {
      const draft = await readBody(req);
      const data = await getData(db);
      const order = {
        id: crypto.randomUUID(),
        shortId: `SO-${String(data.selfOrders.length + 1).padStart(3, "0")}`,
        createdAt: new Date().toISOString(),
        customerName: draft.customerName || "Customer",
        customerPhone: draft.customerPhone || "",
        items: draft.items || [],
        subtotal: Number(draft.subtotal || 0),
        total: Number(draft.total || 0),
        paymentMode: draft.paymentMode || "Cash",
        paymentStatus: "Pending",
        status: "Awaiting Payment",
        waitMinutes: Number(draft.waitMinutes || 8)
      };
      data.selfOrders.push(order);
      await saveData(db, data);
      return sendJson(res, 201, { order, data });
    }

    const billMatch = pathname.match(/^\/api\/bills\/([^/]+)$/);
    if (req.method === "PATCH" && billMatch) {
      const patch = await readBody(req);
      const data = await getData(db);
      const bill = data.bills.find((entry) => entry.id === billMatch[1]);
      if (!bill) return sendJson(res, 404, { error: "Bill not found" });
      Object.assign(bill, patch, { updatedAt: new Date().toISOString() });
      await saveData(db, data);
      return sendJson(res, 200, { bill, data });
    }

    const selfMatch = pathname.match(/^\/api\/self-orders\/([^/]+)$/);
    if (req.method === "PATCH" && selfMatch) {
      const patch = await readBody(req);
      const data = await getData(db);
      const order = data.selfOrders.find((entry) => entry.id === selfMatch[1]);
      if (!order) return sendJson(res, 404, { error: "Self order not found" });
      Object.assign(order, patch, { updatedAt: new Date().toISOString() });
      await saveData(db, data);
      return sendJson(res, 200, { order, data });
    }

    const acceptMatch = pathname.match(/^\/api\/self-orders\/([^/]+)\/accept-payment$/);
    if (req.method === "POST" && acceptMatch) {
      const data = await getData(db);
      const order = data.selfOrders.find((entry) => entry.id === acceptMatch[1]);
      if (!order) return sendJson(res, 404, { error: "Self order not found" });
      if (order.billId) return sendJson(res, 200, { order, data });

      const bill = {
        id: crypto.randomUUID(),
        billNo: formatBill(data.nextBill, data.date),
        token: formatToken(data.nextToken),
        createdAt: new Date().toISOString(),
        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        items: order.items || [],
        subtotal: Number(order.subtotal || 0),
        discount: 0,
        total: Number(order.total || 0),
        paymentMode: order.paymentMode || "Cash",
        status: "Pending",
        source: "Self Order"
      };

      data.bills.push(bill);
      data.nextBill += 1;
      data.nextToken += 1;
      order.paymentStatus = "Accepted";
      order.status = "Token Created";
      order.token = bill.token;
      order.billNo = bill.billNo;
      order.billId = bill.id;
      order.acceptedAt = new Date().toISOString();
      await saveData(db, data);
      return sendJson(res, 200, { order, bill, data });
    }

    if (req.method === "POST" && pathname === "/api/close-day") {
      return sendJson(res, 200, await closeDay(db));
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
