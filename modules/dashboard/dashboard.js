(() => {
    let alertTarget = "production";
    let toastTimer = null;

    function $(selector) {
        return document.querySelector(`.pf-dashboard ${selector}`);
    }

    function getStore() {
        const store = window.ProdFlow?.store;
        if (!store) throw new Error("ProdFlow.store nie jest dostępny.");
        return store;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function statusLabel(status) {
        return {
            running: "Produkcja",
            in_production: "Produkcja",
            waiting: "Oczekuje",
            planned: "Zaplanowane",
            paused: "Pauza",
            issue: "Problem",
            completed: "Zakończone",
            new: "Nowe",
            accepted: "Przyjęte",
            picking: "Kompletacja",
            transit: "W drodze",
            delivered: "Dostarczone",
            ready: "Gotowe",
            loading: "Załadunek",
            shipped: "Wysłane"
        }[status] || status;
    }

    function priorityLabel(priority) {
        return { critical: "Krytyczny", high: "Wysoki", normal: "Normalny", low: "Niski" }[priority] || priority;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("pl-PL").format(Number(value) || 0);
    }

    function formatDate(value) {
        if (!value) return "—";
        return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" })
            .format(new Date(`${value}T12:00:00`));
    }

    function todayIso() {
        return new Date().toISOString().slice(0, 10);
    }

    function renderClock() {
        const clock = $("#dashboardClock");
        if (clock) clock.textContent = new Date().toLocaleTimeString("pl-PL");
    }

    function mapMachine(order) {
        const production = order.production || {};
        const planned = Number(order.order?.quantity) || Number(order.product?.quantity) || 0;
        const good = Number(production.goodQuantity) || 0;
        const progress = planned > 0 ? Math.min(100, Math.round(good / planned * 100)) : 0;
        const produced = Number(production.producedQuantity) || 0;
        const rejected = Number(production.rejectedQuantity) || 0;
        const oee = produced > 0 ? Math.max(0, Math.round((produced - rejected) / produced * 100)) : 0;
        return {
            name: production.machineName || production.machineId || order.planning?.machineName || order.planning?.machineId || "Nieprzydzielona",
            order: order.order?.externalNumber || order.number,
            operator: production.operatorName || "Nieprzypisany",
            status: production.status || (order.status === "in_production" ? "running" : "waiting"),
            progress,
            oee,
            detail: order.product?.name || "Brak nazwy produktu"
        };
    }

    function getRequests(orders) {
        return orders.flatMap(order => (Array.isArray(order.warehouse?.issues) ? order.warehouse.issues : []).map(issue => ({
            ...issue,
            id: issue.id || `${order.id}-issue`,
            machine: issue.machine || order.production?.machineName || order.planning?.machineName || "Nieprzydzielona",
            order: order.order?.externalNumber || order.number,
            material: issue.material || issue.name || "Materiał",
            quantity: issue.quantity || "—",
            priority: issue.priority || "normal",
            status: issue.status || "new",
            reportedAt: issue.createdAt ? new Date(issue.createdAt).toLocaleTimeString("pl-PL", {hour:"2-digit", minute:"2-digit"}) : "--:--"
        })));
    }

    function getShipments(orders) {
        return orders
            .filter(order => order.processStep === "warehouse" || order.status === "warehouse")
            .map(order => ({
                id: order.id,
                loadNumber: order.logistics?.trackingNumber || order.number,
                customer: order.customer?.name || "—",
                destination: order.logistics?.shippingAddress || "—",
                shipDate: order.logistics?.shippingDate || order.logistics?.deliveryDate || "",
                pallets: order.packing?.palletsCount || 0,
                weight: order.product?.weight || 0,
                status: order.warehouse?.status || "planned"
            }));
    }

    function renderMachines(machines) {
        $("#machineGrid").innerHTML = machines.length ? machines.map(machine => `
            <article class="pf-machine">
                <div class="pf-machine__top"><div><strong>${escapeHtml(machine.name)}</strong><small>${escapeHtml(machine.order)} · ${escapeHtml(machine.operator)}</small></div><span class="pf-status pf-status--${escapeHtml(machine.status)}">${statusLabel(machine.status)}</span></div>
                <div class="pf-machine__progress"><i style="width:${machine.progress}%"></i></div>
                <div class="pf-machine__progress-copy"><span>${escapeHtml(machine.detail)}</span><strong>${machine.progress}% · OEE ${machine.oee}%</strong></div>
            </article>
        `).join("") : `<div class="pf-empty">Brak aktywnych maszyn.</div>`;
    }

    function renderRequests(requests) {
        const active = requests.filter(item => item.status !== "delivered").slice(0, 5);
        $("#dashboardRequests").innerHTML = active.length ? active.map(item => `
            <article class="pf-request"><div><strong>${escapeHtml(item.material)}</strong><small>${escapeHtml(item.machine)} · ${escapeHtml(item.order)} · ${escapeHtml(item.quantity)}</small></div><div><span class="pf-priority pf-priority--${escapeHtml(item.priority)}">${priorityLabel(item.priority)}</span><small>${statusLabel(item.status)}</small></div></article>
        `).join("") : `<div class="pf-empty">Brak aktywnych zapotrzebowań.</div>`;
    }

    function renderShipments(shipments) {
        const upcoming = shipments.filter(item => item.status !== "shipped").slice(0, 5);
        $("#dashboardShipments").innerHTML = upcoming.length ? upcoming.map(item => `
            <article class="pf-shipment"><div class="pf-shipment__top"><strong>${escapeHtml(item.loadNumber)}</strong><span class="pf-status pf-status--${escapeHtml(item.status)}">${statusLabel(item.status)}</span></div><p><strong>${escapeHtml(item.customer)}</strong> → ${escapeHtml(item.destination)}</p><small>${formatDate(item.shipDate)} · ${formatNumber(item.pallets)} pal. · ${formatNumber(item.weight)} kg</small></article>
        `).join("") : `<div class="pf-empty">Brak nadchodzących wysyłek.</div>`;
    }

    function renderTimeline(events) {
        $("#dashboardTimeline").innerHTML = events.length ? events.map(event => `
            <article class="pf-event" data-type="info"><div class="pf-event__time">${escapeHtml(new Date(event.createdAt).toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"}))}</div><div class="pf-event__rail"><span class="pf-event__dot"></span></div><div class="pf-event__content"><strong>${escapeHtml(event.message || event.action)}</strong><small>${escapeHtml(event.module || "core")}</small></div></article>
        `).join("") : `<div class="pf-empty">Brak zdarzeń do wyświetlenia.</div>`;
    }

    function renderAlert(machines, requests, shipments) {
        const issueMachine = machines.find(machine => machine.status === "issue");
        const highRequest = requests.find(item => item.status !== "delivered" && ["high","critical"].includes(item.priority));
        const loadingShipment = shipments.find(item => item.status === "loading");
        const strip = $("#dashboardAlertStrip");
        if (issueMachine) {
            strip.dataset.level = "critical";
            $("#dashboardAlertText").textContent = `${issueMachine.name}: ${issueMachine.detail}.`;
            alertTarget = "production";
        } else if (highRequest) {
            strip.dataset.level = "warning";
            $("#dashboardAlertText").textContent = `${highRequest.machine} pilnie potrzebuje: ${highRequest.material}, ${highRequest.quantity}.`;
            alertTarget = "warehouse";
        } else if (loadingShipment) {
            strip.dataset.level = "warning";
            $("#dashboardAlertText").textContent = `Trwa załadunek ${loadingShipment.loadNumber} dla ${loadingShipment.customer}.`;
            alertTarget = "warehouse";
        } else {
            strip.dataset.level = "ok";
            $("#dashboardAlertText").textContent = "Brak krytycznych problemów. Proces przebiega zgodnie z planem.";
            alertTarget = "dashboard";
        }
    }

    function renderCapacity(orders) {
        const planned = orders.reduce((sum, order) => sum + (Number(order.order?.quantity) || 0), 0);
        const good = orders.reduce((sum, order) => sum + (Number(order.production?.goodQuantity) || 0), 0);
        const scrap = orders.reduce((sum, order) => sum + (Number(order.production?.rejectedQuantity) || 0), 0);
        const percent = planned > 0 ? Math.min(100, Math.round(good / planned * 100)) : 0;
        $("#shiftProgress").textContent = `${percent}%`;
        $("#shiftGood").textContent = formatNumber(good);
        $("#shiftScrap").textContent = formatNumber(scrap);
        $("#shiftRemaining").textContent = formatNumber(Math.max(0, planned - good));
        $("#productionRing").style.background = `conic-gradient(var(--pf-blue) ${percent}%, #e9eef5 0)`;
    }

    function renderKpis(machines, requests, shipments, orders) {
        const running = machines.filter(machine => machine.status === "running").length;
        const averageOee = machines.length ? Math.round(machines.reduce((sum, machine) => sum + machine.oee, 0) / machines.length) : 0;
        const newRequests = requests.filter(item => item.status === "new").length;
        const todayShipments = shipments.filter(item => item.shipDate === todayIso()).length;
        const issues = machines.filter(machine => machine.status === "issue").length + requests.filter(item => ["high","critical"].includes(item.priority) && item.status !== "delivered").length;
        const activeOrders = orders.filter(order =>
            !order.archived &&
            !["completed", "cancelled"].includes(order.status)
        );
        const highPriorityOrders = activeOrders.filter(order =>
            ["high", "critical"].includes(
                String(order.order?.priority || "").toLowerCase()
            )
        );
        $("#machinesRunningKpi").textContent = running;
        $("#machinesRunningHint").textContent = machines.length
            ? `${machines.length} monitorowane`
            : "Brak danych";
        $("#oeeKpi").textContent = `${averageOee}%`;
        $("#requestsKpi").textContent = newRequests;
        $("#requestsHint").textContent = newRequests ? "wymagają przyjęcia" : "Brak oczekujących";
        $("#shipmentsTodayKpi").textContent = todayShipments;
        $("#shipmentsTodayHint").textContent = todayShipments ? "zaplanowane na dziś" : "Brak transportów";
        $("#ordersKpi").textContent = activeOrders.length;
        $("#ordersHint").textContent = activeOrders.length
            ? highPriorityOrders.length
                ? `${highPriorityOrders.length} z wysokim priorytetem`
                : "Brak wysokich priorytetów"
            : "Brak aktywnych zleceń";
        $("#issuesKpi").textContent = issues;
        $("#issuesHint").textContent = issues ? "wymagają reakcji" : "Brak krytycznych";
    }

    function render() {
        const store = getStore();
        const orders = store.getOrders();
        const productionOrders = orders.filter(order => order.processStep === "production" || order.status === "in_production");
        const machines = productionOrders.map(mapMachine);
        const requests = getRequests(orders);
        const shipments = getShipments(orders);
        renderMachines(machines);
        renderRequests(requests);
        renderShipments(shipments);
        renderTimeline(store.getHistory({ limit: 7, newestFirst: true }));
        renderCapacity(productionOrders);
        renderKpis(machines, requests, shipments, orders);
        renderAlert(machines, requests, shipments);
    }

    function navigate(moduleName) {
        if (!moduleName || moduleName === "dashboard") return;
        if (typeof window.loadModule === "function") return window.loadModule(moduleName);
        document.querySelector(`[data-module="${moduleName}"]`)?.click();
    }

    function showToast(message) {
        const toast = $("#dashboardToast");
        toast.textContent = message;
        toast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
    }

    function init() {
        const root = document.querySelector(".pf-dashboard");
        if (!root || root.dataset.initialized === "true") return;
        root.dataset.initialized = "true";
        renderClock();
        const clockTimerId = setInterval(renderClock, 1000);
        window.addEventListener("prodflow:module-unload", () => clearInterval(clockTimerId), { once: true });
        root.addEventListener("click", event => {
            const moduleButton = event.target.closest("[data-module-target]");
            if (moduleButton) return navigate(moduleButton.dataset.moduleTarget);
            const actionButton = event.target.closest("[data-dashboard-action]");
            if (!actionButton) return;
            if (actionButton.dataset.dashboardAction === "refresh") {
                render();
                showToast("Dashboard został odświeżony.");
            }
            if (actionButton.dataset.dashboardAction === "open-alert-module") navigate(alertTarget);
        });
        ["store:order-created","store:order-updated","store:order-status-changed","store:order-deleted","store:database-changed","store:database-imported","store:database-cleared"]
            .forEach(name => window.ProdFlow?.events?.on(name, () => document.contains(root) && render()));
        render();
    }

    init();
})();
