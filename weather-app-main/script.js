/**
 * WEATHER APPLICATION SCRIPT
 *
 * This script handles all weather data fetching, processing, and display logic
 * for the weather application. It includes error handling, caching, and rate limiting.
 */

// ====================== CONFIGURATION ======================
// API Key (Note: In production, use a backend proxy to hide this)
const apiKey = "583abf89c1881474961680b358691cbf";

// ====================== DOM ELEMENTS ======================
// Cache all DOM elements for better performance
const cityInput = document.getElementById("city");
const searchBtn = document.getElementById("search-btn");
const tempDiv = document.getElementById("temp-div");
const weatherInfoDiv = document.getElementById("weather-info");
const weatherIcon = document.getElementById("weather-icon");
const extraInfoDiv = document.getElementById("extra-info");
const hourlyForecastDiv = document.getElementById("hourly-forecast");
const loadingIndicator = document.getElementById("loading-indicator");
const errorMessage = document.getElementById("error-message");

// ====================== STATE MANAGEMENT ======================
// Rate limiting and cache implementation
let lastRequestTime = 0; // Timestamp of last API request
const REQUEST_DELAY = 1000; // 1 second minimum between requests
const weatherCache = {}; // Cache storage for weather data

// ====================== EVENT LISTENERS ======================
// Search button click handler
searchBtn.addEventListener("click", getWeather);

// Enter key handler for city input
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getWeather();
});

// ====================== MAIN FUNCTIONS ======================

/**
 * 1. Main Weather Data Fetcher
 * Orchestrates the weather data fetching process including:
 * - Input validation
 * - Cache checking
 * - Rate limiting
 * - Error handling
 * - Data display
 */
async function getWeather() {
  const city = cityInput.value.trim();

  // Validate input
  if (!city) {
    showError("Please enter a city name");
    return;
  }

  // Check cache first (5 minute cache duration)
  if (
    weatherCache[city] &&
    Date.now() - weatherCache[city].timestamp < 5 * 60 * 1000
  ) {
    displayWeather(weatherCache[city].current);
    displayHourlyForecast(weatherCache[city].forecast);
    return;
  }

  // Implement rate limiting
  const now = Date.now();
  if (now - lastRequestTime < REQUEST_DELAY) {
    showError("Please wait before searching again");
    return;
  }
  lastRequestTime = now;

  // Begin data fetching process
  showLoading(true);
  clearWeatherData();

  try {
    // Fetch both current and forecast data in parallel
    const [currentData, forecastData] = await fetchWeatherData(city);

    // Validate API response structure
    if (!currentData.main || !forecastData.list) {
      throw new Error("Invalid data received from weather service");
    }

    // Update cache
    weatherCache[city] = {
      current: currentData,
      forecast: forecastData,
      timestamp: Date.now(),
    };

    // Update UI with new data
    displayWeather(currentData);
    displayHourlyForecast(forecastData);
  } catch (error) {
    handleWeatherError(error, city);
  } finally {
    showLoading(false);
  }
}

/**
 * 2. Weather Data Fetcher
 * Makes parallel API calls to get current weather and forecast data
 * @param {string} city - City name to fetch weather for
 * @returns {Promise<Array>} - [currentData, forecastData]
 */
async function fetchWeatherData(city) {
  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&cnt=5`
      ),
    ]);

    const currentData = await handleResponse(currentResponse);
    const forecastData = await handleResponse(forecastResponse);

    return [currentData, forecastData];
  } catch (error) {
    throw error;
  }
}

/**
 * 3. API Response Handler
 * Handles the HTTP response and converts to JSON
 * Includes error handling for non-200 responses
 * @param {Response} response - Fetch API response object
 * @returns {Promise<Object>} - Parsed JSON data
 */
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }
  return await response.json();
}

/**
 * 4. Current Weather Display
 * Renders the current weather data to the DOM
 * @param {Object} data - Current weather data from API
 */
function displayWeather(data) {
  const { main, weather, wind, name, sys } = data;
  const iconCode = weather[0].icon;
  const tempCelsius = Math.round(main.temp - 273.15); // Convert Kelvin to Celsius

  // Build weather display HTML
  weatherIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${weather[0].description}">`;
  tempDiv.innerHTML = `${tempCelsius}°C`;
  weatherInfoDiv.innerHTML = `
    <h2>${name}, ${sys.country}</h2>
    <p>${weather[0].description}</p>
  `;
  extraInfoDiv.innerHTML = `
    <p>Humidity: ${main.humidity}%</p>
    <p>Wind: ${wind.speed} m/s</p>
    <p>Feels like: ${Math.round(main.feels_like - 273.15)}°C</p>
  `;
}

/**
 * 5. Hourly Forecast Display
 * Renders the 5-hour forecast to the DOM
 * @param {Object} data - Forecast data from API
 */
function displayHourlyForecast(data) {
  hourlyForecastDiv.innerHTML = "";
  data.list.slice(0, 5).forEach((item) => {
    const time = new Date(item.dt * 1000).toLocaleTimeString([], {
      hour: "2-digit",
    });
    const temp = Math.round(item.main.temp - 273.15);
    hourlyForecastDiv.innerHTML += `
      <div class="hourly-item">
        <span>${time}</span>
        <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="${item.weather[0].description}">
        <span>${temp}°C</span>
      </div>
    `;
  });
}

/**
 * 6. Error Handler
 * Processes errors and displays user-friendly messages
 * @param {Error} error - The caught error object
 * @param {string} city - The city that was being searched
 */
function handleWeatherError(error, city) {
  let friendlyMessage = "Failed to get weather data";

  // Map specific error types to friendly messages
  if (error.message.includes("404")) {
    friendlyMessage = `"${city}" not found. Try another location.`;
  } else if (error.message.includes("network")) {
    friendlyMessage = "Internet connection required";
  } else if (error.message.includes("Failed to fetch")) {
    friendlyMessage = "Network error. Check your connection.";
  }

  showError(friendlyMessage);
  console.error("Weather Error:", error.message);
}

// ====================== UTILITY FUNCTIONS ======================

/**
 * 7. Loading State Manager
 * Shows or hides the loading indicator
 * @param {boolean} state - Whether to show loading indicator
 */
function showLoading(state) {
  loadingIndicator.style.display = state ? "block" : "none";
}

/**
 * 8. UI Cleaner
 * Clears all weather data from the display
 */
function clearWeatherData() {
  tempDiv.innerHTML = "";
  weatherInfoDiv.innerHTML = "";
  extraInfoDiv.innerHTML = "";
  hourlyForecastDiv.innerHTML = "";
  weatherIcon.innerHTML = "";
  errorMessage.style.display = "none";
}

/**
 * 9. Error Display
 * Shows an error message to the user for 5 seconds
 * @param {string} message - The error message to display
 */
function showError(message) {
  errorMessage.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    <span>${message}</span>
  `;
  errorMessage.style.display = "block";
  setTimeout(() => (errorMessage.style.display = "none"), 5000);
}
