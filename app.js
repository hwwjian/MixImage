import './styles.css';

const GAP = 2;
const state = { items: [], draggedId: null, output: null, backgroundMode: 'auto', backgroundColor: '#ffffff', gridColumns: 3 };

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
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
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
updateLayoutControl(false);
renderQueue();
