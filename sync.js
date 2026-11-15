const STORAGE_KEY = 'tepha_nutrition_dashboard_v3';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxuIMQEAKQ5_H8SH8S2i4S6e9JmCTaPFVIV-6J0JytabB0MLEkVFyp-fIyCh6FqxgeGAA/exec';
const CATEGORIES = [
  { key:'normal', label:'อาหารธรรมดา', color:'#2d7a4f' }, { key:'disease', label:'เฉพาะโรค', color:'#d99b26' },
  { key:'vip', label:'ห้องพิเศษ', color:'#4285c4' }, { key:'isolate', label:'แยกโรค', color:'#8e63ce' },
  { key:'medical', label:'อาหารทางการแพทย์', color:'#d9634c' }, { key:'tiffin', label:'เจ้าหน้าที่ผูกปิ่นโต', color:'#38a89d' },
  { key:'catering', label:'การจัดเลี้ยง', color:'#8c9691' }
];
const MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MF = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function getDefaultSeedData(){
  return {
    staff:[{id:'s1',name:'สิริยาพร รองเดช'},{id:'s2',name:'ชะวานีย์ นิสัน'},{id:'s3',name:'ภาวิณี ศรีรัตนโกมุท'},{id:'s4',name:'มณฑิตา นิเหร็ม'},{id:'s5',name:'พิลนา ช่วยเจริญ'},{id:'s6',name:'ศิริพร จันทสะโร'},{id:'s7',name:'ปาณนิภาภร เปาะอีแต'},{id:'s8',name:'เบญจวรรณ แก้วอรุณ'}],
    records:{}
  };
}
function loadDB(){
  try{ const r=localStorage.getItem(STORAGE_KEY); if(!r){ const s=getDefaultSeedData(); localStorage.setItem(STORAGE_KEY,JSON.stringify(s)); return s; } return JSON.parse(r); }
  catch(e){ return getDefaultSeedData(); }
}
function setStatus(txt){ document.getElementById('cloud-status').textContent = txt; }

function callGas(params, onDone){
  const cb = '__nutri_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  const sc = document.createElement('script');
  let finished = false;
  const timer = setTimeout(() => { if(finished) return; finished = true; delete window[cb]; sc.remove(); onDone({ ok:false }); }, 15000);
  window[cb] = res => { if(finished) return; finished = true; clearTimeout(timer); delete window[cb]; sc.remove(); onDone(res || { ok:false }); };
  sc.onerror = () => { if(finished) return; finished = true; clearTimeout(timer); delete window[cb]; sc.remove(); onDone({ ok:false }); };
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  sc.src = GAS_URL + '?' + qs + '&callback=' + cb + '&t=' + Date.now();
  document.body.appendChild(sc);
}

function pullFromCloud(notify=false, isAutoPoll=false){
  if(!notify) setStatus('⏳ กำลังซิงค์...');
  callGas({ action:'load' }, res => {
    if(res && res.ok){
      setStatus('🟢 ซิงค์แล้ว');
      if(res.data && res.data.staff && res.data.records){
        db = res.data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        if(!(isAutoPoll && currentMainTab === 'entry')) refreshCurrentTab();
      }
      if(notify) showToast('อัปเดตข้อมูลล่าสุดเรียบร้อย');
    }else{
      setStatus('⚠️ ออฟไลน์');
      if(notify) showToast('ไม่สามารถเชื่อมต่อ Google Sheets ได้');
    }
  });
}

function pushAction(action, date, payload, successMsg){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  setStatus('⏳ กำลังบันทึกขึ้น Sheet...');
  callGas({ action, date: date || '', payload: JSON.stringify(payload || {}) }, res => {
    if(res && res.ok){
      if(res.data){ db = res.data; localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
      setStatus('🟢 ซิงค์แล้ว');
      if(successMsg) showToast(successMsg);
    }else{
      setStatus('⚠️ บันทึกในเครื่อง (รอเน็ต)');
      showToast('บันทึกในเครื่องแล้ว (ยังส่งขึ้น Sheet ไม่ได้)');
    }
  });
}

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const thShort = iso => { if(!iso) return '-'; const [y,m,d]=iso.split('-').map(Number); return `${d} ${MS[m-1]} ${y+543}`; };
const thMY = iso => { const [y,m]=iso.split('-').map(Number); return `${MF[m-1]} ${y+543}`; };
const addDays = (iso,n) => { const [y,m,d]=iso.split('-').map(Number); return toISO(new Date(y,m-1,d+n)); };
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window.__tt); window.__tt=setTimeout(()=>t.classList.remove('show'),2500); }

let db=loadDB(), currentMainTab='dashboard', currentSubTab='meals', selectedDate=toISO(new Date()), reportStart=selectedDate.slice(0,8)+'01', reportEnd=selectedDate, draftAttendance={};
