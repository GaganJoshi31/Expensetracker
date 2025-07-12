document.getElementById('fileInput').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    if (file.name.endsWith('.csv')) {
      parseCSV(contents);
    } else {
      document.getElementById('dashboard').innerHTML = "<p style='color:red;'>PDF support is not available yet.</p>";
    }
  };
  if (file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
});

function parseCSV(csvText) {
  const rows = csvText.trim().split("\n").map(r => r.split(","));
  const dashboard = document.getElementById('dashboard');
  let html = "<h3>Parsed Transactions</h3><table><thead><tr>";
  rows[0].forEach(col => html += `<th>${col}</th>`);
  html += "</tr></thead><tbody>";
  rows.slice(1).forEach(row => {
    html += "<tr>";
    row.forEach(cell => html += `<td>${cell}</td>`);
    html += "</tr>";
  });
  html += "</tbody></table>";
  dashboard.innerHTML = html;
}

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
