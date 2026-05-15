const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const defaultDisplay = {
  mode: "idle",
  updatedAt: "",
  customerName: "",
  itemCount: 0,
  subtotal: 0,
  discount: 0,
  total: 0,
  items: [],
  message: "Welcome to Aaradhna Ice Dish & Gola",
  paymentQrText: "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR",
  paymentQrImage: null,
  paymentQrLabel: "Scan For UPI Payment",
  billNo: "",
  token: ""
};

const els = {
  screenDate: document.getElementById("screenDate"),
  screenTime: document.getElementById("screenTime"),
  stageLabel: document.getElementById("stageLabel"),
  headline: document.getElementById("headline"),
  subline: document.getElementById("subline"),
  tokenStrip: document.getElementById("tokenStrip"),
  tokenNumber: document.getElementById("tokenNumber"),
  billNumber: document.getElementById("billNumber"),
  qrImage: document.getElementById("qrImage"),
  qrLabel: document.getElementById("qrLabel"),
  itemCountPill: document.getElementById("itemCountPill"),
  orderList: document.getElementById("orderList"),
  customerName: document.getElementById("customerName"),
  subtotalAmount: document.getElementById("subtotalAmount"),
  discountAmount: document.getElementById("discountAmount"),
  totalAmount: document.getElementById("totalAmount")
};

async function apiRequest(path) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Server error ${response.status}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderClock() {
  const now = new Date();
  els.screenDate.textContent = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  els.screenTime.textContent = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function modeLabel(mode) {
  switch (mode) {
    case "billing":
      return "ORDER REVIEW";
    case "editing":
      return "ORDER UPDATE";
    case "bill-created":
      return "TOKEN CREATED";
    default:
      return "WELCOME";
  }
}

function headlineText(display) {
  if (display.mode === "bill-created" && display.token) return `Token ${display.token} generated`;
  if (display.customerName) return `${display.customerName}, please review your order`;
  return display.message || defaultDisplay.message;
}

function sublineText(display) {
  if (display.mode === "bill-created") return "Please pay at counter and collect your token slip.";
  if (display.items?.length) return "Items and total are live from the billing counter.";
  return "Your order details will appear here on the second screen.";
}

function qrUrl(text) {
  const data = encodeURIComponent(text || defaultDisplay.paymentQrText);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${data}`;
}

function render(display) {
  const view = { ...defaultDisplay, ...display };
  els.stageLabel.textContent = modeLabel(view.mode);
  els.headline.textContent = headlineText(view);
  els.subline.textContent = sublineText(view);
  els.tokenStrip.hidden = !(view.token || view.billNo);
  els.tokenNumber.textContent = view.token || "---";
  els.billNumber.textContent = view.billNo || "---";
  els.customerName.textContent = view.customerName || "Walk-in Customer";
  els.itemCountPill.textContent = `${view.itemCount || 0} items`;
  els.subtotalAmount.textContent = money.format(Number(view.subtotal || 0));
  els.discountAmount.textContent = money.format(Number(view.discount || 0));
  els.toLabel.textContent = view.paymentQrLabel || "Scan For UPI Payment";
  els.qrImage.src = view.paymentQrImage ||extContent = money.format(Number(view.total || 0));
  els.qrImage.src = qrUrl(view.paymentQrText);

  if (!Array.isArray(view.items) || !view.items.length) {
    els.orderList.innerHTML = `<div class="empty-order">Waiting for your order on the billing counter screen.</div>`;
    return;
  }

  els.orderList.innerHTML = view.items
    .map((item) => {
      const notes = [item.flavours, item.instructions].filter(Boolean).join("\n");
      return `
        <article class="order-row">
          <div class="qty-pill">${item.qty}</div>
          <div class="order-main">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="order-meta">${notes ? escapeHtml(notes) : "Standard order"}</div>
          </div>
          <div class="line-total">${money.format(Number(item.lineTotal || item.price * item.qty || 0))}</div>
        </article>
      `;
    })
    .join("");
}

async function refreshDisplay() {
  try {
    const display = await apiRequest("/api/display");
    render(display);
  } catch (error) {
    console.warn(error);
    render(defaultDisplay);
  }
}

renderClock();
refreshDisplay();
setInterval(renderClock, 1000);
setInterval(refreshDisplay, 2000);
