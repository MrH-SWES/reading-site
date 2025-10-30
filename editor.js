function setupEditor() {
  const container = document.getElementById('content-area');
  let chapters = [];

  container.innerHTML = `
    <div class="editor-panel">
      <h2>Chapters</h2>
      <div id="chapter-editor"></div>
      <button id="add-chapter">Add Chapter</button>
    </div>

    <div class="editor-panel">
      <h2>Glossary (bulk input)</h2>
      <p>Paste terms and definitions, one per line as <code>term: definition</code>.</p>
      <textarea id="glossary-text" rows="10"></textarea>

      <p>Optional image URLs (same format):</p>
      <textarea id="glossary-images" rows="5"></textarea>
    </div>

    <div class="editor-panel" style="text-align:center;">
      <button id="generate-files">Generate Files</button>
    </div>

    <div id="output-area"></div>
  `;

  const chEdit = document.getElementById('chapter-editor');
  const glossaryText = document.getElementById('glossary-text');
  const glossaryImages = document.getElementById('glossary-images');
  const output = document.getElementById('output-area');

  document.getElementById('add-chapter').onclick = () => {
    const index = chapters.length + 1;
    const div = document.createElement('div');
    div.classList.add('chapter-card');
    div.innerHTML = `
      <input type="text" placeholder="Chapter ${index} title (optional)">
      <textarea rows="8" placeholder="Paste chapter text here"></textarea>
    `;
    chEdit.appendChild(div);
    chapters.push(div);
  };

  document.getElementById('generate-files').onclick = async () => {
    output.innerHTML = "";

    // Parse glossary
    const glossaryObj = {};
    glossaryText.value
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const [term, ...rest] = line.split(":");
        if (term && rest.length) {
          // **FIX:** Always create an object with a definition property
          glossaryObj[term.trim().toLowerCase()] = {
            definition: rest.join(":").trim()
          };
        }
      });

    // Parse glossary images (optional)
    glossaryImages.value
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const [term, ...rest] = line.split(":");
        const imageUrl = rest.join(":").trim();
        const t = term.trim().toLowerCase();
        // **FIX:** Check if the term object exists, then add the image property
        if (term && imageUrl && glossaryObj[t]) {
          glossaryObj[t].image = imageUrl;
        }
      });

    // Output glossary.json
    const glossaryData = JSON.stringify(glossaryObj, null, 2);
    outputFile("glossary.json", glossaryData, output);

    // Build manifest for chapters
    const manifest = [];

    chapters.forEach((div, i) => {
      const [titleInput, textArea] = div.querySelectorAll("input, textarea");
      const title = titleInput.value.trim() || `Chapter ${i + 1}`;
      const filename = `chapter${i + 1}.txt`;

      manifest.push({ file: filename, title });
      outputFile(`chapters/${filename}`, textArea.value.trim(), output);
    });

    const manifestData = JSON.stringify(manifest, null, 2);
    outputFile("chapters/manifest.json", manifestData, output);

    // Build index.html dynamically
    const links = manifest
      .map((c, i) => `<a href="chapter.html?chapter=${c.file}">Chapter ${i + 1}: ${c.title}</a>`)
      .join("\n  ");

    const indexTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reading Portal</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main class="index-container">
  <div class="book-card">
    <img src="assets/suqua-cover.jpg" alt="Book cover" class="book-cover">
    <h1 class="book-title">Daughter of Suqua</h1>
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
}

// Create downloadable/copyable file panels
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

setupEditor();
