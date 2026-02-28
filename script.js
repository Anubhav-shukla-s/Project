const startBtn = document.getElementById("start-btn");
const topExploreBtn = document.getElementById("explore-top-btn");
const rankingsBtn = document.getElementById("rankings-btn");
const mapGameBtn = document.getElementById("map-game-btn");

const countrySection = document.getElementById("country-section");
const countryList = document.getElementById("country-list");
const countryDetails = document.getElementById("country-details");
const statusText = document.getElementById("status-text");
const countryCount = document.getElementById("country-count");
const countrySearch = document.getElementById("country-search");

let countriesLoaded = false;
let countriesCache = [];

function formatPopulation(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function scrollToSection(section) {
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showCountryDetails(country) {
  const capital = country?.capital?.[0] || "N/A";
  const population = formatPopulation(country?.population);
  const flagUrl = country?.flags?.svg || country?.flags?.png || "";

  countryDetails.innerHTML = `
    ${flagUrl ? `<img class="details-flag" src="${flagUrl}" alt="Flag of ${country?.name?.common || "country"}">` : ""}
    <h3 class="details-title">${country?.name?.common || "Unknown"}</h3>
    <p class="details-line"><strong>Capital:</strong> ${capital}</p>
    <p class="details-line"><strong>Population:</strong> ${population}</p>
    <p class="details-line"><strong>Region:</strong> ${country?.region || "N/A"}</p>
  `;
}

function renderCountryNames(countries) {
  countryList.innerHTML = "";
  countryDetails.innerHTML = '<p class="details-placeholder">Click any country name to view details.</p>';

  if (countries.length === 0) {
    return;
  }

  countries.forEach((country, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "country-row";
    btn.textContent = country?.name?.common || "Unknown";

    btn.addEventListener("click", () => {
      document.querySelectorAll(".country-row.active").forEach((el) => {
        el.classList.remove("active");
      });
      btn.classList.add("active");
      showCountryDetails(country);
    });

    countryList.appendChild(btn);

    if (index === 0) {
      btn.classList.add("active");
      showCountryDetails(country);
    }
  });
}

async function loadAllCountries() {
  countrySection.classList.remove("hidden");
  statusText.textContent = "Fetching country names...";
  countryCount.textContent = "Loading...";

  if (countriesLoaded) {
    statusText.textContent = "Click any country name to view details.";
    scrollToSection(countrySection);
    return;
  }

  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,capital,population,flags,region"
    );

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const countries = await response.json();
    countries.sort((a, b) => (a?.name?.common || "").localeCompare(b?.name?.common || ""));

    countriesCache = countries;
    countrySearch.value = "";
    renderCountryNames(countriesCache);

    countryCount.textContent = `${countries.length} countries`;
    statusText.textContent = "Hover for animation, click for details.";
    countriesLoaded = true;
    scrollToSection(countrySection);
  } catch (error) {
    statusText.textContent = "Could not load countries. Check your internet and try again.";
    countryCount.textContent = "No data";
    countryList.innerHTML = "";
    countryDetails.innerHTML = '<p class="details-placeholder">Country details unavailable.</p>';
  }
}

countrySearch.addEventListener("input", () => {
  if (!countriesLoaded) {
    return;
  }

  const query = countrySearch.value.trim().toLowerCase();
  const filteredCountries = countriesCache.filter((country) =>
    (country?.name?.common || "").toLowerCase().includes(query)
  );

  renderCountryNames(filteredCountries);
  countryCount.textContent = `${filteredCountries.length} of ${countriesCache.length} countries`;
  statusText.textContent = filteredCountries.length
    ? "Hover for animation, click for details."
    : "No countries match your search.";
});

startBtn.addEventListener("click", loadAllCountries);
topExploreBtn.addEventListener("click", loadAllCountries);
rankingsBtn.addEventListener("click", loadAllCountries);
mapGameBtn.addEventListener("click", () => {
  window.location.href = "map-game.html";
});
