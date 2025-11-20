const graphImageInput = document.getElementById('graphImage');
const analyzeImageButton = document.getElementById('analyzeImage');
const graphCanvas = document.getElementById('graphCanvas');
const imageMessageContainer = document.getElementById('imageMessage');
const imageStatusContainer = document.getElementById('imageStatus');
const canvasContext = graphCanvas.getContext('2d');
let currentImage = null;

function resetImageFeedback() {
    imageMessageContainer.textContent = '';
    imageStatusContainer.textContent = '';
}

graphImageInput.addEventListener('change', () => {
    resetImageFeedback();
    analyzeImageButton.disabled = true;

    const [file] = graphImageInput.files;
    if (!file) {
        graphCanvas.style.display = 'none';
        canvasContext.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
        currentImage = null;
        return;
    }
    if (!file.type.startsWith('image/')) {
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
        imageStatusContainer.textContent = 'Image loaded. Click "Highlight graph & mark extrema" to spotlight the curve and annotate its peaks.';

        URL.revokeObjectURL(imageUrl);
    };
    img.onerror = () => {
        imageMessageContainer.textContent = 'Unable to load the selected image. Please choose another file.';
        URL.revokeObjectURL(imageUrl);
    };
    img.src = imageUrl;
});

function getBrightness(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function highlightGraphPixels(ctx, width, height) {
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
    const highlightColor = { r: 34, g: 197, b: 94 };
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
                data[offset] = Math.round(data[offset] * 0.3 + highlightColor.r * 0.7);
                data[offset + 1] = Math.round(data[offset + 1] * 0.3 + highlightColor.g * 0.7);
                data[offset + 2] = Math.round(data[offset + 2] * 0.3 + highlightColor.b * 0.7);
                highlightMask[index] = 1;
                highlightedCount += 1;
            }
        }
    }

    if (highlightedCount === 0) {
        return null;
    }

    ctx.putImageData(imageData, 0, 0);
    return {
        highlightedCount,
        totalCount: pixelCount,
        highlightMask,
    };
}

function findExtremaFromMask(mask, width, height) {
    if (!mask) {
        return null;
    }

    const totalPixels = mask.length;
    let topY = height;
    let bottomY = -1;

    for (let index = 0; index < totalPixels; index += 1) {
        if (!mask[index]) {
            continue;
        }
        const y = Math.floor(index / width);
        if (y < topY) {
            topY = y;
        }
        if (y > bottomY) {
            bottomY = y;
        }
    }

    if (topY === height || bottomY === -1) {
        return null;
    }

    const bandPadding = 2;
    const topBandLimit = Math.min(topY + bandPadding, bottomY);
    const bottomBandLimit = Math.max(bottomY - bandPadding, topY);

    let topSumX = 0;
    let topSumY = 0;
    let topCount = 0;
    let bottomSumX = 0;
    let bottomSumY = 0;
    let bottomCount = 0;

    for (let index = 0; index < totalPixels; index += 1) {
        if (!mask[index]) {
            continue;
        }
        const y = Math.floor(index / width);
        const x = index % width;

        if (y <= topBandLimit) {
            topSumX += x;
            topSumY += y;
            topCount += 1;
        }

        if (y >= bottomBandLimit) {
            bottomSumX += x;
            bottomSumY += y;
            bottomCount += 1;
        }
    }

    const result = {};
    if (topCount > 0) {
        result.maxPoint = {
            x: topSumX / topCount,
            y: topSumY / topCount,
            count: topCount,
        };
    }
    if (bottomCount > 0) {
        result.minPoint = {
            x: bottomSumX / bottomCount,
            y: bottomSumY / bottomCount,
            count: bottomCount,
        };
    }

    if (!result.maxPoint && !result.minPoint) {
        return null;
    }

    if (result.maxPoint && result.minPoint && Math.abs(result.maxPoint.y - result.minPoint.y) <= 2) {
        const combinedCount = result.maxPoint.count + result.minPoint.count;
        const combinedX =
            (result.maxPoint.x * result.maxPoint.count + result.minPoint.x * result.minPoint.count) /
            combinedCount;
        const combinedY =
            (result.maxPoint.y * result.maxPoint.count + result.minPoint.y * result.minPoint.count) /
            combinedCount;

        return {
            flatPoint: {
                x: combinedX,
                y: combinedY,
            },
        };
    }

    return result;
}

function drawMarker(ctx, point, { color, label }) {
    if (!point) {
        return;
    }

    const radius = 7;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(point.x - radius - 4, point.y);
    ctx.lineTo(point.x + radius + 4, point.y);
    ctx.moveTo(point.x, point.y - radius - 4);
    ctx.lineTo(point.x, point.y + radius + 4);
    ctx.stroke();

    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;

    let offsetX = 10;
    if (point.x + offsetX > ctx.canvas.width - 80) {
        offsetX = -70;
    }
    let offsetY = 10;
    if (point.y + offsetY > ctx.canvas.height - 24) {
        offsetY = -28;
    }

    ctx.fillText(label, point.x + offsetX, point.y + offsetY);
    ctx.restore();
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

    const highlightSummary = highlightGraphPixels(canvasContext, width, height);
    if (!highlightSummary) {
        imageMessageContainer.textContent = 'Unable to detect the graph. Ensure the curve is coloured and stands out from the grid lines.';
        return;
    }

    const extrema = findExtremaFromMask(highlightSummary.highlightMask, width, height);

    if (extrema && extrema.flatPoint) {
        drawMarker(canvasContext, extrema.flatPoint, { color: '#c026d3', label: 'Flat extremum' });
        imageStatusContainer.textContent = `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines. Marked a flat extremum.`;
        return;
    }

    if (extrema) {
        if (extrema.maxPoint) {
            drawMarker(canvasContext, extrema.maxPoint, { color: '#dc2626', label: 'Max' });
        }
        if (extrema.minPoint) {
            drawMarker(canvasContext, extrema.minPoint, { color: '#1d4ed8', label: 'Min' });
        }
        const extremaLabels = [
            extrema.maxPoint ? 'maximum' : null,
            extrema.minPoint ? 'minimum' : null,
        ].filter(Boolean);
        const labelText = extremaLabels.length ? ` Marked the ${extremaLabels.join(' and ')}.` : '';
        imageStatusContainer.textContent = `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines.${labelText}`;
        return;
    }

    imageStatusContainer.textContent = `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines. No clear extrema detected.`;
});
