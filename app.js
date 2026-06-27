// Later, replace this with your deployed API URL.
// Example: const API_BASE_URL = "https://samarao-lab-api.onrender.com/api/v1";
const API_BASE_URL = "";

const VARIABLE_LABELS = {
  day_ahead_price: "Day-Ahead Price",
  intraday_price_session_1: "Intraday Price Session 1",
  intraday_price_session_2: "Intraday Price Session 2",
  intraday_price_session_3: "Intraday Price Session 3",
  mfrr_price_schedule_up: "mFRR Scheduled Price Up",
  mfrr_price_schedule_down: "mFRR Scheduled Price Down",
  bafrr_final_price_up: "BaFRR Final Price Up",
  bafrr_final_price_down: "BaFRR Final Price Down",
  bafrr_contracted_up: "BaFRR Contracted Up",
  bafrr_contracted_down: "BaFRR Contracted Down",
  afrr_activation_up: "aFRR Activation Up",
  afrr_activation_down: "aFRR Activation Down",
  mfrr_price_direct_q1t_up: "mFRR Direct Price Q1t Up",
  mfrr_price_direct_q1t_down: "mFRR Direct Price Q1t Down",
  mfrr_price_direct_qt_up: "mFRR Direct Price Qt Up",
  mfrr_price_direct_qt_down: "mFRR Direct Price Qt Down",
};

const elements = {
  navLinks: document.querySelectorAll(".nav-link"),
  sections: document.querySelectorAll(".page-section"),

  variables: document.getElementById("variables"),
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

function setActiveSection(sectionId) {
  elements.sections.forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });

  window.location.hash = sectionId;
}

function setupNavigation() {
  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActiveSection(link.dataset.section);
    });
  });

  const initialSection = window.location.hash.replace("#", "") || "market-data";
  const validSection = document.getElementById(initialSection)
    ? initialSection
    : "market-data";

  setActiveSection(validSection);
}

function getSelectedVariables() {
  return Array.from(
    document.querySelectorAll("#variables input[type='checkbox']:checked")
  ).map((input) => input.value);
}

function getFilters() {
  return {
    variableCodes: getSelectedVariables(),
    zone: elements.zone.value,
    source: elements.source.value,
    resolution: elements.resolution.value,
    start: elements.start.value,
    end: elements.end.value,
  };
}

function buildApiUrl(variableCode, filters) {
  const url = new URL(`${API_BASE_URL}/series/${variableCode}`);

  url.searchParams.set("zone", filters.zone);
  url.searchParams.set("start", filters.start);
  url.searchParams.set("end", filters.end);
  url.searchParams.set("source", filters.source);
  url.searchParams.set("resolution", filters.resolution);
  url.searchParams.set("limit", "50000");

  return url.toString();
}

async function fetchSeries(variableCode, filters) {
  if (!API_BASE_URL) {
    return createMockResponse(variableCode, filters);
  }

  const url = buildApiUrl(variableCode, filters);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error ${response.status} while loading ${variableCode}`);
  }

  return response.json();
}

async function fetchAllSeries(filters) {
  const requests = filters.variableCodes.map((variableCode) => {
    return fetchSeries(variableCode, filters);
  });

  return Promise.all(requests);
}

function createMockResponse(variableCode, filters) {
  const data = [];
  const start = new Date(`${filters.start}T00:00:00Z`);

  const isHourly = filters.resolution === "PT60M";
  const intervalMinutes = isHourly ? 60 : 15;
  const pointsPerDay = isHourly ? 24 : 96;

  const startDate = new Date(`${filters.start}T00:00:00Z`);
  const endDate = new Date(`${filters.end}T00:00:00Z`);
  const dayCount =
    Math.max(1, Math.round((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1);

  const variableIndex = Object.keys(VARIABLE_LABELS).indexOf(variableCode);
  const safeIndex = variableIndex >= 0 ? variableIndex : 0;

  for (let i = 0; i < pointsPerDay * dayCount; i++) {
    const timestamp = new Date(start.getTime() + i * intervalMinutes * 60 * 1000);

    const dailyShape = Math.sin((i / pointsPerDay) * Math.PI * 2);
    const intradayNoise = Math.sin(i / 3 + safeIndex);
    const base = 60 + safeIndex * 5;
    const value = base + 18 * dailyShape + 4 * intradayNoise;

    data.push({
      datetime_utc_start: timestamp.toISOString(),
      datetime_utc_end: new Date(
        timestamp.getTime() + intervalMinutes * 60 * 1000
      ).toISOString(),
      value: Number(value.toFixed(2)),
      source_code: filters.source,
      resolution_code: filters.resolution,
    });
  }

  return {
    zone_query: filters.zone,
    zone_code: filters.zone === "PT" ? "10YPT-REN------W" : filters.zone,
    country_iso_code: "PT",
    country_name: "Portugal",
    variable_code: variableCode,
    variable_name: VARIABLE_LABELS[variableCode] || formatVariableName(variableCode),
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

function getUniqueUnits(payloads) {
  return [...new Set(payloads.map((payload) => payload.unit_symbol || "-"))];
}

function updateStats(payloads, filters) {
  const returnedRows = payloads.reduce((sum, payload) => sum + payload.returned, 0);
  const units = getUniqueUnits(payloads);

  elements.statVariable.textContent = `${filters.variableCodes.length} selected`;
  elements.statRows.textContent = returnedRows.toLocaleString();
  elements.statUnit.textContent = units.length === 1 ? units[0] : "Mixed units";
  elements.statSource.textContent = filters.source;
}

function renderChart(payloads) {
  const traces = payloads.map((payload) => {
    return {
      x: payload.data.map((row) => row.datetime_utc_start),
      y: payload.data.map((row) => row.value),
      type: "scatter",
      mode: "lines",
      name: payload.variable_name || payload.variable_code,
      line: {
        width: 2,
      },
    };
  });

  const units = getUniqueUnits(payloads);

  const layout = {
    margin: { l: 64, r: 24, t: 24, b: 64 },
    xaxis: {
      title: "UTC timestamp",
      showgrid: true,
    },
    yaxis: {
      title: units.length === 1 ? units[0] : "Value",
      showgrid: true,
    },
    hovermode: "x unified",
    legend: {
      orientation: "h",
      y: -0.25,
    },
  };

  const config = {
    responsive: true,
    displaylogo: false,
  };

  Plotly.newPlot("chart", traces, layout, config);
}

function validateFilters(filters) {
  if (filters.variableCodes.length === 0) {
    throw new Error("Select at least one variable.");
  }

  if (!filters.start || !filters.end) {
    throw new Error("Select both start and end dates.");
  }

  if (filters.end < filters.start) {
    throw new Error("End date must be greater than or equal to start date.");
  }
}

async function loadDashboard() {
  const filters = getFilters();

  elements.loadButton.disabled = true;
  elements.loadButton.textContent = "Loading...";
  elements.message.textContent = "";

  try {
    validateFilters(filters);

    const payloads = await fetchAllSeries(filters);

    elements.modeBadge.textContent = API_BASE_URL ? "Live API" : "Mock mode";

    elements.chartTitle.textContent = "Market Data Comparison";
    elements.chartSubtitle.textContent =
      `${filters.zone} · ${filters.source} · ${filters.resolution} · ${filters.start} to ${filters.end}`;

    updateStats(payloads, filters);
    renderChart(payloads);

    const totalRows = payloads.reduce((sum, payload) => sum + payload.returned, 0);
    const anyHasMore = payloads.some((payload) => payload.has_more);

    if (totalRows === 0) {
      elements.message.textContent = "No data returned for these filters.";
    } else if (anyHasMore) {
      elements.message.textContent =
        "Some series have more data available. Pagination will be added later.";
    } else {
      elements.message.textContent =
        `Showing ${totalRows.toLocaleString()} total rows across ${payloads.length} series.`;
    }
  } catch (error) {
    console.error(error);
    elements.message.textContent = `Could not load data: ${error.message}`;
  } finally {
    elements.loadButton.disabled = false;
    elements.loadButton.textContent = "Load data";
  }
}

setupNavigation();

elements.loadButton.addEventListener("click", loadDashboard);

loadDashboard();