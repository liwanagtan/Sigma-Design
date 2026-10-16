// The explicit inventory shared by source extraction, design specimens and parity fixtures.
export const UI_ICON_SIZES={tool:24,rail:20,control:16,chevron:12};
export const UI_COMPONENTS=[
 ['.btn','Button'],['.btn.primary','Primary button'],['.btn.primary.destructive','Destructive button'],
 ['.icon-btn','Icon button'],['.rail-btn','Rail button'],['.tb-btn','Toolbar button'],
 ['.field','Input field'],['.select','Select'],['.seg','Segmented control'],['.seg-item','Segmented item'],
 ['.page-row','Page row'],['.page-group','Page group'],['.layer-row','Layer row'],
 ['.menu','Dropdown menu'],['.menu-item','Dropdown item'],['.panel-head','Panel heading'],
 ['.file-name','File name'],['.preset','Preset'],['.check-row','Checkbox row'],['.rail-badge','Rail badge'],
 ['.appearance-button','Appearance'],['.switch','Switch'],
].map(([selector,name])=>({selector,name,kind:['.menu','.seg','.field','.check-row','.switch'].includes(selector)?'composite':'primitive'}));
// Explicit remaining scope, rather than an implicit claim that primitive coverage is app coverage.
export const UI_COMPOSITE_BACKLOG=[
 {name:'Save status and recovery',source:'src/save-status.js'}, {name:'Recovery dialog',source:'src/recovery-ui.js'},
 {name:'Saved file recovery dialog',source:'src/saved-file-recovery.js'},
 {name:'Dialogs',source:'src/dialogs.js'}, {name:'Token picker',source:'src/token-picker.js'},
 {name:'Project navigation and icon picker',source:'src/home.js'}, {name:'File cards',source:'src/home.js'},
 {name:'Reports',source:'src/report-ui.js'}, {name:'Terminal',source:'src/terminal.js'},
 {name:'Code creation',source:'src/code-create-ui.js'},
];
export const UI_STYLESHEETS=['styles.css','src/terminal.css','src/report.css','src/code-create.css'];
