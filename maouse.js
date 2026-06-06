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

  let bgMode = 'checkerboard';
  const textures = [];
  let placedItems = [];
  let selectedIds = new Set();
  let nextId = 1;
  let currentTextureIndex = -1;

  const history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 80;
  let clipboardBuffer = [];

  const MAX_PRESETS = 5;
  let presets = [];

  function loadPresets() {
    try {
      const saved = localStorage.getItem('canvasPresets');
      if (saved) presets = JSON.parse(saved);
      else presets = [];
    } catch (e) {
      presets = [];
    }
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
    if (w > 900) {
      alert('画布宽度最大为 900px');
      return;
    }
    presets.push({ w, h });
    savePresets();
  });

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sorted = [...placedItems].sort((a, b) => a.level - b.level);
    const angle = parseFloat(lightAngleInput.value) * Math.PI / 180;
    const shadowFactor = parseFloat(shadowLenInput.value);
    for (const item of sorted) {
      drawItem(item, angle, shadowFactor);
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
  }

  function drawItem(item, lightAngle, shadowFactor) {
    const tex = textures[item.textureIndex];
    if (!tex) return;
    const { x, y, w, h } = item;

    const shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
    const shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.filter = 'brightness(0)';
    ctx.drawImage(tex.img, x + shadowDX, y + shadowDY, w, h);
    ctx.filter = 'none';
    ctx.restore();
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
    if (historyIndex > 0) {
      historyIndex--;
      restoreHistory(history[historyIndex]);
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      restoreHistory(history[historyIndex]);
    }
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

  let dragData = null;
  let dragStartPositions = null;

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
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragData) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let dx = mx - dragData.startX;
    let dy = my - dragData.startY;
    const selectedItems = placedItems.filter(it => selectedIds.has(it.id));
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
        for (const other of placedItems) {
          if (selectedIds.has(other.id) || other.level !== targetLevel) continue;
          const tests = [
            { dist: Math.abs(bounds.minX - other.x), dx: other.x - bounds.minX, dy: 0 },
            { dist: Math.abs(bounds.maxX - (other.x + other.w)), dx: (other.x + other.w) - bounds.maxX, dy: 0 },
            { dist: Math.abs(bounds.minX - (other.x + other.w)), dx: (other.x + other.w) - bounds.minX, dy: 0 },
            { dist: Math.abs(bounds.maxX - other.x), dx: other.x - bounds.maxX, dy: 0 },
            { dist: Math.abs(bounds.minY - other.y), dx: 0, dy: other.y - bounds.minY },
            { dist: Math.abs(bounds.maxY - (other.y + other.h)), dx: 0, dy: (other.y + other.h) - bounds.maxY },
            { dist: Math.abs(bounds.minY - (other.y + other.h)), dx: 0, dy: (other.y + other.h) - bounds.minY },
            { dist: Math.abs(bounds.maxY - other.y), dx: 0, dy: other.y - bounds.maxY }
          ];
          for (const t of tests) {
            if (t.dist < minDist) { minDist = t.dist; bestDx = dx + t.dx; bestDy = dy + t.dy; }
          }
        }
        dx = bestDx; dy = bestDy;
      }
    }
    for (const it of selectedItems) {
      const start = dragStartPositions.find(p => p.id === it.id);
      if (start) { it.x = start.x + dx; it.y = start.y + dy; }
    }
    drawAll();
  });

  canvas.addEventListener('mouseup', () => { dragData = null; dragStartPositions = null; });
  canvas.addEventListener('mouseleave', () => { dragData = null; dragStartPositions = null; });

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

  function exportTransparent() {
    const dataURL = canvas.toDataURL('image/png');
    downloadFile(dataURL, `${getTimeString()}_透明.png`);
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
    downloadFile(dataURL, `${getTimeString()}_带背景.png`);
  }

  function downloadFile(dataURL, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    link.click();
  }

  document.getElementById('exportTransparentBtn').addEventListener('click', exportTransparent);
  document.getElementById('exportWithBgBtn').addEventListener('click', exportWithBackground);

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
  });

  loadPresets();
  renderPresets();
  applyBackgroundStyle();
  refreshMaterialPanel();
  drawAll();
})();