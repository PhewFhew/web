/* Phew 云雾开场 — 仅首页，每次刷新/进入都播放约 2.5s
   点击 / Esc / 空格 可跳过；「减少动效」时直接不播。
   必须放在 #phew-intro 之后同步执行，否则会先闪一下页面。 */
(function () {
  'use strict';

  var intro = document.getElementById('phew-intro');
  var HOLD = 1250, TOTAL = 2500;
  var endTimer = 0, finished = false;

  function remove() {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    intro = null;
    unlock();
    document.dispatchEvent(new CustomEvent('phew:done'));
  }

  function done() {
    if (finished) return;
    finished = true;
    clearTimeout(endTimer);
    if (!intro) return;
    unlock();
    document.dispatchEvent(new CustomEvent('phew:done'));
    intro.classList.add('is-leaving');
    setTimeout(function () {
      if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
      intro = null;
    }, 280);
  }

  try {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var path = location.pathname || '';
    var last = path.split('/').pop();
    var isHome = path === '' || path === '/' || /\/$/.test(path) || last === 'index.html' || last === '';

    if (!intro || reduce || !isHome) { remove(); return; }
  } catch (err) {
    remove();                                            // 任何异常都立即放行，绝不挡住页面
    return;
  }

  lock();

  function start() {
    requestAnimationFrame(function () {
      if (!intro) return;
      intro.classList.add('is-opening');
      setTimeout(function () { if (!finished && intro) intro.classList.add('is-leaving'); }, HOLD);
      endTimer = setTimeout(done, TOTAL);
    });
  }

  // 等字体就绪再落字，避免 fallback 字形跳变；最多等 600ms
  if (document.fonts && document.fonts.ready) {
    var raced = false;
    document.fonts.ready.then(function () { if (!raced) { raced = true; start(); } });
    setTimeout(function () { if (!raced) { raced = true; start(); } }, 600);
  } else {
    start();
  }

  /* ---------- 跳过 ---------- */
  if (intro) intro.addEventListener('pointerdown', done);
  var skip = intro ? intro.querySelector('.phew-intro__skip') : null;
  if (skip) skip.addEventListener('click', function (e) { e.stopPropagation(); done(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') done();
  }, { once: true });
  window.addEventListener('pagehide', function () {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    intro = null;
    unlock();
    document.dispatchEvent(new CustomEvent('phew:done'));
  });

  /* ---------- 锁滚动 + 焦点隔离 ---------- */
  function setInert(on) {
    var sels = ['header.topbar', 'main', 'footer'];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (!el) continue;
      if (on) {
        if ('inert' in HTMLElement.prototype) el.inert = true;
        else el.setAttribute('aria-hidden', 'true');
      } else {
        if ('inert' in HTMLElement.prototype) el.inert = false;
        else el.removeAttribute('aria-hidden');
      }
    }
  }
  function lock()   { document.documentElement.classList.add('phew-lock'); setInert(true); }
  function unlock() { document.documentElement.classList.remove('phew-lock'); setInert(false); }

})();
