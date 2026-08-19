/*
 * 単語リストの取り込み処理
 * - スプレッドシート(xlsx/csv): SheetJS
 * - 写真OCR: Tesseract.js
 * - PDF: pdf.js
 * - Word(.docx): mammoth
 * - テキスト: そのまま
 * いずれも {word, translation, sentence} の配列を返す。
 */
(function (global) {
  "use strict";

  // pdf.js ワーカー設定
  if (global.pdfjsLib) {
    global.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  // 1行テキストを {word, translation, sentence} に分解
  function parseLine(line) {
    const t = line.trim();
    if (!t) return null;
    // 区切り: タブ > カンマ > スラッシュ
    let parts;
    if (t.includes("\t")) parts = t.split("\t");
    else if (t.includes(",")) parts = t.split(",");
    else if (t.includes("/")) parts = t.split("/");
    else parts = [t];
    parts = parts.map((s) => s.trim());
    return {
      word: parts[0] || "",
      translation: parts[1] || "",
      sentence: parts[2] || "",
    };
  }

  function parseTextBlock(text) {
    return text.split(/\r?\n/).map(parseLine).filter(Boolean);
  }

  // 英文テキストから英単語候補を抽出(頻度順・ストップワード除外)
  const STOP = new Set(("a an the and or but if then of to in on at by for with from into "
    + "as is are was were be been being do does did have has had will would shall should "
    + "can could may might must not no nor so than that this these those i you he she it we "
    + "they me him her us them my your his its our their who whom which what when where why how "
    + "there here also very just more most much many some any all each every both few other "
    + "such only own same too s t re ve ll d m o").split(/\s+/));

  function extractWords(text, limit) {
    const raw = (text.match(/[A-Za-z][A-Za-z'-]+/g) || [])
      .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
      .filter((w) => w.length >= 3);
    const freq = new Map();
    const firstSeen = new Map();
    let idx = 0;
    for (const w of raw) {
      const lw = w.toLowerCase();
      if (STOP.has(lw)) { idx++; continue; }
      if (!/^[a-z]+$/.test(lw)) { idx++; continue; }
      freq.set(lw, (freq.get(lw) || 0) + 1);
      if (!firstSeen.has(lw)) firstSeen.set(lw, idx);
      idx++;
    }
    const words = Array.from(freq.keys());
    // 出現頻度が高い順、同数なら出現が早い順
    words.sort((a, b) => (freq.get(b) - freq.get(a)) || (firstSeen.get(a) - firstSeen.get(b)));
    return words.slice(0, limit || 100).map((w) => ({ word: w, translation: "", sentence: "" }));
  }

  // ---- スプレッドシート ----
  async function fromSpreadsheet(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const out = [];
    for (const row of rows) {
      if (!row || row.length === 0) continue;
      const word = String(row[0] == null ? "" : row[0]).trim();
      if (!word) continue;
      // ヘッダー行らしきものはスキップ
      if (/^(word|英単語|単語|english)$/i.test(word)) continue;
      out.push({
        word,
        translation: String(row[1] == null ? "" : row[1]).trim(),
        sentence: String(row[2] == null ? "" : row[2]).trim(),
      });
    }
    return out;
  }

  // ---- 写真OCR ----
  async function fromImage(file, onProgress) {
    const url = URL.createObjectURL(file);
    try {
      const result = await Tesseract.recognize(url, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        },
      });
      return extractWords(result.data.text, 100);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---- PDF ----
  async function fromPdf(file, onProgress) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += " " + content.items.map((i) => i.str).join(" ");
      if (onProgress) onProgress(Math.round((p / pdf.numPages) * 100));
    }
    return extractWords(text, 100);
  }

  // ---- Word(.docx) ----
  async function fromDocx(file) {
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return extractWords(res.value, 100);
  }

  async function fromTextFile(file) {
    const text = await file.text();
    return extractWords(text, 100);
  }

  async function fromDocument(file, onProgress) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return fromPdf(file, onProgress);
    if (name.endsWith(".docx")) return fromDocx(file);
    return fromTextFile(file);
  }

  global.WordImport = {
    parseTextBlock,
    fromSpreadsheet,
    fromImage,
    fromDocument,
    extractWords,
  };
})(window);
