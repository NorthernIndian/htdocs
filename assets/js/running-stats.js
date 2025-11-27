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
        document.getElementById('updatedAt').textContent =
          'Error loading stats. Check the console for details.';
      }
    }

    function formatKm(km) {
      return km.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }

    function formatElevation(meters) {
      return meters.toLocaleString(undefined) + ' m';
    }

    function formatHours(hours) {
      return hours.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' h';
    }

    function formatDate(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    function renderDashboard(stats) {
      // Updated at
      if (stats.updatedAt) {
        const d = new Date(stats.updatedAt);
        document.getElementById('updatedAt').textContent =
          'Last updated: ' + d.toLocaleString();
      }

      // Summary cards container
      const summaryGrid = document.getElementById('summaryGrid');
      summaryGrid.innerHTML = '';

      // Lifetime distance
      if (stats.lifetime) {
        summaryGrid.appendChild(createCard({
          title: 'Lifetime (since 2022)',
          main: formatKm(stats.lifetime.distance_km) + ' km',
          sub: formatElevation(stats.lifetime.elevation_m) + ' climbed',
        }));

        summaryGrid.appendChild(createCard({
          title: 'Lifetime Time',
          main: formatHours(stats.lifetime.time_hours),
          sub: 'Total time on feet',
        }));
      }

      // Year to date
      if (stats.yearToDate) {
        summaryGrid.appendChild(createCard({
          title: `Year to Date (${stats.yearToDate.year})`,
          main: formatKm(stats.yearToDate.distance_km) + ' km',
          sub: `${stats.yearToDate.num_runs} runs · longest ${stats.yearToDate.longest_run_km} km`,
        }));
      }

      // Month to date
      if (stats.monthToDate) {
        const monthName = new Date(stats.monthToDate.year, stats.monthToDate.month - 1, 1)
          .toLocaleString(undefined, { month: 'short' });
        summaryGrid.appendChild(createCard({
          title: `This Month (${monthName} ${stats.monthToDate.year})`,
          main: formatKm(stats.monthToDate.distance_km) + ' km',
          sub: `${stats.monthToDate.num_runs} runs · longest ${stats.monthToDate.longest_run_km} km`,
        }));
      }

      // PBs
      const pbsGrid = document.getElementById('pbsGrid');
      pbsGrid.innerHTML = '';
      if (Array.isArray(stats.pbs)) {
        stats.pbs.forEach(pb => {
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `
            <div class="card-content">
              <div class="card-title">${pb.event}</div>
              <div class="card-main">${pb.time}</div>
              <div class="card-sub">
                <span class="muted">Set on ${formatDate(pb.date)}</span>
              </div>
            </div>
          `;
          pbsGrid.appendChild(div);
        });
      }

      // Recent runs
      const recentContainer = document.getElementById('recentRunsContainer');
      recentContainer.innerHTML = '';
      if (Array.isArray(stats.recentRuns) && stats.recentRuns.length > 0) {
        const table = document.createElement('table');
        table.innerHTML = `
          <thead>
            <tr>
              <th>Date</th>
              <th>Run</th>
              <th>Distance</th>
              <th>Elev</th>
              <th>Time</th>
              <th>Pace</th>
            </tr>
          </thead>
          <tbody>
            ${stats.recentRuns.map(r => `
              <tr>
                <td>${formatDate(r.date)}</td>
                <td>
                  ${r.link
                    ? `<a href="${r.link}" target="_blank" rel="noopener noreferrer">${r.name}</a>`
                    : r.name}
                </td>
                <td>${r.distance_km.toFixed(1)} km</td>
                <td>${r.elevation_m} m</td>
                <td>${r.moving_time_min} min</td>
                <td>${r.avg_pace}</td>
              </tr>
            `).join('')}
          </tbody>
        `;
        recentContainer.appendChild(table);
      } else {
        recentContainer.textContent = 'No recent runs available.';
      }
    }

    function createCard({ title, main, sub, tag }) {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <div class="card-content">
          <div class="card-title">${title}</div>
          <div class="card-main">${main}</div>
          <div class="card-sub">${sub}</div>
          <div class="chip-row">
            <span class="tag">
              <span class="tag-dot"></span>
              ${tag}
            </span>
          </div>
        </div>
      `;
      return div;
    }

    loadStats();