const DATA_URL = "data/modules.json";
const STORAGE_KEY = "tt-leerstof-progress-v1";

const state = {
  modules: [],
  filteredModules: [],
  activeModuleId: null,
  activeTab: "summary",
  flashcard: {
    index: 0,
    flipped: false,
  },
  quiz: {
    questions: [],
    index: 0,
    score: 0,
    locked: false,
    running: false,
  },
  sprint: {
    questions: [],
    index: 0,
    score: 0,
    locked: false,
    running: false,
  },
  progress: loadProgress(),
};

const els = {
  globalStats: document.getElementById("global-stats"),
  searchInput: document.getElementById("search-input"),
  moduleList: document.getElementById("module-list"),
  moduleHeader: document.getElementById("module-header"),
  tabRow: document.getElementById("tab-row"),
  summaryList: document.getElementById("summary-list"),
  keywordCloud: document.getElementById("keyword-cloud"),
  resourceLinkRow: document.getElementById("resource-link-row"),
  flashcard: document.getElementById("flashcard"),
  prevCard: document.getElementById("prev-card"),
  nextCard: document.getElementById("next-card"),
  flipCard: document.getElementById("flip-card"),
  markKnown: document.getElementById("mark-known"),
  flashcardProgress: document.getElementById("flashcard-progress"),
  startQuiz: document.getElementById("start-quiz"),
  quizStatus: document.getElementById("quiz-status"),
  quizCard: document.getElementById("quiz-card"),
  quizQuestion: document.getElementById("quiz-question"),
  quizPrompt: document.getElementById("quiz-prompt"),
  quizOptions: document.getElementById("quiz-options"),
  quizFeedback: document.getElementById("quiz-feedback"),
  quizNext: document.getElementById("quiz-next"),
  startSprint: document.getElementById("start-sprint"),
  sprintCard: document.getElementById("sprint-card"),
  sprintProgress: document.getElementById("sprint-progress"),
  sprintPrompt: document.getElementById("sprint-prompt"),
  sprintOptions: document.getElementById("sprint-options"),
  sprintFeedback: document.getElementById("sprint-feedback"),
  sprintNext: document.getElementById("sprint-next"),
  weakTerms: document.getElementById("weak-terms"),
};

init().catch((error) => {
  console.error(error);
  els.moduleHeader.innerHTML = `<h2>Fout bij laden</h2><p>De modules konden niet worden geladen.</p>`;
});

async function init() {
  bindUI();
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Kon ${DATA_URL} niet laden`);
  }

  const payload = await response.json();
  state.modules = (payload.modules || []).sort((a, b) => a.title.localeCompare(b.title));
  state.filteredModules = [...state.modules];
  state.activeModuleId = state.modules[0]?.id || null;

  renderGlobalStats();
  renderModuleList();
  renderActiveModule();
  renderWeakTerms();
}

function bindUI() {
  els.searchInput.addEventListener("input", onSearch);

  els.tabRow.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab-btn");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
  });

  els.prevCard.addEventListener("click", () => moveFlashcard(-1));
  els.nextCard.addEventListener("click", () => moveFlashcard(1));
  els.flipCard.addEventListener("click", () => flipFlashcard());
  els.flashcard.addEventListener("click", () => flipFlashcard());
  els.flashcard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      flipFlashcard();
    }
  });
  els.markKnown.addEventListener("click", toggleKnownForCurrentCard);

  els.startQuiz.addEventListener("click", startModuleQuiz);
  els.quizNext.addEventListener("click", nextQuizQuestion);

  els.startSprint.addEventListener("click", startSprintQuiz);
  els.sprintNext.addEventListener("click", nextSprintQuestion);
}

function onSearch(event) {
  const query = event.target.value.trim().toLowerCase();
  state.filteredModules = state.modules.filter((module) => {
    if (!query) return true;
    const text = `${module.title} ${(module.keywords || []).join(" ")}`.toLowerCase();
    return text.includes(query);
  });

  if (!state.filteredModules.some((module) => module.id === state.activeModuleId)) {
    state.activeModuleId = state.filteredModules[0]?.id || null;
  }

  renderModuleList();
  renderActiveModule();
}

function setActiveTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });

  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.remove("is-active");
  });

  const activeView = document.getElementById(`tab-${tab}`);
  if (activeView) {
    activeView.classList.add("is-active");
  }
}

function getActiveModule() {
  return state.modules.find((module) => module.id === state.activeModuleId) || null;
}

function renderGlobalStats() {
  const totalPages = state.modules.reduce((sum, module) => sum + (module.pageCount || 0), 0);
  const totalQuestions = state.modules.reduce((sum, module) => sum + (module.quiz?.length || 0), 0);
  const avgProgress = averageModuleProgress();

  const pills = [
    `${state.modules.length} bronnen`,
    `${totalPages} pagina's`,
    `${totalQuestions} toetsvragen`,
    `${avgProgress}% totaal voortgang`,
  ];

  els.globalStats.innerHTML = pills.map((pill) => `<span class="stat-pill">${pill}</span>`).join("");
}

function renderModuleList() {
  if (!state.filteredModules.length) {
    els.moduleList.innerHTML = `<p class="muted">Geen modules gevonden.</p>`;
    return;
  }

  els.moduleList.innerHTML = state.filteredModules
    .map((module) => {
      const progressPct = getModuleProgressPercent(module);
      const activeClass = module.id === state.activeModuleId ? "is-active" : "";
      return `
        <article class="module-item ${activeClass}" data-module-id="${module.id}">
          <p class="module-title">${escapeHtml(module.title)}</p>
          <div class="module-meta">
            <span class="chip">${module.pageCount} p</span>
            <span class="chip">${module.quiz.length} vragen</span>
            <span class="chip chip-progress">${progressPct}%</span>
          </div>
        </article>
      `;
    })
    .join("");

  els.moduleList.querySelectorAll(".module-item").forEach((item) => {
    item.addEventListener("click", () => {
      const { moduleId } = item.dataset;
      state.activeModuleId = moduleId;
      state.flashcard.index = 0;
      state.flashcard.flipped = false;
      stopModuleQuiz();
      renderModuleList();
      renderActiveModule();
    });
  });
}

function renderActiveModule() {
  const module = getActiveModule();

  if (!module) {
    els.moduleHeader.innerHTML = `<h2>Geen module geselecteerd</h2>`;
    els.summaryList.innerHTML = "";
    els.keywordCloud.innerHTML = "";
    els.resourceLinkRow.innerHTML = "";
    els.flashcard.textContent = "";
    return;
  }

  const progressPct = getModuleProgressPercent(module);
  els.moduleHeader.innerHTML = `
    <h2>${escapeHtml(module.title)}</h2>
    <p>${module.pageCount} pagina's · ${module.quiz.length} quizvragen · ${progressPct}% voortgang</p>
  `;

  renderSummary(module);
  renderFlashcard(module);
  resetQuizUI();
}

function renderSummary(module) {
  els.summaryList.innerHTML = (module.summary || [])
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");

  els.keywordCloud.innerHTML = (module.keywords || [])
    .map((term) => `<span class="keyword">${escapeHtml(term)}</span>`)
    .join("");

  const href = encodeURI(module.filePath);
  els.resourceLinkRow.innerHTML = `
    <a class="resource-link" href="${href}" target="_blank" rel="noopener">Open PDF</a>
    <a class="resource-link" href="${href}" download>Download PDF</a>
  `;
}

function moveFlashcard(step) {
  const module = getActiveModule();
  if (!module || !module.flashcards.length) return;

  const count = module.flashcards.length;
  state.flashcard.index = (state.flashcard.index + step + count) % count;
  state.flashcard.flipped = false;
  renderFlashcard(module);
}

function flipFlashcard() {
  const module = getActiveModule();
  if (!module || !module.flashcards.length) return;

  state.flashcard.flipped = !state.flashcard.flipped;
  renderFlashcard(module);
}

function renderFlashcard(module) {
  const cards = module.flashcards || [];
  if (!cards.length) {
    els.flashcard.textContent = "Geen flashcards beschikbaar.";
    els.flashcardProgress.textContent = "";
    return;
  }

  if (state.flashcard.index >= cards.length) {
    state.flashcard.index = 0;
  }

  const card = cards[state.flashcard.index];
  const isBack = state.flashcard.flipped;

  els.flashcard.classList.toggle("back", isBack);
  els.flashcard.innerHTML = isBack
    ? `<strong>Uitleg</strong><br>${escapeHtml(card.explanation)}`
    : `<strong>Begrip</strong><br>${escapeHtml(card.term)}`;

  const knownSet = getKnownCards(module.id);
  const known = knownSet.has(card.id);
  els.markKnown.textContent = known ? "Beheerst ✓" : "Markeer als beheerst";

  els.flashcardProgress.textContent = `Kaart ${state.flashcard.index + 1} van ${cards.length} · ${knownSet.size}/${cards.length} beheerst`;
}

function toggleKnownForCurrentCard() {
  const module = getActiveModule();
  if (!module || !module.flashcards.length) return;

  const card = module.flashcards[state.flashcard.index];
  const knownSet = getKnownCards(module.id);

  if (knownSet.has(card.id)) {
    knownSet.delete(card.id);
  } else {
    knownSet.add(card.id);
  }

  const moduleProgress = getOrCreateModuleProgress(module.id);
  moduleProgress.knownCards = Array.from(knownSet);

  saveProgress();
  renderFlashcard(module);
  renderModuleList();
  renderGlobalStats();
}

function startModuleQuiz() {
  const module = getActiveModule();
  if (!module) return;

  const questions = shuffle([...module.quiz]).slice(0, Math.min(8, module.quiz.length));
  state.quiz.questions = questions;
  state.quiz.index = 0;
  state.quiz.score = 0;
  state.quiz.locked = false;
  state.quiz.running = true;

  els.quizCard.classList.remove("hidden");
  els.quizStatus.textContent = "";
  renderQuizQuestion();
}

function stopModuleQuiz() {
  state.quiz.running = false;
  state.quiz.questions = [];
  state.quiz.index = 0;
  state.quiz.score = 0;
  state.quiz.locked = false;
}

function resetQuizUI() {
  els.quizCard.classList.add("hidden");
  els.quizStatus.textContent = "Start een quiz voor deze module.";
  els.quizFeedback.textContent = "";
  els.quizFeedback.className = "quiz-feedback";
  els.quizNext.classList.add("hidden");
}

function renderQuizQuestion() {
  const question = state.quiz.questions[state.quiz.index];
  if (!question) {
    finishModuleQuiz();
    return;
  }

  state.quiz.locked = false;
  els.quizNext.classList.add("hidden");
  els.quizFeedback.textContent = "";
  els.quizFeedback.className = "quiz-feedback";

  els.quizQuestion.textContent = `Vraag ${state.quiz.index + 1} van ${state.quiz.questions.length}`;
  els.quizPrompt.textContent = question.prompt;

  els.quizOptions.innerHTML = question.options
    .map((option) => `<button class="option-btn" data-option="${escapeAttr(option)}">${escapeHtml(option)}</button>`)
    .join("");

  els.quizOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => answerQuizQuestion(button.dataset.option));
  });
}

function answerQuizQuestion(option) {
  if (state.quiz.locked) return;
  const question = state.quiz.questions[state.quiz.index];
  if (!question) return;

  state.quiz.locked = true;
  const isCorrect = option === question.answer;

  if (isCorrect) {
    state.quiz.score += 1;
    els.quizFeedback.textContent = "Correct.";
    els.quizFeedback.classList.add("good");
  } else {
    els.quizFeedback.textContent = `Onjuist. Correct antwoord: ${question.answer}`;
    els.quizFeedback.classList.add("bad");
    registerWeakTerm(question.answer);
  }

  els.quizOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;
    const buttonOption = button.dataset.option;
    if (buttonOption === question.answer) {
      button.classList.add("correct");
    } else if (buttonOption === option) {
      button.classList.add("wrong");
    }
  });

  els.quizNext.classList.remove("hidden");
}

function nextQuizQuestion() {
  state.quiz.index += 1;
  renderQuizQuestion();
}

function finishModuleQuiz() {
  const module = getActiveModule();
  const total = state.quiz.questions.length || 1;
  const pct = Math.round((state.quiz.score / total) * 100);

  if (module) {
    const progress = getOrCreateModuleProgress(module.id);
    progress.quizAttempts = (progress.quizAttempts || 0) + 1;
    progress.quizBest = Math.max(progress.quizBest || 0, pct);
    progress.quizLast = pct;
    saveProgress();
  }

  els.quizCard.classList.add("hidden");
  els.quizStatus.textContent = `Quiz voltooid: ${state.quiz.score}/${total} (${pct}%).`;

  renderModuleList();
  renderGlobalStats();
  renderWeakTerms();
  stopModuleQuiz();
}

function startSprintQuiz() {
  const pool = [];
  for (const module of state.modules) {
    for (const question of module.quiz || []) {
      pool.push({ ...question, moduleTitle: module.title });
    }
  }

  state.sprint.questions = shuffle(pool).slice(0, Math.min(20, pool.length));
  state.sprint.index = 0;
  state.sprint.score = 0;
  state.sprint.locked = false;
  state.sprint.running = true;

  els.sprintCard.classList.remove("hidden");
  renderSprintQuestion();
}

function renderSprintQuestion() {
  const question = state.sprint.questions[state.sprint.index];
  if (!question) {
    finishSprintQuiz();
    return;
  }

  state.sprint.locked = false;
  els.sprintNext.classList.add("hidden");
  els.sprintFeedback.textContent = "";
  els.sprintFeedback.className = "quiz-feedback";

  els.sprintProgress.textContent = `Vraag ${state.sprint.index + 1} van ${state.sprint.questions.length} · Bron: ${question.moduleTitle}`;
  els.sprintPrompt.textContent = question.prompt;

  els.sprintOptions.innerHTML = question.options
    .map((option) => `<button class="option-btn" data-option="${escapeAttr(option)}">${escapeHtml(option)}</button>`)
    .join("");

  els.sprintOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => answerSprintQuestion(button.dataset.option));
  });
}

function answerSprintQuestion(option) {
  if (state.sprint.locked) return;
  const question = state.sprint.questions[state.sprint.index];
  if (!question) return;

  state.sprint.locked = true;
  const isCorrect = option === question.answer;

  if (isCorrect) {
    state.sprint.score += 1;
    els.sprintFeedback.textContent = "Correct.";
    els.sprintFeedback.classList.add("good");
  } else {
    els.sprintFeedback.textContent = `Onjuist. Correct antwoord: ${question.answer}`;
    els.sprintFeedback.classList.add("bad");
    registerWeakTerm(question.answer);
  }

  els.sprintOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;
    const buttonOption = button.dataset.option;
    if (buttonOption === question.answer) {
      button.classList.add("correct");
    } else if (buttonOption === option) {
      button.classList.add("wrong");
    }
  });

  els.sprintNext.classList.remove("hidden");
}

function nextSprintQuestion() {
  state.sprint.index += 1;
  renderSprintQuestion();
}

function finishSprintQuiz() {
  const total = state.sprint.questions.length || 1;
  const pct = Math.round((state.sprint.score / total) * 100);

  els.sprintProgress.textContent = "Sprinttoets voltooid";
  els.sprintPrompt.textContent = `Eindscore: ${state.sprint.score}/${total} (${pct}%).`;
  els.sprintOptions.innerHTML = "";
  els.sprintFeedback.textContent = "Bekijk hieronder je zwakke begrippen en herhaal de sprint.";
  els.sprintFeedback.className = `quiz-feedback ${pct >= 70 ? "good" : "bad"}`;
  els.sprintNext.classList.add("hidden");

  state.sprint.running = false;
  renderWeakTerms();
}

function getOrCreateModuleProgress(moduleId) {
  if (!state.progress.moduleProgress[moduleId]) {
    state.progress.moduleProgress[moduleId] = {
      knownCards: [],
      quizBest: 0,
      quizLast: 0,
      quizAttempts: 0,
    };
  }
  return state.progress.moduleProgress[moduleId];
}

function getKnownCards(moduleId) {
  const progress = getOrCreateModuleProgress(moduleId);
  return new Set(progress.knownCards || []);
}

function getModuleProgressPercent(module) {
  const progress = getOrCreateModuleProgress(module.id);
  const cardWeight = 0.6;
  const quizWeight = 0.4;

  const known = (progress.knownCards || []).length;
  const totalCards = module.flashcards?.length || 1;
  const cardPct = Math.round((known / totalCards) * 100);

  const quizPct = progress.quizBest || 0;

  return Math.round(cardPct * cardWeight + quizPct * quizWeight);
}

function averageModuleProgress() {
  if (!state.modules.length) return 0;
  const sum = state.modules.reduce((acc, module) => acc + getModuleProgressPercent(module), 0);
  return Math.round(sum / state.modules.length);
}

function registerWeakTerm(term) {
  if (!term) return;
  const key = String(term).toLowerCase();
  state.progress.weakTerms[key] = (state.progress.weakTerms[key] || 0) + 1;
  saveProgress();
  renderWeakTerms();
}

function renderWeakTerms() {
  const entries = Object.entries(state.progress.weakTerms || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (!entries.length) {
    els.weakTerms.innerHTML = `<p class="muted">Nog geen zwakke begrippen geregistreerd. Start een quiz of sprinttoets.</p>`;
    return;
  }

  els.weakTerms.innerHTML = entries
    .map(([term, count]) => `<span class="weak-chip">${escapeHtml(term)} (${count}x)</span>`)
    .join("");
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { moduleProgress: {}, weakTerms: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      moduleProgress: parsed.moduleProgress || {},
      weakTerms: parsed.weakTerms || {},
    };
  } catch (error) {
    console.warn("Kon voortgang niet laden", error);
    return { moduleProgress: {}, weakTerms: {} };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
