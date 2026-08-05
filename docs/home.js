const newAnalysisButton = document.getElementById("newAnalysisButton");
const scenarioLabButton = document.getElementById("scenarioLabButton");
const dcfRimButton = document.getElementById("dcfRimButton");

newAnalysisButton.addEventListener("click", function () {
  window.location.href = "model-selection.html";
});

dcfRimButton.addEventListener("click", function () {
  window.location.href = "dcf_rim_selection.html";
});

scenarioLabButton.addEventListener("click", function () {
  window.location.href = "scenario-lab.html";
});
