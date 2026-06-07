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
  var rotationSlider = document.getElementById('rotationSlider');
  var rotationInput = document.getElementById('rotationInput');
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
  var layerList = document.getElementById('layerList');

  var bgImageInput = document.getElementById('bgImageInput');
  var customBgControls = document.getElementById('customBgControls');
  var bgScaleSlider = document.getElementById('bgScaleSlider');
  var bgScaleInput = document.getElementById('bgScaleInput');
  var bgXSlider = document.getElementById('bgXSlider');
  var bgXInput = document.getElementById('bgXInput');
  var bgYSlider = document.getElementById('bgYSlider');
  var bgYInput = document.getElementById('bgYInput');

  var blurSlider = document.getElementById('blurSlider');
  var blurInput = document.getElementById('blurInput');
  var contrastSlider = document.getElementById('contrastSlider');
  var contrastInput = document.getElementById('contrastInput');
  var brightnessSlider = document.getElementById('brightnessSlider');
  var brightnessInput = document.getElementById('brightnessInput');
  var hueSlider = document.getElementById('hueSlider');
  var hueInput = document.getElementById('hueInput');
  var opacitySlider = document.getElementById('opacitySlider');
  var opacityInput = document.getElementById('opacityInput');

  var textContent = document.getElementById('textContent');
  var textColor = document.getElementById('textColor');
  var textBold = document.getElementById('textBold');
  var textItalic = document.getElementById('textItalic');
  var textLineThrough = document.getElementById('textLineThrough');
  var addTextBtn = document.getElementById('addTextBtn');

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

  var editingItemId = null;
  var resizingItemId = null;
  var resizeStartMouse = null;
  var resizeStartSize = null;

  var bgImage = null;
  var bgImageDataURL = null;
  var bgImageScale = 1;
  var bgImageX = 0;
  var bgImageY = 0;

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
        rotation: rotationInput.value,
        lightAngle: lightAngleInput.value,
        shadowLen: shadowLenInput.value,
        bgImageDataURL: bgImageDataURL,
        bgImageScale: bgImageScale,
        bgImageX: bgImageX,
        bgImageY: bgImageY
      };
      localStorage.setItem('pixelblock_draft', JSON.stringify(draft));
    } catch(e) {
      try {
        if (bgImageDataURL) {
          alert('背景图过大，无法完全保存草稿。背景图将在刷新后丢失。');
          var draftWithoutBg = {
            items: placedItems,
            textures: textures.map(function(t) { return t.dataURL; }),
            selected: Object.keys(selectedIds),
            bgMode: 'color',
            bgColor: bgColorInput.value,
            showGrid: showGrid,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            size: sizeInput.value,
            level: levelInput.value,
            rotation: rotationInput.value,
            lightAngle: lightAngleInput.value,
            shadowLen: shadowLenInput.value,
            bgImageDataURL: null,
            bgImageScale: 1,
            bgImageX: 0,
            bgImageY: 0
          };
          localStorage.setItem('pixelblock_draft', JSON.stringify(draftWithoutBg));
        }
      } catch(e2) {}
    }
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
      rotationInput.value = draft.rotation || 0;
      rotationSlider.value = draft.rotation || 0;
      lightAngleInput.value = draft.lightAngle || 135;
      lightAngleSlider.value = draft.lightAngle || 135;
      shadowLenInput.value = draft.shadowLen || 1.5;
      shadowLenSlider.value = draft.shadowLen || 1.5;
      bgImageScale = draft.bgImageScale || 1;
      bgImageX = draft.bgImageX || 0;
      bgImageY = draft.bgImageY || 0;
      bgScaleSlider.value = bgImageScale;
      bgScaleInput.value = bgImageScale;
      bgXSlider.value = bgImageX;
      bgXInput.value = bgImageX;
      bgYSlider.value = bgImageY;
      bgYInput.value = bgImageY;
      bgImageDataURL = draft.bgImageDataURL || null;

      if (bgMode === 'custom') {
        customBgControls.style.display = 'block';
      } else {
        customBgControls.style.display = 'none';
      }

      var urls = draft.textures || [];
      var totalLoads = urls.length;
      if (bgImageDataURL) totalLoads++;
      if (totalLoads === 0) {
        nextId = placedItems.reduce(function(max, item) { return Math.max(max, item.id); }, 0) + 1;
        placedItems.forEach(function(item) {
          if (item.hidden === undefined) item.hidden = false;
          if (item.rotation === undefined) item.rotation = 0;
          if (!item.filter) item.filter = { blur: 0, contrast: 100, brightness: 100, hue: 0, opacity: 1 };
          if (!item.type) item.type = 'image';
        });
        refreshMaterialPanel();
        drawAll();
        renderLayerPanel();
        applyBackgroundStyle();
        hideLoading();
        return;
      }

      showLoading();
      var loaded = 0;
      function checkAllLoaded() {
        loaded++;
        if (loaded === totalLoads) {
          nextId = placedItems.reduce(function(max, item) { return Math.max(max, item.id); }, 0) + 1;
          placedItems.forEach(function(item) {
            if (item.hidden === undefined) item.hidden = false;
            if (item.rotation === undefined) item.rotation = 0;
            if (!item.filter) item.filter = { blur: 0, contrast: 100, brightness: 100, hue: 0, opacity: 1 };
            if (!item.type) item.type = 'image';
          });
          refreshMaterialPanel();
          drawAll();
          renderLayerPanel();
          applyBackgroundStyle();
          hideLoading();
        }
      }

      if (bgImageDataURL) {
        var img = new Image();
        img.onload = function() {
          bgImage = img;
          checkAllLoaded();
        };
        img.onerror = function() {
          bgImageDataURL = null;
          bgImage = null;
          checkAllLoaded();
        };
        img.src = bgImageDataURL;
      }

      urls.forEach(function(dataURL, idx) {
        var img = new Image();
        img.onload = function() {
          textures[idx] = { img: img, dataURL: dataURL };
          checkAllLoaded();
        };
        img.onerror = function() {
          checkAllLoaded();
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
    if (w > 1200) { alert('画布宽度最大为 1200px'); return; }
    presets.push({ w: w, h: h });
    savePresets();
  });

  document.getElementById('clearCanvasBtn').addEventListener('click', function() {
    if (placedItems.length === 0) return;
    saveHistory();
    placedItems = [];
    selectedIds = {};
    editingItemId = null;
    drawAll();
    renderLayerPanel();
    updateUI();
  });

  function drawAll() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bgMode === 'custom' && bgImage) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      var w = bgImage.width * bgImageScale;
      var h = bgImage.height * bgImageScale;
      ctx.drawImage(bgImage, bgImageX, bgImageY, w, h);
      ctx.restore();
    }

    if (showGrid) drawGrid();
    var sorted = placedItems.slice().sort(function(a, b) { return a.level - b.level; });
    var angle = parseFloat(lightAngleInput.value) * Math.PI / 180;
    var shadowFactor = parseFloat(shadowLenInput.value);
    var drawShadow = !lowPerformanceMode;
    sorted.forEach(function(item) {
      if (!item.hidden) drawItem(item, angle, shadowFactor, drawShadow);
    });
    placedItems.forEach(function(item) {
      if (item.hidden) return;
      if (selectedIds[item.id]) {
        ctx.save();
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        ctx.restore();
      }
    });
    if (editingItemId) {
      var editItem = null;
      for (var i = 0; i < placedItems.length; i++) {
        if (placedItems[i].id === editingItemId) { editItem = placedItems[i]; break; }
      }
      if (editItem) {
        var handleX = editItem.x + editItem.w - 8;
        var handleY = editItem.y + editItem.h - 8;
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.fillRect(handleX, handleY, 8, 8);
        ctx.strokeRect(handleX, handleY, 8, 8);
        ctx.restore();
      }
    }
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

  function buildFilterString(filter) {
    if (!filter) return 'none';
    var parts = [];
    if (filter.blur > 0) parts.push('blur(' + filter.blur + 'px)');
    if (filter.contrast !== 100) parts.push('contrast(' + filter.contrast + '%)');
    if (filter.brightness !== 100) parts.push('brightness(' + filter.brightness + '%)');
    if (filter.hue !== 0) parts.push('hue-rotate(' + filter.hue + 'deg)');
    if (filter.opacity < 1) parts.push('opacity(' + filter.opacity + ')');
    return parts.length === 0 ? 'none' : parts.join(' ');
  }

  function drawItem(item, lightAngle, shadowFactor, drawShadow) {
    if (item.type === 'text') {
      drawTextItem(item, lightAngle, shadowFactor, drawShadow);
      return;
    }
    var tex = textures[item.textureIndex];
    if (!tex) return;
    ctx.imageSmoothingEnabled = false;
    var x = item.x;
    var y = item.y;
    var w = item.w;
    var h = item.h;
    var rot = item.rotation || 0;
    var cx = x + w / 2;
    var cy = y + h / 2;
    var radians = rot * Math.PI / 180;
    var itemOpacity = item.filter ? item.filter.opacity : 1;

    if (drawShadow) {
      var shadowAlpha = 0.3 * itemOpacity;
      var shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
      var shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;
      ctx.save();
      ctx.globalAlpha = shadowAlpha;
      var shadowFilter = 'brightness(0)';
      if (item.filter && item.filter.blur > 0) shadowFilter += ' blur(' + item.filter.blur + 'px)';
      ctx.filter = shadowFilter;
      ctx.translate(cx + shadowDX, cy + shadowDY);
      if (radians !== 0) ctx.rotate(radians);
      ctx.drawImage(tex.img, -w / 2, -h / 2, w, h);
      ctx.filter = 'none';
      ctx.restore();
    }

    ctx.save();
    var filterString = buildFilterString(item.filter);
    if (filterString !== 'none') {
      ctx.filter = filterString;
    }
    ctx.translate(cx, cy);
    if (radians !== 0) ctx.rotate(radians);
    ctx.drawImage(tex.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawTextItem(item, lightAngle, shadowFactor, drawShadow) {
    var x = item.x;
    var y = item.y;
    var w = item.w;
    var h = item.h;
    var fontSize = Math.min(w, h);
    var fontFamily = item.fontFamily || 'Minecraft';
    var fontWeight = item.bold ? 'bold ' : '';
    var fontStyle = item.italic ? 'italic ' : '';
    var fontString = fontStyle + fontWeight + fontSize + 'px ' + fontFamily;
    var textStr = item.text || '';
    var textColorVal = item.color || '#000000';
    var rot = item.rotation || 0;
    var cx = x + w / 2;
    var cy = y + h / 2;
    var radians = rot * Math.PI / 180;
    var itemOpacity = item.filter ? item.filter.opacity : 1;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    if (drawShadow) {
      var shadowAlpha = 0.3 * itemOpacity;
      var shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
      var shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;
      ctx.save();
      ctx.globalAlpha = shadowAlpha;
      ctx.fillStyle = '#000000';
      ctx.font = fontString;
      var shadowFilter = 'none';
      if (item.filter && item.filter.blur > 0) shadowFilter = 'blur(' + item.filter.blur + 'px)';
      ctx.filter = shadowFilter;
      ctx.translate(cx + shadowDX, cy + shadowDY);
      if (radians !== 0) ctx.rotate(radians);
      ctx.fillText(textStr, 0, 0);
      if (item.lineThrough) {
        var textWidth = ctx.measureText(textStr).width;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, fontSize * 0.05);
        ctx.beginPath();
        var lineThroughY = -fontSize * 0.1;
        ctx.moveTo(-textWidth / 2, lineThroughY);
        ctx.lineTo(textWidth / 2, lineThroughY);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    var filterString = buildFilterString(item.filter);
    if (filterString !== 'none') {
      ctx.filter = filterString;
    }
    ctx.fillStyle = textColorVal;
    ctx.font = fontString;
    ctx.translate(cx, cy);
    if (radians !== 0) ctx.rotate(radians);
    ctx.fillText(textStr, 0, 0);
    if (item.lineThrough) {
      var textWidth = ctx.measureText(textStr).width;
      ctx.strokeStyle = textColorVal;
      ctx.lineWidth = Math.max(1, fontSize * 0.05);
      ctx.beginPath();
      var lineThroughY = -fontSize * 0.1;
      ctx.moveTo(-textWidth / 2, lineThroughY);
      ctx.lineTo(textWidth / 2, lineThroughY);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  function updateUI() {
    var count = Object.keys(selectedIds).length;
    if (count === 0) {
      resetFilterUI();
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
    rotationInput.value = firstSelected.rotation || 0;
    rotationSlider.value = firstSelected.rotation || 0;
    updateFilterUI(firstSelected.filter);

    if (firstSelected.type === 'text') {
      textContent.value = firstSelected.text || '';
      textColor.value = firstSelected.color || '#000000';
      textBold.checked = firstSelected.bold || false;
      textItalic.checked = firstSelected.italic || false;
      textLineThrough.checked = firstSelected.lineThrough || false;
    }
  }

  function resetFilterUI() {
    blurSlider.value = 0;
    blurInput.value = 0;
    contrastSlider.value = 100;
    contrastInput.value = 100;
    brightnessSlider.value = 100;
    brightnessInput.value = 100;
    hueSlider.value = 0;
    hueInput.value = 0;
    opacitySlider.value = 1;
    opacityInput.value = 1;
  }

  function updateFilterUI(filter) {
    if (!filter) filter = { blur: 0, contrast: 100, brightness: 100, hue: 0, opacity: 1 };
    blurSlider.value = filter.blur;
    blurInput.value = filter.blur;
    contrastSlider.value = filter.contrast;
    contrastInput.value = filter.contrast;
    brightnessSlider.value = filter.brightness;
    brightnessInput.value = filter.brightness;
    hueSlider.value = filter.hue;
    hueInput.value = filter.hue;
    opacitySlider.value = filter.opacity;
    opacityInput.value = filter.opacity;
  }

  function applyFilterToSelected(property, value) {
    placedItems.forEach(function(item) {
      if (selectedIds[item.id]) {
        if (!item.filter) item.filter = { blur: 0, contrast: 100, brightness: 100, hue: 0, opacity: 1 };
        item.filter[property] = value;
      }
    });
    drawAll();
  }

  function bindFilterChange(property, slider, input) {
    slider.addEventListener('mousedown', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
    slider.addEventListener('input', function() {
      input.value = slider.value;
      applyFilterToSelected(property, parseFloat(slider.value));
    });
    input.addEventListener('focus', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
    input.addEventListener('input', function() {
      var val = parseFloat(input.value);
      if (isNaN(val)) return;
      slider.value = val;
      applyFilterToSelected(property, val);
    });
  }

  bindFilterChange('blur', blurSlider, blurInput);
  bindFilterChange('contrast', contrastSlider, contrastInput);
  bindFilterChange('brightness', brightnessSlider, brightnessInput);
  bindFilterChange('hue', hueSlider, hueInput);
  bindFilterChange('opacity', opacitySlider, opacityInput);

  function applyRotationToSelected(value) {
    placedItems.forEach(function(item) {
      if (selectedIds[item.id]) {
        item.rotation = value;
      }
    });
    drawAll();
  }

  rotationSlider.addEventListener('mousedown', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
  rotationSlider.addEventListener('input', function() {
    rotationInput.value = rotationSlider.value;
    applyRotationToSelected(parseInt(rotationSlider.value));
  });
  rotationInput.addEventListener('focus', function() { if (Object.keys(selectedIds).length > 0) saveHistory(); });
  rotationInput.addEventListener('input', function() {
    var val = parseInt(rotationInput.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 360) val = 360;
    rotationSlider.value = val;
    applyRotationToSelected(val);
  });

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
    renderLayerPanel();
  }

  function applyBackgroundStyle() {
    var color = bgColorInput.value;
    if (bgMode === 'transparent' || bgMode === 'custom') {
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
    bgImageDataURL = null;
    customBgControls.style.display = 'none';
    applyBackgroundStyle();
    drawAll();
  });
  document.getElementById('transparentBgBtn').addEventListener('click', function() {
    bgMode = 'transparent';
    bgImageDataURL = null;
    customBgControls.style.display = 'none';
    applyBackgroundStyle();
    drawAll();
  });
  document.getElementById('customBgBtn').addEventListener('click', function() {
    bgImageInput.click();
  });

  bgImageInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('背景图片不能超过 2MB，否则无法保存草稿。');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataURL = ev.target.result;
      var img = new Image();
      img.onload = function() {
        bgImage = img;
        bgImageDataURL = dataURL;
        bgMode = 'custom';
        customBgControls.style.display = 'block';
        bgScaleSlider.value = 1;
        bgScaleInput.value = 1;
        bgXSlider.value = 0;
        bgXInput.value = 0;
        bgYSlider.value = 0;
        bgYInput.value = 0;
        bgImageScale = 1;
        bgImageX = 0;
        bgImageY = 0;
        applyBackgroundStyle();
        drawAll();
        saveDraft();
      };
      img.src = dataURL;
    };
    reader.readAsDataURL(file);
  });

  bgScaleSlider.addEventListener('input', function() {
    bgScaleInput.value = bgScaleSlider.value;
    bgImageScale = parseFloat(bgScaleSlider.value);
    drawAll();
  });
  bgScaleInput.addEventListener('input', function() {
    var val = parseFloat(bgScaleInput.value);
    if (isNaN(val)) return;
    bgScaleSlider.value = val;
    bgImageScale = val;
    drawAll();
  });
  bgXSlider.addEventListener('input', function() {
    bgXInput.value = bgXSlider.value;
    bgImageX = parseInt(bgXSlider.value);
    drawAll();
  });
  bgXInput.addEventListener('input', function() {
    var val = parseInt(bgXInput.value);
    if (isNaN(val)) return;
    bgXSlider.value = val;
    bgImageX = val;
    drawAll();
  });
  bgYSlider.addEventListener('input', function() {
    bgYInput.value = bgYSlider.value;
    bgImageY = parseInt(bgYSlider.value);
    drawAll();
  });
  bgYInput.addEventListener('input', function() {
    var val = parseInt(bgYInput.value);
    if (isNaN(val)) return;
    bgYSlider.value = val;
    bgImageY = val;
    drawAll();
  });

  addTextBtn.addEventListener('click', function() {
    var text = textContent.value.trim();
    if (!text) return;
    saveHistory();
    var size = parseInt(sizeInput.value) || 32;
    var level = parseInt(levelInput.value) || 2;
    var newItem = {
      id: nextId++,
      type: 'text',
      text: text,
      color: textColor.value,
      bold: textBold.checked,
      italic: textItalic.checked,
      lineThrough: textLineThrough.checked,
      fontFamily: 'Minecraft',
      x: canvas.width / 2 - size / 2,
      y: canvas.height / 2 - size / 2,
      w: size,
      h: size,
      level: level,
      rotation: 0,
      hidden: false,
      filter: { blur: 0, contrast: 100, brightness: 100, hue: 0, opacity: 1 }
    };
    placedItems.push(newItem);
    selectedIds = {};
    selectedIds[newItem.id] = true;
    drawAll();
    renderLayerPanel();
    updateUI();
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
    editingItemId = null;
    drawAll();
    renderLayerPanel();
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
        renderLayerPanel();
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
    editingItemId = null;
    refreshMaterialPanel();
    drawAll();
    renderLayerPanel();
    updateUI();
  });

  function addItemToCanvas(textureIdx) {
    if (textureIdx < 0 || textureIdx >= textures.length) return;
    var size = parseInt(sizeInput.value) || 32;
    var level = parseInt(levelInput.value) || 2;
    var newItem = {
      id: nextId++,
      type: 'image',
      textureIndex: textureIdx,
      x: canvas.width / 2 - size / 2,
      y: canvas.height / 2 - size / 2,
      w: size,
      h: size,
      level: level,
      rotation: 0,
      hidden: false,
      filter: { blur: 0, contrast: 100, brightness: 100, hue: 0, opacity: 1 }
    };
    placedItems.push(newItem);
    selectedIds = {};
    selectedIds[newItem.id] = true;
    drawAll();
    renderLayerPanel();
    updateUI();
  }

  function getItemAt(mx, my) {
    for (var i = placedItems.length - 1; i >= 0; i--) {
      var it = placedItems[i];
      if (it.hidden) continue;
      if (mx >= it.x && mx <= it.x + it.w && my >= it.y && my <= it.y + it.h) return it;
    }
    return null;
  }

  function getResizeHandle(item, mx, my) {
    if (!item) return false;
    var hx = item.x + item.w - 8;
    var hy = item.y + item.h - 8;
    return mx >= hx && mx <= hx + 8 && my >= hy && my <= hy + 8;
  }

  canvas.addEventListener('mousedown', function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    if (editingItemId) {
      var editItem = null;
      for (var i = 0; i < placedItems.length; i++) {
        if (placedItems[i].id === editingItemId) { editItem = placedItems[i]; break; }
      }
      if (editItem && getResizeHandle(editItem, mx, my)) {
        resizingItemId = editingItemId;
        resizeStartMouse = { x: mx, y: my };
        resizeStartSize = { w: editItem.w, h: editItem.h };
        saveHistory();
        e.preventDefault();
        return;
      }
    }

    var clickedItem = getItemAt(mx, my);
    if (!clickedItem) {
      if (!e.ctrlKey && Object.keys(selectedIds).length > 0) {
        selectedIds = {};
        editingItemId = null;
        drawAll();
        renderLayerPanel();
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
      renderLayerPanel();
      updateUI();
      return;
    }
    if (!selectedIds[clickedItem.id]) {
      selectedIds = {};
      selectedIds[clickedItem.id] = true;
      drawAll();
      renderLayerPanel();
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
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    if (resizingItemId) {
      var item = null;
      for (var i = 0; i < placedItems.length; i++) {
        if (placedItems[i].id === resizingItemId) { item = placedItems[i]; break; }
      }
      if (item && resizeStartMouse && resizeStartSize) {
        var dx = mx - resizeStartMouse.x;
        var dy = my - resizeStartMouse.y;
        var newSize = Math.max(8, Math.min(512, resizeStartSize.w + Math.max(dx, dy)));
        item.w = newSize;
        item.h = newSize;
        drawAll();
      }
      return;
    }

    if (!dragData) return;
    var dx = mx - dragData.startX;
    var dy = my - dragData.startY;
    var selectedItems = placedItems.filter(function(it) { return selectedIds[it.id] && !it.hidden; });
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
          if (other.hidden) return;
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
    if (resizingItemId) {
      resizingItemId = null;
      resizeStartMouse = null;
      resizeStartSize = null;
      drawAll();
      renderLayerPanel();
    }
    dragData = null;
    dragStartPositions = null;
    snapTarget = null;
    lowPerformanceMode = false;
    drawAll();
  });

  canvas.addEventListener('mouseleave', function() {
    if (resizingItemId) {
      resizingItemId = null;
      resizeStartMouse = null;
      resizeStartSize = null;
      drawAll();
      renderLayerPanel();
    }
    dragData = null;
    dragStartPositions = null;
    snapTarget = null;
    lowPerformanceMode = false;
    drawAll();
  });

  canvas.addEventListener('dblclick', function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var item = getItemAt(mx, my);
    if (item) {
      editingItemId = item.id;
      selectedIds = {};
      selectedIds[item.id] = true;
      drawAll();
      renderLayerPanel();
      updateUI();
    } else {
      if (editingItemId) {
        editingItemId = null;
        drawAll();
      }
    }
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
        var copy = Object.assign({}, item);
        copy.id = nextId++;
        copy.x = copy.x + 30;
        copy.y = copy.y + 30;
        copy.filter = Object.assign({}, item.filter);
        return copy;
      });
      placedItems = placedItems.concat(newItems);
      selectedIds = {};
      newItems.forEach(function(it) { selectedIds[it.id] = true; });
      drawAll();
      renderLayerPanel();
      updateUI();
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (Object.keys(selectedIds).length === 0) return;
      saveHistory();
      placedItems = placedItems.filter(function(it) { return !selectedIds[it.id]; });
      if (editingItemId && !placedItems.some(function(it) { return it.id === editingItemId; })) {
        editingItemId = null;
      }
      selectedIds = {};
      drawAll();
      renderLayerPanel();
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
      renderLayerPanel();
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
    if (editingItemId && !placedItems.some(function(it) { return it.id === editingItemId; })) {
      editingItemId = null;
    }
    selectedIds = {};
    drawAll();
    renderLayerPanel();
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
    if (w > 1200) { alert('画布宽度最大为 1200px'); return; }
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
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;

    if (bgMode === 'custom' && bgImage) {
      tempCtx.save();
      tempCtx.imageSmoothingEnabled = false;
      var w = bgImage.width * bgImageScale;
      var h = bgImage.height * bgImageScale;
      tempCtx.drawImage(bgImage, bgImageX, bgImageY, w, h);
      tempCtx.restore();
    } else if (bgMode === 'color') {
      tempCtx.fillStyle = bgColorInput.value;
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    var sorted = placedItems.slice().sort(function(a, b) { return a.level - b.level; });
    var angle = parseFloat(lightAngleInput.value) * Math.PI / 180;
    var shadowFactor = parseFloat(shadowLenInput.value);
    sorted.forEach(function(item) {
      if (item.hidden) return;
      if (item.type === 'text') {
        drawTextItemToCtx(tempCtx, item, angle, shadowFactor);
      } else {
        drawImageItemToCtx(tempCtx, item, angle, shadowFactor);
      }
    });

    var dataURL = tempCanvas.toDataURL('image/png');
    if (bgMode === 'transparent') {
      pendingExportFilename = getTimeString() + '_透明.png';
    } else if (bgMode === 'custom') {
      pendingExportFilename = getTimeString() + '_自定义背景.png';
    } else {
      pendingExportFilename = getTimeString() + '_带背景.png';
    }
    pendingExportDataURL = dataURL;
    showPreview(dataURL);
  }

  function drawImageItemToCtx(ctx, item, lightAngle, shadowFactor) {
    var tex = textures[item.textureIndex];
    if (!tex) return;
    var x = item.x, y = item.y, w = item.w, h = item.h, rot = item.rotation || 0;
    var cx = x + w / 2, cy = y + h / 2, radians = rot * Math.PI / 180;
    var itemOpacity = item.filter ? item.filter.opacity : 1;

    var shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
    var shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;
    ctx.save();
    ctx.globalAlpha = 0.3 * itemOpacity;
    var shadowFilter = 'brightness(0)';
    if (item.filter && item.filter.blur > 0) shadowFilter += ' blur(' + item.filter.blur + 'px)';
    ctx.filter = shadowFilter;
    ctx.translate(cx + shadowDX, cy + shadowDY);
    if (radians !== 0) ctx.rotate(radians);
    ctx.drawImage(tex.img, -w / 2, -h / 2, w, h);
    ctx.filter = 'none';
    ctx.restore();

    ctx.save();
    var filterString = buildFilterString(item.filter);
    if (filterString !== 'none') {
      ctx.filter = filterString;
    }
    ctx.translate(cx, cy);
    if (radians !== 0) ctx.rotate(radians);
    ctx.drawImage(tex.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawTextItemToCtx(ctx, item, lightAngle, shadowFactor) {
    var x = item.x, y = item.y, w = item.w, h = item.h;
    var fontSize = Math.min(w, h);
    var fontFamily = item.fontFamily || 'Minecraft';
    var fontWeight = item.bold ? 'bold ' : '';
    var fontStyle = item.italic ? 'italic ' : '';
    var fontString = fontStyle + fontWeight + fontSize + 'px ' + fontFamily;
    var textStr = item.text || '';
    var textColorVal = item.color || '#000000';
    var rot = item.rotation || 0;
    var cx = x + w / 2, cy = y + h / 2, radians = rot * Math.PI / 180;
    var itemOpacity = item.filter ? item.filter.opacity : 1;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    var shadowAlpha = 0.3 * itemOpacity;
    var shadowDX = Math.cos(lightAngle) * 20 * shadowFactor;
    var shadowDY = -Math.sin(lightAngle) * 20 * shadowFactor;
    ctx.save();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = '#000000';
    ctx.font = fontString;
    var shadowFilter = 'none';
    if (item.filter && item.filter.blur > 0) shadowFilter = 'blur(' + item.filter.blur + 'px)';
    ctx.filter = shadowFilter;
    ctx.translate(cx + shadowDX, cy + shadowDY);
    if (radians !== 0) ctx.rotate(radians);
    ctx.fillText(textStr, 0, 0);
    if (item.lineThrough) {
      var textWidth = ctx.measureText(textStr).width;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, fontSize * 0.05);
      ctx.beginPath();
      var lineThroughY = -fontSize * 0.1;
      ctx.moveTo(-textWidth / 2, lineThroughY);
      ctx.lineTo(textWidth / 2, lineThroughY);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    var filterString = buildFilterString(item.filter);
    if (filterString !== 'none') {
      ctx.filter = filterString;
    }
    ctx.fillStyle = textColorVal;
    ctx.font = fontString;
    ctx.translate(cx, cy);
    if (radians !== 0) ctx.rotate(radians);
    ctx.fillText(textStr, 0, 0);
    if (item.lineThrough) {
      var textWidth = ctx.measureText(textStr).width;
      ctx.strokeStyle = textColorVal;
      ctx.lineWidth = Math.max(1, fontSize * 0.05);
      ctx.beginPath();
      var lineThroughY = -fontSize * 0.1;
      ctx.moveTo(-textWidth / 2, lineThroughY);
      ctx.lineTo(textWidth / 2, lineThroughY);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
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

  function renderLayerPanel() {
    if (!layerList) return;
    var levelMap = {};
    placedItems.forEach(function(item) {
      if (!levelMap[item.level]) levelMap[item.level] = [];
      levelMap[item.level].push(item);
    });
    var levels = Object.keys(levelMap).map(Number).sort(function(a, b) { return b - a; });
    layerList.innerHTML = '';
    levels.forEach(function(level) {
      var group = document.createElement('div');
      group.className = 'layer-group';
      group.draggable = true;
      group.dataset.level = level;

      group.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', level);
        e.dataTransfer.effectAllowed = 'move';
      });
      group.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        group.classList.add('drag-over');
      });
      group.addEventListener('dragleave', function() {
        group.classList.remove('drag-over');
      });
      group.addEventListener('drop', function(e) {
        e.preventDefault();
        group.classList.remove('drag-over');
        var fromLevel = parseInt(e.dataTransfer.getData('text/plain'));
        if (fromLevel === level) return;
        placedItems.forEach(function(item) {
          if (item.level === fromLevel) {
            item.level = level;
          } else if (item.level === level) {
            item.level = fromLevel;
          }
        });
        saveHistory();
        drawAll();
        renderLayerPanel();
        updateUI();
      });

      var levelLabel = document.createElement('span');
      levelLabel.className = 'layer-level';
      levelLabel.textContent = level;
      group.appendChild(levelLabel);

      var thumbsDiv = document.createElement('div');
      thumbsDiv.className = 'layer-thumbs';
      levelMap[level].forEach(function(item) {
        if (item.type === 'text') {
          var textSpan = document.createElement('span');
          textSpan.textContent = item.text;
          textSpan.className = 'layer-thumb layer-text-thumb';
          textSpan.style.display = 'inline-block';
          textSpan.style.width = '24px';
          textSpan.style.height = '24px';
          textSpan.style.lineHeight = '24px';
          textSpan.style.textAlign = 'center';
          textSpan.style.fontSize = '10px';
          textSpan.style.overflow = 'hidden';
          textSpan.style.whiteSpace = 'nowrap';
          textSpan.style.textOverflow = 'ellipsis';
          textSpan.style.background = '#ddd';
          textSpan.style.border = '1px solid transparent';
          textSpan.style.imageRendering = 'pixelated';
          if (selectedIds[item.id]) textSpan.classList.add('selected');
          if (item.hidden) textSpan.classList.add('hidden');

          textSpan.addEventListener('click', function(e) {
            e.stopPropagation();
            if (e.ctrlKey) {
              if (selectedIds[item.id]) delete selectedIds[item.id];
              else selectedIds[item.id] = true;
            } else {
              selectedIds = {};
              selectedIds[item.id] = true;
            }
            drawAll();
            renderLayerPanel();
            updateUI();
          });

          textSpan.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            e.preventDefault();
            textSpan.contentEditable = true;
            textSpan.focus();
            var range = document.createRange();
            range.selectNodeContents(textSpan);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            textSpan.addEventListener('blur', function finishEdit() {
              textSpan.contentEditable = false;
              var newText = textSpan.textContent.trim();
              if (newText && newText !== item.text) {
                saveHistory();
                item.text = newText;
                drawAll();
                renderLayerPanel();
                updateUI();
              } else if (newText === '') {
                textSpan.textContent = item.text;
              }
              textSpan.removeEventListener('blur', finishEdit);
            });

            textSpan.addEventListener('keydown', function(ev) {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                textSpan.blur();
              }
            });
          });

          var eyeBtn = document.createElement('button');
          eyeBtn.className = 'eye-btn';
          eyeBtn.textContent = item.hidden ? '👁‍🗨' : '👁';
          eyeBtn.title = '显示/隐藏';
          eyeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            item.hidden = !item.hidden;
            drawAll();
            renderLayerPanel();
          });
          var thumbWrapper = document.createElement('span');
          thumbWrapper.style.display = 'inline-flex';
          thumbWrapper.style.alignItems = 'center';
          thumbWrapper.appendChild(textSpan);
          thumbWrapper.appendChild(eyeBtn);
          thumbsDiv.appendChild(thumbWrapper);
        } else {
          var thumb = document.createElement('img');
          var tex = textures[item.textureIndex];
          if (tex) thumb.src = tex.dataURL;
          thumb.className = 'layer-thumb';
          if (selectedIds[item.id]) thumb.classList.add('selected');
          if (item.hidden) thumb.classList.add('hidden');
          thumb.addEventListener('click', function(e) {
            e.stopPropagation();
            if (e.ctrlKey) {
              if (selectedIds[item.id]) delete selectedIds[item.id];
              else selectedIds[item.id] = true;
            } else {
              selectedIds = {};
              selectedIds[item.id] = true;
            }
            drawAll();
            renderLayerPanel();
            updateUI();
          });
          var eyeBtn = document.createElement('button');
          eyeBtn.className = 'eye-btn';
          eyeBtn.textContent = item.hidden ? '👁‍🗨' : '👁';
          eyeBtn.title = '显示/隐藏';
          eyeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            item.hidden = !item.hidden;
            drawAll();
            renderLayerPanel();
          });
          var thumbWrapper = document.createElement('span');
          thumbWrapper.style.display = 'inline-flex';
          thumbWrapper.style.alignItems = 'center';
          thumbWrapper.appendChild(thumb);
          thumbWrapper.appendChild(eyeBtn);
          thumbsDiv.appendChild(thumbWrapper);
        }
      });
      group.appendChild(thumbsDiv);
      layerList.appendChild(group);
    });
  }

  loadPresets();
  renderPresets();
  applyBackgroundStyle();
  loadDraft();
  document.fonts.ready.then(function() { drawAll(); });
})();
