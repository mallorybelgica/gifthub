const KEY="gift-tracker-data-v1";
const defaultData={people:[],events:[],gifts:[]};
let data=JSON.parse(localStorage.getItem(KEY)||"null")||defaultData;
let activeTab="home", editingId=null, modalType=null, touchTimer=null;

function save(){localStorage.setItem(KEY,JSON.stringify(data));}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function person(id){return data.people.find(x=>x.id===id)}
function event(id){return data.events.find(x=>x.id===id)}
function giftsFor(eid){return data.gifts.filter(x=>x.eventId===eid)}
function fmtDate(d){if(!d)return "No date";const x=new Date(d+"T12:00:00");return x.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}
function showToast(t){const x=document.getElementById("toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1700)}

function render(){
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===activeTab));
 document.getElementById("pageTitle").textContent={home:"Upcoming",people:"People",events:"Events"}[activeTab];
 const main=document.getElementById("main");
 if(activeTab==="home") renderHome(main); else if(activeTab==="people") renderPeople(main); else renderEvents(main);
}

function renderHome(main){
 const events=[...data.events].sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
 if(!events.length){main.innerHTML=`<div class="empty"><strong>No gifts yet</strong>Add a person and an event to start tracking your gifts.</div>`;return}
 main.innerHTML=events.map(e=>{
   const p=person(e.personId), gs=giftsFor(e.id), bought=gs.filter(g=>g.purchased).length;
   return `<section class="card"><div class="event-head"><div><div class="event-title">${esc(p?.name||"Unknown")} · ${esc(e.name)}</div><div class="event-meta">${esc(fmtDate(e.date))} · ${bought}/${gs.length} purchased</div></div><button class="mini-btn" onclick="openEvent('${e.id}')">Edit</button></div><div class="progress"><i style="width:${gs.length?bought/gs.length*100:0}%"></i></div>${gs.length?gs.map(giftHTML).join(""):`<div class="empty" style="padding:20px">No gifts added yet.</div>`}</section>`
 }).join("");
 bindLongPresses();
}
function giftHTML(g){
 const subs=g.items||[];
 return `<div class="gift-row ${g.purchased?"purchased":""}" data-id="${g.id}">
 <div class="gift-icon">${g.purchased?"✓":"🎁"}</div>
 <div class="gift-main"><div class="gift-name">${esc(g.name)} ${g.url?`<span class="link-dot">↗</span>`:""}</div>${subs.length?`<div class="subcount">${subs.filter(x=>x.purchased).length}/${subs.length} kit items purchased</div>`:""}</div>
 <div class="actions"><button class="mini-btn" onclick="openGift('${g.id}')">Edit</button></div></div>`
}
function bindLongPresses(){
 document.querySelectorAll(".gift-row").forEach(el=>{
  el.addEventListener("pointerdown",()=>{touchTimer=setTimeout(()=>togglePurchased(el.dataset.id),650)});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>clearTimeout(touchTimer)));
 });
}
function togglePurchased(id){const g=data.gifts.find(x=>x.id===id);if(!g)return;g.purchased=!g.purchased;save();render();showToast(g.purchased?"Marked purchased":"Marked not purchased")}

function renderPeople(main){
 main.innerHTML=`<button class="primary" onclick="openPerson()">+ Add Person</button><div class="section-title">Your people</div>`+
 (data.people.length?data.people.map(p=>{
  const es=data.events.filter(e=>e.personId===p.id);
  return `<div class="card person-card"><div class="person-name">${esc(p.name)}</div><div class="person-sub">${es.length} event${es.length===1?"":"s"}</div>${es.map(e=>`<span class="chip">${esc(e.name)}</span>`).join("")}<div style="margin-top:12px"><button class="mini-btn" onclick="openPerson('${p.id}')">Edit</button> <button class="mini-btn danger" onclick="deletePerson('${p.id}')">Delete</button></div></div>`
 }).join(""):`<div class="empty"><strong>No people yet</strong>Add the people you buy gifts for.</div>`);
}
function renderEvents(main){
 main.innerHTML=`<button class="primary" onclick="openEvent()">+ Add Event</button><div class="section-title">Events</div>`+
 (data.events.length?data.events.map(e=>{
  const p=person(e.personId), gs=giftsFor(e.id), bought=gs.filter(g=>g.purchased).length;
  return `<div class="card person-card"><div class="person-name">${esc(e.name)}</div><div class="person-sub">${esc(p?.name||"Unknown")} · ${esc(fmtDate(e.date))}</div><div class="person-sub">${bought}/${gs.length} purchased</div><div style="margin-top:12px"><button class="mini-btn" onclick="openEvent('${e.id}')">Edit</button> <button class="mini-btn danger" onclick="deleteEvent('${e.id}')">Delete</button></div></div>`
 }).join(""):`<div class="empty"><strong>No events yet</strong>Create Christmas, birthdays, anniversaries, or anything else.</div>`);
}

function openModal(title,body){document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=body;document.getElementById("modal").classList.remove("hidden")}
function closeModal(){document.getElementById("modal").classList.add("hidden");editingId=null;modalType=null}
document.getElementById("closeModal").onclick=closeModal;
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});

function openPerson(id){
 editingId=id;modalType="person";const p=person(id)||{name:""};
 openModal(id?"Edit Person":"Add Person",`<div class="field"><label>Name</label><input id="fName" value="${esc(p.name)}" placeholder="e.g. Dad"></div><button class="primary" onclick="savePerson()">Save</button>${id?`<button class="secondary danger" onclick="deletePerson('${id}');closeModal()">Delete Person</button>`:""}`);
}
function savePerson(){const name=document.getElementById("fName").value.trim();if(!name)return showToast("Enter a name");if(editingId)person(editingId).name=name;else data.people.push({id:uid(),name});save();closeModal();render();showToast("Saved")}
function deletePerson(id){if(!confirm("Delete this person and all their events and gifts?"))return;const es=data.events.filter(e=>e.personId===id).map(e=>e.id);data.gifts=data.gifts.filter(g=>!es.includes(g.eventId));data.events=data.events.filter(e=>e.personId!==id);data.people=data.people.filter(p=>p.id!==id);save();render();}

function openEvent(id){
 editingId=id;modalType="event";const e=event(id)||{name:"",date:"",personId:data.people[0]?.id||""};
 if(!data.people.length){showToast("Add a person first");activeTab="people";render();return}
 const opts=data.people.map(p=>`<option value="${p.id}" ${p.id===e.personId?"selected":""}>${esc(p.name)}</option>`).join("");
 openModal(id?"Edit Event":"Add Event",`<div class="field"><label>Person</label><select id="fPerson">${opts}</select></div><div class="field"><label>Event</label><input id="fEvent" value="${esc(e.name)}" placeholder="Christmas"></div><div class="field"><label>Date (optional)</label><input id="fDate" type="date" value="${esc(e.date||"")}"></div><button class="primary" onclick="saveEvent()">Save</button><button class="secondary" onclick="openGift()">+ Add Gift</button>${id?`<button class="secondary danger" onclick="deleteEvent('${id}');closeModal()">Delete Event</button>`:""}`);
}
function saveEvent(){const name=document.getElementById("fEvent").value.trim();if(!name)return showToast("Enter an event name");const obj={personId:document.getElementById("fPerson").value,name,date:document.getElementById("fDate").value};if(editingId)Object.assign(event(editingId),obj);else{obj.id=uid();data.events.push(obj)}save();closeModal();render();showToast("Saved")}
function deleteEvent(id){if(!confirm("Delete this event and all its gifts?"))return;data.gifts=data.gifts.filter(g=>g.eventId!==id);data.events=data.events.filter(e=>e.id!==id);save();render()}

function openGift(id){
 editingId=id;modalType="gift";const g=data.gifts.find(x=>x.id===id)||{name:"",url:"",notes:"",eventId:data.events[0]?.id||"",items:[]};
 if(!data.events.length){showToast("Add an event first");activeTab="events";render();return}
 const opts=data.events.map(e=>`<option value="${e.id}" ${e.id===g.eventId?"selected":""}>${esc(person(e.personId)?.name||"")} · ${esc(e.name)}</option>`).join("");
 openModal(id?"Edit Gift":"Add Gift",`<div class="field"><label>Gift</label><input id="gName" value="${esc(g.name)}" placeholder="e.g. BBQ gift basket"></div><div class="field"><label>Event</label><select id="gEvent">${opts}</select></div><div class="field"><label>Hyperlink</label><input id="gUrl" type="url" value="${esc(g.url||"")}" placeholder="https://..."></div><div class="field"><label>Notes</label><textarea id="gNotes" placeholder="Size, colour, ideas...">${esc(g.notes||"")}</textarea></div><div class="hint">Tap a gift to edit it. Hold a gift for about 0.65 seconds to mark it purchased.</div><button class="primary" onclick="saveGift()">Save Gift</button>${id?`<button class="secondary danger" onclick="deleteGift('${id}');closeModal()">Delete Gift</button>`:""}`);
}
function saveGift(){const name=document.getElementById("gName").value.trim();if(!name)return showToast("Enter a gift name");const obj={name,eventId:document.getElementById("gEvent").value,url:document.getElementById("gUrl").value.trim(),notes:document.getElementById("gNotes").value.trim()};if(editingId){Object.assign(data.gifts.find(x=>x.id===editingId),obj)}else{obj.id=uid();obj.purchased=false;obj.items=[];data.gifts.push(obj)}save();closeModal();render();showToast("Gift saved")}
function deleteGift(id){if(!confirm("Delete this gift?"))return;data.gifts=data.gifts.filter(g=>g.id!==id);save();render()}

document.getElementById("quickAdd").onclick=()=>{
 if(activeTab==="people")openPerson();
 else if(activeTab==="events")openEvent();
 else if(data.events.length)openGift();
 else if(data.people.length)openEvent();
 else openPerson();
};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;render()});
document.getElementById("themeBtn").onclick=()=>{
 document.documentElement.classList.toggle("dark");
 localStorage.setItem("gift-theme",document.documentElement.classList.contains("dark")?"dark":"light");
};
if(localStorage.getItem("gift-theme")==="dark")document.documentElement.classList.add("dark");
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
render();
