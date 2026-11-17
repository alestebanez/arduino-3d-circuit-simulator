(function (global) {
  'use strict';

  var NS = global.HardwareSim = global.HardwareSim || {};

  var WIRE_COLORS = [
    { hex: '#D93025', name: 'Rojo' },
    { hex: '#26292E', name: 'Negro' },
    { hex: '#E09F00', name: 'Amarillo' },
    { hex: '#1E8E3E', name: 'Verde' },
    { hex: '#1A73E8', name: 'Azul' },
    { hex: '#E8710A', name: 'Naranja' }
  ];

  var LED_COLOR_OPTIONS_FALLBACK = [
    { id: 'red', name: 'Rojo', hex: '#EF4444' },
    { id: 'green', name: 'Verde', hex: '#22C55E' },
    { id: 'yellow', name: 'Amarillo', hex: '#EAB308' },
    { id: 'blue', name: 'Azul', hex: '#3B82F6' },
    { id: 'white', name: 'Blanco', hex: '#F8FAFC' }
  ];

  function getLedColorOptions() {
    var ds = NS.Datasheets;
    if (ds && ds.LED_COLORS) {
      return ['red', 'green', 'yellow', 'blue', 'white'].map(function (key) {
        var entry = ds.LED_COLORS[key];
        return entry ? { id: entry.id || key, name: entry.name || key, hex: entry.hex || '#EF4444' } : null;
      }).filter(Boolean);
    }
    return LED_COLOR_OPTIONS_FALLBACK;
  }

  var RESISTOR_VALUES = [
    { ohms: 100, label: '100 Ω' },
    { ohms: 220, label: '220 Ω' },
    { ohms: 330, label: '330 Ω' },
    { ohms: 1000, label: '1 kΩ' },
    { ohms: 4700, label: '4.7 kΩ' },
    { ohms: 10000, label: '10 kΩ' }
  ];

  var FOOTPRINTS = {
    arduino_uno_r3: { hw: 40, hd: 32 },
    breadboard_830: { hw: 88, hd: 32 },
    lcd_1602: { hw: 45, hd: 22 },
    ultrasonic_hcsr04: { hw: 26, hd: 16 },
    servo_sg90: { hw: 22, hd: 16 },
    potentiometer: { hw: 16, hd: 16 },
    pushbutton: { hw: 14, hd: 14 },
    led: { hw: 12, hd: 12 },
    resistor: { hw: 15, hd: 10 },
    ldr: { hw: 12, hd: 12 },
    tmp36: { hw: 12, hd: 12 },
    buzzer: { hw: 14, hd: 14 }
  };

  var state = {
    activeWireColor: WIRE_COLORS[0].hex,
    activeView: 'iso',
    contextTarget: null,      // { kind: 'component'|'wire', id: string }
    datasheetType: null,
    datasheetTab: 'all',
    lastSerialCount: -1,
    lastTelemetryTick: 0,
    lastHudTick: 0,
    lastClockText: '',
    lastRunningState: null,
    toastTimer: null,
    rafId: null,
    lastFrameMs: 0
  };

  var dom = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatSimClock(ms) {
    var val = Math.max(0, Number(ms) || 0);
    if (val < 10000) {
      return Math.round(val) + ' ms';
    }
    return (val / 1000).toFixed(2) + ' s';
  }

  function formatVoltage(v) {
    if (v == null || isNaN(v)) {
      return 'Flotante';
    }
    return Number(v).toFixed(2) + ' V';
  }

  function getWireColorName(hex) {
    if (!hex) return 'Personalizado';
    var upper = String(hex).toUpperCase();
    for (var i = 0; i < WIRE_COLORS.length; i++) {
      if (WIRE_COLORS[i].hex.toUpperCase() === upper) {
        return WIRE_COLORS[i].name;
      }
    }
    var extraNames = {
      '#EF4444': 'Rojo',
      '#1F2937': 'Negro',
      '#EAB308': 'Amarillo',
      '#22C55E': 'Verde',
      '#3B82F6': 'Azul',
      '#F59E0B': 'Naranja',
      '#8B5CF6': 'Violeta'
    };
    return extraNames[upper] || upper;
  }

  function showToast(msg, durationMs) {
    if (!dom.toastBanner) return;
    dom.toastBanner.textContent = msg;
    dom.toastBanner.classList.remove('hidden');
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    state.toastTimer = setTimeout(function () {
      dom.toastBanner.classList.add('hidden');
      state.toastTimer = null;
    }, durationMs || 2400);
  }

  function cacheDom() {
    dom.sidebar = $('catalog-sidebar');
    dom.btnToggleSidebar = $('btn-toggle-sidebar');
    dom.catalogCount = $('catalog-count');
    dom.catalogSearch = $('catalog-search');
    dom.catalogList = $('catalog-list');

    dom.simStatusPill = $('sim-status-pill');
    dom.simStatusText = $('sim-status-text');
    dom.simClock = $('sim-clock');
    dom.btnPlayPause = $('btn-play-pause');
    dom.playPauseIcon = $('play-pause-icon');
    dom.playPauseLabel = $('play-pause-label');
    dom.btnReset = $('btn-reset');
    dom.btnMockup = $('btn-mockup');
    dom.btnClear = $('btn-clear');

    dom.wireColorPicker = $('wire-color-picker');
    dom.btnViewIso = $('btn-view-iso');
    dom.btnViewTop = $('btn-view-top');
    dom.btnViewCenter = $('btn-view-center');
    dom.btnOpenIde = $('btn-open-ide');

    dom.canvas = $('scene-canvas');
    dom.wiringBanner = $('wiring-banner');
    dom.wiringSwatch = $('wiring-swatch');
    dom.wiringText = $('wiring-text');
    dom.btnCancelWire = $('btn-cancel-wire');
    dom.toastBanner = $('toast-banner');

    dom.btnZoomIn = $('btn-zoom-in');
    dom.btnZoomOut = $('btn-zoom-out');

    dom.pinTooltip = $('pin-tooltip');
    dom.ttCompName = $('tt-comp-name');
    dom.ttVoltage = $('tt-voltage');
    dom.ttPinId = $('tt-pin-id');
    dom.ttPinDesc = $('tt-pin-desc');
    dom.ttHint = $('tt-hint');

    dom.contextMenu = $('context-menu');

    dom.datasheetModal = $('datasheet-modal');
    dom.dsCategoryBadge = $('ds-category-badge');
    dom.dsProgrammableBadge = $('ds-programmable-badge');
    dom.dsPackageBadge = $('ds-package-badge');
    dom.dsTitle = $('ds-title');
    dom.dsSubtitle = $('ds-subtitle');
    dom.dsOpenIdeBtn = $('ds-open-ide-btn');
    dom.btnCloseDatasheet = $('btn-close-datasheet');
    dom.dsBody = $('ds-body');

    dom.ideDrawer = $('ide-drawer');
    dom.ideSketchBadge = $('ide-sketch-badge');
    dom.btnToggleSound = $('btn-toggle-sound');
    dom.soundIcon = $('sound-icon');
    dom.soundLabel = $('sound-label');
    dom.btnCloseIde = $('btn-close-ide');
    dom.idePresetSelect = $('ide-preset-select');
    dom.btnLoadPreset = $('btn-load-preset');
    dom.btnCompileUpload = $('btn-compile-upload');
    dom.ideLineNumbers = $('ide-line-numbers');
    dom.ideEditor = $('ide-editor');
    dom.ideStatusBar = $('ide-status-bar');
    dom.ideStatusMessage = $('ide-status-message');
    dom.ideMemoryStats = $('ide-memory-stats');
    dom.serialCount = $('serial-count');
    dom.chkSerialAutoscroll = $('chk-serial-autoscroll');
    dom.btnClearSerial = $('btn-clear-serial');
    dom.serialOutput = $('serial-output');
  }

  /* ========================================================================
     Iconos SVG limpios por tipo de componente
     ======================================================================== */

  function getComponentSvgIcon(type) {
    switch (type) {
      case 'arduino_uno_r3':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="7" y="9" width="10" height="6" rx="1"/><path d="M7 5V3M11 5V3M15 5V3M7 19v2M11 19v2M15 19v2"/></svg>';
      case 'breadboard_830':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="1.5"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 15h.01M10 15h.01M14 15h.01M18 15h.01"/></svg>';
      case 'led':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 15V10a3 3 0 0 1 6 0v5"/><path d="M7 15h10"/><path d="M10 15v5M14 15v6"/></svg>';
      case 'resistor':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12h4l1.5-4 3 8 3-8 3 8L18 12h4"/></svg>';
      case 'wire':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17C8 7 16 7 20 17"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="17" r="2"/></svg>';
      case 'pushbutton':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="7" width="14" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>';
      case 'potentiometer':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="11" r="6.5"/><line x1="12" y1="11" x2="15.5" y2="7.5"/><path d="M8 18v3M12 18v3M16 18v3"/></svg>';
      case 'servo_sg90':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="8" width="16" height="11" rx="2"/><circle cx="15" cy="12" r="2"/><path d="M15 10l4-4"/></svg>';
      case 'ultrasonic_hcsr04':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="11" rx="2"/><circle cx="8" cy="11.5" r="3"/><circle cx="16" cy="11.5" r="3"/></svg>';
      case 'lcd_1602':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="8" width="14" height="8" rx="1"/></svg>';
      case 'ldr':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="11" r="5"/><path d="M9 11h6M10 16v5M14 16v5M4 4l3 3M2 8h3"/></svg>';
      case 'tmp36':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 13V8a5 5 0 0 1 10 0v5H7z"/><path d="M9 13v8M12 13v8M15 13v8"/></svg>';
      case 'buzzer':
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>';
      default:
        return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
    }
  }

  /* ========================================================================
     Catálogo Lateral & Colocación en Hueco Libre
     ======================================================================== */

  function getCatalogItems() {
    var ds = NS.Datasheets;
    if (!ds) return [];
    if (typeof ds.list === 'function') {
      return ds.list();
    }
    if (ds.ITEMS) {
      return Object.keys(ds.ITEMS).map(function (k) { return ds.ITEMS[k]; });
    }
    return [];
  }

  function renderCatalog(filterText) {
    if (!dom.catalogList) return;
    var items = getCatalogItems();
    var ds = NS.Datasheets;
    var query = (filterText || '').trim().toLowerCase();

    var filtered = items.filter(function (item) {
      if (!item) return false;
      if (!query) return true;
      return (
        String(item.name || '').toLowerCase().indexOf(query) !== -1 ||
        String(item.shortName || '').toLowerCase().indexOf(query) !== -1 ||
        String(item.model || '').toLowerCase().indexOf(query) !== -1 ||
        String(item.category || '').toLowerCase().indexOf(query) !== -1
      );
    });

    if (dom.catalogCount) {
      dom.catalogCount.textContent = String(filtered.length);
    }

    if (filtered.length === 0) {
      dom.catalogList.innerHTML = '<div class="catalog-empty">No hay componentes que coincidan con "' + escapeHtml(filterText) + '".</div>';
      return;
    }

    var categoryOrder = (ds && Array.isArray(ds.CATEGORIES))
      ? ds.CATEGORIES.slice().sort(function (a, b) {
          return (a && a.order ? a.order : 0) - (b && b.order ? b.order : 0);
        }).map(function (c) {
          return typeof c === 'string' ? c : (c.id || c.name || c.label || String(c));
        })
      : ['Placas', 'Protoboard y Pasivos', 'Actuadores', 'Sensores', 'Pantalla'];

    var grouped = {};
    filtered.forEach(function (item) {
      var cat = item.category || 'Otros';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
      if (categoryOrder.indexOf(cat) === -1) {
        categoryOrder.push(cat);
      }
    });

    var html = '';
    categoryOrder.forEach(function (cat) {
      var list = grouped[cat];
      if (!list || list.length === 0) return;
      html += '<div class="catalog-group">';
      html += '<div class="catalog-group-header"><span>' + escapeHtml(cat) + '</span><span>' + list.length + '</span></div>';
      html += '<div class="catalog-items">';
      list.forEach(function (item) {
        var isWire = item.type === 'wire';
        var progTag = item.isProgrammable ? '<span class="catalog-item-tag">Programable</span>' : '';
        html += '<div class="catalog-item' + (isWire ? ' is-wire-guide' : '') + '" data-type="' + escapeHtml(item.type) + '" role="button" tabindex="0" title="' + (isWire ? 'Haz click en dos pines de la escena 3D para tender un cable' : 'Click para añadir al mapa 3D') + '">';
        html += '  <div class="catalog-item-icon">' + getComponentSvgIcon(item.type) + '</div>';
        html += '  <div class="catalog-item-body">';
        html += '    <div class="catalog-item-top"><span class="catalog-item-name">' + escapeHtml(item.shortName || item.name) + '</span>' + progTag + '</div>';
        html += '    <div class="catalog-item-model">' + escapeHtml(item.model || item.manufacturer || '') + '</div>';
        html += '  </div>';
        html += '  <button class="catalog-item-ds" type="button" data-ds-type="' + escapeHtml(item.type) + '" title="Ver Datasheet Resumido" aria-label="Ver Datasheet de ' + escapeHtml(item.name) + '">📄</button>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    dom.catalogList.innerHTML = html;
  }

  function getCompHalfExtents(type) {
    return FOOTPRINTS[type] || { hw: 16, hd: 16 };
  }

  function findFreeGridSlot(type) {
    var sim = NS.Simulator;
    var simState = sim && typeof sim.getState === 'function' ? sim.getState() : { components: [] };
    var comps = simState.components || [];
    var fp = getCompHalfExtents(type);

    function collides(cx, cz) {
      for (var i = 0; i < comps.length; i++) {
        var c = comps[i];
        if (!c || !c.pos) continue;
        var other = getCompHalfExtents(c.type);
        var rotated = Math.abs(Math.sin(c.rotY || 0)) > 0.7;
        var ohw = rotated ? other.hd : other.hw;
        var ohd = rotated ? other.hw : other.hd;
        if (Math.abs(cx - c.pos.x) < (fp.hw + ohw + 6) && Math.abs(cz - c.pos.z) < (fp.hd + ohd + 6)) {
          return true;
        }
      }
      return false;
    }

    var zCandidates = [65, -65, 105, -105, 0, 35, -35, 140, -140];
    var xCandidates = [0, -35, 35, -75, 75, -115, 115, -155, 155];

    for (var zi = 0; zi < zCandidates.length; zi++) {
      for (var xi = 0; xi < xCandidates.length; xi++) {
        var tx = xCandidates[xi];
        var tz = zCandidates[zi];
        if (!collides(tx, tz)) {
          return { x: tx, y: 0, z: tz };
        }
      }
    }

    for (var r = 10; r <= 200; r += 15) {
      for (var a = 0; a < 12; a++) {
        var ang = (a / 12) * Math.PI * 2;
        var gx = Math.round((Math.cos(ang) * r) / 5) * 5;
        var gz = Math.round((Math.sin(ang) * r) / 5) * 5;
        if (!collides(gx, gz)) {
          return { x: gx, y: 0, z: gz };
        }
      }
    }

    return { x: 0, y: 0, z: 95 };
  }

  function handleAddFromCatalog(type) {
    if (type === 'wire') {
      showToast('Selecciona un color de cable arriba y haz click en dos pines de la escena 3D.');
      return;
    }
    var sim = NS.Simulator;
    var ds = NS.Datasheets;
    if (!sim || typeof sim.addComponent !== 'function') return;

    var info = ds && typeof ds.get === 'function' ? ds.get(type) : null;
    var pos = findFreeGridSlot(type);
    var defaultProps = {};
    if (info && info.defaultProps) {
      var propKeys = Object.keys(info.defaultProps);
      for (var pi = 0; pi < propKeys.length; pi++) {
        defaultProps[propKeys[pi]] = info.defaultProps[propKeys[pi]];
      }
    }
    var added = sim.addComponent(type, pos, defaultProps);

    if (added && NS.Scene3D && typeof NS.Scene3D.setSelected === 'function') {
      NS.Scene3D.setSelected('component', added.id);
    }
    showToast('Añadido: ' + (info ? (info.shortName || info.name) : type));
  }

  /* ========================================================================
     Tooltip Flotante de Pin
     ======================================================================== */

  function updatePinTooltip(info) {
    if (!dom.pinTooltip) return;
    if (!info || !info.comp || !info.pin) {
      dom.pinTooltip.classList.add('hidden');
      return;
    }

    var sim = NS.Simulator;
    var voltageInfo = info.voltageInfo;
    if (!voltageInfo && sim && typeof sim.getPinVoltage === 'function') {
      voltageInfo = sim.getPinVoltage(info.comp.id, info.pin.id);
    }

    var compTitle = info.comp.label || (NS.Datasheets && NS.Datasheets.get(info.comp.type) ? NS.Datasheets.get(info.comp.type).shortName : info.comp.type);
    dom.ttCompName.textContent = compTitle;
    dom.ttPinId.textContent = info.pin.id || info.pin.name || 'PIN';
    dom.ttPinDesc.textContent = info.pin.description || info.pin.name || info.pin.type || '';

    var v = voltageInfo && voltageInfo.voltage !== undefined ? voltageInfo.voltage : null;
    dom.ttVoltage.textContent = formatVoltage(v);

    var pending = NS.Scene3D && typeof NS.Scene3D.getPendingWireStart === 'function' ? NS.Scene3D.getPendingWireStart() : null;
    if (pending) {
      if (pending.compId === info.comp.id && pending.pinId === info.pin.id) {
        dom.ttHint.textContent = 'Origen actual · Click en otro pin para conectar';
      } else {
        dom.ttHint.textContent = 'Click para completar cable aquí';
      }
    } else {
      dom.ttHint.textContent = 'Click izq. para iniciar cable';
    }

    dom.pinTooltip.classList.remove('hidden');

    var offsetX = 14;
    var offsetY = 14;
    var rect = dom.pinTooltip.getBoundingClientRect();
    var left = (info.screenX || 0) + offsetX;
    var top = (info.screenY || 0) + offsetY;

    if (left + rect.width + 10 > window.innerWidth) {
      left = (info.screenX || 0) - rect.width - offsetX;
    }
    if (top + rect.height + 10 > window.innerHeight) {
      top = (info.screenY || 0) - rect.height - offsetY;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    dom.pinTooltip.style.left = left + 'px';
    dom.pinTooltip.style.top = top + 'px';
  }

  /* ========================================================================
     Menú Contextual Flotante de Click Derecho
     ======================================================================== */

  function findComponentById(id) {
    var sim = NS.Simulator;
    if (!sim || typeof sim.getState !== 'function') return null;
    var comps = sim.getState().components || [];
    for (var i = 0; i < comps.length; i++) {
      if (comps[i].id === id) return comps[i];
    }
    return null;
  }

  function findWireById(id) {
    var sim = NS.Simulator;
    if (!sim || typeof sim.getState !== 'function') return null;
    var wires = sim.getState().wires || [];
    for (var i = 0; i < wires.length; i++) {
      if (wires[i].id === id) return wires[i];
    }
    return null;
  }

  function closeContextMenu() {
    state.contextTarget = null;
    if (dom.contextMenu) {
      dom.contextMenu.classList.add('hidden');
      dom.contextMenu.innerHTML = '';
    }
  }

  function positionContextMenu(screenX, screenY) {
    if (!dom.contextMenu) return;
    dom.contextMenu.classList.remove('hidden');

    var rect = dom.contextMenu.getBoundingClientRect();
    var pad = 12;
    var left = (screenX || 0) + 8;
    var top = (screenY || 0) + 8;

    if (left + rect.width + pad > window.innerWidth) {
      left = (screenX || 0) - rect.width - 8;
    }
    if (top + rect.height + pad > window.innerHeight) {
      top = window.innerHeight - rect.height - pad;
    }

    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad));

    dom.contextMenu.style.left = left + 'px';
    dom.contextMenu.style.top = top + 'px';
  }

  function renderTelemetryMarkup(compId) {
    var sim = NS.Simulator;
    if (!sim || typeof sim.getComponentTelemetry !== 'function') {
      return '<div class="ctx-tele-pill"><span class="ctx-tele-key">Estado</span><span class="ctx-tele-val">Sin telemetría</span></div>';
    }
    var tele = sim.getComponentTelemetry(compId) || {};
    var fields = Array.isArray(tele.fields) ? tele.fields.slice() : [];

    if (fields.length === 0) {
      if (tele.voltage !== undefined) fields.push({ label: 'Tensión', value: formatVoltage(tele.voltage) });
      if (tele.currentMa !== undefined) fields.push({ label: 'Corriente', value: Number(tele.currentMa).toFixed(1) + ' mA' });
      if (tele.brightness !== undefined) fields.push({ label: 'Brillo', value: Math.round(tele.brightness * 100) + '%' });
      if (tele.angle !== undefined) fields.push({ label: 'Ángulo', value: Math.round(tele.angle) + '°' });
    }

    var html = '<div class="ctx-telemetry-grid">';
    fields.forEach(function (f) {
      var unitStr = f.unit ? (' ' + f.unit) : '';
      var isDanger = Boolean(tele.overcurrent && /corriente|sobre/i.test(String(f.label)));
      var isAccent = !isDanger && /tensión|volt|brillo|ángulo|dist|temp/i.test(String(f.label));
      html += '<div class="ctx-tele-pill' + (isDanger ? ' is-danger' : (isAccent ? ' is-accent' : '')) + '">';
      html += '  <span class="ctx-tele-key">' + escapeHtml(f.label) + '</span>';
      html += '  <span class="ctx-tele-val">' + escapeHtml(String(f.value) + unitStr) + '</span>';
      html += '</div>';
    });
    if (fields.length === 0 && tele.summary) {
      html += '<div class="ctx-tele-pill" style="grid-column:span 2"><span class="ctx-tele-key">Resumen</span><span class="ctx-tele-val">' + escapeHtml(tele.summary) + '</span></div>';
    }
    html += '</div>';

    if (tele.line1 !== undefined || tele.line2 !== undefined) {
      html += '<div class="ctx-tele-pill" style="margin-top:6px"><span class="ctx-tele-key">Pantalla 16x2</span><span class="ctx-tele-val" style="font-size:11px;white-space:pre">' + escapeHtml(String(tele.line1 || '')) + '\n' + escapeHtml(String(tele.line2 || '')) + '</span></div>';
    }

    var warnings = Array.isArray(tele.warnings) ? tele.warnings.slice() : [];
    if (tele.overcurrent && warnings.length === 0) {
      warnings.push('¡Sobrecorriente detectada! Añade una resistencia limitadora.');
    }
    warnings.forEach(function (w) {
      html += '<div class="ctx-alert">⚠ ' + escapeHtml(w) + '</div>';
    });

    return html;
  }

  function renderResistorBandPreview(ohms) {
    var ds = NS.Datasheets;
    if (!ds || typeof ds.getResistorBands !== 'function') return '';
    var info = ds.getResistorBands(ohms);
    if (!info || !Array.isArray(info.bands)) return '';
    var bandsHtml = info.bands.map(function (b) {
      return '<span class="resistor-band" style="background:' + escapeHtml(b.hex) + '" title="' + escapeHtml(b.name) + '"></span>';
    }).join('');
    var namesText = info.bands.map(function (b) { return b.name; }).join(' · ');
    return '<div class="resistor-preview"><div class="resistor-body-bar">' + bandsHtml + '</div><div class="resistor-bands-text">' + escapeHtml(namesText) + '</div></div>';
  }

  function getResistorOptions() {
    var ds = NS.Datasheets;
    if (ds && Array.isArray(ds.RESISTOR_VALUES) && ds.RESISTOR_VALUES.length > 0) {
      return ds.RESISTOR_VALUES.map(function (ohms) {
        var label = ohms >= 1000
          ? (ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 1) + ' kΩ'
          : ohms + ' Ω';
        return { ohms: ohms, label: label };
      });
    }
    return RESISTOR_VALUES;
  }

  function renderComponentQuickControls(comp) {
    var props = comp.props || {};
    var st = comp.state || {};
    var html = '<div class="ctx-control-row">';

    if (comp.type === 'resistor') {
      var curOhms = Number(props.ohms || 220);
      html += '<div class="ctx-chip-grid">';
      getResistorOptions().forEach(function (rv) {
        var active = curOhms === rv.ohms ? ' is-active' : '';
        html += '<button class="ctx-chip-btn' + active + '" type="button" data-action="set-ohms" data-ohms="' + rv.ohms + '">' + rv.label + '</button>';
      });
      html += '</div>';
      html += '<div id="ctx-resistor-bands">' + renderResistorBandPreview(curOhms) + '</div>';
    } else if (comp.type === 'led') {
      var curColor = String(props.color || 'red').toLowerCase();
      html += '<div class="ctx-color-row">';
      getLedColorOptions().forEach(function (lc) {
        var active = curColor === lc.id ? ' is-active' : '';
        html += '<button class="ctx-color-pill' + active + '" type="button" data-action="set-led-color" data-led-color="' + lc.id + '"><span class="ctx-color-dot" style="background:' + lc.hex + '"></span><span>' + lc.name + '</span></button>';
      });
      html += '</div>';
    } else if (comp.type === 'potentiometer') {
      var potVal = props.value != null ? Number(props.value) : 0.5;
      var pct = Math.round(potVal * 100);
      html += '<div class="ctx-slider-head"><span>Posición del cursor</span><span id="ctx-slider-readout" class="ctx-slider-val">' + pct + '% · ' + (potVal * 10).toFixed(1) + ' kΩ</span></div>';
      html += '<input id="ctx-prop-slider" class="ctx-slider" type="range" min="0" max="100" step="1" value="' + pct + '" data-prop="potentiometer">';
    } else if (comp.type === 'ldr') {
      var luxVal = props.lux != null ? Number(props.lux) : 500;
      html += '<div class="ctx-slider-head"><span>Iluminancia ambiente</span><span id="ctx-slider-readout" class="ctx-slider-val">' + Math.round(luxVal) + ' lux</span></div>';
      html += '<input id="ctx-prop-slider" class="ctx-slider" type="range" min="1" max="1000" step="5" value="' + Math.round(luxVal) + '" data-prop="ldr">';
    } else if (comp.type === 'ultrasonic_hcsr04') {
      var distVal = props.distanceCm != null ? Number(props.distanceCm) : 25;
      html += '<div class="ctx-slider-head"><span>Distancia objetivo</span><span id="ctx-slider-readout" class="ctx-slider-val">' + Math.round(distVal) + ' cm</span></div>';
      html += '<input id="ctx-prop-slider" class="ctx-slider" type="range" min="2" max="400" step="1" value="' + Math.round(distVal) + '" data-prop="ultrasonic_hcsr04">';
    } else if (comp.type === 'tmp36') {
      var tempVal = props.tempC != null ? Number(props.tempC) : 25;
      html += '<div class="ctx-slider-head"><span>Temperatura sensor</span><span id="ctx-slider-readout" class="ctx-slider-val">' + Math.round(tempVal) + ' °C</span></div>';
      html += '<input id="ctx-prop-slider" class="ctx-slider" type="range" min="-40" max="125" step="1" value="' + Math.round(tempVal) + '" data-prop="tmp36">';
    } else if (comp.type === 'pushbutton') {
      var isPressed = Boolean(props.pressed || st.pressed);
      html += '<button id="ctx-push-hold" class="ctx-push-btn' + (isPressed ? ' is-pressed' : '') + '" type="button">' + (isPressed ? '● Pulsado (suelta para liberar)' : 'Mantener pulsado') + '</button>';
      html += '<button id="ctx-push-toggle" class="btn btn-secondary btn-sm" type="button">' + (isPressed ? 'Soltar botón' : 'Fijar pulsado') + '</button>';
    }

    html += '<div class="ctx-actions-pair">';
    html += '  <button class="btn btn-secondary btn-sm" type="button" data-action="rotate-90">↻ Rotar 90°</button>';
    html += '  <button class="btn btn-danger-outline btn-sm" type="button" data-action="delete-comp">🗑 Eliminar</button>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  function openComponentContextMenu(comp, screenX, screenY) {
    var ds = NS.Datasheets && typeof NS.Datasheets.get === 'function' ? NS.Datasheets.get(comp.type) : null;
    state.contextTarget = { kind: 'component', id: comp.id };

    var name = (ds && ds.name) || comp.label || comp.type;
    var modelLine = ds ? [ds.model, ds.manufacturer].filter(Boolean).join(' · ') : '';
    var isProg = Boolean(ds && ds.isProgrammable === true);
    var specs = (ds && Array.isArray(ds.keySpecs)) ? ds.keySpecs : [];

    var html = '';
    html += '<div class="ctx-header">';
    html += '  <div>';
    html += '    <div class="ctx-title-row">';
    html += '      <h3 class="ctx-title">' + escapeHtml(name) + '</h3>';
    if (isProg) {
      html += '    <span class="badge-accent">Programable</span>';
    }
    html += '    </div>';
    if (modelLine) {
      html += '  <p class="ctx-subtitle">' + escapeHtml(modelLine) + '</p>';
    }
    html += '  </div>';
    html += '  <button class="ctx-close" type="button" data-action="close-ctx" aria-label="Cerrar menú">✕</button>';
    html += '</div>';

    if (specs.length > 0) {
      html += '<div class="ctx-section">';
      html += '  <h4 class="ctx-section-title">Características principales</h4>';
      html += '  <div class="ctx-specs-grid">';
      specs.slice(0, 6).forEach(function (sp) {
        var unit = sp.unit ? (' ' + sp.unit) : '';
        html += '<div class="ctx-spec-item"><span class="ctx-spec-label">' + escapeHtml(sp.label) + '</span><span class="ctx-spec-val">' + escapeHtml(String(sp.value) + unit) + '</span></div>';
      });
      html += '  </div>';
      html += '</div>';
    }

    html += '<div class="ctx-section">';
    html += '  <h4 class="ctx-section-title">Telemetría en vivo</h4>';
    html += '  <div id="ctx-live-telemetry">' + renderTelemetryMarkup(comp.id) + '</div>';
    html += '</div>';

    html += '<div class="ctx-section">';
    html += '  <h4 class="ctx-section-title">Controles rápidos</h4>';
    html += renderComponentQuickControls(comp);
    html += '</div>';

    html += '<div class="ctx-footer-actions">';
    html += '  <button class="btn btn-secondary" type="button" data-action="open-datasheet" data-type="' + escapeHtml(comp.type) + '">📄 Abrir Datasheet Resumido</button>';
    if (isProg) {
      html += '  <button class="btn btn-primary" type="button" data-action="open-ide">💻 Abrir IDE e Inyectar Código</button>';
    }
    html += '</div>';

    dom.contextMenu.innerHTML = html;
    bindContextMenuEvents(comp);
    positionContextMenu(screenX, screenY);
  }

  function openWireContextMenu(wire, screenX, screenY) {
    state.contextTarget = { kind: 'wire', id: wire.id };
    var sim = NS.Simulator;
    var fromComp = findComponentById(wire.from.compId);
    var toComp = findComponentById(wire.to.compId);
    var fromName = (fromComp && (fromComp.label || fromComp.type)) || wire.from.compId;
    var toName = (toComp && (toComp.label || toComp.type)) || wire.to.compId;
    var vInfo = sim && typeof sim.getPinVoltage === 'function' ? sim.getPinVoltage(wire.from.compId, wire.from.pinId) : null;

    var html = '';
    html += '<div class="ctx-header">';
    html += '  <div>';
    html += '    <div class="ctx-title-row"><h3 class="ctx-title">Cable Puente Dupont</h3><span class="badge-paper">' + escapeHtml(getWireColorName(wire.color)) + '</span></div>';
    html += '    <p class="ctx-subtitle">22 AWG cobre estañado · PVC</p>';
    html += '  </div>';
    html += '  <button class="ctx-close" type="button" data-action="close-ctx" aria-label="Cerrar menú">✕</button>';
    html += '</div>';

    html += '<div class="ctx-section">';
    html += '  <h4 class="ctx-section-title">Conexión</h4>';
    html += '  <div class="wire-route-box"><span>' + escapeHtml(fromName + ' · ' + wire.from.pinId) + '</span><span>→</span><span>' + escapeHtml(toName + ' · ' + wire.to.pinId) + '</span></div>';
    html += '</div>';

    html += '<div class="ctx-section">';
    html += '  <h4 class="ctx-section-title">Telemetría en vivo</h4>';
    html += '  <div id="ctx-live-telemetry"><div class="ctx-tele-pill is-accent"><span class="ctx-tele-key">Tensión del nodo</span><span class="ctx-tele-val">' + escapeHtml(formatVoltage(vInfo ? vInfo.voltage : null)) + '</span></div></div>';
    html += '</div>';

    html += '<div class="ctx-section">';
    html += '  <h4 class="ctx-section-title">Cambiar color</h4>';
    html += '  <div class="ctx-color-row">';
    WIRE_COLORS.forEach(function (wc) {
      var active = String(wire.color || '').toUpperCase() === wc.hex.toUpperCase() ? ' is-active' : '';
      html += '<button class="ctx-color-pill' + active + '" type="button" data-action="set-wire-color" data-wire-color="' + wc.hex + '"><span class="ctx-color-dot" style="background:' + wc.hex + '"></span><span>' + wc.name + '</span></button>';
    });
    html += '  </div>';
    html += '</div>';

    html += '<div class="ctx-footer-actions">';
    html += '  <button class="btn btn-danger-outline" type="button" data-action="delete-wire">🗑 Eliminar cable</button>';
    html += '</div>';

    dom.contextMenu.innerHTML = html;
    bindWireContextMenuEvents(wire);
    positionContextMenu(screenX, screenY);
  }

  function bindContextMenuEvents(comp) {
    var sim = NS.Simulator;
    dom.contextMenu.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'close-ctx') {
          closeContextMenu();
        } else if (action === 'set-ohms') {
          var ohms = Number(btn.getAttribute('data-ohms'));
          if (sim && typeof sim.updateComponentProps === 'function') {
            sim.updateComponentProps(comp.id, { ohms: ohms });
          }
          dom.contextMenu.querySelectorAll('[data-action="set-ohms"]').forEach(function (b) {
            b.classList.toggle('is-active', Number(b.getAttribute('data-ohms')) === ohms);
          });
          var preview = $('ctx-resistor-bands');
          if (preview) preview.innerHTML = renderResistorBandPreview(ohms);
          updateContextMenuTelemetry();
        } else if (action === 'set-led-color') {
          var color = btn.getAttribute('data-led-color');
          if (sim && typeof sim.updateComponentProps === 'function') {
            sim.updateComponentProps(comp.id, { color: color });
          }
          dom.contextMenu.querySelectorAll('[data-action="set-led-color"]').forEach(function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-led-color') === color);
          });
          updateContextMenuTelemetry();
        } else if (action === 'rotate-90') {
          if (sim && typeof sim.rotateComponent === 'function') {
            sim.rotateComponent(comp.id, 90);
          }
        } else if (action === 'delete-comp') {
          if (sim && typeof sim.removeComponent === 'function') {
            sim.removeComponent(comp.id);
          }
          closeContextMenu();
        } else if (action === 'open-datasheet') {
          closeContextMenu();
          openDatasheetModal(btn.getAttribute('data-type'));
        } else if (action === 'open-ide') {
          closeContextMenu();
          openIdeDrawer();
        }
      });
    });

    var slider = $('ctx-prop-slider');
    if (slider) {
      slider.addEventListener('input', function () {
        var propType = slider.getAttribute('data-prop');
        var raw = Number(slider.value);
        var readout = $('ctx-slider-readout');
        if (propType === 'potentiometer') {
          var v = raw / 100;
          if (readout) readout.textContent = raw + '% · ' + (v * 10).toFixed(1) + ' kΩ';
          if (sim && typeof sim.updateComponentProps === 'function') {
            sim.updateComponentProps(comp.id, { value: v });
          }
        } else if (propType === 'ldr') {
          if (readout) readout.textContent = raw + ' lux';
          if (sim && typeof sim.updateComponentProps === 'function') {
            sim.updateComponentProps(comp.id, { lux: raw });
          }
        } else if (propType === 'ultrasonic_hcsr04') {
          if (readout) readout.textContent = raw + ' cm';
          if (sim && typeof sim.updateComponentProps === 'function') {
            sim.updateComponentProps(comp.id, { distanceCm: raw });
          }
        } else if (propType === 'tmp36') {
          if (readout) readout.textContent = raw + ' °C';
          if (sim && typeof sim.updateComponentProps === 'function') {
            sim.updateComponentProps(comp.id, { tempC: raw });
          }
        }
        updateContextMenuTelemetry();
      });
    }

    var holdBtn = $('ctx-push-hold');
    var toggleBtn = $('ctx-push-toggle');
    if (holdBtn) {
      var setPressed = function (pressed) {
        if (sim && typeof sim.updateComponentProps === 'function') {
          sim.updateComponentProps(comp.id, { pressed: pressed });
        }
        holdBtn.classList.toggle('is-pressed', pressed);
        holdBtn.textContent = pressed ? '● Pulsado (suelta para liberar)' : 'Mantener pulsado';
        if (toggleBtn) {
          toggleBtn.textContent = pressed ? 'Soltar botón' : 'Fijar pulsado';
        }
        updateContextMenuTelemetry();
      };
      holdBtn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        setPressed(true);
      });
      holdBtn.addEventListener('pointerup', function () { setPressed(false); });
      holdBtn.addEventListener('pointercancel', function () { setPressed(false); });
      holdBtn.addEventListener('pointerleave', function (e) {
        if (e.buttons > 0) setPressed(false);
      });
    }
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var latest = findComponentById(comp.id);
        var currentlyPressed = Boolean(latest && ((latest.props && latest.props.pressed) || (latest.state && latest.state.pressed)));
        var next = !currentlyPressed;
        if (sim && typeof sim.updateComponentProps === 'function') {
          sim.updateComponentProps(comp.id, { pressed: next });
        }
        if (holdBtn) {
          holdBtn.classList.toggle('is-pressed', next);
          holdBtn.textContent = next ? '● Pulsado (suelta para liberar)' : 'Mantener pulsado';
        }
        toggleBtn.textContent = next ? 'Soltar botón' : 'Fijar pulsado';
        updateContextMenuTelemetry();
      });
    }
  }

  function bindWireContextMenuEvents(wire) {
    var sim = NS.Simulator;
    dom.contextMenu.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        if (action === 'close-ctx') {
          closeContextMenu();
        } else if (action === 'set-wire-color') {
          var nextColor = btn.getAttribute('data-wire-color');
          if (sim) {
            if (typeof sim.updateWireColor === 'function') {
              sim.updateWireColor(wire.id, nextColor);
            } else {
              wire.color = nextColor;
            }
          }
          dom.contextMenu.querySelectorAll('[data-action="set-wire-color"]').forEach(function (b) {
            b.classList.toggle('is-active', String(b.getAttribute('data-wire-color')).toUpperCase() === nextColor.toUpperCase());
          });
          var badge = dom.contextMenu.querySelector('.badge-paper');
          if (badge) badge.textContent = getWireColorName(nextColor);
        } else if (action === 'delete-wire') {
          if (sim && typeof sim.removeWire === 'function') {
            sim.removeWire(wire.id);
          }
          closeContextMenu();
        }
      });
    });
  }

  function updateContextMenuTelemetry() {
    if (!state.contextTarget || !dom.contextMenu || dom.contextMenu.classList.contains('hidden')) return;
    var box = $('ctx-live-telemetry');
    if (!box) return;

    if (state.contextTarget.kind === 'component') {
      var comp = findComponentById(state.contextTarget.id);
      if (!comp) {
        closeContextMenu();
        return;
      }
      box.innerHTML = renderTelemetryMarkup(comp.id);
    } else if (state.contextTarget.kind === 'wire') {
      var wire = findWireById(state.contextTarget.id);
      if (!wire) {
        closeContextMenu();
        return;
      }
      var sim = NS.Simulator;
      var vInfo = sim && typeof sim.getPinVoltage === 'function' ? sim.getPinVoltage(wire.from.compId, wire.from.pinId) : null;
      box.innerHTML = '<div class="ctx-tele-pill is-accent"><span class="ctx-tele-key">Tensión del nodo</span><span class="ctx-tele-val">' + escapeHtml(formatVoltage(vInfo ? vInfo.voltage : null)) + '</span></div>';
    }
  }

  function handleRightClick(payload) {
    if (!payload || !payload.item) return;
    if (payload.kind === 'wire') {
      var wire = findWireById(payload.item.id) || payload.item;
      openWireContextMenu(wire, payload.screenX, payload.screenY);
    } else {
      var comp = findComponentById(payload.item.id) || payload.item;
      openComponentContextMenu(comp, payload.screenX, payload.screenY);
    }
  }

  /* ========================================================================
     Ventana Modal de Datasheet Resumido
     ======================================================================== */

  function openDatasheetModal(type) {
    var ds = NS.Datasheets && typeof NS.Datasheets.get === 'function' ? NS.Datasheets.get(type) : null;
    if (!ds) return;
    state.datasheetType = type;
    state.datasheetTab = 'all';

    dom.dsCategoryBadge.textContent = ds.category || 'Componente';
    dom.dsPackageBadge.textContent = ds.package || 'Estándar';
    dom.dsProgrammableBadge.classList.toggle('hidden', ds.isProgrammable !== true);
    dom.dsOpenIdeBtn.classList.toggle('hidden', ds.isProgrammable !== true);
    dom.dsTitle.textContent = ds.name || type;
    dom.dsSubtitle.textContent = [ds.model, ds.manufacturer].filter(Boolean).join(' · ');

    document.querySelectorAll('.ds-tab').forEach(function (tabBtn) {
      var active = tabBtn.getAttribute('data-tab') === 'all';
      tabBtn.classList.toggle('is-active', active);
      tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    renderDatasheetBody();
    dom.datasheetModal.classList.remove('hidden');
  }

  function closeDatasheetModal() {
    dom.datasheetModal.classList.add('hidden');
  }

  function renderDatasheetBody() {
    var ds = NS.Datasheets && typeof NS.Datasheets.get === 'function' ? NS.Datasheets.get(state.datasheetType) : null;
    if (!ds || !dom.dsBody) return;

    var tab = state.datasheetTab || 'all';
    var show = function (sectionKey) {
      return tab === 'all' || tab === sectionKey;
    };

    var html = '';

    if (show('summary')) {
      html += '<section class="ds-section-card">';
      html += '  <h3 class="ds-section-heading">Resumen Técnico</h3>';
      html += '  <p class="ds-summary-text">' + escapeHtml(ds.summary || '') + '</p>';
      if (Array.isArray(ds.keySpecs) && ds.keySpecs.length > 0) {
        html += '<div class="ds-keyspecs">';
        ds.keySpecs.forEach(function (sp) {
          var unit = sp.unit ? (' ' + sp.unit) : '';
          html += '<div class="ds-keyspec-card"><div class="ds-keyspec-label">' + escapeHtml(sp.label) + '</div><div class="ds-keyspec-value">' + escapeHtml(String(sp.value) + unit) + '</div></div>';
        });
        html += '</div>';
      }
      html += '</section>';
    }

    if (show('electrical')) {
      var elec = Array.isArray(ds.electricalCharacteristics) ? ds.electricalCharacteristics : [];
      html += '<section class="ds-section-card">';
      html += '  <h3 class="ds-section-heading">Características Eléctricas</h3>';
      if (elec.length > 0) {
        html += '<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Parámetro</th><th>Mín</th><th>Típ</th><th>Máx</th><th>Unidad</th><th>Condiciones</th></tr></thead><tbody>';
        elec.forEach(function (row) {
          html += '<tr>';
          html += '  <td><strong>' + escapeHtml(row.parameter) + '</strong></td>';
          html += '  <td class="ds-mono">' + escapeHtml(row.min != null ? row.min : '—') + '</td>';
          html += '  <td class="ds-mono">' + escapeHtml(row.typ != null ? row.typ : '—') + '</td>';
          html += '  <td class="ds-mono">' + escapeHtml(row.max != null ? row.max : '—') + '</td>';
          html += '  <td class="ds-mono">' + escapeHtml(row.unit || '—') + '</td>';
          html += '  <td>' + escapeHtml(row.conditions || '—') + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      } else {
        html += '<p class="ds-summary-text">Sin tabla de características eléctricas registradas.</p>';
      }
      html += '</section>';
    }

    if (show('limits')) {
      var limits = Array.isArray(ds.absoluteMaxRatings) ? ds.absoluteMaxRatings : [];
      html += '<section class="ds-section-card">';
      html += '  <h3 class="ds-section-heading">Límites Máximos Absolutos</h3>';
      html += '  <div class="ds-alert-banner">⚠ Superar los valores máximos absolutos puede provocar daño térmico o eléctrico permanente en el componente.</div>';
      if (limits.length > 0) {
        html += '<div class="ds-table-wrap"><table class="ds-table ds-limits-table"><thead><tr><th>Parámetro</th><th>Límite Máximo</th><th>Notas</th></tr></thead><tbody>';
        limits.forEach(function (row) {
          html += '<tr><td><strong>' + escapeHtml(row.parameter) + '</strong></td><td>' + escapeHtml(row.value) + '</td><td>' + escapeHtml(row.notes || '—') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</section>';
    }

    if (show('pinout')) {
      var pins = Array.isArray(ds.pinout) ? ds.pinout : [];
      html += '<section class="ds-section-card">';
      html += '  <h3 class="ds-section-heading">Mapa de Pines / Pinout</h3>';
      if (ds.type === 'breadboard_830') {
        html += '<div class="ds-alert-banner">La protoboard MB-102 dispone de 830 puntos de inserción reales (2 buses superiores +/−, 2 buses inferiores +/− y 63 columnas × 5 filas A–E / F–J) interactivos en el escenario 3D.</div>';
      }
      if (pins.length > 0) {
        html += '<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Pin</th><th>Nombre</th><th>Tipo</th><th>Descripción</th></tr></thead><tbody>';
        pins.forEach(function (pin) {
          html += '<tr><td class="ds-mono"><strong>' + escapeHtml(pin.id) + '</strong></td><td>' + escapeHtml(pin.name) + '</td><td><span class="badge-paper">' + escapeHtml(pin.type || 'I/O') + '</span></td><td>' + escapeHtml(pin.description || '') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      } else {
        html += '<p class="ds-summary-text">Componente pasivo sin pines fijos asignados.</p>';
      }
      html += '</section>';
    }

    if (show('notes')) {
      var formulas = Array.isArray(ds.formulas) ? ds.formulas : [];
      var notes = Array.isArray(ds.applicationNotes) ? ds.applicationNotes : [];
      html += '<section class="ds-section-card">';
      html += '  <h3 class="ds-section-heading">Fórmulas Clave y Notas de Aplicación</h3>';
      if (formulas.length > 0) {
        html += '<div class="ds-formulas-grid">';
        formulas.forEach(function (f) {
          html += '<div class="ds-formula-card"><div class="ds-formula-title">' + escapeHtml(f.title) + '</div><code class="ds-formula-code">' + escapeHtml(f.formula) + '</code><p class="ds-formula-exp">' + escapeHtml(f.explanation || '') + '</p></div>';
        });
        html += '</div>';
      }
      if (notes.length > 0) {
        html += '<ul class="ds-notes-list">';
        notes.forEach(function (n) {
          html += '<li>' + escapeHtml(n) + '</li>';
        });
        html += '</ul>';
      }
      html += '</section>';
    }

    dom.dsBody.innerHTML = html;
    dom.dsBody.scrollTop = 0;
  }

  /* ========================================================================
     IDE Arduino y Monitor Serie
     ======================================================================== */

  function populatePresets() {
    if (!dom.idePresetSelect) return;
    var presets = (NS.Sketches && Array.isArray(NS.Sketches.PRESETS)) ? NS.Sketches.PRESETS : [];
    dom.idePresetSelect.innerHTML = '';
    presets.forEach(function (p, idx) {
      var opt = document.createElement('option');
      opt.value = p.id || String(idx);
      opt.textContent = p.name || ('Ejemplo ' + (idx + 1));
      dom.idePresetSelect.appendChild(opt);
    });
  }

  function updateLineNumbers() {
    if (!dom.ideEditor || !dom.ideLineNumbers) return;
    var lines = dom.ideEditor.value.split('\n').length;
    var nums = [];
    for (var i = 1; i <= lines; i++) {
      nums.push(i);
    }
    dom.ideLineNumbers.textContent = nums.join('\n');
    dom.ideLineNumbers.scrollTop = dom.ideEditor.scrollTop;
  }

  function syncIdeFromSimulator() {
    var sim = NS.Simulator;
    if (!sim || typeof sim.getState !== 'function') return;
    var simState = sim.getState();
    var isDirty = Boolean(dom.ideEditor && dom.ideEditor.dataset.dirty);
    if (dom.ideEditor && simState.sketchCode != null && !isDirty) {
      dom.ideEditor.value = simState.sketchCode;
      updateLineNumbers();
    }
    if (dom.ideSketchBadge && simState.sketchName && !isDirty) {
      dom.ideSketchBadge.textContent = simState.sketchName;
    }
    updateCompileStatus(simState.compileInfo);
    updateSoundButton(simState.soundEnabled);
    renderSerialMonitor(simState.serialLines || []);
  }

  function updateCompileStatus(info) {
    if (!dom.ideStatusBar) return;
    if (!info) {
      dom.ideStatusBar.className = 'ide-status-bar is-ok';
      dom.ideStatusMessage.textContent = 'Listo para compilar.';
      dom.ideMemoryStats.textContent = 'Flash: -- · SRAM: --';
      return;
    }
    if (info.ok) {
      dom.ideStatusBar.className = 'ide-status-bar is-ok';
      var warnTxt = (Array.isArray(info.warnings) && info.warnings.length > 0)
        ? (' (' + info.warnings.length + ' aviso)')
        : '';
      dom.ideStatusMessage.textContent = 'Compilado e inyectado en Arduino Uno R3' + warnTxt;
      var flash = Number(info.flashBytes || 0);
      var sram = Number(info.sramBytes || 0);
      var flashPct = Math.min(100, Math.round((flash / 32256) * 100));
      var sramPct = Math.min(100, Math.round((sram / 2048) * 100));
      dom.ideMemoryStats.textContent = 'Flash: ' + flash + ' B (' + flashPct + '%) · SRAM: ' + sram + ' B (' + sramPct + '%)';
    } else {
      dom.ideStatusBar.className = 'ide-status-bar is-error';
      dom.ideStatusMessage.textContent = 'Error: ' + (info.error || 'Fallo de compilación');
      dom.ideMemoryStats.textContent = 'Sin carga';
    }
  }

  function updateSoundButton(enabled) {
    var on = enabled !== false;
    if (dom.soundIcon) dom.soundIcon.textContent = on ? '🔊' : '🔇';
    if (dom.soundLabel) dom.soundLabel.textContent = on ? 'Sonido: ON' : 'Sonido: OFF';
  }

  function renderSerialMonitor(lines) {
    if (!dom.serialOutput) return;
    if (lines.length === state.lastSerialCount) return;
    state.lastSerialCount = lines.length;

    if (dom.serialCount) {
      dom.serialCount.textContent = lines.length + (lines.length === 1 ? ' línea' : ' líneas');
    }

    if (lines.length === 0) {
      dom.serialOutput.innerHTML = '<div class="serial-empty">Esperando datos serie (Serial.begin / Serial.println)...</div>';
      return;
    }

    var startIdx = Math.max(0, lines.length - 180);
    var html = '';
    for (var i = startIdx; i < lines.length; i++) {
      var entry = lines[i];
      var text = typeof entry === 'string' ? entry : (entry.text != null ? entry.text : '');
      var ts = (entry && entry.timeMs != null) ? formatSimClock(entry.timeMs) : '';
      html += '<div class="serial-line">';
      if (ts) html += '<span class="serial-ts">[' + escapeHtml(ts) + ']</span>';
      html += '<span class="serial-text">' + escapeHtml(text) + '</span>';
      html += '</div>';
    }
    dom.serialOutput.innerHTML = html;

    if (!dom.chkSerialAutoscroll || dom.chkSerialAutoscroll.checked) {
      dom.serialOutput.scrollTop = dom.serialOutput.scrollHeight;
    }
  }

  function loadSelectedPreset() {
    var presets = (NS.Sketches && Array.isArray(NS.Sketches.PRESETS)) ? NS.Sketches.PRESETS : [];
    var selId = dom.idePresetSelect ? dom.idePresetSelect.value : '';
    var preset = null;
    for (var i = 0; i < presets.length; i++) {
      if ((presets[i].id || String(i)) === selId) {
        preset = presets[i];
        break;
      }
    }
    if (!preset) return;
    dom.ideEditor.value = preset.code || '';
    dom.ideEditor.dataset.dirty = '1';
    if (dom.ideSketchBadge) {
      dom.ideSketchBadge.textContent = preset.name || 'preset.ino';
    }
    updateLineNumbers();
    showToast('Ejemplo cargado: ' + preset.name + '. Pulsa "Compilar e Inyectar Código".');
  }

  function compileAndUploadSketch() {
    var sim = NS.Simulator;
    if (!sim || typeof sim.loadSketch !== 'function') return;
    var code = dom.ideEditor ? dom.ideEditor.value : '';
    var name = dom.ideSketchBadge ? dom.ideSketchBadge.textContent : 'sketch.ino';

    var result = sim.loadSketch(code, name);
    var simState = sim.getState ? sim.getState() : {};
    var info = (result && result.compileInfo) ? result.compileInfo : (result && typeof result.ok === 'boolean' ? result : simState.compileInfo);
    updateCompileStatus(info);

    if (info && info.ok) {
      delete dom.ideEditor.dataset.dirty;
      if (NS.Scene3D && typeof NS.Scene3D.triggerUploadEffect === 'function') {
        NS.Scene3D.triggerUploadEffect();
      }
      if (!simState.running && typeof sim.start === 'function') {
        sim.start();
      }
      showToast('Código compilado e inyectado en Arduino Uno R3.');
    }
  }

  function openIdeDrawer() {
    if (!dom.ideDrawer) return;
    syncIdeFromSimulator();
    dom.ideDrawer.classList.remove('hidden');
    if (dom.ideEditor) {
      dom.ideEditor.focus();
    }
  }

  function closeIdeDrawer() {
    if (!dom.ideDrawer) return;
    dom.ideDrawer.classList.add('hidden');
  }

  /* ========================================================================
     Barra Superior y Estado Global
     ======================================================================== */

  function syncTopbarStatus(simState) {
    if (!simState) return;
    var running = Boolean(simState.running);
    if (running !== state.lastRunningState) {
      state.lastRunningState = running;
      if (dom.simStatusPill) {
        dom.simStatusPill.classList.toggle('is-running', running);
        dom.simStatusPill.classList.toggle('is-paused', !running);
      }
      if (dom.simStatusText) {
        dom.simStatusText.textContent = running ? 'Ejecutando' : 'Pausado';
      }
      if (dom.playPauseIcon) {
        dom.playPauseIcon.textContent = running ? '⏸' : '▶';
      }
      if (dom.playPauseLabel) {
        dom.playPauseLabel.textContent = running ? 'Pausar' : 'Ejecutar';
      }
    }

    var clockStr = formatSimClock(simState.simTimeMs);
    if (clockStr !== state.lastClockText) {
      state.lastClockText = clockStr;
      if (dom.simClock) {
        dom.simClock.textContent = clockStr;
      }
    }
  }

  function syncWiringBanner(simState) {
    if (!dom.wiringBanner || !NS.Scene3D || typeof NS.Scene3D.getPendingWireStart !== 'function') return;
    var pending = NS.Scene3D.getPendingWireStart();
    if (!pending) {
      dom.wiringBanner.classList.add('hidden');
      return;
    }

    var comps = (simState && simState.components) || [];
    var compLabel = pending.compId;
    for (var i = 0; i < comps.length; i++) {
      if (comps[i].id === pending.compId) {
        compLabel = comps[i].label || comps[i].type;
        break;
      }
    }
    dom.wiringSwatch.style.background = state.activeWireColor;
    dom.wiringText.textContent = 'Cableando desde ' + compLabel + ' · ' + pending.pinId + ' — Selecciona pin destino';
    dom.wiringBanner.classList.remove('hidden');
  }

  function setWireColor(hex) {
    state.activeWireColor = hex;
    if (dom.wireColorPicker) {
      dom.wireColorPicker.querySelectorAll('.wire-swatch').forEach(function (btn) {
        var active = String(btn.getAttribute('data-color')).toUpperCase() === hex.toUpperCase();
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }
    if (NS.Scene3D && typeof NS.Scene3D.setWireModeColor === 'function') {
      NS.Scene3D.setWireModeColor(hex);
    }
  }

  function setCameraView(preset) {
    state.activeView = preset;
    [dom.btnViewIso, dom.btnViewTop, dom.btnViewCenter].forEach(function (btn) {
      if (!btn) return;
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === preset);
    });
    if (NS.Scene3D && typeof NS.Scene3D.setView === 'function') {
      NS.Scene3D.setView(preset);
    }
  }

  /* ========================================================================
     Eventos DOM
     ======================================================================== */

  function bindEvents() {
    if (dom.btnToggleSidebar) {
      dom.btnToggleSidebar.addEventListener('click', function () {
        dom.sidebar.classList.toggle('is-collapsed');
        setTimeout(function () {
          if (NS.Scene3D && typeof NS.Scene3D.resize === 'function') {
            NS.Scene3D.resize();
          }
        }, 210);
      });
    }

    if (dom.catalogSearch) {
      dom.catalogSearch.addEventListener('input', function () {
        renderCatalog(dom.catalogSearch.value);
      });
    }

    if (dom.catalogList) {
      dom.catalogList.addEventListener('click', function (e) {
        var dsBtn = e.target.closest('[data-ds-type]');
        if (dsBtn) {
          e.stopPropagation();
          openDatasheetModal(dsBtn.getAttribute('data-ds-type'));
          return;
        }
        var card = e.target.closest('.catalog-item');
        if (card) {
          handleAddFromCatalog(card.getAttribute('data-type'));
        }
      });

      dom.catalogList.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          var card = e.target.closest('.catalog-item');
          if (card && !e.target.closest('[data-ds-type]')) {
            e.preventDefault();
            handleAddFromCatalog(card.getAttribute('data-type'));
          }
        }
      });
    }

    if (dom.btnPlayPause) {
      dom.btnPlayPause.addEventListener('click', function () {
        var sim = NS.Simulator;
        if (!sim || typeof sim.getState !== 'function') return;
        var st = sim.getState();
        if (st.running) {
          if (typeof sim.pause === 'function') sim.pause();
        } else {
          if (typeof sim.start === 'function') sim.start();
        }
      });
    }

    if (dom.btnReset) {
      dom.btnReset.addEventListener('click', function () {
        var sim = NS.Simulator;
        if (sim && typeof sim.reset === 'function') sim.reset();
        state.lastSerialCount = -1;
        showToast('Simulación reiniciada.');
      });
    }

    if (dom.btnMockup) {
      dom.btnMockup.addEventListener('click', function () {
        var sim = NS.Simulator;
        closeContextMenu();
        if (NS.Scene3D && typeof NS.Scene3D.cancelWire === 'function') NS.Scene3D.cancelWire();
        if (sim && typeof sim.loadInitialMockup === 'function') {
          sim.loadInitialMockup();
          delete dom.ideEditor.dataset.dirty;
          if (dom.idePresetSelect && dom.idePresetSelect.options.length > 0) {
            dom.idePresetSelect.selectedIndex = 0;
          }
          state.lastSerialCount = -1;
          syncIdeFromSimulator();
          setCameraView('iso');
          showToast('Maqueta inicial restaurada.');
        }
      });
    }

    if (dom.btnClear) {
      dom.btnClear.addEventListener('click', function () {
        var sim = NS.Simulator;
        closeContextMenu();
        if (NS.Scene3D && typeof NS.Scene3D.cancelWire === 'function') NS.Scene3D.cancelWire();
        if (sim && typeof sim.clearCircuit === 'function') {
          sim.clearCircuit();
          showToast('Mesa de trabajo limpia.');
        }
      });
    }

    if (dom.wireColorPicker) {
      dom.wireColorPicker.addEventListener('click', function (e) {
        var btn = e.target.closest('.wire-swatch');
        if (btn) {
          setWireColor(btn.getAttribute('data-color'));
        }
      });
    }

    [dom.btnViewIso, dom.btnViewTop, dom.btnViewCenter].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        setCameraView(btn.getAttribute('data-view'));
      });
    });

    if (dom.btnZoomIn) {
      dom.btnZoomIn.addEventListener('click', function () {
        if (NS.Scene3D && typeof NS.Scene3D.zoom === 'function') NS.Scene3D.zoom(1.18);
      });
    }
    if (dom.btnZoomOut) {
      dom.btnZoomOut.addEventListener('click', function () {
        if (NS.Scene3D && typeof NS.Scene3D.zoom === 'function') NS.Scene3D.zoom(0.85);
      });
    }

    if (dom.btnCancelWire) {
      dom.btnCancelWire.addEventListener('click', function () {
        if (NS.Scene3D && typeof NS.Scene3D.cancelWire === 'function') {
          NS.Scene3D.cancelWire();
        }
      });
    }

    if (dom.btnOpenIde) {
      dom.btnOpenIde.addEventListener('click', openIdeDrawer);
    }
    if (dom.btnCloseIde) {
      dom.btnCloseIde.addEventListener('click', closeIdeDrawer);
    }
    if (dom.ideDrawer) {
      dom.ideDrawer.addEventListener('click', function (e) {
        if (e.target === dom.ideDrawer) closeIdeDrawer();
      });
    }

    if (dom.btnLoadPreset) {
      dom.btnLoadPreset.addEventListener('click', loadSelectedPreset);
    }
    if (dom.btnCompileUpload) {
      dom.btnCompileUpload.addEventListener('click', compileAndUploadSketch);
    }

    if (dom.btnToggleSound) {
      dom.btnToggleSound.addEventListener('click', function () {
        var sim = NS.Simulator;
        if (!sim || typeof sim.getState !== 'function' || typeof sim.setSoundEnabled !== 'function') return;
        var next = !sim.getState().soundEnabled;
        sim.setSoundEnabled(next);
        updateSoundButton(next);
      });
    }

    if (dom.btnClearSerial) {
      dom.btnClearSerial.addEventListener('click', function () {
        var sim = NS.Simulator;
        if (sim && typeof sim.clearSerial === 'function') {
          sim.clearSerial();
        } else if (sim && typeof sim.getState === 'function') {
          var st = sim.getState();
          if (Array.isArray(st.serialLines)) st.serialLines.length = 0;
        }
        state.lastSerialCount = -1;
        renderSerialMonitor([]);
      });
    }

    if (dom.ideEditor) {
      dom.ideEditor.addEventListener('input', function () {
        dom.ideEditor.dataset.dirty = '1';
        updateLineNumbers();
      });
      dom.ideEditor.addEventListener('scroll', function () {
        if (dom.ideLineNumbers) {
          dom.ideLineNumbers.scrollTop = dom.ideEditor.scrollTop;
        }
      });
      dom.ideEditor.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var start = dom.ideEditor.selectionStart;
          var end = dom.ideEditor.selectionEnd;
          var val = dom.ideEditor.value;
          dom.ideEditor.value = val.substring(0, start) + '  ' + val.substring(end);
          dom.ideEditor.selectionStart = dom.ideEditor.selectionEnd = start + 2;
          dom.ideEditor.dataset.dirty = '1';
          updateLineNumbers();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          compileAndUploadSketch();
        }
      });
    }

    // Datasheet modal
    if (dom.btnCloseDatasheet) {
      dom.btnCloseDatasheet.addEventListener('click', closeDatasheetModal);
    }
    if (dom.datasheetModal) {
      dom.datasheetModal.addEventListener('click', function (e) {
        if (e.target === dom.datasheetModal) closeDatasheetModal();
      });
    }
    if (dom.dsOpenIdeBtn) {
      dom.dsOpenIdeBtn.addEventListener('click', function () {
        closeDatasheetModal();
        openIdeDrawer();
      });
    }
    document.querySelectorAll('.ds-tab').forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        state.datasheetTab = tabBtn.getAttribute('data-tab') || 'all';
        document.querySelectorAll('.ds-tab').forEach(function (b) {
          var active = b === tabBtn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderDatasheetBody();
      });
    });

    // Cerrar menú contextual al hacer click fuera (izquierdo o derecho en fondo vacío)
    document.addEventListener('pointerdown', function (e) {
      if (dom.contextMenu && !dom.contextMenu.classList.contains('hidden')) {
        if (!dom.contextMenu.contains(e.target)) {
          closeContextMenu();
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (dom.contextMenu && !dom.contextMenu.classList.contains('hidden')) {
          closeContextMenu();
          return;
        }
        if (dom.datasheetModal && !dom.datasheetModal.classList.contains('hidden')) {
          closeDatasheetModal();
          return;
        }
        if (dom.ideDrawer && !dom.ideDrawer.classList.contains('hidden')) {
          closeIdeDrawer();
          return;
        }
        if (NS.Scene3D && typeof NS.Scene3D.cancelWire === 'function') {
          NS.Scene3D.cancelWire();
        }
      }
    });

    window.addEventListener('resize', function () {
      if (NS.Scene3D && typeof NS.Scene3D.resize === 'function') {
        NS.Scene3D.resize();
      }
      if (dom.contextMenu && !dom.contextMenu.classList.contains('hidden')) {
        var r = dom.contextMenu.getBoundingClientRect();
        positionContextMenu(r.left, r.top);
      }
    });
  }

  /* ========================================================================
     Bucle principal de simulación + render 3D
     ======================================================================== */

  function mainLoop(now) {
    var dtMs = state.lastFrameMs ? Math.min(50, Math.max(0, now - state.lastFrameMs)) : 16;
    state.lastFrameMs = now;

    var sim = NS.Simulator;
    var scene = NS.Scene3D;

    if (sim) {
      if (typeof sim.step === 'function') {
        sim.step(dtMs);
      }
      var simState = typeof sim.getState === 'function' ? sim.getState() : null;
      if (scene && typeof scene.render === 'function') {
        scene.render(simState, dtMs);
      }
      if (simState) {
        if (now - state.lastHudTick >= 70) {
          state.lastHudTick = now;
          syncTopbarStatus(simState);
          syncWiringBanner(simState);
          if (dom.ideDrawer && !dom.ideDrawer.classList.contains('hidden')) {
            renderSerialMonitor(simState.serialLines || []);
          }
        }
        if (now - state.lastTelemetryTick >= 110) {
          state.lastTelemetryTick = now;
          updateContextMenuTelemetry();
        }
      }
    }

    state.rafId = global.requestAnimationFrame(mainLoop);
  }

  function initApp() {
    cacheDom();

    var sim = NS.Simulator;
    var scene = NS.Scene3D;

    if (sim && typeof sim.init === 'function') {
      sim.init();
    }
    if (sim && typeof sim.loadInitialMockup === 'function') {
      sim.loadInitialMockup();
    }

    renderCatalog('');
    populatePresets();
    syncIdeFromSimulator();

    if (sim && typeof sim.on === 'function') {
      sim.on('serial', function () {
        if (sim.getState) {
          renderSerialMonitor(sim.getState().serialLines || []);
        }
      });
      sim.on('compile', function () {
        if (sim.getState) {
          updateCompileStatus(sim.getState().compileInfo);
        }
      });
      sim.on('state', function () {
        if (sim.getState) {
          syncTopbarStatus(sim.getState());
        }
      });
    }

    if (scene && typeof scene.init === 'function' && dom.canvas) {
      scene.init(dom.canvas, {
        onHoverPin: updatePinTooltip,
        onPinConnect: function (from, to) {
          if (sim && typeof sim.addWire === 'function') {
            sim.addWire(from, to, state.activeWireColor);
          }
          syncWiringBanner(sim && sim.getState ? sim.getState() : null);
        },
        onMoveComponent: function (compId, pos) {
          if (sim && typeof sim.updateComponentPos === 'function') {
            sim.updateComponentPos(compId, pos);
          }
        },
        onRightClick: handleRightClick,
        onSelect: function () {
          closeContextMenu();
        }
      });
      if (typeof scene.setWireModeColor === 'function') {
        scene.setWireModeColor(state.activeWireColor);
      }
      if (typeof scene.resize === 'function') {
        scene.resize();
      }
    }

    bindEvents();

    if (sim && typeof sim.getState === 'function') {
      var st = sim.getState();
      syncTopbarStatus(st);
      if (typeof sim.start === 'function' && !st.running) {
        sim.start();
      }
    }

    state.lastFrameMs = performance.now();
    state.rafId = global.requestAnimationFrame(mainLoop);
  }

  document.addEventListener('DOMContentLoaded', initApp);

  NS.App = {
    init: initApp,
    openDatasheet: openDatasheetModal,
    openIDE: openIdeDrawer,
    closeContextMenu: closeContextMenu,
    showToast: showToast
  };
})(window);
