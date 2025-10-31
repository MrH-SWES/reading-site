document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("content-area");
  container.innerHTML = `
    <h1>Teacher Editor</h1>

    <section class="chapter-editor">
      <h2>Add New Chapters</h2>
      <div id="chapter-editor"></div>
      <button id="add-chapter">Add Chapter</button>
    </section>

    <section class="glossary-editor">
      <h2>Glossary (bulk input)</h2>
      <p>Paste terms and definitions, one per line as <code>term: definition</code>.</p>
      <textarea id="glossary-text" rows="8" placeholder="cattail: tall wetland plant used for mats"></textarea>
      
      <p>Optional image URLs (same format):</p>
      <textarea id="glossary-images" rows="5" placeholder="cattail: https://example.com/image.jpg"></textarea>
      <button id="save-glossary">Preview Glossary JSON</button>
    </section>

    <section class="export-section">
      <button id="generate-files">Generate Files</button>
    </section>

    <div id="output-area"></div>
  `;

  const chEdit = document.getElementById("chapter-editor");
  const glossaryText = document.getElementById("glossary-text");
  const glossaryImages = document.getElementById("glossary-images");
  const output = document.getElementById("output-area");
  const chapters = [];

  // --- Add new chapter panel ---
  document.getElementById("add-chapter").onclick = () => {
    const index = chapters.length + 1;
    const div = document.createElement("div");
    div.classList.add("chapter-card");
    div.innerHTML = `
      <label>Chapter ${index} Title:</label>
      <input type="text" placeholder="Chapter ${index} title (optional)">
      <label>Chapter Text:</label>
      <textarea rows="10" placeholder="[startPage=1] ... [endPage=1]"></textarea>
    `;
    chEdit.appendChild(div);
    chapters.push(div);
  };

  // --- Preview glossary JSON ---
  document.getElementById("save-glossary").onclick = () => {
    const glossaryObj = buildGlossary(glossaryText.value, glossaryImages.value);
    const data = JSON.stringify(glossaryObj, null, 2);
    outputFile("glossary.json", data, output);
  };

  // --- Generate all output files ---
  document.getElementById("generate-files").onclick = () => {
    output.innerHTML = "";
    const glossaryObj = buildGlossary(glossaryText.value, glossaryImages.value);
    outputFile("glossary.json", JSON.stringify(glossaryObj, null, 2), output);

    const manifest = [];
    chapters.forEach((div, i) => {
      const [titleInput, textArea] = div.querySelectorAll("input, textarea");
      const title = titleInput.value.trim() || `Chapter ${i + 1}`;
      const filename = `chapter${i + 1}.txt`;
      manifest.push({ number: i + 1, title, file: filename });
      outputFile(`chapters/${filename}`, textArea.value.trim(), output);
    });

    const manifestData = JSON.stringify(manifest, null, 2);
    outputFile("chapters/manifest.json", manifestData, output);

    // Build index.html dynamically
    const links = manifest
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

    outputFile("index.html", indexTemplate.trim(), output);
  };

  // --- Helpers ---
  function buildGlossary(defText, imgText) {
    const glossaryObj = {};

    // Parse definitions
    defText
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const [term, ...rest] = line.split(":");
        if (term && rest.length)
          glossaryObj[term.trim()] = { definition: rest.join(":").trim() };
      });

    // Parse optional images
    imgText
      .split("\n")
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
