(function initBarcodeQuality() {
  "use strict";

  const root = document.getElementById("barcodeQualityModule");
  const store = window.ProdFlow?.store;
  if (!root || !store) return;

  const SETTING_KEY = "quality.barcodeControl";
  const AIM_PATTERN = /^\][A-Z][0-9]/;
  const reasons = {
    first_piece: "Pierwsza sztuka",
    periodic: "Kontrola okresowa",
    customer_request: "Na prośbę klienta",
    complaint: "Kontrola reklamacyjna",
    other: "Inna kontrola"
  };

  const elements = {
    form: root.querySelector("#barcodeProtocolForm"),
    protocolNumber: root.querySelector("#barcodeProtocolNumber"),
    inspector: root.querySelector("#barcodeInspector"),
    client: root.querySelector("#barcodeClient"),
    product: root.querySelector("#barcodeProduct"),
    productIndex: root.querySelector("#barcodeProductIndex"),
    batch: root.querySelector("#barcodeBatch"),
    reason: root.querySelector("#barcodeControlReason"),
    target: root.querySelector("#barcodeSampleTarget"),
    notes: root.querySelector("#barcodeNotes"),
    clientList: root.querySelector("#barcodeClients"),
    productList: root.querySelector("#barcodeProducts"),
    scanZone: root.querySelector("#barcodeScanZone"),
    scanInput: root.querySelector("#barcodeScanInput"),
    addScan: root.querySelector("#barcodeAddScan"),
    noRead: root.querySelector("#barcodeNoRead"),
    undoScan: root.querySelector("#barcodeUndoScan"),
    samples: root.querySelector("#barcodeSamples"),
    progress: root.querySelector("#barcodeScanProgress"),
    progressBar: root.querySelector("#barcodeScanProgressBar"),
    liveResult: root.querySelector("#barcodeLiveResult"),
    save: root.querySelector("#barcodeSaveProtocol"),
    reset: root.querySelector("#barcodeResetControl"),
    newProtocol: root.querySelector("#barcodeNewProtocol"),
    metricTotal: root.querySelector("#barcodeMetricTotal"),
    metricPass: root.querySelector("#barcodeMetricPass"),
    metricFail: root.querySelector("#barcodeMetricFail"),
    metricToday: root.querySelector("#barcodeMetricToday"),
    historySearch: root.querySelector("#barcodeHistorySearch"),
    historyStatus: root.querySelector("#barcodeHistoryStatus"),
    historyBody: root.querySelector("#barcodeHistoryBody"),
    historyEmpty: root.querySelector("#barcodeHistoryEmpty"),
    modal: root.querySelector("#barcodeProtocolModal"),
    modalTitle: root.querySelector("#barcodeModalTitle"),
    preview: root.querySelector("#barcodeProtocolPreview"),
    print: root.querySelector("#barcodePrintProtocol"),
    toast: root.querySelector("#barcodeToast")
  };

  let data = normalizeData(store.getSetting(SETTING_KEY, null));
  let scans = [];
  let selectedProtocol = null;
  let toastTimer = null;
  let previousTarget = Number(elements.target.value) || 3;

  function clean(value) {
    return String(value ?? "").replace(/[\r\n]+$/g, "").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix) {
    const value = window.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${value}`;
  }

  function normalizeData(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      version: 1,
      protocols: Array.isArray(source.protocols)
        ? source.protocols.filter(item => item && typeof item === "object")
        : [],
      clients: Array.isArray(source.clients) ? source.clients.filter(Boolean) : [],
      products: Array.isArray(source.products) ? source.products.filter(Boolean) : []
    };
  }

  function currentUser() {
    const user = window.ProdFlow?.currentUser || {};
    return {
      id: user.id || "",
      username: user.username || "",
      name: user.displayName || user.name || user.username || "Użytkownik ProdFlow"
    };
  }

  function localDateKey(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function displayCode(value) {
    return clean(value)
      .replaceAll("\u001d", "<GS>")
      .replaceAll("\u001e", "<RS>")
      .replaceAll("\u0004", "<EOT>");
  }

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.className = `bq-toast${type === "error" ? " is-error" : ""}`;
    requestAnimationFrame(() => elements.toast.classList.add("is-visible"));
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
  }

  function gtinChecksum(code) {
    if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) {
      return null;
    }
    const body = code.slice(0, -1);
    const actual = Number(code.at(-1));
    let sum = 0;
    let weight = 3;
    for (let index = body.length - 1; index >= 0; index -= 1) {
      sum += Number(body[index]) * weight;
      weight = weight === 3 ? 1 : 3;
    }
    const expected = (10 - (sum % 10)) % 10;
    return { valid: expected === actual, expected, actual };
  }

  function analyzeBarcode(rawValue) {
    const raw = clean(rawValue);
    if (!raw) {
      return {
        rawValue: "",
        displayValue: "Brak odczytu",
        payload: "",
        aimIdentifier: "",
        type: "Brak odczytu",
        readable: false,
        checksumStatus: "not_applicable",
        checksumLabel: "Nie dotyczy",
        valid: false,
        detail: "Skaner nie zwrócił wartości."
      };
    }

    const aimIdentifier = AIM_PATTERN.test(raw) ? raw.slice(0, 3) : "";
    const payload = aimIdentifier ? raw.slice(3) : raw;
    let type = "Kod alfanumeryczny · typ nierozpoznany";
    let checksum = null;

    if (aimIdentifier === "]C1") {
      type = "GS1-128";
      const normalizedGs1 = payload.replace(/[()]/g, "");
      const gtinMatch = normalizedGs1.match(/^01(\d{14})/);
      if (gtinMatch) checksum = gtinChecksum(gtinMatch[1]);
    } else if (/^\d{8}$/.test(payload)) {
      type = "EAN-8";
      checksum = gtinChecksum(payload);
    } else if (/^\d{12}$/.test(payload)) {
      type = "UPC-A";
      checksum = gtinChecksum(payload);
    } else if (/^\d{13}$/.test(payload)) {
      type = "EAN-13";
      checksum = gtinChecksum(payload);
    } else if (/^\d{14}$/.test(payload)) {
      type = "GTIN-14";
      checksum = gtinChecksum(payload);
    } else if (/^\d+$/.test(payload)) {
      type = "Kod numeryczny · bez rozpoznanej sumy kontrolnej";
    } else if (aimIdentifier === "]Q3") {
      type = "QR Code (identyfikator AIM)";
    } else if (aimIdentifier === "]C0") {
      type = "Code 128 (identyfikator AIM)";
    }

    const checksumStatus = checksum
      ? (checksum.valid ? "valid" : "invalid")
      : "not_applicable";
    const valid = checksumStatus !== "invalid";

    return {
      rawValue: raw,
      displayValue: displayCode(raw),
      payload,
      aimIdentifier,
      type,
      readable: true,
      checksumStatus,
      checksumLabel: checksumStatus === "valid"
        ? "Poprawna"
        : checksumStatus === "invalid"
          ? `Niepoprawna (oczekiwano ${checksum.expected})`
          : "Nie dotyczy",
      valid,
      detail: checksumStatus === "invalid"
        ? "Odczytano wartość, ale cyfra kontrolna jest niepoprawna."
        : checksumStatus === "valid"
          ? "Kod odczytano, a cyfra kontrolna jest poprawna."
          : "Kod został odczytany; dla tej wartości nie zweryfikowano cyfry kontrolnej."
    };
  }

  function targetCount() {
    return Number(elements.target.value) || 3;
  }

  function evaluateScans(items = scans, required = targetCount()) {
    const complete = items.length >= required;
    const readable = items.filter(item => item.readable);
    const allReadable = complete && readable.length === required;
    const uniqueValues = new Set(readable.map(item => item.rawValue));
    const repeatable = allReadable && uniqueValues.size === 1;
    const invalidChecksum = items.some(item => item.checksumStatus === "invalid");
    const status = !complete
      ? "waiting"
      : allReadable && repeatable && !invalidChecksum
        ? "pass"
        : "fail";

    let message = `Zarejestrowano ${items.length} z ${required} wymaganych próbek.`;
    if (status === "pass") {
      message = required === 1
        ? "Kod został odczytany poprawnie."
        : `Kod odczytano poprawnie w ${required} próbkach, a wszystkie wartości są identyczne.`;
    } else if (status === "fail") {
      const causes = [];
      if (!allReadable) causes.push("co najmniej jedna próbka nie została odczytana");
      if (allReadable && !repeatable) causes.push("zeskanowane wartości nie są identyczne");
      if (invalidChecksum) causes.push("wykryto niepoprawną cyfrę kontrolną");
      message = causes.length ? `${causes.join("; ")}.` : "Kontrola zakończyła się niezgodnością.";
    }

    let checksumSummary = "not_applicable";
    if (invalidChecksum) checksumSummary = "invalid";
    else if (items.some(item => item.checksumStatus === "valid")) checksumSummary = "valid";

    return {
      complete,
      status,
      readableCount: readable.length,
      repeatable,
      checksumSummary,
      decodedValue: uniqueValues.size === 1 ? readable[0]?.rawValue || "" : "",
      message
    };
  }

  function nextProtocolNumber() {
    const year = new Date().getFullYear();
    const expression = new RegExp(`^BK/${year}/(\\d+)$`);
    const highest = data.protocols.reduce((value, protocol) => {
      const match = clean(protocol.number).match(expression);
      return match ? Math.max(value, Number(match[1]) || 0) : value;
    }, 0);
    return `BK/${year}/${String(highest + 1).padStart(5, "0")}`;
  }

  function scanResultLabel(scan) {
    if (!scan.readable) return "Brak odczytu";
    if (!scan.valid) return "Niezgodna";
    return "Odczytana";
  }

  function renderSamples() {
    const required = targetCount();
    elements.progress.textContent = `${scans.length} / ${required}`;
    elements.progressBar.style.width = `${Math.min(100, (scans.length / required) * 100)}%`;
    elements.undoScan.disabled = scans.length === 0;

    if (!scans.length) {
      elements.samples.innerHTML = '<div class="bq-samples-empty">Nie zarejestrowano jeszcze żadnej próbki.</div>';
    } else {
      elements.samples.innerHTML = scans.map((scan, index) => `
        <article class="bq-sample ${scan.valid ? "" : "is-fail"}">
          <span class="bq-sample__number">${index + 1}</span>
          <code title="${escapeHtml(scan.displayValue)}">${escapeHtml(scan.displayValue)}</code>
          <small>${escapeHtml(scan.type)}</small>
          <small>Suma: ${escapeHtml(scan.checksumLabel)}</small>
          <span class="bq-sample__result">${escapeHtml(scanResultLabel(scan))}</span>
        </article>`).join("");
    }

    const result = evaluateScans();
    elements.liveResult.dataset.status = result.status;
    elements.liveResult.innerHTML = result.status === "pass"
      ? `<span class="bq-live-result__icon">✓</span><div><small>WYNIK KONTROLI</small><strong>ODCZYT POPRAWNY</strong><p>${escapeHtml(result.message)}</p></div>`
      : result.status === "fail"
        ? `<span class="bq-live-result__icon">×</span><div><small>WYNIK KONTROLI</small><strong>ODCZYT NIEPOPRAWNY</strong><p>${escapeHtml(result.message)}</p></div>`
        : `<span class="bq-live-result__icon">…</span><div><small>WYNIK KONTROLI</small><strong>Oczekuje na próbki</strong><p>${escapeHtml(result.message)}</p></div>`;
    elements.save.disabled = !result.complete;
  }

  function addScan(rawValue) {
    const required = targetCount();
    if (scans.length >= required) {
      showToast("Wymagana liczba próbek została już zarejestrowana.");
      return;
    }

    const analysis = analyzeBarcode(rawValue);
    scans.push({
      id: createId("scan"),
      sampleNumber: scans.length + 1,
      scannedAt: new Date().toISOString(),
      ...analysis
    });
    elements.scanInput.value = "";
    renderSamples();
    window.setTimeout(() => elements.scanInput.focus({ preventScroll: true }), 20);

    if (!analysis.readable) showToast("Zarejestrowano brak odczytu.", "error");
    else if (!analysis.valid) showToast("Kod odczytano, ale cyfra kontrolna jest niepoprawna.", "error");
  }

  function addInputScan() {
    const value = clean(elements.scanInput.value);
    if (!value) {
      showToast("Zeskanuj kod lub wybierz „Brak odczytu”.", "error");
      elements.scanInput.focus();
      return;
    }
    addScan(value);
  }

  function renderDatalists() {
    elements.clientList.innerHTML = [...new Set(data.clients.map(clean).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pl"))
      .map(value => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
    elements.productList.innerHTML = [...new Set(data.products.map(clean).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pl"))
      .map(value => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }

  function renderMetrics() {
    const today = localDateKey();
    elements.metricTotal.textContent = data.protocols.length;
    elements.metricPass.textContent = data.protocols.filter(item => item.status === "pass").length;
    elements.metricFail.textContent = data.protocols.filter(item => item.status === "fail").length;
    elements.metricToday.textContent = data.protocols.filter(item => localDateKey(item.createdAt) === today).length;
  }

  function protocolSearchText(protocol) {
    return [
      protocol.number,
      protocol.client,
      protocol.product,
      protocol.productIndex,
      protocol.batch,
      protocol.decodedValue,
      protocol.inspector?.name
    ].join(" ").toLowerCase();
  }

  function renderHistory() {
    const query = clean(elements.historySearch.value).toLowerCase();
    const status = elements.historyStatus.value;
    const filtered = data.protocols.filter(protocol => {
      const statusMatch = status === "all" || protocol.status === status;
      return statusMatch && (!query || protocolSearchText(protocol).includes(query));
    });

    elements.historyBody.innerHTML = filtered.map(protocol => `
      <tr>
        <td><strong>${escapeHtml(protocol.number || "—")}</strong><small>${escapeHtml(formatDateTime(protocol.createdAt))}</small></td>
        <td><strong>${escapeHtml(protocol.client || "—")}</strong><small>${escapeHtml(protocol.product || "—")}${protocol.productIndex ? ` · ${escapeHtml(protocol.productIndex)}` : ""}</small></td>
        <td><code title="${escapeHtml(displayCode(protocol.decodedValue || ""))}">${escapeHtml(displayCode(protocol.decodedValue || "Różne wartości / brak odczytu"))}</code><small>${escapeHtml((protocol.detectedTypes || []).join(", ") || "—")}</small></td>
        <td><strong>${escapeHtml(protocol.readableCount)} / ${escapeHtml(protocol.sampleTarget)}</strong><small>${protocol.repeatable ? "wartości identyczne" : "brak powtarzalności"}</small></td>
        <td><strong>${escapeHtml(protocol.inspector?.name || "—")}</strong><small>${escapeHtml(reasons[protocol.reason] || protocol.reason || "—")}</small></td>
        <td><span class="bq-status ${protocol.status === "fail" ? "is-fail" : ""}">${protocol.status === "pass" ? "Poprawny" : "Niepoprawny"}</span></td>
        <td><button class="bq-table-action" type="button" data-barcode-protocol="${escapeHtml(protocol.id)}">Podgląd / PDF</button></td>
      </tr>`).join("");
    elements.historyEmpty.hidden = filtered.length > 0;
  }

  function checksumSummaryLabel(value) {
    return value === "valid"
      ? "Poprawna"
      : value === "invalid"
        ? "Niepoprawna"
        : "Nie dotyczy / nierozpoznana";
  }

  function protocolDocumentHtml(protocol) {
    const logoUrl = new URL("assets/images/logoczarne.png", document.baseURI).href;
    const statusPass = protocol.status === "pass";
    const rows = (protocol.scans || []).map((scan, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(formatTime(scan.scannedAt))}</td>
        <td><code>${escapeHtml(displayCode(scan.rawValue || "Brak odczytu"))}</code></td>
        <td>${escapeHtml(scan.type || "—")}</td>
        <td>${escapeHtml(scan.checksumLabel || "Nie dotyczy")}</td>
        <td>${scan.valid ? "Odczytana" : scan.readable ? "Niezgodna" : "Brak odczytu"}</td>
      </tr>`).join("");

    return `
      <article class="bq-document">
        <header class="bq-doc-head">
          <div><img src="${logoUrl}" alt="Masterpress"></div>
          <div><h3>PROTOKÓŁ KONTROLI ODCZYTU<br>KODU KRESKOWEGO</h3><p>Funkcjonalna kontrola przy użyciu skanera USB</p></div>
          <div class="bq-doc-number"><span>Numer dokumentu</span><strong>${escapeHtml(protocol.number || "—")}</strong><span>Data</span><strong>${escapeHtml(formatDateTime(protocol.createdAt))}</strong></div>
        </header>
        <section class="bq-doc-result ${statusPass ? "" : "is-fail"}">
          <span>Końcowy wynik kontroli</span>
          <strong>${statusPass ? "ODCZYT POPRAWNY" : "ODCZYT NIEPOPRAWNY"}</strong>
        </section>
        <section class="bq-doc-grid">
          <div><span>Klient</span><strong>${escapeHtml(protocol.client || "—")}</strong></div>
          <div><span>Wyrób gotowy</span><strong>${escapeHtml(protocol.product || "—")}</strong></div>
          <div><span>Indeks wyrobu</span><strong>${escapeHtml(protocol.productIndex || "—")}</strong></div>
          <div><span>Partia / odniesienie</span><strong>${escapeHtml(protocol.batch || "—")}</strong></div>
          <div><span>Rodzaj kontroli</span><strong>${escapeHtml(reasons[protocol.reason] || protocol.reason || "—")}</strong></div>
          <div><span>Próbki odczytane</span><strong>${escapeHtml(protocol.readableCount)} / ${escapeHtml(protocol.sampleTarget)}</strong></div>
          <div><span>Powtarzalność</span><strong>${protocol.repeatable ? "Wartości identyczne" : "Brak powtarzalności"}</strong></div>
          <div><span>Suma kontrolna</span><strong>${escapeHtml(checksumSummaryLabel(protocol.checksumSummary))}</strong></div>
        </section>
        <h4 class="bq-doc-section-title">Odczytana wartość</h4>
        <div class="bq-doc-code"><span>Dane zwrócone przez skaner</span><code>${escapeHtml(displayCode(protocol.decodedValue || "Różne wartości / brak odczytu"))}</code></div>
        <h4 class="bq-doc-section-title">Wyniki poszczególnych próbek</h4>
        <table class="bq-doc-table">
          <thead><tr><th>Próbka</th><th>Godzina</th><th>Odczytana wartość</th><th>Rozpoznany typ</th><th>Cyfra kontrolna</th><th>Wynik</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${protocol.notes ? `<h4 class="bq-doc-section-title">Uwagi</h4><div class="bq-doc-disclaimer">${escapeHtml(protocol.notes).replaceAll("\n", "<br>")}</div>` : ""}
        <div class="bq-doc-disclaimer"><strong>Zakres kontroli:</strong> dokument potwierdza funkcjonalny odczyt danych przez skaner oraz — gdy było to możliwe — sprawdzenie cyfry kontrolnej i powtarzalności wyników. Nie jest oceną klasy jakości wydruku według ISO/IEC 15416.</div>
        <section class="bq-doc-grid">
          <div><span>Kontrolę wykonał</span><strong>${escapeHtml(protocol.inspector?.name || "—")}</strong></div>
          <div><span>Stanowisko</span><strong>ProdFlow · skaner USB HID</strong></div>
          <div><span>Wynik techniczny</span><strong>${escapeHtml(protocol.resultMessage || "—")}</strong></div>
          <div><span>Utworzono automatycznie</span><strong>${escapeHtml(formatDateTime(protocol.createdAt))}</strong></div>
        </section>
        <div class="bq-doc-signatures"><div>Podpis osoby wykonującej kontrolę</div><div>Podpis osoby zatwierdzającej</div></div>
      </article>`;
  }

  function openProtocol(protocol) {
    if (!protocol) return;
    selectedProtocol = protocol;
    elements.modalTitle.textContent = protocol.number || "Protokół kontroli";
    elements.preview.innerHTML = protocolDocumentHtml(protocol);
    elements.modal.hidden = false;
    elements.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    elements.print.focus({ preventScroll: true });
  }

  function closeProtocol() {
    elements.modal.hidden = true;
    elements.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    selectedProtocol = null;
  }

  function printProtocol(protocol) {
    if (!protocol) return;
    const cssUrl = new URL("modules/barcode-quality/barcode-quality.css", document.baseURI).href;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Przeglądarka zablokowała otwarcie dokumentu.", "error");
      return;
    }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${escapeHtml(protocol.number)} - kontrola kodu</title><link rel="stylesheet" href="${cssUrl}"><style>@page{size:A4 portrait;margin:9mm}html,body{margin:0;background:#fff}.bq-document{width:100%;max-width:none;min-height:0;margin:0;padding:0;border:0;box-shadow:none}.bq-doc-signatures{margin-top:22px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${protocolDocumentHtml(protocol)}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),180));<\/script></body></html>`);
    printWindow.document.close();
  }

  function rememberValue(list, value) {
    const normalized = clean(value);
    if (!normalized) return list;
    if (list.some(item => clean(item).toLowerCase() === normalized.toLowerCase())) return list;
    return [...list, normalized];
  }

  function persistProtocol(protocol) {
    data.protocols = [protocol, ...data.protocols];
    data.clients = rememberValue(data.clients, protocol.client);
    data.products = rememberValue(data.products, protocol.product);
    store.setSetting(SETTING_KEY, data);
  }

  function saveProtocol(event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    const result = evaluateScans();
    if (!result.complete) {
      showToast("Zarejestruj wszystkie wymagane próbki.", "error");
      elements.scanInput.focus();
      return;
    }

    const formData = new FormData(elements.form);
    const createdAt = new Date().toISOString();
    const protocol = {
      id: createId("barcode-protocol"),
      number: elements.protocolNumber.textContent,
      createdAt,
      client: clean(formData.get("client")),
      product: clean(formData.get("product")),
      productIndex: clean(formData.get("productIndex")),
      batch: clean(formData.get("batch")),
      reason: clean(formData.get("reason")),
      sampleTarget: targetCount(),
      notes: clean(formData.get("notes")),
      inspector: currentUser(),
      scans: clone(scans),
      status: result.status,
      readableCount: result.readableCount,
      repeatable: result.repeatable,
      checksumSummary: result.checksumSummary,
      decodedValue: result.decodedValue,
      detectedTypes: [...new Set(scans.filter(item => item.readable).map(item => item.type))],
      resultMessage: result.message
    };

    persistProtocol(protocol);
    renderDatalists();
    renderMetrics();
    renderHistory();
    showToast(`${protocol.number} został zapisany.`);
    openProtocol(protocol);
    resetControl(false);
  }

  function hasUnsavedData() {
    return scans.length > 0 || [elements.client, elements.product, elements.productIndex, elements.batch, elements.notes]
      .some(control => clean(control.value));
  }

  function resetControl(focusClient = true) {
    elements.form.reset();
    elements.reason.value = "periodic";
    elements.target.value = "3";
    previousTarget = 3;
    scans = [];
    elements.scanInput.value = "";
    elements.protocolNumber.textContent = nextProtocolNumber();
    elements.inspector.textContent = currentUser().name;
    renderSamples();
    if (focusClient) window.setTimeout(() => elements.client.focus({ preventScroll: true }), 20);
  }

  function requestReset() {
    if (hasUnsavedData() && !window.confirm("Wyczyścić niezapisane dane bieżącej kontroli?")) return;
    resetControl(true);
    showToast("Formularz jest gotowy do nowej kontroli.");
  }

  function onTargetChange() {
    const nextTarget = targetCount();
    if (scans.length && !window.confirm("Zmiana liczby próbek wyczyści dotychczasowe odczyty. Kontynuować?")) {
      elements.target.value = String(previousTarget);
      return;
    }
    previousTarget = nextTarget;
    scans = [];
    renderSamples();
    elements.scanInput.focus({ preventScroll: true });
  }

  function onDocumentKeydown(event) {
    if (event.key === "Escape" && !elements.modal.hidden) closeProtocol();
  }

  function cleanup() {
    window.clearTimeout(toastTimer);
    document.removeEventListener("keydown", onDocumentKeydown);
    document.body.style.overflow = "";
    if (window.ProdFlow?.barcodeQuality === publicApi) delete window.ProdFlow.barcodeQuality;
  }

  const publicApi = Object.freeze({
    analyzeBarcode,
    getProtocols: () => clone(data.protocols)
  });
  window.ProdFlow = window.ProdFlow || {};
  window.ProdFlow.barcodeQuality = publicApi;

  elements.scanInput.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === "Tab") && clean(elements.scanInput.value)) {
      event.preventDefault();
      addInputScan();
    }
  });
  elements.addScan.addEventListener("click", addInputScan);
  elements.noRead.addEventListener("click", () => addScan(""));
  elements.undoScan.addEventListener("click", () => {
    scans.pop();
    renderSamples();
    elements.scanInput.focus({ preventScroll: true });
  });
  elements.target.addEventListener("change", onTargetChange);
  elements.form.addEventListener("submit", saveProtocol);
  elements.reset.addEventListener("click", requestReset);
  elements.newProtocol.addEventListener("click", requestReset);
  elements.historySearch.addEventListener("input", renderHistory);
  elements.historyStatus.addEventListener("change", renderHistory);
  elements.historyBody.addEventListener("click", event => {
    const button = event.target.closest("[data-barcode-protocol]");
    if (!button) return;
    openProtocol(data.protocols.find(item => item.id === button.dataset.barcodeProtocol));
  });
  root.querySelectorAll("[data-barcode-close]").forEach(button => button.addEventListener("click", closeProtocol));
  elements.print.addEventListener("click", () => printProtocol(selectedProtocol));
  document.addEventListener("keydown", onDocumentKeydown);
  window.addEventListener("prodflow:module-unload", cleanup, { once: true });

  renderDatalists();
  renderMetrics();
  renderHistory();
  resetControl(false);
  window.setTimeout(() => elements.client.focus({ preventScroll: true }), 120);
})();
