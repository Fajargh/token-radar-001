/* Token Radar dashboard: renders window.RADAR (written by main.ts from the sealed snapshot).
   No network, no fetch: the data is the script the page loads beside it. Hash routes make the
   three views reproducible: #/protocol/<slug> opens a detail, #/filter/<category> filters. */
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.getElementById('rows').innerHTML = '<tr><td colspan="8" class="empty">No radar data: run main.ts first.</td></tr>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows'), boardEl = $('board'), detailEl = $('detail');
  var state = { q: '', category: '', chain: '', mintvl: 0, watchonly: false, sort: 'rank', view: 'pre', sel: null };

  /* ---- formatting ---- */
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pct(n) {
    if (n === null || n === undefined) return '<span class="dim">—</span>';
    var cls = n > 0 ? 'pos' : n < 0 ? 'neg' : '';
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(2) + '%</span>';
  }
  function ageFmt(days) {
    if (days === null || days === undefined) return '<span class="dim">unknown</span>';
    if (days < 90) return days + 'd';
    if (days < 730) return (days / 365).toFixed(1).replace(/\.0$/, '') + 'y';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function chainsOf(r) { return r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : ''); }

  /* ---- header, KPIs, selects ---- */
  var totalImplied = D.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  var top = D.rows[0];
  $('topmeta').textContent = 'Snapshot ' + D.as_of + ' · DefiLlama protocol index · model ' + D.model_version;
  $('headline').textContent = D.board_size + ' pre-token protocols, ranked by implied value';
  var cats = [];
  D.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  var chains = [];
  D.rows.forEach(function (r) { r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
  chains.sort();
  $('category').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  function kpi(label, value, sub, hot) {
    return '<div class="kpi' + (hot ? ' hot' : '') + '"><div class="k-label">' + label + '</div><div class="k-value">' + value + '</div><div class="k-sub">' + sub + '</div></div>';
  }
  $('kpis').innerHTML =
    kpi('Watchlist covered', D.watchlist_size + ' / ' + D.watchlist_size, 'every protocol on the floor', true) +
    kpi('Board rows', String(D.board_size), D.early_size + ' early rows below the floor', false) +
    kpi('Total implied value', money(totalImplied), 'sum of all ' + D.board_size + ' rows', false) +
    kpi('Top implied value', money(top ? top.implied_value_usd : 0), top ? esc(top.name) : '', false) +
    kpi('Categories', String(cats.length), 'with a comps multiple each', false) +
    kpi('Live tokens set aside', String(D.live_size), 'shown at market value, never ranked', false);

  /* ---- comps + excluded tables (methodology) ---- */
  $('compsRows').innerHTML = D.comps.map(function (c) {
    return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.comps_n + '</td><td class="num">' +
      (c.raw_median === null ? '—' : c.raw_median.toFixed(3)) + '</td><td class="num"><b>' + c.multiple.toFixed(3) + '×</b></td></tr>';
  }).join('') + '<tr><td><b>Global median (no live comps)</b></td><td class="num">—</td><td class="num">—</td><td class="num"><b>' + D.global_median.toFixed(3) + '×</b></td></tr>';
  var gm = document.getElementById('globmed'); if (gm) gm.textContent = D.global_median.toFixed(3);
  $('excludedRows').innerHTML = D.excluded.map(function (x) {
    return '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(x.category || '—') + '</td><td class="num">' + money(x.tvl_usd) + '</td><td>' + esc(x.reason) + '</td></tr>';
  }).join('');

  /* ---- filtering + sorting ---- */
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = D.rows.filter(function (r) {
      if (state.category && r.category !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.mintvl) return false;
      if (state.watchonly && !isWatch(r)) return false;
      if (q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var by = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; },
    }[state.sort] || function (a, b) { return a.rank - b.rank; };
    return list.slice().sort(by);
  }
  var watchSet = {};
  D.watchlist.forEach(function (s) { watchSet[s] = true; });
  function isWatch(r) { return !!watchSet[r.slug]; }

  function renderBoard() {
    var list = filtered();
    var maxImp = D.rows.length ? D.rows[0].implied_value_usd : 1;
    $('rowcount').textContent = list.length + ' of ' + D.rows.length + ' rows shown' +
      (state.category ? ' · category: ' + state.category : '') + (state.watchonly ? ' · watchlist only' : '');
    $('boardnote').textContent = 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.';
    if (!list.length) { rowsEl.innerHTML = '<tr><td colspan="8" class="empty">No protocol matches these filters.</td></tr>'; return; }
    rowsEl.innerHTML = list.map(function (r) {
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImp) * 110));
      var badge = r.rank === 1 ? 'top1' : r.rank <= 3 ? 'top' + r.rank : '';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num"><span class="rankbadge ' + badge + '">' + r.rank + '</span></td>' +
        '<td><div class="pname">' + esc(r.name) + '</div><div class="psub">' + esc(r.category || 'Uncategorised') + ' on ' + esc(chainsOf(r)) + '</div></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageFmt(r.age_days) + '</td>' +
        '<td class="num">' + r.comps_multiple.toFixed(2) + '×</td>' +
        '<td class="num"><span class="bar"><i style="width:' + w + 'px"></i><b>' + money(r.implied_value_usd) + '</b></span></td>' +
        '<td class="num"><span class="pill pre">● no token</span></td></tr>';
    }).join('');
  }

  function renderLive() {
    var list = D.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
    $('rowcount').textContent = list.length + ' live-token protocols by market cap — shown at the market’s own value, never ranked.';
    $('boardnote').textContent = 'Protocols whose token already trades. They set the comparables the pre-token board is priced off, and are never ranked as launches.';
    rowsEl.innerHTML = list.map(function (r, i) {
      return '<tr data-slug=""><td class="num"><span class="rankbadge">' + (i + 1) + '</span></td>' +
        '<td><div class="pname">' + esc(r.name) + '</div><div class="psub">' + esc(r.category || 'Uncategorised') + ' on ' + esc(chainsOf(r)) + '</div></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num"><span class="dim">—</span></td>' +
        '<td class="num">' + (r.mcap_tvl === null ? '—' : r.mcap_tvl.toFixed(2) + '×') + '</td>' +
        '<td class="num"><span class="bar"><b>' + money(r.mcap_usd || 0) + '</b></span></td>' +
        '<td class="num"><span class="pill live">● trades</span></td></tr>';
    }).join('');
  }

  function render() {
    boardEl.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
    });
    if (state.view === 'live') renderLive(); else renderBoard();
  }

  /* ---- detail panel ---- */
  function openDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) { closeDetail(); return; }
    state.sel = slug;
    var growthPct = r.change_7d === null ? 0 : Math.min(100, Math.max(-50, r.change_7d));
    var step1 = r.base_usd;
    var step2 = Math.round(step1 * r.growth_multiplier);
    var step3 = Math.round(step2 * r.maturity_multiplier);
    var step4 = Math.round(step3 * r.breadth_multiplier);
    var comp = null;
    D.comps.forEach(function (c) { if (c.category === r.category) comp = c; });
    detailEl.innerHTML =
      '<div class="d-kicker"><span>Rank ' + r.rank + ' of ' + D.rows.length + '</span><button class="d-close" type="button" id="dClose">Close</button></div>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="d-sub">' + esc(r.category || 'Uncategorised') + ' on ' + esc(r.chains.join(', ')) + '</p>' +
      '<h3>Implied value</h3>' +
      '<div class="kv"><span>TVL</span><b>' + moneyFull(r.tvl_usd) + '</b></div>' +
      '<div class="kv"><span>Comps multiple (' + esc(r.category || 'no category') + ', ' + r.category_comps_n + ' live comps)</span><b>' + r.comps_multiple.toFixed(3) + '×</b></div>' +
      '<div class="kv"><span>Base value (TVL × multiple)</span><b>' + moneyFull(step1) + '</b></div>' +
      '<div class="kv"><span>Seven-day growth (' + (r.change_7d === null ? 'not reported, taken as 0' : growthPct.toFixed(2) + '%') + ')</span><b>× ' + r.growth_multiplier.toFixed(4) + '</b></div>' +
      '<div class="kv"><span>Age with no token (' + (r.age_days === null ? 'unknown, taken as 365 days' : r.age_days + ' days') + ')</span><b>× ' + r.maturity_multiplier.toFixed(4) + '</b></div>' +
      '<div class="kv"><span>Chain breadth (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</span><b>× ' + r.breadth_multiplier.toFixed(4) + '</b></div>' +
      '<div class="kv total"><span>Implied value</span><b>' + moneyFull(r.implied_value_usd) + '</b></div>' +
      '<div class="math">' + moneyFull(r.tvl_usd) + ' × ' + r.comps_multiple.toFixed(3) + ' = <b>' + moneyFull(step1) + '</b><br>' +
      moneyFull(step1) + ' × ' + r.growth_multiplier.toFixed(6) + ' = <b>' + moneyFull(step2) + '</b><br>' +
      moneyFull(step2) + ' × ' + r.maturity_multiplier.toFixed(6) + ' = <b>' + moneyFull(step3) + '</b><br>' +
      moneyFull(step3) + ' × ' + r.breadth_multiplier.toFixed(6) + ' = <b>' + moneyFull(step4) + '</b></div>' +
      '<p class="note">Why rank ' + r.rank + ': ' + esc(r.name) + ' records no token and carries ' + money(r.tvl_usd) + ' of TVL' +
      (comp ? ', and live ' + esc(r.category) + ' protocols trade at a median ' + comp.raw_median.toFixed(3) + '× TVL (' + comp.comps_n + ' comps), shrunk to ' + r.comps_multiple.toFixed(3) + '×' : ', priced off the global median multiple') +
      '. The page recomputes this row as ' + money(r.implied_value_usd) + ', the same number board.json carries. This is an estimate, not a price.</p>' +
      '<h3>Farm plan</h3>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) {
        var m = s.match(/^(.*?) Cost: (.*?) Time: (.*?)\.?$/);
        if (!m) return '<li>' + esc(s) + '</li>';
        return '<li>' + esc(m[1]) + '<span class="s-meta">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="note"><b>Records no token</b> is what the snapshot says — not proof the protocol has none. Farming costs gas and carries smart-contract risk; never pay to claim, and claim only from the link the protocol itself publishes.</p>';
    detailEl.classList.add('open');
    detailEl.setAttribute('aria-hidden', 'false');
    $('dClose').addEventListener('click', closeDetail);
    render();
  }
  function closeDetail() {
    state.sel = null;
    detailEl.classList.remove('open');
    detailEl.setAttribute('aria-hidden', 'true');
    detailEl.innerHTML = '';
    if (location.hash.indexOf('#/protocol/') === 0) history.replaceState(null, '', location.pathname + location.search);
    render();
  }

  /* ---- events ---- */
  function bind(id, ev, fn) { $(id).addEventListener(ev, fn); }
  bind('q', 'input', function (e) { state.q = e.target.value; render(); });
  bind('category', 'change', function (e) { state.category = e.target.value; render(); });
  bind('chain', 'change', function (e) { state.chain = e.target.value; render(); });
  bind('mintvl', 'change', function (e) { state.mintvl = Number(e.target.value); render(); });
  bind('watchonly', 'change', function (e) { state.watchonly = e.target.checked; render(); });
  bind('sort', 'change', function (e) { state.sort = e.target.value; render(); });
  bind('segPre', 'click', function () { state.view = 'pre'; $('segPre').classList.add('on'); $('segLive').classList.remove('on'); render(); });
  bind('segLive', 'click', function () { state.view = 'live'; $('segLive').classList.add('on'); $('segPre').classList.remove('on'); render(); });
  boardEl.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () { state.sort = th.getAttribute('data-sort'); $('sort').value = state.sort; render(); });
  });
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr && tr.getAttribute('data-slug')) openDetail(tr.getAttribute('data-slug'));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  /* ---- hash routes: #/protocol/<slug> and #/filter/<category> ---- */
  function route() {
    var h = location.hash || '';
    var m = h.match(/^#\/protocol\/([A-Za-z0-9._-]+)$/);
    if (m) { openDetail(m[1]); return; }
    if (state.sel) closeDetail();
    var f = h.match(/^#\/filter\/(.+)$/);
    if (f) {
      var cat = decodeURIComponent(f[1]);
      if (cats.indexOf(cat) >= 0) { state.category = cat; $('category').value = cat; }
      render();
      return;
    }
    render();
  }
  window.addEventListener('hashchange', route);
  route();
})();
