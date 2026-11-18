const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API_URL = LOCAL ? 'http://localhost:4000/api' : 'https://secure-notes-api-zww8.onrender.com/api';

const $ = (id) => document.getElementById(id);
let token = localStorage.getItem('token');
let me = null;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  if (res.status === 401 && token) logout();
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function el(tag, text, ...children) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  node.append(...children);
  return node;
}

function button(label, onClick, className = 'btn-ghost') {
  const b = el('button', label);
  b.type = 'button';
  b.className = className;
  b.onclick = () => run(onClick, b);
  return b;
}

// Show errors next to the form/card the action came from; top banner is the fallback.
async function run(fn, from) {
  const box = from?.closest('form')?.querySelector('.err') ?? from?.closest('section')?.querySelector('.err') ?? $('error');
  document.querySelectorAll('.err, #error').forEach((n) => (n.textContent = ''));
  try {
    await fn();
  } catch (e) {
    box.textContent = e.message;
  }
}

const formData = (form) => Object.fromEntries(new FormData(form));
const splitInterests = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

// Paged list: fetch(page) returns { items, page, hasMore }, render(item) returns an <li>.
function pagedList(name, fetchPage, render) {
  let page = 1;
  const load = async (p = page) => {
    const data = await fetchPage(p);
    page = data.page;
    $(name).replaceChildren(...(data.items.length ? data.items.map(render) : [el('li', 'Nothing here.')]));
    const pager = [];
    if (page > 1) pager.push(button('Prev', () => load(page - 1)));
    pager.push(el('span', ` Page ${page} `));
    if (data.hasMore) pager.push(button('Next', () => load(page + 1)));
    $(`${name}-pager`).replaceChildren(...pager);
  };
  return load;
}

const loadNotes = pagedList('notes', (p) => api(`/notes?page=${p}`), (n) =>
  el('li', '', el('strong', n.title), el('div', n.body), button('Edit', () => editNote(n)), button('Delete', () => deleteNote(n._id), 'btn-danger'))
);

let postsUserId = '';
const loadPosts = pagedList('posts', async (p) => {
  const data = await api(`/users/${postsUserId || me._id}/posts?page=${p}`);
  $('posts-title').textContent = `Posts by ${data.user.name} (${data.user._id})`;
  return data;
}, (post) => el('li', '', el('strong', post.title), el('div', post.body)));

let interestFilter = '';
const loadInterests = pagedList('interests', (p) => api(`/users/interests?page=${p}&interest=${encodeURIComponent(interestFilter)}`), (g) =>
  el('li', '', el('strong', `${g.interest} (${g.count})`), el('div', g.users.map((u) => u.name).join(', ')))
);

const loadUsers = pagedList('users', (p) => api(`/admin/users?page=${p}`), (u) =>
  el('li', '',
    el('strong', `${u.name} · ${u.role}`),
    el('div', `${u.email} · ${u.interests.join(', ') || 'no interests'} · id ${u._id}`),
    button('Edit', () => editUser(u)),
    button('Delete', () => deleteUser(u), 'btn-danger'))
);

const loadAllNotes = pagedList('all-notes', (p) => api(`/admin/notes?page=${p}`), (n) =>
  el('li', '', el('strong', `${n.title} — by ${n.owner?.name ?? 'deleted user'}`), el('div', n.body))
);

function editNote(n) {
  const f = $('note-form');
  f.title.value = n.title;
  f.body.value = n.body;
  f.id.value = n._id;
  $('note-cancel').hidden = false;
}

function resetNoteForm() {
  $('note-form').reset();
  $('note-form').id.value = '';
  $('note-cancel').hidden = true;
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  await api(`/notes/${id}`, { method: 'DELETE' });
  await loadNotes();
}

function editUser(u) {
  const f = $('user-form');
  f.name.value = u.name;
  f.email.value = u.email;
  f.password.value = '';
  f.interests.value = u.interests.join(', ');
  f.role.value = u.role;
  f.id.value = u._id;
  $('user-cancel').hidden = false;
}

function resetUserForm() {
  $('user-form').reset();
  $('user-form').id.value = '';
  $('user-cancel').hidden = true;
}

async function deleteUser(u) {
  if (!confirm(`Delete ${u.email} and all their notes and posts?`)) return;
  await api(`/admin/users/${u._id}`, { method: 'DELETE' });
  await Promise.all([loadUsers(), loadAllNotes()]);
}

function onSubmit(id, handler) {
  $(id).onsubmit = (e) => {
    e.preventDefault();
    run(() => handler(e.target), e.target);
  };
}

onSubmit('login-form', async (f) => signIn(await api('/auth/login', { method: 'POST', body: formData(f) })));

onSubmit('register-form', async (f) => {
  const body = formData(f);
  body.interests = splitInterests(body.interests);
  signIn(await api('/auth/register', { method: 'POST', body }));
});

onSubmit('note-form', async (f) => {
  const { id, ...body } = formData(f);
  await api(id ? `/notes/${id}` : '/notes', { method: id ? 'PATCH' : 'POST', body });
  resetNoteForm();
  await loadNotes(id ? undefined : 1);
});

onSubmit('post-form', async (f) => {
  await api('/posts', { method: 'POST', body: formData(f) });
  f.reset();
  postsUserId = '';
  await loadPosts(1);
});

onSubmit('posts-user-form', async (f) => {
  postsUserId = f.userId.value.trim();
  await loadPosts(1);
});

onSubmit('interests-form', async (f) => {
  interestFilter = f.interest.value.trim();
  await loadInterests(1);
});

onSubmit('user-form', async (f) => {
  const { id, ...body } = formData(f);
  body.interests = splitInterests(body.interests);
  if (!body.password) delete body.password;
  await api(id ? `/admin/users/${id}` : '/admin/users', { method: id ? 'PATCH' : 'POST', body });
  resetUserForm();
  await loadUsers(id ? undefined : 1);
});

$('note-cancel').onclick = resetNoteForm;
$('user-cancel').onclick = resetUserForm;
$('logout').onclick = logout;

function signIn(data) {
  token = data.token;
  localStorage.setItem('token', token);
  showApp(data.user);
}

function logout() {
  token = null;
  me = null;
  localStorage.removeItem('token');
  $('app').hidden = true;
  $('userbar').hidden = true;
  $('guest').hidden = false;
}

function showApp(user) {
  me = user;
  $('me').textContent = `${user.name} (${user.role})`;
  $('guest').hidden = true;
  $('app').hidden = false;
  $('userbar').hidden = false;
  $('admin').hidden = user.role !== 'admin';
  run(async () => {
    await Promise.all([loadNotes(1), loadPosts(1), loadInterests(1)]);
    if (user.role === 'admin') await Promise.all([loadUsers(1), loadAllNotes(1)]);
  });
}

if (token) run(async () => showApp(await api('/auth/me')));
