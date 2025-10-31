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

  // Process each paragraph separately to prevent cross-paragraph issues
  return parts.map(p => `<p>${renderGlossaryInline(p)}</p>`).join("\n\n");
}

  function renderGlossaryInline(text) {
  if (!glossary || !Object.keys(glossary).length) return text;

  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
  let processed = text;
  const usedTerms = new Set();

  for (const original of terms) {
    const data = glossary[original];
    if (!data) continue;

    if (usedTerms.has(original.toLowerCase())) continue;

    const regex = new RegExp(`\\b(${escapeRegExp(original)})\\b`, "i");

    const parts = processed.split(/(<span class="glossary-wrap">[\s\S]*?<\/span>)/);
    
    let foundAndReplaced = false;
    const newParts = parts.map(part => {
      if (part.startsWith('<span class="glossary-wrap">')) {
        return part;
      }
      
      if (!foundAndReplaced && regex.test(part)) {
        foundAndReplaced = true;
        usedTerms.add(original.toLowerCase());
        return part.replace(regex, (match) => {
          // Store the term in a data attribute for later popup creation
          return `<span class="glossary-wrap" data-term="${original.toLowerCase()}">${match}</span>`;
        });
      }
      
      return part;
    });

    processed = newParts.join('');
  }

  return processed;
}

function enhanceGlossary() {
  const popupContainer = document.getElementById('glossary-popup-container');
  if (!popupContainer) return;

  let activePopup = null;

  document.querySelectorAll(".glossary-wrap").forEach((wrap) => {
    const termText = wrap.textContent;
    const termKey = wrap.getAttribute('data-term');
    
    if (!termKey || !glossary[termKey]) return;

    const data = glossary[termKey];
    const defText = typeof data === "object" ? data.definition : String(data);
    const imgHtml = typeof data === "object" && data.image
      ? `<img src="${data.image}" alt="" class="glossary-image" role="presentation">`
      : "";

    // Make the term visually styled and clickable
    wrap.classList.add('glossary-term');
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', `${termText}, click for definition`);

    const showPopup = (e) => {
      e.stopPropagation();

      // Close any existing popup
      if (activePopup) {
        activePopup.remove();
        activePopup = null;
      }

      // Create popup in the separate container
      const popup = document.createElement('div');
      popup.className = 'glossary-popup';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-label', `Definition of ${termText}`);
      popup.innerHTML = `
        <div class="glossary-popup-content">
          <button class="glossary-popup-close" aria-label="Close definition">×</button>
          <div class="glossary-popup-text">${defText}</div>
          ${imgHtml}
        </div>
      `;

      // Position the popup relative to the term
      const rect = wrap.getBoundingClientRect();
      popup.style.position = 'fixed';
      
      // Try to position on the left
      if (rect.left > 320) {
        popup.style.right = `${window.innerWidth - rect.left + 15}px`;
        popup.style.top = `${rect.top}px`;
      } else {
        // If too close to left edge, position on the right
        popup.style.left = `${rect.right + 15}px`;
        popup.style.top = `${rect.top}px`;
      }

      popupContainer.appendChild(popup);
      activePopup = popup;

      // Highlight the term
      wrap.classList.add('active');

      // Close button functionality
      const closeBtn = popup.querySelector('.glossary-popup-close');
      closeBtn.addEventListener('click', () => {
        popup.remove();
        activePopup = null;
        wrap.classList.remove('active');
        wrap.focus();
      });

      // Focus the close button for accessibility
      closeBtn.focus();
    };

    wrap.addEventListener('click', showPopup);
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showPopup(e);
      }
    });
  });

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (activePopup && !e.target.closest('.glossary-popup') && !e.target.closest('.glossary-wrap')) {
      const activeTerm = document.querySelector('.glossary-wrap.active');
      activePopup.remove();
      activePopup = null;
      if (activeTerm) activeTerm.classList.remove('active');
    }
  });

  // Close popup on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePopup) {
      const activeTerm = document.querySelector('.glossary-wrap.active');
      activePopup.remove();
      activePopup = null;
      if (activeTerm) {
        activeTerm.classList.remove('active');
        activeTerm.focus();
      }
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



