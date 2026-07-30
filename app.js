document.addEventListener("DOMContentLoaded", () => {

    initializeNavigation();

    const intro = document.getElementById("prodflowIntro");
    const loginForm = document.getElementById("prodflowLogin");
    const usernameInput = document.getElementById("prodflowUsername");
    const passwordInput = document.getElementById("prodflowPassword");
    const loginSubmit = document.getElementById("prodflowLoginSubmit");
    const loginError = document.getElementById("prodflowLoginError");
    const revealPassword = document.getElementById("prodflowRevealPassword");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let applicationStarted = false;

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

        window.setTimeout(startApplication, reducedMotion ? 80 : 550);
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

    window.setTimeout(enableEntry, reducedMotion ? 80 : 3900);
    loginForm.addEventListener("submit", handleLogin);
    revealPassword.addEventListener("click", togglePasswordVisibility);

});
