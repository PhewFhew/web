/* A Cabinet of One — 共享脚本
   1) 滚动淡入（will-change 只在动画期间临时挂载，避免常驻合成层）
   2) 与 Phew 云雾开场协同：开场结束后再启动淡入，带兜底超时
*/
(function () {
  'use strict';

  var started = false;

  function arm(el) { el.classList.add('is-armed'); }
  function disarm(el) {
    var self = this;
    el.classList.remove('is-armed');
    el.removeEventListener('transitionend', self);
  }

  function initReveal() {
    if (started) return;
    started = true;

    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        arm(el);
        el.classList.add('is-visible');
        el.addEventListener('transitionend', function handler() {
          el.classList.remove('is-armed');
          el.removeEventListener('transitionend', handler);
        });
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  // 首页若有开场遮罩，等它结束再淡入；3s 兜底，防止脚本异常导致内容永不显示
  var intro = document.getElementById('phew-intro');
  if (intro) {
    document.addEventListener('phew:done', initReveal, { once: true });
    setTimeout(initReveal, 3000);
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initReveal);
    } else {
      initReveal();
    }
  }
})();
