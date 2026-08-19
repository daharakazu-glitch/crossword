/*
 * クロスワード生成エンジン
 * 単語リスト(英単語)から交差配置のクロスワードを構築する。
 */
(function (global) {
  "use strict";

  const key = (r, c) => r + "," + c;

  // 1回分の配置を試みる。grid は {"r,c": "A"} 形式。
  function tryBuild(words) {
    const grid = {};            // 座標 -> 文字
    const placed = [];          // {word, entry, r, c, dir}
    const unplaced = [];

    // 長い単語から置くと交差が作りやすい
    const sorted = words.slice().sort((a, b) => b.word.length - a.word.length);

    // 最初の単語を原点に横向きで置く
    const first = sorted[0];
    placeWord(grid, placed, first, 0, 0, "H");

    for (let n = 1; n < sorted.length; n++) {
      const entry = sorted[n];
      const w = entry.word;
      let best = null;   // {r,c,dir,score}

      // 既存の各セルと、この単語の各文字の交差を試す
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        for (const cellKey in grid) {
          if (grid[cellKey] !== ch) continue;
          const [cr, cc] = cellKey.split(",").map(Number);
          // 既存セルが横向き文字なら、この単語は縦向きに交差
          // 両方向を試す
          for (const dir of ["H", "V"]) {
            let r, c;
            if (dir === "H") { r = cr; c = cc - i; }
            else { r = cr - i; c = cc; }
            const score = canPlace(grid, w, r, c, dir);
            if (score === null) continue;
            if (score < 1) continue; // 必ず交差させる
            const compact = -(Math.abs(r) + Math.abs(c));
            const total = score * 100 + compact;
            if (!best || total > best.total) {
              best = { r, c, dir, total };
            }
          }
        }
      }

      if (best) placeWord(grid, placed, entry, best.r, best.c, best.dir);
      else unplaced.push(entry);
    }

    return { grid, placed, unplaced };
  }

  // 配置可否を判定。可能なら交差数を返す。不可なら null。
  function canPlace(grid, word, r, c, dir) {
    const dr = dir === "V" ? 1 : 0;
    const dc = dir === "H" ? 1 : 0;
    let intersections = 0;

    // 開始点の直前・終端の直後は空でなければならない(既存単語との連結防止)
    if (grid[key(r - dr, c - dc)]) return null;
    if (grid[key(r + dr * word.length, c + dc * word.length)]) return null;

    for (let i = 0; i < word.length; i++) {
      const cr = r + dr * i;
      const cc = c + dc * i;
      const existing = grid[key(cr, cc)];
      if (existing) {
        if (existing !== word[i]) return null;
        intersections++;
      } else {
        // 交差でないセルは、垂直方向の隣が空でなければならない
        if (dir === "H") {
          if (grid[key(cr - 1, cc)] || grid[key(cr + 1, cc)]) return null;
        } else {
          if (grid[key(cr, cc - 1)] || grid[key(cr, cc + 1)]) return null;
        }
      }
    }
    return intersections;
  }

  function placeWord(grid, placed, entry, r, c, dir) {
    const dr = dir === "V" ? 1 : 0;
    const dc = dir === "H" ? 1 : 0;
    for (let i = 0; i < entry.word.length; i++) {
      grid[key(r + dr * i, c + dc * i)] = entry.word[i];
    }
    placed.push({ entry, r, c, dir });
  }

  // 複数回試して最も多く配置できた結果を採用
  function generate(words, attempts) {
    const clean = words
      .map((w) => ({
        word: (w.word || "").toUpperCase().replace(/[^A-Z]/g, ""),
        raw: w.word || "",
        translation: w.translation || "",
        sentence: w.sentence || "",
      }))
      .filter((w) => w.word.length >= 2);

    // 重複語を除去
    const seen = new Set();
    const uniq = [];
    for (const w of clean) {
      if (seen.has(w.word)) continue;
      seen.add(w.word);
      uniq.push(w);
    }

    if (uniq.length === 0) return null;

    attempts = attempts || 40;
    let bestResult = null;
    for (let a = 0; a < attempts; a++) {
      // 2回目以降は軽くシャッフルして多様性を出す
      const trial = a === 0 ? uniq : shuffle(uniq.slice());
      const res = tryBuild(trial);
      if (!bestResult || res.placed.length > bestResult.placed.length) {
        bestResult = res;
        if (res.unplaced.length === 0) break;
      }
    }

    return finalize(bestResult);
  }

  // 番号付け・境界計算・出力整形
  function finalize(result) {
    const { placed, unplaced } = result;
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    for (const p of placed) {
      const dr = p.dir === "V" ? 1 : 0;
      const dc = p.dir === "H" ? 1 : 0;
      for (let i = 0; i < p.entry.word.length; i++) {
        const r = p.r + dr * i, c = p.c + dc * i;
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
    }
    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;

    // グリッド(letter)を正規化
    const cells = {};
    for (const p of placed) {
      const dr = p.dir === "V" ? 1 : 0;
      const dc = p.dir === "H" ? 1 : 0;
      for (let i = 0; i < p.entry.word.length; i++) {
        const r = p.r + dr * i - minR;
        const c = p.c + dc * i - minC;
        cells[key(r, c)] = p.entry.word[i];
      }
    }

    // 番号付け: 単語の開始セルに読み順で番号を振る
    const starts = placed.map((p) => ({
      p,
      r: p.r - minR,
      c: p.c - minC,
    }));
    starts.sort((a, b) => (a.r - b.r) || (a.c - b.c));

    const numberAt = {};   // "r,c" -> number
    let counter = 0;
    const across = [];
    const down = [];
    for (const s of starts) {
      const k = key(s.r, s.c);
      if (!(k in numberAt)) {
        counter++;
        numberAt[k] = counter;
      }
      const num = numberAt[k];
      const item = {
        number: num,
        entry: s.p.entry,
        r: s.r,
        c: s.c,
        dir: s.p.dir,
      };
      if (s.p.dir === "H") across.push(item);
      else down.push(item);
    }
    across.sort((a, b) => a.number - b.number);
    down.sort((a, b) => a.number - b.number);

    return {
      rows, cols, cells, numberAt, across, down,
      placedCount: placed.length,
      unplaced,
    };
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  global.Crossword = { generate };
})(window);
