const KEY = 'gift-tracker-data-v1'; // unchanged so existing data carries over
const defaultData = { people: [], events: [], gifts: [] };
let data = JSON.parse(localStorage.getItem(KEY) || 'null') || defaultData;
let activeTab = 'home',
  editingId = null,
  modalType = null,
  touchTimer = null,
  draftItems = [];

const PLUS_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5v9M7.5 12h9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`;

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function esc(s = '') {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[m],
  );
}
function person(id) {
  return data.people.find((x) => x.id === id);
}
function event(id) {
  return data.events.find((x) => x.id === id);
}
function giftsFor(eid) {
  return data.gifts.filter((x) => x.eventId === eid);
}
function byDate(a, b) {
  return (a.date || '9999').localeCompare(b.date || '9999');
}
function eventsFor(pid) {
  return data.events.filter((e) => e.personId === pid).sort(byDate);
}
function today() {
  return new Date().toLocaleDateString('en-CA');
} // YYYY-MM-DD, local time
function nextEvent(list) {
  const t = today();
  return list.find((e) => e.date && e.date >= t) || list[0];
}
// A gift with items counts as purchased once every item is purchased
function isBought(g) {
  const it = g.items || [];
  return it.length ? it.every((x) => x.purchased) : !!g.purchased;
}
function boughtCount(gs) {
  return gs.filter(isBought).length;
}
function fmtDate(d) {
  if (!d) return 'No date';
  const x = new Date(d + 'T12:00:00');
  return x.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
function showToast(t) {
  const x = document.getElementById('toast');
  x.textContent = t;
  x.classList.add('show');
  setTimeout(() => x.classList.remove('show'), 1700);
}

function render() {
  document
    .querySelectorAll('.tab[data-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  document.getElementById('pageTitle').textContent = {
    home: 'Upcoming',
    people: 'People',
    events: 'Events',
  }[activeTab];
  const main = document.getElementById('main');
  if (activeTab === 'home') renderHome(main);
  else if (activeTab === 'people') renderPeople(main);
  else renderEvents(main);
}

/* ---------- Upcoming: one container per person ---------- */
function renderHome(main) {
  if (!data.people.length) {
    main.innerHTML = `<div class="empty"><strong>No gifts yet</strong>Add a person and an event to start tracking your gifts.</div>`;
    return;
  }
  const groups = data.people
    .map((p) => ({ p, es: eventsFor(p.id) }))
    .sort((a, b) =>
      (nextEvent(a.es)?.date || '9999').localeCompare(
        nextEvent(b.es)?.date || '9999',
      ),
    );
  main.innerHTML = groups
    .map(({ p, es }) => {
      const all = es.flatMap((e) => giftsFor(e.id));
      return `<section class="card person-group">
   <div class="group-head">
    <div class="group-text"><div class="group-name">${esc(p.name)}</div><div class="event-meta">${es.length} event${es.length === 1 ? '' : 's'}, ${boughtCount(all)}/${all.length} purchased</div></div>
    <button class="circle-add" onclick="addGiftFor('${p.id}')" aria-label="Add gift for ${esc(p.name)}">${PLUS_ICON}</button>
   </div>
   ${es.length ? es.map(eventBlockHTML).join('') : `<div class="empty small">No events yet. Tap + to add one.</div>`}
  </section>`;
    })
    .join('');
  bindLongPresses();
}
function eventBlockHTML(e) {
  const gs = giftsFor(e.id),
    bought = boughtCount(gs);
  return `<div class="event-block">
  <div class="event-head"><div><div class="event-title">${esc(e.name)}</div><div class="event-meta">${esc(fmtDate(e.date))} · ${bought}/${gs.length} purchased</div></div><button class="mini-btn" onclick="openEvent('${e.id}')">Edit</button></div>
  <div class="progress"><i style="width:${gs.length ? (bought / gs.length) * 100 : 0}%"></i></div>
  ${gs.length ? gs.map(giftHTML).join('') : `<div class="empty small">No gifts added yet.</div>`}
 </div>`;
}
function giftHTML(g) {
  const subs = g.items || [],
    done = isBought(g);
  return `<div class="gift-block">
  <div class="gift-row ${done ? 'purchased' : ''}" data-id="${g.id}">
   <div class="gift-icon">${done ? '✓' : '🎁'}</div>
   <div class="gift-main"><div class="gift-name">${esc(g.name)} ${g.url ? `<span class="link-dot">↗</span>` : ''}</div>${subs.length ? `<div class="subcount">${subs.filter((x) => x.purchased).length}/${subs.length} items purchased</div>` : ''}</div>
   <div class="actions"><button class="mini-btn" onclick="openGift('${g.id}')">Edit</button></div>
  </div>
  ${subs.length ? `<div class="subs">${subs.map((it) => `<button class="sub-row ${it.purchased ? 'purchased' : ''}" onclick="toggleSub('${g.id}','${it.id}')"><span class="sub-dot">${it.purchased ? '✓' : ''}</span><span class="sub-name">${esc(it.name)}</span></button>`).join('')}</div>` : ''}
 </div>`;
}
function bindLongPresses() {
  document.querySelectorAll('.gift-row').forEach((el) => {
    el.addEventListener('pointerdown', () => {
      touchTimer = setTimeout(() => togglePurchased(el.dataset.id), 650);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
      el.addEventListener(ev, () => clearTimeout(touchTimer)),
    );
  });
}
function togglePurchased(id) {
  const g = data.gifts.find((x) => x.id === id);
  if (!g) return;
  const next = !isBought(g);
  g.purchased = next;
  (g.items || []).forEach((i) => (i.purchased = next));
  save();
  render();
  showToast(next ? 'Marked purchased' : 'Marked not purchased');
  if (navigator.vibrate) navigator.vibrate(15);
}
function toggleSub(gid, iid) {
  const g = data.gifts.find((x) => x.id === gid),
    it = g?.items?.find((x) => x.id === iid);
  if (!it) return;
  it.purchased = !it.purchased;
  g.purchased = isBought(g);
  save();
  render();
}
function addGiftFor(pid) {
  const es = eventsFor(pid);
  if (!es.length) {
    showToast('Add an event first');
    return openEvent(null, pid);
  }
  openGift(null, nextEvent(es).id);
}

/* ---------- People & Events tabs ---------- */
function renderPeople(main) {
  main.innerHTML =
    `<button class="primary" onclick="openPerson()">+ Add Person</button><div class="section-title">Your people</div>` +
    (data.people.length
      ? data.people
          .map((p) => {
            const es = eventsFor(p.id);
            return `<div class="card person-card"><div class="person-name">${esc(p.name)}</div><div class="person-sub">${es.length} event${es.length === 1 ? '' : 's'}</div>${es.map((e) => `<span class="chip">${esc(e.name)}</span>`).join('')}<div style="margin-top:12px"><button class="mini-btn" onclick="openPerson('${p.id}')">Edit</button> <button class="mini-btn danger" onclick="deletePerson('${p.id}')">Delete</button></div></div>`;
          })
          .join('')
      : `<div class="empty"><strong>No people yet</strong>Add the people you buy gifts for.</div>`);
}
function renderEvents(main) {
  main.innerHTML =
    `<button class="primary" onclick="openEvent()">+ Add Event</button><div class="section-title">Events</div>` +
    (data.events.length
      ? [...data.events]
          .sort(byDate)
          .map((e) => {
            const p = person(e.personId),
              gs = giftsFor(e.id),
              bought = boughtCount(gs);
            return `<div class="card person-card"><div class="person-name">${esc(e.name)}</div><div class="person-sub">${esc(p?.name || 'Unknown')} · ${esc(fmtDate(e.date))}</div><div class="person-sub">${bought}/${gs.length} purchased</div><div style="margin-top:12px"><button class="mini-btn" onclick="openEvent('${e.id}')">Edit</button> <button class="mini-btn danger" onclick="deleteEvent('${e.id}')">Delete</button></div></div>`;
          })
          .join('')
      : `<div class="empty"><strong>No events yet</strong>Create Christmas, birthdays, anniversaries, or anything else.</div>`);
}

/* ---------- Modals ---------- */
function openModal(title, body) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  editingId = null;
  modalType = null;
}
document.getElementById('closeModal').onclick = closeModal;
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});

function openPerson(id) {
  editingId = id;
  modalType = 'person';
  const p = person(id) || { name: '' };
  openModal(
    id ? 'Edit Person' : 'Add Person',
    `<div class="field"><label>Name</label><input id="fName" value="${esc(p.name)}" placeholder="e.g. Dad"></div><button class="primary" onclick="savePerson()">Save</button>${id ? `<button class="secondary danger" onclick="deletePerson('${id}');closeModal()">Delete Person</button>` : ''}`,
  );
}
function savePerson() {
  const name = document.getElementById('fName').value.trim();
  if (!name) return showToast('Enter a name');
  if (editingId) person(editingId).name = name;
  else data.people.push({ id: uid(), name });
  save();
  closeModal();
  render();
  showToast('Saved');
}
function deletePerson(id) {
  if (!confirm('Delete this person and all their events and gifts?')) return;
  const es = data.events.filter((e) => e.personId === id).map((e) => e.id);
  data.gifts = data.gifts.filter((g) => !es.includes(g.eventId));
  data.events = data.events.filter((e) => e.personId !== id);
  data.people = data.people.filter((p) => p.id !== id);
  save();
  render();
}

function openEvent(id, presetPersonId) {
  if (!data.people.length) {
    showToast('Add a person first');
    activeTab = 'people';
    render();
    return;
  }
  editingId = id || null;
  modalType = 'event';
  const e = event(id) || {
    name: '',
    date: '',
    personId: presetPersonId || data.people[0].id,
  };
  const opts = data.people
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === e.personId ? 'selected' : ''}>${esc(p.name)}</option>`,
    )
    .join('');
  openModal(
    id ? 'Edit Event' : 'Add Event',
    `<div class="field"><label>Person</label><select id="fPerson">${opts}</select></div><div class="field"><label>Event</label><input id="fEvent" value="${esc(e.name)}" placeholder="Christmas"></div><div class="field"><label>Date (optional)</label><input id="fDate" type="date" value="${esc(e.date || '')}"></div><button class="primary" onclick="saveEvent()">Save</button>${id ? `<button class="secondary" onclick="openGift(null,'${id}')">+ Add Gift</button><button class="secondary danger" onclick="deleteEvent('${id}');closeModal()">Delete Event</button>` : ''}`,
  );
}
function saveEvent() {
  const name = document.getElementById('fEvent').value.trim();
  if (!name) return showToast('Enter an event name');
  const obj = {
    personId: document.getElementById('fPerson').value,
    name,
    date: document.getElementById('fDate').value,
  };
  if (editingId) Object.assign(event(editingId), obj);
  else {
    obj.id = uid();
    data.events.push(obj);
  }
  save();
  closeModal();
  render();
  showToast('Saved');
}
function deleteEvent(id) {
  if (!confirm('Delete this event and all its gifts?')) return;
  data.gifts = data.gifts.filter((g) => g.eventId !== id);
  data.events = data.events.filter((e) => e.id !== id);
  save();
  render();
}

function openGift(id, presetEventId) {
  if (!data.events.length) {
    showToast('Add an event first');
    activeTab = 'events';
    render();
    return;
  }
  editingId = id || null;
  modalType = 'gift';
  const g = data.gifts.find((x) => x.id === id) || {
    name: '',
    url: '',
    notes: '',
    eventId: presetEventId || nextEvent([...data.events].sort(byDate)).id,
    items: [],
  };
  draftItems = (g.items || []).map((x) => ({ ...x }));
  const opts = data.people
    .map((p) => {
      const es = eventsFor(p.id);
      return es.length
        ? `<optgroup label="${esc(p.name)}">${es.map((e) => `<option value="${e.id}" ${e.id === g.eventId ? 'selected' : ''}>${esc(p.name)} · ${esc(e.name)}</option>`).join('')}</optgroup>`
        : '';
    })
    .join('');
  openModal(
    id ? 'Edit Gift' : 'Add Gift',
    `<div class="field"><label>Gift</label><input id="gName" value="${esc(g.name)}" placeholder="e.g. Stocking"></div><div class="field"><label>Event</label><select id="gEvent">${opts}</select></div><div class="field"><label>Items in this gift <span class="opt">(optional, for stockings or bundles)</span></label><div id="itemsList"></div><button class="secondary compact" onclick="addDraftItem()">+ Add Item</button></div><div class="field"><label>Hyperlink</label><input id="gUrl" type="url" value="${esc(g.url || '')}" placeholder="https://..."></div><div class="field"><label>Notes</label><textarea id="gNotes" placeholder="Size, colour, ideas...">${esc(g.notes || '')}</textarea></div><div class="hint">Hold a gift for about half a second to mark it purchased. Tap an item inside a gift to check it off.</div><button class="primary" onclick="saveGift()">Save Gift</button>${id ? `<button class="secondary danger" onclick="deleteGift('${id}');closeModal()">Delete Gift</button>` : ''}`,
  );
  renderDraftItems();
}
function renderDraftItems() {
  document.getElementById('itemsList').innerHTML = draftItems
    .map(
      (it, i) =>
        `<div class="sub-edit"><input value="${esc(it.name)}" placeholder="Item ${i + 1}" oninput="draftItems[${i}].name=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();addDraftItem()}"><button class="icon-x" onclick="removeDraftItem(${i})" aria-label="Remove item">×</button></div>`,
    )
    .join('');
}
function addDraftItem() {
  draftItems.push({ id: uid(), name: '', purchased: false });
  renderDraftItems();
  const ins = document.querySelectorAll('#itemsList input');
  ins[ins.length - 1].focus();
}
function removeDraftItem(i) {
  draftItems.splice(i, 1);
  renderDraftItems();
}
function saveGift() {
  const name = document.getElementById('gName').value.trim();
  if (!name) return showToast('Enter a gift name');
  const items = draftItems
    .map((x) => ({ ...x, name: x.name.trim() }))
    .filter((x) => x.name);
  const obj = {
    name,
    eventId: document.getElementById('gEvent').value,
    url: document.getElementById('gUrl').value.trim(),
    notes: document.getElementById('gNotes').value.trim(),
    items,
  };
  if (editingId) {
    const g = data.gifts.find((x) => x.id === editingId);
    Object.assign(g, obj);
    if (items.length) g.purchased = isBought(g);
  } else {
    obj.id = uid();
    obj.purchased = false;
    data.gifts.push(obj);
  }
  save();
  closeModal();
  render();
  showToast('Gift saved');
}
function deleteGift(id) {
  if (!confirm('Delete this gift?')) return;
  data.gifts = data.gifts.filter((g) => g.id !== id);
  save();
  render();
}

/* ---------- Dock add menu ---------- */
const addMenu = document.getElementById('addMenu'),
  quickAdd = document.getElementById('quickAdd'),
  menuBackdrop = document.getElementById('menuBackdrop');
function setMenu(open) {
  addMenu.classList.toggle('open', open);
  menuBackdrop.classList.toggle('open', open);
  quickAdd.classList.toggle('open', open);
  quickAdd.setAttribute('aria-expanded', String(open));
}
quickAdd.onclick = () => setMenu(!addMenu.classList.contains('open'));
menuBackdrop.onclick = () => setMenu(false);
addMenu.querySelectorAll('[data-add]').forEach(
  (b) =>
    (b.onclick = () => {
      setMenu(false);
      ({
        person: () => openPerson(),
        event: () => openEvent(),
        gift: () => openGift(),
      })[b.dataset.add]();
    }),
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    setMenu(false);
    closeModal();
  }
});

document.querySelectorAll('.tab[data-tab]').forEach(
  (b) =>
    (b.onclick = () => {
      setMenu(false);
      activeTab = b.dataset.tab;
      render();
    }),
);
document.getElementById('themeBtn').onclick = () => {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem(
    'gift-theme',
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
};
if (localStorage.getItem('gift-theme') === 'dark')
  document.documentElement.classList.add('dark');
if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js').catch(() => {});
render();
