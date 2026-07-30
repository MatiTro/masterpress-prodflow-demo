/**
 * ProdFlow Events
 * Lekki system komunikacji pomiędzy modułami.
 */
(function (global) {
  "use strict";

  const listeners = new Map();

  function on(eventName, handler) {
    if (typeof eventName !== "string" || !eventName.trim()) {
      throw new TypeError(
        "ProdFlow.events.on: eventName musi być niepustym tekstem."
      );
    }

    if (typeof handler !== "function") {
      throw new TypeError(
        "ProdFlow.events.on: handler musi być funkcją."
      );
    }

    const name = eventName.trim();

    if (!listeners.has(name)) {
      listeners.set(name, new Set());
    }

    listeners.get(name).add(handler);

    return function unsubscribe() {
      off(name, handler);
    };
  }

  function once(eventName, handler) {
    const unsubscribe = on(eventName, function wrapped(payload) {
      unsubscribe();
      handler(payload);
    });

    return unsubscribe;
  }

  function off(eventName, handler) {
    const name = String(eventName || "").trim();
    const eventListeners = listeners.get(name);

    if (!eventListeners) {
      return false;
    }

    const removed = eventListeners.delete(handler);

    if (eventListeners.size === 0) {
      listeners.delete(name);
    }

    return removed;
  }

  function emit(eventName, payload) {
    const name = String(eventName || "").trim();

    if (!name) {
      throw new TypeError(
        "ProdFlow.events.emit: eventName musi być niepustym tekstem."
      );
    }

    const eventListeners = listeners.get(name);

    if (!eventListeners || eventListeners.size === 0) {
      return 0;
    }

    let called = 0;

    [...eventListeners].forEach(function (handler) {
      try {
        handler(payload);
        called += 1;
      } catch (error) {
        console.error(
          `[ProdFlow.events] Błąd obsługi zdarzenia "${name}":`,
          error
        );
      }
    });

    return called;
  }

  function clear(eventName) {
    if (typeof eventName === "undefined") {
      listeners.clear();
      return;
    }

    listeners.delete(String(eventName).trim());
  }

  const api = Object.freeze({
    on,
    once,
    off,
    emit,
    clear
  });

  global.ProdFlow = global.ProdFlow || {};
  global.ProdFlow.events = api;
})(window);