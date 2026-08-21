window.PRODFLOW_CONFIG = Object.assign(
  {
    warehouseEmail: ""
  },
  window.PRODFLOW_CONFIG || {}
);

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  initializeNavigation();

  const api = window.ProdFlow?.api;
  const store = window.ProdFlow?.store;
  const intro = document.getElementById("prodflowIntro");
  const loginForm = document.getElementById("prodflowLogin");
  const usernameInput = document.getElementById("prodflowUsername");
  const passwordInput = document.getElementById("prodflowPassword");
  const loginSubmit = document.getElementById("prodflowLoginSubmit");
  const loginError = document.getElementById("prodflowLoginError");
  const revealPassword = document.getElementById("prodflowRevealPassword");
  const introHint = intro?.querySelector(".pf-intro__hint");
  const menuToggle = document.getElementById("prodflowMenuToggle");
  const menuBackdrop = document.getElementById("prodflowMenuBackdrop");
  const sidebar = document.getElementById("prodflowSidebar");
  const logoutButton = document.getElementById("prodflowLogout");
  const serverStatus = document.getElementById("prodflowServerStatus");
  const isGithubTest = Boolean(window.PRODFLOW_GITHUB_TEST);
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

  function setIntroHint(message) {
    if (introHint) introHint.textContent = message;
  }

  function setServerStatus(mode, message) {
    if (!serverStatus) return;
    serverStatus.classList.remove("is-online", "is-saving", "is-error");
    if (mode) serverStatus.classList.add(`is-${mode}`);
    const label = serverStatus.querySelector("span");
    if (label) label.textContent = message;
  }

  function enableEntry() {
    if (!intro || !loginForm) return;
    intro.classList.add("is-ready");
    usernameInput.disabled = false;
    passwordInput.disabled = false;
    loginSubmit.disabled = false;
    revealPassword.disabled = false;
    usernameInput.focus({ preventScroll: true });
    setIntroHint(isGithubTest
      ? "Tryb testowy — login: admin / admin"
      : "Połączenie z serwerem gotowe");
  }

  function setAuthenticating(active) {
    loginForm?.classList.toggle("is-authenticating", active);
    usernameInput.disabled = active;
    passwordInput.disabled = active;
    loginSubmit.disabled = active;
    revealPassword.disabled = active;
  }

  function showLoginError(message) {
    loginError.textContent = message;
    loginForm.classList.remove("is-error");
    void loginForm.offsetWidth;
    loginForm.classList.add("is-error");
  }

  function roleLabel(role) {
    return {
      admin: "Administrator",
      planner: "Planowanie",
      operator: "Operator",
      warehouse: "Magazyn",
      quality: "Jakość",
      viewer: "Podgląd"
    }[role] || role || "Użytkownik";
  }

  function applyCurrentUser(user) {
    const currentUser = {
      id: user.id,
      username: user.username,
      name: user.displayName || user.username,
      displayName: user.displayName || user.username,
      role: user.role || "viewer",
      loggedAt: new Date().toISOString()
    };

    window.ProdFlow = window.ProdFlow || {};
    window.ProdFlow.currentUser = currentUser;

    const name = document.getElementById("prodflowUserName");
    const role = document.getElementById("prodflowUserRole");
    const avatar = document.getElementById("prodflowUserAvatar");
    if (name) name.textContent = currentUser.name;
    if (role) role.textContent = roleLabel(currentUser.role);
    if (avatar) {
      avatar.textContent = currentUser.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "PF";
    }

    document.querySelectorAll("[data-roles]").forEach((element) => {
      const roles = String(element.dataset.roles || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      element.hidden = roles.length > 0 && !roles.includes(currentUser.role);
    });

    return currentUser;
  }

  async function loadServerConfig() {
    try {
      const config = await api.getSystemConfig();
      window.PRODFLOW_CONFIG.warehouseEmail = config.warehouseEmail || "";
    } catch (_error) {
      // Konfiguracja pomocnicza nie blokuje startu aplikacji.
    }
  }

  async function prepareApplication(user) {
    applyCurrentUser(user);
    setIntroHint(isGithubTest
      ? "Wczytywanie danych z tej przeglądarki…"
      : "Pobieranie danych z SQL Server…");
    setServerStatus("saving", isGithubTest
      ? "Wczytywanie danych testowych…"
      : "Pobieranie danych…");
    await store.connect();
    await loadServerConfig();
    setServerStatus("online", isGithubTest
      ? "GITHUB TEST · zapis lokalny"
      : "Dane zapisane w SQL");
  }

  function startApplication() {
    if (applicationStarted) return;
    applicationStarted = true;
    loginSubmit.disabled = true;

    const firstVisibleModule = document.querySelector(
      '.sidebar [data-module="dashboard"]:not([hidden]), .sidebar [data-module]:not([hidden])'
    );
    loadModule(firstVisibleModule?.dataset.module || "dashboard");
    intro?.classList.add("is-leaving");
    window.setTimeout(() => intro?.remove(), reducedMotion ? 220 : 750);
  }

  async function handleLogin(event) {
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

    setAuthenticating(true);
    setIntroHint(isGithubTest
      ? "Logowanie do wersji testowej…"
      : "Logowanie i łączenie z bazą…");
    try {
      const user = await api.login(username, password);
      await prepareApplication(user);
      startApplication();
    } catch (error) {
      showLoginError(error?.message || "Nie udało się zalogować.");
      setIntroHint(error?.status === 0 ? "Serwer jest niedostępny" : "Sprawdź dane logowania");
      setAuthenticating(false);
      passwordInput.select();
    }
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

  async function logout() {
    logoutButton.disabled = true;
    setServerStatus("saving", "Zapisywanie przed wylogowaniem…");
    try {
      await store.flush();
    } catch (_error) {
      const confirmed = window.confirm(
        "Nie udało się potwierdzić ostatniego zapisu. Czy mimo to się wylogować?"
      );
      if (!confirmed) {
        logoutButton.disabled = false;
        return;
      }
    }
    try {
      await api.logout();
    } finally {
      window.location.reload();
    }
  }

  async function restoreSession() {
    setIntroHint("Sprawdzanie sesji…");
    try {
      const user = await api.me();
      intro?.classList.add("is-ready");
      await prepareApplication(user);
      window.setTimeout(startApplication, reducedMotion ? 80 : 280);
      return true;
    } catch (error) {
      if (error?.status !== 401 && error?.status !== 403) {
        showLoginError(error?.message || "Serwer ProdFlow jest niedostępny.");
        setIntroHint("Nie udało się połączyć z serwerem");
      }
      enableEntry();
      return false;
    }
  }

  window.addEventListener("prodflow:session-expired", () => {
    if (applicationStarted) {
      window.alert("Sesja wygasła. Zaloguj się ponownie.");
      window.location.reload();
    }
  });

  window.ProdFlow?.events?.on?.("store:sync-error", (event) => {
    setServerStatus("error", event?.message || (isGithubTest
      ? "Błąd zapisu lokalnego"
      : "Błąd zapisu do SQL"));
  });
  window.ProdFlow?.events?.on?.("store:database-changed", (event) => {
    if (event?.source === "server-sync") {
      setServerStatus("online", isGithubTest
        ? "GITHUB TEST · zapis lokalny"
        : "Dane zapisane w SQL");
    }
  });

  loginForm?.addEventListener("submit", handleLogin);
  revealPassword?.addEventListener("click", togglePasswordVisibility);
  logoutButton?.addEventListener("click", logout);

  if (!api || !store) {
    showLoginError("Brak wymaganych składników aplikacji.");
    setIntroHint("Błąd uruchamiania");
    return;
  }

  restoreSession();
});
