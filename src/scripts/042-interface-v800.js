window.InterfaceV800 = (() => {
  'use strict';

  const VERSION = '8.0.0';
  const STORAGE_KEY = 'classroomSeatingPlannerV8Workspace';
  const STYLE_ID = 'interfaceV800Styles';
  const WORKSPACES = Object.freeze({
    class: {
      label: 'Class',
      title: 'Class workspace',
      description: 'Roster, student details, notes, groups, rules, zones, and imports.',
      workflow: 'setup',
      icon: 'people',
      actions: [
        ['add-student', 'Add student', 'primary'],
        ['import-roster', 'Import roster', 'secondary'],
        ['class-rules', 'Rules & groups', 'secondary']
      ]
    },
    room: {
      label: 'Room',
      title: 'Room workspace',
      description: 'Design the physical classroom, seats, tables, pods, zones, and accessibility spaces.',
      workflow: 'room',
      icon: 'room',
      actions: [
        ['room-tools', 'Room tools', 'primary'],
        ['room-templates', 'Templates', 'secondary']
      ]
    },
    seat: {
      label: 'Seat',
      title: 'Seat students',
      description: 'Place students, generate options, inspect valid seats, and resolve conflicts.',
      workflow: 'seating',
      icon: 'seat',
      actions: [
        ['generate', 'Generate options', 'primary'],
        ['assistant', 'Planner Assistant', 'secondary'],
        ['seat-roster', 'Roster', 'secondary mobile-only']
      ]
    },
    plans: {
      label: 'Plans',
      title: 'Plans & activities',
      description: 'Saved plans, Today Mode, activity layouts, testing, stations, planner packs, and history.',
      workflow: 'seating',
      icon: 'plans',
      actions: [
        ['saved-plans', 'Saved plans', 'primary'],
        ['today', 'Today Mode', 'secondary']
      ]
    },
    review: {
      label: 'Review',
      title: 'Review & share',
      description: 'Check the finished chart, violations, analysis, printing, presentation, saving, and sharing.',
      workflow: 'review',
      icon: 'review',
      actions: [
        ['analyze', 'Analyze chart', 'primary'],
        ['print', 'Print / export', 'secondary'],
        ['review-details', 'Details', 'secondary mobile-only']
      ]
    }
  });

  const ICONS = Object.freeze({
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/>',
    room: '<path d="M3 3h18v18H3z"/><path d="M9 3v18M3 10h18M14 10v11"/>',
    seat: '<path d="M6 4v6h12V4"/><path d="M4 10h16v5H4zM7 15v5m10-5v5"/>',
    plans: '<path d="M4 5h16v14H4z"/><path d="M8 3v4m8-4v4M4 9h16"/><path d="M8 13h3m2 0h3m-8 3h3"/>',
    review: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    chevron: '<path d="M9 18l6-6-6-6"/>',
    sparkle: '<path d="M12 3l1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  });

  let installed = false;
  let activeWorkspace = 'class';
  let observer = null;
  let mutationFrame = 0;

  const icon = name => `<svg class="v8-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.more}</svg>`;
  const q = selector => document.querySelector(selector);
  const byId = id => document.getElementById(id);
  const click = id => { const node = byId(id); if (node) { node.click(); return true; } return false; };

  function storageGet() {
    try {
      if (typeof safeStorageGet === 'function') return safeStorageGet('localStorage', STORAGE_KEY);
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) { return null; }
  }

  function storageSet(value) {
    try {
      if (typeof safeStorageSet === 'function') safeStorageSet('localStorage', STORAGE_KEY, value);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch (_) { /* visual preference only */ }
  }

  function announce(message) {
    try { if (typeof setLiveStatusMessage === 'function') setLiveStatusMessage(message); } catch (_) { /* optional */ }
  }

  function installStyles() {
    if (byId(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{--v8-rail:88px;--v8-shell-gap:14px;--v8-topbar-height:64px;--v8-radius:16px;--v8-soft:color-mix(in srgb,var(--panel,#fff) 92%,#2563eb 8%);--v8-soft-2:color-mix(in srgb,var(--panel,#fff) 96%,#64748b 4%)}
      body.v8-interface{background:color-mix(in srgb,var(--bg,#f5f7fb) 96%,#0f172a 4%)}
      body.v8-interface .v4-workflow-shell,body.v8-interface #mobilePanelNav{display:none!important}
      body.v8-interface .v41-stage-ribbon{display:none!important}
      body.v8-interface .v4-topbar{min-height:var(--v8-topbar-height);height:auto;padding:8px 14px;gap:10px;border-bottom:1px solid var(--border,#d8deea);box-shadow:0 2px 12px rgba(15,23,42,.06);z-index:1200}
      body.v8-interface .v4-brand{min-width:190px;gap:8px}body.v8-interface .v4-brand>svg{width:25px;height:25px}body.v8-interface .v4-brand strong{font-size:13px}body.v8-interface .v4-brand span{font-size:9px}
      body.v8-interface .v4-class-dock{min-width:0;flex:1 1 260px;max-width:430px}body.v8-interface .v4-class-dock .class-manager{min-width:0;flex:1}body.v8-interface .v4-class-dock select{min-width:0;max-width:260px}
      body.v8-interface .v4-quick-dock,body.v8-interface .v4-utility-dock{gap:5px}body.v8-interface #snapshotQuickBtn{display:none!important}
      body.v8-interface:not([data-v8-workspace="review"]) #printBtn{display:none!important}
      .v8-workspace-nav{position:fixed;left:0;top:var(--v8-topbar-height);bottom:0;width:var(--v8-rail);z-index:1050;display:flex;flex-direction:column;gap:6px;padding:12px 8px;background:var(--panel,#fff);border-right:1px solid var(--border,#d8deea);box-shadow:2px 0 12px rgba(15,23,42,.04)}
      .v8-workspace-nav::before{content:'Workspace';font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#64748b);text-align:center;padding:3px 0 5px}
      .v8-nav-button{appearance:none;border:0;background:transparent;color:var(--muted,#526176);border-radius:12px;min-height:62px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font:inherit;font-size:10px;font-weight:800;cursor:pointer;position:relative}
      .v8-nav-button .v8-icon{width:21px;height:21px}.v8-nav-button:hover{background:var(--v8-soft);color:var(--text,#172033)}.v8-nav-button.active{background:color-mix(in srgb,var(--panel,#fff) 80%,#2563eb 20%);color:#1746a2;box-shadow:inset 0 0 0 1px color-mix(in srgb,#2563eb 24%,transparent)}
      .v8-nav-button.active::before{content:'';position:absolute;left:-8px;top:14px;bottom:14px;width:3px;border-radius:0 4px 4px 0;background:#2563eb}
      .v8-contextbar{margin-left:var(--v8-rail);position:sticky;top:var(--v8-topbar-height);z-index:1000;min-height:76px;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:color-mix(in srgb,var(--panel,#fff) 96%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border,#d8deea)}
      .v8-context-copy{min-width:0;display:grid;gap:2px}.v8-context-eyebrow{font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#2563eb}.v8-context-copy h2{margin:0;font-size:18px;line-height:1.15}.v8-context-copy p{margin:0;color:var(--muted,#64748b);font-size:11px;max-width:720px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .v8-context-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.v8-context-actions button{white-space:nowrap}.v8-context-actions .mobile-only{display:none}
      body.v8-interface main.app{margin-left:var(--v8-rail)!important;width:auto!important;max-width:none!important;min-height:calc(100vh - var(--v8-topbar-height) - 76px);padding:var(--v8-shell-gap)!important;gap:var(--v8-shell-gap)!important;align-items:start}
      body.v8-interface main.app>.panel{border-radius:var(--v8-radius);border:1px solid var(--border,#d8deea);box-shadow:0 8px 28px rgba(15,23,42,.055);overflow:hidden;background:var(--panel,#fff)}
      body.v8-interface main.app>.panel>.panel-header{min-height:52px;padding:10px 13px;border-bottom:1px solid var(--border,#d8deea);background:var(--v8-soft-2)}
      body.v8-interface main.app>.panel>.panel-header h2{font-size:14px;margin:0}
      body.v8-interface .center-panel>.panel-header>.button-row{flex-wrap:nowrap;min-width:0}.v8-interface .center-panel>.panel-header>.button-row>:not(#seatDisplayControls){display:none!important}.v8-interface #seatDisplayControls{display:flex!important;min-width:0;gap:8px;overflow:auto;padding-bottom:1px}
      body.v8-interface[data-v8-workspace="class"] main.app{display:grid!important;grid-template-columns:minmax(0,1fr)!important}.v8-interface[data-v8-workspace="class"] .left-panel{display:block!important;width:auto!important;max-width:none!important;grid-column:1!important}.v8-interface[data-v8-workspace="class"] .center-panel,.v8-interface[data-v8-workspace="class"] .right-panel,.v8-interface[data-v8-workspace="class"] #v8PlansHub{display:none!important}
      .v8-interface[data-v8-workspace="class"] .left-panel>.panel-header h2{font-size:0}.v8-interface[data-v8-workspace="class"] .left-panel>.panel-header h2::after{content:'Class workspace';font-size:14px}.v8-interface[data-v8-workspace="class"] #toggleLeftPanelBtn,.v8-interface[data-v8-workspace="class"] #v41ToggleLeftPanel{display:none!important}.v8-interface[data-v8-workspace="class"] .left-panel .panel-body{max-width:1180px;width:100%;margin:0 auto;padding:14px}
      .v8-interface[data-v8-workspace="class"] .side-tabs{position:sticky;top:0;z-index:4;background:var(--panel,#fff);padding:5px;border:1px solid var(--border,#d8deea);border-radius:12px;gap:5px}.v8-interface[data-v8-workspace="class"] .side-tab{border-radius:9px;min-height:40px}
      body.v8-interface[data-v8-workspace="room"] main.app{display:grid!important;grid-template-columns:minmax(0,1fr)!important}.v8-interface[data-v8-workspace="room"] .center-panel{display:block!important;grid-column:1!important;min-width:0}.v8-interface[data-v8-workspace="room"] .left-panel,.v8-interface[data-v8-workspace="room"] .right-panel,.v8-interface[data-v8-workspace="room"] #v8PlansHub{display:none!important}
      body.v8-interface[data-v8-workspace="seat"] main.app{display:grid!important;grid-template-columns:minmax(270px,330px) minmax(0,1fr)!important}.v8-interface[data-v8-workspace="seat"] .left-panel,.v8-interface[data-v8-workspace="seat"] .center-panel{display:block!important;min-width:0}.v8-interface[data-v8-workspace="seat"] .right-panel,.v8-interface[data-v8-workspace="seat"] #v8PlansHub{display:none!important}.v8-interface[data-v8-workspace="seat"] .left-panel>.panel-header h2{font-size:0}.v8-interface[data-v8-workspace="seat"] .left-panel>.panel-header h2::after{content:'Seat roster';font-size:14px}.v8-interface[data-v8-workspace="seat"] .left-panel .side-tabs{display:none!important}.v8-interface[data-v8-workspace="seat"] #groupsSideTabPanel,.v8-interface[data-v8-workspace="seat"] #zonesSideTabPanel{display:none!important}.v8-interface[data-v8-workspace="seat"] #studentsSideTabPanel{display:block!important}.v8-interface[data-v8-workspace="seat"] #studentsSideTabPanel>.section:not(:last-child){display:none!important}.v8-interface[data-v8-workspace="seat"] #studentListContextHint{display:none}.v8-interface[data-v8-workspace="seat"] #toggleLeftPanelBtn,.v8-interface[data-v8-workspace="seat"] #v41ToggleLeftPanel{display:none!important}
      body.v8-interface[data-v8-workspace="plans"] main.app{display:block!important}.v8-interface[data-v8-workspace="plans"] main.app>.panel{display:none!important}.v8-interface[data-v8-workspace="plans"] #v8PlansHub{display:grid!important}
      body.v8-interface[data-v8-workspace="review"] main.app{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(280px,360px)!important}.v8-interface[data-v8-workspace="review"] .center-panel,.v8-interface[data-v8-workspace="review"] .right-panel{display:block!important;min-width:0}.v8-interface[data-v8-workspace="review"] .left-panel,.v8-interface[data-v8-workspace="review"] #v8PlansHub{display:none!important}.v8-interface[data-v8-workspace="review"] #layoutToolsPanel{display:none!important}
      .v8-plans-hub{grid-column:1/-1;display:none;gap:14px;max-width:1240px;width:100%;margin:0 auto}.v8-plans-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px;border:1px solid color-mix(in srgb,var(--border,#d8deea) 70%,#2563eb 30%);border-radius:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--panel,#fff) 90%,#2563eb 10%),var(--panel,#fff));box-shadow:0 10px 32px rgba(15,23,42,.06)}.v8-plans-hero h2{margin:2px 0 5px;font-size:22px}.v8-plans-hero p{margin:0;color:var(--muted,#64748b);max-width:720px}.v8-plans-hero-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .v8-plans-grid{display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:12px}.v8-plan-card{appearance:none;text-align:left;border:1px solid var(--border,#d8deea);border-radius:16px;padding:16px;background:var(--panel,#fff);color:var(--text,#172033);display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;min-height:116px;cursor:pointer;box-shadow:0 6px 18px rgba(15,23,42,.035)}.v8-plan-card:hover{border-color:color-mix(in srgb,var(--border,#d8deea) 40%,#2563eb 60%);transform:translateY(-1px);box-shadow:0 10px 24px rgba(15,23,42,.07)}.v8-plan-card-icon{width:42px;height:42px;border-radius:12px;background:var(--v8-soft);display:grid;place-items:center;color:#2563eb}.v8-plan-card-icon .v8-icon{width:21px;height:21px}.v8-plan-card-copy{display:grid;gap:4px}.v8-plan-card-copy strong{font-size:13px}.v8-plan-card-copy span{font-size:10px;line-height:1.35;color:var(--muted,#64748b)}.v8-plan-card>.v8-icon{width:17px;height:17px;color:var(--muted,#64748b)}
      .v8-review-actions{display:none;gap:8px;flex-wrap:wrap;padding:10px 13px;border-bottom:1px solid var(--border,#d8deea);background:var(--v8-soft-2)}.v8-interface[data-v8-workspace="review"] .v8-review-actions{display:flex}.v8-review-actions button{white-space:nowrap}
      .v8-seat-tile-polish #seatGrid .v681-seat-tile{border-radius:12px!important;box-shadow:0 5px 14px rgba(15,23,42,.07)!important}.v8-seat-tile-polish #seatGrid .v681-pod-halo{border-radius:20px!important;background:color-mix(in srgb,var(--v681-pod-color,#6f8f82) 7%,transparent)!important;border-style:solid!important}.v8-seat-tile-polish #seatGrid .v681-pod-halo.round{border-radius:999px!important}.v8-seat-tile-polish #seatGrid .v681-table-surface{border-radius:18px!important}.v8-seat-tile-polish #seatGrid .v681-pod-label{font-size:10px!important;font-weight:900!important;padding:4px 9px!important;border-radius:999px!important}
      .v8-sheet-backdrop{display:none;position:fixed;inset:0;background:rgba(15,23,42,.38);z-index:1460;border:0;width:100%;height:100%;padding:0}.v8-sheet-close{display:none!important}
      .v8-interface .guided-context-button{display:none!important}
      body.visibility-mode .v8-workspace-nav,body.visibility-mode .v8-contextbar{display:none!important}body.visibility-mode main.app{margin-left:0!important}
      @media(max-width:1100px){:root{--v8-rail:76px}.v8-workspace-nav{padding-inline:6px}.v8-nav-button{font-size:9px}.v8-context-copy p{max-width:470px}.v8-plans-grid{grid-template-columns:repeat(2,minmax(220px,1fr))}.v8-interface .v4-brand span{display:none}}
      @media(max-width:760px){:root{--v8-rail:0px;--v8-topbar-height:58px}.v8-interface .v4-topbar{padding:6px 8px;gap:5px;min-height:58px}.v8-interface .v4-brand{min-width:0;flex:0 0 auto}.v8-interface .v4-brand>div{display:none}.v8-interface .v4-class-dock{order:2;flex:1 1 auto;max-width:none}.v8-interface .v4-class-dock .class-manager label{display:none}.v8-interface .v4-class-dock select{width:100%;max-width:none;min-width:0}.v8-interface .v4-quick-dock{order:3}.v8-interface .v4-utility-dock{order:4}.v8-interface #v4CommandButton,.v8-interface #inlineSaveStatus,.v8-interface #v41FocusModeBtn{display:none!important}.v8-interface .v4-quick-dock #saveLoadMenuBtn,.v8-interface .v4-quick-dock #printBtn{display:none!important}
        .v8-workspace-nav{top:auto;left:0;right:0;bottom:0;width:auto;height:66px;display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:5px 6px calc(5px + env(safe-area-inset-bottom));border-right:0;border-top:1px solid var(--border,#d8deea);box-shadow:0 -5px 20px rgba(15,23,42,.08)}.v8-workspace-nav::before{display:none}.v8-nav-button{min-height:54px;padding:4px 2px;gap:2px;border-radius:10px;font-size:9px}.v8-nav-button .v8-icon{width:19px;height:19px}.v8-nav-button.active::before{left:20%;right:20%;top:-5px;bottom:auto;width:auto;height:3px;border-radius:0 0 4px 4px}
        .v8-contextbar{margin-left:0;top:58px;min-height:66px;padding:8px 10px;gap:8px;align-items:flex-start}.v8-context-copy{padding-top:2px;flex:1}.v8-context-copy h2{font-size:15px}.v8-context-copy p{display:none}.v8-context-eyebrow{font-size:8px}.v8-context-actions{gap:5px;max-width:62%;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.v8-context-actions button{min-height:34px;padding:6px 9px;font-size:10px}.v8-context-actions .mobile-only{display:inline-flex}
        body.v8-interface main.app{margin-left:0!important;padding:8px!important;padding-bottom:78px!important;min-height:calc(100vh - 124px);display:block!important}.v8-interface main.app>.panel{border-radius:13px}.v8-interface main.app>.panel>.panel-header{min-height:46px;padding:8px 10px}.v8-interface #seatDisplayControls{width:100%}.v8-interface #seatDisplayControls .seat-display-control{min-width:138px}.v8-interface #mobileRoomPanBtn{display:inline-flex!important}
        .v8-interface[data-v8-workspace="class"] .left-panel,.v8-interface[data-v8-workspace="room"] .center-panel,.v8-interface[data-v8-workspace="seat"] .center-panel,.v8-interface[data-v8-workspace="review"] .center-panel{display:block!important;width:100%!important;max-width:none!important}.v8-interface[data-v8-workspace="seat"] .left-panel,.v8-interface[data-v8-workspace="review"] .right-panel{display:none!important}
        .v8-interface[data-v8-workspace="class"] .left-panel .panel-body{padding:9px}.v8-interface[data-v8-workspace="class"] .side-tabs{position:static;overflow-x:auto;display:flex;flex-wrap:nowrap}.v8-interface[data-v8-workspace="class"] .side-tab{min-width:max-content;flex:1 0 auto}
        .v8-plans-grid{grid-template-columns:1fr}.v8-plans-hero{padding:15px;align-items:flex-start;flex-direction:column}.v8-plans-hero h2{font-size:18px}.v8-plans-hero-actions{justify-content:flex-start}.v8-plan-card{min-height:96px;padding:13px}
        .v8-sheet-backdrop.show{display:block}.v8-interface.v8-mobile-roster-open .v8-sheet-backdrop,.v8-interface.v8-mobile-review-open .v8-sheet-backdrop{display:block}.v8-interface.v8-mobile-roster-open[data-v8-workspace="seat"] .left-panel,.v8-interface.v8-mobile-review-open[data-v8-workspace="review"] .right-panel{display:block!important;position:fixed!important;left:6px!important;right:6px!important;bottom:72px!important;top:auto!important;max-height:min(72vh,720px)!important;width:auto!important;max-width:none!important;z-index:1470!important;overflow:auto!important;border-radius:18px 18px 12px 12px!important;box-shadow:0 -18px 55px rgba(15,23,42,.25)!important}.v8-interface.v8-mobile-roster-open .left-panel .panel-body,.v8-interface.v8-mobile-review-open .right-panel .panel-body{max-height:calc(72vh - 54px);overflow:auto}.v8-interface.v8-mobile-roster-open .v8-sheet-close,.v8-interface.v8-mobile-review-open .v8-sheet-close{display:inline-flex!important}
      }
      @media(max-width:470px){.v8-interface .v4-utility-dock #helpGuideBtn,.v8-interface .v4-quick-dock #redoBtn{display:none!important}.v8-context-actions button:nth-child(n+3):not(.mobile-only){display:none}.v8-plan-card{grid-template-columns:auto 1fr}.v8-plan-card>.v8-icon{display:none}.v8-plans-hero-actions{width:100%}.v8-plans-hero-actions button{flex:1}}
      @media print{.v8-workspace-nav,.v8-contextbar,.v8-plans-hub,.v8-sheet-backdrop{display:none!important}body.v8-interface main.app{margin-left:0!important;padding:0!important}}
    `;
    document.head.appendChild(style);
  }

  function createNav() {
    let nav = byId('v8WorkspaceNav');
    if (nav) return nav;
    nav = document.createElement('nav');
    nav.id = 'v8WorkspaceNav';
    nav.className = 'v8-workspace-nav no-print';
    nav.setAttribute('aria-label', 'Planner workspaces');
    Object.entries(WORKSPACES).forEach(([key, item]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v8-nav-button';
      button.dataset.v8Workspace = key;
      button.setAttribute('aria-label', item.label);
      button.setAttribute('aria-pressed', 'false');
      button.title = item.title;
      button.innerHTML = `${icon(item.icon)}<span>${item.label}</span>`;
      nav.appendChild(button);
    });
    document.body.appendChild(nav);
    return nav;
  }

  function createContextBar() {
    let bar = byId('v8ContextBar');
    if (bar) return bar;
    bar = document.createElement('section');
    bar.id = 'v8ContextBar';
    bar.className = 'v8-contextbar no-print';
    bar.setAttribute('aria-label', 'Current workspace actions');
    bar.innerHTML = `<div class="v8-context-copy"><span id="v8ContextEyebrow" class="v8-context-eyebrow">Workspace</span><h2 id="v8ContextTitle">Class workspace</h2><p id="v8ContextDescription"></p></div><div id="v8ContextActions" class="v8-context-actions"></div>`;
    const main = byId('mainWorkspace') || q('main.app');
    if (main) main.insertAdjacentElement('beforebegin', bar);
    else document.body.appendChild(bar);
    return bar;
  }

  function plansCard(action, iconName, title, description) {
    return `<button class="v8-plan-card" type="button" data-v8-action="${action}"><span class="v8-plan-card-icon">${icon(iconName)}</span><span class="v8-plan-card-copy"><strong>${title}</strong><span>${description}</span></span>${icon('chevron')}</button>`;
  }

  function createPlansHub() {
    let hub = byId('v8PlansHub');
    if (hub) return hub;
    hub = document.createElement('section');
    hub.id = 'v8PlansHub';
    hub.className = 'v8-plans-hub';
    hub.setAttribute('aria-label', 'Plans and activities workspace');
    hub.innerHTML = `
      <div class="v8-plans-hero">
        <div><span class="v8-context-eyebrow">Arrange once, reuse often</span><h2>Plans & activities</h2><p>Keep alternate seating plans, day-of changes, activity arrangements, testing layouts, station rotations, and reusable planning packs in one place.</p></div>
        <div class="v8-plans-hero-actions"><button type="button" data-v8-action="saved-plans">Open saved plans</button><button class="secondary" type="button" data-v8-action="today">Today Mode</button></div>
      </div>
      <div class="v8-plans-grid">
        ${plansCard('saved-plans', 'plans', 'Saved & scheduled plans', 'Save, duplicate, compare, activate, and manage reusable seating plans.')}
        ${plansCard('activity-layouts', 'room', 'Activity layouts', 'Switch between rows, pods, discussion, independent work, labs, and other room arrangements.')}
        ${plansCard('testing-mode', 'review', 'Testing mode', 'Build test-ready spacing while preserving the placements and accessibility constraints that matter.')}
        ${plansCard('station-rotations', 'people', 'Station rotations', 'Plan teams, station assignments, and rotation sequences without scattering controls across the room toolbar.')}
        ${plansCard('planner-packs', 'sparkle', 'Planner packs', 'Open reusable bundles for common classroom planning scenarios and repeatable routines.')}
        ${plansCard('snapshot', 'plans', 'Snapshots & history', 'Capture a restorable point before a major change and use history when comparing classroom decisions.')}
      </div>`;
    (byId('mainWorkspace') || q('main.app'))?.appendChild(hub);
    return hub;
  }

  function createSheetControls() {
    if (!byId('v8SheetBackdrop')) {
      const backdrop = document.createElement('button');
      backdrop.id = 'v8SheetBackdrop';
      backdrop.className = 'v8-sheet-backdrop no-print';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Close panel');
      document.body.appendChild(backdrop);
    }
    const leftHeader = q('.left-panel>.panel-header');
    if (leftHeader && !leftHeader.querySelector('.v8-sheet-close')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'secondary tiny icon-button v8-sheet-close no-print';
      close.setAttribute('aria-label', 'Close roster panel');
      close.innerHTML = icon('close');
      leftHeader.appendChild(close);
    }
    const rightHeader = q('.right-panel>.panel-header');
    if (rightHeader && !rightHeader.querySelector('.v8-sheet-close')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'secondary tiny icon-button v8-sheet-close no-print';
      close.setAttribute('aria-label', 'Close review details');
      close.innerHTML = icon('close');
      rightHeader.appendChild(close);
    }
  }

  function createReviewActions() {
    const center = q('.center-panel');
    if (!center || byId('v8ReviewActions')) return;
    const row = document.createElement('div');
    row.id = 'v8ReviewActions';
    row.className = 'v8-review-actions no-print';
    row.innerHTML = `<button type="button" data-v8-action="presentation">Presentation mode</button><button class="secondary" type="button" data-v8-action="save">Save & backup</button><button class="secondary" type="button" data-v8-action="safe-share">Safe share</button><button class="secondary" type="button" data-v8-action="snapshot">Snapshot</button>`;
    const header = center.querySelector(':scope>.panel-header');
    if (header) header.insertAdjacentElement('afterend', row);
    else center.prepend(row);
  }

  function closeMobileSheets() {
    document.body.classList.remove('v8-mobile-roster-open', 'v8-mobile-review-open');
  }

  function renderContext() {
    const item = WORKSPACES[activeWorkspace] || WORKSPACES.class;
    const title = byId('v8ContextTitle');
    const desc = byId('v8ContextDescription');
    const eyebrow = byId('v8ContextEyebrow');
    if (title) title.textContent = item.title;
    if (desc) desc.textContent = item.description;
    if (eyebrow) eyebrow.textContent = `${item.label} · V8 workspace`;
    const host = byId('v8ContextActions');
    if (host) {
      host.replaceChildren();
      item.actions.forEach(([action, label, kind]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.v8Action = action;
        button.textContent = label;
        button.className = kind.includes('primary') ? '' : 'secondary';
        if (kind.includes('mobile-only')) button.classList.add('mobile-only');
        host.appendChild(button);
      });
    }
    document.querySelectorAll('.v8-nav-button[data-v8-workspace]').forEach(button => {
      const active = button.dataset.v8Workspace === activeWorkspace;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
  }

  function syncSeatRoster() {
    if (activeWorkspace !== 'seat') return;
    try { if (typeof setSideTab === 'function') setSideTab('students'); else click('studentsSideTabBtn'); } catch (_) { click('studentsSideTabBtn'); }
  }

  function workspaceFromWorkflow(workflow) {
    if (workflow === 'setup') return 'class';
    if (workflow === 'room') return 'room';
    if (workflow === 'seating') return 'seat';
    if (workflow === 'review' || workflow === 'share') return 'review';
    return 'class';
  }

  function switchWorkspace(key, options = {}) {
    if (!WORKSPACES[key]) key = 'class';
    if ((document.body.classList.contains('visibility-mode') || (typeof uiState !== 'undefined' && uiState?.visibilityMode)) && key !== 'review') key = 'review';
    activeWorkspace = key;
    document.body.dataset.v8Workspace = key;
    document.body.classList.add('v8-interface', 'v8-seat-tile-polish');
    document.body.dataset.v8PlansActive = key === 'plans' ? 'true' : 'false';
    closeMobileSheets();
    storageSet(key);
    const item = WORKSPACES[key];
    try {
      if (window.ProductExperience?.setWorkflow) ProductExperience.setWorkflow(item.workflow, { silent: Boolean(options.silent) });
    } catch (_) { /* V8 remains usable even if an older workflow bridge is unavailable */ }
    if (key === 'seat') syncSeatRoster();
    renderContext();
    if (!options.silent) {
      const main = byId('mainWorkspace') || q('main.app');
      main?.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
      announce(`${item.title} opened.`);
    }
    return key;
  }

  function openSeatRoster() {
    document.body.classList.remove('v8-mobile-review-open');
    document.body.classList.toggle('v8-mobile-roster-open');
  }

  function openReviewDetails() {
    document.body.classList.remove('v8-mobile-roster-open');
    document.body.classList.toggle('v8-mobile-review-open');
  }

  function invokeApi(path, fallbackId = '') {
    try {
      const parts = path.split('.');
      let value = window;
      for (const part of parts) value = value?.[part];
      if (typeof value === 'function') { value(); return true; }
    } catch (_) { /* fallback */ }
    return fallbackId ? click(fallbackId) : false;
  }

  function handleAction(action) {
    closeMobileSheets();
    if (action === 'add-student') {
      switchWorkspace('class', { silent:true });
      try { window.ClassSetupWorkspaceV54?.setSection?.('students'); } catch (_) { /* optional */ }
      click('studentsSideTabBtn');
      if (byId('addStudentBody')?.classList.contains('collapsed')) click('toggleAddStudentBtn');
      setTimeout(() => byId('firstName')?.focus?.(), 40);
      return;
    }
    if (action === 'import-roster') {
      switchWorkspace('class', { silent:true });
      try { window.ClassSetupWorkspaceV54?.setSection?.('import'); } catch (_) { /* optional */ }
      click('studentsSideTabBtn');
      if (byId('csvImportBody')?.classList.contains('collapsed')) click('toggleCsvImportBtn');
      setTimeout(() => byId('csvFile')?.focus?.(), 40);
      return;
    }
    if (action === 'class-rules') {
      switchWorkspace('class', { silent:true });
      try { window.ClassSetupWorkspaceV54?.setSection?.('rules'); } catch (_) { /* optional */ }
      click('groupsSideTabBtn');
      return;
    }
    if (action === 'room-tools') {
      if (typeof state !== 'undefined' && state?.layoutMode === 'freeform' && click('openFreeformWorkspaceBtn')) return;
      click('toggleLayoutToolsBtn');
      return;
    }
    if (action === 'room-templates') { click('openRoomTemplatesBtn'); return; }
    if (action === 'generate') { click('generateBtn'); return; }
    if (action === 'assistant') {
      try {
        if (window.InterfaceAssistantAuditV721?.setMode) InterfaceAssistantAuditV721.setMode('expanded', { announce:false });
        if (window.PlannerAssistantV710?.open) PlannerAssistantV710.open();
        else window.InterfaceAssistantAuditV721?.open?.();
      } catch (_) { /* optional */ }
      return;
    }
    if (action === 'seat-roster') { openSeatRoster(); return; }
    if (action === 'saved-plans') { click('openSeatingPlansBtn'); return; }
    if (action === 'today') { click('todayModeBtn'); return; }
    if (action === 'activity-layouts') { invokeApi('ActivityLayoutsV701.open'); return; }
    if (action === 'testing-mode') { invokeApi('TestingModeV703.open'); return; }
    if (action === 'station-rotations') { invokeApi('StationRotationsV702.open'); return; }
    if (action === 'planner-packs') { invokeApi('PlannerPacksV720.open'); return; }
    if (action === 'snapshot') { click('snapshotQuickBtn'); return; }
    if (action === 'analyze') { click('analyzeBtn'); return; }
    if (action === 'print') { click('printBtn'); return; }
    if (action === 'review-details') { openReviewDetails(); return; }
    if (action === 'presentation') { click('visibilityModeBtn'); return; }
    if (action === 'save') {
      try { if (typeof openSaveSetupModal === 'function') { openSaveSetupModal(); return; } } catch (_) { /* fallback */ }
      click('inlineSaveStatus');
      return;
    }
    if (action === 'safe-share') {
      try { window.ModernizationSuite?.openSafeShare?.(); } catch (_) { /* optional */ }
    }
  }

  function installEvents() {
    document.addEventListener('click', event => {
      const workspaceButton = event.target.closest?.('[data-v8-workspace]');
      if (workspaceButton) { switchWorkspace(workspaceButton.dataset.v8Workspace); return; }
      const actionButton = event.target.closest?.('[data-v8-action]');
      if (actionButton) { handleAction(actionButton.dataset.v8Action); return; }
      if (event.target.closest?.('#v8SheetBackdrop,.v8-sheet-close')) closeMobileSheets();
    }, true);
    document.addEventListener('keydown', event => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const key = ({ '1':'class', '2':'room', '3':'seat', '4':'plans', '5':'review' })[event.key];
      if (!key) return;
      event.preventDefault();
      switchWorkspace(key);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) closeMobileSheets();
    }, { passive:true });
  }

  function syncFromLegacyWorkflow() {
    if (document.body.dataset.v8PlansActive === 'true' && activeWorkspace === 'plans' && document.body.dataset.workflow === 'seating') return;
    if (document.body.classList.contains('visibility-mode') || (typeof uiState !== 'undefined' && uiState?.visibilityMode)) {
      if (activeWorkspace !== 'review') switchWorkspace('review', { silent:true });
      return;
    }
    const mapped = workspaceFromWorkflow(document.body.dataset.workflow || 'setup');
    if (mapped !== activeWorkspace) {
      activeWorkspace = mapped;
      document.body.dataset.v8Workspace = mapped;
      document.body.dataset.v8PlansActive = 'false';
      storageSet(mapped);
      renderContext();
    }
  }

  function observeInterface() {
    observer?.disconnect();
    observer = new MutationObserver(() => {
      if (mutationFrame) return;
      mutationFrame = requestAnimationFrame(() => {
        mutationFrame = 0;
        syncFromLegacyWorkflow();
        if (!byId('v8PlansHub')) createPlansHub();
        createSheetControls();
        createReviewActions();
      });
    });
    observer.observe(document.body, { attributes:true, attributeFilter:['class','data-workflow'], childList:true, subtree:true });
  }

  function audit() {
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id).filter(Boolean);
    const counts = new Map();
    ids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    const duplicateIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    const doc = document.documentElement;
    const navButtons = document.querySelectorAll('.v8-nav-button[data-v8-workspace]').length;
    const activeButtons = document.querySelectorAll('.v8-nav-button.active').length;
    const oldWorkflowVisible = (() => {
      const node = byId('v4WorkflowNav');
      if (!node) return false;
      return getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
    })();
    return {
      version: VERSION,
      workspace: activeWorkspace,
      navButtons,
      activeButtons,
      duplicateIds,
      oldWorkflowVisible,
      guideMeCount: document.querySelectorAll('.guided-context-button').length,
      horizontalOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth)
    };
  }

  function install() {
    if (installed) return;
    installed = true;
    installStyles();
    createNav();
    createContextBar();
    createPlansHub();
    createSheetControls();
    createReviewActions();
    installEvents();
    document.body.classList.add('v8-interface', 'v8-seat-tile-polish');
    let initial = storageGet();
    if (!WORKSPACES[initial]) initial = workspaceFromWorkflow(document.body.dataset.workflow || 'setup');
    if (document.body.classList.contains('visibility-mode') || (typeof uiState !== 'undefined' && uiState?.visibilityMode)) initial = 'review';
    switchWorkspace(initial, { silent:true });
    observeInterface();
  }

  function afterReady() {
    createPlansHub();
    createSheetControls();
    createReviewActions();
    renderContext();
    syncFromLegacyWorkflow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 0), { once:true });
  else setTimeout(install, 0);

  return Object.freeze({ version:VERSION, install, afterReady, switchWorkspace, current:() => activeWorkspace, handleAction, audit });
})();
