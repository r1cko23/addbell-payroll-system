const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("@playwright/test");

const guidePath = path.join(
  process.cwd(),
  "docs",
  "guides",
  "EMPLOYEE_PORTAL_GUIDEBOOK.md"
);
const outputHtmlPath = path.join(
  process.cwd(),
  "docs",
  "guides",
  "EMPLOYEE_PORTAL_GUIDEBOOK.export.html"
);
const outputPdfPath = path.join(
  process.cwd(),
  "docs",
  "guides",
  "EMPLOYEE_PORTAL_GUIDEBOOK.pdf"
);

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return html;
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let ul = [];
  let ol = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushUl = () => {
    if (!ul.length) return;
    blocks.push(`<ul>${ul.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    ul = [];
  };

  const flushOl = () => {
    if (!ol.length) return;
    blocks.push(`<ol>${ol.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
    ol = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushUl();
    flushOl();
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const clean = trimmed.trim();

    if (!clean) {
      flushAll();
      continue;
    }

    const imageMatch = clean.match(/^!\[(.*)\]\((.*)\)$/);
    if (imageMatch) {
      flushAll();
      const [, alt, src] = imageMatch;
      blocks.push(
        `<figure><img src="${encodeURI(src)}" alt="${escapeHtml(
          alt
        )}" /><figcaption>${escapeHtml(alt)}</figcaption></figure>`
      );
      continue;
    }

    if (/^---+$/.test(clean)) {
      flushAll();
      blocks.push("<hr />");
      continue;
    }

    if (clean.startsWith("# ")) {
      flushAll();
      blocks.push(`<h1>${inlineMarkdown(clean.slice(2))}</h1>`);
      continue;
    }

    if (clean.startsWith("## ")) {
      flushAll();
      blocks.push(`<h2>${inlineMarkdown(clean.slice(3))}</h2>`);
      continue;
    }

    if (clean.startsWith("### ")) {
      flushAll();
      blocks.push(`<h3>${inlineMarkdown(clean.slice(4))}</h3>`);
      continue;
    }

    const orderedMatch = clean.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushUl();
      ol.push(orderedMatch[1]);
      continue;
    }

    const unorderedMatch = clean.match(/^-\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushOl();
      ul.push(unorderedMatch[1]);
      continue;
    }

    flushUl();
    flushOl();
    paragraph.push(clean);
  }

  flushAll();
  return blocks.join("\n");
}

function buildHtml(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Employee Portal Guidebook</title>
  <style>
    :root {
      --text: #1f2937;
      --muted: #6b7280;
      --border: #d1d5db;
      --accent: #0f766e;
      --bg-soft: #f8fafc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--text);
      line-height: 1.6;
      background: white;
    }
    main {
      max-width: 840px;
      margin: 0 auto;
      padding: 36px 40px 56px;
    }
    h1, h2, h3 {
      line-height: 1.25;
      margin-top: 1.35em;
      margin-bottom: 0.55em;
      color: #111827;
    }
    h1 {
      margin-top: 0;
      font-size: 30px;
      border-bottom: 3px solid var(--accent);
      padding-bottom: 10px;
    }
    h2 {
      font-size: 22px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 17px;
      color: #0f172a;
      page-break-after: avoid;
    }
    p, li {
      font-size: 13px;
    }
    p {
      margin: 0 0 10px;
    }
    ul, ol {
      margin: 0 0 12px 22px;
      padding: 0;
    }
    li + li {
      margin-top: 4px;
    }
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 24px 0;
    }
    code {
      background: var(--bg-soft);
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 0.95em;
    }
    strong {
      color: #111827;
    }
    figure {
      margin: 18px 0 24px;
      page-break-inside: avoid;
    }
    img {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 10px;
      display: block;
      background: white;
    }
    figcaption {
      margin-top: 8px;
      font-size: 11px;
      color: var(--muted);
      text-align: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: var(--bg-soft);
    }
    @page {
      size: A4;
      margin: 18mm 14mm;
    }
  </style>
</head>
<body>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

async function main() {
  const markdown = fs.readFileSync(guidePath, "utf8");
  const body = renderMarkdown(markdown);
  const html = buildHtml(body);
  fs.writeFileSync(outputHtmlPath, html, "utf8");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(outputHtmlPath).href, {
      waitUntil: "networkidle",
    });
    await page.pdf({
      path: outputPdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });
  } finally {
    await browser.close();
  }

  console.log(outputPdfPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
