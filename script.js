async function loadGlossary() {
  const res = await fetch('glossary.json');
  return await res.json();
}

async function loadChapter(chapterNum) {
  const res = await fetch(`chapters/chapter${chapterNum}.txt`);
  return await res.text();
}

/* --- Glossary highlighting --- */
function injectGlossary(text, glossary) {
  for (const term in glossary) {
    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${safeTerm}\\b`, 'gi');
    text = text.replace(regex, match =>
      `<span class="gloss" data-word="${term}">${match}</span>`
    );
  }
  return text;
}

function setupTooltips(glossary) {
  const tooltip = document.getElementById('tooltip');
  const tooltipContent = document.getElementById('tooltip-content');

  document.querySelectorAll('.gloss').forEach(span => {
    span.addEventListener('mouseenter', e => {
      const word = span.dataset.word;
      const entry = glossary[word];
      tooltipContent.innerHTML = `<strong>${word}</strong><br>${entry.definition || ''}`;
      if (entry.image) {
        tooltipContent.innerHTML += `<img src="${entry.image}" alt="${word}">`;
      }
      tooltip.classList.remove('hidden');
      tooltip.style.top = `${e.clientY + 15}px`;
      tooltip.style.left = `${e.clientX + 15}px`;
    });

    span.addEventListener('mousemove', e => {
      tooltip.style.top = `${e.clientY + 15}px`;
      tooltip.style.left = `${e.clientX + 15}px`;
    });

    span.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  });
}

/* --- Pagination parser --- */
function parsePages(rawText) {
  // Normalize spacing between tags (in case [end][start] touch)
  let text = rawText.replace(/\]\[/g, "]\n["); 

  const startTagRegex = /\[startPage=(\d+)\]/g;
  const endTagRegex = /\[endPage=(\d+)\]/g;

  const pages = [];
  let match;
  let lastPageNum = null;
  let lastIndex = 0;

  // Find all [startPage] and [endPage] pairs
  while ((match = startTagRegex.exec(text)) !== null) {
    if (lastPageNum !== null) {
      const segment = text.slice(lastIndex, match.index).trim();
      if (segment.length > 0) {
        pages.push({ number: lastPageNum, content: segment });
      }
    }
    lastPageNum = parseInt(match[1]);
    lastIndex = match.index + match[0].length;
  }

  // Handle trailing page
  if (lastPageNum !== null && lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining.length > 0) {
      // Cut off trailing endPage if present
      const clean = remaining.replace(endTagRegex, '').trim();
      pages.push({ number: lastPageNum, content: clean });
    }
  }

  return pages;
}

/* --- Paragraph wrapper helper --- */
function formatParagraphs(text) {
  // Split paragraphs by blank lines
  return text
    .split(/\n\s*\n/)
    .map(p => `<p>${p.trim()}</p>`)
    .join('\n\n');
}

/* --- Page renderer --- */
function renderPage(pages, currentIndex, glossary) {
  const contentDiv = document.getElementById('chapter-content');
  const navDiv = document.createElement('div');
  navDiv.classList.add('page-nav');

  const page = pages[currentIndex];
  const total = pages.length;

  const processedText = injectGlossary(formatParagraphs(page.content), glossary);

  contentDiv.innerHTML = `
    <div class="page-label">Page ${page.number}</div>
    <div class="chapter-text">${processedText}</div>
  `;

  navDiv.innerHTML = `
    <button id="prevPage" ${currentIndex === 0 ? 'disabled' : ''}>← Prev</button>
    <span>Page ${page.number} of ${pages[pages.length - 1].number}</span>
    <button id="nextPage" ${currentIndex === total - 1 ? 'disabled' : ''}>Next →</button>
  `;

  contentDiv.appendChild(navDiv);
  setupTooltips(glossary);

  document.getElementById('prevPage')?.addEventListener('click', () => {
    renderPage(pages, currentIndex - 1, glossary);
    window.scrollTo(0, 0);
  });

  document.getElementById('nextPage')?.addEventListener('click', () => {
    renderPage(pages, currentIndex + 1, glossary);
    window.scrollTo(0, 0);
  });
}

/* --- Initialize chapter page --- */
async function initChapter() {
  const params = new URLSearchParams(window.location.search);
  const chapterNum = params.get('chapter');
  if (!chapterNum) return;

  document.getElementById('chapter-title').textContent = `Chapter ${chapterNum}`;
  const [glossary, chapterText] = await Promise.all([
    loadGlossary(),
    loadChapter(chapterNum)
  ]);

  const pages = parsePages(chapterText);
  if (pages.length === 0) {
    // no page tags → render full chapter
    const processedText = injectGlossary(formatParagraphs(chapterText), glossary);
    document.getElementById('chapter-content').innerHTML =
      `<div class="chapter-text">${processedText}</div>`;
    setupTooltips(glossary);
    return;
  }

  renderPage(pages, 0, glossary);
}

if (window.location.pathname.endsWith('chapter.html')) {
  initChapter();
}
