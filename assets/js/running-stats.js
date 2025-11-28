async function loadStats() {
  try {
    const response = await fetch('/assets/data/stats.json');
    if (!response.ok) {
      throw new Error('Failed to load stats.json: ' + response.status);
    }
    const data = await response.json();
    renderDashboard(data);
  } catch (err) {
    console.error(err);
    const el = document.getElementById('updatedAt');
    if (el) {
      el.textContent = 'Error loading stats. Check console.';
    }
  }
}

document.addEventListener('DOMContentLoaded', loadStats);

function formatKm(km) {
  return km.toFixed(1);
}

function formatElevation(m) {
  return `${m.toLocaleString()} m`;
}

function formatHours(h) {
  return h.toFixed(1) + ' h';
}

function renderDashboard(stats) {
  renderUpdatedAt(stats.updatedAt);
  renderLifetime(stats);
  renderPBs(stats.pbs);
  renderYTD(stats.yearToDate);
  renderAllYears(stats.yearlyTotals);
  renderRecentRuns(stats.recentRuns);
}

function renderUpdatedAt(updatedAt) {
  const el = document.getElementById('updatedAt');
  if (!el) return;
  const dt = new Date(updatedAt);
  el.textContent = `Last updated: ${dt.toLocaleString()}`;
}

// 1. Lifetime section
function renderLifetime(stats) {
  const container = document.getElementById('lifetime-section');
  if (!container) return;

  const lt = stats.lifetime;

  container.innerHTML = `
    <h2>Lifetime</h2>
    <ul class="stat-list">
      <li><strong>Total distance:</strong> ${formatKm(lt.distance_km)} km</li>
      <li><strong>Total elevation:</strong> ${formatElevation(lt.elevation_m)}</li>
      <li><strong>Total time:</strong> ${formatHours(lt.time_hours)}</li>
    </ul>
  `;
}

// 2. Personal Bests
function renderPBs(pbs) {
  const container = document.getElementById('pbs-section');
  if (!container) return;

  // Normalise PBs by event name for easy lookup
  const byEvent = {};
  (pbs || []).forEach(pb => {
    byEvent[pb.event] = pb;
  });

  const events = ['50K', 'Marathon', 'Half Marathon', '10K', '5K'];

  const itemsHtml = events.map(evt => {
    const pb = byEvent[evt];
    if (!pb) {
      return `<li><strong>${evt}:</strong> —</li>`;
    }
    return `<li><strong>${evt}:</strong> ${pb.time} <span class="pb-date">(${pb.date})</span></li>`;
  }).join('');

  container.innerHTML = `
    <h2>Personal Bests</h2>
    <ul class="stat-list">
      ${itemsHtml}
    </ul>
  `;
}

// 3. Year-to-date section (current year header)
function renderYTD(ytd) {
  const container = document.getElementById('ytd-section');
  if (!container) return;

  const year = ytd.year;

  container.innerHTML = `
    <h2>${year} Year To Date</h2>
    <ul class="stat-list">
      <li><strong>Total distance:</strong> ${formatKm(ytd.distance_km)} km</li>
      <li><strong>Total elevation:</strong> ${formatElevation(ytd.elevation_m)}</li>
      <li><strong>Total time:</strong> ${formatHours(ytd.time_hours)}</li>
    </ul>
  `;
}

// 4. All years section (with % change vs previous year)
function renderAllYears(yearlyTotals) {
  const container = document.getElementById('all-years-section');
  if (!container) return;

  if (!Array.isArray(yearlyTotals) || yearlyTotals.length === 0) {
    container.innerHTML = '<h2>All Years</h2><p>No data.</p>';
    return;
  }

  // Sort descending by year (latest first)
  const sorted = [...yearlyTotals].sort((a, b) => b.year - a.year);

  // We’ll show from current year down to 2022
  const filtered = sorted.filter(y => y.year >= 2022);

  let html = '<h2>All Years</h2><ul class="stat-list">';

  for (let i = 0; i < filtered.length; i++) {
    const cur = filtered[i];
    const prev = filtered[i + 1]; // next element in array (previous year)

    const dist = cur.distance_km;
    let changeHtml = '';

    if (prev && prev.distance_km > 0) {
      const diff = dist - prev.distance_km;
      const pct = (diff / prev.distance_km) * 100;
      const rounded = pct.toFixed(1);

      if (pct > 0) {
        changeHtml = ` <span class="year-change positive">(+${rounded}%)</span>`;
      } else if (pct < 0) {
        changeHtml = ` <span class="year-change negative">(${rounded}%)</span>`;
      } else {
        changeHtml = ` <span class="year-change neutral">(0.0%)</span>`;
      }
    } else {
      // No previous year or zero previous distance – no % change
      changeHtml = '';
    }

    html += `
      <li>
        <strong>${cur.year} total distance:</strong>
        ${formatKm(cur.distance_km)} km
        ${changeHtml}
      </li>
    `;
  }

  html += '</ul>';

  container.innerHTML = html;
}

// 5. Recent runs table (keep it)
function renderRecentRuns(runs) {
  const tbody = document.getElementById('recent-runs-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  (runs || []).forEach(run => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${run.date}</td>
      <td><a href="${run.link}" target="_blank" rel="noopener">${run.name}</a></td>
      <td>${run.distance_km.toFixed(2)} km</td>
      <td>${run.elevation_m.toFixed(1)} m</td>
      <td>${run.moving_time_min} min</td>
      <td>${run.avg_pace}</td>
    `;

    tbody.appendChild(tr);
  });
}