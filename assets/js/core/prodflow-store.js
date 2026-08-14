/**
 * ProdFlow Store
 * Centralna warstwa danych aplikacji ProdFlow.
 *
 * Odpowiada za:
 * - tworzenie i przechowywanie zleceń,
 * - zapis do localStorage,
 * - historię zmian,
 * - zmianę statusów,
 * - dane etykiet,
 * - reklamacje,
 * - statystyki,
 * - import i eksport bazy,
 * - komunikację przez ProdFlow.events.
 *
 * Wymagane wcześniej:
 * - prodflow-events.js
 * - prodflow-utils.js
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "prodflow.database";
  const DATABASE_VERSION = 1;

  const ORDER_STATUS = Object.freeze({
    DRAFT: "draft",
    NEW: "new",
    PLANNED: "planned",
    IN_PRODUCTION: "in_production",
    SUSPENDED: "suspended",
    DROPPED: "dropped",
    QUALITY_CONTROL: "quality_control",
    PACKING: "packing",
    WAREHOUSE: "warehouse",
    COMPLETED: "completed",
    CANCELLED: "cancelled"
  });

  const PROCESS_STEP = Object.freeze({
    CARD: "card",
    PLANNING: "planning",
    PRODUCTION: "production",
    QUALITY: "quality",
    PACKING: "packing",
    WAREHOUSE: "warehouse",
    COMPLETED: "completed"
  });

  const EVENT = Object.freeze({
    DATABASE_READY: "store:database-ready",
    DATABASE_CHANGED: "store:database-changed",
    DATABASE_IMPORTED: "store:database-imported",
    DATABASE_CLEARED: "store:database-cleared",

    ORDER_CREATED: "store:order-created",
    ORDER_UPDATED: "store:order-updated",
    ORDER_DELETED: "store:order-deleted",
    ORDER_STATUS_CHANGED: "store:order-status-changed",

    HISTORY_ADDED: "store:history-added",
    LABEL_ADDED: "store:label-added",
    COMPLAINT_ADDED: "store:complaint-added",
    WAREHOUSE_LOAD_CHANGED: "store:warehouse-load-changed"
  });

  let database = null;

  function requireDependencies() {
    if (!global.ProdFlow) {
      throw new Error(
        "ProdFlow Store: obiekt window.ProdFlow nie istnieje."
      );
    }

    if (!global.ProdFlow.utils) {
      throw new Error(
        "ProdFlow Store: najpierw załaduj prodflow-utils.js."
      );
    }

    if (!global.ProdFlow.events) {
      throw new Error(
        "ProdFlow Store: najpierw załaduj prodflow-events.js."
      );
    }
  }

  function getUtils() {
    return global.ProdFlow.utils;
  }

  function getEvents() {
    return global.ProdFlow.events;
  }

  function createEmptyDatabase() {
    const now = getUtils().nowIso();

    return {
      meta: {
        version: DATABASE_VERSION,
        createdAt: now,
        updatedAt: now
      },

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

  function normalizeDatabase(rawDatabase) {
    const emptyDatabase = createEmptyDatabase();

    if (!getUtils().isPlainObject(rawDatabase)) {
      return emptyDatabase;
    }

    const normalized = getUtils().deepMerge(
      emptyDatabase,
      rawDatabase
    );

    normalized.meta.version = DATABASE_VERSION;

    if (!getUtils().isPlainObject(normalized.orders)) {
      normalized.orders = {};
    }

    if (!getUtils().isPlainObject(normalized.customers)) {
      normalized.customers = {};
    }

    if (!getUtils().isPlainObject(normalized.materials)) {
      normalized.materials = {};
    }

    if (!getUtils().isPlainObject(normalized.warehouse)) {
      normalized.warehouse = {};
    }

    if (!getUtils().isPlainObject(normalized.labels)) {
      normalized.labels = {};
    }

    if (!getUtils().isPlainObject(normalized.complaints)) {
      normalized.complaints = {};
    }

    if (!Array.isArray(normalized.history)) {
      normalized.history = [];
    }

    if (!getUtils().isPlainObject(normalized.users)) {
      normalized.users = {};
    }

    if (!getUtils().isPlainObject(normalized.settings)) {
      normalized.settings = {};
    }

    return normalized;
  }

  function loadDatabase() {
    const rawValue = global.localStorage.getItem(
      STORAGE_KEY
    );

    if (!rawValue) {
      database = createEmptyDatabase();
      persistDatabase({
        emitEvent: false
      });

      return database;
    }

    const parsed = getUtils().safeParseJson(
      rawValue,
      null
    );

    database = normalizeDatabase(parsed);

    return database;
  }

  function persistDatabase(options) {
    const settings = Object.assign(
      {
        emitEvent: true
      },
      options || {}
    );

    ensureDatabase();

    database.meta.updatedAt = getUtils().nowIso();

    global.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(database)
    );

    if (settings.emitEvent) {
      emit(EVENT.DATABASE_CHANGED, {
        updatedAt: database.meta.updatedAt
      });
    }

    return true;
  }

  function ensureDatabase() {
    if (!database) {
      loadDatabase();
    }

    return database;
  }

  function emit(eventName, payload) {
    try {
      getEvents().emit(
        eventName,
        getUtils().deepClone(payload)
      );
    } catch (error) {
      console.error(
        `[ProdFlow Store] Błąd zdarzenia "${eventName}":`,
        error
      );
    }
  }

  function normalizeId(value) {
    return getUtils().normalizeText(value);
  }

  function requireOrderId(orderId) {
    const normalizedId = normalizeId(orderId);

    if (!normalizedId) {
      throw new TypeError(
        "ProdFlow Store: wymagany jest identyfikator zlecenia."
      );
    }

    return normalizedId;
  }

  function createOrderNumber() {
    ensureDatabase();

    const year = new Date().getFullYear();

    const yearOrders = Object.values(
      database.orders
    ).filter(function (order) {
      return String(order.number || "").includes(
        `/${year}/`
      );
    });

    let highestSequence = 0;

    yearOrders.forEach(function (order) {
      const match = String(order.number || "").match(
        /\/(\d+)$/
      );

      if (!match) {
        return;
      }

      const sequence = Number(match[1]);

      if (
        Number.isInteger(sequence) &&
        sequence > highestSequence
      ) {
        highestSequence = sequence;
      }
    });

    const nextSequence = String(
      highestSequence + 1
    ).padStart(5, "0");

    return `ZL/${year}/${nextSequence}`;
  }

  function createOrderTemplate(input) {
    const now = getUtils().nowIso();
    const initialData = getUtils().isPlainObject(input)
      ? input
      : {};

    const id =
      normalizeId(initialData.id) ||
      getUtils().generateId("ord");

    const template = {
      id: id,
      number:
        getUtils().normalizeText(initialData.number) ||
        createOrderNumber(),

      status: ORDER_STATUS.DRAFT,
      processStep: PROCESS_STEP.CARD,

      createdAt: now,
      updatedAt: now,
      completedAt: null,

      order: {
        externalNumber: "",
        customerOrderNumber: "",
        priority: "normal",
        quantity: 0,
        unit: "pcs",
        requestedDate: "",
        dueDate: "",
        notes: ""
      },

      customer: {
        id: "",
        code: "",
        name: "",
        taxId: "",
        contactPerson: "",
        email: "",
        phone: "",
        street: "",
        postalCode: "",
        city: "",
        country: ""
      },

      product: {
        id: "",
        code: "",
        name: "",
        description: "",
        revision: "",
        quantity: 0,
        unit: "pcs",
        dimensions: {
          length: 0,
          width: 0,
          height: 0
        },
        weight: 0,
        drawingNumber: "",
        notes: ""
      },

      materials: [],

      technology: {
        route: [],
        operations: [],
        machineRequirements: [],
        tooling: [],
        instructions: "",
        notes: ""
      },

      packing: {
        method: "",
        packageType: "",
        unitsPerPackage: 0,
        packagesCount: 0,
        palletType: "",
        palletsCount: 0,
        labelTemplate: "",
        instructions: "",
        notes: ""
      },

      logistics: {
        deliveryMethod: "",
        shippingAddress: "",
        carrier: "",
        loadingDate: "",
        shippingDate: "",
        deliveryDate: "",
        trackingNumber: "",
        notes: ""
      },

      quality: {
        status: "not_started",
        inspector: "",
        inspectionDate: "",
        measurements: [],
        defects: [],
        acceptedQuantity: 0,
        rejectedQuantity: 0,
        notes: ""
      },

      planning: {
        status: "not_planned",
        plannedStart: "",
        plannedEnd: "",
        machineId: "",
        machineName: "",
        operatorId: "",
        operatorName: "",
        workCenter: "",
        queuePosition: null,
        estimatedMinutes: 0,
        notes: ""
      },

      production: {
        status: "not_started",
        actualStart: "",
        actualEnd: "",
        machineId: "",
        machineName: "",
        operatorId: "",
        operatorName: "",
        producedQuantity: 0,
        goodQuantity: 0,
        rejectedQuantity: 0,
        downtimeMinutes: 0,
        timeSegments: [],
        reports: [],
        materialWithdrawals: [],
        documentPrintBatches: [],
        notes: ""
      },

      warehouse: {
        status: "not_started",
        reservationId: "",
        reservedMaterials: [],
        issues: [],
        receipts: [],
        location: "",
        acceptedBy: "",
        acceptedAt: "",
        notes: ""
      },

      labels: [],

      ppwr: [],

      complaints: [],

      history: [],

      metadata: {
        source: "prodflow",
        imported: false,
        archived: false,
        tags: []
      }
    };

    const merged = getUtils().deepMerge(
      template,
      initialData
    );

    merged.id = id;
    merged.createdAt =
      initialData.createdAt || now;
    merged.updatedAt = now;

    if (!Array.isArray(merged.materials)) {
      merged.materials = [];
    }

    if (!Array.isArray(merged.labels)) {
      merged.labels = [];
    }

    if (!Array.isArray(merged.ppwr)) {
      merged.ppwr = [];
    }

    if (!Array.isArray(merged.complaints)) {
      merged.complaints = [];
    }

    if (!Array.isArray(merged.history)) {
      merged.history = [];
    }

    return merged;
  }

  function createHistoryEntry(input) {
    const data = getUtils().isPlainObject(input)
      ? input
      : {};

    return {
      id:
        normalizeId(data.id) ||
        getUtils().generateId("hist"),

      orderId: normalizeId(data.orderId),

      type:
        getUtils().normalizeText(data.type) ||
        "information",

      action:
        getUtils().normalizeText(data.action) ||
        "updated",

      message:
        getUtils().normalizeText(data.message),

      module:
        getUtils().normalizeText(data.module) ||
        "core",

      user: {
        id: getUtils().normalizeText(
          data.user && data.user.id
        ),
        name:
          getUtils().normalizeText(
            data.user && data.user.name
          ) || "System"
      },

      previousValue:
        typeof data.previousValue === "undefined"
          ? null
          : getUtils().deepClone(
              data.previousValue
            ),

      newValue:
        typeof data.newValue === "undefined"
          ? null
          : getUtils().deepClone(data.newValue),

      details: getUtils().isPlainObject(
        data.details
      )
        ? getUtils().deepClone(data.details)
        : {},

      createdAt:
        data.createdAt || getUtils().nowIso()
    };
  }

  function appendHistoryEntry(entry, options) {
    const settings = Object.assign(
      {
        persist: true,
        emitEvent: true
      },
      options || {}
    );

    ensureDatabase();

    const historyEntry = createHistoryEntry(entry);

    database.history.push(historyEntry);

    if (
      historyEntry.orderId &&
      database.orders[historyEntry.orderId]
    ) {
      const order =
        database.orders[historyEntry.orderId];

      if (!Array.isArray(order.history)) {
        order.history = [];
      }

      order.history.push(historyEntry.id);
    }

    if (settings.persist) {
      persistDatabase();
    }

    if (settings.emitEvent) {
      emit(EVENT.HISTORY_ADDED, historyEntry);
    }

    return getUtils().deepClone(historyEntry);
  }

  function createOrder(input, options) {
    const settings = Object.assign(
      {
        addHistory: true,
        module: "production-card",
        user: null
      },
      options || {}
    );

    ensureDatabase();

    const order = createOrderTemplate(input);

    if (database.orders[order.id]) {
      throw new Error(
        `ProdFlow Store: zlecenie "${order.id}" już istnieje.`
      );
    }

    database.orders[order.id] = order;

    if (settings.addHistory) {
      appendHistoryEntry(
        {
          orderId: order.id,
          type: "order",
          action: "created",
          message: `Utworzono zlecenie ${order.number}.`,
          module: settings.module,
          user: settings.user,
          newValue: {
            id: order.id,
            number: order.number,
            status: order.status
          }
        },
        {
          persist: false
        }
      );
    }

    persistDatabase();

    const result = getOrder(order.id);

    emit(EVENT.ORDER_CREATED, result);

    return result;
  }

  function saveOrder(orderData, options) {
    const settings = Object.assign(
      {
        addHistory: true,
        historyMessage: "",
        module: "production-card",
        user: null
      },
      options || {}
    );

    if (!getUtils().isPlainObject(orderData)) {
      throw new TypeError(
        "ProdFlow Store: saveOrder oczekuje obiektu zlecenia."
      );
    }

    const orderId = requireOrderId(orderData.id);

    ensureDatabase();

    const existingOrder = database.orders[orderId];

    if (!existingOrder) {
      return createOrder(orderData, settings);
    }

    const previousOrder =
      getUtils().deepClone(existingOrder);

    const updatedOrder = getUtils().deepMerge(
      existingOrder,
      orderData
    );

    updatedOrder.id = orderId;
    updatedOrder.createdAt =
      existingOrder.createdAt;
    updatedOrder.updatedAt =
      getUtils().nowIso();

    database.orders[orderId] = updatedOrder;

    if (settings.addHistory) {
      appendHistoryEntry(
        {
          orderId: orderId,
          type: "order",
          action: "updated",
          message:
            settings.historyMessage ||
            `Zaktualizowano zlecenie ${updatedOrder.number}.`,
          module: settings.module,
          user: settings.user,
          previousValue: previousOrder,
          newValue: updatedOrder
        },
        {
          persist: false
        }
      );
    }

    persistDatabase();

    const result = getOrder(orderId);

    emit(EVENT.ORDER_UPDATED, result);

    return result;
  }

  function updateOrder(orderId, changes, options) {
    const id = requireOrderId(orderId);

    if (!getUtils().isPlainObject(changes)) {
      throw new TypeError(
        "ProdFlow Store: updateOrder oczekuje obiektu zmian."
      );
    }

    ensureDatabase();

    const existingOrder = database.orders[id];

    if (!existingOrder) {
      throw new Error(
        `ProdFlow Store: nie znaleziono zlecenia "${id}".`
      );
    }

    const updatedData = getUtils().deepMerge(
      existingOrder,
      changes
    );

    updatedData.id = id;

    return saveOrder(updatedData, options);
  }

  function deleteOrder(orderId, options) {
    const settings = Object.assign(
      {
        hardDelete: false,
        module: "core",
        user: null
      },
      options || {}
    );

    const id = requireOrderId(orderId);

    ensureDatabase();

    const existingOrder = database.orders[id];

    if (!existingOrder) {
      return false;
    }

    if (!settings.hardDelete) {
      return updateOrder(
        id,
        {
          metadata: {
            archived: true
          }
        },
        {
          historyMessage:
            `Zarchiwizowano zlecenie ${existingOrder.number}.`,
          module: settings.module,
          user: settings.user
        }
      );
    }

    const deletedOrder =
      getUtils().deepClone(existingOrder);

    delete database.orders[id];

    appendHistoryEntry(
      {
        orderId: id,
        type: "order",
        action: "deleted",
        message:
          `Trwale usunięto zlecenie ${deletedOrder.number}.`,
        module: settings.module,
        user: settings.user,
        previousValue: deletedOrder
      },
      {
        persist: false
      }
    );

    persistDatabase();

    emit(EVENT.ORDER_DELETED, deletedOrder);

    return true;
  }

  function getOrder(orderId) {
    const id = requireOrderId(orderId);

    ensureDatabase();

    const order = database.orders[id];

    return order
      ? getUtils().deepClone(order)
      : null;
  }

  function getOrderByNumber(orderNumber) {
    const normalizedNumber =
      getUtils().normalizeText(orderNumber);

    if (!normalizedNumber) {
      return null;
    }

    ensureDatabase();

    const order = Object.values(
      database.orders
    ).find(function (item) {
      return item.number === normalizedNumber;
    });

    return order
      ? getUtils().deepClone(order)
      : null;
  }

  function getOrders(filters) {
    ensureDatabase();

    const options = Object.assign(
      {
        status: null,
        processStep: null,
        search: "",
        archived: false,
        sortBy: "updatedAt",
        sortDirection: "desc",
        limit: null
      },
      filters || {}
    );

    let orders = Object.values(
      database.orders
    ).filter(function (order) {
      const isArchived = Boolean(
        order.metadata &&
          order.metadata.archived
      );

      if (!options.archived && isArchived) {
        return false;
      }

      if (
        options.status &&
        order.status !== options.status
      ) {
        return false;
      }

      if (
        options.processStep &&
        order.processStep !== options.processStep
      ) {
        return false;
      }

      if (options.search) {
        const searchText = String(
          options.search
        ).toLowerCase();

        const searchableText = [
          order.id,
          order.number,
          order.status,
          order.order &&
            order.order.externalNumber,
          order.order &&
            order.order.customerOrderNumber,
          order.customer &&
            order.customer.name,
          order.customer &&
            order.customer.code,
          order.product &&
            order.product.name,
          order.product &&
            order.product.code
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(searchText)) {
          return false;
        }
      }

      return true;
    });

    const direction =
      options.sortDirection === "asc" ? 1 : -1;

    orders.sort(function (first, second) {
      const firstValue =
        first[options.sortBy] ?? "";
      const secondValue =
        second[options.sortBy] ?? "";

      if (firstValue < secondValue) {
        return -1 * direction;
      }

      if (firstValue > secondValue) {
        return 1 * direction;
      }

      return 0;
    });

    if (
      Number.isInteger(options.limit) &&
      options.limit >= 0
    ) {
      orders = orders.slice(0, options.limit);
    }

    return getUtils().deepClone(orders);
  }

  function updateStatus(
    orderId,
    newStatus,
    options
  ) {
    const settings = Object.assign(
      {
        processStep: null,
        module: "core",
        user: null,
        message: ""
      },
      options || {}
    );

    const id = requireOrderId(orderId);
    const status =
      getUtils().normalizeText(newStatus);

    if (
      !Object.values(ORDER_STATUS).includes(status)
    ) {
      throw new Error(
        `ProdFlow Store: nieznany status "${status}".`
      );
    }

    ensureDatabase();

    const order = database.orders[id];

    if (!order) {
      throw new Error(
        `ProdFlow Store: nie znaleziono zlecenia "${id}".`
      );
    }

    const previousStatus = order.status;

    if (previousStatus === status) {
      return getOrder(id);
    }

    order.status = status;
    order.updatedAt = getUtils().nowIso();

    if (settings.processStep) {
      if (
        !Object.values(PROCESS_STEP).includes(
          settings.processStep
        )
      ) {
        throw new Error(
          `ProdFlow Store: nieznany etap procesu "${settings.processStep}".`
        );
      }

      order.processStep = settings.processStep;
    }

    if (status === ORDER_STATUS.COMPLETED) {
      order.completedAt = getUtils().nowIso();
      order.processStep = PROCESS_STEP.COMPLETED;
    } else if (
      previousStatus === ORDER_STATUS.COMPLETED
    ) {
      order.completedAt = null;
    }

    appendHistoryEntry(
      {
        orderId: id,
        type: "status",
        action: "status_changed",
        message:
          settings.message ||
          `Zmieniono status z "${previousStatus}" na "${status}".`,
        module: settings.module,
        user: settings.user,
        previousValue: previousStatus,
        newValue: status
      },
      {
        persist: false
      }
    );

    persistDatabase();

    const result = getOrder(id);

    emit(EVENT.ORDER_STATUS_CHANGED, {
      order: result,
      previousStatus: previousStatus,
      newStatus: status
    });

    return result;
  }

  function addHistory(orderId, historyData) {
    const id = requireOrderId(orderId);

    ensureDatabase();

    if (!database.orders[id]) {
      throw new Error(
        `ProdFlow Store: nie znaleziono zlecenia "${id}".`
      );
    }

    const data = getUtils().isPlainObject(
      historyData
    )
      ? historyData
      : {
          message: String(historyData || "")
        };

    return appendHistoryEntry(
      Object.assign({}, data, {
        orderId: id
      })
    );
  }

  function getHistory(filters) {
    ensureDatabase();

    const options = Object.assign(
      {
        orderId: null,
        type: null,
        action: null,
        module: null,
        limit: null,
        newestFirst: true
      },
      filters || {}
    );

    let history = database.history.filter(
      function (entry) {
        if (
          options.orderId &&
          entry.orderId !== options.orderId
        ) {
          return false;
        }

        if (
          options.type &&
          entry.type !== options.type
        ) {
          return false;
        }

        if (
          options.action &&
          entry.action !== options.action
        ) {
          return false;
        }

        if (
          options.module &&
          entry.module !== options.module
        ) {
          return false;
        }

        return true;
      }
    );

    history.sort(function (first, second) {
      const firstTime = new Date(
        first.createdAt
      ).getTime();

      const secondTime = new Date(
        second.createdAt
      ).getTime();

      return options.newestFirst
        ? secondTime - firstTime
        : firstTime - secondTime;
    });

    if (
      Number.isInteger(options.limit) &&
      options.limit >= 0
    ) {
      history = history.slice(0, options.limit);
    }

    return getUtils().deepClone(history);
  }

  function addLabelRecord(
    orderId,
    labelData,
    options
  ) {
    const settings = Object.assign(
      {
        module: "labels",
        user: null
      },
      options || {}
    );

    const id = requireOrderId(orderId);

    ensureDatabase();

    const order = database.orders[id];

    if (!order) {
      throw new Error(
        `ProdFlow Store: nie znaleziono zlecenia "${id}".`
      );
    }

    const input = getUtils().isPlainObject(
      labelData
    )
      ? labelData
      : {};

    const label = {
      id:
        normalizeId(input.id) ||
        getUtils().generateId("label"),

      orderId: id,

      template:
        getUtils().normalizeText(
          input.template
        ),

      quantity: getUtils().toNumber(
        input.quantity,
        1
      ),

      printer:
        getUtils().normalizeText(
          input.printer
        ),

      printedBy: {
        id: getUtils().normalizeText(
          input.printedBy &&
            input.printedBy.id
        ),
        name:
          getUtils().normalizeText(
            input.printedBy &&
              input.printedBy.name
          ) ||
          getUtils().normalizeText(
            settings.user &&
              settings.user.name
          ) ||
          "System"
      },

      data: getUtils().isPlainObject(input.data)
        ? getUtils().deepClone(input.data)
        : {},

      printedAt:
        input.printedAt ||
        getUtils().nowIso(),

      status:
        getUtils().normalizeText(
          input.status
        ) || "printed"
    };

    database.labels[label.id] = label;

    if (!Array.isArray(order.labels)) {
      order.labels = [];
    }

    order.labels.push(label.id);
    order.updatedAt = getUtils().nowIso();

    appendHistoryEntry(
      {
        orderId: id,
        type: "label",
        action: "printed",
        message:
          `Wydrukowano ${label.quantity} etykiet.`,
        module: settings.module,
        user: settings.user,
        newValue: label
      },
      {
        persist: false
      }
    );

    persistDatabase();

    emit(EVENT.LABEL_ADDED, label);

    return getUtils().deepClone(label);
  }

  function getLabels(orderId) {
    ensureDatabase();

    const labels = Object.values(
      database.labels
    );

    if (!orderId) {
      return getUtils().deepClone(labels);
    }

    const id = requireOrderId(orderId);

    return getUtils().deepClone(
      labels.filter(function (label) {
        return label.orderId === id;
      })
    );
  }

  function getWarehouseLoads() {
    ensureDatabase();
    return getUtils().deepClone(
      Object.values(database.warehouse)
    );
  }

  function saveWarehouseLoad(loadData) {
    ensureDatabase();

    const input = getUtils().isPlainObject(loadData)
      ? loadData
      : {};
    const id =
      normalizeId(input.id) ||
      getUtils().generateId("load");
    const existing = database.warehouse[id] || {};
    const now = getUtils().nowIso();
    const load = {
      ...existing,
      ...getUtils().deepClone(input),
      id,
      number:
        getUtils().normalizeText(input.number) ||
        getUtils().normalizeText(existing.number),
      status:
        getUtils().normalizeText(input.status) ||
        getUtils().normalizeText(existing.status) ||
        "planned",
      createdAt: existing.createdAt || input.createdAt || now,
      updatedAt: now
    };

    if (!load.number) {
      throw new TypeError(
        "ProdFlow Store: numer ładunku jest wymagany."
      );
    }

    database.warehouse[id] = load;
    persistDatabase();
    emit(EVENT.WAREHOUSE_LOAD_CHANGED, load);
    return getUtils().deepClone(load);
  }

  function updateWarehouseLoad(loadId, changes) {
    const id = requireOrderId(loadId);
    ensureDatabase();

    if (!database.warehouse[id]) {
      throw new Error(
        `ProdFlow Store: nie znaleziono ładunku "${id}".`
      );
    }

    return saveWarehouseLoad({
      ...database.warehouse[id],
      ...(getUtils().isPlainObject(changes) ? changes : {}),
      id
    });
  }

  function addComplaint(
    orderId,
    complaintData,
    options
  ) {
    const settings = Object.assign(
      {
        module: "complaints",
        user: null
      },
      options || {}
    );

    const id = requireOrderId(orderId);

    ensureDatabase();

    const order = database.orders[id];

    if (!order) {
      throw new Error(
        `ProdFlow Store: nie znaleziono zlecenia "${id}".`
      );
    }

    const input = getUtils().isPlainObject(
      complaintData
    )
      ? complaintData
      : {};

    const now = getUtils().nowIso();

    const complaint = {
      id:
        normalizeId(input.id) ||
        getUtils().generateId("complaint"),

      orderId: id,

      number:
        getUtils().normalizeText(
          input.number
        ) ||
        `REK/${new Date().getFullYear()}/${String(
          Object.keys(database.complaints)
            .length + 1
        ).padStart(5, "0")}`,

      status:
        getUtils().normalizeText(
          input.status
        ) || "open",

      category:
        getUtils().normalizeText(
          input.category
        ),

      description:
        getUtils().normalizeText(
          input.description
        ),

      quantity: getUtils().toNumber(
        input.quantity,
        0
      ),

      resolution:
        getUtils().normalizeText(
          input.resolution
        ),

      attachments: Array.isArray(
        input.attachments
      )
        ? getUtils().deepClone(
            input.attachments
          )
        : [],

      createdAt: input.createdAt || now,
      updatedAt: now
    };

    database.complaints[complaint.id] =
      complaint;

    if (!Array.isArray(order.complaints)) {
      order.complaints = [];
    }

    order.complaints.push(complaint.id);
    order.updatedAt = now;

    appendHistoryEntry(
      {
        orderId: id,
        type: "complaint",
        action: "created",
        message:
          `Dodano reklamację ${complaint.number}.`,
        module: settings.module,
        user: settings.user,
        newValue: complaint
      },
      {
        persist: false
      }
    );

    persistDatabase();

    emit(EVENT.COMPLAINT_ADDED, complaint);

    return getUtils().deepClone(complaint);
  }

  function getComplaints(orderId) {
    ensureDatabase();

    const complaints = Object.values(
      database.complaints
    );

    if (!orderId) {
      return getUtils().deepClone(complaints);
    }

    const id = requireOrderId(orderId);

    return getUtils().deepClone(
      complaints.filter(function (complaint) {
        return complaint.orderId === id;
      })
    );
  }

  function getStatistics() {
    ensureDatabase();

    const orders = Object.values(
      database.orders
    ).filter(function (order) {
      return !(
        order.metadata &&
        order.metadata.archived
      );
    });

    const byStatus = {};

    Object.values(ORDER_STATUS).forEach(
      function (status) {
        byStatus[status] = 0;
      }
    );

    orders.forEach(function (order) {
      if (
        typeof byStatus[order.status] ===
        "number"
      ) {
        byStatus[order.status] += 1;
      } else {
        byStatus[order.status] = 1;
      }
    });

    const completedOrders = orders.filter(
      function (order) {
        return (
          order.status ===
          ORDER_STATUS.COMPLETED
        );
      }
    );

    const openComplaints = Object.values(
      database.complaints
    ).filter(function (complaint) {
      return ![
        "closed",
        "rejected",
        "cancelled"
      ].includes(complaint.status);
    });

    const totalProduced = orders.reduce(
      function (sum, order) {
        return (
          sum +
          getUtils().toNumber(
            order.production &&
              order.production
                .producedQuantity,
            0
          )
        );
      },
      0
    );

    const totalGood = orders.reduce(
      function (sum, order) {
        return (
          sum +
          getUtils().toNumber(
            order.production &&
              order.production.goodQuantity,
            0
          )
        );
      },
      0
    );

    const totalRejected = orders.reduce(
      function (sum, order) {
        return (
          sum +
          getUtils().toNumber(
            order.production &&
              order.production
                .rejectedQuantity,
            0
          )
        );
      },
      0
    );

    const qualityRate =
      totalProduced > 0
        ? Number(
            (
              (totalGood / totalProduced) *
              100
            ).toFixed(2)
          )
        : 0;

    return {
      generatedAt: getUtils().nowIso(),

      orders: {
        total: orders.length,
        completed: completedOrders.length,
        active:
          orders.length -
          completedOrders.length -
          (byStatus[ORDER_STATUS.CANCELLED] ||
            0),
        archived: Object.values(
          database.orders
        ).filter(function (order) {
          return Boolean(
            order.metadata &&
              order.metadata.archived
          );
        }).length,
        byStatus: byStatus
      },

      production: {
        producedQuantity: totalProduced,
        goodQuantity: totalGood,
        rejectedQuantity: totalRejected,
        qualityRate: qualityRate
      },

      labels: {
        records: Object.keys(
          database.labels
        ).length,
        printedQuantity: Object.values(
          database.labels
        ).reduce(function (sum, label) {
          return (
            sum +
            getUtils().toNumber(
              label.quantity,
              0
            )
          );
        }, 0)
      },

      complaints: {
        total: Object.keys(
          database.complaints
        ).length,
        open: openComplaints.length
      },

      history: {
        entries: database.history.length
      }
    };
  }

  function getDatabaseSnapshot() {
    ensureDatabase();

    return getUtils().deepClone(database);
  }

  function exportDatabase(options) {
    const settings = Object.assign(
      {
        pretty: true
      },
      options || {}
    );

    ensureDatabase();

    return JSON.stringify(
      database,
      null,
      settings.pretty ? 2 : 0
    );
  }

  function importDatabase(
    importedData,
    options
  ) {
    const settings = Object.assign(
      {
        createBackup: true
      },
      options || {}
    );

    let parsedData = importedData;

    if (typeof importedData === "string") {
      parsedData = getUtils().safeParseJson(
        importedData,
        null
      );
    }

    if (!getUtils().isPlainObject(parsedData)) {
      throw new TypeError(
        "ProdFlow Store: importowana baza jest nieprawidłowa."
      );
    }

    const backup = settings.createBackup
      ? exportDatabase({
          pretty: false
        })
      : null;

    try {
      database = normalizeDatabase(parsedData);
      persistDatabase();

      emit(
        EVENT.DATABASE_IMPORTED,
        getDatabaseSnapshot()
      );

      return getDatabaseSnapshot();
    } catch (error) {
      if (backup) {
        database = normalizeDatabase(
          JSON.parse(backup)
        );

        persistDatabase({
          emitEvent: false
        });
      }

      throw error;
    }
  }

  function clearDatabase(options) {
    const settings = Object.assign(
      {
        createBackup: true
      },
      options || {}
    );

    const backup = settings.createBackup
      ? exportDatabase()
      : null;

    database = createEmptyDatabase();

    persistDatabase();

    emit(EVENT.DATABASE_CLEARED, {
      clearedAt: getUtils().nowIso()
    });

    return {
      success: true,
      backup: backup
    };
  }

  function getSetting(key, fallback) {
    const normalizedKey =
      getUtils().normalizeText(key);

    if (!normalizedKey) {
      return fallback;
    }

    ensureDatabase();

    if (
      !Object.prototype.hasOwnProperty.call(
        database.settings,
        normalizedKey
      )
    ) {
      return fallback;
    }

    return getUtils().deepClone(
      database.settings[normalizedKey]
    );
  }

  function setSetting(key, value) {
    const normalizedKey =
      getUtils().normalizeText(key);

    if (!normalizedKey) {
      throw new TypeError(
        "ProdFlow Store: klucz ustawienia nie może być pusty."
      );
    }

    ensureDatabase();

    database.settings[normalizedKey] =
      getUtils().deepClone(value);

    persistDatabase();

    return getSetting(normalizedKey);
  }

  function initialize() {
    requireDependencies();
    loadDatabase();

    emit(
      EVENT.DATABASE_READY,
      getDatabaseSnapshot()
    );

    return api;
  }

  const api = Object.freeze({
    version: DATABASE_VERSION,
    storageKey: STORAGE_KEY,

    Status: ORDER_STATUS,
    Process: PROCESS_STEP,
    Event: EVENT,

    initialize,

    createOrder,
    saveOrder,
    updateOrder,
    deleteOrder,
    getOrder,
    getOrderByNumber,
    getOrders,
    updateStatus,

    addHistory,
    getHistory,

    addLabelRecord,
    getLabels,

    getWarehouseLoads,
    saveWarehouseLoad,
    updateWarehouseLoad,

    addComplaint,
    getComplaints,

    getStatistics,

    getDatabaseSnapshot,
    exportDatabase,
    importDatabase,
    clearDatabase,

    getSetting,
    setSetting
  });

  global.ProdFlow = global.ProdFlow || {};
  global.ProdFlow.store = api;

  initialize();
})(window);
