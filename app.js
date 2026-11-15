function emptyMeals(){ const o={}; CATEGORIES.forEach(c=>o[c.key]={b:0,l:0,d:0}); return o; }
function getDaySummary(iso){
  const rec=db.records[iso], meals=(rec&&rec.hasMeals)?rec.meals:emptyMeals(); let b=0,l=0,d=0; const byCat={};
  CATEGORIES.forEach(c=>{ const m=meals[c.key]||{b:0,l:0,d:0}, vb=+m.b||0, vl=+m.l||0, vd=+m.d||0; b+=vb; l+=vl; d+=vd; byCat[c.key]={b:vb,l:vl,d:vd,total:vb+vl+vd}; });
  const totalStaff=db.staff.length, absentNotes=[]; let present=0, hasAtt=!!(rec&&rec.hasAttendance);
  if(hasAtt&&rec.attendance) db.staff.forEach(s=>{ const a=rec.attendance[s.id]; if(a&&a.status==='absent') absentNotes.push({name:s.name,reason:a.reason||'ไม่มา'}); else present++; });
  return {hasMeals:!!(rec&&rec.hasMeals),hasAttendance:hasAtt,b,l,d,total:b+l+d,byCat,present,absent:hasAtt?(totalStaff-present):0,totalStaff,absentNotes};
}
function aggregateRange(sIso,eIso){
  const dates=Object.keys(db.records).filter(d=>d>=sIso&&d<=eIso).sort(); let b=0,l=0,d=0,mealDays=0,attDays=0; const byCat={}, staffStats={}, dailyList=[];
  CATEGORIES.forEach(c=>byCat[c.key]={b:0,l:0,d:0,total:0}); db.staff.forEach(s=>staffStats[s.id]={id:s.id,name:s.name,present:0,absent:0});
  dates.forEach(iso=>{
    const s=getDaySummary(iso);
    if(s.hasMeals){ mealDays++; b+=s.b; l+=s.l; d+=s.d; CATEGORIES.forEach(c=>{byCat[c.key].b+=s.byCat[c.key].b;byCat[c.key].l+=s.byCat[c.key].l;byCat[c.key].d+=s.byCat[c.key].d;byCat[c.key].total+=s.byCat[c.key].total;}); }
    if(s.hasAttendance){ attDays++; const r=db.records[iso]; db.staff.forEach(st=>{ const a=r.attendance&&r.attendance[st.id]; if(a&&a.status==='absent') staffStats[st.id].absent++; else staffStats[st.id].present++; }); }
    if(s.hasMeals||s.hasAttendance) dailyList.push({iso,...s});
  });
  return {b,l,d,total:b+l+d,mealDays,attDays,byCat,staffList:Object.values(staffStats),dailyList};
}

function renderDonut(id,items,total){
  const el=document.getElementById(id), r=56, cx=88, cy=88, C=2*Math.PI*r; let circles='', off=0;
  if(total<=0) circles=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e8edea" stroke-width="26"></circle>`;
  else items.forEach(it=>{ if(it.value<=0) return; const seg=(it.value/total)*C; circles+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="26" stroke-dasharray="${seg} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"></circle>`; off+=seg; });
  el.innerHTML=`<div class="donut-svg-box"><svg viewBox="0 0 176 176" width="176" height="176">${circles}</svg><div class="donut-center"><span class="big">${total}</span><span class="small">รวม</span></div></div><div class="legend-list">${items.map(it=>`<div class="legend-item"><span class="dot" style="background:${it.color}"></span><span>${it.label}</span><span class="legend-val">${it.value}</span><span class="legend-pct">${total>0?Math.round((it.value/total)*100):0}%</span></div>`).join('')}</div>`;
}
function renderHBars(id,items,compact=false){
  const max=Math.max(...items.map(i=>i.value),1);
  document.getElementById(id).innerHTML=items.map(it=>`<div class="hbar-row ${compact?'compact':''}"><div class="hbar-label">${it.label}</div><div class="hbar-track">${it.value>0?`<div class="hbar-fill" style="width:${Math.max((it.value/max)*100,2)}%"></div>`:''}<span class="hbar-num">${it.value}</span></div></div>`).join('');
}
function renderStacked(id,cols,wide=false){
  const el=document.getElementById(id); if(!cols.length){ el.innerHTML='<p class="helper-text" style="text-align:center;padding:28px 0">ยังไม่มีข้อมูลในช่วงที่เลือก</p>'; return; }
  const max=Math.max(...cols.map(c=>c.total),1);
  el.innerHTML=`<div class="stacked-grid">${cols.map(c=>{ const h=c.total>0?Math.max((c.total/max)*155,6):0, hb=c.total>0?(c.b/c.total)*h:0, hl=c.total>0?(c.l/c.total)*h:0, hd=c.total>0?(c.d/c.total)*h:0; return `<div class="stacked-col" title="${c.title} (เช้า:${c.b} เที่ยง:${c.l} เย็น:${c.d})"><div class="stacked-total">${c.total>0?c.total:''}</div><div class="stacked-bars ${wide?'wide':''}" style="height:${h}px"><div class="seg-b" style="height:${hb}px"></div><div class="seg-l" style="height:${hl}px"></div><div class="seg-d" style="height:${hd}px"></div></div><div class="stacked-day ${c.selected?'selected':''}">${c.label}</div></div>`; }).join('')}</div>`;
}

function refreshCurrentTab(){ if(currentMainTab==='dashboard') renderDashboard(); if(currentMainTab==='entry') renderEntry(); if(currentMainTab==='report') renderReport(); }
function switchMainTab(t){
  currentMainTab=t;
  ['dashboard','entry','report'].forEach(x=>{ document.getElementById('tab-'+x).classList.toggle('hidden',x!==t); document.getElementById('tab-btn-'+x).classList.toggle('active',x===t); });
  refreshCurrentTab(); if(t!=='entry') pullFromCloud(false, false);
}
function switchSubTab(s){ currentSubTab=s; document.getElementById('subtab-meals').classList.toggle('hidden',s!=='meals'); document.getElementById('subtab-staff').classList.toggle('hidden',s!=='staff'); document.getElementById('subtab-btn-meals').classList.toggle('active',s==='meals'); document.getElementById('subtab-btn-staff').classList.toggle('active',s==='staff'); renderEntry(); }
function onDateChange(v){ if(v){ selectedDate=v; refreshCurrentTab(); } }

function renderDashboard(){
  document.getElementById('dash-date-label').textContent=thShort(selectedDate); document.getElementById('dash-date-input').value=selectedDate;
  const day=getDaySummary(selectedDate);
  document.getElementById('dash-kpi-grid').innerHTML=`<div class="kpi-card green-text"><div><div class="kpi-val">${day.b}</div><div class="kpi-label">มื้อเช้า</div></div><div class="kpi-icon">🌅</div></div><div class="kpi-card amber"><div><div class="kpi-val">${day.l}</div><div class="kpi-label">มื้อเที่ยง</div></div><div class="kpi-icon">☀️</div></div><div class="kpi-card blue"><div><div class="kpi-val">${day.d}</div><div class="kpi-label">มื้อเย็น</div></div><div class="kpi-icon">🌙</div></div><div class="kpi-card solid-green"><div><div class="kpi-val">${day.total}</div><div class="kpi-label">รวมทั้งวัน</div></div><div class="kpi-icon">🍽️</div></div><div class="kpi-card purple"><div><div class="kpi-val">${day.hasAttendance?`${day.present}/${day.totalStaff}`:`-/${day.totalStaff}`}</div><div class="kpi-label">บุคลากรมาทำงาน</div></div><div class="kpi-icon">👩‍⚕️</div></div>`;
  document.getElementById('dash-daily-table-title').textContent=`ผู้รับบริการรายวัน (${thShort(selectedDate)})`;
  document.getElementById('dash-daily-table').innerHTML=`<table><thead><tr><th>ประเภท</th><th class="num">เช้า</th><th class="num">เที่ยง</th><th class="num">เย็น</th><th class="num">รวม</th></tr></thead><tbody>${CATEGORIES.map(c=>{const r=day.byCat[c.key];return `<tr><td>${c.label}</td><td class="num">${r.b}</td><td class="num">${r.l}</td><td class="num">${r.d}</td><td class="num"><strong>${r.total}</strong></td></tr>`;}).join('')}</tbody></table>`;
  document.getElementById('dash-att-date-sub').textContent=`วันที่ ${thShort(selectedDate)}`;
  renderDonut('dash-att-donut',[{label:'มา',value:day.hasAttendance?day.present:0,color:'#2d7a4f'},{label:'ไม่มา',value:day.hasAttendance?day.absent:0,color:'#d9634c'}],day.hasAttendance?day.totalStaff:0);
  const [yy,mm]=selectedDate.split('-').map(Number), mStart=selectedDate.slice(0,8)+'01', mEnd=selectedDate.slice(0,8)+String(new Date(yy,mm,0).getDate()).padStart(2,'0'), mAgg=aggregateRange(mStart,mEnd);
  document.getElementById('dash-att-month-sub').textContent=`จำนวนวันที่มา · ${thMY(selectedDate)}`;
  renderHBars('dash-att-bars',[...mAgg.staffList].sort((a,b)=>b.present-a.present).map(s=>({label:s.name,value:s.present})),true);
  document.getElementById('dash-att-notes').innerHTML=!day.hasAttendance?`<div class="helper-text">ยังไม่มีการบันทึกการมาทำงานของวันที่ ${thShort(selectedDate)}</div>`:!day.absentNotes.length?'<div class="helper-text">หมายเหตุวันนี้: มาทำงานครบทุกคน</div>':`<div style="font-weight:600;margin-bottom:6px">หมายเหตุวันนี้</div><ul class="note-list">${day.absentNotes.map(n=>`<li>✕ ${n.name} — ${n.reason}</li>`).join('')}</ul>`;
  const cols14=[]; for(let i=-13;i<=0;i++){ const d=addDays(selectedDate,i), s=getDaySummary(d); cols14.push({label:Number(d.split('-')[2]),title:thShort(d),b:s.b,l:s.l,d:s.d,total:s.total,selected:d===selectedDate}); }
  renderStacked('dash-14days-chart',cols14,false);
  document.getElementById('dash-month-cat-title').textContent=`ผู้รับบริการแยกตามประเภท · ${thMY(selectedDate)}`;
  renderHBars('dash-month-cat-bars',CATEGORIES.map(c=>({label:c.label,value:mAgg.byCat[c.key].total})),false);
  document.getElementById('dash-month-ratio-title').textContent=`สัดส่วนผู้รับบริการ · ${thMY(selectedDate)}`;
  renderDonut('dash-month-donut-cat',CATEGORIES.map(c=>({label:c.label,value:mAgg.byCat[c.key].total,color:c.color})),mAgg.total);
  renderDonut('dash-month-donut-meal',[{label:'มื้อเช้า',value:mAgg.b,color:'#2d7a4f'},{label:'มื้อเที่ยง',value:mAgg.l,color:'#d99b26'},{label:'มื้อเย็น',value:mAgg.d,color:'#4285c4'}],mAgg.total);
}

function renderEntry(){
  document.getElementById('entry-date-label').textContent=thShort(selectedDate); document.getElementById('entry-date-input').value=selectedDate;
  const rec=db.records[selectedDate], meals=(rec&&rec.hasMeals&&rec.meals)?rec.meals:emptyMeals();
  document.getElementById('entry-meals-tbody').innerHTML=CATEGORIES.map(c=>{const m=meals[c.key]||{b:0,l:0,d:0};return `<tr><td>${c.label}</td><td class="num"><input type="number" min="0" class="meal-input" data-cat="${c.key}" data-meal="b" value="${m.b}" oninput="recalcTotals()"/></td><td class="num"><input type="number" min="0" class="meal-input" data-cat="${c.key}" data-meal="l" value="${m.l}" oninput="recalcTotals()"/></td><td class="num"><input type="number" min="0" class="meal-input" data-cat="${c.key}" data-meal="d" value="${m.d}" oninput="recalcTotals()"/></td></tr>`;}).join('')+`<tr class="total-row"><td>รวม (<span id="entry-sum-all">0</span>)</td><td class="num" id="entry-sum-b">0</td><td class="num" id="entry-sum-l">0</td><td class="num" id="entry-sum-d">0</td></tr>`;
  document.getElementById('entry-meal-note').value=(rec&&rec.mealNote)?rec.mealNote:'';
  recalcTotals();
  const hm=!!(rec&&rec.hasMeals);
  document.getElementById('save-meals-btn').textContent=hm?'อัปเดตข้อมูลวันนี้':'บันทึกข้อมูลวันนี้';
  document.getElementById('delete-meals-btn').classList.toggle('hidden',!hm);
  document.getElementById('meals-status-hint').textContent=hm?'วันที่นี้มีข้อมูลแล้ว การบันทึกจะทับของเดิม':'ยังไม่มีข้อมูลสำหรับวันนี้';
  draftAttendance={};
  db.staff.forEach(s=>{ const e=rec&&rec.hasAttendance&&rec.attendance&&rec.attendance[s.id]; draftAttendance[s.id]=e?{status:e.status,reason:e.reason||''}:{status:'present',reason:''}; });
  renderStaffList();
  const ha=!!(rec&&rec.hasAttendance);
  document.getElementById('save-staff-btn').textContent=ha?'อัปเดตข้อมูลบุคลากร':'บันทึกข้อมูลบุคลากร';
  document.getElementById('staff-status-hint').textContent=ha?'วันที่นี้บันทึกข้อมูลบุคลากรแล้ว':'ค่าเริ่มต้นตั้งเป็นมาทำงานทั้งหมด กดบันทึกเพื่อยืนยัน';
  renderStaffChips();
}
function recalcTotals(){
  let b=0,l=0,d=0;
  document.querySelectorAll('.meal-input').forEach(i=>{ const v=Math.max(0,parseInt(i.value,10)||0); if(i.dataset.meal==='b')b+=v; if(i.dataset.meal==='l')l+=v; if(i.dataset.meal==='d')d+=v; });
  document.getElementById('entry-sum-b').textContent=b; document.getElementById('entry-sum-l').textContent=l; document.getElementById('entry-sum-d').textContent=d; document.getElementById('entry-sum-all').textContent=b+l+d;
}
function saveMeals(){
  const meals=emptyMeals();
  document.querySelectorAll('.meal-input').forEach(i=>meals[i.dataset.cat][i.dataset.meal]=Math.max(0,parseInt(i.value,10)||0));
  const mealNote = document.getElementById('entry-meal-note').value.trim();
  if(!db.records[selectedDate]) db.records[selectedDate]={};
  db.records[selectedDate].hasMeals=true; db.records[selectedDate].meals=meals; db.records[selectedDate].mealNote=mealNote;
  renderEntry(); pushAction('saveMeals', selectedDate, { meals, mealNote }, `บันทึกและซิงค์ผู้รับบริการวันที่ ${thShort(selectedDate)} แล้ว`);
}
function deleteMeals(){
  if(!confirm(`ต้องการลบข้อมูลผู้รับบริการวันที่ ${thShort(selectedDate)} ใช่หรือไม่?`)) return;
  if(db.records[selectedDate]){ db.records[selectedDate].hasMeals=false; delete db.records[selectedDate].meals; delete db.records[selectedDate].mealNote; if(!db.records[selectedDate].hasAttendance) delete db.records[selectedDate]; }
  renderEntry(); pushAction('deleteMeals', selectedDate, {}, 'ลบข้อมูลของวันดังกล่าวแล้ว');
}
function renderStaffList(){
  document.getElementById('entry-staff-list').innerHTML=!db.staff.length?'<p class="helper-text">ยังไม่มีรายชื่อบุคลากร</p>':db.staff.map(s=>{
    const st=draftAttendance[s.id]||{status:'present',reason:''}, ab=st.status==='absent';
    return `<div class="staff-edit-row"><div style="font-weight:500">${s.name}</div><div class="status-toggle"><button type="button" class="status-btn present ${!ab?'active':''}" onclick="setStaff('${s.id}','present')">มาทำงาน</button><button type="button" class="status-btn absent ${ab?'active':''}" onclick="setStaff('${s.id}','absent')">ไม่มา</button></div><input type="text" class="reason-input" placeholder="${ab?'ระบุเหตุผล เช่น อบรม, ลาป่วย':'—'}" value="${st.reason||''}" ${!ab?'disabled':''} oninput="draftAttendance['${s.id}'].reason=this.value"/></div>`;
  }).join('');
}
function setStaff(id,st){ draftAttendance[id]={status:st,reason:st==='present'?'':(draftAttendance[id]?.reason||'')}; renderStaffList(); }
function saveAttendance(){
  const attendance = JSON.parse(JSON.stringify(draftAttendance));
  if(!db.records[selectedDate]) db.records[selectedDate]={};
  db.records[selectedDate].hasAttendance=true; db.records[selectedDate].attendance=attendance;
  renderEntry(); pushAction('saveAttendance', selectedDate, { attendance }, `บันทึกและซิงค์บุคลากรวันที่ ${thShort(selectedDate)} แล้ว`);
}
function renderStaffChips(){ document.getElementById('staff-chip-list').innerHTML=db.staff.map(s=>`<span class="staff-chip">${s.name}<button onclick="removeStaff('${s.id}')">×</button></span>`).join(''); }
function addStaffMember(){
  const inp=document.getElementById('new-staff-name'), name=inp.value.trim(); if(!name) return;
  const id='s_'+Date.now(); db.staff.push({id,name}); draftAttendance[id]={status:'present',reason:''}; inp.value='';
  renderStaffList(); renderStaffChips(); pushAction('saveStaff', '', { staff: db.staff }, `เพิ่ม "${name}" และซิงค์แล้ว`);
}
function removeStaff(id){
  const st=db.staff.find(x=>x.id===id); if(!st||!confirm(`ลบรายชื่อ "${st.name}" ใช่หรือไม่?`)) return;
  db.staff=db.staff.filter(x=>x.id!==id); delete draftAttendance[id];
  renderStaffList(); renderStaffChips(); pushAction('saveStaff', '', { staff: db.staff }, 'ลบรายชื่อบุคลากรและซิงค์แล้ว');
}

function onReportRangeChange(){
  const s=document.getElementById('rep-start-input').value, e=document.getElementById('rep-end-input').value;
  if(s) reportStart=s; if(e) reportEnd=e;
  if(reportStart>reportEnd){ const t=reportStart; reportStart=reportEnd; reportEnd=t; }
  renderReport();
}
function renderReport(){
  document.getElementById('rep-start-input').value=reportStart; document.getElementById('rep-end-input').value=reportEnd;
  document.getElementById('rep-start-label').textContent=thShort(reportStart); document.getElementById('rep-end-label').textContent=thShort(reportEnd);
  const agg=aggregateRange(reportStart,reportEnd), avg=agg.mealDays>0?Math.round(agg.total/agg.mealDays):0;
  document.getElementById('rep-kpi-grid').innerHTML=`<div class="kpi-card green-text"><div><div class="kpi-val">${agg.b}</div><div class="kpi-label">รวมมื้อเช้า</div></div></div><div class="kpi-card amber"><div><div class="kpi-val">${agg.l}</div><div class="kpi-label">รวมมื้อเที่ยง</div></div></div><div class="kpi-card blue"><div><div class="kpi-val">${agg.d}</div><div class="kpi-label">รวมมื้อเย็น</div></div></div><div class="kpi-card solid-green"><div><div class="kpi-val">${agg.total}</div><div class="kpi-label">รวมทั้งหมด</div></div></div><div class="kpi-card purple"><div><div class="kpi-val">${avg}</div><div class="kpi-label">เฉลี่ยต่อวัน (${agg.mealDays} วัน)</div></div></div>`;
  document.getElementById('rep-cat-table').innerHTML=`<table><thead><tr><th>ประเภท</th><th class="num">เช้า</th><th class="num">เที่ยง</th><th class="num">เย็น</th><th class="num">รวม</th></tr></thead><tbody>${CATEGORIES.map(c=>{const r=agg.byCat[c.key];return `<tr><td>${c.label}</td><td class="num">${r.b}</td><td class="num">${r.l}</td><td class="num">${r.d}</td><td class="num"><strong>${r.total}</strong></td></tr>`;}).join('')}<tr class="total-row"><td>รวม</td><td class="num">${agg.b}</td><td class="num">${agg.l}</td><td class="num">${agg.d}</td><td class="num">${agg.total}</td></tr></tbody></table>`;
  renderHBars('rep-cat-bars',CATEGORIES.map(c=>({label:c.label,value:agg.byCat[c.key].total})),false);
  renderDonut('rep-donut-cat',CATEGORIES.map(c=>({label:c.label,value:agg.byCat[c.key].total,color:c.color})),agg.total);
  renderDonut('rep-donut-meal',[{label:'มื้อเช้า',value:agg.b,color:'#2d7a4f'},{label:'มื้อเที่ยง',value:agg.l,color:'#d99b26'},{label:'มื้อเย็น',value:agg.d,color:'#4285c4'}],agg.total);
  renderStacked('rep-daily-chart',agg.dailyList.filter(d=>d.hasMeals).map(d=>({label:Number(d.iso.split('-')[2]),title:thShort(d.iso),b:d.b,l:d.l,d:d.d,total:d.total,selected:d.iso===selectedDate})),true);
  document.getElementById('rep-daily-table').innerHTML=!agg.dailyList.length?'<p class="helper-text">ไม่มีข้อมูลในช่วงที่เลือก</p>':`<table><thead><tr><th>วันที่</th><th class="num">เช้า</th><th class="num">เที่ยง</th><th class="num">เย็น</th><th class="num">รวม</th><th class="num">บุคลากรมา</th></tr></thead><tbody>${agg.dailyList.map(d=>`<tr><td>${thShort(d.iso)}</td><td class="num">${d.hasMeals?d.b:'-'}</td><td class="num">${d.hasMeals?d.l:'-'}</td><td class="num">${d.hasMeals?d.d:'-'}</td><td class="num"><strong>${d.hasMeals?d.total:'-'}</strong></td><td class="num">${d.hasAttendance?`${d.present}/${d.totalStaff}`:'-'}</td></tr>`).join('')}</tbody></table>`;
  document.getElementById('rep-staff-table').innerHTML=`<table><thead><tr><th>ชื่อ</th><th class="num">มา (วัน)</th><th class="num">ไม่มา (วัน)</th><th class="num">% มา</th></tr></thead><tbody>${agg.staffList.map(s=>{const t=s.present+s.absent;return `<tr><td>${s.name}</td><td class="num">${s.present}</td><td class="num">${s.absent}</td><td class="num">${t>0?Math.round((s.present/t)*100):0}%</td></tr>`;}).join('')}</tbody></table>`;
  document.getElementById('rep-staff-foot').textContent=`นับจาก ${agg.attDays} วันที่มีการบันทึก`;
}

function downloadCSV(){
  const agg=aggregateRange(reportStart,reportEnd), rows=[['รายงานงานโภชนาการ โรงพยาบาลเทพา',`${thShort(reportStart)} ถึง ${thShort(reportEnd)}`],[],['ประเภท','เช้า','เที่ยง','เย็น','รวม']];
  CATEGORIES.forEach(c=>{const r=agg.byCat[c.key];rows.push([c.label,r.b,r.l,r.d,r.total]);});
  rows.push(['รวมทั้งหมด',agg.b,agg.l,agg.d,agg.total],[],['วันที่','เช้า','เที่ยง','เย็น','รวม','บุคลากรมา']);
  agg.dailyList.forEach(d=>rows.push([thShort(d.iso),d.hasMeals?d.b:0,d.hasMeals?d.l:0,d.hasMeals?d.d:0,d.hasMeals?d.total:0,d.hasAttendance?`${d.present}/${d.totalStaff}`:'-']));
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`รายงานโภชนาการ_${reportStart}_${reportEnd}.csv`; a.click();
}

document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && currentMainTab !== 'entry') pullFromCloud(false, true); });
setInterval(() => { if(document.visibilityState === 'visible' && currentMainTab !== 'entry') pullFromCloud(false, true); }, 20000);
renderDashboard();
pullFromCloud(false, false);
