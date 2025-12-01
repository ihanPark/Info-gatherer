const graphImageInput = document.getElementById('graphImage');
const analyzeImageButton = document.getElementById('analyzeImage');
const graphCanvas = document.getElementById('graphCanvas');
const imageMessageContainer = document.getElementById('imageMessage');
const imageStatusContainer = document.getElementById('imageStatus');
const dropZone = document.getElementById('dropZone');
const canvasContext = graphCanvas.getContext('2d');
let currentImage = null;

function resetImageFeedback() {
    imageMessageContainer.textContent = '';
    imageStatusContainer.textContent = '';
}

function loadImageFile(file) {
    resetImageFeedback();
    analyzeImageButton.disabled = true;

    if (!file) {
        graphCanvas.style.display = 'none';
        canvasContext.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
        currentImage = null;
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        imageMessageContainer.textContent = 'Please upload a valid image file.';
        graphImageInput.value = '';
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const maxWidth = 900;
        const maxHeight = 600;
        const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
        const width = Math.round(img.naturalWidth * scale);
        const height = Math.round(img.naturalHeight * scale);

        graphCanvas.width = width;
        graphCanvas.height = height;
        graphCanvas.style.display = 'block';

        canvasContext.clearRect(0, 0, width, height);
        canvasContext.drawImage(img, 0, 0, width, height);
        currentImage = img;
        analyzeImageButton.disabled = false;
        imageStatusContainer.textContent = 'Image loaded. Click "Highlight graph" to tint the curve while filtering out the grid.';

        URL.revokeObjectURL(imageUrl);
    };
    img.onerror = () => {
        imageMessageContainer.textContent = 'Unable to load the selected image. Please choose another file.';
        URL.revokeObjectURL(imageUrl);
    };
    img.src = imageUrl;
}

graphImageInput.addEventListener('change', () => {
    const [file] = graphImageInput.files;
    loadImageFile(file);
});

dropZone.addEventListener('click', () => {
    graphImageInput.click();
});

dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        graphImageInput.click();
    }
});

dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragging');
});

dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');

    const [file] = event.dataTransfer.files;
    if (file) {
        loadImageFile(file);
        graphImageInput.value = '';
    }
});

function getBrightness(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function detectGraphMask(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const candidateMask = new Uint8Array(width * height);
    const highlightMask = new Uint8Array(width * height);
    let brightnessSum = 0;
    let pixelCount = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            const alpha = data[offset + 3];
            if (alpha < 64) {
                continue;
            }

            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const brightness = getBrightness(r, g, b);
            const maxChannel = Math.max(r, g, b);
            const minChannel = Math.min(r, g, b);
            const chroma = maxChannel - minChannel;
            const saturation = maxChannel === 0 ? 0 : chroma / maxChannel;

            if (maxChannel < 32) {
                // Treat very dark pixels as grid lines or axes; skip them entirely.
                continue;
            }
            if (brightness > 245) {
                // Ignore near-white pixels from paper or background glare.
                continue;
            }
            if (chroma < 12 && saturation < 0.08) {
                // Low chroma pixels are usually the grey grid or axes.
                continue;
            }

            const index = y * width + x;
            candidateMask[index] = 1;
            brightnessSum += brightness;
            pixelCount += 1;
        }
    }

    if (pixelCount === 0) {
        return null;
    }

    const averageBrightness = brightnessSum / pixelCount;
    const threshold = Math.min(averageBrightness * 1.1, averageBrightness + 24);
    let highlightedCount = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            if (!candidateMask[index]) {
                continue;
            }

            const offset = index * 4;
            const brightness = getBrightness(data[offset], data[offset + 1], data[offset + 2]);
            if (brightness <= threshold) {
                highlightMask[index] = 1;
                highlightedCount += 1;
            }
        }
    }

    if (highlightedCount === 0) {
        return null;
    }
    return {
        highlightedCount,
        totalCount: pixelCount,
        highlightMask,
    };
}

function applyGraphHighlight(ctx, mask, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    for (let index = 0; index < mask.length; index += 1) {
        if (!mask[index]) {
            continue;
        }

        const offset = index * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];

        data[offset] = Math.min(255, r * 0.35 + 50);
        data[offset + 1] = Math.min(255, g * 0.35 + 200);
        data[offset + 2] = Math.min(255, b * 0.35 + 110);
        data[offset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

analyzeImageButton.addEventListener('click', () => {
    resetImageFeedback();
    imageStatusContainer.textContent = '';

    if (!currentImage || !graphCanvas.width || !graphCanvas.height) {
        imageMessageContainer.textContent = 'Please upload an image before running the analysis.';
        return;
    }

    const { width, height } = graphCanvas;
    canvasContext.clearRect(0, 0, width, height);
    canvasContext.drawImage(currentImage, 0, 0, width, height);

    const highlightSummary = detectGraphMask(canvasContext, width, height);
    if (!highlightSummary) {
        imageMessageContainer.textContent = 'Unable to detect the graph. Ensure the curve is coloured and stands out from the grid lines.';
        return;
    }

    const mask = highlightSummary.highlightMask;
    applyGraphHighlight(canvasContext, mask, width, height);

    imageStatusContainer.textContent = 'Highlighted the detected curve after filtering out grid lines.';
});
