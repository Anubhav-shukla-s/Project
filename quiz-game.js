const backModesBtn = document.getElementById("back-modes-btn");
const quizTitle = document.getElementById("quiz-title");
const gameScore = document.getElementById("game-score");
const gameStatus = document.getElementById("game-status");
const gameCountryInput = document.getElementById("game-country-input");
const guessCountryBtn = document.getElementById("guess-country-btn");
const resetGameBtn = document.getElementById("reset-game-btn");

const params = new URLSearchParams(window.location.search);
const scopeParam = (params.get("scope") || "world").toLowerCase();

const SCOPE_CONFIG = {
  world: {
    title: "World Quiz",
    match(country) {
      return country?.independent === true;
    }
  },
  africa: {
    title: "Africa Quiz",
    match(country) {
      return country?.independent === true && country?.region === "Africa";
    }
  },
  asia: {
    title: "Asia Quiz",
    match(country) {
      return country?.independent === true && country?.region === "Asia";
    }
  },
  europe: {
    title: "Europe Quiz",
    match(country) {
      return country?.independent === true && country?.region === "Europe";
    }
  },
  "north-america": {
    title: "North America Quiz",
    match(country) {
      return (
        country?.independent === true
        && country?.region === "Americas"
        && ["North America", "Central America", "Caribbean"].includes(country?.subregion)
      );
    }
  },
  "south-america": {
    title: "South America Quiz",
    match(country) {
      return (
        country?.independent === true
        && country?.region === "Americas"
        && country?.subregion === "South America"
      );
    }
  },
  oceania: {
    title: "Oceania Quiz",
    match(country) {
      return country?.independent === true && country?.region === "Oceania";
    }
  }
};

const activeScope = SCOPE_CONFIG[scopeParam] || SCOPE_CONFIG.world;
quizTitle.textContent = activeScope.title;
const isWorldScope = (SCOPE_CONFIG[scopeParam] ? scopeParam : "world") === "world";

let gameReady = false;
let playableCountries = [];
const playableByName = new Map();
const mapCountryPaths = new Map();
const mapCountrySigns = new Map();
const foundCountryNames = new Set();
const scopedMapIds = new Set();

const GAME_COLORS = [
  "#22d3ee",
  "#34d399",
  "#f59e0b",
  "#fb7185",
  "#60a5fa",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
  "#4ade80"
];

const COUNTRY_NAME_ALIASES = {
  usa: "united states",
  "united states of america": "united states",
  "russian federation": "russia",
  "ivory coast": "cote d'ivoire",
  "cote d ivoire": "cote d'ivoire",
  "south korea": "korea, republic of",
  "north korea": "korea (democratic people's republic of)",
  "laos": "lao people's democratic republic",
  "moldova": "moldova, republic of",
  "syria": "syrian arab republic",
  "vatican city": "holy see",
  "tanzania": "tanzania, united republic of",
  "venezuela": "venezuela (bolivarian republic of)",
  "bolivia": "bolivia (plurinational state of)",
  "brunei": "brunei darussalam"
};

function normalizeName(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s'()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function updateGameScore() {
  gameScore.textContent = `${foundCountryNames.size} / ${playableCountries.length} found`;
}

function clearMapColors() {
  mapCountryPaths.forEach((pathEl) => {
    pathEl.style.fill = "";
    pathEl.classList.remove("found-country");
  });

  mapCountrySigns.forEach((signEl) => {
    signEl.style.fill = "";
    signEl.classList.remove("found-country-sign");
  });
}

function colorCountryOnMap(mapId) {
  const pathEl = mapCountryPaths.get(mapId);
  const signEl = mapCountrySigns.get(mapId);

  if (!pathEl) {
    return;
  }

  const color = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];

  pathEl.classList.add("found-country");
  pathEl.style.fill = color;

  if (signEl) {
    signEl.classList.add("found-country-sign");
    signEl.style.fill = color;
  }
}

function drawWorldMap(worldData, visibleMapIds, showWorld) {
  const svg = d3.select("#world-map-svg");
  const width = 960;
  const height = 500;

  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const countriesFeature = topojson.feature(worldData, worldData.objects.countries);
  const allFeatures = countriesFeature.features;
  const visibleFeatures = showWorld
    ? allFeatures
    : allFeatures.filter((feature) => visibleMapIds.has(String(feature.id).padStart(3, "0")));

  if (visibleFeatures.length === 0) {
    throw new Error("No visible features for selected scope");
  }

  const projection = d3.geoNaturalEarth1().fitExtent(
    [[20, 20], [width - 20, height - 20]],
    {
      type: "FeatureCollection",
      features: visibleFeatures
    }
  );
  const path = d3.geoPath(projection);

  const countriesGroup = svg.append("g").attr("class", "map-countries");
  const signsGroup = svg.append("g").attr("class", "map-signs");

  countriesGroup
    .selectAll("path")
    .data(visibleFeatures)
    .join("path")
    .attr("class", "map-country")
    .attr("d", path)
    .attr("data-id", (feature) => String(feature.id).padStart(3, "0"));

  signsGroup
    .selectAll("circle")
    .data(visibleFeatures)
    .join("circle")
    .attr("class", "map-country-sign")
    .attr("data-id", (feature) => String(feature.id).padStart(3, "0"))
    .attr("cx", (feature) => {
      const centroid = path.centroid(feature);
      return Number.isFinite(centroid[0]) ? centroid[0] : -20;
    })
    .attr("cy", (feature) => {
      const centroid = path.centroid(feature);
      return Number.isFinite(centroid[1]) ? centroid[1] : -20;
    })
    .attr("r", 1.8);

  mapCountryPaths.clear();
  mapCountrySigns.clear();

  svg.selectAll("path.map-country").each(function eachPath() {
    const id = this.getAttribute("data-id");
    if (id) {
      mapCountryPaths.set(id, this);
    }
  });

  svg.selectAll("circle.map-country-sign").each(function eachSign() {
    const id = this.getAttribute("data-id");
    if (id) {
      mapCountrySigns.set(id, this);
    }
  });
}

function addPlayableLookup(countryData) {
  const normalizedCommon = normalizeName(countryData.name);
  const normalizedOfficial = normalizeName(countryData.officialName);

  if (normalizedCommon) {
    playableByName.set(normalizedCommon, countryData);
  }

  if (normalizedOfficial) {
    playableByName.set(normalizedOfficial, countryData);
  }
}

function buildPlayableCountries(allCountries) {
  playableCountries = [];
  playableByName.clear();
  scopedMapIds.clear();

  allCountries
    .filter((country) => activeScope.match(country))
    .forEach((country) => {
      const mapId = String(country?.ccn3 || "").padStart(3, "0");

      if (!country?.ccn3) {
        return;
      }

      const countryData = {
        name: country?.name?.common || "",
        officialName: country?.name?.official || "",
        mapId
      };

      playableCountries.push(countryData);
      addPlayableLookup(countryData);
      scopedMapIds.add(mapId);
    });

  Object.entries(COUNTRY_NAME_ALIASES).forEach(([alias, canonical]) => {
    const canonicalCountry = playableByName.get(normalizeName(canonical));
    if (canonicalCountry) {
      playableByName.set(normalizeName(alias), canonicalCountry);
    }
  });

  playableCountries.sort((a, b) => a.name.localeCompare(b.name));
}

function resolveCountryGuess(rawGuess) {
  const normalizedGuess = normalizeName(rawGuess);

  if (!normalizedGuess) {
    return null;
  }

  if (playableByName.has(normalizedGuess)) {
    return playableByName.get(normalizedGuess);
  }

  const noTheGuess = normalizedGuess.replace(/^the\s+/, "");
  if (playableByName.has(noTheGuess)) {
    return playableByName.get(noTheGuess);
  }

  return null;
}

function handleCountryGuess() {
  if (!gameReady) {
    gameStatus.textContent = "Game is loading. Please wait.";
    return;
  }

  const guessedCountry = resolveCountryGuess(gameCountryInput.value);

  if (!guessedCountry) {
    gameStatus.textContent = "Country not found in this quiz scope. Try another name.";
    return;
  }

  if (foundCountryNames.has(guessedCountry.name)) {
    gameStatus.textContent = `${guessedCountry.name} is already found.`;
    return;
  }

  foundCountryNames.add(guessedCountry.name);
  colorCountryOnMap(guessedCountry.mapId);
  updateGameScore();

  gameStatus.textContent = `${guessedCountry.name} found and colored.`;
  gameCountryInput.value = "";

  if (foundCountryNames.size === playableCountries.length) {
    gameStatus.textContent = `Excellent. You found all countries in ${activeScope.title}.`;
  }
}

function resetMapGame() {
  foundCountryNames.clear();
  clearMapColors();
  updateGameScore();
  gameStatus.textContent = `Game reset for ${activeScope.title}. Type a country name and submit.`;
}

async function loadMapGame() {
  if (typeof d3 === "undefined" || typeof topojson === "undefined") {
    gameStatus.textContent = "Map library failed to load. Refresh and try again.";
    return;
  }

  gameStatus.textContent = `Loading ${activeScope.title}...`;

  try {
    const [worldMapResponse, countriesResponse] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
      fetch("https://restcountries.com/v3.1/all?fields=name,ccn3,independent,region,subregion")
    ]);

    if (!worldMapResponse.ok || !countriesResponse.ok) {
      throw new Error(
        `Fetch failed (map: ${worldMapResponse.status}, countries: ${countriesResponse.status})`
      );
    }

    const [worldMapData, allCountries] = await Promise.all([
      worldMapResponse.json(),
      countriesResponse.json()
    ]);

    buildPlayableCountries(allCountries);
    drawWorldMap(worldMapData, scopedMapIds, isWorldScope);
    updateGameScore();

    gameReady = true;
    gameStatus.textContent = `${activeScope.title} ready. Map is zoomed to this region.`;
  } catch (error) {
    gameStatus.textContent = `Could not load map quiz: ${error.message}`;
  }
}

backModesBtn.addEventListener("click", () => {
  window.location.href = "map-game.html";
});

guessCountryBtn.addEventListener("click", handleCountryGuess);
resetGameBtn.addEventListener("click", resetMapGame);

gameCountryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleCountryGuess();
  }
});

loadMapGame();
