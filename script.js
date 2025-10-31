document.addEventListener("DOMContentLoaded", () => {
  const chapterContainer = document.querySelector(".chapter-content");
  const pageNumberDisplay = document.querySelector(".page-number");
  const prevButton = document.getElementById("prev");
  const nextButton = document.getElementById("next");
  const chapterTitleEl = document.getElementById("chapter-title");

  if (!chapterContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const chapterFile = urlParams.get("chapter") || "chapter1.txt";

  let glossary = {};
  let pages = [];
  let currentPage = 0;

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function makeParagraphHTML(rawText) {
    const norm = rawText.replace(/\r/g, "");
    const parts = norm
      // Split on blank line or newline followed by capital or quote
      .split(/(?:\n{2,})|\n(?=\s*[A-Z“"'])/g)
      .map(s =>
        s
          .replace(/\s+(?=<)/g, " ") // preserve one space before glossary tags
          .replace(/\s+/g, " ")
          .replace(/\s+([,.!?;:])/g, "$1") // remove space before punctuation
          .trim()
      )
      .filter(Boolean);

    return parts.map(p => `<p>${renderGlossaryInline(p)}</p>`).join("\n");
  }

  function renderGlossaryInline(text) {
    if (!glossary || !Object.keys(glossary).length) return text;

    const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
    let processed = text;
    let uid = 0;

    for (const original of terms) {
      const data = glossary[original];
      if (!data) continue;

      const defText = typeof data === "object" ? data.definition : String(data);
      const imgHtml =
        typeof data === "object" && data.image
          ? `<img src="${data.image}" alt="Image for ${original}" class="glossary-image">`
          : "";

      const regex = new RegExp(`\\b(${escapeRegExp(original)})\\b`, "gi");

      processed = processed.replace(regex, (match) => {
        const id = `def-${uid++}`;
        return (
          `<span class="glossary-wrap">` +
          `<button type="button" class="glossary-term" aria-expanded="false" aria-controls="${id}" data-term="${original}">${match}</button>` +
          `<span id="${id}" class="glossary-definition" role="note">` +
          `<span class="glossary-definition-text">${defText}</span>${imgHtml}` +
          `</span></span>`
        );
      });
    }

    return processed;
  }

  function enhanceGlossary() {
    document.querySelectorAll(".glossary-wrap").forEach((wrap) => {
      const termBtn = wrap.querySelector(".glossary-term");
      if (!termBtn) return;

      termBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pinned = wrap.classList.toggle("pin");
        termBtn.setAttribute("aria-expanded", pinned ? "true" : "false");
      });
    });

    document.addEventListener("click", (e) => {
      document.querySelectorAll(".glossary-wrap.pin").forEach((wrap) => {
        if (wrap.contains(e.target)) return;
        const termBtn = wrap.querySelector(".glossary-term");
        wrap.classList.remove("pin");
        if (termBtn) termBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  function renderPage() {
    if (!pages.length) return;
    const page = pages[currentPage];

    pageNumberDisplay.textContent = `Page ${page.number}`;
    chapterContainer.innerHTML = makeParagraphHTML(page.content);
    enhanceGlossary();

    const wrapper = document.querySelector(".chapter-container");
    if (currentPage === 0) wrapper.classList.add("first-page");
    else wrapper.classList.remove("first-page");

    localStorage.setItem(`page-${chapterFile}`, currentPage);
    prevButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === pages.length - 1;
  }

  Promise.all([
    fetch("glossary.json").then((r) => (r.ok ? r.json() : {})),
    fetch("chapters/manifest.json").then((r) => (r.ok ? r.json() : [])),
    fetch(`chapters/${chapterFile}`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load chapter file: ${chapterFile}`);
      return r.text();
    }),
  ])
    .then(([glossaryData, manifestData, chapterText]) => {
      glossary = glossaryData || {};

      const chapterInfo = Array.isArray(manifestData)
        ? manifestData.find((ch) => ch.file === chapterFile)
        : null;
      if (chapterInfo && chapterTitleEl)
        chapterTitleEl.textContent = chapterInfo.title || "Chapter";

      const pageRegex = /\[startPage=(\d+)\]([\s\S]*?)\[endPage=\1\]/g;
      let m;
      while ((m = pageRegex.exec(chapterText)) !== null) {
        pages.push({ number: parseInt(m[1], 10), content: m[2].trim() });
      }

      if (!pages.length) {
        chapterContainer.innerHTML =
          '<p class="error">Error: No valid [startPage]/[endPage] markers found.</p>';
        return;
      }

      currentPage =
        parseInt(localStorage.getItem(`page-${chapterFile}`), 10) || 0;
      if (currentPage >= pages.length) currentPage = 0;

      prevButton.addEventListener("click", () => {
        if (currentPage > 0) {
          currentPage--;
          renderPage();
        }
      });

      nextButton.addEventListener("click", () => {
        if (currentPage < pages.length - 1) {
          currentPage++;
          renderPage();
        }
      });

      renderPage();
    })
    .catch((err) => {
      chapterContainer.innerHTML = `<p class="error">Error loading page: ${err.message}</p>`;
      if (chapterTitleEl) chapterTitleEl.textContent = "Error";
      console.error(err);
    });
});
