import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,t)=>fs.writeFileSync(p,t,'utf8');
const p='src/scripts/036-planner-assistant-v710.js';let a=read(p);
const r=(s,n)=>{if(!a.includes(s))throw new Error('missing '+s);a=a.replace(s,n)};
r("    if (/\\bstations?\\b.*\\b(rotat|rotation)|\\b(rotat|rotation)\\b.*\\bstations?\\b/.test(text))","    if (/\\bstations?\\b.*\\b(rotat|rotation)|\\b(rotat(?:e|es|ed|ing|ion)?)\\b.*\\bstations?\\b/.test(text))");
r("  function setDockHidden(hidden){uiPrefs.dockHidden=Boolean(hidden);saveUiPrefs();const d=document.getElementById(DOCK_ID);if(d)d.hidden=uiPrefs.dockHidden;const x=document.getElementById('plannerAssistantV710Restore');if(x)x.hidden=!uiPrefs.dockHidden||isPresentationMode()}","  function setDockHidden(hidden){uiPrefs.dockHidden=Boolean(hidden);saveUiPrefs();const d=document.getElementById(DOCK_ID);if(d){d.hidden=uiPrefs.dockHidden;d.classList.toggle('v710-hidden',uiPrefs.dockHidden)}const x=document.getElementById('plannerAssistantV710Restore');if(x){x.hidden=!uiPrefs.dockHidden||isPresentationMode();x.classList.toggle('v710-hidden',!uiPrefs.dockHidden||isPresentationMode())}}");
r(".v710-dock-label{white-space:nowrap;background:transparent!important;color:inherit!important;border-color:transparent!important;font-weight:900}.v710-restore",".v710-dock.v710-hidden,.v710-restore.v710-hidden{display:none!important}.v710-dock-label{white-space:nowrap;background:transparent!important;color:inherit!important;border-color:transparent!important;font-weight:900}.v710-restore");
write(p,a);
console.log('follow-up staged');
