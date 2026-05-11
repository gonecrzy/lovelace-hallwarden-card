# Hallwarden Home Assistant Card

This prototype Lovelace card renders the child-facing chore dashboard through the Hallwarden Home Assistant integration by default, with a direct API fallback for standalone installs.

## Install With HACS Custom Repository

1. Add this repository as a custom repository in HACS.
2. Select category `Dashboard`.
3. Download `Hallwarden Card`.
4. Add the dashboard resource:

```yaml
url: /hacsfiles/lovelace-hallwarden-card/hallwarden-card.js
type: module
```

## Manual Install

Copy `hallwarden-card.js` to your Home Assistant `www/` directory, then add it as a dashboard resource:

```yaml
url: /local/hallwarden-card.js
type: module
```

## Recommended Home Assistant Integration Mode

Use integration mode when the Hallwarden Home Assistant integration is installed:

```yaml
type: custom:hallwarden-card
mode: integration
title: Chores
```

In this mode the browser talks only to Home Assistant. Home Assistant stores the Hallwarden API URL and token in the integration config entry and communicates with Hallwarden server-side.

## Direct Standalone Mode

Use direct mode only when you intentionally want the card to call Hallwarden from the browser:

```yaml
type: custom:hallwarden-card
mode: direct
title: Chores
api_url: http://hallwarden.local:3000
api_token: dev-ha-token
refresh_interval: 30
```

Direct mode requires the Hallwarden API URL to be reachable from the browser and requires CORS to allow the Home Assistant frontend origin. Use `HALLWARDEN_API_TOKEN` on the Hallwarden server to set the bearer token expected by the API.

## Home Assistant UI Editor

Hallwarden registers `custom:hallwarden-card` for the Home Assistant card picker and provides a basic graphical editor. YAML remains supported for advanced options and for copying known-good configs between dashboards.

## API Compatibility

The card uses `/api/v1/dashboard` for display and occurrence endpoints for actions. The HA integration uses `/api/v1/system` and `/api/v1/ha/summary` for entity setup and reminders. Keep the Hallwarden server and HACS assets from compatible releases.

## Display Options

All options are optional unless noted:

```yaml
type: custom:hallwarden-card
mode: integration

# Show one child only. Omit this to show every child returned by the API.
child_id: 2

# Hide the whole card when no matching chores are visible.
show_empty: false

# Hide the visible date/time clock. Single-child cards still show pending count.
show_clock: false

# Use the card as display-only by hiding checklist and complete buttons.
show_complete_button: false

# Limit visible chores per child card.
show_quantity: 5

# Use compact icon action buttons instead of text buttons.
use_icons: true

# Scale the full card or specific areas. Omit targeted scales to inherit scale.
scale: 1.2
button_scale: 1.35
spacing_scale: 1.1

# Return a stable Home Assistant masonry card size.
fixed_card_size: 3

# Arrange child cards when child_id is omitted.
# Options: vertical, horizontal, grid, columns.
# Also accepts common aliases like Grid, column, row.
layout: grid

# Show checklist details inline under the selected chore or in a popup overlay.
# Options: inline, popup.
checklist_mode: inline
```

When `child_id` is set, the card renders that child as the top-level Home Assistant card instead of nesting a child card inside the main chores card. When `child_id` is omitted, `layout` controls the child-card arrangement inside the main card.

`checklist_mode: inline` is the most reliable Home Assistant mode: tapping `List` expands the checklist directly under that chore title. `checklist_mode: popup` attempts to use Home Assistant's native dialog when available and falls back to a custom overlay otherwise.

## Styling

The card ships with readable defaults, but Home Assistant themes or `card_mod` can override these CSS variables. The old `--chore-card-*` variables still work as a transition fallback, but new configs should use `--hallwarden-card-*`.

Sizing can be controlled from the visual editor or YAML with `scale`, `heading_scale`, `child_scale`, `chore_scale`, `button_scale`, and `spacing_scale`. Advanced users can also override the equivalent CSS variables directly.

```yaml
card_mod:
  style: |
    :host,
    ha-card {
      --hallwarden-card-scale: 1.15;
      --hallwarden-card-heading-scale: 1.1;
      --hallwarden-card-child-scale: 1.15;
      --hallwarden-card-chore-scale: 1.2;
      --hallwarden-card-button-scale: 1.25;
      --hallwarden-card-spacing-scale: 1.1;
      --hallwarden-card-text-color: #111827;
      --hallwarden-card-muted-text-color: #334155;
      --hallwarden-card-background: linear-gradient(135deg, #f8fafc, #dbeafe);
      --hallwarden-card-child-background: rgba(255, 255, 255, 0.7);
      --hallwarden-card-child-tint: rgba(255, 251, 246, 0.93);
      --hallwarden-card-chore-background: rgba(255, 255, 255, 0.9);
      --hallwarden-card-popup-background: rgba(255, 255, 255, 0.96);
      --hallwarden-card-popup-overlay-background: rgba(219, 234, 254, 0.68);
      --hallwarden-card-button-background: rgba(15, 23, 42, 0.9);
      --hallwarden-card-button-text-color: #f8fafc;
      --hallwarden-card-household-icon-color: #f59e0b;
      --hallwarden-card-radius: 18px;
      --hallwarden-card-gap: 12px;
    }
```

Glass-style cards should use the exposed variables rather than shadow-root selectors:

```yaml
card_mod:
  style: |
    :host,
    ha-card {
      --hallwarden-card-text-color: #f8fafc;
      --hallwarden-card-muted-text-color: rgba(226, 232, 240, 0.82);
      --hallwarden-card-background: rgba(15, 23, 42, 0.35);
      --hallwarden-card-backdrop-filter: blur(18px) saturate(1.25);
      --hallwarden-card-border: 1px solid rgba(255, 255, 255, 0.22);
      --hallwarden-card-box-shadow: 0 18px 50px rgba(2, 6, 23, 0.28);
      --hallwarden-card-child-background: rgba(255, 255, 255, 0.12);
      --hallwarden-card-child-tint: rgba(255, 255, 255, 0.08);
      --hallwarden-card-child-box-shadow: 0 8px 20px rgba(2, 6, 23, 0.18);
      --hallwarden-card-chore-background: rgba(255, 255, 255, 0.16);
      --hallwarden-card-chore-radius: 16px;
      --hallwarden-card-button-background: rgba(255, 255, 255, 0.18);
      --hallwarden-card-button-text-color: #f8fafc;
      --hallwarden-card-checklist-unchecked-background: rgba(255, 255, 255, 0.16);
      --hallwarden-card-checklist-unchecked-border: 2px solid rgba(255, 255, 255, 0.42);
      --hallwarden-card-checklist-checked-background: #16a34a;
      --hallwarden-card-checklist-checked-border: 2px solid #86efac;
      --hallwarden-card-checklist-check-color: #ffffff;
    }
```

Additional advanced variables are available for tighter theming:

`--hallwarden-card-child-accent-width`, `--hallwarden-card-child-border`, `--hallwarden-card-chore-box-shadow`, `--hallwarden-card-detail-box-shadow`, `--hallwarden-card-button-box-shadow`, and `--hallwarden-card-popup-box-shadow`.
