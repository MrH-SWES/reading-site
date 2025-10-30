/* ----------------- data loading ----------------- */
async function loadGlossary() {
  const res = await fetch('glossary.json');
  return await res.json();
}

async function loadChapter(chapterNum) {
  const res = await fetch(`chapters/chapter${chapterNum}.txt`);
  return await res.text();
}

/* ----------------- glossary injection ----------------- */
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
  const content = document.getElementById('tooltip-content');

  document.querySelectorAll('.gloss').forEach(el => {
    el.addEventListener('mouseenter', e => {
      const word = el.dataset.word;
      const entry = glossary[word] || {};
      content.innerHTML = `<strong>${word}</strong><br>${entry.definition || ''}`;
      if (entry.image) content.innerHTML += `<img src="${entry.image}" alt="${word}">`;
      tooltip.classList.remove('hidden');
      tooltip.style.top = `${e.clientY + 15}px`;
      tooltip.style.left = `${e.clientX + 15}px`;
    });
    el.addEventListener('mousemove', e => {
      tooltip.style.top = `${e.clientY + 15}px`;
      tooltip.style.left = `${e.clientX + 15}px`;
    });
    el.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  });
}

/* ----------------- pagination parsing ----------------- */
/* Accepts tags even when adjacent: [endPage=13][startPage=14] */
function parsePages(rawText) {
  const text = rawText.replace(/\]\[/g, `]\n[`); // normalize adjacency
  const startTag = /\[startPage=(\d+)\]/g;
  const endTag = /\[endPage=\d+\]/g;

  const pages = [];
  let m, lastNum = null, lastIndex = 0;

  while ((m = startTag.exec(text)) !== null) {
    if (lastNum !== null) {
      let slice = text.slice(lastIndex, m.index).replace(endTag, '').trim();
      if (slice) pages.push({ number: lastNum, content: slice });
    }
    lastNum = parseInt(m[1], 10);
    lastIndex = m.index + m[0].length;
  }
  if (lastNum !== null) {
    let tail = text.slice(lastIndex).replace(endTag, '').trim();
    if (tail) pages.push({ number: lastNum, content: tail });
  }
  return pages;
}

/* ----------------- paragraph formatting ----------------- */
function wrapParagraphs(text) {
  // Split on blank lines to form paragraphs
  return text
    .split(/\n\s*\n/)
    .map(p => `<p>${p.trim()}</p>`)
    .join('\n');
}

/* ----------------- rendering & state ----------------- */
function saveProgress(chapterNum, pageIndex) {
  try { localStorage.setItem(`reading_progress_ch${chapterNum}`, String(pageIndex)); } catch {}
}

function loadProgress(chapterNum, maxIndex) {
  try {
    const raw = localStorage.getItem(`reading_progress_ch${chapterNum}`);
    const idx = raw == null ? 0 : Math.max(0, Math.min(maxIndex, parseInt(raw, 10)));
    return isNaN(idx) ? 0 : idx;
  } catch { return 0; }
}

function renderPage(pages, index, glossary, chapterNum) {
  const container = document.getElementById('chapter-content');
  const page = pages[index];
  if (!page) return;

  // Build processed HTML and control drop cap only on first page
  const processed = injectGlossary(wrapParagraphs(page.content), glossary);
  container.classList.toggle('dropcap', index === 0);  // drop cap only on first page
  container.innerHTML = processed;

  // Header + footer metadata
  document.getElementById('page-number-display').textContent = `Page ${page.number}`;
  document.getElementById('page-counter').textContent =
    `Page ${page.number} of ${pages[pages.length - 1].number}`;
  document.getElementById('left-page-num').textContent = `Page ${page.number}`;
  document.getElementById('right-page-num').textContent =
    document.getElementById('chapter-title').textContent;

  // Prev/Next buttons
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === pages.length - 1;

  prevBtn.onclick = () => {
    if (index > 0) { saveProgress(chapterNum, index - 1); renderPage(pages, index - 1, glossary, chapterNum); window.scrollTo(0,0); }
  };
  nextBtn.onclick = () => {
    if (index < pages.length - 1) { saveProgress(chapterNum, index + 1); renderPage(pages, index + 1, glossary, chapterNum); window.scrollTo(0,0); }
  };

  setupTooltips(glossary);
  saveProgress(chapterNum, index);
}

/* ----------------- init ----------------- */
async function initChapter() {
  const params = new URLSearchParams(window.location.search);
  const chapterNum = params.get('chapter');
  if (!chapterNum) return;

  document.getElementById('chapter-title').textContent = `Chapter ${chapterNum}`;

  const [glossary, raw] = await Promise.all([loadGlossary(), loadChapter(chapterNum)]);
  const pages = parsePages(raw);

  if (pages.length === 0) {
    // No tags → render whole chapter, no pagination UI but still hide tags if any.
    const cleaned = raw.replace(/\[startPage=\d+\]|\[endPage=\d+\]/g, '').trim();
    const container = document.getElementById('chapter-content');
    container.classList.add('dropcap'); // treat whole chapter as first page
    container.innerHTML = injectGlossary(wrapParagraphs(cleaned), glossary);
    document.getElementById('page-number-display').textContent = '';
    document.getElementById('page-counter').textContent = '';
    document.getElementById('prevPage').disabled = true;
    document.getElementById('nextPage').disabled = true;
    setupTooltips(glossary);
    return;
  }

  const startIndex = loadProgress(chapterNum, pages.length - 1);
  renderPage(pages, startIndex, glossary, chapterNum);
}

if (window.location.pathname.endsWith('chapter.html')) {
  initChapter();
}
