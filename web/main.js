// Keeps the footer copyright year current without a build step.
document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
});
