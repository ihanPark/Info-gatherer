const graphImageInput = document.getElementById('graphImage');
const analyzeImageButton = document.getElementById('analyzeImage');
const graphCanvas = document.getElementById('graphCanvas');
const imageMessageContainer = document.getElementById('imageMessage');
const imageStatusContainer = document.getElementById('imageStatus');
const imageDimensionsContainer = document.getElementById('imageDimensions');
const dropZone = document.getElementById('dropZone');
const markExtremaButton = document.getElementById('markExtrema');
const extremumChartContainer = document.getElementById('extremumChart');
const canvasContext = graphCanvas.getContext('2d');
let currentImage = null;
let lastHighlightMask = null;

function computeSectionCounts(width, height) {
    return {
        verticalSections: Math.max(1, Math.round(width / 18)),
        horizontalSections: Math.max(1, Math.round(height / 18)),
    };
}

function resetImageFeedback() {
    imageMessageContainer.textContent = '';
    imageStatusContainer.textContent = '';
    extremumChartContainer.innerHTML = '';
    markExtremaButton.disabled = true;
    lastHighlightMask = null;
}

function loadImageFile(file) {
    resetImageFeedback();
    analyzeImageButton.disabled = true;

    if (!file) {
        graphCanvas.style.display = 'none';
        canvasContext.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
        imageDimensionsContainer.textContent = '';
        currentImage = null;
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        imageMessageContainer.textContent = 'Please upload a valid image file.';
        imageDimensionsContainer.textContent = '';
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
        imageDimensionsContainer.textContent = `Image size: ${width}px × ${height}px`;
        analyzeImageButton.disabled = false;
        imageStatusContainer.textContent = 'Image loaded. Click "Highlight graph" to tint the curve that contrasts with the background, then use the "Mark Extremum" button beneath the canvas to place markers if the highlight looks right.';

        URL.revokeObjectURL(imageUrl);
    };
    img.onerror = () => {
        imageMessageContainer.textContent = 'Unable to load the selected image. Please choose another file.';
        imageDimensionsContainer.textContent = '';
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

function pruneFlatSegments(mask, width, height) {
    const columnStats = Array.from({ length: width }, () => ({
        count: 0,
        min: height,
        max: -1,
    }));

    mask.forEach((value, idx) => {
        if (!value) {
            return;
        }

        const x = idx % width;
        const y = Math.floor(idx / width);
        const stats = columnStats[x];

        stats.count += 1;
        stats.min = Math.min(stats.min, y);
        stats.max = Math.max(stats.max, y);
    });

    const columnsToRemove = new Uint8Array(width);

    let runStart = null;
    let runMin = null;
    let runMax = null;

    const finalizeRun = (endIndex) => {
        if (runStart === null) {
            return;
        }

        const runLength = endIndex - runStart + 1;
        if (runLength >= 100 && runMax - runMin <= 5) {
            for (let x = runStart; x <= endIndex; x += 1) {
                columnsToRemove[x] = 1;
            }
        }

        runStart = null;
        runMin = null;
        runMax = null;
    };

    for (let x = 0; x < width; x += 1) {
        const stats = columnStats[x];
        if (!stats.count) {
            finalizeRun(x - 1);
            continue;
        }

        const colMin = stats.min;
        const colMax = stats.max;

        if (runStart === null) {
            runStart = x;
            runMin = colMin;
            runMax = colMax;
            continue;
        }

        const nextMin = Math.min(runMin, colMin);
        const nextMax = Math.max(runMax, colMax);

        if (nextMax - nextMin > 5) {
            finalizeRun(x - 1);
            runStart = x;
            runMin = colMin;
            runMax = colMax;
        } else {
            runMin = nextMin;
            runMax = nextMax;
        }
    }

    finalizeRun(width - 1);

    const prunedMask = new Uint8Array(mask.length);
    mask.forEach((value, idx) => {
        if (!value) {
            return;
        }

        const x = idx % width;
        if (columnsToRemove[x]) {
            return;
        }

        prunedMask[idx] = 1;
    });

    return prunedMask;
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

    const prunedMask = pruneFlatSegments(largestComponent.highlightMask, width, height);
    let prunedCount = 0;

    prunedMask.forEach((value) => {
        if (value) {
            prunedCount += 1;
        }
    });

    if (prunedCount === 0) {
        return null;
    }

    const componentColumns = [];
    const componentRows = [];
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    prunedMask.forEach((value, idx) => {
        if (!value) {
            return;
        }
        const x = idx % width;
        const y = Math.floor(idx / width);
        componentColumns.push(x);
        componentRows.push(y);

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    const rejectAxisAlignedLine = () => {
        const verticalSpan = maxY - minY;
        const horizontalSpan = maxX - minX;

        if (horizontalSpan <= 2) {
            const rowsCovered = new Uint8Array(height);
            let rowCount = 0;

            for (let y = 0; y < height; y += 1) {
                for (let x = minX; x <= maxX; x += 1) {
                    if (prunedMask[y * width + x]) {
                        if (!rowsCovered[y]) {
                            rowsCovered[y] = 1;
                            rowCount += 1;
                        }
                        break;
                    }
                }
            }

            if (rowCount / height >= 0.95 && minY <= 2 && maxY >= height - 3) {
                return true;
            }
        }

        if (verticalSpan <= 2) {
            const colsCovered = new Uint8Array(width);
            let colCount = 0;

            for (let x = 0; x < width; x += 1) {
                for (let y = minY; y <= maxY; y += 1) {
                    if (prunedMask[y * width + x]) {
                        if (!colsCovered[x]) {
                            colsCovered[x] = 1;
                            colCount += 1;
                        }
                        break;
                    }
                }
            }

            if (colCount / width >= 0.95 && minX <= 2 && maxX >= width - 3) {
                return true;
            }
        }

        return false;
    };

    if (rejectAxisAlignedLine()) {
        return null;
    }

    if (hasLargeGap(componentColumns, 30) || hasLargeGap(componentRows, 30)) {
        return null;
    }

    const leftBound = Math.min(50, width - 1);
    const rightBound = Math.max(width - 51, 0);
    const touchesLeft = minX <= leftBound;
    const touchesRight = maxX >= rightBound;
    if (!touchesLeft || !touchesRight) {
        return null;
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX <= 10 && spanY <= 10) {
        return null;
    }

    return {
        highlightedCount: prunedCount,
        totalCount: candidateCount,
        highlightMask: prunedMask,
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

function whitenBackground(ctx, mask, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    for (let index = 0; index < mask.length; index += 1) {
        if (mask[index]) {
            continue;
        }

        const offset = index * 4;
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        data[offset + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

function drawVerticalDivisions(ctx, width, height, sections) {
    if (sections <= 0) {
        return;
    }

    const step = width / sections;

    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();

    for (let i = 1; i < sections; i += 1) {
        const x = Math.round(i * step) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    ctx.stroke();
    ctx.restore();
}

function drawHorizontalDivisions(ctx, width, height, sections) {
    if (sections <= 0) {
        return;
    }

    const step = height / sections;

    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();

    for (let i = 1; i < sections; i += 1) {
        const y = Math.round(i * step) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.stroke();
    ctx.restore();
}

function drawMarker(ctx, { x, y }, color, label) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '14px Arial';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeText(label, x + 10, y - 10);
    ctx.fillText(label, x + 10, y - 10);

    ctx.restore();
}

function pixelToGridCoordinates(x, y, width, height, verticalSections, horizontalSections) {
    const sectionWidth = width / verticalSections;
    const sectionHeight = height / horizontalSections;
    const gridX = x / sectionWidth;
    const gridY = (height - y) / sectionHeight;

    return { x: gridX, y: gridY };
}

function renderExtremumTable(maxima, minima, width, height, verticalSections, horizontalSections) {
    extremumChartContainer.innerHTML = '';

    if (!maxima.length && !minima.length) {
        extremumChartContainer.textContent = 'No extrema to display.';
        return;
    }

    const table = document.createElement('table');
    table.className = 'extremum-table';

    const columnCount = Math.max(maxima.length, minima.length);
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));

    for (let i = 0; i < columnCount; i += 1) {
        const th = document.createElement('th');
        th.textContent = i + 1;
        headerRow.appendChild(th);
    }

    table.appendChild(headerRow);

    const makeRow = (label, points) => {
        const row = document.createElement('tr');
        const heading = document.createElement('th');
        heading.scope = 'row';
        heading.textContent = label;
        row.appendChild(heading);

        for (let i = 0; i < columnCount; i += 1) {
            const cell = document.createElement('td');
            const point = points[i];
            if (point) {
                const coords = pixelToGridCoordinates(point.x, point.y, width, height, verticalSections, horizontalSections);
                cell.textContent = `(${coords.x.toFixed(2)}, ${coords.y.toFixed(2)})`;
            } else {
                cell.textContent = '—';
            }
            row.appendChild(cell);
        }

        table.appendChild(row);
    };

    makeRow('Max', maxima);
    makeRow('Min', minima);

    extremumChartContainer.appendChild(table);
}

function findSectionExtrema(mask, width, height, sections) {
    const sectionWidth = width / sections;
    const extrema = [];
    const missingSections = [];

    for (let section = 0; section < sections; section += 1) {
        const startX = Math.floor(section * sectionWidth);
        const endX = section === sections - 1
            ? width - 1
            : Math.floor((section + 1) * sectionWidth) - 1;

        let highestPoint = null;
        let lowestPoint = null;

        for (let y = 0; y < height; y += 1) {
            const rowOffset = y * width;
            for (let x = startX; x <= endX; x += 1) {
                const index = rowOffset + x;
                if (!mask[index]) {
                    continue;
                }

                if (!highestPoint || y < highestPoint.y) {
                    highestPoint = { x, y, section };
                }

                if (!lowestPoint || y > lowestPoint.y) {
                    lowestPoint = { x, y, section };
                }
            }
        }

        if (!highestPoint && !lowestPoint) {
            missingSections.push(section + 1);
        }

        extrema.push({ section, highestPoint, lowestPoint });
    }

    return { extrema, missingSections };
}

function findOrangeMinima(extrema) {
    const points = [];
    extrema.forEach(({ highestPoint, lowestPoint }) => {
        if (highestPoint) {
            points.push({ ...highestPoint, type: 'max' });
        }
        if (lowestPoint) {
            points.push({ ...lowestPoint, type: 'min' });
        }
    });

    points.sort((a, b) => a.x - b.x || a.y - b.y);

    const orangeKeys = new Set();

    for (let i = 0; i < points.length - 1; i += 1) {
        const current = points[i];
        const next = points[i + 1];

        if (current.type === 'min' && next.type === 'min') {
            orangeKeys.add(`${current.section}-${current.x}-${current.y}`);
            orangeKeys.add(`${next.section}-${next.x}-${next.y}`);
        }
    }

    return orangeKeys;
}

function markExtrema(ctx, mask, width, height, sections) {
    const { extrema, missingSections } = findSectionExtrema(mask, width, height, sections);
    const orangeMinima = findOrangeMinima(extrema);

    let markerCount = 0;
    const maxima = [];
    const minima = [];

    extrema.forEach(({ section, highestPoint, lowestPoint }) => {
        const labelSuffix = ` ${section + 1}`;

        if (highestPoint) {
            drawMarker(ctx, highestPoint, '#e11d48', `Max${labelSuffix}`);
            maxima.push(highestPoint);
            markerCount += 1;
        }

        if (lowestPoint) {
            const key = `${section}-${lowestPoint.x}-${lowestPoint.y}`;
            const color = orangeMinima.has(key) && orangeMinima.size >= 2 ? '#f97316' : '#0ea5e9';
            drawMarker(ctx, lowestPoint, color, `Min${labelSuffix}`);
            minima.push(lowestPoint);
            markerCount += 1;
        }
    });

    return { markerCount, missingSections, maxima, minima };
}

analyzeImageButton.addEventListener('click', () => {
    resetImageFeedback();
    imageStatusContainer.textContent = '';

    if (!currentImage || !graphCanvas.width || !graphCanvas.height) {
        imageMessageContainer.textContent = 'Please upload an image before running the analysis.';
        return;
    }

    const { width, height } = graphCanvas;
    const { verticalSections, horizontalSections } = computeSectionCounts(width, height);
    canvasContext.clearRect(0, 0, width, height);
    canvasContext.drawImage(currentImage, 0, 0, width, height);
    markExtremaButton.disabled = true;
    lastHighlightMask = null;

    const highlightSummary = detectGraphMask(canvasContext, width, height);
    if (!highlightSummary) {
        imageMessageContainer.textContent = 'No graph detected. Try an image where the curve contrasts strongly with the background, runs across the width, and shows visible movement (single straight axes are ignored).';
        imageStatusContainer.textContent = 'Detection failed: no contrasting, continuous curve spanning the image with clear variation was found—perfectly horizontal or vertical lines are treated as non-graph content.';
        extremumChartContainer.textContent = '';
        return;
    }

    const mask = highlightSummary.highlightMask;
    applyGraphHighlight(canvasContext, mask, width, height);
    drawVerticalDivisions(canvasContext, width, height, verticalSections);
    drawHorizontalDivisions(canvasContext, width, height, horizontalSections);
    lastHighlightMask = { mask, width, height, verticalSections, horizontalSections };
    markExtremaButton.disabled = false;
    extremumChartContainer.textContent = 'Click "Mark Extremum" to list coordinates for each detected maximum and minimum.';
    imageStatusContainer.textContent = `Graph highlighted and divided into ${verticalSections} vertical and ${horizontalSections} horizontal guide sections. Very flat stretches (within ±5 px over 100 px) and perfectly horizontal or vertical lines spanning the canvas are ignored before marking. Use the "Mark Extremum" button beneath the canvas to place maximum and minimum markers within each vertical section—no pop-ups needed.`;
});

markExtremaButton.addEventListener('click', () => {
    imageMessageContainer.textContent = '';

    if (!lastHighlightMask || !currentImage) {
        imageMessageContainer.textContent = 'Highlight the graph before marking extrema.';
        return;
    }

    const {
        mask,
        width,
        height,
        verticalSections,
        horizontalSections,
    } = lastHighlightMask;

    canvasContext.clearRect(0, 0, width, height);
    canvasContext.drawImage(currentImage, 0, 0, width, height);
    applyGraphHighlight(canvasContext, mask, width, height);
    whitenBackground(canvasContext, mask, width, height);
    drawVerticalDivisions(canvasContext, width, height, verticalSections);
    drawHorizontalDivisions(canvasContext, width, height, horizontalSections);

    const { markerCount, missingSections, maxima, minima } = markExtrema(canvasContext, mask, width, height, verticalSections);
    renderExtremumTable(maxima, minima, width, height, verticalSections, horizontalSections);
    if (markerCount) {
        const missingNote = missingSections.length
            ? ` Sections without detected graph pixels: ${missingSections.join(', ')}.`
            : '';
        imageStatusContainer.textContent = `Graph highlighted on a white background with ${verticalSections} vertical and ${horizontalSections} horizontal guide lines. Marked ${markerCount} extrema (one maximum and one minimum per populated vertical section). Consecutive minima without intervening maxima appear in orange.${missingNote}`;
    } else {
        imageStatusContainer.textContent = 'Graph highlighted, but no extrema points were identified on the detected curve.';
        extremumChartContainer.textContent = 'No extrema to display.';
    }
});
