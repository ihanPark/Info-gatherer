const evaluateDcfButton = document.getElementById("evaluateDcfButton");
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

function collectDcfInputData() {
  const selectedModel = getElementValue("model") || "balanced";
  localStorage.setItem("selectedEvaluationModel", selectedModel);

  return {
    companyName: getElementValue("companyName"),
    model: selectedModel,
    stockPrice: getNumberInput("stockPrice"),
    FCF: getNumberInput("FCF"),
    cash: getNumberInput("cash"),
    tDebt: getNumberInput("tDebt"),
    SO: getNumberInput("SO"),
    expGrowth: getNumberInput("expGrowth"),
    discRate: getNumberInput("discRate"),
    termGrowth: getNumberInput("termGrowth"),
    projYears: getNumberInput("projYears")
  };
}

async function evaluateDcf() {
  const data = collectDcfInputData();

  setLoadingState(true);

  try {
    const response = await fetch("http://127.0.0.1:5000/evaluate-dcf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      const details = Array.isArray(result.details) ? result.details.join(" ") : "";
      throw new Error(result.error ? `${result.error} ${details}` : "DCF backend response was not successful.");
    }

    displayDcfResult(result);
  } catch (error) {
    displayDcfError(error.message || "Could not connect to the Python backend.");
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

function displayDcfResult(result) {
  const resultText = document.getElementById("dcfResultText");
  const scoreText = result.dcfScore === null || result.dcfScore === undefined
    ? "N/A"
    : `${result.dcfScore}/100`;

  resultText.textContent =
    `${result.companyName}: ${result.valuationSignal} | DCF Score: ${scoreText} | Model: ${result.modelName}`;

  resultText.className = "";

  if (result.valuationSignal === "Positive") {
    resultText.classList.add("positive");
  } else if (result.valuationSignal === "Neutral" || result.valuationSignal === "No Market Price") {
    resultText.classList.add("neutral");
  } else if (result.valuationSignal === "Negative") {
    resultText.classList.add("negative");
  }

  displayDcfSummary(result);
  displayProjectedCashFlows(result.projectedCashFlows);
  displayDcfExplanations(result.explanations);
}

function displayDcfSummary(result) {
  const container = document.getElementById("dcfSummaryList");
  container.innerHTML = "";

  const summaryItems = [
    ["Adjusted Growth Rate", formatPercent(result.assumptions.adjustedGrowthRate)],
    ["Adjusted Discount Rate", formatPercent(result.assumptions.adjustedDiscountRate)],
    ["Adjusted Terminal Growth Rate", formatPercent(result.assumptions.adjustedTerminalGrowthRate)],
    ["PV of Projected FCF", formatNumber(result.presentValueOfCashFlows)],
    ["Terminal Value", formatNumber(result.terminalValue)],
    ["PV of Terminal Value", formatNumber(result.presentValueOfTerminalValue)],
    ["Enterprise Value", formatNumber(result.enterpriseValue)],
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

function displayProjectedCashFlows(projectedCashFlows) {
  const tableBody = document.getElementById("projectedCashFlowTableBody");
  tableBody.innerHTML = "";

  if (!projectedCashFlows || projectedCashFlows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No projected cash flows available.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  projectedCashFlows.forEach(function(item) {
    const row = document.createElement("tr");

    const yearCell = document.createElement("td");
    yearCell.textContent = item.year;

    const fcfCell = document.createElement("td");
    fcfCell.textContent = formatNumber(item.projectedFCF);

    const pvCell = document.createElement("td");
    pvCell.textContent = formatNumber(item.presentValue);

    row.appendChild(yearCell);
    row.appendChild(fcfCell);
    row.appendChild(pvCell);
    tableBody.appendChild(row);
  });
}

function displayDcfExplanations(explanations) {
  const list = document.getElementById("dcfExplanationList");
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

function displayDcfError(message) {
  const resultText = document.getElementById("dcfResultText");

  resultText.textContent = message;
  resultText.className = "error";

  document.getElementById("dcfSummaryList").innerHTML = "";
  document.getElementById("projectedCashFlowTableBody").innerHTML = "";
  document.getElementById("dcfExplanationList").innerHTML = "";
}

function setLoadingState(isLoading) {
  if (isLoading) {
    evaluateDcfButton.disabled = true;
    evaluateDcfButton.textContent = "Evaluating DCF...";
  } else {
    evaluateDcfButton.disabled = false;
    evaluateDcfButton.textContent = "Evaluate DCF";
  }
}

loadSavedModel();

evaluateDcfButton.addEventListener("click", evaluateDcf);

backButton.addEventListener("click", function () {
  window.location.href = "dcf_rim_selection.html";
});
