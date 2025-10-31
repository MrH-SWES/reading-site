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
      .split(/(?:\n{2,})|\n(?=\s*[A-Z""'])/g)
      .map(s =>
        s
          .replace(/\s+([,.!?;:])/g, "$1")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

    return parts.map(p => `<p>${renderGlossaryInline(p)}</p>`).join("\n\n");
  }

  function renderGlossaryInline(text) {
  if (!glossary || !Object.keys(glossary).length) return text;

  // First pass: collect all terms and their definitions WITHOUT any glossary markup
  const cleanDefinitions = {};
  for (const term in glossary) {
    const data = glossary[term];
    cleanDefinitions[term] = typeof data === "object" ? data.definition : String(data);
  }

  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
  let processed = text;
  let uid = 0;
  const usedTerms = new Set();

  for (const original of terms) {
    const data = glossary[original];
    if (!data) continue;

    if (usedTerms.has(original.toLowerCase())) continue;

    const defText = cleanDefinitions[original]; // Use pre-cleaned definition
    const imgHtml =
      typeof data === "object" && data.image
        ? `<img src="${data.image}" alt="" class="glossary-image" role="presentation">`
        : "";

    const regex = new RegExp(`\\b(${escapeRegExp(original)})\\b`, "i");

    if (regex.test(processed)) {
      processed = processed.replace(regex, (match) => {
        const id = `def-${uid++}`;
        usedTerms.add(original.toLowerCase());
        return (
          `<span class="glossary-wrap">` +
          `<button type="button" class="glossary-term" aria-describedby="${id}">${match}</button>` +
          `<span id="${id}" class="glossary-definition" role="status" aria-live="off" aria-atomic="true">` +
          `<span class="glossary-definition-text">${defText}</span>${imgHtml}` +
          `</span></span>`
        );
      });
    }
  }

  return processed;
}

  function enhanceGlossary() {
    document.querySelectorAll(".glossary-wrap").forEach((wrap) => {
      const termBtn = wrap.querySelector(".glossary-term");
      const definition = wrap.querySelector(".glossary-definition");
      if (!termBtn || !definition) return;

      // Check if near left edge and flip to right if needed
      const rect = wrap.getBoundingClientRect();
      if (rect.left < 340) {
        wrap.classList.add("flip-right");
      }

      termBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        
        // Close all other pinned definitions first
        document.querySelectorAll(".glossary-wrap.pin").forEach((otherWrap) => {
          if (otherWrap !== wrap) {
            otherWrap.classList.remove("pin");
            const otherBtn = otherWrap.querySelector(".glossary-term");
            const otherDef = otherWrap.querySelector(".glossary-definition");
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
            if (otherDef) otherDef.setAttribute("aria-live", "off");
          }
        });
        
        // Toggle this one
        const nowPinned = wrap.classList.toggle("pin");
        termBtn.setAttribute("aria-expanded", nowPinned ? "true" : "false");
        
        // Control aria-live to prevent reading background content
        if (nowPinned) {
          definition.setAttribute("aria-live", "polite");
          // Reset after announcement
          setTimeout(() => {
            definition.setAttribute("aria-live", "off");
          }, 100);
        } else {
          definition.setAttribute("aria-live", "off");
        }
      });
    });

    // Close all definitions when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".glossary-wrap")) {
        document.querySelectorAll(".glossary-wrap.pin").forEach((wrap) => {
          const termBtn = wrap.querySelector(".glossary-term");
          const definition = wrap.querySelector(".glossary-definition");
          wrap.classList.remove("pin");
          if (termBtn) termBtn.setAttribute("aria-expanded", "false");
          if (definition) definition.setAttribute("aria-live", "off");
        });
      }
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
    fetch("glossary.json")
      .then((r) => {
        if (!r.ok) {
          console.warn("glossary.json not found or failed to load");
          return {};
        }
        return r.json().catch(err => {
          console.error("Error parsing glossary.json:", err);
          return {};
        });
      }),
    fetch("chapters/manifest.json")
      .then((r) => {
        if (!r.ok) {
          console.error("manifest.json not found or failed to load");
          return [];
        }
        return r.json().catch(err => {
          console.error("Error parsing manifest.json:", err);
          return [];
        });
      }),
    fetch(`chapters/${chapterFile}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load chapter file: ${chapterFile}`);
        return r.text();
      }),
  ])
    .then(([glossaryData, manifestData, chapterText]) => {
      glossary = glossaryData || {};

      const chapterInfo = Array.isArray(manifestData)
        ? manifestData.find((ch) => ch.file === chapterFile)
        : null;
      if (chapterInfo && chapterTitleEl) {
        chapterTitleEl.textContent = chapterInfo.title || "Chapter";
      }

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

