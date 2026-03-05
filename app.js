const DATA_URL = "data/course-data.json";
const STORAGE_KEY = "tt-leerstof-progress-v2";

const state = {
  blocks: [],
  questions: [],
  cases: [],
  supportFiles: [],
  articleGuide: null,
  activeBlockId: null,
  filteredBlocks: [],
  activeTab: "overview",
  flashcard: { index: 0, flipped: false },
  blockQuiz: { questions: [], index: 0, score: 0, locked: false, running: false },
  exam: { questions: [], index: 0, score: 0, locked: false, running: false },
  caseIndex: 0,
  progress: loadProgress(),
};

const els = {
  globalStats: document.getElementById("global-stats"),
  searchInput: document.getElementById("search-input"),
  blockList: document.getElementById("block-list"),
  supportList: document.getElementById("support-list"),
  blockHeader: document.getElementById("block-header"),
  tabRow: document.getElementById("tab-row"),
  summaryList: document.getElementById("summary-list"),
  goalsList: document.getElementById("goals-list"),
  pitfallsList: document.getElementById("pitfalls-list"),
  resourceLinkRow: document.getElementById("resource-link-row"),
  flashcard: document.getElementById("flashcard"),
  prevCard: document.getElementById("prev-card"),
  nextCard: document.getElementById("next-card"),
  flipCard: document.getElementById("flip-card"),
  markKnown: document.getElementById("mark-known"),
  flashcardProgress: document.getElementById("flashcard-progress"),
  startBlockQuiz: document.getElementById("start-block-quiz"),
  blockQuizStatus: document.getElementById("block-quiz-status"),
  blockQuizCard: document.getElementById("block-quiz-card"),
  blockQuizQuestion: document.getElementById("block-quiz-question"),
  blockQuizPrompt: document.getElementById("block-quiz-prompt"),
  blockQuizOptions: document.getElementById("block-quiz-options"),
  blockQuizFeedback: document.getElementById("block-quiz-feedback"),
  blockQuizNext: document.getElementById("block-quiz-next"),
  startExam: document.getElementById("start-exam"),
  examCard: document.getElementById("exam-card"),
  examProgress: document.getElementById("exam-progress"),
  examPrompt: document.getElementById("exam-prompt"),
  examOptions: document.getElementById("exam-options"),
  examFeedback: document.getElementById("exam-feedback"),
  examNext: document.getElementById("exam-next"),
  weakTags: document.getElementById("weak-tags"),
  caseTitle: document.getElementById("case-title"),
  caseScenario: document.getElementById("case-scenario"),
  caseTasks: document.getElementById("case-tasks"),
  caseModel: document.getElementById("case-model"),
  nextCase: document.getElementById("next-case"),
  toggleModel: document.getElementById("toggle-model"),
  articleSteps: document.getElementById("article-steps"),
  quickCheckList: document.getElementById("quick-check-list"),
};

init().catch((error) => {
  console.error(error);
  els.blockHeader.innerHTML = `<h2>Fout bij laden</h2><p>De leerdata kon niet geladen worden.</p>`;
});

async function init() {
  bindUI();

  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Kon ${DATA_URL} niet laden`);
  }

  const data = await response.json();
  state.blocks = data.blocks || [];
  state.questions = data.questions || [];
  state.cases = data.cases || [];
  state.articleGuide = data.articleGuide || null;
  state.supportFiles = data.supportSourceFiles || [];

  state.filteredBlocks = [...state.blocks];
  state.activeBlockId = state.blocks[0]?.id || null;

  renderGlobalStats();
  renderBlockList();
  renderSupportFiles();
  renderArticleGuide();
  renderActiveBlock();
  renderCase();
  renderWeakTags();
}

function bindUI() {
  els.searchInput.addEventListener("input", onSearch);

  els.tabRow.addEventListener("click", (event) => {
    const button = event.target.closest(".tab-btn");
    if (!button) return;
    setActiveTab(button.dataset.tab);
  });

  els.prevCard.addEventListener("click", () => moveFlashcard(-1));
  els.nextCard.addEventListener("click", () => moveFlashcard(1));
  els.flipCard.addEventListener("click", flipFlashcard);
  els.flashcard.addEventListener("click", flipFlashcard);
  els.flashcard.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      flipFlashcard();
    }
  });
  els.markKnown.addEventListener("click", toggleKnownConcept);

  els.startBlockQuiz.addEventListener("click", startBlockQuiz);
  els.blockQuizNext.addEventListener("click", nextBlockQuizQuestion);

  els.startExam.addEventListener("click", startExam);
  els.examNext.addEventListener("click", nextExamQuestion);

  els.nextCase.addEventListener("click", nextCase);
  els.toggleModel.addEventListener("click", () => {
    const isHidden = els.caseModel.classList.contains("hidden");
    els.caseModel.classList.toggle("hidden", !isHidden);
    els.toggleModel.textContent = isHidden ? "Verberg modelpunten" : "Toon modelpunten";
  });
}

function onSearch(event) {
  const query = event.target.value.trim().toLowerCase();

  state.filteredBlocks = state.blocks.filter((block) => {
    if (!query) return true;

    const conceptText = (block.concepts || []).map((item) => item.term).join(" ");
    const questionTagText = state.questions
      .filter((q) => q.blockId === block.id)
      .flatMap((q) => q.tags || [])
      .join(" ");

    const text = `${block.title} ${block.focus} ${conceptText} ${questionTagText}`.toLowerCase();
    return text.includes(query);
  });

  if (!state.filteredBlocks.some((block) => block.id === state.activeBlockId)) {
    state.activeBlockId = state.filteredBlocks[0]?.id || null;
  }

  renderBlockList();
  renderActiveBlock();
}

function setActiveTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });

  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.remove("is-active");
  });

  const target = document.getElementById(`tab-${tab}`);
  if (target) {
    target.classList.add("is-active");
  }
}

function getActiveBlock() {
  return state.blocks.find((block) => block.id === state.activeBlockId) || null;
}

function renderGlobalStats() {
  const totalQuestions = state.questions.length;
  const avgProgress = averageBlockProgress();
  const checklistDone = articleChecklistDoneCount();
  const checklistTotal = state.articleGuide?.steps?.length || 0;

  const stats = [
    `${state.blocks.length} kernblokken`,
    `${totalQuestions} toetsvragen`,
    `${state.cases.length} casussen`,
    `${avgProgress}% totale voortgang`,
    `${checklistDone}/${checklistTotal} artikelcheck-stappen afgevinkt`,
  ];

  els.globalStats.innerHTML = stats.map((item) => `<span class="stat-pill">${escapeHtml(item)}</span>`).join("");
}

function renderBlockList() {
  if (!state.filteredBlocks.length) {
    els.blockList.innerHTML = `<p class="muted">Geen blokken gevonden.</p>`;
    return;
  }

  els.blockList.innerHTML = state.filteredBlocks
    .map((block) => {
      const activeClass = block.id === state.activeBlockId ? "is-active" : "";
      const score = getBlockProgressPercent(block);
      const qCount = state.questions.filter((question) => question.blockId === block.id).length;

      return `
        <article class="module-item ${activeClass}" data-block-id="${block.id}">
          <p class="module-title">${escapeHtml(block.title)}</p>
          <div class="module-meta">
            <span class="chip">${qCount} vragen</span>
            <span class="chip">${(block.concepts || []).length} begrippen</span>
            <span class="chip chip-progress">${score}%</span>
          </div>
        </article>
      `;
    })
    .join("");

  els.blockList.querySelectorAll(".module-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.activeBlockId = item.dataset.blockId;
      state.flashcard.index = 0;
      state.flashcard.flipped = false;
      resetBlockQuizUI();
      renderBlockList();
      renderActiveBlock();
    });
  });
}

function renderSupportFiles() {
  els.supportList.innerHTML = state.supportFiles
    .map((filename) => {
      const href = encodeURI(`materials/${filename}`);
      return `<a class="resource-link support-link" href="${href}" target="_blank" rel="noopener">${escapeHtml(filename)}</a>`;
    })
    .join("");
}

function renderActiveBlock() {
  const block = getActiveBlock();
  if (!block) {
    els.blockHeader.innerHTML = `<h2>Geen blok geselecteerd</h2>`;
    return;
  }

  const qCount = state.questions.filter((question) => question.blockId === block.id).length;
  const score = getBlockProgressPercent(block);

  els.blockHeader.innerHTML = `
    <h2>${escapeHtml(block.title)}</h2>
    <p>${escapeHtml(block.focus)} · ${qCount} vragen · ${score}% voortgang</p>
  `;

  els.summaryList.innerHTML = (block.summary || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  els.goalsList.innerHTML = (block.learningGoals || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  els.pitfallsList.innerHTML = (block.pitfalls || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  const href = encodeURI(`materials/${block.sourceFile}`);
  els.resourceLinkRow.innerHTML = `
    <a class="resource-link" href="${href}" target="_blank" rel="noopener">Open kernbron</a>
    <a class="resource-link" href="${href}" download>Download kernbron</a>
  `;

  renderFlashcard();
}

function moveFlashcard(step) {
  const block = getActiveBlock();
  if (!block || !(block.concepts || []).length) return;

  const count = block.concepts.length;
  state.flashcard.index = (state.flashcard.index + step + count) % count;
  state.flashcard.flipped = false;
  renderFlashcard();
}

function flipFlashcard() {
  const block = getActiveBlock();
  if (!block || !(block.concepts || []).length) return;

  state.flashcard.flipped = !state.flashcard.flipped;
  renderFlashcard();
}

function renderFlashcard() {
  const block = getActiveBlock();
  if (!block || !(block.concepts || []).length) {
    els.flashcard.textContent = "Geen begrippen beschikbaar.";
    els.flashcardProgress.textContent = "";
    return;
  }

  if (state.flashcard.index >= block.concepts.length) {
    state.flashcard.index = 0;
  }

  const concept = block.concepts[state.flashcard.index];
  const isBack = state.flashcard.flipped;

  els.flashcard.classList.toggle("back", isBack);
  if (isBack) {
    els.flashcard.innerHTML = `<strong>Uitleg</strong><br>${escapeHtml(concept.definition)}<br><br><em>Tentamentip:</em> ${escapeHtml(concept.examTip)}`;
  } else {
    els.flashcard.innerHTML = `<strong>Begrip</strong><br>${escapeHtml(concept.term)}`;
  }

  const known = getKnownConceptSet(block.id);
  const isKnown = known.has(concept.term);
  els.markKnown.textContent = isKnown ? "Beheerst ✓" : "Markeer als beheerst";
  els.flashcardProgress.textContent = `Begrip ${state.flashcard.index + 1} van ${block.concepts.length} · ${known.size}/${block.concepts.length} beheerst`;
}

function toggleKnownConcept() {
  const block = getActiveBlock();
  if (!block || !(block.concepts || []).length) return;

  const concept = block.concepts[state.flashcard.index];
  const known = getKnownConceptSet(block.id);

  if (known.has(concept.term)) {
    known.delete(concept.term);
  } else {
    known.add(concept.term);
  }

  const progress = getOrCreateBlockProgress(block.id);
  progress.knownConcepts = Array.from(known);
  saveProgress();

  renderFlashcard();
  renderBlockList();
  renderGlobalStats();
}

function startBlockQuiz() {
  const block = getActiveBlock();
  if (!block) return;

  const questions = shuffle(state.questions.filter((question) => question.blockId === block.id)).slice(0, 10);
  if (!questions.length) {
    els.blockQuizStatus.textContent = "Voor dit blok zijn geen vragen beschikbaar.";
    return;
  }

  state.blockQuiz = {
    questions,
    index: 0,
    score: 0,
    locked: false,
    running: true,
  };

  els.blockQuizCard.classList.remove("hidden");
  els.blockQuizStatus.textContent = "";
  renderBlockQuizQuestion();
}

function resetBlockQuizUI() {
  state.blockQuiz = { questions: [], index: 0, score: 0, locked: false, running: false };
  els.blockQuizCard.classList.add("hidden");
  els.blockQuizStatus.textContent = "Start een quiz met vragen die inhoudelijk bij dit blok horen.";
}

function renderBlockQuizQuestion() {
  const question = state.blockQuiz.questions[state.blockQuiz.index];
  if (!question) {
    finishBlockQuiz();
    return;
  }

  state.blockQuiz.locked = false;
  els.blockQuizFeedback.textContent = "";
  els.blockQuizFeedback.className = "quiz-feedback";
  els.blockQuizNext.classList.add("hidden");

  els.blockQuizQuestion.textContent = `Vraag ${state.blockQuiz.index + 1} van ${state.blockQuiz.questions.length}`;
  els.blockQuizPrompt.textContent = question.prompt;

  els.blockQuizOptions.innerHTML = question.options
    .map((option) => `<button class="option-btn" data-option="${escapeAttr(option)}">${escapeHtml(option)}</button>`)
    .join("");

  els.blockQuizOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => answerBlockQuizQuestion(button.dataset.option));
  });
}

function answerBlockQuizQuestion(option) {
  if (state.blockQuiz.locked) return;

  const question = state.blockQuiz.questions[state.blockQuiz.index];
  if (!question) return;

  state.blockQuiz.locked = true;
  const correct = option === question.answer;

  if (correct) {
    state.blockQuiz.score += 1;
    els.blockQuizFeedback.textContent = "Correct.";
    els.blockQuizFeedback.classList.add("good");
  } else {
    els.blockQuizFeedback.textContent = `Onjuist. ${question.explanation}`;
    els.blockQuizFeedback.classList.add("bad");
    registerWeakTags(question.tags || [], question.blockId);
  }

  els.blockQuizOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;
    const value = button.dataset.option;
    if (value === question.answer) {
      button.classList.add("correct");
    } else if (value === option) {
      button.classList.add("wrong");
    }
  });

  els.blockQuizNext.classList.remove("hidden");
}

function nextBlockQuizQuestion() {
  state.blockQuiz.index += 1;
  renderBlockQuizQuestion();
}

function finishBlockQuiz() {
  const block = getActiveBlock();
  const total = state.blockQuiz.questions.length || 1;
  const pct = Math.round((state.blockQuiz.score / total) * 100);

  if (block) {
    const progress = getOrCreateBlockProgress(block.id);
    progress.bestBlockQuiz = Math.max(progress.bestBlockQuiz || 0, pct);
    progress.lastBlockQuiz = pct;
    progress.quizAttempts = (progress.quizAttempts || 0) + 1;
    saveProgress();
  }

  els.blockQuizCard.classList.add("hidden");
  els.blockQuizStatus.textContent = `Blokquiz afgerond: ${state.blockQuiz.score}/${total} (${pct}%).`;

  state.blockQuiz = { questions: [], index: 0, score: 0, locked: false, running: false };
  renderBlockList();
  renderGlobalStats();
  renderWeakTags();
}

function buildExamQuestions() {
  const questionsByBlock = new Map();
  for (const question of state.questions) {
    if (!questionsByBlock.has(question.blockId)) {
      questionsByBlock.set(question.blockId, []);
    }
    questionsByBlock.get(question.blockId).push(question);
  }

  const selected = [];
  for (const block of state.blocks) {
    const pool = shuffle(questionsByBlock.get(block.id) || []);
    selected.push(...pool.slice(0, 4));
  }

  if (selected.length < 20) {
    const ids = new Set(selected.map((item) => item.id));
    const remaining = shuffle(state.questions.filter((item) => !ids.has(item.id)));
    selected.push(...remaining.slice(0, 20 - selected.length));
  }

  return shuffle(selected).slice(0, 20);
}

function startExam() {
  const questions = buildExamQuestions();
  if (!questions.length) return;

  state.exam = {
    questions,
    index: 0,
    score: 0,
    locked: false,
    running: true,
  };

  els.examCard.classList.remove("hidden");
  renderExamQuestion();
}

function renderExamQuestion() {
  const question = state.exam.questions[state.exam.index];
  if (!question) {
    finishExam();
    return;
  }

  state.exam.locked = false;
  els.examFeedback.textContent = "";
  els.examFeedback.className = "quiz-feedback";
  els.examNext.classList.add("hidden");

  const block = state.blocks.find((item) => item.id === question.blockId);
  els.examProgress.textContent = `Vraag ${state.exam.index + 1} van ${state.exam.questions.length} · ${block?.title || question.blockId}`;
  els.examPrompt.textContent = question.prompt;

  els.examOptions.innerHTML = question.options
    .map((option) => `<button class="option-btn" data-option="${escapeAttr(option)}">${escapeHtml(option)}</button>`)
    .join("");

  els.examOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.addEventListener("click", () => answerExamQuestion(button.dataset.option));
  });
}

function answerExamQuestion(option) {
  if (state.exam.locked) return;
  const question = state.exam.questions[state.exam.index];
  if (!question) return;

  state.exam.locked = true;
  const correct = option === question.answer;

  if (correct) {
    state.exam.score += 1;
    els.examFeedback.textContent = "Correct.";
    els.examFeedback.classList.add("good");
  } else {
    els.examFeedback.textContent = `Onjuist. ${question.explanation}`;
    els.examFeedback.classList.add("bad");
    registerWeakTags(question.tags || [], question.blockId);
  }

  els.examOptions.querySelectorAll(".option-btn").forEach((button) => {
    button.disabled = true;
    const value = button.dataset.option;
    if (value === question.answer) {
      button.classList.add("correct");
    } else if (value === option) {
      button.classList.add("wrong");
    }
  });

  els.examNext.classList.remove("hidden");
}

function nextExamQuestion() {
  state.exam.index += 1;
  renderExamQuestion();
}

function finishExam() {
  const total = state.exam.questions.length || 1;
  const pct = Math.round((state.exam.score / total) * 100);

  state.progress.exam = state.progress.exam || { attempts: 0, best: 0, last: 0 };
  state.progress.exam.attempts += 1;
  state.progress.exam.best = Math.max(state.progress.exam.best, pct);
  state.progress.exam.last = pct;
  saveProgress();

  els.examProgress.textContent = "Integratiesprint afgerond";
  els.examPrompt.textContent = `Eindscore: ${state.exam.score}/${total} (${pct}%).`;
  els.examOptions.innerHTML = "";
  els.examFeedback.textContent = "Bekijk je zwakke labels hieronder en herhaal gericht per blok.";
  els.examFeedback.className = `quiz-feedback ${pct >= 70 ? "good" : "bad"}`;
  els.examNext.classList.add("hidden");

  state.exam.running = false;
  renderWeakTags();
  renderGlobalStats();
}

function renderArticleGuide() {
  const guide = state.articleGuide;
  if (!guide) return;

  const steps = guide.steps || [];
  els.articleSteps.innerHTML = steps
    .map((step, index) => {
      const key = `step-${index + 1}`;
      const checked = !!state.progress.articleChecklist[key];

      return `
        <article class="article-step">
          <label class="article-step-head">
            <input type="checkbox" data-check-key="${key}" ${checked ? "checked" : ""} />
            <strong>${escapeHtml(step.step)}</strong>
          </label>
          <p><strong>Definitie:</strong> ${escapeHtml(step.definition)}</p>
          <p><strong>Herkennen:</strong> ${escapeHtml(step.howToRecognize)}</p>
          <p><strong>Voorbeeld:</strong> ${escapeHtml(step.example)}</p>
          <p><strong>Waar in artikel:</strong> ${escapeHtml((step.articleSections || []).join(", "))}</p>
          <div class="keyword-cloud">
            ${(step.keywords || []).map((kw) => `<span class="keyword">${escapeHtml(kw)}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");

  els.quickCheckList.innerHTML = (guide.quickCheck || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  els.articleSteps.querySelectorAll("input[type='checkbox'][data-check-key]").forEach((input) => {
    input.addEventListener("change", () => {
      state.progress.articleChecklist[input.dataset.checkKey] = input.checked;
      saveProgress();
      renderGlobalStats();
    });
  });
}

function articleChecklistDoneCount() {
  return Object.values(state.progress.articleChecklist || {}).filter(Boolean).length;
}

function renderCase() {
  if (!state.cases.length) return;

  if (state.caseIndex >= state.cases.length) {
    state.caseIndex = 0;
  }

  const item = state.cases[state.caseIndex];
  els.caseTitle.textContent = item.title;
  els.caseScenario.textContent = item.scenario;
  els.caseTasks.innerHTML = (item.tasks || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  els.caseModel.innerHTML = (item.modelPoints || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  els.caseModel.classList.add("hidden");
  els.toggleModel.textContent = "Toon modelpunten";
}

function nextCase() {
  if (!state.cases.length) return;

  const next = Math.floor(Math.random() * state.cases.length);
  state.caseIndex = next === state.caseIndex ? (next + 1) % state.cases.length : next;
  renderCase();
}

function getOrCreateBlockProgress(blockId) {
  if (!state.progress.blockProgress[blockId]) {
    state.progress.blockProgress[blockId] = {
      knownConcepts: [],
      bestBlockQuiz: 0,
      lastBlockQuiz: 0,
      quizAttempts: 0,
    };
  }

  return state.progress.blockProgress[blockId];
}

function getKnownConceptSet(blockId) {
  const progress = getOrCreateBlockProgress(blockId);
  return new Set(progress.knownConcepts || []);
}

function getBlockProgressPercent(block) {
  const progress = getOrCreateBlockProgress(block.id);
  const conceptTotal = (block.concepts || []).length || 1;
  const conceptScore = Math.round(((progress.knownConcepts || []).length / conceptTotal) * 100);
  const quizScore = progress.bestBlockQuiz || 0;
  return Math.round(conceptScore * 0.5 + quizScore * 0.5);
}

function averageBlockProgress() {
  if (!state.blocks.length) return 0;
  const sum = state.blocks.reduce((acc, block) => acc + getBlockProgressPercent(block), 0);
  return Math.round(sum / state.blocks.length);
}

function registerWeakTags(tags, blockId) {
  const values = [...(tags || []), blockId];
  for (const tag of values) {
    if (!tag) continue;
    const key = String(tag).toLowerCase();
    state.progress.weakTags[key] = (state.progress.weakTags[key] || 0) + 1;
  }

  saveProgress();
  renderWeakTags();
}

function renderWeakTags() {
  const entries = Object.entries(state.progress.weakTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14);

  if (!entries.length) {
    els.weakTags.innerHTML = `<p class="muted">Nog geen zwakke labels geregistreerd. Start een blokquiz of integratiesprint.</p>`;
    return;
  }

  els.weakTags.innerHTML = entries
    .map(([label, count]) => `<span class="weak-chip">${escapeHtml(label)} (${count}x)</span>`)
    .join("");
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        blockProgress: {},
        weakTags: {},
        articleChecklist: {},
        exam: { attempts: 0, best: 0, last: 0 },
      };
    }

    const parsed = JSON.parse(raw);
    return {
      blockProgress: parsed.blockProgress || {},
      weakTags: parsed.weakTags || {},
      articleChecklist: parsed.articleChecklist || {},
      exam: parsed.exam || { attempts: 0, best: 0, last: 0 },
    };
  } catch (error) {
    console.warn("Voortgang kon niet worden geladen", error);
    return {
      blockProgress: {},
      weakTags: {},
      articleChecklist: {},
      exam: { attempts: 0, best: 0, last: 0 },
    };
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
