import './styles.css';

const GAP = 2;
const state = { items: [], draggedId: null, output: null, backgroundMode: 'auto', backgroundColor: '#ffffff', gridColumns: 3 };
const A3_WIDTH = 3508;
const A3_HEIGHT = 2480;
const albumState = { items: [], draggedId: null, output: null, notice: '' };

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
  albumDownloadButton: document.querySelector('#albumDownloadButton'),
  albumLayoutBadge: document.querySelector('#albumLayoutBadge'),
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
  const available = Math.max(0, 3 - albumState.items.length);
  const imageFiles = [...fileList].filter(isImageFile);
  const files = imageFiles.slice(0, available);
  albumState.notice = imageFiles.length > available ? '最多支持 3 张照片，超出的图片未添加' : '';
  const addedItems = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      image: null,
      width: 0,
      height: 0,
      error: false,
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
  URL.revokeObjectURL(albumState.items[index].url);
  albumState.items.splice(index, 1);
  albumState.notice = '';
  renderAlbumQueue();
  composeAlbum();
}

function clearAlbum() {
  albumState.items.forEach((item) => URL.revokeObjectURL(item.url));
  albumState.items = [];
  albumState.output = null;
  albumState.notice = '';
  renderAlbumQueue();
  composeAlbum();
}

function moveAlbumItem(sourceId, targetId) {
  const from = albumState.items.findIndex((item) => item.id === sourceId);
  const to = albumState.items.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = albumState.items.splice(from, 1);
  albumState.items.splice(to, 0, item);
  renderAlbumQueue();
  composeAlbum();
}

function renderAlbumQueue() {
  const labels = ['主图', '照片 2', '照片 3'];
  els.albumQueue.innerHTML = Array.from({ length: 3 }, (_, index) => {
    const item = albumState.items[index];
    if (!item) return `<div class="album-slot"><span>${index + 1}</span><small>${index === 2 ? '可选' : labels[index]}</small></div>`;
    return `
      <div class="album-photo${item.error ? ' has-error' : ''}" draggable="true" data-album-id="${item.id}">
        ${item.image ? `<img src="${item.url}" alt="" />` : '<span class="album-loading">读取中</span>'}
        <span class="album-photo-label">${labels[index]}</span>
        <button class="album-remove-button" type="button" data-album-remove="${item.id}" aria-label="移除第 ${index + 1} 张照片">×</button>
      </div>`;
  }).join('');

  els.albumClearButton.disabled = albumState.items.length === 0;
  const readyCount = albumState.items.filter((item) => item.image).length;
  els.albumStatus.textContent = albumState.notice || (readyCount < 2 ? `已添加 ${readyCount} 张，还需 ${2 - readyCount} 张` : `已添加 ${readyCount} 张，可拖动调整主图`);

  els.albumQueue.querySelectorAll('[data-album-remove]').forEach((button) => button.addEventListener('click', () => removeAlbumItem(button.dataset.albumRemove)));
  els.albumQueue.querySelectorAll('[data-album-id]').forEach((item) => {
    item.addEventListener('dragstart', () => { albumState.draggedId = item.dataset.albumId; item.classList.add('is-dragging'); });
    item.addEventListener('dragend', () => { albumState.draggedId = null; item.classList.remove('is-dragging'); });
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => { event.preventDefault(); moveAlbumItem(albumState.draggedId, item.dataset.albumId); });
  });
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
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

function composeAlbum() {
  const ready = albumState.items.filter((item) => item.image).slice(0, 3);
  if (ready.length < 2) {
    albumState.output = null;
    els.albumPreviewFrame.classList.remove('has-result');
    els.albumPreviewFrame.classList.add('empty-preview');
    els.albumPreviewFrame.querySelector('.preview-empty-content').style.display = 'block';
    els.albumDownloadButton.disabled = true;
    els.albumLayoutBadge.textContent = ready.length ? '还需 1 张' : '等待图片';
    return;
  }

  const canvas = els.albumCanvas;
  canvas.width = A3_WIDTH;
  canvas.height = A3_HEIGHT;
  const context = canvas.getContext('2d');
  const margin = 150;
  const photoTop = 135;
  const photoHeight = 1630;
  const gap = 42;
  const contentWidth = A3_WIDTH - margin * 2;

  context.fillStyle = '#f7f5ef';
  context.fillRect(0, 0, A3_WIDTH, A3_HEIGHT);

  if (ready.length === 2) {
    const firstWidth = 1930;
    const secondWidth = contentWidth - firstWidth - gap;
    drawImageCover(context, ready[0].image, margin, photoTop, firstWidth, photoHeight);
    drawImageCover(context, ready[1].image, margin + firstWidth + gap, photoTop, secondWidth, photoHeight);
    els.albumLayoutBadge.textContent = '双图画册';
  } else {
    const mainWidth = 1930;
    const sideWidth = contentWidth - mainWidth - gap;
    const sideHeight = (photoHeight - gap) / 2;
    drawImageCover(context, ready[0].image, margin, photoTop, mainWidth, photoHeight);
    drawImageCover(context, ready[1].image, margin + mainWidth + gap, photoTop, sideWidth, sideHeight);
    drawImageCover(context, ready[2].image, margin + mainWidth + gap, photoTop + sideHeight + gap, sideWidth, sideHeight);
    els.albumLayoutBadge.textContent = '主图 + 双联图';
  }

  const title = els.albumTitle.value.trim();
  const copy = els.albumCopy.value.trim();
  context.fillStyle = '#d98436';
  context.font = '600 28px Arial, sans-serif';
  context.fillText('PHOTO ALBUM', margin, 1927);

  context.fillStyle = '#222829';
  context.font = '600 88px Arial, sans-serif';
  if (title) drawWrappedText(context, title, margin, 2070, 1400, 104, 2);

  context.fillStyle = '#555c58';
  context.font = '400 38px Arial, sans-serif';
  if (copy) drawWrappedText(context, copy, 1740, 1970, 1618, 56, 4);

  context.strokeStyle = '#d6d8d2';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(margin, 2328);
  context.lineTo(A3_WIDTH - margin, 2328);
  context.stroke();
  context.fillStyle = '#777d79';
  context.font = '500 24px Arial, sans-serif';
  context.fillText('A3 LANDSCAPE  /  MIXIMAGE', margin, 2392);
  context.textAlign = 'right';
  context.fillText(`${String(ready.length).padStart(2, '0')} FRAMES`, A3_WIDTH - margin, 2392);
  context.textAlign = 'left';

  albumState.output = canvas;
  els.albumPreviewFrame.classList.add('has-result');
  els.albumPreviewFrame.classList.remove('empty-preview');
  els.albumPreviewFrame.querySelector('.preview-empty-content').style.display = 'none';
  els.albumDownloadButton.disabled = false;
}

function downloadAlbum() {
  if (!albumState.output) return;
  albumState.output.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.download = `miximage-album-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
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
els.albumTitle.addEventListener('input', composeAlbum);
els.albumCopy.addEventListener('input', composeAlbum);
els.albumDownloadButton.addEventListener('click', downloadAlbum);
updateLayoutControl(false);
renderQueue();
renderAlbumQueue();
