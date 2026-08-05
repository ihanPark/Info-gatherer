console.log("JS Loaded");

const evaluateButton = document.getElementById("evaluateButton");
const selectedModelText = document.getElementById("selectedModelText");

let categoryRadarChart = null;

const MODEL_LABELS = {
  optimistic: "Optimistic",
  balanced: "Balanced",
  conservative: "Conservative"
};

function getSelectedModel() {
  const savedModel = localStorage.getItem("selectedEvaluationModel");

  if (MODEL_LABELS[savedModel]) {
    return savedModel;
  }

  localStorage.setItem("selectedEvaluationModel", "balanced");
  return "balanced";
}

function updateSelectedModelText() {
  const model = getSelectedModel();

  if (selectedModelText) {
    selectedModelText.textContent = `Selected model: ${MODEL_LABELS[model]}`;
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

function formatScore(score) {
  if (score === null || score === undefined) {
    return "N/A";
  }

  return `${score}/100`;
}

if (evaluateButton) {
  evaluateButton.addEventListener("click", evaluateCompany);
}

updateSelectedModelText();

async function evaluateCompany() {
  const data = collectInputData();

  setLoadingState(true);

  try {
    const response = await fetch("https://company-evaluator-79k6.onrender.com/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      const details = Array.isArray(result.details) ? result.details.join(" ") : "";
      throw new Error(result.error ? `${result.error} ${details}` : "Backend response was not successful.");
    }

    displayResult(result);
  } catch (error) {
    displayError(error.message || "Could not connect to the Python backend.");
    console.error(error);
  } finally {
    setLoadingState(false);
  }
}

function collectInputData() {
  return {
    companyName: getElementValue("companyName"),
    debtLevel: getElementValue("debtLevel"),
    cashFlow: getElementValue("cashFlow"),
    industryType: getElementValue("industryType"),
    interestRate: getElementValue("interestRate"),
    inflation: getElementValue("inflation"),
    gdpGrowth: getElementValue("gdpGrowth"),

    stockPrice: getNumberInput("stockPrice"),
    revenue: getNumberInput("revenue"),
    preRevenue: getNumberInput("preRevenue"),
    operatingInc: getNumberInput("operatingInc"),
    netInc: getNumberInput("netInc"),
    tDebt: getNumberInput("tDebt"),
    tEquity: getNumberInput("tEquity"),
    cAssets: getNumberInput("cAssets"),
    cLiabilities: getNumberInput("cLiabilities"),
    tAssets: getNumberInput("tAssets"),
    intExp: getNumberInput("intExp"),
    cash: getNumberInput("cash"),
    FCF: getNumberInput("FCF"),
    ocf: getNumberInput("ocf"),
    prevFCF: getNumberInput("prevFCF"),
    EPS: getNumberInput("EPS"),
    prevEPS: getNumberInput("prevEPS"),
    BVpS: getNumberInput("BVpS"),
    SO: getNumberInput("SO"),
    indPE: getNumberInput("indPE"),
    indPB: getNumberInput("indPB"),
    industry: getElementValue("industry"),
    revType: getElementValue("revType"),
    bizType: getElementValue("bizType"),
    expGrowth: getNumberInput("expGrowth"),

    model: getSelectedModel()
  };
}

function displayResult(result) {
  const overallResult = document.getElementById("overallResult");

  overallResult.textContent =
    `${result.companyName}: ${result.overallEvaluation} | Score: ${result.overallScore}/100 | Model: ${result.modelName}`;

  overallResult.className = "";

  if (result.overallEvaluation === "Positive") {
    overallResult.classList.add("positive");
  } else if (result.overallEvaluation === "Neutral") {
    overallResult.classList.add("neutral");
  } else if (result.overallEvaluation === "Negative") {
    overallResult.classList.add("negative");
  }

  renderRadarChart(result.categoryScores, result.modelName);
  displayCategoryScores(result.categoryScores, result.modelWeights);
  displayCategoryExplanations(result.categoryExplanations);
}

function renderRadarChart(categoryScores, modelName) {
  const canvas = document.getElementById("categoryRadarChart");

  if (!canvas) {
    console.error("Radar chart canvas was not found.");
    return;
  }

  if (!categoryScores) {
    console.error("categoryScores was not provided by backend.");
    return;
  }

  if (categoryRadarChart !== null) {
    categoryRadarChart.destroy();
  }

  categoryRadarChart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: [
        "Growth",
        "Profitability",
        "Stability",
        "Cash Flow",
        "Valuation",
        "Macro Adjustment"
      ],
      datasets: [
        {
          label: `${modelName || "Selected"} Model Score`,
          data: [
            categoryScores.growth,
            categoryScores.profitability,
            categoryScores.stability,
            categoryScores.cashFlow,
            categoryScores.valuation,
            categoryScores.macroAdjustment
          ],
          fill: true,
          borderWidth: 2,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: {
          display: true
        }
      }
    }
  });
}

function displayCategoryScores(categoryScores, modelWeights) {
  const container = document.getElementById("categoryScoreList");

  container.innerHTML = "";

  const scoreItems = [
    ["Growth", "growth", categoryScores.growth],
    ["Profitability", "profitability", categoryScores.profitability],
    ["Stability", "stability", categoryScores.stability],
    ["Cash Flow", "cashFlow", categoryScores.cashFlow],
    ["Valuation", "valuation", categoryScores.valuation],
    ["Macro Adjustment", "macroAdjustment", categoryScores.macroAdjustment]
  ];

  scoreItems.forEach(function(item) {
    const row = document.createElement("div");
    row.classList.add("category-score-row");

    const name = document.createElement("span");
    name.classList.add("category-score-name");
    name.textContent = item[0];

    const score = document.createElement("span");
    const weight = modelWeights && modelWeights[item[1]] !== undefined
      ? ` | Weight: ${(modelWeights[item[1]] * 100).toFixed(0)}%`
      : "";
    score.textContent = `${formatScore(item[2])}${weight}`;

    row.appendChild(name);
    row.appendChild(score);
    container.appendChild(row);
  });
}

function displayCategoryExplanations(categoryExplanations) {
  displayList("growthExplanationList", categoryExplanations.growth);
  displayList("profitabilityExplanationList", categoryExplanations.profitability);
  displayList("stabilityExplanationList", categoryExplanations.stability);
  displayList("cashFlowExplanationList", categoryExplanations.cashFlow);
  displayList("valuationExplanationList", categoryExplanations.valuation);
  displayList("macroAdjustmentExplanationList", categoryExplanations.macroAdjustment);
}

function displayList(elementId, items) {
  const list = document.getElementById(elementId);

  list.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No major explanation available.";
    list.appendChild(li);
    return;
  }

  items.forEach(function(item) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
}

function displayError(message) {
  const overallResult = document.getElementById("overallResult");

  overallResult.textContent = message;
  overallResult.className = "error";

  document.getElementById("categoryScoreList").innerHTML = "";

  clearList("growthExplanationList");
  clearList("profitabilityExplanationList");
  clearList("stabilityExplanationList");
  clearList("cashFlowExplanationList");
  clearList("valuationExplanationList");
  clearList("macroAdjustmentExplanationList");

  if (categoryRadarChart !== null) {
    categoryRadarChart.destroy();
    categoryRadarChart = null;
  }
}

function clearList(elementId) {
  const list = document.getElementById(elementId);

  if (list) {
    list.innerHTML = "";
  }
}

function setLoadingState(isLoading) {
  if (!evaluateButton) {
    return;
  }

  if (isLoading) {
    evaluateButton.disabled = true;
    evaluateButton.textContent = "Evaluating...";
  } else {
    evaluateButton.disabled = false;
    evaluateButton.textContent = "Evaluate Company";
  }
}

backButton.addEventListener("click", function () {
  window.location.href = "model-selection.html";
}); 
