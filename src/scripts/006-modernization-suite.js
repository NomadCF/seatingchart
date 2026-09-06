const ModernizationSuite = (() => {
  let installed = false;
  let reconcileDraft = null;
  let selectedCandidateIndex = -1;
  let safeSharePreset = '';

  function requirementOptions(studentId = '') {
    const zoneOptions = [...(state.zones || [])].sort((a,b) => a.name.localeCompare(b.name));
    const studentOptions = [...(state.students || [])].filter(student => String(student.id) !== String(studentId)).sort((a,b) => studentDisplay(a).localeCompare(studentDisplay(b)));
    return { zoneOptions, studentOptions };
  }

  function setMultiSelectValues(select, values) {
    const wanted = new Set((values || []).map(String));
    Array.from(select?.options || []).forEach(option => { option.selected = wanted.has(String(option.value)); });
  }

  function populateStudentRequirements(student) {
    const requirements = normalizeStudent(student || {}).requirements;
    const { zoneOptions, studentOptions } = requirementOptions(student?.id || '');
    const preferred = el('editRequirementPreferredZones');
    const excluded = el('editRequirementExcludedZones');
    const distance = el('editRequirementDistanceStudents');
    const zoneHtml = zoneOptions.map(zone => `<option value="${escapeHtml(zone.id)}">${escapeHtml(zone.name)}</option>`).join('');
    if (preferred) preferred.innerHTML = zoneHtml;
    if (excluded) excluded.innerHTML = zoneHtml;
    if (distance) distance.innerHTML = studentOptions.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(studentDisplay(item))}</option>`).join('');
    if (el('editRequirementFront')) el('editRequirementFront').value = requirements.front || 'none';
    if (el('editRequirementSide')) el('editRequirementSide').value = requirements.side || 'none';
    if (el('editRequirementNearTeacher')) el('editRequirementNearTeacher').checked = Boolean(requirements.nearTeacher);
    if (el('editRequirementAisle')) el('editRequirementAisle').checked = Boolean(requirements.aisle);
    if (el('editRequirementAda')) el('editRequirementAda').checked = Boolean(requirements.ada);
    if (el('editRequirementAwayDoor')) el('editRequirementAwayDoor').checked = Boolean(requirements.awayDoor);
    if (el('editRequirementAwayWindow')) el('editRequirementAwayWindow').checked = Boolean(requirements.awayWindow);
    setMultiSelectValues(preferred, requirements.preferredZoneIds);
    setMultiSelectValues(excluded, requirements.excludedZoneIds);
    setMultiSelectValues(distance, requirements.minDistanceStudentIds);
  }

  function readStudentRequirements(studentId = '') {
    return {
      front: el('editRequirementFront')?.value || 'none',
      side: el('editRequirementSide')?.value || 'none',
      nearTeacher: Boolean(el('editRequirementNearTeacher')?.checked),
      aisle: Boolean(el('editRequirementAisle')?.checked),
      ada: Boolean(el('editRequirementAda')?.checked),
      awayDoor: Boolean(el('editRequirementAwayDoor')?.checked),
      awayWindow: Boolean(el('editRequirementAwayWindow')?.checked),
      preferredZoneIds: selectedOptionValues(el('editRequirementPreferredZones')),
      excludedZoneIds: selectedOptionValues(el('editRequirementExcludedZones')),
      minDistanceStudentIds: selectedOptionValues(el('editRequirementDistanceStudents')).filter(id => id !== String(studentId))
    };
  }

  function requirementCount(student) {
    const r = normalizeStudent(student || {}).requirements;
    return [r.front !== 'none', r.side !== 'none', r.nearTeacher, r.aisle, r.ada, r.awayDoor, r.awayWindow, r.preferredZoneIds.length, r.excludedZoneIds.length, r.minDistanceStudentIds.length].reduce((sum, value) => sum + (value ? 1 : 0), 0);
  }

  function studentRequirementPills(student) {
    const count = requirementCount(student);
    return count ? `<span class="pill special" title="${count} individual seating requirement${count === 1 ? '' : 's'}">${count} requirement${count === 1 ? '' : 's'}</span>` : '';
  }

  function nearestObjectDistance(cell, type) {
    const targets = Object.values(state.cells || {}).filter(item => item.type === type);
    if (!targets.length) return 999;
    return Math.min(...targets.map(target => distance(cell, target)));
  }

  function cellAt(row, col) {
    return state.cells[keyOf(row, col)] || null;
  }

  function isAisleSeat(cell) {
    if (!cell) return false;
    if (Number(cell.col) === 1 || Number(cell.col) === Number(state.cols) || Number(cell.row) === 1 || Number(cell.row) === Number(state.rows)) return true;
    return [[-1,0],[1,0],[0,-1],[0,1]].some(([dr,dc]) => ['walkway','empty'].includes(cellAt(Number(cell.row)+dr, Number(cell.col)+dc)?.type));
  }

  function nearAda(cell) {
    return nearestObjectDistance(cell, 'ada') <= 1.5 || (cell.zoneIds || []).some(id => /ada|access/i.test(zoneById(id)?.name || ''));
  }

  function requirementScore(studentId, cell, details = null) {
    const student = getStudent(studentId);
    if (!student || !cell) return 0;
    const r = normalizeStudent(student).requirements;
    const rowRatio = (Number(cell.row) - 1) / Math.max(1, Number(state.rows) - 1);
    const colRatio = (Number(cell.col) - 1) / Math.max(1, Number(state.cols) - 1);
    let score = 0;
    const add = (value, text, kind = 'neutral') => { score += value; if (details) details.push({ value, text, kind }); };
    if (r.front === 'prefer') add(rowRatio * 180, rowRatio <= .35 ? 'Matches the preferred front area.' : 'Farther from the front than preferred.', rowRatio <= .35 ? 'good' : 'warn');
    if (r.front === 'require') add(rowRatio <= .42 ? -220 : 6000, rowRatio <= .42 ? 'Meets the required front-area placement.' : 'Does not meet the required front-area placement.', rowRatio <= .42 ? 'good' : 'bad');
    if (r.side === 'left') add(colRatio * 90, colRatio <= .45 ? 'Matches the preferred left side.' : 'Farther right than preferred.', colRatio <= .45 ? 'good' : 'warn');
    if (r.side === 'right') add((1 - colRatio) * 90, colRatio >= .55 ? 'Matches the preferred right side.' : 'Farther left than preferred.', colRatio >= .55 ? 'good' : 'warn');
    if (r.nearTeacher) {
      const d = nearestObjectDistance(cell, 'teacher');
      add(d * 85, d <= 2 ? 'Near the teacher area.' : 'Not especially close to the teacher area.', d <= 2 ? 'good' : 'warn');
    }
    if (r.aisle) add(isAisleSeat(cell) ? -120 : 180, isAisleSeat(cell) ? 'Located on an aisle or room edge.' : 'Not located on an aisle or room edge.', isAisleSeat(cell) ? 'good' : 'warn');
    if (r.ada) add(nearAda(cell) ? -260 : 7000, nearAda(cell) ? 'Meets the ADA/accessibility area requirement.' : 'Does not meet the ADA/accessibility area requirement.', nearAda(cell) ? 'good' : 'bad');
    if (r.awayDoor) {
      const d = nearestObjectDistance(cell, 'door');
      add(d < 3 ? (3 - d) * 180 : -40, d >= 3 ? 'Away from the door as requested.' : 'Closer to the door than requested.', d >= 3 ? 'good' : 'warn');
    }
    if (r.awayWindow) {
      const d = nearestObjectDistance(cell, 'window');
      add(d < 3 ? (3 - d) * 150 : -30, d >= 3 ? 'Away from windows as requested.' : 'Closer to a window than requested.', d >= 3 ? 'good' : 'warn');
    }
    const zoneIds = new Set((cell.zoneIds || []).map(String));
    if (r.preferredZoneIds.length) {
      const matched = r.preferredZoneIds.some(id => zoneIds.has(String(id)));
      add(matched ? -180 : 220, matched ? 'Inside a preferred zone.' : 'Outside the preferred zones.', matched ? 'good' : 'warn');
    }
    if (r.excludedZoneIds.length) {
      const excluded = r.excludedZoneIds.some(id => zoneIds.has(String(id)));
      add(excluded ? 6500 : -80, excluded ? 'Inside an excluded zone.' : 'Outside all excluded zones.', excluded ? 'bad' : 'good');
    }
    r.minDistanceStudentIds.forEach(otherId => {
      const otherSeat = assignedSeatForStudent(otherId);
      if (!otherSeat) return;
      const d = distance(cell, otherSeat);
      add(d < 3 ? (3 - d) * 1800 : -60, d >= 3 ? `Maintains distance from ${studentDisplay(getStudent(otherId))}.` : `Too close to ${studentDisplay(getStudent(otherId))}.`, d >= 3 ? 'good' : 'bad');
    });
    return score;
  }

  function buildGeneratorSeats() {
    const median = values => {
      const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
      if (!sorted.length) return 1;
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const pointDistance = (a, b, scale = 1) => Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.y || 0) - Number(b.y || 0)) / Math.max(1, scale);

    if (state.layoutMode === 'freeform') {
      ensureFreeformLayout();
      const layout = state.freeformLayout;
      const canvas = layout.canvas || {};
      const seatObjects = freeformSeatObjectsSorted();
      const referenceScale = Math.max(60, median(seatObjects.map(obj => ((Number(obj.width) || DEFAULT_FREEFORM_SEAT_WIDTH) + (Number(obj.height) || DEFAULT_FREEFORM_SEAT_HEIGHT)) / 2)));
      const roomObjects = (layout.objects || []).filter(obj => obj.type !== 'seat').map(obj => ({
        ...obj,
        center: freeformSeatCenter(obj)
      }));
      const distanceToType = (center, type) => {
        const targets = roomObjects.filter(obj => obj.type === type);
        return targets.length ? Math.min(...targets.map(target => pointDistance(center, target.center, referenceScale))) : 999;
      };
      const frontSide = freeformRoomFrontSide();
      const accessibleZoneIds = new Set((state.zones || []).filter(zone => /\b(ada|access|accessible|mobility)\b/i.test(String(zone.name || ''))).map(zone => String(zone.id)));
      const width = Math.max(1, Number(canvas.width) || 2800);
      const height = Math.max(1, Number(canvas.height) || 1800);
      return seatObjects.map((obj, index) => {
        const center = freeformSeatCenter(obj);
        const xRatio = Math.max(0, Math.min(1, center.x / width));
        const yRatio = Math.max(0, Math.min(1, center.y / height));
        let frontRatio = yRatio;
        let sideRatio = xRatio;
        if (frontSide === 'bottom') frontRatio = 1 - yRatio;
        if (frontSide === 'left') { frontRatio = xRatio; sideRatio = yRatio; }
        if (frontSide === 'right') { frontRatio = 1 - xRatio; sideRatio = yRatio; }
        const walkwayDistance = distanceToType(center, 'walkway');
        return {
          key: String(obj.cellKey || `freeform-seat-${index + 1}`),
          label: String(obj.label || `Seat ${index + 1}`),
          row: Number(obj.cellKey && state.cells[obj.cellKey]?.row) || index + 1,
          col: Number(obj.cellKey && state.cells[obj.cellKey]?.col) || 1,
          ruleX: center.x / referenceScale,
          ruleY: center.y / referenceScale,
          previewX: xRatio,
          previewY: yRatio,
          frontRatio,
          sideRatio,
          zoneIds: [...(obj.zoneIds || [])],
          anchorGroupIds: [...(obj.anchorGroupIds || [])],
          assignedStudentId: obj.assignedStudentId || null,
          manual: Boolean(obj.manual || obj.locked),
          edge: sideRatio <= .12 || sideRatio >= .88 || frontRatio <= .12 || frontRatio >= .88 || walkwayDistance <= 1.5,
          teacherDistance: distanceToType(center, 'teacher'),
          boardDistance: Math.min(distanceToType(center, 'board'), distanceToType(center, 'projector')),
          doorDistance: distanceToType(center, 'door'),
          windowDistance: distanceToType(center, 'window'),
          nearAda: distanceToType(center, 'ada') <= 1.5 || (obj.zoneIds || []).some(id => accessibleZoneIds.has(String(id))),
          freeform: true
        };
      });
    }

    const teacherCells = Object.values(state.cells || {}).filter(cell => cell.type === 'teacher');
    const boardCells = Object.values(state.cells || {}).filter(cell => ['board','projector'].includes(cell.type));
    const doorCells = Object.values(state.cells || {}).filter(cell => cell.type === 'door');
    const windowCells = Object.values(state.cells || {}).filter(cell => cell.type === 'window');
    const adaCells = Object.values(state.cells || {}).filter(cell => cell.type === 'ada');
    const accessibleZoneIds = new Set((state.zones || []).filter(zone => /\b(ada|access|accessible|mobility)\b/i.test(String(zone.name || ''))).map(zone => String(zone.id)));
    return Object.entries(state.cells || {}).filter(([,cell]) => cell.type === 'seat').map(([key, cell]) => ({
      key,
      label: `Seat ${cell.row},${cell.col}`,
      row: Number(cell.row) || 1,
      col: Number(cell.col) || 1,
      ruleX: Number(cell.col) || 1,
      ruleY: Number(cell.row) || 1,
      previewX: (Number(cell.col) - .5) / Math.max(1, Number(state.cols)),
      previewY: (Number(cell.row) - .5) / Math.max(1, Number(state.rows)),
      frontRatio: (Number(cell.row) - 1) / Math.max(1, Number(state.rows) - 1),
      sideRatio: (Number(cell.col) - 1) / Math.max(1, Number(state.cols) - 1),
      zoneIds: [...(cell.zoneIds || [])],
      anchorGroupIds: [...(cell.anchorGroupIds || [])],
      assignedStudentId: cell.assignedStudentId || null,
      manual: Boolean(cell.manual),
      edge: Number(cell.row) === 1 || Number(cell.col) === 1 || Number(cell.row) === Number(state.rows) || Number(cell.col) === Number(state.cols) || isAisleSeat(cell),
      teacherDistance: teacherCells.length ? Math.min(...teacherCells.map(target => distance(cell, target))) : 999,
      boardDistance: boardCells.length ? Math.min(...boardCells.map(target => distance(cell, target))) : 999,
      doorDistance: doorCells.length ? Math.min(...doorCells.map(target => distance(cell, target))) : 999,
      windowDistance: windowCells.length ? Math.min(...windowCells.map(target => distance(cell, target))) : 999,
      nearAda: (adaCells.length ? Math.min(...adaCells.map(target => distance(cell, target))) <= 1.5 : false) || (cell.zoneIds || []).some(id => accessibleZoneIds.has(String(id))),
      freeform: false
    }));
  }


  function generatorWorkerSource() {
    return `
          const hashSeed = value => { let h=2166136261>>>0; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; };
          const rngFor = value => { let a=hashSeed(value)||1; return () => { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
          const shuffle = (items,rng) => { const out=[...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
          const dist=(a,b)=>Math.hypot((Number.isFinite(a.ruleY)?a.ruleY:(a.row||0))-(Number.isFinite(b.ruleY)?b.ruleY:(b.row||0)),(Number.isFinite(a.ruleX)?a.ruleX:(a.col||0))-(Number.isFinite(b.ruleX)?b.ruleX:(b.col||0)));
          const ratio=(value,fallback)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
          const pairs=items=>{const out=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)out.push([items[i],items[j]]);return out;};
          function solve(payload){
            const {students,groups,seats,rows,cols,attempts,candidateCount,seed,mode,currentAssignments,excludedSignatures=[]}=payload;
            const studentById=new Map(students.map(s=>[String(s.id),s]));
            const seatByKey=new Map(seats.map(s=>[String(s.key),s]));
            const memberships=new Map(students.map(s=>[String(s.id),groups.filter(b=>(b.studentIds||[]).map(String).includes(String(s.id)))]));
            const currentByStudent=new Map(Object.entries(currentAssignments||{}).map(([seat,id])=>[String(id||''),String(seat)]));
            const fixed=new Map(); seats.forEach(seat=>{if(seat.manual&&seat.assignedStudentId)fixed.set(String(seat.key),String(seat.assignedStudentId));});
            const results=[]; const signatures=new Set((excludedSignatures||[]).map(String));
            const scoreSeat=(student,seat,assigned,rng)=>{
              const r=student.requirements||{}; let penalty=0;
              const frontRatio=ratio(seat.frontRatio,(seat.row-1)/Math.max(1,rows-1));
              const sideRatio=ratio(seat.sideRatio,(seat.col-1)/Math.max(1,cols-1));
              if(r.front==='prefer')penalty+=frontRatio*180;
              if(r.front==='require'&&frontRatio>.42)penalty+=6000;
              if(r.side==='left')penalty+=sideRatio*90;
              if(r.side==='right')penalty+=(1-sideRatio)*90;
              if(r.nearTeacher)penalty+=Math.min(20,seat.teacherDistance)*85;
              if(r.aisle&&!seat.edge)penalty+=180;
              if(r.ada&&!seat.nearAda)penalty+=7000;
              if(r.awayDoor&&seat.doorDistance<3)penalty+=(3-seat.doorDistance)*180;
              if(r.awayWindow&&seat.windowDistance<3)penalty+=(3-seat.windowDistance)*150;
              const zones=new Set((seat.zoneIds||[]).map(String));
              const memberGroupIds=new Set((memberships.get(String(student.id))||[]).map(group=>String(group.id)));
              if((seat.anchorGroupIds||[]).length&&!(seat.anchorGroupIds||[]).some(id=>memberGroupIds.has(String(id))))penalty+=9000;
              if((r.preferredZoneIds||[]).length&&!(r.preferredZoneIds||[]).some(id=>zones.has(String(id))))penalty+=220;
              if((r.excludedZoneIds||[]).some(id=>zones.has(String(id))))penalty+=6500;
              for(const otherId of r.minDistanceStudentIds||[]){const other=seatByKey.get(String(assigned.get(String(otherId))||''));if(other){const d=dist(seat,other);if(d<3)penalty+=(3-d)*1800;}}
              for(const group of memberships.get(String(student.id))||[]){
                const priority=Number(group.priority||1);
                const assignedMembers=(group.studentIds||[]).map(String).filter(id=>id!==String(student.id)&&assigned.has(id)).map(id=>seatByKey.get(String(assigned.get(id)))).filter(Boolean);
                if((group.type==='together'||group.type==='special')&&assignedMembers.length)penalty+=Math.min(...assignedMembers.map(other=>dist(seat,other)))*priority*24;
                if((group.type==='avoid'||group.type==='spread')&&assignedMembers.length){const d=Math.min(...assignedMembers.map(other=>dist(seat,other)));if(d<3)penalty+=(3-d)*priority*180;}
                if(group.type==='front')penalty+=frontRatio*priority*24;
                if(group.type==='back')penalty+=(1-frontRatio)*priority*24;
                if(group.type==='nearTeacher')penalty+=Math.min(20,seat.teacherDistance)*priority*18;
                if(group.type==='nearBoard')penalty+=Math.min(20,seat.boardDistance)*priority*18;
                if(group.type==='awayDoor'&&seat.doorDistance<3)penalty+=(3-seat.doorDistance)*priority*70;
                if(group.type==='awayWindow'&&seat.windowDistance<3)penalty+=(3-seat.windowDistance)*priority*60;
                if(group.zoneId&&!zones.has(String(group.zoneId)))penalty+=priority*120;
                if((group.anchorSeats||[]).length&&!(group.anchorSeats||[]).map(String).includes(String(seat.key)))penalty+=priority*90;
                if((seat.anchorGroupIds||[]).length&&!(seat.anchorGroupIds||[]).map(String).includes(String(group.id)))penalty+=priority*130;
              }
              return penalty+rng()*3;
            };
            const requirementMetrics=assigned=>{
              let total=0,met=0,hard=0;const issues=[];
              const check=(student,label,ok,isHard=false)=>{total++;if(ok)met++;else{if(isHard)hard++;issues.push({studentId:String(student.id),studentName:[student.firstName,student.lastName].filter(Boolean).join(' ')||String(student.id),label,hard:isHard});}};
              for(const student of students){
                const seat=seatByKey.get(String(assigned.get(String(student.id))||''));
                if(!seat){check(student,'Student is not assigned to a seat.',false,true);continue;}
                const r=student.requirements||{};const front=ratio(seat.frontRatio,(seat.row-1)/Math.max(1,rows-1));const side=ratio(seat.sideRatio,(seat.col-1)/Math.max(1,cols-1));const zones=new Set((seat.zoneIds||[]).map(String));
                if(r.front==='prefer')check(student,'Preferred front area',front<=.35,false);
                if(r.front==='require')check(student,'Required front area',front<=.42,true);
                if(r.side==='left')check(student,'Preferred left side',side<=.45,false);
                if(r.side==='right')check(student,'Preferred right side',side>=.55,false);
                if(r.nearTeacher)check(student,'Near teacher area',seat.teacherDistance<=2.5,false);
                if(r.aisle)check(student,'Aisle or room-edge seat',Boolean(seat.edge),false);
                if(r.ada)check(student,'ADA/accessibility area',Boolean(seat.nearAda),true);
                if(r.awayDoor)check(student,'Away from door',seat.doorDistance>=3,false);
                if(r.awayWindow)check(student,'Away from window',seat.windowDistance>=3,false);
                if((r.preferredZoneIds||[]).length)check(student,'Preferred zone',(r.preferredZoneIds||[]).some(id=>zones.has(String(id))),false);
                if((r.excludedZoneIds||[]).length)check(student,'Outside excluded zones',!(r.excludedZoneIds||[]).some(id=>zones.has(String(id))),true);
                for(const otherId of r.minDistanceStudentIds||[]){const other=seatByKey.get(String(assigned.get(String(otherId))||''));if(other)check(student,'Distance from '+([studentById.get(String(otherId))?.firstName,studentById.get(String(otherId))?.lastName].filter(Boolean).join(' ')||String(otherId)),dist(seat,other)>=3,true);}
              }
              return {total,met,hard,issues};
            };
            const groupMetrics=assigned=>{
              let total=0,met=0;const details=[];
              for(const group of groups){
                const memberIds=(group.studentIds||[]).map(String).filter(id=>studentById.has(id));
                const memberSeats=memberIds.map(id=>seatByKey.get(String(assigned.get(id)||''))).filter(Boolean);
                if(!memberIds.length)continue;
                let applicable=true,ok=true,summary='';
                const priority=Number(group.priority||1);const seatPairs=pairs(memberSeats);const distances=seatPairs.map(([a,b])=>dist(a,b));const zonesFor=seat=>new Set((seat.zoneIds||[]).map(String));
                if(memberSeats.length!==memberIds.length){ok=false;summary=String(memberIds.length-memberSeats.length)+' member(s) are not seated.';}
                else if((group.type==='together'||group.type==='special')&&memberSeats.length>=2){const max=Math.max(...distances);ok=max<=4;summary=ok?'Members stay within the nearby target.':'Farthest members are '+max.toFixed(1)+' seat widths apart.';}
                else if((group.type==='avoid'||group.type==='spread')&&memberSeats.length>=2){const min=Math.min(...distances);ok=min>=3;summary=ok?'Members maintain the separation target.':'Closest members are '+min.toFixed(1)+' seat widths apart.';}
                else if(group.type==='front'){const avg=memberSeats.reduce((sum,s)=>sum+ratio(s.frontRatio,0),0)/memberSeats.length;ok=avg<=.4;summary=ok?'Members are concentrated toward the front.':'Members average outside the front target.';}
                else if(group.type==='back'){const avg=memberSeats.reduce((sum,s)=>sum+ratio(s.frontRatio,0),0)/memberSeats.length;ok=avg>=.6;summary=ok?'Members are concentrated toward the back.':'Members average outside the back target.';}
                else if(group.type==='nearTeacher'){const avg=memberSeats.reduce((sum,s)=>sum+s.teacherDistance,0)/memberSeats.length;ok=avg<=2.5;summary=ok?'Members are near the teacher area.':'Average teacher distance is '+avg.toFixed(1)+' seat widths.';}
                else if(group.type==='nearBoard'){const avg=memberSeats.reduce((sum,s)=>sum+s.boardDistance,0)/memberSeats.length;ok=avg<=2.5;summary=ok?'Members are near the board.':'Average board distance is '+avg.toFixed(1)+' seat widths.';}
                else if(group.type==='awayDoor'){const min=Math.min(...memberSeats.map(s=>s.doorDistance));ok=min>=3;summary=ok?'Members stay away from the door.':'At least one member is too close to the door.';}
                else if(group.type==='awayWindow'){const min=Math.min(...memberSeats.map(s=>s.windowDistance));ok=min>=3;summary=ok?'Members stay away from windows.':'At least one member is too close to a window.';}
                else if(group.type==='zone'&&group.zoneId){ok=memberSeats.every(s=>zonesFor(s).has(String(group.zoneId)));summary=ok?'All members are in the preferred zone.':'One or more members are outside the preferred zone.';}
                else applicable=false;
                if((group.anchorSeats||[]).length&&memberSeats.length){const anchors=new Set((group.anchorSeats||[]).map(String));const required=Math.min(anchors.size,memberSeats.length);const used=memberSeats.filter(s=>anchors.has(String(s.key))).length;const anchorOk=used>=required;ok=ok&&anchorOk;summary+=(summary?' ':'')+(anchorOk?'Reserved seats are used.':used+' of '+required+' reserved seats are used.');applicable=true;}
                if(!applicable)continue;
                total++;if(ok)met++;details.push({id:String(group.id),name:String(group.name||'Unnamed rule'),type:String(group.type||'together'),priority,met:ok,summary});
              }
              return {total,met,details};
            };
            const fullMetrics=assignment=>{
              const assigned=new Map();Object.entries(assignment).forEach(([key,id])=>{if(id)assigned.set(String(id),String(key));});
              let penalty=0;for(const student of students){const seat=seatByKey.get(String(assigned.get(String(student.id))||''));if(!seat){penalty+=10000;continue;}penalty+=scoreSeat(student,seat,assigned,()=>0);}
              const requirements=requirementMetrics(assigned);const groupRules=groupMetrics(assigned);
              let moved=0;for(const [studentId,key] of assigned){if(currentByStudent.get(studentId)!==key)moved++;}
              const unassigned=Math.max(0,students.length-assigned.size);
              const softIssues=(requirements.total-requirements.met)+(groupRules.total-groupRules.met);
              const hard=requirements.hard;
              const warnings=Math.max(0,softIssues-requirements.hard);
              const totalChecks=requirements.total+groupRules.total;
              const metChecks=requirements.met+groupRules.met;
              const baseFit=totalChecks?Math.round(metChecks/totalChecks*100):100;
              const fit=Math.max(0,Math.min(100,baseFit-hard*18-unassigned*12));
              return {penalty:Math.round(penalty),fit,hard,warnings,moved,unassigned,requirements,groupRules};
            };
            for(let attempt=0;attempt<attempts;attempt++){
              const rng=rngFor(seed+'|'+mode+'|'+attempt);const assignment={};const assignedByStudent=new Map();
              fixed.forEach((id,key)=>{assignment[key]=id;assignedByStudent.set(id,key);});
              const freeSeats=seats.filter(seat=>!fixed.has(String(seat.key)));const remaining=students.filter(s=>!assignedByStudent.has(String(s.id)));
              const ordered=shuffle(remaining,rng).sort((a,b)=>{const ar=a.requirements||{},br=b.requirements||{};const aw=(ar.front==='require'?5:0)+(ar.ada?5:0)+(ar.minDistanceStudentIds||[]).length+(memberships.get(String(a.id))||[]).length;const bw=(br.front==='require'?5:0)+(br.ada?5:0)+(br.minDistanceStudentIds||[]).length+(memberships.get(String(b.id))||[]).length;return bw-aw+(mode==='randomize'?(rng()-.5):0);});
              const available=[...freeSeats];
              for(const student of ordered){if(!available.length)break;let bestIndex=0,bestPenalty=Infinity;for(let i=0;i<available.length;i++){const value=scoreSeat(student,available[i],assignedByStudent,rng);if(value<bestPenalty){bestPenalty=value;bestIndex=i;}}const [chosen]=available.splice(bestIndex,1);assignment[String(chosen.key)]=String(student.id);assignedByStudent.set(String(student.id),String(chosen.key));}
              const signature=Object.keys(assignment).sort().map(key=>key+':'+assignment[key]).join('|');
              if(!signatures.has(signature)){signatures.add(signature);const metrics=fullMetrics(assignment);results.push({assignment,metrics,seed:seed+'-'+(attempt+1)});results.sort((a,b)=>a.metrics.hard-b.metrics.hard||b.metrics.groupRules.met-a.metrics.groupRules.met||b.metrics.requirements.met-a.metrics.requirements.met||b.metrics.fit-a.metrics.fit||a.metrics.penalty-b.metrics.penalty||a.metrics.moved-b.metrics.moved);if(results.length>candidateCount)results.length=candidateCount;}
              if(attempt%10===0)postMessage({type:'progress',completed:attempt+1,total:attempts});
            }
            return results;
          }
          self.onmessage=event=>{try{postMessage({type:'result',runId:event.data.runId,candidates:solve(event.data.payload)});}catch(error){postMessage({type:'error',runId:event.data.runId,message:error.message||String(error)});}};
        `;
  }


  function currentAssignmentMap() {
    const map = {};
    Object.entries(state.cells || {}).forEach(([key, cell]) => { if (cell.assignedStudentId) map[key] = String(cell.assignedStudentId); });
    return map;
  }

  function stopSeatingWorker(message = '') {
    if (uiState.seatingWorker) uiState.seatingWorker.terminate();
    uiState.seatingWorker = null;
    if (uiState.seatingWorkerUrl) {
      URL.revokeObjectURL(uiState.seatingWorkerUrl);
      uiState.seatingWorkerUrl = '';
    }
    const moreButton = el('generateMoreCandidatesBtn');
    if (moreButton) { moreButton.disabled = false; moreButton.removeAttribute('aria-busy'); }
    if (message) {
      const text = el('seatingProgressText');
      if (text) text.textContent = message;
    }
  }

  function candidateAssignmentSignature(candidate) {
    return Object.entries(candidate?.assignment || {})
      .filter(([, studentId]) => studentId)
      .sort(([seatA], [seatB]) => String(seatA).localeCompare(String(seatB)))
      .map(([seatKey, studentId]) => `${String(seatKey)}:${String(studentId)}`)
      .join('|');
  }

  function candidateAssignmentByStudent(candidate) {
    const map = new Map();
    Object.entries(candidate?.assignment || {}).forEach(([key, studentId]) => { if (studentId) map.set(String(studentId), String(key)); });
    return map;
  }

  function candidateMovedStudents(candidate) {
    const current = new Map(Object.entries(currentAssignmentMap()).map(([key, id]) => [String(id), String(key)]));
    const next = candidateAssignmentByStudent(candidate);
    return state.students.map(student => {
      const from = current.get(String(student.id)) || '';
      const to = next.get(String(student.id)) || '';
      return from === to ? null : { student, from, to };
    }).filter(Boolean);
  }

  function candidateDifferenceCount(candidate, reference) {
    if (!reference) return 0;
    const a = candidateAssignmentByStudent(candidate);
    const b = candidateAssignmentByStudent(reference);
    return state.students.reduce((count, student) => count + (a.get(String(student.id)) !== b.get(String(student.id)) ? 1 : 0), 0);
  }

  function candidateSeatLabel(key) {
    if (!key) return 'Unassigned';
    const seat = (uiState.seatingGeneratorSeats || []).find(item => String(item.key) === String(key));
    return seat?.label || String(key);
  }

  function candidateBadges(candidate, index) {
    const candidates = uiState.seatingCandidates || [];
    const badges = [];
    if (index === 0) badges.push('Best overall');
    const minMoved = Math.min(...candidates.map(item => Number(item.metrics?.moved ?? Infinity)));
    const maxGroup = Math.max(...candidates.map(item => Number(item.metrics?.groupRules?.met || 0)));
    const maxNeeds = Math.max(...candidates.map(item => Number(item.metrics?.requirements?.met || 0)));
    if (candidate.metrics.moved === minMoved) badges.push('Fewest changes');
    if (candidate.metrics.groupRules.met === maxGroup && candidate.metrics.groupRules.total) badges.push('Best group match');
    if (candidate.metrics.requirements.met === maxNeeds && candidate.metrics.requirements.total) badges.push('Best needs match');
    if (!candidate.metrics.hard) badges.push('No required conflicts');
    return [...new Set(badges)].slice(0, 3);
  }

  function candidateInitials(studentId) {
    const student = getStudent(studentId);
    if (!student) return '';
    return `${String(student.firstName || '').charAt(0)}${String(student.lastName || '').charAt(0)}`.toUpperCase() || '?';
  }

  function renderCandidateRoomPreview(candidate) {
    const seats = uiState.seatingGeneratorSeats || [];
    const current = new Map(Object.entries(currentAssignmentMap()).map(([key, id]) => [String(id), String(key)]));
    return `<div class="candidate-room-preview" role="img" aria-label="Visual preview of this seating option">${seats.map(seat => {
          const studentId = candidate.assignment?.[seat.key] || '';
          const moved = studentId && current.get(String(studentId)) !== String(seat.key);
          const left = Math.max(2, Math.min(96, Number(seat.previewX || 0) * 100));
          const top = Math.max(3, Math.min(94, Number(seat.previewY || 0) * 100));
          const title = studentId ? `${studentDisplay(getStudent(studentId))} · ${seat.label}` : `${seat.label} · empty`;
          return `<span class="candidate-preview-seat${moved ? ' moved' : ''}${seat.manual ? ' locked' : ''}" style="left:${left}%;top:${top}%" title="${escapeHtml(title)}"><b>${escapeHtml(candidateInitials(studentId))}</b></span>`;
        }).join('')}</div>`;
  }

  function renderCandidateDetail() {
    const detail = el('seatingCandidateDetail');
    const candidate = uiState.seatingCandidates?.[selectedCandidateIndex];
    if (!detail) return;
    if (!candidate) { detail.innerHTML = ''; return; }
    const metrics = candidate.metrics;
    const moved = candidateMovedStudents(candidate);
    const groupDetails = metrics.groupRules?.details || [];
    const failedNeeds = metrics.requirements?.issues || [];
    const differenceFromBest = selectedCandidateIndex ? candidateDifferenceCount(candidate, uiState.seatingCandidates[0]) : 0;
    detail.innerHTML = `
          <section class="candidate-detail-summary">
            <div><span class="candidate-option-kicker">Option ${selectedCandidateIndex + 1}</span><h3>${escapeHtml(candidateBadges(candidate, selectedCandidateIndex)[0] || 'Seating option')}</h3><p>${metrics.hard ? `${metrics.hard} required conflict${metrics.hard === 1 ? '' : 's'} need attention.` : 'No required conflicts were found.'} ${differenceFromBest ? `${differenceFromBest} student placement${differenceFromBest === 1 ? '' : 's'} differ from Option 1.` : ''}</p></div>
            <div class="candidate-fit"><strong>${metrics.fit}</strong><span>Fit out of 100</span></div>
          </section>
          <div class="candidate-detail-grid">
            <section><h4>Visual room preview</h4>${renderCandidateRoomPreview(candidate)}<div class="candidate-preview-legend"><span><i class="moved"></i>Changed from current chart</span><span><i class="locked"></i>Locked seat</span></div></section>
            <section><h4>What changes</h4>${moved.length ? `<ul class="candidate-change-list">${moved.slice(0, 10).map(item => `<li><strong>${escapeHtml(studentDisplay(item.student))}</strong><span>${escapeHtml(candidateSeatLabel(item.from))} → ${escapeHtml(candidateSeatLabel(item.to))}</span></li>`).join('')}</ul>${moved.length > 10 ? `<p class="muted">And ${moved.length - 10} more student changes.</p>` : ''}` : '<div class="successbox">This option keeps every current student placement.</div>'}</section>
          </div>
          <div class="candidate-rule-columns">
            <section><h4>Group rules <span>${metrics.groupRules.met}/${metrics.groupRules.total || 0} met</span></h4>${groupDetails.length ? `<ul class="candidate-rule-list">${groupDetails.map(rule => `<li class="${rule.met ? 'met' : 'missed'}"><b>${rule.met ? '✓' : '!'}</b><div><strong>${escapeHtml(rule.name)}</strong><span>${escapeHtml(rule.summary)}</span></div></li>`).join('')}</ul>` : '<div class="hint">No applicable group rules are configured.</div>'}</section>
            <section><h4>Individual needs <span>${metrics.requirements.met}/${metrics.requirements.total || 0} met</span></h4>${!metrics.requirements.total ? '<div class="hint">No individual seating requirements are configured.</div>' : failedNeeds.length ? `<ul class="candidate-rule-list">${failedNeeds.slice(0, 12).map(issue => `<li class="${issue.hard ? 'missed hard' : 'missed'}"><b>!</b><div><strong>${escapeHtml(issue.studentName)}</strong><span>${escapeHtml(issue.label)}</span></div></li>`).join('')}</ul>` : '<div class="successbox">Every configured individual requirement is met.</div>'}</section>
          </div>`;
  }

  function renderCandidateCards() {
    const grid = el('seatingCandidateGrid');
    if (!grid) return;
    if (!uiState.seatingCandidates.length) {
      grid.innerHTML = '<div class="hint">Seating options are being evaluated. Your current chart remains unchanged.</div>';
      renderCandidateDetail();
      return;
    }
    const best = uiState.seatingCandidates[0];
    grid.innerHTML = uiState.seatingCandidates.map((candidate,index) => {
      const metrics = candidate.metrics;
      const badges = candidateBadges(candidate, index);
      const difference = index ? candidateDifferenceCount(candidate, best) : 0;
      const issueText = metrics.hard
        ? `${metrics.hard} required conflict${metrics.hard === 1 ? '' : 's'}`
        : (metrics.warnings ? `${metrics.warnings} preference${metrics.warnings === 1 ? '' : 's'} not fully met` : 'All evaluated rules are met');
      return `
            <article class="candidate-card ${selectedCandidateIndex === index ? 'selected' : ''}" data-candidate-index="${index}">
              <div class="candidate-card-head"><div><span class="candidate-option-kicker">Option ${index + 1}</span><h3>${escapeHtml(badges[0] || 'Alternative layout')}</h3></div><div class="candidate-fit compact"><strong>${metrics.fit}</strong><span>Fit</span></div></div>
              <div class="candidate-badges">${badges.map(badge => `<span>${escapeHtml(badge)}</span>`).join('')}</div>
              <div class="candidate-metrics">
                <div class="candidate-metric"><strong>${metrics.groupRules.total ? `${metrics.groupRules.met}/${metrics.groupRules.total}` : 'None'}</strong><span>Group rules</span></div>
                <div class="candidate-metric"><strong>${metrics.requirements.total ? `${metrics.requirements.met}/${metrics.requirements.total}` : 'None'}</strong><span>Needs met</span></div>
                <div class="candidate-metric"><strong>${metrics.moved}</strong><span>Students changed</span></div>
              </div>
              <p class="candidate-issue-summary ${metrics.hard ? 'bad' : ''}">${escapeHtml(issueText)}${difference ? ` · ${difference} placements differ from Option 1` : ''}</p>
              <button type="button" class="${selectedCandidateIndex === index ? '' : 'secondary'}" data-select-candidate="${index}">${selectedCandidateIndex === index ? 'Comparing this option' : 'Compare this option'}</button>
            </article>`;
    }).join('');
    el('acceptSeatingCandidateBtn').disabled = selectedCandidateIndex < 0;
    renderCandidateDetail();
  }


  function startCandidateGeneration(mode = 'generate', options = {}) {
    if (eyeModeBlocksSeatEditing()) return blockEyeModeAction('seat');
    const anotherBatch = Boolean(options.anotherBatch);
    const usingFreeform = state.layoutMode === 'freeform';
    if (usingFreeform) {
      if (!prepareGridMirrorFromFreeformSeats()) {
        setLiveStatusMessage('Add at least one Freeform seat before generating seating options.');
        return false;
      }
    } else {
      ensureGrid();
    }
    const seats = buildGeneratorSeats();
    uiState.seatingGeneratorSeats = deepClone(seats);
    if (!state.students.length || !seats.length) { setLiveStatusMessage('Add students and usable seats first.'); return false; }

    const previousCandidates = anotherBatch ? deepClone(uiState.seatingCandidates || []) : [];
    const currentSignatures = anotherBatch
      ? previousCandidates.map(candidateAssignmentSignature).filter(Boolean)
      : [];
    if (anotherBatch) {
      uiState.seatingCandidateExcludedSignatures = [...new Set([
        ...(uiState.seatingCandidateExcludedSignatures || []),
        ...currentSignatures
      ])];
      uiState.seatingCandidateBatch = Math.max(0, Number(uiState.seatingCandidateBatch || 0)) + 1;
    } else {
      uiState.seatingCandidateBatch = 0;
      uiState.seatingCandidateExcludedSignatures = [];
    }

    stopSeatingWorker();
    uiState.seatingCandidateMode = mode;
    uiState.seatingCandidates = [];
    selectedCandidateIndex = -1;
    const seedInput = String(el('generatorSeedInput')?.value || pageSettings().generatorSeed || '').trim();
    const initialSeed = seedInput || `${activeClassName()}-${new Date().toISOString().slice(0,10)}-${mode}`;
    const baseSeed = anotherBatch && uiState.seatingCandidateSeed ? uiState.seatingCandidateSeed : initialSeed;
    const batchSeed = `${baseSeed}|batch:${uiState.seatingCandidateBatch}`;
    uiState.seatingCandidateSeed = baseSeed;
    uiState.pageSettings.generatorSeed = seedInput;
    uiState.pageSettings.generatorCandidateCount = clampNumber(el('generatorCandidateCount')?.value || pageSettings().generatorCandidateCount,1,5);
    uiState.pageSettings.generatorAttempts = clampNumber(el('generatorAttemptsInput')?.value || pageSettings().generatorAttempts,20,1200);
    schedulePageSettingsPersistence('generator-settings');
    el('seatingCandidateModal')?.classList.add('show');
    DialogManager.synchronize();
    if (el('seatingCandidateTitle')) el('seatingCandidateTitle').textContent = mode === 'randomize' ? 'Randomized Seating Options' : 'Generated Seating Options';
    if (el('seatingCandidateIntro')) el('seatingCandidateIntro').textContent = anotherBatch
      ? 'A new batch is being generated. Previously shown arrangements are excluded so the options genuinely change.'
      : 'Your current chart is unchanged. Compare rule matches, student moves, and the room preview before choosing an option.';
    if (el('seatingProgressFill')) el('seatingProgressFill').style.width = '0%';
    if (el('seatingProgressText')) el('seatingProgressText').textContent = anotherBatch ? `Starting new option batch ${uiState.seatingCandidateBatch + 1}…` : 'Starting background generator…';
    const moreButton = el('generateMoreCandidatesBtn');
    if (moreButton) { moreButton.disabled = true; moreButton.setAttribute('aria-busy', 'true'); }
    renderCandidateCards();
    if (typeof Worker !== 'function') {
      if (el('seatingProgressText')) el('seatingProgressText').textContent = 'This browser does not support background workers. Use Generate from a browser that supports background workers.';
      if (anotherBatch) {
        uiState.seatingCandidates = previousCandidates;
        selectedCandidateIndex = previousCandidates.length ? 0 : -1;
        renderCandidateCards();
      }
      stopSeatingWorker();
      return false;
    }
    uiState.seatingWorkerUrl = URL.createObjectURL(new Blob([generatorWorkerSource()], { type: 'text/javascript' }));
    const worker = new Worker(uiState.seatingWorkerUrl);
    uiState.seatingWorker = worker;
    const runId = ++uiState.seatingWorkerRunId;
    worker.onmessage = event => {
      const message = event.data || {};
      if (message.runId && message.runId !== runId) return;
      if (message.type === 'progress') {
        const pct = Math.round((Number(message.completed || 0) / Math.max(1,Number(message.total || 1))) * 100);
        if (el('seatingProgressFill')) el('seatingProgressFill').style.width = `${pct}%`;
        if (el('seatingProgressText')) el('seatingProgressText').textContent = `Evaluated ${message.completed} of ${message.total} possible charts.`;
      }
      if (message.type === 'result') {
        const candidates = Array.isArray(message.candidates) ? message.candidates : [];
        if (anotherBatch && !candidates.length) {
          uiState.seatingCandidates = previousCandidates;
          selectedCandidateIndex = previousCandidates.length ? 0 : -1;
          if (el('seatingProgressText')) el('seatingProgressText').textContent = 'No additional unique options were found. Increase generation attempts or adjust the seed and try again.';
          setLiveStatusMessage('No additional unique seating options were found. The previous options remain available.');
        } else {
          uiState.seatingCandidates = candidates;
          selectedCandidateIndex = candidates.length ? 0 : -1;
          if (el('seatingProgressFill')) el('seatingProgressFill').style.width = '100%';
          if (el('seatingProgressText')) el('seatingProgressText').textContent = anotherBatch
            ? `Finished a new batch after ${pageSettings().generatorAttempts} attempts. Previously shown arrangements were excluded.`
            : `Finished ${pageSettings().generatorAttempts} attempts. The current chart is still unchanged.`;
        }
        renderCandidateCards();
        stopSeatingWorker();
      }
      if (message.type === 'error') {
        if (anotherBatch) {
          uiState.seatingCandidates = previousCandidates;
          selectedCandidateIndex = previousCandidates.length ? 0 : -1;
          renderCandidateCards();
        }
        if (el('seatingProgressText')) el('seatingProgressText').textContent = `Generator failed: ${message.message}`;
        stopSeatingWorker();
      }
    };
    worker.onerror = error => {
      if (anotherBatch) {
        uiState.seatingCandidates = previousCandidates;
        selectedCandidateIndex = previousCandidates.length ? 0 : -1;
        renderCandidateCards();
      }
      if (el('seatingProgressText')) el('seatingProgressText').textContent = `Generator failed: ${error.message}`;
      stopSeatingWorker();
    };
    worker.postMessage({ runId, payload: {
      students: deepClone(studentsWithEffectiveRuleRequirements()),
      groups: deepClone(state.groups),
      seats,
      rows: state.rows,
      cols: state.cols,
      attempts: pageSettings().generatorAttempts,
      candidateCount: pageSettings().generatorCandidateCount,
      seed: batchSeed,
      mode,
      currentAssignments: currentAssignmentMap(),
      excludedSignatures: [...(uiState.seatingCandidateExcludedSignatures || [])]
    } });
    return true;
  }

  function applySelectedCandidate() {
    const candidate = uiState.seatingCandidates[selectedCandidateIndex];
    if (!candidate) return;
    pushUndoSnapshot('Before applying seating option');
    Object.values(state.cells).forEach(cell => {
      if (cell.type !== 'seat' || cell.manual) return;
      cell.assignedStudentId = null;
    });
    Object.entries(candidate.assignment || {}).forEach(([key, studentId]) => {
      const cell = state.cells[key];
      if (!cell || cell.type !== 'seat' || cell.manual) return;
      cell.assignedStudentId = studentId || null;
      cell.manual = false;
    });
    if (state.layoutMode === 'freeform') syncGridAssignmentsToFreeformByPosition();
    renderAll();
    el('seatingCandidateModal')?.classList.remove('show');
    setLiveStatusMessage(`Applied Option ${selectedCandidateIndex + 1}: ${candidate.metrics.fit}/100 fit, ${candidate.metrics.groupRules.met}/${candidate.metrics.groupRules.total || 0} group rules met, and ${candidate.metrics.requirements.met}/${candidate.metrics.requirements.total || 0} individual needs met.`);
  }

  function placementExplanation(studentId, cellKey) {
    const student = getStudent(studentId);
    const cell = state.cells[cellKey];
    if (!student || !cell) return { summary: 'Placement information is unavailable.', items: [] };
    const details = [];
    requirementScore(studentId, cell, details);
    const groups = studentGroups(studentId);
    groups.forEach(group => {
      const members = (group.studentIds || []).filter(id => String(id) !== String(studentId)).map(assignedSeatForStudent).filter(Boolean);
      const priority = Number(group.priority || 1);
      if (group.type === 'together' && members.length) {
        const d = Math.min(...members.map(other => distance(cell, other)));
        details.push({ kind: d <= 2 ? 'good' : 'warn', text: `${group.name}: the nearest group member is ${d <= 2 ? 'nearby' : 'farther away than preferred'} (priority ${priority}).` });
      } else if (['avoid','spread'].includes(group.type) && members.length) {
        const d = Math.min(...members.map(other => distance(cell, other)));
        details.push({ kind: d >= 3 ? 'good' : 'bad', text: `${group.name}: the nearest separated member is ${d >= 3 ? 'far enough away' : describeRuleSeparation(d)} (priority ${priority}).` });
      } else if (group.type === 'zone' && group.zoneId) {
        const inZone = (cell.zoneIds || []).includes(String(group.zoneId));
        details.push({ kind: inZone ? 'good' : 'warn', text: `${group.name}: ${inZone ? 'inside' : 'outside'} preferred zone ${zoneById(group.zoneId)?.name || group.zoneId}.` });
      } else {
        details.push({ kind: 'neutral', text: `${group.name}: ${typeLabel(group.type)} rule with priority ${priority}.` });
      }
    });
    if (cell.manual) details.unshift({ kind: 'good', text: 'This seat is manually locked, so generation preserves it.' });
    if ((cell.anchorGroupIds || []).length) details.unshift({ kind: 'good', text: `This seat is reserved for ${(cell.anchorGroupIds || []).map(id => getGroup(id)?.name || id).join(', ')}.` });
    if (!details.length) details.push({ kind: 'neutral', text: 'No individual requirements or group rules affect this placement.' });
    return { summary: `${studentDisplay(student)} is in Seat ${cell.row},${cell.col}.`, items: details };
  }

  function openPlacementWhy(studentId, cellKey) {
    const result = placementExplanation(studentId, cellKey);
    if (el('placementWhySummary')) el('placementWhySummary').textContent = result.summary;
    if (el('placementWhyList')) el('placementWhyList').innerHTML = result.items.map(item => `<li class="${escapeHtml(item.kind || 'neutral')}">${escapeHtml(item.text)}</li>`).join('');
    el('placementWhyModal')?.classList.add('show');
  }

  function enhanceSeatExplanations() {
    document.querySelectorAll('.cell[data-cell-key]').forEach(node => {
      const key = node.dataset.cellKey;
      const cell = state.cells[key];
      if (!cell?.assignedStudentId) return;
      const actions = node.querySelector('.cell-actions');
      if (!actions || actions.querySelector('[data-placement-why]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tiny ghost seat-why-btn no-print';
      button.dataset.placementWhy = cell.assignedStudentId;
      button.dataset.cellKey = key;
      button.textContent = 'Why?';
      button.title = 'Explain the rules and requirements affecting this placement.';
      actions.appendChild(button);
    });
    document.querySelectorAll('.freeform-object[data-object-id]').forEach(node => {
      const obj = (state.freeformLayout?.objects || []).find(item => item.id === node.dataset.objectId);
      if (!obj?.assignedStudentId || !obj.cellKey) return;
      const actions = node.querySelector('.freeform-object-actions');
      if (!actions || actions.querySelector('[data-placement-why]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tiny ghost seat-why-btn no-print';
      button.dataset.placementWhy = obj.assignedStudentId;
      button.dataset.cellKey = obj.cellKey;
      button.textContent = 'Why?';
      actions.appendChild(button);
    });
  }

  function setKeyboardCarry(studentId) {
    const student = getStudent(studentId);
    uiState.keyboardCarryStudentId = student ? String(student.id) : '';
    document.body.classList.toggle('keyboard-carry-active', Boolean(student));
    document.querySelectorAll('.keyboard-seat-target').forEach(node => node.classList.remove('keyboard-seat-target'));
    if (student) {
      if (el('keyboardCarryText')) el('keyboardCarryText').textContent = `Keyboard placement: ${studentDisplay(student)}. Focus a seat and press Enter or Space to place; Escape cancels.`;
      document.querySelectorAll('.cell.seat,.freeform-object.seat').forEach(node => node.classList.add('keyboard-seat-target'));
    }
  }

  function gridFocusMove(node, key) {
    const cellKey = node.dataset.cellKey;
    const cell = state.cells[cellKey];
    if (!cell) return;
    const delta = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] }[key];
    if (!delta) return;
    const next = document.querySelector(`.cell[data-cell-key="${cssEscape(keyOf(Number(cell.row)+delta[0],Number(cell.col)+delta[1]))}"]`);
    next?.focus?.();
  }

  function enhanceKeyboardTargets() {
    document.querySelectorAll('.student-card[data-student-id]').forEach(card => {
      card.tabIndex = -1;
      card.removeAttribute('role');
      card.removeAttribute('aria-label');
      let button = card.querySelector('.keyboard-student-pickup');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'tiny ghost keyboard-student-pickup';
        button.textContent = 'Place';
        const actions = card.querySelector('.card-actions') || card;
        actions.insertBefore(button, actions.firstChild);
      }
      button.dataset.keyboardStudentId = card.dataset.studentId;
      button.setAttribute('aria-label', `Select ${card.querySelector('.student-name-text')?.textContent || 'student'} for keyboard seat placement`);
      button.title = 'Select this student for keyboard seat placement';
    });
    document.querySelectorAll('.cell[data-cell-key]').forEach(node => {
      node.tabIndex = -1;
      node.removeAttribute('role');
      node.removeAttribute('aria-label');
      const cell = state.cells[node.dataset.cellKey];
      const student = getStudent(cell?.assignedStudentId);
      let button = node.querySelector('.keyboard-seat-focus');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'keyboard-seat-focus';
        node.appendChild(button);
      }
      button.dataset.keyboardCellKey = node.dataset.cellKey;
      button.setAttribute('aria-label', `Cell ${cell?.row || ''},${cell?.col || ''}, ${objectLabel(cell?.type || 'empty')}${student ? `, assigned to ${studentDisplay(student)}` : ''}. Double-click or press and hold for seat settings.`);
      button.title = uiState.keyboardCarryStudentId
        ? 'Place the selected student here'
        : 'Double-click for seat settings. On touch, double-tap or press and hold.';
    });
    document.querySelectorAll('.freeform-object[data-object-id]').forEach(node => {
      node.tabIndex = -1;
      node.removeAttribute('role');
      let button = node.querySelector('.keyboard-freeform-seat-focus');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'keyboard-freeform-seat-focus';
        button.title = 'Arrow keys move; Shift moves farther; Alt moves 1 pixel; [ and ] rotate; plus/minus resize; L locks or unlocks.';
        node.appendChild(button);
      }
      button.dataset.keyboardObjectId = node.dataset.objectId;
      const objectName = node.querySelector('.freeform-object-title')?.textContent || node.dataset.type || 'object';
      button.setAttribute('aria-label', `Freeform ${objectName}. Arrow keys move, brackets rotate, plus or minus resize, and L changes lock state.`.trim());
    });
  }

  function keyboardEditFreeformObject(node, event) {
    const id = node?.dataset?.objectId;
    const obj = (state.freeformLayout?.objects || []).find(item => item.id === id);
    if (!obj || eyeModeBlocksRoomEditing()) return false;
    if (event.key.toLowerCase() === 'l') {
      selectFreeformObject(id, false, true);
      lockSelectedFreeformObject(true);
      return true;
    }
    if (obj.locked) return false;
    if (event.key === '[') { selectFreeformObject(id, false, true); rotateFreeformObject(id, event.shiftKey ? -45 : -15); return true; }
    if (event.key === ']') { selectFreeformObject(id, false, true); rotateFreeformObject(id, event.shiftKey ? 45 : 15); return true; }
    const editableKeys = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_']);
    if (!editableKeys.has(event.key)) return false;
    const fine = event.altKey ? 1 : Math.max(1, Number(state.freeformLayout?.canvas?.gridSize || pageSettings().freeformGridSize || 10));
    const step = event.shiftKey ? fine * 5 : fine;
    selectFreeformObject(id, false, true);
    pushUndoSnapshot('Before keyboard Freeform edit');
    if (event.key === 'ArrowLeft') obj.x = Math.max(0, Number(obj.x || 0) - step);
    if (event.key === 'ArrowRight') obj.x = Math.max(0, Number(obj.x || 0) + step);
    if (event.key === 'ArrowUp') obj.y = Math.max(0, Number(obj.y || 0) - step);
    if (event.key === 'ArrowDown') obj.y = Math.max(0, Number(obj.y || 0) + step);
    if (event.key === '+' || event.key === '=') {
      obj.width = Math.max(40, Number(obj.width || 0) + step);
      obj.height = Math.max(40, Number(obj.height || 0) + step);
    }
    if (event.key === '-' || event.key === '_') {
      obj.width = Math.max(obj.type === 'seat' ? MIN_FREEFORM_SEAT_WIDTH : 40, Number(obj.width || 0) - step);
      obj.height = Math.max(obj.type === 'seat' ? MIN_FREEFORM_SEAT_HEIGHT : 40, Number(obj.height || 0) - step);
    }
    rememberFreeformGeometry([obj]);
    commitFreeformLayoutChange('freeform-keyboard-edit', { render: true, syncToGrid: false });
    setLiveStatusMessage(`Updated ${freeformObjectLabel(obj)} with keyboard controls.`);
    return true;
  }

  function onKeyboardPlacement(event) {
    const pickupButton = event.target.closest?.('.keyboard-student-pickup[data-keyboard-student-id]');
    const studentCard = event.target.closest?.('.student-card[data-student-id]');
    if ((pickupButton || studentCard) && ['Enter',' '].includes(event.key)) {
      event.preventDefault(); setKeyboardCarry(pickupButton?.dataset.keyboardStudentId || studentCard.dataset.studentId); return;
    }
    if (event.key === 'Escape' && uiState.keyboardCarryStudentId) { event.preventDefault(); setKeyboardCarry(''); return; }
    const cellButton = event.target.closest?.('.keyboard-seat-focus[data-keyboard-cell-key]');
    const cellNode = cellButton?.closest('.cell[data-cell-key]') || event.target.closest?.('.cell[data-cell-key]');
    if (cellNode) {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); gridFocusMove(cellNode,event.key); return; }
      if (['Enter',' '].includes(event.key)) {
        const key = cellButton?.dataset.keyboardCellKey || cellNode.dataset.cellKey; const cell = state.cells[key];
        if (uiState.keyboardCarryStudentId && cell?.type === 'seat') { event.preventDefault(); assignStudentToCell(uiState.keyboardCarryStudentId,key,true,true); setKeyboardCarry(''); (cellButton || cellNode).focus(); }
        else if (cell?.assignedStudentId) { event.preventDefault(); setKeyboardCarry(cell.assignedStudentId); }
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && state.cells[cellNode.dataset.cellKey]?.assignedStudentId && !state.cells[cellNode.dataset.cellKey]?.manual) {
        event.preventDefault(); state.cells[cellNode.dataset.cellKey].assignedStudentId = null; renderAll();
      }
    }
    const freeformButton = event.target.closest?.('.keyboard-freeform-seat-focus[data-keyboard-object-id]');
    const freeformNode = freeformButton?.closest('.freeform-object[data-object-id]') || event.target.closest?.('.freeform-object[data-object-id]');
    if (freeformNode && ['Enter',' '].includes(event.key) && uiState.keyboardCarryStudentId && freeformNode.classList.contains('seat')) {
      event.preventDefault(); assignStudentToFreeformObject(uiState.keyboardCarryStudentId,freeformNode.dataset.objectId,true,true); setKeyboardCarry(''); freeformButton?.focus(); return;
    }
    if (freeformNode && keyboardEditFreeformObject(freeformNode, event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function activeClassDetails() {
    const cls = activeClassRecord();
    return cls || normalizeClassRecord({ name: 'Class' });
  }

  function openClassTools() {
    const cls = activeClassDetails();
    if (el('classToolsSummary')) el('classToolsSummary').textContent = `${cls.name} · ${state.students.length} active students · ${(state.rosterArchive || []).length} archived roster record(s).`;
    if (el('classAcademicYearInput')) el('classAcademicYearInput').value = cls.academicYear || '';
    if (el('classTermInput')) el('classTermInput').value = cls.term || '';
    if (el('rolloverClassNameInput')) el('rolloverClassNameInput').value = `${cls.name} - Copy`;
    if (el('toggleArchiveClassBtn')) el('toggleArchiveClassBtn').textContent = cls.archived ? 'Restore Current Class' : 'Archive Current Class';
    if (el('showArchivedClassesToggle')) el('showArchivedClassesToggle').checked = Boolean(pageSettings().showArchivedClasses);
    el('classToolsModal')?.classList.add('show');
  }

  function saveClassDetails() {
    const cls = activeClassRecord(); if (!cls) return;
    cls.academicYear = String(el('classAcademicYearInput')?.value || '').trim().slice(0,20);
    cls.term = String(el('classTermInput')?.value || '').trim().slice(0,40);
    persistActiveClass(); renderClassManager(); setLiveStatusMessage('Class year and term saved.');
  }

  function toggleClassArchive() {
    const cls = activeClassRecord(); if (!cls) return;
    if (!cls.archived) {
      const activeOthers = state.classes.filter(item => item.id !== cls.id && !item.archived);
      if (!activeOthers.length) { setLiveStatusMessage('Create or restore another active class before archiving this one.'); return; }
      cls.archived = true;
      state.activeClassId = activeOthers[0].id;
      applyClassToState(state.activeClassId);
    } else cls.archived = false;
    pageSettings().showArchivedClasses = true;
    renderAll(); openClassTools();
  }

  function createRolloverClass() {
    persistActiveClass();
    const source = activeClassRecord(); if (!source) return;
    const copyRoster = Boolean(el('rolloverCopyRoster')?.checked);
    const copyRules = Boolean(el('rolloverCopyRules')?.checked);
    const copyLayout = Boolean(el('rolloverCopyLayout')?.checked);
    const clearAssignments = Boolean(el('rolloverClearAssignments')?.checked);
    const next = normalizeClassRecord({
      ...deepClone(source),
      id: uid('class'),
      name: String(el('rolloverClassNameInput')?.value || `${source.name} - Copy`).trim().slice(0,80) || `${source.name} - Copy`,
      students: copyRoster ? deepClone(source.students || []) : [],
      groups: copyRules ? deepClone(source.groups || []) : [],
      zones: copyRules ? deepClone(source.zones || []) : [],
      rows: copyLayout ? source.rows : 5,
      cols: copyLayout ? source.cols : 6,
      cells: copyLayout ? deepClone(source.cells || {}) : {},
      layoutMode: copyLayout ? source.layoutMode : 'grid',
      freeformLayout: copyLayout ? deepClone(source.freeformLayout) : null,
      customObjects: copyLayout ? deepClone(source.customObjects || []) : [],
      rosterArchive: [], archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    if (clearAssignments) {
      Object.values(next.cells || {}).forEach(cell => { cell.assignedStudentId = null; cell.manual = false; });
      (next.freeformLayout?.objects || []).forEach(obj => { if (obj.type === 'seat') { obj.assignedStudentId = null; obj.manual = false; obj.locked = false; } });
    }
    if (!copyRoster) {
      next.groups.forEach(group => group.studentIds = []);
      next.zones.forEach(zone => zone.studentIds = []);
    }
    state.classes.push(next); state.activeClassId = next.id; applyClassToState(next.id); renderAll(); el('classToolsModal')?.classList.remove('show'); setLiveStatusMessage(`Created rollover class ${next.name}.`);
  }

  function parseReconcileCsv(text) {
    const matrix = parseCsvMatrix(text);
    if (!matrix.length || matrix.length < 2) throw new Error('The CSV does not contain a header row and student records.');
    const headers = matrix[0].map(value => String(value || '').trim());
    const index = {
      firstName: optionalColumnIndex(guessCsvColumn(headers,['first name','firstname','first'])),
      lastName: optionalColumnIndex(guessCsvColumn(headers,['last name','lastname','last'])),
      nickName: optionalColumnIndex(guessCsvColumn(headers,['nickname','nick name','preferred name'])),
      grade: optionalColumnIndex(guessCsvColumn(headers,['grade','level'])),
      id: optionalColumnIndex(guessCsvColumn(headers,['student id','studentid','id']))
    };
    if (index.firstName < 0 && index.lastName < 0 && index.id < 0) throw new Error('No recognized first-name or last-name column, or student-ID column, was found.');
    const value = (row,key) => index[key] >= 0 ? String(row[index[key]] || '').trim() : '';
    const incoming = [];
    const rejectedRows = [];
    matrix.slice(1).forEach((row, rowIndex) => {
      if (!row.some(cell => String(cell || '').trim())) return;
      const values = { firstName:value(row,'firstName'), lastName:value(row,'lastName'), nickName:value(row,'nickName'), grade:value(row,'grade'), id:value(row,'id') };
      if (!(values.firstName || values.lastName || values.id)) {
        const source = csvRejectedRowSource(headers, row);
        rejectedRows.push({ rowNumber: rowIndex + 2, reason: 'No recognized name or student ID.', ...source });
        return;
      }
      incoming.push(normalizeStudent({ ...values, id: values.id || undefined }));
    });
    if (!incoming.length) throw new Error('No usable student rows were found after validation.');
    const existingById = new Map(state.students.map(student => [String(student.id),student]));
    const nameKey = student => `${String(student.firstName||'').trim().toLowerCase()}|${String(student.lastName||'').trim().toLowerCase()}`;
    const existingByName = new Map(state.students.map(student => [nameKey(student),student]));
    const seenIncoming = new Set(); const matched=[]; const added=[]; const duplicates=[];
    incoming.forEach(item => {
      const key = item.id && existingById.has(String(item.id)) ? `id:${item.id}` : `name:${nameKey(item)}`;
      if (seenIncoming.has(key)) { duplicates.push(item); return; }
      seenIncoming.add(key);
      const existing = existingById.get(String(item.id)) || existingByName.get(nameKey(item));
      if (existing) matched.push({ existing, incoming:item, changed: ['firstName','lastName','nickName','grade'].some(field => String(existing[field]||'') !== String(item[field]||'')) });
      else added.push(item);
    });
    duplicates.forEach((student, indexValue) => rejectedRows.push({ rowNumber: '', reason: 'Duplicate incoming student record.', firstName: student.firstName, lastName: student.lastName, studentId: student.id, duplicateNumber: indexValue + 1 }));
    const matchedIds = new Set(matched.map(item => String(item.existing.id)));
    const missing = state.students.filter(student => !matchedIds.has(String(student.id)));
    return { headers, incoming, matched, added, missing, duplicates, rejectedRows };
  }

  function renderReconcileDraft() {
    if (!reconcileDraft) return;
    const cards = [
      ['Matched',reconcileDraft.matched.length],['New',reconcileDraft.added.length],['Missing',reconcileDraft.missing.length],['Duplicates',reconcileDraft.duplicates.length],['Rejected',reconcileDraft.rejectedRows?.length || 0],['Changed names/details',reconcileDraft.matched.filter(item=>item.changed).length]
    ];
    if (el('reconcileSummary')) el('reconcileSummary').innerHTML = cards.map(([label,count]) => `<div class="workflow-card"><strong>${count}</strong><span>${escapeHtml(label)}</span></div>`).join('');
    const rows = [
      ...reconcileDraft.matched.map(item => ['Matched',studentDisplay(item.existing),studentDisplay(item.incoming)]),
      ...reconcileDraft.added.map(item => ['New','',studentDisplay(item)]),
      ...reconcileDraft.missing.map(item => ['Missing',studentDisplay(item),'']),
      ...reconcileDraft.duplicates.map(item => ['Duplicate','',studentDisplay(item)])
    ].slice(0,150);
    if (el('reconcilePreview')) el('reconcilePreview').innerHTML = `<table><thead><tr><th>Status</th><th>Current</th><th>CSV</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join('')}</tbody></table>`;
  }

  async function openRosterReconcileFile(file) {
    if (!file) return;
    try {
      reconcileDraft = parseReconcileCsv(await readTextFileWithinLimits(file, 'roster reconciliation CSV', IMPORT_LIMITS.csvBytes));
      renderReconcileDraft();
      el('rosterReconcileModal')?.classList.add('show');
      if (reconcileDraft.rejectedRows?.length) {
        WorkflowRecoveryV62.reportFailure({
          operation: 'Roster Reconciliation Loaded With Rejected Rows',
          source: file.name,
          error: new Error(`${reconcileDraft.rejectedRows.length} row${reconcileDraft.rejectedRows.length === 1 ? '' : 's'} need review before the roster is applied.`),
          dataChanged: false,
          snapshotCreated: false,
          rejectedRows: reconcileDraft.rejectedRows,
          remedy: 'Download the rejected-row report. You may continue reconciling the valid rows, then correct and re-import only the rejected records.'
        });
      }
    } catch (err) {
      WorkflowRecoveryV62.reportFailure({
        operation: 'Open Roster Reconciliation File',
        source: file.name,
        error: err,
        dataChanged: false,
        snapshotCreated: false,
        remedy: 'Confirm the file is a valid CSV with a recognized name or student-ID column.',
        retry: async () => { reconcileDraft = parseReconcileCsv(await readTextFileWithinLimits(file, 'roster reconciliation CSV', IMPORT_LIMITS.csvBytes)); renderReconcileDraft(); el('rosterReconcileModal')?.classList.add('show'); }
      });
    }
  }

  function cleanupStudentReferences(studentId) {
    const id = String(studentId);
    state.groups.forEach(group => group.studentIds = (group.studentIds || []).filter(value => String(value) !== id));
    state.zones.forEach(zone => zone.studentIds = (zone.studentIds || []).filter(value => String(value) !== id));
    Object.values(state.cells || {}).forEach(cell => { if (String(cell.assignedStudentId || '') === id) { cell.assignedStudentId = null; cell.manual = false; } });
    (state.freeformLayout?.objects || []).forEach(obj => { if (String(obj.assignedStudentId || '') === id) { obj.assignedStudentId = null; obj.manual = false; obj.locked = false; } });
  }

  function applyRosterReconcile() {
    if (!reconcileDraft) return;
    pushUndoSnapshot('Before roster reconciliation');
    const preserveNotes = Boolean(el('reconcilePreserveNotes')?.checked);
    if (el('reconcileUpdateMatched')?.checked) {
      reconcileDraft.matched.forEach(({existing,incoming}) => {
        const requirements = existing.requirements;
        const notes = { notesPrivate:existing.notesPrivate,notesSubstitute:existing.notesSubstitute,notesPublic:existing.notesPublic,noteCategories:existing.noteCategories };
        Object.assign(existing, incoming, { id: existing.id });
        if (preserveNotes) Object.assign(existing, notes, { requirements });
      });
    }
    if (el('reconcileAddNew')?.checked) state.students.push(...reconcileDraft.added.map(normalizeStudent));
    if (el('reconcileArchiveMissing')?.checked) {
      const missingIds = new Set(reconcileDraft.missing.map(item => String(item.id)));
      state.rosterArchive = [...(state.rosterArchive || []), ...reconcileDraft.missing.map(item => ({ ...deepClone(item), archived: true }))];
      reconcileDraft.missing.forEach(item => cleanupStudentReferences(item.id));
      state.students = state.students.filter(item => !missingIds.has(String(item.id)));
    }
    cleanupInvalidAssignmentsAndAnchors(); renderAll(); el('rosterReconcileModal')?.classList.remove('show'); setLiveStatusMessage(`Roster reconciled: ${reconcileDraft.matched.length} matched, ${reconcileDraft.added.length} new, ${el('reconcileArchiveMissing')?.checked ? reconcileDraft.missing.length : 0} archived.`); reconcileDraft = null;
  }

  const SHARE_PRESETS = Object.freeze([
    { id:'teacher',title:'Teacher Backup',description:'Encrypted complete backup with all classes, notes, requirements, snapshots, templates, and settings.',sensitive:true },
    { id:'substitute',title:'Substitute Copy',description:'Current class names, grade, public notes, substitute notes, seating, and room layout. Private notes and requirements are excluded.' },
    { id:'student',title:'Student-Facing Copy',description:'Current class names and seating only. IDs, grades, notes, requirements, groups, and zones are excluded.' },
    { id:'room',title:'Room Layout Template',description:'Room geometry, objects, zones, and blank seats. No student records or assignments.' },
    { id:'support',title:'Support-Team Custom',description:'Current class with only the fields selected below. Review sensitive-note choices carefully.',sensitive:true },
    { id:'anonymous',title:'Anonymous Layout',description:'Current seating layout with numbered student placeholders and no notes, IDs, or requirements.' }
  ]);

  function renderSafeSharePresets() {
    const grid = el('safeShareGrid'); if (!grid) return;
    grid.innerHTML = SHARE_PRESETS.map(item => `<article class="workflow-card"><h3>${escapeHtml(item.title)}</h3><p class="muted">${escapeHtml(item.description)}</p><button type="button" class="${item.sensitive ? 'secondary' : ''}" data-safe-share-preset="${item.id}">Review &amp; Export</button></article>`).join('');
  }

  function sanitizedShareDocument(preset) {
    persistActiveClass();
    const cls = deepClone(activeClassRecord() || {});
    const include = {
      ids: preset === 'support' ? Boolean(el('shareIncludeIds')?.checked) : preset === 'substitute',
      grades: preset === 'support' ? Boolean(el('shareIncludeGrades')?.checked) : preset === 'substitute',
      publicNotes: preset === 'support' ? Boolean(el('shareIncludePublicNotes')?.checked) : preset === 'substitute',
      subNotes: preset === 'support' ? Boolean(el('shareIncludeSubNotes')?.checked) : preset === 'substitute',
      privateNotes: preset === 'support' ? Boolean(el('shareIncludePrivateNotes')?.checked) : false,
      requirements: preset === 'support' ? Boolean(el('shareIncludeRequirements')?.checked) : false
    };
    if (preset === 'room') {
      cls.students=[]; cls.groups=[]; Object.values(cls.cells||{}).forEach(cell=>{cell.assignedStudentId=null;cell.manual=false;cell.anchorGroupIds=[];}); (cls.freeformLayout?.objects||[]).forEach(obj=>{if(obj.type==='seat'){obj.assignedStudentId=null;obj.manual=false;obj.locked=false;obj.anchorGroupIds=[];}});
    } else {
      const idMap = new Map();
      cls.students = (cls.students || []).map((student,index) => {
        const anonymous = preset === 'anonymous'; const id = anonymous ? `student-${index+1}` : (include.ids ? student.id : `shared-${index+1}`); idMap.set(String(student.id),id);
        return { id, firstName:anonymous?'Student':student.firstName, lastName:anonymous?String(index+1):student.lastName, nickName:anonymous?'':student.nickName, grade:include.grades?student.grade:'', notesPrivate:include.privateNotes?student.notesPrivate:'', notesSubstitute:include.subNotes?student.notesSubstitute:'', notesPublic:include.publicNotes?student.notesPublic:'', noteCategories:{private:include.privateNotes?student.notesPrivate:'',substitute:include.subNotes?student.notesSubstitute:'',public:include.publicNotes?student.notesPublic:''}, requirements:include.requirements?student.requirements:normalizeStudent({}).requirements };
      });
      Object.values(cls.cells||{}).forEach(cell=>{if(cell.assignedStudentId)cell.assignedStudentId=idMap.get(String(cell.assignedStudentId))||null;if(['student','anonymous'].includes(preset)){cell.anchorGroupIds=[];cell.zoneIds=[];}});
      (cls.freeformLayout?.objects||[]).forEach(obj=>{if(obj.assignedStudentId)obj.assignedStudentId=idMap.get(String(obj.assignedStudentId))||null;if(['student','anonymous'].includes(preset)){obj.anchorGroupIds=[];obj.zoneIds=[];}});
      if (['student','anonymous'].includes(preset)) { cls.groups=[]; cls.zones=[]; }
      else cls.groups=(cls.groups||[]).map(b=>({...b,studentIds:(b.studentIds||[]).map(id=>idMap.get(String(id))).filter(Boolean)}));
    }
    return { format:SAFE_SHARE_FORMAT,app:APP_NAME,version:APP_REVISION,dataSchemaVersion:DATA_SCHEMA_VERSION,minimumReaderSchemaVersion:MIN_SUPPORTED_DATA_SCHEMA_VERSION,encryptionEnvelopeVersion:ENCRYPTION_ENVELOPE_VERSION,sharePreset:preset,exportedAt:new Date().toISOString(),class:cls };
  }

  function safeShareDescription(preset) {
    const item = SHARE_PRESETS.find(entry => entry.id === preset); if (!item) return '';
    if (preset === 'support') {
      const included = [el('shareIncludeIds')?.checked&&'IDs',el('shareIncludeGrades')?.checked&&'grades',el('shareIncludePublicNotes')?.checked&&'public notes',el('shareIncludeSubNotes')?.checked&&'substitute notes',el('shareIncludePrivateNotes')?.checked&&'private notes',el('shareIncludeRequirements')?.checked&&'seating requirements'].filter(Boolean);
      return `${item.description}\n\nIncluded custom fields: ${included.join(', ') || 'names and seating only'}.`;
    }
    return item.description;
  }

  async function exportSafeShare(preset) {
    safeSharePreset = preset;
    if (el('safeSharePreview')) el('safeSharePreview').textContent = safeShareDescription(preset);
    if (preset === 'teacher') { await downloadSavePackage(); return; }
    const document = sanitizedShareDocument(preset);
    const sensitive = preset === 'support' && (el('shareIncludePrivateNotes')?.checked || el('shareIncludeSubNotes')?.checked || el('shareIncludeRequirements')?.checked);
    const perform = async () => {
      const text = await addBackupManifest(JSON.stringify(document,null,2), 'safe-share');
      downloadText(backupFilename(`share-${preset}`,'json'),text,'application/json');
      await recordBackupVerification(text, `${SHARE_PRESETS.find(item=>item.id===preset)?.title || preset} export`);
      setLiveStatusMessage(`${SHARE_PRESETS.find(item=>item.id===preset)?.title || preset} downloaded.`);
    };
    if (sensitive) showInAppConfirm('This custom support-team export includes sensitive student information. Confirm that the destination and recipient are approved.',perform,{title:'Export Sensitive Student Data?',confirmText:'Export Approved Copy',cancelText:'Cancel'});
    else await perform();
  }

  async function recordBackupVerification(payload, label = 'Backup') {
    try {
      let text = String(payload || '');
      let encrypted = false;
      const outer = JSON.parse(text);
      if (outer?.encrypted) {
        encrypted = true;
        assertSupportedEncryptedEnvelope(outer, label);
        const key = currentSessionEncryptionKey();
        if (!key) throw new Error('The backup is encrypted, but the current session password is unavailable for verification.');
        text = await decryptTextEnvelope(outer, key);
      }
      const document = JSON.parse(text);
      if (encrypted) assertEnvelopePayloadCompatibility(outer, document, label);
      validateImportDocument(document, label);
      let classes = [];
      if (document.format === SAVE_DOCUMENT_FORMAT) {
        assertSupportedSaveDocument(document, label);
        classes = document.classes;
      } else if (document.format === COMPONENT_EXPORT_FORMAT) {
        assertSupportedComponentExport(document, label);
        classes = [classFromCurrentComponentExport(document)];
      } else if (document.format === SAFE_SHARE_FORMAT) {
        assertSupportedPayloadMetadata(document, label, SAFE_SHARE_FORMAT);
        if (!document.class || typeof document.class !== 'object' || Array.isArray(document.class)) throw unsupportedFormatError(label, 'The safe-share class record is missing.');
        classes = [document.class];
      } else {
        throw unsupportedFormatError(label, 'Expected a current save, component export, or safe-share export.');
      }
      const integrity = await verifyBackupManifest(document, label);
      const students = classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0);
      const snapshots = document.format === SAVE_DOCUMENT_FORMAT ? (document.appSnapshots || []).length : 0;
      uiState.lastBackupVerification = {
        label,
        verifiedAt: new Date().toISOString(),
        encrypted,
        classes: classes.length,
        students,
        snapshots,
        dataSchemaVersion: document.dataSchemaVersion,
        hash: integrity.contentHash,
        manifestVerified: true
      };
      if (el('backupVerificationBody')) el('backupVerificationBody').textContent = `${label}
Verified: ${new Date(uiState.lastBackupVerification.verifiedAt).toLocaleString()}
Encrypted payload: ${encrypted ? 'yes' : 'no'}
Classes: ${classes.length}
Students: ${students}
Snapshots: ${snapshots}
Data schema: ${uiState.lastBackupVerification.dataSchemaVersion}
SHA-256: ${uiState.lastBackupVerification.hash}
Manifest: verified

The schema-compatible payload parsed successfully${encrypted ? ' and decrypted with the active session password' : ''}.`;
      el('backupVerificationModal')?.classList.add('show');
      return uiState.lastBackupVerification;
    } catch (err) {
      if (el('backupVerificationBody')) el('backupVerificationBody').textContent = `Verification failed: ${err.message}`;
      el('backupVerificationModal')?.classList.add('show');
      return null;
    }
  }

  function saveConflict(message, callbacks = {}) {
    uiState.pendingSaveConflict = callbacks;
    if (el('saveConflictMessage')) el('saveConflictMessage').textContent = message;
    const mergeButton = el('saveConflictMergeBtn');
    if (mergeButton) mergeButton.hidden = typeof callbacks.merge !== 'function';
    el('saveConflictModal')?.classList.add('show');
    return false;
  }

  async function linkedFileConflict(handle) {
    if (!handle || !uiState.linkedFileLastModified) return false;
    try { const file=await handle.getFile(); return Number(file.lastModified||0)>Number(uiState.linkedFileLastModified||0)+1000; }
    catch (err) { return false; }
  }

  async function googleDriveConflict(fileId, baseline = {}) {
    if (!fileId || !hasUsableGoogleDriveToken()) return null;
    const known = typeof baseline === 'string' ? { lastSavedAt: baseline } : (baseline || {});
    try {
      const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,size,version,md5Checksum,headRevisionId`, { method:'GET' }, false);
      const meta = await response.json();
      const reasons = [];
      if (known.fileVersion && meta.version && String(meta.version) !== String(known.fileVersion)) reasons.push(`Remote version changed from ${known.fileVersion} to ${meta.version}.`);
      if (known.headRevisionId && meta.headRevisionId && String(meta.headRevisionId) !== String(known.headRevisionId)) reasons.push('The remote head revision changed.');
      if (known.remoteMd5 && meta.md5Checksum && String(meta.md5Checksum) !== String(known.remoteMd5)) reasons.push('The remote content checksum changed.');
      if (known.lastSavedAt && Date.parse(meta.modifiedTime || '') > Date.parse(known.lastSavedAt || '') + 1000) reasons.push(`Remote modified time is ${new Date(meta.modifiedTime).toLocaleString()}.`);
      return reasons.length ? { ...meta, reasons } : null;
    } catch (err) {
      return {
        id: fileId,
        unverified: true,
        reasons: [`The remote Drive file could not be verified before saving: ${err?.message || 'unknown metadata error'}.`]
      };
    }
  }

  async function renderDeploymentDiagnostics() {
    const diagnostics = await BrowserDataStore.diagnostics();
    const secure = window.isSecureContext; const protocol=location.protocol; const embedded=appIsEmbeddedFrame(); const linked=linkedSaveApiSupported(); const driveConfigured=googleDriveConfigured();
    const pickerStatus = googlePickerConfigurationStatus();
    const pwaStatus = window.__plannerPwaStatus || {};
    const pwaSupported = 'serviceWorker' in navigator;
    const pwaValue = !pwaSupported
      ? 'Unsupported by this browser'
      : protocol !== 'https:'
        ? 'Requires HTTPS hosted package'
        : pwaStatus.error
          ? `Registration failed: ${pwaStatus.error}`
          : pwaStatus.registered
            ? (pwaStatus.controlling ? 'Registered, offline cache ready, and controlling this page' : 'Registered; control activates after navigation/reload')
            : 'Registration pending';
    const rows=[
      ['Page origin',`${protocol}//${location.host||'(local file)'}`,protocol==='https:'||protocol==='file:'?'good':'warn'],
      ['Secure context',secure?'Available':'Unavailable',secure?'good':'bad'],
      ['IndexedDB',diagnostics.indexedDb?`Available (${diagnostics.databaseName})`:'Unavailable',diagnostics.indexedDb?'good':'bad'],
      ['Browser storage',diagnostics.quota?`${Math.round(diagnostics.usage/1048576)} MB used of ${Math.round(diagnostics.quota/1048576)} MB`:'Estimate unavailable',diagnostics.quota?'good':'warn'],
      ['Persistent storage',diagnostics.persisted===true?'Granted':diagnostics.persisted===false?'Not granted':'Unsupported',diagnostics.persisted===true?'good':'warn'],
      ['Linked file API',linked?'Supported':'Unavailable in this browser/origin',linked?'good':'warn'],
      ['Google Drive OAuth',driveConfigured?(secure&&!embedded?'Configured and origin may authorize':'Configured, but current environment may block OAuth'):'Client ID not configured',driveConfigured&&secure&&!embedded?'good':'warn'],
      ['Google Drive Picker',pickerStatus.ready?'Configured for shared-file selection':`Missing ${pickerStatus.missing.join(', ')}`,pickerStatus.ready?'good':'warn'],
      ['Embedded frame',embedded?'Yes; file pickers/OAuth may be restricted':'No','good'],
      ['PWA/service worker',pwaValue,pwaStatus.registered&&pwaStatus.controlling?'good':'warn'],
      ['Data schema',String(DATA_SCHEMA_VERSION),'good'],['Encryption envelope',String(ENCRYPTION_ENVELOPE_VERSION),'good']
    ];
    if (el('deploymentDiagnosticsGrid')) el('deploymentDiagnosticsGrid').innerHTML = rows.map(([name,value,status])=>`<div class="workflow-card"><div class="diagnostic-row"><strong>${escapeHtml(name)}</strong><span class="diagnostic-status ${status}">${escapeHtml(value)}</span></div></div>`).join('');
  }

  async function requestPersistentStorage() {
    try { const granted=await navigator.storage?.persist?.(); setLiveStatusMessage(granted?'Persistent browser storage was granted.':'The browser did not grant persistent storage. Keep external backups.'); await renderDeploymentDiagnostics(); }
    catch (err) { setLiveStatusMessage(`Persistent storage request failed: ${err.message}`); }
  }

  function freeformSelectedObjects({ includeLocked = true } = {}) {
    const selected = uiState.freeformSelectedObjectIds || new Set();
    return (state.freeformLayout?.objects || []).filter(obj => selected.has(obj.id) && (includeLocked || !obj.locked));
  }

  function selectedFreeformBounds(objects = freeformSelectedObjects()) {
    if (!objects.length) return null;
    const bounds = objects.map(freeformObjectBounds);
    const x = Math.min(...bounds.map(item => item.x));
    const y = Math.min(...bounds.map(item => item.y));
    const right = Math.max(...bounds.map(item => item.x + item.width));
    const bottom = Math.max(...bounds.map(item => item.y + item.height));
    return { x, y, width:right-x, height:bottom-y, right, bottom };
  }

  function alignmentGuideElements() {
    const grid = el('seatGrid');
    if (!grid || state.layoutMode !== 'freeform') return {};
    let vertical = grid.querySelector('.freeform-alignment-guide.vertical');
    let horizontal = grid.querySelector('.freeform-alignment-guide.horizontal');
    if (!vertical) { vertical=document.createElement('div'); vertical.className='freeform-alignment-guide vertical no-print'; grid.appendChild(vertical); }
    if (!horizontal) { horizontal=document.createElement('div'); horizontal.className='freeform-alignment-guide horizontal no-print'; grid.appendChild(horizontal); }
    return { vertical, horizontal };
  }

  function clearAlignmentGuides() {
    document.querySelectorAll('.freeform-alignment-guide').forEach(node => node.classList.remove('show'));
  }

  function applyMagneticAlignment(drag, candidateMap) {
    const canvas = state.freeformLayout?.canvas || {};
    if (!canvas.magneticGuides || drag.resize || !candidateMap?.size) { clearAlignmentGuides(); return candidateMap; }
    const movingIds = drag.ids || new Set(candidateMap.keys());
    const moving = (state.freeformLayout?.objects || []).filter(obj => movingIds.has(obj.id)).map(obj => ({ ...obj, ...(candidateMap.get(obj.id) || {}) }));
    const external = (state.freeformLayout?.objects || []).filter(obj => !movingIds.has(obj.id));
    const movingBounds = selectedFreeformBounds(moving);
    if (!movingBounds || !external.length) { clearAlignmentGuides(); return candidateMap; }
    const gridSize = Math.max(5, Number(canvas.gridSize) || 40);
    const threshold = Math.max(9, Math.min(18, gridSize * 0.3)) / Math.max(0.2, freeformCanvasZoom());
    const movingX = [movingBounds.x, movingBounds.x + movingBounds.width/2, movingBounds.right];
    const movingY = [movingBounds.y, movingBounds.y + movingBounds.height/2, movingBounds.bottom];
    let bestX = null, bestY = null;
    external.forEach(obj => {
      const b=freeformObjectBounds(obj);
      [b.x,b.x+b.width/2,b.x+b.width].forEach(target => movingX.forEach(source => { const delta=target-source; if(Math.abs(delta)<=threshold && (!bestX || Math.abs(delta)<Math.abs(bestX.delta))) bestX={delta,target}; }));
      [b.y,b.y+b.height/2,b.y+b.height].forEach(target => movingY.forEach(source => { const delta=target-source; if(Math.abs(delta)<=threshold && (!bestY || Math.abs(delta)<Math.abs(bestY.delta))) bestY={delta,target}; }));
    });
    if (bestX || bestY) {
      drag.magneticAlignedX = Boolean(bestX);
      drag.magneticAlignedY = Boolean(bestY);
      const adjusted = new Map();
      candidateMap.forEach((candidate,id)=>adjusted.set(id,{...candidate,x:candidate.x==null?candidate.x:candidate.x+(bestX?.delta||0),y:candidate.y==null?candidate.y:candidate.y+(bestY?.delta||0)}));
      const {vertical,horizontal}=alignmentGuideElements();
      if(vertical){vertical.classList.toggle('show',!!bestX);if(bestX)vertical.style.left=`${bestX.target}px`;}
      if(horizontal){horizontal.classList.toggle('show',!!bestY);if(bestY)horizontal.style.top=`${bestY.target}px`;}
      return adjusted;
    }
    drag.magneticAlignedX = false;
    drag.magneticAlignedY = false;
    clearAlignmentGuides();
    return candidateMap;
  }

  function onFreeformSelectionChanged() {
    const count = uiState.freeformSelectedObjectIds?.size || 0;
    if (el('freeformSelectionSummary')) {
      const selected = freeformSelectedObjects({includeLocked:true});
      const layers = selected.map(obj=>Number(obj.zIndex)||1);
      const layerText = layers.length ? ` · layer${layers.length===1?'':'s'} ${Math.min(...layers)}${layers.length>1?`–${Math.max(...layers)}`:''}` : '';
      el('freeformSelectionSummary').textContent = `${count} object${count===1?'':'s'} selected${count>1?' · drag any selected object to move the selection together':''}${layerText}`;
    }
    const disabled = count === 0;
    document.querySelectorAll('[data-requires-freeform-selection]').forEach(button => { button.disabled=disabled; });
    const selected=freeformSelectedObjects({includeLocked:true});
    const selectedGroupIds=new Set(selected.map(obj=>String(obj.groupId||'')).filter(Boolean));
    const groupButton=el('groupFreeformSelectionBtn');
    if(groupButton)groupButton.disabled=count<2;
    const ungroupButton=el('ungroupFreeformSelectionInlineBtn');
    if(ungroupButton)ungroupButton.disabled=!selectedGroupIds.size;
    const lockGroupButton=el('lockFreeformGroupBtn');
    if(lockGroupButton){
      const groupObjects=(state.freeformLayout?.objects||[]).filter(obj=>selectedGroupIds.has(String(obj.groupId||'')));
      const groupsLocked=groupObjects.length>0&&groupObjects.every(obj=>obj.locked);
      lockGroupButton.disabled=!selectedGroupIds.size;
      lockGroupButton.textContent=groupsLocked?'Unlock group':'Lock group';
      lockGroupButton.setAttribute('aria-label',groupsLocked?'Unlock all objects in the selected group':'Lock all objects in the selected group');
    }
    updateFreeformMinimap();
  }

  function openFreeformWorkspaceTools() {
    ensureFreeformLayout();
    populateFreeformGroupControls();
    populateFreeformFindStudent();
    renderRoomHistory();
    syncFreeformPrintControls();
    onFreeformSelectionChanged();
    el('freeformWorkspaceModal')?.classList.add('show');
  }

  function createFreeformGroup(nameOverride = '') {
    const selected=freeformSelectedObjects({includeLocked:true});
    if(selected.length<2){setLiveStatusMessage('Select at least two objects to create a named group.');return;}
    pushUndoSnapshot('Before creating freeform group');
    const defaultName=`Group ${(state.freeformLayout.groups||[]).length+1}`;
    const name=String(nameOverride||el('freeformGroupNameInput')?.value||'').trim().slice(0,60)||defaultName;
    const oldGroupIds=new Set(selected.map(obj=>String(obj.groupId||'')).filter(Boolean));
    const group={id:uid('freeform-group'),name,color:defaultGroupColor((state.freeformLayout.groups||[]).length+5),locked:false};
    state.freeformLayout.groups.push(group);
    selected.forEach(obj=>{obj.groupId=group.id;});
    if(oldGroupIds.size){
      const used=new Set((state.freeformLayout.objects||[]).map(obj=>String(obj.groupId||'')).filter(Boolean));
      state.freeformLayout.groups=(state.freeformLayout.groups||[]).filter(item=>used.has(String(item.id)));
    }
    commitFreeformLayoutChange('freeform-create-group',{render:true});
    populateFreeformGroupControls();
    setLiveStatusMessage(`${name} created with ${selected.length} objects. Drag any member to move the full group. Alt-click selects only one member.`);
  }

  function quickCreateFreeformGroup() {
    const selected=freeformSelectedObjects({includeLocked:true});
    if(selected.length<2){setLiveStatusMessage('Box-select or Shift-click at least two seats or room objects first.');return;}
    const suggested=`Group ${(state.freeformLayout.groups||[]).length+1}`;
    if(typeof openTextInputModal==='function'){
      openTextInputModal({title:'Group Selected Objects',label:'Group name',value:suggested,confirmText:'Create Group',onConfirm:name=>createFreeformGroup(name)});
    } else createFreeformGroup(suggested);
  }

  function toggleSelectedFreeformGroupLock() {
    const selected=freeformSelectedObjects({includeLocked:true});
    const groupIds=new Set(selected.map(obj=>String(obj.groupId||'')).filter(Boolean));
    if(!groupIds.size){setLiveStatusMessage('Group the selected objects before locking the group.');return;}
    const targets=(state.freeformLayout.objects||[]).filter(obj=>groupIds.has(String(obj.groupId||'')));
    if(!targets.length)return;
    pushUndoSnapshot('Before changing Freeform group lock');
    const shouldLock=!targets.every(obj=>obj.locked);
    targets.forEach(obj=>{
      obj.locked=shouldLock;
      if(obj.type==='seat'){
        obj.manual=Boolean(obj.assignedStudentId&&shouldLock);
        const cell=obj.cellKey?state.cells?.[obj.cellKey]:null;
        if(cell&&cell.type==='seat')cell.manual=obj.manual;
      }
    });
    (state.freeformLayout.groups||[]).forEach(group=>{if(groupIds.has(String(group.id)))group.locked=shouldLock;});
    rememberFreeformGeometry(targets);
    commitFreeformLayoutChange('freeform-lock-group',{render:true});
    populateFreeformGroupControls();
    setLiveStatusMessage(`${groupIds.size===1?'Group':'Groups'} ${shouldLock?'locked':'unlocked'}.`);
  }

  function ungroupFreeformSelection() {
    const selected=freeformSelectedObjects({includeLocked:true});
    const affectedGroupIds=new Set(selected.map(obj=>String(obj.groupId||'')).filter(Boolean));
    if(!affectedGroupIds.size){setLiveStatusMessage('Select a grouped Freeform seat or room object first.');return false;}
    pushUndoSnapshot('Before ungrouping freeform objects');
    let changed=0;
    (state.freeformLayout.objects||[]).forEach(obj=>{
      if(affectedGroupIds.has(String(obj.groupId||''))){obj.groupId='';changed+=1;}
    });
    state.freeformLayout.groups=(state.freeformLayout.groups||[]).filter(group=>!affectedGroupIds.has(String(group.id||'')));
    commitFreeformLayoutChange('freeform-ungroup',{render:true});
    populateFreeformGroupControls();
    onFreeformSelectionChanged();
    setLiveStatusMessage(`Ungrouped ${changed} Freeform object${changed===1?'':'s'} from ${affectedGroupIds.size} group${affectedGroupIds.size===1?'':'s'}.`);
    return changed>0;
  }

  function selectFreeformGroupFromControl() {
    const id=String(el('freeformGroupSelect')?.value||'');
    if(!id)return;
    uiState.freeformSelectedObjectIds=new Set((state.freeformLayout.objects||[]).filter(obj=>obj.groupId===id).map(obj=>obj.id));
    updateFreeformSelectionVisuals();
  }

  function populateFreeformGroupControls() {
    const select=el('freeformGroupSelect');
    if(!select)return;
    const current=select.value;
    select.innerHTML='<option value="">Select named group…</option>'+((state.freeformLayout?.groups||[]).map(group=>`<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join(''));
    if(Array.from(select.options).some(option=>option.value===current))select.value=current;
  }

  function moveFreeformLayer(action) {
    const selected=freeformSelectedObjects({includeLocked:false});
    if(!selected.length)return;
    pushUndoSnapshot('Before freeform layer change');
    const all=state.freeformLayout.objects||[];
    const zValues=all.map(obj=>Number(obj.zIndex)||1);
    const min=Math.min(...zValues,1),max=Math.max(...zValues,1);
    if(action==='front')selected.forEach(obj=>{obj.zIndex=state.freeformLayout.nextZ++;});
    else if(action==='back'){selected.sort((a,b)=>(a.zIndex||0)-(b.zIndex||0)).forEach((obj,index)=>{obj.zIndex=min-selected.length+index;});}
    else if(action==='forward')selected.forEach(obj=>{obj.zIndex=Math.min(max+selected.length,(Number(obj.zIndex)||1)+1);});
    else if(action==='backward')selected.forEach(obj=>{obj.zIndex=Math.max(1,(Number(obj.zIndex)||1)-1);});
    all.sort((a,b)=>(Number(a.zIndex)||1)-(Number(b.zIndex)||1)).forEach((obj,index)=>{obj.zIndex=index+1;});
    state.freeformLayout.nextZ=all.length+1;
    commitFreeformLayoutChange(`freeform-layer-${action}`,{render:true});
  }

  function applyFreeformArrange(action) {
    const objects=freeformSelectedObjects({includeLocked:false});
    if(objects.length<2){setLiveStatusMessage('Select at least two unlocked objects for alignment or matching.');return;}
    pushUndoSnapshot(`Before freeform ${action}`);
    const selection=selectedFreeformBounds(objects);
    if(action==='align-left')objects.forEach(obj=>{obj.x+=selection.x-freeformObjectBounds(obj).x;});
    if(action==='align-right')objects.forEach(obj=>{const b=freeformObjectBounds(obj);obj.x+=selection.right-(b.x+b.width);});
    if(action==='align-top')objects.forEach(obj=>{obj.y+=selection.y-freeformObjectBounds(obj).y;});
    if(action==='align-bottom')objects.forEach(obj=>{const b=freeformObjectBounds(obj);obj.y+=selection.bottom-(b.y+b.height);});
    if(action==='center-horizontal')objects.forEach(obj=>{const b=freeformObjectBounds(obj);obj.x+=(selection.x+selection.width/2)-(b.x+b.width/2);});
    if(action==='center-vertical')objects.forEach(obj=>{const b=freeformObjectBounds(obj);obj.y+=(selection.y+selection.height/2)-(b.y+b.height/2);});
    if(action==='match-width'){const width=objects[0].width;objects.slice(1).forEach(obj=>{obj.width=width;});}
    if(action==='match-height'){const height=objects[0].height;objects.slice(1).forEach(obj=>{obj.height=height;});}
    if(action==='distribute-horizontal'){
      const sorted=[...objects].sort((a,b)=>freeformObjectBounds(a).x-freeformObjectBounds(b).x);const first=freeformObjectBounds(sorted[0]);const last=freeformObjectBounds(sorted.at(-1));const total=sorted.reduce((sum,obj)=>sum+freeformObjectBounds(obj).width,0);const gap=(last.x+last.width-first.x-total)/(sorted.length-1);let cursor=first.x;sorted.forEach(obj=>{const b=freeformObjectBounds(obj);obj.x+=cursor-b.x;cursor+=b.width+gap;});
    }
    if(action==='distribute-vertical'){
      const sorted=[...objects].sort((a,b)=>freeformObjectBounds(a).y-freeformObjectBounds(b).y);const first=freeformObjectBounds(sorted[0]);const last=freeformObjectBounds(sorted.at(-1));const total=sorted.reduce((sum,obj)=>sum+freeformObjectBounds(obj).height,0);const gap=(last.y+last.height-first.y-total)/(sorted.length-1);let cursor=first.y;sorted.forEach(obj=>{const b=freeformObjectBounds(obj);obj.y+=cursor-b.y;cursor+=b.height+gap;});
    }
    const targetIds=new Set(objects.map(obj=>obj.id));const external=(state.freeformLayout.objects||[]).filter(obj=>!targetIds.has(obj.id));
    const collision=objects.find(obj=>findFreeformOverlap(obj,null,external,{phase:'drop',excludeIds:targetIds}));
    if(collision){undoLastChange();setLiveStatusMessage('The arrangement was undone because it would overlap a protected room object.');return;}
    rememberFreeformGeometry(objects);commitFreeformLayoutChange(`freeform-${action}`,{render:true});
  }

  function freeformSeatOverlapPairs() {
    const seats=(state.freeformLayout?.objects||[]).filter(obj=>obj.type==='seat');
    const pairs=[];
    for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++)if(freeformRectOverlaps(seats[i],seats[j],{padding:0}))pairs.push([seats[i],seats[j]]);
    return pairs;
  }

  function auditFreeformLayout() {
    ensureFreeformLayout();
    const objects=state.freeformLayout.objects||[];const canvas=state.freeformLayout.canvas||{};const findings=[];const lookups=buildLookupMaps();
    for(let i=0;i<objects.length;i++){
      const obj=objects[i];const b=freeformObjectBounds(obj);
      if(!Number.isFinite(obj.x)||!Number.isFinite(obj.y)||!Number.isFinite(obj.width)||!Number.isFinite(obj.height)||obj.width<=0||obj.height<=0)findings.push({severity:'error',type:'dimensions',ids:[obj.id],message:`${freeformObjectLabel(obj,lookups)} has invalid geometry.`});
      if(b.x<0||b.y<0||b.x+b.width>canvas.width||b.y+b.height>canvas.height)findings.push({severity:'warning',type:'bounds',ids:[obj.id],message:`${freeformObjectLabel(obj,lookups)} extends outside the canvas.`});
      if(obj.type==='seat'&&obj.assignedStudentId&&!getStudent(obj.assignedStudentId))findings.push({severity:'error',type:'missing-student',ids:[obj.id],message:`${freeformObjectLabel(obj,lookups)} references a missing student.`});
      if(obj.type==='seat'&&obj.locked&&!obj.assignedStudentId)findings.push({severity:'info',type:'empty-lock',ids:[obj.id],message:`${freeformObjectLabel(obj,lookups)} is locked but empty.`});
      for(let j=i+1;j<objects.length;j++){
        const other=objects[j];if(!freeformRectOverlaps(obj,other,{padding:0}))continue;
        findings.push({severity:(obj.type==='seat'&&other.type==='seat')?'warning':'error',type:'overlap',ids:[obj.id,other.id],message:`${freeformObjectLabel(obj,lookups)} overlaps ${freeformObjectLabel(other,lookups)}.`});
      }
      const covering=objects.find(other=>other.id!==obj.id&&(Number(other.zIndex)||1)>(Number(obj.zIndex)||1)&&(()=>{const ob=freeformObjectBounds(other);return ob.x<=b.x&&ob.y<=b.y&&ob.x+ob.width>=b.x+b.width&&ob.y+ob.height>=b.y+b.height;})());
      if(covering)findings.push({severity:'warning',type:'hidden',ids:[obj.id,covering.id],message:`${freeformObjectLabel(obj,lookups)} is fully hidden under ${freeformObjectLabel(covering,lookups)}.`});
    }
    const definedGroups=new Set((state.freeformLayout.groups||[]).map(group=>String(group.id)));
    objects.filter(obj=>obj.groupId&&!definedGroups.has(String(obj.groupId))).forEach(obj=>findings.push({severity:'warning',type:'orphan-group',ids:[obj.id],message:`${freeformObjectLabel(obj,lookups)} references a missing named group.`}));
    const assignments=new Map();objects.filter(obj=>obj.type==='seat'&&obj.assignedStudentId).forEach(obj=>{const id=String(obj.assignedStudentId);if(!assignments.has(id))assignments.set(id,[]);assignments.get(id).push(obj);});assignments.forEach((items,id)=>{if(items.length>1)findings.push({severity:'error',type:'duplicate-assignment',ids:items.map(obj=>obj.id),message:`${studentDisplay(getStudent(id)||{id})} is assigned to ${items.length} freeform seats.`});});
    uiState.freeformAuditFindings=findings;
    return findings;
  }

  function renderFreeformAudit() {
    const findings=auditFreeformLayout();const body=el('freeformAuditResults');if(!body)return;
    if(!findings.length){body.innerHTML='<div class="successbox">No Freeform integrity problems were found.</div>';return;}
    const counts={error:0,warning:0,info:0};findings.forEach(f=>counts[f.severity]=(counts[f.severity]||0)+1);
    body.innerHTML=`<div class="audit-summary"><span class="pill avoid">${counts.error} errors</span><span class="pill special">${counts.warning} warnings</span><span class="pill">${counts.info} notes</span></div><div class="audit-finding-list">${findings.map((finding,index)=>`<button type="button" class="audit-finding ${finding.severity}" data-audit-finding="${index}"><strong>${escapeHtml(finding.type.replaceAll('-',' '))}</strong><span>${escapeHtml(finding.message)}</span></button>`).join('')}</div>`;
  }

  function openFreeformAudit() {renderFreeformAudit();el('freeformAuditModal')?.classList.add('show');}
  function highlightAuditFinding(index){const finding=uiState.freeformAuditFindings?.[Number(index)];uiState.freeformAuditObjectIds=new Set(finding?.ids||[]);renderFreeformLayout();if(finding?.ids?.[0])centerFreeformObject(finding.ids[0]);}
  function clearAuditHighlights(){uiState.freeformAuditObjectIds=new Set();renderFreeformLayout();}
  function resolveFreeformOverlaps(){
    let pairs=freeformSeatOverlapPairs();if(!pairs.length){setLiveStatusMessage('No overlapping seat pairs need resolution.');return;}
    pushUndoSnapshot('Before resolving freeform overlaps');saveRoomVersion('Before overlap resolution',false);

    pairs=freeformSeatOverlapPairs();
    const moved=new Set();
    const canvas=state.freeformLayout.canvas||{};
    const step=Math.max(24,Number(canvas.gridSize)||40);
    pairs.forEach(([first,second])=>{
      let target=second.locked&&!first.locked?first:second;
      if(target.locked||moved.has(target.id))return;
      const start={x:target.x,y:target.y};
      positionFreeformObjectWithoutOverlap(target,{startX:target.x,startY:target.y,forceSeatCollision:true});
      if(findFreeformOverlap(target,null,state.freeformLayout.objects,{phase:'drop',forceSeatCollision:true})){
        let found=false;
        for(let radius=1;radius<80&&!found;radius++){
          const candidates=[[radius,0],[-radius,0],[0,radius],[0,-radius],[radius,radius],[-radius,radius],[radius,-radius],[-radius,-radius]];
          for(const [dx,dy] of candidates){
            const x=clampNumber(start.x+dx*step,0,Math.max(0,(canvas.width||2800)-target.width));
            const y=clampNumber(start.y+dy*step,0,Math.max(0,(canvas.height||1800)-target.height));
            if(!findFreeformOverlap(target,{x,y},state.freeformLayout.objects,{phase:'drop',forceSeatCollision:true})){target.x=x;target.y=y;found=true;break;}
          }
        }
      }
      if(target.x!==start.x||target.y!==start.y)moved.add(target.id);
    });
    rememberFreeformGeometry(state.freeformLayout.objects);commitFreeformLayoutChange('freeform-resolve-overlaps',{render:true});renderFreeformAudit();setLiveStatusMessage(`Resolved ${moved.size} overlapping seat${moved.size===1?'':'s'} without moving locked objects.`);
  }

  function handleSeatOverlapSettingChanged() {
    if(state.layoutMode!=='freeform'||state.freeformLayout?.canvas?.allowSeatOverlapOnDrop)return;
    const pairs=freeformSeatOverlapPairs();if(!pairs.length)return;
    uiState.freeformAuditObjectIds=new Set(pairs.flat().map(obj=>obj.id));
    renderFreeformLayout();
    renderFreeformAudit();
    el('freeformAuditModal')?.classList.add('show');
    setLiveStatusMessage(`${pairs.length} existing seat overlap${pairs.length===1?'':'s'} remain in place. Review or resolve them from the Freeform audit.`);
  }

  function fitFreeformRoom() {
    const wrap=freeformScroller();if(!wrap)return;const canvas=state.freeformLayout.canvas;const zoom=Math.min((wrap.clientWidth-32)/canvas.width,(wrap.clientHeight-32)/canvas.height);canvas.zoom=clampNumber(zoom,0.2,2.5);wrap.scrollTo({left:0,top:0,behavior:'smooth'});commitFreeformLayoutChange('freeform-fit-room',{render:true});
  }
  function fitFreeformSelection() {
    const bounds=selectedFreeformBounds();const wrap=freeformScroller();if(!bounds||!wrap){setLiveStatusMessage('Select one or more Freeform objects first.');return;}const zoom=Math.min((wrap.clientWidth-60)/Math.max(1,bounds.width),(wrap.clientHeight-60)/Math.max(1,bounds.height));state.freeformLayout.canvas.zoom=clampNumber(zoom,0.2,2.5);renderFreeformLayout();const z=freeformCanvasZoom();wrap.scrollTo({left:Math.max(0,bounds.x*z-30),top:Math.max(0,bounds.y*z-30),behavior:'smooth'});updateFreeformMinimap();
  }
  function resetFreeformView(){state.freeformLayout.canvas.zoom=1;renderFreeformLayout();const canvas=state.freeformLayout.canvas;requestAnimationFrame(()=>centerFreeformCanvasPoint(canvas.width/2,canvas.height/2,'smooth'));updateFreeformMinimap();}
  function centerFreeformObject(id){const obj=(state.freeformLayout?.objects||[]).find(item=>item.id===id);const wrap=freeformScroller();if(!obj||!wrap)return;const b=freeformObjectBounds(obj);centerFreeformCanvasPoint(b.x+b.width/2,b.y+b.height/2,'smooth');selectFreeformObject(obj.id,false,true);}
  function findFreeformStudent(){const studentId=String(el('freeformFindStudentSelect')?.value||'');const seat=(state.freeformLayout?.objects||[]).find(obj=>obj.type==='seat'&&String(obj.assignedStudentId||'')===studentId);if(seat)centerFreeformObject(seat.id);else setLiveStatusMessage('That student is not assigned to a Freeform seat.');}
  function populateFreeformFindStudent(){const select=el('freeformFindStudentSelect');if(!select)return;select.innerHTML='<option value="">Find assigned student…</option>'+[...(state.students||[])].sort((a,b)=>studentDisplay(a).localeCompare(studentDisplay(b))).map(student=>`<option value="${escapeHtml(student.id)}">${escapeHtml(studentDisplay(student))}</option>`).join('');}

  function ensureFreeformMinimap() {
    const wrap=freeformScroller();if(!wrap||state.layoutMode!=='freeform')return null;let map=wrap.querySelector('#freeformMinimap');if(!map){map=document.createElement('div');map.id='freeformMinimap';map.className='freeform-minimap no-print';map.innerHTML='<div class="freeform-minimap-objects"></div><div class="freeform-minimap-viewport"></div>';map.addEventListener('pointerdown',event=>{const rect=map.getBoundingClientRect();const canvas=state.freeformLayout.canvas;const x=(event.clientX-rect.left)/rect.width*canvas.width;const y=(event.clientY-rect.top)/rect.height*canvas.height;centerFreeformCanvasPoint(x,y,'smooth');});wrap.appendChild(map);wrap.addEventListener('scroll',updateFreeformMinimap,{passive:true});}return map;
  }
  function updateFreeformMinimap(){
    if(state.layoutMode!=='freeform')return;const canvas=state.freeformLayout?.canvas||{};const map=ensureFreeformMinimap();if(!map)return;map.classList.toggle('hidden',canvas.showMinimap===false);if(canvas.showMinimap===false)return;const objects=map.querySelector('.freeform-minimap-objects');objects.innerHTML=(state.freeformLayout.objects||[]).map(obj=>`<span class="${escapeHtml(obj.type)}${uiState.freeformSelectedObjectIds?.has(obj.id)?' selected':''}" style="left:${obj.x/canvas.width*100}%;top:${obj.y/canvas.height*100}%;width:${Math.max(1,obj.width/canvas.width*100)}%;height:${Math.max(1,obj.height/canvas.height*100)}%"></span>`).join('');const wrap=freeformScroller();const viewport=map.querySelector('.freeform-minimap-viewport');const z=freeformCanvasZoom();const grid=el('seatGrid');const wrapRect=wrap.getBoundingClientRect(),gridRect=grid.getBoundingClientRect();const visibleLeft=Math.max(0,(wrapRect.left-gridRect.left)/z),visibleTop=Math.max(0,(wrapRect.top-gridRect.top)/z);viewport.style.left=`${visibleLeft/canvas.width*100}%`;viewport.style.top=`${visibleTop/canvas.height*100}%`;viewport.style.width=`${Math.min(100,(wrap.clientWidth/z)/canvas.width*100)}%`;viewport.style.height=`${Math.min(100,(wrap.clientHeight/z)/canvas.height*100)}%`;
  }
  function toggleFreeformMinimap(){state.freeformLayout.canvas.showMinimap=!state.freeformLayout.canvas.showMinimap;uiState.pageSettings.freeformShowMinimap=state.freeformLayout.canvas.showMinimap;schedulePageSettingsPersistence('freeform-minimap');updateFreeformMinimap();if(typeof syncFreeformToolbarState==='function')syncFreeformToolbarState();}

  function roomVersionPayload(){const layout=state.freeformLayout;return{initialized:true,canvas:{...deepClone(layout.canvas),zoom:1},groups:deepClone(layout.groups||[]),objects:(layout.objects||[]).map(obj=>{const copy=deepClone(obj);delete copy.assignedStudentId;delete copy.manual;delete copy.anchorGroupIds;delete copy.zoneIds;return copy;})};}
  function saveRoomVersion(name=null,announce=true){ensureFreeformLayout();const history=state.freeformLayout.roomHistory||(state.freeformLayout.roomHistory=[]);const version={id:uid('room-version'),name:String(name||el('roomVersionNameInput')?.value||`Room ${new Date().toLocaleString()}`).trim().slice(0,80),createdAt:new Date().toISOString(),...roomVersionPayload()};history.unshift(version);if(history.length>24)history.length=24;persistActiveClass();scheduleLinkedAutoSave('freeform-room-history');renderRoomHistory();if(announce)setLiveStatusMessage(`Saved room-layout version “${version.name}”.`);return version;}
  function renderRoomHistory(){const list=el('roomHistoryList');if(!list)return;const history=state.freeformLayout?.roomHistory||[];list.innerHTML=history.length?history.map(entry=>`<div class="room-history-row"><div><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(new Date(entry.createdAt).toLocaleString())}</span></div><div class="button-row"><button type="button" class="tiny secondary" data-restore-room-version="${escapeHtml(entry.id)}">Restore</button><button type="button" class="tiny danger" data-delete-room-version="${escapeHtml(entry.id)}" aria-label="Delete ${escapeHtml(entry.name)}">×</button></div></div>`).join(''):'<div class="restore-empty">No room-layout versions saved yet.</div>';}
  function restoreRoomVersion(id){const version=(state.freeformLayout?.roomHistory||[]).find(entry=>entry.id===id);if(!version)return;pushUndoSnapshot('Before restoring room version');const currentById=new Map((state.freeformLayout.objects||[]).map(obj=>[obj.id,obj]));const currentByCell=new Map((state.freeformLayout.objects||[]).filter(obj=>obj.cellKey).map(obj=>[obj.cellKey,obj]));const history=state.freeformLayout.roomHistory;const restored=normalizeFreeformLayout({initialized:version.initialized,canvas:version.canvas,groups:version.groups,objects:version.objects,roomHistory:history});restored.objects.forEach(obj=>{const existing=currentById.get(obj.id)||currentByCell.get(obj.cellKey);if(existing&&obj.type==='seat'){obj.assignedStudentId=existing.assignedStudentId||null;obj.manual=Boolean(existing.manual);obj.anchorGroupIds=deepClone(existing.anchorGroupIds||[]);obj.zoneIds=deepClone(existing.zoneIds||[]);}});state.freeformLayout=restored;resetFreeformGeometryCache();rememberFreeformGeometry(restored.objects);commitFreeformLayoutChange('freeform-restore-room-version',{render:true});renderRoomHistory();}
  function deleteRoomVersion(id){state.freeformLayout.roomHistory=(state.freeformLayout.roomHistory||[]).filter(entry=>entry.id!==id);persistActiveClass();scheduleLinkedAutoSave('freeform-delete-room-version');renderRoomHistory();}

  function freeformPrintPixels(){const canvas=state.freeformLayout?.canvas||{};const sizes={letter:[8.5,11],legal:[8.5,14],a4:[8.27,11.69]};let [w,h]=sizes[canvas.printPageSize]||sizes.letter;if(canvas.printOrientation==='landscape')[w,h]=[h,w];const margin=Number(canvas.printMargin)||0;return{width:Math.max(96,(w-margin*2)*96),height:Math.max(96,(h-margin*2)*96)};}
  function renderFreeformPrintBoundaries(){const grid=el('seatGrid');if(!grid||state.layoutMode!=='freeform')return;grid.querySelectorAll('.freeform-print-boundary').forEach(node=>node.remove());const canvas=state.freeformLayout.canvas;if(!canvas.showPrintBoundaries)return;const page=freeformPrintPixels();for(let y=0,row=1;y<canvas.height;y+=page.height,row++)for(let x=0,col=1;x<canvas.width;x+=page.width,col++){const node=document.createElement('div');node.className=`freeform-print-boundary no-print${canvas.printCropMarks?' crop-marks':''}`;node.style.left=`${x}px`;node.style.top=`${y}px`;node.style.width=`${Math.min(page.width,canvas.width-x)}px`;node.style.height=`${Math.min(page.height,canvas.height-y)}px`;node.innerHTML=`<span>Page ${row}.${col}</span>${canvas.printCropMarks?'<i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>':''}`;grid.appendChild(node);}}
  function syncFreeformPrintControls(){const c=state.freeformLayout?.canvas||{};if(el('freeformPrintPageSize'))el('freeformPrintPageSize').value=c.printPageSize||'letter';if(el('freeformPrintOrientation'))el('freeformPrintOrientation').value=c.printOrientation||'landscape';if(el('freeformPrintMargin'))el('freeformPrintMargin').value=String(c.printMargin??0.35);if(el('freeformPrintScaleMode'))el('freeformPrintScaleMode').value=c.printScaleMode||'tile';if(el('freeformShowPrintBoundariesToggle'))el('freeformShowPrintBoundariesToggle').checked=Boolean(c.showPrintBoundaries);if(el('freeformShowMinimapToggle'))el('freeformShowMinimapToggle').checked=c.showMinimap!==false;if(el('freeformCropMarksToggle'))el('freeformCropMarksToggle').checked=Boolean(c.printCropMarks);const recommendation=(Number(c.width)||0)>=(Number(c.height)||0)?'Landscape is recommended for this room shape.':'Portrait is recommended for this room shape.';if(el('freeformPrintRecommendation'))el('freeformPrintRecommendation').textContent=recommendation;}
  function applyFreeformPrintSettings(){const c=state.freeformLayout.canvas;c.printPageSize=el('freeformPrintPageSize')?.value||'letter';c.printOrientation=el('freeformPrintOrientation')?.value||'landscape';c.printMargin=clampNumber(el('freeformPrintMargin')?.value??0.35,0,1.5);c.printScaleMode=el('freeformPrintScaleMode')?.value||'tile';c.showPrintBoundaries=Boolean(el('freeformShowPrintBoundariesToggle')?.checked);c.showMinimap=Boolean(el('freeformShowMinimapToggle')?.checked);c.printCropMarks=Boolean(el('freeformCropMarksToggle')?.checked);uiState.pageSettings.freeformShowPrintBoundaries=c.showPrintBoundaries;uiState.pageSettings.freeformShowMinimap=c.showMinimap;schedulePageSettingsPersistence('freeform-print');let style=el('freeformDynamicPrintStyle');if(!style){style=document.createElement('style');style.id='freeformDynamicPrintStyle';document.head.appendChild(style);}style.textContent=`@page { size: ${c.printPageSize} ${c.printOrientation}; margin: ${c.printMargin}in; }`;persistActiveClass();renderFreeformLayout();renderFreeformPrintBoundaries();updateFreeformMinimap();setLiveStatusMessage('Freeform print and viewport settings updated.');}

  function enhanceRenderedWorkspace() {
    enhanceSeatExplanations(); enhanceKeyboardTargets();
    if (state.layoutMode === 'freeform') {
      renderFreeformPrintBoundaries();
      updateFreeformMinimap();
      onFreeformSelectionChanged();
      document.querySelectorAll('.freeform-object[data-group-id]').forEach(node => {
        const group=(state.freeformLayout?.groups||[]).find(item=>item.id===node.dataset.groupId);
        if(group && !node.querySelector('.freeform-group-badge')){const badge=document.createElement('span');badge.className='freeform-group-badge no-print';badge.textContent=group.name;badge.title=`Named group: ${group.name}. Alt-click to select only this object.`;node.appendChild(badge);}
      });
    }
  }

  function installEvents() {
    el('closeSeatingCandidateBtn')?.addEventListener('click',()=>{stopSeatingWorker('Generation canceled.');el('seatingCandidateModal')?.classList.remove('show');});
    el('cancelSeatingWorkerBtn')?.addEventListener('click',()=>stopSeatingWorker('Generation canceled. The current chart was not changed.'));
    el('generateMoreCandidatesBtn')?.addEventListener('click',()=>startCandidateGeneration(uiState.seatingCandidateMode,{ anotherBatch:true }));
    el('acceptSeatingCandidateBtn')?.addEventListener('click',applySelectedCandidate);
    el('seatingCandidateGrid')?.addEventListener('click',event=>{const button=event.target.closest('[data-select-candidate]');if(!button)return;selectedCandidateIndex=Number(button.dataset.selectCandidate);renderCandidateCards();});
    el('closePlacementWhyBtn')?.addEventListener('click',()=>el('placementWhyModal')?.classList.remove('show'));
    el('classToolsBtn')?.addEventListener('click',openClassTools); el('closeClassToolsBtn')?.addEventListener('click',()=>el('classToolsModal')?.classList.remove('show')); el('saveClassDetailsBtn')?.addEventListener('click',saveClassDetails); el('toggleArchiveClassBtn')?.addEventListener('click',toggleClassArchive); el('createRolloverClassBtn')?.addEventListener('click',createRolloverClass); el('showArchivedClassesToggle')?.addEventListener('change',event=>{uiState.pageSettings.showArchivedClasses=event.target.checked;schedulePageSettingsPersistence('class-view');renderClassManager();});
    el('reconcileRosterBtn')?.addEventListener('click',()=>el('reconcileRosterFile')?.click()); el('reconcileRosterFile')?.addEventListener('change',event=>{openRosterReconcileFile(event.target.files?.[0]);event.target.value='';}); el('closeRosterReconcileBtn')?.addEventListener('click',()=>el('rosterReconcileModal')?.classList.remove('show')); el('cancelRosterReconcileBtn')?.addEventListener('click',()=>el('rosterReconcileModal')?.classList.remove('show')); el('applyRosterReconcileBtn')?.addEventListener('click',applyRosterReconcile);
    el('closeSafeShareBtn')?.addEventListener('click',()=>el('safeShareModal')?.classList.remove('show')); el('safeShareGrid')?.addEventListener('click',event=>{const button=event.target.closest('[data-safe-share-preset]');if(button)exportSafeShare(button.dataset.safeSharePreset);}); ['shareIncludeIds','shareIncludeGrades','shareIncludePublicNotes','shareIncludeSubNotes','shareIncludePrivateNotes','shareIncludeRequirements'].forEach(id=>el(id)?.addEventListener('change',()=>{if(safeSharePreset==='support'&&el('safeSharePreview'))el('safeSharePreview').textContent=safeShareDescription('support');}));
    el('closeBackupVerificationBtn')?.addEventListener('click',()=>el('backupVerificationModal')?.classList.remove('show'));
    el('saveConflictCancelBtn')?.addEventListener('click',()=>{uiState.pendingSaveConflict?.cancel?.();uiState.pendingSaveConflict=null;el('saveConflictModal')?.classList.remove('show');});
    el('saveConflictOverwriteBtn')?.addEventListener('click',()=>{const cb=uiState.pendingSaveConflict?.overwrite;uiState.pendingSaveConflict=null;el('saveConflictModal')?.classList.remove('show');cb?.();});
    el('saveConflictCopyBtn')?.addEventListener('click',()=>{const cb=uiState.pendingSaveConflict?.copy;uiState.pendingSaveConflict=null;el('saveConflictModal')?.classList.remove('show');cb?.();});
    el('saveConflictMergeBtn')?.addEventListener('click',()=>{const cb=uiState.pendingSaveConflict?.merge;uiState.pendingSaveConflict=null;el('saveConflictModal')?.classList.remove('show');cb?.();});
    el('saveConflictReviewBtn')?.addEventListener('click',()=>{exportAndDownload('all');});
    el('deploymentDiagnosticsBtn')?.addEventListener('click',()=>{el('deploymentDiagnosticsModal')?.classList.add('show');renderDeploymentDiagnostics();}); el('closeDeploymentDiagnosticsBtn')?.addEventListener('click',()=>el('deploymentDiagnosticsModal')?.classList.remove('show')); el('refreshDeploymentDiagnosticsBtn')?.addEventListener('click',renderDeploymentDiagnostics); el('requestPersistentStorageBtn')?.addEventListener('click',requestPersistentStorage);
    el('openFreeformWorkspaceBtn')?.addEventListener('click',openFreeformWorkspaceTools);
    el('closeFreeformWorkspaceBtn')?.addEventListener('click',()=>el('freeformWorkspaceModal')?.classList.remove('show'));
    el('createFreeformGroupBtn')?.addEventListener('click',()=>createFreeformGroup());
    el('groupFreeformSelectionBtn')?.addEventListener('click',quickCreateFreeformGroup);
    el('ungroupFreeformBtn')?.addEventListener('click',ungroupFreeformSelection);
    el('ungroupFreeformSelectionInlineBtn')?.addEventListener('click',ungroupFreeformSelection);
    el('lockFreeformGroupBtn')?.addEventListener('click',toggleSelectedFreeformGroupLock);
    el('selectFreeformGroupBtn')?.addEventListener('click',selectFreeformGroupFromControl);
    document.querySelectorAll('[data-freeform-layer]').forEach(button=>button.addEventListener('click',()=>moveFreeformLayer(button.dataset.freeformLayer)));
    document.querySelectorAll('[data-freeform-arrange]').forEach(button=>button.addEventListener('click',()=>applyFreeformArrange(button.dataset.freeformArrange)));
    el('fitFreeformRoomBtn')?.addEventListener('click',fitFreeformRoom);
    el('fitFreeformSelectionBtn')?.addEventListener('click',fitFreeformSelection);
    el('resetFreeformViewBtn')?.addEventListener('click',resetFreeformView);
    el('findFreeformStudentBtn')?.addEventListener('click',findFreeformStudent);
    el('toggleFreeformMinimapBtn')?.addEventListener('click',toggleFreeformMinimap);
    el('saveRoomVersionBtn')?.addEventListener('click',()=>saveRoomVersion());
    el('roomHistoryList')?.addEventListener('click',event=>{const restore=event.target.closest('[data-restore-room-version]');const remove=event.target.closest('[data-delete-room-version]');if(restore)restoreRoomVersion(restore.dataset.restoreRoomVersion);if(remove)deleteRoomVersion(remove.dataset.deleteRoomVersion);});
    el('applyFreeformPrintSettingsBtn')?.addEventListener('click',applyFreeformPrintSettings);
    el('openFreeformAuditBtn')?.addEventListener('click',openFreeformAudit);
    el('closeFreeformAuditBtn')?.addEventListener('click',()=>el('freeformAuditModal')?.classList.remove('show'));
    el('refreshFreeformAuditBtn')?.addEventListener('click',renderFreeformAudit);
    el('resolveFreeformOverlapsBtn')?.addEventListener('click',resolveFreeformOverlaps);
    el('clearFreeformAuditHighlightsBtn')?.addEventListener('click',clearAuditHighlights);
    el('freeformAuditResults')?.addEventListener('click',event=>{const item=event.target.closest('[data-audit-finding]');if(item)highlightAuditFinding(item.dataset.auditFinding);});
    el('cancelKeyboardCarryBtn')?.addEventListener('click',()=>setKeyboardCarry(''));
    document.addEventListener('keydown',onKeyboardPlacement,true);
    document.addEventListener('keydown',event=>{
      if(state.layoutMode!=='freeform'||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='g'){event.preventDefault();event.shiftKey?ungroupFreeformSelection():createFreeformGroup();}
      if((event.ctrlKey||event.metaKey)&&event.key===']'){event.preventDefault();moveFreeformLayer(event.shiftKey?'front':'forward');}
      if((event.ctrlKey||event.metaKey)&&event.key==='['){event.preventDefault();moveFreeformLayer(event.shiftKey?'back':'backward');}
      if(event.key.toLowerCase()==='f'&&event.altKey){event.preventDefault();fitFreeformSelection();}
    },true);
    document.body.addEventListener('click',event=>{const why=event.target.closest('[data-placement-why]');if(why){event.preventDefault();event.stopPropagation();openPlacementWhy(why.dataset.placementWhy,why.dataset.cellKey);}});
  }

  function install() {
    if (installed) return;
    installed = true;
    DialogManager.install();
    renderSafeSharePresets();
    installEvents();
    if (el('generatorSeedInput')) el('generatorSeedInput').value = pageSettings().generatorSeed || '';
    if (el('generatorCandidateCount')) el('generatorCandidateCount').value = String(pageSettings().generatorCandidateCount || 3);
    if (el('generatorAttemptsInput')) el('generatorAttemptsInput').value = String(pageSettings().generatorAttempts || 180);
    uiState.freeformAuditObjectIds = new Set();
    document.body.dataset.modernizationV3 = 'installed';
  }

  return Object.freeze({
    install,
    populateStudentRequirements,
    readStudentRequirements,
    studentRequirementPills,
    requirementScore,
    startCandidateGeneration,
    buildGeneratorSeats,
    generatorWorkerSource,
    openPlacementWhy,
    enhanceRenderedWorkspace,
    openClassTools,
    recordBackupVerification,
    saveConflict,
    linkedFileConflict,
    googleDriveConflict,
    renderDeploymentDiagnostics,
    applyMagneticAlignment,
    clearAlignmentGuides,
    updateFreeformMinimap,
    onFreeformSelectionChanged,
    handleSeatOverlapSettingChanged,
    auditFreeformLayout,
    resolveFreeformOverlaps,
    saveRoomVersion,
    openFreeformWorkspaceTools,
    openFreeformAudit,
    toggleFreeformMinimap,
    createFreeformGroup,
    quickCreateFreeformGroup,
    ungroupFreeformSelection,
    toggleSelectedFreeformGroupLock,
    openSafeShare: () => { renderSafeSharePresets(); el('safeShareModal')?.classList.add('show'); }
  });
})();


