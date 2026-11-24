const API_URL = "https://api.spaceflightnewsapi.net/v4/articles/?limit=20";
const STORAGE_KEY = "spaceflight_news_prefs_v1";

// In-memory application state
let allArticles = [];
let savedIds = [];
let selectedSource = "all";
let searchTerm = "";
let showOnlySaved = false;

// DOM references
const searchInput = document.querySelector("#search-input");
const sourceSelect = document.querySelector("#source-select");
const bookmarksToggleBtn = document.querySelector("#bookmarks-toggle-btn");
const savedCountSpan = document.querySelector("#saved-count");
const clearStorageBtn = document.querySelector("#clear-storage-btn");
const articlesGrid = document.querySelector("#articles-grid");
const loadingState = document.querySelector("#loading-state");
const errorState = document.querySelector("#error-state");
const errorMessage = document.querySelector("#error-message");
const retryBtn = document.querySelector("#retry-btn");
const emptyState = document.querySelector("#empty-state");
const articleModal = document.querySelector("#article-modal");
const modalBody = document.querySelector("#modal-body");
const closeModalBtn = document.querySelector("#close-modal-btn");

// 1. localStorage Persistence
function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.savedIds)) {
      savedIds = parsed.savedIds;
    }
    if (typeof parsed.selectedSource === "string") {
      selectedSource = parsed.selectedSource;
    }
  } catch (err) {
    savedIds = [];
    selectedSource = "all";
  }
}

function savePreferences() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ savedIds, selectedSource })
  );
}

function clearPreferences() {
  localStorage.removeItem(STORAGE_KEY);
  savedIds = [];
  selectedSource = "all";
  searchTerm = "";
  showOnlySaved = false;

  searchInput.value = "";
  sourceSelect.value = "all";
  bookmarksToggleBtn.setAttribute("aria-pressed", "false");
  updateSavedBadge();
  applyFiltersAndRender();
}

// 2. API Fetching & States
async function fetchArticles() {
  setLoading(true);
  hideError();

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    allArticles = Array.isArray(data.results) ? data.results : [];

    populateSources(allArticles);
    updateSavedBadge();
    applyFiltersAndRender();
  } catch (error) {
    showError(`Could not load spaceflight articles: ${error.message}`);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  loadingState.classList.toggle("hidden", !isLoading);
  if (isLoading) {
    articlesGrid.innerHTML = "";
    emptyState.classList.add("hidden");
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorState.classList.remove("hidden");
  articlesGrid.innerHTML = "";
  emptyState.classList.add("hidden");
}

function hideError() {
  errorState.classList.add("hidden");
}

// 3. Filtering & Rendering
function populateSources(articles) {
  const uniqueSources = [...new Set(articles.map((item) => item.news_site))];

  sourceSelect.innerHTML = '<option value="all">All Sources</option>';
  uniqueSources.forEach((source) => {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    sourceSelect.appendChild(option);
  });

  if (uniqueSources.includes(selectedSource)) {
    sourceSelect.value = selectedSource;
  } else {
    selectedSource = "all";
    sourceSelect.value = "all";
  }
}

function getFilteredArticles() {
  const q = searchTerm.trim().toLowerCase();

  return allArticles.filter((article) => {
    const matchesSource =
      selectedSource === "all" || article.news_site === selectedSource;
    const matchesSearch =
      article.title.toLowerCase().includes(q) ||
      article.summary.toLowerCase().includes(q);
    const matchesSaved = !showOnlySaved || savedIds.includes(article.id);

    return matchesSource && matchesSearch && matchesSaved;
  });
}

function applyFiltersAndRender() {
  renderArticles(getFilteredArticles());
}

function renderArticles(articles) {
  articlesGrid.innerHTML = "";

  if (articles.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  articles.forEach((article) => {
    const isSaved = savedIds.includes(article.id);
    articlesGrid.appendChild(createArticleCard(article, isSaved));
  });
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function createArticleCard(article, isSaved) {
  const card = document.createElement("article");
  card.className = "card";

  const img = document.createElement("img");
  img.className = "card-img";
  img.src = article.image_url || "";
  img.alt = article.title;

  const source = document.createElement("span");
  source.className = "card-source";
  source.textContent = article.news_site;

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = article.title;

  const date = document.createElement("p");
  date.className = "card-date";
  date.textContent = `Published: ${formatDate(article.published_at)}`;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "btn btn-primary";
  detailsBtn.textContent = "Details";
  detailsBtn.dataset.id = article.id;
  detailsBtn.dataset.action = "details";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-secondary";
  saveBtn.textContent = isSaved ? "Saved ★" : "Save ☆";
  saveBtn.setAttribute("aria-pressed", String(isSaved));
  saveBtn.dataset.id = article.id;
  saveBtn.dataset.action = "save";

  actions.append(detailsBtn, saveBtn);
  card.append(img, source, title, date, actions);
  return card;
}

// 4. Interactions & Modal
function toggleBookmark(articleId) {
  if (savedIds.includes(articleId)) {
    savedIds = savedIds.filter((id) => id !== articleId);
  } else {
    savedIds.push(articleId);
  }
  savePreferences();
  updateSavedBadge();
  applyFiltersAndRender();
}

function updateSavedBadge() {
  savedCountSpan.textContent = savedIds.length;
}

function openArticleModal(articleId) {
  const article = allArticles.find((item) => item.id === articleId);
  if (!article) return;

  modalBody.innerHTML = "";

  const img = document.createElement("img");
  img.className = "modal-img";
  img.src = article.image_url || "";
  img.alt = article.title;

  const title = document.createElement("h2");
  title.className = "modal-title";
  title.textContent = article.title;

  const meta = document.createElement("p");
  meta.className = "modal-meta";
  meta.textContent = `${article.news_site} • ${formatDate(article.published_at)}`;

  const summary = document.createElement("p");
  summary.className = "modal-summary";
  summary.textContent = article.summary;

  const link = document.createElement("a");
  link.className = "btn btn-primary";
  link.href = article.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Read Full Article";

  modalBody.append(img, title, meta, summary, link);
  articleModal.showModal();
}

// 5. Event Listeners
searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value;
  applyFiltersAndRender();
});

sourceSelect.addEventListener("change", (event) => {
  selectedSource = event.target.value;
  savePreferences();
  applyFiltersAndRender();
});

bookmarksToggleBtn.addEventListener("click", () => {
  showOnlySaved = !showOnlySaved;
  bookmarksToggleBtn.setAttribute("aria-pressed", String(showOnlySaved));
  applyFiltersAndRender();
});

clearStorageBtn.addEventListener("click", clearPreferences);
retryBtn.addEventListener("click", fetchArticles);

articlesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const articleId = Number(button.dataset.id);
  if (button.dataset.action === "details") {
    openArticleModal(articleId);
  } else if (button.dataset.action === "save") {
    toggleBookmark(articleId);
  }
});

closeModalBtn.addEventListener("click", () => {
  articleModal.close();
});

articleModal.addEventListener("click", (event) => {
  if (event.target === articleModal) {
    articleModal.close();
  }
});

// Initialize Application
loadPreferences();
fetchArticles();