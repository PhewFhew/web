/* 札记页 — 排序（默认日期倒序 / 可切随机）/ 中文搜索 / 标签筛选 / 懒加载音频
   无第三方依赖，纯事件委托。无 JS 时便签按 HTML 原顺序正常排列。 */
(function () {
  'use strict';

  var grid = document.getElementById('notes');
  if (!grid) return;

  var input   = document.getElementById('note-q');
  var counter = document.getElementById('note-n');
  var empty   = document.getElementById('notes-empty');
  var orderBtn = document.getElementById('note-order');
  var chips   = document.querySelectorAll('.notes-chips .chip');

  var notes = Array.prototype.slice.call(grid.querySelectorAll('.note'));
  if (!notes.length) return;

  /* ---------- 工具 ---------- */
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { /* Safari 无痕模式：静默失败 */ }
    return null;
  }
  function norm(s) {
    return (s || '').toLowerCase().replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- 1. 建索引（只读一次 DOM） ---------- */
  notes.forEach(function (el) {
    var t  = el.querySelector('.note__title');
    var bs = Array.prototype.slice.call(el.querySelectorAll('.note__body'));
    el._titleEl = t;
    el._title   = t ? t.textContent : '';
    el._bodyEls = bs;                                   // 一条札记可能有多段
    el._bodies  = bs.map(function (p) { return p.textContent; });
    el._body    = el._bodies.join(' ');
    el._hay     = norm([el.getAttribute('data-tags') || '', el._title, el._body].join(' '));
    el._date    = el.getAttribute('data-date') || '';
  });

  /* ---------- 2. 排列 ---------- */
  function applyOrder(order) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < order.length; i++) frag.appendChild(order[i]);
    grid.appendChild(frag);
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var shuffled = ls('notes-shuffle') === '1';

  function render() {
    if (!shuffled) {
      applyOrder(notes.slice().sort(function (a, b) { return b._date.localeCompare(a._date); }));
      return;
    }
    var seed = parseInt(ls('notes-shuffle-seed') || '0', 10) || 1;
    var rnd = mulberry32(seed);
    var order = notes.slice();
    for (var i = order.length - 1; i > 0; i--) {          // Fisher–Yates
      var j = Math.floor(rnd() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    applyOrder(order);
  }

  /* ---------- 3. 高亮：DOM API 构造，绝不拼 innerHTML ---------- */
  function clearMarks(el) {
    if (el._titleEl && el._titleEl._dirty) { el._titleEl.textContent = el._title; el._titleEl._dirty = false; }
    el._bodyEls.forEach(function (p, i) {
      if (!p._dirty) return;
      p.textContent = el._bodies[i];
      p._dirty = false;
    });
  }

  function markNode(node, text, terms) {
    var lower = text.toLowerCase();
    var marks = [];
    terms.forEach(function (t) {
      if (!t) return;
      var from = 0, at;
      while ((at = lower.indexOf(t, from)) > -1) { marks.push([at, at + t.length]); from = at + t.length; }
    });
    if (!marks.length) return;
    marks.sort(function (a, b) { return a[0] - b[0]; });

    var frag = document.createDocumentFragment();
    var cur = 0;
    marks.forEach(function (m) {
      if (m[0] < cur) return;                            // 跳过重叠
      frag.appendChild(document.createTextNode(text.slice(cur, m[0])));
      var mk = document.createElement('mark');
      mk.textContent = text.slice(m[0], m[1]);
      frag.appendChild(mk);
      cur = m[1];
    });
    frag.appendChild(document.createTextNode(text.slice(cur)));
    node.textContent = '';
    node.appendChild(frag);
    node._dirty = true;
  }

  function highlight(el, terms) {
    clearMarks(el);
    if (el._titleEl && el._title) markNode(el._titleEl, el._title, terms);
    el._bodyEls.forEach(function (p, i) { markNode(p, el._bodies[i], terms); });
  }

  /* ---------- 4. 搜索 + 筛选 ---------- */
  var timer = 0;
  var activeTag = '';

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(filter, 130);                     // 中文 IME 下防抖
  }

  function filter() {
    var q = norm(input ? input.value : '');
    var terms = q ? q.split(' ').filter(Boolean) : [];
    var hit = 0;

    grid.classList.toggle('is-searching', !!q);

    notes.forEach(function (el) {
      var ok = true;
      for (var i = 0; i < terms.length; i++) {
        if (el._hay.indexOf(terms[i]) === -1) { ok = false; break; }
      }
      if (ok && activeTag && (el.getAttribute('data-tags') || '').indexOf(activeTag) === -1) ok = false;
      el.hidden = !ok;
      if (ok) { hit++; if (q) highlight(el, terms); else clearMarks(el); }
      else clearMarks(el);
    });

    if (counter) counter.textContent = hit;
    if (empty) empty.hidden = hit !== 0;

    if (q) sortByRelevance(terms); else render();
  }

  function sortByRelevance(terms) {
    var visible = notes.filter(function (el) { return !el.hidden; });
    visible.forEach(function (el) {
      var s = 0;
      var tags  = norm(el.getAttribute('data-tags') || '');
      var title = norm(el._title);
      var body  = norm(el._body);
      terms.forEach(function (t) {
        if (tags.indexOf(t) > -1) s += 4;                // 标签命中权重最高
        if (title.indexOf(t) > -1) s += 2;
        if (body.indexOf(t) > -1) s += 1;
      });
      el._score = s;
    });
    visible.sort(function (a, b) {
      return (b._score - a._score) || b._date.localeCompare(a._date);
    });
    applyOrder(visible);                                 // 只重排可见项，隐藏项原地保留
  }

  /* ---------- 5. 音频：懒加载 + 互斥播放 ---------- */
  var current = null;

  function fmt(s) {
    if (!isFinite(s)) return '--:--';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function syncUI(a) {
    var wrap = a.closest('.note__audio');
    if (!wrap) return;
    wrap.querySelector('.note__play').classList.toggle('is-playing', !a.paused);
  }

  function bindAudio(audio, wrap) {
    var seek = wrap.querySelector('.note__seek');
    var time = wrap.querySelector('.note__time');
    audio.addEventListener('timeupdate', function () {
      if (audio.duration) seek.value = (audio.currentTime / audio.duration * 100).toFixed(1);
      time.textContent = fmt(audio.currentTime) + ' / ' + (audio.duration ? fmt(audio.duration) : '--:--');
    });
    audio.addEventListener('loadedmetadata', function () {
      time.textContent = '0:00 / ' + fmt(audio.duration);
    });
    audio.addEventListener('ended', function () { seek.value = 0; syncUI(audio); });
    audio.addEventListener('play',  function () { syncUI(audio); });
    audio.addEventListener('pause', function () { syncUI(audio); });
    seek.addEventListener('input', function () {
      if (audio.duration) audio.currentTime = seek.value / 100 * audio.duration;
    });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.note__play') : null;
    if (!btn) return;
    var wrap = btn.closest('.note__audio');
    var audio = wrap ? wrap.querySelector('audio') : null;
    if (!audio) return;

    if (!audio.src && audio.getAttribute('data-src')) audio.src = audio.getAttribute('data-src');
    if (!audio._bound) { bindAudio(audio, wrap); audio._bound = true; }

    if (current && current !== audio) { current.pause(); syncUI(current); }
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      audio.pause();
    }
    current = audio;
    syncUI(audio);
  });

  /* ---------- 6. 标签 chips + 排序切换 ---------- */
  Array.prototype.forEach.call(chips, function (c) {
    c.addEventListener('click', function () {
      Array.prototype.forEach.call(chips, function (x) { x.classList.remove('is-on'); });
      c.classList.add('is-on');
      activeTag = c.getAttribute('data-tag') || '';
      filter();
    });
  });

  if (orderBtn) {
    function paint() {
      orderBtn.setAttribute('aria-pressed', shuffled ? 'true' : 'false');
      orderBtn.textContent = shuffled ? '按日期排列' : '打乱排列';
      orderBtn.title = shuffled ? '当前：随机排列' : '当前：最新在前';
    }
    paint();
    orderBtn.addEventListener('click', function () {
      shuffled = !shuffled;
      if (shuffled) {
        ls('notes-shuffle', '1');
        ls('notes-shuffle-seed', String((Math.random() * 1e9) | 0));
      } else {
        ls('notes-shuffle', null);
      }
      paint();
      render();
    });
  }

  /* ---------- 7. 启动 ---------- */
  render();
  if (counter) counter.textContent = notes.length;
  if (input) {
    input.addEventListener('input', onInput);
    input.addEventListener('search', onInput);
  }
})();
