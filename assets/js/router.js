let currentCss = null;
let currentScript = null;

async function loadModule(moduleKey) {

    const module = MODULES[moduleKey];

    if (!module) {
        console.error(`Nie znaleziono modułu: ${moduleKey}`);
        return;
    }

    const content = document.getElementById("content");

    if (!content) {
        console.error("Nie znaleziono kontenera #content.");
        return;
    }

    try {

        if (!window.ProdFlow?.store || !window.ProdFlow?.events) {
            throw new Error(
                "ProdFlow core nie jest gotowy. Załaduj kolejno: events, utils, store i core."
            );
        }

        window.dispatchEvent(new CustomEvent("prodflow:module-unload"));

        // Usuń poprzedni CSS
        if (currentCss) {
            currentCss.remove();
            currentCss = null;
        }

        // Usuń poprzedni JS
        if (currentScript) {
            currentScript.remove();
            currentScript = null;
        }

        // Wczytaj HTML
        const response = await fetch(`modules/${module.folder}/${module.folder}.html`);

        if (!response.ok) {
            throw new Error(`Nie można wczytać modułu: ${module.folder}`);
        }

        content.innerHTML = await response.text();

        // Wczytaj CSS modułu
        currentCss = document.createElement("link");
        currentCss.rel = "stylesheet";
        currentCss.href = `modules/${module.folder}/${module.folder}.css`;
        document.head.appendChild(currentCss);

        // Wczytaj JS modułu
        currentScript = document.createElement("script");
        currentScript.src = `modules/${module.folder}/${module.folder}.js`;
        await new Promise((resolve, reject) => {
            currentScript.onload = resolve;
            currentScript.onerror = () => reject(
                new Error(`Nie można wczytać skryptu modułu: ${module.folder}`)
            );
            document.body.appendChild(currentScript);
        });

        // Tytuł strony
        document.title = `ProdFlow • ${module.title}`;

        // Aktywne menu
        document.querySelectorAll("nav a").forEach(link => {
            link.classList.remove("active");
        });

        const activeLink = document.querySelector(`[data-module="${moduleKey}"]`);

        if (activeLink) {
            activeLink.classList.add("active");
        }

    } catch (error) {

        console.error(error);

        content.innerHTML = `
            <div style="padding:40px">
                <h2>Błąd</h2>
                <p>${error.message}</p>
            </div>
        `;

    }

}

function initializeNavigation() {

    if (document.body.dataset.prodflowNavigationInitialized === "true") {
        return;
    }

    document.body.dataset.prodflowNavigationInitialized = "true";

    document.querySelectorAll("[data-module]").forEach(link => {

        link.addEventListener("click", (event) => {

            event.preventDefault();

            loadModule(link.dataset.module);

        });

    });

}

window.loadModule = loadModule;
window.initializeNavigation = initializeNavigation;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeNavigation, { once: true });
} else {
    initializeNavigation();
}
