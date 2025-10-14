// app.js - Main library application (ES Module)
// Uses: Fuse.js for fuzzy search, PDF.js for inline viewing, and GitHub Pages static hosting

// -------------------------------
// Configuration and State
// -------------------------------
const DEFAULT_CONFIG = {
  rootFolder: 'Books',
  fuzzySearch: true,
  searchThreshold: 0.4,
  maxViewerSizeMB: 10,
};

let state = {
  config: { ...DEFAULT_CONFIG },
  books: [], // { id, title, author, field, tags[], description, path, sizeBytes, addedAt, metadataSource }
  filteredBooks: [],
  activeTags: new Set(),
  fields: new Set(),
  tags: new Set(),
  fuse: null,
  pdf: {
    url: null,
    pdfDoc: null,
    pageNum: 1,
    pageCount: 1,
    scale: 1.0,
    minScale: 0.5,
    maxScale: 2.5,
    step: 0.1,
    title: '',
  }
};

// LocalStorage Keys
const LS_KEYS = {
  CONFIG: 'library_config_v1',
  BOOKS: 'library_books_v1',
};

// -------------------------------
// Utilities
// -------------------------------
function $(sel, ctx=document) { return ctx.querySelector(sel); }
function $all(sel, ctx=document) { return [...ctx.querySelectorAll(sel)]; }
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
function debounce(fn, delay=250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
function slugify(str='') {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
function uniqueId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function filenameFromPath(p) { return p.split('/').pop(); }

// -------------------------------
// Persistence
// -------------------------------
function saveConfig() { localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(state.config)); }
function loadConfig() {
  const raw = localStorage.getItem(LS_KEYS.CONFIG);
  if (raw) {
    try { state.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }; }
    catch { state.config = { ...DEFAULT_CONFIG }; }
  }
}
function saveBooks() { localStorage.setItem(LS_KEYS.BOOKS, JSON.stringify(state.books)); }
function loadBooks() {
  const raw = localStorage.getItem(LS_KEYS.BOOKS);
  if (raw) {
    try { state.books = JSON.parse(raw); }
    catch { state.books = []; }
  }
}

// -------------------------------
// Initialization
// -------------------------------
function initFuse() {
  if (!state.config.fuzzySearch || state.books.length === 0) { state.fuse = null; return; }
  state.fuse = new Fuse(state.books, {
    keys: [
      'title',
      'author',
      'field',
      'tags',
      'description',
      'filename'
    ],
    threshold: state.config.searchThreshold,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

function rebuildFacets() {
  state.fields = new Set(state.books.map(b => b.field).filter(Boolean));
  state.tags = new Set(state.books.flatMap(b => b.tags || []).filter(Boolean));
  const fieldFilter = $('#fieldFilter');
  const prev = fieldFilter.value;
  fieldFilter.innerHTML = '<option value="">All Fields</option>' +
    [...state.fields].sort().map(f => `<option value="${f}">${f}</option>`).join('');
  fieldFilter.value = prev || '';

  const tagFilters = $('#tagFilters');
  tagFilters.innerHTML = '';
  [...state.tags].sort().forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-filter';
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener('click', () => {
      if (state.activeTags.has(tag)) state.activeTags.delete(tag);
      else state.activeTags.add(tag);
      btn.classList.toggle('active');
      applyFiltersAndRender();
    });
    tagFilters.appendChild(btn);
  });
}

// -------------------------------
// Manifest loading (books.json only)
// -------------------------------
async function tryLoadManifest() {
  try {
    const res = await fetch('books.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

// -------------------------------
// Scan books: Only load from books.json, NO metadata extraction
// -------------------------------
async function scanBooks() {
  showLoading(true);

  const manifest = await tryLoadManifest();
  if (!manifest || manifest.length === 0) {
    alert('No books.json manifest found. Please create or import one.');
    showLoading(false);
    return;
  }

  // Replace current book list with manifest entries only
  state.books = manifest.map(item => ({
    id: item.id || uniqueId(),
    title: item.title || '',
    author: item.author || '',
    field: item.field || '',
    tags: item.tags || [],
    description: item.description || '',
    path: item.path,
    filename: filenameFromPath(item.path),
    sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : NaN,
    addedAt: item.addedAt || Date.now(),
    metadataSource: item.metadataSource || 'manifest',
  }));

  saveBooks();
  initFuse();
  rebuildFacets();
  applyFiltersAndRender();
  showLoading(false);
}

// -------------------------------
// Rendering
// -------------------------------
function renderBooks(list) {
  const grid = $('#booksGrid');
  grid.innerHTML = '';
  if (!list || list.length === 0) {
    $('#emptyState').style.display = 'block';
    $('#resultsCount').textContent = '0 books found';
    $('#totalSize').textContent = 'Total: 0 MB';
    return;
  }
  $('#emptyState').style.display = 'none';
  const totalSize = list.reduce((sum, b) => sum + (Number.isFinite(b.sizeBytes) ? b.sizeBytes : 0), 0);
  $('#resultsCount').textContent = `${list.length} book${list.length > 1 ? 's' : ''} found`;
  $('#totalSize').textContent = `Total: ${formatBytes(totalSize)}`;

  list.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.id = book.id;
    card.innerHTML = `
      <div class="book-header">
        <div class="book-icon">📘</div>
        <div class="book-actions">
          <button class="action-btn" title="Edit" data-action="edit">✏️</button>
          <a class="action-btn" title="Download" href="${encodeURI(book.path)}" download>📥</a>
          <a class="action-btn" title="Open Raw" href="${encodeURI(book.path)}" target="_blank" rel="noopener">🔗</a>
        </div>
      </div>
      <div class="book-title" title="${book.title}">${book.title}</div>
      <div class="book-meta">
        <div class="book-author">👤 ${book.author || 'Unknown author'}</div>
        <div class="book-field">🏷️ ${book.field || 'Uncategorized'}</div>
      </div>
      <div class="book-tags">${(book.tags || []).map(t => `<span class="book-tag">${t}</span>`).join('')}</div>
      <div class="book-description">${book.description || ''}</div>
      <div class="book-footer">
        <div class="book-size">${Number.isFinite(book.sizeBytes) ? formatBytes(book.sizeBytes) : ''}</div>
        <div class="book-actions-footer">
          <button class="btn btn-secondary btn-small" data-action="view">👁️ View</button>
          <a class="btn btn-primary btn-small" href="${encodeURI(book.path)}" download>Download</a>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      const action = e.target?.dataset?.action;
      if (!action) return;
      if (action === 'view') openPdf(book);
      if (action === 'edit') openEditModal(book);
    });
    grid.appendChild(card);
  });
}

function applyFiltersAndRender() {
  const query = $('#searchInput').value.trim();
  const fieldVal = $('#fieldFilter').value;
  const activeTags = new Set(state.activeTags);
  let list = [...state.books];

  // Search
  if (query) {
    if (state.fuse) {
      const results = state.fuse.search(query);
      list = results.map(r => r.item);
    } else {
      const q = query.toLowerCase();
      list = list.filter(b =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.field || '').toLowerCase().includes(q) ||
        (b.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
  }

  // Field filter
  if (fieldVal) list = list.filter(b => b.field === fieldVal);

  // Tag filters (AND)
  if (activeTags.size > 0) {
    list = list.filter(b => {
      const bt = new Set((b.tags || []).map(String));
      for (const t of activeTags) if (!bt.has(t)) return false; return true;
    });
  }

  // Sorting
  const sort = $('#sortSelect').value;
  list.sort((a, b) => {
    switch (sort) {
      case 'title-desc': return a.title.localeCompare(b.title) * -1;
      case 'author': return (a.author || '').localeCompare(b.author || '');
      case 'author-desc': return (a.author || '').localeCompare(b.author || '') * -1;
      case 'field': return (a.field || '').localeCompare(b.field || '');
      case 'size': return (a.sizeBytes || 0) - (b.sizeBytes || 0);
      case 'date': return (a.addedAt || 0) - (b.addedAt || 0);
      case 'title':
      default: return a.title.localeCompare(b.title);
    }
  });

  state.filteredBooks = list;
  renderBooks(list);
}

function showLoading(show) {
  $('#loadingIndicator').style.display = show ? 'block' : 'none';
}

// -------------------------------
// PDF Viewer
// -------------------------------
async function openPdf(book) {
  const sizeMB = Number.isFinite(book.sizeBytes) ? book.sizeBytes / (1024 * 1024) : NaN;
  const allowInline = !Number.isFinite(sizeMB) || sizeMB <= state.config.maxViewerSizeMB;
  if (!allowInline) {
    window.open(encodeURI(book.path), '_blank');
    return;
  }
  state.pdf = { ...state.pdf, url: encodeURI(book.path), pageNum: 1, scale: 1.0, title: book.title };
  $('#modalTitle').textContent = book.title;
  $('#downloadBtn').onclick = () => window.open(encodeURI(book.path), '_blank');
  $('#pdfModal').style.display = 'flex';
  await renderPdfPage();
}

async function getPdfjs() {
  const pdfjs = (window.pdfjsLib || window['pdfjs-dist/build/pdf']);
  if (pdfjs && !pdfjs.GlobalWorkerOptions?._worker) {
    const ver = pdfjs.version || '4.7.76';
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
  }
  return pdfjs;
}

async function renderPdfPage() {
  const pdfjs = await getPdfjs();
  if (!pdfjs) return;
  if (!state.pdf.pdfDoc) {
    const task = pdfjs.getDocument(state.pdf.url);
    state.pdf.pdfDoc = await task.promise;
    state.pdf.pageCount = state.pdf.pdfDoc.numPages;
  }
  const page = await state.pdf.pdfDoc.getPage(state.pdf.pageNum);
  const viewport = page.getViewport({ scale: state.pdf.scale });
  const canvas = $('#pdfCanvas');
  const ctx = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  const renderContext = { canvasContext: ctx, viewport };
  await page.render(renderContext).promise;
  $('#pageInfo').textContent = `Page ${state.pdf.pageNum} of ${state.pdf.pageCount}`;
  $('#zoomLevel').textContent = `${Math.round(state.pdf.scale * 100)}%`;
}

function closePdf() {
  $('#pdfModal').style.display = 'none';
  if (state.pdf.pdfDoc) { try { state.pdf.pdfDoc.destroy(); } catch { } }
  state.pdf = { url: null, pdfDoc: null, pageNum: 1, pageCount: 1, scale: 1.0, minScale: 0.5, maxScale: 2.5, step: 0.1, title: '' };
}

// -------------------------------
// Edit Modal
// -------------------------------
let editingId = null;
function openEditModal(book) {
  editingId = book.id;
  $('#editTitle').value = book.title || '';
  $('#editAuthor').value = book.author || '';
  $('#editField').value = book.field || '';
  $('#editTags').value = (book.tags || []).join(', ');
  $('#editDescription').value = book.description || '';
  $('#editModal').style.display = 'flex';
}
function closeEditModal() {
  $('#editModal').style.display = 'none';
  editingId = null;
}

// -------------------------------
// Config Modal
// -------------------------------
function openConfigModal() {
  $('#rootFolder').value = state.config.rootFolder;
  $('#fuzzySearch').checked = state.config.fuzzySearch;
  $('#searchThreshold').value = state.config.searchThreshold;
  $('#thresholdValue').textContent = state.config.searchThreshold.toString();
  $('#maxViewerSize').value = state.config.maxViewerSizeMB;
  $('#configModal').style.display = 'flex';
}
function closeConfigModal() { $('#configModal').style.display = 'none'; }

// -------------------------------
// Import/Export books.json
// -------------------------------
function exportBooksJson() {
  const manifest = state.books.map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    field: b.field,
    tags: b.tags,
    description: b.description,
    path: b.path,
    sizeBytes: Number.isFinite(b.sizeBytes) ? b.sizeBytes : undefined,
    addedAt: b.addedAt,
    metadataSource: b.metadataSource,
  }));
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'books.json'; a.click();
  URL.revokeObjectURL(url);
}

function importBooksJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const arr = JSON.parse(e.target.result);
      if (!Array.isArray(arr)) throw new Error('Invalid JSON');
      state.books = arr.map(enrich => ({
        id: enrich.id || uniqueId(),
        title: enrich.title || '',
        author: enrich.author || '',
        field: enrich.field || '',
        tags: enrich.tags || [],
        description: enrich.description || '',
        path: enrich.path,
        filename: filenameFromPath(enrich.path),
        sizeBytes: typeof enrich.sizeBytes === 'number' ? enrich.sizeBytes : NaN,
        addedAt: enrich.addedAt || Date.now(),
        metadataSource: enrich.metadataSource || 'import',
      }));
      saveBooks();
      initFuse();
      rebuildFacets();
      applyFiltersAndRender();
      alert('Imported books.json successfully. Remember to commit this file to your repository root for auto-scan.');
    } catch (err) {
      alert('Failed to import books.json: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// -------------------------------
// Event Listeners
// -------------------------------
function bindEvents() {
  // Search
  const onSearch = debounce(applyFiltersAndRender, 200);
  $('#searchInput').addEventListener('input', () => {
    $('#clearSearchBtn').style.display = $('#searchInput').value ? 'block' : 'none';
    onSearch();
  });
  $('#clearSearchBtn').addEventListener('click', () => { $('#searchInput').value = ''; $('#clearSearchBtn').style.display = 'none'; applyFiltersAndRender(); });

  // Filters
  $('#fieldFilter').addEventListener('change', applyFiltersAndRender);
  $('#sortSelect').addEventListener('change', applyFiltersAndRender);
  $('#resetFiltersBtn').addEventListener('click', () => {
    $('#searchInput').value = '';
    $('#fieldFilter').value = '';
    state.activeTags.clear();
    $all('.tag-filter').forEach(el => el.classList.remove('active'));
    applyFiltersAndRender();
  });

  // Buttons
  $('#scanBtn').addEventListener('click', scanBooks);
  $('#configBtn').addEventListener('click', openConfigModal);

  // PDF modal controls
  $('#closeModalBtn').addEventListener('click', closePdf);
  $('#prevPageBtn').addEventListener('click', async () => { if (state.pdf.pageNum > 1) { state.pdf.pageNum--; await renderPdfPage(); } });
  $('#nextPageBtn').addEventListener('click', async () => { if (state.pdf.pageNum < state.pdf.pageCount) { state.pdf.pageNum++; await renderPdfPage(); } });
  $('#zoomInBtn').addEventListener('click', async () => { state.pdf.scale = Math.min(state.pdf.scale + state.pdf.step, state.pdf.maxScale); await renderPdfPage(); });
  $('#zoomOutBtn').addEventListener('click', async () => { state.pdf.scale = Math.max(state.pdf.scale - state.pdf.step, state.pdf.minScale); await renderPdfPage(); });

  // Edit modal
  $('#closeEditModalBtn').addEventListener('click', closeEditModal);
  $('#cancelEditBtn').addEventListener('click', closeEditModal);
  $('#editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = state.books.findIndex(b => b.id === editingId);
    if (idx === -1) return;
    const updated = {
      ...state.books[idx],
      title: $('#editTitle').value.trim(),
      author: $('#editAuthor').value.trim(),
      field: $('#editField').value.trim(),
      tags: $('#editTags').value.split(',').map(s => s.trim()).filter(Boolean),
      description: $('#editDescription').value.trim(),
      metadataSource: (state.books[idx].metadataSource || 'manifest') + '+manual',
    };
    state.books[idx] = updated;
    saveBooks();
    initFuse();
    rebuildFacets();
    applyFiltersAndRender();
    closeEditModal();
  });

  // Config modal
  $('#closeConfigModalBtn').addEventListener('click', closeConfigModal);
  $('#saveConfigBtn').addEventListener('click', () => {
    state.config.rootFolder = $('#rootFolder').value.trim() || 'Books';
    state.config.fuzzySearch = $('#fuzzySearch').checked;
    state.config.searchThreshold = parseFloat($('#searchThreshold').value) || 0.4;
    state.config.maxViewerSizeMB = Math.max(1, Math.min(50, parseInt($('#maxViewerSize').value, 10) || 10));
    saveConfig();
    initFuse();
    closeConfigModal();
  });
  $('#searchThreshold').addEventListener('input', (e) => { $('#thresholdValue').textContent = e.target.value; });

  // Import/Export
  $('#exportDataBtn').addEventListener('click', exportBooksJson);
  $('#importDataBtn').addEventListener('click', () => $('#importFileInput').click());
  $('#importFileInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importBooksJson(file);
  });

  // Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#pdfModal').style.display === 'flex') closePdf();
      if ($('#editModal').style.display === 'flex') closeEditModal();
      if ($('#configModal').style.display === 'flex') closeConfigModal();
    }
  });
}

// -------------------------------
// Boot
// -------------------------------
function boot() {
  loadConfig();
  loadBooks();
  initFuse();
  rebuildFacets();
  applyFiltersAndRender();
  bindEvents();
}

window.addEventListener('DOMContentLoaded', boot);
