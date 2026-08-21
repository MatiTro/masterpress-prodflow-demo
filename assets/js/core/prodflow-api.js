/**
 * ProdFlow GITHUB TEST
 * Lokalny zamiennik API do testów biznesowych na GitHub Pages.
 * Nie łączy się z SQL Serverem i nie wysyła wiadomości e-mail.
 */
(function (global) {
  "use strict";

  const VERSION = "0.8.0-GITHUB-TEST";
  const STATE_KEY = "prodflow.github-test.state.v1";
  const USERS_KEY = "prodflow.github-test.users.v1";
  const SESSION_KEY = "prodflow.github-test.session.v1";
  const REQUESTS_KEY = "prodflow.github-test.material-requests.v1";
  const attachmentUrls = new Map();

  global.PRODFLOW_GITHUB_TEST = true;

  class ApiError extends Error {
    constructor(message, status, details) {
      super(message || "Błąd lokalnego trybu testowego.");
      this.name = "ApiError";
      this.status = status || 0;
      this.details = details || null;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    const random = global.crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${random}`;
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function readJson(storage, key, fallback) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : clone(fallback);
    } catch (_error) {
      return clone(fallback);
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new ApiError(
        "Brak miejsca na zapis danych testowych w przeglądarce. Wyeksportuj dane lub wyczyść pamięć tej strony.",
        507,
        error
      );
    }
  }

  function emptyDatabase() {
    const timestamp = nowIso();
    return {
      meta: { version: 1, createdAt: timestamp, updatedAt: timestamp },
      orders: {},
      customers: {},
      materials: {},
      warehouse: {},
      labels: {},
      complaints: {},
      history: [],
      users: {},
      settings: {}
    };
  }

  function defaultState() {
    return {
      revision: 0,
      database: emptyDatabase(),
      updatedAt: nowIso(),
      updatedBy: "GITHUB TEST"
    };
  }

  function defaultUsers() {
    return [{
      id: "github-test-admin",
      username: "admin",
      password: "admin",
      displayName: "Administrator testowy",
      role: "admin",
      isActive: true,
      createdAt: nowIso(),
      lastLoginAt: null
    }];
  }

  function getUsersWithPasswords() {
    const users = readJson(global.localStorage, USERS_KEY, defaultUsers());
    if (!Array.isArray(users) || !users.length) return defaultUsers();
    return users;
  }

  function saveUsers(users) {
    writeJson(global.localStorage, USERS_KEY, users);
  }

  function publicUser(user) {
    if (!user) return null;
    const { password: _password, ...safeUser } = user;
    return clone(safeUser);
  }

  function getSessionUser() {
    const id = global.sessionStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return getUsersWithPasswords().find((user) => user.id === id && user.isActive) || null;
  }

  function requireSession() {
    const user = getSessionUser();
    if (!user) throw new ApiError("Brak aktywnej sesji testowej.", 401);
    return user;
  }

  function requireAdmin() {
    const user = requireSession();
    if (user.role !== "admin") throw new ApiError("Ta operacja wymaga konta administratora.", 403);
    return user;
  }

  function defer(value) {
    return Promise.resolve(clone(value));
  }

  function addTestBanner() {
    if (document.getElementById("prodflowGithubTestBanner")) return;
    const style = document.createElement("style");
    style.textContent = `
      #prodflowGithubTestBanner {
        position: fixed; top: 12px; right: 14px; z-index: 30000;
        max-width: min(420px, calc(100vw - 28px)); padding: 9px 14px;
        border: 1px solid #f59e0b; border-radius: 999px;
        background: #fffbeb; color: #78350f; box-shadow: 0 8px 24px rgba(120,53,15,.16);
        font: 700 12px/1.25 Inter, Arial, sans-serif; letter-spacing: .02em;
        pointer-events: none;
      }
      @media (max-width: 700px) {
        #prodflowGithubTestBanner { top: 8px; right: 8px; padding: 7px 10px; font-size: 10px; }
      }
    `;
    document.head.appendChild(style);
    const banner = document.createElement("div");
    banner.id = "prodflowGithubTestBanner";
    banner.setAttribute("role", "status");
    banner.textContent = "GITHUB TEST · dane tylko w tej przeglądarce";
    document.body.appendChild(banner);
    const versionLabel = document.querySelector(".sidebar-footer > span:last-child");
    if (versionLabel) versionLabel.textContent = "ProdFlow 0.8.0 GITHUB TEST";
  }

  document.addEventListener("DOMContentLoaded", addTestBanner);

  const api = Object.freeze({
    ApiError,

    request() {
      return Promise.reject(new ApiError("W trybie GITHUB TEST nie ma połączeń z serwerem.", 503));
    },

    login(username, password) {
      const normalized = String(username || "").trim().toLowerCase();
      const users = getUsersWithPasswords();
      const user = users.find((item) =>
        String(item.username || "").toLowerCase() === normalized &&
        item.password === String(password || "") &&
        item.isActive
      );
      if (!user) return Promise.reject(new ApiError("Nieprawidłowy login lub hasło.", 401));
      user.lastLoginAt = nowIso();
      saveUsers(users);
      global.sessionStorage.setItem(SESSION_KEY, user.id);
      return defer(publicUser(user));
    },

    me() {
      const user = getSessionUser();
      return user
        ? defer(publicUser(user))
        : Promise.reject(new ApiError("Brak aktywnej sesji testowej.", 401));
    },

    logout() {
      global.sessionStorage.removeItem(SESSION_KEY);
      return Promise.resolve(null);
    },

    getState() {
      requireSession();
      const envelope = readJson(global.localStorage, STATE_KEY, defaultState());
      return defer(envelope);
    },

    saveState(_baseRevision, database) {
      const user = requireSession();
      const current = readJson(global.localStorage, STATE_KEY, defaultState());
      const timestamp = nowIso();
      const envelope = {
        revision: (Number(current.revision) || 0) + 1,
        database: clone(database || emptyDatabase()),
        updatedAt: timestamp,
        updatedBy: user.displayName || user.username
      };
      envelope.database.meta = envelope.database.meta || {};
      envelope.database.meta.updatedAt = timestamp;
      writeJson(global.localStorage, STATE_KEY, envelope);
      return defer(envelope);
    },

    listUsers() {
      requireAdmin();
      return defer(getUsersWithPasswords().map(publicUser));
    },

    createUser(data) {
      requireAdmin();
      const users = getUsersWithPasswords();
      const username = String(data?.username || "").trim();
      const password = String(data?.password || "");
      if (username.length < 3) return Promise.reject(new ApiError("Login musi mieć co najmniej 3 znaki.", 400));
      if (password.length < 4) return Promise.reject(new ApiError("Hasło testowe musi mieć co najmniej 4 znaki.", 400));
      if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
        return Promise.reject(new ApiError("Konto o takim loginie już istnieje.", 409));
      }
      const user = {
        id: createId("user"),
        username,
        password,
        displayName: String(data?.displayName || username).trim(),
        role: String(data?.role || "operator"),
        isActive: true,
        createdAt: nowIso(),
        lastLoginAt: null
      };
      users.push(user);
      saveUsers(users);
      return defer(publicUser(user));
    },

    updateUser(id, data) {
      requireAdmin();
      const users = getUsersWithPasswords();
      const user = users.find((item) => item.id === id);
      if (!user) return Promise.reject(new ApiError("Nie znaleziono konta.", 404));
      if (typeof data?.displayName === "string") user.displayName = data.displayName.trim() || user.username;
      if (typeof data?.role === "string") user.role = data.role;
      if (typeof data?.isActive === "boolean") user.isActive = data.isActive;
      saveUsers(users);
      return defer(publicUser(user));
    },

    resetUserPassword(id, password) {
      requireAdmin();
      const users = getUsersWithPasswords();
      const user = users.find((item) => item.id === id);
      if (!user) return Promise.reject(new ApiError("Nie znaleziono konta.", 404));
      if (String(password || "").length < 4) {
        return Promise.reject(new ApiError("Hasło testowe musi mieć co najmniej 4 znaki.", 400));
      }
      user.password = String(password);
      saveUsers(users);
      return Promise.resolve(null);
    },

    disableUser(id) {
      const admin = requireAdmin();
      if (id === admin.id) return Promise.reject(new ApiError("Nie można wyłączyć używanego konta.", 400));
      const users = getUsersWithPasswords();
      const user = users.find((item) => item.id === id);
      if (!user) return Promise.reject(new ApiError("Nie znaleziono konta.", 404));
      user.isActive = false;
      saveUsers(users);
      return Promise.resolve(null);
    },

    listAttachments(orderId) {
      requireSession();
      const items = Array.from(attachmentUrls.values())
        .filter((item) => !orderId || item.orderId === orderId)
        .map((item) => ({ ...item }));
      return defer(items);
    },

    uploadAttachment(file, orderId, category) {
      requireSession();
      if (!file) return Promise.reject(new ApiError("Nie wybrano pliku.", 400));
      const id = createId("attachment");
      const item = {
        id,
        orderId: orderId || "",
        category: category || "general",
        name: file.name || "załącznik",
        type: file.type || "application/octet-stream",
        size: Number(file.size) || 0,
        url: URL.createObjectURL(file),
        createdAt: nowIso()
      };
      attachmentUrls.set(id, item);
      return defer(item);
    },

    deleteAttachment(id) {
      requireSession();
      const item = attachmentUrls.get(id);
      if (item?.url) URL.revokeObjectURL(item.url);
      attachmentUrls.delete(id);
      return Promise.resolve(null);
    },

    sendMaterialRequest(data) {
      requireSession();
      const requests = readJson(global.localStorage, REQUESTS_KEY, []);
      requests.push({ id: createId("request"), createdAt: nowIso(), ...clone(data || {}) });
      writeJson(global.localStorage, REQUESTS_KEY, requests);
      return defer({
        status: "test",
        message: "Zgłoszenie zapisano lokalnie. W trybie GITHUB TEST e-mail nie jest wysyłany."
      });
    },

    getSystemConfig() {
      return defer({
        version: VERSION,
        warehouseEmail: "GITHUB TEST — bez wysyłki",
        maxAttachmentSizeMb: 25
      });
    }
  });

  global.ProdFlow = global.ProdFlow || {};
  global.ProdFlow.api = api;
})(window);
