/* ============================================================
   DRD GENERATOR — SCRIPT.JS
   Modular Vanilla JS ES6 Application
   Phase 1 Complete + Phase 2 Placeholders
============================================================ */

/* ── PDF.js Worker Setup ── */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ============================================================
   MODULE: STATE MANAGEMENT
   Single source of truth for all application data
============================================================ */
const AppState = {
  suratJalanList: [],   // Array of parsed/edited SJ objects
  circuitList: [],      // Array of parsed/edited Circuit objects
  photoMap: {},         // { sjId: [{ dataUrl, name, type:'general'|'before'|'after' }] }
  beforeAfterMap: {},   // { sjId: { before:[{dataUrl,name}], after:[{dataUrl,name}] } }
  kendalaMap: {},       // { sjId: { type, text } }  — standalone kendala per SJ
  assetData: {          // Phase 2 powerbank tracking
    pbDibawa: 0,
    pbTerpasang: 0,
    pbRusak: 0,
    pbSisa: 0,
    kondisiMap: {},     // { sjId: { kondisi:'Baik'|'Bermasalah'|'Rusak', catatan:'' } }
  },
  gpsData: {            // Phase 2 GPS points
    startLat: '', startLng: '', startLabel: '',
    finishLat:'', finishLng:'', finishLabel:'',
    locationCoords: {}, // { sjId: { lat, lng } }
  },
  aiSummary: {
    aktivitas: '',
    hasil: '',
    kesimpulan: '',
    insight: '',
  },
  config: {
    technicianName: '',
    workDate: '',
    targetLocations: 0,
    companyName: '',
  },
};

/* ============================================================
   MODULE: STORAGE
   Persist and restore all state via localStorage
============================================================ */
const Storage = {
  KEY_SJ:          'drd_sj_list',
  KEY_CIRCUIT:     'drd_circuit_list',
  KEY_PHOTOS:      'drd_photo_map',
  KEY_AI:          'drd_ai_summary',
  KEY_CONFIG:      'drd_config',
  KEY_BEFORE_AFTER:'drd_before_after',
  KEY_KENDALA:     'drd_kendala_map',
  KEY_ASSET:       'drd_asset_data',
  KEY_GPS:         'drd_gps_data',

  save() {
    try {
      localStorage.setItem(this.KEY_SJ,          JSON.stringify(AppState.suratJalanList));
      localStorage.setItem(this.KEY_CIRCUIT,     JSON.stringify(AppState.circuitList));
      localStorage.setItem(this.KEY_AI,          JSON.stringify(AppState.aiSummary));
      localStorage.setItem(this.KEY_CONFIG,      JSON.stringify(AppState.config));
      localStorage.setItem(this.KEY_KENDALA,     JSON.stringify(AppState.kendalaMap));
      localStorage.setItem(this.KEY_ASSET,       JSON.stringify(AppState.assetData));
      localStorage.setItem(this.KEY_GPS,         JSON.stringify(AppState.gpsData));
      // Photos stored last — largest
      localStorage.setItem(this.KEY_PHOTOS,      JSON.stringify(AppState.photoMap));
      localStorage.setItem(this.KEY_BEFORE_AFTER,JSON.stringify(AppState.beforeAfterMap));
    } catch (e) {
      // Quota exceeded — save everything except large images
      try {
        localStorage.setItem(this.KEY_SJ,      JSON.stringify(AppState.suratJalanList));
        localStorage.setItem(this.KEY_CIRCUIT, JSON.stringify(AppState.circuitList));
        localStorage.setItem(this.KEY_AI,      JSON.stringify(AppState.aiSummary));
        localStorage.setItem(this.KEY_CONFIG,  JSON.stringify(AppState.config));
        localStorage.setItem(this.KEY_KENDALA, JSON.stringify(AppState.kendalaMap));
        localStorage.setItem(this.KEY_ASSET,   JSON.stringify(AppState.assetData));
        localStorage.setItem(this.KEY_GPS,     JSON.stringify(AppState.gpsData));
      } catch (e2) {
        console.warn('Storage quota exceeded:', e2);
      }
    }
  },

  load() {
    try {
      const sj         = localStorage.getItem(this.KEY_SJ);
      const circuit    = localStorage.getItem(this.KEY_CIRCUIT);
      const photos     = localStorage.getItem(this.KEY_PHOTOS);
      const ai         = localStorage.getItem(this.KEY_AI);
      const config     = localStorage.getItem(this.KEY_CONFIG);
      const beforeAfter= localStorage.getItem(this.KEY_BEFORE_AFTER);
      const kendala    = localStorage.getItem(this.KEY_KENDALA);
      const asset      = localStorage.getItem(this.KEY_ASSET);
      const gps        = localStorage.getItem(this.KEY_GPS);

      if (sj)          AppState.suratJalanList  = JSON.parse(sj);
      if (circuit)     AppState.circuitList     = JSON.parse(circuit);
      if (photos)      AppState.photoMap        = JSON.parse(photos);
      if (ai)          AppState.aiSummary       = JSON.parse(ai);
      if (config)      AppState.config          = { ...AppState.config, ...JSON.parse(config) };
      if (beforeAfter) AppState.beforeAfterMap  = JSON.parse(beforeAfter);
      if (kendala)     AppState.kendalaMap      = JSON.parse(kendala);
      if (asset)       AppState.assetData       = { ...AppState.assetData, ...JSON.parse(asset) };
      if (gps)         AppState.gpsData         = { ...AppState.gpsData, ...JSON.parse(gps) };
    } catch (e) {
      console.warn('Error loading stored data:', e);
    }
  },

  clear() {
    [this.KEY_SJ, this.KEY_CIRCUIT, this.KEY_PHOTOS, this.KEY_AI, this.KEY_CONFIG,
     this.KEY_BEFORE_AFTER, this.KEY_KENDALA, this.KEY_ASSET, this.KEY_GPS]
      .forEach(k => localStorage.removeItem(k));
  },
};

/* ============================================================
   MODULE: UTILITIES
   Shared helper functions
============================================================ */
const Utils = {
  /** Generate a unique ID */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /** Format date to Indonesian locale */
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },

  /** Escape HTML to prevent XSS */
  escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /** Show toast notification */
  toast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    const id = Utils.uid();
    const icons = { success: 'bi-check-circle-fill', danger: 'bi-x-circle-fill',
                    warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    const html = `
      <div id="toast-${id}" class="toast align-items-center text-bg-${type} border-0 show" role="alert">
        <div class="d-flex">
          <div class="toast-body d-flex align-items-center gap-2">
            <i class="bi ${icons[type] || icons.info}"></i>
            ${Utils.escHtml(message)}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto"
                  onclick="this.closest('.toast').remove()"></button>
        </div>
      </div>`;
    container.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById(`toast-${id}`)?.remove(), duration);
  },

  /** Read file as DataURL (Promise) */
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  },

  /** Read file as ArrayBuffer (Promise) */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  },

  /** Sanitize filename */
  sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-\.]/gi, '_');
  },

  /** Compute duration string from two HH:MM strings */
  computeDuration(start, finish) {
    if (!start || !finish) return '—';
    const toMin = t => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const diff = toMin(finish) - toMin(start);
    if (diff < 0) return '—';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}j ${m}m`;
  },
};

/* ============================================================
   MODULE: NAVIGATION
============================================================ */
const breadcrumbLabels = {
  dashboard:       'Dashboard',
  'surat-jalan':   'Surat Jalan',
  circuit:         'Circuit',
  documentation:   'Dokumentasi',
  kpi:             'KPI Summary',
  'ai-summary':    'AI Summary',
  review:          'Review Report',
  'pdf-export':    'Export PDF',
  'gps-map':       'GPS Route Map',
  'asset-tracking':'Asset Tracking',
};

function navigateTo(moduleId) {
  // Hide all modules
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  // Show target
  const target = document.getElementById(`module-${moduleId}`);
  if (target) target.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.module === moduleId);
  });

  // Update breadcrumb
  document.getElementById('breadcrumb-text').textContent =
    breadcrumbLabels[moduleId] || moduleId;

  // Close sidebar on mobile
  if (window.innerWidth < 992) closeSidebar();

  // Module-specific refresh
  if (moduleId === 'documentation') renderDocumentationModule();
  if (moduleId === 'kpi')           KPI.render();
  if (moduleId === 'review')        Review.render();
  if (moduleId === 'pdf-export')    PDFExport.renderValidation();
  if (moduleId === 'ai-summary')    restoreAISummary();
  if (moduleId === 'gps-map')       GPSMap.init();
  if (moduleId === 'asset-tracking') AssetTracking.render();

  return false; // Prevent anchor jump
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ============================================================
   MODULE: CONFIG
============================================================ */
function saveConfig() {
  AppState.config = {
    technicianName:  document.getElementById('technicianName')?.value || '',
    workDate:        document.getElementById('workDate')?.value || '',
    targetLocations: parseInt(document.getElementById('targetLocations')?.value) || 0,
    companyName:     document.getElementById('companyName')?.value || '',
  };
  Storage.save();
  Dashboard.updateStats();
}

function restoreConfig() {
  const c = AppState.config;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('technicianName',  c.technicianName);
  set('workDate',        c.workDate);
  set('targetLocations', c.targetLocations || '');
  set('companyName',     c.companyName);
}

function clearAllData() {
  if (!confirm('Reset semua data? Tindakan ini tidak dapat dibatalkan.')) return;
  Storage.clear();
  AppState.suratJalanList = [];
  AppState.circuitList    = [];
  AppState.photoMap       = {};
  AppState.beforeAfterMap = {};
  AppState.kendalaMap     = {};
  AppState.assetData      = { pbDibawa:0, pbTerpasang:0, pbRusak:0, pbSisa:0, kondisiMap:{} };
  AppState.gpsData        = { startLat:'', startLng:'', startLabel:'', finishLat:'', finishLng:'', finishLabel:'', locationCoords:{} };
  AppState.aiSummary      = { aktivitas:'', hasil:'', kesimpulan:'', insight:'' };
  AppState.config         = { technicianName:'', workDate:'', targetLocations:0, companyName:'' };
  restoreConfig();
  SuratJalan.renderAll();
  Circuit.renderAll();
  Dashboard.updateStats();
  navigateTo('dashboard');
  Utils.toast('Semua data berhasil direset.', 'info');
}

/* ============================================================
   MODULE: DASHBOARD
============================================================ */
const Dashboard = {
  updateStats() {
    const sjList   = AppState.suratJalanList;
    const photoMap = AppState.photoMap;
    const circuits = AppState.circuitList;

    const totalFotos = Object.values(photoMap).reduce((a, arr) => a + (arr?.length || 0), 0);
    const kpi = KPI.compute();

    document.getElementById('dash-sj-count').textContent    = sjList.length;
    document.getElementById('dash-foto-count').textContent  = totalFotos;
    document.getElementById('dash-circuit-count').textContent = circuits.length;

    const prod = kpi.productivityScore;
    const prodEl = document.getElementById('dash-productivity');
    if (prod !== null) {
      prodEl.textContent = prod.toFixed(0) + '%';
    } else {
      prodEl.textContent = '—';
    }

    // Update sidebar badge
    const badge = document.getElementById('sj-count-badge');
    if (sjList.length > 0) {
      badge.textContent = sjList.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  },
};

/* ============================================================
   MODULE: PDF PARSING
   Uses PDF.js to extract raw text from PDFs
============================================================ */
const PDFParser = {
  /** Extract all text from a PDF file */
  async extractText(file) {
    try {
      const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page  = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } catch (e) {
      console.error('PDF text extraction failed:', e);
      throw new Error(`Gagal membaca PDF: ${file.name}`);
    }
  },

  /** Parse Surat Jalan fields from raw text */
  parseSuratJalan(text, filename) {
    const find = (patterns, def = '') => {
      for (const pattern of patterns) {
        const m = text.match(pattern);
        if (m && m[1]?.trim()) return m[1].trim();
      }
      return def;
    };

    // Flexible patterns — adapt to common SJ formats
    const nomor = find([
      /No(?:mor)?\s*[:.]\s*([A-Z0-9\/\-\.]+)/i,
      /SJ[:\s]+([A-Z0-9\/\-\.]+)/i,
      /Surat\s+Jalan\s*[:\s]+([A-Z0-9\/\-\.]+)/i,
      /No\.\s*([A-Z0-9\/\-]+)/i,
    ], filename.replace(/\.pdf$/i,'').toUpperCase());

    const tanggal = find([
      /Tanggal\s*[:.]\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
      /Date\s*[:.]\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
      /(\d{1,2}\s+\w+\s+\d{4})/,
    ]);

    const lokasi = find([
      /Lokasi\s*[:.]\s*(.+?)(?:\n|Nama|Mesin|Equipment)/is,
      /Location\s*[:.]\s*(.+?)(?:\n|Nama|Mesin)/is,
      /Toko\s*[:.]\s*(.+?)(?:\n|Mesin)/is,
      /Outlet\s*[:.]\s*(.+?)(?:\n|Mesin)/is,
      /Nama\s+Toko\s*[:.]\s*(.+?)(?:\n)/is,
    ]);

    const mesin = find([
      /Nama\s+Mesin\s*[:.]\s*(.+?)(?:\n|Tipe|Jumlah)/is,
      /Mesin\s*[:.]\s*(.+?)(?:\n|Tipe|Jml)/is,
      /Device\s*[:.]\s*(.+?)(?:\n)/is,
    ]);

    const tipe = find([
      /Tipe\s+Mesin\s*[:.]\s*(.+?)(?:\n|Jumlah)/is,
      /Type\s*[:.]\s*(.+?)(?:\n)/is,
      /Model\s*[:.]\s*(.+?)(?:\n)/is,
    ]);

    const jmlMesin = (() => {
      const m = text.match(/Jumlah\s+Mesin\s*[:.]\s*(\d+)/i) ||
                text.match(/Qty\s+Mesin\s*[:.]\s*(\d+)/i) ||
                text.match(/Jumlah\s*[:.]\s*(\d+)/i);
      return m ? parseInt(m[1]) : 1;
    })();

    const jmlPB = (() => {
      const m = text.match(/(?:Jumlah\s+)?Power\s*[Bb]ank\s*[:.]\s*(\d+)/i) ||
                text.match(/PB\s*[:.]\s*(\d+)/i) ||
                text.match(/Powerbank\s*[:.]\s*(\d+)/i);
      return m ? parseInt(m[1]) : 0;
    })();

    const equipment = find([
      /Equipment\s*[:.]\s*(.+?)(?:\n{2}|Catatan|Keterangan|$)/is,
      /Accessories\s*[:.]\s*(.+?)(?:\n)/is,
    ]);

    return {
      id:        Utils.uid(),
      nomor:     nomor || `SJ-${Date.now()}`,
      tanggal,
      lokasi:    lokasi || 'Lokasi tidak terdeteksi',
      mesin:     mesin  || '',
      tipe:      tipe   || '',
      jmlMesin,
      jmlPB,
      equipment: equipment || '',
      kendala:   '',
      kendalaText: '',
      filename,
      rawText: text.slice(0, 3000), // Keep first 3000 chars for reference
    };
  },

  /** Parse Circuit fields from raw text */
  parseCircuit(text, filename) {
    const find = (patterns, def = '') => {
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]?.trim()) return m[1].trim();
      }
      return def;
    };

    const teknisi = find([
      /Teknisi\s*[:.]\s*(.+?)(?:\n)/i,
      /Driver\s*[:.]\s*(.+?)(?:\n)/i,
      /Name\s*[:.]\s*(.+?)(?:\n)/i,
      /Nama\s*[:.]\s*(.+?)(?:\n)/i,
    ]);

    const tanggal = find([
      /Tanggal\s*[:.]\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
      /Date\s*[:.]\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
      /(\d{4}-\d{2}-\d{2})/,
    ]);

    const startTime = find([
      /Start\s*(?:Time)?\s*[:.]\s*(\d{1,2}:\d{2})/i,
      /Mulai\s*[:.]\s*(\d{1,2}:\d{2})/i,
      /Begin\s*[:.]\s*(\d{1,2}:\d{2})/i,
      /Check.in\s*[:.]\s*(\d{1,2}:\d{2})/i,
    ]);

    const finishTime = find([
      /Finish\s*(?:Time)?\s*[:.]\s*(\d{1,2}:\d{2})/i,
      /Selesai\s*[:.]\s*(\d{1,2}:\d{2})/i,
      /End\s*(?:Time)?\s*[:.]\s*(\d{1,2}:\d{2})/i,
      /Check.out\s*[:.]\s*(\d{1,2}:\d{2})/i,
    ]);

    const duration = find([
      /(?:Total\s+)?Duration\s*[:.]\s*(.+?)(?:\n)/i,
      /(?:Total\s+)?Durasi\s*[:.]\s*(.+?)(?:\n)/i,
      /Working\s+Hours?\s*[:.]\s*(.+?)(?:\n)/i,
    ]) || Utils.computeDuration(startTime, finishTime);

    const distance = find([
      /(?:Total\s+)?Distance\s*[:.]\s*(.+?)(?:\n|km)/i,
      /(?:Total\s+)?Jarak\s*[:.]\s*(.+?)(?:\n|km)/i,
      /(\d+(?:\.\d+)?\s*km)/i,
    ]);

    // Extract table rows (lines with multiple tab/space separated values)
    const tableRows = [];
    const lines = text.split('\n');
    lines.forEach(line => {
      const clean = line.trim();
      if (clean.length > 10 && /\d/.test(clean)) {
        tableRows.push(clean);
      }
    });

    return {
      id: Utils.uid(),
      teknisi: teknisi || AppState.config.technicianName || 'Teknisi',
      tanggal,
      startTime,
      finishTime,
      duration,
      distance,
      tableRows: tableRows.slice(0, 50),
      filename,
    };
  },
};

/* ============================================================
   MODULE: SURAT JALAN
============================================================ */
const SuratJalan = {
  /** Render all SJ cards */
  renderAll() {
    const container = document.getElementById('sj-cards-container');
    const empty     = document.getElementById('sj-empty');
    const list      = AppState.suratJalanList;

    if (list.length === 0) {
      container.innerHTML = '';
      container.appendChild(empty);
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    const html = list.map(sj => this._cardHTML(sj)).join('');
    container.innerHTML = html;
    Dashboard.updateStats();
  },

  _cardHTML(sj) {
    const photos = AppState.photoMap[sj.id] || [];
    const hasPhoto = photos.length > 0;
    const hasKendala = !!sj.kendala;
    let cardClass = 'sj-card';
    if (hasPhoto)   cardClass += ' has-docs';
    if (hasKendala) cardClass += ' has-kendala';

    const kendalaHtml = sj.kendala
      ? `<span class="kendala-badge"><i class="bi bi-exclamation-triangle me-1"></i>${Utils.escHtml(sj.kendala)}</span>`
      : '';

    return `
    <div class="${cardClass}" id="sj-card-${sj.id}">
      <div class="sj-card-header">
        <div>
          <div class="sj-nomor">${Utils.escHtml(sj.nomor)}</div>
          <div class="sj-lokasi">${Utils.escHtml(sj.lokasi)}</div>
          ${sj.tanggal ? `<small class="text-muted">${Utils.escHtml(sj.tanggal)}</small>` : ''}
        </div>
        <div class="sj-card-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="openEditSJ('${sj.id}')"
                  title="Edit data SJ">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </div>
      <div class="sj-meta">
        ${sj.mesin ? `<div class="sj-badge"><i class="bi bi-cpu"></i><strong>${Utils.escHtml(sj.mesin)}</strong></div>` : ''}
        ${sj.tipe  ? `<div class="sj-badge"><i class="bi bi-tag"></i>${Utils.escHtml(sj.tipe)}</div>` : ''}
        <div class="sj-badge"><i class="bi bi-layers"></i>Mesin: <strong>${sj.jmlMesin}</strong></div>
        <div class="sj-badge"><i class="bi bi-battery-charging"></i>PB: <strong>${sj.jmlPB}</strong></div>
        ${sj.equipment ? `<div class="sj-badge"><i class="bi bi-tools"></i>${Utils.escHtml(sj.equipment.slice(0,40))}${sj.equipment.length>40?'…':''}</div>` : ''}
      </div>
      <div class="sj-status-bar">
        <span class="completion-dot ${hasPhoto ? 'complete' : ''}"></span>
        <span class="sj-docs-count">${hasPhoto ? photos.length + ' foto' : 'Belum ada foto'}</span>
        ${kendalaHtml}
        <span class="ms-auto">
          <small class="text-muted" style="font-size:10px">${Utils.escHtml(sj.filename || '')}</small>
        </span>
      </div>
    </div>`;
  },

  /** Add new SJ to state and re-render */
  add(sjData) {
    // Check for duplicate nomor
    const dup = AppState.suratJalanList.find(s => s.nomor === sjData.nomor);
    if (dup) {
      sjData.nomor = sjData.nomor + '_' + Date.now().toString(36).slice(-4);
    }
    AppState.suratJalanList.push(sjData);
    Storage.save();
    this.renderAll();
  },

  /** Update existing SJ */
  update(id, data) {
    const idx = AppState.suratJalanList.findIndex(s => s.id === id);
    if (idx === -1) return;
    AppState.suratJalanList[idx] = { ...AppState.suratJalanList[idx], ...data };
    Storage.save();
    this.renderAll();
  },

  /** Delete SJ by id */
  delete(id) {
    AppState.suratJalanList = AppState.suratJalanList.filter(s => s.id !== id);
    delete AppState.photoMap[id];
    Storage.save();
    this.renderAll();
    Dashboard.updateStats();
  },

  /** Find SJ by id */
  findById(id) {
    return AppState.suratJalanList.find(s => s.id === id);
  },
};

/* ── SJ Upload & Parsing Handlers ── */
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleSJDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  if (files.length === 0) { Utils.toast('Hanya file PDF yang diterima.', 'warning'); return; }
  processSJFiles(files);
}

function handleSJFiles(e) {
  const files = Array.from(e.target.files);
  if (files.length) processSJFiles(files);
  e.target.value = '';
}

async function processSJFiles(files) {
  const statusEl   = document.getElementById('sj-parsing-status');
  const textEl     = document.getElementById('sj-parsing-text');
  const progressEl = document.getElementById('sj-progress-bar');

  statusEl.style.display = 'block';
  let processed = 0;
  let errors    = 0;

  for (const file of files) {
    textEl.textContent = `Memproses: ${file.name} (${processed + 1}/${files.length})`;
    progressEl.style.width = `${((processed) / files.length) * 100}%`;
    try {
      const text = await PDFParser.extractText(file);
      const sjData = PDFParser.parseSuratJalan(text, file.name);
      SuratJalan.add(sjData);
    } catch (err) {
      console.error(err);
      errors++;
      Utils.toast(`Gagal parsing: ${file.name}`, 'danger');
    }
    processed++;
  }

  progressEl.style.width = '100%';
  textEl.textContent = `Selesai. ${processed - errors} berhasil, ${errors} gagal.`;

  setTimeout(() => { statusEl.style.display = 'none'; progressEl.style.width = '0%'; }, 2500);

  if (processed - errors > 0) {
    Utils.toast(`${processed - errors} Surat Jalan berhasil diparsing!`, 'success');
  }
  Dashboard.updateStats();
}

/* ── Edit SJ Modal ── */
function openEditSJ(id) {
  const sj = SuratJalan.findById(id);
  if (!sj) return;

  document.getElementById('edit-sj-id').value          = sj.id;
  document.getElementById('edit-sj-nomor').value        = sj.nomor || '';
  document.getElementById('edit-sj-tanggal').value      = sj.tanggal || '';
  document.getElementById('edit-sj-lokasi').value       = sj.lokasi || '';
  document.getElementById('edit-sj-mesin').value        = sj.mesin || '';
  document.getElementById('edit-sj-tipe').value         = sj.tipe || '';
  document.getElementById('edit-sj-jml-mesin').value   = sj.jmlMesin || 0;
  document.getElementById('edit-sj-jml-pb').value      = sj.jmlPB || 0;
  document.getElementById('edit-sj-equipment').value   = sj.equipment || '';
  document.getElementById('edit-sj-kendala').value     = sj.kendala || '';
  document.getElementById('edit-sj-kendala-text').value= sj.kendalaText || '';
  toggleKendalaText();

  new bootstrap.Modal(document.getElementById('editSJModal')).show();
}

function toggleKendalaText() {
  const val = document.getElementById('edit-sj-kendala').value;
  document.getElementById('kendala-text-wrapper').style.display =
    val === 'Lainnya' ? 'block' : 'none';
}

function saveEditSJ() {
  const id = document.getElementById('edit-sj-id').value;
  const nomor  = document.getElementById('edit-sj-nomor').value.trim();
  const lokasi = document.getElementById('edit-sj-lokasi').value.trim();
  if (!nomor || !lokasi) {
    Utils.toast('Nomor SJ dan Lokasi wajib diisi!', 'warning');
    return;
  }

  SuratJalan.update(id, {
    nomor,
    tanggal:     document.getElementById('edit-sj-tanggal').value.trim(),
    lokasi,
    mesin:       document.getElementById('edit-sj-mesin').value.trim(),
    tipe:        document.getElementById('edit-sj-tipe').value.trim(),
    jmlMesin:    parseInt(document.getElementById('edit-sj-jml-mesin').value) || 0,
    jmlPB:       parseInt(document.getElementById('edit-sj-jml-pb').value) || 0,
    equipment:   document.getElementById('edit-sj-equipment').value.trim(),
    kendala:     document.getElementById('edit-sj-kendala').value,
    kendalaText: document.getElementById('edit-sj-kendala-text').value.trim(),
  });

  bootstrap.Modal.getInstance(document.getElementById('editSJModal'))?.hide();
  Utils.toast('Data Surat Jalan berhasil disimpan.', 'success');
  Dashboard.updateStats();
}

function deleteSJ() {
  const id = document.getElementById('edit-sj-id').value;
  if (!confirm('Hapus Surat Jalan ini beserta semua fotonya?')) return;
  bootstrap.Modal.getInstance(document.getElementById('editSJModal'))?.hide();
  SuratJalan.delete(id);
  Utils.toast('Surat Jalan dihapus.', 'info');
}

/* ============================================================
   MODULE: CIRCUIT
============================================================ */
const Circuit = {
  renderAll() {
    const container = document.getElementById('circuit-data-container');
    const empty     = document.getElementById('circuit-empty');
    const list      = AppState.circuitList;

    if (list.length === 0) {
      container.innerHTML = '';
      container.appendChild(empty);
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = list.map(c => this._cardHTML(c)).join('');
    Dashboard.updateStats();
  },

  _cardHTML(c) {
    const tableHtml = c.tableRows?.length
      ? `<div class="mt-3">
           <small class="text-muted fw-semibold">Data Tabel Circuit</small>
           <div class="table-responsive mt-1">
             <table class="table table-sm table-bordered" style="font-size:11.5px">
               <tbody>
                 ${c.tableRows.slice(0,15).map(row =>
                   `<tr><td>${Utils.escHtml(row)}</td></tr>`
                 ).join('')}
               </tbody>
             </table>
           </div>
         </div>`
      : '';

    return `
    <div class="circuit-card" id="circuit-card-${c.id}">
      <div class="circuit-header">
        <div>
          <div class="circuit-name"><i class="bi bi-diagram-3 me-2 text-primary"></i>${Utils.escHtml(c.teknisi || 'Circuit Data')}</div>
          <small class="text-muted">${Utils.escHtml(c.filename || '')}</small>
        </div>
        <button class="btn btn-sm btn-outline-primary" onclick="openEditCircuit('${c.id}')">
          <i class="bi bi-pencil me-1"></i>Edit
        </button>
      </div>
      <div class="circuit-stats">
        <div class="circuit-stat">
          <div class="circuit-stat-label">Tanggal</div>
          <div class="circuit-stat-value" style="font-size:13px">${Utils.escHtml(c.tanggal || '—')}</div>
        </div>
        <div class="circuit-stat">
          <div class="circuit-stat-label">Start Time</div>
          <div class="circuit-stat-value">${Utils.escHtml(c.startTime || '—')}</div>
        </div>
        <div class="circuit-stat">
          <div class="circuit-stat-label">Finish Time</div>
          <div class="circuit-stat-value">${Utils.escHtml(c.finishTime || '—')}</div>
        </div>
        <div class="circuit-stat">
          <div class="circuit-stat-label">Duration</div>
          <div class="circuit-stat-value">${Utils.escHtml(c.duration || '—')}</div>
        </div>
        <div class="circuit-stat">
          <div class="circuit-stat-label">Distance</div>
          <div class="circuit-stat-value">${Utils.escHtml(c.distance || '—')}</div>
        </div>
      </div>
      ${tableHtml}
    </div>`;
  },

  add(data) {
    AppState.circuitList.push(data);
    Storage.save();
    this.renderAll();
  },

  update(id, data) {
    const idx = AppState.circuitList.findIndex(c => c.id === id);
    if (idx === -1) return;
    AppState.circuitList[idx] = { ...AppState.circuitList[idx], ...data };
    Storage.save();
    this.renderAll();
  },

  delete(id) {
    AppState.circuitList = AppState.circuitList.filter(c => c.id !== id);
    Storage.save();
    this.renderAll();
  },

  findById(id) {
    return AppState.circuitList.find(c => c.id === id);
  },

  /** Get primary circuit (first one) for time data */
  getPrimary() {
    return AppState.circuitList[0] || null;
  },
};

/* ── Circuit Upload Handlers ── */
function handleCircuitDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  if (files.length === 0) { Utils.toast('Hanya file PDF yang diterima.', 'warning'); return; }
  processCircuitFiles(files);
}

function handleCircuitFiles(e) {
  const files = Array.from(e.target.files);
  if (files.length) processCircuitFiles(files);
  e.target.value = '';
}

async function processCircuitFiles(files) {
  const statusEl = document.getElementById('circuit-parsing-status');
  const textEl   = document.getElementById('circuit-parsing-text');

  statusEl.style.display = 'block';

  for (const file of files) {
    textEl.textContent = `Memproses: ${file.name}...`;
    try {
      const text = await PDFParser.extractText(file);
      const data = PDFParser.parseCircuit(text, file.name);
      Circuit.add(data);
    } catch (err) {
      console.error(err);
      Utils.toast(`Gagal parsing Circuit: ${file.name}`, 'danger');
    }
  }

  statusEl.style.display = 'none';
  Utils.toast(`${files.length} Circuit berhasil diparsing!`, 'success');
  Dashboard.updateStats();
}

/* ── Edit Circuit Modal ── */
function openEditCircuit(id) {
  const c = Circuit.findById(id);
  if (!c) return;

  document.getElementById('edit-circuit-id').value       = c.id;
  document.getElementById('edit-circuit-teknisi').value  = c.teknisi || '';
  document.getElementById('edit-circuit-tanggal').value  = c.tanggal || '';
  document.getElementById('edit-circuit-start').value    = c.startTime || '';
  document.getElementById('edit-circuit-finish').value   = c.finishTime || '';
  document.getElementById('edit-circuit-duration').value = c.duration || '';
  document.getElementById('edit-circuit-distance').value = c.distance || '';

  new bootstrap.Modal(document.getElementById('editCircuitModal')).show();
}

function saveEditCircuit() {
  const id       = document.getElementById('edit-circuit-id').value;
  const start    = document.getElementById('edit-circuit-start').value.trim();
  const finish   = document.getElementById('edit-circuit-finish').value.trim();
  const duration = document.getElementById('edit-circuit-duration').value.trim()
                   || Utils.computeDuration(start, finish);

  Circuit.update(id, {
    teknisi:   document.getElementById('edit-circuit-teknisi').value.trim(),
    tanggal:   document.getElementById('edit-circuit-tanggal').value.trim(),
    startTime: start,
    finishTime: finish,
    duration,
    distance:  document.getElementById('edit-circuit-distance').value.trim(),
  });

  bootstrap.Modal.getInstance(document.getElementById('editCircuitModal'))?.hide();
  Utils.toast('Data Circuit berhasil disimpan.', 'success');
  Dashboard.updateStats();
}

function deleteCircuit() {
  const id = document.getElementById('edit-circuit-id').value;
  if (!confirm('Hapus data Circuit ini?')) return;
  bootstrap.Modal.getInstance(document.getElementById('editCircuitModal'))?.hide();
  Circuit.delete(id);
  Utils.toast('Circuit dihapus.', 'info');
}

/* ============================================================
   MODULE: DOCUMENTATION — Phase 2 (Before/After + Kendala tabs)
============================================================ */
function renderDocumentationModule() {
  const container = document.getElementById('doc-container');
  const emptyEl   = document.getElementById('doc-empty');
  const list      = AppState.suratJalanList;
  if (list.length === 0) {
    container.innerHTML = '';
    if (emptyEl) { container.appendChild(emptyEl); emptyEl.style.display = 'block'; }
    return;
  }
  container.innerHTML = list.map(sj => _docSectionHTML(sj)).join('');
}

function _docSectionHTML(sj) {
  const photos  = AppState.photoMap[sj.id]      || [];
  const ba      = AppState.beforeAfterMap[sj.id] || { before: [], after: [] };
  const kendala = AppState.kendalaMap[sj.id]     || { type: sj.kendala || '', text: sj.kendalaText || '' };
  const totalPhotos = photos.length + ba.before.length + ba.after.length;

  const thumbsHTML = (arr, type) => arr.map((p, i) => `
    <div class="photo-thumb ${type !== 'general' ? 'ba-thumb-'+type : ''}">
      <img src="${p.dataUrl}" alt="${Utils.escHtml(p.name)}" loading="lazy" />
      ${type !== 'general' ? `<div class="ba-label ${type}-label">${type.toUpperCase()}</div>` : ''}
      <button class="photo-remove" onclick="removeDocPhoto('${sj.id}','${type}',${i})"><i class="bi bi-x"></i></button>
    </div>`).join('');

  const kendalaOpts = ['','Lokasi Tutup','Listrik Tidak Tersedia','Internet Tidak Tersedia',
    'Mesin Rusak','Powerbank Rusak','Bracket Tidak Sesuai','Lokasi Menolak Pemasangan','Lainnya'];
  const kendalaOptHTML = kendalaOpts.map(o =>
    `<option value="${o}" ${kendala.type===o?'selected':''}>${o||'Tidak Ada'}</option>`).join('');

  const id = sj.id;
  return `
  <div class="doc-sj-section">
    <div class="doc-sj-header">
      <div>
        <div class="doc-sj-title">${Utils.escHtml(sj.nomor)} — ${Utils.escHtml(sj.lokasi)}</div>
        <small class="text-muted">${totalPhotos} foto total</small>
      </div>
      <span class="completion-dot ${totalPhotos > 0 ? 'complete' : ''}"></span>
    </div>
    <div class="doc-sj-body">
      <ul class="nav nav-tabs doc-tabs mb-3" id="doctabs-${id}">
        <li class="nav-item"><button class="nav-link active" onclick="switchDocTab(event,'${id}','general')">
          <i class="bi bi-images me-1"></i>Umum${photos.length?` <span class="tab-badge">${photos.length}</span>`:''}</button></li>
        <li class="nav-item"><button class="nav-link" onclick="switchDocTab(event,'${id}','before-after')">
          <i class="bi bi-arrow-left-right me-1"></i>Before &amp; After${(ba.before.length+ba.after.length)?` <span class="tab-badge">${ba.before.length+ba.after.length}</span>`:''}</button></li>
        <li class="nav-item"><button class="nav-link" onclick="switchDocTab(event,'${id}','kendala')">
          <i class="bi bi-exclamation-triangle me-1"></i>Kendala${kendala.type?` <span class="tab-badge warn">!</span>`:''}</button></li>
      </ul>

      <div id="doctab-${id}-general">
        <div class="doc-drop-zone" ondrop="handlePhotoDrop(event,'${id}','general')"
             ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)"
             onclick="triggerDocInput('${id}','general')">
          <i class="bi bi-image me-2"></i>Drag &amp; Drop atau klik untuk upload foto umum
          <input type="file" id="photo-input-${id}-general" accept="image/*" multiple hidden
                 onchange="handlePhotoFiles(event,'${id}','general')" />
        </div>
        ${photos.length ? `<div class="photo-grid mt-2">${thumbsHTML(photos,'general')}</div>` : ''}
      </div>

      <div id="doctab-${id}-before-after" style="display:none">
        <div class="row g-3">
          <div class="col-md-6">
            <div class="ba-zone before-zone" ondrop="handlePhotoDrop(event,'${id}','before')"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)"
                 onclick="triggerDocInput('${id}','before')">
              <i class="bi bi-camera me-1"></i><strong>BEFORE</strong> — Sebelum Pemasangan
              <input type="file" id="photo-input-${id}-before" accept="image/*" multiple hidden
                     onchange="handlePhotoFiles(event,'${id}','before')" />
            </div>
            ${ba.before.length ? `<div class="photo-grid mt-2">${thumbsHTML(ba.before,'before')}</div>` : ''}
          </div>
          <div class="col-md-6">
            <div class="ba-zone after-zone" ondrop="handlePhotoDrop(event,'${id}','after')"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)"
                 onclick="triggerDocInput('${id}','after')">
              <i class="bi bi-camera-fill me-1"></i><strong>AFTER</strong> — Setelah Pemasangan
              <input type="file" id="photo-input-${id}-after" accept="image/*" multiple hidden
                     onchange="handlePhotoFiles(event,'${id}','after')" />
            </div>
            ${ba.after.length ? `<div class="photo-grid mt-2">${thumbsHTML(ba.after,'after')}</div>` : ''}
          </div>
        </div>
      </div>

      <div id="doctab-${id}-kendala" style="display:none">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label fw-semibold">Jenis Kendala</label>
            <select class="form-select" id="kendala-type-${id}"
                    onchange="saveKendala('${id}');toggleKendalaDetailDoc('${id}')">
              ${kendalaOptHTML}
            </select>
          </div>
          <div class="col-md-6" id="kendala-detail-wrap-${id}" style="${kendala.type==='Lainnya'?'':'display:none'}">
            <label class="form-label fw-semibold">Detail Kendala</label>
            <textarea class="form-control" id="kendala-text-${id}" rows="3"
                      oninput="saveKendala('${id}')">${Utils.escHtml(kendala.text)}</textarea>
          </div>
        </div>
        <div class="alert mt-3 mb-0 ${kendala.type ? 'alert-warning' : 'alert-success'} d-flex gap-2 align-items-center" style="font-size:13px">
          <i class="bi ${kendala.type ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}"></i>
          <div>${kendala.type ? `<strong>${Utils.escHtml(kendala.type)}</strong>${kendala.text?' — '+Utils.escHtml(kendala.text):''}` : 'Tidak ada kendala.'}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function switchDocTab(e, id, tab) {
  document.querySelectorAll(`#doctabs-${id} .nav-link`).forEach(b => b.classList.remove('active'));
  ['general','before-after','kendala'].forEach(t => {
    const p = document.getElementById(`doctab-${id}-${t}`);
    if (p) p.style.display = 'none';
  });
  e.target.classList.add('active');
  const panel = document.getElementById(`doctab-${id}-${tab}`);
  if (panel) panel.style.display = 'block';
}

function toggleKendalaDetailDoc(id) {
  const type = document.getElementById(`kendala-type-${id}`)?.value;
  const wrap = document.getElementById(`kendala-detail-wrap-${id}`);
  if (wrap) wrap.style.display = type === 'Lainnya' ? 'block' : 'none';
}

function saveKendala(sjId) {
  const type = document.getElementById(`kendala-type-${sjId}`)?.value || '';
  const text = document.getElementById(`kendala-text-${sjId}`)?.value || '';
  AppState.kendalaMap[sjId] = { type, text };
  SuratJalan.update(sjId, { kendala: type, kendalaText: text });
}

function triggerDocInput(sjId, type) {
  document.getElementById(`photo-input-${sjId}-${type}`)?.click();
}

function handlePhotoDrop(e, sjId, type = 'general') {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) { Utils.toast('Hanya file gambar yang diterima.', 'warning'); return; }
  addDocPhotos(sjId, files, type);
}

function handlePhotoFiles(e, sjId, type = 'general') {
  const files = Array.from(e.target.files);
  if (files.length) addDocPhotos(sjId, files, type);
  e.target.value = '';
}

async function addDocPhotos(sjId, files, type = 'general') {
  for (const file of files) {
    try {
      const dataUrl = await Utils.readFileAsDataURL(file);
      const entry = { dataUrl, name: file.name };
      if (type === 'general') {
        if (!AppState.photoMap[sjId]) AppState.photoMap[sjId] = [];
        AppState.photoMap[sjId].push(entry);
      } else {
        if (!AppState.beforeAfterMap[sjId]) AppState.beforeAfterMap[sjId] = { before: [], after: [] };
        AppState.beforeAfterMap[sjId][type].push(entry);
      }
    } catch (err) { Utils.toast(`Gagal membaca: ${file.name}`, 'danger'); }
  }
  Storage.save();
  renderDocumentationModule();
  Dashboard.updateStats();
  Utils.toast(`${files.length} foto ditambahkan.`, 'success');
}

function removeDocPhoto(sjId, type, index) {
  if (type === 'general') {
    AppState.photoMap[sjId]?.splice(index, 1);
  } else {
    AppState.beforeAfterMap[sjId]?.[type]?.splice(index, 1);
  }
  Storage.save();
  renderDocumentationModule();
  Dashboard.updateStats();
}

// Legacy compat
function addPhotos(sjId, files) { addDocPhotos(sjId, files, 'general'); }
function removePhoto(sjId, index) { removeDocPhoto(sjId, 'general', index); }
function triggerPhotoInput(sjId) { triggerDocInput(sjId, 'general'); }

/* ============================================================
   MODULE: KPI
============================================================ */
const KPI = {
  /** Compute all KPI values from AppState */
  compute() {
    const sjList   = AppState.suratJalanList;
    const photoMap = AppState.photoMap;
    const circuits = AppState.circuitList;
    const config   = AppState.config;

    const totalSJ      = sjList.length;
    const totalLokasi  = totalSJ;
    const totalMesin   = sjList.reduce((a, s) => a + (s.jmlMesin || 0), 0);
    const totalPB      = sjList.reduce((a, s) => a + (s.jmlPB || 0), 0);
    const totalFoto    = Object.values(photoMap).reduce((a, arr) => a + (arr?.length || 0), 0);
    const totalEquip   = sjList.filter(s => s.equipment).length;

    // Lokasi selesai = has at least 1 foto
    const lokasiSelesai = sjList.filter(s => (photoMap[s.id]?.length || 0) > 0).length;
    const lokasiBelum   = totalLokasi - lokasiSelesai;

    // Productivity Score
    const target = config.targetLocations || totalLokasi || 1;
    const productivityScore = totalLokasi > 0
      ? Math.min(100, (lokasiSelesai / target) * 100)
      : null;

    const productivityCategory = productivityScore !== null
      ? productivityScore >= 90 ? 'Excellent'
      : productivityScore >= 80 ? 'Good'
      : productivityScore >= 70 ? 'Fair'
      : 'Need Improvement'
      : '—';

    // Time from Circuit (primary source)
    const circuit = Circuit.getPrimary();
    const startTime  = circuit?.startTime  || '—';
    const finishTime = circuit?.finishTime || '—';
    const duration   = circuit?.duration   || Utils.computeDuration(circuit?.startTime, circuit?.finishTime) || '—';
    const distance   = circuit?.distance   || '—';
    const timeSource = circuit ? 'Circuit PDF' : '—';

    return {
      totalSJ, totalLokasi, totalMesin, totalPB, totalFoto, totalEquip,
      lokasiSelesai, lokasiBelum,
      productivityScore, productivityCategory,
      startTime, finishTime, duration, distance, timeSource,
    };
  },

  /** Render KPI module UI */
  render() {
    const kpi = this.compute();

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; };

    setEl('kpi-total-sj',       kpi.totalSJ);
    setEl('kpi-total-lokasi',   kpi.totalLokasi);
    setEl('kpi-lokasi-selesai', kpi.lokasiSelesai);
    setEl('kpi-lokasi-belum',   kpi.lokasiBelum);
    setEl('kpi-total-mesin',    kpi.totalMesin);
    setEl('kpi-total-pb',       kpi.totalPB);
    setEl('kpi-total-foto',     kpi.totalFoto);
    setEl('kpi-total-equipment',kpi.totalEquip);
    setEl('kpi-start-time',     kpi.startTime);
    setEl('kpi-end-time',       kpi.finishTime);
    setEl('kpi-duration',       kpi.duration);
    setEl('kpi-distance',       kpi.distance);
    setEl('kpi-time-source',    kpi.timeSource);

    // Productivity circle
    const score = kpi.productivityScore;
    const scoreEl = document.getElementById('kpi-prod-score');
    const catEl   = document.getElementById('kpi-prod-cat');
    const arcEl   = document.getElementById('kpi-prod-arc');

    if (score !== null) {
      scoreEl.textContent = score.toFixed(0);
      catEl.textContent   = kpi.productivityCategory;

      // Update SVG arc: circumference = 2 * PI * r = 2 * 3.14159 * 50 ≈ 314
      const filled = (score / 100) * 314;
      if (arcEl) arcEl.setAttribute('stroke-dasharray', `${filled} ${314 - filled}`);

      // Category color
      catEl.className = 'prod-category mt-2 ' + ({
        'Excellent':        'cat-excellent',
        'Good':             'cat-good',
        'Fair':             'cat-fair',
        'Need Improvement': 'cat-need-improvement',
      }[kpi.productivityCategory] || '');

      // Stroke color by category
      if (arcEl) arcEl.style.stroke = ({
        'Excellent':        '#198754',
        'Good':             '#0D6EFD',
        'Fair':             '#ffc107',
        'Need Improvement': '#dc3545',
      }[kpi.productivityCategory] || '#0D6EFD');
    } else {
      if (scoreEl) scoreEl.textContent = '—';
      if (catEl)   catEl.textContent   = '—';
    }
  },
};

/* ============================================================
   MODULE: REPORT GENERATOR (Offline — No API Required)
   Generates all report sections from KPI + SJ + Circuit + Asset data
============================================================ */
const AI = {

  /** Collect all data needed for generation */
  _getData() {
    const kpi   = KPI.compute();
    const cfg   = AppState.config;
    const sjs   = AppState.suratJalanList;
    const asset = AppState.assetData;

    const dateStr = cfg.workDate
      ? new Date(cfg.workDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    // Collect all kendala across SJs
    const kendalaItems = sjs
      .map(s => ({ sj: s, k: AppState.kendalaMap[s.id] || { type: s.kendala || '', text: s.kendalaText || '' } }))
      .filter(({ k }) => k.type);

    // Unique machine types deployed
    const mesinList = [...new Set(sjs.map(s => s.mesin).filter(Boolean))];

    // Unique location names
    const lokasiList = sjs.map(s => s.lokasi).filter(Boolean);

    // Before/After coverage
    const hasBAfoto = sjs.some(s => {
      const ba = AppState.beforeAfterMap[s.id];
      return ba && (ba.before.length > 0 || ba.after.length > 0);
    });

    return { kpi, cfg, sjs, asset, dateStr, kendalaItems, mesinList, lokasiList, hasBAfoto };
  },

  /** ── AKTIVITAS ── */
  generateAktivitas() {
    const { kpi, cfg, sjs, dateStr, kendalaItems, mesinList, lokasiList, hasBAfoto } = this._getData();

    if (sjs.length === 0) return 'Tidak ada data Surat Jalan untuk dibuatkan ringkasan aktivitas.';

    const teknisi   = cfg.technicianName || 'Teknisi';
    const perusahaan = cfg.companyName ? ` dari ${cfg.companyName}` : '';

    // Sentence 1 — opening activity
    const s1 = `Pada tanggal ${dateStr}, ${teknisi}${perusahaan} melaksanakan kegiatan deployment lapangan dengan mengunjungi ${kpi.totalLokasi} lokasi berdasarkan ${kpi.totalSJ} Surat Jalan yang diterbitkan.`;

    // Sentence 2 — machines and powerbanks
    const mesinDesc = mesinList.length > 0
      ? `perangkat ${mesinList.slice(0, 3).join(', ')}${mesinList.length > 3 ? ` dan ${mesinList.length - 3} tipe lainnya` : ''}`
      : 'perangkat mesin';
    const s2 = `Kegiatan meliputi pemasangan ${kpi.totalMesin} unit ${mesinDesc}${kpi.totalPB > 0 ? ` serta ${kpi.totalPB} unit powerbank` : ''} di seluruh lokasi target.`;

    // Sentence 3 — working hours
    const s3 = kpi.startTime !== '—' && kpi.finishTime !== '—'
      ? `Teknisi memulai kegiatan pada pukul ${kpi.startTime} dan menyelesaikan seluruh pekerjaan lapangan pada pukul ${kpi.finishTime} dengan total durasi kerja ${kpi.duration}.`
      : `Kegiatan lapangan berlangsung selama ${kpi.duration !== '—' ? kpi.duration : 'seharian penuh'}.`;

    // Sentence 4 — documentation
    const s4 = kpi.totalFoto > 0
      ? `Seluruh proses pemasangan didokumentasikan dengan ${kpi.totalFoto} foto${hasBAfoto ? ' mencakup kondisi before dan after pemasangan' : ''}.`
      : 'Dokumentasi lapangan dilakukan sesuai prosedur standar yang berlaku.';

    // Sentence 5 — distance
    const s5 = kpi.distance !== '—'
      ? `Total jarak tempuh yang dilalui teknisi selama kegiatan deployment adalah ${kpi.distance}.`
      : '';

    // Sentence 6 — kendala (if any)
    const s6 = kendalaItems.length > 0
      ? `Ditemukan ${kendalaItems.length} kendala di lapangan: ${kendalaItems.map(({ k }) => k.type).join(', ')}.`
      : 'Kegiatan berlangsung tanpa kendala berarti di lapangan.';

    return [s1, s2, s3, s4, s5, s6].filter(Boolean).join(' ');
  },

  /** ── HASIL ── */
  generateHasil() {
    const { kpi, cfg, sjs, asset, kendalaItems } = this._getData();

    if (sjs.length === 0) return 'Tidak ada data untuk dibuatkan ringkasan hasil.';

    const teknisi = cfg.technicianName || 'Teknisi';

    // Sentence 1 — completion rate
    const completionRate = kpi.totalLokasi > 0
      ? Math.round((kpi.lokasiSelesai / kpi.totalLokasi) * 100)
      : 0;
    const s1 = `${teknisi} berhasil menyelesaikan ${kpi.lokasiSelesai} dari ${kpi.totalLokasi} lokasi target (${completionRate}%) dengan kategori produktivitas ${kpi.productivityCategory}.`;

    // Sentence 2 — machines
    const s2 = `Total ${kpi.totalMesin} unit mesin berhasil dipasang${kpi.totalPB > 0 ? ` dan ${kpi.totalPB} unit powerbank terdistribusi` : ''} di seluruh lokasi yang dikunjungi.`;

    // Sentence 3 — incomplete locations
    const s3 = kpi.lokasiBelum > 0
      ? `Sebanyak ${kpi.lokasiBelum} lokasi belum terdokumentasi dengan lengkap dan memerlukan tindak lanjut.`
      : 'Seluruh lokasi yang dikunjungi telah terdokumentasi dengan lengkap.';

    // Sentence 4 — asset tracking
    const s4 = asset.pbDibawa > 0
      ? `Dari ${asset.pbDibawa} unit powerbank yang dibawa, ${asset.pbTerpasang} unit berhasil terpasang, ${asset.pbRusak} unit rusak, dan ${asset.pbSisa} unit tersisa.`
      : '';

    // Sentence 5 — kendala impact
    const s5 = kendalaItems.length > 0
      ? `Terdapat ${kendalaItems.length} kendala lapangan yang mempengaruhi hasil pekerjaan, di antaranya: ${[...new Set(kendalaItems.map(({ k }) => k.type))].join(', ')}.`
      : 'Tidak ditemukan kendala signifikan yang berdampak pada hasil pekerjaan harian.';

    // Sentence 6 — documentation result
    const s6 = kpi.totalFoto > 0
      ? `Dokumentasi foto berjumlah ${kpi.totalFoto} gambar telah tersimpan sebagai bukti pelaksanaan pekerjaan.`
      : '';

    return [s1, s2, s3, s4, s5, s6].filter(Boolean).join(' ');
  },

  /** ── KESIMPULAN ── */
  generateKesimpulan() {
    const { kpi, cfg, dateStr, kendalaItems } = this._getData();

    if (AppState.suratJalanList.length === 0) return 'Tidak ada data untuk dibuatkan kesimpulan.';

    const teknisi    = cfg.technicianName || 'Teknisi';
    const perusahaan = cfg.companyName || 'perusahaan';

    // Productivity assessment
    const assessMap = {
      'Excellent':        'sangat baik dan melampaui target yang ditetapkan',
      'Good':             'baik dan memenuhi target operasional harian',
      'Fair':             'cukup namun belum mencapai target optimal yang diharapkan',
      'Need Improvement': 'belum optimal dan memerlukan evaluasi lebih lanjut',
    };
    const assess = assessMap[kpi.productivityCategory] || 'telah dicatat';

    const scoreStr = kpi.productivityScore !== null ? ` (${kpi.productivityScore.toFixed(0)}%)` : '';
    const s1 = `Pelaksanaan kegiatan deployment harian tanggal ${dateStr} oleh ${teknisi} berjalan dengan tingkat produktivitas ${assess}${scoreStr}.`;

    // Working summary
    const s2 = kpi.duration !== '—'
      ? `Teknisi bekerja selama ${kpi.duration}${kpi.distance !== '—' ? ` dengan jarak tempuh ${kpi.distance}` : ''} untuk menyelesaikan ${kpi.lokasiSelesai} lokasi dari ${kpi.totalLokasi} target yang ditetapkan oleh ${perusahaan}.`
      : `Teknisi berhasil menyelesaikan ${kpi.lokasiSelesai} dari ${kpi.totalLokasi} lokasi target yang ditetapkan.`;

    // Kendala note
    const s3 = kendalaItems.length > 0
      ? `Terdapat ${kendalaItems.length} kendala yang perlu mendapat perhatian dan tindak lanjut dari tim terkait.`
      : 'Seluruh kegiatan berlangsung lancar tanpa kendala yang signifikan.';

    // Closing
    const s4 = `Laporan ini disusun sebagai pertanggungjawaban pelaksanaan tugas harian dan dapat dijadikan acuan evaluasi kinerja operasional.`;

    return [s1, s2, s3, s4].join(' ');
  },

  /** ── INSIGHT & RECOMMENDATION ── */
  generateInsight() {
    const { kpi, cfg, sjs, asset, kendalaItems, lokasiList } = this._getData();

    if (sjs.length === 0) return 'Tidak ada data untuk dibuatkan insight dan rekomendasi.';

    const insights = [];
    const rekomendasi = [];

    // ── INSIGHT ANALYSIS ──

    // Productivity insight
    const score = kpi.productivityScore;
    if (score !== null) {
      if (score >= 90) {
        insights.push(`✅ Produktivitas harian sangat tinggi (${score.toFixed(0)}%) — teknisi berhasil menyelesaikan hampir seluruh target lokasi.`);
      } else if (score >= 80) {
        insights.push(`✅ Produktivitas harian baik (${score.toFixed(0)}%) — sebagian besar lokasi target berhasil diselesaikan.`);
      } else if (score >= 70) {
        insights.push(`⚠️ Produktivitas harian cukup (${score.toFixed(0)}%) — masih ada ruang peningkatan untuk mencapai target optimal.`);
      } else {
        insights.push(`🔴 Produktivitas harian rendah (${score.toFixed(0)}%) — diperlukan evaluasi beban kerja dan hambatan operasional.`);
      }
    }

    // Documentation insight
    const docsRate = kpi.totalLokasi > 0
      ? Math.round((kpi.lokasiSelesai / kpi.totalLokasi) * 100)
      : 0;
    if (kpi.totalFoto > 0 && docsRate === 100) {
      insights.push(`📷 Dokumentasi lengkap — seluruh ${kpi.totalLokasi} lokasi telah terdokumentasi dengan ${kpi.totalFoto} foto.`);
    } else if (kpi.lokasiBelum > 0) {
      insights.push(`📷 Dokumentasi belum lengkap — ${kpi.lokasiBelum} lokasi belum memiliki foto dokumentasi yang diperlukan.`);
    }

    // Distance insight
    if (kpi.distance && kpi.distance !== '—') {
      const distNum = parseFloat(kpi.distance);
      if (!isNaN(distNum)) {
        const perLokasi = kpi.totalLokasi > 0 ? (distNum / kpi.totalLokasi).toFixed(1) : 0;
        insights.push(`🗺️ Rata-rata jarak per lokasi adalah ${perLokasi} km dari total ${kpi.distance} yang ditempuh.`);
      }
    }

    // Kendala insight
    if (kendalaItems.length > 0) {
      const types = [...new Set(kendalaItems.map(({ k }) => k.type))];
      insights.push(`⚠️ Ditemukan ${kendalaItems.length} kendala lapangan (${types.join(', ')}) yang mempengaruhi ${kendalaItems.length} lokasi.`);
    } else {
      insights.push(`✅ Tidak ditemukan kendala lapangan — kegiatan berjalan sesuai prosedur standar.`);
    }

    // Asset insight
    if (asset.pbDibawa > 0) {
      const pbEff = asset.pbDibawa > 0
        ? Math.round((asset.pbTerpasang / asset.pbDibawa) * 100)
        : 0;
      insights.push(`🔋 Efisiensi penggunaan powerbank: ${pbEff}% (${asset.pbTerpasang} terpasang dari ${asset.pbDibawa} yang dibawa${asset.pbRusak > 0 ? `, ${asset.pbRusak} unit rusak` : ''}).`);
    }

    // ── REKOMENDASI ──

    // Based on productivity
    if (score !== null && score < 90) {
      rekomendasi.push(`📌 Evaluasi penyebab ${kpi.lokasiBelum} lokasi yang belum selesai dan jadwalkan kunjungan susulan.`);
    }

    // Based on documentation gaps
    if (kpi.lokasiBelum > 0) {
      rekomendasi.push(`📌 Lengkapi dokumentasi foto untuk ${kpi.lokasiBelum} lokasi yang belum terdokumentasi sebelum laporan akhir dikirim.`);
    } else {
      rekomendasi.push(`📌 Pertahankan kelengkapan dokumentasi foto sebagai standar kualitas pelaporan.`);
    }

    // Based on kendala
    if (kendalaItems.length > 0) {
      const hasListrik = kendalaItems.some(({ k }) => k.type.includes('Listrik'));
      const hasInternet = kendalaItems.some(({ k }) => k.type.includes('Internet'));
      const hasTutup = kendalaItems.some(({ k }) => k.type.includes('Tutup'));
      if (hasListrik) rekomendasi.push(`📌 Koordinasikan ketersediaan listrik di lokasi bermasalah sebelum kunjungan berikutnya.`);
      if (hasInternet) rekomendasi.push(`📌 Siapkan solusi koneksi alternatif (hotspot) untuk lokasi dengan keterbatasan internet.`);
      if (hasTutup) rekomendasi.push(`📌 Konfirmasi jadwal operasional toko/outlet sebelum kunjungan untuk menghindari lokasi tutup.`);
      if (!hasListrik && !hasInternet && !hasTutup) {
        rekomendasi.push(`📌 Tindaklanjuti kendala yang ditemukan bersama tim teknis dan koordinasikan dengan pihak lokasi.`);
      }
    } else {
      rekomendasi.push(`📌 Tidak ada kendala berarti — lanjutkan penerapan prosedur standar operasional.`);
    }

    // Based on distance
    if (kpi.distance && kpi.distance !== '—') {
      const distNum = parseFloat(kpi.distance);
      if (!isNaN(distNum) && distNum > 50) {
        rekomendasi.push(`📌 Pertimbangkan pengelompokan lokasi berdasarkan area geografis untuk mengoptimalkan efisiensi perjalanan.`);
      }
    }

    // Based on assets
    if (asset.pbRusak > 0) {
      rekomendasi.push(`📌 Laporkan ${asset.pbRusak} unit powerbank rusak ke gudang untuk penggantian dan klaim garansi.`);
    }

    // General
    if (score !== null && score >= 90) {
      rekomendasi.push(`📌 Pertahankan standar kinerja yang sangat baik — hasil hari ini dapat dijadikan benchmark untuk tim lainnya.`);
    }

    const insightText  = '📊 INSIGHT OPERASIONAL\n\n' + insights.join('\n\n');
    const rekomendasiText = '\n\n💡 REKOMENDASI\n\n' + rekomendasi.join('\n\n');

    return insightText + rekomendasiText;
  },

  setLoading(section, show) {
    const el = document.getElementById(`ai-loading-${section}`);
    if (el) el.style.display = show ? 'flex' : 'none';
  },
};

/** Generate a specific section using offline templates */
function generateAISection(section) {
  if (AppState.suratJalanList.length === 0) {
    Utils.toast('Upload Surat Jalan terlebih dahulu!', 'warning');
    return;
  }

  AI.setLoading(section, true);

  // Use setTimeout to allow the loading indicator to render before synchronous generation
  setTimeout(() => {
    try {
      let result = '';
      if (section === 'aktivitas')  result = AI.generateAktivitas();
      else if (section === 'hasil') result = AI.generateHasil();
      else if (section === 'kesimpulan') result = AI.generateKesimpulan();
      else if (section === 'insight')    result = AI.generateInsight();
      else { AI.setLoading(section, false); return; }

      const textarea = document.getElementById(`ai-${section}`);
      if (textarea) textarea.value = result;
      AppState.aiSummary[section] = result;
      Storage.save();
      Utils.toast(`${section.charAt(0).toUpperCase() + section.slice(1)} berhasil digenerate!`, 'success');
    } catch (err) {
      Utils.toast(`Gagal generate ${section}: ${err.message}`, 'danger', 4000);
      console.error(err);
    } finally {
      AI.setLoading(section, false);
    }
  }, 80);
}

/** Generate all sections sequentially */
function generateAllAI() {
  if (AppState.suratJalanList.length === 0) {
    Utils.toast('Upload Surat Jalan terlebih dahulu!', 'warning');
    return;
  }

  const btn = document.getElementById('btn-generate-ai');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...'; }

  // Stagger each section slightly so loading indicators are visible
  const sections = ['aktivitas', 'hasil', 'kesimpulan', 'insight'];
  sections.forEach((section, i) => {
    setTimeout(() => {
      generateAISection(section);
      if (i === sections.length - 1) {
        setTimeout(() => {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-magic me-2"></i>Generate Semua'; }
        }, 200);
      }
    }, i * 120);
  });
}

function generateWhatsApp() {
  const kpi   = KPI.compute();
  const cfg   = AppState.config;
  const asset = AppState.assetData;
  const date  = cfg.workDate
    ? new Date(cfg.workDate).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric'})
    : new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric'});

  const kesimpulan = AppState.aiSummary.kesimpulan
    ? AppState.aiSummary.kesimpulan.split('\n')[0]
    : '-';

  const kendalaList = AppState.suratJalanList
    .filter(s => AppState.kendalaMap[s.id]?.type || s.kendala)
    .map(s => {
      const k = AppState.kendalaMap[s.id] || { type: s.kendala||'' };
      return `  • ${s.lokasi}: ${k.type}`;
    }).join('\n');

  const assetSection = (asset.pbDibawa > 0)
    ? `\n📦 *ASSET TRACKING*\n• PB Dibawa: ${asset.pbDibawa}\n• PB Terpasang: ${asset.pbTerpasang}\n• PB Rusak: ${asset.pbRusak}\n• PB Tersisa: ${asset.pbSisa}`
    : '';

  const kendalaSection = kendalaList
    ? `\n⚠️ *KENDALA*\n${kendalaList}`
    : '\n✅ *KENDALA*\n• Tidak ada kendala';

  const wa = `*DAILY DEPLOYMENT REPORT*
━━━━━━━━━━━━━━━━━━━

📅 Tanggal: ${date}
👷 Teknisi: ${cfg.technicianName || '-'}
🏢 Perusahaan: ${cfg.companyName || '-'}

📋 *RINGKASAN KPI*
• Total Surat Jalan: ${kpi.totalSJ}
• Lokasi Selesai: ${kpi.lokasiSelesai} / ${kpi.totalLokasi}
• Mesin Terpasang: ${kpi.totalMesin}
• Powerbank Terpasang: ${kpi.totalPB}
• Total Foto: ${kpi.totalFoto}
• Jarak Tempuh: ${kpi.distance}

⏱️ *WAKTU KERJA*
• Jam Mulai: ${kpi.startTime}
• Jam Selesai: ${kpi.finishTime}
• Durasi: ${kpi.duration}

📊 *PRODUKTIVITAS*
• Score: ${kpi.productivityScore !== null ? kpi.productivityScore.toFixed(0)+'%' : '—'}
• Kategori: ${kpi.productivityCategory}
${assetSection}${kendalaSection}

📝 *KESIMPULAN*
${kesimpulan}

━━━━━━━━━━━━━━━━━━━
_Generated by DRD Generator v2.0_`;

  document.getElementById('wa-summary').value = wa;
  AppState.aiSummary.whatsapp = wa;
  Storage.save();
  Utils.toast('WhatsApp Summary berhasil digenerate!', 'success');
}

function copyWhatsApp() {
  const text = document.getElementById('wa-summary').value;
  if (!text) { Utils.toast('Generate summary terlebih dahulu.', 'warning'); return; }
  navigator.clipboard.writeText(text)
    .then(() => Utils.toast('WhatsApp Summary berhasil dicopy!', 'success'))
    .catch(() => Utils.toast('Gagal copy. Silahkan copy manual.', 'danger'));
}

function saveAISummary() {
  AppState.aiSummary.aktivitas  = document.getElementById('ai-aktivitas')?.value  || '';
  AppState.aiSummary.hasil      = document.getElementById('ai-hasil')?.value      || '';
  AppState.aiSummary.kesimpulan = document.getElementById('ai-kesimpulan')?.value || '';
  AppState.aiSummary.insight    = document.getElementById('ai-insight')?.value    || '';
  Storage.save();
  Utils.toast('AI Summary disimpan.', 'success');
}

function restoreAISummary() {
  const ai = AppState.aiSummary;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ai-aktivitas',  ai.aktivitas);
  set('ai-hasil',      ai.hasil);
  set('ai-kesimpulan', ai.kesimpulan);
  set('ai-insight',    ai.insight);
  set('wa-summary',    ai.whatsapp || '');
}

/* ============================================================
   MODULE: REVIEW — Phase 2 extended
============================================================ */
const Review = {
  render() {
    const container = document.getElementById('review-container');
    const kpi = KPI.compute();
    const cfg = AppState.config;
    const ai  = AppState.aiSummary;
    const sjs = AppState.suratJalanList;
    const circuits = AppState.circuitList;
    const asset = AppState.assetData;

    if (sjs.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="bi bi-eye"></i><p>Belum ada data untuk direview.</p></div>`;
      return;
    }

    const row = (label, val) =>
      `<tr><td class="text-muted">${Utils.escHtml(label)}</td><td>${Utils.escHtml(String(val||'—'))}</td></tr>`;

    const sjCards = sjs.map(sj => {
      const photos = AppState.photoMap[sj.id] || [];
      const ba     = AppState.beforeAfterMap[sj.id] || { before:[], after:[] };
      const k      = AppState.kendalaMap[sj.id] || { type: sj.kendala||'', text: sj.kendalaText||'' };
      return `
      <div class="review-section mb-2">
        <div class="review-section-header">
          <i class="bi bi-file-earmark-text text-primary"></i>
          ${Utils.escHtml(sj.nomor)} — ${Utils.escHtml(sj.lokasi)}
        </div>
        <div class="review-section-body">
          <table class="review-table">
            ${row('Tanggal', sj.tanggal)}
            ${row('Mesin', `${sj.mesin||'—'} (${sj.tipe||'—'})`)}
            ${row('Jumlah Mesin', sj.jmlMesin)}
            ${row('Jumlah Powerbank', sj.jmlPB)}
            ${row('Equipment', sj.equipment)}
            ${row('Kendala', k.type || 'Tidak Ada')}
            ${row('Foto Umum', photos.length + ' foto')}
            ${row('Before Photos', ba.before.length + ' foto')}
            ${row('After Photos', ba.after.length + ' foto')}
          </table>
        </div>
      </div>`;
    }).join('');

    // Kendala summary
    const kendalaItems = sjs
      .filter(s => AppState.kendalaMap[s.id]?.type || s.kendala)
      .map(s => {
        const k = AppState.kendalaMap[s.id] || { type: s.kendala||'', text: s.kendalaText||'' };
        return row(s.lokasi, k.type + (k.text?' — '+k.text:''));
      }).join('');

    container.innerHTML = `
    <div class="review-section mb-3">
      <div class="review-section-header"><i class="bi bi-person-circle text-primary"></i>Informasi Teknisi</div>
      <div class="review-section-body"><table class="review-table">
        ${row('Nama Teknisi', cfg.technicianName)}
        ${row('Tanggal Kerja', cfg.workDate)}
        ${row('Target Lokasi', cfg.targetLocations)}
        ${row('Perusahaan', cfg.companyName)}
      </table></div>
    </div>

    <div class="review-section mb-3">
      <div class="review-section-header"><i class="bi bi-bar-chart text-success"></i>KPI Summary</div>
      <div class="review-section-body"><table class="review-table">
        ${row('Total Surat Jalan', kpi.totalSJ)}
        ${row('Total Lokasi', kpi.totalLokasi)}
        ${row('Lokasi Selesai', kpi.lokasiSelesai)}
        ${row('Lokasi Belum Lengkap', kpi.lokasiBelum)}
        ${row('Total Mesin', kpi.totalMesin)}
        ${row('Total Powerbank', kpi.totalPB)}
        ${row('Total Foto', kpi.totalFoto)}
        ${row('Jam Mulai', kpi.startTime)}
        ${row('Jam Selesai', kpi.finishTime)}
        ${row('Durasi Kerja', kpi.duration)}
        ${row('Jarak Tempuh', kpi.distance)}
        ${row('Productivity Score', kpi.productivityScore !== null ? kpi.productivityScore.toFixed(1)+'%' : '—')}
        ${row('Kategori', kpi.productivityCategory)}
      </table></div>
    </div>

    ${asset.pbDibawa > 0 ? `
    <div class="review-section mb-3">
      <div class="review-section-header"><i class="bi bi-box-seam text-info"></i>Asset Tracking</div>
      <div class="review-section-body"><table class="review-table">
        ${row('PB Dibawa', asset.pbDibawa)}
        ${row('PB Terpasang', asset.pbTerpasang)}
        ${row('PB Rusak', asset.pbRusak)}
        ${row('PB Tersisa', asset.pbSisa)}
      </table></div>
    </div>` : ''}

    ${kendalaItems ? `
    <div class="review-section mb-3">
      <div class="review-section-header"><i class="bi bi-exclamation-triangle text-warning"></i>Laporan Kendala</div>
      <div class="review-section-body"><table class="review-table">${kendalaItems}</table></div>
    </div>` : ''}

    <h6 class="fw-bold mb-2 mt-3" style="font-family:var(--font-display)">Detail Surat Jalan</h6>
    ${sjCards}

    ${circuits.length ? `
    <div class="review-section mb-3 mt-3">
      <div class="review-section-header"><i class="bi bi-diagram-3 text-info"></i>Data Circuit</div>
      <div class="review-section-body">
        ${circuits.map(c => `<table class="review-table mb-2">
          ${row('Teknisi', c.teknisi)} ${row('Tanggal', c.tanggal)}
          ${row('Start Time', c.startTime)} ${row('Finish Time', c.finishTime)}
          ${row('Durasi', c.duration)} ${row('Jarak', c.distance)}
        </table>`).join('<hr>')}
      </div>
    </div>` : ''}

    ${ai.aktivitas || ai.hasil || ai.kesimpulan ? `
    <div class="review-section mb-3">
      <div class="review-section-header"><i class="bi bi-stars text-warning"></i>AI Summary</div>
      <div class="review-section-body">
        ${ai.aktivitas  ? `<p><strong>Aktivitas:</strong><br>${Utils.escHtml(ai.aktivitas)}</p>`  : ''}
        ${ai.hasil      ? `<p><strong>Hasil:</strong><br>${Utils.escHtml(ai.hasil)}</p>`          : ''}
        ${ai.kesimpulan ? `<p><strong>Kesimpulan:</strong><br>${Utils.escHtml(ai.kesimpulan)}</p>`: ''}
        ${ai.insight    ? `<p><strong>Insight:</strong><br>${Utils.escHtml(ai.insight)}</p>`      : ''}
      </div>
    </div>` : ''}`;
  },
};

/* ============================================================
   MODULE: PDF EXPORT
============================================================ */
const PDFExport = {
  renderValidation() {
    const container = document.getElementById('validation-items');
    const kpi = KPI.compute();
    const cfg = AppState.config;
    const ai  = AppState.aiSummary;

    const checks = [
      { label: 'Nama Teknisi',    ok: !!cfg.technicianName,         warn: false },
      { label: 'Tanggal Kerja',   ok: !!cfg.workDate,               warn: false },
      { label: 'Surat Jalan',     ok: AppState.suratJalanList.length > 0, warn: false },
      { label: 'Foto Dokumentasi',ok: kpi.totalFoto > 0,            warn: true  },
      { label: 'Data Circuit',    ok: AppState.circuitList.length > 0, warn: true },
      { label: 'AI Aktivitas',    ok: !!ai.aktivitas,               warn: true  },
      { label: 'AI Hasil',        ok: !!ai.hasil,                   warn: true  },
      { label: 'AI Kesimpulan',   ok: !!ai.kesimpulan,              warn: true  },
    ];

    container.innerHTML = checks.map(c => {
      const icon  = c.ok ? 'bi-check-circle-fill val-ok' : (c.warn ? 'bi-exclamation-circle-fill val-warn' : 'bi-x-circle-fill val-error');
      const label = c.ok ? c.label : (c.warn ? `${c.label} (opsional — belum diisi)` : `${c.label} — wajib diisi`);
      return `<div class="validation-item"><i class="bi ${icon} val-icon"></i><span>${Utils.escHtml(label)}</span></div>`;
    }).join('');
  },

  /** Build the full PDF HTML content */
  buildPDFHTML() {
    const kpi = KPI.compute();
    const cfg = AppState.config;
    const ai  = AppState.aiSummary;
    const sjs = AppState.suratJalanList;
    const circuits = AppState.circuitList;
    const includePhotos  = document.getElementById('pdf-include-photos')?.checked;
    const includeCircuit = document.getElementById('pdf-include-circuit')?.checked;
    const includeAI      = document.getElementById('pdf-include-ai')?.checked;
    const titleText      = document.getElementById('pdf-title')?.value || 'Daily Deployment Report';
    const subtitleText   = document.getElementById('pdf-subtitle')?.value || '';

    const dateStr = cfg.workDate
      ? new Date(cfg.workDate).toLocaleDateString('id-ID', {day:'2-digit',month:'long',year:'numeric'})
      : new Date().toLocaleDateString('id-ID', {day:'2-digit',month:'long',year:'numeric'});

    // Category badge color
    const catColors = {
      'Excellent': '#d1f5e0', 'Good': '#d4edda',
      'Fair': '#fff3cd', 'Need Improvement': '#f8d7da',
    };
    const catTextColors = {
      'Excellent': '#0a6b35', 'Good': '#155724',
      'Fair': '#856404', 'Need Improvement': '#842029',
    };
    const prodColor = kpi.productivityScore !== null
      ? (kpi.productivityScore >= 90 ? '#198754' : kpi.productivityScore >= 80 ? '#0D6EFD' : kpi.productivityScore >= 70 ? '#ffc107' : '#dc3545')
      : '#7a8599';

    /* ── PAGE STYLES (inline for PDF) ── */
    const pageStyle = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', Arial, sans-serif; background: white; }
        .pdf-page { width: 794px; padding: 50px; background: white; page-break-after: always; }
        .page-header { border-bottom: 2px solid #0D6EFD; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .page-header-title { font-size: 11px; font-weight: 700; color: #0D6EFD; text-transform: uppercase; letter-spacing: 1px; }
        .page-header-meta { font-size: 10px; color: #7a8599; }
        h1 { font-size: 32px; font-weight: 900; color: #0D6EFD; }
        h2 { font-size: 18px; font-weight: 700; color: #0D6EFD; border-bottom: 2px solid #0D6EFD; padding-bottom: 6px; margin-bottom: 16px; }
        h3 { font-size: 14px; font-weight: 700; color: #1a2236; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td, th { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
        th { background: #f0f2f7; font-weight: 700; color: #1a2236; }
        .td-label { color: #7a8599; width: 35%; white-space: nowrap; }
        p { font-size: 13px; line-height: 1.7; color: #1a2236; white-space: pre-wrap; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .kpi-box { background: #f0f2f7; border-radius: 8px; padding: 14px; text-align: center; }
        .kpi-box-val { font-size: 26px; font-weight: 900; color: #1a2236; }
        .kpi-box-label { font-size: 10px; color: #7a8599; text-transform: uppercase; letter-spacing: 0.5px; }
        .sj-block { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
        .sj-block-header { background: #f0f5ff; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
        .sj-block-body { padding: 14px; }
        .photo-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .photo-item { width: 160px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; }
        .sign-block { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; height: 120px; }
        .sign-label { font-size: 11px; color: #7a8599; }
        .cover-accent { height: 6px; background: linear-gradient(90deg, #0D6EFD, #0dcaf0); border-radius: 3px; margin-bottom: 40px; }
        .cover-score { font-size: 64px; font-weight: 900; color: ${prodColor}; line-height: 1; }
        .cover-cat { font-size: 14px; font-weight: 700; padding: 4px 16px; border-radius: 99px;
                     background: ${catColors[kpi.productivityCategory] || '#f0f2f7'};
                     color: ${catTextColors[kpi.productivityCategory] || '#1a2236'}; display: inline-block; }
        .footer-bar { position: absolute; bottom: 30px; left: 50px; right: 50px; display: flex; justify-content: space-between; font-size: 10px; color: #7a8599; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>`;

    /* Helper: page header */
    const pageHeader = (title) => `
      <div class="page-header">
        <div class="page-header-title">${Utils.escHtml(titleText)} — ${Utils.escHtml(title)}</div>
        <div class="page-header-meta">${Utils.escHtml(cfg.technicianName||'')} | ${dateStr}</div>
      </div>`;

    /* Helper: footer */
    const footer = (page) => `
      <div class="footer-bar">
        <span>${Utils.escHtml(cfg.companyName || 'DRD Generator')}</span>
        <span>Hal. ${page}</span>
        <span>${dateStr}</span>
      </div>`;

    /* ── PAGE 1: COVER ── */
    const page1 = `
    <div class="pdf-page" style="position:relative; display:flex; flex-direction:column; justify-content:center; min-height:1123px;">
      <div class="cover-accent"></div>
      <div style="margin-bottom:8px; font-size:11px; font-weight:700; color:#7a8599; text-transform:uppercase; letter-spacing:2px;">
        ${Utils.escHtml(cfg.companyName || 'Deployment Report')}
      </div>
      <h1 style="margin-bottom:6px">${Utils.escHtml(titleText)}</h1>
      <div style="font-size:16px; color:#7a8599; margin-bottom:32px">${Utils.escHtml(subtitleText)}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:460px; margin-bottom:40px;">
        <div><div style="font-size:10px;color:#7a8599;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Teknisi</div>
             <div style="font-size:16px;font-weight:700">${Utils.escHtml(cfg.technicianName||'—')}</div></div>
        <div><div style="font-size:10px;color:#7a8599;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Tanggal</div>
             <div style="font-size:16px;font-weight:700">${dateStr}</div></div>
      </div>
      ${kpi.productivityScore !== null ? `
      <div style="border:2px solid #e2e8f0; border-radius:12px; padding:24px; max-width:240px;">
        <div style="font-size:10px;color:#7a8599;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Productivity Score</div>
        <div class="cover-score">${kpi.productivityScore.toFixed(0)}%</div>
        <div class="cover-cat" style="margin-top:10px">${Utils.escHtml(kpi.productivityCategory)}</div>
      </div>` : ''}
      ${footer(1)}
    </div>`;

    /* ── PAGE 2: KPI SUMMARY ── */
    const page2 = `
    <div class="pdf-page" style="position:relative">
      ${pageHeader('KPI Summary')}
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-box"><div class="kpi-box-val">${kpi.totalSJ}</div><div class="kpi-box-label">Total Surat Jalan</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${kpi.lokasiSelesai}/${kpi.totalLokasi}</div><div class="kpi-box-label">Lokasi Selesai</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${kpi.totalMesin}</div><div class="kpi-box-label">Total Mesin</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${kpi.totalPB}</div><div class="kpi-box-label">Total Powerbank</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${kpi.totalFoto}</div><div class="kpi-box-label">Total Foto</div></div>
        <div class="kpi-box"><div class="kpi-box-val" style="color:${prodColor}">${kpi.productivityScore !== null ? kpi.productivityScore.toFixed(0)+'%' : '—'}</div><div class="kpi-box-label">Productivity Score</div></div>
      </div>
      <table style="margin-bottom:20px;">
        <tr><td class="td-label">Jam Mulai Kerja</td><td>${Utils.escHtml(kpi.startTime)}</td></tr>
        <tr><td class="td-label">Jam Selesai Kerja</td><td>${Utils.escHtml(kpi.finishTime)}</td></tr>
        <tr><td class="td-label">Total Durasi Kerja</td><td>${Utils.escHtml(kpi.duration)}</td></tr>
        <tr><td class="td-label">Total Jarak Tempuh</td><td>${Utils.escHtml(kpi.distance)}</td></tr>
        <tr><td class="td-label">Lokasi Belum Lengkap</td><td>${kpi.lokasiBelum}</td></tr>
        <tr><td class="td-label">Productivity Category</td><td>${Utils.escHtml(kpi.productivityCategory)}</td></tr>
        <tr><td class="td-label">Sumber Data Waktu</td><td>${Utils.escHtml(kpi.timeSource)}</td></tr>
      </table>
      ${footer(2)}
    </div>`;

    /* ── PAGE 3–6: AI SECTIONS ── */
    const aiPages = includeAI ? ['aktivitas','hasil','kesimpulan','insight'].filter(s => ai[s]).map((section, i) => {
      const titles = { aktivitas:'Aktivitas', hasil:'Hasil', kesimpulan:'Kesimpulan', insight:'AI Insight & Rekomendasi' };
      return `
      <div class="pdf-page" style="position:relative">
        ${pageHeader(titles[section])}
        <h2>${titles[section]}</h2>
        <p>${Utils.escHtml(ai[section])}</p>
        ${footer(3 + i)}
      </div>`;
    }).join('') : '';

    /* ── SJ DETAIL PAGES ── */
    const includeBeforeAfter = document.getElementById('pdf-include-before-after')?.checked;
    const includeKendala     = document.getElementById('pdf-include-kendala')?.checked;
    const includeAsset       = document.getElementById('pdf-include-asset')?.checked;

    const sjPages = sjs.map((sj, i) => {
      const photos = AppState.photoMap[sj.id] || [];
      const ba     = AppState.beforeAfterMap[sj.id] || { before:[], after:[] };
      const k      = AppState.kendalaMap[sj.id] || { type: sj.kendala||'', text: sj.kendalaText||'' };

      const photosHtml = includePhotos && photos.length
        ? `<div style="margin-top:14px"><strong style="font-size:12px">Dokumentasi Umum (${photos.length} foto)</strong>
           <div class="photo-row">${photos.map(p => `<img class="photo-item" src="${p.dataUrl}" alt="foto" />`).join('')}</div></div>`
        : '';

      const baHtml = includeBeforeAfter && (ba.before.length || ba.after.length)
        ? `<div style="margin-top:14px"><strong style="font-size:12px">Before &amp; After</strong>
           <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
             <div>
               <div style="font-size:10px;font-weight:700;color:#198754;text-transform:uppercase;margin-bottom:6px">BEFORE (${ba.before.length} foto)</div>
               <div class="photo-row">${ba.before.map(p=>`<img class="photo-item" src="${p.dataUrl}" alt="before" />`).join('')}</div>
             </div>
             <div>
               <div style="font-size:10px;font-weight:700;color:#0D6EFD;text-transform:uppercase;margin-bottom:6px">AFTER (${ba.after.length} foto)</div>
               <div class="photo-row">${ba.after.map(p=>`<img class="photo-item" src="${p.dataUrl}" alt="after" />`).join('')}</div>
             </div>
           </div></div>`
        : '';

      return `
      <div class="pdf-page" style="position:relative">
        ${pageHeader(`Detail SJ #${i+1}`)}
        <div class="sj-block">
          <div class="sj-block-header">
            <strong>${Utils.escHtml(sj.nomor)}</strong> — ${Utils.escHtml(sj.lokasi)}
          </div>
          <div class="sj-block-body">
            <table>
              <tr><td class="td-label">Tanggal</td><td>${Utils.escHtml(sj.tanggal||'—')}</td></tr>
              <tr><td class="td-label">Nama Mesin</td><td>${Utils.escHtml(sj.mesin||'—')}</td></tr>
              <tr><td class="td-label">Tipe Mesin</td><td>${Utils.escHtml(sj.tipe||'—')}</td></tr>
              <tr><td class="td-label">Jumlah Mesin</td><td>${sj.jmlMesin}</td></tr>
              <tr><td class="td-label">Jumlah Powerbank</td><td>${sj.jmlPB}</td></tr>
              <tr><td class="td-label">Equipment</td><td>${Utils.escHtml(sj.equipment||'—')}</td></tr>
              <tr><td class="td-label">Kendala</td><td style="color:${k.type?'#856404':'#155724'}">${Utils.escHtml(k.type||'Tidak Ada')}${k.text?' — '+Utils.escHtml(k.text):''}</td></tr>
            </table>
            ${photosHtml}${baHtml}
          </div>
        </div>
        ${footer(7 + i)}
      </div>`;
    }).join('');

    /* ── KENDALA PAGE ── */
    const kendalaItems = sjs.filter(s => AppState.kendalaMap[s.id]?.type || s.kendala);
    const kendalaPage = includeKendala && kendalaItems.length ? `
    <div class="pdf-page" style="position:relative">
      ${pageHeader('Laporan Kendala')}
      <h2>Laporan Kendala</h2>
      <table>
        <thead><tr><th>Lokasi / SJ</th><th>Jenis Kendala</th><th>Detail</th></tr></thead>
        <tbody>
          ${kendalaItems.map(s => {
            const k = AppState.kendalaMap[s.id] || { type: s.kendala||'', text: s.kendalaText||'' };
            return `<tr>
              <td><strong>${Utils.escHtml(s.nomor)}</strong><br><small>${Utils.escHtml(s.lokasi)}</small></td>
              <td style="color:#856404;font-weight:600">${Utils.escHtml(k.type)}</td>
              <td>${Utils.escHtml(k.text||'—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${footer(7 + sjs.length + circuits.length + 1)}
    </div>` : '';

    /* ── ASSET SUMMARY PAGE ── */
    const assetData = AppState.assetData;
    const assetPage = includeAsset && assetData.pbDibawa > 0 ? `
    <div class="pdf-page" style="position:relative">
      ${pageHeader('Asset Summary')}
      <h2>Asset Summary</h2>
      <div class="kpi-grid" style="margin-bottom:20px">
        <div class="kpi-box"><div class="kpi-box-val">${assetData.pbDibawa}</div><div class="kpi-box-label">PB Dibawa</div></div>
        <div class="kpi-box"><div class="kpi-box-val" style="color:#198754">${assetData.pbTerpasang}</div><div class="kpi-box-label">PB Terpasang</div></div>
        <div class="kpi-box"><div class="kpi-box-val" style="color:#dc3545">${assetData.pbRusak}</div><div class="kpi-box-label">PB Rusak</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${assetData.pbSisa}</div><div class="kpi-box-label">PB Tersisa</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${kpi.totalMesin}</div><div class="kpi-box-label">Total Mesin</div></div>
        <div class="kpi-box"><div class="kpi-box-val">${kpi.totalPB}</div><div class="kpi-box-label">Total PB (dari SJ)</div></div>
      </div>
      <h3>Detail Mesin per Lokasi</h3>
      <table>
        <thead><tr><th>Nomor SJ</th><th>Lokasi</th><th>Mesin</th><th>Tipe</th><th>Jml Mesin</th><th>Jml PB</th></tr></thead>
        <tbody>
          ${sjs.map(s => `<tr>
            <td>${Utils.escHtml(s.nomor)}</td>
            <td>${Utils.escHtml(s.lokasi)}</td>
            <td>${Utils.escHtml(s.mesin||'—')}</td>
            <td>${Utils.escHtml(s.tipe||'—')}</td>
            <td style="text-align:center">${s.jmlMesin}</td>
            <td style="text-align:center">${s.jmlPB}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${footer(7 + sjs.length + circuits.length + 2)}
    </div>` : '';

    /* ── CIRCUIT PAGE ── */
    const circuitPage = includeCircuit && circuits.length ? circuits.map((c, i) => `
      <div class="pdf-page" style="position:relative">
        ${pageHeader('Data Circuit')}
        <h2>Data Circuit — ${Utils.escHtml(c.teknisi || 'Teknisi')}</h2>
        <table style="margin-bottom:16px">
          <tr><td class="td-label">Nama Teknisi</td><td>${Utils.escHtml(c.teknisi||'—')}</td></tr>
          <tr><td class="td-label">Tanggal</td><td>${Utils.escHtml(c.tanggal||'—')}</td></tr>
          <tr><td class="td-label">Start Time</td><td>${Utils.escHtml(c.startTime||'—')}</td></tr>
          <tr><td class="td-label">Finish Time</td><td>${Utils.escHtml(c.finishTime||'—')}</td></tr>
          <tr><td class="td-label">Total Duration</td><td>${Utils.escHtml(c.duration||'—')}</td></tr>
          <tr><td class="td-label">Total Distance</td><td>${Utils.escHtml(c.distance||'—')}</td></tr>
        </table>
        ${c.tableRows?.length ? `
        <h3>Tabel Circuit</h3>
        <table>
          <tbody>
            ${c.tableRows.map(row => `<tr><td>${Utils.escHtml(row)}</td></tr>`).join('')}
          </tbody>
        </table>` : ''}
        ${footer(7 + sjs.length + i)}
      </div>`).join('') : '';

    /* ── OPERATIONAL RECAP ── */
    const totalPages = 7 + sjs.length + circuits.length;
    const recapPage = `
    <div class="pdf-page" style="position:relative">
      ${pageHeader('Rekap Operasional')}
      <h2>Rekap Operasional</h2>
      <table style="margin-bottom:20px">
        <tr><td class="td-label">Total Surat Jalan</td><td>${kpi.totalSJ}</td></tr>
        <tr><td class="td-label">Total Lokasi</td><td>${kpi.totalLokasi}</td></tr>
        <tr><td class="td-label">Lokasi Selesai</td><td>${kpi.lokasiSelesai}</td></tr>
        <tr><td class="td-label">Total Mesin</td><td>${kpi.totalMesin}</td></tr>
        <tr><td class="td-label">Total Powerbank</td><td>${kpi.totalPB}</td></tr>
        <tr><td class="td-label">Total Foto</td><td>${kpi.totalFoto}</td></tr>
        <tr><td class="td-label">Total Jarak Tempuh</td><td>${Utils.escHtml(kpi.distance)}</td></tr>
        <tr><td class="td-label">Total Working Hours</td><td>${Utils.escHtml(kpi.duration)}</td></tr>
      </table>
      ${footer(totalPages - 1)}
    </div>`;

    /* ── SIGNATURE PAGE ── */
    const signPage = `
    <div class="pdf-page" style="position:relative">
      ${pageHeader('Tanda Tangan')}
      <h2>Halaman Tanda Tangan</h2>
      <p style="margin-bottom:32px; color:#7a8599; font-size:12px">
        Laporan ini disusun berdasarkan data deployment yang tercatat pada tanggal ${dateStr}.
      </p>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px;">
        <div>
          <div style="font-size:12px; font-weight:700; margin-bottom:8px">Disiapkan Oleh:</div>
          <div class="sign-block"></div>
          <div style="margin-top:8px">
            <div style="border-bottom:1px solid #1a2236; padding-bottom:2px; margin-bottom:4px; font-size:12px">${Utils.escHtml(cfg.technicianName||'_________________')}</div>
            <div style="font-size:10px; color:#7a8599">Nama Teknisi</div>
            <div style="font-size:10px; color:#7a8599; margin-top:4px">${dateStr}</div>
          </div>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; margin-bottom:8px">Diperiksa Oleh:</div>
          <div class="sign-block"></div>
          <div style="margin-top:8px">
            <div style="border-bottom:1px solid #1a2236; padding-bottom:2px; margin-bottom:4px; font-size:12px">_________________</div>
            <div style="font-size:10px; color:#7a8599">Supervisor</div>
          </div>
        </div>
        <div>
          <div style="font-size:12px; font-weight:700; margin-bottom:8px">Diketahui Oleh:</div>
          <div class="sign-block"></div>
          <div style="margin-top:8px">
            <div style="border-bottom:1px solid #1a2236; padding-bottom:2px; margin-bottom:4px; font-size:12px">_________________</div>
            <div style="font-size:10px; color:#7a8599">Manager</div>
          </div>
        </div>
      </div>
      ${footer(totalPages)}
    </div>`;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&display=swap" rel="stylesheet">
      ${pageStyle}
    </head><body>
      ${page1}${page2}${aiPages}${sjPages}${circuitPage}${kendalaPage}${assetPage}${recapPage}${signPage}
    </body></html>`;
  },
};

async function exportPDF(btnEl) {
  const btn = btnEl || event?.target;
  if (!btn) return;
  const origText = btn.innerHTML;

  // Validate required fields
  if (AppState.suratJalanList.length === 0) {
    Utils.toast('Tambahkan minimal 1 Surat Jalan terlebih dahulu!', 'danger');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating PDF...';

  try {
    const html = PDFExport.buildPDFHTML();

    // Create hidden iframe to render PDF HTML
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;z-index:-1';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();

    await new Promise(r => setTimeout(r, 1500)); // Wait for fonts/images

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pages = iframe.contentDocument.querySelectorAll('.pdf-page');
    let isFirst = true;

    for (const page of pages) {
      const canvas = await html2canvas(page, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdfW = 210;
      const pdfH = (canvas.height * pdfW) / canvas.width;

      if (!isFirst) doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
      isFirst = false;
    }

    // Generate filename
    const cfg = AppState.config;
    const dateStr = cfg.workDate
      ? cfg.workDate.replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const name = Utils.sanitizeFilename(cfg.technicianName || 'Teknisi');
    doc.save(`DRD_${name}_${dateStr}.pdf`);

    iframe.remove();
    Utils.toast('PDF berhasil didownload!', 'success');
  } catch (err) {
    console.error(err);
    Utils.toast(`Gagal generate PDF: ${err.message}`, 'danger', 5000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

async function previewPDF() {
  if (AppState.suratJalanList.length === 0) {
    Utils.toast('Tambahkan minimal 1 Surat Jalan terlebih dahulu!', 'danger');
    return;
  }

  const wrapper  = document.getElementById('pdf-preview-wrapper');
  const content  = document.getElementById('pdf-preview-content');
  const html = PDFExport.buildPDFHTML();

  // Render inline preview
  content.innerHTML = `<iframe style="width:100%;height:800px;border:none;border-radius:0 0 12px 12px"
    srcdoc="${html.replace(/"/g, '&quot;')}"></iframe>`;
  wrapper.style.display = 'block';
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   MODULE: GPS ROUTE MAP — Phase 2
============================================================ */
const GPSMap = {
  _map: null,
  _markers: [],
  _polyline: null,

  init() {
    this._renderLocationInputs();
    this._restorePoints();
    if (!this._map) {
      this._map = L.map('leaflet-map').setView([-6.2, 106.816], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(this._map);
    }
    this.renderMap();
  },

  _renderLocationInputs() {
    const list = document.getElementById('gps-locations-list');
    if (!list) return;
    const sjs = AppState.suratJalanList;
    if (!sjs.length) {
      list.innerHTML = '<div class="p-3 text-muted" style="font-size:13px">Upload Surat Jalan terlebih dahulu.</div>';
      return;
    }
    list.innerHTML = `
      <table class="table table-sm mb-0" style="font-size:13px">
        <thead><tr><th style="width:40%">Lokasi</th><th>Latitude</th><th>Longitude</th></tr></thead>
        <tbody>
          ${sjs.map(sj => {
            const coord = AppState.gpsData.locationCoords[sj.id] || {};
            return `<tr>
              <td><div class="fw-semibold" style="font-size:12px">${Utils.escHtml(sj.nomor)}</div>
                  <div class="text-muted" style="font-size:11px">${Utils.escHtml(sj.lokasi)}</div></td>
              <td><input type="number" class="form-control form-control-sm" step="any"
                         id="gps-lat-${sj.id}" value="${coord.lat||''}" placeholder="-6.xxx"
                         oninput="GPSMap.saveCoord('${sj.id}')" /></td>
              <td><input type="number" class="form-control form-control-sm" step="any"
                         id="gps-lng-${sj.id}" value="${coord.lng||''}" placeholder="106.xxx"
                         oninput="GPSMap.saveCoord('${sj.id}')" /></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  },

  saveCoord(sjId) {
    const lat = parseFloat(document.getElementById(`gps-lat-${sjId}`)?.value);
    const lng = parseFloat(document.getElementById(`gps-lng-${sjId}`)?.value);
    if (!AppState.gpsData.locationCoords) AppState.gpsData.locationCoords = {};
    AppState.gpsData.locationCoords[sjId] = { lat: isNaN(lat)?'':lat, lng: isNaN(lng)?'':lng };
    Storage.save();
  },

  savePoints() {
    AppState.gpsData.startLat   = document.getElementById('gps-start-lat')?.value || '';
    AppState.gpsData.startLng   = document.getElementById('gps-start-lng')?.value || '';
    AppState.gpsData.startLabel = document.getElementById('gps-start-label')?.value || '';
    AppState.gpsData.finishLat  = document.getElementById('gps-finish-lat')?.value || '';
    AppState.gpsData.finishLng  = document.getElementById('gps-finish-lng')?.value || '';
    AppState.gpsData.finishLabel= document.getElementById('gps-finish-label')?.value || '';
    Storage.save();
  },

  _restorePoints() {
    const g = AppState.gpsData;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val||''; };
    set('gps-start-lat',    g.startLat);
    set('gps-start-lng',    g.startLng);
    set('gps-start-label',  g.startLabel);
    set('gps-finish-lat',   g.finishLat);
    set('gps-finish-lng',   g.finishLng);
    set('gps-finish-label', g.finishLabel);
  },

  async geocodeAll() {
    const sjs = AppState.suratJalanList;
    if (!sjs.length) { Utils.toast('Tidak ada Surat Jalan untuk di-geocode.', 'warning'); return; }
    Utils.toast('Geocoding lokasi... harap tunggu.', 'info');
    let success = 0;
    for (const sj of sjs) {
      const existing = AppState.gpsData.locationCoords[sj.id];
      if (existing?.lat && existing?.lng) continue; // skip if already set
      try {
        const q = encodeURIComponent(sj.lokasi + ', Indonesia');
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
        const data = await res.json();
        if (data?.[0]) {
          if (!AppState.gpsData.locationCoords) AppState.gpsData.locationCoords = {};
          AppState.gpsData.locationCoords[sj.id] = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          success++;
        }
        await new Promise(r => setTimeout(r, 300)); // rate limit
      } catch (e) { console.warn('Geocode failed for:', sj.lokasi); }
    }
    Storage.save();
    this._renderLocationInputs();
    this.renderMap();
    Utils.toast(`Geocoding selesai: ${success} lokasi berhasil.`, 'success');
  },

  renderMap() {
    if (!this._map) return;
    const g = AppState.gpsData;

    // Clear old markers and polyline
    this._markers.forEach(m => this._map.removeLayer(m));
    this._markers = [];
    if (this._polyline) { this._map.removeLayer(this._polyline); this._polyline = null; }

    const points = [];

    // Icon factory
    const icon = (color, label) => L.divIcon({
      className: '',
      html: `<div style="background:${color};color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    // Start point
    const sLat = parseFloat(g.startLat), sLng = parseFloat(g.startLng);
    if (!isNaN(sLat) && !isNaN(sLng)) {
      const m = L.marker([sLat, sLng], { icon: icon('#198754','S') })
        .addTo(this._map)
        .bindPopup(`<strong>${Utils.escHtml(g.startLabel||'Start')}</strong><br>Start Point`);
      this._markers.push(m);
      points.push([sLat, sLng]);
    }

    // Deployment locations
    const sjs = AppState.suratJalanList;
    sjs.forEach((sj, i) => {
      const coord = g.locationCoords?.[sj.id];
      if (!coord?.lat || !coord?.lng) return;
      const lat = parseFloat(coord.lat), lng = parseFloat(coord.lng);
      if (isNaN(lat) || isNaN(lng)) return;
      const hasPhotos = (AppState.photoMap[sj.id]?.length||0) > 0;
      const m = L.marker([lat, lng], { icon: icon(hasPhotos ? '#0D6EFD' : '#6c757d', i+1) })
        .addTo(this._map)
        .bindPopup(`<strong>${Utils.escHtml(sj.nomor)}</strong><br>${Utils.escHtml(sj.lokasi)}<br>
          <small>Mesin: ${sj.jmlMesin} | PB: ${sj.jmlPB}</small>`);
      this._markers.push(m);
      points.push([lat, lng]);
    });

    // Finish point
    const fLat = parseFloat(g.finishLat), fLng = parseFloat(g.finishLng);
    if (!isNaN(fLat) && !isNaN(fLng)) {
      const m = L.marker([fLat, fLng], { icon: icon('#dc3545','F') })
        .addTo(this._map)
        .bindPopup(`<strong>${Utils.escHtml(g.finishLabel||'Finish')}</strong><br>Finish Point`);
      this._markers.push(m);
      points.push([fLat, fLng]);
    }

    if (points.length > 1) {
      this._polyline = L.polyline(points, { color: '#0D6EFD', weight: 3, dashArray: '6 4', opacity: 0.8 }).addTo(this._map);
      this._map.fitBounds(this._polyline.getBounds(), { padding: [40, 40] });
    } else if (points.length === 1) {
      this._map.setView(points[0], 13);
    }

    // Update stats
    const statsRow = document.getElementById('gps-stats-row');
    if (statsRow) statsRow.style.removeProperty('display');
    const stops = sjs.filter(s => { const c=g.locationCoords?.[s.id]; return c?.lat && c?.lng; }).length;
    const dist  = this._estimateDistance(points);
    const coverage = sjs.length > 0 ? Math.round((stops / sjs.length) * 100) : 0;
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('gps-stat-stops', stops);
    setEl('gps-stat-dist', dist > 0 ? dist.toFixed(1) + ' km' : '—');
    setEl('gps-stat-coverage', coverage + '%');

    if (points.length > 0) Utils.toast('Peta berhasil diperbarui.', 'success');
  },

  _estimateDistance(points) {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const [lat1, lon1] = points[i-1];
      const [lat2, lon2] = points[i];
      const R = 6371;
      const dLat = (lat2-lat1) * Math.PI/180;
      const dLon = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return total;
  },
};

/* ============================================================
   MODULE: ASSET TRACKING — Phase 2
============================================================ */
const AssetTracking = {
  render() {
    this._restoreInputs();
    this._renderMesinTable();
    this._renderKondisiList();
    this.computePB();
  },

  _restoreInputs() {
    const a = AppState.assetData;
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val||0; };
    set('asset-pb-dibawa',          a.pbDibawa);
    set('asset-pb-input-terpasang', a.pbTerpasang);
    set('asset-pb-input-rusak',     a.pbRusak);
    set('asset-pb-sisa-input',      a.pbSisa);
  },

  computePB() {
    const dibawa    = parseInt(document.getElementById('asset-pb-dibawa')?.value)          || 0;
    const terpasang = parseInt(document.getElementById('asset-pb-input-terpasang')?.value) || 0;
    const rusak     = parseInt(document.getElementById('asset-pb-input-rusak')?.value)     || 0;
    const sisa      = Math.max(0, dibawa - terpasang - rusak);

    const siEl = document.getElementById('asset-pb-sisa-input');
    if (siEl) siEl.value = sisa;

    AppState.assetData = { ...AppState.assetData, pbDibawa: dibawa, pbTerpasang: terpasang, pbRusak: rusak, pbSisa: sisa };
    Storage.save();

    // Update summary cards
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const kpi = KPI.compute();
    setEl('asset-total-mesin',   kpi.totalMesin);
    setEl('asset-pb-terpasang',  terpasang);
    setEl('asset-pb-rusak',      rusak);
    setEl('asset-pb-sisa',       sisa);
  },

  _renderMesinTable() {
    const container = document.getElementById('asset-mesin-table');
    if (!container) return;
    const sjs = AppState.suratJalanList;
    if (!sjs.length) {
      container.innerHTML = '<div class="text-muted" style="font-size:13px">Upload Surat Jalan untuk melihat daftar mesin.</div>';
      return;
    }
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm table-hover mb-0" style="font-size:13px">
          <thead class="table-light">
            <tr><th>SJ / Lokasi</th><th>Nama Mesin</th><th>Tipe</th><th class="text-center">Jml Mesin</th><th class="text-center">Jml PB</th></tr>
          </thead>
          <tbody>
            ${sjs.map(s => `
              <tr>
                <td><div class="fw-semibold" style="font-size:12px">${Utils.escHtml(s.nomor)}</div>
                    <div class="text-muted" style="font-size:11px">${Utils.escHtml(s.lokasi)}</div></td>
                <td>${Utils.escHtml(s.mesin||'—')}</td>
                <td><span class="badge bg-light text-dark border">${Utils.escHtml(s.tipe||'—')}</span></td>
                <td class="text-center fw-bold">${s.jmlMesin}</td>
                <td class="text-center fw-bold">${s.jmlPB}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot class="table-light">
            <tr>
              <td colspan="3" class="fw-bold">TOTAL</td>
              <td class="text-center fw-bold text-primary">${sjs.reduce((a,s)=>a+(s.jmlMesin||0),0)}</td>
              <td class="text-center fw-bold text-primary">${sjs.reduce((a,s)=>a+(s.jmlPB||0),0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  },

  _renderKondisiList() {
    const container = document.getElementById('asset-kondisi-list');
    if (!container) return;
    const sjs = AppState.suratJalanList;
    if (!sjs.length) {
      container.innerHTML = '<div class="text-muted" style="font-size:13px">Data kondisi akan muncul setelah Surat Jalan diupload.</div>';
      return;
    }
    const kondisiMap = AppState.assetData.kondisiMap || {};
    container.innerHTML = sjs.map(s => {
      const k = kondisiMap[s.id] || { kondisi:'Baik', catatan:'' };
      return `
      <div class="d-flex align-items-center gap-3 py-2 border-bottom flex-wrap">
        <div style="flex:1;min-width:160px">
          <div class="fw-semibold" style="font-size:13px">${Utils.escHtml(s.nomor)}</div>
          <div class="text-muted" style="font-size:11px">${Utils.escHtml(s.lokasi)}</div>
        </div>
        <select class="form-select form-select-sm" style="width:140px"
                onchange="AssetTracking.saveKondisi('${s.id}',this.value,null)">
          <option ${k.kondisi==='Baik'?'selected':''}>Baik</option>
          <option ${k.kondisi==='Bermasalah'?'selected':''}>Bermasalah</option>
          <option ${k.kondisi==='Rusak'?'selected':''}>Rusak</option>
        </select>
        <input type="text" class="form-control form-control-sm" style="flex:1;min-width:180px"
               placeholder="Catatan kondisi..." value="${Utils.escHtml(k.catatan)}"
               oninput="AssetTracking.saveKondisi('${s.id}',null,this.value)" />
        <span class="badge ${k.kondisi==='Baik'?'bg-success':k.kondisi==='Bermasalah'?'bg-warning text-dark':'bg-danger'}">${k.kondisi}</span>
      </div>`;
    }).join('');
  },

  saveKondisi(sjId, kondisi, catatan) {
    if (!AppState.assetData.kondisiMap) AppState.assetData.kondisiMap = {};
    const existing = AppState.assetData.kondisiMap[sjId] || { kondisi:'Baik', catatan:'' };
    AppState.assetData.kondisiMap[sjId] = {
      kondisi: kondisi ?? existing.kondisi,
      catatan: catatan ?? existing.catatan,
    };
    Storage.save();
  },
};

/* ============================================================
   MODULE: INIT — Phase 1 & 2
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Storage.load();
  restoreConfig();
  SuratJalan.renderAll();
  Circuit.renderAll();
  Dashboard.updateStats();

  if (!AppState.config.workDate) {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('workDate').value = today;
    AppState.config.workDate = today;
  }

  navigateTo('dashboard');
  console.log('[DRD Generator] Initialized — Phase 1 & 2 v2.0.0');
});
