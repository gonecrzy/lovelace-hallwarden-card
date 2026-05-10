const HALLWARDEN_CARD_VERSION = "2026.05.10-hallwarden-v1";

class HallwardenCard extends HTMLElement {
  static version = HALLWARDEN_CARD_VERSION;

  static getStubConfig() {
    return {
      title: "Chores",
      api_url: "http://hallwarden.local:3000",
      api_token: "",
      layout: "vertical",
      checklist_mode: "inline",
      show_empty: true,
      show_complete_button: true,
      use_icons: false,
    };
  }

  static getConfigElement() {
    return document.createElement("hallwarden-card-editor");
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._dashboard = null;
    this._detail = null;
    this._detailChildId = null;
    this._detailOccurrenceId = null;
    this._error = "";
    this._popupPortal = null;
    this._useHaDialog = false;
    this._refreshTimer = null;
  }

  setConfig(config) {
    if (!config || config.type !== "custom:hallwarden-card") {
      throw new Error("Expected type: custom:hallwarden-card");
    }

    const apiUrl = config.api_url || config.base_url;
    if (!apiUrl) {
      throw new Error("api_url is required");
    }

    this._config = {
      title: "Chores",
      refresh_interval: 30,
      show_empty: true,
      show_complete_button: true,
      use_icons: false,
      layout: "vertical",
      checklist_mode: "inline",
      ...config,
      api_url: apiUrl,
    };

    if (this.isConnected) {
      this._refresh();
      this._scheduleRefresh();
    }
  }

  connectedCallback() {
    this.setAttribute("data-card-version", HALLWARDEN_CARD_VERSION);
    this._render();
    if (this._config.api_url) {
      this._refresh();
      this._scheduleRefresh();
    }
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      window.clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    this._removePopupPortal();
  }

  getCardSize() {
    if (Number(this._config.fixed_card_size) > 0) {
      return Number(this._config.fixed_card_size);
    }
    return 5;
  }

  getGridOptions() {
    return {
      columns: 12,
      rows: 5,
      min_columns: 6,
      min_rows: 3,
    };
  }

  _scheduleRefresh() {
    if (this._refreshTimer) {
      window.clearInterval(this._refreshTimer);
    }

    const seconds = Math.max(Number(this._config.refresh_interval) || 30, 10);
    this._refreshTimer = window.setInterval(() => this._refresh(), seconds * 1000);
  }

  async _refresh() {
    try {
      const response = await fetch(this._endpoint("/api/v1/dashboard"), {
        headers: this._headers(),
      });

      if (!response.ok) {
        throw new Error(`Dashboard API returned ${response.status}`);
      }

      this._dashboard = await response.json();
      this._error = "";
    } catch (error) {
      this._error = error instanceof Error ? error.message : "Failed to load chores";
    }

    this._render();
  }

  async _openDetail(occurrenceId, childId) {
    try {
      const response = await fetch(
        this._endpoint(`/api/v1/occurrences/${occurrenceId}?child_id=${childId}`),
        { headers: this._headers() },
      );

      if (!response.ok) {
        throw new Error(`Detail request failed: ${response.status}`);
      }

      this._detail = await response.json();
      this._detailChildId = Number(childId);
      this._detailOccurrenceId = Number(occurrenceId);
      await this._ensureHaDialog();
      this._error = "";
    } catch (error) {
      this._error = error instanceof Error ? error.message : "Unable to load chore detail";
    }

    this._render();
  }

  async _updateChecklist(occurrenceId, itemId, checked) {
    try {
      const response = await fetch(
        this._endpoint(`/api/v1/occurrences/${occurrenceId}/checklist/${itemId}`),
        {
          method: "POST",
          headers: this._headers({ "Content-Type": "application/json" }),
          body: JSON.stringify({ checked }),
        },
      );

      if (!response.ok) {
        throw new Error(`Checklist update failed: ${response.status}`);
      }

      await this._openDetail(occurrenceId, this._detailChildId);
    } catch (error) {
      this._error = error instanceof Error ? error.message : "Unable to update checklist";
      this._render();
    }
  }

  async _completeOccurrence(occurrenceId, childId) {
    try {
      const response = await fetch(this._endpoint(`/api/v1/occurrences/${occurrenceId}/complete`), {
        method: "POST",
        headers: this._headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ completed_by_child_id: Number(childId) }),
      });

      if (!response.ok) {
        throw new Error(`Complete failed: ${response.status}`);
      }

      this._detail = null;
      this._detailChildId = null;
      this._detailOccurrenceId = null;
      this._error = "";
      await this._refresh();
    } catch (error) {
      this._error = error instanceof Error ? error.message : "Unable to complete chore";
      this._render();
    }
  }

  _endpoint(path) {
    return `${this._config.api_url.replace(/\/$/, "")}${path}`;
  }

  _headers(extra = {}) {
    const headers = { Accept: "application/json", ...extra };
    if (this._config.api_token) {
      headers.Authorization = `Bearer ${this._config.api_token}`;
    }
    return headers;
  }

  _render() {
    const preservedStyleNodes = this._preservedStyleNodes();
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --ct-text: var(--hallwarden-card-text-color, var(--chore-card-text-color, #172033));
          --ct-muted: var(--hallwarden-card-muted-text-color, var(--chore-card-muted-text-color, #475569));
          --ct-card-background:
            var(
              --hallwarden-card-background,
              var(
                --chore-card-background,
                radial-gradient(circle at top left, rgba(245, 158, 11, 0.22), transparent 32rem),
                linear-gradient(135deg, rgba(255,255,255,0.94), rgba(239,246,255,0.92))
              )
            );
          --ct-surface: var(--hallwarden-card-child-background, var(--chore-card-child-background, rgba(255, 255, 255, 0.76)));
          --ct-surface-strong: var(--hallwarden-card-chore-background, var(--chore-card-chore-background, rgba(255, 255, 255, 0.88)));
          --ct-popup-surface: var(--hallwarden-card-popup-background, var(--chore-card-popup-background, var(--ct-surface-strong)));
          --ct-button-background: var(--hallwarden-card-button-background, var(--chore-card-button-background, var(--ct-surface-strong)));
          --ct-button-text: var(--hallwarden-card-button-text-color, var(--chore-card-button-text-color, var(--ct-text)));
          --ct-household-icon: var(--hallwarden-card-household-icon-color, var(--chore-card-household-icon-color, #b45309));
          --ct-radius: var(--hallwarden-card-radius, var(--chore-card-radius, 18px));
          --ct-gap: var(--hallwarden-card-gap, var(--chore-card-gap, 12px));
          color: var(--ct-text);
        }

        ha-card {
          --ct-text: var(--hallwarden-card-text-color, var(--chore-card-text-color, #172033));
          --ct-muted: var(--hallwarden-card-muted-text-color, var(--chore-card-muted-text-color, #475569));
          --ct-card-background:
            var(
              --hallwarden-card-background,
              var(
                --chore-card-background,
                radial-gradient(circle at top left, rgba(245, 158, 11, 0.22), transparent 32rem),
                linear-gradient(135deg, rgba(255,255,255,0.94), rgba(239,246,255,0.92))
              )
            );
          --ct-surface: var(--hallwarden-card-child-background, var(--chore-card-child-background, rgba(255, 255, 255, 0.76)));
          --ct-surface-strong: var(--hallwarden-card-chore-background, var(--chore-card-chore-background, rgba(255, 255, 255, 0.88)));
          --ct-popup-surface: var(--hallwarden-card-popup-background, var(--chore-card-popup-background, var(--ct-surface-strong)));
          --ct-button-background: var(--hallwarden-card-button-background, var(--chore-card-button-background, var(--ct-surface-strong)));
          --ct-button-text: var(--hallwarden-card-button-text-color, var(--chore-card-button-text-color, var(--ct-text)));
          --ct-household-icon: var(--hallwarden-card-household-icon-color, var(--chore-card-household-icon-color, #b45309));
          --ct-radius: var(--hallwarden-card-radius, var(--chore-card-radius, 18px));
          --ct-gap: var(--hallwarden-card-gap, var(--chore-card-gap, 12px));
          color: var(--ct-text);
          overflow: hidden;
          background: var(--ct-card-background);
        }

        ha-card.single-child-card {
          border-left: 8px solid var(--child-color, #2563eb);
        }

        .card {
          padding: 16px;
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        h2 {
          margin: 0;
          font-size: 1.3rem;
          line-height: 1.1;
          color: var(--hallwarden-card-text-color, var(--chore-card-text-color, var(--ct-text, #172033))) !important;
        }

        .date {
          font-size: 0.85rem;
          color: var(--hallwarden-card-muted-text-color, var(--chore-card-muted-text-color, var(--ct-muted, #475569))) !important;
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 0.45rem 0.75rem;
          background: var(--ct-button-background);
          color: var(--hallwarden-card-button-text-color, var(--chore-card-button-text-color, var(--ct-button-text, var(--ct-text, #172033)))) !important;
          cursor: pointer;
          font-weight: 800;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.09);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .children {
          display: grid;
          gap: var(--ct-gap);
        }

        .children.layout-vertical {
          grid-template-columns: 1fr;
        }

        .children.layout-grid {
          grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
        }

        .children.layout-columns {
          grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
        }

        .children.layout-horizontal {
          display: flex;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .children.layout-horizontal .child {
          flex: 0 0 min(320px, 86vw);
        }

        .child {
          border-left: 8px solid var(--child-color, #2563eb);
          border-radius: var(--ct-radius);
          padding: 12px;
          background: var(--ct-surface);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .child-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .child-name {
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--hallwarden-card-text-color, var(--chore-card-text-color, var(--ct-text, #172033))) !important;
        }

        .counts {
          font-size: 0.8rem;
          color: var(--hallwarden-card-muted-text-color, var(--chore-card-muted-text-color, var(--ct-muted, #475569))) !important;
        }

        .chores {
          display: grid;
          gap: 7px;
        }

        .chore {
          border-radius: 14px;
          padding: 8px 10px;
          background: var(--ct-surface-strong);
        }

        .chore-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .title {
          min-width: 0;
          font-weight: 900;
          color: var(--hallwarden-card-text-color, var(--chore-card-text-color, var(--ct-text, #172033))) !important;
        }

        .household-icon {
          color: var(--ct-household-icon);
        }

        .actions {
          display: flex;
          flex: none;
          gap: 6px;
        }

        .detail {
          margin-top: 14px;
          border-radius: var(--ct-radius);
          padding: 14px;
          background: var(--ct-surface-strong);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
        }

        .chore .detail {
          margin-top: 8px;
        }

        .detail h3 {
          margin: 0 0 10px;
          font-size: 1.05rem;
          color: var(--hallwarden-card-text-color, var(--chore-card-text-color, var(--ct-text, #172033))) !important;
        }

        .detail-list {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        .detail-list label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: var(--hallwarden-card-text-color, var(--chore-card-text-color, var(--ct-text, #172033))) !important;
        }

        .ha-dialog-detail {
          color: var(--hallwarden-card-text-color, var(--chore-card-text-color, var(--ct-text, #172033))) !important;
        }

        .ha-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .empty,
        .error {
          padding: 18px;
          border-radius: var(--ct-radius);
          background: var(--ct-surface);
          text-align: center;
        }

        .error {
          color: #b91c1c;
        }
      </style>
      ${this._shouldHideCard()
        ? ""
        : this._renderCardShell()}
      ${this._useHaDialog ? this._renderPopupDetail() : ""}
    `;
    preservedStyleNodes.forEach((node) => this.shadowRoot.append(node));

    this.shadowRoot
      .querySelector("[data-refresh]")
      ?.addEventListener("click", () => this._refresh());
    this.shadowRoot.querySelectorAll("[data-complete]").forEach((button) => {
      button.addEventListener("click", () =>
        this._completeOccurrence(button.dataset.complete, button.dataset.child),
      );
    });
    this.shadowRoot.querySelectorAll("[data-detail]").forEach((button) => {
      button.addEventListener("click", () =>
        this._openDetail(button.dataset.detail, button.dataset.child),
      );
    });
    this.shadowRoot.querySelectorAll("[data-checklist]").forEach((input) => {
      input.addEventListener("change", () =>
        this._updateChecklist(this._detailOccurrenceId, input.dataset.checklist, input.checked),
      );
    });
    this.shadowRoot.querySelector("[data-detail-complete]")?.addEventListener("click", (event) => {
      this._completeOccurrence(event.currentTarget.dataset.detailComplete, this._detailChildId);
    });
    this.shadowRoot.querySelector("[data-ha-dialog]")?.addEventListener("closed", () => {
      this._detail = null;
      this._detailChildId = null;
      this._detailOccurrenceId = null;
      this._render();
    });
    this.shadowRoot.querySelectorAll("[data-close-detail]").forEach((element) => {
      element.addEventListener("click", () => {
        this._detail = null;
        this._detailChildId = null;
        this._detailOccurrenceId = null;
        this._render();
      });
    });
    this._syncPopupPortal();
  }

  _preservedStyleNodes() {
    return Array.from(this.shadowRoot.children).filter(
      (node) => node.matches?.("card-mod, [data-card-mod]"),
    );
  }

  _renderCardShell() {
    const singleChild = this._singleVisibleChild();
    if (singleChild) {
      return this._renderSingleChildCard(singleChild);
    }

    return `<ha-card>
        <section class="card">
          <header>
            <div>
              <h2>${this._escape(this._config.title || "Chores")}</h2>
              <div class="date">${this._escape(this._dashboard?.clock_fallback || "")}</div>
            </div>
            <button type="button" data-refresh>Refresh</button>
          </header>
          ${this._error ? `<div class="error">${this._escape(this._error)}</div>` : this._renderChildren()}
        </section>
      </ha-card>`;
  }

  _renderSingleChildCard(child) {
    const chores = this._visibleChores(child);
    const heading = this._config.title && this._config.title !== "Chores" ? this._config.title : child.name;
    const pendingCount = Number(child.pending_count ?? chores.length) || 0;

    return `<ha-card class="single-child-card" style="--child-color: ${this._escapeAttribute(child.color || "#2563eb")}">
        <section class="card single-child">
          <header>
            <div>
              <h2>${this._escape(heading)}</h2>
              <div class="date">${pendingCount} pending · ${this._escape(this._dashboard?.clock_fallback || "")}</div>
            </div>
            <button type="button" data-refresh>Refresh</button>
          </header>
          ${this._error ? `<div class="error">${this._escape(this._error)}</div>` : ""}
          <div class="chores">
            ${chores.map((chore) => this._renderChore(chore, child)).join("")}
          </div>
          ${chores.length === 0 ? `<div class="empty">${this._escape(child.empty_message || "No chores are ready.")}</div>` : ""}
        </section>
      </ha-card>`;
  }

  _renderChildren() {
    const children = this._visibleChildren();
    if (children.length === 0) {
      return `<div class="empty">${this._escape(this._emptyMessage())}</div>`;
    }

    return `
      <div class="children layout-${this._escapeAttribute(this._layout())}">
        ${children.map((child) => this._renderChild(child)).join("")}
      </div>
    `;
  }

  _renderChild(child) {
    const chores = this._visibleChores(child);
    const pendingCount = Number(child.pending_count ?? chores.length) || 0;

    return `
      <article class="child" style="--child-color: ${this._escapeAttribute(child.color || "#2563eb")}">
        <div class="child-heading">
          <div class="child-name">${this._escape(child.name)}</div>
          <div class="counts">${pendingCount} pending</div>
        </div>
        <div class="chores">
          ${chores.map((chore) => this._renderChore(chore, child)).join("")}
        </div>
      </article>
    `;
  }

  _renderChore(chore, child) {
    const isHousehold = chore.is_household || chore.assignment_kind === "household";
    const icon = isHousehold
      ? `<span class="household-icon" aria-label="Household chore">★</span>`
      : `<span aria-hidden="true">✓</span>`;
    const action = this._renderAction(chore, child);

    return `
      <div class="chore" data-occurrence-id="${Number(chore.occurrence_id)}">
        <div class="chore-row">
          <span class="title">${icon} ${this._escape(chore.title)}</span>
          <span class="actions">${action}</span>
        </div>
        ${this._renderInlineDetail(chore)}
      </div>
    `;
  }

  _renderAction(chore, child) {
    if (this._config.show_complete_button === false) {
      return "";
    }

    if (chore.has_checklist) {
      const label = this._config.use_icons ? "≣" : "List";
      const aria = this._config.use_icons ? ` aria-label="Open checklist"` : "";
      return `<button type="button" data-detail="${Number(chore.occurrence_id)}" data-child="${Number(child.id)}"${aria}>${label}</button>`;
    }

    const label = this._config.use_icons ? "✓" : "Complete";
    const aria = this._config.use_icons ? ` aria-label="Complete chore"` : "";
    return `<button type="button" data-complete="${Number(chore.occurrence_id)}" data-child="${Number(child.id)}"${aria}>${label}</button>`;
  }

  _layout() {
    const configuredLayout =
      this._config.child_layout ?? this._config.children_layout ?? this._config.layout ?? "vertical";
    const rawLayout = String(configuredLayout?.type ?? configuredLayout?.mode ?? configuredLayout)
      .trim()
      .toLowerCase();
    const aliases = {
      column: "columns",
      cols: "columns",
      row: "horizontal",
      rows: "horizontal",
    };
    const layout = aliases[rawLayout] || rawLayout;
    if (["vertical", "horizontal", "grid", "columns"].includes(layout)) {
      return layout;
    }
    return "vertical";
  }

  _singleVisibleChild() {
    if (this._config.child_id === undefined || this._config.child_id === null) {
      return null;
    }
    const children = this._visibleChildren();
    return children.length === 1 ? children[0] : null;
  }

  _visibleChildren() {
    let children = this._dashboard?.children || [];
    if (this._config.child_id !== undefined && this._config.child_id !== null) {
      const childId = Number(this._config.child_id);
      children = children.filter((child) => Number(child.id) === childId);
    }

    if (this._config.show_empty === false) {
      children = children.filter((child) => this._visibleChores(child).length > 0);
    }

    return children;
  }

  _visibleChores(child) {
    let chores = child.chores || [];
    const limit = Number(this._config.show_quantity);
    if (Number.isInteger(limit) && limit >= 0) {
      chores = chores.slice(0, limit);
    }
    return chores;
  }

  _emptyMessage() {
    if (this._config.child_id !== undefined && this._config.child_id !== null) {
      return "Child not found.";
    }
    return "No chores are ready.";
  }

  _shouldHideCard() {
    if (this._error || this._detail || this._config.show_empty !== false || !this._dashboard) {
      return false;
    }
    return this._visibleChildren().length === 0;
  }

  _renderDetail() {
    const detail = this._detail;

    return `
      <div class="detail" role="dialog" aria-label="${this._escapeAttribute(detail.title)}">
        <h3>${this._escape(detail.title)}</h3>
        <div class="detail-list">
          ${(detail.checklist || [])
            .map(
              (item) => `
                <label>
                  <input
                    type="checkbox"
                    data-checklist="${Number(item.id)}"
                    ${item.completed ? "checked" : ""}
                  >
                  ${this._escape(item.label)}
                </label>
              `,
            )
            .join("")}
        </div>
        <button
          type="button"
          data-detail-complete="${Number(this._detailOccurrenceId)}"
          ${detail.can_complete ? "" : "disabled"}
        >
          Complete
        </button>
      </div>
    `;
  }

  _renderInlineDetail(chore) {
    if (!this._detail || this._config.checklist_mode === "popup") {
      return "";
    }
    if (Number(this._detailOccurrenceId) !== Number(chore.occurrence_id)) {
      return "";
    }
    return this._renderDetail();
  }

  _renderPopupDetail() {
    if (!this._detail || this._config.checklist_mode !== "popup") {
      return "";
    }
    if (this._useHaDialog) {
      return this._renderHaDialogDetail();
    }
    const detail = this._detail;

    return `
      <div class="popup-backdrop" data-close-detail>
        <div class="popup-dialog" role="dialog" aria-label="${this._escapeAttribute(detail.title)}" data-popup-dialog>
          <div class="popup-header">
            <h3>${this._escape(detail.title)}</h3>
            <button type="button" data-close-detail aria-label="Close checklist">×</button>
          </div>
          <div class="detail-list">
            ${(detail.checklist || [])
              .map(
                (item) => `
                  <label>
                    <input
                      type="checkbox"
                      data-checklist="${Number(item.id)}"
                      ${item.completed ? "checked" : ""}
                    >
                    ${this._escape(item.label)}
                  </label>
                `,
              )
              .join("")}
          </div>
          <button
            type="button"
            data-detail-complete="${Number(this._detailOccurrenceId)}"
            ${detail.can_complete ? "" : "disabled"}
          >
            Complete
          </button>
        </div>
      </div>
    `;
  }

  _renderHaDialogDetail() {
    const detail = this._detail;

    return `
      <ha-dialog
        open
        data-ha-dialog
        heading="${this._escapeAttribute(detail.title)}"
        aria-label="${this._escapeAttribute(detail.title)}"
      >
        <div class="ha-dialog-detail">
          <div class="detail-list">
            ${(detail.checklist || [])
              .map(
                (item) => `
                  <label>
                    <input
                      type="checkbox"
                      data-checklist="${Number(item.id)}"
                      ${item.completed ? "checked" : ""}
                    >
                    ${this._escape(item.label)}
                  </label>
                `,
              )
              .join("")}
          </div>
          <div class="ha-dialog-actions">
            <button type="button" data-close-detail>Close</button>
            <button
              type="button"
              data-detail-complete="${Number(this._detailOccurrenceId)}"
              ${detail.can_complete ? "" : "disabled"}
            >
              Complete
            </button>
          </div>
        </div>
      </ha-dialog>
    `;
  }

  async _ensureHaDialog() {
    if (this._config.checklist_mode !== "popup") {
      this._useHaDialog = false;
      return;
    }

    if (customElements.get("ha-dialog")) {
      this._useHaDialog = true;
      return;
    }

    if (typeof window.loadCardHelpers !== "function") {
      this._useHaDialog = false;
      return;
    }

    try {
      const cardHelpers = await window.loadCardHelpers();
      if (!customElements.get("ha-dialog") && cardHelpers?.importMoreInfoDialog) {
        await cardHelpers.importMoreInfoDialog();
      }
      this._useHaDialog = Boolean(customElements.get("ha-dialog"));
    } catch (_error) {
      this._useHaDialog = false;
    }
  }

  _syncPopupPortal() {
    if (!this._detail || this._config.checklist_mode !== "popup" || this._useHaDialog) {
      this._removePopupPortal();
      return;
    }

    if (!this._popupPortal) {
      this._popupPortal = document.createElement("div");
      this._popupPortal.className = "hallwarden-popup-portal";
      document.body.append(this._popupPortal);
    }

    this._copyPopupVariables();
    this._popupPortal.innerHTML = `${this._renderPopupStyles()}${this._renderPopupDetail()}`;
    this._popupPortal.querySelector("[data-popup-dialog]")?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    this._popupPortal.querySelectorAll("[data-close-detail]").forEach((element) => {
      element.addEventListener("click", () => {
        this._detail = null;
        this._detailChildId = null;
        this._detailOccurrenceId = null;
        this._render();
      });
    });
    this._popupPortal.querySelectorAll("[data-checklist]").forEach((input) => {
      input.addEventListener("change", () =>
        this._updateChecklist(this._detailOccurrenceId, input.dataset.checklist, input.checked),
      );
    });
    this._popupPortal.querySelector("[data-detail-complete]")?.addEventListener("click", (event) => {
      this._completeOccurrence(event.currentTarget.dataset.detailComplete, this._detailChildId);
    });
  }

  _removePopupPortal() {
    this._popupPortal?.remove();
    this._popupPortal = null;
  }

  _copyPopupVariables() {
    if (!this._popupPortal) {
      return;
    }

    const variableSource = this.shadowRoot.querySelector("ha-card") || this;
    const sourceStyles = window.getComputedStyle(variableSource);
    [
      "--ct-text",
      "--ct-muted",
      "--ct-popup-surface",
      "--ct-button-background",
      "--ct-button-text",
      "--ct-radius",
    ].forEach((name) => {
      const value = sourceStyles.getPropertyValue(name).trim();
      if (value) {
        this._popupPortal.style.setProperty(name, value);
      }
    });
  }

  _renderPopupStyles() {
    return `
      <style>
        .popup-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          padding: 24px;
          color: var(--ct-text, #172033);
          background: rgba(15, 23, 42, 0.46);
          backdrop-filter: blur(4px);
        }

        .popup-dialog {
          width: min(460px, 100%);
          max-height: min(80vh, 620px);
          overflow: auto;
          border-radius: var(--ct-radius, 18px);
          padding: 16px;
          color: var(--ct-text, #172033);
          background: var(--ct-popup-surface, rgba(255, 255, 255, 0.96));
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.35);
        }

        .popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .popup-header h3 {
          margin: 0;
          font-size: 1.08rem;
          color: var(--ct-text, #172033);
        }

        .detail-list {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        .detail-list label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: var(--ct-text, #172033);
        }

        button {
          border: 0;
          border-radius: 999px;
          padding: 0.45rem 0.75rem;
          background: var(--ct-button-background, rgba(255, 255, 255, 0.88));
          color: var(--ct-button-text, var(--ct-text, #172033));
          cursor: pointer;
          font-weight: 800;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.09);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      </style>
    `;
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _escapeAttribute(value) {
    return this._escape(value).replace(/`/g, "&#096;");
  }
}

class HallwardenCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    this._config = {
      type: "custom:hallwarden-card",
      title: "Chores",
      layout: "vertical",
      checklist_mode: "inline",
      show_empty: true,
      show_complete_button: true,
      use_icons: false,
      ...config,
    };
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: grid;
          gap: 12px;
        }

        label {
          display: grid;
          gap: 4px;
          font-weight: 600;
        }

        input,
        select {
          box-sizing: border-box;
          width: 100%;
          padding: 8px;
        }

        .row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .row input {
          width: auto;
        }
      </style>
      <div class="editor">
        ${this._input("title", "Title")}
        ${this._input("api_url", "API URL")}
        ${this._input("api_token", "API token", "password")}
        ${this._input("child_id", "Child ID", "number")}
        ${this._input("show_quantity", "Visible chore limit", "number")}
        ${this._input("fixed_card_size", "Fixed card size", "number")}
        ${this._select("layout", "Layout", ["vertical", "horizontal", "grid", "columns"])}
        ${this._select("checklist_mode", "Checklist mode", ["inline", "popup"])}
        ${this._checkbox("show_empty", "Show empty card")}
        ${this._checkbox("show_complete_button", "Show complete buttons")}
        ${this._checkbox("use_icons", "Use icon buttons")}
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-config-key]").forEach((element) => {
      element.addEventListener("input", () => this._updateFromElement(element));
      element.addEventListener("change", () => this._updateFromElement(element));
    });
  }

  _input(key, label, type = "text") {
    const value = this._config[key] ?? "";
    return `<label>${label}<input name="${key}" data-config-key="${key}" type="${type}" value="${this._escapeAttribute(value)}"></label>`;
  }

  _select(key, label, options) {
    const current = this._config[key] ?? "";
    return `<label>${label}<select name="${key}" data-config-key="${key}">${options
      .map(
        (option) =>
          `<option value="${option}" ${current === option ? "selected" : ""}>${option}</option>`,
      )
      .join("")}</select></label>`;
  }

  _checkbox(key, label) {
    return `<label class="row"><input name="${key}" data-config-key="${key}" type="checkbox" ${
      this._config[key] !== false ? "checked" : ""
    }>${label}</label>`;
  }

  _updateFromElement(element) {
    const key = element.dataset.configKey;
    let value = element.type === "checkbox" ? element.checked : element.value;
    if (["child_id", "show_quantity", "fixed_card_size"].includes(key)) {
      value = value === "" ? undefined : Number(value);
    }

    const nextConfig = { ...this._config };
    if (value === undefined || value === "") {
      delete nextConfig[key];
    } else {
      nextConfig[key] = value;
    }
    this._config = nextConfig;

    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config: nextConfig };
    this.dispatchEvent(event);
  }

  _escapeAttribute(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/`/g, "&#096;");
  }
}

customElements.define("hallwarden-card-editor", HallwardenCardEditor);
customElements.define("hallwarden-card", HallwardenCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "custom:hallwarden-card",
  name: "Hallwarden Card",
  description: `Child-facing chore dashboard card backed by the Hallwarden API. Version ${HALLWARDEN_CARD_VERSION}.`,
});

window.HallwardenCardVersion = HALLWARDEN_CARD_VERSION;
