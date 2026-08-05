const dcfButton = document.getElementById("dcfButton");
const rimButton = document.getElementById("rimButton");
const scenarioLabButton = document.getElementById("scenarioLabButton");
const backButton = document.getElementById("backButton");

dcfButton.addEventListener("click", function () {
  window.location.href = "dcf-analysis.html";
});

rimButton.addEventListener("click", function () {
  window.location.href = "rim-analysis.html";
});

scenarioLabButton.addEventListener("click", function () {
  window.location.href = "scenario-lab.html";
});

backButton.addEventListener("click", function () {
  window.location.href = "index.html";
});
