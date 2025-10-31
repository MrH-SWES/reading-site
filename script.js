document.addEventListener("DOMContentLoaded", () => {
  // Elements on chapter.html
  const chapterContainer = document.querySelector(".chapter-content");
  const pageNumberDisplay = document.querySelector(".page-number");
  const prevButton = document.getElementById("prev");
  const nextButton = document.getElementById("next");
  const chapterTitleEl = document.getElementById("chapter-title");

  // Only run on chapter.html
  if (!chapterContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const chapterFile = urlParams.get("chapter") || "chapter1.txt";

  let glossary = {};
  let pages = [];
  let currentPage = 0;

  // ---------- Helpers ----------
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Split into paragraph blocks by 2+ newlines; inside each block collapse
  // single newlines to spaces so we don't create fake paragraph gaps or extra spaces.
  function makeParagraphHTML(rawText) {
    const blocks = rawText
      .replace(/\r/g, "")
      .split(/\n{2,}/); // paragraphs are separated by blank lines (2+ newlines)

    return blocks
      .map((b) => b.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map((clean) => `<p>${renderGlossaryInline(clean)}</p>`)
      .join("\n");
  }

  // Replace glossary terms inline with accessible markup (no flicker).
  function renderGlossaryInline(text) {
    if (!glossary || !Object.keys(glossary).length) return text;

    // Longest-first to avoid partial overlaps
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
    // click-to-pin; hover is handled by CSS
    document.querySelectorAll(".glossary-wrap").forEach((wrap) => {
      const termBtn = wrap.querySelector(".glossary-term");
      if (!termBtn) return;

      termBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pinned = wrap.classList.toggle("pin");
        termBtn.setAttribute("aria-expanded", pinned ? "true" : "false");
      });
    });

    // click outside closes pinned bubbles
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

    // drop cap only on first page of the chapter
    const wrapper = document.querySelector(".chapter-container");
    if (currentPage === 0) wrapper.classList.add("first-page");
    else wrapper.classList.remove("first-page");

    localStorage.setItem(`page-${chapterFile}`, currentPage);
    prevButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === pages.length - 1;
  }

  // ---------- Load all data then render ----------
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

      // Parse page blocks [startPage=N] ... [endPage=N]
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

      currentPage = parseInt(localStorage.getItem(`page-${chapterFile}`), 10) || 0;
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
