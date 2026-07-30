console.log("production-card.js uruchomiony");

function initProductionCard() {
  console.log("INIT production-card");

  /* =====================================================
     ŚCIEŻKA MODUŁU
  ===================================================== */
  const BASE = "modules/production-card/";

  /* =====================================================
     KONTENER MODUŁU
  ===================================================== */
  const moduleRoot =
    document.querySelector("#content") ||
    document.body;

  /* =====================================================
     MAPA GRAFIK
  ===================================================== */
  const graphicMap = {
    TDB: BASE + "image/tdb.png",
    TDBH: BASE + "image/tdbh.png",
    TDBD: BASE + "image/tdbd.png",
    TVB: BASE + "image/tvb.png"
  };

  /* =====================================================
     PAPIERY – AUTOUZUPEŁNIANIE
  ===================================================== */
  let papers = {};

  fetch(BASE + "data/papers.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Nie można wczytać papers.json. Status: ${response.status}`
        );
      }

      return response.json();
    })
    .then((data) => {
      papers = data;
    })
    .catch((error) => {
      console.error("papers.json error:", error);
    });

  function bindPaperAutocomplete(indexId, nameId) {
    const indexInput = document.getElementById(indexId);
    const nameInput = document.getElementById(nameId);

    if (!indexInput || !nameInput) {
      return;
    }

    const fill = () => {
      const key = indexInput.value.trim().toUpperCase();

      if (papers[key]) {
        nameInput.value = papers[key];
      }
    };

    indexInput.addEventListener("input", fill);
    indexInput.addEventListener("change", fill);
  }

  bindPaperAutocomplete("paperIndex", "paperName");
  bindPaperAutocomplete("bublakPaperIndex", "bublakPaperName");

  /* =====================================================
     INDEKSY FARB – DYNAMICZNE
  ===================================================== */
  const inksContainer = document.getElementById("inksContainer");

  function addInkField() {
    if (!inksContainer) {
      return;
    }

    const oldButton = inksContainer.querySelector(".add-ink-btn");

    if (oldButton) {
      oldButton.remove();
    }

    const row = document.createElement("div");
    row.className = "ink-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "np. FARBA-001";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "add-ink-btn";
    button.textContent = "+ Dodaj farbę";
    button.addEventListener("click", addInkField);

    row.appendChild(input);
    row.appendChild(button);

    inksContainer.appendChild(row);
  }

  if (inksContainer) {
    addInkField();
  }

  /* =====================================================
     CUSTOM SELECT
  ===================================================== */
  moduleRoot.addEventListener("click", (event) => {
    const trigger = event.target.closest(".select-trigger");

    if (trigger && moduleRoot.contains(trigger)) {
      const select = trigger.closest(".custom-select");

      if (!select) {
        return;
      }

      moduleRoot
        .querySelectorAll(".custom-select.open")
        .forEach((openedSelect) => {
          if (openedSelect !== select) {
            openedSelect.classList.remove("open");
          }
        });

      select.classList.toggle("open");
      return;
    }

    const option = event.target.closest(".select-option");

    if (option && moduleRoot.contains(option)) {
      const select = option.closest(".custom-select");

      if (!select) {
        return;
      }

      const valueElement = select.querySelector(".select-value");

      if (valueElement) {
        valueElement.textContent = option.textContent.trim();
      }

      select.dataset.value =
        option.dataset.value || option.textContent.trim();

      select.classList.remove("open");
      return;
    }

    moduleRoot
      .querySelectorAll(".custom-select.open")
      .forEach((select) => {
        select.classList.remove("open");
      });
  });

  /* =====================================================
     PODGLĄD GRAFIKI
  ===================================================== */
  const productTypeInput = document.getElementById("productType");
  const graphicPreview = document.getElementById("graphicPreview");

  function updateGraphicPreview() {
    if (!productTypeInput || !graphicPreview) {
      return;
    }

    const key = productTypeInput.value
      .trim()
      .toUpperCase();

    if (graphicMap[key]) {
      graphicPreview.src = graphicMap[key];
      graphicPreview.alt = `Podgląd grafiki ${key}`;
      graphicPreview.style.display = "block";
    } else {
      graphicPreview.removeAttribute("src");
      graphicPreview.alt = "";
      graphicPreview.style.display = "none";
    }
  }

  if (productTypeInput && graphicPreview) {
    productTypeInput.addEventListener(
      "input",
      updateGraphicPreview
    );

    productTypeInput.addEventListener(
      "change",
      updateGraphicPreview
    );

    updateGraphicPreview();
  }

  /* =====================================================
     BUBLAK – POKAŻ / UKRYJ
  ===================================================== */
  const embossedCheckbox = document.getElementById(
    "embossedPaperCheckbox"
  );

  const embossedFields = document.getElementById(
    "embossedPaperFields"
  );

  function updateEmbossedFields() {
    if (!embossedCheckbox || !embossedFields) {
      return;
    }

    embossedFields.style.display =
      embossedCheckbox.checked ? "block" : "none";
  }

  if (embossedCheckbox && embossedFields) {
    embossedCheckbox.addEventListener(
      "change",
      updateEmbossedFields
    );

    updateEmbossedFields();
  }

  /* =====================================================
     PASEK SILIKONOWY – DYNAMICZNE POLA
  ===================================================== */
  const siliconeSelect = document.getElementById(
    "siliconeSelect"
  );

  const siliconeFields = document.getElementById(
    "siliconeFields"
  );

  if (siliconeSelect && siliconeFields) {
    siliconeSelect.addEventListener("click", (event) => {
      const option = event.target.closest(".select-option");

      if (!option) {
        return;
      }

      const count = Number(option.dataset.value || 0);

      siliconeFields.innerHTML = "";

      for (let index = 1; index <= count; index += 1) {
        const label = document.createElement("label");
        label.textContent =
          `Rodzaj materiału – pasek ${index}`;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "silicone-input";

        label.appendChild(input);
        siliconeFields.appendChild(label);
      }
    });
  }

  /* =====================================================
     KALENDARZ
  ===================================================== */
  const dateInput = document.getElementById("deliveryDate");

  if (dateInput) {
    dateInput.addEventListener("click", () => {
      if (typeof dateInput.showPicker === "function") {
        dateInput.showPicker();
      }
    });
  }

  /* =====================================================
     POMOCNICZE ODCZYTYWANIE SELECTÓW
  ===================================================== */
  function getSelectValue(selector) {
    return (
      document.querySelector(
        `${selector} .select-value`
      )?.textContent?.trim() || ""
    );
  }

  /* =====================================================
     ZBIERANIE DANYCH DO WYDRUKU
  ===================================================== */
  function collectFormData() {
    const productType =
      document
        .getElementById("productType")
        ?.value
        ?.trim()
        ?.toUpperCase() || "";

    return {
      // A
      orderNumber:
        document.getElementById("orderNumber")?.value || "",

      clientOrderNumber:
        document.getElementById("clientOrderNumber")?.value || "",

      client:
        document.getElementById("client")?.value || "",

      clientIndex:
        document.getElementById("clientIndex")?.value || "",

      productIndex:
        document.getElementById("productIndex")?.value || "",

      orderQty:
        document.getElementById("orderQty")?.value || "",

      envelopeSize:
        document.getElementById("envelopeSize")?.value || "",

      // B
      paperIndex:
        document.getElementById("paperIndex")?.value || "",

      paperName:
        document.getElementById("paperName")?.value || "",

      paperSize:
        document.getElementById("paperSize")?.value || "",

      // C
      productType,

      graphicNumber:
        document.getElementById("graphicNumber")?.value || "",

      colorCount:
        document.getElementById("colorCount")?.value || "",

      graphicImage:
        graphicMap[productType] || "",

      printMethod:
        getSelectValue("#printMethodSelect"),

      printRoll:
        document.getElementById("printRoll")?.value || "",

      inks: [
        ...document.querySelectorAll(
          "#inksContainer input"
        )
      ]
        .map((input) => input.value)
        .filter((value) => value.trim() !== ""),

      // D
      perforation:
        document.querySelector(
          'input[name="perforation"]:checked'
        )?.value || "",

      tearStrip:
        getSelectValue("#tearStripSelect"),

      glue1:
        getSelectValue("#glue1Select"),

      glue2:
        getSelectValue("#glue2Select"),

      glue3:
        getSelectValue("#glue3Select"),

      // BUBLAK
      bublak:
        document.getElementById(
          "embossedPaperCheckbox"
        )?.checked || false,

      bublakDetails:
        document.getElementById(
          "embossedPaperCheckbox"
        )?.checked
          ? {
              paperIndex:
                document.getElementById(
                  "bublakPaperIndex"
                )?.value || "",

              paperName:
                document.getElementById(
                  "bublakPaperName"
                )?.value || "",

              paperSize:
                document.getElementById(
                  "bublakPaperSize"
                )?.value || ""
            }
          : null,

      // PASEK SILIKONOWY
      siliconeDetails: [
        ...document.querySelectorAll(
          "#siliconeFields .silicone-input"
        )
      ]
        .map((input) => input.value)
        .filter((value) => value.trim() !== ""),

      siliconeCount:
        getSelectValue("#siliconeSelect") || "Brak",

      palletSize:
        getSelectValue("#palletSizeSelect"),

      palletType:
        getSelectValue("#palletTypeSelect"),

      carton:
        getSelectValue("#cartonSelect"),

      // ELEMENTY STAŁE
      corner:
        document.getElementById("corner")?.checked || false,

      wrapping:
        document.getElementById("wrapping")?.checked || false,

      // F
      qtyCarton:
        document.getElementById("qtyCarton")?.value || "",

      qtyPallet:
        document.getElementById("qtyPallet")?.value || "",

      qtyLayer:
        document.getElementById("qtyLayer")?.value || "",

      palletHeight:
        document.getElementById("palletHeight")?.value || "",

      // G
      labelType:
        getSelectValue("#labelTypeSelect"),

      deliveryDate:
        document.getElementById("deliveryDate")?.value || "",

      notes:
        document.getElementById("notes")?.value || "",

      signature:
        document.getElementById("signature")?.value || "",

      date:
        new Date().toISOString()
    };
  }

  /* =====================================================
     DRUK
  ===================================================== */
  let isPrinting = false;

  const printButton = document.getElementById("printBtn");

  if (printButton) {
    printButton.addEventListener("click", () => {
      if (isPrinting) {
        return;
      }

      isPrinting = true;

      try {
        const printData = collectFormData();

        localStorage.setItem(
          "printData",
          JSON.stringify(printData)
        );

        const frame = document.createElement("iframe");

        frame.style.position = "fixed";
        frame.style.left = "-9999px";
        frame.style.top = "0";
        frame.style.width = "1px";
        frame.style.height = "1px";
        frame.style.border = "0";
        frame.setAttribute("aria-hidden", "true");

        frame.src = BASE + "print/print.html";

        frame.onload = () => {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch (error) {
            console.error("Błąd drukowania:", error);
          }

          setTimeout(() => {
            frame.remove();
            isPrinting = false;
          }, 1000);
        };

        frame.onerror = () => {
          console.error(
            "Nie udało się wczytać:",
            frame.src
          );

          frame.remove();
          isPrinting = false;
        };

        document.body.appendChild(frame);
      } catch (error) {
        console.error(
          "Nie udało się przygotować wydruku:",
          error
        );

        isPrinting = false;
      }
    });
  } else {
    console.warn(
      "Nie znaleziono przycisku #printBtn."
    );
  }
}

initProductionCard();