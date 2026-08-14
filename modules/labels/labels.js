(() => {
  "use strict";

  const root = document.getElementById("labelsModule");
  if (!root) return;

  const CARLTON_ASIN = "B0DHDB7377";
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

  function detectMisc(productName, clientIndex) {
    const source = normalize(`${productName} ${clientIndex}`);
    if (source.includes("small")) return "MISC2360";
    if (source.includes("large")) return "MISC2353";
    return "";
  }

  function buildConfig(order) {
    const fields = order.metadata?.productionCard?.fields || {};
    const quantity = Number(order.order?.quantity || order.product?.quantity) || 0;
    const unitsPerCarton = Number(order.packing?.unitsPerPackage || fields.qtyCarton) || 0;
    const unitsPerPallet = Number(fields.qtyPallet) || 0;
    const cartons = unitsPerCarton > 0 ? Math.ceil(quantity / unitsPerCarton) : 0;
    const cartonsPerPallet = unitsPerCarton > 0 && unitsPerPallet > 0
      ? Math.max(1, Math.floor(unitsPerPallet / unitsPerCarton))
      : 0;
    const pallets = cartonsPerPallet > 0
      ? Math.ceil(cartons / cartonsPerPallet)
      : Number(order.packing?.palletsCount) || 0;
    const carlton = isCarlton(order);
    const config = {
      order,
      carlton,
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
      productName: clean(order.product?.name || fields.productName),
      customerName: clean(order.customer?.name),
      misc: detectMisc(order.product?.name, order.customer?.code || fields.clientIndex),
      errors: []
    };

    if (!quantity) config.errors.push("brak ilości zlecenia");
    if (!unitsPerCarton) config.errors.push("brak ilości w kartonie");
    if (!config.customerOrderNumber) config.errors.push("brak numeru zlecenia klienta");
    if (!config.clientIndex) config.errors.push("brak indeksu klienta");
    if (!config.productName) config.errors.push("brak nazwy produktu");
    if (carlton && !config.misc) config.errors.push("nazwa produktu Carlton nie zawiera SMALL ani LARGE");
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
      ? `Gotowe: system przygotuje ${formatNumber(selectedConfig.cartons)} etykiet i automatycznie nada numery palet.`
      : `Uzupełnij Kartę Produkcyjną: ${selectedConfig.errors.join(", ")}.`;
    $("labelsPrintSubmit").disabled = !valid;
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
          <div class="carlton-code-row"><span>ASIN: ${CARLTON_ASIN}</span><strong>${escapeHtml(config.misc)}</strong></div>
          <div class="carlton-barcode">${barcodeSvg(CARLTON_ASIN)}</div>
          <div class="carlton-batch">Batch No: ${escapeHtml(config.customerOrderNumber)}</div>
        </section>
        <footer>
          <span>Palette no. ${String(palletNumber).padStart(2, "0")}</span>
          <small>Carton ${formatNumber(cartonNumber)} / ${formatNumber(config.cartons)}</small>
        </footer>
      </article>`;
  }

  function labelsPrintDocument(config) {
    const pages = Array.from({ length: config.cartons }, (_, index) => {
      const cartonNumber = index + 1;
      const palletNumber = config.cartonsPerPallet > 0
        ? Math.ceil(cartonNumber / config.cartonsPerPallet)
        : 1;
      return config.carlton
        ? carltonLabelHtml(config, cartonNumber, palletNumber)
        : masterpressLabelHtml(config, cartonNumber, palletNumber);
    }).join("");

    return `<!doctype html>
      <html lang="pl">
      <head>
        <meta charset="utf-8">
        <title>Etykiety ${escapeHtml(orderNumber(config.order))}</title>
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
          .label-carlton footer{display:flex;height:14mm;align-items:flex-start;justify-content:space-between;padding:1.5mm 12mm 0;font-size:18pt;line-height:1}
          .label-carlton footer small{font-size:7pt}
          @media screen{body{display:grid;gap:8mm;padding:8mm;background:#e8edf2}.label-page{box-shadow:0 8px 25px rgba(0,0,0,.18)}}
          @media print{body{display:block;padding:0;background:#fff}.label-page{box-shadow:none}}
        </style>
      </head>
      <body>${pages}<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script></body>
      </html>`;
  }

  function printLabels(config) {
    const printWindow = window.open("", "_blank", "width=760,height=720");
    if (!printWindow) {
      showToast("Przeglądarka zablokowała okno wydruku.");
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(labelsPrintDocument(config));
    printWindow.document.close();

    store().addLabelRecord(config.order.id, {
      template: config.template,
      quantity: config.cartons,
      data: {
        source: "automatic-carton-labels",
        unitsPerCarton: config.unitsPerCarton,
        cartons: config.cartons,
        pallets: config.pallets,
        customerOrderNumber: config.customerOrderNumber,
        clientIndex: config.clientIndex,
        asin: config.carlton ? CARLTON_ASIN : "",
        misc: config.misc
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
  $("labelsPrintForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!selectedConfig || selectedConfig.errors.length) return;
    if (printLabels(selectedConfig)) {
      const count = selectedConfig.cartons;
      closeDialog();
      render();
      showToast(`Przygotowano ${formatNumber(count)} etykiet 100 × 75 mm.`);
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
