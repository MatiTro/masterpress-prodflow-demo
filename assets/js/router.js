let currentCss = null;
let currentScript = null;
let navigationRequestId = 0;
const PROD_FLOW_ASSET_VERSION = "0.11.0-github-test-20260821";

function versionedAsset(path) {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}v=${encodeURIComponent(PROD_FLOW_ASSET_VERSION)}`;
}

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

    const permissionLink = document.querySelector(`[data-module="${moduleKey}"]`);
    const allowedRoles = String(permissionLink?.dataset.roles || "")
        .split(",")
        .map(role => role.trim())
        .filter(Boolean);
    const currentRole = window.ProdFlow?.currentUser?.role || "";
    if (allowedRoles.length && !allowedRoles.includes(currentRole)) {
        window.alert("Twoje konto nie ma dostępu do tego modułu.");
        if (moduleKey !== "dashboard") loadModule("dashboard");
        return;
    }

    const requestId = ++navigationRequestId;
    const moduleBasePath = `modules/${module.folder}/${module.folder}`;
    let nextCss = null;

    try {
        if (!window.ProdFlow?.store || !window.ProdFlow?.events) {
            throw new Error(
                "ProdFlow core nie jest gotowy. Załaduj kolejno: events, utils, store i core."
            );
        }

        content.setAttribute("aria-busy", "true");

        /*
         * HTML i CSS pobieramy równolegle. Poprzedni moduł pozostaje
         * widoczny, dopóki arkusz stylów nowego modułu nie jest gotowy.
         * Zapobiega to pokazaniu nieostylowanego HTML (FOUC).
         */
        const htmlPromise = fetch(versionedAsset(`${moduleBasePath}.html`), {
            cache: "no-cache"
        }).then(response => {
            if (!response.ok) {
                throw new Error(`Nie można wczytać modułu: ${module.folder}`);
            }
            return response.text();
        });

        nextCss = document.createElement("link");
        nextCss.rel = "stylesheet";
        nextCss.href = versionedAsset(`${moduleBasePath}.css`);
        nextCss.dataset.prodflowModuleStyle = moduleKey;

        const cssPromise = new Promise((resolve, reject) => {
            nextCss.onload = resolve;
            nextCss.onerror = () => reject(
                new Error(`Nie można wczytać stylów modułu: ${module.folder}`)
            );
        });

        document.head.appendChild(nextCss);

        const [html] = await Promise.all([htmlPromise, cssPromise]);

        // Użytkownik zdążył wybrać inny moduł — porzuć starsze żądanie.
        if (requestId !== navigationRequestId) {
            nextCss.remove();
            return;
        }

        window.dispatchEvent(new CustomEvent("prodflow:module-unload"));

        if (currentScript) {
            currentScript.remove();
            currentScript = null;
        }

        const previousCss = currentCss;
        currentCss = nextCss;
        nextCss = null;

        /*
         * Nowy CSS jest już aktywny. Dopiero teraz podmieniamy HTML,
         * a stary arkusz usuwamy po wykonaniu podmiany.
         */
        content.innerHTML = html;
        content.dataset.currentModule = moduleKey;
        previousCss?.remove();

        currentScript = document.createElement("script");
        currentScript.src = versionedAsset(`${moduleBasePath}.js`);
        currentScript.dataset.prodflowModuleScript = moduleKey;

        await new Promise((resolve, reject) => {
            currentScript.onload = resolve;
            currentScript.onerror = () => reject(
                new Error(`Nie można wczytać skryptu modułu: ${module.folder}`)
            );
            document.body.appendChild(currentScript);
        });

        if (requestId !== navigationRequestId) {
            return;
        }

        // Każdy moduł zaczyna się od własnego nagłówka, niezależnie od
        // pozycji przewinięcia pozostawionej w poprzednim widoku.
        content.scrollTo({ top: 0, left: 0, behavior: "auto" });

        document.title = `ProdFlow • ${module.title}`;

        document.querySelectorAll("nav a").forEach(link => {
            link.classList.remove("active");
        });

        const activeLink = document.querySelector(`[data-module="${moduleKey}"]`);

        if (activeLink) {
            activeLink.classList.add("active");
        }

    } catch (error) {
        nextCss?.remove();
        console.error(error);

        if (requestId === navigationRequestId) {
            content.innerHTML = `
                <div style="padding:40px">
                    <h2>Błąd</h2>
                    <p>${error.message}</p>
                </div>
            `;
        }
    } finally {
        if (requestId === navigationRequestId) {
            content.removeAttribute("aria-busy");
        }
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
