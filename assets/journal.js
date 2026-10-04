/* 日记页 — 按日期升 / 降序切换（默认降序，最新在前） */
(function () {
  'use strict';

  var grid = document.getElementById('journal');
  if (!grid) return;

  var items = Array.prototype.slice.call(grid.querySelectorAll('.diary'));
  var btns = document.querySelectorAll('.sortbtn');
  if (!items.length) return;

  function sort(dir) {
    var arr = items.slice().sort(function (a, b) {
      var da = a.getAttribute('data-date') || '';
      var db = b.getAttribute('data-date') || '';
      return dir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });
    var frag = document.createDocumentFragment();
    for (var i = 0; i < arr.length; i++) frag.appendChild(arr[i]);
    grid.appendChild(frag);
  }

  Array.prototype.forEach.call(btns, function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(btns, function (x) { x.classList.remove('is-on'); });
      btn.classList.add('is-on');
      sort(btn.getAttribute('data-sort'));
    });
  });

  sort('desc');
})();
