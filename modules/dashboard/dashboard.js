(() => {
  "use strict";

  const root = document.getElementById("dashboardModule");
  if (!root) return;

  const $ = id => root.querySelector(`#${id}`);
  const priorityRank = Object.freeze({ critical: 0, high: 1, normal: 2, low: 3 });
  const moduleInfo = Object.freeze({
    "production-card": ["KP", "Karta produkcyjna"],
    planning: ["PL", "Planowanie"],
    production: ["PR", "Produkcja"],
    labels: ["ET", "Etykiety"],
    complaints: ["WK", "Wniosek kasacji"],
    "quality-complaints": ["RE", "Reklamacje"],
    "barcode-quality": ["KK", "Kontrola kodów"],
    ppwr: ["PP", "PPWR"],
    core: ["SY", "System"]
  });
  let clockTimer = null;

  function store() {
    const value = window.ProdFlow?.store;
    if (!value?.getOrders || !value?.getHistory) {
      throw new Error("ProdFlow.store nie jest dostępny.");
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

  function formatNumber(value) {
    return new Intl.NumberFormat("pl-PL").format(Number(value) || 0);
  }

  function localDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function orderNumber(order) {
    return clean(order.order?.externalNumber || order.number || order.id) || "—";
  }

  function statusLabel(status) {
    return {
      draft: "Karta robocza",
      new: "Nowe",
      planned: "Zaplanowane",
      in_production: "W produkcji",
      suspended: "Zawieszone",
      dropped: "Spadnięte",
      quality_control: "Kontrola jakości",
      packing: "Pakowanie",
      completed: "Zakończone",
      cancelled: "Anulowane"
    }[status] || "W przygotowaniu";
  }

  function statusForOrder(order) {
    if (order.status) return order.status;
    if (order.production?.status === "running") return "in_production";
    return "draft";
  }

  function isMaintenance(order) {
    return order.metadata?.orderType === "maintenance";
  }

  function isActive(order) {
    return !order.metadata?.archived && !["completed", "cancelled"].includes(order.status);
  }

  function dueInfo(order) {
    const value = clean(order.order?.dueDate || order.planning?.plannedEnd);
    if (!value) return { timestamp: Number.POSITIVE_INFINITY, label: "Bez terminu", tone: "" };
    const due = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(due.getTime())) return { timestamp: Number.POSITIVE_INFINITY, label: "Bez terminu", tone: "" };
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const days = Math.round((due.getTime() - today.getTime()) / 86400000);
    const date = new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" }).format(due);
    if (days < 0) return { timestamp: due.getTime(), label: `${date} · po terminie`, tone: "is-late", overdue: true };
    if (days === 0) return { timestamp: due.getTime(), label: `${date} · dzisiaj`, tone: "is-near" };
    if (days === 1) return { timestamp: due.getTime(), label: `${date} · jutro`, tone: "is-near" };
    return { timestamp: due.getTime(), label: date, tone: days <= 3 ? "is-near" : "" };
  }

  function currentShift(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 6 && hour < 14) return { number: 1, hours: "06:00–14:00" };
    if (hour >= 14 && hour < 22) return { number: 2, hours: "14:00–22:00" };
    return { number: 3, hours: "22:00–06:00" };
  }

  function renderClock() {
    const now = new Date();
    const shift = currentShift(now);
    $("dashboardDate").textContent = new Intl.DateTimeFormat("pl-PL", {
      weekday: "long", day: "2-digit", month: "long"
    }).format(now);
    $("dashboardClock").textContent = now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    $("dashboardShift").textContent = `${shift.number}. zmiana`;
    $("dashboardShiftHours").textContent = shift.hours;
  }

  function qualityData(dataStore) {
    const complaints = dataStore.getSetting?.("quality.complaints", { records: [] }) || { records: [] };
    const barcode = dataStore.getSetting?.("quality.barcodeControl", { protocols: [] }) || { protocols: [] };
    const openComplaints = (Array.isArray(complaints.records) ? complaints.records : [])
      .filter(record => clean(record.values?.qcStatus || "new") !== "closed");
    const failedToday = (Array.isArray(barcode.protocols) ? barcode.protocols : [])
      .filter(protocol => protocol.status === "fail" && localDateKey(protocol.createdAt) === localDateKey());
    return { openComplaints, failedToday };
  }

  function attentionData(activeOrders, quality) {
    const suspended = activeOrders.filter(order => ["suspended", "dropped"].includes(order.status));
    const suspendedIds = new Set(suspended.map(order => order.id));
    const overdue = activeOrders.filter(order => !suspendedIds.has(order.id) && dueInfo(order).overdue);
    const count = suspended.length + overdue.length + quality.openComplaints.length + quality.failedToday.length;
    return { suspended, overdue, count };
  }

  function renderKpis(activeOrders, attention) {
    const toPlan = activeOrders.filter(order =>
      ["draft", "new"].includes(order.status) || order.processStep === "card"
    );
    const planned = activeOrders.filter(order =>
      order.status === "planned" || (order.processStep === "planning" && !["draft", "new"].includes(order.status))
    );
    const running = activeOrders.filter(order =>
      order.status === "in_production" || order.production?.status === "running"
    );

    $("dashboardToPlan").textContent = formatNumber(toPlan.length);
    $("dashboardPlanned").textContent = formatNumber(planned.length);
    $("dashboardRunning").textContent = formatNumber(running.length);
    $("dashboardAttention").textContent = formatNumber(attention.count);
    $("dashboardToPlanHint").textContent = toPlan.length ? "oczekują na termin i maszynę" : "Brak nowych zleceń";
    $("dashboardPlannedHint").textContent = planned.length ? "w kolejce do produkcji" : "Brak kolejki";
    $("dashboardRunningHint").textContent = running.length ? "aktualnie realizowane" : "Brak realizowanych zleceń";
    $("dashboardAttentionHint").textContent = attention.count ? "sprawy do sprawdzenia" : "Brak pilnych spraw";

    const brief = $("dashboardBrief");
    if (attention.suspended.some(order => order.status === "dropped")) {
      brief.dataset.tone = "critical";
      $("dashboardBriefText").textContent = "Co najmniej jedno zlecenie spadło z planu — wymaga decyzji planisty.";
    } else if (attention.count) {
      brief.dataset.tone = "warning";
      $("dashboardBriefText").textContent = `${formatNumber(attention.count)} ${attention.count === 1 ? "sprawa wymaga" : "spraw wymaga"} sprawdzenia.`;
    } else if (activeOrders.length) {
      brief.dataset.tone = "ok";
      $("dashboardBriefText").textContent = "Brak pilnych problemów. Aktywne zlecenia są widoczne poniżej.";
    } else {
      brief.dataset.tone = "neutral";
      $("dashboardBriefText").textContent = "Brak aktywnych zleceń. Dashboard uzupełni się po zapisaniu Karty Produkcyjnej.";
    }
  }

  function renderPriorities(activeOrders) {
    const rows = [...activeOrders]
      .sort((first, second) => {
        const firstRisk = ["dropped", "suspended"].includes(first.status) ? 0 : 1;
        const secondRisk = ["dropped", "suspended"].includes(second.status) ? 0 : 1;
        if (firstRisk !== secondRisk) return firstRisk - secondRisk;
        const firstPriority = priorityRank[clean(first.order?.priority).toLowerCase()] ?? 2;
        const secondPriority = priorityRank[clean(second.order?.priority).toLowerCase()] ?? 2;
        if (firstPriority !== secondPriority) return firstPriority - secondPriority;
        const dueDifference = dueInfo(first).timestamp - dueInfo(second).timestamp;
        if (dueDifference) return dueDifference;
        return String(second.updatedAt || "").localeCompare(String(first.updatedAt || ""));
      })
      .slice(0, 7);

    $("dashboardPriorityCount").textContent = `${activeOrders.length} ${activeOrders.length === 1 ? "zlecenie" : "zleceń"}`;
    $("dashboardPriorityList").innerHTML = rows.length ? rows.map(order => {
      const due = dueInfo(order);
      const priority = clean(order.order?.priority).toLowerCase() || "normal";
      const machine = clean(order.planning?.machineName || order.production?.machineName) || "Maszyna nieprzypisana";
      const product = isMaintenance(order)
        ? clean(order.product?.name || "Konserwacja maszyny")
        : clean(order.product?.name || "Brak nazwy produktu");
      return `
        <article class="dashboard-order" data-priority="${escapeHtml(priority)}" data-status="${escapeHtml(statusForOrder(order))}">
          <div><strong>${escapeHtml(orderNumber(order))}</strong><small>${escapeHtml(order.customer?.name || (isMaintenance(order) ? "Zlecenie konserwacji" : "Brak klienta"))}</small></div>
          <div class="dashboard-order__product"><strong>${escapeHtml(product)}</strong><small>${escapeHtml(machine)} · ${formatNumber(order.order?.quantity || order.product?.quantity)} szt.</small></div>
          <span class="dashboard-order__status" data-status="${escapeHtml(statusForOrder(order))}">${escapeHtml(statusLabel(statusForOrder(order)))}</span>
          <span class="dashboard-order__due ${due.tone}">${escapeHtml(due.label)}</span>
        </article>`;
    }).join("") : `<div class="dashboard-empty">Brak aktywnych zleceń do wyświetlenia.</div>`;
  }

  function renderAttention(attention, quality) {
    const items = [];
    attention.suspended.forEach(order => {
      const dropped = order.status === "dropped";
      items.push({
        level: dropped ? "critical" : "warning",
        code: dropped ? "SP" : "ZA",
        title: `${orderNumber(order)} · ${dropped ? "zlecenie spadło" : "zlecenie zawieszone"}`,
        detail: clean(order.production?.statusReason || order.production?.notes) || "Sprawdź przyczynę i zdecyduj o dalszej realizacji."
      });
    });
    attention.overdue.forEach(order => items.push({
      level: "critical",
      code: "TR",
      title: `${orderNumber(order)} · termin minął`,
      detail: `${clean(order.product?.name || "Zlecenie")} · ${dueInfo(order).label}`
    }));
    if (quality.openComplaints.length) items.push({
      level: "warning", code: "RE",
      title: `${formatNumber(quality.openComplaints.length)} ${quality.openComplaints.length === 1 ? "otwarta reklamacja" : "otwarte reklamacje"}`,
      detail: "Sprawy jakościowe bez statusu „zamknięta”."
    });
    if (quality.failedToday.length) items.push({
      level: "critical", code: "KK",
      title: `${formatNumber(quality.failedToday.length)} ${quality.failedToday.length === 1 ? "negatywna kontrola kodu" : "negatywne kontrole kodu"} dzisiaj`,
      detail: "Sprawdź protokoły w module Kontrola kodów."
    });

    const critical = items.some(item => item.level === "critical");
    $("dashboardAttentionLight").dataset.state = critical ? "critical" : items.length ? "warning" : "ok";
    $("dashboardAttentionList").innerHTML = items.length
      ? items.slice(0, 5).map(item => `
          <article class="dashboard-attention-item" data-level="${item.level}">
            <span class="dashboard-attention-item__code">${item.code}</span>
            <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>
          </article>`).join("")
      : `<div class="dashboard-empty is-ok">Brak zleceń i zapisów jakości wymagających pilnej reakcji.</div>`;
  }

  function renderStages(orders, activeOrders) {
    const today = localDateKey();
    const stages = [
      { key: "card", label: "Karta", count: activeOrders.filter(order => order.processStep === "card" || ["draft", "new"].includes(order.status)).length },
      { key: "planning", label: "Planowanie", count: activeOrders.filter(order => order.processStep === "planning" && !["draft", "new", "in_production", "suspended", "dropped"].includes(order.status)).length },
      { key: "production", label: "Produkcja", count: activeOrders.filter(order => order.processStep === "production" || ["in_production", "suspended", "dropped"].includes(order.status)).length },
      { key: "quality", label: "Jakość", count: activeOrders.filter(order => order.processStep === "quality" || order.status === "quality_control").length },
      { key: "completed", label: "Zakończone dziś", count: orders.filter(order => order.status === "completed" && localDateKey(order.completedAt || order.updatedAt) === today).length }
    ];
    const maximum = Math.max(1, ...stages.map(stage => stage.count));
    $("dashboardStageTotal").textContent = `${activeOrders.length} aktywnych`;
    $("dashboardStageList").innerHTML = stages.map(stage => `
      <div class="dashboard-stage" data-stage="${stage.key}">
        <span>${stage.label}</span>
        <div class="dashboard-stage__bar"><i style="width:${stage.count ? Math.max(8, Math.round(stage.count / maximum * 100)) : 0}%"></i></div>
        <strong>${formatNumber(stage.count)}</strong>
      </div>`).join("");
  }

  function renderActivity(dataStore, orders) {
    const orderMap = new Map(orders.map(order => [order.id, order]));
    const events = dataStore.getHistory({ newestFirst: true })
      .filter(event => event.module !== "warehouse")
      .slice(0, 6);
    $("dashboardActivityList").innerHTML = events.length ? events.map(event => {
      const order = orderMap.get(event.orderId);
      const info = moduleInfo[event.module] || moduleInfo.core;
      const createdAt = new Date(event.createdAt);
      const time = Number.isNaN(createdAt.getTime()) ? "—" : createdAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      return `
        <article class="dashboard-activity-item">
          <time>${escapeHtml(time)}</time>
          <span class="dashboard-activity-item__module">${info[0]}</span>
          <div><strong>${escapeHtml(event.message || event.action || "Aktualizacja danych")}</strong><small>${escapeHtml(info[1])} · ${escapeHtml(order ? orderNumber(order) : event.user?.name || "System")}</small></div>
        </article>`;
    }).join("") : `<div class="dashboard-empty">Historia jest pusta. Pierwsze zdarzenia pojawią się po pracy ze zleceniami.</div>`;
  }

  function render() {
    if (!document.contains(root)) return;
    const dataStore = store();
    const orders = dataStore.getOrders({ archived: true });
    const activeOrders = orders.filter(isActive);
    const quality = qualityData(dataStore);
    const attention = attentionData(activeOrders, quality);
    renderClock();
    renderKpis(activeOrders, attention);
    renderPriorities(activeOrders);
    renderAttention(attention, quality);
    renderStages(orders, activeOrders);
    renderActivity(dataStore, orders);
  }

  [
    "store:order-created", "store:order-updated", "store:order-status-changed",
    "store:order-deleted", "store:history-added", "store:database-changed", "store:database-imported",
    "store:database-cleared"
  ].forEach(name => window.ProdFlow?.events?.on(name, render));
  clockTimer = window.setInterval(renderClock, 1000);
  window.addEventListener("prodflow:module-unload", () => window.clearInterval(clockTimer), { once: true });
  render();
})();
