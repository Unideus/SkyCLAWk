const form = document.getElementById('reportForm');
const btn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.className = 'status';
  statusEl.textContent = 'Generating PDF...';
  btn.disabled = true;

  const data = {
    name: document.getElementById('name').value.trim(),
    date: document.getElementById('birthDate').value,
    time: document.getElementById('birthTime').value,
    location: document.getElementById('location').value.trim(),
    lat: parseFloat(document.getElementById('lat').value),
    lon: parseFloat(document.getElementById('lon').value),
    tzOffset: parseFloat(document.getElementById('tzOffset').value),
  };

  if (!data.name || !data.date || !data.time || !data.location ||
      isNaN(data.lat) || isNaN(data.lon) || isNaN(data.tzOffset)) {
    statusEl.className = 'status error';
    statusEl.textContent = 'Please fill in all fields.';
    btn.disabled = false;
    return;
  }

  try {
    const resp = await fetch('http://localhost:3000/api/cosmic-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || `Server error ${resp.status}`);
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmic-history-report-${data.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    statusEl.className = 'status success';
    statusEl.textContent = 'PDF downloaded.';
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});
