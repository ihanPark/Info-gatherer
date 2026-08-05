const optButton = document.getElementById("optButton");
const balButton = document.getElementById("balButton");
const conButton = document.getElementById("conButton");
const backButton = document.getElementById("backButton");

function selectModel(modelKey) {
  localStorage.setItem("selectedEvaluationModel", modelKey);
  window.location.href = "analysis.html";
}

optButton.addEventListener("click", function () {
  selectModel("optimistic");
}); 

balButton.addEventListener("click", function () {
  selectModel("balanced");
});

conButton.addEventListener("click", function () {
  selectModel("conservative");
});

backButton.addEventListener("click", function () {
  window.location.href = "index.html";
});