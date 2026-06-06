(function() {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const canvasWrapper = document.getElementById('canvasWrapper');
  const bgColorInput = document.getElementById('bgColor');
  const materialPanel = document.getElementById('materialPanel');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeInput = document.getElementById('sizeInput');
  const levelSlider = document.getElementById('levelSlider');
  const levelInput = document.getElementById('levelInput');
  const lightAngleSlider = document.getElementById('lightAngleSlider');
  const lightAngleInput = document.getElementById('lightAngleInput');
  const shadowLenSlider = document.getElementById('shadowLenSlider');
  const shadowLenInput = document.getElementById('shadowLenInput');
  const presetList = document.getElementById('presetList');
  const gridToggle = document.getElementById('gridToggle');
  const previewModal = document.getElementById('previewModal');
  const previewImage = document.getElementById('previewImage');
  const confirmExport = document.getElementById('confirmExport');
  const cancelExport = document.getElementById('cancelExport');
  const shortcutModal = document.getElementById('shortcutModal');
  const themeToggle = document.getElementById('themeToggle');
  const shortcutBtn = document.getElementById('shortcutBtn');

  let bgMode = 'checkerboard';
  const textures = [];
  let placedItems = [];
  let selectedIds = new Set();
  let nextId = 1;
  let currentTextureIndex = -1;
  let pendingExportType = null;
  let showGrid = false;
  let snapTarget = null;

  const history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 80;
  let clipboardBuffer = [];
  const MAX_PRESETS = 5;
  let presets = [];

  let dragData = null;
  let dragStartPositions = null;
  let lowPerformanceMode = false;

  function saveDraft() {
    try {
      const draft = {
        items: placedItems,
        textures: textures.map(t => t.dataURL),
        selected: Array.from(selectedIds),
        bgMode,
        bgColor: bgColorInput.value,
        showGrid
      };
      localStorage.setItem('pixelblock_draft', JSON.stringify(draft));
    } catch(e) {}
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem('pixelblock_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      placedItems = draft.items || [];
      selectedIds = new Set(draft.selected || []);
      bgMode = draft.bgMode || 'checkerboard';
      bgColorInput.value = draft.bgColor || '#ffffff';
      showGrid = draft.showGrid || false;
      gridToggle.checked = showGrid;
      let loaded = 0;
      const urls = draft.textures || [];
      urls.forEach((dataURL, idx) => {
        const img = new Image();
        img.onload = () => {
          textures[idx] = { img, dataURL };
          loaded++;
          if (loaded === urls.length) {
            refreshMaterialPanel();
            drawAll();
            applyBackgroundStyle();
          }
        };
        img.src = dataURL;
      });
      if (urls.length === 0) {
        nextId = placedItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
        refreshMaterialPanel();
        drawAll();
        applyBackgroundStyle();
      }
    } catch(e) {}
  }

  window.addEventListener('beforeunload', saveDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDraft();
  });

  function loadPresets() {
    try {
      const saved = localStorage.getItem('canvasPresets');
      if (saved) presets = JSON.parse(saved);
      else presets = [];
    } catch (e) { presets = []; }
  }

  function savePresets() {
    localStorage.setItem('canvasPresets', JSON.stringify(presets));
    renderPresets();
  }

  function renderPresets() {
    presetList.innerHTML = '';
    presets.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'preset-item';
      item.innerHTML = `<span>${p.w}×${p.h}</span><span class="preset-del" data-index="${idx}">×</span>`;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('preset-del')) {
          e.stopPropagation();
          presets.splice(idx, 1);
          savePresets();
        } else {
          document.getElementById('canvasW').value = p.w;
          document.getElementById('canvasH').value = p.h;
          resizeCanvas(p.w, p.h);
        }
      });
      presetList.appendChild(item);
    });
  }

  document.getElementById('savePresetBtn').addEventListener('click', () => {
    if (presets.length >= MAX_PRESETS) {
      alert(`最多保存 ${MAX_PRESETS} 个预设`);
      return;
    }
    const w = parseInt(document.getElementById('canvasW').value);
    const h = parseInt(document.getElementById('canvasH').value);
    if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return;
    if (w > 900) { alert('画布宽度最大为 900px'); return; }
    presets.push({ w, h });
    savePresets();
  });

  document.getElementById('clearCanvasBtn').addEventListener('click', () => {
    if (placedItems.length === 0) return;
    saveHistory();
    placedItems = [];
    selectedIds.clear();
    drawAll();
    updateUI();
  });

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showGrid) drawGrid();
    const sorted = [...placedItems].sort((a, b) => a.level - b.level);
    const angle = parseFloat(lightAngleInput.value) * Math.PI / 180;
    const shadowFactor = parseFloat(shadowLenInput.value);
    const drawShadow = !lowPerformanceMode;
    for (const item of sorted) {
      drawItem(item, angle, shadowFactor, drawShadow);
    }
    for (const item of placedItems) {
      if (selectedIds.has(item.id)) {
        ctx.save();
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        ctx.restore();
      }
    }
    if (snapTarget && dragData) {
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      const target = snapTarget.item;
      const edge = snapTarget.edge;
      let x1, y1, x2, y2;
      if (edge === 'left' || edge === 'right' || edge === 'left-to-right' || edge === 'right-to-left') {
        const x = (edge === 'left' || edge === 'left-to-right') ? target.x : target.x + target.w;
        x1 = x; y1 = 0; x2 = x; y2 = canvas.height;
      } else {
        const y = (edge === 'top' || edge === 'top-to-bottom') ? target.y : target.y + target.h;
        x1 = 0; y1 = y; x2 = canvas.width; y2 = y;
      }
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    const step = 20;
    for (let x = 0; x <= canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  gridToggle.addEventListener('change', () => {
    showGrid = gridToggle.checked;
    drawAll();
  });

  function drawItem(item, lightAngle, shadowFactor, drawShadow = true) {
    const tex = textures[item.textureIndex];
    if (!tex) return;
    const { x, y, w, h } = item;
    if (drawShadow) {
      const shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
      const shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.filter = 'brightness(0)';
      ctx.drawImage(tex.img, x + shadowDX, y + shadowDY, w, h);
      ctx.filter = 'none';
      ctx.restore();
    }
    ctx.drawImage(tex.img, x, y, w, h);
  }

  function updateUI() {
    if (selectedIds.size === 0) {
      sizeInput.value = 32; sizeSlider.value = 32;
      levelInput.value = 2;  levelSlider.value = 2;
      return;
    }
    const firstSelected = placedItems.find(item => selectedIds.has(item.id));
    if (!firstSelected) return;
    sizeInput.value = firstSelected.w;  sizeSlider.value = firstSelected.w;
    levelInput.value = firstSelected.level; levelSlider.value = firstSelected.level;
  }

  function applyToSelected(property, value) {
    for (const item of placedItems) {
      if (selectedIds.has(item.id)) {
        if (property === 'w') { item.w = value; item.h = value; }
        else item[property] = value;
      }
    }
    drawAll();
  }

  function applyBackgroundStyle() {
    const color = bgColorInput.value;
    if (bgMode === 'transparent') {
      canvasWrapper.style.backgroundColor = 'transparent';
      canvasWrapper.style.backgroundImage = 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 20px 20px';
      return;
    }
    canvasWrapper.style.backgroundColor = color;
    canvasWrapper.style.backgroundImage = `repeating-conic-gradient(${color} 0% 25%, #fff 0% 50%) 50% / 20px 20px`;
  }

  bgColorInput.addEventListener('input', applyBackgroundStyle);
  document.getElementById('checkerBgBtn').addEventListener('click', () => {
    bgMode = 'checkerboard';
    applyBackgroundStyle();
  });
  document.getElementById('transparentBgBtn').addEventListener('click', () => {
    bgMode = 'transparent';
    applyBackgroundStyle();
  });

  function saveHistory() {
    history.splice(historyIndex + 1, history.length - historyIndex - 1, {
      items: placedItems.map(item => ({ ...item })),
      selected: Array.from(selectedIds)
    });
    historyIndex++;
    if (history.length > MAX_HISTORY) {
      history.shift();
      historyIndex--;
    }
  }

  function restoreHistory(snapshot) {
    placedItems = snapshot.items.map(item => ({ ...item }));
    selectedIds = new Set(snapshot.selected);
    nextId = placedItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    drawAll();
    updateUI();
  }

  function undo() {
    if (historyIndex > 0) { historyIndex--; restoreHistory(history[historyIndex]); }
  }
  function redo() {
    if (historyIndex < history.length - 1) { historyIndex++; restoreHistory(history[historyIndex]); }
  }

  function refreshMaterialPanel() {
    materialPanel.innerHTML = '';
    textures.forEach((tex, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mat-item';
      const imgEl = document.createElement('img');
      imgEl.src = tex.dataURL;
      imgEl.title = `材质 ${idx + 1}`;
      imgEl.addEventListener('click', () => {
        document.querySelectorAll('.mat-item img').forEach(i => i.classList.remove('selected'));
        imgEl.classList.add('selected');
        currentTextureIndex = idx;
      });
      imgEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (textures.length === 0) return;
        saveHistory();
        addItemToCanvas(idx);
      });
      if (idx === currentTextureIndex) imgEl.classList.add('selected');

      const delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.textContent = '×';
      delBtn.title = '删除材质';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (textures.length === 0) return;
        saveHistory();
        const removedIndex = idx;
        textures.splice(removedIndex, 1);
        placedItems = placedItems.filter(item => {
          if (item.textureIndex === removedIndex) return false;
          if (item.textureIndex > removedIndex) item.textureIndex--;
          return true;
        });
        if (currentTextureIndex === removedIndex) currentTextureIndex = Math.min(currentTextureIndex, textures.length - 1);
        else if (currentTextureIndex > removedIndex) currentTextureIndex--;
        if (textures.length === 0) currentTextureIndex = -1;
        refreshMaterialPanel();
        drawAll();
        updateUI();
      });
      wrapper.appendChild(imgEl);
      wrapper.appendChild(delBtn);
      materialPanel.appendChild(wrapper);
    });

    if (textures.length === 0) {
      currentTextureIndex = -1;
    } else if (currentTextureIndex === -1) {
      currentTextureIndex = 0;
      const firstImg = materialPanel.querySelector('.mat-item img');
      if (firstImg) firstImg.classList.add('selected');
    }
  }

  document.getElementById('clearMaterialsBtn').addEventListener('click', () => {
    if (textures.length === 0) return;
    saveHistory();
    textures.length = 0;
    placedItems = [];
    selectedIds.clear();
    currentTextureIndex = -1;
    refreshMaterialPanel();
    drawAll();
    updateUI();
  });

  function addItemToCanvas(textureIdx) {
    if (textureIdx < 0 || textureIdx >= textures.length) return;
    const size = parseInt(sizeInput.value) || 32;
    const level = parseInt(levelInput.value) || 2;
    const newItem = {
      id: nextId++,
      textureIndex: textureIdx,
      x: canvas.width / 2 - size / 2,
      y: canvas.height / 2 - size / 2,
      w: size,
      h: size,
      level
    };
    placedItems.push(newItem);
    selectedIds.clear();
    selectedIds.add(newItem.id);
    drawAll();
    updateUI();
  }

  function getItemAt(mx, my) {
    for (let i = placedItems.length - 1; i >= 0; i--) {
      const it = placedItems[i];
      if (mx >= it.x && mx <= it.x + it.w && my >= it.y && my <= it.y + it.h) return it;
    }
    return null;
  }

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const clickedItem = getItemAt(mx, my);
    if (!clickedItem) {
      if (!e.ctrlKey && selectedIds.size > 0) {
        selectedIds.clear();
        drawAll();
        updateUI();
      }
      return;
    }
    if (e.ctrlKey) {
      if (selectedIds.has(clickedItem.id)) selectedIds.delete(clickedItem.id);
      else selectedIds.add(clickedItem.id);
      drawAll();
      updateUI();
      return;
    }
    if (!selectedIds.has(clickedItem.id)) {
      selectedIds.clear();
      selectedIds.add(clickedItem.id);
      drawAll();
      updateUI();
    }
    saveHistory();
    dragData = { startX: mx, startY: my };
    dragStartPositions = placedItems
      .filter(it => selectedIds.has(it.id))
      .map(it => ({ id: it.id, x: it.x, y: it.y }));
    snapTarget = null;
    if (placedItems.length > 200) lowPerformanceMode = true;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragData) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let dx = mx - dragData.startX;
    let dy = my - dragData.startY;
    const selectedItems = placedItems.filter(it => selectedIds.has(it.id));
    snapTarget = null;
    if (e.shiftKey && selectedItems.length > 0) {
      const levels = new Set(selectedItems.map(it => it.level));
      if (levels.size === 1) {
        const targetLevel = [...levels][0];
        let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        for (const it of selectedItems) {
          bounds.minX = Math.min(bounds.minX, it.x + dx);
          bounds.minY = Math.min(bounds.minY, it.y + dy);
          bounds.maxX = Math.max(bounds.maxX, it.x + it.w + dx);
          bounds.maxY = Math.max(bounds.maxY, it.y + it.h + dy);
        }
        let bestDx = dx, bestDy = dy, minDist = 20;
        let bestOther = null, bestEdge = '';
        for (const other of placedItems) {
          if (selectedIds.has(other.id) || other.level !== targetLevel) continue;
          const tests = [
            { dist: Math.abs(bounds.minX - other.x), dx: other.x - bounds.minX, dy: 0, edge: 'left' },
            { dist: Math.abs(bounds.maxX - (other.x + other.w)), dx: (other.x + other.w) - bounds.maxX, dy: 0, edge: 'right' },
            { dist: Math.abs(bounds.minX - (other.x + other.w)), dx: (other.x + other.w) - bounds.minX, dy: 0, edge: 'left-to-right' },
            { dist: Math.abs(bounds.maxX - other.x), dx: other.x - bounds.maxX, dy: 0, edge: 'right-to-left' },
            { dist: Math.abs(bounds.minY - other.y), dx: 0, dy: other.y - bounds.minY, edge: 'top' },
            { dist: Math.abs(bounds.maxY - (other.y + other.h)), dx: 0, dy: (other.y + other.h) - bounds.maxY, edge: 'bottom' },
            { dist: Math.abs(bounds.minY - (other.y + other.h)), dx: 0, dy: (other.y + other.h) - bounds.minY, edge: 'top-to-bottom' },
            { dist: Math.abs(bounds.maxY - other.y), dx: 0, dy: other.y - bounds.maxY, edge: 'bottom-to-top' }
          ];
          for (const t of tests) {
            if (t.dist < minDist) { minDist = t.dist; bestDx = dx + t.dx; bestDy = dy + t.dy; bestOther = other; bestEdge = t.edge; }
          }
        }
        if (bestOther) { snapTarget = { item: bestOther, edge: bestEdge }; }
        dx = bestDx; dy = bestDy;
      }
    }
    for (const it of selectedItems) {
      const start = dragStartPositions.find(p => p.id === it.id);
      if (start) { it.x = start.x + dx; it.y = start.y + dy; }
    }
    drawAll();
  });

  canvas.addEventListener('mouseup', () => {
    dragData = null;
    dragStartPositions = null;
    snapTarget = null;
    lowPerformanceMode = false;
    drawAll();
  });
  canvas.addEventListener('mouseleave', () => {
    dragData = null;
    dragStartPositions = null;
    snapTarget = null;
    lowPerformanceMode = false;
    drawAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      clipboardBuffer = placedItems.filter(it => selectedIds.has(it.id)).map(it => ({ ...it }));
    }
    else if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      if (clipboardBuffer.length === 0) return;
      saveHistory();
      const newItems = clipboardBuffer.map(item => ({
        ...item,
        id: nextId++,
        x: item.x + 30,
        y: item.y + 30
      }));
      placedItems.push(...newItems);
      selectedIds.clear();
      newItems.forEach(it => selectedIds.add(it.id));
      drawAll();
      updateUI();
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (selectedIds.size === 0) return;
      saveHistory();
      placedItems = placedItems.filter(it => !selectedIds.has(it.id));
      selectedIds.clear();
      drawAll();
      updateUI();
    }

    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrowKeys.includes(e.key) && selectedIds.size > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      saveHistory();
      for (const item of placedItems) {
        if (selectedIds.has(item.id)) {
          if (e.key === 'ArrowUp') item.y -= step;
          if (e.key === 'ArrowDown') item.y += step;
          if (e.key === 'ArrowLeft') item.x -= step;
          if (e.key === 'ArrowRight') item.x += step;
        }
      }
      drawAll();
      updateUI();
    }
  });

  document.getElementById('addBtn').addEventListener('click', () => {
    if (textures.length === 0 || currentTextureIndex < 0) return;
    saveHistory();
    addItemToCanvas(currentTextureIndex);
  });

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    saveHistory();
    placedItems = placedItems.filter(it => !selectedIds.has(it.id));
    selectedIds.clear();
    drawAll();
    updateUI();
  });

  document.getElementById('upload').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(ev) {
        const dataURL = ev.target.result;
        const img = new Image();
        img.onload = function() {
          if ((img.width === 16 || img.width === 32 || img.width === 64) && img.width === img.height) {
            textures.push({ img, dataURL });
            if (currentTextureIndex === -1) currentTextureIndex = 0;
            refreshMaterialPanel();
          } else {
            alert('请上传正方形像素图（16×16, 32×32, 64×64）');
          }
        };
        img.src = dataURL;
      };
      reader.readAsDataURL(file);
    });
  });

  function bindSizeChange() {
    const val = parseInt(sizeInput.value);
    if (isNaN(val) || val < 1 || val > 512) return;
    sizeSlider.value = val;
    if (selectedIds.size > 0) applyToSelected('w', val);
  }
  function bindLevelChange() {
    const val = parseInt(levelInput.value);
    if (isNaN(val) || val < -10 || val > 10) return;
    levelSlider.value = val;
    if (selectedIds.size > 0) applyToSelected('level', val);
  }

  sizeSlider.addEventListener('mousedown', () => { if (selectedIds.size > 0) saveHistory(); });
  sizeSlider.addEventListener('input', () => { sizeInput.value = sizeSlider.value; bindSizeChange(); });
  sizeInput.addEventListener('focus', () => { if (selectedIds.size > 0) saveHistory(); });
  sizeInput.addEventListener('input', bindSizeChange);

  levelSlider.addEventListener('mousedown', () => { if (selectedIds.size > 0) saveHistory(); });
  levelSlider.addEventListener('input', () => { levelInput.value = levelSlider.value; bindLevelChange(); });
  levelInput.addEventListener('focus', () => { if (selectedIds.size > 0) saveHistory(); });
  levelInput.addEventListener('input', bindLevelChange);

  lightAngleSlider.addEventListener('input', () => { lightAngleInput.value = lightAngleSlider.value; drawAll(); });
  lightAngleInput.addEventListener('input', () => { lightAngleSlider.value = lightAngleInput.value; drawAll(); });
  shadowLenSlider.addEventListener('input', () => { shadowLenInput.value = shadowLenSlider.value; drawAll(); });
  shadowLenInput.addEventListener('input', () => { shadowLenSlider.value = shadowLenInput.value; drawAll(); });

  function resizeCanvas(w, h) {
    if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return;
    if (w > 900) { alert('画布宽度最大为 900px'); return; }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0);
    drawAll();
  }

  document.getElementById('resizeCanvasBtn').addEventListener('click', () => {
    const w = parseInt(document.getElementById('canvasW').value);
    const h = parseInt(document.getElementById('canvasH').value);
    resizeCanvas(w, h);
  });

  function getTimeString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}${hh}${mm}`;
  }

  function showPreview(dataURL) {
    previewImage.src = dataURL;
    previewModal.style.display = 'flex';
  }

  confirmExport.addEventListener('click', () => {
    if (pendingExportType === 'transparent') {
      downloadFile(previewImage.src, `${getTimeString()}_透明.png`);
    } else if (pendingExportType === 'background') {
      downloadFile(previewImage.src, `${getTimeString()}_带背景.png`);
    }
    previewModal.style.display = 'none';
    pendingExportType = null;
  });

  cancelExport.addEventListener('click', () => {
    previewModal.style.display = 'none';
    pendingExportType = null;
  });

  function exportTransparent() {
    const dataURL = canvas.toDataURL('image/png');
    pendingExportType = 'transparent';
    showPreview(dataURL);
  }

  function exportWithBackground() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    expCtx.imageSmoothingEnabled = false;
    const color = bgColorInput.value;

    if (bgMode === 'transparent') {
      expCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else {
      expCtx.fillStyle = color;
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      const size = 20;
      const light = color, dark = '#ffffff';
      for (let y = 0; y < exportCanvas.height; y += size) {
        for (let x = 0; x < exportCanvas.width; x += size) {
          expCtx.fillStyle = ((x / size + y / size) % 2 === 0) ? light : dark;
          expCtx.fillRect(x, y, size, size);
        }
      }
    }
    expCtx.drawImage(canvas, 0, 0);
    const dataURL = exportCanvas.toDataURL('image/png');
    pendingExportType = 'background';
    showPreview(dataURL);
  }

  function downloadFile(dataURL, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    link.click();
  }

  document.getElementById('exportTransparentBtn').addEventListener('click', exportTransparent);
  document.getElementById('exportWithBgBtn').addEventListener('click', exportWithBackground);

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.textContent = isDark ? '浅色模式' : '深色模式';
    localStorage.setItem('darkTheme', isDark);
  });

  if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '浅色模式';
  }

  shortcutBtn.addEventListener('click', () => {
    shortcutModal.style.display = 'flex';
  });
  document.getElementById('closeShortcut').addEventListener('click', () => {
    shortcutModal.style.display = 'none';
  });
  shortcutModal.addEventListener('click', (e) => {
    if (e.target === shortcutModal) shortcutModal.style.display = 'none';
  });
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) { previewModal.style.display = 'none'; pendingExportType = null; }
  });

  loadPresets();
  renderPresets();
  applyBackgroundStyle();
  loadDraft();
f (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '浅色模式';
  }

  shortcutBtn.addEventListener('click', () => {
    shortcutModal.style.display = 'flex';
  });
  document.getElementById('closeShortcut').addEventListener('click', () => {
    shortcutModal.style.display = 'none';
  });
  shortcutModal.addEventListener('click', (e) => {
    if (e.target === shortcutModal) shortcutModal.style.display = 'none';
  });
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) { previewModal.style.display = 'none'; pendingExportType = null; }
  });

  loadPresets();
  renderPresets();
  applyBackgroundStyle();
  loadDraft();
})();calStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '浅色模式';
  }

  shortcutBtn.addEventListener('click', () => {
    shortcutModal.style.display = 'flex';
  });
  document.getElementById('closeShortcut').addEventListener('click', () => {
    shortcutModal.style.display = 'none';
  });
  shortcutModal.addEventListener('click', (e) => {
    if (e.target === shortcutModal) shortcutModal.style.display = 'none';
  });
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) { previewModal.style.display = 'none'; pendingExportType = null; }
  });

  loadPresets();
  renderPresets();
  applyBackgroundStyle();
  loadDraft();
})();
