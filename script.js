const MOODS = [
  { score: 1, label: 'Very low', emoji: '😢', color: '#d98e91' },
  { score: 2, label: 'Low', emoji: '😕', color: '#e9ad8c' },
  { score: 3, label: 'Okay', emoji: '😐', color: '#f0cf83' },
  { score: 4, label: 'Good', emoji: '🙂', color: '#9bb69a' },
  { score: 5, label: 'Great', emoji: '😄', color: '#315c49' }
];

const referenceDate = startOfDay(new Date());
const wellnessData = [];

const periodSelect = document.querySelector('#period-select');
const trendCanvas = document.querySelector('#mood-trend-chart');
const balanceCanvas = document.querySelector('#mood-balance-chart');
let moodTrendChart;
let moodBalanceChart;
let wellnessScoreChart;
let toastTimeout;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateDaysAgo(date, daysAgo) {
  const result = new Date(date);
  result.setDate(result.getDate() - daysAgo);
  return result;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(date);
}

function getFilteredRecords(days) {
  const firstDay = dateDaysAgo(referenceDate, days - 1);
  return wellnessData
    .filter((record) => record.date >= firstDay && record.date <= referenceDate)
    .sort((first, second) => first.date - second.date);
}

function average(records, key) {
  if (!records.length) return null;
  return records.reduce((total, record) => total + record[key], 0) / records.length;
}

function formatAverage(value, decimals = 1) {
  return value === null ? '—' : value.toFixed(decimals).replace(/\.0$/, '');
}

function calculateWellnessScore(records) {
  if (!records.length) return null;

  const moodAverage = average(records, 'mood');
  const sleepAverage = average(records, 'sleep');
  const waterAverage = average(records, 'water');
  const activityAverage = average(records, 'activity');
  return Math.round(((moodAverage / 5) + Math.min(sleepAverage / 8, 1) + Math.min(waterAverage / 8, 1) + Math.min(activityAverage / 30, 1)) * 25);
}

function updateDateHeader() {
  document.querySelector('#current-date').textContent = formatDate(new Date(), {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function updateSummary(records) {
  const moodAverage = average(records, 'mood');
  const sleepAverage = average(records, 'sleep');
  const waterAverage = average(records, 'water');
  const activityAverage = average(records, 'activity');
  const wellnessScore = calculateWellnessScore(records);

  document.querySelector('#average-mood').textContent = formatAverage(moodAverage, 1);
  document.querySelector('#average-mood-icon').textContent = moodAverage === null
    ? '—'
    : MOODS.find((mood) => mood.score === Math.round(moodAverage)).emoji;
  document.querySelector('#average-sleep').textContent = formatAverage(sleepAverage);
  document.querySelector('#average-water').textContent = formatAverage(waterAverage);
  document.querySelector('#average-activity').textContent = formatAverage(activityAverage, 0);
  document.querySelector('#average-wellness-score').textContent = wellnessScore === null ? '—' : String(wellnessScore);
  document.querySelector('#wellness-score-unit').textContent = wellnessScore === null ? '' : '%';
  const scoreStatus = document.querySelector('#wellness-score-status');
  scoreStatus.textContent = wellnessScore === null ? 'No score' : wellnessScore >= 70 ? 'Good' : 'Needs a boost';
  scoreStatus.className = `score-status ${wellnessScore === null ? 'is-empty' : wellnessScore >= 70 ? 'is-good' : 'is-low'}`;
  document.querySelector('#wellness-score-foot').textContent = records.length
    ? 'Mood + habits, evenly weighted'
    : 'Add a check-in to calculate';
  document.querySelector('#mood-foot').textContent = records.length
    ? `Across ${records.length} check-in${records.length === 1 ? '' : 's'}`
    : 'No check-ins in this period';
}

function updateHabits(records) {
  const habits = [
    { key: 'sleep', averageKey: 'sleep', goal: 8 },
    { key: 'water', averageKey: 'water', goal: 8 },
    { key: 'activity', averageKey: 'activity', goal: 30 }
  ];

  for (const habit of habits) {
    const value = average(records, habit.averageKey);
    const percentage = value === null ? 0 : Math.min((value / habit.goal) * 100, 100);
    const valueLabel = value === null
      ? '—'
      : `${formatAverage(value, habit.key === 'activity' ? 0 : 1)}${habit.key === 'sleep' ? ' hrs' : habit.key === 'water' ? '' : ' min'}`;
    document.querySelector(`#habit-${habit.key}-value`).textContent = valueLabel;
    const progress = document.querySelector(`#habit-${habit.key}-bar`).parentElement;
    progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
    document.querySelector(`#habit-${habit.key}-bar`).style.width = `${percentage}%`;
  }

  document.querySelector('#habits-empty').hidden = records.length > 0;
}

function buildMoodCounts(records) {
  return MOODS.map((mood) => ({
    ...mood,
    count: records.filter((record) => record.mood === mood.score).length
  }));
}

function renderMoodLegend(moodCounts) {
  const legend = document.querySelector('#mood-legend');
  legend.replaceChildren();

  for (const mood of moodCounts) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const emoji = document.createElement('span');
    const count = document.createElement('span');
    label.className = 'legend-label';
    emoji.className = 'legend-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = mood.emoji;
    label.append(emoji, document.createTextNode(mood.label));
    count.className = 'legend-count';
    count.textContent = String(mood.count);
    item.append(label, count);
    legend.append(item);
  }
}

function renderCharts(records) {
  if (typeof Chart === 'undefined') {
    document.querySelector('#trend-empty').hidden = false;
    document.querySelector('#trend-empty').textContent = 'Charts need an internet connection to load.';
    document.querySelector('#balance-empty').hidden = false;
    document.querySelector('#balance-empty').textContent = 'Charts need an internet connection to load.';
    return;
  }

  const moodCounts = buildMoodCounts(records);
  const trendPointColors = records.map((record) => MOODS.find((mood) => mood.score === record.mood).color);
  const chartText = '#879187';
  const gridColor = 'rgba(113, 132, 113, 0.11)';
  if (moodTrendChart) moodTrendChart.destroy();
  if (moodBalanceChart) moodBalanceChart.destroy();
  if (wellnessScoreChart) wellnessScoreChart.destroy();

  moodTrendChart = new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: records.map((record) => formatDate(record.date)),
      datasets: [{
        label: 'Mood score',
        data: records.map((record) => record.mood),
        borderColor: '#6e8c70',
        backgroundColor: 'rgba(142, 168, 139, 0.15)',
        fill: true,
        tension: 0.38,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: trendPointColors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#304b3b',
          padding: 10,
          displayColors: false,
          callbacks: {
            label(context) {
              const score = context.parsed.y;
              const mood = MOODS.find((item) => item.score === score);
              return `${mood.emoji} ${score} / 5 · ${mood.label}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: chartText, maxRotation: 0, autoSkip: true, font: { family: 'DM Sans', size: 9 } } },
        y: { min: 1, max: 5, ticks: { stepSize: 1, color: chartText, padding: 8, font: { family: 'DM Sans', size: 9 } }, grid: { color: gridColor, drawTicks: false }, border: { display: false } }
      }
    }
  });

  moodBalanceChart = new Chart(balanceCanvas, {
    type: 'doughnut',
    data: {
      labels: moodCounts.map((mood) => mood.label),
      datasets: [{
        data: moodCounts.map((mood) => mood.count),
        backgroundColor: moodCounts.map((mood) => mood.color),
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '73%',
      plugins: { legend: { display: false }, tooltip: { enabled: records.length > 0 } }
    }
  });

  const wellnessScore = calculateWellnessScore(records);
  wellnessScoreChart = new Chart(document.querySelector('#wellness-score-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Remaining'],
      datasets: [{
        data: wellnessScore === null ? [0, 100] : [wellnessScore, 100 - wellnessScore],
        backgroundColor: wellnessScore === null
          ? ['rgba(255,255,255,.25)', 'rgba(255,255,255,.12)']
          : [wellnessScore >= 70 ? '#f0cf83' : '#e9ad8c', 'rgba(255,255,255,.14)'],
        borderWidth: 0,
        hoverOffset: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: wellnessScore !== null,
          callbacks: { label: () => `${wellnessScore}% wellness score` }
        }
      }
    }
  });

  document.querySelector('#checkin-total').textContent = String(records.length);
  renderMoodLegend(moodCounts);
  document.querySelector('#trend-empty').hidden = records.length > 0;
  document.querySelector('#balance-empty').hidden = records.length > 0;
}

function renderCheckins(records) {
  const list = document.querySelector('#checkin-list');
  list.replaceChildren();

  for (const record of [...records].reverse().slice(0, 4)) {
    const mood = MOODS.find((item) => item.score === record.mood);
    const row = document.createElement('div');
    const emoji = document.createElement('span');
    const copy = document.createElement('div');
    const meta = document.createElement('div');
    const label = document.createElement('strong');
    const date = document.createElement('time');
    const note = document.createElement('p');
    const score = document.createElement('span');
    const scoreValue = document.createElement('small');
    const editLink = document.createElement('a');

    row.className = 'checkin-row';
    emoji.className = 'checkin-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = mood.emoji;
    copy.className = 'checkin-copy';
    meta.className = 'checkin-meta';
    label.textContent = mood.label;
    date.dateTime = record.date.toISOString().slice(0, 10);
    date.textContent = formatDate(record.date);
    note.className = 'checkin-note';
    note.textContent = record.note;
    score.className = 'checkin-score';
    score.append(document.createTextNode(String(record.mood)));
    scoreValue.textContent = ' / 5';
    score.append(scoreValue);
    editLink.className = 'edit-checkin';
    editLink.href = `/check-in?id=${encodeURIComponent(record.id)}`;
    editLink.setAttribute('aria-label', `Edit ${mood.label} check-in from ${formatDate(record.date)}`);
    editLink.textContent = 'Edit';
    meta.append(label, date);
    copy.append(meta, note);
    row.append(emoji, copy, score, editLink);
    list.append(row);
  }

  document.querySelector('#checkins-empty').hidden = records.length > 0;
}

function renderDashboard() {
  const records = getFilteredRecords(Number(periodSelect.value));
  updateSummary(records);
  renderCharts(records);
  updateHabits(records);
  renderCheckins(records);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const section = link.dataset.section;
      document.querySelectorAll('.nav-link').forEach((item) => {
        item.classList.remove('is-active');
        item.removeAttribute('aria-current');
      });
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
      if (section !== 'Analytics') showToast(`${section} will be available in a future update.`);
      else document.querySelector('#analytics').scrollIntoView({ behavior: 'smooth' });
    });
  });

  document.querySelector('#view-all').addEventListener('click', () => {
    showToast('Full check-in history will be available in a future update.');
  });

}

async function initializeDashboard() {
  updateDateHeader();
  periodSelect.addEventListener('change', renderDashboard);
  setupNavigation();

  const requestedPeriod = new URLSearchParams(window.location.search).get('period');
  if (['7', '14', '30'].includes(requestedPeriod)) periodSelect.value = requestedPeriod;

  try {
    const response = await fetch('/api/checkins');
    if (!response.ok) throw new Error('Could not load check-ins.');
    const records = await response.json();
    wellnessData.push(...records.map((record) => ({
      ...record,
      date: new Date(`${record.date}T00:00:00`)
    })));
  } catch (error) {
    showToast('Could not load your local check-ins. Is the WELLSPACE server running?');
  }

  renderDashboard();
}

initializeDashboard();