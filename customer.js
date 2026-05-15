const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

let menu = [];
let flavours = { sweet: [], khataMitha: [] };
let cart = {};
let selfOrderId = localStorage.getItem("aaradhnaSelfOrderId") || "";
let activeCategory = "";

const els = {
  menuCategoryTabs: document.getElementById("menuCategoryTabs"),
  customerMenu: document.getElementById("customerMenu"),
  customerCart: document.getElementById("customerCart"),
  customerName: document.getElementById("customerName"),
  customerPhone: document.getElementById("customerPhone"),
  customerInstruction: document.getElementById("customerInstruction"),
  customerTotal: document.getElementById("customerTotal"),
  placeOrderBtn: document.getElementById("placeOrderBtn"),
  orderView: document.getElementById("orderView"),
  statusView: document.getElementById("statusView"),
  customerStatusLabel: document.getElementById("customerStatusLabel"),
  customerStatusTitle: document.getElementById("customerStatusTitle"),
  customerToken: document.getElementById("customerToken"),
  customerStatusSub: document.getElementById("customerStatusSub")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options
  });
  if (!response.ok) throw new Error(`Server error ${response.status}`);
  return response.json();
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function allFlavours() {
  return [...(flavours.sweet || []), ...(flavours.khataMitha || [])];
}

function total() {
  return Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
}

function groupedMenu() {
  const groups = {};
  for (const item of menu) {
    const category = item.category || "Menu";
    groups[category] = groups[category] || [];
    groups[category].push(item);
  }
  return groups;
}

function menuCategories() {
  return Object.keys(groupedMenu());
}

function flavourSelectOptions(selected = "") {
  return [`<option value="">Select flavour</option>`]
    .concat(allFlavours().map((flavour) => {
      const isSelected = flavour === selected ? " selected" : "";
      return `<option value="${escapeAttr(flavour)}"${isSelected}>${escapeHtml(flavour)}</option>`;
    }))
    .join("");
}

function renderMenu() {
  const groups = groupedMenu();
  const categories = menuCategories();
  if (!activeCategory || !groups[activeCategory]) activeCategory = categories[0] || "";

  els.menuCategoryTabs.innerHTML = categories
    .map((category) => {
      const active = category === activeCategory ? " active" : "";
      return `<button class="menu-category-tab${active}" type="button" data-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`;
    })
    .join("");

  const items = groups[activeCategory] || [];
  els.customerMenu.innerHTML = `
    <section class="menu-section">
      <h2>${escapeHtml(activeCategory || "Menu")}</h2>
      <div class="menu-section-grid">
        ${items
          .map(
            (item) => `
              <button class="menu-button" type="button" data-item="${item.id}">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${money.format(item.price)}</span>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCart() {
  const items = Object.values(cart);
  els.customerCart.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="cart-row">
              <div class="cart-top">
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <p>${money.format(item.price)} x ${item.qty} = ${money.format(item.price * item.qty)}</p>
                </div>
                <div class="qty-tools">
                  <button type="button" data-dec="${item.id}">-</button>
                  <strong>${item.qty}</strong>
                  <button type="button" data-inc="${item.id}">+</button>
                </div>
              </div>
              <div class="customer-flavour-grid">
                <label>
                  <span>Flavour 1</span>
                  <select data-note="${item.id}" data-field="flavourOne">
                    ${flavourSelectOptions(item.flavourOne || "")}
                  </select>
                </label>
                <label>
                  <span>Flavour 2</span>
                  <select data-note="${item.id}" data-field="flavourTwo">
                    ${flavourSelectOptions(item.flavourTwo || "")}
                  </select>
                </label>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-cart">Select items from Ice Gola, Ice Dish, Lassi, Sharbat, and Extras.</div>`;

  els.customerTotal.textContent = money.format(total());
}

function addItem(id) {
  const item = menu.find((entry) => entry.id === id);
  if (!item) return;
  const lineId = `${id}-${Date.now()}`;
  cart[lineId] = { ...item, id: lineId, qty: 1, flavourOne: "", flavourTwo: "" };
  renderCart();
}

function changeQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
}

function combinedFlavours(item) {
  return [item.flavourOne, item.flavourTwo].filter(Boolean).join(" + ");
}

function showStatus(order) {
  els.orderView.hidden = true;
  els.statusView.hidden = false;
  els.customerStatusLabel.textContent = order.paymentStatus === "Accepted" ? "Payment accepted" : "Payment pending";
  els.customerStatusTitle.textContent = order.paymentStatus === "Accepted" ? "Your token is ready" : "Waiting for counter payment acceptance";
  els.customerToken.textContent = order.token || "--";
  els.customerStatusSub.textContent =
    order.paymentStatus === "Accepted"
      ? `Token ${order.token} created. Waiting time about ${order.waitMinutes || 8} min.`
      : "Please show this screen at the counter. Token will appear after payment.";
}

async function pollOrder() {
  if (!selfOrderId) return;
  const data = await api("/api/data");
  const order = (data.selfOrders || []).find((entry) => entry.id === selfOrderId);
  if (order) showStatus(order);
  if (order && order.paymentStatus === "Accepted") clearInterval(window.customerPoll);
}

async function placeOrder() {
  const items = Object.values(cart).map((item) => ({
    ...item,
    flavours: combinedFlavours(item),
    instructions: els.customerInstruction.value.trim()
  }));
  if (!items.length) return;

  const result = await api("/api/self-orders", {
    method: "POST",
    body: JSON.stringify({
      customerName: els.customerName.value.trim(),
      customerPhone: els.customerPhone.value.trim(),
      items,
      subtotal: total(),
      total: total(),
      paymentMode: "Pay at Counter",
      waitMinutes: 8
    })
  });

  selfOrderId = result.order.id;
  localStorage.setItem("aaradhnaSelfOrderId", selfOrderId);
  showStatus(result.order);
  window.customerPoll = setInterval(pollOrder, 2000);
}

async function init() {
  menu = await api("/api/menu");
  flavours = await api("/api/flavours");
  renderMenu();
  renderCart();
  if (selfOrderId) {
    await pollOrder();
    window.customerPoll = setInterval(pollOrder, 2000);
  }
}

els.customerMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-item]");
  if (button) addItem(button.dataset.item);
});

els.menuCategoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderMenu();
});

els.customerCart.addEventListener("click", (event) => {
  const inc = event.target.closest("[data-inc]");
  const dec = event.target.closest("[data-dec]");
  if (inc) changeQty(inc.dataset.inc, 1);
  if (dec) changeQty(dec.dataset.dec, -1);
});

els.customerCart.addEventListener("input", (event) => {
  const input = event.target.closest("[data-note]");
  if (!input || !cart[input.dataset.note]) return;
  cart[input.dataset.note][input.dataset.field] = input.value.trim();
});

els.placeOrderBtn.addEventListener("click", placeOrder);

init();
