const API_BASE_URL = window.SA_API_BASE_URL || "http://127.0.0.1:5000";
const STORAGE_KEY = "scenarioLabInputs";

const form = document.getElementById("scenarioLabForm");
const runScenarioButton = document.getElementById("runScenarioButton");
const resetButton = document.getElementById("resetButton");
const backButton = document.getElementById("backButton");
const loadDemoButton = document.getElementById("loadDemoButton");
const formError = document.getElementById("formError");
const resultsSection = document.getElementById("resultsSection");

let hasCompletedEvaluation = false;
let liveUpdateTimer = null;

const INPUT_IDS = [
  "companyName",
  "stockPrice",
  "SO",
  "FCF",
  "cash",
  "tDebt",
  "dcfProjectionYears",
  "dcfGrowth",
  "dcfDiscountRate",
  "dcfTerminalGrowth",
  "tEquity",
  "netInc",
  "payoutRatio",
  "rimProjectionYears",
  "rimGrowth",
  "costOfEquity",
  "rimTerminalGrowth"
];

const SLIDER_PAIRS = [
  ["dcfGrowth", "dcfGrowthRange"],
  ["dcfDiscountRate", "dcfDiscountRateRange"],
  ["dcfTerminalGrowth", "dcfTerminalGrowthRange"],
  ["rimGrowth", "rimGrowthRange"],
  ["costOfEquity", "costOfEquityRange"],
  ["rimTerminalGrowth", "rimTerminalGrowthRange"]
];

const DEMO_DATA = {
  companyName: "Example Company",
  stockPrice: 150,
  SO: 1000,
  FCF: 18000,
  cash: 12000,
  tDebt: 25000,
  dcfProjectionYears: 5,
  dcfGrowth: 8,
  dcfDiscountRate: 10,
  dcfTerminalGrowth: 2.5,
  tEquity: 92000,
  netInc: 15500,
  payoutRatio: 30,
  rimProjectionYears: 5,
  rimGrowth: 7,
  costOfEquity: 11,
  rimTerminalGrowth: 2.5
};

function getElement(id) {
  return document.getElementById(id);
}

function getNumberValue(id) {
  const element = getElement(id);
  if (!element || element.value === "") {
    return null;
  }

  const numberValue = Number(element.value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits
  });
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  return `$${formatNumber(value, 2)}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "N/A";
  }

  const numericValue = Number(value);
  const sign = numericValue > 0 ? "+" : "";
  return `${sign}${numericValue.toFixed(2)}%`;
}

function collectInputData() {
  return {
    companyName: getElement("companyName").value.trim(),
    stockPrice: getNumberValue("stockPrice"),
    SO: getNumberValue("SO"),
    FCF: getNumberValue("FCF"),
    cash: getNumberValue("cash"),
    tDebt: getNumberValue("tDebt"),
    dcfProjectionYears: getNumberValue("dcfProjectionYears"),
    dcfGrowth: getNumberValue("dcfGrowth"),
    dcfDiscountRate: getNumberValue("dcfDiscountRate"),
    dcfTerminalGrowth: getNumberValue("dcfTerminalGrowth"),
    tEquity: getNumberValue("tEquity"),
    netInc: getNumberValue("netInc"),
    payoutRatio: getNumberValue("payoutRatio"),
    rimProjectionYears: getNumberValue("rimProjectionYears"),
    rimGrowth: getNumberValue("rimGrowth"),
    costOfEquity: getNumberValue("costOfEquity"),
    rimTerminalGrowth: getNumberValue("rimTerminalGrowth")
  };
}

function validateClientInputs(data) {
  const errors = [];

  const positiveFields = [
    [data.stockPrice, "Current Stock Price"],
    [data.SO, "Shares Outstanding"],
    [data.FCF, "Current Free Cash Flow"],
    [data.dcfDiscountRate, "DCF Discount Rate"],
    [data.tEquity, "Book Value of Equity"],
    [data.netInc, "Current Net Income"],
    [data.costOfEquity, "RIM Cost of Equity"]
  ];

  positiveFields.forEach(function ([value, label]) {
    if (value === null) {
      errors.push(`${label} is required.`);
    } else if (value <= 0) {
      errors.push(`${label} must be greater than 0.`);
    }
  });

  const requiredFields = [
    [data.cash, "Cash and Equivalents"],
    [data.tDebt, "Total Debt"],
    [data.dcfGrowth, "Annual FCF Growth"],
    [data.dcfTerminalGrowth, "DCF Terminal Growth"],
    [data.rimGrowth, "Annual Earnings Growth"],
    [data.rimTerminalGrowth, "RIM Terminal Growth"],
    [data.payoutRatio, "Dividend Payout Ratio"]
  ];

  requiredFields.forEach(function ([value, label]) {
    if (value === null) {
      errors.push(`${label} is required.`);
    }
  });

  if (data.dcfProjectionYears === null || data.dcfProjectionYears < 1 || data.dcfProjectionYears > 10) {
    errors.push("DCF Projection Years must be between 1 and 10.");
  }

  if (data.rimProjectionYears === null || data.rimProjectionYears < 1 || data.rimProjectionYears > 10) {
    errors.push("RIM Projection Years must be between 1 and 10.");
  }

  if (data.payoutRatio !== null && (data.payoutRatio < 0 || data.payoutRatio > 100)) {
    errors.push("Dividend Payout Ratio must be between 0 and 100.");
  }

  if (
    data.dcfDiscountRate !== null &&
    data.dcfTerminalGrowth !== null &&
    data.dcfDiscountRate <= data.dcfTerminalGrowth
  ) {
    errors.push("DCF Discount Rate must be greater than DCF Terminal Growth.");
  }

  if (
    data.costOfEquity !== null &&
    data.rimTerminalGrowth !== null &&
    data.costOfEquity <= data.rimTerminalGrowth
  ) {
    errors.push("RIM Cost of Equity must be greater than RIM Terminal Growth.");
  }

  return errors;
}

function showError(messages) {
  const errorMessages = Array.isArray(messages) ? messages : [messages];
  formError.innerHTML = errorMessages.map(function (message) {
    return `<div>${escapeHtml(String(message))}</div>`;
  }).join("");
  formError.classList.add("visible");
}

function clearError() {
  formError.textContent = "";
  formError.classList.remove("visible");
}

function setLoadingState(isLoading) {
  runScenarioButton.disabled = isLoading;
  runScenarioButton.textContent = isLoading ? "Calculating Scenarios..." : "Run Scenario Lab";
}

function saveInputs(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Scenario Lab inputs could not be saved.", error);
  }
}

function loadSavedInputs() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) {
      return;
    }

    const savedData = JSON.parse(rawData);
    setInputValues(savedData);
  } catch (error) {
    console.warn("Saved Scenario Lab inputs could not be loaded.", error);
  }
}

function setInputValues(values) {
  INPUT_IDS.forEach(function (id) {
    const element = getElement(id);
    if (!element || values[id] === undefined || values[id] === null) {
      return;
    }

    element.value = values[id];
  });

  syncAllSlidersFromNumbers();
}

function resetForm() {
  form.reset();
  clearError();
  resultsSection.hidden = true;
  hasCompletedEvaluation = false;
  localStorage.removeItem(STORAGE_KEY);
  syncAllSlidersFromNumbers();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clampToElementRange(value, element) {
  let clampedValue = value;
  const minimum = element.min === "" ? null : Number(element.min);
  const maximum = element.max === "" ? null : Number(element.max);

  if (minimum !== null && Number.isFinite(minimum)) {
    clampedValue = Math.max(minimum, clampedValue);
  }
  if (maximum !== null && Number.isFinite(maximum)) {
    clampedValue = Math.min(maximum, clampedValue);
  }

  return clampedValue;
}

function setupSliderPair(numberId, rangeId) {
  const numberInput = getElement(numberId);
  const rangeInput = getElement(rangeId);

  rangeInput.addEventListener("input", function () {
    numberInput.value = rangeInput.value;
    scheduleLiveEvaluation();
  });

  numberInput.addEventListener("input", function () {
    const value = Number(numberInput.value);
    if (!Number.isFinite(value)) {
      return;
    }

    rangeInput.value = clampToElementRange(value, rangeInput);
    scheduleLiveEvaluation();
  });
}

function syncAllSlidersFromNumbers() {
  SLIDER_PAIRS.forEach(function ([numberId, rangeId]) {
    const numberInput = getElement(numberId);
    const rangeInput = getElement(rangeId);
    const value = Number(numberInput.value);

    if (Number.isFinite(value)) {
      rangeInput.value = clampToElementRange(value, rangeInput);
    }
  });
}

function scheduleLiveEvaluation() {
  if (!hasCompletedEvaluation) {
    return;
  }

  clearTimeout(liveUpdateTimer);
  liveUpdateTimer = setTimeout(function () {
    runScenarioLab({ scrollToResults: false });
  }, 450);
}

async function runScenarioLab(options = {}) {
  const scrollToResults = options.scrollToResults !== false;
  const data = collectInputData();
  const validationErrors = validateClientInputs(data);

  clearError();

  if (validationErrors.length > 0) {
    showError(validationErrors);
    return;
  }

  setLoadingState(true);

  try {
    const response = await fetch(`${API_BASE_URL}/evaluate-scenario-lab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("The backend returned an unreadable response.");
    }

    if (!response.ok) {
      const details = Array.isArray(result.details) ? result.details : [];
      const message = result.error || "Scenario Lab evaluation failed.";
      throw new Error([message, ...details].join(" "));
    }

    displayResults(result);
    saveInputs(data);
    hasCompletedEvaluation = true;

    if (scrollToResults) {
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    showError(error.message || "Could not connect to the Python backend.");
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

function displayResults(result) {
  resultsSection.hidden = false;
  getElement("resultsTitle").textContent = `${result.companyName} Scenario Comparison`;
  getElement("resultsTimestamp").textContent = `Calculated ${new Date().toLocaleString()}`;

  displayScenarioCards(result.scenarios);
  displayMethodComparison(result);
  displaySensitivityMatrix(result.sensitivityMatrix, result.currentStockPrice);
  displayKeyDrivers(result.keyValueDrivers);
  displayWarnings(result.warnings);
}

function displayScenarioCards(scenarios) {
  const container = getElement("scenarioCards");
  container.innerHTML = "";

  scenarios.forEach(function (scenario) {
    const card = document.createElement("article");
    card.className = `scenario-result-card ${scenario.key}`;

    const adjustmentText = scenario.key === "base"
      ? "Entered assumptions"
      : `Growth ${signedPoints(scenario.adjustments.growthDelta)}, Return ${signedPoints(scenario.adjustments.requiredReturnDelta)}, Terminal ${signedPoints(scenario.adjustments.terminalGrowthDelta)}`;

    const heading = document.createElement("div");
    heading.className = "scenario-label";
    heading.innerHTML = `<h3>${escapeHtml(scenario.name)}</h3><span>${escapeHtml(adjustmentText)}</span>`;
    card.appendChild(heading);

    card.appendChild(createScenarioMethodRow("DCF", scenario.dcf));
    card.appendChild(createScenarioMethodRow("RIM", scenario.rim));

    const range = document.createElement("div");
    range.className = "scenario-range";
    range.textContent = `Method range: ${formatMoney(scenario.valuationRange.low)} – ${formatMoney(scenario.valuationRange.high)}`;
    card.appendChild(range);

    container.appendChild(card);
  });
}

function createScenarioMethodRow(methodName, methodResult) {
  const row = document.createElement("div");
  row.className = "scenario-method-row";

  if (!methodResult || methodResult.error) {
    row.innerHTML = `
      <span class="method-name">${escapeHtml(methodName)}</span>
      <strong class="method-value">N/A</strong>
      <span class="method-upside negative-text">${escapeHtml(methodResult?.error || "Calculation unavailable")}</span>
    `;
    return row;
  }

  const textClass = getSignalClass(methodResult.valuationSignal);
  row.innerHTML = `
    <span class="method-name">${escapeHtml(methodName)} Fair Value</span>
    <strong class="method-value">${formatMoney(methodResult.intrinsicValuePerShare)}</strong>
    <span class="method-upside ${textClass}">${formatPercent(methodResult.upsideDownsidePercent)} vs. market · ${escapeHtml(methodResult.valuationSignal)}</span>
  `;

  return row;
}

function displayMethodComparison(result) {
  const container = getElement("methodComparison");
  const baseScenario = result.scenarios.find(function (scenario) {
    return scenario.key === "base";
  });

  if (!baseScenario) {
    container.innerHTML = "";
    return;
  }

  const dcfValue = baseScenario.dcf?.intrinsicValuePerShare;
  const rimValue = baseScenario.rim?.intrinsicValuePerShare;
  const rangeLow = baseScenario.valuationRange?.low;
  const rangeHigh = baseScenario.valuationRange?.high;

  const metrics = [
    ["Market Price", formatMoney(result.currentStockPrice)],
    ["DCF Fair Value", formatMoney(dcfValue)],
    ["RIM Fair Value", formatMoney(rimValue)],
    ["Valuation Range", `${formatMoney(rangeLow)} – ${formatMoney(rangeHigh)}`]
  ];

  container.innerHTML = "";
  metrics.forEach(function ([label, value]) {
    const item = document.createElement("div");
    item.className = "metric-card";
    item.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    container.appendChild(item);
  });
}

function displaySensitivityMatrix(matrix, stockPrice) {
  const tableHead = getElement("sensitivityTableHead");
  const tableBody = getElement("sensitivityTableBody");
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  const headerRow = document.createElement("tr");
  const cornerCell = document.createElement("th");
  cornerCell.textContent = "Terminal ↓ / Discount →";
  headerRow.appendChild(cornerCell);

  matrix.discountRates.forEach(function (discountRate) {
    const headerCell = document.createElement("th");
    headerCell.textContent = `${Number(discountRate).toFixed(2)}%`;
    headerRow.appendChild(headerCell);
  });
  tableHead.appendChild(headerRow);

  matrix.rows.forEach(function (rowData) {
    const row = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.textContent = `${Number(rowData.terminalGrowthRate).toFixed(2)}%`;
    row.appendChild(labelCell);

    rowData.values.forEach(function (value) {
      const cell = document.createElement("td");

      if (value === null || value === undefined) {
        cell.textContent = "Invalid";
        cell.classList.add("invalid-cell");
      } else {
        cell.textContent = formatMoney(value);
        cell.classList.add(getSensitivityCellClass(value, stockPrice));
      }

      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}

function displayKeyDrivers(drivers) {
  const container = getElement("keyDrivers");
  container.innerHTML = "";

  if (!drivers || drivers.length === 0) {
    container.textContent = "No driver analysis is available.";
    return;
  }

  drivers.forEach(function (driver, index) {
    const item = document.createElement("div");
    item.className = "driver-item";
    item.innerHTML = `
      <span class="driver-rank">${index + 1}</span>
      <div class="driver-copy">
        <strong>${escapeHtml(driver.label)}</strong>
        <span>${escapeHtml(driver.method)} one-variable stress test</span>
      </div>
      <span class="driver-impact">${Number(driver.impactPercent).toFixed(2)}%</span>
    `;
    container.appendChild(item);
  });
}

function displayWarnings(warnings) {
  const container = getElement("warningList");
  container.innerHTML = "";

  warnings.forEach(function (warning) {
    const item = document.createElement("div");
    item.className = `warning-item ${warning.level || "medium"}`;
    item.innerHTML = `
      <span class="warning-indicator" aria-hidden="true"></span>
      <div class="warning-copy">
        <strong>${escapeHtml(warning.title)}</strong>
        <span>${escapeHtml(warning.message)}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function getSensitivityCellClass(value, stockPrice) {
  if (stockPrice === null || stockPrice === undefined || stockPrice <= 0) {
    return "neutral-cell";
  }

  const upside = ((value - stockPrice) / stockPrice) * 100;
  if (upside >= 15) {
    return "positive-cell";
  }
  if (upside <= -15) {
    return "negative-cell";
  }
  return "neutral-cell";
}

function getSignalClass(signal) {
  if (signal === "Positive") {
    return "positive-text";
  }
  if (signal === "Negative") {
    return "negative-text";
  }
  return "neutral-text";
}

function signedPoints(value) {
  const numericValue = Number(value);
  const sign = numericValue > 0 ? "+" : "";
  return `${sign}${numericValue.toFixed(1)} pts`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

SLIDER_PAIRS.forEach(function ([numberId, rangeId]) {
  setupSliderPair(numberId, rangeId);
});

INPUT_IDS.forEach(function (id) {
  const element = getElement(id);
  if (!element) {
    return;
  }

  element.addEventListener("input", function () {
    if (!SLIDER_PAIRS.some(function ([numberId]) { return numberId === id; })) {
      scheduleLiveEvaluation();
    }
  });
});

form.addEventListener("submit", function (event) {
  event.preventDefault();
  runScenarioLab();
});

loadDemoButton.addEventListener("click", function () {
  setInputValues(DEMO_DATA);
  clearError();
  if (hasCompletedEvaluation) {
    runScenarioLab({ scrollToResults: false });
  }
});

resetButton.addEventListener("click", resetForm);

backButton.addEventListener("click", function () {
  window.location.href = "index.html";
});

loadSavedInputs();
syncAllSlidersFromNumbers();
