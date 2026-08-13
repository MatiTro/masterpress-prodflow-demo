(() => {
  "use strict";

  const root = document.getElementById("warehouseModule");
  if (!root) return;

  const $ = id => root.querySelector(`#${id}`);
  let orders = [];
  let requests = [];
  let toastTimer = null;

  function store() {
    const value = window.ProdFlow?.store;
    if (!value?.getOrders || !value?.updateOrder) {
      throw new Error("ProdFlow.store nie udostępnia danych magazynowych.");
    }
    return value;
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function escapeHtml(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function orderNumber(order) {
    return order.order?.externalNumber || order.number || order.id;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
  }

  function priority(value) {
    const normalized = clean(value).toLowerCase();
    if (["krytyczny", "critical"].includes(normalized)) return ["critical", "Krytyczny"];
    if (["wysoki", "high"].includes(normalized)) return ["high", "Wysoki"];
    return ["normal", "Normalny"];
  }

  function reload() {
    orders = store().getOrders();
    requests = orders.flatMap(order =>
      (Array.isArray(order.warehouse?.issues) ? order.warehouse.issues : []).map((issue, index) => ({
        ...issue,
        id: issue.id || `${order.id}-issue-${index}`,
        orderId: order.id,
        orderNumber: orderNumber(order),
        machine: issue.machine || order.production?.machineName || order.planning?.machineName || "Nieprzydzielona",
        material: issue.material || issue.name || "Materiał",
        quantity: issue.quantity || "—",
        status: issue.status === "delivered" ? "delivered" : "pending"
      }))
    );
  }

  function renderRequests() {
    const query = clean($("warehouseRequestSearch").value).toLowerCase();
    const filter = $("warehouseRequestFilter").value;
    const data = requests.filter(item =>
      (filter === "all" || item.status === filter) &&
      (!query || [item.machine, item.orderNumber, item.material, item.materialCode, item.quantity]
        .some(value => clean(value).toLowerCase().includes(query)))
    );

    $("warehouseRequestsBody").innerHTML = data.map(item => {
      const [priorityClass, priorityLabel] = priority(item.priority);
      const emailInfo = item.emailRecipient
        ? `<small>e-mail: ${escapeHtml(item.emailRecipient)}</small>`
        : "";
      return `
        <tr>
          <td><span class="warehouse-priority warehouse-priority--${priorityClass}">${priorityLabel}</span></td>
          <td><strong>${escapeHtml(item.machine)}</strong><small>${escapeHtml(item.orderNumber)}</small></td>
          <td><strong>${escapeHtml(item.material)}</strong><small>${escapeHtml(item.materialCode || "")}</small></td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(formatDateTime(item.createdAt))}${emailInfo}</td>
          <td><span class="warehouse-status warehouse-status--${item.status}">${item.status === "delivered" ? "Dostarczone" : "Oczekuje"}</span></td>
          <td>${item.status === "delivered"
            ? "—"
            : `<button class="warehouse-btn warehouse-btn--success" type="button" data-deliver-request="${escapeHtml(item.id)}">Dostarczone</button>`}</td>
        </tr>`;
    }).join("");

    $("warehouseRequestsEmpty").hidden = data.length > 0;
  }

  function renderKpis() {
    const today = new Date().toISOString().slice(0, 10);
    $("warehousePendingKpi").textContent = requests.filter(item => item.status === "pending").length;
    $("warehouseDeliveredKpi").textContent = requests.filter(item =>
      item.status === "delivered" && clean(item.deliveredAt).startsWith(today)
    ).length;
  }

  function renderAll() {
    reload();
    renderRequests();
    renderKpis();
  }

  function deliverRequest(requestId) {
    const request = requests.find(item => item.id === requestId);
    const order = orders.find(item => item.id === request?.orderId);
    if (!request || !order) return;

    const issues = (order.warehouse?.issues || []).map((issue, index) => {
      const id = issue.id || `${order.id}-issue-${index}`;
      return id === request.id
        ? { ...issue, status: "delivered", deliveredAt: new Date().toISOString() }
        : issue;
    });

    store().updateOrder(order.id, { warehouse: { issues } }, {
      module: "warehouse",
      historyMessage: `Dostarczono materiał: ${request.material}.`
    });
    renderAll();
    showToast("Materiał oznaczono jako dostarczony.");
  }

  function showToast(message) {
    const toast = $("warehouseToast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2500);
  }

  $("warehouseRequestSearch").addEventListener("input", renderRequests);
  $("warehouseRequestFilter").addEventListener("change", renderRequests);
  $("warehouseRequestsBody").addEventListener("click", event => {
    const button = event.target.closest("[data-deliver-request]");
    if (button) deliverRequest(button.dataset.deliverRequest);
  });

  function renderClock() {
    if ($("warehouseClock")) {
      $("warehouseClock").textContent = new Date().toLocaleTimeString("pl-PL");
    }
  }

  renderClock();
  const clockTimer = window.setInterval(renderClock, 1000);
  window.addEventListener("prodflow:module-unload", () => clearInterval(clockTimer), { once: true });

  [
    "store:order-updated",
    "store:order-deleted",
    "store:database-imported",
    "store:database-cleared"
  ].forEach(name => window.ProdFlow?.events?.on(name, () => {
    if (document.contains(root)) renderAll();
  }));

  renderAll();
})();
