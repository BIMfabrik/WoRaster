const STORAGE_KEY = 'woraster-target-state-v3';
const DEFAULT_TOTAL_APARTMENTS = 394;
const COLORS = ['#007aff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#5ac8fa'];
const COMPARE_COLORS = ['#80bdff', '#8ee0a5', '#ffe680', '#ffc580', '#d7a8ef', '#ade3fc'];

const targetDefaults = [
  { rooms: '1–1.5', percent: 4, corridor: '3–5 %', function: 'gezielte kleine Einheiten', note: 'klein halten' },
  { rooms: '2–2.5', percent: 20, corridor: '18–22 %', function: 'Verkleinerung, ältere Personen, kleine Haushalte', note: 'deutlich erhöhen' },
  { rooms: '3–3.5', percent: 44, corridor: '42–46 %', function: 'Hauptsegment', note: 'reduzieren' },
  { rooms: '4–4.5', percent: 24, corridor: '22–26 %', function: 'Familien', note: 'stärken' },
  { rooms: '5–5.5', percent: 7, corridor: '7–9 %', function: 'grössere Familien', note: 'stabil' },
  { rooms: '6–6.5', percent: 1, corridor: '1–2 %', function: 'Ausnahmebestand', note: 'Ausnahme' }
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

const projectRows = [
  { label: '2 Zi.-WHG.', count: 7, percent: 5.5 },
  { label: '2.5 Zi.-WHG.', count: 17, percent: 13.5 },
  { label: '3 Zi.-WHG.', count: 15, percent: 12.0 },
  { label: '3.5 Zi.-WHG.', count: 61, percent: 48.0 },
  { label: '4 Zi.-WHG.', count: 1, percent: 1.0 },
  { label: '4.5 Zi.-WHG.', count: 22, percent: 17.0 },
  { label: '5.5 Zi.-WHG.', count: 3, percent: 2.0 },
  { label: '6.5 Zi.-WHG.', count: 1, percent: 1.0 }
];

const chartTitles = {
  target: ['Soll', 'Vorschlag'],
  bg: ['Ist', 'BG'],
  city: ['Stadt', 'Zürich'],
  canton: ['Kanton', 'Zürich'],
  swiss: ['Schweiz', 'BFS']
};

const state = {
  targetRows: cloneRows(targetDefaults),
  totalApartments: DEFAULT_TOTAL_APARTMENTS,
  chartType: 'target',
  compareType: 'bg',
  historyStartYear: 1930,
  historyEndYear: 2025,
  cityData: null,
  dirty: false
};

const pieCharts = {};

function cloneRows(rows) {
  return JSON.parse(JSON.stringify(rows));
}

function recalculateTargetCounts() {
  state.targetRows.forEach((row) => {
    row.targetCount = Math.round((row.percent / 100) * state.totalApartments);
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
      return { index, base: Math.floor(raw), fraction: raw - Math.floor(raw) };
    });
    let remainder = remainingTenths - weighted.reduce((sum, item) => sum + item.base, 0);
    weighted.sort((a, b) => b.fraction - a.fraction).forEach((item) => {
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
    totalApartments: state.totalApartments,
    chartType: state.chartType,
    compareType: state.compareType,
    historyStartYear: state.historyStartYear,
    historyEndYear: state.historyEndYear,
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
    state.totalApartments = Number(parsed.totalApartments) > 0 ? Number(parsed.totalApartments) : DEFAULT_TOTAL_APARTMENTS;
    state.chartType = parsed.chartType || 'target';
    state.compareType = parsed.compareType || 'bg';
    state.historyStartYear = Number(parsed.historyStartYear) || 1930;
    state.historyEndYear = Number(parsed.historyEndYear) || 2025;
    state.targetRows = cloneRows(targetDefaults).map((row, index) => ({
      ...row,
      ...(parsed.targetRows?.[index] || {})
    }));
    recalculateTargetCounts();
    updateStatus('Lokale Version geladen.');
  } catch {
    state.targetRows = cloneRows(targetDefaults);
    state.totalApartments = DEFAULT_TOTAL_APARTMENTS;
    state.historyStartYear = 1930;
    state.historyEndYear = 2025;
    recalculateTargetCounts();
    updateStatus('Gespeicherte Version konnte nicht gelesen werden.');
  }
}

function resetState() {
  state.targetRows = cloneRows(targetDefaults);
  state.totalApartments = DEFAULT_TOTAL_APARTMENTS;
  state.chartType = 'target';
  state.compareType = 'bg';
  state.historyStartYear = 1930;
  state.historyEndYear = 2025;
  recalculateTargetCounts();
  localStorage.removeItem(STORAGE_KEY);
  state.dirty = false;
  syncControls();
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

function syncControls() {
  document.getElementById('chartSelect').value = state.chartType;
  document.getElementById('compareSelect').value = state.compareType;
  document.getElementById('totalApartments').value = state.totalApartments;
  document.getElementById('apartmentsHeaderLabel').textContent = String(state.totalApartments);
  document.getElementById('historyStartRange').value = String(state.historyStartYear);
  document.getElementById('historyEndRange').value = String(state.historyEndYear);
  document.getElementById('historyRangeLabel').textContent = `${state.historyStartYear}–${state.historyEndYear}`;
}

function toPieRows(type) {
  if (type === 'target') return state.targetRows.map((row) => ({ name: row.rooms, value: row.percent }));
  if (type === 'bg') return bgRows.map((row) => ({ name: row.rooms, value: row.percent }));
  if (type === 'city') return (state.cityData?.roomRows || []).map((row) => ({ name: row.label, value: row.percent }));
  if (type === 'canton') return cantonRows.map((row) => ({ name: row.label, value: row.percent }));
  if (type === 'swiss') return swissRows.map((row) => ({ name: row.label, value: row.percent }));
  return [];
}

function ensureChart(id) {
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
  const detailLines = mainRows.map((row) => `${row.name} ${Number(row.value).toFixed(1).replace('.0', '')}%`).join('\n');

  const series = hasCompare
    ? [
        createPieSeries(`Innen: ${line1} ${line2}`, mainRows, ['38%', '57%'], COLORS, true),
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
    legend: { show: false },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: hasCompare ? '35%' : '38%',
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
        top: hasCompare ? '45%' : '48%',
        style: {
          text: line2,
          fill: '#6e6e73',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center'
        }
      },
      {
        type: 'text',
        left: 'center',
        top: hasCompare ? '53%' : '56%',
        style: {
          text: detailLines,
          fill: '#6e6e73',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          lineHeight: 15
        }
      }
    ],
    series
  }, true);

  renderMainLegend(mainRows, compareRows, hasCompare);
}

function renderMainLegend(mainRows, compareRows, hasCompare) {
  const legend = document.getElementById('chartLegend');
  if (!legend) return;

  const mainTitle = chartTitles[state.chartType].join(' ');
  const compareTitle = hasCompare ? chartTitles[state.compareType].join(' ') : '';

  legend.innerHTML = `
    <div class="legend-group">
      <div class="legend-group-title">Innenring · ${mainTitle}</div>
      ${mainRows.map((row, index) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${COLORS[index % COLORS.length]}"></span>
          <span class="legend-label">${row.name}</span>
          <span class="legend-value">${Number(row.value).toFixed(1).replace('.0', '')}%</span>
        </div>
      `).join('')}
    </div>
    ${hasCompare ? `
      <div class="legend-group">
        <div class="legend-group-title">Aussenring · ${compareTitle}</div>
        ${compareRows.map((row, index) => `
          <div class="legend-item muted">
            <span class="legend-dot" style="background:${COMPARE_COLORS[index % COMPARE_COLORS.length]}"></span>
            <span class="legend-label">${row.name}</span>
            <span class="legend-value">${Number(row.value).toFixed(1).replace('.0', '')}%</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
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

function renderOverviewBars() {
  if (!state.cityData) return;

  const chart = ensureChart('overviewBarChart');
  const categories = state.targetRows.map((row) => row.rooms);
  const cityLookup = new Map(state.cityData.roomRows.map((row) => [row.label, row.percent]));
  const datasets = [
    { name: 'Soll-Vorschlag', color: '#007aff', values: state.targetRows.map((row) => row.percent) },
    { name: 'Bestand BG', color: '#34c759', values: bgRows.map((row) => row.percent) },
    { name: 'Stadt Zürich', color: '#5ac8fa', values: [cityLookup.get('1 Zimmer') || 0, cityLookup.get('2 Zimmer') || 0, cityLookup.get('3 Zimmer') || 0, cityLookup.get('4 Zimmer') || 0, cityLookup.get('5 Zimmer') || 0, cityLookup.get('6+ Zimmer') || 0] },
    { name: 'Kanton Zürich', color: '#ff9500', values: cantonRows.map((row) => row.percent) },
    { name: 'Schweiz', color: '#af52de', values: swissRows.map((row) => row.percent) }
  ];

  chart.setOption({
    animationDuration: 500,
    grid: { left: 56, right: 18, top: 26, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      borderWidth: 0,
      backgroundColor: 'rgba(29,29,31,.92)',
      textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' }
    },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: '#6e6e73', fontSize: 12, fontFamily: 'Inter, sans-serif' }
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#d2d2d7' } },
      axisTick: { show: false },
      axisLabel: { color: '#6e6e73', fontSize: 12, fontFamily: 'Inter, sans-serif' }
    },
    yAxis: {
      type: 'value',
      name: 'Anteil in %',
      nameTextStyle: { color: '#6e6e73', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      splitLine: { lineStyle: { color: '#ececf0' } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#6e6e73', fontSize: 12, fontFamily: 'Inter, sans-serif' }
    },
    series: datasets.map((dataset) => ({
      name: dataset.name,
      type: 'bar',
      barMaxWidth: 28,
      itemStyle: {
        color: dataset.color,
        borderRadius: [8, 8, 0, 0]
      },
      data: dataset.values
    }))
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
            class="cell-input percent-input"
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
          class="cell-input corridor-input emphasis-input"
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
  document.querySelector('#projectTable tbody').innerHTML = projectRows.map((row) => `
    <tr><td>${row.label}</td><td>${row.count}</td><td>${row.percent.toFixed(1).replace('.0', '')} %</td></tr>
  `).join('');

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

  const allYears = state.cityData.roomHistoryRows[0]?.series.map((row) => row.year) || [];
  const filteredYears = allYears.filter((year) => year >= state.historyStartYear && year <= state.historyEndYear);
  const roomSets = state.cityData.roomHistoryRows.map((entry, roomIndex) => ({
    label: entry.label,
    color: COLORS[roomIndex % COLORS.length],
    series: entry.series.filter((row) => row.year >= state.historyStartYear && row.year <= state.historyEndYear)
  }));
  const values = roomSets.flatMap((entry) => entry.series.map((row) => row.count));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 760;
  const height = 320;
  const padding = 42;
  const roomLines = roomSets.map((entry) => ({
    ...entry,
    points: entry.series.map((row, index) => {
      const x = padding + (index / Math.max(entry.series.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((row.count - min) / Math.max(max - min, 1)) * (height - padding * 2);
      return { ...row, x, y };
    })
  }));

  document.getElementById('historyRangeLabel').textContent = `${state.historyStartYear}–${state.historyEndYear}`;

  document.getElementById('historyChart').innerHTML = `
    <div class="history-inline-legend">
      ${roomLines.map((entry) => `
        <span class="history-inline-item">
          <span class="legend-dot" style="background:${entry.color}"></span>
          ${entry.label}
        </span>
      `).join('')}
    </div>
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#e5e5ea" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#e5e5ea" />
      ${roomLines.map((entry) => `
        <polyline
          points="${entry.points.map((point) => `${point.x},${point.y}`).join(' ')}"
          fill="none"
          stroke="${entry.color}"
          stroke-width="3.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        ${entry.points.map((point) => `
          <circle cx="${point.x}" cy="${point.y}" r="2.8" fill="${entry.color}">
            <title>${entry.label} ${point.year}: ${point.count.toLocaleString('de-CH')}</title>
          </circle>
        `).join('')}
      `).join('')}
      <text x="${padding}" y="22" class="svg-label">${filteredYears[0] || ''}</text>
      <text x="${width - padding}" y="22" text-anchor="end" class="svg-label">${filteredYears[filteredYears.length - 1] || ''}</text>
    </svg>
  `;

  document.querySelector('#historyTable tbody').innerHTML = [...filteredYears].reverse().map((year) => `
    <tr>
      <td>${year}</td>
      ${roomSets.map((entry) => {
        const hit = entry.series.find((row) => row.year === year);
        return `<td>${hit ? hit.count.toLocaleString('de-CH') : '–'}</td>`;
      }).join('')}
    </tr>
  `).join('');
}

function renderAll() {
  syncControls();
  renderTargetTable();
  renderBgTable();
  renderStaticTables();
  renderCityTables();
  renderHistory();
  renderMainPie();
  renderOverviewBars();
  renderMiniPie('projectPie', 'Projekt', projectRows);
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

function handleTotalApartmentsInput(event) {
  const nextValue = Number(event.target.value);
  if (Number.isNaN(nextValue) || nextValue <= 0) return;
  state.totalApartments = Math.round(nextValue);
  recalculateTargetCounts();
  renderAll();
  markDirty();
}

function handleHistoryRangeInput() {
  const start = Number(document.getElementById('historyStartRange').value);
  const end = Number(document.getElementById('historyEndRange').value);
  state.historyStartYear = Math.min(start, end);
  state.historyEndYear = Math.max(start, end);
  renderHistory();
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

  document.getElementById('historyStartRange').addEventListener('input', handleHistoryRangeInput);
  document.getElementById('historyEndRange').addEventListener('input', handleHistoryRangeInput);
  document.getElementById('totalApartments').addEventListener('input', handleTotalApartmentsInput);
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
