function initHistory() {
  const root = document.getElementById("historyModule");
  if (!root || root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  const $ = id => document.getElementById(id);
  const modules = {
    "production-card": ["Karta produkcyjna", "KP"],
    labels: ["Etykiety", "ET"],
    complaints: ["Reklamacje", "RK"],
    planning: ["Planowanie", "PL"],
    production: ["Produkcja", "PR"],
    warehouse: ["Magazyn", "MG"],
    ppwr: ["PPWR", "PP"],
    core: ["System", "SY"]
  };
  const statuses = {
    done: "Zakończone",
    attention: "Wymaga uwagi",
    draft: "Wersja robocza"
  };
  const search = $("historySearch");
  const moduleFilter = $("historyModuleFilter");
  const statusFilter = $("historyStatusFilter");
  const list = $("historyList");
  const dialog = $("historyDialog");
  let selectedId = null;
  let entries = [];

  function getStore() {
    const store = window.ProdFlow?.store;
    if (!store) throw new Error("ProdFlow.store nie jest dostępny.");
    return store;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function dateText(value, short = false) {
    return new Intl.DateTimeFormat(
      "pl-PL",
      short
        ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    ).format(new Date(value));
  }

  function statusFor(entry, order) {
    if (order?.status === "draft" || entry.action === "created") return "draft";
    if (
      order?.status === "cancelled" ||
      order?.status === "suspended" ||
      order?.status === "dropped" ||
      entry.type === "complaint" ||
      entry.action === "error"
    ) return "attention";
    return "done";
  }

  function reload() {
    const store = getStore();
    const orders = store.getOrders({ archived: true });
    const orderMap = new Map(orders.map(order => [order.id, order]));

    entries = store.getHistory({ newestFirst: true }).map(entry => {
      const order = orderMap.get(entry.orderId);
      return {
        id: entry.id,
        orderId: entry.orderId,
        orderNumber:
          order?.order?.externalNumber ||
          order?.number ||
          entry.orderId ||
          "—",
        client: order?.customer?.name || "—",
        productIndex: order?.product?.code || "—",
        module: entry.module || "core",
        title: entry.message || entry.action || "Zdarzenie",
        description:
          entry.details?.description ||
          `${entry.type || "informacja"} · ${entry.action || "aktualizacja"}`,
        status: statusFor(entry, order),
        createdAt: entry.createdAt,
        createdBy: entry.user?.name || "System"
      };
    });
  }

  function visibleEntries() {
    const q = norm(search.value);
    return entries.filter(entry => {
      const haystack = norm([
        entry.orderNumber,
        entry.client,
        entry.productIndex,
        entry.title,
        entry.description,
        entry.createdBy,
        modules[entry.module]?.[0]
      ].join(" "));
      return (
        (!q || haystack.includes(q)) &&
        (moduleFilter.value === "all" || entry.module === moduleFilter.value) &&
        (statusFilter.value === "all" || entry.status === statusFilter.value)
      );
    });
  }

  function renderStats() {
    const today = new Date().toDateString();
    $("historyAllCount").textContent = entries.length;
    $("historyTodayCount").textContent =
      entries.filter(entry => new Date(entry.createdAt).toDateString() === today).length;
    $("historyAttentionCount").textContent =
      entries.filter(entry => entry.status === "attention").length;
    $("historyOrdersCount").textContent =
      new Set(entries.map(entry => entry.orderId).filter(Boolean)).size;
  }

  function renderList() {
    const rows = visibleEntries();
    $("historyResultCount").textContent =
      `${rows.length} ${rows.length === 1 ? "wynik" : "wyników"}`;
    $("historyEmpty").hidden = rows.length > 0;
    list.innerHTML = rows.map(entry => `
      <button class="history-item ${entry.id === selectedId ? "active" : ""}" data-id="${esc(entry.id)}" type="button">
        <span class="module-icon ${esc(entry.module)}">${esc(modules[entry.module]?.[1] || "?")}</span>
        <span class="history-item-main"><strong>${esc(entry.title)}</strong><p>${esc(entry.description)}</p><small>${esc(entry.orderNumber)} · ${esc(entry.client)} · ${esc(entry.createdBy)}</small></span>
        <span class="history-item-side"><b class="history-status ${esc(entry.status)}">${esc(statuses[entry.status])}</b><time>${esc(dateText(entry.createdAt, true))}</time></span>
      </button>
    `).join("");

    list.querySelectorAll("[data-id]").forEach(button => {
      button.addEventListener("click", () => {
        selectedId = button.dataset.id;
        renderList();
        renderDetails();
      });
    });
  }

  function renderDetails() {
    const entry = entries.find(item => item.id === selectedId);
    $("historyDetailsEmpty").hidden = Boolean(entry);
    $("historyDetails").hidden = !entry;
    if (!entry) return;

    $("detailsModule").textContent = modules[entry.module]?.[0] || entry.module;
    $("detailsTitle").textContent = entry.title;
    $("detailsStatus").textContent = statuses[entry.status];
    $("detailsStatus").className = `history-status ${entry.status}`;
    $("detailsOrder").textContent = entry.orderNumber;
    $("detailsClient").textContent = entry.client;
    $("detailsIndex").textContent = entry.productIndex;
    $("detailsDescription").textContent = entry.description;
    $("detailsDate").textContent = dateText(entry.createdAt);
    $("detailsUser").textContent = entry.createdBy;

    const timeline = entries.filter(item => item.orderId === entry.orderId);
    $("timelineCount").textContent =
      `${timeline.length} ${timeline.length === 1 ? "zdarzenie" : "zdarzeń"}`;
    $("historyTimeline").innerHTML = timeline.map((item, index) => `
      <article class="timeline-item"><span class="timeline-dot">${index + 1}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.description)}</p><time>${esc(dateText(item.createdAt))} · ${esc(item.createdBy)}</time></div></article>
    `).join("");
  }

  function render() {
    renderStats();
    renderList();
    renderDetails();
  }

  function refresh() {
    if (!document.contains(root)) return;
    reload();
    if (selectedId && !entries.some(entry => entry.id === selectedId)) selectedId = null;
    render();
  }

  [search, moduleFilter, statusFilter].forEach(control => {
    control?.addEventListener("input", renderList);
  });

  $("historyAddBtn")?.addEventListener("click", () => dialog.showModal());
  $("historyForm")?.addEventListener("submit", event => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const orderRef = $("newOrder").value.trim();
    const store = getStore();
    const order = store.getOrders({ archived: true }).find(item =>
      item.id === orderRef ||
      item.number === orderRef ||
      item.order?.externalNumber === orderRef
    );
    if (!order) {
      window.alert("Nie znaleziono zlecenia w ProdFlow.store.");
      return;
    }
    store.addHistory(order.id, {
      type: "information",
      action: "manual",
      module: $("newModule").value,
      message: $("newTitle").value.trim(),
      details: { description: $("newDescription").value.trim() },
      user: { name: $("newUser").value || "System" }
    });
    dialog.close();
    event.target.reset();
    refresh();
  });

  [
    "store:order-created",
    "store:order-updated",
    "store:order-status-changed",
    "store:order-deleted",
    "store:database-changed",
    "store:database-imported",
    "store:database-cleared",
    "store:history-added"
  ].forEach(name => window.ProdFlow?.events?.on(name, refresh));

  refresh();
}

initHistory();
