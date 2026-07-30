function initPpwr() {
  const root = document.getElementById("ppwrModule");
  if (!root) return;

  const $ = id => document.getElementById(id);
  let currentOrderId = "";

  const fields = {
    specificationNumber: $("ppwrSpecificationNumber"),
    documentDate: $("ppwrDocumentDate"),
    client: $("ppwrClient"),
    supplier: $("ppwrSupplier"),
    productName: $("ppwrProductName"),
    orderNumber: $("ppwrOrderNumber"),
    productIndex: $("ppwrProductIndex"),
    material: $("ppwrMaterial"),
    siliconeStrip: $("ppwrSiliconeStrip"),
    tearOff: $("ppwrTearOff"),
    glue1: $("ppwrGlue1"),
    glue2: $("ppwrGlue2"),
    glue3: $("ppwrGlue3"),
    width: $("ppwrWidth"),
    height: $("ppwrHeight"),
    flap: $("ppwrFlap"),
    bottomGusset: $("ppwrBottomGusset"),
    adhesiveStrips: $("ppwrAdhesiveStrips"),
    tearStrip: $("ppwrTearStrip"),
    colorsCount: $("ppwrColorsCount"),
    inkType: $("ppwrInkType"),
    printTechnique: $("ppwrPrintTechnique"),
    boxQuantity: $("ppwrBoxQuantity"),
    palletQuantity: $("ppwrPalletQuantity"),
    palletType: $("ppwrPalletType"),
    banded: $("ppwrBanded"),
    preparedBy: $("ppwrPreparedBy"),
    checkedBy: $("ppwrCheckedBy"),
    approvedBy: $("ppwrApprovedBy")
  };

  const required = [
    ["specificationNumber", "numer specyfikacji"],
    ["documentDate", "data dokumentu"],
    ["client", "klient"],
    ["productName", "nazwa produktu"],
    ["material", "materiał"],
    ["width", "szerokość"],
    ["height", "wysokość"],
    ["colorsCount", "ilość kolorów"],
    ["printTechnique", "technika druku"],
    ["boxQuantity", "ilość w kartonie"],
    ["palletQuantity", "ilość na palecie"],
    ["preparedBy", "opracował"],
    ["checkedBy", "sprawdził"],
    ["approvedBy", "zatwierdził"]
  ];

  let photoDataUrl = "";
  let photoName = "";

  function getStore() {
    const store = window.ProdFlow?.store;
    if (!store) throw new Error("ProdFlow.store nie jest dostępny.");
    return store;
  }

  function resolveOrder() {
    const store = getStore();
    const activeId = sessionStorage.getItem("prodflow.activeOrderId");
    const reference = clean(fields.orderNumber.value);
    const orders = store.getOrders({ archived: false })
      .filter(item => item.processStep !== "card");
    const order = (
      reference
        ? orders.find(item =>
            item.id === reference ||
            item.number === reference ||
            item.order?.externalNumber === reference
          )
        : null
    ) || orders.find(item => item.id === activeId) || null;
    currentOrderId = order?.id || "";
    return order || null;
  }

  function availableOrders() {
    return getStore().getOrders({ archived: false }).filter(order =>
      order.processStep !== "card" &&
      order.status !== "draft" &&
      order.status !== "cancelled"
    );
  }

  function orderReference(order) {
    return clean(order.number || order.id);
  }

  function externalReference(order) {
    return clean(order.order?.externalNumber);
  }

  function ppwrStatus(order) {
    const records = Array.isArray(order.ppwr) ? order.ppwr : [];
    if (records.some(item => item.status === "approved")) return "approved";
    if (records.length) return "draft";
    return "empty";
  }

  function ppwrStatusLabel(status) {
    return {
      empty: "Nieutworzony",
      draft: "Roboczy",
      approved: "Gotowy"
    }[status] || "Nieutworzony";
  }

  function applyOrderToForm(order) {
    if (!order) return;

    currentOrderId = order.id;
    sessionStorage.setItem("prodflow.activeOrderId", order.id);

    const card = order.metadata?.productionCard || {};
    const cardFields = card.fields || {};
    const dimensions = order.product?.dimensions || {};
    const paper = Array.isArray(order.materials)
      ? order.materials.find(item => item.type === "paper")
      : null;
    const glues = Array.isArray(order.materials)
      ? order.materials.filter(item => item.type === "glue")
      : [];
    const inks = Array.isArray(card.inks) ? card.inks : [];
    const latest = Array.isArray(order.ppwr)
      ? order.ppwr[order.ppwr.length - 1]
      : null;

    fields.specificationNumber.value =
      latest?.fields?.specificationNumber ||
      externalReference(order) ||
      orderReference(order);
    fields.documentDate.value =
      latest?.fields?.documentDate ||
      new Date().toISOString().slice(0, 10);
    fields.client.value = order.customer?.name || "";
    fields.supplier.value = "Masterpress S.A.";
    fields.productName.value = order.product?.name || "";
    fields.orderNumber.value = orderReference(order);
    fields.productIndex.value = order.product?.code || "";
    fields.material.value = [
      paper?.name || paper?.code || cardFields.paperName || cardFields.paperIndex,
      paper?.metadata?.size || cardFields.paperSize
    ].filter(Boolean).join(" / ");
    fields.siliconeStrip.value =
      cardFields.siliconeSelect ||
      (Array.isArray(card.silicone)
        ? card.silicone.map(item => item.name || item.code).filter(Boolean).join(", ")
        : "");
    fields.tearOff.value = cardFields.tearStripSelect || "";
    fields.glue1.value = glues[0]?.name || cardFields.glue1Select || "";
    fields.glue2.value = glues[1]?.name || cardFields.glue2Select || "";
    fields.glue3.value = glues[2]?.name || cardFields.glue3Select || "";
    fields.width.value = dimensions.width || cardFields.ppwrWidth || "";
    fields.height.value = dimensions.height || cardFields.ppwrHeight || "";
    fields.flap.value = dimensions.length || cardFields.ppwrFlap || "";
    fields.bottomGusset.value =
      dimensions.bottomGusset || cardFields.ppwrBottomGusset || "";
    fields.adhesiveStrips.value =
      dimensions.adhesiveStrips || cardFields.ppwrAdhesiveStrips || "";
    fields.tearStrip.value =
      dimensions.tearStrip || cardFields.ppwrTearStrip || "";
    fields.colorsCount.value = cardFields.colorCount || inks.length || "";
    fields.inkType.value = inks.map(item => item.name || item.code).filter(Boolean).join(", ");
    fields.printTechnique.value =
      cardFields.printMethodSelect || order.technology?.instructions || "";
    fields.boxQuantity.value =
      order.packing?.unitsPerPackage || cardFields.qtyCarton || "";
    fields.palletQuantity.value = cardFields.qtyPallet || "";
    fields.palletType.value =
      order.packing?.palletType || cardFields.palletTypeSelect || "";

    if (latest) applyDraft(latest);
    updateAll();
    root.querySelector(".ppwr-topbar")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function renderOrderBrowser() {
    const body = $("ppwrOrdersBody");
    if (!body) return;

    const query = clean($("ppwrOrderSearch")?.value).toLowerCase();
    const statusFilter = $("ppwrOrderStatusFilter")?.value || "all";
    const orders = availableOrders()
      .filter(order => statusFilter === "all" || ppwrStatus(order) === statusFilter)
      .filter(order => {
        if (!query) return true;
        return [
          orderReference(order),
          externalReference(order),
          order.customer?.name,
          order.product?.name,
          order.product?.code
        ].some(value => clean(value).toLowerCase().includes(query));
      })
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    body.innerHTML = orders.map(order => {
      const status = ppwrStatus(order);
      const date = order.order?.dueDate
        ? new Intl.DateTimeFormat("pl-PL").format(new Date(`${order.order.dueDate}T12:00:00`))
        : "—";
      return `
        <tr class="${order.id === currentOrderId ? "is-selected" : ""}">
          <td><strong>${escapeHtml(orderReference(order))}</strong></td>
          <td>${escapeHtml(externalReference(order) || "—")}</td>
          <td>${escapeHtml(order.customer?.name || "—")}</td>
          <td><strong>${escapeHtml(order.product?.name || "—")}</strong><small>${escapeHtml(order.product?.code || "—")}</small></td>
          <td>${escapeHtml(date)}</td>
          <td><span class="ppwr-order-status ppwr-order-status--${status}">${ppwrStatusLabel(status)}</span></td>
          <td><button class="ppwr-btn ppwr-btn-primary" type="button" data-ppwr-order="${escapeHtml(order.id)}">${status === "empty" ? "Utwórz PPWR" : "Otwórz"}</button></td>
        </tr>`;
    }).join("");

    $("ppwrOrdersEmpty").hidden = orders.length > 0;
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function text(value, fallback = "—") {
    return clean(value) || fallback;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("pl-PL").format(date);
  }

  function sectionDefinitions() {
    return [
      {
        id: "ppwrBasicSection",
        complete: Boolean(
          clean(fields.specificationNumber.value) &&
          clean(fields.documentDate.value) &&
          clean(fields.client.value) &&
          clean(fields.productName.value)
        )
      },
      {
        id: "ppwrMaterialsSection",
        complete: Boolean(clean(fields.material.value))
      },
      {
        id: "ppwrDimensionsSection",
        complete: Boolean(Number(fields.width.value) && Number(fields.height.value))
      },
      {
        id: "ppwrPrintSection",
        complete: Boolean(Number(fields.colorsCount.value) && clean(fields.printTechnique.value))
      },
      {
        id: "ppwrPackagingSection",
        complete: Boolean(Number(fields.boxQuantity.value) && Number(fields.palletQuantity.value))
      },
      {
        id: "ppwrPhotoSection",
        complete: Boolean(photoDataUrl)
      },
      {
        id: "ppwrApprovalSection",
        complete: Boolean(
          clean(fields.preparedBy.value) &&
          clean(fields.checkedBy.value) &&
          clean(fields.approvedBy.value)
        )
      }
    ];
  }

  function updateCompletion() {
    const missing = required
      .filter(([key]) => {
        const field = fields[key];
        if (!field) return true;
        return field.type === "number"
          ? !Number(field.value)
          : !clean(field.value);
      })
      .map(([, label]) => label);

    if (!photoDataUrl) missing.push("zdjęcie techniczne");

    const total = required.length + 1;
    const completed = total - missing.length;
    const percent = Math.max(0, Math.round((completed / total) * 100));

    $("ppwrCompletionPercent").textContent = `${percent}%`;
    $("ppwrCompletionBar").style.width = `${percent}%`;
    $("ppwrMissingCount").textContent = missing.length;

    $("ppwrMissingSummary").textContent = missing.length
      ? `Brakuje ${missing.length} ${missing.length === 1 ? "elementu" : "elementów"}.`
      : "Dokument jest kompletny.";

    $("ppwrMissingList").innerHTML = missing.length
      ? missing.slice(0, 6).map(item => `<em>${escapeHtml(item)}</em>`).join("")
      : '<em class="is-ready">Dokument gotowy</em>';

    $("ppwrStatus").textContent = percent === 100 ? "Gotowa" : "Robocza";
    $("ppwrStatus").style.background = percent === 100 ? "#e8f6ee" : "#eef1f4";
    $("ppwrStatus").style.color = percent === 100 ? "#16754a" : "#65727d";
  }

  function updateSections() {
    sectionDefinitions().forEach(section => {
      const card = $(section.id);
      const state = card.querySelector(".ppwr-section-state");
      const navButton = root.querySelector(`[data-target="${section.id}"]`);

      card.classList.toggle("is-complete", section.complete);
      state.textContent = section.complete ? "Uzupełnione" : "Do uzupełnienia";

      navButton.classList.toggle("is-complete", section.complete);
      navButton.classList.toggle("is-warning", !section.complete);
      navButton.querySelector("em").textContent = section.complete ? "✓" : "!";
    });
  }

  function updatePreview() {
    $("ppwrSpecNumber").textContent = text(fields.specificationNumber.value);
    $("ppwrTopClient").textContent = text(fields.client.value);

    $("previewDate").textContent = formatDate(fields.documentDate.value);
    $("previewSpecNumber").textContent = text(fields.specificationNumber.value);
    $("previewClient").textContent = text(fields.client.value);
    $("previewSupplier").textContent = text(fields.supplier.value, "Masterpress S.A.");
    $("previewProduct").textContent = text(fields.productName.value);
    $("previewMaterial").textContent = text(fields.material.value);

    $("previewProductName").textContent = clean(fields.productName.value)
      ? `SPECYFIKACJA GOTOWEGO WYROBU – ${fields.productName.value}`
      : "SPECYFIKACJA GOTOWEGO WYROBU";

    const photoBox = $("previewPhotoBox");

    if (photoDataUrl) {
      photoBox.innerHTML = `<img src="${photoDataUrl}" alt="Zdjęcie techniczne">`;
    } else {
      photoBox.innerHTML = "<span>Zdjęcie techniczne</span>";
    }
  }

  function updateAll() {
    updatePreview();
    updateCompletion();
    updateSections();
  }

  function escapeHtml(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizePdfText(value) {
    return clean(value)
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pl-PL");
  }

  const PDF_FIELD_LABELS = [
    "Numer zlecenia", "Zlecenie klienta", "Klient", "Indeks klienta",
    "Indeks produktu", "Nazwa produktu", "Ilość zamówiona", "Wymiary wyrobu",
    "Termin realizacji", "Osoba odpowiedzialna", "Indeks papieru",
    "Rozmiar papieru", "Rodzaj papieru", "W kartonie", "Na palecie",
    "Na warstwie", "Wysokość palety", "Rodzaj wyrobu", "Numer grafiki",
    "Wersja", "Status grafiki", "Liczba kolorów", "Sposób zadruku",
    "Wałek do druku", "Pasek silikonowy", "Zrywka", "Perforacja",
    "Narożnik", "Foliowanie", "Klej 1", "Klej 2", "Klej 3",
    "Paleta - wymiar", "Paleta - typ", "Karton", "Etykieta", "Metoda dostawy"
  ].map(normalizePdfText);

  function isPdfFieldLabel(value) {
    const normalized = normalizePdfText(value);
    return PDF_FIELD_LABELS.some(label =>
      normalized === label || normalized.startsWith(`${label} `)
    );
  }

  function findPdfValue(content, labels) {
    const lines = content.lines || [];
    const tokens = content.tokens || [];
    const normalizedLabels = labels.map(normalizePdfText);

    for (const token of tokens) {
      const normalizedToken = normalizePdfText(token.text);
      if (!normalizedLabels.some(label =>
        normalizedToken === label
      )) {
        continue;
      }

      const validCandidate = candidate =>
        clean(candidate.text) &&
        clean(candidate.text) !== "—" &&
        !isPdfFieldLabel(candidate.text);

      const below = tokens
        .filter(candidate =>
          candidate.page === token.page &&
          validCandidate(candidate) &&
          token.y - candidate.y >= 3 &&
          token.y - candidate.y <= 42 &&
          candidate.x >= token.x - 8 &&
          candidate.x <= token.x + Math.max(token.width + 70, 170)
        )
        .sort((a, b) =>
          (token.y - a.y) - (token.y - b.y) ||
          Math.abs(token.x - a.x) - Math.abs(token.x - b.x)
        )[0];

      if (below) return clean(below.text);

      const onRight = tokens
        .filter(candidate =>
          candidate.page === token.page &&
          validCandidate(candidate) &&
          Math.abs(candidate.y - token.y) <= 2.5 &&
          candidate.x > token.x + token.width - 2 &&
          candidate.x - token.x <= 260
        )
        .sort((a, b) => a.x - b.x)[0];

      if (onRight) return clean(onRight.text);
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = clean(lines[index]);
      const normalizedLine = normalizePdfText(line);

      for (const label of normalizedLabels) {
        const position = normalizedLine.indexOf(label);
        if (position === -1) continue;

        const inlineValue = clean(line.slice(position + label.length))
          .replace(/^[:|\-–—\s]+/, "");

        if (inlineValue && normalizePdfText(inlineValue) !== label) {
          return inlineValue;
        }

        for (let offset = 1; offset <= 3; offset += 1) {
          const candidate = clean(lines[index + offset]);
          const normalizedCandidate = normalizePdfText(candidate);

          if (
            candidate &&
            candidate !== "—" &&
            !normalizedLabels.includes(normalizedCandidate)
          ) {
            return candidate;
          }
        }
      }
    }

    return "";
  }

  function numberFromPdf(value) {
    const match = clean(value)
      .replace(",", ".")
      .match(/\d+(?:\.\d+)?/);
    return match ? match[0] : "";
  }

  function applyDimensionsFromPdf(value) {
    const dimensions = clean(value)
      .replaceAll(",", ".")
      .match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/);

    if (!dimensions) return 0;

    let filled = 0;
    if (dimensions[1]) {
      fields.width.value = dimensions[1];
      filled += 1;
    }
    if (dimensions[2]) {
      fields.height.value = dimensions[2];
      filled += 1;
    }
    if (dimensions[3]) {
      fields.flap.value = dimensions[3];
      filled += 1;
    }
    return filled;
  }

  async function extractPdfContent(file) {
    const moduleUrl = new URL(
      "assets/vendor/pdfjs/pdf.mjs",
      document.baseURI
    ).href;
    const workerUrl = new URL(
      "assets/vendor/pdfjs/pdf.worker.mjs",
      document.baseURI
    ).href;
    const pdfjs = await import(moduleUrl);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const documentData = await pdfjs.getDocument({
      data: await file.arrayBuffer()
    }).promise;
    const lines = [];
    const tokens = [];

    for (let pageNumber = 1; pageNumber <= documentData.numPages; pageNumber += 1) {
      const page = await documentData.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = [];

      content.items
        .filter(item => clean(item.str))
        .sort((a, b) => {
          const yDifference = b.transform[5] - a.transform[5];
          return Math.abs(yDifference) > 2
            ? yDifference
            : a.transform[4] - b.transform[4];
        })
        .forEach(item => {
          const y = item.transform[5];
          tokens.push({
            page: pageNumber,
            text: clean(item.str),
            x: item.transform[4],
            y,
            width: Number(item.width) || 0
          });
          let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2);
          if (!row) {
            row = { y, items: [] };
            rows.push(row);
          }
          row.items.push(item);
        });

      rows
        .sort((a, b) => b.y - a.y)
        .forEach(row => {
          const line = row.items
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map(item => clean(item.str))
            .filter(Boolean)
            .join(" ");
          if (line) lines.push(line);
        });
    }

    return { lines, tokens };
  }

  function populateFromProductionPdf(content) {
    const mappings = [
      ["orderNumber", ["Numer zlecenia"]],
      ["productIndex", ["Indeks produktu"]],
      ["client", ["Klient"]],
      ["productName", ["Nazwa produktu"]],
      ["siliconeStrip", ["Pasek silikonowy"]],
      ["tearOff", ["Zrywka"]],
      ["glue1", ["Klej 1"]],
      ["glue2", ["Klej 2"]],
      ["glue3", ["Klej 3"]],
      ["inkType", ["Indeksy farb"]],
      ["printTechnique", ["Sposób zadruku"]],
      ["palletType", ["Paleta - typ", "Paleta – typ"]],
      ["banded", ["Foliowanie"]]
    ];
    let filled = 0;

    mappings.forEach(([fieldName, labels]) => {
      const value = findPdfValue(content, labels);
      if (value && value !== "Brak") {
        fields[fieldName].value = value;
        filled += 1;
      }
    });

    const materialParts = [
      findPdfValue(content, ["Rodzaj papieru"]),
      findPdfValue(content, ["Rozmiar papieru"])
    ].filter(value => value && value !== "—");

    if (materialParts.length) {
      fields.material.value = materialParts.join(" / ");
      filled += 1;
    }

    const dimensions = findPdfValue(content, ["Wymiary wyrobu"]);
    filled += applyDimensionsFromPdf(dimensions);

    const numericMappings = [
      ["colorsCount", ["Liczba kolorów"]],
      ["boxQuantity", ["W kartonie"]],
      ["palletQuantity", ["Na palecie"]]
    ];

    numericMappings.forEach(([fieldName, labels]) => {
      const value = numberFromPdf(findPdfValue(content, labels));
      if (value) {
        fields[fieldName].value = value;
        filled += 1;
      }
    });

    if (!clean(fields.specificationNumber.value) && clean(fields.orderNumber.value)) {
      fields.specificationNumber.value = fields.orderNumber.value;
      filled += 1;
    }

    fields.documentDate.value = new Date().toISOString().slice(0, 10);
    updateAll();
    return filled;
  }

  async function importProductionPdf(file) {
    const drop = $("ppwrPdfDrop");
    const title = $("ppwrPdfTitle");
    const status = $("ppwrPdfStatus");

    drop.classList.remove("is-success", "is-error");
    title.textContent = "Analizowanie Karty Produkcyjnej…";
    status.textContent = file.name;

    try {
      const content = await extractPdfContent(file);
      const filled = populateFromProductionPdf(content);

      if (!filled) {
        throw new Error(
          "Nie rozpoznano pól Karty Produkcyjnej. Sprawdź, czy wybrano właściwy PDF."
        );
      }

      drop.classList.add("is-success");
      title.textContent = "Dane zostały odczytane";
      status.textContent =
        `${file.name} · uzupełniono ${filled} ${filled === 1 ? "pole" : "pól"}. Sprawdź dane przed zapisem.`;
    } catch (error) {
      console.error(error);
      drop.classList.add("is-error");
      title.textContent = "Nie udało się odczytać PDF";
      status.textContent = error.message;
    }
  }

  function serializeDraft() {
    const data = {};

    Object.entries(fields).forEach(([key, field]) => {
      data[key] = field.type === "checkbox"
        ? field.checked
        : field.value;
    });

    return {
      fields: data,
      photoDataUrl,
      photoName,
      savedAt: new Date().toISOString()
    };
  }

  function applyDraft(draft) {
    if (!draft?.fields) return;

    Object.entries(draft.fields).forEach(([key, value]) => {
      const field = fields[key];
      if (!field) return;

      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value ?? "";
    });

    photoDataUrl = draft.photoDataUrl || "";
    photoName = draft.photoName || "";

    renderPhotoState();
    updateAll();
  }

  function saveDraft() {
    const order = resolveOrder();
    if (!order) {
      window.alert("Brak aktywnego zlecenia w ProdFlow.store.");
      return;
    }
    const records = Array.isArray(order.ppwr) ? order.ppwr : [];
    const draft = {
      id: records.find(item => item.status === "draft")?.id || `ppwr-${Date.now()}`,
      status: "draft",
      ...serializeDraft()
    };
    const next = [
      ...records.filter(item => item.id !== draft.id),
      draft
    ];
    getStore().updateOrder(order.id, { ppwr: next }, {
      module: "ppwr",
      historyMessage: "Zapisano wersję roboczą PPWR."
    });

    const button = $("ppwrSaveDraftBtn");
    const oldText = button.textContent;
    button.textContent = "Zapisano";
    setTimeout(() => {
      button.textContent = oldText;
    }, 1200);
  }

  function loadDraft() {
    const order = resolveOrder();
    const records = Array.isArray(order?.ppwr) ? order.ppwr : [];
    const draft = [...records].reverse().find(item => item.status === "draft") ||
      records[records.length - 1];
    if (draft) applyDraft(draft);
  }

  function clearModule() {
    Object.values(fields).forEach(field => {
      if (field.type === "checkbox") {
        field.checked = false;
      } else if (field.id === "ppwrSupplier") {
        field.value = "Masterpress S.A.";
      } else {
        field.value = "";
      }
    });

    fields.documentDate.value = new Date().toISOString().slice(0, 10);

    photoDataUrl = "";
    photoName = "";
    renderPhotoState();
    updateAll();

    root.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function renderPhotoState() {
    $("ppwrPhotoEmpty").hidden = Boolean(photoDataUrl);
    $("ppwrPhotoPreview").hidden = !photoDataUrl;

    if (photoDataUrl) {
      $("ppwrPhotoImage").src = photoDataUrl;
      $("ppwrPhotoName").textContent = photoName || "zdjęcie techniczne";
    } else {
      $("ppwrPhotoImage").removeAttribute("src");
      $("ppwrPhotoName").textContent = "";
    }
  }

  function readPhoto(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();

    reader.onload = () => {
      photoDataUrl = String(reader.result);
      photoName = file.name;
      renderPhotoState();
      updateAll();
    };

    reader.readAsDataURL(file);
  }

  Object.values(fields).forEach(field => {
    field.addEventListener("input", updateAll);
    field.addEventListener("change", updateAll);
  });

  $("ppwrOrderSearch")?.addEventListener("input", renderOrderBrowser);
  $("ppwrOrderStatusFilter")?.addEventListener("change", renderOrderBrowser);
  $("ppwrOrdersBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-ppwr-order]");
    if (!button) return;
    const order = availableOrders().find(item => item.id === button.dataset.ppwrOrder);
    applyOrderToForm(order);
    renderOrderBrowser();
  });

  root.querySelectorAll("[data-target]").forEach(button => {
    button.addEventListener("click", () => {
      const target = $(button.dataset.target);

      root.querySelectorAll("[data-target]").forEach(item => {
        item.classList.remove("is-active");
      });

      button.classList.add("is-active");

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  const photoInput = $("ppwrPhotoInput");
  const photoDrop = $("ppwrPhotoDrop");

  $("ppwrPhotoChooseBtn").addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (file) readPhoto(file);
  });

  ["dragenter", "dragover"].forEach(eventName => {
    photoDrop.addEventListener(eventName, event => {
      event.preventDefault();
      photoDrop.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    photoDrop.addEventListener(eventName, event => {
      event.preventDefault();
      photoDrop.classList.remove("is-dragging");
    });
  });

  photoDrop.addEventListener("drop", event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) readPhoto(file);
  });

  $("ppwrPhotoRemoveBtn").addEventListener("click", () => {
    photoDataUrl = "";
    photoName = "";
    photoInput.value = "";
    renderPhotoState();
    updateAll();
  });

  $("ppwrClearBtn").addEventListener("click", clearModule);
  $("ppwrSaveDraftBtn").addEventListener("click", saveDraft);

  $("ppwrGenerateBtn").addEventListener("click", () => {
    updateAll();
    const order = resolveOrder();
    if (order) {
      const records = Array.isArray(order.ppwr) ? order.ppwr : [];
      const record = {
        id: `ppwr-${Date.now()}`,
        status: "approved",
        ...serializeDraft(),
        approvedAt: new Date().toISOString()
      };
      getStore().updateOrder(order.id, { ppwr: [...records, record] }, {
        module: "ppwr",
        historyMessage: "Wygenerowano i zatwierdzono dokument PPWR."
      });
    }
    $("ppwrDialog").showModal();
  });

  $("ppwrDialogClose").addEventListener("click", () => {
    $("ppwrDialog").close();
  });

  $("ppwrZoomBtn").addEventListener("click", () => {
    const paper = $("ppwrPaper");
    paper.classList.toggle("is-zoomed");
    $("ppwrZoomBtn").textContent = paper.classList.contains("is-zoomed")
      ? "Pomniejsz"
      : "Powiększ";
  });

  fields.documentDate.value = new Date().toISOString().slice(0, 10);
  [
    "store:order-updated",
    "store:order-status-changed",
    "store:database-imported"
  ].forEach(name => window.ProdFlow?.events?.on(name, () => {
    if (document.contains(root)) {
      renderOrderBrowser();
      if (currentOrderId) loadDraft();
    }
  }));
  loadDraft();
  renderOrderBrowser();
  renderPhotoState();
  updateAll();
}

initPpwr();
