async function loadGlossary() {
  const res = await fetch('glossary.json');
  return await res.json();
}

async function loadChapter(chapterNum) {
  const res = await fetch(`chapters/chapter${chapterNum}.txt`);
  return await res.text();
}

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

async function initChapter() {
  const params = new URLSearchParams(window.location.search);
  const chapterNum = params.get('chapter');
  if (!chapterNum) return;

  document.getElementById('chapter-title').textContent = `Chapter ${chapterNum}`;
  const [glossary, chapterText] = await Promise.all([
    loadGlossary(),
    loadChapter(chapterNum)
  ]);

  const processed = injectGlossary(chapterText, glossary);
  document.getElementById('chapter-content').innerHTML = processed;
  setupTooltips(glossary);
}

if (window.location.pathname.endsWith('chapter.html')) {
  initChapter();
}
