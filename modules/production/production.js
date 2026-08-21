(() => {
    let state = createEmptyState();
    let timerId = null;
    let toastTimer = null;
    let modalSubmitHandler = null;

    function $(selector) {
        return document.querySelector(`.pf-production ${selector}`);
    }

    function createEmptyState() {
        return {
            orderId: "",
            orderNumber: "",
            priority: "",
            client: "",
            product: "",
            machine: "",
            operator: "",
            dueDate: "",
            material: "",
            speed: "",
            webTension: "",
            uvTemperature: "",
            colorCount: "",
            coreSize: "",
            winding: "",
            oee: 0,
            planned: 0,
            good: 0,
            scrap: 0,
            status: "waiting",
            elapsedSeconds: 0,
            downtimeMinutes: 0,
            materials: [],
            productCode: "",
            printOrderNumber: "",
            nominalDimensions: {
                width: 0,
                length: 0,
                bottom: 0,
                flap: 0
            },
            plannedPallets: 0,
            unitsPerPallet: 0,
            timeSegments: [],
            reports: [],
            withdrawals: [],
            printBatches: [],
            lineClearance: null,
            palletChecks: [],
            events: []
        };
    }

    function getStore() {
        const store = window.ProdFlow?.store;

        if (
            !store ||
            typeof store.getOrders !== "function" ||
            typeof store.updateOrder !== "function" ||
            typeof store.updateStatus !== "function"
        ) {
            throw new Error(
                "ProdFlow Store nie jest dostępny. Sprawdź kolejność ładowania plików core."
            );
        }

        return store;
    }

    function getLoggedUser() {
        const directUser =
            window.ProdFlow?.currentUser ||
            window.ProdFlow?.auth?.currentUser;
        if (directUser) {
            return directUser.name ||
                directUser.displayName ||
                directUser.username ||
                "";
        }

        try {
            const saved = JSON.parse(
                sessionStorage.getItem("prodflow.currentUser") || "null"
            );
            return saved?.name ||
                saved?.displayName ||
                saved?.username ||
                "";
        } catch (_error) {
            return "";
        }
    }

    function mapHistoryEvents(orderId) {
        const store = getStore();

        if (typeof store.getHistory !== "function") {
            return [];
        }

        return store
            .getHistory({
                orderId,
                limit: 40,
                newestFirst: false
            })
            .map(entry => ({
                time: new Date(entry.createdAt)
                    .toLocaleTimeString("pl-PL", {
                        hour: "2-digit",
                        minute: "2-digit"
                    }),
                title: entry.message || "Zdarzenie",
                detail:
                    entry.module === "production"
                        ? "Moduł Produkcja"
                        : `Moduł: ${entry.module || "core"}`,
                type:
                    entry.type === "status"
                        ? "success"
                        : "info"
            }));
    }

    function mapOrderToState(order) {
        const runtime =
            order.metadata?.productionRuntime || {};
        const production = order.production || {};
        const cardFields =
            order.metadata?.productionCard?.fields || {};
        const settings =
            order.metadata?.productionSettings || {};
        const dimensions = order.product?.dimensions || {};
        const firstMaterial =
            Array.isArray(order.materials)
                ? order.materials.find(item =>
                    item?.name || item?.code
                )
                : null;
        const materials = Array.isArray(order.materials)
            ? order.materials
                .filter(item => item?.name || item?.code)
                .map((item, index) => ({
                    id: item.id || `material-${index}`,
                    type: item.type || "material",
                    code: item.code || "",
                    name: item.name || item.code || "Materiał",
                    unit: item.unit || ""
                }))
            : [];
        const planned =
            Number(order.order?.quantity) ||
            Number(order.product?.quantity) ||
            0;
        const isFinished =
            order.processStep === "quality" ||
            order.status === "quality_control" ||
            order.status === "completed";
        const isSuspended = order.status === "suspended";

        return {
            orderId: order.id,
            orderNumber:
                order.order?.externalNumber ||
                order.number ||
                order.id,
            priority:
                order.order?.priority || "normal",
            client:
                order.customer?.name || "",
            product:
                order.product?.name || "",
            machine:
                production.machineName ||
                production.machineId ||
                order.planning?.machineName ||
                order.planning?.machineId ||
                "",
            operator:
                getLoggedUser() ||
                production.operatorName ||
                production.operator ||
                "",
            dueDate:
                order.order?.dueDate || "",
            material:
                firstMaterial?.name ||
                firstMaterial?.code ||
                cardFields.paperName ||
                cardFields.paperIndex ||
                "",
            speed:
                settings.speed ||
                production.speed ||
                "",
            webTension:
                settings.webTension || "",
            uvTemperature:
                settings.uvTemperature || "",
            colorCount:
                settings.colorCount ||
                cardFields.colorCount ||
                "",
            coreSize:
                settings.coreSize || "",
            winding:
                settings.winding || "",
            oee:
                Number(production.oee) || 0,
            planned,
            good: Number(production.goodQuantity) || 0,
            scrap:
                Number(production.rejectedQuantity) || 0,
            status: isFinished
                ? "finished"
                : isSuspended
                    ? "suspended"
                : runtime.status ||
                  (order.status === "in_production"
                      ? "running"
                      : "waiting"),
            elapsedSeconds:
                Number(runtime.elapsedSeconds) || 0,
            downtimeMinutes:
                Number(production.downtimeMinutes) || 0,
            materials,
            productCode: order.product?.code || "",
            printOrderNumber:
                cardFields.printOrderNumber ||
                order.production?.printOrderNumber ||
                "",
            nominalDimensions: {
                width: Number(dimensions.width) || 0,
                length: Number(dimensions.height) || 0,
                bottom: Number(dimensions.bottomGusset) || 0,
                flap: Number(dimensions.length) || 0
            },
            plannedPallets:
                Number(order.packing?.palletsCount) ||
                (Number(order.packing?.unitsPerPallet) > 0
                    ? Math.ceil(planned / Number(order.packing.unitsPerPallet))
                    : 0),
            unitsPerPallet: Number(order.packing?.unitsPerPallet) || 0,
            timeSegments:
                Array.isArray(production.timeSegments)
                    ? production.timeSegments
                    : [],
            reports:
                Array.isArray(production.reports)
                    ? production.reports
                    : [],
            withdrawals:
                Array.isArray(production.materialWithdrawals)
                    ? production.materialWithdrawals
                    : [],
            printBatches:
                Array.isArray(production.documentPrintBatches)
                    ? production.documentPrintBatches
                    : [],
            lineClearance:
                production.lineClearance && typeof production.lineClearance === "object"
                    ? production.lineClearance
                    : null,
            palletChecks:
                Array.isArray(production.palletChecks)
                    ? production.palletChecks
                    : [],
            events:
                Array.isArray(runtime.events)
                    ? runtime.events
                    : mapHistoryEvents(order.id)
        };
    }

    function productionQueue() {
        const storeOrders =
            getStore().getOrders();
        const activeOrders =
            storeOrders.filter(
                order =>
                    order.processStep === "production" ||
                    order.status === "in_production" ||
                    order.status === "suspended"
            );
        const plannedOrders =
            storeOrders.filter(
                order => order.status === "planned"
            );
        return [
            ...activeOrders,
            ...plannedOrders.filter(
                order =>
                    !activeOrders.some(
                        active =>
                            active.id === order.id
                    )
            )
        ];
    }

    function loadStateFromStore(preferredId) {
        const orders = productionQueue();
        const preferred =
            orders.find(order => order.id === preferredId) ||
            orders.find(order => order.id === state.orderId) ||
            orders[0];

        state = preferred
            ? mapOrderToState(preferred)
            : createEmptyState();
    }

    function renderOrderPicker() {
        const select = $("#productionOrderSelect");
        if (!select) return;
        const orders = productionQueue();
        select.innerHTML = orders.length
            ? orders.map(order => {
                const reference =
                    order.order?.externalNumber ||
                    order.number ||
                    order.id;
                const machine =
                    order.production?.machineName ||
                    order.planning?.machineName ||
                    "bez maszyny";
                return `<option value="${escapeHtml(order.id)}">${escapeHtml(reference)} — ${escapeHtml(order.product?.name || "brak produktu")} · ${escapeHtml(machine)}</option>`;
            }).join("")
            : '<option value="">Brak zleceń gotowych do produkcji</option>';
        select.value = state.orderId || "";
    }

    function persistState(historyMessage) {
        if (!state.orderId) {
            return null;
        }

        return getStore().updateOrder(
            state.orderId,
            {
                production: {
                    status:
                        state.status === "finished"
                            ? "completed"
                            : state.status,
                    producedQuantity:
                        state.good + state.scrap,
                    goodQuantity: state.good,
                    rejectedQuantity: state.scrap,
                    downtimeMinutes:
                        state.downtimeMinutes,
                    timeSegments:
                        state.timeSegments,
                    reports:
                        state.reports,
                    materialWithdrawals:
                        state.withdrawals,
                    documentPrintBatches:
                        state.printBatches,
                    lineClearance:
                        state.lineClearance,
                    palletChecks:
                        state.palletChecks
                },
                metadata: {
                    productionRuntime: {
                        status: state.status,
                        elapsedSeconds:
                            state.elapsedSeconds,
                        events: state.events
                    }
                }
            },
            {
                addHistory: Boolean(historyMessage),
                historyMessage:
                    historyMessage || "",
                module: "production"
            }
        );
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("pl-PL").format(value);
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function nowTime() {
        return new Date().toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getShiftInfo(date = new Date()) {
        const hour = date.getHours();

        if (hour >= 6 && hour < 14) {
            return { number: "I", label: "Zmiana I", hours: "06:00-14:00" };
        }

        if (hour >= 14 && hour < 22) {
            return { number: "II", label: "Zmiana II", hours: "14:00-22:00" };
        }

        return { number: "III", label: "Zmiana III", hours: "22:00-06:00" };
    }

    function renderClock() {
        const clock = $("#productionClock");
        const shiftLabel = $("#productionShiftLabel");
        const shift = getShiftInfo();
        if (clock) {
            clock.textContent = new Date().toLocaleTimeString("pl-PL");
        }
        if (shiftLabel) {
            shiftLabel.textContent = shift.label;
            shiftLabel.title = shift.hours;
        }
    }

    function statusConfig() {
        if (!state.orderId) {
            return {
                label: "Brak zleceń do wyświetlenia",
                pill: "BRAK DANYCH",
                icon: "—",
                action: "Brak zlecenia",
                hint: "Przekaż zlecenie z Planowania"
            };
        }

        const openSegment = [...state.timeSegments]
            .reverse()
            .find(segment => !segment.endedAt);

        return {
            waiting: { label: "Gotowe do uruchomienia", pill: "OCZEKUJE", icon: "▶", action: "Uruchom zlecenie", hint: "Rozpocznij rejestrowanie czasu" },
            running: { label: "Produkcja w toku", pill: "W PRODUKCJI", icon: "●", action: "Wstrzymaj produkcję", hint: "Zatrzymaj rejestrowanie czasu" },
            paused: { label: openSegment?.label || "Produkcja wstrzymana", pill: "STOP", icon: "Ⅱ", action: "Wznów produkcję", hint: "Kontynuuj realizację zlecenia" },
            issue: { label: openSegment?.label || "Oczekiwanie na rozwiązanie problemu", pill: "PROBLEM", icon: "!", action: "Wznów produkcję", hint: "Potwierdź usunięcie problemu" },
            suspended: { label: openSegment?.label || "Zlecenie zawieszone", pill: "ZAWIESZONE", icon: "Ⅱ", action: "Wznów zlecenie", hint: "Zlecenie pozostaje przypisane do stanowiska" },
            dropped: { label: "Zlecenie zdjęte ze stanowiska", pill: "SPADNIĘTE", icon: "↘", action: "Przekazano do planowania", hint: "Zlecenie wymaga ponownego zaplanowania" },
            finished: { label: "Zlecenie zakończone", pill: "ZAKOŃCZONE", icon: "✓", action: "Zlecenie zamknięte", hint: "Zlecenie przekazano do kontroli jakości" }
        }[state.status];
    }

    function render() {
        const percent = state.planned > 0
            ? Math.max(0, Math.round((state.good / state.planned) * 100))
            : 0;
        const barPercent = Math.min(100, percent);
        const remaining = Math.max(0, state.planned - state.good);
        const overproduction = Math.max(0, state.good - state.planned);
        const total = state.good + state.scrap;
        const quality = total > 0 ? (state.good / total) * 100 : 0;
        const efficiency = total > 0
            ? Math.max(0, Math.min(100, Math.round(100 - state.scrap / Math.max(1, state.good) * 100)))
            : 0;
        const priorityLabels = {
            critical: "Priorytet krytyczny",
            high: "Priorytet wysoki",
            normal: "Priorytet normalny",
            low: "Priorytet niski"
        };
        const dueDate = state.dueDate
            ? new Intl.DateTimeFormat("pl-PL").format(
                new Date(`${state.dueDate}T12:00:00`)
            )
            : "—";
        const oee = Math.max(
            0,
            Math.min(100, Number(state.oee) || 0)
        );

        $("#productionOrderNumber").textContent =
            state.orderNumber || "Brak zleceń do wyświetlenia.";
        $("#productionPriority").textContent =
            state.orderId
                ? priorityLabels[state.priority] ||
                  `Priorytet ${state.priority}`
                : "—";
        $("#productionClient").textContent =
            state.client || "—";
        $("#productionProduct").textContent =
            state.product || "—";
        $("#productionMachine").textContent =
            state.machine || "—";
        $("#productionOperator").textContent =
            state.operator || "—";
        $("#productionDueDate").textContent = dueDate;
        $("#productionMaterial").textContent =
            state.material || "—";
        $("#productionSpeed").textContent =
            state.speed ? `${state.speed}` : "—";
        $("#productionWebTension").textContent =
            state.webTension ? `${state.webTension}` : "—";
        $("#productionUvTemperature").textContent =
            state.uvTemperature ? `${state.uvTemperature}` : "—";
        $("#productionColorCount").textContent =
            state.colorCount ? `${state.colorCount}` : "—";
        $("#productionCoreSize").textContent =
            state.coreSize ? `${state.coreSize}` : "—";
        $("#productionWinding").textContent =
            state.winding || "—";
        $("#productionOee").textContent = `${oee}%`;
        $("#productionOeeBar").style.width = `${oee}%`;

        $("#goodQuantity").textContent = formatNumber(state.good);
        $("#goodKpi").textContent = formatNumber(state.good);
        $("#scrapKpi").textContent = formatNumber(state.scrap);
        $("#remainingQuantity").textContent = formatNumber(overproduction || remaining);
        const remainingLabel = $("#remainingLabel");
        if (remainingLabel) {
            remainingLabel.textContent = overproduction ? "Nadprodukcja" : "Pozostało";
        }
        $("#plannedQuantity").textContent = formatNumber(state.planned);
        $("#progressPercent").textContent = `${percent}%`;
        $("#progressBar").style.width = `${barPercent}%`;
        const progressRing = $("#productionProgressRing");
        if (progressRing) {
            progressRing.style.setProperty(
                "--progress",
                `${barPercent * 3.6}deg`
            );
        }
        $("#efficiencyKpi").textContent = `${efficiency}%`;
        $("#workTimeKpi").textContent = formatTime(state.elapsedSeconds);
        $("#qualityIndicator").textContent = `${quality.toFixed(1).replace(".", ",")}%`;
        $("#qualityBar").style.width = `${quality}%`;
        $("#downtimeValue").textContent = `${state.downtimeMinutes} min`;
        const pendingDocumentCount =
            pendingWithdrawals().length + pendingGoodReports().length;
        const documentCount = $("#productionDocumentCount");
        const documentButton = $("#productionDocumentBtn");
        if (documentCount) {
            documentCount.textContent = formatNumber(pendingDocumentCount);
        }
        if (documentButton) {
            documentButton.title = pendingDocumentCount
                ? `${pendingDocumentCount} pozycji czeka na dokument zmiany`
                : state.printBatches.length
                    ? "Brak nowych pozycji; dostępny jest podgląd ostatniego wydruku"
                    : "Brak pozycji do wydruku";
        }

        const config = statusConfig();
        $("#statusBanner").dataset.state = state.status;
        $("#statusIcon").textContent = config.icon;
        $("#orderStatusLabel").textContent = config.label;
        $("#orderStatusPill").textContent = config.pill;
        $("#toggleActionIcon").textContent = state.status === "running" ? "Ⅱ" : config.icon;
        $("#toggleActionLabel").textContent = config.action;
        $("#toggleActionHint").textContent = config.hint;

        const startButton = $("#productionStartBtn");
        const stopButton = $("#productionStopBtn");
        const suspendButton = $("#productionSuspendBtn");
        const dropButton = $("#productionDropBtn");
        const productionCardButton = $("[data-production-action=\"production-card\"]");
        if (startButton) {
            startButton.disabled =
                !state.orderId ||
                state.status === "running" ||
                state.status === "finished";
        }
        if (stopButton) {
            stopButton.disabled =
                !state.orderId ||
                state.status !== "running";
        }
        if (suspendButton) {
            suspendButton.disabled =
                !state.orderId ||
                state.status === "finished" ||
                state.status === "suspended";
        }
        if (dropButton) {
            dropButton.disabled =
                !state.orderId || state.status === "finished";
        }
        if (productionCardButton) {
            productionCardButton.disabled = !state.orderId;
        }
        const correctionButton = $("#productionCorrectReportBtn");
        if (correctionButton) {
            correctionButton.disabled = !state.orderId || !state.reports.length;
        }
        const palletButton = $("#productionPalletBtn");
        const palletHistoryButton = $("[data-production-action=\"pallet-history\"]");
        const palletCount = $("#productionPalletCount");
        const nextPallet = $("#productionNextPallet");
        const completedPallets = state.palletChecks.length;
        if (palletButton) {
            palletButton.disabled = !state.orderId || state.status === "finished";
        }
        if (palletHistoryButton) {
            palletHistoryButton.disabled = !state.orderId;
            palletHistoryButton.title = completedPallets
                ? `${completedPallets} zapisanych kontroli palet`
                : "Nie zapisano jeszcze żadnej kontroli palety";
        }
        if (palletCount) palletCount.textContent = formatNumber(completedPallets);
        if (nextPallet) nextPallet.textContent = formatNumber(nextPalletNumber());
        const startLabel = $("#productionStartLabel");
        if (startLabel) {
            startLabel.textContent =
                ["paused", "issue", "suspended"].includes(state.status)
                    ? "WZNÓW"
                    : "START";
        }

        renderTimeline();
        renderMaterials();
        renderOrderPicker();
        syncTimer();
    }

    function materialTypeLabel(type) {
        return {
            paper: "Papier",
            glue: "Klej",
            ink: "Farba",
            "embossed-paper": "Papier",
            silicone: "Silikon",
            strip: "Pasek"
        }[type] || "Surowiec";
    }

    function renderMaterials() {
        const list = $("#productionMaterialsList");
        const count = $("#productionMaterialsCount");
        if (!list || !count) return;

        count.textContent = state.materials.length;
        if (!state.materials.length) {
            list.innerHTML =
                "<p>Brak materiałów przypisanych do zlecenia.</p>";
            return;
        }

        list.innerHTML = state.materials.map(material => {
            const withdrawn = state.withdrawals
                .filter(item => item.materialId === material.id)
                .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const unit = state.withdrawals
                .find(item => item.materialId === material.id)?.unit ||
                material.unit ||
                "";
            return `
                <div class="operator-material-row">
                    <div>
                        <strong>${escapeHtml(material.name)}</strong>
                        <small>${escapeHtml(material.code || "Brak indeksu")}${withdrawn ? ` · pobrano ${escapeHtml(formatNumber(withdrawn))} ${escapeHtml(unit)}` : ""}</small>
                    </div>
                    <span>${escapeHtml(materialTypeLabel(material.type))}</span>
                </div>`;
        }).join("");
    }

    function renderTimeline() {
        const timeline = $("#productionTimeline");
        if (!state.events.length) {
            timeline.innerHTML = `<p class="pf-muted">Brak zdarzeń dla bieżącego zlecenia.</p>`;
            return;
        }

        timeline.innerHTML = state.events.slice().reverse().map(event => `
            <div class="pf-event" data-type="${escapeHtml(event.type || "info")}">
                <div class="pf-event__time">${escapeHtml(event.time)}</div>
                <div class="pf-event__rail"><span class="pf-event__dot"></span></div>
                <div class="pf-event__content">
                    <strong>${escapeHtml(event.title)}</strong>
                    <small>${escapeHtml(event.detail)}</small>
                </div>
            </div>
        `).join("");
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function syncTimer() {
        if (state.status === "running" && !timerId) {
            timerId = window.setInterval(() => {
                state.elapsedSeconds += 1;
                const workTime = $("#workTimeKpi");
                if (workTime) workTime.textContent = formatTime(state.elapsedSeconds);
                if (state.elapsedSeconds % 10 === 0) {
                    persistState();
                }
            }, 1000);
        }

        if (state.status !== "running" && timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function addEvent(title, detail, type = "info") {
        state.events.push({ time: nowTime(), title, detail, type });
        state.events = state.events.slice(-100);
        persistState(title);
        render();
    }

    function showToast(message) {
        const toast = $("#productionToast");
        toast.textContent = message;
        toast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
    }

    function openModal(config) {
        $("#productionModalEyebrow").textContent = config.eyebrow || "Raportowanie";
        $("#productionModalTitle").textContent = config.title;
        $("#productionModalDescription").textContent = config.description || "";
        $("#productionModalFields").innerHTML = config.fields || "";
        modalSubmitHandler = config.onSubmit || null;
        const submitButton = $("#productionModalForm")
            .querySelector('[type="submit"]');
        submitButton.hidden = Boolean(config.readOnly);
        submitButton.textContent = config.submitLabel || "Zapisz";

        const dialog = $("#productionModal .hmi-modal__dialog");
        dialog?.classList.toggle("is-wide", Boolean(config.wide));

        const modal = $("#productionModal");
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");

        window.setTimeout(() => {
            const firstField = modal.querySelector("input, textarea, select");
            if (firstField) firstField.focus();
        }, 30);
    }

    function closeModal() {
        const modal = $("#productionModal");
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        modalSubmitHandler = null;
        $("#productionModalForm")
            .querySelector('[type="submit"]')
            .hidden = false;
        $("#productionModalForm")
            .querySelector('[type="submit"]')
            .textContent = "Zapisz";
        $("#productionModal .hmi-modal__dialog")
            ?.classList.remove("is-wide");
        $("#productionModalForm").reset();
    }

    function requireActive() {
        if (!state.orderId) {
            showToast("Brak zlecenia przekazanego z Planowania.");
            return false;
        }

        if (state.status === "finished") {
            showToast("Zlecenie jest już zakończone.");
            return false;
        }
        return true;
    }

    function closeOpenSegment() {
        const now = new Date().toISOString();
        let closed = false;
        state.timeSegments = state.timeSegments.map(segment => {
            if (!closed && !segment.endedAt) {
                closed = true;
                return { ...segment, endedAt: now };
            }
            return segment;
        });
    }

    function openTimeSegment(type, label, note = "") {
        closeOpenSegment();
        state.timeSegments.push({
            id: `segment-${Date.now()}`,
            type,
            label,
            note,
            operator: state.operator,
            shift: getShiftInfo().number,
            startedAt: new Date().toISOString(),
            endedAt: ""
        });
    }

    function updateDowntimeTotal() {
        const now = Date.now();
        const seconds = state.timeSegments
            .filter(segment => segment.type !== "production")
            .reduce((sum, segment) => {
                const start = new Date(segment.startedAt).getTime();
                const end = segment.endedAt
                    ? new Date(segment.endedAt).getTime()
                    : now;
                if (!Number.isFinite(start) || !Number.isFinite(end)) {
                    return sum;
                }
                return sum + Math.max(0, Math.floor((end - start) / 1000));
            }, 0);
        state.downtimeMinutes = Math.floor(seconds / 60);
    }

    function segmentLabel(type) {
        return {
            production: "Produkcja",
            material: "Brak materiału",
            changeover: "Przezbrojenie",
            failure: "Awaria",
            organization: "Przerwa organizacyjna",
            other: "Inny powód"
        }[type] || "Inny powód";
    }

    function formatMaterialOption(material) {
        return `${material.name}${material.code ? ` — ${material.code}` : ""}`;
    }

    function formatDocumentDate(value) {
        return new Intl.DateTimeFormat("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(value));
    }

    function nextPalletNumber() {
        const highest = state.palletChecks.reduce(
            (value, record) => Math.max(value, Number(record?.palletNumber) || 0),
            0
        );
        return highest + 1;
    }

    function dimensionText(dimensions = state.nominalDimensions) {
        const values = [
            dimensions?.width,
            dimensions?.length,
            dimensions?.bottom,
            dimensions?.flap
        ];
        return values.some(value => Number(value) > 0)
            ? values.map(value => Number(value) || 0).join(" × ") + " mm"
            : "brak wymiarów w Karcie Produkcyjnej";
    }

    function palletResultControl(name, title, description) {
        return `
            <fieldset class="pallet-check-field">
                <legend>${escapeHtml(title)}</legend>
                <small>${escapeHtml(description)}</small>
                <div class="pallet-check-options">
                    <label class="pallet-check-option is-pass">
                        <input type="radio" name="${escapeHtml(name)}" value="P" required>
                        <span><b>✓</b>Zgodne</span>
                    </label>
                    <label class="pallet-check-option is-fail">
                        <input type="radio" name="${escapeHtml(name)}" value="N" required>
                        <span><b>×</b>Niezgodne</span>
                    </label>
                </div>
            </fieldset>`;
    }

    function openLineClearanceModal(afterConfirmation) {
        const nominal = dimensionText();
        openModal({
            eyebrow: "Kontrola przed rozpoczęciem",
            title: "Potwierdź przygotowanie linii",
            description: "To potwierdzenie jest wymagane jeden raz przed rozpoczęciem zlecenia.",
            submitLabel: "Potwierdź i rozpocznij",
            fields: `
                <div class="pallet-order-summary">
                    <div><span>Zlecenie</span><strong>${escapeHtml(state.orderNumber || "—")}</strong></div>
                    <div><span>Produkt</span><strong>${escapeHtml(state.product || "—")}</strong></div>
                    <div><span>Wymiar nominalny</span><strong>${escapeHtml(nominal)}</strong></div>
                    <div><span>Operator</span><strong>${escapeHtml(state.operator || "—")}</strong></div>
                </div>
                <label class="line-clearance-confirmation">
                    <input type="checkbox" name="lineCleaned" value="yes" required>
                    <span>
                        <strong>Linia została oczyszczona</strong>
                        <small>Brak zbędnych komponentów, czyste stoły, maszyna i podłoga.</small>
                    </span>
                </label>
                <div class="pf-field">
                    <label for="lineClearanceNote">Uwagi</label>
                    <textarea id="lineClearanceNote" name="note" placeholder="Opcjonalnie..."></textarea>
                </div>`,
            onSubmit: form => {
                const data = new FormData(form);
                if (data.get("lineCleaned") !== "yes") {
                    showToast("Potwierdź oczyszczenie linii przed rozpoczęciem.");
                    return;
                }
                const now = new Date();
                state.lineClearance = {
                    confirmed: true,
                    confirmedAt: now.toISOString(),
                    operator: state.operator,
                    shift: getShiftInfo(now).number,
                    note: String(data.get("note") || "").trim()
                };
                closeModal();
                addEvent(
                    "Potwierdzono oczyszczenie linii",
                    `${state.operator || "Operator"} · zmiana ${state.lineClearance.shift}.`,
                    "success"
                );
                showToast("Przygotowanie linii zostało zapisane.");
                if (typeof afterConfirmation === "function") {
                    window.setTimeout(afterConfirmation, 0);
                }
            }
        });
    }

    function openPalletCheckModal() {
        if (!requireActive()) return;
        if (!state.lineClearance?.confirmedAt) {
            openLineClearanceModal(openPalletCheckModal);
            return;
        }

        const palletNumber = nextPalletNumber();
        const previous = state.palletChecks[state.palletChecks.length - 1] || {};
        const nominal = state.nominalDimensions;
        openModal({
            eyebrow: "Lista kontrolna JB",
            title: `Kontrola palety nr ${palletNumber}`,
            description: "Zmierz gotowy wyrób i potwierdź każdą pozycję. Niezgodność wymaga wpisania uwagi.",
            wide: true,
            submitLabel: "Zatwierdź paletę",
            fields: `
                <div class="pallet-order-summary">
                    <div><span>Zlecenie</span><strong>${escapeHtml(state.orderNumber || "—")}</strong></div>
                    <div><span>Produkt</span><strong>${escapeHtml(state.product || "—")}</strong></div>
                    <div><span>Indeks</span><strong>${escapeHtml(state.productCode || "—")}</strong></div>
                    <div><span>Wymiar nominalny</span><strong>${escapeHtml(dimensionText())}</strong></div>
                    <div><span>Paleta</span><strong>${escapeHtml(palletNumber)}${state.plannedPallets ? ` / ${escapeHtml(state.plannedPallets)}` : ""}</strong></div>
                    <div><span>Operator / zmiana</span><strong>${escapeHtml(state.operator || "—")} · ${escapeHtml(getShiftInfo().number)}</strong></div>
                </div>
                <section class="pallet-form-section">
                    <header><span>1</span><div><strong>Identyfikacja materiałów</strong><small>Numery są przenoszone z poprzedniej palety — zmień je, jeśli partia się zmieniła.</small></div></header>
                    <div class="operator-details-grid">
                        <div class="pf-field">
                            <label for="palletGlueBatch">Numer partii kleju</label>
                            <input id="palletGlueBatch" name="glueBatch" value="${escapeHtml(previous.glueBatch || "")}" autocomplete="off" required>
                        </div>
                        <div class="pf-field">
                            <label for="palletTapeBatch">Numer partii taśmy silikonowej</label>
                            <input id="palletTapeBatch" name="siliconeBatch" value="${escapeHtml(previous.siliconeBatch || "")}" autocomplete="off" required>
                        </div>
                    </div>
                </section>
                <section class="pallet-form-section">
                    <header><span>2</span><div><strong>Zmierzony wymiar koperty</strong><small>Szerokość × długość × dno × klapa, w milimetrach.</small></div></header>
                    <div class="pallet-dimensions-grid">
                        <label><span>Szerokość</span><input name="width" type="number" min="0" step="0.1" inputmode="decimal" placeholder="${escapeHtml(nominal.width || "0")}" required><small>nominalnie ${escapeHtml(nominal.width || "—")} mm</small></label>
                        <label><span>Długość</span><input name="length" type="number" min="0" step="0.1" inputmode="decimal" placeholder="${escapeHtml(nominal.length || "0")}" required><small>nominalnie ${escapeHtml(nominal.length || "—")} mm</small></label>
                        <label><span>Dno</span><input name="bottom" type="number" min="0" step="0.1" inputmode="decimal" placeholder="${escapeHtml(nominal.bottom || "0")}" required><small>nominalnie ${escapeHtml(nominal.bottom || "—")} mm</small></label>
                        <label><span>Klapa</span><input name="flap" type="number" min="0" step="0.1" inputmode="decimal" placeholder="${escapeHtml(nominal.flap || "0")}" required><small>nominalnie ${escapeHtml(nominal.flap || "—")} mm</small></label>
                    </div>
                </section>
                <section class="pallet-form-section">
                    <header><span>3</span><div><strong>Kontrola zgodności</strong><small>Każdy punkt musi zostać oceniony.</small></div></header>
                    <div class="pallet-check-grid">
                        ${palletResultControl("gluePosition", "Klej i taśma", "Obecność i właściwe pozycjonowanie")}
                        ${palletResultControl("closure", "Sklejenie i zamknięcie", "Poprawność wykonania koperty")}
                        ${palletResultControl("barcode", "Kod kreskowy", "Poprawność i czytelność kodu")}
                        ${palletResultControl("packaging", "Pakowanie", "Zgodność ze specyfikacją")}
                        ${palletResultControl("labelPrint", "Etykieta i druk", "Właściwa etykieta oraz jakość druku")}
                    </div>
                </section>
                <div class="pf-field">
                    <label for="palletComments">Uwagi</label>
                    <textarea id="palletComments" name="comments" placeholder="Obowiązkowe, jeśli zaznaczono niezgodność..."></textarea>
                </div>`,
            onSubmit: form => {
                const data = new FormData(form);
                const readMeasurement = name => Number(data.get(name));
                const dimensions = {
                    width: readMeasurement("width"),
                    length: readMeasurement("length"),
                    bottom: readMeasurement("bottom"),
                    flap: readMeasurement("flap")
                };
                if (Object.values(dimensions).some(value => !Number.isFinite(value) || value < 0)) {
                    showToast("Uzupełnij prawidłowe wymiary palety.");
                    return;
                }

                const checks = {
                    gluePosition: String(data.get("gluePosition") || ""),
                    closure: String(data.get("closure") || ""),
                    barcode: String(data.get("barcode") || ""),
                    packaging: String(data.get("packaging") || ""),
                    labelPrint: String(data.get("labelPrint") || "")
                };
                if (Object.values(checks).some(value => !["P", "N"].includes(value))) {
                    showToast("Oceń wszystkie punkty kontroli.");
                    return;
                }

                const comments = String(data.get("comments") || "").trim();
                const nonconforming = Object.values(checks).includes("N");
                if (nonconforming && !comments) {
                    $("#palletComments")?.focus();
                    showToast("Przy niezgodności wpisz wyjaśnienie w uwagach.");
                    return;
                }

                const now = new Date();
                const record = {
                    id: `pallet-check-${Date.now()}`,
                    palletNumber,
                    status: nonconforming ? "nonconforming" : "accepted",
                    orderNumber: state.orderNumber,
                    printOrderNumber: state.printOrderNumber,
                    product: state.product,
                    productCode: state.productCode,
                    nominalDimensions: { ...state.nominalDimensions },
                    dimensions,
                    glueBatch: String(data.get("glueBatch") || "").trim(),
                    siliconeBatch: String(data.get("siliconeBatch") || "").trim(),
                    checks,
                    comments,
                    operator: state.operator,
                    shift: getShiftInfo(now).number,
                    completedAt: now.toISOString()
                };
                state.palletChecks = [...state.palletChecks, record];
                closeModal();
                addEvent(
                    `Zakończono kontrolę palety nr ${palletNumber}`,
                    nonconforming
                        ? `Paleta wstrzymana — wykryto niezgodność: ${comments}`
                        : `Wszystkie punkty kontroli są zgodne. Wymiar: ${dimensionText(dimensions)}.`,
                    nonconforming ? "warning" : "success"
                );
                showToast(nonconforming
                    ? `Paleta nr ${palletNumber} została oznaczona jako niezgodna.`
                    : `Paleta nr ${palletNumber} została zatwierdzona.`);
            }
        });
    }

    function palletStatusLabel(record) {
        return record?.status === "nonconforming" ? "Niezgodna" : "Zgodna";
    }

    function openPalletHistory() {
        if (!state.orderId) {
            showToast("Najpierw wybierz zlecenie.");
            return;
        }
        const rows = state.palletChecks.length
            ? [...state.palletChecks].reverse().map(record => `
                <article class="pallet-history-item ${record.status === "nonconforming" ? "is-fail" : "is-pass"}">
                    <div class="pallet-history-number"><small>PALETA</small><strong>${escapeHtml(record.palletNumber)}</strong></div>
                    <div>
                        <strong>${escapeHtml(palletStatusLabel(record))}</strong>
                        <small>${escapeHtml(dimensionText(record.dimensions))} · klej ${escapeHtml(record.glueBatch || "—")} · taśma ${escapeHtml(record.siliconeBatch || "—")}</small>
                        <small>${escapeHtml(record.operator || "—")} · zmiana ${escapeHtml(record.shift || "—")} · ${escapeHtml(formatDocumentDate(record.completedAt))}</small>
                        ${record.comments ? `<p>${escapeHtml(record.comments)}</p>` : ""}
                    </div>
                </article>`).join("")
            : '<div class="pallet-history-empty">Nie zapisano jeszcze żadnej kontroli palety.</div>';
        const clearance = state.lineClearance?.confirmedAt
            ? `Potwierdzono ${formatDocumentDate(state.lineClearance.confirmedAt)} przez ${state.lineClearance.operator || "—"}`
            : "Nie potwierdzono jeszcze oczyszczenia linii";
        openModal({
            eyebrow: "Dokumentacja zlecenia",
            title: "Kontrole skompletowanych palet",
            description: `${state.orderNumber} · ${state.product || "—"}`,
            wide: true,
            readOnly: true,
            fields: `
                <div class="pallet-history-toolbar">
                    <div><span>Przygotowanie linii</span><strong>${escapeHtml(clearance)}</strong></div>
                    <button type="button" data-production-action="print-pallet-checklist" ${state.palletChecks.length ? "" : "disabled"}>Drukuj / zapisz PDF</button>
                </div>
                <div class="pallet-history-list">${rows}</div>`
        });
    }

    function palletChecklistHtml() {
        const logoUrl = new URL("assets/images/logoczarne.png", document.baseURI).href;
        const checkValue = (record, key) => record.checks?.[key] === "P" ? "P" : "N";
        const rows = state.palletChecks.map(record => `
            <tr class="${record.status === "nonconforming" ? "fail" : ""}">
                <td><strong>${escapeHtml(record.palletNumber)}</strong></td>
                <td>${escapeHtml(record.glueBatch || "—")}</td>
                <td>${escapeHtml(record.siliconeBatch || "—")}</td>
                <td>${escapeHtml(dimensionText(record.dimensions))}</td>
                <td>${checkValue(record, "gluePosition")}</td>
                <td>${checkValue(record, "closure")}</td>
                <td>${checkValue(record, "barcode")}</td>
                <td>${checkValue(record, "packaging")}</td>
                <td>${checkValue(record, "labelPrint")}</td>
                <td>${escapeHtml(record.comments || "—")}</td>
                <td>${escapeHtml(formatDocumentDate(record.completedAt))}<br>Zm. ${escapeHtml(record.shift || "—")}</td>
                <td>${escapeHtml(record.operator || "—")}</td>
            </tr>`).join("");
        const clearance = state.lineClearance || {};
        return `<!doctype html>
        <html lang="pl"><head><meta charset="utf-8"><title>Lista kontrolna JB / Checklist JB - ${escapeHtml(state.orderNumber)}</title>
        <style>
          @page{size:A4 landscape;margin:7mm}*{box-sizing:border-box}body{margin:0;color:#17283a;font:7.2px Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .document-header{display:grid;grid-template-columns:165px 1fr 190px;align-items:stretch;border:1.5px solid #173e63}.document-header>div{display:grid;align-content:center;min-height:57px;padding:7px 9px;border-left:1px solid #9aabb9}.document-header>div:first-child{border-left:0}.document-header img{display:block;width:145px;height:auto;max-height:36px;margin:auto;object-fit:contain;image-rendering:auto}.document-header h1{margin:0;color:#002855;font-size:17px;text-align:center}.document-header p{margin:4px 0 0;color:#53687a;font-size:8px;text-align:center}.doc{text-align:right}.doc strong,.doc span{display:block}.doc strong{font-size:7px}.doc span{margin-top:4px;color:#627585;font-size:7px}
          .meta{display:grid;grid-template-columns:1fr 1fr 1.45fr 1.2fr;margin-top:5px;border:1px solid #70889b}.meta div{min-height:46px;padding:6px 7px;border-left:1px solid #a8b6c1}.meta div:first-child{border-left:0}.meta span,.meta strong{display:block}.meta span{color:#52697c;font-size:6.8px;font-weight:700}.meta strong{margin-top:5px;font-size:9px}
          .clearance{display:grid;grid-template-columns:.78fr 3.3fr 1.15fr 1.05fr;margin:5px 0;border:1px solid #70889b}.clearance div{display:grid;align-content:center;min-height:52px;padding:6px 7px;border-left:1px solid #a8b6c1}.clearance div:first-child{border-left:0}.clearance span,.clearance strong{display:block}.clearance span{color:#52697c;font-size:6.8px;font-weight:700}.clearance strong{margin-top:4px;font-size:8px;line-height:1.3}.clearance .statement strong{font-weight:500}
          table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{padding:4px 2px;border:1px solid #7890a3;vertical-align:middle;text-align:center;overflow-wrap:anywhere}th{background:#e8eef3;color:#173e63;font-size:6.1px;line-height:1.16}th span,th small{display:block}th span{font-weight:800}th small{margin-top:2px;color:#415b70;font-size:5.8px;font-weight:500}td{font-size:6.8px}td:nth-child(10){text-align:left}tr.fail td{background:#fff0f1;color:#8b2731}tbody tr{height:28px;break-inside:avoid}
          .legend{display:flex;justify-content:space-between;gap:16px;margin-top:5px;color:#52697c;font-size:6.8px}.legend strong{color:#173e63}footer{position:fixed;right:0;bottom:0;color:#8292a0;font-size:6.5px}
        </style></head><body>
          <header class="document-header"><div><img src="${logoUrl}" alt="Masterpress"></div><div><h1>Lista kontrolna JB / Checklist JB</h1><p>Elektroniczna kontrola każdej skompletowanej palety / Electronic inspection of every completed pallet</p></div><div class="doc"><strong>FO.PROD.105_LISTA KONTROLNA JB_v01</strong><span>Dokument elektroniczny / Electronic document</span><span>Wygenerowano / Generated: ${escapeHtml(formatDocumentDate(new Date()))}</span></div></header>
          <section class="meta">
            <div><span>Numer zlecenia JB / JB order number</span><strong>${escapeHtml(state.orderNumber || "—")}</strong></div>
            <div><span>Numer zlecenia z druku / Print order number</span><strong>${escapeHtml(state.printOrderNumber || "—")}</strong></div>
            <div><span>Wyrób i indeks / Product and item number</span><strong>${escapeHtml(state.product || "—")} ${state.productCode ? `· ${escapeHtml(state.productCode)}` : ""}</strong></div>
            <div><span>Wymiar nominalny / Nominal dimensions</span><strong>${escapeHtml(dimensionText())}</strong></div>
          </section>
          <section class="clearance">
            <div><span>Oczyszczenie linii / Line cleaning</span><strong>${clearance.confirmed ? "TAK / YES" : "NIE / NO"}</strong></div>
            <div class="statement"><span>Potwierdzenie / Confirmation</span><strong>Potwierdzam oczyszczenie linii przed rozpoczęciem zlecenia: usunięto zbędne komponenty, a stoły, maszyna i podłoga są czyste. / I confirm that the line has been cleaned before production: unnecessary components were removed and the tables, machine and floor are clean.</strong></div>
            <div><span>Data i zmiana / Date and shift</span><strong>${clearance.confirmedAt ? escapeHtml(formatDocumentDate(clearance.confirmedAt)) : "—"}<br>${clearance.shift ? `Zmiana / Shift: ${escapeHtml(clearance.shift)}` : ""}</strong></div>
            <div><span>Podpis operatora / Operator signature</span><strong>${escapeHtml(clearance.operator || "—")}</strong></div>
          </section>
          <table><colgroup><col style="width:4%"><col style="width:7%"><col style="width:7.5%"><col style="width:12%"><col style="width:8%"><col style="width:8%"><col style="width:7%"><col style="width:8%"><col style="width:9%"><col style="width:11.5%"><col style="width:9%"><col style="width:9%"></colgroup>
            <thead><tr>
              <th><span>Numer palety</span><small>Pallet number</small></th>
              <th><span>Numer partii kleju</span><small>Glue batch number</small></th>
              <th><span>Numer partii taśmy silikonowej</span><small>Silicone tape batch number</small></th>
              <th><span>Wymiary koperty: szerokość × długość × dno × klapa</span><small>Envelope dimensions: width × length × bottom × flap</small></th>
              <th><span>Obecność i pozycjonowanie kleju oraz taśmy</span><small>Presence and positioning of glue and tape</small></th>
              <th><span>Poprawność sklejenia i zamknięcia</span><small>Correctness of gluing and closing</small></th>
              <th><span>Poprawność kodu kreskowego</span><small>Correctness of barcode</small></th>
              <th><span>Pakowanie zgodne ze specyfikacją</span><small>Packaging according to specification</small></th>
              <th><span>Właściwa etykieta i jakość wydruku</span><small>Correct label and print quality</small></th>
              <th><span>Uwagi</span><small>Comments</small></th>
              <th><span>Data i zmiana</span><small>Date and shift</small></th>
              <th><span>Podpis operatora</span><small>Operator signature</small></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="legend"><span><strong>P</strong> — poprawne / zgodne / correct and compliant · <strong>N</strong> — niepoprawne / niezgodne / incorrect or non-compliant</span><span>Liczba skontrolowanych palet / Inspected pallets: ${escapeHtml(state.palletChecks.length)}${state.plannedPallets ? ` / plan ${escapeHtml(state.plannedPallets)}` : ""}</span></div>
          <footer>Dokument elektroniczny / Electronic document · Masterpress S.A.</footer>
        </body></html>`;
    }

    function printPalletChecklist() {
        if (!state.palletChecks.length) {
            showToast("Brak zapisanych kontroli palet do wydrukowania.");
            return;
        }
        const printWindow = window.open("", "_blank", "width=1240,height=820");
        if (!printWindow) {
            showToast("Przeglądarka zablokowała okno wydruku.");
            return;
        }
        printWindow.document.open();
        printWindow.document.write(palletChecklistHtml());
        printWindow.document.close();
        printWindow.focus();
        const images = Array.from(printWindow.document.images || []);
        Promise.all(images.map(image => image.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
            })))
            .finally(() => window.setTimeout(() => printWindow.print(), 180));
    }

    function isReportDocumentRelevant(record) {
        return Number(record?.goodQuantity) > 0 || Boolean(record?.correctedAt);
    }

    function pendingWithdrawals() {
        return state.withdrawals.filter(record => !record.documentPrintedAt);
    }

    function pendingGoodReports() {
        return state.reports.filter(
            record => isReportDocumentRelevant(record) && !record.documentPrintedAt
        );
    }

    function productionMovementDocumentHtml(withdrawals, reports, documentMeta = {}) {
        const withdrawalRows = withdrawals.map((record, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(record.materialName)}</td>
                <td>${escapeHtml(record.materialCode || "—")}</td>
                <td>${escapeHtml(record.identifier || "—")}</td>
                <td>${escapeHtml(formatNumber(record.quantity))} ${escapeHtml(record.unit)}</td>
                <td>${escapeHtml(record.shift || "—")}</td>
                <td>${escapeHtml(formatDocumentDate(record.createdAt))}</td>
            </tr>`).join("");

        const goodReports = reports.filter(isReportDocumentRelevant);
        const reportRows = goodReports.map((record, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(formatNumber(record.goodQuantity))} szt.</td>
                <td>${escapeHtml(record.operator || state.operator || "—")}</td>
                <td>${escapeHtml(record.shift || "—")}</td>
                <td>${record.correctedAt
                    ? `<strong>KOREKTA:</strong> ${escapeHtml(record.correctionReason || "poprawiono ilość")}<br>${escapeHtml(record.note || "—")}`
                    : escapeHtml(record.note || "—")}</td>
                <td>${escapeHtml(formatDocumentDate(record.createdAt))}</td>
            </tr>`).join("");

        const withdrawnTotal = withdrawals.reduce(
            (sum, record) => sum + (Number(record.quantity) || 0),
            0
        );
        const goodTotal = goodReports.reduce(
            (sum, record) => sum + (Number(record.goodQuantity) || 0),
            0
        );

        return `<!doctype html>
          <html lang="pl">
          <head>
            <meta charset="utf-8">
            <title>Raport pobrań i wyrobu gotowego - ${escapeHtml(state.orderNumber)}</title>
            <style>
              @page{size:A4;margin:12mm}
              *{box-sizing:border-box}
              body{margin:0;color:#172436;font:11px Arial,sans-serif}
              header{display:flex;justify-content:space-between;gap:20px;padding-bottom:14px;border-bottom:2px solid #172436}
              h1{margin:0 0 4px;font-size:20px}
              h2{margin:20px 0 7px;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
              p{margin:3px 0;color:#506174}
              .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 0}
              .meta div{padding:8px;border:1px solid #cfd8e1}
              .meta span,.meta strong{display:block}.meta span{margin-bottom:5px;color:#68798a;font-size:9px;text-transform:uppercase}
              .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:0 0 15px}
              .summary div{padding:9px;border-left:4px solid #002855;background:#eef3f7}
              .summary span,.summary strong{display:block}.summary span{color:#68798a;font-size:8px;text-transform:uppercase}.summary strong{margin-top:3px;font-size:16px}
              table{width:100%;border-collapse:collapse}
              th,td{padding:7px 6px;border:1px solid #bdc8d2;text-align:left;vertical-align:top}
              th{background:#eef2f5;font-size:9px;text-transform:uppercase}
              .empty{text-align:center;color:#7b8996;font-style:italic}
              .signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:48px;break-inside:avoid}
              .signature{padding-top:8px;border-top:1px solid #172436;text-align:center;color:#68798a}
              footer{position:fixed;right:0;bottom:0;color:#9aa7b2;font-size:9px}
            </style>
          </head>
          <body>
            <header>
              <div><h1>Raport pobrań i wyrobu gotowego</h1><p>Masterpress S.A.</p></div>
              <div><strong>${escapeHtml(state.orderNumber)}</strong><p>${escapeHtml(state.product)}</p><p>${documentMeta.isCopy ? "KOPIA DOKUMENTU" : "NOWE POZYCJE"}</p></div>
            </header>
            <section class="meta">
              <div><span>Maszyna</span><strong>${escapeHtml(state.machine || "—")}</strong></div>
              <div><span>Operator</span><strong>${escapeHtml(state.operator || "—")}</strong></div>
              <div><span>Zmiana</span><strong>${escapeHtml(documentMeta.shift || getShiftInfo().number)}</strong></div>
              <div><span>Data wydruku</span><strong>${escapeHtml(formatDocumentDate(new Date()))}</strong></div>
            </section>
            <section class="summary">
              <div><span>Plan zlecenia</span><strong>${escapeHtml(formatNumber(state.planned))} szt.</strong></div>
              <div><span>Dobre zgłoszone</span><strong>${escapeHtml(formatNumber(goodTotal))} szt.</strong></div>
              <div><span>Pozycje pobrań</span><strong>${escapeHtml(formatNumber(withdrawals.length))}</strong></div>
            </section>
            <h2>Pobrania surowców</h2>
            <table>
              <thead><tr><th>Lp.</th><th>Surowiec</th><th>Indeks</th><th>Numer identyfikacyjny</th><th>Ilość</th><th>Zmiana</th><th>Data pobrania</th></tr></thead>
              <tbody>${withdrawalRows || '<tr><td class="empty" colspan="7">Brak zapisanych pobrań surowców.</td></tr>'}</tbody>
            </table>
            <h2>Zgłoszenia dobrego wyrobu gotowego</h2>
            <table>
              <thead><tr><th>Lp.</th><th>Ilość dobra</th><th>Operator</th><th>Zmiana</th><th>Uwagi</th><th>Data zgłoszenia</th></tr></thead>
              <tbody>${reportRows || '<tr><td class="empty" colspan="6">Brak zgłoszeń dobrego wyrobu.</td></tr>'}</tbody>
            </table>
            <section class="signatures">
              <div class="signature">Operator / osoba zgłaszająca</div>
              <div class="signature">Magazyn / osoba przyjmująca zgłoszenie</div>
            </section>
            <footer>Dokument ${escapeHtml(documentMeta.batchId || "roboczy")} · wygenerowany dla Masterpress S.A.</footer>
          </body></html>`;
    }

    function createDocumentBatch(withdrawals, reports) {
        const now = new Date().toISOString();
        return {
            id: `document-${Date.now()}`,
            createdAt: now,
            operator: state.operator,
            shift: getShiftInfo().number,
            withdrawals: withdrawals.map(record => ({ ...record })),
            reports: reports.map(record => ({ ...record }))
        };
    }

    function markDocumentBatchPrinted(batch) {
        const withdrawalIds = new Set(batch.withdrawals.map(record => record.id));
        const reportIds = new Set(batch.reports.map(record => record.id));
        state.withdrawals = state.withdrawals.map(record =>
            withdrawalIds.has(record.id)
                ? {
                    ...record,
                    documentPrintedAt: batch.createdAt,
                    documentBatchId: batch.id
                }
                : record
        );
        state.reports = state.reports.map(record =>
            reportIds.has(record.id)
                ? {
                    ...record,
                    documentPrintedAt: batch.createdAt,
                    documentBatchId: batch.id
                }
                : record
        );
        state.printBatches = [...state.printBatches, batch].slice(-60);
        addEvent(
            "Przygotowano dokument zmiany",
            `${batch.withdrawals.length} pobrań i ${batch.reports.length} zgłoszeń wyrobu oznaczono jako wydrukowane.`,
            "info"
        );
    }

    function printProductionDocument(options = {}) {
        const reprintBatch = options.reprintBatch || null;
        const withdrawals = reprintBatch?.withdrawals || pendingWithdrawals();
        const reports = reprintBatch?.reports || pendingGoodReports();
        const goodReports = reports.filter(isReportDocumentRelevant);
        if (!withdrawals.length && !goodReports.length) {
            showToast("Brak nowych pobrań i zgłoszeń dobrego wyrobu do wydrukowania.");
            return;
        }
        const batch = reprintBatch || createDocumentBatch(withdrawals, goodReports);
        const printWindow = window.open("", "_blank", "width=980,height=760");
        if (!printWindow) {
            showToast("Przeglądarka zablokowała okno wydruku.");
            return;
        }
        printWindow.document.open();
        printWindow.document.write(productionMovementDocumentHtml(
            withdrawals,
            goodReports,
            {
                batchId: batch.id,
                shift: batch.shift,
                isCopy: Boolean(reprintBatch)
            }
        ));
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 250);
        if (!reprintBatch) {
            markDocumentBatchPrinted(batch);
        } else {
            showToast(`Otwarto kopię dokumentu ${batch.id}.`);
        }
    }

    function productionCardUrl(orderId, embedded = false) {
        const url = new URL(
            "modules/production-card/print/print.html",
            document.baseURI
        );
        url.searchParams.set("orderId", orderId);
        url.searchParams.set("preview", "1");
        if (embedded) url.searchParams.set("embedded", "1");
        return url;
    }

    function openProductionCard() {
        if (!state.orderId) {
            showToast("Najpierw wybierz zlecenie.");
            return;
        }

        const cardWindow = window.open(
            productionCardUrl(state.orderId).href,
            "_blank",
            "noopener,noreferrer"
        );

        if (!cardWindow) {
            showToast("Przeglądarka zablokowała otwarcie Karty Produkcyjnej.");
        }
    }

    async function sendWarehouseEmail(issue) {
        const api = window.ProdFlow?.api;
        if (!api?.sendMaterialRequest) {
            throw new Error("Usługa wysyłania wiadomości nie jest dostępna.");
        }

        return api.sendMaterialRequest({
            orderId: state.orderId,
            orderNumber: state.orderNumber,
            materialId: issue.materialId,
            material: `${issue.material}${issue.materialCode ? ` (${issue.materialCode})` : ""}`,
            quantity: issue.quantityValue,
            unit: issue.unit,
            machine: state.machine || "",
            shift: String(issue.shift || ""),
            notes: `Priorytet: ${issue.priority}. Operator: ${state.operator || "—"}.`
        });
    }

    function handleAction(action, button) {
        if (action === "start") {
            if (!requireActive()) return;
            if (state.status === "running") {
                showToast("Produkcja jest już uruchomiona.");
                return;
            }

            const firstStart = state.status === "waiting";
            if (firstStart && !state.lineClearance?.confirmedAt) {
                openLineClearanceModal(() => handleAction("start"));
                return;
            }
            const resumeSuspended = state.status === "suspended";
            if (firstStart || resumeSuspended) {
                const store = getStore();
                store.updateStatus(
                    state.orderId,
                    "in_production",
                    {
                        processStep: "production",
                        module: "production",
                        message: resumeSuspended
                            ? "Wznowiono zawieszone zlecenie."
                            : "Rozpoczęto produkcję zlecenia."
                    }
                );
                store.updateOrder(
                    state.orderId,
                    {
                        production: {
                            status: "running",
                            actualStart: firstStart
                                ? new Date().toISOString()
                                : undefined,
                            operatorName: state.operator
                        }
                    },
                    { addHistory: false, module: "production" }
                );
            }

            openTimeSegment("production", "Produkcja");
            updateDowntimeTotal();
            state.status = "running";
            addEvent(
                firstStart ? "Rozpoczęto produkcję" : "Wznowiono produkcję",
                firstStart
                    ? "Uruchomiono pomiar czasu realizacji zlecenia."
                    : "Zakończono przestój i wznowiono pomiar czasu produkcji.",
                "success"
            );
            showToast(firstStart ? "Produkcja rozpoczęta." : "Produkcja wznowiona.");
        }

        if (action === "pallet-check") {
            openPalletCheckModal();
        }

        if (action === "pallet-history") {
            openPalletHistory();
        }

        if (action === "print-pallet-checklist") {
            printPalletChecklist();
        }

        if (action === "stop") {
            if (!requireActive()) return;
            if (state.status !== "running") {
                showToast("Produkcja nie jest obecnie uruchomiona.");
                return;
            }

            openModal({
                eyebrow: "Zatrzymanie produkcji",
                title: "Dlaczego zatrzymujesz?",
                description: "Wybrany powód będzie liczony do chwili ponownego uruchomienia produkcji.",
                fields: `
                    <div class="pf-field">
                        <label for="stopReason">Powód zatrzymania</label>
                        <select id="stopReason" name="reason" required>
                            <option value="">Wybierz powód</option>
                            <option value="material">Brak materiału</option>
                            <option value="changeover">Przezbrojenie</option>
                            <option value="failure">Awaria</option>
                            <option value="organization">Przerwa organizacyjna</option>
                            <option value="other">Inny powód</option>
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="stopNote">Uwagi</label>
                        <textarea id="stopNote" name="note" placeholder="Opcjonalny opis zatrzymania..."></textarea>
                    </div>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    const reason = String(data.get("reason") || "");
                    const note = String(data.get("note") || "").trim();
                    if (!reason) {
                        showToast("Wybierz powód zatrzymania.");
                        return;
                    }

                    const label = segmentLabel(reason);
                    openTimeSegment(reason, label, note);
                    updateDowntimeTotal();
                    state.status = reason === "failure" ? "issue" : "paused";
                    addEvent(
                        `Zatrzymano: ${label}`,
                        note || "Rozpoczęto pomiar czasu zatrzymania.",
                        "warning"
                    );
                    closeModal();
                    showToast(`Zapisano zatrzymanie: ${label}.`);
                }
            });
        }

        if (action === "suspend") {
            if (!requireActive()) return;
            openModal({
                eyebrow: "Status zlecenia",
                title: "Zawieś zlecenie",
                description: "Zlecenie pozostanie przypisane do stanowiska i będzie można je później wznowić.",
                fields: `
                    <div class="pf-field">
                        <label for="suspendReason">Powód zawieszenia</label>
                        <select id="suspendReason" name="reason" required>
                            <option value="">Wybierz powód</option>
                            <option>Awaria maszyny</option>
                            <option>Brak materiału</option>
                            <option>Brak obsady</option>
                            <option>Oczekiwanie na decyzję</option>
                            <option>Inny powód</option>
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="suspendNote">Uwagi</label>
                        <textarea id="suspendNote" name="note" placeholder="Opisz, co jest potrzebne do wznowienia..."></textarea>
                    </div>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    const reason = String(data.get("reason") || "").trim();
                    const note = String(data.get("note") || "").trim();
                    if (!reason) {
                        showToast("Wybierz powód zawieszenia.");
                        return;
                    }

                    openTimeSegment("suspension", `Zawieszenie: ${reason}`, note);
                    updateDowntimeTotal();
                    state.status = "suspended";
                    getStore().updateStatus(
                        state.orderId,
                        "suspended",
                        {
                            processStep: "production",
                            module: "production",
                            message: `Zawieszono zlecenie. Powód: ${reason}.`
                        }
                    );
                    addEvent(
                        "Zlecenie zawieszone",
                        [reason, note].filter(Boolean).join(" - "),
                        "warning"
                    );
                    closeModal();
                    showToast("Zlecenie zostało zawieszone i można je później wznowić.");
                }
            });
        }

        if (action === "drop-order") {
            if (!requireActive()) return;
            openModal({
                eyebrow: "Status zlecenia",
                title: "Oznacz jako spadnięte",
                description: "Zlecenie zostanie zdjęte ze stanowiska i wróci do kolumny „Do zaplanowania”.",
                fields: `
                    <div class="pf-field">
                        <label for="dropReason">Powód</label>
                        <select id="dropReason" name="reason" required>
                            <option value="">Wybierz powód</option>
                            <option>Awaria uniemożliwiająca realizację</option>
                            <option>Brak surowca</option>
                            <option>Brak możliwości technologicznych</option>
                            <option>Zmiana priorytetów</option>
                            <option>Inny powód</option>
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="dropNote">Uwagi dla planisty</label>
                        <textarea id="dropNote" name="note" placeholder="Co powinien wiedzieć planista?"></textarea>
                    </div>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    const reason = String(data.get("reason") || "").trim();
                    const note = String(data.get("note") || "").trim();
                    if (!reason) {
                        showToast("Wybierz powód zdjęcia zlecenia.");
                        return;
                    }

                    const store = getStore();
                    const droppedOrderId = state.orderId;
                    const droppedOrderNumber = state.orderNumber;
                    const previousMachine = state.machine;
                    closeOpenSegment();
                    updateDowntimeTotal();
                    state.status = "dropped";
                    state.events.push({
                        time: nowTime(),
                        title: "Zlecenie spadło ze stanowiska",
                        detail: [reason, note].filter(Boolean).join(" - "),
                        type: "warning"
                    });
                    persistState(`Zlecenie ${droppedOrderNumber} spadło ze stanowiska. Powód: ${reason}.`);

                    store.updateOrder(
                        droppedOrderId,
                        {
                            planning: {
                                status: "not_planned",
                                machineId: "",
                                machineName: "",
                                notes: [
                                    note,
                                    `Spadło z maszyny ${previousMachine || "—"}: ${reason}`
                                ].filter(Boolean).join("\n")
                            },
                            metadata: {
                                productionDisposition: {
                                    type: "dropped",
                                    reason,
                                    note,
                                    previousMachine,
                                    operator: state.operator,
                                    shift: getShiftInfo().number,
                                    createdAt: new Date().toISOString()
                                }
                            }
                        },
                        { addHistory: false, module: "production" }
                    );
                    store.updateStatus(
                        droppedOrderId,
                        "dropped",
                        {
                            processStep: "planning",
                            module: "production",
                            message: `Zlecenie spadło ze stanowiska i wróciło do planowania. Powód: ${reason}.`
                        }
                    );

                    closeModal();
                    loadStateFromStore();
                    render();
                    showToast("Zlecenie wróciło do planowania jako spadnięte.");
                }
            });
        }

        if (action === "withdraw-material") {
            if (!requireActive()) return;
            if (!state.materials.length) {
                showToast("Zlecenie nie ma przypisanej listy surowców.");
                return;
            }

            openModal({
                eyebrow: "Ewidencja surowców",
                title: "Pobranie surowca",
                description: "Wybierz surowiec ze zlecenia i zapisz dane potrzebne do późniejszego rozchodu w ERP.",
                fields: `
                    <div class="pf-field">
                        <label for="withdrawMaterial">Surowiec</label>
                        <select id="withdrawMaterial" name="materialId" required>
                            <option value="">Wybierz surowiec</option>
                            ${state.materials.map(material => `<option value="${escapeHtml(material.id)}">${escapeHtml(formatMaterialOption(material))}</option>`).join("")}
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="withdrawIdentifier">Numer identyfikacyjny / partia / rolka</label>
                        <input id="withdrawIdentifier" name="identifier" required autocomplete="off" placeholder="Wpisz lub zeskanuj numer">
                    </div>
                    <div class="operator-details-grid">
                        <div class="pf-field">
                            <label for="withdrawQuantity">Ilość pobrana</label>
                            <input id="withdrawQuantity" name="quantity" type="number" min="0.001" step="0.001" required inputmode="decimal">
                        </div>
                        <div class="pf-field">
                            <label for="withdrawUnit">Jednostka</label>
                            <select id="withdrawUnit" name="unit" required>
                                <option value="kg">kg</option>
                                <option value="m">m</option>
                                <option value="szt.">szt.</option>
                                <option value="rolka">rolka</option>
                                <option value="opak.">opak.</option>
                            </select>
                        </div>
                    </div>
                    <div class="pf-field">
                        <label for="withdrawNote">Uwagi</label>
                        <textarea id="withdrawNote" name="note" placeholder="Opcjonalnie..."></textarea>
                    </div>
                    <label class="pf-field">
                        <span><input name="printAfterSave" type="checkbox" value="yes"> Drukuj dokument po zapisaniu</span>
                    </label>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    const material = state.materials.find(
                        item => item.id === String(data.get("materialId") || "")
                    );
                    const quantity = Number(data.get("quantity"));
                    const identifier = String(data.get("identifier") || "").trim();
                    if (!material || !identifier || !Number.isFinite(quantity) || quantity <= 0) {
                        showToast("Uzupełnij surowiec, identyfikator i ilość.");
                        return;
                    }

                    const record = {
                        id: `withdrawal-${Date.now()}`,
                        materialId: material.id,
                        materialName: material.name,
                        materialCode: material.code,
                        materialType: material.type,
                        identifier,
                        quantity,
                        unit: String(data.get("unit") || ""),
                        note: String(data.get("note") || "").trim(),
                        operator: state.operator,
                        shift: getShiftInfo().number,
                        createdAt: new Date().toISOString(),
                        documentPrintedAt: "",
                        documentBatchId: ""
                    };
                    state.withdrawals.push(record);
                    addEvent(
                        "Zapisano pobranie surowca",
                        `${record.materialName} · ${record.identifier} · ${formatNumber(record.quantity)} ${record.unit}.`,
                        "info"
                    );
                    const shouldPrint = data.get("printAfterSave") === "yes";
                    closeModal();
                    if (shouldPrint) {
                        printProductionDocument();
                    }
                    showToast("Pobranie surowca zostało zapisane.");
                }
            });
        }

        if (action === "withdrawals") {
            if (!requireActive()) return;
            const withdrawals = pendingWithdrawals();
            const goodReports = pendingGoodReports();
            const lastBatch = state.printBatches.at(-1);
            const hasDocumentData = withdrawals.length || goodReports.length;
            openModal({
                eyebrow: "Dokument produkcyjny",
                title: "Dokument bieżącej zmiany",
                description: hasDocumentData
                    ? "Na PDF trafią tylko nowe pozycje. Po otwarciu wydruku zostaną oznaczone, więc nie wydrukujesz ich przypadkiem drugi raz."
                    : "Brak nowych pozycji do rozliczenia. Wcześniejsze wydruki pozostają zapisane w historii.",
                readOnly: true,
                fields: `<div class="operator-document-section">
                        <h3>Pobrania surowców</h3>
                        <div class="operator-withdrawal-list">
                        ${withdrawals.slice().reverse().map(record => `
                            <div class="operator-withdrawal-item">
                                <div>
                                    <strong>${escapeHtml(record.materialName)} · ${escapeHtml(formatNumber(record.quantity))} ${escapeHtml(record.unit)}</strong>
                                    <small>${escapeHtml(record.identifier)} · ${escapeHtml(new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(record.createdAt)))}</small>
                                </div>
                            </div>`).join("") || '<div class="operator-history-list"><div><strong>Brak pobrań</strong><small>Nie zapisano pobrań surowców.</small></div></div>'}
                        </div>
                        <h3>Dobry wyrób gotowy</h3>
                        <div class="operator-withdrawal-list">
                          ${goodReports.slice().reverse().map(record => `
                            <div class="operator-withdrawal-item">
                              <div>
                                <strong>${escapeHtml(formatNumber(record.goodQuantity))} szt. dobrych</strong>
                                <small>Zmiana ${escapeHtml(record.shift || "—")} · ${escapeHtml(formatDocumentDate(record.createdAt))}</small>
                              </div>
                            </div>`).join("") || '<div class="operator-history-list"><div><strong>Brak zgłoszeń</strong><small>Nie zapisano dobrego wyrobu.</small></div></div>'}
                        </div>
                        ${hasDocumentData
                            ? '<button class="operator-btn operator-btn--primary" type="button" data-print-production-document>Drukuj nowe pozycje</button>'
                            : '<div class="operator-history-list"><div><strong>Wszystko rozliczone</strong><small>Nowe pozycje pojawią się po pobraniu surowca lub raporcie wyniku.</small></div></div>'}
                        ${lastBatch
                            ? `<button class="operator-btn" type="button" data-reprint-production-document="${escapeHtml(lastBatch.id)}">Drukuj kopię ostatniego dokumentu</button>`
                            : ""}
                      </div>`
            });
        }

        if (action === "report") {
            if (!requireActive()) return;
            openModal({
                eyebrow: "Raport zmiany",
                title: "Raportuj produkcję",
                description: "Wpisz wynik od ostatniego raportu. Puste pole oznacza zero.",
                fields: `
                    <div class="pf-field">
                        <label for="reportGood">Dobre sztuki</label>
                        <input id="reportGood" name="good" type="number" min="0" step="1" value="0" inputmode="numeric">
                    </div>
                    <div class="pf-field">
                        <label for="reportScrap">Braki</label>
                        <input id="reportScrap" name="scrap" type="number" min="0" step="1" value="0" inputmode="numeric">
                    </div>
                    <div class="pf-field">
                        <label for="reportReason">Przyczyna braków</label>
                        <select id="reportReason" name="reason">
                            <option value="">Nie dotyczy</option>
                            <option>Rozruch maszyny</option>
                            <option>Błąd druku</option>
                            <option>Uszkodzenie materiału</option>
                            <option>Niezgodność wymiarowa</option>
                            <option>Inna</option>
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="reportNote">Krótka uwaga</label>
                        <textarea id="reportNote" name="note" placeholder="Opcjonalnie..."></textarea>
                    </div>
                    <label class="pf-field">
                        <span><input name="printAfterSave" type="checkbox" value="yes"> Drukuj wspólny PDF po zapisaniu</span>
                    </label>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    const good = Math.max(0, Number(data.get("good")) || 0);
                    const scrap = Math.max(0, Number(data.get("scrap")) || 0);
                    const reason = String(data.get("reason") || "").trim();
                    const note = String(data.get("note") || "").trim();

                    if (!good && !scrap) {
                        showToast("Wpisz liczbę dobrych sztuk lub braków.");
                        return;
                    }

                    state.good += good;
                    state.scrap += scrap;
                    state.reports.push({
                        id: `report-${Date.now()}`,
                        goodQuantity: good,
                        scrapQuantity: scrap,
                        scrapReason: reason,
                        note,
                        operator: state.operator,
                        shift: getShiftInfo().number,
                        createdAt: new Date().toISOString(),
                        documentPrintedAt: "",
                        documentBatchId: ""
                    });
                    const detail = [
                        good ? `Dobre: ${formatNumber(good)} szt.` : "",
                        scrap ? `Braki: ${formatNumber(scrap)} szt.` : "",
                        reason ? `Przyczyna: ${reason}.` : "",
                        note
                    ].filter(Boolean).join(" ");

                    addEvent("Zapisano raport produkcji", detail, scrap ? "warning" : "success");
                    const shouldPrint = data.get("printAfterSave") === "yes";
                    closeModal();
                    if (shouldPrint) {
                        printProductionDocument();
                    }
                    const overproduction = Math.max(0, state.good - state.planned);
                    showToast(
                        overproduction
                            ? `Wynik zapisany. Nadprodukcja: ${formatNumber(overproduction)} szt.`
                            : "Wynik produkcji został zapisany."
                    );
                }
            });
        }

        if (action === "correct-report") {
            if (!requireActive()) return;
            if (!state.reports.length) {
                showToast("Nie ma jeszcze raportu, który można poprawić.");
                return;
            }

            const reports = state.reports.slice().reverse();
            const reportOptions = reports.map(record => {
                const label = `${formatDocumentDate(record.createdAt)} · dobre ${formatNumber(record.goodQuantity || 0)} · braki ${formatNumber(record.scrapQuantity || 0)}`;
                return `<option value="${escapeHtml(record.id)}">${escapeHtml(label)}</option>`;
            }).join("");

            openModal({
                eyebrow: "Korekta operatora",
                title: "Popraw ilość w raporcie",
                description: "Oryginalny wpis zostanie zachowany w historii korekt. Jeżeli był już drukowany, poprawiona wersja wróci do dokumentu zmiany.",
                fields: `
                    <div class="pf-field">
                        <label for="correctionReportId">Raport do poprawienia</label>
                        <select id="correctionReportId" name="reportId" required>${reportOptions}</select>
                    </div>
                    <div class="operator-details-grid">
                        <div class="pf-field">
                            <label for="correctionGood">Dobre sztuki po korekcie</label>
                            <input id="correctionGood" name="good" type="number" min="0" step="1" required inputmode="numeric">
                        </div>
                        <div class="pf-field">
                            <label for="correctionScrap">Braki po korekcie</label>
                            <input id="correctionScrap" name="scrap" type="number" min="0" step="1" required inputmode="numeric">
                        </div>
                    </div>
                    <div class="pf-field">
                        <label for="correctionReason">Powód korekty</label>
                        <select id="correctionReason" name="correctionReason" required>
                            <option value="">Wybierz powód</option>
                            <option>Pomyłka przy wpisywaniu</option>
                            <option>Błędne przeliczenie</option>
                            <option>Korekta po ponownym sprawdzeniu</option>
                            <option>Inny powód</option>
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="correctionNote">Uwagi po korekcie</label>
                        <textarea id="correctionNote" name="note" placeholder="Opcjonalnie..."></textarea>
                    </div>`,
                onSubmit: form => {
                    const data = new FormData(form);
                    const reportId = String(data.get("reportId") || "");
                    const reportIndex = state.reports.findIndex(record => record.id === reportId);
                    const report = state.reports[reportIndex];
                    const good = Number(data.get("good"));
                    const scrap = Number(data.get("scrap"));
                    const correctionReason = String(data.get("correctionReason") || "").trim();
                    const note = String(data.get("note") || "").trim();
                    if (!report || !Number.isInteger(good) || good < 0 || !Number.isInteger(scrap) || scrap < 0 || !correctionReason) {
                        showToast("Wpisz prawidłowe ilości i wybierz powód korekty.");
                        return;
                    }
                    const previousGood = Number(report.goodQuantity) || 0;
                    const previousScrap = Number(report.scrapQuantity) || 0;
                    if (previousGood === good && previousScrap === scrap && (report.note || "") === note) {
                        showToast("Nie zmieniono danych raportu.");
                        return;
                    }
                    const correctedAt = new Date().toISOString();
                    state.good = Math.max(0, state.good - previousGood + good);
                    state.scrap = Math.max(0, state.scrap - previousScrap + scrap);
                    state.reports[reportIndex] = {
                        ...report,
                        goodQuantity: good,
                        scrapQuantity: scrap,
                        note,
                        correctedAt,
                        correctedBy: state.operator,
                        correctionReason,
                        documentPrintedAt: "",
                        documentBatchId: "",
                        corrections: [
                            ...(Array.isArray(report.corrections) ? report.corrections : []),
                            {
                                correctedAt,
                                correctedBy: state.operator,
                                reason: correctionReason,
                                previousGoodQuantity: previousGood,
                                previousScrapQuantity: previousScrap,
                                goodQuantity: good,
                                scrapQuantity: scrap
                            }
                        ]
                    };
                    closeModal();
                    addEvent(
                        "Skorygowano raport produkcji",
                        `Dobre: ${formatNumber(previousGood)} → ${formatNumber(good)}; braki: ${formatNumber(previousScrap)} → ${formatNumber(scrap)}. ${correctionReason}.`,
                        "warning"
                    );
                    showToast("Raport poprawiono. Korekta czeka na dokument zmiany.");
                }
            });

            const reportSelect = $("#correctionReportId");
            const fillCorrectionFields = () => {
                const record = state.reports.find(item => item.id === reportSelect?.value);
                if (!record) return;
                $("#correctionGood").value = Number(record.goodQuantity) || 0;
                $("#correctionScrap").value = Number(record.scrapQuantity) || 0;
                $("#correctionNote").value = record.note || "";
            };
            reportSelect?.addEventListener("change", fillCorrectionFields);
            fillCorrectionFields();
        }

        if (action === "production-card") {
            openProductionCard();
        }

        if (action === "details") {
            const events = state.events.slice(-5).reverse();
            openModal({
                eyebrow: "Informacje",
                title: state.orderNumber || "Szczegóły zlecenia",
                description: "Najważniejsze dane technologiczne i ostatnie zdarzenia.",
                readOnly: true,
                fields: `
                    <div class="operator-details-grid">
                        <div><span>Produkt</span><strong>${escapeHtml(state.product || "—")}</strong></div>
                        <div><span>Klient</span><strong>${escapeHtml(state.client || "—")}</strong></div>
                        <div><span>Maszyna</span><strong>${escapeHtml(state.machine || "—")}</strong></div>
                        <div><span>Materiał</span><strong>${escapeHtml(state.material || "—")}</strong></div>
                        <div><span>Liczba kolorów</span><strong>${escapeHtml(state.colorCount || "—")}</strong></div>
                        <div><span>Instrukcja / nawój</span><strong>${escapeHtml(state.winding || "—")}</strong></div>
                    </div>
                    <div class="operator-history-list">
                        ${events.length
                            ? events.map(event => `<div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.time)} · ${escapeHtml(event.detail)}</small></div>`).join("")
                            : "<div><strong>Brak zdarzeń</strong><small>Historia pojawi się po rozpoczęciu pracy.</small></div>"}
                    </div>
                `
            });
        }

        if (action === "add-good") {
            if (!requireActive()) return;
            openModal({
                title: "Dodaj wykonane sztuki",
                description: "Wpisz liczbę dobrych sztuk od ostatniego raportu.",
                fields: `
                    <div class="pf-field">
                        <label for="goodAmount">Liczba sztuk</label>
                        <input id="goodAmount" name="amount" type="number" min="1" step="1" required>
                    </div>
                `,
                onSubmit: form => {
                    const amount = Number(new FormData(form).get("amount"));
                    if (!Number.isFinite(amount) || amount <= 0) return;
                    state.good += amount;
                    addEvent(`Zaraportowano ${formatNumber(amount)} szt.`, `Łącznie wykonano ${formatNumber(state.good)} dobrych sztuk.`, "success");
                    closeModal();
                    showToast("Postęp produkcji został zaktualizowany.");
                }
            });
        }

        if (action === "add-scrap") {
            if (!requireActive()) return;
            openModal({
                title: "Zgłoś brak produkcyjny",
                description: "Zapisz ilość i przyczynę powstania odpadu.",
                fields: `
                    <div class="pf-field">
                        <label for="scrapAmount">Liczba sztuk</label>
                        <input id="scrapAmount" name="amount" type="number" min="1" step="1" required>
                    </div>
                    <div class="pf-field">
                        <label for="scrapReason">Przyczyna</label>
                        <select id="scrapReason" name="reason">
                            <option>Rozruch maszyny</option>
                            <option>Błąd druku</option>
                            <option>Uszkodzenie materiału</option>
                            <option>Niezgodność wymiarowa</option>
                            <option>Inna</option>
                        </select>
                    </div>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    const amount = Number(data.get("amount"));
                    if (!Number.isFinite(amount) || amount <= 0) return;
                    state.scrap += amount;
                    addEvent(`Zgłoszono ${formatNumber(amount)} braków`, `Przyczyna: ${data.get("reason")}.`, "warning");
                    closeModal();
                    showToast("Brak został zapisany.");
                }
            });
        }

        if (action === "failure") {
            if (!requireActive()) return;
            openModal({
                title: "Zgłoś awarię maszyny",
                description: "Produkcja zostanie oznaczona jako zatrzymana.",
                fields: `
                    <div class="pf-field">
                        <label for="failureType">Rodzaj awarii</label>
                        <select id="failureType" name="type">
                            <option>Układ prowadzenia wstęgi</option>
                            <option>Zespół drukujący</option>
                            <option>Układ UV</option>
                            <option>Napęd maszyny</option>
                            <option>Inna awaria</option>
                        </select>
                    </div>
                    <div class="pf-field">
                        <label for="failureNote">Opis</label>
                        <textarea id="failureNote" name="note" placeholder="Krótki opis problemu..."></textarea>
                    </div>
                `,
                onSubmit: form => {
                    const data = new FormData(form);
                    state.status = "issue";
                    state.downtimeMinutes += 1;
                    addEvent("Zgłoszono awarię", `${data.get("type")}${data.get("note") ? ` — ${data.get("note")}` : ""}`, "warning");
                    closeModal();
                    showToast("Awaria została zgłoszona.");
                }
            });
        }

        if (action === "material" || action === "warehouse-request") {
            if (!requireActive()) return;
            if (!state.materials.length) {
                showToast("Zlecenie nie ma przypisanej listy surowców.");
                return;
            }
            openModal({
                title: "Zapotrzebowanie materiałowe",
                description: "Wybierz surowiec przypisany do zlecenia. System zapisze zgłoszenie i automatycznie wyśle e-mail do magazynu.",
                fields: `
                    <div class="pf-field">
                        <label for="warehouseMaterial">Materiał z Karty Produkcyjnej</label>
                        <select id="warehouseMaterial" name="materialId" required>
                            <option value="">Wybierz surowiec</option>
                            ${state.materials.map(material => `<option value="${escapeHtml(material.id)}">${escapeHtml(formatMaterialOption(material))}</option>`).join("")}
                        </select>
                    </div>
                    <div class="operator-details-grid">
                        <div class="pf-field">
                            <label for="materialQuantity">Ilość</label>
                            <input id="materialQuantity" name="quantity" type="number" min="0.001" step="0.001" inputmode="decimal" required>
                        </div>
                        <div class="pf-field">
                            <label for="materialUnit">Jednostka</label>
                            <select id="materialUnit" name="unit" required>
                                <option value="kg">kg</option>
                                <option value="m">m</option>
                                <option value="szt.">szt.</option>
                                <option value="rolka">rolka</option>
                                <option value="opak.">opak.</option>
                            </select>
                        </div>
                    </div>
                    <div class="pf-field">
                        <label for="materialPriority">Priorytet</label>
                        <select id="materialPriority" name="priority">
                            <option>Wysoki</option>
                            <option>Normalny</option>
                        </select>
                    </div>
                `,
                onSubmit: async form => {
                    const data = new FormData(form);
                    const material = state.materials.find(
                        item => item.id === String(data.get("materialId") || "")
                    );
                    const quantityValue = Number(data.get("quantity"));
                    if (!material || !Number.isFinite(quantityValue) || quantityValue <= 0) {
                        showToast("Wybierz surowiec i wpisz prawidłową ilość.");
                        return;
                    }
                    const store = getStore();
                    const order = store.getOrder(
                        state.orderId
                    );
                    const issues = Array.isArray(
                        order?.warehouse?.issues
                    )
                        ? order.warehouse.issues
                        : [];
                    const issue = {
                        id: `material-${Date.now()}`,
                        materialId: material.id,
                        material: material.name,
                        materialCode: material.code,
                        quantity: `${formatNumber(quantityValue)} ${String(data.get("unit") || "")}`,
                        quantityValue,
                        unit: String(data.get("unit") || ""),
                        priority:
                            String(data.get("priority") || ""),
                        status: "open",
                        machine: state.machine,
                        requestedBy: state.operator,
                        shift: getShiftInfo().number,
                        emailRecipient: String(window.PRODFLOW_CONFIG?.warehouseEmail || ""),
                        createdAt:
                            new Date().toISOString()
                    };

                    store.updateOrder(
                        state.orderId,
                        {
                            warehouse: {
                                status: "issue",
                                issues: [...issues, issue]
                            }
                        },
                        {
                            module: "production",
                            historyMessage:
                                `Zgłoszono zapotrzebowanie na materiał: ${issue.material}.`
                        }
                    );

                    state.status = "issue";
                    addEvent("Zgłoszono brak materiału", `${issue.material} · ${issue.quantity} · priorytet ${issue.priority.toLowerCase()}.`, "warning");
                    closeModal();
                    showToast("Zapisano zgłoszenie. Wysyłanie wiadomości do magazynu…");
                    try {
                        const result = await sendWarehouseEmail(issue);
                        showToast(result?.message || "Wiadomość została przekazana do magazynu.");
                    } catch (error) {
                        showToast(
                            `Zgłoszenie zapisano, ale e-mail nie został wysłany: ${error?.message || "błąd serwera"}`
                        );
                    }
                }
            });
        }

        if (action === "note") {
            if (!requireActive()) return;
            openModal({
                title: "Dodaj notatkę",
                description: "Notatka zostanie zapisana w historii zlecenia.",
                fields: `
                    <div class="pf-field">
                        <label for="orderNote">Treść notatki</label>
                        <textarea id="orderNote" name="note" placeholder="Wpisz informację dla kolejnej zmiany..." required></textarea>
                    </div>
                `,
                onSubmit: form => {
                    const note = String(new FormData(form).get("note") || "").trim();
                    if (!note) return;

                    const store = getStore();
                    const order = store.getOrder(
                        state.orderId
                    );
                    const existingNotes =
                        order?.production?.notes || "";

                    store.updateOrder(
                        state.orderId,
                        {
                            production: {
                                notes: [
                                    existingNotes,
                                    note
                                ]
                                    .filter(Boolean)
                                    .join("\n")
                            }
                        },
                        {
                            module: "production",
                            historyMessage:
                                "Dodano notatkę operatora."
                        }
                    );

                    addEvent("Dodano notatkę operatora", note, "info");
                    closeModal();
                    showToast("Notatka została dodana.");
                }
            });
        }

        if (action === "toggle") {
            if (!state.orderId) {
                showToast("Brak zlecenia przekazanego z Planowania.");
                return;
            }

            if (state.status === "finished") {
                showToast("Zlecenie jest zakończone.");
                return;
            }

            if (state.status === "running") {
                state.status = "paused";
                addEvent("Produkcja wstrzymana", "Operator zatrzymał realizację zlecenia.", "warning");
                showToast("Produkcja została wstrzymana.");
            } else {
                const wasIssue = state.status === "issue";

                if (state.status === "waiting") {
                    const store = getStore();

                    store.updateStatus(
                        state.orderId,
                        "in_production",
                        {
                            processStep: "production",
                            module: "production",
                            message:
                                "Rozpoczęto produkcję zlecenia."
                        }
                    );

                    store.updateOrder(
                        state.orderId,
                        {
                            production: {
                                status: "running",
                                actualStart:
                                    new Date().toISOString()
                            }
                        },
                        {
                            addHistory: false,
                            module: "production"
                        }
                    );
                }

                state.status = "running";
                addEvent(wasIssue ? "Problem rozwiązany — produkcja wznowiona" : "Produkcja uruchomiona", "Rejestrowanie czasu pracy jest aktywne.", "success");
                showToast("Produkcja jest aktywna.");
            }
        }

        if (action === "finish") {
            if (!state.orderId) {
                showToast("Brak zlecenia przekazanego z Planowania.");
                return;
            }

            if (state.status === "finished") {
                showToast("Zlecenie jest już zakończone.");
                return;
            }
            const remaining = Math.max(0, state.planned - state.good);
            openModal({
                title: "Zakończyć zlecenie?",
                description: remaining > 0
                    ? `Do planu brakuje jeszcze ${formatNumber(remaining)} szt. Możesz mimo to zakończyć zlecenie.`
                    : "Planowana ilość została wykonana.",
                fields: `
                    <div class="pf-field">
                        <label for="finishNote">Uwagi końcowe</label>
                        <textarea id="finishNote" name="note" placeholder="Opcjonalne podsumowanie zmiany..."></textarea>
                    </div>
                `,
                onSubmit: form => {
                    const note = String(new FormData(form).get("note") || "").trim();

                    const store = getStore();
                    const finishedOrderId = state.orderId;
                    const finishedGood = state.good;
                    const finishedScrap = state.scrap;
                    const finishedOperator = state.operator;
                    const finishedDowntime = state.downtimeMinutes;
                    const finishedElapsed = state.elapsedSeconds;
                    const finishedSegments = [...state.timeSegments];
                    const finishedReports = [...state.reports];
                    const finishedWithdrawals = [...state.withdrawals];
                    const finishedPrintBatches = [...state.printBatches];
                    const finishedLineClearance = state.lineClearance
                        ? { ...state.lineClearance }
                        : null;
                    const finishedPalletChecks = state.palletChecks.map(record => ({ ...record }));
                    const finishedEvents = [...state.events];
                    const order = store.getOrder(finishedOrderId);
                    const existingNotes =
                        order?.production?.notes || "";

                    closeOpenSegment();
                    updateDowntimeTotal();
                    const completedProduction = {
                        status: "completed",
                        actualEnd: new Date().toISOString(),
                        operatorName: finishedOperator,
                        producedQuantity: finishedGood + finishedScrap,
                        goodQuantity: finishedGood,
                        rejectedQuantity: finishedScrap,
                        downtimeMinutes: finishedDowntime,
                        timeSegments: finishedSegments,
                        reports: finishedReports,
                        materialWithdrawals: finishedWithdrawals,
                        documentPrintBatches: finishedPrintBatches,
                        lineClearance: finishedLineClearance,
                        palletChecks: finishedPalletChecks,
                        notes: [existingNotes, note]
                            .filter(Boolean)
                            .join("\n")
                    };
                    const completionEvent = {
                        time: nowTime(),
                        title: "Zlecenie zakończone",
                        detail: note || `Wykonano ${formatNumber(finishedGood)} dobrych sztuk i zgłoszono ${formatNumber(finishedScrap)} braków.`,
                        type: "success"
                    };

                    closeModal();

                    store.updateStatus(
                        finishedOrderId,
                        "quality_control",
                        {
                            processStep: "quality",
                            module: "production",
                            message:
                                "Zakończono produkcję i przekazano zlecenie do kontroli jakości."
                        }
                    );

                    store.updateOrder(
                        finishedOrderId,
                        {
                            production: completedProduction,
                            metadata: {
                                productionRuntime: {
                                    status: "finished",
                                    elapsedSeconds: finishedElapsed,
                                    events: [...finishedEvents, completionEvent].slice(-100)
                                }
                            }
                        },
                        {
                            addHistory: false,
                            module: "production"
                        }
                    );

                    state.status = "finished";
                    showToast("Zlecenie zostało zamknięte.");
                }
            });
        }

        if (action === "close-modal") {
            closeModal();
        }
    }

    function init() {
        if (!document.querySelector(".pf-production")) return;

        loadStateFromStore();

        renderClock();
        const clockTimerId = window.setInterval(renderClock, 1000);
        window.addEventListener("prodflow:module-unload", () => {
            window.clearInterval(clockTimerId);
            if (timerId) {
                window.clearInterval(timerId);
                timerId = null;
            }
        }, { once: true });

        document.querySelector(".pf-production").addEventListener("click", event => {
            const reprintDocument = event.target.closest("[data-reprint-production-document]");
            if (reprintDocument) {
                const batch = state.printBatches.find(
                    item => item.id === reprintDocument.dataset.reprintProductionDocument
                );
                if (batch) printProductionDocument({ reprintBatch: batch });
                return;
            }
            const printDocument = event.target.closest("[data-print-production-document]");
            if (printDocument) {
                printProductionDocument();
                return;
            }

            const button = event.target.closest("[data-production-action]");
            if (!button) return;
            handleAction(button.dataset.productionAction, button);
        });

        $("#productionModalForm").addEventListener("submit", event => {
            event.preventDefault();
            if (modalSubmitHandler) modalSubmitHandler(event.currentTarget);
        });

        $("#productionOrderSelect")?.addEventListener("change", event => {
            if (["running", "paused", "issue"].includes(state.status)) {
                event.currentTarget.value = state.orderId;
                showToast("Najpierw zakończ aktywne zlecenie.");
                return;
            }
            const switchedFromSuspended = state.status === "suspended";
            loadStateFromStore(event.currentTarget.value);
            render();
            if (switchedFromSuspended) {
                showToast("Wybrano inne zlecenie. Zawieszone pozostaje na liście do późniejszego wznowienia.");
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && $("#productionModal")?.classList.contains("is-open")) {
                closeModal();
            }
        });

        [
            "store:order-created",
            "store:order-updated",
            "store:order-status-changed",
            "store:order-deleted",
            "store:database-changed",
            "store:database-imported",
            "store:database-cleared"
        ].forEach(name => window.ProdFlow?.events?.on(name, () => {
            if (!document.querySelector(".pf-production")) return;
            loadStateFromStore(state.orderId);
            render();
        }));

        render();
    }

    init();
})();
