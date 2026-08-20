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

  /* --- 音声(voice)の選定 ---
   * getVoices() は初回は空配列を返すことがあるため voiceschanged を待つ。
   * ネタ音声(Zarvox等)を除外し、自然な高品質音声を優先して並べる。
   */
  let voices = [];

  // macOS等に入っているノベルティ音声(機械的で教材に不適)
  const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|junior|kathy|organ|princess|ralph|trinoids|whisper|wobble|zarvox|superstar|grandma|grandpa|rocko|sandy|shelley|eddy|flo|reed|fred|hysterical|pipe organ)\b/i;
  // Appleはノベルティ音声の名前だけを日本語化する(ささやき声/オルガン/道化 等)。
  // 実在の人名音声(Samantha, Daniel…)はラテン文字のままなので、CJK名は一括除外できる。
  const CJK_NAME = /[\u3040-\u30ff\u4e00-\u9faf]/;

  // 自然さで並べるためのスコア
  function voiceScore(v) {
    const n = v.name;
    let s = 0;
    if (NOVELTY.test(n)) return -1000;
    if (CJK_NAME.test(n.replace(/\s*[（(].*$/, ""))) return -1000;
    // ネットワーク系(Google/Microsoft)は概して自然
    if (/Google/i.test(n)) s += 120;
    if (/Natural|Neural|Online/i.test(n)) s += 120;
    if (/Premium|Enhanced/i.test(n)) s += 90;
    if (v.localService === false) s += 40;
    // Apple の標準的な自然音声
    if (/^(Samantha|Ava|Allison|Susan|Zoe|Evan|Nathan|Joelle|Tom|Alex|Karen|Daniel|Serena|Kate|Oliver|Stephanie)\b/i.test(n)) s += 60;
    // 方言の優先度
    if (/^en[-_]US/i.test(v.lang)) s += 30;
    else if (/^en[-_]GB/i.test(v.lang)) s += 20;
    else if (/^en[-_]AU|^en[-_]CA/i.test(v.lang)) s += 10;
    return s;
  }

  function loadVoices() {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve([]);
      const get = () => speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
      let list = get();
      if (list.length) return resolve(list);
      // 初回は非同期で届く
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(get()); };
      speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
      setTimeout(finish, 1500); // 保険
    });
  }

  async function initVoices() {
    voices = (await loadVoices())
      .filter((v) => voiceScore(v) > -1000)
      .sort((a, b) => voiceScore(b) - voiceScore(a));

    const sel = $("ttsVoice");
    const note = $("voiceNote");
    sel.innerHTML = "";

    if (!voices.length) {
      sel.innerHTML = '<option>利用できる英語音声がありません</option>';
      note.textContent = "英語の音声がインストールされていません。OSの設定で英語音声を追加してください。";
      return;
    }

    voices.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = v.name + "（" + v.lang + "）" + (voiceScore(v) >= 100 ? " ★高品質" : "");
      sel.appendChild(o);
    });

    // 前回の選択を復元
    const saved = localStorage.getItem("cw_voice");
    const idx = saved ? voices.findIndex((v) => v.name === saved) : -1;
    sel.value = idx >= 0 ? idx : 0;

    updateVoiceNote();
    sel.addEventListener("change", () => {
      localStorage.setItem("cw_voice", currentVoice().name);
      updateVoiceNote();
      speak("This is a sample of the selected voice.");
    });
  }

  function currentVoice() {
    return voices[parseInt($("ttsVoice").value, 10)] || voices[0] || null;
  }

  function updateVoiceNote() {
    const v = currentVoice();
    if (!v) return;
    const note = $("voiceNote");
    if (voiceScore(v) >= 100) {
      note.textContent = "自然な音声を選択中です。";
      note.className = "voice-note good";
    } else {
      note.textContent = "この音声は機械的に聞こえる場合があります。ChromeまたはEdgeで開くと、より自然な音声（Google / Microsoft Natural）が使えます。macOSでは「システム設定 → アクセシビリティ → 読み上げコンテンツ → システムの声 → 英語（米国）」から高品質な声を追加できます。";
      note.className = "voice-note warn";
    }
  }

  function speak(text, onend) {
    if (!("speechSynthesis" in window)) { alert("お使いのブラウザは音声読み上げに対応していません。"); return; }
    // 直前の再生を止めるので、他ボタンの「再生中…」表示を戻す
    document.querySelectorAll('[data-act="listen"]').forEach((b) => { b.textContent = "手本を聴く"; });
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = currentVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    else u.lang = "en-US";
    u.rate = rate();
    u.pitch = 1;
    if (onend) { u.onend = onend; u.onerror = onend; }
    speechSynthesis.speak(u);
  }

  initVoices();

  /* ---------------- 音読の自動採点（100点満点・励まし重視） ----------------
   * 録音と同時に SpeechRecognition を走らせて文字起こしし、手本の英文と
   * 単語単位で照合する。生徒のやる気を削がないよう曲線は甘めにするが、
   * 満点(100)は「全単語が完全に聞き取れ、余計な語もない」ときだけ出す。
   */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function normWords(s) {
    return String(s).toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9'\s]/g, " ")
      .replace(/\s+/g, " ").trim()
      .split(" ").filter(Boolean);
  }

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      const t = prev; prev = cur; cur = t;
    }
    return prev[n];
  }

  // 単語同士の似ぐあい 0..1（発音の揺れを拾えるよう編集距離ベース）
  function wordSim(a, b) {
    if (a === b) return 1;
    const d = lev(a, b);
    return Math.max(0, 1 - d / Math.max(a.length, b.length));
  }

  // 手本の語列と聞き取り語列を並べて、手本の各語がどれだけ言えたかを返す
  function alignWords(target, said) {
    const m = target.length, n = said.length;
    const dp = [], bt = [];
    for (let i = 0; i <= m; i++) { dp.push(new Float64Array(n + 1)); bt.push(new Int8Array(n + 1)); }
    for (let i = 1; i <= m; i++) bt[i][0] = 1;
    for (let j = 1; j <= n; j++) bt[0][j] = 2;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const diag = dp[i - 1][j - 1] + wordSim(target[i - 1], said[j - 1]);
        const up = dp[i - 1][j];
        const left = dp[i][j - 1];
        if (diag >= up && diag >= left) { dp[i][j] = diag; bt[i][j] = 0; }
        else if (up >= left) { dp[i][j] = up; bt[i][j] = 1; }
        else { dp[i][j] = left; bt[i][j] = 2; }
      }
    }
    const sims = new Array(m).fill(0);
    let extra = 0, i = m, j = n;
    while (i > 0 || j > 0) {
      const d = i === 0 ? 2 : j === 0 ? 1 : bt[i][j];
      if (d === 0) { sims[i - 1] = wordSim(target[i - 1], said[j - 1]); i--; j--; }
      else if (d === 1) { i--; }
      else { extra++; j--; }
    }
    return { sims, extra };
  }

  // conf: 音声認識の平均確信度(0..1)。取得できない環境では null。
  function scoreReading(targetText, heardText, conf) {
    const target = normWords(targetText);
    const said = normWords(heardText);
    if (!target.length) return null;
    const { sims, extra } = alignWords(target, said);
    const acc = sims.reduce((a, b) => a + b, 0) / target.length;
    // 励まし重視の甘い曲線: 半分言えれば 77点、9割で 95点。通常の上限は 99点。
    let score = 45 + 54 * Math.pow(acc, 0.75);
    score -= Math.min(8, extra * 2);                  // 余計な語は軽い減点
    if (conf != null) score += (conf - 0.75) * 8;     // 発音の明瞭さで ±2 程度
    score = Math.round(Math.max(50, Math.min(99, score)));
    // 満点は「全語を過不足なく、はっきり言い切った」ときだけ
    if (acc >= 0.995 && extra === 0 && target.length >= 3 && (conf == null || conf >= 0.9)) {
      score = 100;
    }
    return { score, acc, sims, target, extra };
  }

  function tierOf(score) {
    if (score === 100) return "満点！ 完璧な音読です";
    if (score >= 93) return "すばらしい！ ネイティブ級のなめらかさ";
    if (score >= 85) return "とても良い発音です！ この調子";
    if (score >= 75) return "いい感じ！ あと少しで高得点";
    if (score >= 65) return "しっかり声が出ています。もう一度どうぞ";
    return "ナイストライ！ 手本を聴いて再挑戦しよう";
  }

  function scoreHtml(res, heardText) {
    const chips = res.target.map((w, i) => {
      const s = res.sims[i];
      const cls = s >= 0.85 ? "ok" : s >= 0.5 ? "mid" : "ng";
      return '<span class="p-chip ' + cls + '">' + esc(w) + "</span>";
    }).join("");
    return (
      '<div class="p-score">' +
      '<div class="p-score-num">' + res.score + "<small>点</small></div>" +
      '<div class="p-score-body">' +
      '<div class="p-score-bar"><i style="width:' + res.score + '%"></i></div>' +
      '<div class="p-score-tier">' + esc(tierOf(res.score)) + "</div>" +
      '<div class="p-chips">' + chips + "</div>" +
      (heardText
        ? '<div class="p-heard">聞き取り: “' + esc(heardText) + "”</div>"
        : "") +
      "</div></div>"
    );
  }

  // 録音と並行して走らせる音声認識。使えない環境では null を返す。
  function startRecognition(onText) {
    if (!SR) return null;
    let rec;
    try { rec = new SR(); } catch (e) { return null; }
    rec.lang = (currentVoice() && currentVoice().lang) || "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          onText(ev.results[i][0].transcript || "", ev.results[i][0].confidence);
        }
      }
    };
    rec.onerror = () => {};
    try { rec.start(); } catch (e) { return null; }
    return rec;
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
      "</div>" +
      '<div class="p-result"></div>';

    const text = fullSentence(entry);
    const btnListen = div.querySelector('[data-act="listen"]');
    const btnRec = div.querySelector('[data-act="rec"]');
    const btnPlay = div.querySelector('[data-act="play"]');
    const note = div.querySelector(".p-note");
    const result = div.querySelector(".p-result");

    btnListen.addEventListener("click", () => {
      btnListen.textContent = "再生中…";
      speak(text, () => { btnListen.textContent = "手本を聴く"; });
    });

    let recorder = null, chunks = [], audioUrl = null, recog = null, heard = "", confs = [];

    function judge() {
      if (!SR) {
        result.innerHTML = '<div class="p-nosr">この環境では自動採点が使えません。ChromeまたはEdgeで開くと点数が出ます。</div>';
        return;
      }
      const said = heard.trim();
      if (!said) {
        result.innerHTML = '<div class="p-nosr">うまく聞き取れませんでした。マイクに近づいて、もう一度はっきり音読してみましょう。</div>';
        return;
      }
      const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
      const res = scoreReading(text, said, conf);
      if (!res) return;
      result.innerHTML = scoreHtml(res, said);
    }

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
        heard = "";
        confs = [];
        result.innerHTML = "";
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (recog) { try { recog.stop(); } catch (e) {} }
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          audioUrl = URL.createObjectURL(new Blob(chunks, { type: chunks[0] ? chunks[0].type : "audio/webm" }));
          btnPlay.disabled = false;
          btnRec.classList.remove("on");
          btnRec.textContent = "録り直す";
          note.textContent = "録音しました。聴き比べてみましょう。";
          result.innerHTML = '<div class="p-nosr">採点中…</div>';
          // 認識結果は stop の直後に届くことがあるので少し待つ
          setTimeout(judge, 800);
        };
        recorder.start();
        recog = startRecognition((t, c) => {
          heard = (heard + " " + t).trim();
          if (typeof c === "number" && c > 0) confs.push(c);
        });
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
