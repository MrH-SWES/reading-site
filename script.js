let currentPage = 0;
let pages = [];
const pageNumberDisplay = document.querySelector('.page-number');
const chapterContainer = document.querySelector('.chapter-content');

async function loadChapter() {
  const urlParams = new URLSearchParams(window.location.search);
  const chapterFile = urlParams.get('chapter');
  const response = await fetch(`chapters/${chapterFile}`);
  const text = await response.text();
  pages = parsePages(text);
  renderPage();
}

function parsePages(text) {
  const sections = text.split(/\[startPage=(\d+)\]/g).slice(1);
  const pages = [];
  for (let i = 0; i < sections.length; i += 2) {
    const number = parseInt(sections[i]);
    const content = sections[i + 1].replace(/\[endPage=\d+\]/g, '').trim();
    pages.push({ number, content });
  }
  return pages;
}

function paragraphsFrom(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=\.)\s{2,}/g)
    .map(p => `<p>${p.trim()}</p>`)
    .join("\n");
}

function renderGlossary(text) {
  // basic placeholder replacement for glossary highlighting
  return paragraphsFrom(text);
}

function enhanceGlossary() {
  // if you need to attach events for glossary popups, do it here
}

function renderPage() {
  if (pages.length === 0) return;
  const page = pages[currentPage];
  pageNumberDisplay.textContent = `Page ${page.number}`;
  chapterContainer.innerHTML = renderGlossary(page.content);
  enhanceGlossary();

  // Drop cap only on first page
  const chapterWrapper = document.querySelector('.chapter-container');
  if (currentPage === 0) {
    chapterWrapper.classList.add('first-page');
  } else {
    chapterWrapper.classList.remove('first-page');
  }
}

function nextPage() {
  if (currentPage < pages.length - 1) {
    currentPage++;
    renderPage();
  }
}

function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    renderPage();
  }
}

document.querySelector('#nextBtn')?.addEventListener('click', nextPage);
document.querySelector('#prevBtn')?.addEventListener('click', prevPage);

loadChapter();
