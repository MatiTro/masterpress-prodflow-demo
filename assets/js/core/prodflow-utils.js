/**
 * ProdFlow Utils
 * Wspólne funkcje pomocnicze dla wszystkich modułów.
 */
(function (global) {
  "use strict";

  function nowIso() {
    return new Date().toISOString();
  }

  function generateId(prefix) {
    const safePrefix = String(prefix || "id")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "id";

    if (
      global.crypto &&
      typeof global.crypto.randomUUID === "function"
    ) {
      return `${safePrefix}_${global.crypto.randomUUID()}`;
    }

    return (
      `${safePrefix}_${Date.now()}_` +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function deepClone(value) {
    if (typeof global.structuredClone === "function") {
      return global.structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return (
      Object.prototype.toString.call(value) ===
      "[object Object]"
    );
  }

  function deepMerge(target, source) {
    const output = isPlainObject(target)
      ? deepClone(target)
      : {};

    if (!isPlainObject(source)) {
      return output;
    }

    Object.keys(source).forEach(function (key) {
      const sourceValue = source[key];
      const targetValue = output[key];

      if (
        isPlainObject(sourceValue) &&
        isPlainObject(targetValue)
      ) {
        output[key] = deepMerge(
          targetValue,
          sourceValue
        );
      } else {
        output[key] = deepClone(sourceValue);
      }
    });

    return output;
  }

  function toNumber(value, fallback) {
    const defaultValue =
      typeof fallback === "number" ? fallback : 0;

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    const normalized = String(value ?? "")
      .replace(/\s+/g, "")
      .replace(",", ".");

    const parsed = Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : defaultValue;
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function debounce(fn, delay) {
    let timeoutId = null;
    const wait =
      typeof delay === "number" ? delay : 300;

    return function debounced() {
      const context = this;
      const args = arguments;

      clearTimeout(timeoutId);

      timeoutId = setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  function formatDateTime(value, locale) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      locale || "pl-PL",
      {
        dateStyle: "short",
        timeStyle: "short"
      }
    ).format(date);
  }

  function safeParseJson(rawValue, fallback) {
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      return fallback;
    }
  }

  const api = Object.freeze({
    nowIso,
    generateId,
    deepClone,
    deepMerge,
    isPlainObject,
    toNumber,
    normalizeText,
    debounce,
    formatDateTime,
    safeParseJson
  });

  global.ProdFlow = global.ProdFlow || {};
  global.ProdFlow.utils = api;
})(window);