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
        imageStatusContainer.textContent = 'Image loaded. Click "Highlight graph" to tint the curve that contrasts with the background.';

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

function estimateBackgroundColor(data, width, height) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let x = 0; x < width; x += 1) {
        const topOffset = x * 4;
        const bottomOffset = ((height - 1) * width + x) * 4;
        rSum += data[topOffset];
        gSum += data[topOffset + 1];
        bSum += data[topOffset + 2];
        rSum += data[bottomOffset];
        gSum += data[bottomOffset + 1];
        bSum += data[bottomOffset + 2];
        count += 2;
    }

    for (let y = 0; y < height; y += 1) {
        const leftOffset = (y * width) * 4;
        const rightOffset = (y * width + (width - 1)) * 4;
        rSum += data[leftOffset];
        gSum += data[leftOffset + 1];
        bSum += data[leftOffset + 2];
        rSum += data[rightOffset];
        gSum += data[rightOffset + 1];
        bSum += data[rightOffset + 2];
        count += 2;
    }

    return {
        r: rSum / count,
        g: gSum / count,
        b: bSum / count,
    };
}

function findLargestComponent(mask, width, height) {
    const visited = new Uint8Array(mask.length);
    let largest = { size: 0, pixels: [] };
    const neighbors = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], /* self */ [1, 0],
        [-1, 1], [0, 1], [1, 1],
    ];

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const startIndex = y * width + x;
            if (!mask[startIndex] || visited[startIndex]) {
                continue;
            }

            const queue = [[x, y]];
            visited[startIndex] = 1;
            const pixels = [];

            while (queue.length) {
                const [cx, cy] = queue.shift();
                const currentIndex = cy * width + cx;
                pixels.push([cx, cy]);

                neighbors.forEach(([dx, dy]) => {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                        return;
                    }
                    const neighborIndex = ny * width + nx;
                    if (!mask[neighborIndex] || visited[neighborIndex]) {
                        return;
                    }
                    visited[neighborIndex] = 1;
                    queue.push([nx, ny]);
                });
            }

            if (pixels.length > largest.size) {
                largest = { size: pixels.length, pixels };
            }
        }
    }

    const highlightMask = new Uint8Array(mask.length);
    largest.pixels.forEach(([px, py]) => {
        highlightMask[py * width + px] = 1;
    });

    return { highlightMask, size: largest.size };
}

function hasLargeGap(indices, maxGap) {
    const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i] - sorted[i - 1] > maxGap) {
            return true;
        }
    }
    return false;
}

function detectGraphMask(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const candidateMask = new Uint8Array(width * height);

    const background = estimateBackgroundColor(data, width, height);
    let candidateCount = 0;

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

            const diffR = Math.abs(r - background.r);
            const diffG = Math.abs(g - background.g);
            const diffB = Math.abs(b - background.b);

            if (diffR < 50 && diffG < 50 && diffB < 50) {
                continue;
            }

            const index = y * width + x;
            candidateMask[index] = 1;
            candidateCount += 1;
        }
    }

    if (candidateCount === 0) {
        return null;
    }

    const largestComponent = findLargestComponent(candidateMask, width, height);
    if (!largestComponent.size) {
        return null;
    }

    const componentColumns = [];
    const componentRows = [];
    largestComponent.highlightMask.forEach((value, idx) => {
        if (!value) {
            return;
        }
        const x = idx % width;
        const y = Math.floor(idx / width);
        componentColumns.push(x);
        componentRows.push(y);
    });

    if (hasLargeGap(componentColumns, 30) || hasLargeGap(componentRows, 30)) {
        return null;
    }

    return {
        highlightedCount: largestComponent.size,
        totalCount: candidateCount,
        highlightMask: largestComponent.highlightMask,
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

    imageStatusContainer.textContent = 'Highlighted the detected curve using background contrast and continuity checks.';
});
