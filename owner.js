const metrics = document.getElementById("metrics");
const itemSales = document.getElementById("itemSales");
const paymentSales = document.getElementById("paymentSales");
const customerList = document.getElementById("customerList");
const cancelledList = document.getElementById("cancelledList");
const qrPreview = document.getElementById("qrPreview");
const qrLabel = document.getElementById("qrLabel");
const upiText = document.getElementById("upiText");
const qrImageUpload = document.getElementById("qrImageUpload");
const saveQrBtn = document.getElementById("saveQrBtn");
const resetQrBtn = document.getElementById("resetQrBtn");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

async function loadData() {
  const response = await fetch("/api/data", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load report data");
  return response.json();
}

function table(headers, rows) {
  if (!rows.length) return `<p class="empty">No data yet</p>`;
  return `
    <table>
      <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function render(data) {
  const bills = data.bills || [];
  const paid = bills.filter((bill) => bill.status !== "Cancelled");
  const cancelled = bills.filter((bill) => bill.status === "Cancelled");
  const total = paid.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
  const average = paid.length ? total / paid.length : 0;
  const payments = { Cash: 0, UPI: 0, Card: 0 };
  const items = {};
  const customers = {};

  paid.forEach((bill) => {
    payments[bill.paymentMode] = (payments[bill.paymentMode] || 0) + Number(bill.total || 0);
    if (bill.customerName || bill.customerPhone) {
      const key = `${bill.customerName || "Customer"} ${bill.customerPhone || ""}`.trim();
      customers[key] = (customers[key] || 0) + Number(bill.total || 0);
    }
    (bill.items || []).forEach((item) => {
      items[item.name] = items[item.name] || { qty: 0, total: 0 };
      items[item.name].qty += Number(item.qty || 0);
      items[item.name].total += Number(item.price || 0) * Number(item.qty || 0);
    });
  });

  metrics.innerHTML = [
    ["Total Sales", money.format(total)],
    ["Paid Orders", paid.length],
    ["Average Bill", money.format(average)],
    ["Cancelled", cancelled.length]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");

  itemSales.innerHTML = table(
    ["Item", "Qty", "Sales"],
    Object.entries(items).sort((a, b) => b[1].qty - a[1].qty).map(([name, item]) => [name, item.qty, money.format(item.total)])
  );
  paymentSales.innerHTML = table(
    ["Mode", "Sales"],
    Object.entries(payments).map(([mode, value]) => [mode, money.format(value)])
  );
  customerList.innerHTML = table(
    ["Customer", "Sales"],
    Object.entries(customers).sort((a, b) => b[1] - a[1]).map(([name, value]) => [name, money.format(value)])
  );
  cancelledList.innerHTML = table(
    ["Token", "Reason"],
    cancelled.map((bill) => [bill.token, bill.cancelReason || "-"])
  );
}

async function init() {
  render(await loadData());
  await loadQrSettings();
  setInterval(async () => render(await loadData()), 3000);
}

async function loadQrSettings() {
  try {
    const data = await loadData();
    const display = data.display || {};
    qrLabel.value = display.paymentQrLabel || "Scan For UPI Payment";
    upiText.value = display.paymentQrText || "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR";
    updateQrPreview(display.paymentQrImage || null, display.paymentQrText);
  } catch (error) {
    console.warn("Could not load QR settings", error);
  }
}

function updateQrPreview(imageData, upiTextValue) {
  if (imageData) {
    qrPreview.src = imageData;
  } else {
    const data = encodeURIComponent(upiTextValue || "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR");
    qrPreview.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${data}`;
  }
}

saveQrBtn.addEventListener("click", async () => {
  const label = qrLabel.value.trim();
  const upi = upiText.value.trim();
  
  let imageData = null;
  if (qrImageUpload.files.length > 0) {
    const file = qrImageUpload.files[0];
    imageData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }
  
  try {
    const response = await fetch("/api/qr-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentQrLabel: label || "Scan For UPI Payment",
        paymentQrText: upi || "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR",
        paymentQrImage: imageData
      })
    });
    
    if (!response.ok) throw new Error("Failed to save QR settings");
    alert("QR settings saved successfully!");
    qrImageUpload.value = "";
    updateQrPreview(imageData, upi);
  } catch (error) {
    alert("Error saving QR settings: " + error.message);
  }
});

resetQrBtn.addEventListener("click", async () => {
  if (!confirm("Reset QR settings to default?")) return;
  
  try {
    const response = await fetch("/api/qr-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentQrLabel: "Scan For UPI Payment",
        paymentQrText: "upi://pay?pa=aaradhna@upi&pn=Aaradhna%20Ice%20Dish%20%26%20Gola&cu=INR",
        paymentQrImage: null
      })
    });
    
    if (!response.ok) throw new Error("Failed to reset QR settings");
    alert("QR settings reset to default!");
    await loadQrSettings();
  } catch (error) {
    alert("Error resetting QR settings: " + error.message);
  }
});

qrImageUpload.addEventListener("change", () => {
  if (qrImageUpload.files.length > 0) {
    const file = qrImageUpload.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      updateQrPreview(e.target.result, upiText.value);
    };
    reader.readAsDataURL(file);
  }
});

upiText.addEventListener("input", () => {
  if (!qrImageUpload.files.length) {
    updateQrPreview(null, upiText.value);
  }
});

init();
