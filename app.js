const COLORS = ['#007aff', '#34c759', '#ffcc00', '#ff9500', '#af52de', '#5ac8fa'];
const COMPARE_COLORS = ['#80bdff', '#8ee0a5', '#ffe680', '#ffc580', '#d7a8ef', '#ade3fc'];
let donutChart;

const targetRows = [
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

const cantonRows = [['1 Zimmer', 6.8], ['2 Zimmer', 16.2], ['3 Zimmer', 29.2], ['4 Zimmer', 27.4], ['5 Zimmer', 13.0], ['6+ Zimmer', 7.4]];
const swissRows = [['1 Zimmer', "312'000", 6.4], ['2 Zimmer', "678'000", 14.0], ['3 Zimmer', "1'321'000", 27.3], ['4 Zimmer', "1'341'000", 27.7], ['5 Zimmer', "731'000", 15.1], ['6+ Zimmer', "460'000", 9.5]];
let cityChartRows = [];

const chartMeta = {
  target: 'Quelle: eigene fachliche Ableitung. Kein amtlicher Sollwert.',
  bg: 'Quelle: öffentliches Liegenschaftenverzeichnis 2023 der BG; Anteile eigene Berechnung.',
  city: 'Quelle: Stadt Zürich Open Data BAU506OD5062.csv; Anteile eigene Berechnung.',
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

function toPieRows(type) {
  if (type === 'target') return targetRows.map(r => ({ name: r.rooms, value: r.percent }));
  if (type === 'bg') return bgRows.map(r => ({ name: r.rooms, value: r.percent }));
  if (type === 'city') return cityChartRows.length ? cityChartRows.map(r => ({ name: r.label, value: r.percent })) : [{ name: 'Daten laden', value: 100 }];
  if (type === 'canton') return cantonRows.map(r => ({ name: r[0], value: r[1] }));
  if (type === 'swiss') return swissRows.map(r => ({ name: r[0], value: r[2] }));
  return [];
}

function initDonutChart() {
  const el = document.getElementById('mainPie');
  donutChart = echarts.init(el, null, { renderer: 'svg' });
  window.addEventListener('resize', () => donutChart.resize());
}

function seriesForRing(name, data, radius, colors, labelShown) {
  return {
    name,
    type: 'pie',
    radius,
    center: ['50%', '44%'],
    avoidLabelOverlap: true,
    padAngle: 3,
    minAngle: 3,
    color: colors,
    itemStyle: { borderRadius: 12, borderColor: '#fbfbfd', borderWidth: 4 },
    label: {
      show: labelShown,
      formatter: '{b}\n{d}%',
      color: '#1d1d1f',
      fontSize: 12,
      fontWeight: 700,
      fontFamily: 'Inter, sans-serif'
    },
    labelLine: { show: labelShown, length: 12, length2: 8, lineStyle: { color: '#d2d2d7' } },
    emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 18, shadowColor: 'rgba(0,0,0,.16)' } },
    data
  };
}

function renderMainPie(type = document.getElementById('chartSelect').value) {
  if (!donutChart) initDonutChart();
  const compareType = document.getElementById('compareSelect').value;
  const hasCompare = compareType !== 'none' && compareType !== type;
  const mainRows = toPieRows(type);
  const compareRows = hasCompare ? toPieRows(compareType) : [];
  const [line1, line2] = chartTitles[type] || ['', ''];
  const series = hasCompare
    ? [
        seriesForRing(`Innen: ${line1} ${line2}`, mainRows, ['38%', '57%'], COLORS, false),
        seriesForRing(`Aussen: ${(chartTitles[compareType] || [compareType, '']).join(' ')}`, compareRows, ['64%', '84%'], COMPARE_COLORS, true)
      ]
    : [seriesForRing(`${line1} ${line2}`, mainRows, ['54%', '78%'], COLORS, true)];

  donutChart.setOption({
    animationDuration: 650,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      borderWidth: 0,
      backgroundColor: 'rgba(29,29,31,.92)',
      textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' },
      formatter: params => `${params.seriesName}<br>${params.marker}${params.name}: <b>${Number(params.value).toFixed(1).replace('.0', '')}%</b>`
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
      { type: 'text', left: 'center', top: hasCompare ? '39%' : '42%', style: { text: line1, fill: '#1d1d1f', fontSize: 28, fontWeight: 800, fontFamily: 'Inter, sans-serif', textAlign: 'center' } },
      { type: 'text', left: 'center', top: hasCompare ? '49%' : '52%', style: { text: line2, fill: '#6e6e73', fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif', textAlign: 'center' } }
    ],
    series
  }, true);

  const source = hasCompare ? `${chartMeta[type]} Vergleich Aussenring: ${chartMeta[compareType]}` : chartMeta[type];
  document.getElementById('chartSource').textContent = source;
}

function recalculateTargetCounts() {
  targetRows.forEach(row => {
    row.targetCount = Math.round((row.percent / 100) * 394);
  });
}

function renderTarget() {
  document.querySelector('#targetTable tbody').innerHTML = targetRows.map((r, index) => `
    <tr>
      <td>${r.rooms}</td>
      <td>
        <label class="sr-only" for="target-percent-${index}">Prozent ${r.rooms}</label>
        <div class="editable-cell editable-percent">
          <input
            id="target-percent-${index}"
            class="cell-input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value="${r.percent}"
            data-field="percent"
            data-index="${index}"
          >
          <span class="cell-suffix">%</span>
        </div>
      </td>
      <td>
        <label class="sr-only" for="target-corridor-${index}">Zielkorridor ${r.rooms}</label>
        <input
          id="target-corridor-${index}"
          class="cell-input corridor-input"
          type="text"
          value="${r.corridor}"
          data-field="corridor"
          data-index="${index}"
        >
      </td>
      <td>${r.targetCount}</td>
      <td>${r.function}</td>
    </tr>
  `).join('');
}

function renderBg() {
  document.querySelector('#bgTable tbody').innerHTML = bgRows.map((r, i) => {
    const target = targetRows[i].percent;
    const diff = (r.percent - target).toFixed(1);
    const cls = diff > 0 ? 'positive' : 'negative';
    return `<tr><td>${r.rooms}</td><td>${r.count}</td><td>${r.percent.toFixed(1)} %</td><td>${target} %</td><td class="${cls}">${diff > 0 ? '+' : ''}${diff} %-Punkte</td><td>${targetRows[i].note}</td></tr>`;
  }).join('');
}

function renderStaticTables() {
  document.querySelector('#cantonTable tbody').innerHTML = cantonRows.map(r => `<tr><td>${r[0]}</td><td>${r[1].toFixed(1)} %</td></tr>`).join('');
  document.querySelector('#swissTable tbody').innerHTML = swissRows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2].toFixed(1)} %</td></tr>`).join('');
}

function handleTargetTableInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (!Number.isInteger(index) || !field || !targetRows[index]) return;

  if (field === 'percent') {
    const nextValue = Number(input.value);
    if (Number.isNaN(nextValue)) return;
    const clamped = Math.min(100, Math.max(0, nextValue));
    targetRows[index].percent = clamped;
    recalculateTargetCounts();
    renderTarget();
    renderBg();
    renderMainPie();
    const refreshed = document.getElementById(`target-percent-${index}`);
    if (refreshed) refreshed.focus();
    if (refreshed) refreshed.select();
    return;
  }

  if (field === 'corridor') {
    targetRows[index].corridor = input.value;
  }
}

function parseCsv(text) {
  const delimiter = text.indexOf(';') > -1 ? ';' : ',';
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(delimiter).map(h => h.replace(/^"|"$/g, ''));
  return lines.map(line => {
    const cols = line.split(delimiter).map(c => c.replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, cols[i]]));
  });
}

function getYear(row) { return row.StichtagDatJahr || row.Jahr || row.STICHTAGDATJAHR || row.stichtagdatjahr; }
function getCount(row) { return Number(String(row.AnzWhgStat || row.AnzWhg || row.Wohnungen || row.anzahl || '0').replace(/[^0-9.-]/g, '')); }
function roomLabel(row) { return row.AnzZimmerLevel2Lang_noDM || row.AnzZimmerLevel2Cd_noDM || row.Zimmerzahl || row.anzzimmer || ''; }
function groupCityRooms(label) {
  const text = String(label || '').toLowerCase();
  if (text.includes('1')) return '1 Zimmer';
  if (text.includes('2')) return '2 Zimmer';
  if (text.includes('3')) return '3 Zimmer';
  if (text.includes('4')) return '4 Zimmer';
  if (text.includes('5')) return '5 Zimmer';
  if (text.includes('6')) return '6+ Zimmer';
  return null;
}

function renderHistory(yearTotals) {
  const rows = [...yearTotals.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const recent = rows.slice(-8);
  const values = rows.map(r => r[1]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 760, h = 250, p = 34;
  const points = rows.map(([year, value], i) => {
    const x = p + (i / Math.max(rows.length - 1, 1)) * (w - p * 2);
    const y = h - p - ((value - min) / Math.max(max - min, 1)) * (h - p * 2);
    return { year, value, x, y };
  });
  const poly = points.map(p => `${p.x},${p.y}`).join(' ');
  document.getElementById('historyChart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${poly}" fill="none" stroke="#007aff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#e5e5ea"/><line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#e5e5ea"/>${points.map(pt => `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#007aff"><title>${pt.year}: ${pt.value.toLocaleString('de-CH')}</title></circle>`).join('')}<text x="${p}" y="22" class="svg-label">${rows[0][0]}</text><text x="${w-p}" y="22" text-anchor="end" class="svg-label">${rows[rows.length-1][0]}</text></svg>`;
  document.querySelector('#historyTable tbody').innerHTML = recent.reverse().map(([year, value]) => {
    const previous = rows.find(r => Number(r[0]) === Number(year) - 1);
    const diff = previous ? value - previous[1] : null;
    return `<tr><td>${year}</td><td>${value.toLocaleString('de-CH')}</td><td>${diff === null ? '–' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('de-CH')}`}</td></tr>`;
  }).join('');
}

async function loadCityData() {
  const url = 'https://data.stadt-zuerich.ch/dataset/bau_best_whg_zizahl_jahr_od5062/download/BAU506OD5062.csv';
  const cityBody = document.querySelector('#cityTable tbody');
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Quelle nicht erreichbar');
    const rows = parseCsv(await res.text());
    const years = [...new Set(rows.map(getYear).filter(Boolean))].sort();
    const latest = years[years.length - 1];
    const grouped = new Map();
    const yearTotals = new Map();
    rows.forEach(r => {
      const y = getYear(r);
      const c = getCount(r);
      if (!y || !c) return;
      yearTotals.set(y, (yearTotals.get(y) || 0) + c);
      if (y === latest) {
        const key = groupCityRooms(roomLabel(r));
        if (key) grouped.set(key, (grouped.get(key) || 0) + c);
      }
    });
    const total = [...grouped.values()].reduce((a, b) => a + b, 0);
    const order = ['1 Zimmer', '2 Zimmer', '3 Zimmer', '4 Zimmer', '5 Zimmer', '6+ Zimmer'];
    cityChartRows = order.map(k => {
      const count = grouped.get(k) || 0;
      const percent = total ? ((count / total) * 100) : 0;
      return { label: k, percent, count };
    });
    cityBody.innerHTML = cityChartRows.map(r => `<tr><td>${r.label}</td><td>${r.count.toLocaleString('de-CH')}</td><td>${r.percent.toFixed(1)} %</td><td>${latest}</td></tr>`).join('');
    renderHistory(yearTotals);
    const compareType = document.getElementById('compareSelect').value;
    if (document.getElementById('chartSelect').value === 'city' || compareType === 'city') renderMainPie();
  } catch (error) {
    cityBody.innerHTML = `<tr><td colspan="4">Automatisches Laden nicht möglich. Bitte Tabelle direkt aus BAU506OD5062.csv übernehmen.</td></tr>`;
    document.getElementById('historyChart').textContent = 'Automatisches Laden nicht möglich. Quelle bitte direkt prüfen.';
    document.querySelector('#historyTable tbody').innerHTML = `<tr><td colspan="3">Keine Zeitreihe geladen.</td></tr>`;
  }
}

document.getElementById('chartSelect').addEventListener('change', () => renderMainPie());
document.getElementById('compareSelect').addEventListener('change', () => renderMainPie());
document.querySelector('#targetTable tbody').addEventListener('input', handleTargetTableInput);
recalculateTargetCounts();
renderTarget();
renderBg();
renderStaticTables();
renderMainPie('target');
loadCityData();
