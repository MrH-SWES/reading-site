document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("content-area");
  container.innerHTML = `<h1>Teacher Editor</h1><p>Loading existing data...</p>`;

  const chEdit = document.createElement("div");
  const output = document.createElement("div");
  const glossaryText = document.createElement("textarea");
  const glossaryImages = document.createElement("textarea");
  const chapters = [];

  // Try to load manifest + glossary
  let manifest = [];
  let glossary = {};

  try {
    const mRes = await fetch("chapters/manifest.json");
    if (mRes.ok) manifest = await mRes.json();
  } catch (err) {
    console.warn("No manifest found, starting fresh");
  }

  try {
    const gRes = await fetch("glossary.json");
    if (gRes.ok) glossary = await gRes.json();
  } catch (err) {
    console.warn("No glossary found, starting fresh");
  }

  // Build UI structure
  container.innerHTML = `
    <h1>Teacher Editor</h1>

    <section class="chapter-editor">
      <h2>Chapters</h2>
      <div id="chapter-editor"></div>
      <button id="add-chapter">Add Chapter</button>
    </section>

    <section class="glossary-editor">
      <h2>Glossary</h2>
      <p>Edit or add terms: one per line as <code>term: definition</code>.</p>
      <textarea id="glossary-text" rows="10"></textarea>

      <p>Optional image URLs (same format):</p>
      <textarea id="glossary-images" rows="5"></textarea>
    </section>

    <section class="export-section">
      <button id="generate-files">Generate Updated Files</button>
    </section>

    <div id="output-area"></div>
  `;

  // Reference elements again
  const chContainer = document.getElementById("chapter-editor");
  const outDiv = document.getElementById("output-area");
  const glossaryDefEl = document.getElementById("glossary-text");
  const glossaryImgEl = document.getElementById("glossary-images");

  // --- Load chapters from manifest ---
  if (manifest.length > 0) {
    for (const ch of manifest) {
      let text = "";
      try {
        const res = await fetch(`chapters/${ch.file}`);
        if (res.ok) text = await res.text();
      } catch (e) {
        console.warn(`Could not load ${ch.file}`);
      }

      const div = document.createElement("div");
      div.classList.add("chapter-card");
      div.innerHTML = `
        <label>Chapter ${ch.number || ""} Title:</label>
        <input type="text" value="${ch.title || ""}">
        <label>Chapter Text:</label>
        <textarea rows="10">${text.trim()}</textarea>
      `;
      chContainer.appendChild(div);
      chapters.push(div);
    }
  } else {
    // If no manifest exists yet
    const div = document.createElement("div");
    div.classList.add("chapter-card");
    div.innerHTML = `
      <label>Chapter 1 Title:</label>
      <input type="text" placeholder="Chapter 1 title (optional)">
      <label>Chapter Text:</label>
      <textarea rows="10" placeholder="[startPage=1] ... [endPage=1]"></textarea>
    `;
    chContainer.appendChild(div);
    chapters.push(div);
  }

  // --- Load glossary into textareas ---
  if (Object.keys(glossary).length > 0) {
    const defs = [];
    const imgs = [];
    for (const [term, data] of Object.entries(glossary)) {
      if (typeof data === "object") {
        defs.push(`${term}: ${data.definition}`);
        if (data.image) imgs.push(`${term}: ${data.image}`);
      } else {
        defs.push(`${term}: ${data}`);
      }
    }
    glossaryDefEl.value = defs.join("\n");
    glossaryImgEl.value = imgs.join("\n");
  }

  // --- Add Chapter button ---
  document.getElementById("add-chapter").onclick = () => {
    const index = chapters.length + 1;
    const div = document.createElement("div");
    div.classList.add("chapter-card");
    div.innerHTML = `
      <label>Chapter ${index} Title:</label>
      <input type="text" placeholder="Chapter ${index} title (optional)">
      <label>Chapter Text:</label>
      <textarea rows="10" placeholder="[startPage=${index}] ... [endPage=${index}]"></textarea>
    `;
    chContainer.appendChild(div);
    chapters.push(div);
  };

  // --- Generate Updated Files ---
  document.getElementById("generate-files").onclick = () => {
    outDiv.innerHTML = "";

    // Parse glossary data
    const glossaryObj = buildGlossary(glossaryDefEl.value, glossaryImgEl.value);
    outputFile("glossary.json", JSON.stringify(glossaryObj, null, 2), outDiv);

    // Collect chapter data
    const newManifest = [];
    chapters.forEach((div, i) => {
      const [titleInput, textArea] = div.querySelectorAll("input, textarea");
      const title = titleInput.value.trim() || `Chapter ${i + 1}`;
      const filename = `chapter${i + 1}.txt`;
      newManifest.push({ number: i + 1, title, file: filename });
      outputFile(`chapters/${filename}`, textArea.value.trim(), outDiv);
    });

    outputFile("chapters/manifest.json", JSON.stringify(newManifest, null, 2), outDiv);

    // Build index.html
    const links = newManifest
      .map((c, i) => `<a href="chapter.html?chapter=${c.file}">Chapter ${i + 1}: ${c.title}</a>`)
      .join("\n  ");

    const indexTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reading Portal – Suqua</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main class="index-container">
  <div class="book-card">
    <img src="assets/suqua-cover.jpg" alt="Book cover" class="book-cover">
    <h1 class="book-title">Suqua</h1>
    <p class="book-author">by Diane Johnston Hamm</p>
    <p class="book-subtitle">Reading Portal</p>
    <div class="chapter-list">
      ${links}
    </div>
  </div>
</main>
</body>
</html>`;

    outputFile("index.html", indexTemplate.trim(), outDiv);
  };

  // --- Helper: build glossary object ---
  function buildGlossary(defText, imgText) {
    const glossaryObj = {};

    defText.split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const [term, ...rest] = line.split(":");
        if (term && rest.length)
          glossaryObj[term.trim()] = { definition: rest.join(":").trim() };
      });

    imgText.split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const [term, ...rest] = line.split(":");
        const imageUrl = rest.join(":").trim();
        const key = term.trim();
        if (term && imageUrl && glossaryObj[key])
          glossaryObj[key].image = imageUrl;
      });

    return glossaryObj;
  }

  // --- Helper: output file panels ---
  function outputFile(filename, content, container) {
    const div = document.createElement("div");
    div.classList.add("editor-panel");
    div.innerHTML = `
      <strong>${filename}</strong><br>
      <textarea readonly rows="8">${content}</textarea><br>
      <button class="copy-btn">Copy</button>
      <button class="download-btn">Download</button>
    `;
    container.appendChild(div);

    div.querySelector(".copy-btn").onclick = () => {
      navigator.clipboard.writeText(content);
      alert(`${filename} copied to clipboard`);
    };

    div.querySelector(".download-btn").onclick = () => {
      const blob = new Blob([content], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    };
  }
});
