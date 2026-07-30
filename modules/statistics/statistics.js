function initStatistics() {
  const root = document.getElementById("statisticsModule");
  if (!root) return;

  const $ = id => document.getElementById(id);

  let currentData = emptyData();

  function getStore() {
    const store = window.ProdFlow?.store;
    if (!store) throw new Error("ProdFlow.store nie jest dostępny.");
    return store;
  }

  function emptyData() {
    return {
      machines: [],
      clients: [],
      complaints: [],
      delivery: { onTime: 0, delayed: 0, critical: 0 },
      trend: {
        labels: ["—", "—", "—", "—", "—", "—", "—"],
        production: [0, 0, 0, 0, 0, 0, 0],
        plan: [0, 0, 0, 0, 0, 0, 0]
      }
    };
  }

  function percent(part, total) {
    return total > 0 ? Math.round(part / total * 100) : 0;
  }

  function loadStoreData() {
    const store = getStore();
    const periodDays =
      Number($("statisticsPeriod")?.value) || 30;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - periodDays + 1);
    const orders = store
      .getOrders({ archived: false })
      .filter(order => {
        const value =
          order.updatedAt ||
          order.createdAt ||
          order.order?.dueDate;
        if (!value) return true;
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) &&
          date >= cutoff;
      });
    const complaints = store.getComplaints();
    const machineMap = new Map();
    const clientMap = new Map();

    orders.forEach(order => {
      const production = order.production || {};
      const machine =
        production.machineName ||
        production.machineId ||
        order.planning?.machineName ||
        order.planning?.machineId ||
        "Nieprzydzielona";
      const good = Number(production.goodQuantity) || 0;
      const rejected = Number(production.rejectedQuantity) || 0;
      const produced = Number(production.producedQuantity) || good + rejected;
      const plannedMinutes = Number(order.planning?.estimatedMinutes) || 0;
      const elapsedSeconds = Number(order.metadata?.productionRuntime?.elapsedSeconds) || 0;
      const due = order.order?.dueDate ? new Date(`${order.order.dueDate}T23:59:59`) : null;
      const completed = order.completedAt ? new Date(order.completedAt) : null;
      const onTime = !due || !completed || completed <= due;
      const current = machineMap.get(machine) || {
        name: machine, volume: 0, produced: 0, rejected: 0,
        plannedMinutes: 0, elapsedMinutes: 0, completed: 0, onTime: 0
      };
      current.volume += good;
      current.produced += produced;
      current.rejected += rejected;
      current.plannedMinutes += plannedMinutes;
      current.elapsedMinutes += elapsedSeconds / 60;
      if (completed) {
        current.completed += 1;
        if (onTime) current.onTime += 1;
      }
      machineMap.set(machine, current);

      const client = order.customer?.name || "Nieprzypisany";
      const clientData = clientMap.get(client) || { name: client, volume: 0, orders: 0 };
      clientData.volume += good;
      clientData.orders += 1;
      clientMap.set(client, clientData);
    });

    const machines = [...machineMap.values()].map(item => {
      const utilization = item.plannedMinutes > 0
        ? Math.min(100, Math.round(item.elapsedMinutes / item.plannedMinutes * 100))
        : item.produced > 0 ? 100 : 0;
      const onTime = percent(item.onTime, item.completed);
      const waste = item.produced > 0 ? Number((item.rejected / item.produced * 100).toFixed(1)) : 0;
      const score = Math.max(0, Math.round(utilization * .4 + onTime * .4 + (100 - waste) * .2));
      return { name: item.name, utilization, volume: item.volume, onTime, waste, score };
    }).sort((a, b) => b.volume - a.volume);

    const categoryCounts = new Map();
    complaints.forEach(item => {
      const name = item.category || "Inne";
      categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1);
    });
    const complaintTotal = complaints.length;
    const complaintData = [...categoryCounts.entries()]
      .map(([name, count]) => ({ name, value: percent(count, complaintTotal) }))
      .sort((a, b) => b.value - a.value);

    const completedOrders = orders.filter(order => order.completedAt);
    const delayedCount = completedOrders.filter(order =>
      order.order?.dueDate &&
      new Date(order.completedAt) > new Date(`${order.order.dueDate}T23:59:59`)
    ).length;
    const criticalCount = orders.filter(order =>
      ["critical", "Krytyczny"].includes(order.order?.priority) &&
      order.status !== "completed"
    ).length;
    const deliveryTotal = Math.max(1, completedOrders.length + criticalCount);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const trend = {
      labels: days.map(date => String(date.getDate())),
      production: days.map(date => {
        const key = date.toISOString().slice(0, 10);
        return Math.round(orders
          .filter(order => String(order.production?.actualEnd || order.completedAt || "").slice(0, 10) === key)
          .reduce((sum, order) => sum + (Number(order.production?.goodQuantity) || 0), 0) / 1000);
      }),
      plan: days.map(date => {
        const key = date.toISOString().slice(0, 10);
        return Math.round(orders
          .filter(order => order.order?.dueDate === key)
          .reduce((sum, order) => sum + (Number(order.order?.quantity) || 0), 0) / 1000);
      })
    };

    currentData = {
      machines,
      clients: [...clientMap.values()].sort((a, b) => b.volume - a.volume),
      complaints: complaintData,
      delivery: {
        onTime: percent(completedOrders.length - delayedCount, deliveryTotal),
        delayed: percent(delayedCount, deliveryTotal),
        critical: percent(criticalCount, deliveryTotal)
      },
      trend
    };
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pl-PL").format(Math.round(Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fillFilters() {
    $("statisticsMachine").innerHTML =
      '<option value="">Wszystkie maszyny</option>' +
      currentData.machines.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("");

    $("statisticsClient").innerHTML =
      '<option value="">Wszyscy klienci</option>' +
      currentData.clients.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("");
  }

  function filteredMachines() {
    const selected = $("statisticsMachine").value;
    return selected
      ? currentData.machines.filter(item => item.name === selected)
      : currentData.machines;
  }

  function filteredClients() {
    const selected = $("statisticsClient").value;
    return selected
      ? currentData.clients.filter(item => item.name === selected)
      : currentData.clients;
  }

  function renderSummary() {
    const machines = filteredMachines();
    const clients = filteredClients();

    const volume = machines.reduce((sum, item) => sum + item.volume, 0);
    const utilization = machines.length
      ? machines.reduce((sum, item) => sum + item.utilization, 0) / machines.length
      : 0;
    const onTime = machines.length
      ? machines.reduce((sum, item) => sum + item.onTime, 0) / machines.length
      : 0;
    const waste = machines.length
      ? machines.reduce((sum, item) => sum + item.waste, 0) / machines.length
      : 0;
    const orders = clients.reduce((sum, item) => sum + item.orders, 0);

    const cards = [
      ["Wolumen produkcji", `${formatNumber(volume)} szt.`],
      ["Średnie wykorzystanie", `${utilization.toFixed(1)}%`],
      ["Terminowość", `${onTime.toFixed(1)}%`],
      ["Średni poziom odpadów", `${waste.toFixed(1)}%`],
      ["Zrealizowane zlecenia", formatNumber(orders)]
    ];

    $("statisticsSummary").innerHTML = cards.map(([label, value]) => `
      <article class="statistics-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <small class="statistics-change">Dane z wybranego okresu</small>
      </article>
    `).join("");
  }

  function renderBars() {
    const machines = filteredMachines();
    const maxUtil = Math.max(...machines.map(item => item.utilization), 1);

    $("statisticsMachineBars").innerHTML = machines.length
      ? machines.map(item => `
      <div class="statistics-bar-item">
        <div class="statistics-bar-head">
          <span>${escapeHtml(item.name)}</span>
          <strong>${item.utilization}%</strong>
        </div>
        <div class="statistics-bar-track">
          <i style="width:${(item.utilization / maxUtil) * 100}%"></i>
        </div>
      </div>
    `).join("")
      : '<p class="statistics-empty">Brak danych o maszynach do wyświetlenia.</p>';

    const maxComplaint = Math.max(...currentData.complaints.map(item => item.value), 1);

    $("statisticsComplaintBars").innerHTML = currentData.complaints.length
      ? currentData.complaints.map(item => `
      <div class="statistics-bar-item">
        <div class="statistics-bar-head">
          <span>${escapeHtml(item.name)}</span>
          <strong>${item.value}%</strong>
        </div>
        <div class="statistics-bar-track">
          <i style="width:${(item.value / maxComplaint) * 100}%"></i>
        </div>
      </div>
    `).join("")
      : '<p class="statistics-empty">Brak reklamacji do wyświetlenia.</p>';
  }

  function renderClients() {
    const clients = filteredClients();

    $("statisticsClientList").innerHTML = clients.length
      ? clients.map((item, index) => `
      <div class="statistics-rank-item">
        <span class="statistics-rank-number">${index + 1}</span>
        <div>
          <span>${escapeHtml(item.name)}</span>
          <small>${item.orders} zleceń</small>
        </div>
        <strong>${formatNumber(item.volume)} szt.</strong>
      </div>
    `).join("")
      : '<p class="statistics-empty">Brak klientów do wyświetlenia.</p>';
  }

  function renderMachineTable() {
    const machines = filteredMachines();

    $("statisticsMachineTable").innerHTML = machines.length
      ? machines.map(item => {
      const scoreClass = item.score >= 88
        ? ""
        : item.score >= 80
          ? "is-warning"
          : "is-danger";

      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${formatNumber(item.volume)} szt.</td>
          <td>${item.utilization}%</td>
          <td>${item.onTime}%</td>
          <td>${item.waste}%</td>
          <td><span class="statistics-score ${scoreClass}">${item.score}/100</span></td>
        </tr>
      `;
    }).join("")
      : '<tr><td colspan="6">Brak danych o maszynach do wyświetlenia.</td></tr>';
  }

  function renderInsights() {
    const machines = filteredMachines();
    const worst = [...machines].sort((a, b) => a.score - b.score)[0];
    const best = [...machines].sort((a, b) => b.score - a.score)[0];
    const materialRisk =
      currentData.complaints.find(item =>
        item.name.toLowerCase().includes("klej")
      );

    const insights = machines.length ? [
      {
        type: worst && worst.score < 80 ? "is-danger" : "is-warning",
        icon: "!",
        title: worst ? `${worst.name} wymaga analizy` : "Brak danych",
        text: worst
          ? `Ocena ${worst.score}/100. Największe odchylenie dotyczy terminowości i poziomu odpadów.`
          : "Brak danych dla aktywnych filtrów."
      },
      {
        type: "",
        icon: "✓",
        title: best ? `${best.name} osiąga najlepszy wynik` : "Brak danych",
        text: best
          ? `Wykorzystanie ${best.utilization}% i terminowość ${best.onTime}%.`
          : "Brak danych dla aktywnych filtrów."
      }
    ] : [];

    if (materialRisk) {
      insights.push({
        type: "is-warning",
        icon: "%",
        title: "Problemy z klejem",
        text: `${materialRisk.value}% reklamacji jest związanych z klejem.`
      });
    }

    $("statisticsInsights").innerHTML = insights.length
      ? insights.map(item => `
      <article class="statistics-insight ${item.type}">
        <span class="statistics-insight-icon">${item.icon}</span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
        </div>
      </article>
    `).join("")
      : '<p class="statistics-empty">Brak danych do analizy.</p>';
  }

  function canvasSize(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width: rect.width, height: rect.height };
  }

  function drawProductionChart() {
    const canvas = $("statisticsProductionChart");
    const { ctx, width, height } = canvasSize(canvas);
    const data = currentData.trend;
    const padding = { top: 18, right: 18, bottom: 32, left: 42 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const max = Math.max(1, ...data.production, ...data.plan) * 1.12;

    ctx.clearRect(0, 0, width, height);
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      const value = Math.round(max - (max / 4) * i);

      ctx.strokeStyle = "#e7edf1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = "#7a8791";
      ctx.fillText(`${value}k`, padding.left - 8, y);
    }

    ctx.textAlign = "center";
    data.labels.forEach((label, index) => {
      const x = padding.left + (chartWidth / (data.labels.length - 1)) * index;
      ctx.fillStyle = "#7a8791";
      ctx.fillText(label, x, height - 12);
    });

    function drawLine(values, stroke, fill, dashed = false) {
      const points = values.map((value, index) => ({
        x: padding.left + (chartWidth / (values.length - 1)) * index,
        y: padding.top + chartHeight - (value / max) * chartHeight
      }));

      if (fill) {
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, "rgba(0,40,85,.18)");
        gradient.addColorStop(1, "rgba(0,40,85,0)");

        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartHeight);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });

      ctx.strokeStyle = stroke;
      ctx.lineWidth = dashed ? 1.5 : 2.4;
      ctx.setLineDash(dashed ? [5, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!dashed) {
        points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#002855";
          ctx.fill();
        });
      }
    }

    drawLine(data.plan, "#aebdca", false, true);
    drawLine(data.production, "#002855", true, false);
  }

  function drawDeliveryChart() {
    const canvas = $("statisticsDeliveryChart");
    const { ctx, width, height } = canvasSize(canvas);
    const values = [
      currentData.delivery.onTime,
      currentData.delivery.delayed,
      currentData.delivery.critical
    ];
    const colors = ["#1c7a4d", "#c18a2b", "#b83b3b"];
    const total = Math.max(1, values.reduce((sum, value) => sum + value, 0));
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * .37;
    const lineWidth = Math.min(width, height) * .12;
    let start = -Math.PI / 2;

    ctx.clearRect(0, 0, width, height);

    values.forEach((value, index) => {
      const angle = (value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, start, start + angle);
      ctx.strokeStyle = colors[index];
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "butt";
      ctx.stroke();
      start += angle;
    });

    $("statisticsOnTimePercent").textContent = `${currentData.delivery.onTime}%`;

    const labels = [
      ["Na czas", currentData.delivery.onTime, colors[0]],
      ["Opóźnione", currentData.delivery.delayed, colors[1]],
      ["Krytyczne", currentData.delivery.critical, colors[2]]
    ];

    $("statisticsDeliveryLegend").innerHTML = labels.map(([label, value, color]) => `
      <div>
        <span><i class="statistics-dot" style="background:${color}"></i>${label}</span>
        <b>${value}%</b>
      </div>
    `).join("");
  }

  function renderAll() {
    renderSummary();
    renderBars();
    renderClients();
    renderMachineTable();
    renderInsights();

    requestAnimationFrame(() => {
      drawProductionChart();
      drawDeliveryChart();
    });
  }

  function exportCsv() {
    const rows = [
      ["Maszyna", "Wolumen", "Wykorzystanie", "Terminowość", "Odpady", "Ocena"],
      ...filteredMachines().map(item => [
        item.name,
        item.volume,
        item.utilization,
        item.onTime,
        item.waste,
        item.score
      ])
    ];

    const csv = rows
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "prodflow-statystyka.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    $("statisticsPeriod").value = "30";
    $("statisticsMachine").value = "";
    $("statisticsClient").value = "";
    $("statisticsStatus").value = "";
    renderAll();
  }

  $("statisticsPeriod").addEventListener("change", () => {
    loadStoreData();
    fillFilters();
    renderAll();
  });

  [
    "statisticsMachine",
    "statisticsClient",
    "statisticsStatus"
  ].forEach(id => {
    $(id).addEventListener("change", renderAll);
  });

  $("statisticsClearFilters").addEventListener("click", clearFilters);
  $("statisticsExportBtn").addEventListener("click", exportCsv);

  $("statisticsRefreshBtn").addEventListener("click", () => {
    loadStoreData();
    fillFilters();
    renderAll();
    $("statisticsDialog").showModal();
  });

  $("statisticsDialogClose").addEventListener("click", () => {
    $("statisticsDialog").close();
  });

  let resizeTimer;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawProductionChart();
      drawDeliveryChart();
    }, 120);
  });

  [
    "store:order-created",
    "store:order-updated",
    "store:order-status-changed",
    "store:order-deleted",
    "store:database-changed",
    "store:database-imported",
    "store:database-cleared",
    "store:complaint-added"
  ].forEach(name => window.ProdFlow?.events?.on(name, () => {
    if (!document.contains(root)) return;
    loadStoreData();
    fillFilters();
    renderAll();
  }));

  loadStoreData();
  fillFilters();
  renderAll();
}

initStatistics();
