document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
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
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function paragraphsFrom(text) {
    // Split on blank line or single newline followed by a capital letter start—keeps it forgiving
    const parts = text.trim().split(/\n{2,}|\r?\n(?=[A-Z“"'])/g).map(s => s.trim()).filter(Boolean);
    return parts.map(p => `<p>${p}</p>`).join("\n");
  }

  // Build inline, accessible glossary markup:
  //  <span class="glossary-wrap">
  //    <button class="glossary-term" aria-expanded="false" aria-controls="def-...">Word</button>
  //    <span id="def-..." class="glossary-definition" role="note">Definition (and optional image)</span>
  //  </span>
  function renderGlossary(text) {
    if (!glossary || !Object.keys(glossary).length) {
      return paragraphsFrom(text);
    }

    // Sort longest-to-shortest to avoid partial replacements
    const sortedTerms = Object.keys(glossary).sort((a, b) => b.length - a.length);

    let processed = text;
    let uid = 0;

    for (const originalTerm of sortedTerms) {
      const data = glossary[originalTerm];
      if (!data) continue;

      const defText = typeof data === "object" ? data.definition : String(data);
      const imgHtml = (typeof data === "object" && data.image)
        ? `<img src="${data.image}" alt="Image for ${originalTerm}" class="glossary-image">`
        : "";

      const escaped = escapeRegExp(originalTerm);
      // whole-word, case-insensitive
      const regex = new RegExp(`\\b(${escaped})\\b`, "gi");

      processed = processed.replace(regex, (match) => {
        const id = `def-${uid++}`;
        // Keep original case in the visible button text (match)
        return (
          `<span class="glossary-wrap">` +
            `<button type="button" class="glossary-term" aria-expanded="false" aria-controls="${id}" data-term="${originalTerm}">${match}</button>` +
            `<span id="${id}" class="glossary-definition" role="note">` +
              `<span class="glossary-definition-text">${defText}</span>${imgHtml}` +
            `</span>` +
          `</span>`
        );
      });
    }

    return paragraphsFrom(processed);
  }

  function enhanceGlossary() {
    // Click to pin/unpin (so students can select text inside bubble)
    document.querySelectorAll(".glossary-wrap").forEach((wrap) => {
      const termBtn = wrap.querySelector(".glossary-term");
      const def = wrap.querySelector(".glossary-definition");

      if (!termBtn || !def) return;

      // Toggle pin on click
      termBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pinned = wrap.classList.toggle("pin");
        termBtn.setAttribute("aria-expanded", pinned ? "true" : "false");
      });

      // Keep visibility while moving mouse between term and definition
      wrap.addEventListener("mouseenter", () => {
        wrap.classList.add("hovering");
      });
      wrap.addEventListener("mouseleave", () => {
        wrap.classList.remove("hovering");
      });
    });

    // Clicking outside closes any pinned bubbles
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".glossary-wrap.pin").forEach(wrap => {
        // If click happened inside the pinned wrap, ignore
        if (wrap.contains(e.target)) return;
        const termBtn = wrap.querySelector(".glossary-term");
        wrap.classList.remove("pin");
        if (termBtn) termBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  function renderPage() {
    if (pages.length === 0) return;
    const page = pages[currentPage];

    pageNumberDisplay.textContent = `Page ${page.number}`;
    chapterContainer.innerHTML = renderGlossary(page.content);
    enhanceGlossary();

    localStorage.setItem(`page-${chapterFile}`, currentPage);
    prevButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === pages.length - 1;
  }

  // ---------- Load data then render ----------
  Promise.all([
    fetch("glossary.json").then((res) => (res.ok ? res.json() : {})),
    fetch("chapters/manifest.json").then((res) => (res.ok ? res.json() : [])),
    fetch(`chapters/${chapterFile}`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load chapter file: ${chapterFile}`);
      return res.text();
    }),
  ])
  .then(([glossaryData, manifestData, chapterText]) => {
    glossary = glossaryData || {};

    const chapterInfo = Array.isArray(manifestData)
      ? manifestData.find(ch => ch.file === chapterFile)
      : null;
    if (chapterInfo && chapterTitleEl) {
      chapterTitleEl.textContent = chapterInfo.title || "Chapter";
    }

    const pageRegex = /\[startPage=(\d+)\]([\s\S]*?)\[endPage=\1\]/g;
    let match;
    while ((match = pageRegex.exec(chapterText)) !== null) {
      pages.push({
        number: parseInt(match[1], 10),
        content: match[2].trim(),
      });
    }

    if (pages.length === 0) {
      chapterContainer.innerHTML = '<p class="error">Error: No valid [startPage]/[endPage] markers found.</p>';
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
