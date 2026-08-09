document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId") || "";
  const recordId = params.get("recordId") || "";
  const store = window.ProdFlow?.store;
  const order = orderId && store?.getOrder ? store.getOrder(orderId) : null;
  const records = Array.isArray(order?.ppwr) ? order.ppwr : [];
  const record = records.find((item) => item.id === recordId) || records.at(-1);
  const fields = record?.fields || {};

  const showError = (message) => {
    const error = document.getElementById("printError");
    const documentRoot = document.getElementById("ppwrPrintDocument");
    if (documentRoot) documentRoot.hidden = true;
    if (error) {
      error.hidden = false;
      error.textContent = message;
    }
  };

  if (!order || !record) {
    showError("Nie znaleziono danych PPWR. Wróć do aplikacji, wybierz zlecenie i wygeneruj dokument ponownie.");
    return;
  }

  const value = (input, fallback = "-") => {
    const normalized = String(input ?? "").trim();
    return normalized || fallback;
  };

  const formatDate = (input) => {
    if (!input) return "-";
    const date = new Date(`${String(input).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? String(input)
      : new Intl.DateTimeFormat("pl-PL").format(date);
  };

  const tearLabel = {
    folia: "Folia",
    perforacja: "Perforacja",
    plastik: "Folia",
    papier: "Perforacja"
  }[String(fields.tearStrip || "").toLowerCase()] || "Brak";

  const values = {
    specificationNumber: value(fields.specificationNumber),
    documentDate: formatDate(fields.documentDate),
    documentStatus: record.status === "approved" ? "ZATWIERDZONA" : "WERSJA ROBOCZA",
    client: value(fields.client),
    supplier: value(fields.supplier, "Masterpress S.A."),
    productName: value(fields.productName, "Specyfikacja gotowego wyrobu"),
    orderNumber: value(fields.orderNumber),
    productIndex: value(fields.productIndex),
    material: value(fields.material),
    siliconeStrip: value(fields.siliconeStrip),
    tearStrip: tearLabel,
    glue1: value(fields.glue1),
    glue2: value(fields.glue2),
    glue3: value(fields.glue3),
    width: value(fields.width),
    height: value(fields.height),
    flap: value(fields.flap),
    bottomGusset: value(fields.bottomGusset),
    adhesiveStrips: value(fields.adhesiveStrips),
    colorsCount: value(fields.colorsCount),
    inkType: value(fields.inkType),
    printTechnique: value(fields.printTechnique),
    boxQuantity: value(fields.boxQuantity),
    palletQuantity: value(fields.palletQuantity),
    palletType: value(fields.palletType),
    banded: value(fields.banded),
    preparedBy: value(fields.preparedBy),
    checkedBy: value(fields.checkedBy),
    approvedBy: value(fields.approvedBy)
  };

  values.dimensionsSummary = [
    fields.width && `szer. ${fields.width} mm`,
    fields.height && `wys. ${fields.height} mm`,
    fields.flap && `klapa ${fields.flap} mm`,
    fields.bottomGusset && `fałda ${fields.bottomGusset} mm`,
    tearLabel !== "Brak" && `zrywka: ${tearLabel}`
  ].filter(Boolean).join(" / ") || "-";

  values.printSummary = [
    fields.colorsCount && `${fields.colorsCount} kolorów`,
    fields.inkType,
    fields.printTechnique
  ].filter(Boolean).join(" / ") || "-";

  values.packingSummary = [
    fields.boxQuantity && `${fields.boxQuantity} szt. w kartonie`,
    fields.palletQuantity && `${fields.palletQuantity} szt. na palecie`,
    fields.palletType
  ].filter(Boolean).join(" / ") || "-";

  Object.entries(values).forEach(([key, content]) => {
    document.querySelectorAll(`[data-field="${key}"]`).forEach((element) => {
      element.textContent = content;
    });
  });

  const photo = document.getElementById("technicalPhoto");
  if (photo && record.photoDataUrl) {
    const image = document.createElement("img");
    image.src = record.photoDataUrl;
    image.alt = "Zdjęcie techniczne produktu";
    photo.replaceChildren(image);
  }

  document.title = `PPWR-${values.specificationNumber.replace(/[^a-z0-9_-]+/gi, "-")}`;

  document.getElementById("printDocumentBtn")?.addEventListener("click", () => {
    window.print();
  });

  if (params.get("autoprint") === "1") {
    const images = Array.from(document.images);
    Promise.all(
      images.map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }))
    ).finally(() => {
      window.setTimeout(() => window.print(), 300);
    });
  }
});
