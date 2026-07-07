const STORAGE_KEY = 'woraster-target-state-v1';
const TOTAL_APARTMENTS = 394;
const COLORS = ['#007aff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#5ac8fa'];
const COMPARE_COLORS = ['#80bdff', '#8ee0a5', '#ffe680', '#ffc580', '#d7a8ef', '#ade3fc'];

const targetDefaults = [
  { rooms: '1–1.5', percent: 4, corridor: '3–5 %', targetCount: 16, function: 'gezielte kleine Einheiten', note: 'klein halten' },
  { rooms: '2–2.5', percent: 20, corridor: '18–22 %', targetCount: 79, function: 'Verkleinerung, ältere Personen, kleine Haushalte', note: 'deutlich erhöhen' },
  { rooms: '3–3.5', percent: 44, corridor: '42–46 %', targetCount: 173, function: 'Hauptsegment', note: 'reduzieren' },
  { rooms: '4–4.5', percent: 24, corridor: '22–26 %', targetCount: 95, function: 'Familien', note: 'stärken' },
  { rooms: '5–5.5', percent: 7, corridor: '7–9 %', targetCount: 28, function: 'grössere Familien', note: 'stabil' },
  { rooms: '6–6.5', percent: 1, corridor: '1–2 %', targetCount: 4, function: 'Ausnahmebestand', note: 'Ausnahme' }
];

const bgRows = [
  { rooms: '1–1.5', count: 9, percent: 2.3 },
  { rooms: '2–2.5', count: 46, percent: 11.7 },
  { rooms: '3–3.5', count: 230, percent: 58.4 },
  { rooms: '4–4.5', count: 70, percent: 17.8 },
  { rooms: '5–5.5', count: 37, percent: 9.4 },
  { rooms: '6–6.5', count: 2, percent: 0.5 }
];

const cantonRows = [
  { label: '1 Zimmer', countLabel: '', percent: 6.8 },
  { label: '2 Zimmer', countLabel: '', percent: 16.2 },
  { label: '3 Zimmer', countLabel: '', percent: 29.2 },
  { label: '4 Zimmer', countLabel: '', percent: 27.4 },
  { label: '5 Zimmer', countLabel: '', percent: 13.0 },
  { label: '6+ Zimmer', countLabel: '', percent: 7.4 }
];

const swissRows = [
  { label: '1 Zimmer', countLabel: "312'000", percent: 6.4 },
  { label: '2 Zimmer', countLabel: "678'000", percent: 14.0 },
  { label: '3 Zimmer', countLabel: "1'321'000", percent: 27.3 },
  { label: '4 Zimmer', countLabel: "1'341'000", percent: 27.7 },
  { label: '5 Zimmer', countLabel: "731'000", percent: 15.1 },
  { label: '6+ Zimmer', countLabel: "460'000", percent: 9.5 }
];

const chartMeta = {
  target: 'Quelle: eigene fachliche Ableitung. Kein amtlicher Sollwert.',
  bg: 'Quelle: öffentliches Liegenschaftenverzeichnis 2023 der BG; Anteile eigene Berechnung.',
  city: 'Quelle: Snapshot aus BAU506OD5062.csv, im Repo gespeichert.',
  canton: 'Quelle: BFS / Kanton Zürich 2024; Werte als Referenzanteile.',
  swiss: 'Quelle: BFS Gebäude- und Wohnungsstatistik 2024; Werte gerundet.',
  none: ''
};

const chartTitles = {
  target: ['Soll', 'Vorschlag'],
  bg: ['Ist', 'BG'],
  city: ['Stadt', 'Zürich'],
  canton: ['Kanton', 'Zürich'],
  swiss: ['Schweiz', 'BFS']
};

const state = {
  targetRows: structuredClone(targetDefaults),
  chartType: 'target',
  compareType: 'bg',
  cityData: null,
  dirty: false
};

const pieCharts = {};

function structuredCloneFallback(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneRows(rows) {
  if (typeof structuredClone === 'function') {
    return structuredClone(rows);
  }
  return structuredCloneFallback(rows);
}

function recalculateTargetCounts() {
  state.targetRows.forEach((row) => {
    row.targetCount = Math.round((row.percent / 100) * TOTAL_APARTMENTS);
  });
}

function normalizePercents(editedIndex, nextValue) {
  const tenthsTotal = 1000;
  const nextTenths = Math.min(tenthsTotal, Math.max(0, Math.round(nextValue * 10)));
  const currentTenths = state.targetRows.map((row) => Math.round(row.percent * 10));
  const otherIndexes = currentTenths.map((_, index) => index).filter((index) => index !== editedIndex);
  const otherTotal = otherIndexes.reduce((sum, index) => sum + currentTenths[index], 0);
  const remainingTenths = tenthsTotal - nextTenths;
  const nextTenthsValues = [...currentTenths];
  nextTenthsValues[editedIndex] = nextTenths;

  if (remainingTenths <= 0) {
    otherIndexes.forEach((index) => {
      nextTenthsValues[index] = 0;
    });
  } else if (otherTotal <= 0) {
    const base = Math.floor(remainingTenths / otherIndexes.length);
    let remainder = remainingTenths - base * otherIndexes.length;
    otherIndexes.forEach((index) => {
      nextTenthsValues[index] = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    });
  } else {
    const weighted = otherIndexes.map((index) => {
      const raw = (currentTenths[index] / otherTotal) * remainingTenths;
      return {
        index,
        base: Math.floor(raw),
        fraction: raw - Math.floor(raw)
      };
    });

    let assigned = weighted.reduce((sum, item) => sum + item.base, 0);
    let remainder = remainingTenths - assigned;
    weighted
      .sort((a, b) => b.fraction - a.fraction)
      .forEach((item) => {
        nextTenthsValues[item.index] = item.base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
      });
  }

  state.targetRows.forEach((row, index) => {
    row.percent = nextTenthsValues[index] / 10;
  });
}

function saveState() {
  const payload = {
    chartType: state.chartType,
    compareType: state.compareType,
    targetRows: state.targetRows.map((row) => ({
      rooms: row.rooms,
      percent: row.percent,
      corridor: row.corridor,
      function: row.function,
      note: row.note
    }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  state.dirty = false;
  updateStatus('Lokal gespeichert.');
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    recalculateTargetCounts();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    const mergedRows = cloneRows(targetDefaults).map((row, index) => ({
      ...row,
      ...(parsed.targetRows?.[index] || {})
    }));
    state.targetRows = mergedRows;
    state.chartType = parsed.chartType || 'target';
    state.compareType = parsed.compareType || 'bg';
    recalculateTargetCounts();
    updateStatus('Lokale Version geladen.');
  } catch {
    state.targetRows = cloneRows(targetDefaults);
    recalculateTargetCounts();
    updateStatus('Gespeicherte Version konnte nicht gelesen werden.');
  }
}

function resetState() {
  state.targetRows = cloneRows(targetDefaults);
  state.chartType = 'target';
  state.compareType = 'bg';
  recalculateTargetCounts();
  localStorage.removeItem(STORAGE_KEY);
  state.dirty = false;
  syncSelects();
  renderAll();
  updateStatus('Auf Standardwerte zurückgesetzt.');
}

function updateStatus(text) {
  const status = document.getElementById('targetStatus');
  if (status) status.textContent = text;
}

function markDirty() {
  state.dirty = true;
  updateStatus('Ungespeicherte Änderungen.');
}

function syncSelects() {
  document.getElementById('chartSelect').value = state.chartType;
  document.getElementById('compareSelect').value = state.compareType;
}

function toPieRows(type) {
  if (type === 'target') return state.targetRows.map((row) => ({ name: row.rooms, value: row.percent }));
  if (type === 'bg') return bgRows.map((row) => ({ name: row.rooms, value: row.percent }));
  if (type === 'city') return (state.cityData?.roomRows || []).map((row) => ({ name: row.label, value: row.percent }));
  if (type === 'canton') return cantonRows.map((row) => ({ name: row.label, value: row.percent }));
  if (type === 'swiss') return swissRows.map((row) => ({ name: row.label, value: row.percent }));
  return [];
}

function ensureChart(id, size = 'full') {
  if (pieCharts[id]) return pieCharts[id];
  const element = document.getElementById(id);
  pieCharts[id] = echarts.init(element, null, { renderer: 'svg' });
  window.addEventListener('resize', () => pieCharts[id].resize());
  return pieCharts[id];
}

function createPieSeries(name, data, radius, colors, labelShown) {
  return {
    name,
    type: 'pie',
    radius,
    center: ['50%', '45%'],
    padAngle: 3,
    minAngle: 3,
    avoidLabelOverlap: true,
    color: colors,
    itemStyle: {
      borderRadius: 12,
      borderColor: '#fbfbfd',
      borderWidth: 4
    },
    label: {
      show: labelShown,
      formatter: '{b}\n{d}%',
      color: '#1d1d1f',
      fontSize: 12,
      fontWeight: 700,
      fontFamily: 'Inter, sans-serif'
    },
    labelLine: {
      show: labelShown,
      length: 12,
      length2: 8,
      lineStyle: { color: '#d2d2d7' }
    },
    emphasis: {
      scale: true,
      scaleSize: 6,
      itemStyle: { shadowBlur: 18, shadowColor: 'rgba(0,0,0,.16)' }
    },
    data
  };
}

function renderMainPie() {
  const chart = ensureChart('mainPie');
  const hasCompare = state.compareType !== 'none' && state.compareType !== state.chartType;
  const mainRows = toPieRows(state.chartType);
  const compareRows = hasCompare ? toPieRows(state.compareType) : [];
  const [line1, line2] = chartTitles[state.chartType] || ['', ''];
  const series = hasCompare
    ? [
        createPieSeries(`Innen: ${line1} ${line2}`, mainRows, ['38%', '57%'], COLORS, false),
        createPieSeries(`Aussen: ${(chartTitles[state.compareType] || [state.compareType, '']).join(' ')}`, compareRows, ['64%', '84%'], COMPARE_COLORS, true)
      ]
    : [createPieSeries(`${line1} ${line2}`, mainRows, ['54%', '78%'], COLORS, true)];

  chart.setOption({
    animationDuration: 650,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      borderWidth: 0,
      backgroundColor: 'rgba(29,29,31,.92)',
      textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' },
      formatter: (params) => `${params.seriesName}<br>${params.marker}${params.name}: <b>${Number(params.value).toFixed(1).replace('.0', '')}%</b>`
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: '#6e6e73', fontSize: 12, fontFamily: 'Inter, sans-serif' }
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: hasCompare ? '39%' : '42%',
        style: {
          text: line1,
          fill: '#1d1d1f',
          fontSize: 28,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center'
        }
      },
      {
        type: 'text',
        left: 'center',
        top: hasCompare ? '49%' : '52%',
        style: {
          text: line2,
          fill: '#6e6e73',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center'
        }
      }
    ],
    series
  }, true);

  const source = hasCompare
    ? `${chartMeta[state.chartType]} Vergleich Aussenring: ${chartMeta[state.compareType]}`
    : chartMeta[state.chartType];
  document.getElementById('chartSource').textContent = source;
}

function renderMiniPie(id, title, rows) {
  const chart = ensureChart(id);
  chart.setOption({
    animationDuration: 500,
    tooltip: {
      trigger: 'item',
      borderWidth: 0,
      backgroundColor: 'rgba(29,29,31,.92)',
      textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' },
      formatter: (params) => `${params.marker}${params.name}: <b>${Number(params.value).toFixed(1).replace('.0', '')}%</b>`
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: '#6e6e73', fontSize: 11, fontFamily: 'Inter, sans-serif' }
    },
    series: [
      {
        type: 'pie',
        radius: ['44%', '72%'],
        center: ['50%', '42%'],
        padAngle: 3,
        minAngle: 3,
        color: COLORS,
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11,
          fontWeight: 700,
          color: '#1d1d1f'
        },
        labelLine: {
          show: true,
          length: 10,
          length2: 6,
          lineStyle: { color: '#d2d2d7' }
        },
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fbfbfd',
          borderWidth: 4
        },
        data: rows.map((row) => ({ name: row.label || row.rooms, value: row.percent }))
      }
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '40%',
        style: {
          text: title,
          fill: '#1d1d1f',
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center'
        }
      }
    ]
  }, true);
}

function renderTargetTable() {
  const body = document.querySelector('#targetTable tbody');
  body.innerHTML = state.targetRows.map((row, index) => `
    <tr>
      <td>${row.rooms}</td>
      <td>
        <label class="sr-only" for="target-percent-${index}">Prozent ${row.rooms}</label>
        <div class="editable-cell editable-percent">
          <input
            id="target-percent-${index}"
            class="cell-input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value="${row.percent.toFixed(1).replace('.0', '')}"
            data-field="percent"
            data-index="${index}"
          >
          <span class="cell-suffix">%</span>
        </div>
      </td>
      <td>
        <label class="sr-only" for="target-corridor-${index}">Zielkorridor ${row.rooms}</label>
        <input
          id="target-corridor-${index}"
          class="cell-input corridor-input"
          type="text"
          value="${row.corridor}"
          data-field="corridor"
          data-index="${index}"
        >
      </td>
      <td>${row.targetCount}</td>
      <td>${row.function}</td>
    </tr>
  `).join('');
}

function renderBgTable() {
  document.querySelector('#bgTable tbody').innerHTML = bgRows.map((row, index) => {
    const target = state.targetRows[index].percent;
    const diff = Number((row.percent - target).toFixed(1));
    const cls = diff > 0 ? 'positive' : 'negative';
    return `
      <tr>
        <td>${row.rooms}</td>
        <td>${row.count}</td>
        <td>${row.percent.toFixed(1)} %</td>
        <td>${target.toFixed(1).replace('.0', '')} %</td>
        <td class="${cls}">${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.0', '')} %-Punkte</td>
        <td>${state.targetRows[index].note}</td>
      </tr>
    `;
  }).join('');
}

function renderStaticTables() {
  document.querySelector('#cantonTable tbody').innerHTML = cantonRows.map((row) => `
    <tr><td>${row.label}</td><td>${row.percent.toFixed(1)} %</td></tr>
  `).join('');

  document.querySelector('#swissTable tbody').innerHTML = swissRows.map((row) => `
    <tr><td>${row.label}</td><td>${row.countLabel}</td><td>${row.percent.toFixed(1)} %</td></tr>
  `).join('');
}

function renderCityTables() {
  if (!state.cityData) return;
  document.querySelector('#cityTable tbody').innerHTML = state.cityData.roomRows.map((row) => `
    <tr>
      <td>${row.label}</td>
      <td>${Number(row.count).toLocaleString('de-CH')}</td>
      <td>${row.percent.toFixed(1)} %</td>
      <td>${state.cityData.latestYear}</td>
    </tr>
  `).join('');
  document.getElementById('citySourceNote').textContent =
    `Quelle: Snapshot aus BAU506OD5062.csv, Datenjahr ${state.cityData.latestYear}, im Repo gespeichert unter data/city-zurich.json.`;
}

function renderHistory() {
  if (!state.cityData) return;
  const rows = [...state.cityData.historyRows].sort((a, b) => a.year - b.year);
  const recent = rows.slice(-8);
  const values = rows.map((row) => row.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 760;
  const height = 250;
  const padding = 34;
  const points = rows.map((row, index) => {
    const x = padding + (index / Math.max(rows.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((row.total - min) / Math.max(max - min, 1)) * (height - padding * 2);
    return { ...row, x, y };
  });

  document.getElementById('historyChart').innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline
        points="${points.map((point) => `${point.x},${point.y}`).join(' ')}"
        fill="none"
        stroke="#007aff"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#e5e5ea" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#e5e5ea" />
      ${points.map((point) => `
        <circle cx="${point.x}" cy="${point.y}" r="3.5" fill="#007aff">
          <title>${point.year}: ${point.total.toLocaleString('de-CH')}</title>
        </circle>
      `).join('')}
      <text x="${padding}" y="22" class="svg-label">${rows[0].year}</text>
      <text x="${width - padding}" y="22" text-anchor="end" class="svg-label">${rows[rows.length - 1].year}</text>
    </svg>
  `;

  document.querySelector('#historyTable tbody').innerHTML = recent.reverse().map((row) => {
    const previous = rows.find((entry) => entry.year === row.year - 1);
    const diff = previous ? row.total - previous.total : null;
    return `
      <tr>
        <td>${row.year}</td>
        <td>${row.total.toLocaleString('de-CH')}</td>
        <td>${diff === null ? '–' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('de-CH')}`}</td>
      </tr>
    `;
  }).join('');
}

function renderAll() {
  syncSelects();
  renderTargetTable();
  renderBgTable();
  renderStaticTables();
  renderCityTables();
  renderHistory();
  renderMainPie();
  renderMiniPie('bgPie', 'BG', bgRows.map((row) => ({ label: row.rooms, percent: row.percent })));
  if (state.cityData) renderMiniPie('cityPie', 'Stadt', state.cityData.roomRows);
  renderMiniPie('cantonPie', 'Kanton', cantonRows);
  renderMiniPie('swissPie', 'Schweiz', swissRows);
}

function handleTargetTableInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (!Number.isInteger(index) || !field || !state.targetRows[index]) return;

  if (field === 'percent') {
    const nextValue = Number(input.value);
    if (Number.isNaN(nextValue)) return;
    normalizePercents(index, nextValue);
    recalculateTargetCounts();
    renderAll();
    markDirty();
    const refreshed = document.getElementById(`target-percent-${index}`);
    if (refreshed) {
      refreshed.focus();
      refreshed.select();
    }
    return;
  }

  if (field === 'corridor') {
    state.targetRows[index].corridor = input.value;
    markDirty();
  }
}

async function loadCityData() {
  const response = await fetch('data/city-zurich.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Lokaler Zürich-Snapshot nicht verfügbar.');
  }
  state.cityData = await response.json();
}

async function init() {
  loadState();

  document.getElementById('chartSelect').addEventListener('change', (event) => {
    state.chartType = event.target.value;
    renderMainPie();
    markDirty();
  });

  document.getElementById('compareSelect').addEventListener('change', (event) => {
    state.compareType = event.target.value;
    renderMainPie();
    markDirty();
  });

  document.querySelector('#targetTable tbody').addEventListener('input', handleTargetTableInput);
  document.getElementById('saveTargetRows').addEventListener('click', saveState);
  document.getElementById('resetTargetRows').addEventListener('click', resetState);

  try {
    await loadCityData();
  } catch (error) {
    updateStatus(`Zürich-Snapshot konnte nicht geladen werden: ${error.message}`);
  }

  renderAll();
}

init();
