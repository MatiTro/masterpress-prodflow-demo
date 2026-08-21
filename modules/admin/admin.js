(function () {
  "use strict";

  const root = document.getElementById("prodflowAdmin");
  const api = window.ProdFlow?.api;
  if (!root || !api) return;

  const body = root.querySelector("#adminUsersBody");
  const empty = root.querySelector("#adminUsersEmpty");
  const search = root.querySelector("#adminUserSearch");
  const dialog = root.querySelector("#adminUserDialog");
  const form = root.querySelector("#adminUserForm");
  const formError = root.querySelector("#adminFormError");
  const saveButton = root.querySelector("#adminSaveUser");
  const toast = root.querySelector("#adminToast");
  let users = [];
  let toastTimer = null;

  const roleLabels = {
    admin: "Administrator",
    planner: "Planowanie",
    operator: "Operator",
    warehouse: "Magazyn",
    quality: "Jakość",
    viewer: "Podgląd"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "Nigdy";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function initials(name) {
    return String(name || "PF")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function showToast(message, type) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `admin-toast${type ? ` is-${type}` : ""}`;
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function updateMetrics() {
    root.querySelector("#adminUsersTotal").textContent = users.length;
    root.querySelector("#adminUsersActive").textContent = users.filter((user) => user.isActive).length;
    root.querySelector("#adminUsersAdmins").textContent = users.filter(
      (user) => user.isActive && user.role === "admin"
    ).length;
  }

  function render() {
    const query = String(search.value || "").trim().toLowerCase();
    const filtered = users.filter((user) =>
      [user.username, user.displayName, roleLabels[user.role]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );

    body.innerHTML = filtered.map((user) => `
      <tr>
        <td>
          <div class="admin-user">
            <span class="admin-user__avatar">${escapeHtml(initials(user.displayName))}</span>
            <span><strong>${escapeHtml(user.displayName)}</strong><small>${escapeHtml(user.username)}</small></span>
          </div>
        </td>
        <td><span class="admin-role">${escapeHtml(roleLabels[user.role] || user.role)}</span></td>
        <td><span class="admin-status ${user.isActive ? "" : "is-disabled"}">${user.isActive ? "Aktywne" : "Wyłączone"}</span></td>
        <td><span class="admin-last-login">${escapeHtml(formatDate(user.lastLoginAt))}</span></td>
        <td>
          <div class="admin-actions">
            <button type="button" data-user-edit="${escapeHtml(user.id)}">Edytuj</button>
            ${user.isActive ? `<button class="is-danger" type="button" data-user-disable="${escapeHtml(user.id)}">Wyłącz</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("");

    empty.hidden = filtered.length > 0;
    updateMetrics();
  }

  async function loadUsers() {
    body.innerHTML = '<tr><td colspan="5"><div class="admin-empty">Pobieranie kont…</div></td></tr>';
    try {
      users = await api.listUsers();
      render();
    } catch (error) {
      body.innerHTML = "";
      empty.hidden = false;
      empty.textContent = error?.message || "Nie udało się pobrać kont.";
    }
  }

  function openDialog(user) {
    form.reset();
    formError.textContent = "";
    root.querySelector("#adminUserId").value = user?.id || "";
    root.querySelector("#adminUsername").value = user?.username || "";
    root.querySelector("#adminUsername").disabled = Boolean(user);
    root.querySelector("#adminDisplayName").value = user?.displayName || "";
    root.querySelector("#adminRole").value = user?.role || "operator";
    root.querySelector("#adminIsActive").checked = user?.isActive ?? true;
    root.querySelector("#adminActiveRow").hidden = !user;
    root.querySelector("#adminDialogTitle").textContent = user ? "Edytuj konto" : "Dodaj konto";
    root.querySelector("#adminPasswordLabel").textContent = user ? "Nowe hasło (opcjonalnie)" : "Hasło początkowe";
    root.querySelector("#adminPasswordHint").textContent = user
      ? "Pozostaw puste, aby nie zmieniać hasła."
      : "Użytkownik poda je podczas logowania.";
    root.querySelector("#adminPassword").required = !user;
    dialog.showModal();
  }

  function closeDialog() {
    dialog.close();
  }

  async function saveUser(event) {
    event.preventDefault();
    formError.textContent = "";
    saveButton.disabled = true;

    const id = root.querySelector("#adminUserId").value;
    const password = root.querySelector("#adminPassword").value;
    const data = {
      username: root.querySelector("#adminUsername").value.trim(),
      displayName: root.querySelector("#adminDisplayName").value.trim(),
      role: root.querySelector("#adminRole").value,
      password
    };

    try {
      if (!id) {
        await api.createUser(data);
        showToast("Konto zostało utworzone.");
      } else {
        await api.updateUser(id, {
          displayName: data.displayName,
          role: data.role,
          isActive: root.querySelector("#adminIsActive").checked
        });
        if (password) await api.resetUserPassword(id, password);
        showToast(password ? "Konto i hasło zostały zaktualizowane." : "Konto zostało zaktualizowane.");
      }
      closeDialog();
      await loadUsers();
    } catch (error) {
      formError.textContent = error?.message || "Nie udało się zapisać konta.";
    } finally {
      saveButton.disabled = false;
    }
  }

  async function disableUser(id) {
    const user = users.find((item) => item.id === id);
    if (!user || !window.confirm(`Wyłączyć konto „${user.displayName}”?`)) return;
    try {
      await api.disableUser(id);
      showToast("Konto zostało wyłączone.");
      await loadUsers();
    } catch (error) {
      showToast(error?.message || "Nie udało się wyłączyć konta.", "error");
    }
  }

  root.querySelector("#adminAddUser").addEventListener("click", () => openDialog(null));
  root.querySelectorAll("[data-dialog-close]").forEach((button) =>
    button.addEventListener("click", closeDialog)
  );
  search.addEventListener("input", render);
  form.addEventListener("submit", saveUser);
  body.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-user-edit]");
    if (edit) openDialog(users.find((user) => user.id === edit.dataset.userEdit));
    const disable = event.target.closest("[data-user-disable]");
    if (disable) disableUser(disable.dataset.userDisable);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  loadUsers();
})();
