// Interwave landing — small bits of JS for the static site.
//
// 1. Stamps the current year in the footer.
// 2. If the URL contains ?p=<token>, fetches the shared playlist snapshot
//    from Supabase (anon REST) and renders a preview into <section id="share">.
//    Falls back gracefully when secrets aren't injected or the snapshot 404s.
//
// Placeholders __SUPABASE_URL__ and __SUPABASE_ANON__ are replaced by the
// Pages workflow at deploy time. Local file:// previews will show the
// "share preview unavailable" fallback, which is fine.

(function () {
  // ── Footer year ────────────────────────────────────────────────────────────
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ── Share resolver ─────────────────────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var token = params.get('p');
  if (!token) return;

  var SUPABASE_URL = '__SUPABASE_URL__';
  var SUPABASE_ANON = '__SUPABASE_ANON__';
  var configured =
    SUPABASE_URL.indexOf('__SUPABASE_URL__') === -1 &&
    SUPABASE_ANON.indexOf('__SUPABASE_ANON__') === -1;

  var landing = document.getElementById('landing');
  var section = document.getElementById('share');
  if (!section) return;
  if (landing) landing.style.display = 'none';
  section.style.display = 'block';

  if (!configured) {
    section.innerHTML = renderUnavailable(
      'Share preview is unavailable on this build.',
      'Open the link inside the Interwave desktop app to import this playlist.',
    );
    return;
  }

  section.innerHTML = renderLoading();

  var url =
    SUPABASE_URL +
    '/rest/v1/shared_playlists?token=eq.' +
    encodeURIComponent(token) +
    '&select=name,description,cover_url,tracks,created_at';

  fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: 'Bearer ' + SUPABASE_ANON,
      Accept: 'application/json',
    },
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (rows) {
      if (!rows || rows.length === 0) {
        section.innerHTML = renderUnavailable(
          'Playlist not found',
          'This share link may be expired or revoked. Ask the sender for a new one.',
        );
        return;
      }
      section.innerHTML = renderPlaylist(rows[0], token);
    })
    .catch(function () {
      section.innerHTML = renderUnavailable(
        'Couldn’t load this playlist',
        'Open the link inside the Interwave desktop app, or try again in a moment.',
      );
    });

  function renderLoading() {
    return (
      '<div class="share-wrap">' +
      '<div class="share-loading">Loading shared playlist…</div>' +
      '</div>'
    );
  }

  function renderUnavailable(title, body) {
    return (
      '<div class="share-wrap">' +
      '<a class="back" href="/">← Interwave</a>' +
      '<h1 class="share-title">' + escapeHtml(title) + '</h1>' +
      '<p class="share-sub">' + escapeHtml(body) + '</p>' +
      '<div class="cta-row">' +
      '<a class="btn btn-primary" href="https://github.com/Cloaxyyy/wave/releases/latest">Get Interwave</a>' +
      '<a class="btn btn-ghost" href="/">Back to home</a>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPlaylist(p, tok) {
    var tracks = Array.isArray(p.tracks) ? p.tracks : [];
    var preview = tracks.slice(0, 8).map(function (t) {
      var title = escapeHtml(t.title || 'Untitled');
      var artist = escapeHtml(t.artist || '');
      return (
        '<li class="share-track">' +
        '<span class="share-track-title">' + title + '</span>' +
        '<span class="share-track-artist">' + artist + '</span>' +
        '</li>'
      );
    }).join('');
    var more = tracks.length > 8
      ? '<li class="share-track more">+ ' + (tracks.length - 8) + ' more</li>'
      : '';
    var cover = p.cover_url
      ? '<img class="share-cover" src="' + escapeAttr(p.cover_url) + '" alt="" />'
      : '<div class="share-cover share-cover-fallback">♫</div>';
    var desc = p.description
      ? '<p class="share-desc">' + escapeHtml(p.description) + '</p>'
      : '';
    var importHref = 'interwave://import?token=' + encodeURIComponent(tok);
    return (
      '<div class="share-wrap">' +
      '<a class="back" href="/">← Interwave</a>' +
      '<div class="share-card">' +
      cover +
      '<div class="share-meta">' +
      '<div class="share-kicker">SHARED PLAYLIST</div>' +
      '<h1 class="share-title">' + escapeHtml(p.name || 'Untitled playlist') + '</h1>' +
      desc +
      '<div class="share-count">' + tracks.length + ' track' + (tracks.length === 1 ? '' : 's') + '</div>' +
      '<div class="cta-row">' +
      '<a class="btn btn-primary" href="' + escapeAttr(importHref) + '">Import in Interwave</a>' +
      '<a class="btn btn-ghost" href="https://github.com/Cloaxyyy/wave/releases/latest">Get the app</a>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<ul class="share-list">' + preview + more + '</ul>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
