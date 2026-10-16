// Generated from first-party app stylesheets by tools/design-system/build.mjs. Do not edit.
export const UI_SOURCE = {
  "stylesheets": [
    "styles.css",
    "src/terminal.css",
    "src/report.css",
    "src/code-create.css"
  ],
  "responsive": [
    {
      "selector": "#app",
      "declarations": {
        "grid-template-columns": "var(--rail-w) 0 1fr 0"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "#left",
      "declarations": {
        "display": "none"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "#right",
      "declarations": {
        "display": "none"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "#app > .col-resizer",
      "declarations": {
        "display": "none"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home",
      "declarations": {
        "grid-template-columns": "1fr"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home > .col-resizer",
      "declarations": {
        "display": "none"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home-side",
      "declarations": {
        "display": "none"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home-search",
      "declarations": {
        "width": "140px"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".pg-body",
      "declarations": {
        "grid-template-columns": "1fr"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 640px)"
    },
    {
      "selector": ".pg-side",
      "declarations": {
        "border-left": "0",
        "border-top": "1px solid var(--border)"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 640px)"
    },
    {
      "selector": ".vr-panes",
      "declarations": {
        "grid-template-columns": "1fr"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 720px)"
    },
    {
      "selector": ".file-banner",
      "declarations": {
        "width": "calc(100% - 32px)",
        "flex-wrap": "wrap",
        "white-space": "normal"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".tokens-header .file-name",
      "declarations": {
        "min-width": "0"
      },
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".welcome-docs",
      "declarations": {
        "grid-template-columns": "1fr",
        "gap": "16px"
      },
      "file": "styles.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".welcome-docs nav",
      "declarations": {
        "flex-direction": "row",
        "flex-wrap": "wrap"
      },
      "file": "styles.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".welcome-docs article",
      "declarations": {
        "padding": "20px"
      },
      "file": "styles.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": "#terminal-dock header",
      "declarations": {
        "gap": "4px",
        "padding": "6px 8px"
      },
      "file": "src/terminal.css",
      "condition": "@media (max-width:640px)"
    },
    {
      "selector": "#terminal-dock header span",
      "declarations": {
        "flex-basis": "70%"
      },
      "file": "src/terminal.css",
      "condition": "@media (max-width:640px)"
    },
    {
      "selector": ".terminal-emulator",
      "declarations": {
        "padding": "0 8px"
      },
      "file": "src/terminal.css",
      "condition": "@media (max-width:640px)"
    },
    {
      "selector": ".report .report-cards",
      "declarations": {
        "grid-template-columns": "1fr",
        "gap": "10px"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-summary-card",
      "declarations": {
        "padding": "16px"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-summary-card>strong",
      "declarations": {
        "font-size": "26px",
        "margin": "8px 0"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-kind-grid",
      "declarations": {
        "grid-template-columns": "repeat(3,minmax(0,1fr))"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-library-grid",
      "declarations": {
        "grid-template-columns": "1fr"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-intro",
      "declarations": {
        "flex-wrap": "wrap"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-details-toolbar",
      "declarations": {
        "align-items": "start",
        "flex-direction": "column"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-details-toolbar input",
      "declarations": {
        "width": "100%"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-kind-grid",
      "declarations": {
        "gap": "8px"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-kind-grid",
      "declarations": {
        "grid-template-columns": "repeat(2,minmax(0,1fr))"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-finding",
      "declarations": {
        "align-items": "start",
        "flex-direction": "column",
        "gap": "8px"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-filters label",
      "declarations": {
        "width": "100%"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-filters .select",
      "declarations": {
        "max-width": "none"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-intro h2",
      "declarations": {
        "font-size": "19px"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-host",
      "declarations": {
        "padding": "20px 16px"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:640px)"
    },
    {
      "selector": ".report-section-title",
      "declarations": {
        "flex-wrap": "wrap"
      },
      "file": "src/report.css",
      "condition": "@media(max-width:640px)"
    },
    {
      "selector": ".code-create-backdrop",
      "declarations": {
        "padding": "8px"
      },
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create",
      "declarations": {
        "height": "calc(100dvh - 16px)"
      },
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-body",
      "declarations": {
        "display": "flex",
        "flex-direction": "column",
        "overflow": "auto"
      },
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-source",
      "declarations": {
        "min-height": "420px",
        "border-right": "0",
        "border-bottom": "1px solid var(--border)"
      },
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-preview",
      "declarations": {
        "min-height": "400px"
      },
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-toolbar select",
      "declarations": {
        "max-width": "220px"
      },
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    }
  ],
  "origins": [
    {
      "selector": ":root",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ":root[data-theme=\"dark\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "*",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "[hidden]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "html",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "button",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.scrubbing",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.scrubbing *",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".col-resizer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".col-resizer::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".col-resizer:hover::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".col-resizer.dragging::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".col-resizer:focus-visible::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".col-resizer:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.col-resizing",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.col-resizing *",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > .col-resizer[data-col=\"left\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > .col-resizer[data-col=\"right\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home > .col-resizer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-body > .col-resizer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-work > .col-resizer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-body > .col-resizer[data-col=\"icons-groups\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-body > .col-resizer[data-col=\"icons-inspector\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-btn:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-btn:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-tools",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-logo",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-sep",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".panel",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#left",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#right",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-header",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-name:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-name:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".panel-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pages",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#pages-list",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row.in-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group .chev",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group.has-active .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group .count",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row.drop-before::before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row.drop-after::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group.drop-before::before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row.drop-before::before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group.drop-before::before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row.drop-after::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-group.drop-inside",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pages-filter",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pages-filter[hidden]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pages-none",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row .check",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row.active .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row .row-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".page-row:hover .row-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layers",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#layers-list",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.selected",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.in-selected",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.frame > .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.frame > .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.is-hidden > .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.is-hidden > .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row .chev",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.selected .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".row-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row:hover .row-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.is-hidden .row-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.is-locked .row-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row:not(:hover).is-hidden [data-act=\"lock\"]:not(.on)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row:not(:hover):not(.is-locked) [data-act=\"lock\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row:not(:hover):not(.is-hidden) [data-act=\"vis\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.drop-before::before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.drop-after::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.drop-before::before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.drop-after::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.drop-inside",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.componentish > .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.componentish > .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.in-instance > .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".empty-hint",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rename-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-btn:hover:not(:disabled)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-btn:disabled",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-btn.on",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".right-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tabs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tab",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tab.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".zoom-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".zoom-btn:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#props",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".section",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".section-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".align-bar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid2",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field:focus-within",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mini",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".op-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".color-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".color-row:focus-within",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".swatch input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".color-row .hex",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".color-row .op",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".op-suffix",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row.is-hidden .swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row.is-hidden .hex",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row.is-hidden .op",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row.is-hidden .op-suffix",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row .icon-btn:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mixed-paints",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".modal.lib-modal.audit-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-done",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-all",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-section",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-row .audit-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-count",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-match",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-match .audit-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-match.exact b",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".audit-match.close b",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".deprecated-tag",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset.deprecated",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row.deprecated .var-name input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row.deprecated .var-name-text",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-chip.deprecated",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip.deprecated",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-chip.deprecated",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".deprecate-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset.deprecated .asset-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-deprecated",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-pair",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-pair .mini-swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-badge.aaa",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-badge.aa",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-badge.fail",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-pair-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-pair-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-pair-head .link-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-pair-head .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-modes",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".contrast-mode",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-field",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-field > .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-field .grid-num",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-field .grid-num:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-field .var-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-field:hover .var-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".grid-row.is-hidden .grid-field",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-row .field-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-row + .effect-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-head .select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-head .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-row.is-hidden .grid2",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".effect-row.is-hidden .color-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".select:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".select:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".select.wide",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".seg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".seg .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".seg .icon-btn.on",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".wh-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".wh-row .lock-aspect",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".wh-row .lock-aspect.on",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-mid",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-grid",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-cell",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-cell:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-cell span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-cell.on span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-grid.vertical .al-cell.on span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-fields",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".export-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn.wide",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".presets",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".preset",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".preset:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#canvas",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#scene",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#overlay",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#overlay",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".text-editor",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#toolbar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tb-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tb-btn:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tb-btn.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tb-btn::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tb-btn:hover::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tb-sep",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item.disabled",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-check",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-shortcut",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item:hover .menu-shortcut",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-sep",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".modal-backdrop",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".modal-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".modal-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".sc-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".sc-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".sc-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "kbd",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#toast",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#toast.show",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "#left",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "#right",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "#app > .col-resizer",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".btn.primary",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn.primary:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-side",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-brand",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-nav",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-item:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-item.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-storage",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-main",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-header",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-header h1",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-tools",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-tools .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-tools .select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-search",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-search:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-layout",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-layout .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-notice",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.grid",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-card",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.grid .file-card",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.grid .file-card:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.grid .file-card:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-thumb img",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.grid .file-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-info",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".card-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-time",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-created",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-created",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-card .rename-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-card:hover .file-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-more:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-card",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-card:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-info",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-created",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-empty-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-empty-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-empty-actions .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-drop",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-banner",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-banner .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#tokens:not([hidden]) ~ .file-banner",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#icons:not([hidden]) ~ .file-banner",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home > .col-resizer",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home-side",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".home-search",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".left-tabs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".left-tab",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".left-tab:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".left-tab.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".left-pane",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-search",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-search input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-search input:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-group-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-grid",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset-thumb svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".desc:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-row:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-row .link-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".licon.purple",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn-row .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn:disabled",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".warn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "fieldset.readonly",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "fieldset.readonly .field-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-def",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-def:first-of-type",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-name:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-name:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-type",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-input:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-toggle",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-row > span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-row input[type=checkbox]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".chips",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field.bindable:hover .var-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".paint-row:hover .var-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-btn:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-chip span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-chip:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".color-row .hex .var-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".field .var-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-inline",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-inline .var-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-inline.wide",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".text-case-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".add-limits",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".stroke-sides .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-btn.text-case",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-side",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-add",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-add:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-main",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-toolbar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-toolbar .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-name:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-name:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-table",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mode-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mode-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mode-name:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mode-name:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-name input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-name input:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-input:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-name input:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-input:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-type",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell .cell-input.hex",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-alias",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row:hover .cell-alias",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-bool",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-footer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-footer .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-empty .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-none",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ext-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-hint",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-name-text",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell.inherited .cell-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell.inherited .cell-bool",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell.inherited .alias-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell.overridden",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-reset",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-subgroup",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-project",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-chip .project-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-state",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-state.ok",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".move-notice",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-spacer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-item svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-intro",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-intro p",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".card-desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .card-desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .file-card:has(.card-desc)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".archive-intro",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-card.archived",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-card.archived .file-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".archive-restore",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.grid .archive-restore",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .archive-restore",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-card.archived:hover .archive-restore",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".nav-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".kind-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".kind-badge.sample",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".thumb-placeholder",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-files.list .thumb-placeholder",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-screen",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-screen > .screen-main",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-header",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-file-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-kind",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-header-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-editor",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-modal.inline",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-pins",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-pins[hidden]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-pin",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-pin.resolved",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-pin.open",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-popover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-popover .desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-target",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-msg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-meta",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-text",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-actions .spacer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comments-pane",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comments-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-row:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-row.resolved",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comment-on",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".right-head .tabs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".right-head .tab",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".right-head .tab.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-copy",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-tokens",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-head b",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-code .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-code code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".code-name-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".code-name-row .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-type",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".code-names",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".code-names .code-name-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-file",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-file-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-file-head .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-item .kind-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-change",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-change.added",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-change.removed",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".propose-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changesets",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changeset-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changeset-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changeset-date",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changeset-row a",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-status",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-status .dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-status.unsaved",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-status.offline",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-status[hidden]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-header .file-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-groups",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-groups .nav-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-groups .nav-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-group-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-main",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-toolbar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-toolbar .spacer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-toolbar .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-groups .nav-item.sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-groups .icons-style-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-style-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-style-title:not(:first-child)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-grid",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-section-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-tiles",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-tile",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-tile:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-tile.selected",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-tile svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-tile-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-empty p",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-inspector",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-inspector .inspector-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-inspector .desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-inspector .seg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-inspector .seg .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-inspector .btn.wide",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-source",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-source a",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".license-text",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-help",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-preview",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-sizes",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-multi",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icons-drop",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker.icon-picker",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-list",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-tiles",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-tile",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-tile:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-tile.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-tile.current",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-picker .btn.wide",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-actions .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-choice",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-choice-glyph",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-choice .icon-choice-glyph",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-groups",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-layer-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-layer-preview",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-layer-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".icon-layer-name span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-work",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-work .vars-table",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-search",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-search:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-actions .select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row[data-row]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row[data-row]:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row.selected",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".desc-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-inspector",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-row > span:first-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-chip:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn.danger",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn.danger:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mini-swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".mini-swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alpha-wrap",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".unit-wrap",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".unit-wrap .cell-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".easing-preview",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".easing-curve",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".shadow-sample",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".shadow-sample div",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-field .swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-input.alpha",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-cell",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-cell:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-sample",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-meta",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-mode",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-mode-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-sample-line",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-field",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".typo-field .select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-input.boxed",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".cell-alias.always",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-intro",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-footer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-footer .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-row .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-info",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".update-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".update-card",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".update-card .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".update-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".update-notes",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".diff-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".diff-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".diff-group.added .diff-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".diff-group.changed .diff-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".diff-group.removed .diff-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".head-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".head-actions .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".publish-status",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".status-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".status-chip.ok",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".status-chip.warn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-header-actions .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".tokens-header-actions .btn:disabled",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".orphan-note",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".link-btn:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".exposed-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-section",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".assets-group-title .lib-glyph",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-panel",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-actions .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-toggle",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-list",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-day",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row.named .history-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row.current .history-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row.publish .history-dot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-text",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row.auto .history-title",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-meta",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row:hover .history-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-row.active .history-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".history-foot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.previewing #toolbar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.previewing .file-banner",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-groups",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item.drop-into",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group.drop-into",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-caret",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "button.group-caret.open",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-count",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item:hover .group-more",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-rename",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-add.sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-tabs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-tab",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-tab:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-tab.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-file-bar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-file-bar b",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-side-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-side-head.first",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-side-head.lib-file",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-file-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-file-meta",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-side-head.lib-file .link-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-side-note",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".drag-handle",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-name.static",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ext-badge.lib",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip.missing",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ref-arrow",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ref-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ref-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ref-value .mini-swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-tag",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-cell.readonly",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".static-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".chain",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".chain-arrow",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".chain .link-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-search",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-list",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-head .lib-tag",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-item.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-item.current .token-picker-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-detach",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-picker-detach:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip .ref-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip .ref-leaf",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip .ref-lib",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip .ref-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".alias-chip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col-row .vars-col",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col.current",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-col.drop-into",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item.active .group-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item.drop-before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-group-item.drop-after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row.drop-before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-row.drop-after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vars-add.sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-heading",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-crumbs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-desc-inline",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".group-caret",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-footer .spacer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".using-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".lib-body .warn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-panel",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-head .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-desc",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-desc-edit",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-meta",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-up",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-swap",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-swap:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-swap svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-label svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-row .select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-row .prop-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-row .switch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-nested-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".swap-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".swap-btn .swap-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-icon.inst",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch span::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch input:checked + span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch input:checked + span::after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch input:focus-visible + span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row .prop-grip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row:hover .prop-grip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row:hover .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row:hover .prop-row-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row.drop-before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row.drop-after",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row.exposed",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-rename",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-expose",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-empty",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-pill",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-pill:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-pill svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-head .prop-pill",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-window",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-head .w-type",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-body .prop-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-seg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-seg button",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-seg button.on",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-foot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-pref",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-pref span:nth-child(2)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-values",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-value .prop-grip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-note",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-picker .comp-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-inline .prop-pill",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-inline .prop-pill span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bind-inline:not(.wide):has(.prop-pill) > .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".switch:has(input[data-mixed]) span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-head > .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-label-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-label-row .w-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-var",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-token",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".var-chip-like",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-token .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".token-ref",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-row:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".picker-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".picker-thumb svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-picker .token-picker-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset-thumb",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset-info",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset:hover .asset-info",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".asset-info:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".playground",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".playground .modal-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".playground .modal-head .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pg-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pg-preview",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pg-preview svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pg-side",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pg-side .prop-sub",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pg-body",
      "file": "styles.css",
      "condition": "@media (max-width: 640px)"
    },
    {
      "selector": ".pg-side",
      "file": "styles.css",
      "condition": "@media (max-width: 640px)"
    },
    {
      "selector": ".comp-icon.slot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-name.slot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".prop-icon.slot",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-tag",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-row .slot-ctrl",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-row .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-limit",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-limit.ok",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-limit.warn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-limits",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".w-limits label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inst-row.slot-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-row .inst-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-tag",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-status",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-section",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-ok",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-bad",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-row.ok .check-mark",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-row.bad .check-mark",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-diff",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-report",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report h3",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-filters",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-filters label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-cards",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-card",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-big",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-kinds",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-kinds > div",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-bar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-bar > span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-table",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-table td",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-table th",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-table th",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-table .num",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".report-columns",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".handoff-badge",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-status",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-docs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-docs-usage",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-wrap",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix th",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix td",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix th",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-check",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-check.ok",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-check.no",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-tick",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-next",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-summary",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".docs-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".docs-frames",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changelog-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changelog-entry",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changelog-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".changelog-entry ul",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".update-actions",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".visual-review",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-summary",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-touched a",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-head .btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-panes",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-panes figure",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-panes figcaption",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-img",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-img img",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-overlay",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-box",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".vr-panes",
      "file": "styles.css",
      "condition": "@media (max-width: 720px)"
    },
    {
      "selector": ".a11y-bar",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-bar select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-reason",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-what",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-sev",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-sev.error",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-sev.warning",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-row .prop-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".a11y-row input[type=\"checkbox\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-dir-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-dir-row .seg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".al-dir",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row .bp-num",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row .bp-num[data-bp-field$=\":maxW\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row .seg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row .seg .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row > .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".bp-row > .bp-hide",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ask-backdrop",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ask-modal",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ask-body",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ask-message",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".ask-input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn.primary.destructive",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".btn.primary.destructive:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-tip",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-tip[hidden]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-tip-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".rail-tip-detail",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only #toolbar [data-tool]:not([data-tool=\"move\"]):not([data-tool=\"hand\"])",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only #toolbar .tb-sep",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only #add-page",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-action=\"publish-components\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-publish]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-publish-status]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-undo]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-redo]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-import]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-import-empty]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .rail-tools [data-rail=\"tokens\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .rail-tools [data-rail=\"components\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .rail-tools [data-rail=\"icons\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .rail-tools [data-rail=\"linked\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .rail-tools [data-rail=\"import\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .rail-tools .rail-sep",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"add-mode\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"delete-collection\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"extend\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"move-to-file\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"new-collection\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"new-group\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only [data-act=\"new-variable\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .tokens-kind",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .file-name[readonly]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "body.view-only .file-name[readonly]:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".appearance-button",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".design-header",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".design-header .file-name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#design-appearance",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > #rail",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > #left",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > #canvas",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > #right",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#app > .col-resizer",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-header",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-header .appearance-button",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-banner",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": ".tokens-header .file-name",
      "file": "styles.css",
      "condition": "@media (max-width: 760px)"
    },
    {
      "selector": "select:not([multiple])",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".select",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "select:not([multiple]):hover:not(:disabled)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "select:not([multiple]):focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "select[aria-expanded=\"true\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "select:disabled",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item:hover:not(.disabled)",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item[aria-selected=\"true\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-item.disabled",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-check",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-shortcut",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-sep",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-project",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-group-heading",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-group-heading .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-name-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-name-label input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs nav",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs nav a",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs nav a:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs nav a[aria-current]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs article",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs article h2",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs article p",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs article li",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".welcome-docs",
      "file": "styles.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".welcome-docs nav",
      "file": "styles.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".welcome-docs article",
      "file": "styles.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".home-side > .nav-welcome",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row.active",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row .project-nav-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon-grid svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon-grid",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon-grid .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon-picker form",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon-picker label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-icon-picker [data-error]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-side .home-search",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#home-create",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#home-create svg:last-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-nav",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-main",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#home-files.project-file-sections",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-file-group",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-file-group h2",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-file-group h2 span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-file-group .home-files",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".file-source",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".home-heading",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-header-icon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-header-icon svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#home-title[contenteditable=\"plaintext-only\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#home-title[contenteditable=\"plaintext-only\"]:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".component-docs-disclosure",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".component-docs-disclosure summary",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".component-docs-disclosure summary:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".component-docs-disclosure[open] summary",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".component-docs-disclosure .comp-docs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-section",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "[data-theme=\"dark\"] .inspect-section",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-property",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-attribute",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-string",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-number",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-color",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-variable",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-keyword",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-function",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-element",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-comment",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".syntax-punctuation",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-props",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-property",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-property-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-property-head b",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-property-head code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-default code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-property .code-name-row",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-default",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-variant-values",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-variant-values code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-variant-values code.selected",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-tokens",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-head b",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-type",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-value",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-swatch",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspect-token-code .muted",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-docs",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section h4",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section p",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section p:last-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section ul",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section ol",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section li",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section li:last-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-role",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-status",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-role span:last-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-status",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".comp-doc-section code",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-description-area",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#project-description",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#project-description:focus",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#project-description::placeholder",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row:not(.active):hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row:not(.active):focus-within",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row .project-nav-item",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row .project-nav-item:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row .project-icon:hover",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".project-nav-row .project-icon:focus-visible",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.component-context > .name",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".layer-row.component-context > .licon",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limits",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limits-head",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limits-head>span:last-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-axis>span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control>span",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control>.field",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control .field-label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control>.icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control>.icon-btn svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".size-limit-control input",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraints-editor",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-axes",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-axes label",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-diagram",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-diagram:before",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-pin",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-pin[aria-pressed=true]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-center[aria-pressed=true]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-left",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-right",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-left",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-right",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-top",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-bottom",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-top",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".pin-bottom",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".constraint-center",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".inspector-help",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".save-state",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".save-state[data-state=\"error\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".save-state[data-state=\"unavailable\"]",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".save-state .icon-btn",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".recovery-entry",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".recovery-entry:last-child",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-check",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-mark",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-limit",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-tick",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".menu-check svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".check-mark svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".slot-limit svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": ".matrix-check svg",
      "file": "styles.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock[hidden]",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock header",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock header span",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock button",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock button:hover",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock button[aria-selected=\"true\"]",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock button:disabled",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-tabs",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-content",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-emulator",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-emulator[hidden]",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-status",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-guidance",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-guidance p",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-resizer",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-resizer:hover",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-resizer:focus-visible",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "body.terminal-open #app",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "body.terminal-open #tokens",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock .xterm-viewport",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-tabs",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-tabs button",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": ".terminal-status",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock button:focus-visible",
      "file": "src/terminal.css",
      "condition": ""
    },
    {
      "selector": "#terminal-dock header",
      "file": "src/terminal.css",
      "condition": "@media (max-width:640px)"
    },
    {
      "selector": "#terminal-dock header span",
      "file": "src/terminal.css",
      "condition": "@media (max-width:640px)"
    },
    {
      "selector": ".terminal-emulator",
      "file": "src/terminal.css",
      "condition": "@media (max-width:640px)"
    },
    {
      "selector": ".report-host",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-intro",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-intro h2",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-intro p",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-eyebrow",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-scope",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-scope>span:first-child",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-filters",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-filters label",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-filters .select",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-filters .report-check",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-cards",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-summary-card",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-summary-card h3",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-summary-card>strong",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-summary-card p",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-summary-card p span",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-section",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-section-title",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-section-title h3",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-section-title>span",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-section-title label",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind-grid",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind:hover",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind:focus-visible",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind>span:first-child",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind strong",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind small",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-bar",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-bar>span",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-details-toolbar",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-details-toolbar input",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-table-wrap",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-table",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-table th",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-table td",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-table td small",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-link",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-link:hover",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-note",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-empty",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-empty h3",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-empty p",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding h4",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding p",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding-type",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding-type.report-warning",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding>.btn",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-library-grid",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-library-grid>div",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-library-grid h4",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-method",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-method summary",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-method>div",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-method strong",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-notice",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-notice ul",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-cards",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-summary-card",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-summary-card>strong",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-kind-grid",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-library-grid",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-intro",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-details-toolbar",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-details-toolbar input",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-kind-grid",
      "file": "src/report.css",
      "condition": "@media(max-width:850px)"
    },
    {
      "selector": ".report-kind-grid",
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-finding",
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-filters label",
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-filters .select",
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-intro h2",
      "file": "src/report.css",
      "condition": "@media(max-width:480px)"
    },
    {
      "selector": ".report-host",
      "file": "src/report.css",
      "condition": "@media(max-width:640px)"
    },
    {
      "selector": ".report-section-title",
      "file": "src/report.css",
      "condition": "@media(max-width:640px)"
    },
    {
      "selector": ".report .report-note",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-scope",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-intro p:not(.report-eyebrow)",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-summary-card h3",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-summary-card p span",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-section-title>span",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-section-title label",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-kind>span:first-child",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-kind small",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-table th",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-table small",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-finding p",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-finding-type:not(.report-warning)",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-method>div",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .report-empty p",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report .muted",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-finding>div",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-table td:first-child",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-kind[aria-pressed=\"true\"]",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-active-filters",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-active-filters:empty",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-details-toolbar .report-note",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".report-filters>[data-report-reset-scope]",
      "file": "src/report.css",
      "condition": ""
    },
    {
      "selector": ".code-create-backdrop",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-head",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-head h2",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-head p",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-toolbar",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create label",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-toolbar select",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-body",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-source",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-source>label",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create textarea",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-actions",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-actions strong",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-preview",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-frame",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create iframe",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-notes",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-notes summary",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-notes ul",
      "file": "src/code-create.css",
      "condition": ""
    },
    {
      "selector": ".code-create-backdrop",
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create",
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-body",
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-source",
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-preview",
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    },
    {
      "selector": ".code-create-toolbar select",
      "file": "src/code-create.css",
      "condition": "@media(max-width:800px)"
    }
  ],
  "scoped": {
    ".inspect-section": {
      "--code-property": "#006da8",
      "--code-string": "#28723b",
      "--code-number": "#995400",
      "--code-variable": "#953c79",
      "--code-keyword": "#7140ae",
      "--code-function": "#825500",
      "--code-element": "#216b5b"
    },
    "[data-theme=\"dark\"] .inspect-section": {
      "--code-property": "#9cdcfe",
      "--code-string": "#ce9178",
      "--code-number": "#b5cea8",
      "--code-variable": "#e4abd3",
      "--code-keyword": "#c586c0",
      "--code-function": "#dcdcaa",
      "--code-element": "#4ec9b0"
    }
  },
  "motion": [
    {
      "selector": ".col-resizer::after",
      "property": "transition",
      "value": "background 0.1s"
    },
    {
      "selector": ".tb-btn::after",
      "property": "transition",
      "value": "opacity 0.1s"
    },
    {
      "selector": "#toast",
      "property": "transition",
      "value": "opacity 0.15s, transform 0.15s"
    },
    {
      "selector": ".group-caret",
      "property": "transition",
      "value": "transform 0.1s"
    },
    {
      "selector": ".switch span",
      "property": "transition",
      "value": "background 0.12s"
    },
    {
      "selector": ".switch span::after",
      "property": "transition",
      "value": "transform 0.12s"
    }
  ],
  "parts": {
    ".field-label": {
      "width": "24px",
      "flex": "none",
      "display": "grid",
      "place-items": "center",
      "color": "var(--muted)",
      "cursor": "ew-resize",
      "user-select": "none",
      "height": "100%"
    },
    ".field input": {
      "flex": "1",
      "min-width": "0",
      "border": "0",
      "background": "none",
      "outline": "none",
      "height": "100%",
      "padding-right": "6px",
      "padding-top": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    ".menu-check": {
      "width": "16px",
      "color": "var(--accent)",
      "flex": "none",
      "vertical-align": "middle"
    },
    ".menu-label": {
      "flex": "1"
    },
    ".menu-shortcut": {
      "color": "var(--muted)",
      "margin-left": "24px"
    },
    ".switch span": {
      "position": "absolute",
      "inset": "0",
      "border-radius": "8px",
      "background": "var(--control-track)",
      "transition": "background 0.12s"
    },
    ".switch span::after": {
      "content": "''",
      "position": "absolute",
      "top": "2px",
      "left": "2px",
      "width": "12px",
      "height": "12px",
      "border-radius": "50%",
      "background": "var(--on-accent)",
      "box-shadow": "0 1px 2px rgba(0,0,0,0.2)",
      "transition": "transform 0.12s"
    },
    ".switch input:checked + span": {
      "background": "#0D99FF"
    },
    ".switch input:checked + span::after": {
      "transform": "translateX(12px)"
    },
    ".switch input:focus-visible + span": {
      "box-shadow": "0 0 0 2px var(--accent-soft)"
    }
  },
  "palette": [
    "#00000026",
    "#006da8",
    "#0B6BCB",
    "#0D99FF",
    "#0F7A40",
    "#0b8ae6",
    "#0d99ff",
    "#14ae5c",
    "#153D59",
    "#172C3B",
    "#1A1A1A",
    "#1D3629",
    "#1e1e1e",
    "#216b5b",
    "#242424",
    "#28723b",
    "#2A2A2A",
    "#30223F",
    "#333333",
    "#342445",
    "#3D2323",
    "#3D2538",
    "#3D2D1C",
    "#444444",
    "#47315F",
    "#4ec9b0",
    "#555555",
    "#6B5A8E",
    "#7140ae",
    "#73D79E",
    "#7AC5FF",
    "#7B2EE6",
    "#825500",
    "#8c8c8c",
    "#953c79",
    "#9747FF",
    "#9747ff",
    "#995400",
    "#9cdcfe",
    "#AAAAAA",
    "#B5197F",
    "#B54708",
    "#C3B0E0",
    "#C4320A",
    "#C59EFF",
    "#CFACFF",
    "#D9D9D9",
    "#E4D4FF",
    "#E7F7EE",
    "#F0E6FF",
    "#F5EFFF",
    "#F5F5F5",
    "#FAFAFA",
    "#FDE7F6",
    "#FF9A80",
    "#FF9BDD",
    "#FFBC6C",
    "#FFE8E8",
    "#FFF4E5",
    "#FFFFFF",
    "#b3b3b3",
    "#b5cea8",
    "#b9a3e8",
    "#c4320a",
    "#c586c0",
    "#c7c7c7",
    "#ce9178",
    "#d9d9d9",
    "#dcdcaa",
    "#e03e1a",
    "#e4abd3",
    "#e5f4ff",
    "#e6e6e6",
    "#e91e8c",
    "#f24822",
    "#f2f9ff",
    "#f5f5f5",
    "#ffd8a8",
    "#fff",
    "#ffffff"
  ],
  "foundations": [
    {
      "font-size": "11px"
    },
    {
      "height": "100%"
    },
    {
      "padding": "0",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "height": "100vh"
    },
    {
      "width": "8px"
    },
    {
      "width": "2px"
    },
    {
      "gap": "4px",
      "padding": "8px 0",
      "padding-top": "8px",
      "padding-right": "0px",
      "padding-bottom": "8px",
      "padding-left": "0px"
    },
    {
      "width": "32px",
      "height": "32px",
      "border-radius": "6px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "gap": "4px"
    },
    {
      "width": "20px",
      "height": "1px"
    },
    {
      "width": "7px",
      "height": "7px",
      "border-radius": "50%",
      "box-shadow": "0 0 0 2px var(--panel)"
    },
    {
      "height": "14px",
      "padding": "0 3px",
      "border-radius": "7px",
      "font-size": "9px",
      "font-weight": "600",
      "box-shadow": "0 0 0 2px var(--panel)",
      "padding-top": "0px",
      "padding-right": "3px",
      "padding-bottom": "0px",
      "padding-left": "3px"
    },
    {
      "min-height": "0"
    },
    {
      "gap": "4px",
      "padding": "8px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "border-radius": "4px",
      "padding": "5px 6px",
      "font-weight": "600",
      "font-size": "12px",
      "padding-top": "5px",
      "padding-right": "6px",
      "padding-bottom": "5px",
      "padding-left": "6px"
    },
    {
      "font-size": "12px",
      "font-weight": "600"
    },
    {
      "height": "32px",
      "padding": "0 8px 0 16px",
      "font-weight": "600",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "16px"
    },
    {
      "padding-bottom": "6px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "height": "28px",
      "padding": "0 8px 0 8px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "padding-left": "24px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "gap": "4px",
      "height": "28px",
      "padding": "0 8px 0 4px",
      "border-radius": "5px",
      "font-weight": "600",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "4px"
    },
    {
      "font-size": "11px",
      "font-weight": "600"
    },
    {
      "width": "16px",
      "height": "16px"
    },
    {
      "font-weight": "400",
      "font-size": "11px"
    },
    {
      "height": "2px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "height": "2px",
      "font-size": "11px",
      "font-weight": "600"
    },
    {
      "box-shadow": "inset 0 0 0 2px var(--accent)",
      "font-size": "11px",
      "font-weight": "600"
    },
    {
      "width": "calc(100% - 32px)"
    },
    {
      "padding": "4px 16px",
      "padding-top": "4px",
      "padding-right": "16px",
      "padding-bottom": "4px",
      "padding-left": "16px"
    },
    {
      "width": "16px"
    },
    {
      "font-weight": "600",
      "font-size": "11px"
    },
    {
      "padding-bottom": "24px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "height": "28px",
      "padding-left": "0px",
      "padding-right": "6px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-bottom": "0px"
    },
    {
      "box-shadow": "inset 0 0 0 1px var(--accent)",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "gap": "2px"
    },
    {
      "box-shadow": "inset 0 0 0 2px var(--accent)",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "padding": "8px 16px",
      "padding-top": "8px",
      "padding-right": "16px",
      "padding-bottom": "8px",
      "padding-left": "16px"
    },
    {
      "height": "22px",
      "border-radius": "3px",
      "padding": "0 4px",
      "padding-top": "0px",
      "padding-right": "4px",
      "padding-bottom": "0px",
      "padding-left": "4px"
    },
    {
      "width": "24px",
      "height": "24px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "box-shadow": "inset 0 0 0 1px var(--border)",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "height": "41px",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "padding": "6px 8px",
      "border-radius": "5px",
      "font-weight": "600",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "gap": "6px",
      "padding": "6px 8px",
      "border-radius": "5px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "padding-bottom": "32px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "padding": "8px 8px 12px 16px",
      "gap": "6px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "height": "24px",
      "font-weight": "600"
    },
    {
      "gap": "0",
      "padding": "8px 8px 8px 12px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "12px"
    },
    {
      "gap": "8px",
      "padding-right": "24px",
      "padding-top": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "height": "28px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "width": "24px",
      "height": "100%"
    },
    {
      "height": "100%",
      "padding-right": "6px",
      "padding-top": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "font-size": "9px",
      "font-weight": "600"
    },
    {
      "width": "10px",
      "height": "10px",
      "border-radius": "2px"
    },
    {
      "gap": "0",
      "height": "28px",
      "border-radius": "5px",
      "padding-left": "4px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "box-shadow": "inset 0 0 0 1px var(--accent)"
    },
    {
      "width": "18px",
      "height": "18px",
      "border-radius": "3px",
      "box-shadow": "inset 0 0 0 1px rgba(0,0,0,0.1)"
    },
    {
      "width": "30px",
      "height": "30px"
    },
    {
      "width": "34px",
      "height": "100%"
    },
    {
      "padding": "0 6px 0 1px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "1px"
    },
    {
      "padding": "4px 0",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "4px",
      "padding-left": "0px"
    },
    {
      "gap": "6px",
      "padding-bottom": "8px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "width": "min(760px, calc(100vw - 32px))"
    },
    {
      "padding": "24px 4px",
      "padding-top": "24px",
      "padding-right": "4px",
      "padding-bottom": "24px",
      "padding-left": "4px"
    },
    {
      "font-weight": "600",
      "padding": "4px 0",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "4px",
      "padding-left": "0px"
    },
    {
      "gap": "10px",
      "min-height": "36px",
      "padding": "4px 0",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "4px",
      "padding-left": "0px"
    },
    {
      "gap": "6px"
    },
    {
      "padding": "1px 5px",
      "border-radius": "3px",
      "font-size": "10px",
      "font-weight": "500",
      "padding-top": "1px",
      "padding-right": "5px",
      "padding-bottom": "1px",
      "padding-left": "5px"
    },
    {
      "gap": "6px",
      "height": "28px"
    },
    {
      "width": "18px",
      "height": "18px",
      "font-size": "10px",
      "font-weight": "600"
    },
    {
      "height": "20px",
      "padding": "0 6px",
      "border-radius": "4px",
      "font-size": "11px",
      "font-weight": "500",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "gap": "4px",
      "padding": "4px 0 6px",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "6px",
      "padding-left": "0px"
    },
    {
      "gap": "6px 10px"
    },
    {
      "gap": "4px",
      "height": "28px"
    },
    {
      "width": "56px"
    },
    {
      "height": "26px",
      "border-radius": "5px",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "width": "auto",
      "padding": "0 6px 0 8px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "padding-top": "8px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "gap": "8px",
      "height": "24px",
      "padding": "2px 0",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "2px",
      "padding-right": "0px",
      "padding-bottom": "2px",
      "padding-left": "0px"
    },
    {
      "height": "28px",
      "border-radius": "6px",
      "padding": "0 6px",
      "padding-left": "8px",
      "padding-right": "28px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-bottom": "0px"
    },
    {
      "border-radius": "5px",
      "padding": "2px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "2px",
      "padding-right": "2px",
      "padding-bottom": "2px",
      "padding-left": "2px"
    },
    {
      "width": "auto",
      "height": "24px"
    },
    {
      "box-shadow": "0 0 0 1px var(--border)"
    },
    {
      "height": "62px",
      "border-radius": "5px",
      "padding": "3px",
      "padding-top": "3px",
      "padding-right": "3px",
      "padding-bottom": "3px",
      "padding-left": "3px"
    },
    {
      "border-radius": "3px"
    },
    {
      "width": "2px",
      "height": "2px",
      "border-radius": "1px"
    },
    {
      "width": "4px",
      "height": "10px"
    },
    {
      "width": "10px",
      "height": "4px"
    },
    {
      "height": "30px",
      "padding": "0 8px",
      "border-radius": "5px",
      "font-weight": "500",
      "gap": "4px",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "font-size": "11px",
      "font-weight": "500"
    },
    {
      "padding": "7px 8px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "7px",
      "padding-right": "8px",
      "padding-bottom": "7px",
      "padding-left": "8px"
    },
    {
      "width": "100%",
      "height": "100%"
    },
    {
      "gap": "2px",
      "padding": "4px",
      "border-radius": "13px",
      "box-shadow": "0 0 0 0.5px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08)",
      "padding-top": "4px",
      "padding-right": "4px",
      "padding-bottom": "4px",
      "padding-left": "4px"
    },
    {
      "width": "32px",
      "height": "32px",
      "border-radius": "8px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "padding": "4px 8px",
      "border-radius": "4px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "4px",
      "padding-right": "8px",
      "padding-bottom": "4px",
      "padding-left": "8px"
    },
    {
      "width": "1px",
      "height": "20px"
    },
    {
      "padding": "4px",
      "border-radius": "8px",
      "box-shadow": "0 8px 24px #00000026",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "4px",
      "padding-right": "4px",
      "padding-bottom": "4px",
      "padding-left": "4px"
    },
    {
      "width": "100%",
      "height": "30px",
      "padding": "6px 8px",
      "border-radius": "4px",
      "min-height": "30px",
      "gap": "8px",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "height": "1px"
    },
    {
      "width": "min(720px, calc(100vw - 32px))",
      "border-radius": "12px",
      "box-shadow": "0 12px 48px rgba(0,0,0,0.25)"
    },
    {
      "padding": "12px 12px 12px 16px",
      "font-weight": "600",
      "font-size": "13px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "padding": "8px 16px 16px",
      "padding-top": "8px",
      "padding-right": "16px",
      "padding-bottom": "16px",
      "padding-left": "16px"
    },
    {
      "font-weight": "600"
    },
    {
      "gap": "12px",
      "padding": "4px 0",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "4px",
      "padding-left": "0px"
    },
    {
      "padding": "8px 14px",
      "border-radius": "6px",
      "font-size": "12px",
      "padding-top": "8px",
      "padding-right": "14px",
      "padding-bottom": "8px",
      "padding-left": "14px"
    },
    {
      "padding": "12px 8px",
      "gap": "12px",
      "padding-top": "12px",
      "padding-right": "8px",
      "padding-bottom": "12px",
      "padding-left": "8px"
    },
    {
      "gap": "8px",
      "padding": "4px 8px",
      "font-size": "13px",
      "font-weight": "600",
      "padding-top": "4px",
      "padding-right": "8px",
      "padding-bottom": "4px",
      "padding-left": "8px"
    },
    {
      "gap": "2px",
      "min-height": "0"
    },
    {
      "height": "32px",
      "padding": "0 10px",
      "border-radius": "6px",
      "font-size": "12px",
      "gap": "8px",
      "padding-top": "0px",
      "padding-right": "10px",
      "padding-bottom": "0px",
      "padding-left": "10px"
    },
    {
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "gap": "16px",
      "padding": "16px 24px",
      "padding-right": "64px",
      "padding-top": "16px",
      "padding-bottom": "16px",
      "padding-left": "24px"
    },
    {
      "font-size": "16px",
      "font-weight": "600"
    },
    {
      "gap": "8px"
    },
    {
      "height": "32px",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "height": "32px"
    },
    {
      "height": "32px",
      "width": "200px",
      "border-radius": "6px",
      "padding": "0 10px",
      "padding-top": "0px",
      "padding-right": "10px",
      "padding-bottom": "0px",
      "padding-left": "10px"
    },
    {
      "padding": "2px",
      "padding-top": "2px",
      "padding-right": "2px",
      "padding-bottom": "2px",
      "padding-left": "2px"
    },
    {
      "width": "28px",
      "height": "26px"
    },
    {
      "padding": "8px 8px 8px 12px",
      "border-radius": "6px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "12px"
    },
    {
      "padding": "24px",
      "padding-top": "24px",
      "padding-right": "24px",
      "padding-bottom": "24px",
      "padding-left": "24px"
    },
    {
      "gap": "24px"
    },
    {
      "border-radius": "8px"
    },
    {
      "box-shadow": "0 0 0 1px var(--accent)"
    },
    {
      "padding": "10px 12px 12px",
      "gap": "2px",
      "padding-top": "10px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "font-size": "12px",
      "font-weight": "500"
    },
    {
      "height": "24px",
      "font-size": "12px"
    },
    {
      "box-shadow": "0 1px 3px rgba(0,0,0,0.15)"
    },
    {
      "height": "56px",
      "padding": "0 8px",
      "gap": "12px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "width": "56px",
      "height": "42px",
      "border-radius": "4px"
    },
    {
      "width": "120px"
    },
    {
      "box-shadow": "none"
    },
    {
      "padding": "80px 24px",
      "padding-top": "80px",
      "padding-right": "24px",
      "padding-bottom": "80px",
      "padding-left": "24px"
    },
    {
      "height": "32px",
      "padding": "0 14px",
      "padding-top": "0px",
      "padding-right": "14px",
      "padding-bottom": "0px",
      "padding-left": "14px"
    },
    {
      "border-radius": "12px",
      "font-size": "14px"
    },
    {
      "gap": "12px",
      "padding": "6px 6px 6px 14px",
      "border-radius": "8px",
      "box-shadow": "0 4px 16px rgba(0,0,0,0.2)",
      "padding-top": "6px",
      "padding-right": "6px",
      "padding-bottom": "6px",
      "padding-left": "14px"
    },
    {
      "height": "26px"
    },
    {
      "gap": "4px",
      "padding": "6px 8px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "padding": "6px 8px",
      "border-radius": "5px",
      "font-weight": "500",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "padding": "8px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "width": "100%",
      "height": "28px",
      "border-radius": "5px",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "padding": "4px 8px 12px",
      "padding-top": "4px",
      "padding-right": "8px",
      "padding-bottom": "12px",
      "padding-left": "8px"
    },
    {
      "font-weight": "600",
      "padding": "4px 4px 8px",
      "padding-top": "4px",
      "padding-right": "4px",
      "padding-bottom": "8px",
      "padding-left": "4px"
    },
    {
      "border-radius": "6px"
    },
    {
      "height": "72px",
      "padding": "8px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "padding": "6px 8px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "width": "calc(100% - 24px)",
      "min-height": "44px",
      "border-radius": "5px",
      "padding": "6px 8px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "gap": "6px",
      "height": "28px",
      "padding": "0 8px",
      "border-radius": "5px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "font-weight": "500"
    },
    {
      "height": "28px"
    },
    {
      "border-radius": "5px",
      "padding": "6px 8px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "padding": "0",
      "gap": "6px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "gap": "4px",
      "padding": "6px 0",
      "padding-top": "6px",
      "padding-right": "0px",
      "padding-bottom": "6px",
      "padding-left": "0px"
    },
    {
      "height": "24px",
      "border-radius": "4px",
      "padding": "0 4px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "4px",
      "padding-bottom": "0px",
      "padding-left": "4px"
    },
    {
      "font-size": "10px",
      "font-weight": "600"
    },
    {
      "height": "28px",
      "border-radius": "5px",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "gap": "6px",
      "height": "24px"
    },
    {
      "gap": "8px",
      "min-height": "28px"
    },
    {
      "padding": "2px 6px",
      "border-radius": "4px",
      "padding-top": "2px",
      "padding-right": "6px",
      "padding-bottom": "2px",
      "padding-left": "6px"
    },
    {
      "width": "20px",
      "height": "20px"
    },
    {
      "gap": "4px",
      "height": "20px",
      "padding": "0 6px",
      "border-radius": "4px",
      "font-weight": "500",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "font-weight": "500",
      "font-size": "11px"
    },
    {
      "width": "28px"
    },
    {
      "width": "30px",
      "font-size": "11px",
      "font-weight": "500"
    },
    {
      "width": "min(1100px, calc(100vw - 32px))",
      "height": "min(720px, 86vh)"
    },
    {
      "padding": "8px",
      "gap": "2px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "height": "30px",
      "padding": "0 10px",
      "border-radius": "6px",
      "padding-top": "0px",
      "padding-right": "10px",
      "padding-bottom": "0px",
      "padding-left": "10px"
    },
    {
      "gap": "8px",
      "padding": "10px 16px",
      "padding-top": "10px",
      "padding-right": "16px",
      "padding-bottom": "10px",
      "padding-left": "16px"
    },
    {
      "font-weight": "600",
      "font-size": "13px",
      "border-radius": "4px",
      "padding": "4px 6px",
      "padding-top": "4px",
      "padding-right": "6px",
      "padding-bottom": "4px",
      "padding-left": "6px"
    },
    {
      "padding": "0 8px 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "gap": "8px",
      "min-height": "36px",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "border-radius": "4px",
      "padding": "3px 4px",
      "font-weight": "600",
      "padding-top": "3px",
      "padding-right": "4px",
      "padding-bottom": "3px",
      "padding-left": "4px"
    },
    {
      "padding": "12px 8px 4px",
      "font-weight": "600",
      "border-radius": "4px",
      "padding-top": "12px",
      "padding-right": "8px",
      "padding-bottom": "4px",
      "padding-left": "8px"
    },
    {
      "height": "26px",
      "border-radius": "4px",
      "padding": "0 6px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "width": "22px",
      "height": "22px"
    },
    {
      "height": "24px",
      "padding": "0 8px",
      "border-radius": "4px",
      "gap": "5px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "padding": "10px 16px",
      "padding-top": "10px",
      "padding-right": "16px",
      "padding-bottom": "10px",
      "padding-left": "16px"
    },
    {
      "padding": "16px 8px",
      "padding-top": "16px",
      "padding-right": "8px",
      "padding-bottom": "16px",
      "padding-left": "8px"
    },
    {
      "padding": "2px 8px",
      "border-radius": "10px",
      "font-size": "11px",
      "padding-top": "2px",
      "padding-right": "8px",
      "padding-bottom": "2px",
      "padding-left": "8px"
    },
    {
      "padding": "0 6px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "border-radius": "6px",
      "padding": "2px 4px",
      "padding-top": "2px",
      "padding-right": "4px",
      "padding-bottom": "2px",
      "padding-left": "4px"
    },
    {
      "font-weight": "500",
      "padding": "8px 4px 6px",
      "padding-top": "8px",
      "padding-right": "4px",
      "padding-bottom": "6px",
      "padding-left": "4px"
    },
    {
      "padding": "0",
      "gap": "2px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "gap": "6px",
      "padding": "6px 8px",
      "border-radius": "6px",
      "font-size": "12px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "font-size": "10px",
      "padding": "1px 6px",
      "border-radius": "8px",
      "padding-top": "1px",
      "padding-right": "6px",
      "padding-bottom": "1px",
      "padding-left": "6px"
    },
    {
      "padding": "12px 10px 4px",
      "font-size": "11px",
      "font-weight": "600",
      "padding-top": "12px",
      "padding-right": "10px",
      "padding-bottom": "4px",
      "padding-left": "10px"
    },
    {
      "height": "12px"
    },
    {
      "height": "72px"
    },
    {
      "gap": "12px"
    },
    {
      "height": "26px",
      "padding": "0 10px",
      "padding-top": "0px",
      "padding-right": "10px",
      "padding-bottom": "0px",
      "padding-left": "10px"
    },
    {
      "padding": "0 6px",
      "border-radius": "4px",
      "font-weight": "600",
      "font-size": "10px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "gap": "8px",
      "height": "48px",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "width": "auto",
      "height": "auto",
      "border-radius": "0",
      "box-shadow": "none"
    },
    {
      "height": "26px",
      "padding": "0 7px",
      "border-radius": "13px 13px 13px 2px",
      "box-shadow": "0 2px 6px rgba(0,0,0,0.25)",
      "padding-top": "0px",
      "padding-right": "7px",
      "padding-bottom": "0px",
      "padding-left": "7px"
    },
    {
      "width": "280px",
      "padding": "10px 12px",
      "border-radius": "10px",
      "box-shadow": "0 8px 32px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)",
      "gap": "8px",
      "padding-top": "10px",
      "padding-right": "12px",
      "padding-bottom": "10px",
      "padding-left": "12px"
    },
    {
      "width": "100%"
    },
    {
      "gap": "6px",
      "font-size": "11px"
    },
    {
      "padding": "8px",
      "gap": "6px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "padding": "0 4px",
      "padding-top": "0px",
      "padding-right": "4px",
      "padding-bottom": "0px",
      "padding-left": "4px"
    },
    {
      "padding": "8px",
      "border-radius": "8px",
      "gap": "3px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "padding": "4px 8px",
      "border-radius": "5px",
      "font-weight": "600",
      "padding-top": "4px",
      "padding-right": "8px",
      "padding-bottom": "4px",
      "padding-left": "8px"
    },
    {
      "padding": "12px",
      "border-radius": "6px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "padding": "8px 0",
      "padding-top": "8px",
      "padding-right": "0px",
      "padding-bottom": "8px",
      "padding-left": "0px"
    },
    {
      "padding": "10px",
      "border-radius": "6px",
      "padding-top": "10px",
      "padding-right": "10px",
      "padding-bottom": "10px",
      "padding-left": "10px"
    },
    {
      "gap": "10px"
    },
    {
      "gap": "8px",
      "font-size": "11px",
      "padding": "3px 0",
      "padding-top": "3px",
      "padding-right": "0px",
      "padding-bottom": "3px",
      "padding-left": "0px"
    },
    {
      "width": "auto"
    },
    {
      "width": "min(640px, calc(100vw - 32px))"
    },
    {
      "border-radius": "8px",
      "padding": "6px 10px 8px",
      "padding-top": "6px",
      "padding-right": "10px",
      "padding-bottom": "8px",
      "padding-left": "10px"
    },
    {
      "gap": "8px",
      "padding": "3px 0",
      "padding-top": "3px",
      "padding-right": "0px",
      "padding-bottom": "3px",
      "padding-left": "0px"
    },
    {
      "height": "30px",
      "min-height": "0"
    },
    {
      "gap": "10px",
      "padding": "6px 8px",
      "border-radius": "6px",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "gap": "6px",
      "height": "24px",
      "padding": "0 8px",
      "border-radius": "12px",
      "font-size": "11px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "width": "6px",
      "height": "6px",
      "border-radius": "3px"
    },
    {
      "width": "var(--icons-groups-w, 200px)",
      "padding": "12px 8px",
      "gap": "2px",
      "padding-top": "12px",
      "padding-right": "8px",
      "padding-bottom": "12px",
      "padding-left": "8px"
    },
    {
      "padding": "0 10px 4px",
      "font-size": "11px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "10px",
      "padding-bottom": "4px",
      "padding-left": "10px"
    },
    {
      "height": "30px",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "padding-left": "22px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "padding-top": "12px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "font-size": "14px",
      "font-weight": "600",
      "padding": "16px 0 0",
      "padding-top": "16px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "min-height": "0",
      "padding": "8px 16px 32px",
      "padding-top": "8px",
      "padding-right": "16px",
      "padding-bottom": "32px",
      "padding-left": "16px"
    },
    {
      "font-weight": "600",
      "padding": "14px 0 8px",
      "padding-top": "14px",
      "padding-right": "0px",
      "padding-bottom": "8px",
      "padding-left": "0px"
    },
    {
      "gap": "8px",
      "height": "84px",
      "padding": "8px 4px",
      "border-radius": "8px",
      "padding-top": "8px",
      "padding-right": "4px",
      "padding-bottom": "8px",
      "padding-left": "4px"
    },
    {
      "font-size": "10px"
    },
    {
      "width": "var(--icons-inspector-w, 260px)",
      "padding": "12px 0 24px 16px",
      "padding-top": "12px",
      "padding-right": "0px",
      "padding-bottom": "24px",
      "padding-left": "16px"
    },
    {
      "min-height": "0",
      "height": "28px"
    },
    {
      "font-size": "12px"
    },
    {
      "padding": "8px 10px",
      "border-radius": "6px",
      "padding-top": "8px",
      "padding-right": "10px",
      "padding-bottom": "8px",
      "padding-left": "10px"
    },
    {
      "height": "160px",
      "border-radius": "8px"
    },
    {
      "gap": "16px"
    },
    {
      "width": "296px"
    },
    {
      "gap": "2px",
      "padding": "0 6px 6px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "6px",
      "padding-left": "6px"
    },
    {
      "height": "32px",
      "border-radius": "5px"
    },
    {
      "padding": "6px 10px",
      "font-size": "11px",
      "min-height": "16px",
      "padding-top": "6px",
      "padding-right": "10px",
      "padding-bottom": "6px",
      "padding-left": "10px"
    },
    {
      "width": "calc(100% - 16px)"
    },
    {
      "padding-left": "16px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "width": "32px",
      "height": "32px",
      "border-radius": "6px"
    },
    {
      "height": "28px",
      "width": "180px",
      "border-radius": "5px",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "box-shadow": "inset 2px 0 0 var(--accent)"
    },
    {
      "width": "var(--vars-inspector-w, 280px)",
      "padding": "14px 16px",
      "gap": "6px",
      "padding-top": "14px",
      "padding-right": "16px",
      "padding-bottom": "14px",
      "padding-left": "16px"
    },
    {
      "gap": "8px",
      "font-weight": "600",
      "font-size": "13px"
    },
    {
      "gap": "8px",
      "min-height": "24px"
    },
    {
      "padding": "2px 8px",
      "border-radius": "4px",
      "padding-top": "2px",
      "padding-right": "8px",
      "padding-bottom": "2px",
      "padding-left": "8px"
    },
    {
      "width": "14px",
      "height": "14px",
      "border-radius": "3px",
      "box-shadow": "inset 0 0 0 1px rgba(0,0,0,0.1)"
    },
    {
      "padding-left": "4px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "height": "72px",
      "border-radius": "6px"
    },
    {
      "width": "64px",
      "height": "36px",
      "border-radius": "6px"
    },
    {
      "width": "34px",
      "padding": "0 2px",
      "padding-top": "0px",
      "padding-right": "2px",
      "padding-bottom": "0px",
      "padding-left": "2px"
    },
    {
      "gap": "8px",
      "height": "30px",
      "padding": "0 6px",
      "border-radius": "5px",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "font-size": "18px"
    },
    {
      "padding": "6px 0 8px",
      "padding-top": "6px",
      "padding-right": "0px",
      "padding-bottom": "8px",
      "padding-left": "0px"
    },
    {
      "gap": "6px",
      "min-height": "28px"
    },
    {
      "width": "min(560px, calc(100vw - 32px))"
    },
    {
      "padding": "12px 16px 16px",
      "gap": "8px",
      "padding-top": "12px",
      "padding-right": "16px",
      "padding-bottom": "16px",
      "padding-left": "16px"
    },
    {
      "gap": "8px",
      "padding": "12px 16px",
      "padding-top": "12px",
      "padding-right": "16px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "gap": "10px",
      "padding": "8px",
      "border-radius": "8px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "8px"
    },
    {
      "padding": "16px 0",
      "padding-top": "16px",
      "padding-right": "0px",
      "padding-bottom": "16px",
      "padding-left": "0px"
    },
    {
      "border-radius": "8px",
      "padding": "10px 12px",
      "gap": "6px",
      "padding-top": "10px",
      "padding-right": "12px",
      "padding-bottom": "10px",
      "padding-left": "12px"
    },
    {
      "height": "28px",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "gap": "1px"
    },
    {
      "height": "28px",
      "padding": "0 10px",
      "font-weight": "500",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "10px",
      "padding-bottom": "0px",
      "padding-left": "10px"
    },
    {
      "padding": "3px 8px",
      "border-radius": "10px",
      "font-size": "11px",
      "padding-top": "3px",
      "padding-right": "8px",
      "padding-bottom": "3px",
      "padding-left": "8px"
    },
    {
      "font-weight": "600",
      "padding": "0 2px",
      "padding-top": "0px",
      "padding-right": "2px",
      "padding-bottom": "0px",
      "padding-left": "2px"
    },
    {
      "gap": "6px",
      "padding-top": "8px",
      "font-weight": "600",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "width": "var(--right-w, 240px)",
      "box-shadow": "-4px 0 16px rgba(0,0,0,0.06)"
    },
    {
      "height": "48px",
      "padding": "0 8px 0 16px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "16px"
    },
    {
      "padding": "12px 16px",
      "gap": "10px",
      "padding-top": "12px",
      "padding-right": "16px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "padding": "4px 0 16px",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "16px",
      "padding-left": "0px"
    },
    {
      "padding": "12px 16px 4px",
      "font-weight": "600",
      "padding-top": "12px",
      "padding-right": "16px",
      "padding-bottom": "4px",
      "padding-left": "16px"
    },
    {
      "gap": "10px",
      "padding": "8px 8px 8px 16px",
      "padding-top": "8px",
      "padding-right": "8px",
      "padding-bottom": "8px",
      "padding-left": "16px"
    },
    {
      "width": "8px",
      "height": "8px",
      "border-radius": "50%"
    },
    {
      "font-weight": "400"
    },
    {
      "padding": "1px 5px",
      "border-radius": "4px",
      "font-size": "10px",
      "font-weight": "500",
      "padding-top": "1px",
      "padding-right": "5px",
      "padding-bottom": "1px",
      "padding-left": "5px"
    },
    {
      "width": "24px",
      "height": "24px"
    },
    {
      "padding": "12px 16px",
      "padding-top": "12px",
      "padding-right": "16px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "gap": "4px",
      "height": "26px",
      "padding-right": "4px",
      "border-radius": "6px",
      "padding-top": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "box-shadow": "inset 0 0 0 2px var(--accent)"
    },
    {
      "width": "14px",
      "font-size": "0",
      "height": "16px"
    },
    {
      "height": "22px",
      "border-radius": "4px",
      "padding": "0 4px",
      "padding-top": "0px",
      "padding-right": "4px",
      "padding-bottom": "0px",
      "padding-left": "4px"
    },
    {
      "height": "26px",
      "padding-left": "44px",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "height": "30px",
      "padding": "0",
      "font-size": "12px",
      "font-weight": "500",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "gap": "8px",
      "font-size": "11px"
    },
    {
      "font-weight": "600",
      "font-size": "10px"
    },
    {
      "gap": "2px 6px",
      "padding-top": "12px",
      "font-size": "11px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "font-weight": "600",
      "gap": "4px"
    },
    {
      "gap": "4px",
      "font-size": "10px"
    },
    {
      "width": "11px",
      "height": "11px"
    },
    {
      "padding": "0 5px",
      "border-radius": "3px",
      "font-size": "10px",
      "font-weight": "500",
      "padding-top": "0px",
      "padding-right": "5px",
      "padding-bottom": "0px",
      "padding-left": "5px"
    },
    {
      "width": "320px",
      "border-radius": "8px",
      "box-shadow": "0 8px 32px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)"
    },
    {
      "height": "36px",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "padding": "8px 12px 2px",
      "font-weight": "600",
      "gap": "4px",
      "padding-top": "8px",
      "padding-right": "12px",
      "padding-bottom": "2px",
      "padding-left": "12px"
    },
    {
      "gap": "8px",
      "width": "100%",
      "height": "28px",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "gap": "5px",
      "font-size": "10px"
    },
    {
      "padding": "12px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "padding-left": "2px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "box-shadow": "inset 0 2px 0 var(--accent)"
    },
    {
      "box-shadow": "inset 0 -2px 0 var(--accent)"
    },
    {
      "padding": "10px 8px 6px",
      "gap": "6px",
      "padding-top": "10px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    {
      "gap": "4px",
      "font-weight": "600",
      "font-size": "12px"
    },
    {
      "width": "100%",
      "min-height": "28px"
    },
    {
      "font-weight": "500",
      "padding": "0 8px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "gap": "6px",
      "height": "28px",
      "padding": "0 6px",
      "border-radius": "5px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "6px"
    },
    {
      "gap": "6px",
      "width": "100%"
    },
    {
      "width": "28px",
      "height": "16px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "width": "12px",
      "height": "12px",
      "border-radius": "50%",
      "box-shadow": "0 1px 2px rgba(0,0,0,0.2)"
    },
    {
      "box-shadow": "0 0 0 2px var(--accent-soft)"
    },
    {
      "gap": "6px",
      "height": "30px",
      "padding": "0 2px 0 0",
      "border-radius": "5px",
      "padding-top": "0px",
      "padding-right": "2px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "width": "10px"
    },
    {
      "padding-left": "12px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "height": "24px"
    },
    {
      "gap": "4px",
      "height": "22px",
      "padding": "0 7px",
      "border-radius": "11px",
      "font-weight": "500",
      "padding-top": "0px",
      "padding-right": "7px",
      "padding-bottom": "0px",
      "padding-left": "7px"
    },
    {
      "width": "264px",
      "border-radius": "10px",
      "box-shadow": "0 10px 36px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)"
    },
    {
      "gap": "6px",
      "height": "40px",
      "padding": "0 6px 0 12px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "6px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "padding": "10px 12px 12px",
      "gap": "6px",
      "padding-top": "10px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "box-shadow": "0 0 0 1px var(--border)",
      "font-weight": "500"
    },
    {
      "padding": "10px 12px",
      "padding-top": "10px",
      "padding-right": "12px",
      "padding-bottom": "10px",
      "padding-left": "12px"
    },
    {
      "gap": "6px",
      "height": "26px"
    },
    {
      "width": "22px",
      "height": "22px",
      "border-radius": "4px"
    },
    {
      "gap": "8px",
      "height": "32px"
    },
    {
      "width": "20px",
      "height": "20px",
      "border-radius": "4px",
      "box-shadow": "0 0 0 1px var(--border)"
    },
    {
      "width": "min(720px, calc(100vw - 32px))"
    },
    {
      "gap": "6px",
      "font-weight": "600"
    },
    {
      "min-height": "280px"
    },
    {
      "padding": "12px 16px",
      "gap": "6px",
      "padding-top": "12px",
      "padding-right": "16px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "padding": "0 0 2px 22px",
      "font-size": "12px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "2px",
      "padding-left": "22px"
    },
    {
      "gap": "12px",
      "padding-bottom": "40px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "font-size": "13px"
    },
    {
      "gap": "7px",
      "font-size": "11px"
    },
    {
      "border-radius": "8px",
      "padding": "12px 14px",
      "gap": "4px",
      "padding-top": "12px",
      "padding-right": "14px",
      "padding-bottom": "12px",
      "padding-left": "14px"
    },
    {
      "font-size": "28px",
      "font-weight": "600"
    },
    {
      "height": "6px",
      "border-radius": "3px"
    },
    {
      "padding": "4px 6px",
      "font-weight": "normal",
      "padding-top": "4px",
      "padding-right": "6px",
      "padding-bottom": "4px",
      "padding-left": "6px"
    },
    {
      "padding": "4px 6px",
      "font-weight": "normal",
      "font-size": "11px",
      "padding-top": "4px",
      "padding-right": "6px",
      "padding-bottom": "4px",
      "padding-left": "6px"
    },
    {
      "font-size": "10px",
      "padding": "1px 6px",
      "padding-top": "1px",
      "padding-right": "6px",
      "padding-bottom": "1px",
      "padding-left": "6px"
    },
    {
      "gap": "12px",
      "font-size": "12px"
    },
    {
      "width": "min(1100px, calc(100vw - 32px))"
    },
    {
      "width": "100%",
      "font-size": "12px"
    },
    {
      "padding": "5px 6px",
      "font-weight": "normal",
      "font-size": "11px",
      "padding-top": "5px",
      "padding-right": "6px",
      "padding-bottom": "5px",
      "padding-left": "6px"
    },
    {
      "padding": "5px 6px",
      "padding-top": "5px",
      "padding-right": "6px",
      "padding-bottom": "5px",
      "padding-left": "6px"
    },
    {
      "width": "58px"
    },
    {
      "border-radius": "6px",
      "padding": "4px 8px",
      "padding-top": "4px",
      "padding-right": "8px",
      "padding-bottom": "4px",
      "padding-left": "8px"
    },
    {
      "padding-left": "18px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "width": "min(980px, calc(100vw - 32px))"
    },
    {
      "padding": "12px 0",
      "padding-top": "12px",
      "padding-right": "0px",
      "padding-bottom": "12px",
      "padding-left": "0px"
    },
    {
      "border-radius": "6px",
      "padding": "12px",
      "min-height": "64px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "border-radius": "2px"
    },
    {
      "width": "auto",
      "height": "26px"
    },
    {
      "font-size": "10px",
      "font-weight": "600",
      "padding": "1px 6px",
      "border-radius": "8px",
      "padding-top": "1px",
      "padding-right": "6px",
      "padding-bottom": "1px",
      "padding-left": "6px"
    },
    {
      "width": "auto",
      "padding": "0 8px",
      "font-size": "10px",
      "font-weight": "600",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    {
      "padding-right": "0px",
      "padding-top": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "gap": "2px",
      "padding": "2px",
      "border-radius": "6px",
      "padding-top": "2px",
      "padding-right": "2px",
      "padding-bottom": "2px",
      "padding-left": "2px"
    },
    {
      "width": "32px",
      "padding": "0 2px",
      "padding-top": "0px",
      "padding-right": "2px",
      "padding-bottom": "0px",
      "padding-left": "2px"
    },
    {
      "width": "40px"
    },
    {
      "width": "22px"
    },
    {
      "width": "20px"
    },
    {
      "width": "min(420px, calc(100vw - 32px))"
    },
    {
      "padding": "4px 16px 16px",
      "gap": "10px",
      "padding-top": "4px",
      "padding-right": "16px",
      "padding-bottom": "16px",
      "padding-left": "16px"
    },
    {
      "padding": "6px 10px",
      "border-radius": "6px",
      "font-size": "12px",
      "box-shadow": "0 4px 16px rgba(0,0,0,0.18)",
      "padding-top": "6px",
      "padding-right": "10px",
      "padding-bottom": "6px",
      "padding-left": "10px"
    },
    {
      "width": "32px",
      "height": "32px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "border-radius": "6px",
      "padding-left": "8px",
      "padding-right": "28px",
      "padding-top": "0px",
      "padding-bottom": "0px"
    },
    {
      "padding-right": "6px",
      "padding-top": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "gap": "32px",
      "padding": "12px 0 40px",
      "padding-top": "12px",
      "padding-right": "0px",
      "padding-bottom": "40px",
      "padding-left": "0px"
    },
    {
      "padding": "9px 12px",
      "border-radius": "6px",
      "padding-top": "9px",
      "padding-right": "12px",
      "padding-bottom": "9px",
      "padding-left": "12px"
    },
    {
      "padding": "24px 32px",
      "border-radius": "10px",
      "font-size": "14px",
      "padding-top": "24px",
      "padding-right": "32px",
      "padding-bottom": "24px",
      "padding-left": "32px"
    },
    {
      "font-size": "24px"
    },
    {
      "gap": "2px",
      "padding-left": "10px",
      "border-radius": "6px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "width": "24px",
      "height": "24px",
      "font-size": "16px"
    },
    {
      "width": "32px",
      "height": "32px",
      "font-size": "20px"
    },
    {
      "width": "100%",
      "height": "32px"
    },
    {
      "padding": "24px 32px",
      "padding-top": "24px",
      "padding-right": "32px",
      "padding-bottom": "24px",
      "padding-left": "32px"
    },
    {
      "font-size": "14px"
    },
    {
      "width": "24px",
      "height": "24px",
      "font-size": "18px"
    },
    {
      "width": "18px",
      "height": "18px"
    },
    {
      "box-shadow": "0 1px 0 var(--accent)"
    },
    {
      "padding": "8px 10px",
      "font-weight": "500",
      "padding-top": "8px",
      "padding-right": "10px",
      "padding-bottom": "8px",
      "padding-left": "10px"
    },
    {
      "padding": "10px",
      "font-size": "11px",
      "padding-top": "10px",
      "padding-right": "10px",
      "padding-bottom": "10px",
      "padding-left": "10px"
    },
    {
      "padding": "3px 6px",
      "border-radius": "4px",
      "padding-top": "3px",
      "padding-right": "6px",
      "padding-bottom": "3px",
      "padding-left": "6px"
    },
    {
      "font-size": "10px",
      "padding": "2px 5px",
      "border-radius": "4px",
      "padding-top": "2px",
      "padding-right": "5px",
      "padding-bottom": "2px",
      "padding-left": "5px"
    },
    {
      "gap": "8px",
      "padding-bottom": "8px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "width": "16px",
      "height": "16px",
      "border-radius": "4px"
    },
    {
      "font-size": "inherit",
      "font-weight": "600"
    },
    {
      "gap": "8px",
      "padding-top": "8px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "border-radius": "4px",
      "padding": "2px 6px",
      "padding-top": "2px",
      "padding-right": "6px",
      "padding-bottom": "2px",
      "padding-left": "6px"
    },
    {
      "padding": "2px 4px",
      "border-radius": "3px",
      "padding-top": "2px",
      "padding-right": "4px",
      "padding-bottom": "2px",
      "padding-left": "4px"
    },
    {
      "padding": "14px 32px 0",
      "padding-top": "14px",
      "padding-right": "32px",
      "padding-bottom": "0px",
      "padding-left": "32px"
    },
    {
      "width": "100%",
      "min-height": "30px",
      "padding": "4px 0",
      "border-radius": "0",
      "font-size": "12px",
      "padding-top": "4px",
      "padding-right": "0px",
      "padding-bottom": "4px",
      "padding-left": "0px"
    },
    {
      "box-shadow": "inset 0 0 0 1px var(--border)"
    },
    {
      "padding-left": "6px",
      "padding-right": "18px",
      "padding-top": "0px",
      "padding-bottom": "0px"
    },
    {
      "width": "76px",
      "height": "76px",
      "border-radius": "6px"
    },
    {
      "border-radius": "3px",
      "padding": "0",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      "padding-left": "0px"
    },
    {
      "width": "16px",
      "height": "5px"
    },
    {
      "height": "16px",
      "width": "5px"
    },
    {
      "gap": "4px",
      "font-size": "11px"
    },
    {
      "gap": "8px",
      "padding": "8px 12px",
      "padding-top": "8px",
      "padding-right": "12px",
      "padding-bottom": "8px",
      "padding-left": "12px"
    },
    {
      "border-radius": "4px",
      "padding": "4px 8px",
      "padding-top": "4px",
      "padding-right": "8px",
      "padding-bottom": "4px",
      "padding-left": "8px"
    },
    {
      "gap": "4px",
      "padding": "0 12px 6px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "6px",
      "padding-left": "12px"
    },
    {
      "height": "100%",
      "padding": "0 12px",
      "padding-top": "0px",
      "padding-right": "12px",
      "padding-bottom": "0px",
      "padding-left": "12px"
    },
    {
      "padding": "4px 12px",
      "min-height": "20px",
      "padding-top": "4px",
      "padding-right": "12px",
      "padding-bottom": "4px",
      "padding-left": "12px"
    },
    {
      "padding": "12px 20px",
      "height": "100%",
      "padding-top": "12px",
      "padding-right": "20px",
      "padding-bottom": "12px",
      "padding-left": "20px"
    },
    {
      "height": "5px"
    },
    {
      "height": "calc(100vh - var(--terminal-height))"
    },
    {
      "width": "100%",
      "min-height": "0",
      "padding": "28px 32px",
      "padding-top": "28px",
      "padding-right": "32px",
      "padding-bottom": "28px",
      "padding-left": "32px"
    },
    {
      "font-size": "22px",
      "font-weight": "600"
    },
    {
      "gap": "8px 20px",
      "padding": "12px 0",
      "padding-top": "12px",
      "padding-right": "0px",
      "padding-bottom": "12px",
      "padding-left": "0px"
    },
    {
      "gap": "16px",
      "padding": "16px",
      "border-radius": "8px",
      "padding-top": "16px",
      "padding-right": "16px",
      "padding-bottom": "16px",
      "padding-left": "16px"
    },
    {
      "gap": "6px",
      "padding-bottom": "7px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-left": "0px"
    },
    {
      "border-radius": "8px",
      "padding": "20px",
      "padding-top": "20px",
      "padding-right": "20px",
      "padding-bottom": "20px",
      "padding-left": "20px"
    },
    {
      "font-size": "32px",
      "font-weight": "600"
    },
    {
      "padding": "22px 0",
      "padding-top": "22px",
      "padding-right": "0px",
      "padding-bottom": "22px",
      "padding-left": "0px"
    },
    {
      "font-size": "13px",
      "font-weight": "600"
    },
    {
      "border-radius": "6px",
      "padding": "12px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "min-height": "24px"
    },
    {
      "font-size": "18px",
      "font-weight": "600"
    },
    {
      "width": "100%",
      "height": "4px",
      "border-radius": "4px"
    },
    {
      "width": "300px"
    },
    {
      "width": "100%",
      "font-size": "11px"
    },
    {
      "padding": "10px 12px",
      "font-weight": "500",
      "padding-top": "10px",
      "padding-right": "12px",
      "padding-bottom": "10px",
      "padding-left": "12px"
    },
    {
      "padding": "24px",
      "border-radius": "8px",
      "padding-top": "24px",
      "padding-right": "24px",
      "padding-bottom": "24px",
      "padding-left": "24px"
    },
    {
      "gap": "20px",
      "padding": "16px 0",
      "padding-top": "16px",
      "padding-right": "0px",
      "padding-bottom": "16px",
      "padding-left": "0px"
    },
    {
      "padding": "14px 16px",
      "font-weight": "500",
      "padding-top": "14px",
      "padding-right": "16px",
      "padding-bottom": "14px",
      "padding-left": "16px"
    },
    {
      "padding": "0 16px 12px",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "16px",
      "padding-bottom": "12px",
      "padding-left": "16px"
    },
    {
      "padding": "14px 16px",
      "border-radius": "6px",
      "padding-top": "14px",
      "padding-right": "16px",
      "padding-bottom": "14px",
      "padding-left": "16px"
    },
    {
      "gap": "8px 16px",
      "font-size": "11px"
    },
    {
      "width": "min(1400px,100%)",
      "height": "calc(100dvh - 48px)"
    },
    {
      "padding": "16px 20px",
      "gap": "16px",
      "padding-top": "16px",
      "padding-right": "20px",
      "padding-bottom": "16px",
      "padding-left": "20px"
    },
    {
      "font-size": "16px"
    },
    {
      "gap": "12px",
      "padding": "12px 20px",
      "padding-top": "12px",
      "padding-right": "20px",
      "padding-bottom": "12px",
      "padding-left": "20px"
    },
    {
      "min-height": "0",
      "padding": "12px",
      "gap": "12px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "min-height": "70px",
      "width": "100%",
      "border-radius": "6px",
      "padding": "12px",
      "padding-top": "12px",
      "padding-right": "12px",
      "padding-bottom": "12px",
      "padding-left": "12px"
    },
    {
      "min-height": "120px",
      "border-radius": "6px"
    },
    {
      "padding-left": "20px",
      "padding-top": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px"
    },
    {
      "box-shadow": "0 0 0 2px var(--accent-soft)",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "width": "auto",
      "height": "24px",
      "border-radius": "5px",
      "font-size": "11px",
      "font-weight": "400"
    },
    {
      "box-shadow": "0 0 0 1px var(--border)",
      "font-size": "11px",
      "font-weight": "400"
    }
  ],
  "root": {
    "color-scheme": "light",
    "--subtle": "#FAFAFA",
    "--on-accent": "#FFFFFF",
    "--component-accent": "#9747FF",
    "--component-text": "#7B2EE6",
    "--component-muted": "#6B5A8E",
    "--component-soft": "#F0E6FF",
    "--component-soft-hover": "#E4D4FF",
    "--component-override": "#F5EFFF",
    "--success-text": "#0F7A40",
    "--success-soft": "#E7F7EE",
    "--warning-text": "#B54708",
    "--warning-soft": "#FFF4E5",
    "--danger-text": "#C4320A",
    "--danger-soft": "#FFE8E8",
    "--info-text": "#0B6BCB",
    "--slot-text": "#B5197F",
    "--slot-soft": "#FDE7F6",
    "--control-track": "#D9D9D9",
    "--accent": "#0d99ff",
    "--accent-soft": "#e5f4ff",
    "--accent-softer": "#f2f9ff",
    "--panel": "#ffffff",
    "--border": "#e6e6e6",
    "--text": "#1e1e1e",
    "--muted": "#8c8c8c",
    "--hover": "#f5f5f5",
    "--input": "#f5f5f5",
    "--canvas": "#f5f5f5",
    "--rail-w": "40px",
    "font-family": "Inter, system-ui, -apple-system, sans-serif",
    "font-size": "11px",
    "color": "var(--text)",
    "-webkit-font-smoothing": "antialiased"
  },
  "dark": {
    "color-scheme": "dark",
    "--accent": "#0D99FF",
    "--accent-soft": "#153D59",
    "--accent-softer": "#172C3B",
    "--panel": "#242424",
    "--border": "#444444",
    "--text": "#F5F5F5",
    "--muted": "#AAAAAA",
    "--hover": "#333333",
    "--input": "#333333",
    "--canvas": "#1A1A1A",
    "--subtle": "#2A2A2A",
    "--on-accent": "#FFFFFF",
    "--component-accent": "#C59EFF",
    "--component-text": "#CFACFF",
    "--component-muted": "#C3B0E0",
    "--component-soft": "#342445",
    "--component-soft-hover": "#47315F",
    "--component-override": "#30223F",
    "--success-text": "#73D79E",
    "--success-soft": "#1D3629",
    "--warning-text": "#FFBC6C",
    "--warning-soft": "#3D2D1C",
    "--danger-text": "#FF9A80",
    "--danger-soft": "#3D2323",
    "--info-text": "#7AC5FF",
    "--slot-text": "#FF9BDD",
    "--slot-soft": "#3D2538",
    "--control-track": "#555555"
  },
  "rules": {
    ".btn": {
      "height": "30px",
      "padding": "0 8px",
      "overflow": "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "border-radius": "5px",
      "border": "1px solid var(--border)",
      "background": "var(--panel)",
      "font-weight": "500",
      "display": "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "gap": "4px",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    ".btn:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "500"
    },
    ".btn.disabled": {
      "opacity": "0.45",
      "font-size": "11px",
      "font-weight": "500"
    },
    ".btn.primary": {
      "height": "30px",
      "padding": "0 8px",
      "overflow": "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "border-radius": "5px",
      "border": "1px solid var(--border)",
      "background": "var(--accent)",
      "font-weight": "500",
      "display": "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "gap": "4px",
      "border-color": "var(--accent)",
      "color": "var(--on-accent)",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    ".btn.primary:hover": {
      "background": "#0b8ae6",
      "font-size": "11px",
      "font-weight": "500"
    },
    ".btn.primary.disabled": {
      "opacity": "0.45",
      "font-size": "11px",
      "font-weight": "500"
    },
    ".btn.primary.destructive": {
      "height": "30px",
      "padding": "0 8px",
      "overflow": "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "border-radius": "5px",
      "border": "1px solid var(--border)",
      "background": "#e03e1a",
      "font-weight": "500",
      "display": "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      "gap": "4px",
      "border-color": "#e03e1a",
      "color": "var(--on-accent)",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    ".btn.primary.destructive:hover": {
      "background": "#c4320a",
      "font-size": "11px",
      "font-weight": "500"
    },
    ".btn.primary.destructive.disabled": {
      "opacity": "0.45",
      "font-size": "11px",
      "font-weight": "500"
    },
    ".icon-btn": {
      "width": "24px",
      "height": "24px",
      "display": "inline-grid",
      "place-items": "center",
      "border-radius": "5px",
      "color": "var(--text)",
      "flex": "none",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".icon-btn:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".icon-btn.selected": {
      "background": "var(--hover)",
      "box-shadow": "inset 0 0 0 1px var(--border)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".icon-btn.disabled": {
      "opacity": "0.3",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".rail-btn": {
      "position": "relative",
      "width": "32px",
      "height": "32px",
      "display": "grid",
      "place-items": "center",
      "border-radius": "6px",
      "color": "var(--muted)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".rail-btn:hover": {
      "background": "var(--hover)",
      "color": "var(--text)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".rail-btn:focus": {
      "outline": "2px solid var(--accent)",
      "outline-offset": "-2px",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".tb-btn": {
      "width": "32px",
      "height": "32px",
      "display": "grid",
      "place-items": "center",
      "border-radius": "8px",
      "color": "var(--text)",
      "position": "relative",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".tb-btn:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".tb-btn.active": {
      "background": "var(--accent)",
      "color": "var(--on-accent)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".field": {
      "display": "flex",
      "align-items": "center",
      "height": "28px",
      "background": "var(--input)",
      "border": "1px solid transparent",
      "border-radius": "5px",
      "min-width": "0",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".field:hover": {
      "border-color": "var(--border)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".field:focus": {
      "border-color": "var(--accent)",
      "background": "var(--panel)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".select": {
      "height": "28px",
      "border": "1px solid var(--border)",
      "background": "var(--panel)",
      "border-radius": "6px",
      "padding": "0 6px",
      "outline": "none",
      "min-width": "0",
      "appearance": "none",
      "background-color": "var(--panel)",
      "padding-left": "8px",
      "padding-right": "28px",
      "cursor": "pointer",
      "background-image": "url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888888%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E\")",
      "background-repeat": "no-repeat",
      "background-position": "right 8px center",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-bottom": "0px"
    },
    ".select:hover": {
      "border-color": "var(--muted)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".select:focus": {
      "border-color": "var(--accent)",
      "outline": "2px solid var(--accent-softer)",
      "outline-offset": "1px",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".select.disabled": {
      "opacity": "0.45",
      "cursor": "default",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".seg": {
      "display": "flex",
      "background": "var(--input)",
      "border-radius": "5px",
      "padding": "2px",
      "justify-content": "space-between",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "2px",
      "padding-right": "2px",
      "padding-bottom": "2px",
      "padding-left": "2px"
    },
    ".seg-item": {
      "width": "auto",
      "height": "24px",
      "display": "inline-grid",
      "place-items": "center",
      "border-radius": "5px",
      "color": "var(--text)",
      "flex": "1",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".seg-item:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".seg-item.selected": {
      "background": "var(--panel)",
      "box-shadow": "0 0 0 1px var(--border)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".seg-item.disabled": {
      "opacity": "0.3",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".page-row": {
      "display": "flex",
      "align-items": "center",
      "height": "28px",
      "padding": "0 8px 0 8px",
      "margin": "0 8px",
      "border-radius": "5px",
      "position": "relative",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "8px"
    },
    ".page-row:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".page-group": {
      "display": "flex",
      "align-items": "center",
      "gap": "4px",
      "height": "28px",
      "padding": "0 8px 0 4px",
      "margin": "0 8px",
      "border-radius": "5px",
      "position": "relative",
      "color": "var(--muted)",
      "font-weight": "600",
      "cursor": "default",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "4px"
    },
    ".page-group:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "600"
    },
    ".layer-row": {
      "display": "flex",
      "align-items": "center",
      "height": "28px",
      "padding-left": "0px",
      "padding-right": "6px",
      "margin": "0 8px",
      "border-radius": "5px",
      "position": "relative",
      "white-space": "nowrap",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "0px",
      "padding-bottom": "0px"
    },
    ".layer-row:hover": {
      "box-shadow": "inset 0 0 0 1px var(--accent)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".layer-row.selected": {
      "background": "var(--accent-soft)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".menu": {
      "position": "fixed",
      "z-index": "100",
      "min-width": "200px",
      "padding": "4px",
      "background": "var(--panel)",
      "color": "var(--text)",
      "border-radius": "8px",
      "box-shadow": "0 8px 24px #00000026",
      "border": "1px solid var(--border)",
      "max-height": "min(360px, calc(100vh - 16px))",
      "max-width": "calc(100vw - 16px)",
      "overflow-y": "auto",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "4px",
      "padding-right": "4px",
      "padding-bottom": "4px",
      "padding-left": "4px"
    },
    ".menu-item": {
      "display": "flex",
      "align-items": "center",
      "width": "100%",
      "height": "30px",
      "padding": "6px 8px",
      "border-radius": "4px",
      "text-align": "left",
      "min-height": "30px",
      "gap": "8px",
      "color": "var(--text)",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "6px",
      "padding-right": "8px",
      "padding-bottom": "6px",
      "padding-left": "8px"
    },
    ".menu-item:hover": {
      "background": "var(--hover)",
      "outline": "none",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".menu-item:focus": {
      "background": "var(--hover)",
      "outline": "none",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".menu-item.selected": {
      "color": "var(--accent)",
      "background": "var(--accent-softer)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".menu-item.disabled": {
      "opacity": "0.4",
      "color": "var(--muted)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".panel-head": {
      "display": "flex",
      "align-items": "center",
      "justify-content": "space-between",
      "height": "32px",
      "padding": "0 8px 0 16px",
      "font-weight": "600",
      "font-size": "11px",
      "padding-top": "0px",
      "padding-right": "8px",
      "padding-bottom": "0px",
      "padding-left": "16px"
    },
    ".file-name": {
      "flex": "1",
      "min-width": "0",
      "border": "1px solid transparent",
      "background": "none",
      "border-radius": "4px",
      "padding": "5px 6px",
      "font-weight": "600",
      "font-size": "12px",
      "outline": "none",
      "padding-top": "5px",
      "padding-right": "6px",
      "padding-bottom": "5px",
      "padding-left": "6px"
    },
    ".file-name:hover": {
      "border-color": "var(--border)",
      "font-size": "12px",
      "font-weight": "600"
    },
    ".file-name:focus": {
      "border-color": "var(--accent)",
      "font-size": "12px",
      "font-weight": "600"
    },
    ".preset": {
      "display": "flex",
      "justify-content": "space-between",
      "padding": "7px 8px",
      "border-radius": "5px",
      "text-align": "left",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "7px",
      "padding-right": "8px",
      "padding-bottom": "7px",
      "padding-left": "8px"
    },
    ".preset:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".check-row": {
      "display": "flex",
      "align-items": "center",
      "gap": "8px",
      "height": "24px",
      "padding": "2px 0",
      "font-size": "11px",
      "font-weight": "400",
      "padding-top": "2px",
      "padding-right": "0px",
      "padding-bottom": "2px",
      "padding-left": "0px"
    },
    ".rail-badge": {
      "position": "absolute",
      "top": "2px",
      "right": "1px",
      "min-width": "14px",
      "height": "14px",
      "padding": "0 3px",
      "box-sizing": "border-box",
      "border-radius": "7px",
      "background": "#9747ff",
      "color": "var(--on-accent)",
      "font-size": "9px",
      "font-weight": "600",
      "line-height": "14px",
      "text-align": "center",
      "box-shadow": "0 0 0 2px var(--panel)",
      "padding-top": "0px",
      "padding-right": "3px",
      "padding-bottom": "0px",
      "padding-left": "3px"
    },
    ".appearance-button": {
      "width": "32px",
      "height": "32px",
      "flex": "none",
      "display": "inline-grid",
      "place-items": "center",
      "border-radius": "5px",
      "color": "var(--text)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".appearance-button:hover": {
      "background": "var(--hover)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".appearance-button.disabled": {
      "opacity": "0.3",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".switch": {
      "position": "relative",
      "display": "inline-block",
      "width": "28px",
      "height": "16px",
      "flex": "none",
      "cursor": "default",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".switch:focus": {
      "box-shadow": "0 0 0 2px var(--accent-soft)",
      "font-size": "11px",
      "font-weight": "400"
    },
    ".switch.selected": {
      "position": "relative",
      "display": "inline-block",
      "width": "28px",
      "height": "16px",
      "flex": "none",
      "cursor": "default",
      "font-size": "11px",
      "font-weight": "400"
    }
  }
};
