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

  // 出題形式を変えたら結果も更新
  document.querySelectorAll('input[name="clueType"]').forEach((r) =>
    r.addEventListener("change", () => { if (puzzle) renderResult(); }));

  /* ---------------- 盤面描画 & 入力 ---------------- */
  let inputs = {};      // "r,c" -> input要素
  let cellWords = {};   // "r,c" -> {H: item, V: item}
  let curDir = "H";
  let curCell = null;   // "r,c"

  function renderResult() {
    inputs = {};
    cellWords = {};
    curCell = null;

    // セル→単語の索引
    puzzle.across.concat(puzzle.down).forEach((it) => {
      const dr = it.dir === "V" ? 1 : 0, dc = it.dir === "H" ? 1 : 0;
      for (let i = 0; i < it.entry.word.length; i++) {
        const k = (it.r + dr * i) + "," + (it.c + dc * i);
        if (!cellWords[k]) cellWords[k] = {};
        cellWords[k][it.dir] = it;
      }
    });

    const host = $("gridHost");
    host.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "cw-grid";
    grid.style.gridTemplateColumns = "repeat(" + puzzle.cols + ", 34px)";

    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const k = r + "," + c;
        const letter = puzzle.cells[k];
        const cell = document.createElement("div");
        if (letter) {
          cell.className = "cw-cell fill";
          cell.dataset.k = k;
          const num = puzzle.numberAt[k];
          if (num) cell.innerHTML = '<span class="num">' + num + "</span>";
          const inp = document.createElement("input");
          inp.maxLength = 1;
          inp.autocapitalize = "characters";
          inp.autocomplete = "off";
          inp.dataset.k = k;
          inp.setAttribute("aria-label", "row " + (r + 1) + " column " + (c + 1));
          cell.appendChild(inp);
          inputs[k] = inp;
        } else {
          cell.className = "cw-cell block";
        }
        grid.appendChild(cell);
      }
    }
    host.appendChild(grid);
    wireGrid();

    renderClueList($("acrossList"), puzzle.across);
    renderClueList($("downList"), puzzle.down);

    const un = $("unplacedHost");
    if (puzzle.unplaced && puzzle.unplaced.length) {
      un.innerHTML = '<div class="unplaced-note">交差が作れず盤面に入らなかった語: ' +
        puzzle.unplaced.map((u) => esc(u.raw || u.word)).join(", ") +
        '　（別レイアウトで再生成すると入る場合があります）</div>';
    } else un.innerHTML = "";

    $("practiceCard").style.display = "none";
    updateProgress();
  }

  function renderClueList(ol, items) {
    ol.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.dataset.dir = it.dir;
      li.dataset.num = it.number;
      li.style.cursor = "pointer";
      li.innerHTML = '<span class="cnum">' + it.number + '</span>' +
        '<span>' + esc(buildClue(it.entry)) + ' <span class="len">(' + it.entry.word.length + ')</span></span>';
      li.addEventListener("click", () => focusCell(it.r + "," + it.c, it.dir));
      ol.appendChild(li);
    });
  }

  const parseK = (k) => k.split(",").map(Number);

  // 現在の方向の単語(無ければ他方向)
  function wordFor(k, dir) {
    const w = cellWords[k];
    if (!w) return null;
    return w[dir] || w[dir === "H" ? "V" : "H"] || null;
  }

  function focusCell(k, dir) {
    if (!inputs[k]) return;
    if (dir) curDir = cellWords[k] && cellWords[k][dir] ? dir : curDir;
    curCell = k;
    inputs[k].focus();
    inputs[k].select();
    highlight();
  }

  function highlight() {
    document.querySelectorAll(".cw-cell.fill").forEach((c) => c.classList.remove("in-word", "active"));
    document.querySelectorAll(".clue-list li").forEach((l) => l.classList.remove("hl"));
    if (!curCell) return;
    const it = wordFor(curCell, curDir);
    if (!it) return;
    curDir = it.dir;
    const dr = it.dir === "V" ? 1 : 0, dc = it.dir === "H" ? 1 : 0;
    for (let i = 0; i < it.entry.word.length; i++) {
      const k = (it.r + dr * i) + "," + (it.c + dc * i);
      const cell = document.querySelector('.cw-cell[data-k="' + k + '"]');
      if (cell) cell.classList.add("in-word");
    }
    const active = document.querySelector('.cw-cell[data-k="' + curCell + '"]');
    if (active) active.classList.add("active");

    const li = document.querySelector('.clue-list li[data-dir="' + it.dir + '"][data-num="' + it.number + '"]');
    if (li) li.classList.add("hl");

    const cc = $("currentClue");
    cc.className = "current-clue on";
    cc.innerHTML = "<b>" + it.number + " " + (it.dir === "H" ? "ヨコ" : "タテ") + "</b>　" +
      esc(buildClue(it.entry)) + " <span class='len'>(" + it.entry.word.length + ")</span>";
  }

  // 方向に沿って step 分移動
  function step(k, dir, delta) {
    const [r, c] = parseK(k);
    const nk = dir === "H" ? r + "," + (c + delta) : (r + delta) + "," + c;
    return inputs[nk] ? nk : null;
  }

  function wireGrid() {
    const host = $("gridHost");

    host.addEventListener("mousedown", (e) => {
      const inp = e.target.closest("input");
      if (!inp) return;
      const k = inp.dataset.k;
      // 同じマスを再クリック → タテ／ヨコ切替
      if (k === curCell && cellWords[k].H && cellWords[k].V) {
        curDir = curDir === "H" ? "V" : "H";
      } else if (cellWords[k] && !cellWords[k][curDir]) {
        curDir = cellWords[k].H ? "H" : "V";
      }
      curCell = k;
      setTimeout(highlight, 0);
    });

    host.addEventListener("focusin", (e) => {
      const inp = e.target.closest("input");
      if (!inp) return;
      if (curCell !== inp.dataset.k) { curCell = inp.dataset.k; }
      if (cellWords[curCell] && !cellWords[curCell][curDir]) {
        curDir = cellWords[curCell].H ? "H" : "V";
      }
      highlight();
    });

    host.addEventListener("input", (e) => {
      const inp = e.target.closest("input");
      if (!inp) return;
      const v = inp.value.replace(/[^A-Za-z]/g, "").toUpperCase();
      inp.value = v.slice(-1);
      inp.parentElement.classList.remove("wrong", "correct", "revealed");
      if (inp.value) {
        const nk = step(inp.dataset.k, curDir, 1);
        if (nk) focusCell(nk);
      }
      updateProgress();
    });

    host.addEventListener("keydown", (e) => {
      const inp = e.target.closest("input");
      if (!inp) return;
      const k = inp.dataset.k;
      const moves = { ArrowRight: ["H", 1], ArrowLeft: ["H", -1], ArrowDown: ["V", 1], ArrowUp: ["V", -1] };
      if (moves[e.key]) {
        e.preventDefault();
        const [d, delta] = moves[e.key];
        const nk = step(k, d, delta);
        if (nk) { curDir = d; focusCell(nk); }
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        inp.parentElement.classList.remove("wrong", "correct", "revealed");
        if (inp.value) { inp.value = ""; }
        else {
          const pk = step(k, curDir, -1);
          if (pk) { inputs[pk].value = ""; inputs[pk].parentElement.classList.remove("wrong", "correct", "revealed"); focusCell(pk); }
        }
        updateProgress();
        return;
      }
      if (e.key === " " || e.key === "Tab") {
        e.preventDefault();
        if (e.key === " ") { curDir = curDir === "H" ? "V" : "H"; highlight(); }
        else jumpWord(e.shiftKey ? -1 : 1);
      }
    });
  }

  // 次／前の単語へ
  function jumpWord(delta) {
    const all = puzzle.across.concat(puzzle.down);
    const it = curCell ? wordFor(curCell, curDir) : null;
    let idx = it ? all.indexOf(it) : -1;
    idx = (idx + delta + all.length) % all.length;
    const t = all[idx];
    curDir = t.dir;
    focusCell(t.r + "," + t.c, t.dir);
  }

  /* ---------------- 答え合わせ・進捗 ---------------- */
  function updateProgress() {
    const keys = Object.keys(inputs);
    let filled = 0;
    keys.forEach((k) => { if (inputs[k].value) filled++; });
    $("solveBar").style.width = (keys.length ? (filled / keys.length) * 100 : 0) + "%";
    $("solveText").textContent = filled + " / " + keys.length + " マス";

    // 単語ごとの完成チェック(カギに印)
    puzzle.across.concat(puzzle.down).forEach((it) => {
      const li = document.querySelector('.clue-list li[data-dir="' + it.dir + '"][data-num="' + it.number + '"]');
      if (li) li.classList.toggle("done", wordSolved(it));
    });

    if (filled === keys.length && keys.length > 0 && allCorrect()) onComplete();
  }

  function wordSolved(it) {
    const dr = it.dir === "V" ? 1 : 0, dc = it.dir === "H" ? 1 : 0;
    for (let i = 0; i < it.entry.word.length; i++) {
      const k = (it.r + dr * i) + "," + (it.c + dc * i);
      if ((inputs[k].value || "").toUpperCase() !== puzzle.cells[k]) return false;
    }
    return true;
  }

  function allCorrect() {
    return Object.keys(inputs).every((k) => (inputs[k].value || "").toUpperCase() === puzzle.cells[k]);
  }

  $("checkBtn").addEventListener("click", () => {
    let wrong = 0, blank = 0;
    Object.keys(inputs).forEach((k) => {
      const cell = inputs[k].parentElement;
      cell.classList.remove("wrong", "correct");
      const v = (inputs[k].value || "").toUpperCase();
      if (!v) { blank++; return; }
      if (v === puzzle.cells[k]) cell.classList.add("correct");
      else { cell.classList.add("wrong"); wrong++; }
    });
    if (wrong === 0 && blank === 0) { onComplete(); }
    else setStatus("genStatus", "誤り " + wrong + " マス / 未入力 " + blank + " マス", wrong ? "err" : "busy");
  });

  $("revealBtn").addEventListener("click", () => {
    if (!confirm("すべての解答を表示しますか？")) return;
    Object.keys(inputs).forEach((k) => {
      if ((inputs[k].value || "").toUpperCase() !== puzzle.cells[k]) {
        inputs[k].value = puzzle.cells[k];
        inputs[k].parentElement.classList.add("revealed");
      }
    });
    updateProgress();
    showPractice();  // 解答表示後も音読練習は使えるように
  });

  $("clearGridBtn").addEventListener("click", () => {
    Object.keys(inputs).forEach((k) => {
      inputs[k].value = "";
      inputs[k].parentElement.classList.remove("wrong", "correct", "revealed");
    });
    $("practiceCard").style.display = "none";
    setStatus("genStatus", "", "");
    updateProgress();
  });

  function onComplete() {
    setStatus("genStatus", "", "");
    Object.keys(inputs).forEach((k) => inputs[k].parentElement.classList.remove("wrong"));
    showPractice();
    $("practiceCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- 音読・録音練習 ---------------- */
  // 例文の空所を単語で埋めた「完全な英文」を返す
  function fullSentence(entry) {
    const s = entry.sentence;
    const word = entry.raw || entry.word.toLowerCase();
    if (!s) return word;
    if (/（\s*）|\(\s*\)/.test(s)) {
      return s.replace(/（\s*）/g, word).replace(/\(\s*\)/g, word);
    }
    return s;
  }

  // 読み上げ対象の語を下線表示するHTML
  function sentenceHtml(entry) {
    const s = fullSentence(entry);
    const w = (entry.raw || entry.word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("\\b(" + w + "\\w*)", "i");
    return esc(s).replace(re, "<u>$1</u>");
  }

  const rate = () => parseFloat($("ttsRate").value);
  $("ttsRate").addEventListener("input", () => { $("ttsRateVal").textContent = rate().toFixed(1) + "x"; });

  function speak(text, onend) {
    if (!("speechSynthesis" in window)) { alert("お使いのブラウザは音声読み上げに対応していません。"); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate();
    const v = speechSynthesis.getVoices().find((x) => /en[-_]US/i.test(x.lang));
    if (v) u.voice = v;
    if (onend) u.onend = onend;
    speechSynthesis.speak(u);
  }

  function showPractice() {
    const list = $("practiceList");
    list.innerHTML = "";
    const items = puzzle.across.concat(puzzle.down)
      .sort((a, b) => a.number - b.number);
    // 同じ語の重複を除く
    const seen = new Set();
    items.forEach((it) => {
      if (seen.has(it.entry.word)) return;
      seen.add(it.entry.word);
      list.appendChild(practiceRow(it.entry));
    });
    $("practiceCard").style.display = "block";
  }

  function practiceRow(entry) {
    const div = document.createElement("div");
    div.className = "p-item";
    div.innerHTML =
      '<div class="p-word">' + esc(entry.raw || entry.word.toLowerCase()) +
      (entry.translation ? '<span class="p-ja">' + esc(entry.translation) + "</span>" : "") + "</div>" +
      '<div class="p-sent">' + sentenceHtml(entry) + "</div>" +
      '<div class="p-btns">' +
      '<button class="p-btn" data-act="listen">手本を聴く</button>' +
      '<button class="p-btn rec" data-act="rec">録音する</button>' +
      '<button class="p-btn" data-act="play" disabled>録音を再生</button>' +
      '<span class="p-note"></span>' +
      "</div>";

    const text = fullSentence(entry);
    const btnListen = div.querySelector('[data-act="listen"]');
    const btnRec = div.querySelector('[data-act="rec"]');
    const btnPlay = div.querySelector('[data-act="play"]');
    const note = div.querySelector(".p-note");

    btnListen.addEventListener("click", () => {
      btnListen.textContent = "再生中…";
      speak(text, () => { btnListen.textContent = "手本を聴く"; });
    });

    let recorder = null, chunks = [], audioUrl = null;
    btnRec.addEventListener("click", async () => {
      if (recorder && recorder.state === "recording") {
        recorder.stop();
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        note.textContent = "このブラウザは録音に対応していません。";
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          audioUrl = URL.createObjectURL(new Blob(chunks, { type: chunks[0] ? chunks[0].type : "audio/webm" }));
          btnPlay.disabled = false;
          btnRec.classList.remove("on");
          btnRec.textContent = "録り直す";
          note.textContent = "録音しました。聴き比べてみましょう。";
        };
        recorder.start();
        btnRec.classList.add("on");
        btnRec.textContent = "■ 停止";
        note.textContent = "録音中… 例文を音読してください。";
      } catch (err) {
        note.textContent = "マイクを使用できません（許可が必要です）。";
      }
    });

    btnPlay.addEventListener("click", () => {
      if (!audioUrl) return;
      new Audio(audioUrl).play();
    });

    return div;
  }

  // すべて続けて聴く
  $("playAllBtn").addEventListener("click", function () {
    const btn = this;
    const rows = puzzle.across.concat(puzzle.down).sort((a, b) => a.number - b.number);
    const seen = new Set();
    const texts = [];
    rows.forEach((it) => {
      if (seen.has(it.entry.word)) return;
      seen.add(it.entry.word);
      texts.push(fullSentence(it.entry));
    });
    let i = 0;
    btn.disabled = true;
    btn.textContent = "再生中…";
    (function next() {
      if (i >= texts.length) { btn.disabled = false; btn.textContent = "すべて続けて聴く"; return; }
      speak(texts[i++], next);
    })();
  });

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
