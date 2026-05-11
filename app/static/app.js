const form = document.querySelector("#chatForm");
const questionInput = document.querySelector("#question");
const messages = document.querySelector("#messages");
const ingestButton = document.querySelector("#ingestButton");

function addMessage(role, text, sources = []) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  if (sources.length > 0) {
    const sourcesElement = document.createElement("div");
    sourcesElement.className = "sources";
    sources.forEach((source) => {
      const item = document.createElement("div");
      item.className = "source";
      const distance = source.distance === null ? "N/A" : source.distance.toFixed(4);
      item.innerHTML = `<strong>${escapeHtml(source.file)} / chunk ${source.chunk} / distance ${distance}</strong>${escapeHtml(
        source.content.slice(0, 300)
      )}`;
      sourcesElement.appendChild(item);
    });
    bubble.appendChild(sourcesElement);
  }

  article.appendChild(bubble);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  addMessage("user", question);
  questionInput.value = "";
  form.querySelector("button").disabled = true;

  try {
    const data = await postJson("/api/chat", { question, top_k: 4 });
    addMessage("assistant", data.answer, data.sources);
  } catch (error) {
    addMessage("assistant", `エラー: ${error.message}`);
  } finally {
    form.querySelector("button").disabled = false;
    questionInput.focus();
  }
});

ingestButton.addEventListener("click", async () => {
  ingestButton.disabled = true;
  addMessage("assistant", "ナレッジを取り込み中です...");

  try {
    const data = await postJson("/api/ingest", {});
    addMessage("assistant", `${data.files}ファイルから${data.chunks}チャンクを取り込みました。`);
  } catch (error) {
    addMessage("assistant", `取り込みエラー: ${error.message}`);
  } finally {
    ingestButton.disabled = false;
  }
});
