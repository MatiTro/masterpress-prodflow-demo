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
      .filter(order => order.metadata?.orderType !== "maintenance")
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
      ["Zlecenia w okresie", formatNumber(orders)]
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
    if (!canvas || !document.contains(root)) return;
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
    if (!canvas || !document.contains(root)) return;
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
      if (!document.contains(root)) return;
      drawProductionChart();
      drawDeliveryChart();
    });
  }

  function statisticsReportHtml() {
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
    const orderCount = clients.reduce((sum, item) => sum + item.orders, 0);
    const generatedAt = new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
    const period = $("statisticsPeriod").selectedOptions[0]?.textContent || "Wybrany okres";
    const machineFilter = $("statisticsMachine").selectedOptions[0]?.textContent || "Wszystkie maszyny";
    const clientFilter = $("statisticsClient").selectedOptions[0]?.textContent || "Wszyscy klienci";
    const best = [...machines].sort((a, b) => b.score - a.score)[0];
    const attention = [...machines].sort((a, b) => a.score - b.score)[0];
    const machineRows = machines.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(formatNumber(item.volume))} szt.</td>
        <td>${item.utilization}%</td>
        <td>${item.onTime}%</td>
        <td>${item.waste}%</td>
        <td><strong>${item.score}/100</strong></td>
      </tr>`).join("");
    const clientRows = clients.slice(0, 12).map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(formatNumber(item.orders))}</td>
        <td>${escapeHtml(formatNumber(item.volume))} szt.</td>
      </tr>`).join("");
    const complaintRows = currentData.complaints.map(item => `
      <tr><td>${escapeHtml(item.name)}</td><td><strong>${item.value}%</strong></td></tr>`).join("");

    return `<!doctype html>
      <html lang="pl">
      <head>
        <meta charset="utf-8">
        <title>ProdFlow — raport statystyczny</title>
        <style>
          @page{size:A4;margin:12mm 11mm 14mm}
          *{box-sizing:border-box}
          body{margin:0;color:#172436;background:#fff;font:10px Arial,sans-serif}
          header{display:flex;justify-content:space-between;gap:20px;padding:0 0 13px;border-bottom:3px solid #002855}
          .brand{display:flex;align-items:center;gap:10px}.mark{display:grid;width:38px;height:38px;place-items:center;background:#002855;color:#fff;font-weight:900}
          h1{margin:0;font-size:21px;letter-spacing:-.02em}.subtitle{margin:3px 0 0;color:#657486}
          .report-meta{text-align:right}.report-meta strong,.report-meta span{display:block}.report-meta span{margin-top:3px;color:#657486}
          .filters{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:11px 0}.filters div{padding:7px 8px;border:1px solid #d7e0e7;background:#f8fafb}.filters span,.filters strong{display:block}.filters span{margin-bottom:3px;color:#758393;font-size:7px;font-weight:700;text-transform:uppercase}
          .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:0 0 13px}.kpi{padding:9px 8px;border-left:4px solid #1f5f9f;background:#edf3f8}.kpi span,.kpi strong{display:block}.kpi span{color:#66778a;font-size:7px;font-weight:700;text-transform:uppercase}.kpi strong{margin-top:4px;font-size:15px}
          h2{margin:15px 0 6px;color:#002855;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
          table{width:100%;border-collapse:collapse;break-inside:avoid}th,td{padding:6px;border:1px solid #cbd6df;text-align:left;vertical-align:top}th{background:#eaf0f5;font-size:7px;text-transform:uppercase}
          .columns{display:grid;grid-template-columns:1.45fr .8fr;gap:10px;align-items:start;margin-top:2px}.columns table{break-inside:auto}
          .delivery{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 8px}.delivery div{padding:8px;text-align:center;background:#f2f5f7}.delivery strong,.delivery span{display:block}.delivery strong{font-size:15px}.delivery span{margin-top:2px;color:#6d7b89;font-size:7px;text-transform:uppercase}
          .insights{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;break-inside:avoid}.insight{padding:9px;border:1px solid #d7e0e7;background:#fbfcfd}.insight strong{display:block;margin-bottom:3px;color:#002855}.insight p{margin:0;color:#5d6e7f;line-height:1.4}
          .notice{margin-top:10px;padding:8px;border-left:4px solid #c18a2b;background:#fff8e9;color:#674c1e;break-inside:avoid}
          footer{display:flex;justify-content:space-between;margin-top:12px;padding-top:6px;border-top:1px solid #d7e0e7;color:#8c99a5;font-size:7px}
          .empty{padding:16px;text-align:center;color:#748392;font-style:italic}
        </style>
      </head>
      <body>
        <header>
          <div class="brand"><div class="mark">MP</div><div><h1>Raport statystyczny ProdFlow</h1><p class="subtitle">Produkcja, terminowość, jakość i wykorzystanie maszyn</p></div></div>
          <div class="report-meta"><strong>Masterpress S.A.</strong><span>Wygenerowano: ${escapeHtml(generatedAt)}</span></div>
        </header>
        <section class="filters">
          <div><span>Zakres</span><strong>${escapeHtml(period)}</strong></div>
          <div><span>Maszyna</span><strong>${escapeHtml(machineFilter)}</strong></div>
          <div><span>Klient</span><strong>${escapeHtml(clientFilter)}</strong></div>
        </section>
        <section class="kpis">
          <div class="kpi"><span>Wolumen</span><strong>${escapeHtml(formatNumber(volume))}</strong></div>
          <div class="kpi"><span>Wykorzystanie</span><strong>${utilization.toFixed(1)}%</strong></div>
          <div class="kpi"><span>Terminowość</span><strong>${onTime.toFixed(1)}%</strong></div>
          <div class="kpi"><span>Odpady</span><strong>${waste.toFixed(1)}%</strong></div>
          <div class="kpi"><span>Zlecenia</span><strong>${escapeHtml(formatNumber(orderCount))}</strong></div>
        </section>
        <h2>Wynik według maszyn</h2>
        <table>
          <thead><tr><th>Maszyna</th><th>Wolumen</th><th>Wykorzystanie</th><th>Terminowość</th><th>Odpady</th><th>Ocena</th></tr></thead>
          <tbody>${machineRows || '<tr><td class="empty" colspan="6">Brak danych o maszynach dla wybranych filtrów.</td></tr>'}</tbody>
        </table>
        <div class="columns">
          <section><h2>Klienci według wolumenu</h2><table><thead><tr><th>Lp.</th><th>Klient</th><th>Zlecenia</th><th>Wolumen</th></tr></thead><tbody>${clientRows || '<tr><td class="empty" colspan="4">Brak danych o klientach.</td></tr>'}</tbody></table></section>
          <section><h2>Terminowość</h2><div class="delivery"><div><strong>${currentData.delivery.onTime}%</strong><span>na czas</span></div><div><strong>${currentData.delivery.delayed}%</strong><span>opóźnione</span></div><div><strong>${currentData.delivery.critical}%</strong><span>krytyczne</span></div></div><h2>Reklamacje</h2><table><thead><tr><th>Przyczyna</th><th>Udział</th></tr></thead><tbody>${complaintRows || '<tr><td class="empty" colspan="2">Brak reklamacji.</td></tr>'}</tbody></table></section>
        </div>
        <section class="insights">
          <div class="insight"><strong>Najlepszy wynik</strong><p>${best ? `${escapeHtml(best.name)} — ocena ${best.score}/100, wykorzystanie ${best.utilization}%.` : "Brak danych do porównania."}</p></div>
          <div class="insight"><strong>Obszar do sprawdzenia</strong><p>${attention ? `${escapeHtml(attention.name)} — ocena ${attention.score}/100, odpady ${attention.waste}%.` : "Brak danych do porównania."}</p></div>
        </section>
        <div class="notice"><strong>OEE:</strong> wskaźnik nie jest jeszcze liczony w tym raporcie. Definicję źródeł czasu, dostępności, wydajności i jakości trzeba zatwierdzić z biznesem.</div>
        <footer><span>ProdFlow · raport operacyjny</span><span>${escapeHtml(generatedAt)}</span></footer>
      </body></html>`;
  }

  function exportPdf() {
    const html = statisticsReportHtml();
    window.ProdFlow = window.ProdFlow || {};
    window.ProdFlow.lastStatisticsReportHtml = html;
    const reportWindow = window.open("", "_blank", "width=1000,height=780");
    if (!reportWindow) {
      window.alert("Przeglądarka zablokowała raport. Zezwól na wyskakujące okna i spróbuj ponownie.");
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 300);
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
  $("statisticsExportBtn").addEventListener("click", exportPdf);

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

  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      drawProductionChart();
      drawDeliveryChart();
    }, 120);
  };

  window.addEventListener("resize", handleResize);
  window.addEventListener("prodflow:module-unload", () => {
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", handleResize);
  }, { once: true });

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
