"use strict";

document.querySelectorAll("button[data-confirm]").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (!window.confirm(button.dataset.confirm)) event.preventDefault();
  });
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", `${visible ? "Ocultar" : "Mostrar"} contraseña`);
    button.querySelector("i").className = visible ? "bi bi-eye-slash" : "bi bi-eye";
  });
});

const menuToggle = document.getElementById("menu-toggle");
if (menuToggle) {
  const sidebar = document.getElementById("sidebar");
  const content = document.getElementById("workspace-main");
  const overlay = document.querySelector(".menu-overlay");
  const mobile = window.matchMedia("(max-width: 991px)");
  let expanded = !mobile.matches;

  function setMenu(open, moveFocus = false) {
    expanded = open;
    document.body.classList.toggle("menu-expanded", open);
    document.body.classList.toggle("menu-collapsed", !open);
    menuToggle.setAttribute("aria-expanded", String(open));
    sidebar.inert = !open;
    content.inert = mobile.matches && open;
    overlay.hidden = !(mobile.matches && open);
    if (moveFocus && mobile.matches && open) {
      sidebar.querySelector("[data-menu-close]").focus();
    } else if (moveFocus && !open) {
      menuToggle.focus();
    }
  }

  menuToggle.addEventListener("click", () => setMenu(!expanded, true));
  document.querySelectorAll("[data-menu-close]").forEach((button) => {
    button.addEventListener("click", () => setMenu(false, true));
  });
  document.querySelectorAll("[data-menu-link]").forEach((link) => {
    link.addEventListener("click", () => {
      if (mobile.matches) setMenu(false, true);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (!mobile.matches || !expanded) return;
    if (event.key === "Escape") setMenu(false, true);
    if (event.key === "Tab") {
      const elements = [...sidebar.querySelectorAll("a[href], button")]
        .filter((element) => element.offsetParent !== null);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });
  mobile.addEventListener("change", () => setMenu(!mobile.matches));
  setMenu(expanded);
}
// The hidden payroll section remains submitted with its defaults; only the
// explicitly selected mode contributes to the monthly employer cost.
document.addEventListener('DOMContentLoaded', () => {
  const mode = document.getElementById('calculation_mode') || document.getElementById('payroll-calculation_mode');
  if (!mode) return;
  const update = () => document.querySelectorAll('[data-payroll-mode]').forEach(
    section => { section.hidden = section.dataset.payrollMode !== mode.value; }
  );
  mode.addEventListener('change', update);
  update();
  const configure = document.getElementById('configure_payroll');
  const initial = document.querySelector('[data-initial-payroll]');
  if (configure && initial) {
    const toggle = () => { initial.hidden = !configure.checked; };
    configure.addEventListener('change', toggle);
    toggle();
  }
});

document.querySelectorAll('[data-material-workspace]').forEach((workspace) => {
  const tabs = [...workspace.querySelectorAll('[data-material-tab]')];
  const panels = [...workspace.querySelectorAll('[data-material-panel]')];
  const activeInput = workspace.querySelector('[data-active-tab-input]');
  const search = workspace.querySelector('[data-material-search]');
  const normalize = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
  const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

  const sortTable = (form) => {
    const panel = form.closest('[data-material-panel]');
    const table = panel?.querySelector('[data-sortable-table]');
    const body = table?.tBodies[0];
    if (!body) return;
    const column = Number(form.querySelector('[data-sort-field]').value);
    const direction = form.querySelector('[data-sort-order]').value;
    const rows = [...body.querySelectorAll('[data-material-row]')]
      .map((row, originalIndex) => ({ row, originalIndex }));
    rows.sort((left, right) => {
      const leftValue = left.row.cells[column]?.dataset.sortValue?.trim() || '';
      const rightValue = right.row.cells[column]?.dataset.sortValue?.trim() || '';
      if (!leftValue || !rightValue) {
        if (!leftValue && !rightValue) return left.originalIndex - right.originalIndex;
        return !leftValue ? 1 : -1;
      }
      const order = collator.compare(leftValue, rightValue);
      return (direction === 'ascending' ? order : -order) || left.originalIndex - right.originalIndex;
    });
    rows.forEach(({ row }) => body.append(row));
    form.closest('details')?.removeAttribute('open');
  };

  const activate = (name) => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.materialTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.materialPanel !== name; });
    if (activeInput) activeInput.value = name;
  };

  const filterRows = () => {
    const query = normalize(search?.value.trim() || '');
    panels.forEach((panel) => {
      const name = panel.dataset.materialPanel;
      const rows = [...panel.querySelectorAll(`[data-material-row="${name}"]`)];
      let visible = 0;
      rows.forEach((row) => {
        const matches = !query || normalize(row.dataset.search || '').includes(query);
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      const counter = workspace.querySelector(`[data-material-count="${name}"]`);
      if (counter) counter.textContent = String(visible);
      const staticEmpty = panel.querySelector('[data-static-empty]');
      if (staticEmpty) staticEmpty.hidden = Boolean(query);
      const filteredEmpty = panel.querySelector(`[data-filter-empty="${name}"]`);
      if (filteredEmpty) filteredEmpty.hidden = !query || visible > 0;
    });
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.materialTab)));
  workspace.querySelectorAll('[data-material-sort-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sortTable(form);
    });
  });
  search?.addEventListener('input', filterRows);
  activate(workspace.dataset.activeTab || 'catalogo');
  filterRows();
});

document.querySelectorAll('[data-dialog-open]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.dialogOpen);
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
  });
});
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.querySelectorAll('[data-dialog-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  if (dialog.hasAttribute('data-open-on-load')) {
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  }
});
