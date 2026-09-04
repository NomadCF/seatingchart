const ClassroomWorkflowV53 = (() => {
  let installed = false;
  let marquee = null;
  let marqueeMode = false;
  let panState = null;
  const JOURNAL_KEY = 'classroomSeatingPlannerJournalV6';
  const PRESETS = [
    {
      id: 'pod-4', name: 'Four-seat pod', description: 'A shared table with four seats around it.', width: 520, height: 420,
      objects: [
        { type:'table', label:'Pod Table', x:150, y:120, width:220, height:150 },
        { type:'seat', x:170, y:0 }, { type:'seat', x:170, y:290 }, { type:'seat', x:0, y:135 }, { type:'seat', x:340, y:135 }
      ]
    },
    {
      id: 'testing-row', name: 'Testing row', description: 'Six evenly spaced seats in a straight row.', width: 1250, height: 150,
      objects: Array.from({length:6}, (_,index)=>({ type:'seat', x:index*210, y:0 }))
    },
    {
      id: 'teacher-station', name: 'Teacher station', description: 'Teacher desk, board, and projector arranged as a group.', width: 760, height: 350,
      objects: [
        { type:'board', label:'Front Board', x:80, y:0, width:600, height:55 },
        { type:'teacher', label:'Teacher Desk', x:260, y:150, width:240, height:120 },
        { type:'projector', label:'Projector', x:560, y:135, width:130, height:90 }
      ]
    },
    {
      id: 'lab-stations', name: 'Lab stations', description: 'Three tables with paired seats for a lab or makerspace.', width: 1000, height: 520,
      objects: [0,1,2].flatMap(index => {
        const x=index*330;
        return [
          { type:'table', label:`Lab ${index+1}`, x:x+55, y:125, width:220, height:130 },
          { type:'seat', x:x+75, y:0 }, { type:'seat', x:x+75, y:310 }
        ];
      })
    },
    {
      id: 'meeting-area', name: 'Meeting area', description: 'A carpet area with six seats around it.', width: 760, height: 650,
      objects: [
        { type:'carpet', label:'Meeting Area', x:170, y:150, width:420, height:310 },
        { type:'seat', x:0, y:220 }, { type:'seat', x:590, y:220 },
        { type:'seat', x:110, y:0 }, { type:'seat', x:450, y:0 },
        { type:'seat', x:110, y:500 }, { type:'seat', x:450, y:500 }
      ]
    },
    {
      id: 'ada-path', name: 'Accessible pathway', description: 'A clear central walkway with ADA spaces on both ends.', width: 850, height: 600,
      objects: [
        { type:'walkway', label:'Accessible Path', x:300, y:0, width:200, height:600 },
        { type:'ada', label:'ADA Space', x:20, y:180, width:220, height:180 },
        { type:'ada', label:'ADA Space', x:610, y:180, width:220, height:180 }
      ]
    }
  ];

  function activeToday() {
    state.todaySession = normalizeTodaySession(state.todaySession);
    return state.todaySession;
  }

  function clearAssignmentsForStudent(studentId) {
    const id = String(studentId || '');
    Object.values(state.cells || {}).forEach(cell => {
      if (String(cell.assignedStudentId || '') === id) {
        cell.assignedStudentId = null;
        cell.manual = false;
      }
    });
    (state.freeformLayout?.objects || []).forEach(obj => {
      if (obj.type === 'seat' && String(obj.assignedStudentId || '') === id) {
        obj.assignedStudentId = null;
        obj.manual = false;
      }
    });
  }

  function ensureTodayMasterSnapshot() {
    const today = activeToday();
    if (!today.masterAssignments) today.masterAssignments = snapshotAssignments();
    if (!today.startedAt) today.startedAt = new Date().toISOString();
    return today;
  }

  function renderTodayModal() {
    const today = activeToday();
    const activeToggle = el('todayModeActiveToggle');
    if (activeToggle) activeToggle.checked = today.active;
    if (el('todayModeStatus')) {
      const present = seatingStudents().length;
      const absent = today.absentStudentIds.length;
      el('todayModeStatus').textContent = today.active ? `Today mode active · ${present} present · ${absent} absent` : 'Today mode is off';
    }
    const list = el('todayAttendanceList');
    if (list) {
      const guests = new Set(today.guestStudentIds.map(String));
      const absent = new Set(today.absentStudentIds.map(String));
      const roster = (state.students || []).filter(student => !student.archived && !guests.has(String(student.id))).sort((a,b)=>studentDisplay(a).localeCompare(studentDisplay(b)));
      list.innerHTML = roster.length ? roster.map(student => `
            <label class="today-attendance-row${absent.has(String(student.id)) ? ' absent' : ''}">
              <span><strong>${escapeHtml(studentDisplay(student))}</strong>${student.grade ? `<small>${escapeHtml(student.grade)}</small>` : ''}</span>
              <span class="checkline"><input type="checkbox" data-today-absent-id="${escapeHtml(student.id)}" ${absent.has(String(student.id)) ? 'checked' : ''} /> Absent</span>
            </label>`).join('') : '<div class="restore-empty">Add students before recording attendance.</div>';
    }
    const guestList = el('todayGuestList');
    if (guestList) {
      const guests = (state.students || []).filter(student => today.guestStudentIds.includes(String(student.id)));
      guestList.innerHTML = guests.length ? guests.map(student => `<div class="settings-list-row"><span>${escapeHtml(studentDisplay(student))}</span><button class="tiny danger" type="button" data-remove-today-guest="${escapeHtml(student.id)}">Remove</button></div>`).join('') : '<div class="muted">No guests added.</div>';
    }
    if (el('todayNoteInput')) el('todayNoteInput').value = today.note || '';
  }

  function openTodayMode() {
    renderTodayModal();
    el('todayModeModal')?.classList.add('show');
  }

  function saveTodayMode() {
    const today = activeToday();
    const wasActive = today.active;
    today.active = Boolean(el('todayModeActiveToggle')?.checked);
    if (today.active) ensureTodayMasterSnapshot();
    today.absentStudentIds = Array.from(document.querySelectorAll('[data-today-absent-id]:checked')).map(input => String(input.dataset.todayAbsentId));
    today.note = String(el('todayNoteInput')?.value || '').trim().slice(0,1000);
    today.date = new Date().toISOString().slice(0,10);
    today.updatedAt = new Date().toISOString();
    if (today.active) today.absentStudentIds.forEach(clearAssignmentsForStudent);
    if (!today.active && wasActive && today.masterAssignments) restoreAssignments(today.masterAssignments);
    state.todaySession = today;
    renderAll();
    renderTodayModal();
    scheduleLinkedAutoSave('today-mode');
    setLiveStatusMessage(today.active ? 'Today mode saved. Absent students are excluded from generation.' : 'Today mode turned off.');
  }

  function addTodayGuest() {
    const name = String(el('todayGuestNameInput')?.value || '').trim();
    if (!name) return setLiveStatusMessage('Enter a guest name first.');
    const parts = name.split(/\s+/);
    const student = normalizeStudent({ id:uid('guest'), firstName:parts.shift() || name, lastName:parts.join(' '), todayGuest:true });
    state.students.push(student);
    const today = ensureTodayMasterSnapshot();
    today.active = true;
    today.guestStudentIds.push(String(student.id));
    today.guestStudentIds = Array.from(new Set(today.guestStudentIds));
    state.todaySession = today;
    if (el('todayGuestNameInput')) el('todayGuestNameInput').value = '';
    renderAll();
    renderTodayModal();
  }

  function removeTodayGuest(id) {
    const today = activeToday();
    clearAssignmentsForStudent(id);
    state.students = state.students.filter(student => String(student.id) !== String(id));
    today.guestStudentIds = today.guestStudentIds.filter(value => String(value) !== String(id));
    state.groups.forEach(group => group.studentIds = (group.studentIds || []).filter(value => String(value) !== String(id)));
    state.zones.forEach(zone => zone.studentIds = (zone.studentIds || []).filter(value => String(value) !== String(id)));
    state.todaySession = today;
    renderAll();
    renderTodayModal();
  }

  function restoreTodayMaster() {
    const today = activeToday();
    if (!today.masterAssignments) return setLiveStatusMessage('No master seating snapshot is stored for Today mode.');
    restoreAssignments(today.masterAssignments);
    renderAll();
    setLiveStatusMessage('Restored the master seating assignments. Today mode remains active.');
  }

  function endTodayMode() {
    const perform = () => {
      const today = activeToday();
      if (today.masterAssignments) restoreAssignments(today.masterAssignments);
      const guestIds = new Set(today.guestStudentIds.map(String));
      state.students = state.students.filter(student => !guestIds.has(String(student.id)));
      state.groups.forEach(group => group.studentIds = (group.studentIds || []).filter(id => !guestIds.has(String(id))));
      state.zones.forEach(zone => zone.studentIds = (zone.studentIds || []).filter(id => !guestIds.has(String(id))));
      state.todaySession = normalizeTodaySession({ active:false, date:new Date().toISOString().slice(0,10) });
      renderAll();
      renderTodayModal();
      setLiveStatusMessage('Today mode ended and the master seating chart was restored.');
    };
    if (typeof showInAppConfirm === 'function') {
      showInAppConfirm('End Today mode, remove temporary guests, and restore the master seating chart?', perform, { title:'End Today Mode', confirmText:'End Today Mode', cancelText:'Keep Today Mode' });
    } else perform();
  }

  function generateToday() {
    const today = activeToday();
    if (!today.active) {
      if (el('todayModeActiveToggle')) el('todayModeActiveToggle').checked = true;
      saveTodayMode();
    }
    today.absentStudentIds.forEach(clearAssignmentsForStudent);
    el('todayModeModal')?.classList.remove('show');
    ProductExperience?.setWorkflow?.('seating');
    setTimeout(()=>el('generateBtn')?.click(),50);
  }

  function saveSeatingPlan() {
    const name = String(el('seatingPlanNameInput')?.value || '').trim() || `Plan ${new Date().toLocaleDateString()}`;
    state.seatingPlans = (state.seatingPlans || []).map(plan => ({...plan,status:plan.status==='current'?'previous':plan.status}));
    const plan = normalizeSeatingPlan({
      id:uid('seating-plan'), name,
      reason:String(el('seatingPlanReasonInput')?.value || '').trim(),
      notes:String(el('seatingPlanNotesInput')?.value || '').trim(),
      status:'current', createdAt:new Date().toISOString(), layoutMode:state.layoutMode,
      rows:state.rows, cols:state.cols, cells:deepClone(state.cells), freeformLayout:deepClone(state.freeformLayout)
    }, state.seatingPlans.length);
    state.seatingPlans.unshift(plan);
    if (state.seatingPlans.length > 60) state.seatingPlans.length = 60;
    persistActiveClass();
    scheduleLinkedAutoSave('seating-plan');
    ['seatingPlanNameInput','seatingPlanReasonInput','seatingPlanNotesInput'].forEach(id=>{if(el(id))el(id).value='';});
    renderSeatingPlans();
    setLiveStatusMessage(`Saved named seating plan “${plan.name}”.`);
  }

  function planById(id) { return (state.seatingPlans || []).find(plan => String(plan.id) === String(id)); }

  function planAssignmentSnapshot(plan) {
    const snapshot = {};
    Object.entries(plan?.cells || {}).forEach(([key,cell]) => { snapshot[key] = { assignedStudentId:cell.assignedStudentId || null, manual:Boolean(cell.manual) }; });
    snapshot.__freeform = (plan?.freeformLayout?.objects || []).filter(obj=>obj.type==='seat').map(obj=>({ id:obj.id, cellKey:obj.cellKey || '', assignedStudentId:obj.assignedStudentId || null, manual:Boolean(obj.manual), locked:Boolean(obj.locked) }));
    return snapshot;
  }

  function restorePlanAssignments(id) {
    const plan = planById(id);
    if (!plan) return;
    pushUndoSnapshot('Before restoring named plan assignments');
    const snap = planAssignmentSnapshot(plan);
    Object.entries(state.cells || {}).forEach(([key,cell])=>{
      const saved=snap[key];
      if(saved){cell.assignedStudentId=saved.assignedStudentId;cell.manual=saved.manual;}
      else if(cell.type==='seat'){cell.assignedStudentId=null;cell.manual=false;}
    });
    const byId=new Map((snap.__freeform||[]).map(item=>[String(item.id),item]));
    const byCell=new Map((snap.__freeform||[]).filter(item=>item.cellKey).map(item=>[String(item.cellKey),item]));
    (state.freeformLayout?.objects||[]).forEach(obj=>{
      if(obj.type!=='seat')return;
      const saved=byId.get(String(obj.id))||byCell.get(String(obj.cellKey||''));
      obj.assignedStudentId=saved?.assignedStudentId||null;
      obj.manual=Boolean(saved?.manual);
      if(saved)obj.locked=Boolean(saved.locked);
    });
    renderAll();
    setLiveStatusMessage(`Restored assignments from “${plan.name}” without replacing the room.`);
  }

  function restoreFullPlan(id) {
    const plan = planById(id);
    if (!plan) return;
    pushUndoSnapshot('Before restoring named seating plan');
    state.rows=plan.rows;state.cols=plan.cols;state.cells=normalizeCellsRecord(plan.cells);state.layoutMode=plan.layoutMode;state.freeformLayout=normalizeFreeformLayout(plan.freeformLayout);
    resetFreeformGeometryCache();
    rememberFreeformGeometry(state.freeformLayout.objects || []);
    state.seatingPlans=(state.seatingPlans||[]).map(item=>({...item,status:String(item.id)===String(id)?'current':(item.status==='current'?'previous':item.status)}));
    renderAll();
    renderSeatingPlans();
    setLiveStatusMessage(`Restored the room and assignments from “${plan.name}”.`);
  }

  function renderSeatingPlans() {
    const plans=(state.seatingPlans||[]).map(normalizeSeatingPlan);
    state.seatingPlans=plans;
    const list=el('seatingPlansList');
    if(list) list.innerHTML=plans.length?plans.map(plan=>`<div class="seating-plan-row"><div class="seating-plan-main"><strong>${escapeHtml(plan.name)} <span class="pill">${escapeHtml(plan.status)}</span></strong><span>${escapeHtml(new Date(plan.createdAt).toLocaleString())}${plan.reason?` · ${escapeHtml(plan.reason)}`:''}</span>${plan.notes?`<p>${escapeHtml(plan.notes)}</p>`:''}</div><div class="seating-plan-actions"><button class="tiny secondary" type="button" data-plan-assignments="${escapeHtml(plan.id)}">Assignments only</button><button class="tiny secondary" type="button" data-plan-full="${escapeHtml(plan.id)}">Room + assignments</button><button class="tiny secondary" type="button" data-plan-archive="${escapeHtml(plan.id)}">${plan.status==='archived'?'Unarchive':'Archive'}</button><button class="tiny danger" type="button" data-plan-delete="${escapeHtml(plan.id)}">Delete</button></div></div>`).join(''):'<div class="restore-empty">No named seating plans saved yet.</div>';
    const options='<option value="">Choose a plan</option>'+plans.map(plan=>`<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)}</option>`).join('');
    ['comparePlanASelect','comparePlanBSelect'].forEach(id=>{if(el(id))el(id).innerHTML=options;});
  }

  function comparePlans() {
    const a=planById(el('comparePlanASelect')?.value);const b=planById(el('comparePlanBSelect')?.value);const out=el('seatingPlanComparison');
    if(!out)return;
    if(!a||!b){out.textContent='Choose two plans to compare.';return;}
    const map=plan=>{
      const result=new Map();Object.values(plan.cells||{}).forEach(cell=>{if(cell.assignedStudentId)result.set(String(cell.assignedStudentId),`Grid ${cell.row},${cell.col}`);});
      (plan.freeformLayout?.objects||[]).forEach(obj=>{if(obj.type==='seat'&&obj.assignedStudentId)result.set(String(obj.assignedStudentId),obj.label||`Freeform ${Math.round(obj.x)},${Math.round(obj.y)}`);});return result;
    };
    const ma=map(a),mb=map(b),ids=new Set([...ma.keys(),...mb.keys()]);let moved=0,added=0,removed=0;
    ids.forEach(id=>{if(!ma.has(id))added++;else if(!mb.has(id))removed++;else if(ma.get(id)!==mb.get(id))moved++;});
    const roomChanged=a.layoutMode!==b.layoutMode||a.rows!==b.rows||a.cols!==b.cols||(a.freeformLayout?.objects||[]).length!==(b.freeformLayout?.objects||[]).length;
    out.innerHTML=`<strong>${escapeHtml(a.name)} vs ${escapeHtml(b.name)}</strong><br>${moved} student(s) moved · ${added} added · ${removed} removed · Room ${roomChanged?'changed':'unchanged'}.`;
  }

  function renderPresets() {
    const grid=el('freeformPresetGrid');if(!grid)return;
    grid.innerHTML=PRESETS.map(preset=>`<article class="preset-card"><h3>${escapeHtml(preset.name)}</h3><p>${escapeHtml(preset.description)}</p><button type="button" data-insert-freeform-preset="${escapeHtml(preset.id)}">Insert preset</button></article>`).join('');
  }

  function insertPreset(id) {
    const preset=PRESETS.find(item=>item.id===id);if(!preset)return;
    ensureFreeformLayout();pushUndoSnapshot(`Before inserting ${preset.name}`);
    const zoom=freeformCanvasZoom();const scroller=freeformScroller();
    const baseX=freeformSnap(Math.max(20,((scroller?.scrollLeft||0)/zoom)+80));const baseY=freeformSnap(Math.max(20,((scroller?.scrollTop||0)/zoom)+80));
    const groupId=uid('freeform-group');state.freeformLayout.groups.push({id:groupId,name:preset.name,color:defaultGroupColor((state.freeformLayout.groups||[]).length+5),locked:false});
    const ids=[];
    preset.objects.forEach((spec,index)=>{const obj=normalizeFreeformObject({...spec,id:uid('freeform'),x:baseX+spec.x,y:baseY+spec.y,width:spec.width||(spec.type==='seat'?DEFAULT_FREEFORM_SEAT_WIDTH:160),height:spec.height||(spec.type==='seat'?DEFAULT_FREEFORM_SEAT_HEIGHT:110),groupId,zIndex:state.freeformLayout.nextZ++},state.freeformLayout.objects.length+index);state.freeformLayout.objects.push(obj);ids.push(obj.id);});
    uiState.freeformSelectedObjectIds=new Set(ids);rememberFreeformGeometry(state.freeformLayout.objects.filter(obj=>ids.includes(obj.id)));commitFreeformLayoutChange('freeform-insert-preset',{render:true});
    el('freeformPresetsModal')?.classList.remove('show');setLiveStatusMessage(`${preset.name} inserted as an editable group.`);
  }

  function selectedObjects() { const ids=uiState.freeformSelectedObjectIds||new Set();return (state.freeformLayout?.objects||[]).filter(obj=>ids.has(obj.id)); }

  function renderInspector() {
    const selected=selectedObjects();const inspector=el('freeformObjectInspector');const multi=el('freeformMultiSelectionTools');
    if(multi)multi.hidden=selected.length<2;
    if(!inspector)return;
    inspector.hidden=selected.length!==1;
    if(selected.length!==1)return;
    const obj=selected[0];if(el('freeformInspectorName'))el('freeformInspectorName').textContent=obj.label||objectLabel(obj.type);
    const values={freeformInspectorX:obj.x,freeformInspectorY:obj.y,freeformInspectorWidth:obj.width,freeformInspectorHeight:obj.height,freeformInspectorRotation:obj.rotation||0};
    Object.entries(values).forEach(([id,value])=>{if(el(id)&&document.activeElement!==el(id))el(id).value=Math.round(Number(value)||0);});
  }

  function applyInspector() {
    const selected=selectedObjects();if(selected.length!==1)return;const obj=selected[0];pushUndoSnapshot('Before editing freeform object geometry');
    obj.x=freeformSnap(Number(el('freeformInspectorX')?.value)||0);obj.y=freeformSnap(Number(el('freeformInspectorY')?.value)||0);
    obj.width=Math.max(obj.type==='seat'?MIN_FREEFORM_SEAT_WIDTH:20,Number(el('freeformInspectorWidth')?.value)||obj.width);obj.height=Math.max(obj.type==='seat'?MIN_FREEFORM_SEAT_HEIGHT:20,Number(el('freeformInspectorHeight')?.value)||obj.height);obj.rotation=Number(el('freeformInspectorRotation')?.value)||0;
    commitFreeformLayoutChange('freeform-inspector',{render:true});
  }

  function nudgeSelection(dx,dy,{raw=false}={}) {
    const selected=selectedObjects().filter(obj=>!obj.locked);if(!selected.length)return;
    pushUndoSnapshot('Before nudging freeform selection');const canvas=state.freeformLayout?.canvas||{};
    selected.forEach(obj=>{const maxX=Math.max(0,(Number(canvas.width)||2800)-obj.width);const maxY=Math.max(0,(Number(canvas.height)||1800)-obj.height);const nx=obj.x+dx,ny=obj.y+dy;obj.x=clampNumber(raw?nx:freeformSnap(nx),0,maxX);obj.y=clampNumber(raw?ny:freeformSnap(ny),0,maxY);});
    commitFreeformLayoutChange('freeform-keyboard-nudge',{render:true});
  }

  function syncMarqueeMode() {
    document.body.classList.toggle('freeform-marquee-mode',marqueeMode);
    const button=el('toggleFreeformMarqueeBtn');
    if(button){button.setAttribute('aria-pressed',marqueeMode?'true':'false');button.textContent=marqueeMode?'Exit select':'Box select';button.title=marqueeMode?'Exit box-selection mode':'Drag a box across multiple seats and room objects';}
  }

  function toggleMarqueeMode() {
    marqueeMode=!marqueeMode;
    if(marqueeMode&&document.body.classList.contains('freeform-pan-mode'))togglePan();
    syncMarqueeMode();
    setLiveStatusMessage(marqueeMode?'Box Select is on. Drag across seats and room objects; hold Shift to add to the selection.':'Box Select is off. Drag empty canvas to select, or drag an object to move it.');
  }

  function beginMarquee(event) {
    if(state.layoutMode!=='freeform'||document.body.classList.contains('freeform-pan-mode')||event.button!==0)return;
    if(isMobileViewport()&&(uiState.mobileRoomPanActive||document.body.dataset.workflow!=='room'))return;
    const grid=el('seatGrid');if(!grid||!grid.contains(event.target))return;
    if(event.target.closest('button,input,select,textarea,.freeform-minimap,.freeform-resize-handle,.freeform-rotate-handle'))return;
    const objectNode=event.target.closest('.freeform-object');
    if(objectNode&&!marqueeMode)return;
    const rect=grid.getBoundingClientRect(),zoom=freeformCanvasZoom();const startX=(event.clientX-rect.left)/zoom,startY=(event.clientY-rect.top)/zoom;
    const node=document.createElement('div');node.className='freeform-marquee show';grid.appendChild(node);marquee={grid,node,startX,startY,additive:event.shiftKey,forceSingle:event.altKey,zoom,startObjectId:objectNode?.dataset.objectId||''};event.preventDefault();event.stopImmediatePropagation();
    const move=ev=>{if(!marquee)return;const x=(ev.clientX-rect.left)/zoom,y=(ev.clientY-rect.top)/zoom;const left=Math.min(startX,x),top=Math.min(startY,y),width=Math.abs(x-startX),height=Math.abs(y-startY);Object.assign(node.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});marquee.bounds={x:left,y:top,right:left+width,bottom:top+height};};
    const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);finishMarquee();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});
  }

  function finishMarquee() {
    if(!marquee)return;const {node,bounds,additive,forceSingle,startObjectId}=marquee;node.remove();
    if(bounds&&bounds.right-bounds.x>4&&bounds.bottom-bounds.y>4){
      const hit=(state.freeformLayout?.objects||[]).filter(obj=>{const b=freeformObjectBounds(obj);const right=b.x+b.width,bottom=b.y+b.height;return b.x<bounds.right&&right>bounds.x&&b.y<bounds.bottom&&bottom>bounds.y;});
      const ids=new Set(hit.map(obj=>String(obj.id)));
      if(!forceSingle){const groupIds=new Set(hit.map(obj=>String(obj.groupId||'')).filter(Boolean));(state.freeformLayout?.objects||[]).forEach(obj=>{if(groupIds.has(String(obj.groupId||'')))ids.add(String(obj.id));});}
      uiState.freeformSelectedObjectIds=additive?new Set([...(uiState.freeformSelectedObjectIds||[]),...ids]):ids;
      uiState.suppressFreeformCanvasClick=true;
      updateFreeformSelectionVisuals();
      setLiveStatusMessage(`${ids.size} object${ids.size===1?'':'s'} selected. Use Group to keep them together while moving.`);
    } else if(startObjectId){
      uiState.suppressFreeformCanvasClick=true;
      selectFreeformObject(startObjectId,additive,forceSingle);
    } else if(!additive){
      uiState.suppressFreeformCanvasClick=true;
      selectFreeformObject(null);
    }
    marquee=null;
  }

  function togglePan() { const active=!document.body.classList.contains('freeform-pan-mode');document.body.classList.toggle('freeform-pan-mode',active);if(active&&marqueeMode){marqueeMode=false;syncMarqueeMode();}el('toggleFreeformPanBtn')?.setAttribute('aria-pressed',active?'true':'false');if(el('toggleFreeformPanBtn'))el('toggleFreeformPanBtn').textContent=active?'Exit pan':'Pan'; }
  function beginPan(event){if(!document.body.classList.contains('freeform-pan-mode')||event.button!==0)return;const grid=el('seatGrid'),scroller=freeformScroller();if(!grid||!scroller||!grid.contains(event.target))return;panState={x:event.clientX,y:event.clientY,left:scroller.scrollLeft,top:scroller.scrollTop,scroller};event.preventDefault();event.stopImmediatePropagation();const move=ev=>{if(!panState)return;panState.scroller.scrollLeft=panState.left-(ev.clientX-panState.x);panState.scroller.scrollTop=panState.top-(ev.clientY-panState.y);};const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);panState=null;};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});}

  function scrollElementWithinContainer(target, container) {
    if (!target || !container) return;
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const targetHeight = Math.max(0, targetRect.height || target.offsetHeight || 0);
    const availableHeight = Math.max(0, containerRect.height || container.clientHeight || 0);
    const offset = targetRect.top - containerRect.top - Math.max(0, (availableHeight - targetHeight) / 2);
    container.scrollTop = Math.max(0, container.scrollTop + offset);
  }

  function captureDocumentViewport() {
    const scrollingElement = document.scrollingElement || document.documentElement;
    return { left: Number(scrollingElement?.scrollLeft || 0), top: Number(scrollingElement?.scrollTop || 0) };
  }

  function restoreDocumentViewport(position) {
    const left = Number(position?.left || 0);
    const top = Number(position?.top || 0);
    const scrollingElement = document.scrollingElement || document.documentElement;
    if (scrollingElement) { scrollingElement.scrollLeft = left; scrollingElement.scrollTop = top; }
    document.documentElement.scrollLeft = left;
    document.documentElement.scrollTop = top;
    document.body.scrollLeft = left;
    document.body.scrollTop = top;
  }

  function renderSearch(query='') {
    const term=String(query||'').trim().toLowerCase();const results=[];
    (state.classes||[]).forEach(cls=>results.push({kind:'Class',title:cls.name,detail:`${(cls.students||[]).length} students`,run:()=>{persistActiveClass();state.activeClassId=cls.id;applyClassToState(cls.id);renderAll();ProductExperience?.setWorkflow?.('setup');}}));
    (state.students||[]).forEach(student=>results.push({kind:'Student',title:studentDisplay(student),detail:[student.grade,student.id].filter(Boolean).join(' · '),run:()=>{ProductExperience?.setWorkflow?.('setup');ClassSetupWorkspaceV54?.setSection?.('students');setSideTab('students');setTimeout(()=>{const card=document.querySelector(`.student-card[data-student-id="${cssEscape(student.id)}"]`);scrollElementWithinContainer(card,el('classSetupContent'));card?.classList.add('keyboard-selected');setTimeout(()=>card?.classList.remove('keyboard-selected'),1800);},80);}}));
    (state.groups||[]).forEach(item=>results.push({kind:'Rule',title:item.name,detail:objectLabel(item.type)||item.type,run:()=>{ProductExperience?.setWorkflow?.('setup');ClassSetupWorkspaceV54?.setSection?.('rules');setSideTab('groups');}}));
    (state.zones||[]).forEach(item=>results.push({kind:'Zone',title:item.name,detail:`${(item.studentIds||[]).length} linked students`,run:()=>{ProductExperience?.setWorkflow?.('setup');ClassSetupWorkspaceV54?.setSection?.('zones');setSideTab('zones');}}));
    (state.roomTemplates||[]).forEach(item=>results.push({kind:'Template',title:item.name,detail:'Room template',run:()=>el('openRoomTemplatesBtn')?.click()}));
    (state.seatingPlans||[]).forEach(item=>results.push({kind:'Plan',title:item.name,detail:item.reason||item.status,run:()=>{renderSeatingPlans();el('seatingPlansModal')?.classList.add('show');}}));
    const filtered=results.filter(item=>!term||`${item.kind} ${item.title} ${item.detail}`.toLowerCase().includes(term)).slice(0,80);const box=el('globalSearchResults');if(!box)return;
    box.innerHTML=filtered.length?filtered.map((item,index)=>`<button type="button" class="global-search-result" data-global-result="${index}"><span class="result-kind">${escapeHtml(item.kind)}</span><span class="result-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail||'')}</small></span><span>Open</span></button>`).join(''):'<div class="restore-empty">No matching classes, students, rules, zones, templates, or plans.</div>';box._results=filtered;
  }

  function renderImportProfiles() {
    const select=el('csvImportProfileSelect');if(!select)return;select.innerHTML='<option value="">No saved profile</option>'+(state.importProfiles||[]).map(profile=>`<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`).join('');
  }
  function currentCsvMapping(){const mapping={};document.querySelectorAll('[data-csv-map-field]').forEach(select=>{const idx=Number(select.value);mapping[select.dataset.csvMapField]=Number.isInteger(idx)&&idx>=0?(uiState.csvImportDraft?.headers?.[idx]||''):'';});return mapping;}
  function saveImportProfile(){
    if(!uiState.csvImportDraft)return;
    openTextInputModal({
      title:'Save CSV Mapping Profile',
      label:'Profile name',
      value:`Roster ${new Date().toLocaleDateString()}`,
      confirmText:'Save Profile',
      onConfirm:(name)=>{
        const profile=normalizeImportProfile({id:uid('import-profile'),name,mapping:currentCsvMapping(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
        state.importProfiles.push(profile);persistActiveClass();renderImportProfiles();
        if(el('csvImportProfileSelect'))el('csvImportProfileSelect').value=profile.id;
        setLiveStatusMessage(`Saved CSV import profile “${profile.name}”.`);
      }
    });
  }
  function applyImportProfile(){const profile=(state.importProfiles||[]).find(item=>String(item.id)===String(el('csvImportProfileSelect')?.value));if(!profile||!uiState.csvImportDraft)return;Object.entries(profile.mapping||{}).forEach(([key,header])=>{const select=el(`csvMap_${key}`);if(!select)return;const idx=uiState.csvImportDraft.headers.findIndex(value=>String(value).trim().toLowerCase()===String(header).trim().toLowerCase());select.value=idx>=0?String(idx):'';});renderCsvPreview();}
  function deleteImportProfile(){const id=el('csvImportProfileSelect')?.value;if(!id)return;state.importProfiles=(state.importProfiles||[]).filter(item=>String(item.id)!==String(id));persistActiveClass();renderImportProfiles();}

  async function createRecoveryKit(){const status=el('recoveryKitStatus');try{if(status)status.textContent='Creating encrypted recovery files…';const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);const secret=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');const plain=exportState('all');const encrypted=await encryptTextWithSecret(plain,secret,'offline-recovery-kit',{recoveryKit:true,createdAt:new Date().toISOString()});const date=new Date().toISOString().slice(0,10);downloadText(`classroom-seating-planner-recovery-${date}.json`,encrypted,'application/json');downloadText(`classroom-seating-planner-recovery-key-${date}.txt`,`Classroom Seating Planner Offline Recovery Key\n\n${secret}\n\nStore this key separately from the encrypted recovery file. Anyone with both can open the backup.\n`,'text/plain');if(status)status.textContent='Recovery backup and separate key downloaded. Store them in different secure locations.';}catch(error){if(status)status.textContent=`Recovery kit could not be created: ${error.message}`;}}

  function scheduleJournal(){clearTimeout(scheduleJournal.timer);scheduleJournal.timer=setTimeout(async()=>{if(!uiState.appReady||uiState.pageLocked)return;try{const plain=exportState('current');const payload=currentSessionEncryptionKey()?await encryptTextWithSecret(plain,currentSessionEncryptionKey(),'editing-journal',{journal:true,createdAt:new Date().toISOString()}):plain;safeStorageSet('localStorage',JOURNAL_KEY,JSON.stringify({createdAt:new Date().toISOString(),encrypted:Boolean(currentSessionEncryptionKey()),payload}));}catch(_){ }},1200);}

  function updateContextHint(){const hint=el('studentListContextHint');if(!hint)return;const workflow=document.body.dataset.workflow||'setup';if(workflow==='setup')hint.innerHTML='Use this list to manage roster records, notes, rules, and today\'s attendance. Seat placement happens in the <strong>Seat Students</strong> stage, where the chart is visible.';else if(workflow==='seating')hint.innerHTML='Select or drag a student from the visible seating workspace, then place them on a seat. Locked placements stay in place when generating new options.';else hint.textContent='Use this list to review roster details. Open Class Setup to edit students or Seat Students to place them.';}

  function decorateTodayUi(){const today=activeToday();document.body.classList.toggle('today-mode-active',today.active);el('todayModeBtn')?.setAttribute('aria-pressed',today.active?'true':'false');if(el('todayModeBtn'))el('todayModeBtn').textContent=today.active?`Today (${today.absentStudentIds.length} absent)`:'Today';const absent=new Set(today.absentStudentIds.map(String)),guests=new Set(today.guestStudentIds.map(String));document.querySelectorAll('[data-student-id]').forEach(node=>{const id=String(node.dataset.studentId||'');node.classList.toggle('today-absent-student',today.active&&absent.has(id));node.classList.toggle('today-guest-student',guests.has(id));});}

  function enhanceRenderedWorkspace(){updateContextHint();decorateTodayUi();renderInspector();renderImportProfiles();}

  function syncMoreToolsDisclosure(){
    const details=el('freeformAdvancedTools');
    const summary=details?.querySelector('summary');
    if(!details||!summary)return;
    summary.setAttribute('aria-expanded',details.open?'true':'false');
    summary.setAttribute('aria-label',details.open?'Collapse more Freeform tools':'Expand more Freeform tools');
  }

  function installEvents(){
    el('freeformAdvancedTools')?.addEventListener('toggle',syncMoreToolsDisclosure);syncMoreToolsDisclosure();
    el('todayModeBtn')?.addEventListener('click',openTodayMode);el('closeTodayModeBtn')?.addEventListener('click',()=>el('todayModeModal')?.classList.remove('show'));el('saveTodayModeBtn')?.addEventListener('click',saveTodayMode);el('addTodayGuestBtn')?.addEventListener('click',addTodayGuest);el('generateTodayBtn')?.addEventListener('click',generateToday);el('printTodayBtn')?.addEventListener('click',()=>{el('todayModeModal')?.classList.remove('show');el('printBtn')?.click();});el('restoreMasterFromTodayBtn')?.addEventListener('click',restoreTodayMaster);el('clearTodayModeBtn')?.addEventListener('click',endTodayMode);el('todayGuestList')?.addEventListener('click',event=>{const btn=event.target.closest('[data-remove-today-guest]');if(btn)removeTodayGuest(btn.dataset.removeTodayGuest);});
    el('openSeatingPlansBtn')?.addEventListener('click',()=>{renderSeatingPlans();el('seatingPlansModal')?.classList.add('show');});el('closeSeatingPlansBtn')?.addEventListener('click',()=>el('seatingPlansModal')?.classList.remove('show'));el('saveSeatingPlanBtn')?.addEventListener('click',saveSeatingPlan);el('compareSeatingPlansBtn')?.addEventListener('click',comparePlans);el('seatingPlansList')?.addEventListener('click',event=>{const a=event.target.closest('[data-plan-assignments]');const f=event.target.closest('[data-plan-full]');const d=event.target.closest('[data-plan-delete]');const ar=event.target.closest('[data-plan-archive]');if(a)restorePlanAssignments(a.dataset.planAssignments);if(f)restoreFullPlan(f.dataset.planFull);if(d){state.seatingPlans=(state.seatingPlans||[]).filter(plan=>String(plan.id)!==String(d.dataset.planDelete));persistActiveClass();renderSeatingPlans();}if(ar){const plan=planById(ar.dataset.planArchive);if(plan){plan.status=plan.status==='archived'?'previous':'archived';persistActiveClass();renderSeatingPlans();}}});
    el('openFreeformPresetsBtn')?.addEventListener('click',()=>{renderPresets();el('freeformPresetsModal')?.classList.add('show');});el('closeFreeformPresetsBtn')?.addEventListener('click',()=>el('freeformPresetsModal')?.classList.remove('show'));el('freeformPresetGrid')?.addEventListener('click',event=>{const btn=event.target.closest('[data-insert-freeform-preset]');if(btn)insertPreset(btn.dataset.insertFreeformPreset);});
    el('fitFreeformRoomInlineBtn')?.addEventListener('click',()=>el('fitFreeformRoomBtn')?.click());el('fitFreeformSelectionInlineBtn')?.addEventListener('click',()=>el('fitFreeformSelectionBtn')?.click());el('toggleFreeformMarqueeBtn')?.addEventListener('click',toggleMarqueeMode);el('toggleFreeformPanBtn')?.addEventListener('click',togglePan);el('applyFreeformInspectorBtn')?.addEventListener('click',applyInspector);document.querySelectorAll('[data-freeform-inline-arrange]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector(`[data-freeform-arrange="${cssEscape(btn.dataset.freeformInlineArrange)}"]`)?.click()));
    const setGlobalSearchOpen = open => {
      const modal = el('globalSearchModal');
      if (!modal) return;
      modal.classList.toggle('show', Boolean(open));
      DialogManager.synchronize();
      if (open) {
        const input = el('globalSearchInput');
        if (input) input.value = '';
        renderSearch('');
        setTimeout(() => input?.focus(), 0);
      }
    };
    el('globalSearchBtn')?.addEventListener('click',()=>setGlobalSearchOpen(true));
    el('closeGlobalSearchBtn')?.addEventListener('click',()=>setGlobalSearchOpen(false));
    el('globalSearchInput')?.addEventListener('input',event=>renderSearch(event.target.value));
    el('globalSearchResults')?.addEventListener('click',event=>{
      const btn=event.target.closest('[data-global-result]');
      const result=el('globalSearchResults')?._results?.[Number(btn?.dataset.globalResult)];
      if(result){
        const viewport = captureDocumentViewport();
        setGlobalSearchOpen(false);
        result.run();
        restoreDocumentViewport(viewport);
        requestAnimationFrame(()=>restoreDocumentViewport(viewport));
      }
    });
    el('saveCsvImportProfileBtn')?.addEventListener('click',saveImportProfile);el('applyCsvImportProfileBtn')?.addEventListener('click',applyImportProfile);el('deleteCsvImportProfileBtn')?.addEventListener('click',deleteImportProfile);
    el('openRecoveryKitBtn')?.addEventListener('click',()=>{el('saveSetupModal')?.classList.remove('show');el('recoveryKitModal')?.classList.add('show');});el('closeRecoveryKitBtn')?.addEventListener('click',()=>el('recoveryKitModal')?.classList.remove('show'));el('createRecoveryKitBtn')?.addEventListener('click',createRecoveryKit);
    el('seatGrid')?.addEventListener('pointerdown',beginMarquee,true);el('seatGrid')?.addEventListener('pointerdown',beginPan,true);
    document.addEventListener('keydown',event=>{if(state.layoutMode!=='freeform'||event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('.modal-backdrop.show'))return;if(event.key==='Escape'&&marqueeMode){event.preventDefault();marqueeMode=false;syncMarqueeMode();return;}const selected=selectedObjects();if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selected.length){event.preventDefault();const base=event.altKey?1:(event.shiftKey?Math.max(10,Number(state.freeformLayout?.canvas?.gridSize)||40)*5:Math.max(5,Number(state.freeformLayout?.canvas?.gridSize)||40));nudgeSelection(event.key==='ArrowLeft'?-base:event.key==='ArrowRight'?base:0,event.key==='ArrowUp'?-base:event.key==='ArrowDown'?base:0,{raw:event.altKey});}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='d'&&selected.length){event.preventDefault();duplicateSelectedFreeformObject();}else if(event.key.toLowerCase()==='l'&&selected.length){event.preventDefault();el('lockFreeformObjectBtn')?.click();}else if(event.key.toLowerCase()==='r'&&selected.length===1){event.preventDefault();rotateFreeformObject(selected[0].id,event.shiftKey?-15:15);}else if((event.key==='Delete'||event.key==='Backspace')&&selected.length){event.preventDefault();deleteSelectedFreeformObject();}else if(event.key.toLowerCase()==='p'&&event.altKey){event.preventDefault();togglePan();}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();el('globalSearchBtn')?.click();}},true);
    ['input','change'].forEach(type=>document.addEventListener(type,event=>{if(event.target.closest('input,textarea,select'))scheduleJournal();},true));document.addEventListener('click',event=>{if(event.target.closest('button'))scheduleJournal();},true);
  }

  function install(){if(installed)return;installed=true;installEvents();syncMarqueeMode();document.body.dataset.classroomWorkflow=APP_REVISION;}
  function afterReady(){enhanceRenderedWorkspace();renderSeatingPlans();renderImportProfiles();}
  return Object.freeze({install,afterReady,enhanceRenderedWorkspace,openTodayMode,openSeatingPlans:()=>{renderSeatingPlans();el('seatingPlansModal')?.classList.add('show');},openGlobalSearch:()=>el('globalSearchBtn')?.click(),openPresets:()=>el('openFreeformPresetsBtn')?.click()});
})();

