const evaluateRimButton = document.getElementById("evaluateRimButton");
const backButton = document.getElementById("backButton");
const modelSelect = document.getElementById("model");

const MODEL_LABELS = {
  optimistic: "Optimistic",
  balanced: "Balanced",
  conservative: "Conservative"
};

function loadSavedModel() {
  const savedModel = localStorage.getItem("selectedEvaluationModel");

  if (savedModel && MODEL_LABELS[savedModel]) {
    modelSelect.value = savedModel;
  }
}

function getElementValue(id) {
  const element = document.getElementById(id);

  if (!element) {
    console.error(`Element with id "${id}" was not found.`);
    return null;
  }

  return element.value;
}

function getNumberInput(id) {
  const element = document.getElementById(id);

  if (!element) {
    console.error(`Element with id "${id}" was not found.`);
    return null;
  }

  const value = element.value;

  if (value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return null;
  }

  return numberValue;
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)}%`;
}

function collectRimInputData() {
  const selectedModel = getElementValue("model") || "balanced";
  localStorage.setItem("selectedEvaluationModel", selectedModel);

  return {
    companyName: getElementValue("companyName"),
    model: selectedModel,
    stockPrice: getNumberInput("stockPrice"),
    tEquity: getNumberInput("tEquity"),
    netInc: getNumberInput("netInc"),
    SO: getNumberInput("SO"),
    expGrowth: getNumberInput("expGrowth"),
    costOfEquity: getNumberInput("costOfEquity"),
    termGrowth: getNumberInput("termGrowth"),
    payoutRatio: getNumberInput("payoutRatio"),
    projYears: getNumberInput("projYears")
  };
}

async function evaluateRim() {
  const data = collectRimInputData();

  setLoadingState(true);

  try {
    const response = await fetch("http://127.0.0.1:5000/evaluate-rim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      const details = Array.isArray(result.details) ? result.details.join(" ") : "";
      throw new Error(result.error ? `${result.error} ${details}` : "RIM backend response was not successful.");
    }

    displayRimResult(result);
  } catch (error) {
    displayRimError(error.message || "Could not connect to the Python backend.");
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

function displayRimResult(result) {
  const resultText = document.getElementById("rimResultText");
  const scoreText = result.rimScore === null || result.rimScore === undefined
    ? "N/A"
    : `${result.rimScore}/100`;

  resultText.textContent =
    `${result.companyName}: ${result.valuationSignal} | RIM Score: ${scoreText} | Model: ${result.modelName}`;

  resultText.className = "";

  if (result.valuationSignal === "Positive") {
    resultText.classList.add("positive");
  } else if (result.valuationSignal === "Neutral" || result.valuationSignal === "No Market Price") {
    resultText.classList.add("neutral");
  } else if (result.valuationSignal === "Negative") {
    resultText.classList.add("negative");
  }

  displayRimSummary(result);
  displayResidualIncomeRows(result.residualIncomeRows);
  displayRimExplanations(result.explanations);
}

function displayRimSummary(result) {
  const container = document.getElementById("rimSummaryList");
  container.innerHTML = "";

  const summaryItems = [
    ["Adjusted Earnings Growth Rate", formatPercent(result.assumptions.adjustedEarningsGrowthRate)],
    ["Adjusted Cost of Equity", formatPercent(result.assumptions.adjustedCostOfEquity)],
    ["Adjusted Terminal Growth Rate", formatPercent(result.assumptions.adjustedTerminalGrowthRate)],
    ["Dividend Payout Ratio", formatPercent(result.assumptions.payoutRatio)],
    ["PV of Residual Income", formatNumber(result.presentValueOfResidualIncome)],
    ["Terminal Residual Value", formatNumber(result.terminalResidualValue)],
    ["PV of Terminal Residual Value", formatNumber(result.presentValueOfTerminalResidualValue)],
    ["Equity Value", formatNumber(result.equityValue)],
    ["Intrinsic Value per Share", formatNumber(result.intrinsicValuePerShare)],
    ["Upside / Downside", formatPercent(result.upsideDownsidePercent)]
  ];

  summaryItems.forEach(function(item) {
    const row = document.createElement("div");
    row.classList.add("category-score-row");

    const name = document.createElement("span");
    name.classList.add("category-score-name");
    name.textContent = item[0];

    const value = document.createElement("span");
    value.textContent = item[1];

    row.appendChild(name);
    row.appendChild(value);
    container.appendChild(row);
  });
}

function displayResidualIncomeRows(residualIncomeRows) {
  const tableBody = document.getElementById("residualIncomeTableBody");
  tableBody.innerHTML = "";

  if (!residualIncomeRows || residualIncomeRows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No residual income projection available.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  residualIncomeRows.forEach(function(item) {
    const row = document.createElement("tr");

    const cells = [
      item.year,
      formatNumber(item.beginningBookValue),
      formatNumber(item.projectedNetIncome),
      formatNumber(item.equityCharge),
      formatNumber(item.residualIncome),
      formatNumber(item.presentValue)
    ];

    cells.forEach(function(cellValue) {
      const cell = document.createElement("td");
      cell.textContent = cellValue;
      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}

function displayRimExplanations(explanations) {
  const list = document.getElementById("rimExplanationList");
  list.innerHTML = "";

  if (!explanations || explanations.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No explanation available.";
    list.appendChild(li);
    return;
  }

  explanations.forEach(function(explanation) {
    const li = document.createElement("li");
    li.textContent = explanation;
    list.appendChild(li);
  });
}

function displayRimError(message) {
  const resultText = document.getElementById("rimResultText");

  resultText.textContent = message;
  resultText.className = "error";

  document.getElementById("rimSummaryList").innerHTML = "";
  document.getElementById("residualIncomeTableBody").innerHTML = "";
  document.getElementById("rimExplanationList").innerHTML = "";
}

function setLoadingState(isLoading) {
  if (isLoading) {
    evaluateRimButton.disabled = true;
    evaluateRimButton.textContent = "Evaluating RIM...";
  } else {
    evaluateRimButton.disabled = false;
    evaluateRimButton.textContent = "Evaluate RIM";
  }
}

loadSavedModel();

evaluateRimButton.addEventListener("click", evaluateRim);

backButton.addEventListener("click", function () {
  window.location.href = "dcf_rim_selection.html";
});
