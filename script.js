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
        imageStatusContainer.textContent = 'Image loaded. Click "Highlight graph & mark extrema" to spotlight the curve and annotate its peaks.';

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

function buildCurveProfile(mask, width, height) {
    const profile = new Array(width).fill(null);

    for (let x = 0; x < width; x += 1) {
        let sumY = 0;
        let count = 0;

        for (let y = 0; y < height; y += 1) {
            if (mask[y * width + x]) {
                sumY += y;
                count += 1;
            }
        }

        if (count > 0) {
            profile[x] = sumY / count;
        }
    }

    return profile;
}

function detectLocalExtrema(profile) {
    const segments = [];
    let current = [];

    for (let x = 0; x < profile.length; x += 1) {
        const y = profile[x];
        if (y === null) {
            if (current.length) {
                segments.push(current);
                current = [];
            }
            continue;
        }
        current.push({ x, y });
    }

    if (current.length) {
        segments.push(current);
    }

    const maxima = [];
    const minima = [];
    const slopeThreshold = 0.2;
    const separation = 4;

    function recordExtrema(list, point, preferLowerY = false) {
        if (!list.length) {
            list.push(point);
            return;
        }

        const last = list[list.length - 1];
        if (Math.abs(last.x - point.x) >= separation) {
            list.push(point);
        } else if ((preferLowerY && point.y < last.y) || (!preferLowerY && point.y > last.y)) {
            list[list.length - 1] = point;
        }
    }

    segments.forEach((segment) => {
        const smoothed = segment.map((point, index) => {
            let sum = 0;
            let count = 0;
            for (let i = Math.max(0, index - 2); i <= Math.min(segment.length - 1, index + 2); i += 1) {
                sum += segment[i].y;
                count += 1;
            }
            return { x: point.x, y: sum / count };
        });

        const derivatives = smoothed.map((point, index) => {
            if (index === 0) {
                return 0;
            }
            return smoothed[index].y - smoothed[index - 1].y;
        });

        for (let i = 1; i < smoothed.length - 1; i += 1) {
            const prevSlope = derivatives[i];
            const nextSlope = derivatives[i + 1];

            const crossingMax = prevSlope < -slopeThreshold && nextSlope > slopeThreshold;
            const crossingMin = prevSlope > slopeThreshold && nextSlope < -slopeThreshold;

            if (crossingMax) {
                recordExtrema(maxima, smoothed[i], true);
            } else if (crossingMin) {
                recordExtrema(minima, smoothed[i], false);
            } else {
                const nearFlatPrev = Math.abs(prevSlope) <= slopeThreshold;
                const nearFlatNext = Math.abs(nextSlope) <= slopeThreshold;
                if (nearFlatPrev && nearFlatNext) {
                    const window = smoothed.slice(Math.max(0, i - 2), Math.min(smoothed.length, i + 3));
                    const totalDiff = window.reduce((sum, point, idx) => {
                        if (idx === 0) {
                            return sum;
                        }
                        return sum + (window[idx].y - window[idx - 1].y);
                    }, 0);
                    const avgSlope = totalDiff / Math.max(1, window.length - 1);
                    if (avgSlope > slopeThreshold) {
                        recordExtrema(minima, smoothed[i], false);
                    } else if (avgSlope < -slopeThreshold) {
                        recordExtrema(maxima, smoothed[i], true);
                    }
                }
            }
        }
    });

    if (!maxima.length && !minima.length) {
        return null;
    }

    return { maxima, minima };
}

function snapPointToMask(point, mask, width, height, radius = 3) {
    if (!point) {
        return null;
    }

    const centerX = Math.round(point.x);
    const centerY = Math.round(point.y);
    const radiusSq = radius * radius;
    let best = null;

    for (let dy = -radius; dy <= radius; dy += 1) {
        const y = centerY + dy;
        if (y < 0 || y >= height) {
            continue;
        }
        for (let dx = -radius; dx <= radius; dx += 1) {
            const x = centerX + dx;
            if (x < 0 || x >= width) {
                continue;
            }
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > radiusSq) {
                continue;
            }

            const index = y * width + x;
            if (mask[index]) {
                if (!best || distanceSq < best.distanceSq) {
                    best = { x, y, distanceSq };
                }
            }
        }
    }

    if (!best) {
        return null;
    }

    return { x: best.x, y: best.y };
}

function snapPointsToMask(points, mask, width, height, radius = 3) {
    if (!points) {
        return [];
    }

    return points
        .map((point) => snapPointToMask(point, mask, width, height, radius))
        .filter((point) => point !== null);
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

    const mask = highlightSummary.highlightMask;
    const extrema = findExtremaFromMask(mask, width, height);
    const profile = buildCurveProfile(mask, width, height);
    const localExtrema = detectLocalExtrema(profile);

    const snappedFlat = extrema?.flatPoint ? snapPointToMask(extrema.flatPoint, mask, width, height) : null;
    const snappedMax = extrema?.maxPoint ? snapPointToMask(extrema.maxPoint, mask, width, height) : null;
    const snappedMin = extrema?.minPoint ? snapPointToMask(extrema.minPoint, mask, width, height) : null;
    const snappedLocalMaxima = snapPointsToMask(localExtrema?.maxima, mask, width, height);
    const snappedLocalMinima = snapPointsToMask(localExtrema?.minima, mask, width, height);

    if (snappedFlat) {
        drawMarker(canvasContext, snappedFlat, { color: '#c026d3', label: 'Flat extremum' });
        imageStatusContainer.textContent = `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines. Marked a flat extremum${snappedLocalMaxima.length || snappedLocalMinima.length ? ' plus local extrema.' : '.'}`;
    } else if (snappedMax || snappedMin) {
        if (snappedMax) {
            drawMarker(canvasContext, snappedMax, { color: '#dc2626', label: 'Max' });
        }
        if (snappedMin) {
            drawMarker(canvasContext, snappedMin, { color: '#1d4ed8', label: 'Min' });
        }
        const extremaLabels = [
            snappedMax ? 'maximum' : null,
            snappedMin ? 'minimum' : null,
        ].filter(Boolean);
        const labelText = extremaLabels.length ? ` Marked the ${extremaLabels.join(' and ')}.` : '';
        imageStatusContainer.textContent = `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines.${labelText}`;
    }

    if (snappedLocalMaxima.length || snappedLocalMinima.length) {
        snappedLocalMaxima.forEach((point, index) => {
            drawMarker(canvasContext, point, { color: '#f97316', label: `Local max ${index + 1}` });
        });
        snappedLocalMinima.forEach((point, index) => {
            drawMarker(canvasContext, point, { color: '#0ea5e9', label: `Local min ${index + 1}` });
        });
        const localParts = [];
        if (snappedLocalMaxima.length) {
            localParts.push(`${snappedLocalMaxima.length} local max${snappedLocalMaxima.length > 1 ? 'ima' : 'imum'}`);
        }
        if (snappedLocalMinima.length) {
            localParts.push(`${snappedLocalMinima.length} local min${snappedLocalMinima.length > 1 ? 'ima' : 'imum'}`);
        }
        const prefix = snappedFlat || snappedMax || snappedMin ? ' Also marked' : 'Marked';
        const description = localParts.length ? `${prefix} ${localParts.join(' and ')}.` : '';
        imageStatusContainer.textContent = `${imageStatusContainer.textContent || `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines.`}${description}`.trim();
        return;
    }

    if (!snappedFlat && !snappedMax && !snappedMin) {
        imageStatusContainer.textContent = `Highlighted ${highlightSummary.highlightedCount.toLocaleString()} coloured pixels after filtering out grid lines. No clear extrema detected on the highlighted graph.`;
    }
});
