(() => {
  "use strict";

  const root = document.getElementById("labelsModule");
  if (!root) return;

  const $ = id => root.querySelector(`#${id}`) || document.getElementById(id);
  let selectedOrderId = "";
  let toastTimer = null;

  function store() {
    const value = window.ProdFlow?.store;
    if (!value?.getOrders || !value?.getLabels || !value?.addLabelRecord) {
      throw new Error("ProdFlow.store nie udostępnia obsługi etykiet.");
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

  function availableOrders() {
    return store().getOrders({ archived: false }).filter(order =>
      order.processStep !== "card" &&
      order.status !== "draft" &&
      order.status !== "cancelled"
    );
  }

  function labelName(value) {
    return {
      pallet: "Paletowa",
      carton: "Kartonowa",
      product: "Produktowa"
    }[value] || value || "Nie wybrano";
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
  }

  function render() {
    const query = clean($("labelsSearch").value).toLowerCase();
    const status = $("labelsStatusFilter").value;
    const labels = store().getLabels();

    const rows = availableOrders()
      .map(order => {
        const prints = labels
          .filter(label => label.orderId === order.id)
          .sort((a, b) => String(b.printedAt).localeCompare(String(a.printedAt)));
        return { order, prints };
      })
      .filter(({ order, prints }) => {
        if (status === "printed" && !prints.length) return false;
        if (status === "not-printed" && prints.length) return false;
        if (!query) return true;
        return [
          orderNumber(order),
          order.number,
          order.customer?.name,
          order.product?.name,
          order.product?.code
        ].some(value => clean(value).toLowerCase().includes(query));
      })
      .sort((a, b) => String(b.order.updatedAt || "").localeCompare(String(a.order.updatedAt || "")));

    $("labelsOrdersBody").innerHTML = rows.map(({ order, prints }) => {
      const last = prints[0];
      const total = prints.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return `
        <tr>
          <td><strong>${escapeHtml(orderNumber(order))}</strong><small>${escapeHtml(order.number || order.id)}</small></td>
          <td>${escapeHtml(order.customer?.name || "—")}</td>
          <td><strong>${escapeHtml(order.product?.name || "—")}</strong><small>${escapeHtml(order.product?.code || "—")}</small></td>
          <td>${new Intl.NumberFormat("pl-PL").format(Number(order.order?.quantity) || 0)} szt.</td>
          <td>${escapeHtml(labelName(last?.template || order.packing?.labelTemplate))}</td>
          <td><strong>${total}</strong></td>
          <td>${escapeHtml(formatDateTime(last?.printedAt))}</td>
          <td><button class="label-btn label-btn-primary" type="button" data-label-print="${escapeHtml(order.id)}">Drukuj</button></td>
        </tr>`;
    }).join("");

    $("labelsEmpty").hidden = rows.length > 0;
  }

  function openDialog(orderId) {
    const order = availableOrders().find(item => item.id === orderId);
    if (!order) return;

    selectedOrderId = order.id;
    $("labelsDialogTitle").textContent = `Etykiety — ${orderNumber(order)}`;
    $("labelsDialogDescription").textContent =
      `${order.customer?.name || "Brak klienta"} · ${order.product?.name || "Brak nazwy produktu"}`;
    $("labelsTemplate").value =
      ["pallet", "carton", "product"].includes(order.packing?.labelTemplate)
        ? order.packing.labelTemplate
        : "pallet";
    $("labelsCopies").value = "1";
    $("labelsPreviewOrder").textContent = orderNumber(order);
    $("labelsPreviewProduct").textContent = order.product?.name || "—";
    $("labelsPreviewCustomer").textContent = order.customer?.name || "—";
    $("labelsPrintDialog").showModal();
  }

  function closeDialog() {
    $("labelsPrintDialog").close();
    selectedOrderId = "";
  }

  function showToast(message) {
    const toast = $("labelsToast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  $("labelsSearch").addEventListener("input", render);
  $("labelsStatusFilter").addEventListener("change", render);
  $("labelsOrdersBody").addEventListener("click", event => {
    const button = event.target.closest("[data-label-print]");
    if (button) openDialog(button.dataset.labelPrint);
  });
  $("labelsDialogClose").addEventListener("click", closeDialog);
  $("labelsCancelBtn").addEventListener("click", closeDialog);
  $("labelsPrintForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!selectedOrderId) return;
    const data = new FormData(event.currentTarget);
    store().addLabelRecord(selectedOrderId, {
      template: clean(data.get("template")),
      quantity: Number(data.get("quantity")) || 1,
      printer: clean(data.get("printer")),
      data: { source: "orders-table" }
    }, { module: "labels" });
    window.print();
    closeDialog();
    render();
    showToast("Wydruk etykiet został zapisany w historii zlecenia.");
  });

  [
    "store:order-created",
    "store:order-updated",
    "store:order-status-changed",
    "store:order-deleted",
    "store:label-added",
    "store:database-imported",
    "store:database-cleared"
  ].forEach(name => window.ProdFlow?.events?.on(name, () => {
    if (document.contains(root)) render();
  }));

  render();
})();
