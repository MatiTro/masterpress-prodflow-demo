document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const orderId =
    params.get("orderId") ||
    sessionStorage.getItem("prodflow.activeOrderId") ||
    "";
  const store = window.ProdFlow?.store;
  const order = orderId && store?.getOrder
    ? store.getOrder(orderId)
    : null;
  const card =
    order?.metadata?.productionCard || {};
  const fields = card.fields || {};
  const inks = Array.isArray(card.inks)
    ? card.inks
    : [];
  const silicone = Array.isArray(card.silicone)
    ? card.silicone
    : [];

  const value = (...candidates) => {
    const resolved = candidates.find(
      candidate =>
        candidate !== undefined &&
        candidate !== null &&
        String(candidate).trim() !== ""
    );
    return resolved === undefined ? "" : resolved;
  };

  const yesNo = input =>
    input === true ||
    input === "true" ||
    input === "1" ||
    input === 1
      ? "TAK"
      : "NIE";

  const formatNumber = input => {
    if (input === "" || input === null || input === undefined) {
      return "";
    }
    const number = Number(input);
    return Number.isFinite(number)
      ? new Intl.NumberFormat("pl-PL").format(number)
      : String(input);
  };

  const formatDate = input => {
    if (!input) return "";
    const date = new Date(`${String(input).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? String(input)
      : new Intl.DateTimeFormat("pl-PL").format(date);
  };

  const setText = (id, input, fallback = "—") => {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent =
      input === "" ||
      input === null ||
      input === undefined
        ? fallback
        : String(input);
  };

  const orderNumber = value(
    fields.orderNumber,
    order?.order?.externalNumber,
    order?.number
  );

  setText("orderNumber", orderNumber);
  setText("qrOrderNumber", orderNumber, "Brak numeru");
  setText("footerOrderNumber", orderNumber);
  setText(
    "clientOrderNumber",
    value(
      fields.clientOrderNumber,
      order?.order?.customerOrderNumber
    )
  );
  setText(
    "client",
    value(fields.client, order?.customer?.name)
  );
  setText(
    "clientIndex",
    value(fields.clientIndex, order?.customer?.code)
  );
  setText(
    "responsiblePerson",
    value(
      fields.responsiblePerson,
      order?.customer?.contactPerson
    )
  );
  setText(
    "productIndex",
    value(fields.productIndex, order?.product?.code)
  );
  setText(
    "productName",
    value(fields.productName, order?.product?.name)
  );
  setText(
    "orderQty",
    formatNumber(
      value(
        fields.orderQty,
        order?.order?.quantity,
        order?.product?.quantity
      )
    )
  );
  setText("envelopeSize", fields.envelopeSize);
  setText("deliveryDate", formatDate(
    value(
      fields.deliveryDate,
      order?.order?.dueDate,
      order?.logistics?.deliveryDate
    )
  ));

  setText("paperIndex", fields.paperIndex);
  setText("paperName", fields.paperName);
  setText("paperSize", fields.paperSize);

  setText("qtyCarton", formatNumber(fields.qtyCarton));
  setText("qtyPallet", formatNumber(fields.qtyPallet));
  setText("qtyLayer", formatNumber(fields.qtyLayer));
  setText(
    "palletHeight",
    fields.palletHeight
      ? `${fields.palletHeight} cm`
      : ""
  );

  setText("productType", fields.productType);
  setText("graphicNumber", fields.graphicNumber);
  setText("graphicVersion", fields.graphicVersion);
  setText("graphicStatus", fields.graphicStatus);
  setText("colorCount", fields.colorCount);
  setText("printMethod", fields.printMethodSelect);
  setText("printRoll", fields.printRoll);

  const inksList = document.getElementById("inksList");
  if (inksList) {
    if (!inks.length) {
      inksList.innerHTML =
        '<span class="empty-value">Brak przypisanych farb</span>';
    } else {
      inksList.innerHTML = "";
      inks.forEach((ink, index) => {
        const chip = document.createElement("div");
        chip.className = "ink-chip";

        const title = document.createElement("strong");
        title.textContent = value(
          ink.index,
          ink.code,
          `Farba ${index + 1}`
        );

        const details = document.createElement("span");
        details.textContent = [
          ink.description,
          ink.quantity
            ? `${formatNumber(ink.quantity)} ${ink.unit || ""}`.trim()
            : ""
        ].filter(Boolean).join(" - ");

        chip.append(title, details);
        inksList.appendChild(chip);
      });
    }
  }

  setText(
    "siliconeSummary",
    silicone.length
      ? `${silicone.length} ${
          silicone.length === 1 ? "pasek" : "paski"
        }`
      : "Brak"
  );

  const siliconeDetails =
    document.getElementById("siliconeDetails");
  if (siliconeDetails) {
    siliconeDetails.innerHTML = "";
    silicone.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "compact-row";

      const label = document.createElement("span");
      label.textContent = `Pasek ${index + 1}`;

      const content = document.createElement("strong");
      content.textContent =
        typeof item === "object"
          ? [
              item.name,
              item.width,
              item.position,
              item.notes
            ].filter(Boolean).join(" / ") || "—"
          : String(item || "—");

      row.append(label, content);
      siliconeDetails.appendChild(row);
    });
  }

  setText(
    "tearStrip",
    {
      folia: "Folia",
      perforacja: "Perforacja",
      plastik: "Folia",
      papier: "Perforacja"
    }[String(fields.ppwrTearStrip || fields.tearStripSelect || "").toLowerCase()] || "Brak"
  );
  setText("corner", yesNo(fields.corner));
  setText("wrapping", yesNo(fields.wrapping));
  setText("glue1", fields.glue1Select);
  setText("glue2", fields.glue2Select);
  setText("glue3", fields.glue3Select);
  setText("palletSize", fields.palletSizeSelect);
  setText("palletType", fields.palletTypeSelect);
  setText("carton", fields.cartonSelect);
  setText("labelType", fields.labelTypeSelect);
  setText(
    "deliveryMethod",
    value(
      fields.deliveryMethod,
      order?.logistics?.deliveryMethod
    )
  );

  const bublakGroup =
    document.getElementById("bublakGroup");
  const bublakDetails =
    document.getElementById("bublakDetails");
  if (
    bublakGroup &&
    bublakDetails &&
    yesNo(fields.embossedPaperCheckbox) === "TAK"
  ) {
    bublakGroup.classList.remove("hidden");
    bublakDetails.innerHTML = "";
    [
      ["Indeks", fields.bublakPaperIndex],
      ["Papier", fields.bublakPaperName],
      ["Rozmiar", fields.bublakPaperSize]
    ].forEach(([labelText, contentText]) => {
      const row = document.createElement("div");
      row.className = "compact-row";
      const label = document.createElement("span");
      label.textContent = labelText;
      const content = document.createElement("strong");
      content.textContent = contentText || "—";
      row.append(label, content);
      bublakDetails.appendChild(row);
    });
  }

  setText(
    "notes",
    value(fields.notes, order?.order?.notes)
  );
  setText(
    "qualityRequirements",
    value(
      fields.qualityRequirements,
      order?.quality?.notes
    )
  );
  setText(
    "signature",
    value(fields.signature, order?.quality?.inspector)
  );
  setText(
    "approvalDate",
    formatDate(
      value(
        fields.approvalDate,
        order?.quality?.inspectionDate
      )
    )
  );
  setText(
    "printDate",
    new Intl.DateTimeFormat("pl-PL").format(new Date())
  );

  const qrContainer = document.getElementById("qrCode");
  if (
    qrContainer &&
    orderNumber &&
    typeof window.QRCode === "function"
  ) {
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: String(orderNumber),
      width: 160,
      height: 160,
      colorDark: "#101827",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });

    window.setTimeout(() => {
      const image = qrContainer.querySelector("img");

      if (image) {
        qrContainer
          .querySelectorAll("canvas, table")
          .forEach(element => element.remove());

        image.style.display = "block";
        image.style.width = "100%";
        image.style.height = "100%";
        image.style.margin = "0";
      }
    }, 80);
  } else if (qrContainer) {
    qrContainer.textContent = "Brak numeru";
  }

  window.setTimeout(() => {
    const page = document.querySelector(".print-page");
    const printableHeight =
      288 * (96 / 25.4);

    if (
      page &&
      page.scrollHeight > printableHeight
    ) {
      document.documentElement.classList.add(
        "print-extra-compact"
      );
    }

    window.print();
  }, 350);
});
