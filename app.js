const API_BASE_URL = "https://samarao-lab-api.onrender.com/api/v1";
const SOURCE_CODE = "REN";

const PRICE_VARIABLES = [
  {
    code: "day_ahead_price",
    label: "Day-Ahead",
  },
  {
    code: "intraday_price_session_1",
    label: "IDA 1",
  },
  {
    code: "intraday_price_session_2",
    label: "IDA 2",
  },
  {
    code: "intraday_price_session_3",
    label: "IDA 3",
  },
  {
    code: "mfrr_price_schedule_up",
    label: "mFRR SA",
  },
  {
    code: "bafrr_final_price_up",
    label: "BaFRR Final Up",
  },
  {
    code: "bafrr_final_price_down",
    label: "BaFRR Final Down",
  },
];

const PRICE_LABEL_BY_CODE = Object.fromEntries(
  PRICE_VARIABLES.map((item) => [item.code, item.label])
);

const elements = {
  navLinks: document.querySelectorAll(".nav-link"),
  sections: document.querySelectorAll(".page-section"),

  marketSubtabs: document.querySelectorAll(".market-subtab"),
  marketSubtabContents: document.querySelectorAll(".market-subtab-content"),

  country: document.getElementById("country"),
  zone: document.getElementById("zone"),
  start: document.getElementById("start"),
  end: document.getElementById("end"),
  referencePrice: document.getElementById("referencePrice"),
  comparisonPrices: document.getElementById("comparisonPrices"),
  loadButton: document.getElementById("loadButton"),

  statVariable: document.getElementById("statVariable"),
  statRows: document.getElementById("statRows"),
  statUnit: document.getElementById("statUnit"),
  statSource: document.getElementById("statSource"),

  chartTitle: document.getElementById("chartTitle"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  spreadSubtitle: document.getElementById("spreadSubtitle"),
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

function setupMarketSubtabs() {
  elements.marketSubtabs.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.subtab;

      elements.marketSubtabs.forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      elements.marketSubtabContents.forEach((content) => {
        content.classList.toggle("active", content.id === targetId);
      });
    });
  });
}

function setupPriceSelectors() {
  elements.referencePrice.innerHTML = PRICE_VARIABLES.map((variable) => {
    return `<option value="${variable.code}">${variable.label}</option>`;
  }).join("");

  elements.referencePrice.value = "day_ahead_price";

  updateComparisonOptions(["intraday_price_session_1"]);

  elements.referencePrice.addEventListener("change", () => {
    const selectedComparisonCodes = getSelectedComparisonVariables();
    updateComparisonOptions(selectedComparisonCodes);
  });
}

function updateComparisonOptions(selectedCodes = []) {
  const referenceCode = elements.referencePrice.value;

  const availableComparisons = PRICE_VARIABLES.filter((variable) => {
    return variable.code !== referenceCode;
  });

  let safeSelectedCodes = selectedCodes.filter((code) => code !== referenceCode);

  if (safeSelectedCodes.length === 0) {
    const defaultComparison = availableComparisons.find(
      (variable) => variable.code === "intraday_price_session_1"
    );

    safeSelectedCodes = [
      defaultComparison ? defaultComparison.code : availableComparisons[0].code,
    ];
  }

  elements.comparisonPrices.innerHTML = availableComparisons
    .map((variable) => {
      const checked = safeSelectedCodes.includes(variable.code) ? "checked" : "";

      return `
        <label class="checkbox-row">
          <input type="checkbox" value="${variable.code}" ${checked} />
          ${variable.label}
        </label>
      `;
    })
    .join("");
}

function getSelectedComparisonVariables() {
  return Array.from(
    elements.comparisonPrices.querySelectorAll("input[type='checkbox']:checked")
  ).map((input) => input.value);
}

function getFilters() {
  return {
    country: elements.country.value,
    zone: elements.zone.value,
    source: SOURCE_CODE,
    start: elements.start.value,
    end: elements.end.value,
    referenceCode: elements.referencePrice.value,
    comparisonCodes: getSelectedComparisonVariables(),
  };
}

function validateFilters(filters) {
  if (!filters.start || !filters.end) {
    throw new Error("Select both start and end dates.");
  }

  if (filters.end < filters.start) {
    throw new Error("End date must be greater than or equal to start date.");
  }

  if (!filters.referenceCode) {
    throw new Error("Select one reference market.");
  }

  if (filters.comparisonCodes.length === 0) {
    throw new Error("Select at least one comparison market.");
  }
}

function buildApiUrl(variableCode, filters) {
  const url = new URL(`${API_BASE_URL}/series/${variableCode}`);

  url.searchParams.set("zone", filters.zone);
  url.searchParams.set("start", filters.start);
  url.searchParams.set("end", filters.end);
  url.searchParams.set("source", filters.source);
  url.searchParams.set("limit", "50000");

  return url.toString();
}

async function fetchSeries(variableCode, filters) {
  const url = buildApiUrl(variableCode, filters);
  console.log("Fetching:", url);

  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `Network/CORS error while loading ${PRICE_LABEL_BY_CODE[variableCode] || variableCode}. Tried URL: ${url}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API error ${response.status} while loading ${PRICE_LABEL_BY_CODE[variableCode] || variableCode}: ${errorText}`
    );
  }

  return response.json();
}

async function fetchDashboardData(filters) {
  const variableCodes = [
    filters.referenceCode,
    ...filters.comparisonCodes.filter((code) => code !== filters.referenceCode),
  ];

  const payloads = await Promise.all(
    variableCodes.map((variableCode) => fetchSeries(variableCode, filters))
  );

  const referencePayload = payloads.find(
    (payload) => payload.variable_code === filters.referenceCode
  );

  const comparisonPayloads = payloads.filter(
    (payload) => payload.variable_code !== filters.referenceCode
  );

  return {
    payloads,
    referencePayload,
    comparisonPayloads,
  };
}

function getDisplayName(payload) {
  return PRICE_LABEL_BY_CODE[payload.variable_code] || payload.variable_name || payload.variable_code;
}

function getUniqueUnits(payloads) {
  return [
    ...new Set(
      payloads.map((payload) => payload.unit_symbol || "-")
    ),
  ];
}

function updateStats(payloads) {
  const returnedRows = payloads.reduce((sum, payload) => sum + payload.returned, 0);
  const units = getUniqueUnits(payloads);

  elements.statVariable.textContent = `${payloads.length} series`;
  elements.statRows.textContent = returnedRows.toLocaleString();
  elements.statUnit.textContent = units.length === 1 ? units[0] : units.join(" / ");
  elements.statSource.textContent = SOURCE_CODE;
}

function renderPriceChart(referencePayload, comparisonPayloads) {
  const payloads = [referencePayload, ...comparisonPayloads];

  const primaryUnit = referencePayload.unit_symbol || "Value";
  const secondaryUnits = [
    ...new Set(
      payloads
        .map((payload) => payload.unit_symbol || "Value")
        .filter((unit) => unit !== primaryUnit)
    ),
  ];

  const hasSecondaryAxis = secondaryUnits.length > 0;

  const traces = payloads.map((payload) => {
    const unit = payload.unit_symbol || "Value";
    const usesSecondaryAxis = hasSecondaryAxis && unit !== primaryUnit;

    return {
      x: payload.data.map((row) => row.datetime_utc_start),
      y: payload.data.map((row) => row.value),
      type: "scatter",
      mode: "lines",
      name: `${getDisplayName(payload)} (${unit})`,
      yaxis: usesSecondaryAxis ? "y2" : "y",
      line: {
        width: payload.variable_code === referencePayload.variable_code ? 3 : 2,
      },
    };
  });

  const layout = {
    margin: { l: 72, r: hasSecondaryAxis ? 72 : 24, t: 24, b: 72 },
    xaxis: {
      title: "UTC timestamp",
      showgrid: true,
    },
    yaxis: {
      title: primaryUnit,
      showgrid: true,
    },
    hovermode: "x unified",
    legend: {
      orientation: "h",
      y: -0.25,
    },
  };

  if (hasSecondaryAxis) {
    layout.yaxis2 = {
      title: secondaryUnits.join(" / "),
      overlaying: "y",
      side: "right",
      showgrid: false,
    };
  }

  const config = {
    responsive: true,
    displaylogo: false,
  };

  Plotly.newPlot("chart", traces, layout, config);
}

function parseResolutionMinutes(resolutionCode) {
  if (!resolutionCode) {
    return 60;
  }

  const minuteMatch = resolutionCode.match(/^PT(\d+)M$/i);
  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const hourMatch = resolutionCode.match(/^PT(\d+)H$/i);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  return 60;
}

function normalizeUnitSymbol(unitSymbol) {
  return String(unitSymbol || "")
    .replace("€", "EUR")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function convertValueToUnit(value, fromUnit, toUnit, resolutionCode) {
  const normalizedFrom = normalizeUnitSymbol(fromUnit);
  const normalizedTo = normalizeUnitSymbol(toUnit);

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return value;
  }

  const resolutionMinutes = parseResolutionMinutes(resolutionCode);
  const factor = 60 / resolutionMinutes;

  if (normalizedFrom === "EUR/MW" && normalizedTo === "EUR/MWH") {
    return value * factor;
  }

  if (normalizedFrom === "EUR/MWH" && normalizedTo === "EUR/MW") {
    return value / factor;
  }

  return value;
}

function buildTimestampMap(payload) {
  return new Map(
    payload.data.map((row) => [row.datetime_utc_start, row])
  );
}

function buildSpreadTraces(referencePayload, comparisonPayloads) {
  const referenceMap = buildTimestampMap(referencePayload);
  const referenceUnit = referencePayload.unit_symbol || "Value";

  return comparisonPayloads.map((comparisonPayload) => {
    const x = [];
    const y = [];

    comparisonPayload.data.forEach((comparisonRow) => {
      const referenceRow = referenceMap.get(comparisonRow.datetime_utc_start);

      if (!referenceRow) {
        return;
      }

      const normalizedComparisonValue = convertValueToUnit(
        comparisonRow.value,
        comparisonPayload.unit_symbol,
        referenceUnit,
        comparisonRow.resolution_code
      );

      const spread = normalizedComparisonValue - referenceRow.value;

      x.push(comparisonRow.datetime_utc_start);
      y.push(Number(spread.toFixed(4)));
    });

    return {
      x,
      y,
      type: "bar",
      name: `${getDisplayName(comparisonPayload)} - ${getDisplayName(referencePayload)}`,
    };
  });
}

function renderSpreadChart(referencePayload, comparisonPayloads) {
  const traces = buildSpreadTraces(referencePayload, comparisonPayloads);
  const referenceUnit = referencePayload.unit_symbol || "reference unit";

  const totalSpreadRows = traces.reduce((sum, trace) => sum + trace.y.length, 0);

  const layout = {
    margin: { l: 72, r: 24, t: 24, b: 72 },
    xaxis: {
      title: "UTC timestamp",
      showgrid: true,
    },
    yaxis: {
      title: `Spread (${referenceUnit})`,
      showgrid: true,
    },
    barmode: "group",
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

  Plotly.newPlot("spreadChart", traces, layout, config);

  return totalSpreadRows;
}

async function loadDashboard() {
  const filters = getFilters();

  elements.loadButton.disabled = true;
  elements.loadButton.textContent = "Loading...";
  elements.message.textContent = "";

  try {
    validateFilters(filters);

    const { payloads, referencePayload, comparisonPayloads } =
      await fetchDashboardData(filters);

    if (!referencePayload) {
      throw new Error("Reference market did not return data.");
    }

    elements.modeBadge.textContent = "Live API";
    elements.chartTitle.textContent = "Price comparison";
    elements.chartSubtitle.textContent =
      `${filters.country} · ${filters.zone} · ${filters.start} to ${filters.end}`;

    elements.spreadSubtitle.textContent =
      `Buying in ${getDisplayName(referencePayload)} and selling in selected comparison markets.`;

    updateStats(payloads);
    renderPriceChart(referencePayload, comparisonPayloads);

    const spreadRows = renderSpreadChart(referencePayload, comparisonPayloads);

    const totalRows = payloads.reduce((sum, payload) => sum + payload.returned, 0);
    const emptySeries = payloads.filter((payload) => payload.returned === 0);

    if (totalRows === 0) {
      elements.message.textContent = "No data returned for these filters.";
    } else if (emptySeries.length > 0) {
      elements.message.textContent =
        `Loaded ${totalRows.toLocaleString()} rows. Some selected markets returned no data.`;
    } else {
      elements.message.textContent =
        `Loaded ${totalRows.toLocaleString()} rows. Spread chart uses ${spreadRows.toLocaleString()} exact timestamp matches.`;
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
setupMarketSubtabs();
setupPriceSelectors();

elements.loadButton.addEventListener("click", loadDashboard);

loadDashboard();