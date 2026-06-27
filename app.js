// Later, replace this with your deployed API URL.
// Example: const API_BASE_URL = "https://samarao-lab-api.onrender.com";
const API_BASE_URL = "";

const elements = {
  variable: document.getElementById("variable"),
  zone: document.getElementById("zone"),
  source: document.getElementById("source"),
  resolution: document.getElementById("resolution"),
  start: document.getElementById("start"),
  end: document.getElementById("end"),
  loadButton: document.getElementById("loadButton"),

  statVariable: document.getElementById("statVariable"),
  statRows: document.getElementById("statRows"),
  statUnit: document.getElementById("statUnit"),
  statSource: document.getElementById("statSource"),

  chartTitle: document.getElementById("chartTitle"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  modeBadge: document.getElementById("modeBadge"),
  message: document.getElementById("message"),
};

function buildApiUrl(filters) {
  const url = new URL(`${API_BASE_URL}/series/${filters.variableCode}`);

  url.searchParams.set("zone", filters.zone);
  url.searchParams.set("start", filters.start);
  url.searchParams.set("end", filters.end);
  url.searchParams.set("source", filters.source);
  url.searchParams.set("resolution", filters.resolution);
  url.searchParams.set("limit", "50000");

  return url.toString();
}

function getFilters() {
  return {
    variableCode: elements.variable.value,
    zone: elements.zone.value,
    source: elements.source.value,
    resolution: elements.resolution.value,
    start: elements.start.value,
    end: elements.end.value,
  };
}

async function fetchSeries(filters) {
  if (!API_BASE_URL) {
    return createMockResponse(filters);
  }

  const url = buildApiUrl(filters);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return response.json();
}

function createMockResponse(filters) {
  const data = [];
  const start = new Date(`${filters.start}T00:00:00Z`);

  for (let i = 0; i < 96 * 7; i++) {
    const timestamp = new Date(start.getTime() + i * 15 * 60 * 1000);
    const base = 80 + 18 * Math.sin(i / 12);
    const noise = 5 * Math.sin(i / 3);

    data.push({
      datetime_utc_start: timestamp.toISOString(),
      datetime_utc_end: new Date(timestamp.getTime() + 15 * 60 * 1000).toISOString(),
      value: Number((base + noise).toFixed(2)),
      source_code: filters.source,
      resolution_code: filters.resolution,
    });
  }

  return {
    zone_query: filters.zone,
    zone_code: "10YPT-REN------W",
    country_iso_code: "PT",
    country_name: "Portugal",
    variable_code: filters.variableCode,
    variable_name: formatVariableName(filters.variableCode),
    unit_symbol: "EUR/MWh",
    currency_code: "EUR",
    source_code: filters.source,
    resolution_code: filters.resolution,
    start_date: filters.start,
    end_date: filters.end,
    count_total: data.length,
    returned: data.length,
    limit: 50000,
    offset: 0,
    has_more: false,
    next_offset: null,
    generated_at_utc: new Date().toISOString(),
    data,
  };
}

function formatVariableName(variableCode) {
  return variableCode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function updateStats(payload) {
  elements.statVariable.textContent = payload.variable_name || payload.variable_code;
  elements.statRows.textContent = payload.returned.toLocaleString();
  elements.statUnit.textContent = payload.unit_symbol || "-";
  elements.statSource.textContent = payload.source_code || "Multiple";
}

function renderChart(payload) {
  const x = payload.data.map((row) => row.datetime_utc_start);
  const y = payload.data.map((row) => row.value);

  const trace = {
    x,
    y,
    type: "scatter",
    mode: "lines",
    name: payload.variable_name || payload.variable_code,
    line: {
      width: 2,
    },
  };

  const layout = {
    margin: { l: 60, r: 24, t: 24, b: 60 },
    xaxis: {
      title: "UTC timestamp",
      showgrid: true,
    },
    yaxis: {
      title: payload.unit_symbol || "Value",
      showgrid: true,
    },
    hovermode: "x unified",
  };

  const config = {
    responsive: true,
    displaylogo: false,
  };

  Plotly.newPlot("chart", [trace], layout, config);
}

async function loadDashboard() {
  const filters = getFilters();

  elements.loadButton.disabled = true;
  elements.loadButton.textContent = "Loading...";
  elements.message.textContent = "";

  try {
    const payload = await fetchSeries(filters);

    elements.modeBadge.textContent = API_BASE_URL ? "Live API" : "Mock mode";
    elements.chartTitle.textContent = payload.variable_name || payload.variable_code;
    elements.chartSubtitle.textContent =
      `${payload.country_name || filters.zone} · ${filters.source} · ${filters.resolution} · ${filters.start} to ${filters.end}`;

    updateStats(payload);
    renderChart(payload);

    if (payload.returned === 0) {
      elements.message.textContent = "No data returned for these filters.";
    } else if (payload.has_more) {
      elements.message.textContent =
        `Showing ${payload.returned} of ${payload.count_total} rows. Increase pagination later.`;
    } else {
      elements.message.textContent =
        `Showing ${payload.returned} rows. Generated at ${payload.generated_at_utc}.`;
    }
  } catch (error) {
    console.error(error);
    elements.message.textContent = `Could not load data: ${error.message}`;
  } finally {
    elements.loadButton.disabled = false;
    elements.loadButton.textContent = "Load data";
  }
}

elements.loadButton.addEventListener("click", loadDashboard);

loadDashboard();