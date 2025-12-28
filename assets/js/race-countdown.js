console.log("race-countdown.js loaded ✅");


async function loadRaces() {
  const res = await fetch('/assets/data/races.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load races.json: ' + res.status);
  return await res.json();
}

function parseLocalDateTime(isoLocal) {
  // Interprets "2026-05-16T07:00:00" in the visitor's local time zone.
  return new Date(isoLocal);
}

function fmt2(n) {
  return String(n).padStart(2, '0');
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function renderCountdownParts(el, diffMs) {
  if (diffMs <= 0) {
    el.innerHTML = `<strong>It’s race time!</strong>`;
    return;
  }
  const { days, hours, minutes, seconds } = formatCountdown(diffMs);
  el.innerHTML = `
    <div class="time-grid">
      <div><div class="num">${days}</div><div class="lbl">Days</div></div>
      <div><div class="num">${fmt2(hours)}</div><div class="lbl">Hours</div></div>
      <div><div class="num">${fmt2(minutes)}</div><div class="lbl">Min</div></div>
      <div><div class="num">${fmt2(seconds)}</div><div class="lbl">Sec</div></div>
    </div>
  `;
}

function renderNextRace(next, now) {
  const subtitle = document.getElementById('subtitle');
  const raceName = document.getElementById('raceName');
  const raceMeta = document.getElementById('raceMeta');
  const raceGoal = document.getElementById('raceGoal');
  const timeLeft = document.getElementById('timeLeft');
  const badge = document.getElementById('badge');

  if (!next) {
    subtitle.textContent = 'No upcoming races found.';
    raceName.textContent = '';
    raceMeta.textContent = '';
    raceGoal.textContent = '';
    timeLeft.textContent = '';
    if (badge) badge.textContent = '';
    return;
  }

  const start = parseLocalDateTime(next.dateTime);
  const diff = start - now;

  subtitle.textContent = `Next up: ${next.name}`;
  raceName.textContent = next.name;

  const dateStr = start.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const metaBits = [];
  metaBits.push(dateStr);
  if (next.location) metaBits.push(next.location);
  raceMeta.textContent = metaBits.join(' • ');

  if (next.goal) {
    raceGoal.textContent = `Goal: ${next.goalType ? next.goalType + ' — ' : ''}${next.goal}`;
  } else {
    raceGoal.textContent = '';
  }

  if (badge) {
    // simple badge: Time vs Placing
    badge.textContent = next.goalType ? next.goalType : '';
    badge.style.display = badge.textContent ? 'inline-flex' : 'none';
  }

  renderCountdownParts(timeLeft, diff);
}

function renderProgress(next, now) {
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  if (!fill || !text) return;

  if (!next) {
    fill.style.width = '0%';
    text.textContent = '';
    return;
  }

  const start = parseLocalDateTime(next.dateTime);
  const totalWindowDays = 120; // show progress over the last 120 days before race
  const windowStart = new Date(start.getTime() - totalWindowDays * 24 * 60 * 60 * 1000);

  const total = start - windowStart;
  const done = now - windowStart;

  const pct = Math.max(0, Math.min(100, (done / total) * 100));
  fill.style.width = pct.toFixed(1) + '%';

  const daysToGo = Math.max(0, Math.ceil((start - now) / (24 * 60 * 60 * 1000)));
  text.textContent = `${daysToGo} days to go (showing last ${totalWindowDays} days)`;
}

function renderRaceList(races, now) {
  const el = document.getElementById('raceList');
  const upcoming = races
    .map(r => ({ ...r, start: parseLocalDateTime(r.dateTime) }))
    .filter(r => r.start - now > 0)
    .sort((a, b) => a.start - b.start);

  if (!upcoming.length) {
    el.textContent = 'No upcoming races.';
    return;
  }

  el.innerHTML = upcoming
    .map(r => {
      const dateStr = r.start.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const goal = r.goal ? ` • Goal: ${r.goalType ? r.goalType + ' — ' : ''}${r.goal}` : '';
      const loc = r.location ? ` • ${r.location}` : '';
      return `
        <div class="race-row">
          <div class="race-title">${r.name}</div>
          <div class="race-date">${dateStr}</div>
          <div class="race-extra muted">${loc}${goal}</div>
        </div>
      `;
    })
    .join('');
}

async function init() {
  try {
    const data = await loadRaces();
    const races = data.races || [];

    function tick() {
      const now = new Date();

      const upcomingSorted = races
        .map(r => ({ ...r, start: parseLocalDateTime(r.dateTime) }))
        .filter(r => r.start - now > 0)
        .sort((a, b) => a.start - b.start);

      const next = upcomingSorted.length ? upcomingSorted[0] : null;

      renderNextRace(next, now);
      renderProgress(next, now);
      renderRaceList(races, now);
    }

    tick();
    setInterval(tick, 1000);
  } catch (err) {
    console.error(err);
    const subtitle = document.getElementById('subtitle');
    if (subtitle) subtitle.textContent = 'Error loading races. Check console.';
  }
}

document.addEventListener('DOMContentLoaded', init);
