document.addEventListener("DOMContentLoaded", () => {
  const chapterContainer = document.querySelector(".chapter-content");
  const pageNumberDisplay = document.querySelector(".page-number");
  const prevButton = document.getElementById("prev");
  const nextButton = document.getElementById("next");
  const backLink = document.querySelector(".back-link");

  // Load glossary (if available)
  let glossary = {};
  fetch("glossary.json")
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => (glossary = data))
    .catch(() => (glossary = {}));

  // Only run on chapter.html
  if (!chapterContainer) return;

  const urlParams = new URLSearchParams(window.location.search);
  const chapterFile = urlParams.get("chapter") || "chapter1.txt";

  fetch(`chapters/${chapterFile}`)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load chapter file");
      return response.text();
    })
    .then((text) => {
      const pageRegex = /\[startPage=(\d+)\]([\s\S]*?)\[endPage=\1\]/g;
      const pages = [];
      let match;
      while ((match = pageRegex.exec(text)) !== null) {
        pages.push({
          number: parseInt(match[1]),
          content: match[2].trim(),
        });
      }

      if (pages.length === 0) {
        chapterContainer.textContent =
          "Error: No valid [startPage]/[endPage] markers found.";
        return;
      }

      // Track current page
      let currentPage = parseInt(localStorage.getItem(`page-${chapterFile}`)) || 0;
      if (currentPage >= pages.length) currentPage = 0;

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
        const page = pages[currentPage];
        pageNumberDisplay.textContent = `Page ${page.number}`;
        chapterContainer.innerHTML = renderGlossary(page.content);
        attachGlossaryHandlers();
        localStorage.setItem(`page-${chapterFile}`, currentPage);
        prevButton.disabled = currentPage === 0;
        nextButton.disabled = currentPage === pages.length - 1;
      }

      function attachGlossaryHandlers() {
        document.querySelectorAll(".glossary-term").forEach((termEl) => {
          termEl.addEventListener("click", (e) => {
            e.stopPropagation();
            // Remove existing tooltips
            document.querySelectorAll(".tooltip").forEach((t) => t.remove());

            const term = termEl.dataset.term;
            // **FIX:** Get the glossary object { definition: "..." }
            const termData = glossary[term];
            if (!termData) return; // Safety check

            const tooltip = document.createElement("div");
            tooltip.classList.add("tooltip");

            // **FIX:** Build HTML from the object's properties
            let content = `<p>${termData.definition}</p>`;
            if (termData.image) {
              content += `<img src="${termData.image}" alt="Image for ${term}" style="width: 100%; max-width: 200px; display: block; margin-top: 8px; border-radius: 4px;">`;
            }

            tooltip.innerHTML = content;
            document.body.appendChild(tooltip);

            const rect = termEl.getBoundingClientRect();
            tooltip.style.left = `${rect.left + window.scrollX}px`;
            tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;

            // Clicking outside closes tooltip
            const closeTooltip = (ev) => {
              if (!tooltip.contains(ev.target)) {
                tooltip.remove();
                document.removeEventListener("click", closeTooltip);
              }
            };
            document.addEventListener("click", closeTooltip);
          });
        });
      }

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
      chapterContainer.textContent = `Error: ${err.message}`;
    });
});
