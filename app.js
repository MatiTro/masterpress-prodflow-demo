window.PRODFLOW_CONFIG = Object.assign(
    {
        warehouseEmail: "magazyn@masterpress.com.pl"
    },
    window.PRODFLOW_CONFIG || {}
);

document.addEventListener("DOMContentLoaded", () => {

    initializeNavigation();

    const intro = document.getElementById("prodflowIntro");
    const loginForm = document.getElementById("prodflowLogin");
    const usernameInput = document.getElementById("prodflowUsername");
    const passwordInput = document.getElementById("prodflowPassword");
    const loginSubmit = document.getElementById("prodflowLoginSubmit");
    const loginError = document.getElementById("prodflowLoginError");
    const revealPassword = document.getElementById("prodflowRevealPassword");
    const menuToggle = document.getElementById("prodflowMenuToggle");
    const menuBackdrop = document.getElementById("prodflowMenuBackdrop");
    const sidebar = document.getElementById("prodflowSidebar");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let applicationStarted = false;

    function setMobileMenu(open) {
        const shouldOpen = Boolean(open);
        document.body.classList.toggle("pf-mobile-menu-open", shouldOpen);
        menuToggle?.setAttribute("aria-expanded", String(shouldOpen));
        menuBackdrop?.setAttribute("tabindex", shouldOpen ? "0" : "-1");
    }

    menuToggle?.addEventListener("click", () => {
        setMobileMenu(!document.body.classList.contains("pf-mobile-menu-open"));
    });

    menuBackdrop?.addEventListener("click", () => setMobileMenu(false));
    sidebar?.addEventListener("click", (event) => {
        if (event.target.closest("[data-module]")) setMobileMenu(false);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setMobileMenu(false);
    });

    window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
        if (event.matches) setMobileMenu(false);
    });

    function enableEntry() {
        if (!intro || !loginForm) {
            return;
        }

        intro.classList.add("is-ready");
        usernameInput.disabled = false;
        passwordInput.disabled = false;
        loginSubmit.disabled = false;
        revealPassword.disabled = false;
        usernameInput.focus({ preventScroll: true });
    }

    function startApplication() {
        if (applicationStarted) {
            return;
        }

        applicationStarted = true;
        loginSubmit.disabled = true;

        loadModule("dashboard");
        intro.classList.add("is-leaving");

        window.setTimeout(() => {
            intro.remove();
        }, reducedMotion ? 220 : 750);
    }

    function showLoginError(message) {
        loginError.textContent = message;
        loginForm.classList.remove("is-error");
        void loginForm.offsetWidth;
        loginForm.classList.add("is-error");
    }

    function handleLogin(event) {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        loginError.textContent = "";
        loginForm.classList.remove("is-error");

        if (!username || !password) {
            showLoginError("Uzupełnij login i hasło.");
            (!username ? usernameInput : passwordInput).focus();
            return;
        }

        if (username !== "admin" || password !== "admin") {
            showLoginError("Nieprawidłowy login lub hasło.");
            passwordInput.select();
            return;
        }

        loginForm.classList.add("is-authenticating");
        usernameInput.disabled = true;
        passwordInput.disabled = true;
        loginSubmit.disabled = true;
        revealPassword.disabled = true;

        const currentUser = {
            id: username.toLowerCase(),
            username,
            name: username.toLowerCase() === "admin" ? "Administrator" : username,
            role: "admin",
            loggedAt: new Date().toISOString()
        };
        sessionStorage.setItem(
            "prodflow.currentUser",
            JSON.stringify(currentUser)
        );
        window.ProdFlow = window.ProdFlow || {};
        window.ProdFlow.currentUser = currentUser;

        window.setTimeout(startApplication, reducedMotion ? 80 : 280);
    }

    function togglePasswordVisibility() {
        const passwordVisible = passwordInput.type === "text";
        passwordInput.type = passwordVisible ? "password" : "text";
        revealPassword.textContent = passwordVisible ? "Pokaż" : "Ukryj";
        revealPassword.setAttribute(
            "aria-label",
            passwordVisible ? "Pokaż hasło" : "Ukryj hasło"
        );
        passwordInput.focus();
    }

    if (!intro || !loginForm) {
        loadModule("dashboard");
        return;
    }

    try {
        const sessionUser = JSON.parse(
            sessionStorage.getItem("prodflow.currentUser") || "null"
        );

        if (sessionUser?.username) {
            window.ProdFlow = window.ProdFlow || {};
            window.ProdFlow.currentUser = sessionUser;
            intro.classList.add("is-ready");
            window.setTimeout(startApplication, reducedMotion ? 80 : 380);
            return;
        }
    } catch (_error) {
        sessionStorage.removeItem("prodflow.currentUser");
    }

    window.setTimeout(enableEntry, reducedMotion ? 80 : 900);
    loginForm.addEventListener("submit", handleLogin);
    revealPassword.addEventListener("click", togglePasswordVisibility);

});
