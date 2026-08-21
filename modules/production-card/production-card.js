/* =========================================================
   ProdFlow — Karta Produkcyjna v2
   File: production-card-v2.js
   ========================================================= */

(function () {
  "use strict";

const MODULE_SCRIPT_URL =
  document.currentScript?.src || "";
const ACTIVE_ORDER_KEY = "prodflow.activeOrderId";

const HISTORY_LIMIT = 40;
const AUTO_SAVE_DELAY = 700;

let currentOrderId = sessionStorage.getItem(
  ACTIVE_ORDER_KEY
) || "";

  const MODULE_SELECTOR = "#productionCardV2";

  let root = null;
  let autoSaveTimer = null;
  let toastTimer = null;
  let inkCounter = 0;
  let isRestoringData = false;
  let graphicPdfAttachment = null;

  /* =======================================================
     KONFIGURACJA RODZAJÓW WYROBU
     ======================================================= */

  const PRODUCT_TYPES = {
    TDB: {
      code: "TDB",
      name: "Torba dolna bez uchwytu",
      description:
        "Podstawowy wzór koperty z dolnym zamknięciem i bocznymi strefami klejenia.",
      render: renderEnvelopeTDB
    },

    TDBH: {
      code: "TDBH",
      name: "Torba dolna z dodatkowym zamknięciem",
      description:
        "Koperta z dolnym zamknięciem oraz dodatkową klapą zamykającą u góry.",
      render: renderEnvelopeTDBH
    },

    TDBD: {
      code: "TDBD",
      name: "Torba dolna dwustronna",
      description:
        "Konstrukcja dwustronna z symetrycznymi strefami składania i klejenia.",
      render: renderEnvelopeTDBD
    },

    TVB: {
      code: "TVB",
      name: "Torba V-bottom",
      description:
        "Koperta ze spodem typu V-bottom, przeznaczona do szybkiego automatycznego składania.",
      render: renderEnvelopeTVB
    }
  };

  /* =======================================================
     POLA FORMULARZA
     ======================================================= */

  const FIELD_IDS = [
    "orderNumber",
    "clientOrderNumber",
    "printOrderNumber",
    "priority",
    "client",
    "clientIndex",
    "responsiblePerson",

    "productIndex",
    "orderQty",
    "productName",
    "ppwrWidth",
    "ppwrHeight",
    "ppwrFlap",
    "ppwrBottomGusset",
    "ppwrAdhesiveStrips",
    "ppwrTearStrip",
    "productType",

    "paperIndex",
    "paperName",
    "paperSize",

    "glue1Select",
    "glue2Select",
    "glue3Select",

    "embossedPaperCheckbox",
    "bublakPaperIndex",
    "bublakPaperName",
    "bublakPaperSize",

    "corner",
    "wrapping",
    "siliconeSelect",

    "graphicNumber",
    "colorCount",
    "printMethodSelect",
    "printRoll",
    "plannedStartDate",

    "palletSizeSelect",
    "palletTypeSelect",
    "cartonSelect",
    "qtyCarton",
    "qtyPallet",
    "qtyLayer",

    "labelTypeSelect",
    "deliveryDate",
    "notes"
  ];

  /* =======================================================
     START MODUŁU
     ======================================================= */

  function init() {
    root = document.querySelector(MODULE_SELECTOR);

    if (!root) {
      return;
    }

    if (root.dataset.initialized === "true") {
      return;
    }

    root.dataset.initialized = "true";

    bindSectionToggles();
    bindProductTypes();
    bindProcessSteps();
    bindFormEvents();
    bindActionButtons();
    bindMaterialButtons();
    bindSpecialFields();
    bindGraphicAttachment();

    restoreCard();
    ensureInitialInkRow();
    renderEnvelope(getValue("productType"));

    updateAllViews();
    renderOrderManager();
  }

  /* =======================================================
     POMOCNICZE FUNKCJE DOM
     ======================================================= */

  function getElement(id) {
    return root ? root.querySelector(`#${id}`) : null;
  }

  function query(selector) {
    return root ? root.querySelector(selector) : null;
  }

  function queryAll(selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function getValue(id) {
    const element = getElement(id);

    if (!element) {
      return "";
    }

    if (element.type === "checkbox") {
      return element.checked;
    }

    return element.value ?? "";
  }

  function setValue(id, value) {
    const element = getElement(id);

    if (!element) {
      return;
    }

    if (element.type === "checkbox") {
      element.checked = Boolean(value);
      return;
    }

    element.value = value ?? "";
  }

  function safeText(value, fallback = "—") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createId(prefix = "item") {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function toNumber(value) {
    const normalized = String(value ?? "")
      .replace(",", ".")
      .trim();

    const number = Number(normalized);

    return Number.isFinite(number) ? number : 0;
  }

  function normalizeTearType(value, legacyPerforation = "") {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();

    if (
      normalized === "perforacja" ||
      normalized === "papier" ||
      String(legacyPerforation).toLowerCase() === "tak"
    ) {
      return "perforacja";
    }

    if (
      normalized === "folia" ||
      normalized === "plastik"
    ) {
      return "folia";
    }

    return "";
  }

  function tearTypeLabel(value) {
    return {
      folia: "Folia",
      perforacja: "Perforacja"
    }[normalizeTearType(value)] || "Brak";
  }

  function orderStatusLabel(order) {
    const labels = {
      draft: "Robocza",
      new: "Nowa",
      planned: "W planowaniu",
      in_production: "W produkcji",
      suspended: "Zawieszona",
      dropped: "Spadnięta - do przeplanowania",
      quality_control: "Kontrola jakości",
      packing: "Pakowanie",
      warehouse: "Magazyn",
      completed: "Zakończona",
      cancelled: "Anulowana"
    };

    return labels[order?.status] || "Zapisana";
  }

  function debounceAutoSave() {
    if (isRestoringData) {
      return;
    }

    window.clearTimeout(autoSaveTimer);

    markAsUnsaved();

    autoSaveTimer = window.setTimeout(() => {
      saveCard({
        silent: true,
        historyMessage: "Automatyczny zapis zmian"
      });
    }, AUTO_SAVE_DELAY);
  }

  /* =======================================================
     SEKCJE ZWIJANE
     ======================================================= */

  function bindSectionToggles() {
    queryAll("[data-section-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const sectionName = button.dataset.sectionToggle;
        const section = query(`[data-section="${sectionName}"]`);

        if (!section) {
          return;
        }

        section.classList.toggle("is-open");
      });
    });
  }

  /* =======================================================
     RODZAJE WYROBU
     ======================================================= */

  function bindProductTypes() {
    queryAll("[data-product-type]").forEach((button) => {
      button.addEventListener("click", () => {
        setProductType(button.dataset.productType);
      });
    });
  }

  function setProductType(typeCode, options = {}) {
    const type = PRODUCT_TYPES[typeCode] || null;

    setValue("productType", type?.code || "");

    queryAll("[data-product-type]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        Boolean(type) &&
          button.dataset.productType === type.code
      );
    });

    renderEnvelope(type?.code || "");
    updateSummary();
    updateCompleteness();

    if (!options.silent && type) {
      addHistory(
        "Zmieniono rodzaj wyrobu",
        `${type.code} — ${type.name}`
      );

      debounceAutoSave();
    }
  }

  function renderEnvelope(typeCode) {
    const type = PRODUCT_TYPES[typeCode] || null;
    const container = getElement("envelopeShape");
    const title = getElement("envelopePreviewTitle");
    const description = getElement("envelopePreviewDescription");

    if (!container) {
      return;
    }

    if (!type) {
      if (title) {
        title.textContent = "Wybierz rodzaj wyrobu";
      }

      if (description) {
        description.textContent =
          "Schemat pojawi się po wybraniu rodzaju wyrobu.";
      }

      container.innerHTML = "";
      return;
    }

    if (title) {
      title.textContent = type.code;
    }

    if (description) {
      description.textContent = type.description;
    }

    container.innerHTML = type.render();
  }

  /* =======================================================
     SCHEMATY KOPERT
     ======================================================= */

  function renderEnvelopeTDB() {
    return `
      <g>
        <path
          class="envelope-paper"
          d="
            M130 62
            L510 62
            L510 325
            L450 325
            L420 370
            L220 370
            L190 325
            L130 325
            Z
          ">
        </path>

        <path
          class="envelope-pattern"
          d="
            M130 62
            L510 62
            L510 325
            L450 325
            L420 370
            L220 370
            L190 325
            L130 325
            Z
          ">
        </path>

        <rect
          class="envelope-glue"
          x="130"
          y="78"
          width="38"
          height="225"
          rx="5">
        </rect>

        <rect
          class="envelope-glue"
          x="472"
          y="78"
          width="38"
          height="225"
          rx="5">
        </rect>

        <line
          class="envelope-fold"
          x1="190"
          y1="62"
          x2="190"
          y2="325">
        </line>

        <line
          class="envelope-fold"
          x1="450"
          y1="62"
          x2="450"
          y2="325">
        </line>

        <line
          class="envelope-fold"
          x1="190"
          y1="325"
          x2="450"
          y2="325">
        </line>

        <path
          class="envelope-fold"
          d="M220 370 L250 325">
        </path>

        <path
          class="envelope-fold"
          d="M420 370 L390 325">
        </path>

        <text
          class="envelope-label"
          x="320"
          y="185">
          TDB
        </text>

        <text
          class="envelope-dimension"
          x="320"
          y="212">
          powierzchnia główna
        </text>

        ${renderHorizontalDimension(190, 450, 42, "szerokość")}
        ${renderVerticalDimension(540, 62, 325, "wysokość")}
      </g>
    `;
  }

  function renderEnvelopeTDBH() {
    return `
      <g>
        <path
          class="envelope-paper"
          d="
            M130 98
            L180 98
            L205 45
            L435 45
            L460 98
            L510 98
            L510 320
            L450 320
            L420 370
            L220 370
            L190 320
            L130 320
            Z
          ">
        </path>

        <path
          class="envelope-pattern"
          d="
            M130 98
            L180 98
            L205 45
            L435 45
            L460 98
            L510 98
            L510 320
            L450 320
            L420 370
            L220 370
            L190 320
            L130 320
            Z
          ">
        </path>

        <rect
          class="envelope-glue"
          x="130"
          y="112"
          width="38"
          height="190"
          rx="5">
        </rect>

        <rect
          class="envelope-glue"
          x="472"
          y="112"
          width="38"
          height="190"
          rx="5">
        </rect>

        <rect
          class="envelope-tear"
          x="218"
          y="62"
          width="204"
          height="18"
          rx="5">
        </rect>

        <line
          class="envelope-fold"
          x1="180"
          y1="98"
          x2="460"
          y2="98">
        </line>

        <line
          class="envelope-fold"
          x1="190"
          y1="98"
          x2="190"
          y2="320">
        </line>

        <line
          class="envelope-fold"
          x1="450"
          y1="98"
          x2="450"
          y2="320">
        </line>

        <line
          class="envelope-fold"
          x1="190"
          y1="320"
          x2="450"
          y2="320">
        </line>

        <path
          class="envelope-fold"
          d="M220 370 L250 320">
        </path>

        <path
          class="envelope-fold"
          d="M420 370 L390 320">
        </path>

        <text
          class="envelope-label"
          x="320"
          y="190">
          TDBH
        </text>

        <text
          class="envelope-dimension"
          x="320"
          y="217">
          klapa zamykająca
        </text>

        ${renderHorizontalDimension(190, 450, 28, "szerokość")}
        ${renderVerticalDimension(540, 98, 320, "wysokość")}
      </g>
    `;
  }

  function renderEnvelopeTDBD() {
    return `
      <g>
        <path
          class="envelope-paper"
          d="
            M92 82
            L548 82
            L548 320
            L485 320
            L450 370
            L190 370
            L155 320
            L92 320
            Z
          ">
        </path>

        <path
          class="envelope-pattern"
          d="
            M92 82
            L548 82
            L548 320
            L485 320
            L450 370
            L190 370
            L155 320
            L92 320
            Z
          ">
        </path>

        <rect
          class="envelope-glue"
          x="92"
          y="100"
          width="35"
          height="202"
          rx="5">
        </rect>

        <rect
          class="envelope-glue"
          x="513"
          y="100"
          width="35"
          height="202"
          rx="5">
        </rect>

        <rect
          class="envelope-glue"
          x="292"
          y="95"
          width="56"
          height="210"
          rx="5">
        </rect>

        <line
          class="envelope-fold"
          x1="155"
          y1="82"
          x2="155"
          y2="320">
        </line>

        <line
          class="envelope-fold"
          x1="292"
          y1="82"
          x2="292"
          y2="320">
        </line>

        <line
          class="envelope-fold"
          x1="348"
          y1="82"
          x2="348"
          y2="320">
        </line>

        <line
          class="envelope-fold"
          x1="485"
          y1="82"
          x2="485"
          y2="320">
        </line>

        <line
          class="envelope-fold"
          x1="155"
          y1="320"
          x2="485"
          y2="320">
        </line>

        <path
          class="envelope-fold"
          d="M190 370 L225 320">
        </path>

        <path
          class="envelope-fold"
          d="M450 370 L415 320">
        </path>

        <text
          class="envelope-label"
          x="222"
          y="190">
          A
        </text>

        <text
          class="envelope-label"
          x="418"
          y="190">
          B
        </text>

        <text
          class="envelope-dimension"
          x="320"
          y="347">
          TDBD — układ dwustronny
        </text>

        ${renderHorizontalDimension(155, 485, 60, "szerokość całkowita")}
        ${renderVerticalDimension(578, 82, 320, "wysokość")}
      </g>
    `;
  }

  function renderEnvelopeTVB() {
    return `
      <g>
        <path
          class="envelope-paper"
          d="
            M135 62
            L505 62
            L505 290
            L450 290
            L395 360
            L320 390
            L245 360
            L190 290
            L135 290
            Z
          ">
        </path>

        <path
          class="envelope-pattern"
          d="
            M135 62
            L505 62
            L505 290
            L450 290
            L395 360
            L320 390
            L245 360
            L190 290
            L135 290
            Z
          ">
        </path>

        <rect
          class="envelope-glue"
          x="135"
          y="78"
          width="38"
          height="195"
          rx="5">
        </rect>

        <rect
          class="envelope-glue"
          x="467"
          y="78"
          width="38"
          height="195"
          rx="5">
        </rect>

        <line
          class="envelope-fold"
          x1="190"
          y1="62"
          x2="190"
          y2="290">
        </line>

        <line
          class="envelope-fold"
          x1="450"
          y1="62"
          x2="450"
          y2="290">
        </line>

        <line
          class="envelope-fold"
          x1="190"
          y1="290"
          x2="450"
          y2="290">
        </line>

        <path
          class="envelope-fold"
          d="M245 360 L275 290">
        </path>

        <path
          class="envelope-fold"
          d="M395 360 L365 290">
        </path>

        <path
          class="envelope-fold"
          d="M245 360 L320 390 L395 360">
        </path>

        <text
          class="envelope-label"
          x="320"
          y="180">
          TVB
        </text>

        <text
          class="envelope-dimension"
          x="320"
          y="207">
          spód typu V
        </text>

        ${renderHorizontalDimension(190, 450, 42, "szerokość")}
        ${renderVerticalDimension(535, 62, 290, "wysokość")}
      </g>
    `;
  }

  function renderHorizontalDimension(x1, x2, y, label) {
    const center = (x1 + x2) / 2;

    return `
      <g>
        <line
          class="envelope-arrow"
          x1="${x1}"
          y1="${y}"
          x2="${x2}"
          y2="${y}">
        </line>

        <path
          class="envelope-arrow"
          d="M${x1} ${y} L${x1 + 10} ${y - 5} M${x1} ${y} L${x1 + 10} ${y + 5}">
        </path>

        <path
          class="envelope-arrow"
          d="M${x2} ${y} L${x2 - 10} ${y - 5} M${x2} ${y} L${x2 - 10} ${y + 5}">
        </path>

        <text
          class="envelope-dimension"
          x="${center}"
          y="${y - 8}">
          ${label}
        </text>
      </g>
    `;
  }

  function renderVerticalDimension(x, y1, y2, label) {
    const center = (y1 + y2) / 2;

    return `
      <g>
        <line
          class="envelope-arrow"
          x1="${x}"
          y1="${y1}"
          x2="${x}"
          y2="${y2}">
        </line>

        <path
          class="envelope-arrow"
          d="M${x} ${y1} L${x - 5} ${y1 + 10} M${x} ${y1} L${x + 5} ${y1 + 10}">
        </path>

        <path
          class="envelope-arrow"
          d="M${x} ${y2} L${x - 5} ${y2 - 10} M${x} ${y2} L${x + 5} ${y2 - 10}">
        </path>

        <text
          class="envelope-dimension"
          x="${x + 16}"
          y="${center}"
          transform="rotate(90 ${x + 16} ${center})">
          ${label}
        </text>
      </g>
    `;
  }

  /* =======================================================
     STATUS PROCESU
     ======================================================= */

  function bindProcessSteps() {
    queryAll("[data-process-step]").forEach((button) => {
      button.addEventListener("click", () => {
        setProcessStep(button.dataset.processStep);
      });
    });
  }

  function setProcessStep(stepName, options = {}) {
    const steps = queryAll("[data-process-step]");

    if (!steps.length) {
      root.dataset.processStep =
        stepName || "card";
      return;
    }

    const activeIndex = steps.findIndex(
      (step) => step.dataset.processStep === stepName
    );

    if (activeIndex < 0) {
      return;
    }

    steps.forEach((step, index) => {
      step.classList.toggle("is-active", index === activeIndex);
      step.classList.toggle("is-complete", index < activeIndex);
    });

    root.dataset.processStep = stepName;

    updateMainStatus(stepName);

    if (!options.silent) {
      const activeButton = steps[activeIndex];
      const label =
        activeButton.querySelector("strong")?.textContent || stepName;

      addHistory("Zmieniono etap procesu", label);
      debounceAutoSave();
    }
  }

  function updateMainStatus(stepName) {
    const statusPill = getElement("mainStatusPill");

    if (!statusPill) {
      return;
    }

    const statuses = {
      card: {
        label: "Przygotowanie karty",
        className: "pf-status-pill--draft"
      },

      planning: {
        label: "Planowanie",
        className: "pf-status-pill--draft"
      },

      materials: {
        label: "Weryfikacja materiałów",
        className: "pf-status-pill--warning"
      },

      production: {
        label: "W produkcji",
        className: "pf-status-pill--warning"
      },

      quality: {
        label: "Kontrola jakości",
        className: "pf-status-pill--warning"
      },

      packing: {
        label: "Pakowanie",
        className: "pf-status-pill--draft"
      },

      shipment: {
        label: "Gotowe do wysyłki",
        className: "pf-status-pill--success"
      }
    };

    const status = statuses[stepName] || statuses.card;

    statusPill.className = `pf-status-pill ${status.className}`;
    statusPill.textContent = status.label;
  }

  /* =======================================================
     ZDARZENIA FORMULARZA
     ======================================================= */

  function bindFormEvents() {
    FIELD_IDS.forEach((fieldId) => {
      const element = getElement(fieldId);

      if (!element) {
        return;
      }

      const eventName =
        element.tagName === "SELECT" ||
        element.type === "checkbox" ||
        element.type === "date"
          ? "change"
          : "input";

      element.addEventListener(eventName, () => {
        handleFieldChange(fieldId);
      });

      if (eventName !== "input") {
        element.addEventListener("input", () => {
          handleFieldChange(fieldId);
        });
      }
    });
  }

  function handleFieldChange(fieldId) {
    if (fieldId === "embossedPaperCheckbox") {
      updateEmbossedPaperVisibility();
    }

    if (fieldId === "siliconeSelect") {
      renderSiliconeFields();
    }

    if (
      fieldId === "orderQty" ||
      fieldId === "qtyCarton" ||
      fieldId === "qtyPallet"
    ) {
      updatePackingCalculations();
    }

    clearFieldError(fieldId);
    updateAllViews();
    debounceAutoSave();
  }

  /* =======================================================
     FARBY
     ======================================================= */

  function bindMaterialButtons() {
    const addInkButton = getElement("addInkBtn");

    addInkButton?.addEventListener("click", () => {
      addInkRow();

      addHistory(
        "Dodano materiał",
        "Dodano nową pozycję farby"
      );

      debounceAutoSave();
    });
  }

  function ensureInitialInkRow() {
    const container = getElement("inksContainer");

    if (!container || container.children.length > 0) {
      return;
    }

    addInkRow(
      {
        index: "",
        description: "",
        status: "available"
      },
      {
        silent: true
      }
    );
  }

  function addInkRow(data = {}, options = {}) {
    const container = getElement("inksContainer");

    if (!container) {
      return;
    }

    inkCounter += 1;

    const rowId = data.id || createId(`ink-${inkCounter}`);
    const row = document.createElement("div");

    row.className = "pf-material-row";
    row.dataset.inkId = rowId;

    row.innerHTML = `
      <input
        type="text"
        class="pf-ink-index"
        placeholder="np. 900012345"
        value="${escapeHtml(data.index || "")}">

      <input
        type="text"
        class="pf-ink-description"
        placeholder="Opis / kolor"
        value="${escapeHtml(data.description || "")}">

      <select class="pf-material-status pf-ink-status">
        ${renderOptions(
          [
            { value: "available", label: "Dostępny" },
            { value: "missing", label: "Brak" },
            { value: "ordered", label: "Zamówiony" }
          ],
          ["available", "missing", "ordered"].includes(data.status)
            ? data.status
            : "available"
        )}
      </select>

      <button
        type="button"
        class="pf-material-remove"
        aria-label="Usuń farbę"
        title="Usuń farbę">
        ×
      </button>
    `;

    container.appendChild(row);

    row
      .querySelectorAll("input, select")
      .forEach((element) => {
        element.addEventListener("input", () => {
          updateCompleteness();
          debounceAutoSave();
        });

        element.addEventListener("change", () => {
          updateCompleteness();
          debounceAutoSave();
        });
      });

    row
      .querySelector(".pf-material-remove")
      ?.addEventListener("click", () => {
        row.remove();

        addHistory(
          "Usunięto materiał",
          "Usunięto pozycję farby"
        );

        updateCompleteness();
        debounceAutoSave();
      });

    if (!options.silent) {
      updateCompleteness();
    }
  }

  function renderOptions(options, selectedValue) {
    return options
      .map((option) => {
        const selected =
          String(option.value) === String(selectedValue)
            ? "selected"
            : "";

        return `
          <option
            value="${escapeHtml(option.value)}"
            ${selected}>
            ${escapeHtml(option.label)}
          </option>
        `;
      })
      .join("");
  }

  function collectInks() {
    return queryAll(".pf-material-row").map((row) => ({
      id: row.dataset.inkId,
      index:
        row.querySelector(".pf-ink-index")?.value || "",
      description:
        row.querySelector(".pf-ink-description")?.value || "",
      status:
        row.querySelector(".pf-ink-status")?.value || "available"
    }));
  }

  function restoreInks(inks) {
    const container = getElement("inksContainer");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!Array.isArray(inks) || inks.length === 0) {
      ensureInitialInkRow();
      return;
    }

    inks.forEach((ink) => {
      addInkRow(ink, {
        silent: true
      });
    });
  }

  /* =======================================================
     POLA SPECJALNE
     ======================================================= */

  function bindSpecialFields() {
    updateEmbossedPaperVisibility();
    renderSiliconeFields();
  }

  function updateEmbossedPaperVisibility() {
    const panel = getElement("embossedPaperFields");
    const checkbox = getElement("embossedPaperCheckbox");

    if (!panel || !checkbox) {
      return;
    }

    panel.hidden = !checkbox.checked;
  }

  function renderSiliconeFields(restoredData = null) {
    const container = getElement("siliconeFields");
    const count = Number(getValue("siliconeSelect")) || 0;

    if (!container) {
      return;
    }

    const existingValues = restoredData || collectSiliconeData();

    container.innerHTML = "";

    if (count === 0) {
      return;
    }

    const fields = document.createElement("div");
    fields.className = "pf-form-grid pf-form-grid--2";

    for (let index = 1; index <= count; index += 1) {
      const previous = existingValues[index - 1] || {};
      const previousName =
        previous.name ||
        previous.code ||
        [previous.width, previous.position]
          .filter(Boolean)
          .join(" / ");

      fields.insertAdjacentHTML(
        "beforeend",
        `
          <label class="pf-field">
            <span>Pasek silikonowy ${index} — pełna nazwa</span>

            <input
              type="text"
              class="pf-silicone-name"
              data-silicone-index="${index}"
              value="${escapeHtml(previousName || "")}"
              placeholder="Wklej pełną nazwę paska">
          </label>
        `
      );
    }

    container.appendChild(fields);

    container
      .querySelectorAll("input")
      .forEach((input) => {
        input.addEventListener("input", debounceAutoSave);
      });
  }

  function collectSiliconeData() {
    return queryAll(".pf-silicone-name")
      .map((input) => ({
        name: input.value.trim()
      }))
      .filter((item) => item.name);
  }

  /* =======================================================
     WYLICZENIA PAKOWANIA
     ======================================================= */

  function updatePackingCalculations() {
    const orderedQuantity = toNumber(getValue("orderQty"));
    const quantityPerCarton = toNumber(getValue("qtyCarton"));
    const quantityPerPallet = toNumber(getValue("qtyPallet"));

    const cartons =
      orderedQuantity > 0 && quantityPerCarton > 0
        ? Math.ceil(orderedQuantity / quantityPerCarton)
        : 0;

    const fullPallets =
      orderedQuantity > 0 && quantityPerPallet > 0
        ? Math.floor(orderedQuantity / quantityPerPallet)
        : 0;

    const remaining =
      orderedQuantity > 0 && quantityPerPallet > 0
        ? orderedQuantity % quantityPerPallet
        : orderedQuantity;

    const cartonsElement = getElement("calculatedCartons");
    const palletsElement = getElement("calculatedPallets");
    const remainingElement = getElement("calculatedRemaining");

    if (cartonsElement) {
      cartonsElement.textContent = String(cartons);
    }

    if (palletsElement) {
      palletsElement.textContent = String(fullPallets);
    }

    if (remainingElement) {
      remainingElement.textContent = `${remaining} szt.`;
    }
  }

  /* =======================================================
     PODSUMOWANIE
     ======================================================= */

  function updateSummary() {
    const orderNumber = safeText(
      getValue("orderNumber"),
      "Nowe zlecenie"
    );

    const client = safeText(getValue("client"));
    const product =
      safeText(getValue("productName")) !== "—"
        ? safeText(getValue("productName"))
        : safeText(getValue("productIndex"));

    const productType =
      getValue("productType") || "—";
    const quantity = toNumber(getValue("orderQty"));
    const dueDate = formatDate(getValue("deliveryDate"));
    setText("headerOrderNumber", orderNumber);
    setText("summaryClient", client);
    setText("summaryProduct", product);
    setText("summaryProductType", productType);
    setText(
      "summaryQuantity",
      `${new Intl.NumberFormat("pl-PL").format(quantity)} szt.`
    );
    setText("summaryDueDate", dueDate);
  }

  function setText(id, value) {
    const element = getElement(id);

    if (element) {
      element.textContent = value;
    }
  }

  /* =======================================================
     KOMPLETNOŚĆ KARTY
     ======================================================= */

  function updateCompleteness() {
    const checks = {
      basic:
        Boolean(getValue("orderNumber").trim()) &&
        Boolean(getValue("client").trim()),

      product:
        Boolean(getValue("productIndex").trim()) &&
        toNumber(getValue("orderQty")) > 0 &&
        Boolean(getValue("productType")),

      materials:
        Boolean(getValue("paperIndex").trim()) ||
        Boolean(getValue("paperName").trim()),

      packing:
        Boolean(getValue("palletSizeSelect")) &&
        toNumber(getValue("qtyPallet")) > 0,

      logistics:
        Boolean(getValue("deliveryDate"))
    };

    const completed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    const percentage = Math.round((completed / total) * 100);

    setText("completenessValue", `${percentage}%`);

    const ring = getElement("completenessRing");

    if (ring) {
      ring.style.setProperty(
        "--progress",
        `${percentage * 3.6}deg`
      );
    }

    updateCheckLabel("checkBasic", checks.basic);
    updateCheckLabel("checkProduct", checks.product);
    updateCheckLabel("checkMaterials", checks.materials);
    updateCheckLabel("checkPacking", checks.packing);
    updateCheckLabel("checkLogistics", checks.logistics);
  }

  function updateCheckLabel(id, isComplete) {
    const element = getElement(id);

    if (!element) {
      return;
    }

    element.textContent = isComplete ? "Tak" : "Nie";
    element.classList.toggle("is-complete", isComplete);
  }

  /* =======================================================
     ZAŁĄCZNIK GRAFIKI
     ======================================================= */

  function formatAttachmentSize(size) {
    const bytes = Number(size) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }

  function renderGraphicAttachment() {
    const panel = getElement("graphicAttachmentPanel");
    const status = getElement("graphicPdfStatus");
    const openButton = getElement("graphicPdfOpenBtn");
    const removeButton = getElement("graphicPdfRemoveBtn");

    const hasFile = Boolean(
      graphicPdfAttachment?.dataUrl ||
      graphicPdfAttachment?.url
    );
    panel?.classList.toggle("has-file", hasFile);

    if (status) {
      status.textContent = hasFile
        ? `${graphicPdfAttachment.name || "załącznik.pdf"} · ${formatAttachmentSize(graphicPdfAttachment.size)}`
        : "Nie dodano załącznika PDF.";
    }

    if (openButton) openButton.hidden = !hasFile;
    if (removeButton) removeButton.hidden = !hasFile;
  }

  function openGraphicAttachment() {
    const attachmentUrl =
      graphicPdfAttachment?.url ||
      graphicPdfAttachment?.dataUrl;

    if (!attachmentUrl) {
      showToast("Brak załącznika PDF.", "warning");
      return;
    }

    const opened = window.open("", "_blank");
    if (!opened) {
      showToast("Przeglądarka zablokowała otwarcie załącznika.", "warning");
      return;
    }
    opened.opener = null;
    opened.location.href = attachmentUrl;
  }

  async function readGraphicAttachment(file) {
    if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      showToast("Wybierz plik PDF.", "warning");
      return;
    }

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("Załącznik może mieć maksymalnie 25 MB.", "warning");
      return;
    }

    const api = window.ProdFlow?.api;
    if (!api?.uploadAttachment) {
      showToast("Usługa załączników nie jest dostępna.", "error");
      return;
    }

    if (!currentOrderId) {
      saveCard({
        silent: true,
        historyMessage: "Utworzono kartę przed dodaniem załącznika"
      });
    }

    const status = getElement("graphicPdfStatus");
    if (status) status.textContent = `Wysyłanie ${file.name}…`;

    try {
      const uploaded = await api.uploadAttachment(
        file,
        currentOrderId,
        "production-graphic"
      );
      graphicPdfAttachment = {
        id: uploaded.id,
        name: uploaded.name || file.name,
        type: uploaded.type || "application/pdf",
        size: uploaded.size || file.size,
        url: uploaded.url,
        addedAt: uploaded.createdAt || new Date().toISOString()
      };
      renderGraphicAttachment();
      addHistory("Dodano załącznik grafiki", file.name);
      saveCard({
        silent: true,
        historyMessage: "Zapisano załącznik grafiki"
      });
      showToast("Załącznik został zapisany na serwerze.", "success");
    } catch (error) {
      renderGraphicAttachment();
      showToast(
        error?.message || "Nie udało się wysłać pliku PDF.",
        "error"
      );
    }
  }

  function bindGraphicAttachment() {
    const input = getElement("graphicPdfInput");

    getElement("graphicPdfChooseBtn")?.addEventListener("click", () => input?.click());
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) readGraphicAttachment(file);
      input.value = "";
    });
    getElement("graphicPdfOpenBtn")?.addEventListener("click", openGraphicAttachment);
    getElement("graphicPdfRemoveBtn")?.addEventListener("click", async () => {
      if (!graphicPdfAttachment) return;
      const attachmentId = graphicPdfAttachment.id;
      if (attachmentId && window.ProdFlow?.api?.deleteAttachment) {
        try {
          await window.ProdFlow.api.deleteAttachment(attachmentId);
        } catch (error) {
          showToast(
            error?.message || "Nie udało się usunąć załącznika.",
            "error"
          );
          return;
        }
      }
      graphicPdfAttachment = null;
      renderGraphicAttachment();
      addHistory("Usunięto załącznik grafiki", "Usunięto wzór i siatkę projektu.");
      saveCard({
        silent: true,
        historyMessage: "Usunięto załącznik grafiki"
      });
    });

    renderGraphicAttachment();
  }

  /* =======================================================
     ZAPIS I ODCZYT DANYCH
     ======================================================= */

  function collectCardData() {
    const fields = {};

    FIELD_IDS.forEach((fieldId) => {
      fields[fieldId] = getValue(fieldId);
    });

    return {
      version: 4,
      updatedAt: new Date().toISOString(),
      processStep: root.dataset.processStep || "card",
      fields,
      inks: collectInks(),
      silicone: collectSiliconeData(),
      graphicAttachment: graphicPdfAttachment
        ? { ...graphicPdfAttachment }
        : null,
      history: getHistory()
    };
  }

  function getProdFlowStore() {
    const store = window.ProdFlow?.store;

    if (!store) {
      throw new Error(
        "ProdFlow Store nie jest dostępny. Sprawdź kolejność ładowania plików core."
      );
    }

    if (typeof store.saveOrder !== "function") {
      throw new Error(
        "ProdFlow.store.saveOrder() nie jest dostępne."
      );
    }

    return store;
  }

  function getAllStoreOrders() {
    const store = getProdFlowStore();

    if (typeof store.getOrders !== "function") {
      return [];
    }

    const orders = store.getOrders();

    return Array.isArray(orders) ? orders : [];
  }

  function findStoreOrder(orderId) {
    if (!orderId) {
      return null;
    }

    const store = getProdFlowStore();

    if (typeof store.getOrder === "function") {
      const order = store.getOrder(orderId);

      if (order) {
        return order;
      }
    }

    return (
      getAllStoreOrders().find((order) => {
        return (
          order.id === orderId ||
          order.number === orderId ||
          order.order?.externalNumber === orderId
        );
      }) || null
    );
  }

  function orderCardLabel(order) {
    const reference =
      order.order?.externalNumber ||
      order.number ||
      order.id;
    const client = order.customer?.name || "brak klienta";
    const product =
      order.product?.name ||
      order.product?.code ||
      "brak produktu";

    return `${reference} - ${client} - ${product} (${orderStatusLabel(order)})`;
  }

  function renderOrderManager() {
    const select = getElement("orderCardSelect");
    const counter = getElement("orderCardCount");
    const openButton = getElement("openOrderCardBtn");

    if (!select) {
      return;
    }

    const orders = getAllStoreOrders();

    select.innerHTML = orders.length
      ? [
          '<option value="">- wybierz zapisaną kartę -</option>',
          ...orders.map(
            (order) =>
              `<option value="${escapeHtml(order.id)}">${escapeHtml(orderCardLabel(order))}</option>`
          )
        ].join("")
      : '<option value="">Brak zapisanych kart</option>';

    select.value = orders.some((order) => order.id === currentOrderId)
      ? currentOrderId
      : "";

    if (counter) {
      counter.textContent = orders.length
        ? `${orders.length} ${orders.length === 1 ? "zapisana karta" : orders.length < 5 ? "zapisane karty" : "zapisanych kart"}`
        : "Brak zapisanych kart";
    }

    if (openButton) {
      openButton.disabled = !select.value;
    }
  }

  function preservePendingDraft() {
    window.clearTimeout(autoSaveTimer);

    if (!root.classList.contains("has-unsaved-changes")) {
      return;
    }

    saveCard({
      silent: true,
      historyMessage: null
    });
  }

  function openOrderCard(orderId) {
    const order = findStoreOrder(orderId);

    if (!order) {
      showToast("Nie znaleziono wybranej karty.", "error");
      renderOrderManager();
      return;
    }

    if (order.id === currentOrderId) {
      showToast("Ta karta jest już otwarta.");
      return;
    }

    preservePendingDraft();
    currentOrderId = order.id;
    sessionStorage.setItem(ACTIVE_ORDER_KEY, currentOrderId);
    applyCardData(convertOrderToCard(order));
    renderOrderManager();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Otwarto kartę ${order.order?.externalNumber || order.number}.`, "success");
  }

  function normalizeHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }

    return history.slice(0, HISTORY_LIMIT).map((item) => ({
      id: item.id || createId("history"),
      type: item.type || "production-card-event",
      title: item.title || "Zdarzenie",
      description: item.description || "",
      module: item.module || "production-card",
      createdAt: item.createdAt || new Date().toISOString(),
      data:
        item.data && typeof item.data === "object"
          ? item.data
          : {}
    }));
  }

  function mapProcessStepToStore(processStep) {
    const processStepMap = {
      card: "card",
      planning: "planning",
      materials: "planning",
      production: "production",
      quality: "quality",
      packing: "packing",
      shipment: "warehouse"
    };

    return processStepMap[processStep] || "card";
  }

  function mapProcessStepToCard(processStep) {
    const processStepMap = {
      card: "card",
      planning: "planning",
      production: "production",
      quality: "quality",
      packing: "packing",
      warehouse: "shipment",
      completed: "shipment"
    };

    return processStepMap[processStep] || "card";
  }

  function mapCardStatusToStore(cardData) {
    const processStep = cardData.processStep || "card";

    const statusMap = {
      card: "draft",
      planning: "planned",
      materials: "planned",
      production: "in_production",
      quality: "quality_control",
      packing: "packing",
      shipment: "warehouse"
    };

    return statusMap[processStep] || "draft";
  }

  function convertCardToOrder(cardData) {
    const fields = cardData.fields || {};
    const orderId =
      currentOrderId ||
      createId("ord");
    const existingOrder = findStoreOrder(orderId);

    const materials = [
      {
        id: "paper",
        type: "paper",
        code: fields.paperIndex || "",
        name: fields.paperName || "",
        description: fields.paperSize || "",
        quantity: 0,
        unit: "",
        status: "unknown",
        metadata: {
          size: fields.paperSize || ""
        }
      },
      ...(fields.embossedPaperCheckbox
        ? [
            {
              id: "embossed-paper",
              type: "embossed-paper",
              code: fields.bublakPaperIndex || "",
              name: fields.bublakPaperName || "",
              description: fields.bublakPaperSize || "",
              quantity: 0,
              unit: "",
              status: "unknown",
              metadata: {
                size: fields.bublakPaperSize || ""
              }
            }
          ]
        : []),
      ...[
        fields.glue1Select,
        fields.glue2Select,
        fields.glue3Select
      ]
        .filter(Boolean)
        .map((code, index) => ({
          id: `glue-${index + 1}`,
          type: "glue",
          code,
          name: code,
          description: "",
          quantity: 0,
          unit: "",
          status: "unknown"
        })),
      ...(Array.isArray(cardData.inks)
        ? cardData.inks.map((ink, index) => ({
            id: ink.id || `ink-${index + 1}`,
            type: "ink",
            code: ink.index || "",
            name: ink.description || "",
            description: ink.description || "",
            quantity: 0,
            unit: "",
              status: ink.status || "available"
          }))
        : []),
      ...(Array.isArray(cardData.silicone)
        ? cardData.silicone
            .filter((item) => item?.name || item?.code)
            .map((item, index) => ({
              id: `silicone-${index + 1}`,
              type: "silicone",
              code: item.code || "",
              name: item.name || item.code,
              description: "Pasek silikonowy",
              quantity: 0,
              unit: "",
              status: "unknown"
            }))
        : []),
      ...(normalizeTearType(fields.ppwrTearStrip)
        ? [
            {
              id: "tear-off",
              type: "tear-off",
              code: normalizeTearType(fields.ppwrTearStrip),
              name: `Zrywka - ${tearTypeLabel(fields.ppwrTearStrip)}`,
              description: "Rodzaj zrywki",
              quantity: 0,
              unit: "",
              status: "unknown"
            }
          ]
        : [])
    ];

    return {
      id: orderId,
      status: mapCardStatusToStore(cardData),
      processStep: mapProcessStepToStore(
        cardData.processStep
      ),

      order: {
        externalNumber: fields.orderNumber || "",
        customerOrderNumber:
          fields.clientOrderNumber || "",
        priority: fields.priority || "normal",
        quantity: toNumber(fields.orderQty),
        dueDate: fields.deliveryDate || "",
        notes: fields.notes || ""
      },

      customer: {
        code: fields.clientIndex || "",
        name: fields.client || "",
        contactPerson:
          fields.responsiblePerson || ""
      },

      product: {
        code: fields.productIndex || "",
        name: fields.productName || "",
        description: fields.productType || "",
        revision: existingOrder?.product?.revision || "",
        quantity: toNumber(fields.orderQty),
        drawingNumber: fields.graphicNumber || "",
        dimensions: {
          length: toNumber(fields.ppwrFlap),
          width: toNumber(fields.ppwrWidth),
          height: toNumber(fields.ppwrHeight),
          bottomGusset: toNumber(fields.ppwrBottomGusset),
          adhesiveStrips: toNumber(fields.ppwrAdhesiveStrips),
          tearStripType: normalizeTearType(fields.ppwrTearStrip)
        },
        notes: ""
      },

      materials,

      technology: {
        instructions: fields.printMethodSelect || "",
        notes: [
          fields.printRoll
            ? `Wałek: ${fields.printRoll}`
            : "",
          fields.colorCount !== ""
            ? `Liczba kolorów: ${fields.colorCount}`
            : ""
        ]
          .filter(Boolean)
          .join("\n")
      },

      packing: {
        packageType: fields.cartonSelect || "",
        unitsPerPackage: toNumber(fields.qtyCarton),
        packagesCount:
          toNumber(fields.qtyCarton) > 0
            ? Math.ceil(
                toNumber(fields.orderQty) /
                  toNumber(fields.qtyCarton)
              )
            : 0,
        palletType: fields.palletTypeSelect || "",
        unitsPerPallet: toNumber(fields.qtyPallet),
        palletsCount:
          toNumber(fields.qtyPallet) > 0
            ? Math.ceil(
                toNumber(fields.orderQty) /
                  toNumber(fields.qtyPallet)
              )
            : 0,
        labelTemplate:
          fields.labelTypeSelect || "",
        instructions: "",
        notes: ""
      },

      logistics: {
        ...(existingOrder?.logistics || {}),
        deliveryDate: fields.deliveryDate || "",
        notes: fields.notes || ""
      },

      production: {
        ...(existingOrder?.production || {}),
        printOrderNumber: fields.printOrderNumber || ""
      },

      quality: existingOrder?.quality || {},

      planning: {
        ...(existingOrder?.planning || {}),
        plannedStart:
          fields.plannedStartDate ||
          existingOrder?.planning?.plannedStart ||
          ""
      },

      metadata: {
        source: "production-card",
        productionCard: {
          version: cardData.version || 4,
          updatedAt:
            cardData.updatedAt ||
            new Date().toISOString(),
          processStep:
            cardData.processStep || "card",
          fields: { ...fields },
          inks: Array.isArray(cardData.inks)
            ? cardData.inks
            : [],
          silicone: Array.isArray(
            cardData.silicone
          )
            ? cardData.silicone
            : [],
          graphicAttachment:
            (cardData.graphicAttachment?.dataUrl || cardData.graphicAttachment?.url)
              ? { ...cardData.graphicAttachment }
              : null,
          history: normalizeHistory(
            cardData.history
          )
        }
      }
    };
  }

  function convertOrderToCard(order) {
    const savedCard =
      order.metadata?.productionCard;

    if (
      savedCard &&
      savedCard.fields &&
      typeof savedCard.fields === "object"
    ) {
      return {
        version:
          savedCard.version || 4,

        updatedAt:
          order.updatedAt ||
          new Date().toISOString(),

        processStep:
          savedCard.processStep ||
          mapProcessStepToCard(order.processStep),

        fields:
          savedCard.fields,

        inks:
          Array.isArray(savedCard.inks)
            ? savedCard.inks
            : [],

        silicone:
          Array.isArray(savedCard.silicone)
            ? savedCard.silicone
            : [],

        graphicAttachment:
          (savedCard.graphicAttachment?.dataUrl || savedCard.graphicAttachment?.url)
            ? { ...savedCard.graphicAttachment }
            : null,

        history:
          Array.isArray(savedCard.history)
            ? savedCard.history
            : []
      };
    }

    const paper =
      Array.isArray(order.materials)
        ? order.materials.find(
            (material) =>
              material.type === "paper"
          )
        : null;

    const embossedPaper =
      Array.isArray(order.materials)
        ? order.materials.find(
            (material) =>
              material.type ===
              "embossed-paper"
          )
        : null;

    const inks =
      Array.isArray(order.materials)
        ? order.materials
            .filter(
              (material) =>
                material.type === "ink"
            )
            .map((material) => ({
              id:
                material.id ||
                createId("ink"),

              index:
                material.code || "",

              description:
                material.name ||
                material.description ||
                "",

              quantity:
                material.quantity ?? "",

              unit:
                material.unit || "kg",

              status:
                material.status || "unknown"
            }))
        : [];

    const glues =
      Array.isArray(order.materials)
        ? order.materials.filter(
            (material) =>
              material.type === "glue"
          )
        : [];

    const silicone = Array.isArray(order.materials)
      ? order.materials
          .filter((material) => material.type === "silicone")
          .map((material) => ({
            name: material.name || material.code || ""
          }))
          .filter((item) => item.name)
      : [];

    const tearMaterial = Array.isArray(order.materials)
      ? order.materials.find((material) => material.type === "tear-off")
      : null;

    const dimensions = order.product?.dimensions || {};

    return {
      version: 4,

      updatedAt:
        order.updatedAt ||
        new Date().toISOString(),

      processStep:
        mapProcessStepToCard(order.processStep),

      fields: {
        orderNumber:
          order.order?.externalNumber || "",

        clientOrderNumber:
          order.order?.customerOrderNumber || "",

        printOrderNumber:
          order.production?.printOrderNumber || "",

        priority:
          order.order?.priority || "normal",

        client:
          order.customer?.name || "",

        clientIndex:
          order.customer?.code || "",

        responsiblePerson:
          order.customer?.contactPerson || "",

        productIndex:
          order.product?.code || "",

        orderQty:
          order.order?.quantity ||
          order.product?.quantity ||
          "",

        productName:
          order.product?.name || "",

        ppwrWidth: dimensions.width || "",
        ppwrHeight: dimensions.height || "",
        ppwrFlap: dimensions.length || "",
        ppwrBottomGusset: dimensions.bottomGusset || "",
        ppwrAdhesiveStrips: dimensions.adhesiveStrips || "",
        ppwrTearStrip: normalizeTearType(
          dimensions.tearStripType || tearMaterial?.code || tearMaterial?.name
        ),

        productType: "",

        paperIndex:
          paper?.code || "",

        paperName:
          paper?.name || "",

        paperSize:
          paper?.metadata?.size ||
          paper?.description ||
          "",

        glue1Select:
          glues[0]?.code || "",

        glue2Select:
          glues[1]?.code || "",

        glue3Select:
          glues[2]?.code || "",

        embossedPaperCheckbox:
          Boolean(embossedPaper),

        bublakPaperIndex:
          embossedPaper?.code || "",

        bublakPaperName:
          embossedPaper?.name || "",

        bublakPaperSize:
          embossedPaper?.metadata?.size ||
          "",

        corner: false,
        wrapping: false,

        siliconeSelect: String(Math.min(2, silicone.length)),

        graphicNumber:
          order.product?.drawingNumber || "",

        colorCount: "",

        printMethodSelect:
          order.technology?.instructions || "",

        printRoll: "",

        plannedStartDate:
          order.planning?.plannedStart || "",

        palletSizeSelect:
          order.packing?.palletType || "",

        palletTypeSelect:
          order.packing?.palletType || "",

        cartonSelect:
          order.packing?.packageType || "",

        qtyCarton:
          order.packing?.unitsPerPackage || "",

        qtyPallet: order.packing?.unitsPerPallet || "",
        qtyLayer: "",

        labelTypeSelect:
          order.packing?.labelTemplate ||
          "standard",

        deliveryDate:
          order.logistics?.deliveryDate ||
          order.order?.dueDate ||
          "",

        notes:
          order.logistics?.notes ||
          order.order?.notes ||
          ""
      },

      inks,
      silicone,
      graphicAttachment:
        (order.metadata?.productionCard?.graphicAttachment?.dataUrl ||
          order.metadata?.productionCard?.graphicAttachment?.url)
          ? { ...order.metadata.productionCard.graphicAttachment }
          : null,
      history: []
    };
  }

  function normalizeCardData(data) {
    const normalized = {
      ...data,
      fields: { ...(data?.fields || {}) },
      silicone: Array.isArray(data?.silicone)
        ? data.silicone
        : [],
      graphicAttachment: (data?.graphicAttachment?.dataUrl || data?.graphicAttachment?.url)
        ? { ...data.graphicAttachment }
        : null
    };

    const legacyEnvelopeSize = String(normalized.fields.envelopeSize || "").trim();
    const currentProductName = String(normalized.fields.productName || "").trim();
    if (legacyEnvelopeSize && !currentProductName.toLowerCase().includes(legacyEnvelopeSize.toLowerCase())) {
      normalized.fields.productName = [currentProductName, legacyEnvelopeSize]
        .filter(Boolean)
        .join(" — ");
    }
    delete normalized.fields.envelopeSize;

    normalized.fields.ppwrTearStrip =
      normalizeTearType(
        normalized.fields.ppwrTearStrip,
        normalized.fields.perforationSelect
      ) ||
      normalizeTearType(
        normalized.fields.tearStripSelect,
        normalized.fields.perforationSelect
      );

    normalized.fields.siliconeSelect = String(
      Math.max(
        Number(normalized.fields.siliconeSelect) || 0,
        Math.min(2, normalized.silicone.length)
      )
    );

    return normalized;
  }

  function applyCardData(data) {
    const normalizedData = normalizeCardData(data);
    isRestoringData = true;

    try {
      graphicPdfAttachment = normalizedData.graphicAttachment
        ? { ...normalizedData.graphicAttachment }
        : null;

      Object.entries(normalizedData.fields || {}).forEach(
        ([fieldId, value]) => {
          setValue(fieldId, value);
        }
      );

      restoreInks(normalizedData.inks || []);

      updateEmbossedPaperVisibility();

      renderSiliconeFields(
        normalizedData.silicone || []
      );

      setProductType(
        normalizedData.fields?.productType || "",
        {
          silent: true
        }
      );

      setProcessStep(
        normalizedData.processStep || "card",
        {
          silent: true
        }
      );

      restoreHistory(
        normalizedData.history || []
      );

      renderGraphicAttachment();

      updateAllViews();
      markAsSaved();
    } finally {
      isRestoringData = false;
    }
  }

  function saveCard(options = {}) {
    const {
      silent = false,
      historyMessage = "Ręczny zapis karty",
      targetStatus = null,
      targetProcessStep = null,
      successMessage =
        "Karta produkcyjna została zapisana."
    } = options;

    setSavingState(true);

    try {
      if (historyMessage) {
        addHistory(
          historyMessage,
          buildSaveDescription()
        );
      }

      const cardData =
        collectCardData();

      if (targetProcessStep) {
        cardData.processStep = targetProcessStep;
      }

      const orderData =
        convertCardToOrder(cardData);

      const store =
        getProdFlowStore();

      const existingOrder =
        findStoreOrder(orderData.id);

      if (targetStatus && targetProcessStep) {
        orderData.status = targetStatus;
        orderData.processStep =
          targetProcessStep;
      } else if (
        existingOrder &&
        (
          existingOrder.processStep !== "card" ||
          !["draft", "new"].includes(
            existingOrder.status
          )
        )
      ) {
        orderData.status =
          existingOrder.status;
        orderData.processStep =
          existingOrder.processStep;
      } else {
        orderData.status = "draft";
        orderData.processStep = "card";
      }

      const result = store.saveOrder(
        orderData,
        {
          addHistory: !silent,
          historyMessage:
            historyMessage ||
            "Zaktualizowano Kartę Produkcyjną.",
          module: "production-card"
        }
      );

      const savedOrder =
        result ||
        findStoreOrder(orderData.id) ||
        orderData;

      currentOrderId =
        savedOrder.id ||
        orderData.id;

      sessionStorage.setItem(
        ACTIVE_ORDER_KEY,
        currentOrderId
      );

      if (targetProcessStep) {
        setProcessStep(targetProcessStep, { silent: true });
      }

      renderOrderManager();

      window.setTimeout(() => {
        setSavingState(false);
        markAsSaved();

        if (!silent) {
          showToast(
            successMessage,
            "success"
          );
        }
      }, 250);

      return savedOrder;
    } catch (error) {
      console.error(
        "[ProdFlow] Nie udało się zapisać karty:",
        error
      );

      setSavingState(false);

      updateSaveStatus(
        "Błąd zapisu",
        "Nie udało się zapisać danych"
      );

      showToast(
        "Nie udało się zapisać karty.",
        "error"
      );

      return null;
    }
  }

  function ensureTransferToPlanningButton() {
    let button =
      getElement("transferToPlanningBtn");

    if (button) {
      return button;
    }

    const saveButton =
      getElement("saveCardBtn");

    if (!saveButton) {
      return null;
    }

    button = document.createElement("button");
    button.type = "button";
    button.id = "transferToPlanningBtn";
    button.className = saveButton.className;
    button.textContent = "Przekaż do planowania";

    saveButton.insertAdjacentElement(
      "afterend",
      button
    );

    return button;
  }

  function transferToPlanning() {
    if (!validateRequiredFields()) {
      showToast(
        "Uzupełnij wymagane pola.",
        "warning"
      );

      return;
    }

    saveCard({
      silent: false,
      historyMessage:
        "Przekazano Kartę Produkcyjną do planowania",
      targetStatus: "planned",
      targetProcessStep: "planning",
      successMessage:
        "Zlecenie zostało przekazane do planowania."
    });
  }

  function createNewCardState() {
    currentOrderId = "";

    sessionStorage.removeItem(
      ACTIVE_ORDER_KEY
    );

    setProcessStep("card", {
      silent: true
    });

    restoreHistory([]);

    addHistory(
      "Utworzono kartę",
      "Nowa karta produkcyjna"
    );

    markAsSaved();
  }

  function restoreCard() {
    try {
      getProdFlowStore();

      if (currentOrderId) {
        const order =
          findStoreOrder(currentOrderId);

        if (order) {
          applyCardData(
            convertOrderToCard(order)
          );

          return;
        }

        currentOrderId = "";

        sessionStorage.removeItem(
          ACTIVE_ORDER_KEY
        );
      }

      createNewCardState();
    } catch (error) {
      isRestoringData = false;

      console.error(
        "[ProdFlow] Nie udało się odczytać zapisanej karty:",
        error
      );

      updateSaveStatus(
        "Błąd zapisu",
        "ProdFlow Store jest niedostępny"
      );

      showToast(
        "ProdFlow Store jest niedostępny. Sprawdź pliki core.",
        "error"
      );

      setProcessStep("card", {
        silent: true
      });
    }
  }

  function buildSaveDescription() {
    const orderNumber = safeText(
      getValue("orderNumber"),
      "Nowe zlecenie"
    );

    return `Zapisano dane: ${orderNumber}`;
  }

  /* =======================================================
     HISTORIA ZMIAN
     ======================================================= */

  function getHistory() {
    const rawHistory = root.dataset.history;

    if (!rawHistory) {
      return [];
    }

    try {
      const history = JSON.parse(rawHistory);
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  function setHistory(history) {
    root.dataset.history = JSON.stringify(history);
    renderHistory(history);
  }

  function addHistory(title, description = "") {
    if (isRestoringData) {
      return;
    }

    const history = getHistory();

    history.unshift({
      id: createId("history"),
      title,
      description,
      createdAt: new Date().toISOString()
    });

    setHistory(history.slice(0, HISTORY_LIMIT));
  }

  function restoreHistory(history) {
    const safeHistory = Array.isArray(history)
      ? history.slice(0, HISTORY_LIMIT)
      : [];

    setHistory(safeHistory);
  }

  function renderHistory(history = getHistory()) {
    const container = getElement("cardHistory");

    if (!container) {
      return;
    }

    if (!history.length) {
      container.innerHTML = `
        <div class="pf-history__empty">
          Brak zapisanych zdarzeń.
        </div>
      `;

      return;
    }

    container.innerHTML = history
      .map(
        (item) => `
          <article class="pf-history-item">
            <strong>${escapeHtml(item.title)}</strong>

            <small>
              ${escapeHtml(formatDateTime(item.createdAt))}
            </small>

            ${
              item.description
                ? `
                  <p>
                    ${escapeHtml(item.description)}
                  </p>
                `
                : ""
            }
          </article>
        `
      )
      .join("");
  }

  /* =======================================================
     PRZYCISKI GŁÓWNE
     ======================================================= */

  function bindActionButtons() {
    getElement("saveCardBtn")?.addEventListener(
      "click",
      () => {
        if (!validateRequiredFields()) {
          showToast(
            "Uzupełnij wymagane pola.",
            "warning"
          );

          return;
        }

        const existingOrder = currentOrderId
          ? findStoreOrder(currentOrderId)
          : null;
        const shouldPlan = !existingOrder ||
          existingOrder.processStep === "card" ||
          ["draft", "new"].includes(existingOrder.status);

        saveCard({
          silent: false,
          historyMessage: shouldPlan
            ? "Zapisano Kartę Produkcyjną i dodano zlecenie do planu"
            : "Ręczny zapis karty",
          targetStatus: shouldPlan ? "planned" : null,
          targetProcessStep: shouldPlan ? "planning" : null,
          successMessage: shouldPlan
            ? "Karta została zapisana i trafiła do Zaplanowanych."
            : "Karta produkcyjna została zaktualizowana."
        });
      }
    );

    getElement("newCardBtn")?.addEventListener(
      "click",
      startNewCard
    );

    getElement("orderCardSelect")?.addEventListener(
      "change",
      (event) => {
        const button = getElement("openOrderCardBtn");
        if (button) {
          button.disabled = !event.currentTarget.value;
        }
      }
    );

    getElement("openOrderCardBtn")?.addEventListener(
      "click",
      () => {
        const selectedId = getValue("orderCardSelect");
        if (selectedId) {
          openOrderCard(selectedId);
        }
      }
    );

    getElement("printLegacyBtn")?.addEventListener(
      "click",
      printLegacy
    );

  }

  /* =======================================================
     WALIDACJA
     ======================================================= */

  function validateRequiredFields() {
    const requiredIds = [
      "orderNumber",
      "client",
      "productIndex",
      "orderQty",
      "deliveryDate"
    ];

    let isValid = true;
    let firstInvalid = null;

    requiredIds.forEach((fieldId) => {
      const element = getElement(fieldId);

      if (!element) {
        return;
      }

      const value = getValue(fieldId);
      const empty =
        element.type === "number"
          ? toNumber(value) <= 0
          : !String(value).trim();

      const field = element.closest(".pf-field");

      if (empty) {
        field?.classList.add("has-error");
        isValid = false;

        if (!firstInvalid) {
          firstInvalid = element;
        }
      } else {
        field?.classList.remove("has-error");
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();

      firstInvalid
        .closest(".pf-section")
        ?.classList.add("is-open");

      firstInvalid.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    return isValid;
  }

  function clearFieldError(fieldId) {
    getElement(fieldId)
      ?.closest(".pf-field")
      ?.classList.remove("has-error");
  }

  /* =======================================================
     RESET KARTY
     ======================================================= */

  function startNewCard() {
    const confirmed = window.confirm(
      currentOrderId
        ? "Rozpocząć nową kartę? Obecna karta pozostanie zapisana i będzie można do niej wrócić z listy."
        : "Wyczyścić formularz i rozpocząć nową kartę?"
    );

    if (!confirmed) {
      return;
    }

    preservePendingDraft();
    window.clearTimeout(autoSaveTimer);

    currentOrderId = "";

    sessionStorage.removeItem(
      ACTIVE_ORDER_KEY
    );

    FIELD_IDS.forEach((fieldId) => {
      const element = getElement(fieldId);

      if (!element) {
        return;
      }

      if (element.type === "checkbox") {
        element.checked = false;
      } else if (element.tagName === "SELECT") {
        element.selectedIndex = 0;
      } else {
        element.value = "";
      }
    });

    setValue("productType", "");
    setValue("priority", "normal");
    setValue("labelTypeSelect", "standard");
    setValue("siliconeSelect", "0");
    setValue("ppwrTearStrip", "");

    graphicPdfAttachment = null;
    renderGraphicAttachment();

    const inksContainer = getElement("inksContainer");

    if (inksContainer) {
      inksContainer.innerHTML = "";
    }

    ensureInitialInkRow();

    root.dataset.history = "[]";

    updateEmbossedPaperVisibility();
    renderSiliconeFields();
    setProductType("", {
      silent: true
    });

    setProcessStep("card", {
      silent: true
    });

    addHistory(
      "Utworzono kartę",
      "Rozpoczęto nowe zlecenie"
    );

    updateAllViews();
    renderOrderManager();
    markAsSaved();

    showToast(
      "Możesz wprowadzić kolejne zlecenie.",
      "success"
    );
  }

  /* =======================================================
     WYDRUKI
     ======================================================= */

  function printProdFlow() {
    saveCard({
      silent: true,
      historyMessage: "Wygenerowano wydruk ProdFlow"
    });

    window.setTimeout(() => {
      window.print();
    }, 150);
  }

  function printLegacy() {
    const savedOrder = saveCard({
      silent: true,
      historyMessage: "Wygenerowano wydruk karty produkcyjnej"
    });

    if (!savedOrder?.id && !currentOrderId) {
      showToast(
        "Najpierw uzupełnij i zapisz Kartę Produkcyjną.",
        "warning"
      );
      return;
    }

    const printUrl = MODULE_SCRIPT_URL
      ? new URL("./print/print.html", MODULE_SCRIPT_URL)
      : new URL(
          "modules/production-card/print/print.html",
          window.location.href
        );

    printUrl.searchParams.set(
      "orderId",
      savedOrder?.id || currentOrderId
    );

    const printWindow = window.open(
      printUrl.href,
      "_blank"
    );

    if (!printWindow) {
      showToast(
        "Przeglądarka zablokowała okno wydruku.",
        "warning"
      );
    } else {
      printWindow.opener = null;
    }
  }

  /* =======================================================
     STANY ZAPISU
     ======================================================= */

  function markAsUnsaved() {
    root.classList.add("has-unsaved-changes");

    updateSaveStatus(
      "Niezapisane zmiany",
      "Automatyczny zapis za chwilę"
    );
  }

  function markAsSaved() {
    root.classList.remove(
      "has-unsaved-changes",
      "is-saving"
    );

    updateSaveStatus(
      "Wszystko zapisane",
      `Ostatni zapis: ${formatDateTime()}`
    );
  }

  function setSavingState(isSaving) {
    root.classList.toggle("is-saving", isSaving);

    if (isSaving) {
      updateSaveStatus(
        "Zapisywanie...",
        "Trwa aktualizacja danych"
      );
    }
  }

  function updateSaveStatus(title, description) {
    const status = getElement("saveStatus");

    if (!status) {
      return;
    }

    const strong = status.querySelector("strong");
    const small = status.querySelector("small");

    if (strong) {
      strong.textContent = title;
    }

    if (small) {
      small.textContent = description;
    }
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(message, type = "") {
    const toast = getElement("productionCardToast");

    if (!toast) {
      return;
    }

    window.clearTimeout(toastTimer);

    toast.className = "pf-toast";

    if (type) {
      toast.classList.add(`is-${type}`);
    }

    toast.textContent = message;

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  /* =======================================================
     AKTUALIZACJA CAŁEGO WIDOKU
     ======================================================= */

  function updateAllViews() {
    updateSummary();
    updatePackingCalculations();
    updateCompleteness();
    updateMainStatus(root.dataset.processStep || "card");
  }

  /* =======================================================
     API MODUŁU — DO PÓŹNIEJSZEGO PODŁĄCZENIA
     ======================================================= */

  window.ProductionCardV2 = {
    init,

    save() {
      saveCard({
        silent: false,
        historyMessage: "Zapis wywołany przez aplikację"
      });
    },

    load() {
      restoreCard();
      updateAllViews();
    },

    reset() {
      startNewCard();
    },

    getData() {
      return collectCardData();
    },

    setData(data) {
      if (!data || typeof data !== "object") {
        throw new TypeError(
          "ProductionCardV2.setData wymaga obiektu danych."
        );
      }

      isRestoringData = true;

      graphicPdfAttachment = (data.graphicAttachment?.dataUrl || data.graphicAttachment?.url)
        ? { ...data.graphicAttachment }
        : null;

      Object.entries(data.fields || {}).forEach(
        ([fieldId, value]) => {
          setValue(fieldId, value);
        }
      );

      restoreInks(data.inks || []);
      updateEmbossedPaperVisibility();
      renderSiliconeFields(data.silicone || []);

      setProductType(
        data.fields?.productType || "",
        {
          silent: true
        }
      );

      setProcessStep(
        data.processStep || "card",
        {
          silent: true
        }
      );

      restoreHistory(data.history || []);
      renderGraphicAttachment();

      isRestoringData = false;

      updateAllViews();
    },

    setProductType(typeCode) {
      setProductType(typeCode);
    },

    addInk(data = {}) {
      addInkRow(data);
    },

    print() {
      printProdFlow();
    },

    printLegacy() {
      printLegacy();
    }
  };

  [
    "store:order-updated",
    "store:order-status-changed",
    "store:order-deleted",
    "store:database-imported",
    "store:database-cleared"
  ].forEach((eventName) => {
    window.ProdFlow?.events?.on(
      eventName,
      (payload) => {
        if (
          !root ||
          !document.contains(root) ||
          root.classList.contains(
            "has-unsaved-changes"
          )
        ) {
          return;
        }

        const changedOrder =
          payload?.order || payload;
        const changedId =
          changedOrder?.id ||
          changedOrder?.orderId;

        if (
          !changedId ||
          changedId === currentOrderId
        ) {
          restoreCard();
        }
      }
    );
  });

  /* =======================================================
     AUTOMATYCZNY START

     Działa przy normalnym osadzeniu HTML.

     Przy dynamicznym loaderze możemy później wywołać:
     window.ProductionCardV2.init();
     ======================================================= */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
