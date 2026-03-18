(function () {
  function formatTime(date) {
    try {
      const formatter = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
      return formatter.format(date);
    } catch (e) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return hours + ':' + minutes;
    }
  }

  function updateTime() {
    var node = document.getElementById('menu-time');
    if (!node) return;
    node.textContent = formatTime(new Date());
  }

  function detectEmbedded() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('embed') === '1') return true;
    } catch (err) {
      // ignore
    }

    try {
      return window.self !== window.top;
    } catch (err) {
      return false;
    }
  }

  function flattenEmbeddedWindow() {
    if (!document.body.classList.contains('embedded')) return;
    var desktop = document.querySelector('.desktop');
    if (!desktop) return;
    var win = desktop.querySelector('.window');
    if (!win) return;
    var body = win.querySelector('.window-body');
    if (!body) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'embedded-content';
    while (body.firstChild) {
      wrapper.appendChild(body.firstChild);
    }

    desktop.innerHTML = '';
    desktop.appendChild(wrapper);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('loaded');
    updateTime();
    setInterval(updateTime, 60000);

    if (detectEmbedded()) {
      document.body.classList.add('embedded');
      flattenEmbeddedWindow();
    }

    var apple = document.getElementById('menu-apple');
    var appleBtn = document.getElementById('menu-apple-btn');
    if (apple && appleBtn) {
      appleBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        var isOpen = apple.classList.toggle('open');
        appleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }
  });

  function loadLazyFramesForHash() {
    var hash = location.hash;
    if (!hash) return;
    var target = document.querySelector(hash);
    if (!target) return;
    var frames = target.querySelectorAll('iframe[data-src]');
    frames.forEach(function (frame) {
      if (!frame.getAttribute('src')) {
        frame.setAttribute('src', frame.getAttribute('data-src'));
      }
    });
  }

  var searchState = {
    ready: false,
    render: null,
    input: null,
    attempted: false
  };

  var musicState = {
    ready: false,
    attempted: false
  };

  function getSearchInlineData() {
    var node = document.getElementById('search-index');
    if (!node) return null;
    try {
      var text = node.textContent || '[]';
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  }

  function getSearchIndexUrl() {
    var container = document.getElementById('search');
    if (!container) return '';
    return container.getAttribute('data-index-url') || '';
  }

  function loadSearchData() {
    if (searchState.promise) return searchState.promise;
    var inline = getSearchInlineData();
    if (inline && inline.length) {
      searchState.promise = Promise.resolve(inline);
      return searchState.promise;
    }

    var url = getSearchIndexUrl();
    if (!url || typeof fetch !== 'function') {
      searchState.promise = Promise.resolve([]);
      return searchState.promise;
    }

    searchState.promise = fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res || !res.ok) return [];
        return res.json();
      })
      .catch(function () {
        return [];
      });

    return searchState.promise;
  }

  function formatSearchDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    try {
      var formatter = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(date);
    } catch (err) {
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, '0');
      var d = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
  }

  function setupSearch() {
    if (searchState.ready) return;
    searchState.loading = true;

    loadSearchData().then(function (data) {
      searchState.loading = false;
      var input = document.getElementById('search-input');
      var list = document.getElementById('search-results');
      var empty = document.getElementById('search-empty');
      if (!data || !input || !list || !empty) return;

      var items = data.map(function (item) {
        var title = item.title || 'Untitled';
        var folder = item.folder || '';
        var dateText = item.dateText || formatSearchDate(item.date);
        var path = item.path || '';
        return {
          title: title,
          folder: folder,
          dateText: dateText,
          path: path,
          text: (title + ' ' + folder).toLowerCase()
        };
      });
      var hasOverlay = !!document.getElementById('article-frame');

      function buildItem(item) {
        var li = document.createElement('li');
        li.className = 'search-item';

        var link = document.createElement('a');
        link.className = 'search-link';
        if (hasOverlay) {
          link.href = '#article';
          link.setAttribute('data-article-url', item.path);
          link.setAttribute('data-article-title', item.title);
          link.setAttribute('data-article-back', '#search');
          link.setAttribute('data-article-share', item.path);
        } else {
          link.href = item.path;
        }

        var title = document.createElement('span');
        title.className = 'search-title';
        title.textContent = item.title;

        var meta = document.createElement('span');
        meta.className = 'search-meta';
        var metaText = '';
        if (item.folder) metaText = item.folder;
        if (item.dateText) metaText = metaText ? (metaText + ' · ' + item.dateText) : item.dateText;
        meta.textContent = metaText;

        link.appendChild(title);
        if (metaText) link.appendChild(meta);
        li.appendChild(link);
        return li;
      }

      function render(query) {
        var q = String(query || '').trim().toLowerCase();
        var results = [];
        if (!q) {
          results = items.slice(0, 12);
        } else {
          results = items.filter(function (item) {
            return item.text.indexOf(q) !== -1;
          }).slice(0, 30);
        }

        list.innerHTML = '';
        if (!results.length) {
          empty.style.display = 'block';
          return;
        }
        empty.style.display = 'none';
        results.forEach(function (item) {
          list.appendChild(buildItem(item));
        });
      }

      input.addEventListener('input', function () {
        render(input.value);
      });

      searchState.ready = true;
      searchState.render = render;
      searchState.input = input;

      render(input.value);
      if (location.hash === '#search') {
        input.focus();
        input.select();
      }
    });
  }

  function ensureSearchReady() {
    if (searchState.ready || searchState.attempted) return;
    searchState.attempted = true;
    setupSearch();
  }

  function focusSearch() {
    if (location.hash !== '#search') return;
    ensureSearchReady();
    if (!searchState.ready || !searchState.input) return;
    searchState.input.focus();
    searchState.input.select();
    if (searchState.render) {
      searchState.render(searchState.input.value);
    }
  }

  function onHashChange() {
    loadLazyFramesForHash();
    if (location.hash === '#music') {
      ensureMusicReady();
    }
    if (location.hash === '#search') {
      ensureSearchReady();
    }
    focusSearch();
  }

  window.addEventListener('hashchange', onHashChange);

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;

    var apple = document.getElementById('menu-apple');
    var appleBtn = document.getElementById('menu-apple-btn');
    if (apple && apple.classList.contains('open')) {
      var inAppleMenu = target.closest && target.closest('#menu-apple');
      if (!inAppleMenu) {
        apple.classList.remove('open');
        if (appleBtn) appleBtn.setAttribute('aria-expanded', 'false');
      }
    }

    var appleItem = target.closest && target.closest('.menu-dropdown-item[data-open]');
    if (appleItem) {
      var openId = appleItem.getAttribute('data-open');
      if (openId) {
        event.preventDefault();
        location.hash = openId;
      }
      if (apple) {
        apple.classList.remove('open');
        if (appleBtn) appleBtn.setAttribute('aria-expanded', 'false');
      }
      return;
    }
    if (target.classList && target.classList.contains('traffic-max')) {
      event.preventDefault();
      var win = target.closest('.window');
      if (!win) return;
      win.classList.toggle('is-maximized');
    }

    var articleLink = target.closest && target.closest('a[data-article-url]');
    if (articleLink) {
      event.preventDefault();
      var url = articleLink.getAttribute('data-article-url') || '';
      var title = articleLink.getAttribute('data-article-title') || 'Article';
      var back = articleLink.getAttribute('data-article-back') || '#';
      var share = articleLink.getAttribute('data-article-share') || url;

      var frame = document.getElementById('article-frame');
      var titleNode = document.getElementById('article-title');
      var backNode = document.getElementById('article-back');
      var shareNode = document.getElementById('article-share');

      if (titleNode) titleNode.textContent = title;
      if (backNode) backNode.setAttribute('href', back);
      if (shareNode) shareNode.setAttribute('href', share || '#');
      if (frame && url) {
        var embedUrl = url.indexOf('?') === -1 ? (url + '?embed=1') : (url + '&embed=1');
        if (frame.getAttribute('src') !== embedUrl) {
          frame.setAttribute('src', embedUrl);
        }
      }

      if (location.hash !== '#article') {
        location.hash = 'article';
      }
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.defaultPrevented) return;
    var tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target && event.target.isContentEditable)) return;
    var key = String(event.key || '').toLowerCase();
    if (key === 'escape') {
      var apple = document.getElementById('menu-apple');
      var appleBtn = document.getElementById('menu-apple-btn');
      if (apple && apple.classList.contains('open')) {
        apple.classList.remove('open');
        if (appleBtn) appleBtn.setAttribute('aria-expanded', 'false');
        event.preventDefault();
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      if (location.hash !== '#search') {
        location.hash = 'search';
      } else {
        focusSearch();
      }
    }
    if (key === 'escape' && location.hash === '#search') {
      event.preventDefault();
      location.hash = '';
    }
  });

  function formatSeconds(value) {
    if (!value || !isFinite(value)) return '0:00';
    var total = Math.max(0, Math.floor(value));
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + ':' + String(seconds).padStart(2, '0');
  }

  function setupMusicPlayer() {
    if (musicState.ready) return;
    var container = document.getElementById('music');
    if (!container) return;
    var list = document.getElementById('music-list');
    var audio = document.getElementById('music-audio');
    var playBtn = document.getElementById('music-play');
    var prevBtn = document.getElementById('music-prev');
    var nextBtn = document.getElementById('music-next');
    var progress = document.getElementById('music-progress');
    var titleNode = document.getElementById('music-title');
    var subNode = document.getElementById('music-sub');
    var player = container.querySelector('.music-player');
    if (!list || !audio || !playBtn || !progress || !player) return;

    var buttons = Array.prototype.slice.call(list.querySelectorAll('.music-track'));
    if (!buttons.length) return;
    var tracks = buttons.map(function (btn) {
      return {
        title: btn.getAttribute('data-title') || 'Untitled',
        src: btn.getAttribute('data-src') || '',
        button: btn
      };
    }).filter(function (track) {
      return track.src;
    });
    if (!tracks.length) return;

    var currentIndex = 0;
    var currentTimeNode = document.getElementById('music-current');
    var durationNode = document.getElementById('music-duration');

    function updateActiveButton() {
      tracks.forEach(function (track, index) {
        if (!track.button) return;
        if (index === currentIndex) {
          track.button.classList.add('is-active');
        } else {
          track.button.classList.remove('is-active');
        }
      });
    }

    function loadTrack(index, autoplay) {
      if (index < 0 || index >= tracks.length) return;
      currentIndex = index;
      var track = tracks[currentIndex];
      audio.src = track.src;
      if (titleNode) titleNode.textContent = track.title;
      if (subNode) subNode.textContent = 'MP3 · 本地';
      updateActiveButton();
      if (autoplay) {
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {});
        }
      }
    }

    function playPause() {
      if (audio.paused) {
        var playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () {});
        }
      } else {
        audio.pause();
      }
    }

    function nextTrack() {
      var next = (currentIndex + 1) % tracks.length;
      loadTrack(next, true);
    }

    function prevTrack() {
      var prev = currentIndex - 1;
      if (prev < 0) prev = tracks.length - 1;
      loadTrack(prev, true);
    }

    playBtn.addEventListener('click', playPause);
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);

    list.addEventListener('click', function (event) {
      var target = event.target;
      var btn = target && target.closest ? target.closest('.music-track') : null;
      if (!btn) return;
      var index = buttons.indexOf(btn);
      if (index === -1) return;
      loadTrack(index, true);
    });

    audio.addEventListener('play', function () {
      player.classList.add('is-playing');
    });

    audio.addEventListener('pause', function () {
      player.classList.remove('is-playing');
    });

    audio.addEventListener('ended', function () {
      nextTrack();
    });

    audio.addEventListener('loadedmetadata', function () {
      if (durationNode) durationNode.textContent = formatSeconds(audio.duration);
    });

    audio.addEventListener('timeupdate', function () {
      if (currentTimeNode) currentTimeNode.textContent = formatSeconds(audio.currentTime);
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      progress.value = Math.min(100, Math.round((audio.currentTime / audio.duration) * 100));
    });

    progress.addEventListener('input', function () {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      var percent = Math.max(0, Math.min(100, Number(progress.value) || 0));
      audio.currentTime = (percent / 100) * audio.duration;
    });

    loadTrack(currentIndex, false);
    musicState.ready = true;
  }

  function ensureMusicReady() {
    if (musicState.ready || musicState.attempted) return;
    musicState.attempted = true;
    setupMusicPlayer();
  }

  onHashChange();
  // Fixed-height iframe: no dynamic resizing needed.
})();
