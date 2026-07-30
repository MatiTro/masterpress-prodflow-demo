/**
 * ProdFlow Core
 * Główny punkt startowy i rejestr modułów aplikacji.
 *
 * Wymagane wcześniej:
 * - prodflow-events.js
 * - prodflow-utils.js
 * - prodflow-store.js
 */
(function (global) {
  "use strict";

  const CORE_VERSION = "1.0.0";

  const MODULE_STATUS = Object.freeze({
    REGISTERED: "registered",
    INITIALIZING: "initializing",
    READY: "ready",
    ERROR: "error",
    DISABLED: "disabled"
  });

  const EVENT = Object.freeze({
    CORE_READY: "core:ready",
    MODULE_REGISTERED: "core:module-registered",
    MODULE_STATUS_CHANGED: "core:module-status-changed",
    MODULE_ERROR: "core:module-error"
  });

  const modules = new Map();

  let initialized = false;
  let initializedAt = null;

  function requireNamespace() {
    global.ProdFlow = global.ProdFlow || {};
  }

  function getEvents() {
    return global.ProdFlow.events || null;
  }

  function emit(eventName, payload) {
    const events = getEvents();

    if (!events || typeof events.emit !== "function") {
      return 0;
    }

    return events.emit(eventName, payload);
  }

  function normalizeText(value) {
    if (
      global.ProdFlow.utils &&
      typeof global.ProdFlow.utils.normalizeText === "function"
    ) {
      return global.ProdFlow.utils.normalizeText(value);
    }

    return String(value ?? "").trim();
  }

  function clone(value) {
    if (
      global.ProdFlow.utils &&
      typeof global.ProdFlow.utils.deepClone === "function"
    ) {
      return global.ProdFlow.utils.deepClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function validateDependencies() {
    const missing = [];

    if (!global.ProdFlow.events) {
      missing.push("events");
    }

    if (!global.ProdFlow.utils) {
      missing.push("utils");
    }

    if (!global.ProdFlow.store) {
      missing.push("store");
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  function createModuleRecord(config) {
    const id = normalizeText(config.id);

    if (!id) {
      throw new TypeError(
        "ProdFlow.registerModule: moduł musi posiadać niepuste id."
      );
    }

    return {
      id,

      name:
        normalizeText(config.name) ||
        normalizeText(config.title) ||
        id,

      version:
        normalizeText(config.version) ||
        "1.0.0",

      description:
        normalizeText(config.description),

      status:
        config.enabled === false
          ? MODULE_STATUS.DISABLED
          : MODULE_STATUS.REGISTERED,

      enabled:
        config.enabled !== false,

      initialized: false,

      initializedAt: null,

      registeredAt: new Date().toISOString(),

      error: null,

      metadata:
        config.metadata &&
        typeof config.metadata === "object"
          ? clone(config.metadata)
          : {}
    };
  }

  function registerModule(config) {
    if (!config || typeof config !== "object") {
      throw new TypeError(
        "ProdFlow.registerModule oczekuje obiektu konfiguracji."
      );
    }

    const record = createModuleRecord(config);
    const existing = modules.get(record.id);

    if (existing) {
      const updated = Object.assign({}, existing, record, {
        registeredAt: existing.registeredAt
      });

      modules.set(record.id, updated);

      emit(EVENT.MODULE_REGISTERED, clone(updated));

      return clone(updated);
    }

    modules.set(record.id, record);

    emit(EVENT.MODULE_REGISTERED, clone(record));

    return clone(record);
  }

  function setModuleStatus(moduleId, status, details) {
    const id = normalizeText(moduleId);
    const record = modules.get(id);

    if (!record) {
      throw new Error(
        `ProdFlow Core: moduł "${id}" nie został zarejestrowany.`
      );
    }

    if (!Object.values(MODULE_STATUS).includes(status)) {
      throw new Error(
        `ProdFlow Core: nieznany status modułu "${status}".`
      );
    }

    record.status = status;

    if (status === MODULE_STATUS.READY) {
      record.initialized = true;
      record.initializedAt = new Date().toISOString();
      record.error = null;
    }

    if (status === MODULE_STATUS.ERROR) {
      record.initialized = false;
      record.error =
        details && details.error
          ? String(details.error)
          : "Nieznany błąd modułu";
    }

    emit(EVENT.MODULE_STATUS_CHANGED, {
      module: clone(record),
      details:
        details && typeof details === "object"
          ? clone(details)
          : {}
    });

    return clone(record);
  }

  function markModuleReady(moduleId) {
    return setModuleStatus(
      moduleId,
      MODULE_STATUS.READY
    );
  }

  function markModuleError(moduleId, error) {
    const result = setModuleStatus(
      moduleId,
      MODULE_STATUS.ERROR,
      {
        error:
          error instanceof Error
            ? error.message
            : String(error || "Nieznany błąd")
      }
    );

    emit(EVENT.MODULE_ERROR, {
      module: result,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack || ""
            }
          : {
              name: "Error",
              message: String(error || "Nieznany błąd"),
              stack: ""
            }
    });

    return result;
  }

  function getModule(moduleId) {
    const id = normalizeText(moduleId);
    const record = modules.get(id);

    return record ? clone(record) : null;
  }

  function getModules(filters) {
    const options = Object.assign(
      {
        status: null,
        enabled: null
      },
      filters || {}
    );

    return Array.from(modules.values())
      .filter(function (module) {
        if (
          options.status &&
          module.status !== options.status
        ) {
          return false;
        }

        if (
          typeof options.enabled === "boolean" &&
          module.enabled !== options.enabled
        ) {
          return false;
        }

        return true;
      })
      .map(clone);
  }

  function hasModule(moduleId) {
    return modules.has(normalizeText(moduleId));
  }

  function getSystemInfo() {
    const dependencies = validateDependencies();

    return {
      name: "ProdFlow",
      coreVersion: CORE_VERSION,
      initialized,
      initializedAt,
      dependencies,
      registeredModules: modules.size,
      readyModules: getModules({
        status: MODULE_STATUS.READY
      }).length,
      storeVersion:
        global.ProdFlow.store &&
        global.ProdFlow.store.version
          ? global.ProdFlow.store.version
          : null
    };
  }

  function initialize() {
    if (initialized) {
      return getSystemInfo();
    }

    requireNamespace();

    const dependencies = validateDependencies();

    if (!dependencies.valid) {
      throw new Error(
        `ProdFlow Core: brakuje zależności: ${dependencies.missing.join(
          ", "
        )}.`
      );
    }

    initialized = true;
    initializedAt = new Date().toISOString();

    const info = getSystemInfo();

    emit(EVENT.CORE_READY, clone(info));

    return info;
  }

  requireNamespace();

  const api = Object.freeze({
    version: CORE_VERSION,

    ModuleStatus: MODULE_STATUS,
    Event: EVENT,

    initialize,

    registerModule,
    setModuleStatus,
    markModuleReady,
    markModuleError,

    getModule,
    getModules,
    hasModule,
    getSystemInfo
  });

  global.ProdFlow.core = api;

  global.ProdFlow.registerModule =
    registerModule;

  initialize();
})(window);
