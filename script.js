document.addEventListener("DOMContentLoaded", () => {
  // --- Get all required elements ---
  const chapterContainer = document.querySelector(".chapter-content");
  const pageNumberDisplay = document.querySelector(".page-number");
  const prevButton = document.getElementById("prev");
  const nextButton = document.getElementById("next");
  const backLink = document.querySelector(".back-link");
  const chapterTitleEl = document.getElementById("chapter-title");

  // Only run on chapter.html
  if (!chapterContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const chapterFile = urlParams.get("chapter") || "chapter1.txt";

  let glossary = {};
  let pages = [];
  let currentPage = 0;

  // --- Helper Functions (Defined first for clarity) ---

  function renderGlossary(text) {
    const words = text.split(/\b/);
    return words
      .map((word) => {
        const cleanWord = word.toLowerCase().replace(/[^a-z']/g, "");
        if (glossary[cleanWord]) {
          return `<span class="glossary-term" data-term="${cleanWord}">${word}</span>`;
        }
        return word;
      })
      .join("");
  }

  function renderPage() {
    if (pages.length === 0) return;

    const page = pages[currentPage];
    pageNumberDisplay.textContent = `Page ${page.number}`;
    chapterContainer.innerHTML = renderGlossary(page.content);
    attachGlossaryHandlers(); // This is the function we are fixing
    localStorage.setItem(`page-${chapterFile}`, currentPage);
    prevButton.disabled = currentPage === 0;
    nextButton.disabled = currentPage === pages.length - 1;
  }

  function attachGlossaryHandlers() {
    document.querySelectorAll(".glossary-term").forEach((termEl) => {
      termEl.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevents click from closing parent tooltips if nested
        
        // Remove any other tooltips that might be open
        document.querySelectorAll(".tooltip").forEach((t) => t.remove());

        const term = termEl.dataset.term;
        const termData = glossary[term];
        if (!termData) return;

        const tooltip = document.createElement("div");
        tooltip.classList.add("tooltip");

        let content = `<p>${termData.definition}</p>`;
        if (termData.image) {
          content += `<img src="${termData.image}" alt="Image for ${term}" style="width: 100%; max-width: 200px; display: block; margin-top: 8px; border-radius: 4px;">`;
        }
        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);

        const rect = termEl.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;

        // This function handles closing the tooltip
        const closeTooltip = (ev) => {
          // Check if the click is *outside* the tooltip
          if (tooltip && !tooltip.contains(ev.target)) {
            tooltip.remove();
            document.removeEventListener("click", closeTooltip);
          }
        };

        // **THE FIX:**
        // Add the 'click-outside' listener *after* the current
        // click event has finished propagating.
        setTimeout(() => {
          document.addEventListener("click", closeTooltip);
        }, 0);
        
      });
    });
  }

  // --- Load all data before rendering ---
  Promise.all([
    // 1. Load Glossary
    fetch("glossary.json").then((res) => (res.ok ? res.json() : {})),
    // 2. Load Manifest
    fetch("chapters/manifest.json").then((res) => (res.ok ? res.json() : [])),
    // 3. Load Chapter Text
    fetch(`chapters/${chapterFile}`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load chapter file: ${chapterFile}`);
      return res.text();
    }),
  ])
  .then(([glossaryData, manifestData, chapterText]) => {
    // --- 1. Process Glossary ---
    glossary = glossaryData;

    // --- 2. Process Manifest ---
    const chapterInfo = manifestData.find(ch => ch.file === chapterFile);
    if (chapterInfo && chapterTitleEl) {
      chapterTitleEl.textContent = chapterInfo.title;
    }

    // --- 3. Process Chapter Text ---
    const pageRegex = /\[startPage=(\d+)\]([\s\S]*?)\[endPage=\1\]/g;
    let match;
    while ((match = pageRegex.exec(chapterText)) !== null) {
      pages.push({
        number: parseInt(match[1]),
        content: match[2].trim(),
      });
    }

    if (pages.length === 0) {
      chapterContainer.innerHTML = '<p class="error">Error: No valid [startPage]/[endPage] markers found.</p>';
      return;
    }

    // --- 4. Setup Page and Navigation ---
    currentPage = parseInt(localStorage.getItem(`page-${chapterFile}`)) || 0;
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

    // Initial render
    renderPage();

  })
  .catch((err) => {
    // Handle errors from any of the fetches
    chapterContainer.innerHTML = `<p class="error">Error loading page: ${err.message}</p>`;
    if (chapterTitleEl) chapterTitleEl.textContent = "Error";
    console.error(err);
  });
});
