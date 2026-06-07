(function() {
  'use strict';

  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var canvasWrapper = document.getElementById('canvasWrapper');
  var bgColorInput = document.getElementById('bgColor');
  var materialPanel = document.getElementById('materialPanel');
  var sizeSlider = document.getElementById('sizeSlider');
  var sizeInput = document.getElementById('sizeInput');
  var levelSlider = document.getElementById('levelSlider');
  var levelInput = document.getElementById('levelInput');
  var lightAngleSlider = document.getElementById('lightAngleSlider');
  var lightAngleInput = document.getElementById('lightAngleInput');
  var shadowLenSlider = document.getElementById('shadowLenSlider');
  var shadowLenInput = document.getElementById('shadowLenInput');
  var presetList = document.getElementById('presetList');
  var gridToggle = document.getElementById('gridToggle');
  var previewModal = document.getElementById('previewModal');
  var previewImage = document.getElementById('previewImage');
  var previewSizeInfo = document.getElementById('previewSizeInfo');
  var confirmExport = document.getElementById('confirmExport');
  var cancelExport = document.getElementById('cancelExport');
  var shortcutModal = document.getElementById('shortcutModal');
  var themeToggle = document.getElementById('themeToggle');
  var shortcutBtn = document.getElementById('shortcutBtn');
  var exportBtn = document.getElementById('exportBtn');
  var loadingHint = document.getElementById('loadingHint');

  var bgMode = 'color';
  var textures = [];
  var placedItems = [];
  var selectedIds = {};
  var nextId = 1;
  var currentTextureIndex = -1;
  var pendingExportDataURL = null;
  var pendingExportFilename = null;
  var showGrid = false;
  var snapTarget = null;

  var history = [];
  var historyIndex = -1;
  var MAX_HISTORY = 80;
  var clipboardBuffer = [];
  var MAX_PRESETS = 5;
  var presets = [];

  var dragData = null;
  var dragStartPositions = null;
  var lowPerformanceMode = false;

  function saveDraft() {
    try {
      var draft = {
        items: placedItems,
        textures: textures.map(function(t) { return t.dataURL; }),
        selected: Object.keys(selectedIds),
        bgMode: bgMode,
        bgColor: bgColorInput.value,
        showGrid: showGrid,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        size: sizeInput.value,
        level: levelInput.value,
        lightAngle: lightAngleInput.value,
        shadowLen: shadowLenInput.value
      };
      localStorage.setItem('pixelblock_draft', JSON.stringify(draft));
    } catch(e) {}
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem('pixelblock_draft');
      if (!raw) return;
      var draft = JSON.parse(raw);
      placedItems = draft.items || [];
      var ids = draft.selected || [];
      selectedIds = {};
      ids.forEach(function(id) { selectedIds[id] = true; });
      bgMode = draft.bgMode || 'color';
      bgColorInput.value = draft.bgColor || '#ffffff';
      showGrid = draft.showGrid || false;
      gridToggle.checked = showGrid;
      if (draft.canvasWidth && draft.canvasHeight) {
        canvas.width = draft.canvasWidth;
        canvas.height = draft.canvasHeight;
        canvas.style.width = draft.canvasWidth + 'px';
        canvas.style.height = draft.canvasHeight + 'px';
      }
      sizeInput.value = draft.size || 32;
      sizeSlider.value = draft.size || 32;
      levelInput.value = draft.level || 2;
      levelSlider.value = draft.level || 2;
      lightAngleInput.value = draft.lightAngle || 135;
      lightAngleSlider.value = draft.lightAngle || 135;
      shadowLenInput.value = draft.shadowLen || 1.5;
      shadowLenSlider.value = draft.shadowLen || 1.5;

      var urls = draft.textures || [];
      if (urls.length === 0) {
        nextId = placedItems.reduce(function(max, item) { return Math.max(max, item.id); }, 0) + 1;
        refreshMaterialPanel();
        drawAll();
        applyBackgroundStyle();
        hideLoading();
        return;
      }
      showLoading();
      var loaded = 0;
      urls.forEach(function(dataURL, idx) {
        var img = new Image();
        img.onload = function() {
          textures[idx] = { img: img, dataURL: dataURL };
          loaded++;
          if (loaded === urls.length) {
            nextId = placedItems.reduce(function(max, item) { return Math.max(max, item.id); }, 0) + 1;
            refreshMaterialPanel();
            drawAll();
            applyBackgroundStyle();
            hideLoading();
          }
        };
        img.src = dataURL;
      });
    } catch(e) {}
  }

  function showLoading() {
    if (loadingHint) loadingHint.style.display = 'block';
  }

  function hideLoading() {
    if (loadingHint) loadingHint.style.display = 'none';
  }

  window.addEventListener('beforeunload', saveDraft);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') saveDraft();
  });

  function loadPresets() {
    try {
      var saved = localStorage.getItem('canvasPresets');
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
    presets.forEach(function(p, idx) {
      var item = document.createElement('div');
      item.className = 'preset-item';
      item.innerHTML = '<span>' + p.w + '×' + p.h + '</span><span class="preset-del" data-index="' + idx + '">×</span>';
      item.addEventListener('click', function(e) {
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

  document.getElementById('savePresetBtn').addEventListener('click', function() {
    if (presets.length >= MAX_PRESETS) {
      alert('最多保存 ' + MAX_PRESETS + ' 个预设');
      return;
    }
    var w = parseInt(document.getElementById('canvasW').value);
    var h = parseInt(document.getElementById('canvasH').value);
    if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return;
    if (w > 900) { alert('画布宽度最大为 900px'); return; }
    presets.push({ w: w, h: h });
    savePresets();
  });

  document.getElementById('clearCanvasBtn').addEventListener('click', function() {
    if (placedItems.length === 0) return;
    saveHistory();
    placedItems = [];
    selectedIds = {};
    drawAll();
    updateUI();
  });

  function drawAll() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showGrid) drawGrid();
    var sorted = placedItems.slice().sort(function(a, b) { return a.level - b.level; });
    var angle = parseFloat(lightAngleInput.value) * Math.PI / 180;
    var shadowFactor = parseFloat(shadowLenInput.value);
    var drawShadow = !lowPerformanceMode;
    sorted.forEach(function(item) {
      drawItem(item, angle, shadowFactor, drawShadow);
    });
    placedItems.forEach(function(item) {
      if (selectedIds[item.id]) {
        ctx.save();
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        ctx.restore();
      }
    });
    if (snapTarget && dragData) {
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      var target = snapTarget.item;
      var edge = snapTarget.edge;
      var x1, y1, x2, y2;
      if (edge === 'left' || edge === 'right' || edge === 'left-to-right' || edge === 'right-to-left') {
        var x = (edge === 'left' || edge === 'left-to-right') ? target.x : target.x + target.w;
        x1 = x; y1 = 0; x2 = x; y2 = canvas.height;
      } else {
        var y = (edge === 'top' || edge === 'top-to-bottom') ? target.y : target.y + target.h;
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
    var step = 20;
    for (var x = 0; x <= canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (var y = 0; y <= canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  gridToggle.addEventListener('change', function() {
    showGrid = gridToggle.checked;
    drawAll();
  });

  function drawItem(item, lightAngle, shadowFactor, drawShadow) {
    var tex = textures[item.textureIndex];
    if (!tex) return;
    ctx.imageSmoothingEnabled = false;
    var x = item.x;
    var y = item.y;
    var w = item.w;
    var h = item.h;
    if (drawShadow) {
      var shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
      var shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;
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
    var count = Object.keys(selectedIds).length;
    if (count === 0) {
      return;
    }
    var firstSelected = null;
    for (var i = 0; i < placedItems.length; i++) {
      if (selectedIds[placedItems[i].id]) {
        firstSelected = placedItems[i];
        break;
      }
    }
    if (!firstSelected) return;
    sizeInput.value = firstSelected.w;
    sizeSlider.value = firstSelected.w;
    levelInput.value = firstSelected.level;
    levelSlider.value = firstSelected.level;
  }

  function applyToSelected(property, value) {
    placedItems.forEach(function(item) {
      if (selectedIds[item.id]) {
        if (property === 'w') {
          item.w = value;
          item.h = value;
        } else {
          item[property] = value;
        }
      }
    });
    drawAll();
  }

  function applyBackgroundStyle() {
    var color = bgColorInput.value;
    if (bgMode === 'transparent') {
      canvasWrapper.style.backgroundColor = 'transparent';
      canvasWrapper.style.backgroundImage = 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 20px 20px';
    } else {
      canvasWrapper.style.backgroundColor = color;
      canvasWrapper.style.backgroundImage = 'none';
    }
  }

  bgColorInput.addEventListener('input', applyBackgroundStyle);
  document.getElementById('colorBgBtn').addEventListener('click', function() {
    bgMode = 'color';
    applyBackgroundStyle();
  });
  document.getElementById('transparentBgBtn').addEventListener('click', function() {
    bgMode = 'transparent';
    applyBackgroundStyle();
  });

  function saveHistory() {
    history.splice(historyIndex + 1, history.length - historyIndex - 1, {
      items: placedItems.map(function(item) { return Object.assign({}, item); }),
      selected: Object.keys(selectedIds)
    });
    historyIndex++;
    if (history.length > MAX_HISTORY) {
      history.shift();
      historyIndex--;
    }
  }

  function restoreHistory(snapshot) {
    placedItems = snapshot.items.map(function(item) { return Object.assign({}, item); });
    selectedIds = {};
    snapshot.selected.forEach(function(id) { selectedIds[id] = true; });
    nextId = placedItems.reduce(function(max, item) { return Math.max(max, item.id); }, 0) + 1;
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
    textures.forEach(function(tex, idx) {
      var wrapper = document.createElement('div');
      wrapper.className = 'mat-item';
      var imgEl = document.createElement('img');
      imgEl.src = tex.dataURL;
      imgEl.title = '材质 ' + (idx + 1);
      imgEl.addEventListener('click', function() {
        var allImgs = materialPanel.querySelectorAll('.mat-item img');
        allImgs.forEach(function(i) { i.classList.remove('selected'); });
        imgEl.classList.add('selected');
        currentTextureIndex = idx;
      });
      imgEl.addEventListener('dblclick', function(e) {
        e.preventDefault();
        if (textures.length === 0) return;
        saveHistory();
        addItemToCanvas(idx);
      });
      if (idx === currentTextureIndex) imgEl.classList.add('selected');

      var delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.textContent = '×';
      delBtn.title = '删除材质';
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (textures.length === 0) return;
        saveHistory();
        var removedIndex = idx;
        textures.splice(removedIndex, 1);
        placedItems = placedItems.filter(function(item) {
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
      var firstImg = materialPanel.querySelector('.mat-item img');
      if (firstImg) firstImg.classList.add('selected');
    }
  }

  document.getElementById('clearMaterialsBtn').addEventListener('click', function() {
    if (textures.length === 0) return;
    saveHistory();
    textures.length = 0;
    placedItems = [];
    selectedIds = {};
    currentTextureIndex = -1;
    refreshMaterialPanel();
    drawAll();
    updateUI();
  });

  function addItemToCanvas(textureIdx) {
    if (textureIdx < 0 || textureIdx >= textures.length) return;
    var size = parseInt(sizeInput.value) || 32;
    var level = parseInt(levelInput.value) || 2;
    var newItem = {
      id: nextId++,
      textureIndex: textureIdx,
      x: canvas.width / 2 - size / 2,
      y: canvas.height / 2 - size / 2,
      w: size,
      h: size,
      level: level
    };
    placedItems.push(newItem);
    selectedIds = {};
    selectedIds[newItem.id] = true;
    drawAll();
    updateUI();
  }

  function getItemAt(mx, my) {
    for (var i = placedItems.length - 1; i >= 0; i--) {
      var it = placedItems[i];
      if (mx >= it.x && mx <= it.x + it.w && my >= it.y && my <= it.y + it.h) return it;
    }
    return null;
  }

  canvas.addEventListener('mousedown', function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var clickedItem = getItemAt(mx, my);
    if (!clickedItem) {
      if (!e.ctrlKey && Object.keys(selectedIds).length > 0) {
        selectedIds = {};
        drawAll();
        updateUI();
      }
      return;
    }
    if (e.ctrlKey) {
      if (selectedIds[clickedItem.id]) {
        delete selectedIds[clickedItem.id];
      } else {
        selectedIds[clickedItem.id] = true;
      }
      drawAll();
      updateUI();
      return;
    }
    if (!selectedIds[clickedItem.id]) {
      selectedIds = {};
      selectedIds[clickedItem.id] = true;
      drawAll();
      updateUI();
    }
    saveHistory();
    dragData = { startX: mx, startY: my };
    dragStartPositions = [];
    placedItems.forEach(function(it) {
      if (selectedIds[it.id]) {
        dragStartPositions.push({ id: it.id, x: it.x, y: it.y });
      }
    });
    snapTarget = null;
    if (placedItems.length > 200) lowPerformanceMode = true;
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!dragData) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var dx = mx - dragData.startX;
    var dy = my - dragData.startY;
    var selectedItems = placedItems.filter(function(it) { return selectedIds[it.id]; });
    snapTarget = null;
    if (e.shiftKey && selectedItems.length > 0) {
      var levelsSet = {};
      selectedItems.forEach(function(it) { levelsSet[it.level] = true; });
      var levels = Object.keys(levelsSet).map(Number);
      if (levels.length === 1) {
        var targetLevel = levels[0];
        var bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        selectedItems.forEach(function(it) {
          bounds.minX = Math.min(bounds.minX, it.x + dx);
          bounds.minY = Math.min(bounds.minY, it.y + dy);
          bounds.maxX = Math.max(bounds.maxX, it.x + it.w + dx);
          bounds.maxY = Math.max(bounds.maxY, it.y + it.h + dy);
        });
        var bestDx = dx, bestDy = dy, minDist = 20;
        var bestOther = null, bestEdge = '';
        placedItems.forEach(function(other) {
          if (selectedIds[other.id] || other.level !== targetLevel) return;
          var tests = [
            { dist: Math.abs(bounds.minX - other.x), dx: other.x - bounds.minX, dy: 0, edge: 'left' },
            { dist: Math.abs(bounds.maxX - (other.x + other.w)), dx: (other.x + other.w) - bounds.maxX, dy: 0, edge: 'right' },
            { dist: Math.abs(bounds.minX - (other.x + other.w)), dx: (other.x + other.w) - bounds.minX, dy: 0, edge: 'left-to-right' },
            { dist: Math.abs(bounds.maxX - other.x), dx: other.x - bounds.maxX, dy: 0, edge: 'right-to-left' },
            { dist: Math.abs(bounds.minY - other.y), dx: 0, dy: other.y - bounds.minY, edge: 'top' },
            { dist: Math.abs(bounds.maxY - (other.y + other.h)), dx: 0, dy: (other.y + other.h) - bounds.maxY, edge: 'bottom' },
            { dist: Math.abs(bounds.minY - (other.y + other.h)), dx: 0, dy: (other.y + other.h) - bounds.minY, edge: 'top-to-bottom' },
            { dist: Math.abs(bounds.maxY - other.y), dx: 0, dy: other.y - bounds.maxY, edge: 'bottom-to-top' }
          ];
          tests.forEach(function(t) {
            if (t.dist < minDist) { minDist = t.dist; bestDx = dx + t.dx; bestDy = dy + t.dy; bestOther = other; bestEdge = t.edge; }
          });
        });
        if (bestOther) { snapTarget = { item: bestOther, edge: bestEdge }; }
        dx = bestDx; dy = bestDy;
      }
    }
    selectedItems.forEach(function(it) {
      var start = dragStartPositions.find(function(p) { return p.id === it.id; });
      if (start) { it.x = start.x + dx; it.y = start.y + dy; }
    });
    drawAll();
  });

  canvas.addEventListener('mouseup', function() {
    dragData = null;
    dragStartPositions = null;
    snapTarget = null;
    lowPerformanceMode = false;
    drawAll();
  });
  canvas.addEventListener('mouseleave', function() {
    dragData = null;
    dragStartPositions = null;
    snapTarget = null;
    lowPerformanceMode = false;
    drawAll();
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      clipboardBuffer = [];
      placedItems.forEach(function(it) {
        if (selectedIds[it.id]) clipboardBuffer.push(Object.assign({}, it));
      });
    }
    else if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      if (clipboardBuffer.length === 0) return;
      saveHistory();
      var newItems = clipboardBuffer.map(function(item) {
        return Object.assign({}, item, { id: nextId++, x: item.x + 30, y: item.y + 30 });
      });
      placedItems = placedItems.concat(newItems);
      selectedIds = {};
      newItems.forEach(function(it) { selectedIds[it.id] = true; });
      drawAll();
      updateUI();
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (Object.keys(selectedIds).length === 0) return;
      saveHistory();
      placedItems = placedItems.filter(function(it) { return !selectedIds[it.id]; });
      selectedIds = {};
      drawAll();
      updateUI();
    }

    var arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrowKeys.includes(e.key) && Object.keys(selectedIds).length > 0) {
      e.preventDefault();
      var step = e.shiftKey ? 10 : 1;
      saveHistory();
      placedItems.forEach(function(item) {
        if (selectedIds[item.id]) {
          if (e.key === 'ArrowUp') item.y -= step;
          if (e.key === 'ArrowDown') item.y += step;
          if (e.key === 'ArrowLeft') item.x -= step;
          if (e.key === 'ArrowRight') item.x += step;
        }
      });
      drawAll();
      updateUI();
    }
  });

  document.getElementById('addBtn').addEventListener('click', function() {
    if (textures.length === 0 || currentTextureIndex < 0) return;
    saveHistory();
    addItemToCanvas(currentTextureIndex);
  });

  document.getElementById('deleteBtn').addEventListener('click', function() {
    if (Object.keys(selectedIds).length === 0) return;
    saveHistory();
    placedItems = placedItems.filter(function(it) { return !selectedIds[it.id]; });
    selectedIds = {};
    drawAll();
    updateUI();
  });

  document.getElementById('upload').addEventListener('change', function(e) {
    var files = Array.from(e.target.files);
    files.forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var dataURL = ev.target.result;
        var img = new Image();
        img.onload = function() {
          if ((img.width === 16 || img.width === 32 || img.width === 64) && img.width === img.height) {
            textures.push({ img: img, dataURL: dataURL });
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
    var val = parseInt(sizeInput.value);
    if (isNaN(val) || val < 1 || val > 512) return;
    sizeSlider.value = val;
    if (Object.keys(selectedIds).length > 0) applyToSelected('w', val);
  }
  function bindLevelChange() {
    var val = parseInt(levelInput.value);
    if (isNaN(val) || val < -50 || val > 50) return;
    levelSlider.value = val;
    if (Object.keys(selectedIds).length > 0) applyToSelected('level', val);
  }

  sizeSlider.addEventListener('mousedown', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
  sizeSlider.addEventListener('input', function() { sizeInput.value = sizeSlider.value; bindSizeChange(); });
  sizeInput.addEventListener('focus', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
  sizeInput.addEventListener('input', bindSizeChange);

  levelSlider.addEventListener('mousedown', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
  levelSlider.addEventListener('input', function() { levelInput.value = levelSlider.value; bindLevelChange(); });
  levelInput.addEventListener('focus', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
  levelInput.addEventListener('input', bindLevelChange);

  lightAngleSlider.addEventListener('input', function() { lightAngleInput.value = lightAngleSlider.value; drawAll(); });
  lightAngleInput.addEventListener('input', function() { lightAngleSlider.value = lightAngleInput.value; drawAll(); });
  shadowLenSlider.addEventListener('input', function() { shadowLenInput.value = shadowLenSlider.value; drawAll(); });
  shadowLenInput.addEventListener('input', function() { shadowLenSlider.value = shadowLenInput.value; drawAll(); });

  function resizeCanvas(w, h) {
    if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return;
    if (w > 900) { alert('画布宽度最大为 900px'); return; }
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(canvas, 0, 0);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0);
    drawAll();
  }

  document.getElementById('resizeCanvasBtn').addEventListener('click', function() {
    var w = parseInt(document.getElementById('canvasW').value);
    var h = parseInt(document.getElementById('canvasH').value);
    resizeCanvas(w, h);
  });

  function getTimeString() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    return '' + y + m + d + hh + mm;
  }

  function showPreview(dataURL) {
    previewImage.src = dataURL;
    previewSizeInfo.textContent = canvas.width + ' x ' + canvas.height + ' 像素';
    previewModal.style.display = 'flex';
  }

  confirmExport.addEventListener('click', function() {
    if (pendingExportDataURL) {
      downloadFile(pendingExportDataURL, pendingExportFilename);
    }
    previewModal.style.display = 'none';
    pendingExportDataURL = null;
    pendingExportFilename = null;
  });

  cancelExport.addEventListener('click', function() {
    previewModal.style.display = 'none';
    pendingExportDataURL = null;
    pendingExportFilename = null;
  });

  function doExport() {
    if (bgMode === 'transparent') {
      var dataURL = canvas.toDataURL('image/png');
      pendingExportDataURL = dataURL;
      pendingExportFilename = getTimeString() + '_透明.png';
      showPreview(dataURL);
    } else {
      var exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      var expCtx = exportCanvas.getContext('2d');
      expCtx.imageSmoothingEnabled = false;
      expCtx.fillStyle = bgColorInput.value;
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      expCtx.drawImage(canvas, 0, 0);
      var dataURL = exportCanvas.toDataURL('image/png');
      pendingExportDataURL = dataURL;
      pendingExportFilename = getTimeString() + '_带背景.png';
      showPreview(dataURL);
    }
  }

  function downloadFile(dataURL, filename) {
    var link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    link.click();
  }

  exportBtn.addEventListener('click', doExport);

  themeToggle.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    var isDark = document.body.classList.contains('dark-theme');
    themeToggle.textContent = isDark ? '浅色模式' : '深色模式';
    localStorage.setItem('darkTheme', isDark);
  });

  if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '浅色模式';
  }

  shortcutBtn.addEventListener('click', function() {
    shortcutModal.style.display = 'flex';
  });
  document.getElementById('closeShortcut').addEventListener('click', function() {
    shortcutModal.style.display = 'none';
  });
  shortcutModal.addEventListener('click', function(e) {
    if (e.target === shortcutModal) shortcutModal.style.display = 'none';
  });
  previewModal.addEventListener('click', function(e) {
    if (e.target === previewModal) {
      previewModal.style.display = 'none';
      pendingExportDataURL = null;
      pendingExportFilename = null;
    }
  });

  loadPresets();
  renderPresets();
  applyBackgroundStyle();
  loadDraft();
})();
