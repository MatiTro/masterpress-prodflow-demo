(() => {
  "use strict";

  const root = document.getElementById("qualityComplaintsModule");
  if (!root) return;

  const SETTING_KEY = "quality.complaints";
  const TYPE_CONFIG = Object.freeze({
    material: {
      code: "RS",
      label: "Reklamacja surowca",
      short: "Surowiec",
      description: "Rejestracja niezgodności materiału otrzymanego od dostawcy.",
      required: ["qcSupplier", "qcMaterialIndex", "qcMaterialName", "qcBatch", "qcQuantity", "qcUnit"],
      categories: [
        ["dimensions", "Niezgodne wymiary lub gramatura"],
        ["damage", "Uszkodzenie mechaniczne"],
        ["contamination", "Zabrudzenie lub zanieczyszczenie"],
        ["appearance", "Kolor lub wygląd"],
        ["adhesive", "Właściwości kleju / powłoki"],
        ["quantity", "Niezgodna ilość"],
        ["documentation", "Dokumentacja lub identyfikacja"],
        ["other", "Inna niezgodność surowca"]
      ]
    },
    finished: {
      code: "RWG",
      label: "Reklamacja wyrobu gotowego",
      short: "Wyrób gotowy",
      description: "Rejestracja reklamacji klienta dotyczącej dostarczonego wyrobu.",
      required: ["qcCustomer", "qcProductionOrder", "qcProductIndex", "qcProductName", "qcFinishedBatch", "qcFinishedQuantity", "qcFinishedUnit"],
      categories: [
        ["dimensions", "Niezgodne wymiary wyrobu"],
        ["gluing", "Klejenie lub zamknięcie"],
        ["printing", "Grafika lub jakość druku"],
        ["barcode", "Kod kreskowy"],
        ["packaging", "Pakowanie lub uszkodzenie transportowe"],
        ["label", "Etykieta lub oznaczenie"],
        ["quantity", "Niezgodna ilość"],
        ["other", "Inna wada wyrobu"]
      ]
    },
    process: {
      code: "NP",
      label: "Niezgodność procesu",
      short: "Proces",
      description: "Wewnętrzne odstępstwo dotyczące maszyny, stanowiska, operatora lub przebiegu procesu.",
      required: ["qcArea", "qcEventAt"],
      categories: [
        ["machine", "Awaria lub niewłaściwa praca maszyny"],
        ["parameters", "Odchylenie parametrów procesu"],
        ["procedure", "Nieprzestrzeganie lub brak procedury"],
        ["human", "Błąd wykonania / czynnik ludzki"],
        ["material", "Brak lub niewłaściwy materiał"],
        ["measurement", "Błąd pomiaru lub kontroli"],
        ["safety", "Zdarzenie dotyczące bezpieczeństwa"],
        ["other", "Inna niezgodność procesu"]
      ]
    }
  });

  const COMMON_REQUIRED = [
    "qcReportedAt",
    "qcReporter",
    "qcPriority",
    "qcStatus",
    "qcCategory",
    "qcDescription",
    "qcImmediateAction"
  ];

  const FIELD_LABELS = Object.freeze({
    qcReportedAt: "Data zgłoszenia",
    qcReporter: "Zgłaszający",
    qcPriority: "Priorytet",
    qcStatus: "Status sprawy",
    qcSupplier: "Dostawca",
    qcMaterialIndex: "Indeks surowca",
    qcMaterialName: "Nazwa surowca",
    qcBatch: "Numer partii",
    qcQuantity: "Ilość reklamowana",
    qcUnit: "Jednostka",
    qcCustomer: "Klient",
    qcProductionOrder: "Numer zlecenia produkcyjnego",
    qcProductIndex: "Indeks wyrobu",
    qcProductName: "Nazwa wyrobu gotowego",
    qcFinishedBatch: "Partia wyrobu",
    qcFinishedQuantity: "Ilość reklamowana",
    qcFinishedUnit: "Jednostka",
    qcArea: "Obszar procesu",
    qcEventAt: "Data i godzina zdarzenia",
    qcCategory: "Kategoria niezgodności",
    qcDescription: "Opis niezgodności",
    qcImmediateAction: "Działanie natychmiastowe"
  });

  const VALUE_FIELDS = [
    "qcReportedAt", "qcReporter", "qcDepartment", "qcPriority", "qcStatus",
    "qcSupplier", "qcPurchaseOrder", "qcDeliveryNumber", "qcMaterialIndex",
    "qcMaterialName", "qcBatch", "qcWarehouse", "qcQuantity", "qcUnit",
    "qcCustomer", "qcCustomerOrder", "qcProductionOrder", "qcShipmentNumber",
    "qcProductIndex", "qcProductName", "qcFinishedBatch", "qcFinishedQuantity",
    "qcFinishedUnit", "qcArea", "qcMachine", "qcProcessOrder", "qcShift",
    "qcRelatedPerson", "qcEventAt", "qcDowntime", "qcCategory",
    "qcDetectionPoint", "qcDescription", "qcImmediateAction",
    "qcProductionBlocked", "qcSeverity", "qcRootCause", "qcCorrectiveAction",
    "qcPreventiveAction", "qcOwner", "qcDueDate", "qcDisposition"
  ];

  const STATUS_LABELS = Object.freeze({
    new: "Nowa",
    analysis: "W analizie",
    action: "Działania w toku",
    closed: "Zamknięta",
    rejected: "Odrzucona"
  });
  const PRIORITY_LABELS = Object.freeze({ low: "Niski", normal: "Normalny", high: "Wysoki", critical: "Krytyczny" });
  const DEPARTMENT_LABELS = Object.freeze({ quality: "Jakość", production: "Produkcja", warehouse: "Magazyn", planning: "Planowanie", sales: "Obsługa klienta", other: "Inny" });
  const AREA_LABELS = Object.freeze({ production: "Produkcja", printing: "Grafika i druk", warehouse: "Magazyn", quality: "Jakość", planning: "Planowanie", other: "Inny" });
  const BLOCKED_LABELS = Object.freeze({ no: "Brak zatrzymania", limited: "Produkcja ograniczona", yes: "Produkcja zatrzymana", unknown: "Do ustalenia" });
  const SEVERITY_LABELS = Object.freeze({ minor: "Mały", major: "Znaczący", critical: "Krytyczny" });

  const $ = id => root.querySelector(`#${id}`);
  const form = $("qcForm");
  let data = normalizeData(readStore().getSetting(SETTING_KEY, null));
  let activeType = "";
  let toastTimer = null;

  function readStore() {
    const store = window.ProdFlow?.store;
    if (!store?.getSetting || !store?.setSetting) {
      throw new Error("ProdFlow.store nie udostępnia rejestru reklamacji.");
    }
    return store;
  }

  function normalizeData(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      version: 1,
      records: Array.isArray(source.records)
        ? source.records.filter(record => record && TYPE_CONFIG[record.type])
        : []
    };
  }

  function saveData() {
    data = normalizeData(data);
    readStore().setSetting(SETTING_KEY, data);
  }

  function clean(value) { return String(value ?? "").trim(); }
  function normalize(value) {
    return clean(value).toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function escapeHtml(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function createId() {
    return `quality-claim-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }
  function localDateValue(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
  function localDateTimeValue(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
  function formatDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pl-PL", withTime
      ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }
  function numberText(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 }).format(number) : "—";
  }
  function userName() {
    const user = window.ProdFlow?.currentUser || {};
    return clean(user.displayName || user.name || user.username) || "Użytkownik ProdFlow";
  }

  function nextNumber(type) {
    const config = TYPE_CONFIG[type];
    const year = new Date().getFullYear();
    const prefix = `${config.code}/${year}/`;
    const highest = data.records
      .filter(record => String(record.number || "").startsWith(prefix))
      .reduce((max, record) => Math.max(max, Number(String(record.number).split("/").pop()) || 0), 0);
    return `${prefix}${String(highest + 1).padStart(5, "0")}`;
  }

  function categoryLabel(type, value) {
    return TYPE_CONFIG[type]?.categories.find(([key]) => key === value)?.[1] || value || "—";
  }

  function renderCategoryOptions(type, selected = "") {
    $("qcCategory").innerHTML = `<option value="">Wybierz kategorię</option>${TYPE_CONFIG[type].categories
      .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("")}`;
  }

  function setValue(id, value) {
    const element = $(id);
    if (element) element.value = value ?? "";
  }
  function getValue(id) { return $(id)?.value ?? ""; }

  function showTypeFields(type) {
    root.querySelectorAll("[data-qc-fields]").forEach(section => {
      section.hidden = section.dataset.qcFields !== type;
    });
    root.querySelectorAll("[data-qc-type]").forEach(button => {
      button.classList.toggle("is-selected", button.dataset.qcType === type);
    });
  }

  function beginForm(type, record = null) {
    const config = TYPE_CONFIG[type];
    if (!config) return;
    activeType = type;
    form.reset();
    root.querySelectorAll(".qc-field.is-invalid").forEach(field => field.classList.remove("is-invalid"));
    showTypeFields(type);
    renderCategoryOptions(type, record?.values?.qcCategory || "");

    $("qcRecordId").value = record?.id || "";
    $("qcNumber").value = record?.number || nextNumber(type);
    $("qcNumberPreview").textContent = $("qcNumber").value;
    $("qcReportedAt").value = record?.values?.qcReportedAt || localDateValue();
    $("qcReporter").value = record?.values?.qcReporter || userName();
    $("qcDepartment").value = record?.values?.qcDepartment || "quality";
    $("qcPriority").value = record?.values?.qcPriority || "normal";
    $("qcStatus").value = record?.values?.qcStatus || "new";
    $("qcProductionBlocked").value = record?.values?.qcProductionBlocked || "no";
    $("qcSeverity").value = record?.values?.qcSeverity || "minor";
    if (type === "process") $("qcEventAt").value = record?.values?.qcEventAt || localDateTimeValue();

    if (record?.values) {
      VALUE_FIELDS.forEach(id => {
        if (Object.prototype.hasOwnProperty.call(record.values, id)) setValue(id, record.values[id]);
      });
    }

    $("qcFormKicker").textContent = record ? "Edycja dokumentu" : "Nowe zgłoszenie";
    $("qcFormTitle").textContent = config.label;
    $("qcFormDescription").textContent = config.description;
    $("qcTypeBadge").textContent = config.short;
    $("qcIdentificationHint").textContent = type === "material"
      ? "Zidentyfikuj dostawcę, dostawę i reklamowaną partię surowca."
      : type === "finished"
        ? "Powiąż reklamację klienta z wyrobem, partią i zleceniem produkcyjnym."
        : "Zapisz obszar, czas i warunki wystąpienia niezgodności procesu.";
    $("qcWorkspace").hidden = false;
    updateCompleteness();
    $("qcWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function requiredIds() { return activeType ? [...COMMON_REQUIRED, ...TYPE_CONFIG[activeType].required] : []; }
  function isFilled(id) {
    const value = clean(getValue(id));
    if (["qcQuantity", "qcFinishedQuantity"].includes(id)) return Number(value) > 0;
    return Boolean(value);
  }

  function updateCompleteness() {
    const ids = requiredIds();
    const missing = ids.filter(id => !isFilled(id));
    const completed = ids.length - missing.length;
    const percent = ids.length ? Math.round((completed / ids.length) * 100) : 0;
    $("qcCompletenessValue").textContent = `${percent}%`;
    $("qcCompletenessBar").style.width = `${percent}%`;
    $("qcCompletenessRing").style.setProperty("--qc-progress", `${percent * 3.6}deg`);
    $("qcCompletenessText").textContent = missing.length
      ? `Do uzupełnienia pozostało ${missing.length} ${missing.length === 1 ? "pole" : "pól"}.`
      : "Dokument zawiera wszystkie dane wymagane do zapisu.";
    $("qcMissingFields").innerHTML = missing.length
      ? `<div class="qc-missing-list">${missing.map(id => `<span>${escapeHtml(FIELD_LABELS[id] || id)}</span>`).join("")}</div>`
      : '<div class="qc-ready">✓ Formularz gotowy do zapisu</div>';
  }

  function validateForm() {
    let first = null;
    requiredIds().forEach(id => {
      const element = $(id);
      const label = element?.closest(".qc-field");
      const invalid = !isFilled(id);
      label?.classList.toggle("is-invalid", invalid);
      if (invalid && !first) first = element;
    });
    updateCompleteness();
    if (first) {
      first.focus({ preventScroll: true });
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast(`Uzupełnij pole: ${FIELD_LABELS[first.id] || "wymagane dane"}.`, true);
      return false;
    }
    return true;
  }

  function collectRecord() {
    const existing = data.records.find(record => record.id === $("qcRecordId").value);
    const values = Object.fromEntries(VALUE_FIELDS.map(id => [id, getValue(id)]));
    return {
      id: existing?.id || createId(),
      number: clean($("qcNumber").value) || nextNumber(activeType),
      type: activeType,
      values,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: existing?.createdBy || userName(),
      updatedBy: userName()
    };
  }

  function saveRecord(options = {}) {
    if (!activeType || !validateForm()) return null;
    const record = collectRecord();
    const index = data.records.findIndex(item => item.id === record.id);
    if (index >= 0) data.records[index] = record;
    else data.records.push(record);
    saveData();
    $("qcRecordId").value = record.id;
    renderAll();
    if (!options.silent) showToast(index >= 0 ? "Zgłoszenie zostało zaktualizowane." : "Zgłoszenie zostało zapisane.");
    return record;
  }

  function recordSubject(record) {
    const values = record.values || {};
    if (record.type === "material") return {
      owner: clean(values.qcSupplier) || "—",
      subject: [values.qcMaterialIndex, values.qcMaterialName, values.qcBatch ? `partia ${values.qcBatch}` : ""].filter(Boolean).join(" · ") || "—"
    };
    if (record.type === "finished") return {
      owner: clean(values.qcCustomer) || "—",
      subject: [values.qcProductIndex, values.qcProductName, values.qcFinishedBatch ? `partia ${values.qcFinishedBatch}` : ""].filter(Boolean).join(" · ") || "—"
    };
    return {
      owner: AREA_LABELS[values.qcArea] || values.qcArea || "—",
      subject: [values.qcMachine, values.qcProcessOrder ? `zlecenie ${values.qcProcessOrder}` : ""].filter(Boolean).join(" · ") || "Niezgodność procesu"
    };
  }

  function renderMetrics() {
    $("qcMetricTotal").textContent = data.records.length;
    $("qcMetricNew").textContent = data.records.filter(record => record.values?.qcStatus === "new").length;
    $("qcMetricProgress").textContent = data.records.filter(record => ["analysis", "action"].includes(record.values?.qcStatus)).length;
    $("qcMetricClosed").textContent = data.records.filter(record => record.values?.qcStatus === "closed").length;
  }

  function renderRecords() {
    const query = normalize($("qcSearch").value);
    const status = $("qcStatusFilter").value;
    const rows = [...data.records]
      .filter(record => status === "all" || record.values?.qcStatus === status)
      .filter(record => !query || normalize(`${record.number} ${record.type} ${JSON.stringify(record.values || {})}`).includes(query))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    $("qcRecordsBody").innerHTML = rows.map(record => {
      const config = TYPE_CONFIG[record.type];
      const subject = recordSubject(record);
      const statusValue = record.values?.qcStatus || "new";
      const priority = record.values?.qcPriority || "normal";
      return `<tr>
        <td><strong>${escapeHtml(record.number)}</strong><small>${escapeHtml(formatDate(record.values?.qcReportedAt))}</small></td>
        <td><span class="qc-pill">${escapeHtml(config.short)}</span></td>
        <td><strong>${escapeHtml(subject.owner)}</strong><small>${escapeHtml(subject.subject)}</small></td>
        <td>${escapeHtml(categoryLabel(record.type, record.values?.qcCategory))}</td>
        <td>${escapeHtml(record.values?.qcOwner || "—")}</td>
        <td><span class="qc-pill is-${escapeHtml(priority)}">${escapeHtml(PRIORITY_LABELS[priority] || priority)}</span></td>
        <td><span class="qc-pill status-${escapeHtml(statusValue)}">${escapeHtml(STATUS_LABELS[statusValue] || statusValue)}</span></td>
        <td><div class="qc-table-actions"><button type="button" data-qc-edit="${escapeHtml(record.id)}">Otwórz</button><button class="is-pdf" type="button" data-qc-pdf="${escapeHtml(record.id)}">PDF</button></div></td>
      </tr>`;
    }).join("");
    $("qcEmpty").hidden = rows.length > 0;
  }

  function renderAll() { renderMetrics(); renderRecords(); }

  function detailRows(record) {
    const v = record.values || {};
    if (record.type === "material") return [
      ["Dostawca", v.qcSupplier], ["Zamówienie zakupu", v.qcPurchaseOrder],
      ["Dostawa / PZ", v.qcDeliveryNumber], ["Indeks surowca", v.qcMaterialIndex],
      ["Nazwa surowca", v.qcMaterialName], ["Numer partii", v.qcBatch],
      ["Magazyn / lokalizacja", v.qcWarehouse], ["Ilość reklamowana", `${numberText(v.qcQuantity)} ${v.qcUnit || ""}`]
    ];
    if (record.type === "finished") return [
      ["Klient", v.qcCustomer], ["Zamówienie klienta", v.qcCustomerOrder],
      ["Zlecenie produkcyjne", v.qcProductionOrder], ["Wysyłka / dostawa", v.qcShipmentNumber],
      ["Indeks wyrobu", v.qcProductIndex], ["Nazwa wyrobu", v.qcProductName],
      ["Partia / batch", v.qcFinishedBatch], ["Ilość reklamowana", `${numberText(v.qcFinishedQuantity)} ${v.qcFinishedUnit || ""}`]
    ];
    return [
      ["Obszar procesu", AREA_LABELS[v.qcArea] || v.qcArea], ["Maszyna / stanowisko", v.qcMachine],
      ["Numer zlecenia", v.qcProcessOrder], ["Zmiana", v.qcShift ? `${v.qcShift} zmiana` : "Nie dotyczy"],
      ["Stanowisko / osoba", v.qcRelatedPerson], ["Data i godzina zdarzenia", formatDate(v.qcEventAt, true)],
      ["Czas przestoju", v.qcDowntime ? `${numberText(v.qcDowntime)} min` : "—"]
    ];
  }

  function printDocument(record) {
    const config = TYPE_CONFIG[record.type];
    const v = record.values || {};
    const logoUrl = new URL("assets/images/logoczarne.png", document.baseURI).href;
    const cells = detailRows(record).map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
    const printWindow = window.open("", "_blank", "width=1050,height=820");
    if (!printWindow) { showToast("Przeglądarka zablokowała okno dokumentu.", true); return; }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${escapeHtml(record.number)} · ${escapeHtml(config.label)}</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#17283a;font:9px Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      header{display:grid;grid-template-columns:155px 1fr 180px;align-items:center;min-height:72px;border:1.5px solid #173e63}header>div{padding:10px;border-left:1px solid #9aabb9}header>div:first-child{border-left:0}header img{display:block;width:135px;height:auto;margin:auto}h1{margin:0;color:#002855;font-size:19px;text-align:center}header p{margin:4px 0 0;color:#5a6e80;text-align:center}.doc{text-align:right}.doc strong,.doc span{display:block}.doc span{margin-top:5px;color:#627585}
      .meta,.details{display:grid;grid-template-columns:repeat(4,1fr);margin-top:7px;border:1px solid #7890a3}.meta div,.details div{min-height:50px;padding:8px;border-left:1px solid #a8b6c1;border-top:1px solid #a8b6c1}.meta div:nth-child(-n+4),.details div:nth-child(-n+4){border-top:0}.meta div:nth-child(4n+1),.details div:nth-child(4n+1){border-left:0}.meta span,.meta strong,.details span,.details strong{display:block}.meta span,.details span{color:#607485;font-size:7px;font-weight:700;text-transform:uppercase}.meta strong,.details strong{margin-top:5px;font-size:10px;overflow-wrap:anywhere}
      h2{margin:11px 0 5px;color:#002855;font-size:12px;text-transform:uppercase}.block{border:1px solid #7890a3}.block>div{padding:8px;border-top:1px solid #a8b6c1}.block>div:first-child{border-top:0}.block span,.block strong{display:block}.block span{color:#607485;font-size:7px;font-weight:700;text-transform:uppercase}.block strong{min-height:24px;margin-top:4px;font-size:9px;line-height:1.4;white-space:pre-wrap}.two{display:grid;grid-template-columns:1fr 1fr}.two>div:nth-child(2){border-top:0;border-left:1px solid #a8b6c1}
      .decision{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #7890a3}.decision div{min-height:52px;padding:8px;border-left:1px solid #a8b6c1}.decision div:first-child{border-left:0}.decision span,.decision strong{display:block}.decision span{color:#607485;font-size:7px;text-transform:uppercase}.decision strong{margin-top:5px;font-size:9px}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}.signatures div{min-height:55px;padding-top:35px;border-bottom:1px solid #52697c;color:#607485;text-align:center}.foot{display:flex;justify-content:space-between;margin-top:9px;color:#718493;font-size:7px}
      @media screen{body{max-width:210mm;margin:18px auto;padding:10mm;box-shadow:0 12px 45px rgba(0,0,0,.18)}}@media print{body{padding:0;box-shadow:none}}
    </style></head><body>
      <header><div><img src="${escapeHtml(logoUrl)}" alt="Masterpress"></div><div><h1>${escapeHtml(config.label)}</h1><p>Formularz reklamacji / niezgodności jakościowej</p></div><div class="doc"><strong>${escapeHtml(record.number)}</strong><span>Status: ${escapeHtml(STATUS_LABELS[v.qcStatus] || v.qcStatus)}</span><span>Wygenerowano: ${escapeHtml(formatDate(new Date().toISOString(), true))}</span></div></header>
      <section class="meta"><div><span>Data zgłoszenia</span><strong>${escapeHtml(formatDate(v.qcReportedAt))}</strong></div><div><span>Zgłaszający</span><strong>${escapeHtml(v.qcReporter || "—")}</strong></div><div><span>Dział</span><strong>${escapeHtml(DEPARTMENT_LABELS[v.qcDepartment] || v.qcDepartment || "—")}</strong></div><div><span>Priorytet / skutek</span><strong>${escapeHtml(PRIORITY_LABELS[v.qcPriority] || v.qcPriority)} / ${escapeHtml(SEVERITY_LABELS[v.qcSeverity] || v.qcSeverity)}</strong></div></section>
      <h2>Dane identyfikacyjne</h2><section class="details">${cells}</section>
      <h2>Opis niezgodności</h2><section class="block"><div><span>Kategoria</span><strong>${escapeHtml(categoryLabel(record.type,v.qcCategory))}</strong></div><div><span>Miejsce wykrycia</span><strong>${escapeHtml(v.qcDetectionPoint || "—")}</strong></div><div><span>Opis stwierdzonej niezgodności</span><strong>${escapeHtml(v.qcDescription || "—")}</strong></div><div><span>Działanie natychmiastowe / zabezpieczające</span><strong>${escapeHtml(v.qcImmediateAction || "—")}</strong></div><div class="two"><div><span>Wpływ na produkcję</span><strong>${escapeHtml(BLOCKED_LABELS[v.qcProductionBlocked] || v.qcProductionBlocked || "—")}</strong></div><div><span>Poziom skutku</span><strong>${escapeHtml(SEVERITY_LABELS[v.qcSeverity] || v.qcSeverity || "—")}</strong></div></div></section>
      <h2>Analiza przyczyny i działania CAPA</h2><section class="block"><div><span>Przyczyna źródłowa</span><strong>${escapeHtml(v.qcRootCause || "Nie uzupełniono.")}</strong></div><div><span>Działanie korygujące</span><strong>${escapeHtml(v.qcCorrectiveAction || "Nie uzupełniono.")}</strong></div><div><span>Działanie zapobiegawcze</span><strong>${escapeHtml(v.qcPreventiveAction || "Nie uzupełniono.")}</strong></div><div><span>Decyzja / sposób postępowania</span><strong>${escapeHtml(v.qcDisposition || "Nie uzupełniono.")}</strong></div></section>
      <h2>Odpowiedzialność i termin</h2><section class="decision"><div><span>Osoba odpowiedzialna</span><strong>${escapeHtml(v.qcOwner || "—")}</strong></div><div><span>Termin realizacji</span><strong>${escapeHtml(formatDate(v.qcDueDate))}</strong></div><div><span>Status sprawy</span><strong>${escapeHtml(STATUS_LABELS[v.qcStatus] || v.qcStatus)}</strong></div></section>
      <section class="signatures"><div>Zgłaszający / podpis</div><div>Osoba odpowiedzialna / podpis</div><div>Akceptacja działu jakości / podpis</div></section>
      <div class="foot"><span>Dokument wygenerowany w ProdFlow · Masterpress S.A.</span><span>Utworzył: ${escapeHtml(record.createdBy || "—")} · aktualizacja: ${escapeHtml(formatDate(record.updatedAt,true))}</span></div>
      <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script>
    </body></html>`);
    printWindow.document.close();
  }

  function showToast(message, error = false) {
    const toast = $("qcToast");
    toast.textContent = message;
    toast.classList.toggle("is-error", error);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3300);
  }

  root.querySelectorAll("[data-qc-type]").forEach(button => button.addEventListener("click", () => beginForm(button.dataset.qcType)));
  $("qcNewRecord").addEventListener("click", () => {
    activeType = "";
    $("qcWorkspace").hidden = true;
    root.querySelectorAll("[data-qc-type]").forEach(button => button.classList.remove("is-selected"));
    $("qcTypePanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("qcCancelEdit").addEventListener("click", () => {
    $("qcWorkspace").hidden = true;
    activeType = "";
    root.querySelectorAll("[data-qc-type]").forEach(button => button.classList.remove("is-selected"));
    $("qcTypePanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    saveRecord();
  });
  $("qcSaveAndPrint").addEventListener("click", () => {
    const record = saveRecord({ silent: true });
    if (record) {
      showToast("Zgłoszenie zapisane. Otwieram dokument PDF.");
      printDocument(record);
    }
  });
  form.addEventListener("input", event => {
    event.target.closest(".qc-field")?.classList.remove("is-invalid");
    updateCompleteness();
  });
  form.addEventListener("change", event => {
    event.target.closest(".qc-field")?.classList.remove("is-invalid");
    updateCompleteness();
  });
  $("qcSearch").addEventListener("input", renderRecords);
  $("qcStatusFilter").addEventListener("change", renderRecords);
  $("qcRecordsBody").addEventListener("click", event => {
    const edit = event.target.closest("[data-qc-edit]");
    const pdf = event.target.closest("[data-qc-pdf]");
    const id = edit?.dataset.qcEdit || pdf?.dataset.qcPdf;
    const record = data.records.find(item => item.id === id);
    if (!record) return;
    if (edit) beginForm(record.type, record);
    if (pdf) printDocument(record);
  });

  renderAll();
})();
