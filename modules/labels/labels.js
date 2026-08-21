(() => {
  "use strict";

  const root = document.getElementById("labelsModule");
  if (!root) return;

  const CARLTON_VARIANTS = Object.freeze({
    small: Object.freeze({
      key: "small",
      label: "Small",
      unitsPerCarton: 200,
      misc: "MISC2360",
      asin: "B0DHDB7377",
      productName: "Paper Returns Mailer Small - Barcoded"
    }),
    large: Object.freeze({
      key: "large",
      label: "Large",
      unitsPerCarton: 150,
      misc: "MISC2353",
      asin: "",
      productName: "Paper Returns Mailer Large - Barcoded"
    })
  });
  const $ = id => root.querySelector(`#${id}`) || document.getElementById(id);
  let selectedConfig = null;
  let toastTimer = null;

  function store() {
    const value = window.ProdFlow?.store;
    if (!value?.getOrders || !value?.getLabels || !value?.addLabelRecord) {
      throw new Error("ProdFlow.store nie udostępnia obsługi etykiet.");
    }
    return value;
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalize(value) {
    return clean(value)
      .toLocaleLowerCase("pl-PL")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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

  function orderNumber(order) {
    return order.order?.externalNumber || order.number || order.id;
  }

  function isCarlton(order) {
    return normalize(order.customer?.name).includes("carlton");
  }

  function availableOrders() {
    return store().getOrders({ archived: false }).filter(order =>
      order.processStep !== "card" &&
      order.status !== "draft" &&
      order.status !== "cancelled" &&
      order.metadata?.orderType !== "maintenance"
    );
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
  }

  function detectCarltonSize(...values) {
    const source = normalize(values.join(" "));
    if (source.includes("small")) return "small";
    if (source.includes("large")) return "large";
    return "";
  }

  function resolveCarltonVariant(order, fields) {
    const explicit = normalize(fields.carltonSize);
    const key = CARLTON_VARIANTS[explicit]
      ? explicit
      : detectCarltonSize(
          order.product?.name,
          order.customer?.code,
          fields.clientIndex,
          order.product?.code
        );
    return CARLTON_VARIANTS[key] || null;
  }

  function buildConfig(order) {
    const fields = order.metadata?.productionCard?.fields || {};
    const quantity = Number(order.order?.quantity || order.product?.quantity) || 0;
    const carlton = isCarlton(order);
    const carltonVariant = carlton ? resolveCarltonVariant(order, fields) : null;
    const unitsPerCarton = carltonVariant?.unitsPerCarton ||
      Number(order.packing?.unitsPerPackage || fields.qtyCarton) || 0;
    const unitsPerPallet = Number(fields.qtyPallet) || 0;
    const cartons = unitsPerCarton > 0 ? Math.ceil(quantity / unitsPerCarton) : 0;
    const cartonsPerPallet = unitsPerCarton > 0 && unitsPerPallet > 0
      ? Math.max(1, Math.floor(unitsPerPallet / unitsPerCarton))
      : 0;
    const pallets = cartonsPerPallet > 0
      ? Math.ceil(cartons / cartonsPerPallet)
      : Number(order.packing?.palletsCount) || 0;
    const config = {
      order,
      carlton,
      carltonSize: carltonVariant?.key || "",
      carltonSizeLabel: carltonVariant?.label || "",
      template: carlton ? "carlton-carton" : "masterpress-carton",
      templateName: carlton ? "Carlton 100 × 75 mm" : "Masterpress 100 × 75 mm",
      quantity,
      unitsPerCarton,
      unitsPerPallet,
      cartons,
      cartonsPerPallet,
      pallets,
      customerOrderNumber: clean(order.order?.customerOrderNumber || fields.clientOrderNumber),
      clientIndex: clean(order.customer?.code || fields.clientIndex || order.product?.code),
      productName: carltonVariant?.productName || clean(order.product?.name || fields.productName),
      customerName: clean(order.customer?.name),
      asin: carltonVariant?.asin || "",
      misc: carltonVariant?.misc || "",
      errors: []
    };

    if (!quantity) config.errors.push("brak ilości zlecenia");
    if (!unitsPerCarton) config.errors.push("brak ilości w kartonie");
    if (!config.customerOrderNumber) config.errors.push("brak numeru zlecenia klienta");
    if (!config.clientIndex) config.errors.push("brak indeksu klienta");
    if (!config.productName) config.errors.push("brak nazwy produktu");
    if (carlton && !carltonVariant) config.errors.push("brak wariantu Carlton Small/Large w Karcie Produkcyjnej");
    if (carltonVariant && !config.asin) config.errors.push(`brak numeru ASIN dla wariantu ${carltonVariant.label}`);
    if (carlton && !cartonsPerPallet) config.errors.push("brak ilości na palecie");

    return config;
  }

  function render() {
    const query = normalize($("labelsSearch").value);
    const status = $("labelsStatusFilter").value;
    const labels = store().getLabels();

    const rows = availableOrders()
      .map(order => {
        const prints = labels
          .filter(label => label.orderId === order.id)
          .sort((a, b) => String(b.printedAt).localeCompare(String(a.printedAt)));
        return { order, prints, config: buildConfig(order) };
      })
      .filter(({ order, prints }) => {
        if (status === "printed" && !prints.length) return false;
        if (status === "not-printed" && prints.length) return false;
        if (!query) return true;
        return [
          orderNumber(order),
          order.number,
          order.customer?.name,
          order.product?.name,
          order.product?.code
        ].some(value => normalize(value).includes(query));
      })
      .sort((a, b) => String(b.order.updatedAt || "").localeCompare(String(a.order.updatedAt || "")));

    $("labelsOrdersBody").innerHTML = rows.map(({ order, prints, config }) => {
      const last = prints[0];
      const total = prints.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return `
        <tr>
          <td><strong>${escapeHtml(orderNumber(order))}</strong><small>${escapeHtml(order.order?.customerOrderNumber || "bez numeru klienta")}</small></td>
          <td>${escapeHtml(order.customer?.name || "—")}</td>
          <td><strong>${escapeHtml(order.product?.name || "—")}</strong><small>${escapeHtml(config.clientIndex || "—")}</small></td>
          <td>${formatNumber(config.quantity)} szt.<small>${formatNumber(config.unitsPerCarton)} szt. / karton</small></td>
          <td><span class="labels-template-pill ${config.carlton ? "is-carlton" : ""}">${escapeHtml(config.carlton ? "Carlton" : "Masterpress")}</span></td>
          <td><strong>${formatNumber(config.cartons)}</strong><small>wydrukowano łącznie: ${formatNumber(total)}</small></td>
          <td>${escapeHtml(formatDateTime(last?.printedAt))}</td>
          <td><button class="label-btn label-btn-primary" type="button" data-label-print="${escapeHtml(order.id)}">Drukuj</button></td>
        </tr>`;
    }).join("");

    $("labelsEmpty").hidden = rows.length > 0;
  }

  function openDialog(orderId) {
    const order = availableOrders().find(item => item.id === orderId);
    if (!order) return;

    selectedConfig = buildConfig(order);
    $("labelsDialogTitle").textContent = `Etykiety — ${orderNumber(order)}`;
    $("labelsDialogDescription").textContent =
      `${selectedConfig.customerName || "Brak klienta"} · ${selectedConfig.productName || "Brak nazwy produktu"}`;
    $("labelsDetectedTemplate").textContent = selectedConfig.templateName;
    $("labelsUnitsPerCarton").textContent = selectedConfig.unitsPerCarton
      ? `${formatNumber(selectedConfig.unitsPerCarton)} szt.`
      : "Brak";
    $("labelsCartonsCount").textContent = selectedConfig.cartons
      ? formatNumber(selectedConfig.cartons)
      : "Brak";
    $("labelsPalletsCount").textContent = selectedConfig.pallets
      ? formatNumber(selectedConfig.pallets)
      : "—";
    $("labelsPreviewKind").textContent = selectedConfig.carlton
      ? "ETYKIETA CARLTON"
      : "ETYKIETA KARTONOWA MASTERPRESS";
    $("labelsPreviewOrder").textContent = selectedConfig.customerOrderNumber || "—";
    $("labelsPreviewProduct").textContent = selectedConfig.productName || "—";
    $("labelsPreviewCustomer").textContent = selectedConfig.customerName || "—";

    const validation = $("labelsValidation");
    const valid = selectedConfig.errors.length === 0;
    validation.classList.toggle("is-error", !valid);
    validation.textContent = valid
      ? `Gotowe: łącznie ${formatNumber(selectedConfig.cartons)} etykiet z automatyczną numeracją palet.`
      : `Uzupełnij Kartę Produkcyjną: ${selectedConfig.errors.join(", ")}.`;
    $("labelsPrintSubmit").disabled = !valid;
    $("labelsBatchPanel").hidden = !valid;
    if (valid) renderBatchControls(true);
    $("labelsPrintDialog").showModal();
  }

  function closeDialog() {
    $("labelsPrintDialog").close();
    selectedConfig = null;
  }

  function barcodeSvg(value) {
    if (typeof window.JsBarcode !== "function") {
      return `<div class="barcode-fallback">${escapeHtml(value)}</div>`;
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    window.JsBarcode(svg, value, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      width: 2,
      height: 52,
      background: "#ffffff",
      lineColor: "#000000"
    });
    return svg.outerHTML;
  }

  function masterpressLabelHtml(config, cartonNumber, palletNumber) {
    const logoUrl = new URL("assets/images/logoczarne.png", document.baseURI).href;
    const qrUrl = new URL("assets/images/label-qr.png", document.baseURI).href;
    return `
      <article class="label-page label-masterpress">
        <header>
          <img class="masterpress-logo" src="${escapeHtml(logoUrl)}" alt="Masterpress">
          <div><small>ETYKIETA KARTONOWA</small><strong>${escapeHtml(config.customerName || "Masterpress")}</strong></div>
          <img class="masterpress-qr" src="${escapeHtml(qrUrl)}" alt="Kod QR">
        </header>
        <section class="masterpress-product">
          <span>Nazwa produktu</span>
          <strong>${escapeHtml(config.productName)}</strong>
        </section>
        <section class="masterpress-grid">
          <div><span>Numer zlecenia klienta</span><strong>${escapeHtml(config.customerOrderNumber)}</strong></div>
          <div><span>Indeks klienta</span><strong>${escapeHtml(config.clientIndex)}</strong></div>
          <div><span>Ilość w kartonie</span><strong>${formatNumber(config.unitsPerCarton)} szt.</strong></div>
          <div><span>Karton / paleta</span><strong>${formatNumber(cartonNumber)} / ${String(palletNumber).padStart(2, "0")}</strong></div>
        </section>
        <footer><span>${escapeHtml(orderNumber(config.order))}</span><b>Paleta ${String(palletNumber).padStart(2, "0")}</b></footer>
      </article>`;
  }

  function carltonLabelHtml(config, cartonNumber, palletNumber) {
    return `
      <article class="label-page label-carlton">
        <section class="carlton-box">
          <strong class="carlton-index">${escapeHtml(config.clientIndex)}</strong>
          <div class="carlton-name">${escapeHtml(config.productName)}</div>
          <div class="carlton-carton">${formatNumber(config.unitsPerCarton)}/carton</div>
          <div class="carlton-code-row"><span>ASIN: ${escapeHtml(config.asin)}</span><strong>${escapeHtml(config.misc)}</strong></div>
          <div class="carlton-barcode">${barcodeSvg(config.asin)}</div>
          <div class="carlton-batch">Batch No: ${escapeHtml(config.customerOrderNumber)}</div>
        </section>
        <footer>
          <span>Palette no. ${String(palletNumber).padStart(2, "0")}</span>
        </footer>
      </article>`;
  }

  function buildBatches(config, size = Number($("labelsBatchSize")?.value) || 250) {
    const batchSize = Math.max(1, Math.floor(Number(size) || 250));
    const batches = [];
    for (let start = 1; start <= config.cartons; start += batchSize) {
      const end = Math.min(config.cartons, start + batchSize - 1);
      batches.push({
        index: batches.length,
        number: batches.length + 1,
        start,
        end,
        count: end - start + 1
      });
    }
    return batches;
  }

  function batchWasPrinted(config, batch) {
    return store().getLabels().some(record =>
      record.orderId === config.order.id &&
      Number(record.data?.labelStart) === batch.start &&
      Number(record.data?.labelEnd) === batch.end
    );
  }

  function selectedBatch() {
    if (!selectedConfig) return null;
    const batches = buildBatches(selectedConfig);
    return batches[Number($("labelsBatchRange").value) || 0] || batches[0] || null;
  }

  function updateBatchDescription() {
    if (!selectedConfig) return;
    const batches = buildBatches(selectedConfig);
    const batch = selectedBatch();
    if (!batch) return;
    $("labelsBatchCount").textContent = `${batches.length} ${batches.length === 1 ? "partia" : "partii"}`;
    $("labelsBatchInfo").textContent = batches.length === 1
      ? `Otworzy się komplet ${formatNumber(batch.count)} etykiet.`
      : `Otworzą się etykiety ${formatNumber(batch.start)}–${formatNumber(batch.end)} z ${formatNumber(selectedConfig.cartons)}. Po wydruku system wybierze następną partię.`;
    $("labelsPrintSubmit").textContent = batches.length === 1
      ? "Otwórz wydruk"
      : `Drukuj partię ${batch.number} z ${batches.length}`;
  }

  function renderBatchControls(resetSelection = false) {
    if (!selectedConfig) return;
    const range = $("labelsBatchRange");
    const previous = resetSelection ? 0 : Number(range.value) || 0;
    const batches = buildBatches(selectedConfig);
    range.innerHTML = batches.map(batch => {
      const printed = batchWasPrinted(selectedConfig, batch);
      return `<option value="${batch.index}">Partia ${batch.number} z ${batches.length} · etykiety ${formatNumber(batch.start)}–${formatNumber(batch.end)}${printed ? " · wydrukowana ✓" : ""}</option>`;
    }).join("");
    range.value = String(Math.min(previous, Math.max(0, batches.length - 1)));
    updateBatchDescription();
  }

  function labelsPrintDocument(config, batch) {
    const pageList = [];
    for (let cartonNumber = batch.start; cartonNumber <= batch.end; cartonNumber += 1) {
      const palletNumber = config.cartonsPerPallet > 0
        ? Math.ceil(cartonNumber / config.cartonsPerPallet)
        : 1;
      pageList.push(config.carlton
        ? carltonLabelHtml(config, cartonNumber, palletNumber)
        : masterpressLabelHtml(config, cartonNumber, palletNumber));
    }
    const pages = pageList.join("");

    return `<!doctype html>
      <html lang="pl">
      <head>
        <meta charset="utf-8">
        <title>Etykiety ${escapeHtml(orderNumber(config.order))} · ${batch.start}-${batch.end}</title>
        <style>
          @page{size:100mm 75mm;margin:0}
          *{box-sizing:border-box}
          html,body{margin:0;padding:0;background:#fff;color:#050505;font-family:Arial,sans-serif}
          .label-page{position:relative;width:100mm;height:75mm;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
          .label-page:last-child{page-break-after:auto;break-after:auto}
          .label-masterpress{display:grid;grid-template-rows:15mm 17mm 22mm 9mm;padding:3mm 5mm;border:1.1mm solid #002855}
          .label-masterpress header{display:grid;grid-template-columns:30mm 1fr 13mm;align-items:center;gap:2.5mm;border-bottom:.4mm solid #002855}
          .masterpress-logo{width:29mm;max-height:8mm;object-fit:contain;object-position:left center}
          .label-masterpress header div{display:grid;gap:1mm}
          .label-masterpress header small{color:#456078;font-size:7pt;font-weight:700;letter-spacing:.08em}
          .label-masterpress header strong{font-size:10pt;line-height:1.05}
          .masterpress-qr{width:12mm;height:12mm;object-fit:contain}
          .masterpress-product{display:grid;align-content:center;padding:1.5mm 0;overflow:hidden}
          .masterpress-product span,.masterpress-grid span{color:#5d6c7a;font-size:6.5pt;font-weight:700;text-transform:uppercase}
          .masterpress-product strong{font-size:13pt;line-height:1.05;overflow-wrap:anywhere}
          .masterpress-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:1mm 2.5mm;padding:1.5mm 0;border-top:.3mm solid #b6c2cd}
          .masterpress-grid div{display:grid;gap:.6mm}
          .masterpress-grid strong{font-size:9.5pt;overflow-wrap:anywhere}
          .label-masterpress footer{display:flex;align-items:center;justify-content:space-between;border-top:.3mm solid #b6c2cd;font-size:7.5pt}
          .label-masterpress footer b{color:#002855;font-size:11pt}
          .label-carlton{padding:5mm 7mm 2mm}
          .carlton-box{height:54mm;padding:2.5mm 3.5mm 2mm;border:.65mm solid #111}
          .carlton-index{display:block;font-size:11.5pt;line-height:1}
          .carlton-name{margin-top:.7mm;font-size:9.4pt;line-height:1.05}
          .carlton-carton{font-size:9.5pt;line-height:1.05}
          .carlton-code-row{display:flex;align-items:center;justify-content:space-between;gap:3mm;margin-top:.7mm;font-size:10pt}
          .carlton-code-row strong{font-size:17pt;font-weight:400}
          .carlton-barcode{height:14mm;margin:.7mm 5mm 0;overflow:hidden}
          .carlton-barcode svg{display:block;width:100%;height:100%}
          .barcode-fallback{display:grid;height:100%;place-items:center;border:1mm solid #111;font-weight:700;letter-spacing:.35em}
          .carlton-batch{margin-top:.3mm;font-size:10pt}
          .label-carlton footer{display:grid;height:14mm;place-items:start center;padding-top:1.5mm;font-size:18pt;line-height:1}
          @media screen{body{display:grid;gap:8mm;padding:8mm;background:#e8edf2}.label-page{box-shadow:0 8px 25px rgba(0,0,0,.18)}}
          @media print{body{display:block;padding:0;background:#fff}.label-page{box-shadow:none}}
        </style>
      </head>
      <body>${pages}<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script></body>
      </html>`;
  }

  function printLabels(config, batch) {
    const printWindow = window.open("", "_blank", "width=760,height=720");
    if (!printWindow) {
      showToast("Przeglądarka zablokowała okno wydruku.");
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(labelsPrintDocument(config, batch));
    printWindow.document.close();

    store().addLabelRecord(config.order.id, {
      template: config.template,
      quantity: batch.count,
      data: {
        source: "automatic-carton-labels",
        unitsPerCarton: config.unitsPerCarton,
        cartons: config.cartons,
        labelStart: batch.start,
        labelEnd: batch.end,
        batchNumber: batch.number,
        batchCount: buildBatches(config).length,
        pallets: config.pallets,
        customerOrderNumber: config.customerOrderNumber,
        clientIndex: config.clientIndex,
        asin: config.carlton ? config.asin : "",
        misc: config.misc,
        carltonSize: config.carltonSize
      }
    }, { module: "labels" });
    return true;
  }

  function showToast(message) {
    const toast = $("labelsToast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  $("labelsSearch").addEventListener("input", render);
  $("labelsStatusFilter").addEventListener("change", render);
  $("labelsOrdersBody").addEventListener("click", event => {
    const button = event.target.closest("[data-label-print]");
    if (button) openDialog(button.dataset.labelPrint);
  });
  $("labelsDialogClose").addEventListener("click", closeDialog);
  $("labelsCancelBtn").addEventListener("click", closeDialog);
  $("labelsBatchSize").addEventListener("change", () => renderBatchControls(true));
  $("labelsBatchRange").addEventListener("change", updateBatchDescription);
  $("labelsPrintForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!selectedConfig || selectedConfig.errors.length) return;
    const batches = buildBatches(selectedConfig);
    const batch = selectedBatch();
    if (!batch) return;
    if (printLabels(selectedConfig, batch)) {
      render();
      const nextIndex = batch.index + 1;
      if (nextIndex < batches.length) {
        renderBatchControls(false);
        $("labelsBatchRange").value = String(nextIndex);
        updateBatchDescription();
        showToast(`Przygotowano partię ${batch.number}: ${formatNumber(batch.count)} etykiet. Wybrano następną partię.`);
      } else {
        const count = batch.count;
        closeDialog();
        showToast(`Przygotowano ostatnią partię: ${formatNumber(count)} etykiet 100 × 75 mm.`);
      }
    }
  });

  [
    "store:order-created",
    "store:order-updated",
    "store:order-status-changed",
    "store:order-deleted",
    "store:label-added",
    "store:database-imported",
    "store:database-cleared"
  ].forEach(name => window.ProdFlow?.events?.on(name, () => {
    if (document.contains(root)) render();
  }));

  render();
})();
