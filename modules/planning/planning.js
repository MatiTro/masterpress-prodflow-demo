function initPlanning() {
  const root = document.getElementById("planningModule");
  if (!root) return;

  const statuses = [
    { id: "unplanned", label: "Do zaplanowania", caption: "Oczekuje na decyzję" },
    { id: "planned", label: "Zaplanowane", caption: "Przydzielone do maszyny" },
    { id: "production", label: "W produkcji", caption: "Realizowane obecnie" },
    { id: "completed", label: "Zakończone", caption: "Gotowe lub przekazane dalej" }
  ];

  let orders = [];
  let selectedOrderId = null;
  let currentView = "board";

  const $ = id => document.getElementById(id);

  function offsetDate(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function getStore() {
    const store = window.ProdFlow?.store;

    if (!store || typeof store.getOrders !== "function") {
      throw new Error(
        "ProdFlow Store nie jest dostępny. Sprawdź kolejność ładowania plików core."
      );
    }

    return store;
  }

  function mapStoreStatus(status) {
    const statusMap = {
      draft: "unplanned",
      new: "unplanned",
      planned: "planned",
      in_production: "production",
      suspended: "production",
      dropped: "unplanned",
      quality_control: "production",
      packing: "production",
      warehouse: "production",
      completed: "completed",
      cancelled: "completed"
    };

    return statusMap[status] || "unplanned";
  }

  function mapPlanningStatus(status) {
    const statusMap = {
      unplanned: {
        status: "draft",
        processStep: "planning"
      },
      planned: {
        status: "planned",
        processStep: "planning"
      },
      production: {
        status: "in_production",
        processStep: "production"
      },
      completed: {
        status: "completed",
        processStep: "completed"
      }
    };

    return statusMap[status] || statusMap.unplanned;
  }

  function mapPriorityToPlanning(priority) {
    const priorityMap = {
      critical: "Krytyczny",
      krytyczny: "Krytyczny",
      high: "Wysoki",
      wysoki: "Wysoki",
      normal: "Normalny",
      normalny: "Normalny",
      low: "Niski",
      niski: "Niski"
    };

    const normalized = String(priority || "normal").toLowerCase();
    return priorityMap[normalized] || String(priority || "Normalny");
  }

  function mapPriorityToStore(priority) {
    const priorityMap = {
      Krytyczny: "critical",
      Wysoki: "high",
      Normalny: "normal",
      Niski: "low"
    };

    return priorityMap[priority] || "normal";
  }

  function getMaterialAvailability(order) {
    const savedValue =
      order.metadata?.planning?.materialAvailability;

    if (savedValue) {
      return savedValue;
    }

    const warehouseStatus = order.warehouse?.status;

    if (
      warehouseStatus === "missing" ||
      warehouseStatus === "unavailable"
    ) {
      return "Brak";
    }

    if (
      warehouseStatus === "partial" ||
      warehouseStatus === "partially_reserved"
    ) {
      return "Częściowo";
    }

    return "Dostępny";
  }

  function getProgress(order, planningStatus) {
    if (planningStatus === "completed") {
      return 100;
    }

    const storedProgress =
      order.metadata?.planning?.progress;

    if (Number.isFinite(Number(storedProgress))) {
      return Math.max(
        0,
        Math.min(100, Number(storedProgress))
      );
    }

    const quantity =
      Number(order.order?.quantity) ||
      Number(order.product?.quantity) ||
      0;

    const produced =
      Number(order.production?.goodQuantity) ||
      Number(order.production?.producedQuantity) ||
      0;

    if (quantity > 0 && produced > 0) {
      return Math.max(0, Math.round((produced / quantity) * 100));
    }

    return planningStatus === "production" ? 10 : 0;
  }

  function mapStoreOrder(order) {
    const planningStatus = mapStoreStatus(order.status);
    const maintenance = order.metadata?.maintenance || null;

    return {
      id: order.id,
      order:
        order.order?.externalNumber ||
        order.number ||
        order.id,
      client: order.customer?.name || "",
      product: order.product?.name || "",
      index: order.product?.code || "",
      quantity:
        Number(order.order?.quantity) ||
        Number(order.product?.quantity) ||
        0,
      deadline:
        order.order?.dueDate ||
        order.order?.requestedDate ||
        order.logistics?.deliveryDate ||
        "",
      machine:
        order.planning?.machineName ||
        order.planning?.machineId ||
        "",
      material: getMaterialAvailability(order),
      priority: mapPriorityToPlanning(
        order.order?.priority
      ),
      status: planningStatus,
      progress: getProgress(order, planningStatus),
      note: order.planning?.notes || "",
      systemStatus: order.status,
      disposition: order.metadata?.productionDisposition || null,
      orderType: order.metadata?.orderType || "production",
      maintenance
    };
  }

  function refreshOrders() {
    const storeOrders = getStore().getOrders();
    orders = Array.isArray(storeOrders)
      ? storeOrders
          .filter(
            order =>
              order.processStep !== "card"
          )
          .map(mapStoreOrder)
      : [];
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pl-PL").format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "Brak terminu";
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(`${value}T12:00:00`));
  }

  function daysUntil(value) {
    if (!value) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(`${value}T00:00:00`);
    return Math.ceil((date - today) / 86400000);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function filteredOrders() {
    const query = $("planningSearch").value.trim().toLowerCase();
    const machine = $("planningMachineFilter").value;
    const priority = $("planningPriorityFilter").value;
    const material = $("planningMaterialFilter").value;

    return orders.filter(order => {
      const haystack = [
        order.order,
        order.client,
        order.product,
        order.index,
        order.machine
      ].join(" ").toLowerCase();

      return (!query || haystack.includes(query))
        && (!machine || order.machine === machine)
        && (!priority || order.priority === priority)
        && (!material || order.material === material);
    });
  }

  function renderMachineFilter() {
    const selected = $("planningMachineFilter").value;
    const machines = [...new Set(orders.map(order => order.machine).filter(Boolean))].sort();

    $("planningMachineFilter").innerHTML =
      '<option value="">Wszystkie</option>' +
      machines.map(machine => `<option value="${escapeHtml(machine)}">${escapeHtml(machine)}</option>`).join("");

    $("planningMachineFilter").value = machines.includes(selected) ? selected : "";
  }

  function renderStats() {
    const active = orders.filter(order => order.status !== "completed");
    const overdue = active.filter(order => daysUntil(order.deadline) < 0).length;
    const materialRisk = active.filter(order => order.material !== "Dostępny").length;
    const production = orders.filter(order => order.status === "production").length;
    const totalQuantity = active.reduce((sum, order) => sum + Number(order.quantity || 0), 0);

    const stats = [
      ["Aktywne zlecenia", active.length, "W całym planie"],
      ["W produkcji", production, "Realizowane obecnie"],
      ["Po terminie", overdue, overdue ? "Wymagają reakcji" : "Brak opóźnień"],
      ["Ryzyko materiałowe", materialRisk, "Brak lub częściowa dostępność"],
      ["Łączna ilość", `${formatNumber(totalQuantity)} szt.`, "Do realizacji"]
    ];

    $("planningStats").innerHTML = stats.map(([label, value, note]) => `
      <article class="planning-stat">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${note}</small>
      </article>
    `).join("");
  }

  function renderAlerts() {
    const risks = orders
      .filter(order => order.status !== "completed")
      .flatMap(order => {
        const items = [];
        const days = daysUntil(order.deadline);

        if (days < 0) {
          items.push({
            text: `${order.order}: po terminie`,
            danger: true
          });
        } else if (days <= 1 && order.status !== "production") {
          items.push({
            text: `${order.order}: termin za ${days === 0 ? "0 dni" : "1 dzień"}`,
            danger: true
          });
        }

        if (order.material === "Brak") {
          items.push({
            text: `${order.order}: brak materiału`,
            danger: true
          });
        } else if (order.material === "Częściowo") {
          items.push({
            text: `${order.order}: materiał częściowo`,
            danger: false
          });
        }

        return items;
      });

    $("planningAlertTitle").textContent = risks.length
      ? `${risks.length} ${risks.length === 1 ? "aktywny alert" : "aktywnych alertów"}`
      : "Brak aktywnych ostrzeżeń";

    $("planningAlertList").innerHTML = risks.length
      ? risks.slice(0, 8).map(risk => `
          <span class="planning-alert-chip ${risk.danger ? "is-danger" : ""}">
            ${escapeHtml(risk.text)}
          </span>
        `).join("")
      : '<span class="planning-alert-chip is-ok">Plan nie zawiera krytycznych ryzyk</span>';
  }

  function renderBoard() {
    const visible = filteredOrders();

    $("planningBoard").innerHTML = statuses.map(status => {
      const statusOrders = visible.filter(order => order.status === status.id);

      return `
        <section class="planning-column">
          <header class="planning-column-head">
            <div>
              <span>${status.caption}</span>
              <strong>${status.label}</strong>
            </div>
            <b class="planning-column-count">${statusOrders.length}</b>
          </header>

          <div class="planning-column-body" data-status="${status.id}">
            ${statusOrders.length
              ? statusOrders.map(renderCard).join("")
              : '<div class="planning-empty">Brak zleceń w tej kolumnie.</div>'}
          </div>
        </section>
      `;
    }).join("");

    bindBoardEvents();
  }

  function renderCard(order) {
    const machine = order.machine || "Nieprzydzielona";
    const isMaintenance = order.orderType === "maintenance";
    const days = daysUntil(order.deadline);
    let deadlineText = formatDate(order.deadline);
    const specialStatus = {
      suspended: ["suspended", "Zawieszone"],
      dropped: ["dropped", "Spadnięte - wymaga przeplanowania"]
    }[order.systemStatus];

    if (days < 0 && order.status !== "completed") deadlineText += " · po terminie";
    else if (days === 0 && order.status !== "completed") deadlineText += " · dzisiaj";
    else if (days === 1 && order.status !== "completed") deadlineText += " · jutro";

    return `
      <article class="planning-card ${isMaintenance ? "is-maintenance" : ""}"
        draggable="true"
        data-id="${escapeHtml(order.id)}"
        data-priority="${escapeHtml(order.priority)}">
        <div class="planning-card-top">
          <span class="planning-card-order">${escapeHtml(order.order)}</span>
          <span class="planning-card-priority">${escapeHtml(order.priority)}</span>
        </div>

        ${specialStatus
          ? `<span class="planning-card-state planning-card-state--${specialStatus[0]}">${escapeHtml(specialStatus[1])}</span>`
          : ""}

        ${isMaintenance
          ? `<span class="planning-maintenance-badge">Konserwacja · ${escapeHtml(order.maintenance?.type || "zadanie techniczne")}</span>`
          : ""}

        <h3>${escapeHtml(order.product)}</h3>
        <p class="planning-card-client">${escapeHtml(order.client)} · indeks ${escapeHtml(order.index || "—")}</p>

        <div class="planning-card-meta">
          <div>
            <span>${isMaintenance ? "Czas" : "Ilość"}</span>
            <strong>${isMaintenance ? `${formatNumber(order.maintenance?.durationMinutes || 0)} min` : `${formatNumber(order.quantity)} szt.`}</strong>
          </div>
          <div>
            <span>Maszyna</span>
            <strong>${escapeHtml(machine)}</strong>
          </div>
          <div>
            <span>Termin</span>
            <strong>${escapeHtml(deadlineText)}</strong>
          </div>
          <div>
            <span>Postęp</span>
            <strong>${Number(order.progress || 0)}%</strong>
          </div>
        </div>

        <footer class="planning-card-footer">
          <span class="planning-material" data-material="${escapeHtml(order.material)}">
            ${escapeHtml(order.material)}
          </span>
          <button type="button" data-details="${escapeHtml(order.id)}">Szczegóły</button>
        </footer>
      </article>
    `;
  }

  function bindBoardEvents() {
    root.querySelectorAll(".planning-card").forEach(card => {
      card.addEventListener("dragstart", event => {
        card.classList.add("is-dragging");
        event.dataTransfer.setData("text/plain", card.dataset.id);
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
      });
    });

    root.querySelectorAll(".planning-column-body").forEach(column => {
      column.addEventListener("dragover", event => {
        event.preventDefault();
        column.classList.add("is-drag-over");
      });

      column.addEventListener("dragleave", () => {
        column.classList.remove("is-drag-over");
      });

      column.addEventListener("drop", event => {
        event.preventDefault();
        column.classList.remove("is-drag-over");

        const id = event.dataTransfer.getData("text/plain");
        const order = orders.find(item => item.id === id);
        if (!order) return;

        const target = mapPlanningStatus(
          column.dataset.status
        );

        try {
          getStore().updateStatus(
            id,
            target.status,
            {
              processStep: target.processStep,
              module: "planning"
            }
          );

          if (
            ["suspended", "dropped"].includes(order.systemStatus) &&
            ["draft", "planned"].includes(target.status)
          ) {
            getStore().updateOrder(
              id,
              {
                production: {
                  status: "not_started",
                  actualStart: "",
                  actualEnd: ""
                },
                metadata: {
                  productionRuntime: {
                    status: "waiting"
                  }
                }
              },
              { addHistory: false, module: "planning" }
            );
          }

          refreshOrders();
          renderAll();
        } catch (error) {
          console.error(
            "[ProdFlow Planning] Nie udało się zmienić statusu:",
            error
          );
          alert("Nie udało się zmienić statusu zlecenia.");
          refreshOrders();
          renderAll();
        }
      });
    });

    root.querySelectorAll("[data-details]").forEach(button => {
      button.addEventListener("click", () => openDetails(button.dataset.details));
    });
  }

  function renderTimeline() {
    const visible = filteredOrders();
    const machines = [...new Set(visible.map(order => order.machine || "Nieprzydzielone"))].sort();
    const days = Array.from({ length: 5 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + index);
      return date;
    });

    const head = `
      <div class="planning-timeline-row is-head">
        <div class="planning-timeline-cell">Maszyna</div>
        ${days.map(date => `
          <div class="planning-timeline-cell">
            ${new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date)}
          </div>
        `).join("")}
      </div>
    `;

    const rows = machines.map(machine => {
      const machineOrders = visible.filter(order => (order.machine || "Nieprzydzielone") === machine);
      const total = machineOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);

      return `
        <div class="planning-timeline-row">
          <div class="planning-timeline-cell planning-machine-cell">
            <strong>${escapeHtml(machine)}</strong>
            <span>${formatNumber(total)} szt.</span>
          </div>

          ${days.map(date => {
            const iso = date.toISOString().slice(0, 10);
            const dayOrders = machineOrders.filter(order => order.deadline === iso);

            return `
              <div class="planning-timeline-cell">
                <div class="planning-slot">
                  ${dayOrders.map(order => `
                    <button
                      class="planning-timeline-order ${daysUntil(order.deadline) < 0 ? "is-risk" : ""}"
                      type="button"
                      data-timeline-order="${escapeHtml(order.id)}">
                      ${escapeHtml(order.order)} · ${formatNumber(order.quantity)}
                    </button>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }).join("");

    $("planningTimelineContent").innerHTML =
      `<div class="planning-timeline-table">${head}${rows || '<div class="planning-empty">Brak danych dla aktywnych filtrów.</div>'}</div>`;

    root.querySelectorAll("[data-timeline-order]").forEach(button => {
      button.addEventListener("click", () => openDetails(button.dataset.timelineOrder));
    });
  }

  function productionCardPreviewUrl(id, embedded = true) {
    const url = new URL(
      "modules/production-card/print/print.html",
      document.baseURI
    );
    url.searchParams.set("orderId", id);
    url.searchParams.set("preview", "1");
    if (embedded) url.searchParams.set("embedded", "1");
    return url;
  }

  function maintenanceCardHtml(order) {
    const maintenance = order.maintenance || {};
    const tasks = Array.isArray(maintenance.tasks) ? maintenance.tasks : [];
    const taskRows = tasks.length
      ? tasks.map(task => `<li><span>✓</span>${escapeHtml(task)}</li>`).join("")
      : "<li><span>○</span>Zakres czynności do ustalenia</li>";
    const scheduled = [
      formatDate(maintenance.scheduledDate || order.deadline),
      maintenance.scheduledTime || ""
    ].filter(Boolean).join(" · ");

    return `<!doctype html>
      <html lang="pl"><head><meta charset="utf-8"><title>${escapeHtml(order.order)} — konserwacja</title>
      <style>
        @page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{min-height:100%;margin:0}body{display:grid;place-items:center;padding:24px;background:#e8edf2;color:#172436;font:13px Arial,sans-serif}
        .sheet{width:min(760px,100%);min-height:500px;padding:28px;border-top:7px solid #a56b0b;background:#fff;box-shadow:0 14px 35px rgba(20,35,50,.16)}
        header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:2px solid #172436}.eyebrow{display:block;color:#8a5b0b;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:5px 0 0;font-size:25px}.number{text-align:right}.number strong,.number span{display:block}.number strong{font-size:18px}.number span{margin-top:5px;color:#68778a}
        .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.meta div{padding:10px;border:1px solid #d9e1e7;background:#f8fafb}.meta span,.meta strong{display:block}.meta span{color:#738291;font-size:8px;text-transform:uppercase}.meta strong{margin-top:5px;font-size:13px}
        h2{margin:20px 0 8px;color:#002855;font-size:12px;text-transform:uppercase}ul{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0;padding:0;list-style:none}li{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e3d2ae;background:#fffaf0}li span{display:grid;width:20px;height:20px;place-items:center;border-radius:50%;background:#a56b0b;color:#fff;font-weight:800}.note{min-height:76px;padding:12px;border:1px solid #d9e1e7;white-space:pre-wrap}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:50px}.signature{padding-top:8px;border-top:1px solid #172436;text-align:center;color:#68778a;font-size:10px}
        button{display:block;margin:20px 0 0 auto;padding:10px 16px;border:0;background:#002855;color:#fff;font-weight:700;cursor:pointer}@media print{body{display:block;padding:0;background:#fff}.sheet{width:100%;min-height:0;padding:0;box-shadow:none}button{display:none}}
      </style></head><body><main class="sheet">
        <header><div><span class="eyebrow">Zlecenie utrzymania ruchu</span><h1>${escapeHtml(maintenance.type || order.product)}</h1></div><div class="number"><strong>${escapeHtml(order.order)}</strong><span>${escapeHtml(order.machine || maintenance.machine || "—")}</span></div></header>
        <section class="meta"><div><span>Maszyna</span><strong>${escapeHtml(maintenance.machine || order.machine || "—")}</strong></div><div><span>Termin</span><strong>${escapeHtml(scheduled || "—")}</strong></div><div><span>Planowany czas</span><strong>${formatNumber(maintenance.durationMinutes || 0)} min</strong></div><div><span>Priorytet</span><strong>${escapeHtml(order.priority || "Normalny")}</strong></div></section>
        <h2>Lista czynności</h2><ul>${taskRows}</ul>
        <h2>Zakres i uwagi</h2><div class="note">${escapeHtml(maintenance.note || order.note || "Brak dodatkowych uwag.")}</div>
        <section class="signatures"><div class="signature">Wykonał / data</div><div class="signature">Potwierdził / data</div></section>
        <button type="button" onclick="window.print()">Drukuj / zapisz PDF</button>
      </main></body></html>`;
  }

  function openDetails(id) {
    const order = orders.find(item => item.id === id);
    if (!order) return;

    selectedOrderId = id;
    const isMaintenance = order.orderType === "maintenance";
    $("planningDialogOrder").textContent = order.order;
    $("planningDialogProduct").textContent = `${order.client} · ${order.product}`;
    $("planningDialogKind").textContent = isMaintenance
      ? "Karta konserwacji maszyny"
      : "Karta produkcyjna zlecenia";
    const frame = $("planningProductionCardFrame");
    if (isMaintenance) {
      frame.removeAttribute("src");
      frame.srcdoc = maintenanceCardHtml(order);
    } else {
      frame.removeAttribute("srcdoc");
      frame.src = productionCardPreviewUrl(id).href;
    }
    $("planningOpenCardBtn").textContent = isMaintenance
      ? "Otwórz kartę konserwacji"
      : "Otwórz w nowym oknie";
    const withdrawButton = ensureWithdrawButton();
    if (withdrawButton) withdrawButton.hidden = isMaintenance;
    $("planningDialogNote").value = order.note || "";
    $("planningDetailsDialog").showModal();
  }

  function ensureWithdrawButton() {
    let button =
      $("planningWithdrawBtn");

    if (button) {
      return button;
    }

    const saveButton =
      $("planningDialogSave");

    if (!saveButton) {
      return null;
    }

    button = document.createElement("button");
    button.type = "button";
    button.id = "planningWithdrawBtn";
    button.className = saveButton.className;
    button.textContent = "Wycofaj do szkicu";

    saveButton.insertAdjacentElement(
      "beforebegin",
      button
    );

    return button;
  }

  function withdrawToDraft() {
    const order = orders.find(
      item => item.id === selectedOrderId
    );

    if (!order) {
      return;
    }

    const confirmed = window.confirm(
      `Wycofać zlecenie ${order.order} do szkicu Karty Produkcyjnej?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const store = getStore();

      store.updateStatus(
        order.id,
        "draft",
        {
          processStep: "card",
          module: "planning",
          message:
            `Wycofano zlecenie ${order.order} do szkicu Karty Produkcyjnej.`
        }
      );

      store.updateOrder(
        order.id,
        {
          status: "draft",
          processStep: "card",
          planning: {
            status: "not_planned",
            plannedStart: "",
            plannedEnd: "",
            machineId: "",
            machineName: "",
            operatorId: "",
            operatorName: "",
            workCenter: "",
            queuePosition: null,
            estimatedMinutes: 0
          }
        },
        {
          module: "planning",
          historyMessage:
            `Usunięto przydział planistyczny zlecenia ${order.order}.`
        }
      );

      selectedOrderId = null;
      refreshOrders();
      $("planningDetailsDialog").close();
      renderAll();
    } catch (error) {
      console.error(
        "[ProdFlow Planning] Nie udało się wycofać zlecenia:",
        error
      );
      alert("Nie udało się wycofać zlecenia do szkicu.");
    }
  }

  function renderAll() {
    renderMachineFilter();
    renderStats();
    renderAlerts();
    renderBoard();
    renderTimeline();
  }

  function switchView(view) {
    currentView = view;

    root.querySelectorAll("[data-view]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });

    $("planningBoard").hidden = view !== "board";
    $("planningTimeline").hidden = view !== "timeline";
  }

  function createOrder() {
    const orderNumber = $("planningNewOrder").value.trim();
    const client = $("planningNewClient").value.trim();
    const product = $("planningNewProduct").value.trim();
    const deadline = $("planningNewDeadline").value;

    if (!orderNumber || !client || !product || !deadline) {
      alert("Uzupełnij numer zlecenia, klienta, produkt i termin.");
      return;
    }

    const quantity = Number(
      $("planningNewQuantity").value || 0
    );
    const machine =
      $("planningNewMachine").value.trim();
    const priority =
      $("planningNewPriority").value;
    const material =
      $("planningNewMaterial").value;

    try {
      getStore().saveOrder(
        {
          id: `ord-${Date.now()}`,
          status: "draft",
          processStep: "planning",
          order: {
            externalNumber: orderNumber,
            priority: mapPriorityToStore(priority),
            quantity,
            dueDate: deadline
          },
          customer: {
            name: client
          },
          product: {
            code:
              $("planningNewIndex").value.trim(),
            name: product,
            quantity
          },
          planning: {
            status: "not_planned",
            machineId: machine,
            machineName: machine,
            notes: ""
          },
          metadata: {
            source: "planning",
            planning: {
              materialAvailability: material,
              progress: 0
            }
          }
        },
        {
          module: "planning",
          historyMessage:
            `Utworzono zlecenie ${orderNumber} w module Planning.`
        }
      );

      refreshOrders();
      $("planningAddDialog").close();
      clearAddForm();
      renderAll();
      switchView("board");
    } catch (error) {
      console.error(
        "[ProdFlow Planning] Nie udało się utworzyć zlecenia:",
        error
      );
      alert("Nie udało się utworzyć zlecenia.");
    }
  }

  function clearAddForm() {
    [
      "planningNewOrder",
      "planningNewClient",
      "planningNewProduct",
      "planningNewIndex",
      "planningNewQuantity",
      "planningNewMachine"
    ].forEach(id => {
      $(id).value = "";
    });

    $("planningNewDeadline").value = offsetDate(3);
    $("planningNewPriority").value = "Normalny";
    $("planningNewMaterial").value = "Dostępny";
  }

  function maintenanceOrderNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const sequence = String(Date.now()).slice(-6);
    return `KON/${year}/${sequence}`;
  }

  function fillMaintenanceMachines() {
    const machines = [...new Set(
      orders.map(order => order.machine).filter(Boolean)
    )].sort();

    $("planningMaintenanceMachines").innerHTML = machines
      .map(machine => `<option value="${escapeHtml(machine)}"></option>`)
      .join("");
  }

  function clearMaintenanceForm() {
    $("planningMaintenanceMachine").value = "";
    $("planningMaintenanceType").value = "Czyszczenie standardowe";
    $("planningMaintenanceDate").value = offsetDate(0);
    $("planningMaintenanceTime").value = "06:00";
    $("planningMaintenanceDuration").value = "60";
    $("planningMaintenancePriority").value = "Normalny";
    $("planningMaintenanceNote").value = "";
    root.querySelectorAll('[name="maintenanceTask"]').forEach(input => {
      input.checked = true;
    });
    fillMaintenanceMachines();
  }

  function createMaintenanceOrder() {
    const machine = $("planningMaintenanceMachine").value.trim();
    const type = $("planningMaintenanceType").value;
    const date = $("planningMaintenanceDate").value;
    const time = $("planningMaintenanceTime").value || "06:00";
    const durationMinutes = Math.max(
      15,
      Number($("planningMaintenanceDuration").value) || 60
    );
    const note = $("planningMaintenanceNote").value.trim();
    const priority = $("planningMaintenancePriority").value;
    const tasks = Array.from(
      root.querySelectorAll('[name="maintenanceTask"]:checked')
    ).map(input => input.value);

    if (!machine || !type || !date) {
      alert("Uzupełnij maszynę, rodzaj konserwacji i datę.");
      return;
    }

    const number = maintenanceOrderNumber();

    try {
      getStore().saveOrder(
        {
          id: `maintenance-${Date.now()}`,
          status: "planned",
          processStep: "planning",
          order: {
            externalNumber: number,
            priority: mapPriorityToStore(priority),
            quantity: 1,
            dueDate: date,
            notes: note
          },
          customer: {
            name: "Utrzymanie ruchu"
          },
          product: {
            code: "KONSERWACJA",
            name: `${type} — ${machine}`,
            quantity: 1,
            description: note
          },
          planning: {
            status: "planned",
            machineId: machine,
            machineName: machine,
            plannedStart: `${date}T${time}`,
            estimatedMinutes: durationMinutes,
            notes: note
          },
          metadata: {
            source: "planning",
            orderType: "maintenance",
            maintenance: {
              type,
              machine,
              scheduledDate: date,
              scheduledTime: time,
              durationMinutes,
              tasks,
              note,
              status: "planned"
            },
            planning: {
              materialAvailability: "Dostępny",
              progress: 0
            }
          }
        },
        {
          module: "planning",
          historyMessage: `Zaplanowano konserwację maszyny ${machine}: ${type}.`
        }
      );

      refreshOrders();
      $("planningMaintenanceDialog").close();
      renderAll();
      switchView("board");
    } catch (error) {
      console.error("[ProdFlow Planning] Nie udało się utworzyć konserwacji:", error);
      alert("Nie udało się utworzyć zlecenia konserwacji.");
    }
  }

  root.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  [
    "planningSearch",
    "planningMachineFilter",
    "planningPriorityFilter",
    "planningMaterialFilter"
  ].forEach(id => {
    $(id).addEventListener("input", renderAll);
    $(id).addEventListener("change", renderAll);
  });

  $("planningSaveBtn").addEventListener("click", () => {
    refreshOrders();
    renderAll();
    const button = $("planningSaveBtn");
    const oldText = button.textContent;
    button.textContent = "Plan zapisany";
    setTimeout(() => {
      button.textContent = oldText;
    }, 1200);
  });

  $("planningAddBtn").addEventListener("click", () => {
    clearAddForm();
    $("planningAddDialog").showModal();
  });

  $("planningCreateOrderBtn").addEventListener("click", createOrder);

  $("planningMaintenanceBtn").addEventListener("click", () => {
    clearMaintenanceForm();
    $("planningMaintenanceDialog").showModal();
  });

  $("planningCreateMaintenanceBtn").addEventListener("click", createMaintenanceOrder);

  $("planningOpenCardBtn").addEventListener("click", () => {
    if (!selectedOrderId) return;
    const order = orders.find(item => item.id === selectedOrderId);
    if (order?.orderType === "maintenance") {
      const cardWindow = window.open("", "_blank", "width=900,height=760");
      if (!cardWindow) {
        alert("Przeglądarka zablokowała otwarcie Karty Konserwacji.");
        return;
      }
      cardWindow.document.open();
      cardWindow.document.write(maintenanceCardHtml(order));
      cardWindow.document.close();
      cardWindow.opener = null;
      return;
    }
    const cardWindow = window.open(
      productionCardPreviewUrl(selectedOrderId, false).href,
      "_blank"
    );
    if (!cardWindow) {
      alert("Przeglądarka zablokowała otwarcie Karty Produkcyjnej.");
    } else {
      cardWindow.opener = null;
    }
  });

  $("planningDetailsDialog").addEventListener("close", () => {
    const frame = $("planningProductionCardFrame");
    frame.removeAttribute("srcdoc");
    frame.src = "about:blank";
  });

  ensureWithdrawButton()?.addEventListener(
    "click",
    withdrawToDraft
  );

  [
    "store:order-created",
    "store:order-updated",
    "store:order-status-changed",
    "store:order-deleted",
    "store:database-changed",
    "store:database-imported",
    "store:database-cleared"
  ].forEach(name => window.ProdFlow?.events?.on(name, () => {
    if (!document.contains(root)) return;
    refreshOrders();
    renderAll();
  }));

  $("planningDialogSave").addEventListener("click", () => {
    const order = orders.find(item => item.id === selectedOrderId);
    if (!order) return;

    const note =
      $("planningDialogNote").value.trim();

    try {
      getStore().updateOrder(
        order.id,
        {
          planning: {
            notes: note
          }
        },
        {
          module: "planning",
          historyMessage:
            `Zaktualizowano notatkę planistyczną dla ${order.order}.`
        }
      );

      refreshOrders();
      $("planningDetailsDialog").close();
      renderAll();
    } catch (error) {
      console.error(
        "[ProdFlow Planning] Nie udało się zapisać notatki:",
        error
      );
      alert("Nie udało się zapisać notatki.");
    }
  });

  clearAddForm();
  clearMaintenanceForm();
  refreshOrders();
  renderAll();
  switchView(currentView);
}

initPlanning();
