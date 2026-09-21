import './styles.css';

const GAP = 2;
const state = { items: [], draggedId: null, output: null, backgroundMode: 'auto', backgroundColor: '#ffffff', gridColumns: 3 };
const A3_WIDTH = 3508;
const A3_HEIGHT = 2480;
const albumState = {
  items: [], draggedId: null, output: null, notice: '', activePage: 0, pageCopy: [], layoutVariants: [],
  backgroundMode: 'auto', backgroundColor: '#ffffff', pageSize: 'auto', textPositions: [], textStyles: [], textTarget: 'title', hitRegions: [], textRegions: [],
  selectedItemId: null, canvasDrag: null,
};

const els = {
  fileInput: document.querySelector('#fileInput'),
  dropzone: document.querySelector('#dropzone'),
  queue: document.querySelector('#queue'),
  imageCount: document.querySelector('#imageCount'),
  clearButton: document.querySelector('#clearButton'),
  downloadButton: document.querySelector('#downloadButton'),
  previewFrame: document.querySelector('#previewFrame'),
  canvas: document.querySelector('#resultCanvas'),
  backgroundColor: document.querySelector('#backgroundColor'),
  backgroundSwatch: document.querySelector('#backgroundSwatch'),
  backgroundValue: document.querySelector('#backgroundValue'),
  layoutControl: document.querySelector('.layout-control'),
  oneColumnButton: document.querySelector('#oneColumnButton'),
  threeColumnButton: document.querySelector('#threeColumnButton'),
  toolNavButtons: document.querySelectorAll('[data-workspace]'),
  composerWorkspace: document.querySelector('#composerWorkspace'),
  albumWorkspace: document.querySelector('#albumWorkspace'),
  albumFileInput: document.querySelector('#albumFileInput'),
  albumDropzone: document.querySelector('#albumDropzone'),
  albumQueue: document.querySelector('#albumQueue'),
  albumStatus: document.querySelector('#albumStatus'),
  albumClearButton: document.querySelector('#albumClearButton'),
  albumTitle: document.querySelector('#albumTitle'),
  albumCopy: document.querySelector('#albumCopy'),
  albumAutoBackground: document.querySelector('#albumAutoBackground'),
  albumManualBackground: document.querySelector('#albumManualBackground'),
  albumBackgroundColor: document.querySelector('#albumBackgroundColor'),
  albumBackgroundSwatch: document.querySelector('#albumBackgroundSwatch'),
  albumBackgroundValue: document.querySelector('#albumBackgroundValue'),
  albumTextControl: document.querySelector('#albumTextControl'),
  albumTextTitleTarget: document.querySelector('#albumTextTitleTarget'),
  albumTextCopyTarget: document.querySelector('#albumTextCopyTarget'),
  albumFontFamily: document.querySelector('#albumFontFamily'),
  albumFontWeight: document.querySelector('#albumFontWeight'),
  albumFontSize: document.querySelector('#albumFontSize'),
  albumFontSizeValue: document.querySelector('#albumFontSizeValue'),
  albumFontColor: document.querySelector('#albumFontColor'),
  albumFontColorSwatch: document.querySelector('#albumFontColorSwatch'),
  albumEditControl: document.querySelector('#albumEditControl'),
  albumSelectionLabel: document.querySelector('#albumSelectionLabel'),
  albumScaleRange: document.querySelector('#albumScaleRange'),
  albumScaleValue: document.querySelector('#albumScaleValue'),
  albumRotateLeft: document.querySelector('#albumRotateLeft'),
  albumRotateRight: document.querySelector('#albumRotateRight'),
  albumResetTransform: document.querySelector('#albumResetTransform'),
  albumPageSize: document.querySelector('#albumPageSize'),
  albumLayoutName: document.querySelector('#albumLayoutName'),
  albumDownloadButton: document.querySelector('#albumDownloadButton'),
  albumExportNote: document.querySelector('#albumExportNote'),
  albumPreviousPage: document.querySelector('#albumPreviousPage'),
  albumNextPage: document.querySelector('#albumNextPage'),
  albumPageValue: document.querySelector('#albumPageValue'),
  albumPreviewFrame: document.querySelector('#albumPreviewFrame'),
  albumCanvas: document.querySelector('#albumCanvas'),
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const isImageFile = (file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name);

function addFiles(fileList) {
  const files = [...fileList].filter(isImageFile);
  files.forEach((file) => {
    state.items.push({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      image: null,
      width: 0,
      height: 0,
    });
  });
  if (files.length) {
    renderQueue();
    Promise.all(state.items.slice(-files.length).map(loadImage)).then(compose);
  }
  els.fileInput.value = '';
}

function loadImage(item) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      item.image = image;
      item.width = image.naturalWidth;
      item.height = image.naturalHeight;
      resolve(item);
      renderQueue();
      compose();
    };
    image.onerror = resolve;
    image.src = item.url;
  });
}

function removeItem(id) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  URL.revokeObjectURL(state.items[index].url);
  state.items.splice(index, 1);
  renderQueue();
  compose();
}

function clearAll() {
  state.items.forEach((item) => URL.revokeObjectURL(item.url));
  state.items = [];
  state.output = null;
  renderQueue();
  compose();
}

function moveItem(sourceId, targetId) {
  const from = state.items.findIndex((item) => item.id === sourceId);
  const to = state.items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = state.items.splice(from, 1);
  state.items.splice(to, 0, item);
  renderQueue();
  compose();
}

function getThemeColor(items) {
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sampleCanvas.width = 24;
  sampleCanvas.height = 24;
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;

  items.forEach((item) => {
    sampleContext.clearRect(0, 0, 24, 24);
    sampleContext.drawImage(item.image, 0, 0, 24, 24);
    const pixels = sampleContext.getImageData(0, 0, 24, 24).data;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.2) continue;
      const pixelRed = pixels[index];
      const pixelGreen = pixels[index + 1];
      const pixelBlue = pixels[index + 2];
      // Down-weight near-white pixels so a mostly white image can still contribute its accent color.
      const chroma = Math.max(pixelRed, pixelGreen, pixelBlue) - Math.min(pixelRed, pixelGreen, pixelBlue);
      const pixelWeight = alpha * (chroma > 14 ? 1.4 : 0.65);
      red += pixelRed * pixelWeight;
      green += pixelGreen * pixelWeight;
      blue += pixelBlue * pixelWeight;
      weight += pixelWeight;
    }
  });

  if (!weight) return '#ffffff';
  // Blend toward white to create a calm canvas color while preserving the image's hue.
  const blend = (value) => Math.round(value / weight * 0.2 + 255 * 0.8);
  const toHex = (value) => value.toString(16).padStart(2, '0');
  return `#${toHex(blend(red))}${toHex(blend(green))}${toHex(blend(blue))}`;
}

function renderQueue() {
  els.imageCount.textContent = state.items.length;
  els.clearButton.disabled = state.items.length === 0;
  els.downloadButton.disabled = !state.output;
  if (!state.items.length) {
    els.queue.className = 'queue empty-state';
    els.queue.innerHTML = '<div class="empty-queue"><span aria-hidden="true">▧</span><p>还没有图片</p><small>先把几张图片放进来吧</small></div>';
    return;
  }
  els.queue.className = 'queue';
  els.queue.innerHTML = state.items.map((item, index) => `
    <div class="queue-item" draggable="true" data-id="${item.id}">
      <div class="queue-thumb">${item.image ? `<img src="${item.url}" alt="" />` : ''}</div>
      <div class="queue-info">
        <div class="queue-name" title="${item.file.name}">${index + 1}. ${item.file.name}</div>
        <div class="queue-meta">${item.width ? `${item.width} × ${item.height}` : '读取中'} · ${formatBytes(item.file.size)}</div>
      </div>
      <div class="queue-actions"><span class="drag-handle" aria-hidden="true">⠿</span><button class="remove-button" type="button" data-remove="${item.id}" aria-label="移除 ${item.file.name}">×</button></div>
    </div>`).join('');
  els.queue.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => removeItem(button.dataset.remove)));
  els.queue.querySelectorAll('.queue-item').forEach((item) => {
    item.addEventListener('dragstart', () => { state.draggedId = item.dataset.id; item.classList.add('is-dragging'); });
    item.addEventListener('dragend', () => { state.draggedId = null; item.classList.remove('is-dragging'); els.queue.querySelectorAll('.drag-target').forEach((el) => el.classList.remove('drag-target')); });
    item.addEventListener('dragover', (event) => { event.preventDefault(); if (state.draggedId !== item.dataset.id) item.classList.add('drag-target'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
    item.addEventListener('drop', (event) => { event.preventDefault(); item.classList.remove('drag-target'); moveItem(state.draggedId, item.dataset.id); });
  });
}

function getComposition() {
  const ready = state.items.filter((item) => item.image);
  if (!ready.length) return null;
  const allSquares = ready.length === state.items.length && ready.every((item) => item.width === item.height);
  if (!allSquares) {
    const width = ready[0].width;
    const heights = ready.map((item) => Math.round(item.height * width / item.width));
    return {
      ready,
      mode: 'column',
      width,
      height: heights.reduce((sum, value) => sum + value, 0) + GAP * (ready.length - 1),
      heights,
      background: getThemeColor(ready),
      layoutAvailable: false,
    };
  }
  const columns = Math.min(state.gridColumns, ready.length);
  const rowCount = Math.ceil(ready.length / columns);
  const tile = ready[0].width;
  const rowCounts = Array.from({ length: rowCount }, (_, index) => Math.min(columns, ready.length - index * columns));
  return {
    ready,
    mode: 'grid',
    width: columns * tile + GAP * (columns - 1),
    height: rowCount * tile + GAP * (rowCount - 1),
    columns,
    rowCount,
    rowCounts,
    tile,
    background: getThemeColor(ready),
    layoutAvailable: true,
  };
}

function updateLayoutControl(isAvailable) {
  const buttons = [els.oneColumnButton, els.threeColumnButton];
  els.layoutControl.classList.toggle('is-disabled', !isAvailable);
  buttons.forEach((button) => {
    const isActive = Number(button.dataset.columns) === state.gridColumns;
    button.disabled = !isAvailable;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function compose() {
  const composition = getComposition();
  if (!composition) {
    updateLayoutControl(false);
    state.output = null;
    els.previewFrame.classList.remove('has-result');
    els.previewFrame.classList.add('empty-preview');
    els.previewFrame.querySelector('.preview-empty-content').style.display = 'block';
    els.downloadButton.disabled = true;
    return;
  }
  updateLayoutControl(composition.layoutAvailable);
  const { canvas } = els;
  canvas.width = composition.width;
  canvas.height = composition.height;
  const context = canvas.getContext('2d');
  const background = state.backgroundMode === 'manual' ? state.backgroundColor : composition.background || '#ffffff';
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (composition.mode === 'column') {
    let y = 0;
    composition.ready.forEach((item, index) => {
      const drawHeight = composition.heights[index];
      context.drawImage(item.image, 0, y, composition.width, drawHeight);
      y += drawHeight + GAP;
    });
  } else {
    let itemIndex = 0;
    composition.rowCounts.forEach((itemsInRow, rowIndex) => {
      if (!itemsInRow) return;
      const rowOffset = 0;
      for (let col = 0; col < itemsInRow; col += 1) {
        const item = composition.ready[itemIndex];
        context.drawImage(item.image, rowOffset + col * (composition.tile + GAP), rowIndex * (composition.tile + GAP), composition.tile, composition.tile);
        itemIndex += 1;
      }
    });
  }
  state.output = { canvas, mode: composition.mode };
  els.previewFrame.classList.add('has-result');
  els.previewFrame.classList.remove('empty-preview');
  els.previewFrame.querySelector('.preview-empty-content').style.display = 'none';
  els.backgroundColor.value = background;
  els.backgroundSwatch.style.backgroundColor = background;
  els.backgroundValue.textContent = state.backgroundMode === 'manual' ? background.toUpperCase() : '自动主题';
  els.downloadButton.disabled = false;
}

function downloadResult() {
  if (!state.output) return;
  state.output.canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.download = `miximage-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}

function switchWorkspace(workspace) {
  const showAlbum = workspace === 'album';
  els.composerWorkspace.hidden = showAlbum;
  els.albumWorkspace.hidden = !showAlbum;
  els.toolNavButtons.forEach((button) => {
    const isActive = button.dataset.workspace === workspace;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  if (showAlbum) composeAlbum();
}

function addAlbumFiles(fileList) {
  const files = [...fileList].filter(isImageFile);
  albumState.notice = '';
  const addedItems = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      image: null,
      width: 0,
      height: 0,
      error: false,
      transform: { scale: 1, rotation: 0 },
    }));
  albumState.items.push(...addedItems);
  renderAlbumQueue();
  addedItems.forEach(loadAlbumImage);
  els.albumFileInput.value = '';
}

function loadAlbumImage(item) {
  const image = new Image();
  image.onload = () => {
    item.image = image;
    item.width = image.naturalWidth;
    item.height = image.naturalHeight;
    renderAlbumQueue();
    composeAlbum();
  };
  image.onerror = () => {
    item.error = true;
    albumState.notice = `无法读取 ${item.file.name}`;
    renderAlbumQueue();
    composeAlbum();
  };
  image.src = item.url;
}

function removeAlbumItem(id) {
  const index = albumState.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  saveActiveAlbumCopy();
  URL.revokeObjectURL(albumState.items[index].url);
  albumState.items.splice(index, 1);
  albumState.notice = '';
  if (albumState.selectedItemId === id) albumState.selectedItemId = null;
  const pageCount = getAlbumPages().length;
  albumState.activePage = Math.min(albumState.activePage, Math.max(0, pageCount - 1));
  loadActiveAlbumCopy();
  renderAlbumQueue();
  composeAlbum();
}

function clearAlbum() {
  albumState.items.forEach((item) => URL.revokeObjectURL(item.url));
  albumState.items = [];
  albumState.output = null;
  albumState.notice = '';
  albumState.activePage = 0;
  albumState.pageCopy = [];
  albumState.layoutVariants = [];
  albumState.textPositions = [];
  albumState.textStyles = [];
  albumState.textTarget = 'title';
  albumState.selectedItemId = null;
  albumState.canvasDrag = null;
  albumState.hitRegions = [];
  albumState.textRegions = [];
  loadActiveAlbumCopy();
  renderAlbumQueue();
  composeAlbum();
}

function moveAlbumItem(sourceId, targetId) {
  const from = albumState.items.findIndex((item) => item.id === sourceId);
  const to = albumState.items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  saveActiveAlbumCopy();
  const [item] = albumState.items.splice(from, 1);
  albumState.items.splice(to, 0, item);
  renderAlbumQueue();
  composeAlbum();
}

function getAlbumPageSizes(count, requestedSize = albumState.pageSize) {
  if (count < 2) return [];
  if (requestedSize === 'auto') {
    const pageCount = Math.ceil(count / 6);
    const baseSize = Math.floor(count / pageCount);
    const remainder = count % pageCount;
    return Array.from({ length: pageCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
  }

  const pageSize = Number(requestedSize);
  const sizes = [];
  let remaining = count;
  while (remaining > pageSize) {
    sizes.push(pageSize);
    remaining -= pageSize;
  }
  if (remaining === 1 && sizes.length && sizes[sizes.length - 1] > 2) {
    sizes[sizes.length - 1] -= 1;
    sizes.push(2);
  } else if (remaining > 1) {
    sizes.push(remaining);
  } else if (remaining === 1) {
    sizes[sizes.length - 1] += 1;
  }
  return sizes;
}

function getAlbumLayoutVariant(pageIndex, itemCount) {
  const variantCounts = { 2: 2, 3: 3, 4: 3, 5: 3, 6: 2 };
  const variantCount = variantCounts[itemCount] || 1;
  if (!Number.isInteger(albumState.layoutVariants[pageIndex]) || albumState.layoutVariants[pageIndex] >= variantCount) {
    albumState.layoutVariants[pageIndex] = Math.floor(Math.random() * variantCount);
  }
  return albumState.layoutVariants[pageIndex];
}

function getAlbumPages() {
  const items = albumState.items.filter((item) => !item.error);
  let offset = 0;
  return getAlbumPageSizes(items.length).map((size, index) => {
    const page = { index, items: items.slice(offset, offset + size), layoutVariant: getAlbumLayoutVariant(index, size) };
    offset += size;
    return page;
  });
}

function saveActiveAlbumCopy() {
  albumState.pageCopy[albumState.activePage] = {
    title: els.albumTitle.value,
    copy: els.albumCopy.value,
  };
}

function loadActiveAlbumCopy() {
  const content = albumState.pageCopy[albumState.activePage] || { title: '', copy: '' };
  els.albumTitle.value = content.title;
  els.albumCopy.value = content.copy;
}

function setActiveAlbumPage(index) {
  const pages = getAlbumPages();
  if (!pages.length) return;
  saveActiveAlbumCopy();
  albumState.activePage = Math.max(0, Math.min(index, pages.length - 1));
  albumState.selectedItemId = null;
  loadActiveAlbumCopy();
  composeAlbum();
}

function getAlbumBackground(items) {
  if (albumState.backgroundMode === 'manual') return albumState.backgroundColor;
  return items.length ? getThemeColor(items) : '#ffffff';
}

function updateAlbumBackgroundControls(background) {
  const isManual = albumState.backgroundMode === 'manual';
  els.albumAutoBackground.classList.toggle('is-active', !isManual);
  els.albumManualBackground.classList.toggle('is-active', isManual);
  els.albumAutoBackground.setAttribute('aria-pressed', String(!isManual));
  els.albumManualBackground.setAttribute('aria-pressed', String(isManual));
  els.albumBackgroundColor.value = albumState.backgroundColor;
  els.albumBackgroundColor.disabled = !isManual;
  els.albumBackgroundSwatch.style.backgroundColor = background;
  els.albumBackgroundValue.textContent = isManual ? albumState.backgroundColor.toUpperCase() : '自动选色';
}

function setAlbumBackgroundMode(mode) {
  albumState.backgroundMode = mode;
  composeAlbum();
}

function getAlbumTextPosition(pageIndex) {
  if (!albumState.textPositions[pageIndex]) {
    albumState.textPositions[pageIndex] = {
      title: { x: 150, y: 2070 },
      copy: { x: 1740, y: 1970 },
    };
  }
  return albumState.textPositions[pageIndex];
}

function getAlbumTextStyles(pageIndex) {
  if (!albumState.textStyles[pageIndex]) {
    albumState.textStyles[pageIndex] = {
      title: { fontFamily: "'Microsoft YaHei', '微软雅黑', sans-serif", fontSize: 88, fontWeight: 600, color: '#222829' },
      copy: { fontFamily: "'Microsoft YaHei', '微软雅黑', sans-serif", fontSize: 38, fontWeight: 400, color: '#555c58' },
    };
  }
  return albumState.textStyles[pageIndex];
}

function getActiveAlbumTextStyle() {
  return getAlbumTextStyles(albumState.activePage)[albumState.textTarget];
}

function updateAlbumTextControls() {
  const page = getActiveAlbumPage();
  els.albumTextControl.hidden = !page;
  if (!page) return;
  const style = getActiveAlbumTextStyle();
  const isTitle = albumState.textTarget === 'title';
  els.albumTextTitleTarget.classList.toggle('is-active', isTitle);
  els.albumTextCopyTarget.classList.toggle('is-active', !isTitle);
  els.albumTextTitleTarget.setAttribute('aria-pressed', String(isTitle));
  els.albumTextCopyTarget.setAttribute('aria-pressed', String(!isTitle));
  els.albumFontFamily.value = style.fontFamily;
  els.albumFontWeight.value = String(style.fontWeight);
  els.albumFontSize.min = isTitle ? '40' : '20';
  els.albumFontSize.max = isTitle ? '160' : '72';
  els.albumFontSize.value = String(style.fontSize);
  els.albumFontSizeValue.textContent = `${style.fontSize} px`;
  els.albumFontColor.value = style.color;
  els.albumFontColorSwatch.style.backgroundColor = style.color;
}

function setAlbumTextTarget(target) {
  albumState.textTarget = target;
  updateAlbumTextControls();
}

function updateAlbumTextStyle(property, value) {
  const style = getActiveAlbumTextStyle();
  style[property] = property === 'fontSize' ? Number(value) : value;
  composeAlbum();
}

function getActiveAlbumPage() {
  return getAlbumPages()[albumState.activePage];
}

function getSelectedAlbumItem() {
  return getActiveAlbumPage()?.items.find((item) => item.id === albumState.selectedItemId) || null;
}

function updateAlbumSelectionControls() {
  const item = getSelectedAlbumItem();
  els.albumEditControl.hidden = !item;
  if (!item) return;
  const page = getActiveAlbumPage();
  const itemIndex = page.items.findIndex((entry) => entry.id === item.id);
  els.albumSelectionLabel.textContent = itemIndex === 0 ? '主图' : `图 ${itemIndex + 1}`;
  els.albumScaleRange.value = String(item.transform.scale);
  els.albumScaleValue.textContent = `${Math.round(item.transform.scale * 100)}%`;
}

function renderAlbumQueue() {
  const pages = getAlbumPages();
  const placement = new Map();
  pages.forEach((page, pageIndex) => page.items.forEach((item, itemIndex) => placement.set(item.id, { pageIndex, itemIndex })));
  if (!albumState.items.length) {
    els.albumQueue.innerHTML = Array.from({ length: 3 }, (_, index) => `<div class="album-slot"><span>${index + 1}</span><small>${index ? '照片' : '主图'}</small></div>`).join('');
  } else {
    els.albumQueue.innerHTML = albumState.items.map((item, index) => {
      const position = placement.get(item.id);
      const label = position ? `P${position.pageIndex + 1} · ${position.itemIndex ? `图 ${position.itemIndex + 1}` : '主图'}` : '待成页';
    return `
      <div class="album-photo${item.error ? ' has-error' : ''}" draggable="true" data-album-id="${item.id}">
        ${item.image ? `<img src="${item.url}" alt="" />` : '<span class="album-loading">读取中</span>'}
        <span class="album-photo-label">${label}</span>
        <button class="album-remove-button" type="button" data-album-remove="${item.id}" aria-label="移除第 ${index + 1} 张照片">×</button>
      </div>`;
    }).join('');
  }

  els.albumClearButton.disabled = albumState.items.length === 0;
  const readyCount = albumState.items.filter((item) => item.image).length;
  const isLoading = readyCount < albumState.items.filter((item) => !item.error).length;
  els.albumStatus.textContent = albumState.notice || (albumState.items.length < 2
    ? `已添加 ${albumState.items.length} 张，还需 ${2 - albumState.items.length} 张`
    : `已添加 ${albumState.items.length} 张 · ${isLoading ? '正在读取图片' : `自动生成 ${pages.length} 页`}`);

  els.albumQueue.querySelectorAll('[data-album-remove]').forEach((button) => button.addEventListener('click', () => removeAlbumItem(button.dataset.albumRemove)));
  els.albumQueue.querySelectorAll('[data-album-id]').forEach((item) => {
    item.addEventListener('dragstart', () => { albumState.draggedId = item.dataset.albumId; item.classList.add('is-dragging'); });
    item.addEventListener('dragend', () => { albumState.draggedId = null; item.classList.remove('is-dragging'); });
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => { event.preventDefault(); moveAlbumItem(albumState.draggedId, item.dataset.albumId); });
  });
}

function drawImageCover(context, image, x, y, width, height, transform = {}) {
  const border = 2;
  const innerX = x + border;
  const innerY = y + border;
  const innerWidth = width - border * 2;
  const innerHeight = height - border * 2;
  const scale = Math.max(innerWidth / image.naturalWidth, innerHeight / image.naturalHeight) * (transform.scale || 1);
  const rotation = (transform.rotation || 0) * Math.PI / 180;

  context.fillStyle = '#ffffff';
  context.fillRect(x, y, width, height);
  context.save();
  context.beginPath();
  context.rect(innerX, innerY, innerWidth, innerHeight);
  context.clip();
  context.translate(innerX + innerWidth / 2, innerY + innerHeight / 2);
  context.rotate(rotation);
  context.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  context.restore();
}

function drawAlbumItem(context, item, x, y, width, height, hitRegions) {
  drawImageCover(context, item.image, x, y, width, height, item.transform);
  if (hitRegions) hitRegions.push({ itemId: item.id, x, y, width, height });
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const paragraphs = text.split(/\r?\n/);
  const lines = [];
  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push('');
      return;
    }
    let line = '';
    [...paragraph].forEach((character) => {
      const testLine = line + character;
      if (line && context.measureText(testLine).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = testLine;
      }
    });
    if (line) lines.push(line);
  });
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines && visibleLines.length) {
    let lastLine = visibleLines[visibleLines.length - 1];
    while (lastLine && context.measureText(`${lastLine}…`).width > maxWidth) lastLine = lastLine.slice(0, -1);
    visibleLines[visibleLines.length - 1] = `${lastLine}…`;
  }
  visibleLines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function drawAlbumGrid(context, items, columns, rows, x, y, width, height, gap, hitRegions) {
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - gap * (rows - 1)) / rows;
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawAlbumItem(context, item, x + column * (cellWidth + gap), y + row * (cellHeight + gap), cellWidth, cellHeight, hitRegions);
  });
}

function renderAlbumPage(page, pageIndex, canvas) {
  canvas.width = A3_WIDTH;
  canvas.height = A3_HEIGHT;
  const context = canvas.getContext('2d');
  const margin = 150;
  const photoTop = 135;
  const photoHeight = 1630;
  const gap = 42;
  const contentWidth = A3_WIDTH - margin * 2;
  const ready = page.items;
  const hitRegions = canvas === els.albumCanvas ? [] : null;
  if (hitRegions) {
    albumState.hitRegions = hitRegions;
    albumState.textRegions = [];
  }

  context.fillStyle = getAlbumBackground(ready);
  context.fillRect(0, 0, A3_WIDTH, A3_HEIGHT);

  const variant = page.layoutVariant;
  let layoutName = '';
  if (ready.length === 2) {
    const firstWidth = 1930;
    const secondWidth = contentWidth - firstWidth - gap;
    if (variant === 0) {
      drawAlbumItem(context, ready[0], margin, photoTop, firstWidth, photoHeight, hitRegions);
      drawAlbumItem(context, ready[1], margin + firstWidth + gap, photoTop, secondWidth, photoHeight, hitRegions);
      layoutName = '双图 · 左侧主视觉';
    } else {
      drawAlbumItem(context, ready[0], margin, photoTop, secondWidth, photoHeight, hitRegions);
      drawAlbumItem(context, ready[1], margin + secondWidth + gap, photoTop, firstWidth, photoHeight, hitRegions);
      layoutName = '双图 · 右侧主视觉';
    }
  } else if (ready.length === 3) {
    const mainWidth = 1930;
    const sideWidth = contentWidth - mainWidth - gap;
    const sideHeight = (photoHeight - gap) / 2;
    if (variant === 0) {
      drawAlbumItem(context, ready[0], margin, photoTop, mainWidth, photoHeight, hitRegions);
      drawAlbumItem(context, ready[1], margin + mainWidth + gap, photoTop, sideWidth, sideHeight, hitRegions);
      drawAlbumItem(context, ready[2], margin + mainWidth + gap, photoTop + sideHeight + gap, sideWidth, sideHeight, hitRegions);
      layoutName = '三图 · 左主图';
    } else if (variant === 1) {
      drawAlbumItem(context, ready[0], margin, photoTop, sideWidth, sideHeight, hitRegions);
      drawAlbumItem(context, ready[1], margin, photoTop + sideHeight + gap, sideWidth, sideHeight, hitRegions);
      drawAlbumItem(context, ready[2], margin + sideWidth + gap, photoTop, mainWidth, photoHeight, hitRegions);
      layoutName = '三图 · 右主图';
    } else {
      drawAlbumGrid(context, ready, 3, 1, margin, photoTop, contentWidth, photoHeight, gap, hitRegions);
      layoutName = '三图 · 三联画';
    }
  } else if (ready.length === 4) {
    if (variant === 0) {
      drawAlbumGrid(context, ready, 2, 2, margin, photoTop, contentWidth, photoHeight, gap, hitRegions);
      layoutName = '四图 · 二乘二';
    } else if (variant === 1) {
      const mainWidth = 1930;
      const sideWidth = contentWidth - mainWidth - gap;
      const sideHeight = (photoHeight - gap) / 2;
      drawAlbumItem(context, ready[0], margin, photoTop, mainWidth, photoHeight, hitRegions);
      drawAlbumGrid(context, ready.slice(1, 3), 2, 1, margin + mainWidth + gap, photoTop, sideWidth, sideHeight, gap, hitRegions);
      drawAlbumItem(context, ready[3], margin + mainWidth + gap, photoTop + sideHeight + gap, sideWidth, sideHeight, hitRegions);
      layoutName = '四图 · 左主图';
    } else {
      const mainWidth = 1930;
      const sideWidth = contentWidth - mainWidth - gap;
      const sideHeight = (photoHeight - gap) / 2;
      drawAlbumItem(context, ready[3], margin + sideWidth + gap, photoTop, mainWidth, photoHeight, hitRegions);
      drawAlbumItem(context, ready[0], margin, photoTop, sideWidth, sideHeight, hitRegions);
      drawAlbumGrid(context, ready.slice(1, 3), 2, 1, margin, photoTop + sideHeight + gap, sideWidth, sideHeight, gap, hitRegions);
      layoutName = '四图 · 右主图';
    }
  } else if (ready.length === 5) {
    const halfHeight = (photoHeight - gap) / 2;
    if (variant === 0) {
      drawAlbumGrid(context, ready.slice(0, 3), 3, 1, margin, photoTop, contentWidth, halfHeight, gap, hitRegions);
      drawAlbumGrid(context, ready.slice(3), 2, 1, margin, photoTop + halfHeight + gap, contentWidth, halfHeight, gap, hitRegions);
      layoutName = '五图 · 三上二下';
    } else if (variant === 1) {
      drawAlbumGrid(context, ready.slice(0, 2), 2, 1, margin, photoTop, contentWidth, halfHeight, gap, hitRegions);
      drawAlbumGrid(context, ready.slice(2), 3, 1, margin, photoTop + halfHeight + gap, contentWidth, halfHeight, gap, hitRegions);
      layoutName = '五图 · 二上三下';
    } else {
      const mainWidth = 1450;
      const sideWidth = contentWidth - mainWidth - gap;
      drawAlbumItem(context, ready[0], margin, photoTop, mainWidth, photoHeight, hitRegions);
      drawAlbumGrid(context, ready.slice(1), 2, 2, margin + mainWidth + gap, photoTop, sideWidth, photoHeight, gap, hitRegions);
      layoutName = '五图 · 左主图四联';
    }
  } else if (ready.length === 6) {
    if (variant === 0) {
      drawAlbumGrid(context, ready, 3, 2, margin, photoTop, contentWidth, photoHeight, gap, hitRegions);
      layoutName = '六图 · 三乘二';
    } else {
      drawAlbumGrid(context, ready, 2, 3, margin, photoTop, contentWidth, photoHeight, gap, hitRegions);
      layoutName = '六图 · 二乘三';
    }
  }

  const pageCopy = albumState.pageCopy[pageIndex] || { title: '', copy: '' };
  const title = pageCopy.title.trim();
  const copy = pageCopy.copy.trim();
  const textPosition = getAlbumTextPosition(pageIndex);
  const textStyles = getAlbumTextStyles(pageIndex);

  context.fillStyle = textStyles.title.color;
  context.font = `${textStyles.title.fontWeight} ${textStyles.title.fontSize}px ${textStyles.title.fontFamily}`;
  if (title) {
    const titleLineHeight = Math.round(textStyles.title.fontSize * 1.18);
    drawWrappedText(context, title, textPosition.title.x, textPosition.title.y, 1400, titleLineHeight, 2);
    if (hitRegions) albumState.textRegions.push({ type: 'title', x: textPosition.title.x, y: textPosition.title.y - titleLineHeight, width: 1400, height: titleLineHeight * 2.2 });
  }

  context.fillStyle = textStyles.copy.color;
  context.font = `${textStyles.copy.fontWeight} ${textStyles.copy.fontSize}px ${textStyles.copy.fontFamily}`;
  if (copy) {
    const copyLineHeight = Math.round(textStyles.copy.fontSize * 1.48);
    drawWrappedText(context, copy, textPosition.copy.x, textPosition.copy.y, 1618, copyLineHeight, 4);
    if (hitRegions) albumState.textRegions.push({ type: 'copy', x: textPosition.copy.x, y: textPosition.copy.y - copyLineHeight, width: 1618, height: copyLineHeight * 4.2 });
  }

  return layoutName;
}

function composeAlbum() {
  const pages = getAlbumPages();
  albumState.activePage = Math.min(albumState.activePage, Math.max(0, pages.length - 1));
  const page = pages[albumState.activePage];
  const allReady = pages.length > 0 && pages.every((entry) => entry.items.every((item) => item.image));

  els.albumPageValue.textContent = pages.length ? `${albumState.activePage + 1} / ${pages.length}` : '0 / 0';
  els.albumPageSize.value = albumState.pageSize;
  els.albumPreviousPage.disabled = !pages.length || albumState.activePage === 0;
  els.albumNextPage.disabled = !pages.length || albumState.activePage === pages.length - 1;
  els.albumExportNote.textContent = pages.length > 1 ? `${pages.length} 页 A3 PNG · 打包 ZIP` : 'A3 PNG · 3508 × 2480 px';
  els.albumDownloadButton.disabled = !allReady;
  updateAlbumBackgroundControls(getAlbumBackground(page?.items || []));
  updateAlbumSelectionControls();
  updateAlbumTextControls();

  if (!page || !page.items.every((item) => item.image)) {
    albumState.output = null;
    els.albumPreviewFrame.classList.remove('has-result');
    els.albumPreviewFrame.classList.add('empty-preview');
    els.albumPreviewFrame.querySelector('.preview-empty-content').style.display = 'block';
    els.albumLayoutName.textContent = albumState.items.length ? (pages.length ? '读取中' : '还需 1 张') : '等待图片';
    return;
  }

  const layoutName = renderAlbumPage(page, albumState.activePage, els.albumCanvas);
  els.albumLayoutName.textContent = layoutName;
  updateAlbumBackgroundControls(getAlbumBackground(page.items));
  updateAlbumSelectionControls();
  updateAlbumTextControls();

  albumState.output = els.albumCanvas;
  els.albumPreviewFrame.classList.add('has-result');
  els.albumPreviewFrame.classList.remove('empty-preview');
  els.albumPreviewFrame.querySelector('.preview-empty-content').style.display = 'none';
}

function getAlbumCanvasPoint(event) {
  const bounds = els.albumCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * els.albumCanvas.width / bounds.width,
    y: (event.clientY - bounds.top) * els.albumCanvas.height / bounds.height,
  };
}

function isPointInAlbumRegion(point, region) {
  return point.x >= region.x && point.x <= region.x + region.width && point.y >= region.y && point.y <= region.y + region.height;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function handleAlbumCanvasPointerDown(event) {
  if (!albumState.output) return;
  const point = getAlbumCanvasPoint(event);
  const textRegion = [...albumState.textRegions].reverse().find((region) => isPointInAlbumRegion(point, region));
  const imageRegion = [...albumState.hitRegions].reverse().find((region) => isPointInAlbumRegion(point, region));
  if (textRegion) {
    albumState.selectedItemId = null;
    albumState.canvasDrag = { type: textRegion.type, pointerId: event.pointerId, lastX: point.x, lastY: point.y };
  } else if (imageRegion) {
    albumState.selectedItemId = imageRegion.itemId;
    albumState.canvasDrag = { type: 'select', pointerId: event.pointerId };
  } else {
    albumState.selectedItemId = null;
    albumState.canvasDrag = null;
  }
  els.albumCanvas.setPointerCapture?.(event.pointerId);
  updateAlbumSelectionControls();
  composeAlbum();
  event.preventDefault();
}

function handleAlbumCanvasPointerMove(event) {
  const drag = albumState.canvasDrag;
  if (!drag || !drag.type || drag.type === 'select') return;
  const point = getAlbumCanvasPoint(event);
  const position = getAlbumTextPosition(albumState.activePage)[drag.type];
  const deltaX = point.x - drag.lastX;
  const deltaY = point.y - drag.lastY;
  const maxX = drag.type === 'title' ? 2050 : 1740;
  position.x = clamp(position.x + deltaX, 80, maxX);
  position.y = clamp(position.y + deltaY, drag.type === 'title' ? 1750 : 1750, 2220);
  drag.lastX = point.x;
  drag.lastY = point.y;
  composeAlbum();
  event.preventDefault();
}

function handleAlbumCanvasPointerUp(event) {
  if (!albumState.canvasDrag) return;
  albumState.canvasDrag = null;
  els.albumCanvas.releasePointerCapture?.(event.pointerId);
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function crc32(bytes) {
  if (!crc32.table) {
    crc32.table = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      return value >>> 0;
    });
  }
  let crc = 0xffffffff;
  bytes.forEach((byte) => { crc = crc32.table[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

function downloadBlob(blob, fileName) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function downloadAlbum() {
  const pages = getAlbumPages();
  if (!pages.length || pages.some((page) => page.items.some((item) => !item.image))) return;
  saveActiveAlbumCopy();
  const buttonLabel = els.albumDownloadButton.querySelector('span');
  els.albumDownloadButton.disabled = true;
  buttonLabel.textContent = '生成中…';

  try {
    const entries = [];
    for (let index = 0; index < pages.length; index += 1) {
      const canvas = document.createElement('canvas');
      renderAlbumPage(pages[index], index, canvas);
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error('PNG export failed');
      entries.push({ name: `miximage-page-${String(index + 1).padStart(2, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }

    const date = new Date().toISOString().slice(0, 10);
    if (entries.length === 1) {
      downloadBlob(new Blob([entries[0].data], { type: 'image/png' }), `miximage-album-${date}.png`);
    } else {
      downloadBlob(createZip(entries), `miximage-album-${date}.zip`);
    }
  } finally {
    buttonLabel.textContent = '导出全部';
    els.albumDownloadButton.disabled = false;
  }
}

els.fileInput.addEventListener('change', (event) => addFiles(event.target.files));
['dragenter', 'dragover'].forEach((eventName) => els.dropzone.addEventListener(eventName, (event) => { event.preventDefault(); els.dropzone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => els.dropzone.addEventListener(eventName, (event) => { event.preventDefault(); els.dropzone.classList.remove('is-dragging'); }));
els.dropzone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
els.clearButton.addEventListener('click', clearAll);
els.downloadButton.addEventListener('click', downloadResult);
els.backgroundColor.addEventListener('input', (event) => {
  state.backgroundMode = 'manual';
  state.backgroundColor = event.target.value;
  compose();
});
els.oneColumnButton.dataset.columns = '1';
els.threeColumnButton.dataset.columns = '3';
els.oneColumnButton.addEventListener('click', () => { state.gridColumns = 1; compose(); });
els.threeColumnButton.addEventListener('click', () => { state.gridColumns = 3; compose(); });
els.toolNavButtons.forEach((button) => button.addEventListener('click', () => switchWorkspace(button.dataset.workspace)));
els.albumFileInput.addEventListener('change', (event) => addAlbumFiles(event.target.files));
['dragenter', 'dragover'].forEach((eventName) => els.albumDropzone.addEventListener(eventName, (event) => { event.preventDefault(); els.albumDropzone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => els.albumDropzone.addEventListener(eventName, (event) => { event.preventDefault(); els.albumDropzone.classList.remove('is-dragging'); }));
els.albumDropzone.addEventListener('drop', (event) => addAlbumFiles(event.dataTransfer.files));
els.albumClearButton.addEventListener('click', clearAlbum);
els.albumTitle.addEventListener('input', () => { saveActiveAlbumCopy(); composeAlbum(); });
els.albumCopy.addEventListener('input', () => { saveActiveAlbumCopy(); composeAlbum(); });
els.albumAutoBackground.addEventListener('click', () => setAlbumBackgroundMode('auto'));
els.albumManualBackground.addEventListener('click', () => setAlbumBackgroundMode('manual'));
els.albumBackgroundColor.addEventListener('input', (event) => {
  albumState.backgroundMode = 'manual';
  albumState.backgroundColor = event.target.value;
  composeAlbum();
});
els.albumTextTitleTarget.addEventListener('click', () => setAlbumTextTarget('title'));
els.albumTextCopyTarget.addEventListener('click', () => setAlbumTextTarget('copy'));
els.albumFontFamily.addEventListener('change', (event) => updateAlbumTextStyle('fontFamily', event.target.value));
els.albumFontWeight.addEventListener('change', (event) => updateAlbumTextStyle('fontWeight', event.target.value));
els.albumFontSize.addEventListener('input', (event) => updateAlbumTextStyle('fontSize', event.target.value));
els.albumFontColor.addEventListener('input', (event) => updateAlbumTextStyle('color', event.target.value));
els.albumPageSize.addEventListener('change', (event) => {
  albumState.pageSize = event.target.value;
  albumState.activePage = 0;
  albumState.selectedItemId = null;
  composeAlbum();
});
els.albumScaleRange.addEventListener('input', (event) => {
  const item = getSelectedAlbumItem();
  if (!item) return;
  item.transform.scale = Number(event.target.value);
  composeAlbum();
});
els.albumRotateLeft.addEventListener('click', () => {
  const item = getSelectedAlbumItem();
  if (!item) return;
  item.transform.rotation -= 15;
  composeAlbum();
});
els.albumRotateRight.addEventListener('click', () => {
  const item = getSelectedAlbumItem();
  if (!item) return;
  item.transform.rotation += 15;
  composeAlbum();
});
els.albumResetTransform.addEventListener('click', () => {
  const item = getSelectedAlbumItem();
  if (!item) return;
  item.transform = { scale: 1, rotation: 0 };
  composeAlbum();
});
els.albumCanvas.addEventListener('pointerdown', handleAlbumCanvasPointerDown);
els.albumCanvas.addEventListener('pointermove', handleAlbumCanvasPointerMove);
els.albumCanvas.addEventListener('pointerup', handleAlbumCanvasPointerUp);
els.albumCanvas.addEventListener('pointercancel', handleAlbumCanvasPointerUp);
els.albumPreviousPage.addEventListener('click', () => setActiveAlbumPage(albumState.activePage - 1));
els.albumNextPage.addEventListener('click', () => setActiveAlbumPage(albumState.activePage + 1));
els.albumDownloadButton.addEventListener('click', downloadAlbum);
updateLayoutControl(false);
renderQueue();
renderAlbumQueue();
