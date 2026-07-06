/* ===========================================================
   Chroma — Palette Extractor & Contrast Checker
   Vanilla JS. Canvas-based color extraction + WCAG contrast math.
   =========================================================== */

(function () {
  'use strict';

  const STORE_KEY = 'chroma_gallery_v1';

  // -----------------------------------------------------------
  // Color math helpers
  // -----------------------------------------------------------
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        default: h = ((r - g) / d + 4);
      }
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }

  // WCAG relative luminance + contrast ratio
  function relativeLuminance({ r, g, b }) {
    const chan = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrastRatio(hex1, hex2) {
    const l1 = relativeLuminance(hexToRgb(hex1));
    const l2 = relativeLuminance(hexToRgb(hex2));
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // -----------------------------------------------------------
  // View switching
  // -----------------------------------------------------------
  const toplinks = document.querySelectorAll('.toplink');
  const views = document.querySelectorAll('.view');

  toplinks.forEach(link => {
    link.addEventListener('click', () => {
      toplinks.forEach(l => l.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('view-' + link.dataset.view).classList.add('active');
      if (link.dataset.view === 'gallery') renderGallery();
    });
  });

  // -----------------------------------------------------------
  // Toast
  // -----------------------------------------------------------
  const toastEl = document.getElementById('toast');
  let toastTimeout = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(label || 'Copied to clipboard');
    }).catch(() => {
      showToast('Could not copy — select and copy manually');
    });
  }

  // -----------------------------------------------------------
  // Image color extraction
  // -----------------------------------------------------------
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewImg = document.getElementById('previewImg');
  const dropzoneInner = dropzone.querySelector('.dropzone-inner');
  const extractBtn = document.getElementById('extractBtn');
  const swatchCountInput = document.getElementById('swatchCount');
  const swatchCountValue = document.getElementById('swatchCountValue');
  const canvas = document.getElementById('workCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let loadedImage = null;

  swatchCountInput.addEventListener('input', () => {
    swatchCountValue.textContent = swatchCountInput.value;
  });

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        previewImg.src = e.target.result;
        previewImg.hidden = false;
        dropzoneInner.hidden = true;
        extractBtn.disabled = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function extractPaletteFromImage(img, count) {
    const maxDim = 160; // downscale for fast, stable sampling
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const buckets = {};
    const bucketSize = 24; // quantization step per channel

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 125) continue; // skip transparent pixels
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = [
        Math.floor(r / bucketSize),
        Math.floor(g / bucketSize),
        Math.floor(b / bucketSize)
      ].join(',');
      if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
      buckets[key].r += r;
      buckets[key].g += g;
      buckets[key].b += b;
      buckets[key].count += 1;
    }

    const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
    const picked = [];
    for (const bucket of sorted) {
      const color = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count
      };
      // avoid near-duplicate colors
      const isDup = picked.some(p => {
        const dr = p.r - color.r, dg = p.g - color.g, db = p.b - color.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) < 28;
      });
      if (!isDup) picked.push(color);
      if (picked.length >= count) break;
    }

    return picked.map(c => rgbToHex(c.r, c.g, c.b));
  }

  extractBtn.addEventListener('click', () => {
    if (!loadedImage) return;
    const count = parseInt(swatchCountInput.value, 10);
    const hexes = extractPaletteFromImage(loadedImage, count);
    if (hexes.length === 0) {
      showToast('Could not extract colors from this image');
      return;
    }
    renderPalette(hexes);
  });

  // -----------------------------------------------------------
  // Harmony generation
  // -----------------------------------------------------------
  const harmonyButtons = document.querySelectorAll('.harmony-btn');

  function randomHarmony(type) {
    const baseHue = Math.floor(Math.random() * 360);
    const baseSat = 55 + Math.random() * 30;
    let hues = [];

    switch (type) {
      case 'complementary':
        hues = [baseHue, (baseHue + 180) % 360, (baseHue + 180 + 20) % 360, (baseHue + 20) % 360, (baseHue + 200) % 360];
        break;
      case 'analogous':
        hues = [baseHue, (baseHue + 25) % 360, (baseHue + 50) % 360, (baseHue - 25 + 360) % 360, (baseHue - 50 + 360) % 360];
        break;
      case 'triadic':
        hues = [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360, (baseHue + 15) % 360, (baseHue + 135) % 360];
        break;
      case 'monochrome':
        hues = [baseHue, baseHue, baseHue, baseHue, baseHue];
        break;
      default:
        hues = [baseHue];
    }

    return hues.map((h, i) => {
      let s = baseSat;
      let l;
      if (type === 'monochrome') {
        l = 20 + i * (60 / hues.length);
      } else {
        l = 35 + Math.random() * 35;
      }
      const rgb = hslToRgb(h, s, l);
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    });
  }

  harmonyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hexes = randomHarmony(btn.dataset.harmony);
      renderPalette(hexes);
    });
  });

  // -----------------------------------------------------------
  // Palette rendering + swatch interactions
  // -----------------------------------------------------------
  const swatchRow = document.getElementById('swatchRow');
  const emptyHint = document.getElementById('emptyHint');
  let currentPalette = [];
  let lockedIndices = new Set();

  function renderPalette(hexes) {
    currentPalette = hexes;
    lockedIndices = new Set();
    drawSwatches();
    document.getElementById('exportPanel').hidden = true;
  }

  function drawSwatches() {
    swatchRow.innerHTML = '';
    if (currentPalette.length === 0) {
      swatchRow.appendChild(emptyHint);
      return;
    }
    currentPalette.forEach((hex, i) => {
      const card = document.createElement('div');
      card.className = 'swatch-card';

      const colorDiv = document.createElement('div');
      colorDiv.className = 'swatch-color';
      colorDiv.style.background = hex;

      const lockBtn = document.createElement('button');
      lockBtn.className = 'swatch-lock' + (lockedIndices.has(i) ? ' locked' : '');
      lockBtn.textContent = lockedIndices.has(i) ? '🔒' : '🔓';
      lockBtn.title = 'Lock this color when regenerating';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (lockedIndices.has(i)) lockedIndices.delete(i);
        else lockedIndices.add(i);
        drawSwatches();
      });
      colorDiv.appendChild(lockBtn);

      const meta = document.createElement('div');
      meta.className = 'swatch-meta';
      meta.innerHTML = `<span class="swatch-hex">${hex}</span><span class="swatch-copy-hint">Click to copy</span>`;

      card.appendChild(colorDiv);
      card.appendChild(meta);
      card.addEventListener('click', (e) => {
        if (e.target === lockBtn) return;
        copyToClipboard(hex, `Copied ${hex}`);
      });

      swatchRow.appendChild(card);
    });
  }

  // -----------------------------------------------------------
  // Save to gallery
  // -----------------------------------------------------------
  function loadGallery() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveGallery(gallery) {
    localStorage.setItem(STORE_KEY, JSON.stringify(gallery));
  }

  document.getElementById('savePaletteBtn').addEventListener('click', () => {
    if (currentPalette.length === 0) {
      showToast('Nothing to save yet');
      return;
    }
    const gallery = loadGallery();
    gallery.unshift({ id: Date.now(), colors: currentPalette, created: new Date().toISOString() });
    saveGallery(gallery);
    showToast('Palette saved to gallery');
  });

  function renderGallery() {
    const gallery = loadGallery();
    const grid = document.getElementById('galleryGrid');
    const emptyHintEl = document.getElementById('galleryEmptyHint');
    grid.innerHTML = '';
    emptyHintEl.style.display = gallery.length === 0 ? 'block' : 'none';

    gallery.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'gallery-card';

      const strip = document.createElement('div');
      strip.className = 'gallery-strip';
      entry.colors.forEach(hex => {
        const div = document.createElement('div');
        div.style.background = hex;
        strip.appendChild(div);
      });
      strip.addEventListener('click', () => {
        renderPalette(entry.colors);
        toplinks.forEach(l => l.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        document.querySelector('.toplink[data-view="extract"]').classList.add('active');
        document.getElementById('view-extract').classList.add('active');
      });

      const info = document.createElement('div');
      info.className = 'gallery-info';
      const dateLabel = new Date(entry.created).toLocaleDateString();
      info.innerHTML = `<span>${dateLabel}</span>`;
      const delBtn = document.createElement('button');
      delBtn.className = 'gallery-delete';
      delBtn.textContent = '✕ remove';
      delBtn.addEventListener('click', () => {
        const updated = loadGallery().filter(g => g.id !== entry.id);
        saveGallery(updated);
        renderGallery();
      });
      info.appendChild(delBtn);

      card.appendChild(strip);
      card.appendChild(info);
      grid.appendChild(card);
    });
  }

  // -----------------------------------------------------------
  // Export panel
  // -----------------------------------------------------------
  const exportBtn = document.getElementById('exportBtn');
  const exportPanel = document.getElementById('exportPanel');
  const exportCode = document.getElementById('exportCode');
  const exportTabs = document.querySelectorAll('.export-tab');
  let currentExportFormat = 'css';

  function buildExportText(format) {
    if (currentPalette.length === 0) return '';
    if (format === 'css') {
      return ':root {\n' + currentPalette.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n') + '\n}';
    }
    if (format === 'json') {
      return JSON.stringify({ palette: currentPalette }, null, 2);
    }
    if (format === 'tailwind') {
      const obj = currentPalette.reduce((acc, hex, i) => {
        acc[`chroma-${i + 1}`] = hex;
        return acc;
      }, {});
      return 'module.exports = {\n  theme: {\n    extend: {\n      colors: ' +
        JSON.stringify(obj, null, 8).replace(/"/g, "'") +
        '\n      }\n    }\n  }\n};';
    }
    return '';
  }

  exportBtn.addEventListener('click', () => {
    if (currentPalette.length === 0) {
      showToast('Nothing to export yet');
      return;
    }
    exportPanel.hidden = !exportPanel.hidden;
    exportCode.textContent = buildExportText(currentExportFormat);
  });

  exportTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      exportTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentExportFormat = tab.dataset.format;
      exportCode.textContent = buildExportText(currentExportFormat);
    });
  });

  document.getElementById('copyExportBtn').addEventListener('click', () => {
    copyToClipboard(exportCode.textContent, 'Export copied to clipboard');
  });

  // -----------------------------------------------------------
  // Contrast checker
  // -----------------------------------------------------------
  const fgPicker = document.getElementById('fgPicker');
  const bgPicker = document.getElementById('bgPicker');
  const fgHex = document.getElementById('fgHex');
  const bgHex = document.getElementById('bgHex');
  const contrastPreview = document.getElementById('contrastPreview');
  const ratioValue = document.getElementById('ratioValue');

  function isValidHex(hex) {
    return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex);
  }

  function updateContrast() {
    const fg = fgHex.value, bg = bgHex.value;
    if (!isValidHex(fg) || !isValidHex(bg)) return;

    contrastPreview.style.color = fg;
    contrastPreview.style.background = bg;

    const ratio = contrastRatio(fg, bg);
    ratioValue.textContent = ratio.toFixed(2);

    setBadge('badgeAANormal', ratio >= 4.5);
    setBadge('badgeAALarge', ratio >= 3);
    setBadge('badgeAAANormal', ratio >= 7);
    setBadge('badgeAAALarge', ratio >= 4.5);
  }

  function setBadge(id, passed) {
    const el = document.getElementById(id);
    el.classList.toggle('pass', passed);
    el.classList.toggle('fail', !passed);
  }

  fgPicker.addEventListener('input', () => { fgHex.value = fgPicker.value.toUpperCase(); updateContrast(); });
  bgPicker.addEventListener('input', () => { bgHex.value = bgPicker.value.toUpperCase(); updateContrast(); });
  fgHex.addEventListener('input', () => {
    if (isValidHex(fgHex.value)) fgPicker.value = fgHex.value;
    updateContrast();
  });
  bgHex.addEventListener('input', () => {
    if (isValidHex(bgHex.value)) bgPicker.value = bgHex.value;
    updateContrast();
  });

  document.getElementById('swapColorsBtn').addEventListener('click', () => {
    const tempHex = fgHex.value;
    fgHex.value = bgHex.value;
    bgHex.value = tempHex;
    fgPicker.value = fgHex.value;
    bgPicker.value = bgHex.value;
    updateContrast();
  });

  updateContrast();

})();
