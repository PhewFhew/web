/* 磁吸 / 黏连跟移
   鼠标横向移过打了 .magnet 标记的文字时，文字在原位产生轻微跟移。
   · 全站只挂 3 个 document 级监听，pointermove 里不读 DOM
   · 弹簧积分驱动 CSS 变量，归位后 rAF 自动停机
   · 触屏与「减少动效」下完全不初始化
*/
(function () {
  'use strict';

  if (!window.matchMedia || !window.requestAnimationFrame) return;
  var fine   = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  var MAX_SHIFT = 6;    // px，最大横向跟移
  var MAX_SKEW  = 1.2;  // deg，最大倾斜
  var STIFF = 0.12, DAMP = 0.72;
  var MAX_LETTERS = 60;

  var pointerX = 0;
  var active = null;    // 当前悬停的元素
  var live = [];        // 本帧需要更新的元素
  var raf = 0;

  /* ---------- 逐字预处理：只切纯文本节点，一次性 ---------- */
  function prepareLetters(el) {
    if (el._spans || el.children.length) return;         // 含 <br>/<em> 等则跳过，避免破坏结构
    var txt = el.textContent;
    if (!txt) return;
    var chars = Array.from ? Array.from(txt) : txt.split('');
    if (chars.length > MAX_LETTERS) return;
    var frag = document.createDocumentFragment();
    var spans = [];
    chars.forEach(function (ch) {
      var s = document.createElement('span');
      s.className = 'ml-c';
      s.textContent = ch;
      frag.appendChild(s);
      spans.push(s);
    });
    el.textContent = '';
    el.appendChild(frag);
    el._spans = spans;
  }

  function engage(el) {
    for (var i = 0; i < live.length; i++) if (live[i].el === el) return;
    live.push({ el: el, x: 0, s: 0, vx: 0, vs: 0, rect: null, rectAt: 0, cx: 0 });
    el.classList.add('is-magnet-active');
  }

  function release(el) {
    el.classList.remove('is-magnet-active');
    if (el._spans) for (var i = 0; i < el._spans.length; i++) el._spans[i].style.removeProperty('--cx');
  }

  function reset(el) {
    el.style.removeProperty('--mx');
    el.style.removeProperty('--sk');
  }

  /* ---------- 逐字：按字符序号做高斯衰减（不逐个读 rect） ---------- */
  function applyLetters(it) {
    var spans = it.el._spans, n = spans.length;
    var rel = (pointerX - it.cx) / Math.max(1, it.rect.width / 2);
    var focus = (rel + 1) / 2 * (n - 1);
    for (var i = 0; i < n; i++) {
      var d = Math.abs(i - focus) / Math.max(1, n * 0.5);
      var w = Math.exp(-d * d * 2.2);
      spans[i].style.setProperty('--cx', (it.x * (0.35 + 0.9 * w)).toFixed(2) + 'px');
    }
  }

  /* ---------- 每帧：弹簧积分 ---------- */
  function tick() {
    raf = 0;
    var running = false;
    var now = performance.now();
    var vh = window.innerHeight;

    for (var i = live.length - 1; i >= 0; i--) {
      var it = live[i];

      // rect 每 250ms 才读一次，避免每帧强制 layout
      if (!it.rect || now - it.rectAt > 250) { it.rect = it.el.getBoundingClientRect(); it.rectAt = now; }
      var r = it.rect;
      if (r.bottom < -60 || r.top > vh + 60) {          // 已滚出视口
        reset(it.el); release(it.el); live.splice(i, 1); continue;
      }
      it.cx = r.left + r.width / 2;

      var tx = 0, ts = 0;
      if (it.el === active) {
        var rel = (pointerX - it.cx) / Math.max(1, r.width / 2);
        if (rel > 1.6) rel = 1.6; else if (rel < -1.6) rel = -1.6;
        tx = rel * MAX_SHIFT;
        ts = rel * MAX_SKEW;
      }

      it.vx += (tx - it.x) * STIFF; it.vx *= DAMP; it.x += it.vx;
      it.vs += (ts - it.s) * STIFF; it.vs *= DAMP; it.s += it.vs;

      if (Math.abs(it.x) > 0.02 || Math.abs(it.vx) > 0.02 || Math.abs(it.s) > 0.01) {
        running = true;
      } else {
        it.x = it.s = it.vx = it.vs = 0;
        if (it.el !== active) { reset(it.el); release(it.el); live.splice(i, 1); continue; }
      }

      it.el.style.setProperty('--mx', it.x.toFixed(2) + 'px');
      it.el.style.setProperty('--sk', it.s.toFixed(2) + 'deg');
      if (it.el._spans) applyLetters(it);
    }

    if (running) raf = requestAnimationFrame(tick);
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }

  /* ---------- 事件：全站 3 个 ---------- */
  document.addEventListener('pointerover', function (e) {
    var el = (e.target && e.target.closest) ? e.target.closest('.magnet, .magnet-letters') : null;
    if (el === active) return;
    active = el;
    if (el) {
      if (el.classList.contains('magnet-letters')) prepareLetters(el);
      engage(el);
      schedule();
    }
  }, true);

  document.addEventListener('pointermove', function (e) {
    pointerX = e.clientX;
    if (active) schedule();
  }, { passive: true });

  function clear() {
    active = null;
    if (live.length) schedule();
  }
  document.addEventListener('pointerleave', clear);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } clear(); }
  });

  // 预先切分已存在的逐字标题
  var letters = document.querySelectorAll('.magnet-letters');
  for (var k = 0; k < letters.length; k++) prepareLetters(letters[k]);
})();
