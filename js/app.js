/*
 * メインアプリ: UI操作・単語リスト管理・クロスワード描画・PDF出力
 */
(function () {
  "use strict";

  const MAX_WORDS = 100;
  let words = [];          // {word, translation, sentence}
  let puzzle = null;       // Crossword.generate の結果

  const $ = (id) => document.getElementById(id);

  const SAMPLE = [
    ["apple", "りんご", "She put an ( ) in her lunch box."],
    ["honest", "正直な", "An ( ) student never cheats on tests."],
    ["courage", "勇気", "It takes ( ) to speak in front of the class."],
    ["nature", "自然", "We hiked to enjoy the beauty of ( )."],
    ["silent", "静かな", "The library was completely ( )."],
    ["improve", "改善する", "Practice will ( ) your English quickly."],
    ["reason", "理由", "Tell me the ( ) you were late."],
    ["travel", "旅行する", "I want to ( ) around the world someday."],
    ["future", "未来", "Nobody can predict the ( )."],
    ["danger", "危険", "The sign warns us of ( ) ahead."],
    ["gentle", "優しい", "He spoke in a ( ) voice to the child."],
    ["remind", "思い出させる", "This song ( )s me of summer."],
    ["effort", "努力", "Success is the result of hard ( )."],
    ["planet", "惑星", "The Earth is the third ( ) from the sun."],
    ["ocean", "海", "Whales live in the deep ( )."],
    ["custom", "習慣", "Bowing is a ( ) in Japan."],
  ];

  /* ---------------- タブ切り替え ---------------- */
  document.querySelectorAll("#importTabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#importTabs .tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $("panel-" + tab.dataset.tab).classList.add("active");
    });
  });

  /* ---------------- 出題形式の選択見た目 ---------------- */
  document.querySelectorAll('input[name="clueType"]').forEach((r) => {
    r.addEventListener("change", () => {
      document.querySelectorAll(".clue-opt").forEach((o) => o.classList.remove("sel"));
      r.closest(".clue-opt").classList.add("sel");
    });
  });

  /* ---------------- 単語リスト管理 ---------------- */
  function addWords(list) {
    for (const w of list) {
      if (!w.word || !w.word.trim()) continue;
      if (words.length >= MAX_WORDS) break;
      words.push({
        word: w.word.trim(),
        translation: (w.translation || "").trim(),
        sentence: (w.sentence || "").trim(),
      });
    }
    renderTable();
  }

  function renderTable() {
    const body = $("wordBody");
    body.innerHTML = "";
    if (words.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="empty-msg">まだ単語がありません。STEP 1 で追加してください。</td></tr>';
    } else {
      words.forEach((w, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td class="eng"><input data-i="' + i + '" data-f="word" value="' + esc(w.word) + '"></td>' +
          '<td><input data-i="' + i + '" data-f="translation" value="' + esc(w.translation) + '" placeholder="和訳"></td>' +
          '<td><input data-i="' + i + '" data-f="sentence" value="' + esc(w.sentence) + '" placeholder="例文 ( )"></td>' +
          '<td><button class="row-del" data-del="' + i + '" title="削除">×</button></td>';
        body.appendChild(tr);
      });
    }
    // 件数バッジ
    const badge = $("countBadge");
    badge.textContent = words.length + " / " + MAX_WORDS;
    badge.classList.toggle("over", words.length > MAX_WORDS);
  }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // テーブル編集
  $("wordBody").addEventListener("input", (e) => {
    const inp = e.target;
    if (inp.dataset.f) {
      words[+inp.dataset.i][inp.dataset.f] = inp.value;
    }
  });
  $("wordBody").addEventListener("click", (e) => {
    if (e.target.dataset.del != null) {
      words.splice(+e.target.dataset.del, 1);
      renderTable();
    }
  });

  $("addRow").addEventListener("click", () => {
    if (words.length >= MAX_WORDS) return alert("単語は最大" + MAX_WORDS + "語までです。");
    words.push({ word: "", translation: "", sentence: "" });
    renderTable();
  });
  $("clearAll").addEventListener("click", () => {
    if (words.length && !confirm("すべての単語を削除しますか？")) return;
    words = [];
    renderTable();
  });

  /* ---------------- 手入力 ---------------- */
  $("addManual").addEventListener("click", () => {
    const parsed = WordImport.parseTextBlock($("manualInput").value);
    if (parsed.length === 0) return;
    addWords(parsed);
    $("manualInput").value = "";
  });
  $("loadSample").addEventListener("click", () => {
    addWords(SAMPLE.map((r) => ({ word: r[0], translation: r[1], sentence: r[2] })));
  });

  /* ---------------- ファイル取り込み共通 ---------------- */
  function wireDrop(dropId, inputId, handler) {
    const drop = $(dropId), input = $(inputId);
    input.addEventListener("change", () => { if (input.files[0]) handler(input.files[0]); input.value = ""; });
    ["dragover", "dragenter"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]); });
  }

  function setStatus(id, msg, cls) {
    const el = $(id);
    el.textContent = msg;
    el.className = "status" + (cls ? " " + cls : "");
  }

  // スプレッドシート
  wireDrop("dropSheet", "fileSheet", async (file) => {
    setStatus("statusSheet", "読み込み中…", "busy");
    try {
      const list = await WordImport.fromSpreadsheet(file);
      addWords(list);
      setStatus("statusSheet", list.length + " 語を追加しました。", "ok");
    } catch (err) {
      setStatus("statusSheet", "読み込みに失敗しました: " + err.message, "err");
    }
  });

  // 写真OCR
  wireDrop("dropPhoto", "filePhoto", async (file) => {
    setStatus("statusPhoto", "画像を解析中… 0%", "busy");
    try {
      const list = await WordImport.fromImage(file, (p) => setStatus("statusPhoto", "画像を解析中… " + p + "%", "busy"));
      addWords(list);
      setStatus("statusPhoto", list.length + " 語を抽出しました。和訳はリストで編集してください。", "ok");
    } catch (err) {
      setStatus("statusPhoto", "解析に失敗しました: " + err.message, "err");
    }
  });

  // PDF / Word / txt
  wireDrop("dropDoc", "fileDoc", async (file) => {
    setStatus("statusDoc", "文書を解析中…", "busy");
    try {
      const list = await WordImport.fromDocument(file, (p) => setStatus("statusDoc", "文書を解析中… " + p + "%", "busy"));
      addWords(list);
      setStatus("statusDoc", list.length + " 語を抽出しました。和訳はリストで編集してください。", "ok");
    } catch (err) {
      setStatus("statusDoc", "解析に失敗しました: " + err.message, "err");
    }
  });

  /* ---------------- ヒント文の生成 ---------------- */
  function clueType() {
    return document.querySelector('input[name="clueType"]:checked').value;
  }

  // 例文の空所を整える。( )が無ければ単語をブランク化。
  function blankSentence(entry) {
    let s = entry.sentence;
    if (!s) return "";
    if (/（\s*）|\(\s*\)/.test(s)) {
      return s.replace(/（\s*）/g, "(          )").replace(/\(\s*\)/g, "(          )");
    }
    // 単語自体を空所に置換(語形変化も少し許容)
    const re = new RegExp("\\b" + entry.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*", "i");
    if (re.test(s)) return s.replace(re, "(          )");
    return s + "  ( " + entry.word.length + " letters )";
  }

  function buildClue(entry) {
    const type = clueType();
    const sent = blankSentence(entry);
    const ja = entry.translation;
    if (type === "ja") {
      return ja || "（" + entry.word.length + "文字の単語）";
    }
    if (type === "fill") {
      return sent || (ja ? "「" + ja + "」" : "（" + entry.word.length + "文字）");
    }
    // fill_ja
    const bits = [];
    if (sent) bits.push(sent);
    if (ja) bits.push("（" + ja + "）");
    if (bits.length === 0) return "（" + entry.word.length + "文字の単語）";
    return bits.join("  ");
  }

  /* ---------------- 生成 ---------------- */
  function generate() {
    // テーブルの最新値を取り込む(念のため)
    const valid = words.filter((w) => (w.word || "").replace(/[^A-Za-z]/g, "").length >= 2);
    if (valid.length < 2) {
      setStatus("genStatus", "英単語を2語以上（2文字以上の語で）入れてください。", "err");
      return;
    }
    setStatus("genStatus", "生成中…", "busy");
    // 少し待ってから重い処理(UI更新のため)
    setTimeout(() => {
      puzzle = Crossword.generate(valid, 60);
      if (!puzzle || puzzle.placedCount === 0) {
        setStatus("genStatus", "クロスワードを作れませんでした。単語を増やすか、共通文字の多い語を入れてください。", "err");
        return;
      }
      setStatus("genStatus", "", "");
      renderResult();
      $("result").style.display = "block";
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  $("generateBtn").addEventListener("click", generate);
  $("regenBtn").addEventListener("click", generate);

  $("showAnswers").addEventListener("change", () => {
    $("gridHost").querySelectorAll(".cw-cell.fill").forEach((c) => {
      c.classList.toggle("hide-letter", !$("showAnswers").checked);
    });
  });

  // 出題形式を変えたら結果も更新
  document.querySelectorAll('input[name="clueType"]').forEach((r) =>
    r.addEventListener("change", () => { if (puzzle) renderResult(); }));

  function renderResult() {
    // グリッド
    const host = $("gridHost");
    host.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "cw-grid";
    grid.style.gridTemplateColumns = "repeat(" + puzzle.cols + ", 34px)";
    const showAns = $("showAnswers").checked;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const letter = puzzle.cells[r + "," + c];
        const cell = document.createElement("div");
        if (letter) {
          cell.className = "cw-cell fill" + (showAns ? "" : " hide-letter");
          const num = puzzle.numberAt[r + "," + c];
          if (num) cell.innerHTML = '<span class="num">' + num + "</span>";
          cell.appendChild(document.createTextNode(letter));
        } else {
          cell.className = "cw-cell block";
        }
        grid.appendChild(cell);
      }
    }
    host.appendChild(grid);

    // カギ
    renderClueList($("acrossList"), puzzle.across);
    renderClueList($("downList"), puzzle.down);

    // 未配置語
    const un = $("unplacedHost");
    if (puzzle.unplaced && puzzle.unplaced.length) {
      un.innerHTML = '<div class="unplaced-note">交差が作れず盤面に入らなかった語: ' +
        puzzle.unplaced.map((u) => esc(u.raw || u.word)).join(", ") +
        '　（別レイアウトで再生成すると入る場合があります）</div>';
    } else un.innerHTML = "";
  }

  function renderClueList(ol, items) {
    ol.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.innerHTML = '<span class="cnum">' + it.number + '</span>' +
        '<span>' + esc(buildClue(it.entry)) + ' <span class="len">(' + it.entry.word.length + ')</span></span>';
      ol.appendChild(li);
    });
  }

  /* ---------------- PDF出力 ---------------- */
  // 日本語対応のため、HTMLを html2canvas でラスタライズして jsPDF に貼る。
  $("downloadPdf").addEventListener("click", exportPdf);

  function gridTableHtml(showLetters) {
    const cell = 30;
    let html = '<table style="border-collapse:collapse; margin:0 auto;">';
    for (let r = 0; r < puzzle.rows; r++) {
      html += "<tr>";
      for (let c = 0; c < puzzle.cols; c++) {
        const letter = puzzle.cells[r + "," + c];
        if (letter) {
          const num = puzzle.numberAt[r + "," + c];
          html += '<td style="width:' + cell + 'px;height:' + cell + 'px;border:1px solid #333;' +
            'position:relative;text-align:center;vertical-align:middle;font-family:Times New Roman,serif;' +
            'font-size:16px;font-weight:700;background:#fff;">' +
            (num ? '<span style="position:absolute;top:0;left:2px;font-size:8px;font-weight:700;font-family:sans-serif;color:#333;">' + num + "</span>" : "") +
            (showLetters ? letter : "") + "</td>";
        } else {
          html += '<td style="width:' + cell + 'px;height:' + cell + 'px;border:none;"></td>';
        }
      }
      html += "</tr>";
    }
    return html + "</table>";
  }

  function clueTableHtml(items) {
    let html = '<table class="pa-clues">';
    items.forEach((it) => {
      html += '<tr><td class="n">' + it.number + '</td><td>' + esc(buildClue(it.entry)) +
        ' <span style="color:#888;font-size:11px;">(' + it.entry.word.length + ')</span></td></tr>';
    });
    return html + "</table>";
  }

  async function exportPdf() {
    if (!puzzle) return;
    const btn = $("downloadPdf");
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = "PDFを作成中…";
    try {
      const area = $("printArea");
      // --- 問題ページ ---
      area.innerHTML =
        '<div class="pa-title">英単語クロスワード</div>' +
        '<div class="pa-sub">Name:_______________________　Date:__________　（全 ' + (puzzle.across.length + puzzle.down.length) + ' 問）</div>' +
        gridTableHtml(false) +
        '<div class="pa-section">ヨコのカギ (Across)</div>' + clueTableHtml(puzzle.across) +
        '<div class="pa-section">タテのカギ (Down)</div>' + clueTableHtml(puzzle.down);

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      await addElementAsPages(pdf, area, false);

      // --- 解答ページ ---
      area.innerHTML =
        '<div class="pa-title">解答 (Answer Key)</div>' +
        '<div class="pa-sub">英単語クロスワード</div>' +
        gridTableHtml(true);
      await addElementAsPages(pdf, area, true);

      pdf.save("crossword.pdf");
    } catch (err) {
      alert("PDFの作成に失敗しました: " + err.message);
    } finally {
      $("printArea").innerHTML = "";
      btn.disabled = false; btn.textContent = old;
    }
  }

  // 要素をA4幅に合わせて画像化し、必要なら複数ページに分割して追加
  async function addElementAsPages(pdf, el, newPage) {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pw - margin * 2;
    const usableH = ph - margin * 2;
    const imgH = (canvas.height * usableW) / canvas.width; // mm換算後の全体高さ

    if (newPage) pdf.addPage();

    if (imgH <= usableH) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, usableW, imgH);
      return;
    }
    // 高さがページを超える場合はスライスして複数ページに
    const pageCanvasHeightPx = (usableH / usableW) * canvas.width;
    let y = 0, first = true;
    while (y < canvas.height) {
      const sliceH = Math.min(pageCanvasHeightPx, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const h = (sliceH * usableW) / canvas.width;
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, margin, usableW, h);
      first = false;
      y += sliceH;
    }
  }

  /* ---------------- 初期化 ---------------- */
  renderTable();
})();
