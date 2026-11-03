(function () {
  'use strict';

  var PROGRESS_KEY = 'textbook-progress-v1';
  var grid = document.getElementById('book-grid');
  var loading = document.getElementById('book-loading');
  var resume = document.getElementById('resume');
  var resumeMeta = document.getElementById('resume-meta');
  var resumeLink = document.getElementById('resume-link');
  var sourceText = document.getElementById('source-text');
  var sourceLink = document.getElementById('source-link');
  var officialLink = document.getElementById('official-link');

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readProgress() {
    try {
      var raw = window.localStorage.getItem(PROGRESS_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function formatTime(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    var now = new Date();
    var sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return '今天 ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }
    return date.getMonth() + 1 + ' 月 ' + date.getDate() + ' 日';
  }

  function renderCard(book) {
    var quizUnits = book.units.filter(function (unit) { return unit.inQuiz; }).length;
    var unitChips = book.units.slice(0, 4).map(function (unit) {
      return '<span class="unit-chip">' + escapeHtml(unit.no) + ' · ' + escapeHtml(unit.title) + '</span>';
    }).join('');
    var href = 'reader.html?book=' + encodeURIComponent(book.id);
    return (
      '<article class="book-card book-card--' + escapeHtml(book.subject) + '">' +
        '<div class="book-card__cover" aria-hidden="true">' +
          '<span class="book-card__mark">' + escapeHtml(book.mark) + '</span>' +
          '<span class="book-card__edition">' + escapeHtml(book.edition) + '</span>' +
          '<span class="book-card__cover-line"></span>' +
          '<span class="book-card__cover-title">' + escapeHtml(book.title) + '</span>' +
          '<span class="book-card__cover-pub">' + escapeHtml(book.publisher) + '</span>' +
        '</div>' +
        '<div class="book-card__body">' +
          '<div class="book-card__head">' +
            '<div>' +
              '<p class="book-card__subject">' + escapeHtml(book.label) + ' · ' + escapeHtml(book.grade) + '</p>' +
              '<h3>' + escapeHtml(book.title) + '</h3>' +
            '</div>' +
            (quizUnits ? '<span class="book-card__badge">期中 ' + quizUnits + ' 单元</span>' : '') +
          '</div>' +
          '<p class="book-card__summary">' + escapeHtml(book.summary) + '</p>' +
          '<div class="unit-chips" aria-label="单元目录">' + unitChips + '</div>' +
          '<div class="book-card__foot">' +
            '<span class="book-card__count">' + book.units.length + ' 个单元 · PDF 在线翻页</span>' +
            '<a class="btn btn--primary btn--sm" href="' + href + '">在线翻阅 →</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderResume(books) {
    var progress = readProgress();
    var latest = null;
    books.forEach(function (book) {
      var item = progress[book.id];
      if (item && item.page && (!latest || (item.updatedAt || '') > (latest.updatedAt || ''))) {
        latest = {
          book: book,
          page: item.page,
          total: item.total || 0,
          updatedAt: item.updatedAt,
        };
      }
    });
    if (!latest) return;
    resume.hidden = false;
    resumeMeta.textContent = latest.book.title + ' · ' + latest.book.edition + ' · 第 ' + latest.page +
      (latest.total ? ' / ' + latest.total : '') + ' 页' + (latest.updatedAt ? ' · ' + formatTime(latest.updatedAt) : '');
    resumeLink.href = 'reader.html?book=' + encodeURIComponent(latest.book.id) + '#p=' + latest.page;
  }

  function showError(message) {
    if (loading) loading.remove();
    grid.innerHTML = '<div class="load-error"><b>教材目录加载失败</b><p>' + escapeHtml(message) +
      '</p><p><a href="https://basic.smartedu.cn/tchMaterial/" target="_blank" rel="noopener noreferrer">前往国家中小学智慧教育平台阅读 →</a></p></div>';
  }

  fetch('assets/books.json', { cache: 'no-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      var books = data.books || [];
      if (!books.length) throw new Error('目录为空');
      if (loading) loading.remove();
      grid.innerHTML = books.map(renderCard).join('');
      if (data.notice && sourceText) sourceText.textContent = data.notice;
      if (data.source) {
        if (data.source.url) sourceLink.href = data.source.url;
        if (data.source.officialUrl) officialLink.href = data.source.officialUrl;
      }
      renderResume(books);
    })
    .catch(function (error) {
      showError(error && error.message ? error.message : '未知错误');
    });
})();
