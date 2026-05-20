/* ============================================================
   Local Knowledge RAG — frontend
   ============================================================ */

const $ = (selector) => document.querySelector(selector);

const form = $("#chatForm");
const questionInput = $("#question");
const messages = $("#messages");
const ingestButton = $("#ingestButton");
const sendButton = form.querySelector(".send-button");
const welcomeView = $("#welcomeView");
const newChatButton = $("#newChatButton");
const historyList = $("#historyList");
const headerTitle = $("#headerTitle");
const sidebar = $("#sidebar");
const sidebarBackdrop = $("#sidebarBackdrop");
const openSidebarButton = $("#openSidebar");
const closeSidebarButton = $("#closeSidebar");
const themeToggle = $("#themeToggle");

const STORAGE_THEME_KEY = "rag.theme";
const TYPING_SPEED_MS = 10;
const HISTORY_LIMIT = 12;

const history = [];

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const label = themeToggle.querySelector(".theme-label");
  if (label) label.textContent = theme === "dark" ? "ライトモード" : "ダークモード";
}

function initTheme() {
  const stored = localStorage.getItem(STORAGE_THEME_KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(stored ?? (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(STORAGE_THEME_KEY, next);
});

initTheme();

/* ---------- Marked configuration ---------- */
if (window.marked) {
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
  });
}

function renderMarkdown(text) {
  if (!window.marked) {
    const span = document.createElement("span");
    span.textContent = text;
    return span.innerHTML;
  }
  return marked.parse(text);
}

/* ---------- Messages ---------- */
function createMessageElement(role) {
  hideWelcome();
  const article = document.createElement("article");
  article.className = `message ${role}`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.src = "icon.png";
    img.alt = "";
    avatar.appendChild(img);
    article.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  article.appendChild(bubble);

  messages.appendChild(article);
  scrollToBottom();
  return { article, bubble };
}

function addUserMessage(text) {
  const { bubble } = createMessageElement("user");
  bubble.textContent = text;
}

function addAssistantPlain(text) {
  const { bubble } = createMessageElement("assistant");
  bubble.innerHTML = renderMarkdown(text);
}

function addThinkingIndicator() {
  const { article, bubble } = createMessageElement("assistant");
  const dots = document.createElement("div");
  dots.className = "thinking";
  for (let i = 0; i < 3; i++) {
    const d = document.createElement("span");
    d.className = "thinking-dot";
    dots.appendChild(d);
  }
  bubble.appendChild(dots);
  article.dataset.thinking = "true";
  return { article, bubble };
}

function attachSources(bubble, sources) {
  if (!sources || sources.length === 0) return;
  const wrap = document.createElement("div");
  wrap.className = "sources";

  const label = document.createElement("div");
  label.className = "sources-label";
  label.textContent = "参照ナレッジ";
  wrap.appendChild(label);

  sources.forEach((source) => {
    const item = document.createElement("div");
    item.className = "source";
    const distance = source.distance === null || source.distance === undefined
      ? "N/A"
      : Number(source.distance).toFixed(4);
    const header = document.createElement("strong");
    header.textContent = `${source.file} · chunk ${source.chunk} · distance ${distance}`;
    const body = document.createElement("span");
    body.textContent = source.content.slice(0, 300);
    item.appendChild(header);
    item.appendChild(body);
    wrap.appendChild(item);
  });

  bubble.appendChild(wrap);
}

function attachCopyButton(article, getText) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy-button";
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span>コピー</span>
  `;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getText());
      btn.classList.add("copied");
      btn.querySelector("span").textContent = "コピーしました";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.querySelector("span").textContent = "コピー";
      }, 1600);
    } catch {
      btn.querySelector("span").textContent = "失敗";
    }
  });

  actions.appendChild(btn);
  article.appendChild(actions);
}

/* ---------- Typing animation ---------- */
function typeOut(bubble, text, fullMarkdown) {
  return new Promise((resolve) => {
    bubble.textContent = "";
    bubble.classList.add("typing");

    let i = 0;
    const total = text.length;
    const chunkSize = Math.max(1, Math.ceil(total / 240));
    let lastScrollAt = 0;

    function step() {
      i = Math.min(i + chunkSize, total);
      bubble.textContent = text.slice(0, i);

      const now = performance.now();
      if (now - lastScrollAt > 60) {
        scrollToBottom();
        lastScrollAt = now;
      }

      if (i < total) {
        setTimeout(step, TYPING_SPEED_MS);
      } else {
        bubble.classList.remove("typing");
        bubble.innerHTML = fullMarkdown;
        scrollToBottom();
        resolve();
      }
    }

    setTimeout(step, 120);
  });
}

/* ---------- Welcome / header ---------- */
function hideWelcome() {
  if (welcomeView && !welcomeView.classList.contains("hidden")) {
    welcomeView.classList.add("hidden");
  }
}

function showWelcome() {
  welcomeView?.classList.remove("hidden");
}

function setHeaderTitle(text) {
  if (headerTitle) headerTitle.textContent = text;
}

/* ---------- History ---------- */
function pushHistory(question) {
  history.unshift(question);
  if (history.length > HISTORY_LIMIT) history.pop();
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "まだ質問はありません";
    historyList.appendChild(empty);
    return;
  }
  history.forEach((q) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";
    btn.textContent = q;
    btn.title = q;
    btn.addEventListener("click", () => {
      questionInput.value = q;
      autoResize();
      updateSendButton();
      questionInput.focus();
      closeSidebar();
    });
    li.appendChild(btn);
    historyList.appendChild(li);
  });
}

/* ---------- HTTP ---------- */
async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || response.statusText);
  }

  return response.json();
}

/* ---------- Composer ---------- */
function autoResize() {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 240)}px`;
}

function resetInput() {
  questionInput.value = "";
  questionInput.style.height = "auto";
  updateSendButton();
}

function updateSendButton() {
  sendButton.disabled = questionInput.value.trim().length === 0;
}

questionInput.addEventListener("input", () => {
  autoResize();
  updateSendButton();
});

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!sendButton.disabled) form.requestSubmit();
  }
});

updateSendButton();

/* ---------- Scroll ---------- */
function scrollToBottom() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

/* ---------- Submit ---------- */
let isSending = false;

async function submitQuestion(question) {
  if (!question || isSending) return;
  isSending = true;

  addUserMessage(question);
  pushHistory(question);
  if (messages.children.length === 1) {
    setHeaderTitle(question.length > 48 ? `${question.slice(0, 48)}…` : question);
  }
  resetInput();
  sendButton.disabled = true;

  const { article: thinkingArticle } = addThinkingIndicator();

  try {
    const data = await postJson("/api/chat", { question, top_k: 4 });
    thinkingArticle.remove();

    const { article, bubble } = createMessageElement("assistant");
    const fullHtml = renderMarkdown(data.answer || "");
    await typeOut(bubble, data.answer || "", fullHtml);
    attachSources(bubble, data.sources);
    attachCopyButton(article, () => data.answer || "");
  } catch (error) {
    thinkingArticle.remove();
    addAssistantPlain(`エラー: ${error.message}`);
  } finally {
    isSending = false;
    updateSendButton();
    questionInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuestion(questionInput.value.trim());
});

/* ---------- Ingest ---------- */
ingestButton.addEventListener("click", async () => {
  ingestButton.disabled = true;
  const { article: thinkingArticle } = addThinkingIndicator();

  try {
    const data = await postJson("/api/ingest", {});
    thinkingArticle.remove();
    addAssistantPlain(`**${data.files}** ファイルから **${data.chunks}** チャンクを取り込みました。`);
  } catch (error) {
    thinkingArticle.remove();
    addAssistantPlain(`取り込みエラー: ${error.message}`);
  } finally {
    ingestButton.disabled = false;
    closeSidebar();
  }
});

/* ---------- Suggestions ---------- */
document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt || button.textContent.trim();
    submitQuestion(prompt);
  });
});

/* ---------- New chat ---------- */
newChatButton.addEventListener("click", () => {
  messages.innerHTML = "";
  showWelcome();
  setHeaderTitle("新規チャット");
  resetInput();
  questionInput.focus();
  closeSidebar();
});

/* ---------- Sidebar (mobile) ---------- */
function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.add("open");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("open");
}

openSidebarButton.addEventListener("click", openSidebar);
closeSidebarButton.addEventListener("click", closeSidebar);
sidebarBackdrop.addEventListener("click", closeSidebar);

window.addEventListener("resize", () => {
  if (window.innerWidth > 960) closeSidebar();
});

/* ---------- Initial focus ---------- */
questionInput.focus();
