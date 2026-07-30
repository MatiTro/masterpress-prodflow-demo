function initComplaints() {
  const root = document.getElementById("complaintsModule");
  if (!root) return;

  const XLSX_SCRIPT = "assets/vendor/xlsx/xlsx.full.min.js";
  let importedRows = [];

  const fileInput = document.getElementById("complaintExcelInput");
  const chooseFileBtn = document.getElementById("chooseComplaintFileBtn");
  const uploadZone = document.getElementById("complaintUploadZone");
  const workspace = document.getElementById("complaintsWorkspace");
  const importError = document.getElementById("complaintImportError");
  const importProgress = document.getElementById("importProgress");

  const fields = {
    requestNumber: document.getElementById("requestNumber"),
    requestDate: document.getElementById("requestDate"),
    complaintNumber: document.getElementById("complaintNumber"),
    client: document.getElementById("complaintClient"),
    applicant: document.getElementById("complaintApplicant"),
    scrapReason: document.getElementById("scrapReason"),
    rootCause: document.getElementById("rootCause"),
    capaActions: document.getElementById("capaActions"),
    owner: document.getElementById("complaintOwner"),
    dueDate: document.getElementById("complaintDueDate"),
    notes: document.getElementById("complaintNotes")
  };

  const requiredFields = [
    { key: "requestNumber", label: "Numer wniosku" },
    { key: "requestDate", label: "Data wniosku" },
    { key: "client", label: "Klient" },
    { key: "applicant", label: "Wnioskodawca" },
    { key: "scrapReason", label: "Opis problemu" }
  ];

  const preview = {
    requestNumber: document.getElementById("previewRequestNumber"),
    requestDate: document.getElementById("previewRequestDate"),
    complaintNumber: document.getElementById("previewComplaintNumber"),
    client: document.getElementById("previewClient"),
    applicant: document.getElementById("previewApplicant"),
    scrapReason: document.getElementById("previewScrapReason"),
    rootCause: document.getElementById("previewRootCause"),
    capaActions: document.getElementById("previewCapaActions"),
    owner: document.getElementById("previewOwner"),
    dueDate: document.getElementById("previewDueDate"),
    notes: document.getElementById("previewNotes")
  };

  function getStore() {
    const store = window.ProdFlow?.store;
    if (!store) throw new Error("ProdFlow.store nie jest dostępny.");
    return store;
  }

  function resolveOrder() {
    const reference = clean(fields.requestNumber.value);
    if (!reference) return null;
    const orders = getStore().getOrders({ archived: false });
    return orders.find(order =>
      order.id === reference ||
      order.number === reference ||
      order.order?.externalNumber === reference
    ) || null;
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-prodflow-xlsx="true"]');

      if (existing) {
        existing.addEventListener("load", () => resolve(window.XLSX), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = XLSX_SCRIPT;
      script.async = true;
      script.dataset.prodflowXlsx = "true";
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error("Nie udało się załadować biblioteki XLSX."));
      document.head.appendChild(script);
    });
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalize(value) {
    return clean(value).toLowerCase().replace(/\s+/g, " ");
  }

  function valueFrom(row, names) {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalize(key)] = value;
    });

    for (const name of names) {
      const value = normalized[normalize(name)];
      if (value !== undefined) return value;
    }

    return "";
  }

  function numberValue(value) {
    if (typeof value === "number") return Math.abs(value);

    const parsed = Number(
      clean(value)
        .replace(/\s/g, "")
        .replace(",", ".")
    );

    return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
  }

  function text(value, fallback = "—") {
    return clean(value) || fallback;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pl-PL", {
      maximumFractionDigits: 3
    }).format(value || 0);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN"
    }).format(value || 0);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("pl-PL").format(date);
  }

  function escapeHtml(value) {
    return clean(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updatePreview() {
    preview.requestNumber.textContent = text(fields.requestNumber.value);
    preview.requestDate.textContent = formatDate(fields.requestDate.value);
    preview.complaintNumber.textContent = text(fields.complaintNumber.value);
    preview.client.textContent = text(fields.client.value);
    preview.applicant.textContent = text(fields.applicant.value);
    preview.scrapReason.textContent = text(fields.scrapReason.value, "Nie uzupełniono.");
    preview.rootCause.textContent = text(fields.rootCause.value, "Nie uzupełniono.");
    preview.capaActions.textContent = text(fields.capaActions.value, "Nie uzupełniono.");
    preview.owner.textContent = text(fields.owner.value);
    preview.dueDate.textContent = formatDate(fields.dueDate.value);
    preview.notes.textContent = text(fields.notes.value, "Nie uzupełniono.");
  }

  function updateCompletion() {
  const completionPercent = document.getElementById("completionPercent");
  const completionBar = document.getElementById("completionBar");
  const box = document.getElementById("missingDataBox");
  const title = document.getElementById("missingDataTitle");
  const list = document.getElementById("missingDataList");

  if (!importedRows.length) {
    completionPercent.textContent = "0%";
    completionBar.style.width = "0%";

    document.querySelectorAll(".required-field").forEach(label => {
      label.classList.remove("is-missing");
    });

    title.textContent = "Status dokumentu";
    list.className = "";
    list.innerHTML =
      '<div class="missing-chip">Najpierw zaimportuj plik z Dynamics 365</div>';

    box.style.background = "#f8fafb";
    return;
  }

  const missing = requiredFields.filter(item => {
    return !clean(fields[item.key].value);
  });

  const completed = requiredFields.length - missing.length;
  const percent = Math.round(
    (completed / requiredFields.length) * 100
  );

  completionPercent.textContent = `${percent}%`;
  completionBar.style.width = `${percent}%`;

  document.querySelectorAll(".required-field").forEach(label => {
    const control = label.querySelector("input, textarea");

    label.classList.toggle(
      "is-missing",
      !clean(control?.value)
    );
  });

  if (!missing.length) {
    title.textContent = "Status dokumentu";
    list.className = "";
    list.innerHTML =
      '<div class="ready-chip">✓ Wniosek jest gotowy do wydruku</div>';

    box.style.background = "#f5fbf7";
  } else {
    title.textContent =
      `Do uzupełnienia pozostało: ${missing.length}`;

    list.className = "missing-data-list";

    list.innerHTML = missing
      .map(item => {
        return `<span class="missing-chip">${escapeHtml(item.label)}</span>`;
      })
      .join("");

    box.style.background = "#f8fafb";
  }
}

  function renderRows() {
    const body = document.getElementById("complaintItemsBody");

    body.innerHTML = importedRows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(row.itemNumber)}</strong></td>
        <td>${escapeHtml(row.productName || "—")}</td>
        <td>${escapeHtml(row.batch || "—")}</td>
        <td>${escapeHtml(row.warehouse || "—")}</td>
        <td>${escapeHtml(row.location || "—")}</td>
        <td class="number">${formatNumber(row.quantity)}</td>
        <td class="number">${formatCurrency(row.cost)}</td>
      </tr>
    `).join("");

    const totalQty = importedRows.reduce((sum, row) => sum + row.quantity, 0);
    const totalValue = importedRows.reduce((sum, row) => sum + row.cost, 0);

    document.getElementById("itemsMeta").textContent =
      `${importedRows.length} pozycji · ${formatCurrency(totalValue)}`;

    document.getElementById("previewItems").innerHTML = `
      <table class="preview-items-table">
        <thead>
          <tr>
            <th>Lp.</th>
            <th>Indeks</th>
            <th>Partia</th>
            <th>Lokalizacja</th>
            <th>Ilość</th>
            <th>Wartość</th>
          </tr>
        </thead>
        <tbody>
          ${importedRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.itemNumber)}</td>
              <td>${escapeHtml(row.batch || "—")}</td>
              <td>${escapeHtml(row.location || "—")}</td>
              <td>${formatNumber(row.quantity)}</td>
              <td>${formatCurrency(row.cost)}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">Razem</td>
            <td>${formatNumber(totalQty)}</td>
            <td>${formatCurrency(totalValue)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function renderStats() {
    const totalValue = importedRows.reduce((sum, row) => sum + row.cost, 0);
    const batches = new Set(importedRows.map(row => row.batch).filter(Boolean));
    const warehouses = new Set(importedRows.map(row => row.warehouse).filter(Boolean));

    document.getElementById("statRows").textContent = importedRows.length;
    document.getElementById("statBatches").textContent = batches.size;
    document.getElementById("statWarehouses").textContent = warehouses.size;
    document.getElementById("statValue").textContent = formatCurrency(totalValue);
  }

  function buildInsights() {
    const insights = [];
    const totalValue = importedRows.reduce((sum, row) => sum + row.cost, 0);
    const batches = new Set(importedRows.map(row => row.batch).filter(Boolean));
    const warehouses = new Set(importedRows.map(row => row.warehouse).filter(Boolean));

    const missingBatchCount = importedRows.filter(row => !row.batch).length;
    const missingLocationCount = importedRows.filter(row => !row.location).length;
    const zeroValueCount = importedRows.filter(row => row.cost === 0).length;

    const largestItem = [...importedRows].sort((a, b) => b.cost - a.cost)[0];
    const largestItemShare = totalValue && largestItem
      ? Math.round((largestItem.cost / totalValue) * 100)
      : 0;

    const batchTotals = {};
    importedRows.forEach(row => {
      const key = row.batch || "Brak partii";
      batchTotals[key] = (batchTotals[key] || 0) + row.cost;
    });

    const largestBatch = Object.entries(batchTotals)
      .sort((a, b) => b[1] - a[1])[0];

    const largestBatchShare = totalValue && largestBatch
      ? Math.round((largestBatch[1] / totalValue) * 100)
      : 0;

    const duplicateMap = {};
    importedRows.forEach(row => {
      const key = `${row.itemNumber}|${row.batch}|${row.location}`;
      duplicateMap[key] = (duplicateMap[key] || 0) + 1;
    });

    const duplicateCount = Object.values(duplicateMap).filter(count => count > 1).length;

    if (warehouses.size === 1) {
      insights.push({
        type: "success",
        text: "Wszystkie pozycje pochodzą z jednego magazynu."
      });
    } else if (warehouses.size > 1) {
      insights.push({
        type: "warning",
        text: `Wniosek obejmuje ${warehouses.size} magazyny. Sprawdź, czy wszystkie pozycje dotyczą tej samej sprawy.`
      });
    }

    if (batches.size === 1 && missingBatchCount === 0) {
      insights.push({
        type: "info",
        text: "Wszystkie pozycje pochodzą z jednej partii. Może to wskazywać na wspólną przyczynę problemu."
      });
    } else if (largestBatchShare >= 70) {
      insights.push({
        type: "warning",
        text: `Partia ${largestBatch[0]} odpowiada za ${largestBatchShare}% wartości całego wniosku.`
      });
    }

    if (largestItemShare >= 40 && largestItem) {
      insights.push({
        type: "info",
        text: `Pozycja ${largestItem.itemNumber} stanowi ${largestItemShare}% wartości kasacji (${formatCurrency(largestItem.cost)}).`
      });
    }

    if (missingBatchCount) {
      insights.push({
        type: "warning",
        text: `${missingBatchCount} pozycji nie ma przypisanego numeru partii.`
      });
    }

    if (missingLocationCount) {
      insights.push({
        type: "warning",
        text: `${missingLocationCount} pozycji nie ma lokalizacji magazynowej.`
      });
    }

    if (zeroValueCount) {
      insights.push({
        type: "warning",
        text: `${zeroValueCount} pozycji ma wartość równą 0,00 zł.`
      });
    }

    if (duplicateCount) {
      insights.push({
        type: "warning",
        text: `Wykryto ${duplicateCount} możliwe duplikaty indeksu, partii i lokalizacji.`
      });
    }

    if (!missingBatchCount && !missingLocationCount && !zeroValueCount && !duplicateCount) {
      insights.push({
        type: "success",
        text: "Dane magazynowe są kompletne i nie wykryto oczywistych duplikatów."
      });
    }

    document.getElementById("assistantSummary").textContent =
      `ProdFlow znalazł ${importedRows.length} pozycji o łącznej wartości ${formatCurrency(totalValue)}. Analiza wskazuje najważniejsze zależności i dane wymagające sprawdzenia.`;

    document.getElementById("assistantInsights").innerHTML = insights
      .slice(0, 5)
      .map(item => `<div class="insight-message ${item.type}">${escapeHtml(item.text)}</div>`)
      .join("");
  }

  async function importFile(file) {
    importError.hidden = true;
    importProgress.hidden = false;

    document.getElementById("importTitle").textContent = "Analizowanie pliku...";
    document.getElementById("importSubtitle").textContent = file.name;

    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) throw new Error("Plik nie zawiera arkusza.");

      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: "",
        raw: true
      });

      const importedValue = aliases => {
        for (const row of rawRows) {
          const value = valueFrom(row, aliases);
          if (clean(value)) return value;
        }
        return "";
      };

      fields.requestNumber.value = clean(importedValue([
        "Numer zlecenia",
        "Zlecenie",
        "Numer wniosku",
        "Order number",
        "Sales order"
      ]));
      fields.client.value = clean(importedValue([
        "Klient",
        "Nazwa klienta",
        "Customer",
        "Customer name"
      ]));
      fields.complaintNumber.value = clean(importedValue([
        "Numer reklamacji",
        "Reklamacja",
        "Complaint number"
      ]));
      fields.applicant.value = clean(importedValue([
        "Wnioskodawca",
        "Zgłaszający",
        "Applicant"
      ]));

      const importedDate = importedValue([
        "Data wniosku",
        "Data reklamacji",
        "Request date",
        "Complaint date"
      ]);
      fields.requestDate.value = importedDate instanceof Date
        ? importedDate.toISOString().slice(0, 10)
        : /^\d{4}-\d{2}-\d{2}$/.test(clean(importedDate))
          ? clean(importedDate)
          : "";

      importedRows = rawRows.map(row => ({
        itemNumber: text(valueFrom(row, ["Numer pozycji", "Indeks", "Item number"]), ""),
        productName: text(valueFrom(row, ["Nazwa wyrobu", "Nazwa produktu", "Product name"]), ""),
        batch: text(valueFrom(row, ["Numer partii", "Partia", "Batch number"]), ""),
        warehouse: text(valueFrom(row, ["Magazyn", "Warehouse"]), ""),
        location: text(valueFrom(row, ["Lokalizacja", "Location"]), ""),
        quantity: numberValue(valueFrom(row, ["Ilość", "Ilosc", "Quantity"])),
        cost: numberValue(valueFrom(row, ["Kwota kosztu", "Wartość", "Wartosc", "Cost amount"]))
      })).filter(row =>
        row.itemNumber || row.batch || row.quantity || row.cost
      );

      if (!importedRows.length) {
        throw new Error("Nie znaleziono pozycji zgodnych z eksportem Dynamics.");
      }

      renderRows();
      renderStats();
      buildInsights();
      updatePreview();
      updateCompletion();

      workspace.hidden = false;
      document.getElementById("importTitle").textContent = "Import zakończony";
      document.getElementById("importSubtitle").textContent =
        `${file.name} · ${importedRows.length} pozycji`;

      requestAnimationFrame(() => {
        workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      console.error(error);
      importedRows = [];
      workspace.hidden = true;
      importError.textContent = `Nie udało się odczytać pliku: ${error.message}`;
      importError.hidden = false;
      document.getElementById("importTitle").textContent = "Zaimportuj eksport z Dynamics 365";
      document.getElementById("importSubtitle").textContent =
        "Przeciągnij plik tutaj lub wybierz go z dysku.";
      fileInput.value = "";
    } finally {
      importProgress.hidden = true;
    }
  }

  chooseFileBtn.addEventListener("click", event => {
    event.stopPropagation();
    fileInput.click();
  });

  uploadZone.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) importFile(file);
  });

  ["dragenter", "dragover"].forEach(eventName => {
    uploadZone.addEventListener(eventName, event => {
      event.preventDefault();
      uploadZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    uploadZone.addEventListener(eventName, event => {
      event.preventDefault();
      uploadZone.classList.remove("is-dragging");
    });
  });

  uploadZone.addEventListener("drop", event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) importFile(file);
  });

  Object.values(fields).forEach(field => {
    field.addEventListener("input", () => {
      updatePreview();
      updateCompletion();
    });

    field.addEventListener("change", () => {
      updatePreview();
      updateCompletion();
    });
  });

  function resetComplaints() {
    importedRows = [];

    fileInput.value = "";
    uploadZone.classList.remove("is-dragging");
    importProgress.hidden = true;

    importError.textContent = "";
    importError.hidden = true;

    Object.values(fields).forEach(field => {
      field.value = "";
    });

    document.getElementById("importTitle").textContent =
      "Zaimportuj eksport z Dynamics 365";
    document.getElementById("importSubtitle").textContent =
      "Przeciągnij plik tutaj lub wybierz go z dysku.";

    document.getElementById("complaintItemsBody").innerHTML = "";
    document.getElementById("itemsMeta").textContent = "0 pozycji";

    document.getElementById("statRows").textContent = "0";
    document.getElementById("statBatches").textContent = "0";
    document.getElementById("statWarehouses").textContent = "0";
    document.getElementById("statValue").textContent = formatCurrency(0);

    document.getElementById("assistantSummary").textContent =
      "Zaimportuj dane, aby zobaczyć analizę.";
    document.getElementById("assistantInsights").innerHTML = "";

    document.getElementById("previewItems").innerHTML = "";

    document.querySelectorAll(".required-field").forEach(label => {
      label.classList.remove("is-missing");
    });

    workspace.hidden = true;

    updatePreview();
    updateCompletion();

    root.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  document.getElementById("clearComplaintBtn").addEventListener("click", resetComplaints);

  document.getElementById("printComplaintBtn").addEventListener("click", () => {
    updatePreview();
    updateCompletion();
    const order = resolveOrder();
    if (!order) {
      window.alert("Nie znaleziono zlecenia w ProdFlow.store.");
      return;
    }
    const complaintNumber =
      clean(fields.complaintNumber.value) ||
      clean(fields.requestNumber.value);
    const exists = getStore().getComplaints(order.id)
      .some(item => item.number === complaintNumber);
    if (!exists) {
      getStore().addComplaint(order.id, {
        number: complaintNumber,
        status: clean(fields.capaActions.value) ? "in_progress" : "open",
        category: clean(fields.scrapReason.value),
        description: [
          clean(fields.scrapReason.value),
          clean(fields.rootCause.value),
          clean(fields.capaActions.value),
          clean(fields.notes.value)
        ].filter(Boolean).join("\n"),
        quantity: importedRows.reduce((sum, row) => sum + row.quantity, 0),
        resolution: clean(fields.capaActions.value),
        attachments: [{
          type: "d365-import",
          rows: importedRows,
          requestDate: fields.requestDate.value,
          dueDate: fields.dueDate.value,
          owner: fields.owner.value
        }]
      }, { module: "complaints" });
    }
    window.print();
  });

  updatePreview();
  updateCompletion();
}

initComplaints();
