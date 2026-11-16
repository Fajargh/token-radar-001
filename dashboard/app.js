/* Token Radar dashboard (radar-3): renders window.RADAR (written by main.ts from the sealed snapshot).
   No network, no fetch: the data is the script the page loads beside it. Hash routes make the
   three views reproducible: #/protocol/<slug> opens a detail, #/filter/<category> filters. */
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.getElementById('rows').innerHTML = '<tr><td colspan="9" class="empty">No radar data: run main.ts first.</td></tr>'; return; }

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
  function money2(n) { return '$' + n.toFixed(2); }
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
    kpi('Backtest, leave-one-out', '×' + D.backtest.loo.median_factor.toFixed(2), 'median miss; 5-fold ×' + D.backtest.cv5.median_factor.toFixed(2), false) +
    kpi('Size curve R²', D.curve.r_squared.toFixed(2), D.curve.kept_n + ' traded comps fitted', false);

  /* ---- methodology numbers ---- */
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  setText('curveA', D.curve.intercept.toFixed(4));
  setText('curveB', D.curve.slope.toFixed(4));
  setText('curveR2', D.curve.r_squared.toFixed(3));
  setText('curveN', String(D.curve.kept_n));
  setText('curveClean', String(D.curve.clean_n));
  setText('curveKept', String(D.curve.kept_n));
  setText('curveSetAside', String(D.curve.set_aside_n));
  setText('medRatio', D.curve.median_ratio.toFixed(3) + '×');
  setText('curveBand', D.curve.band_lo.toFixed(3) + '× to ' + D.curve.band_hi.toFixed(2) + '×');

  /* ---- comps, backtest, gas, set-aside and excluded tables ---- */
  $('compsRows').innerHTML = D.comps.map(function (c) {
    return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.comps_n + '</td><td class="num">' +
      (c.raw_median === null ? '—' : c.raw_median.toFixed(3) + '×') + '</td></tr>';
  }).join('');
  function btRow(name, b, meaning) {
    return '<tr><td><b>' + name + '</b></td><td class="num">' + b.n + '</td><td class="num"><b>×' + b.median_factor.toFixed(2) + '</b></td>' +
      '<td class="num">' + Math.round(b.within_2x * 100) + '%</td><td class="num">' + Math.round(b.within_3x * 100) + '%</td><td>' + meaning + '</td></tr>';
  }
  $('backtestRows').innerHTML =
    btRow('Leave-one-out', D.backtest.loo, 'Each token predicted by a curve that never saw it.') +
    btRow('5-fold cross-validation', D.backtest.cv5, 'Each token predicted by a curve fitted on the other four fifths.') +
    btRow('70/30 out-of-sample split', D.backtest.oos_split, 'One fixed split: fitted on 70%, tested on the other 30%.') +
    btRow('Leave-one-out, outliers in', D.backtest.loo_all_clean, 'Same test on all ' + D.curve.clean_n + ' clean comps, the set-aside outliers included.') +
    btRow('5-fold, outliers in', D.backtest.cv5_all_clean, 'Same cross-validation with the outliers included.') +
    btRow('Radar-2 rule, leave-one-out', D.backtest.radar2_loo, 'The old shrunk-category-multiple rule, tested the same way on the same comps.');
  $('gasRows').innerHTML =
    '<tr><td>Ethereum</td><td class="num"><b>$' + D.gas_usd.ethereum.toFixed(2) + '</b></td></tr>' +
    '<tr><td>Solana</td><td class="num"><b>$' + D.gas_usd.solana.toFixed(2) + '</b></td></tr>' +
    '<tr><td>Layer-2s and cheap chains (Arbitrum, Optimism, Base, Linea, Scroll, zkSync Era, Blast, Mantle, Unichain, Ink, Mode, Starknet, Polygon zkEVM, Manta, Fraxtal, Katana, Taiko, Zircuit, Abstract, Soneium, World Chain, Op_Bnb, Arbitrum Nova, Metis, Kroma, Zora, Mint, Lisk, Morph, Boba, Plume, MegaETH, RISE, Fluent, Stable, Tempo, X Layer, Polygon, Celo, xDai, Lens, MetalL2, ApeChain, Reya Network, Degen, Eclipse, Fuel, Zkfair, Silicon zkEVM, KiteAI)</td><td class="num"><b>$' + D.gas_usd.low_cost.toFixed(2) + '</b></td></tr>' +
    '<tr><td>All other chains</td><td class="num"><b>$' + D.gas_usd.other.toFixed(2) + '</b></td></tr>';
  $('setAsideRows').innerHTML = D.curve.set_aside.map(function (x) {
    return '<tr><td><b>' + esc(x.name) + '</b></td><td class="num">' + x.ratio.toFixed(3) + '×</td><td>Multiple outside the band (' + D.curve.band_lo.toFixed(3) + '× to ' + D.curve.band_hi.toFixed(2) + '×): a parent token&rsquo;s market cap on a sub-protocol, or pass-through staked assets counted as TVL.</td></tr>';
  }).join('');
  $('excludedRows').innerHTML = D.excluded.map(function (x) {
    return '<tr><td><b>' + esc(x.name) + '</b></td><td>' + esc(x.category || '—') + '</td><td class="num">' + money(x.tvl_usd) + '</td><td>' + esc(x.reason) + '</td></tr>';
  }).join('');

  /* ---- size-curve scatter: log TVL against log market cap, kept comps and set-aside, fitted line ---- */
  (function renderCurve() {
    var el = $('curveChart');
    if (!el || !D.curve.points.length) return;
    var W = 760, H = 400, L = 58, R = 16, T = 14, B = 36;
    var x0 = Math.log10(5e6), x1 = Math.log10(3e10), y0 = Math.log10(1e5), y1 = Math.log10(3e9);
    function X(v) { return L + ((Math.log10(v) - x0) / (x1 - x0)) * (W - L - R); }
    function Y(v) { return T + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - T - B); }
    var s = '';
    s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Market cap against TVL for the traded comparables, with the fitted size curve">';
    [5e6, 5e7, 5e8, 5e9].forEach(function (t) {
      s += '<line x1="' + X(t).toFixed(1) + '" y1="' + T + '" x2="' + X(t).toFixed(1) + '" y2="' + (H - B) + '" stroke="#e3e0d5"/>';
      s += '<text x="' + X(t).toFixed(1) + '" y="' + (H - 12) + '" font-size="11" fill="#5d6b60" text-anchor="middle">' + (t >= 1e9 ? '$' + (t / 1e9) + 'B' : '$' + (t / 1e6) + 'M') + '</text>';
    });
    [1e6, 1e7, 1e8, 1e9].forEach(function (m) {
      s += '<line x1="' + L + '" y1="' + Y(m).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(m).toFixed(1) + '" stroke="#e3e0d5"/>';
      s += '<text x="' + (L - 8) + '" y="' + (Y(m) + 4).toFixed(1) + '" font-size="11" fill="#5d6b60" text-anchor="end">' + (m >= 1e9 ? '$' + (m / 1e9) + 'B' : '$' + (m / 1e6) + 'M') + '</text>';
    });
    s += '<text x="' + ((W + L) / 2) + '" y="' + (H - 0) + '" font-size="11" fill="#5d6b60" text-anchor="middle"></text>';
    var lx0 = 5e6, lx1 = 3e10;
    var ly0 = Math.pow(10, D.curve.intercept + D.curve.slope * Math.log10(lx0));
    var ly1 = Math.pow(10, D.curve.intercept + D.curve.slope * Math.log10(lx1));
    s += '<line x1="' + X(lx0).toFixed(1) + '" y1="' + Y(Math.max(ly0, 1e5)).toFixed(1) + '" x2="' + X(lx1).toFixed(1) + '" y2="' + Y(Math.min(ly1, 3e9)).toFixed(1) + '" stroke="#0a4d36" stroke-width="2"/>';
    D.curve.points.forEach(function (p) {
      var cx = X(p.tvl_usd).toFixed(1), cy = Y(Math.max(p.mcap_usd, 1e5)).toFixed(1);
      if (p.kept) s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#0e6b4a"><title>' + esc(p.name) + '</title></circle>';
      else s += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#f6f4ee" stroke="#8a978d" stroke-width="1.5"><title>' + esc(p.name) + ' (set aside)</title></circle>';
    });
    s += '<text x="' + L + '" y="' + (T + 2) + '" font-size="11" fill="#5d6b60">Market cap (log scale)</text>';
    s += '<text x="' + (W - R) + '" y="' + (H - B - 8) + '" font-size="11" fill="#5d6b60" text-anchor="end">TVL (log scale)</text>';
    s += '</svg>';
    s += '<div class="legend"><span><i class="k"></i>Kept comp (' + D.curve.kept_n + ')</span><span><i class="s"></i>Set aside (' + D.curve.set_aside_n + ')</span><span><i class="l"></i>Fitted curve: log&#8321;&#8320;(mcap) = ' + D.curve.intercept.toFixed(2) + ' + ' + D.curve.slope.toFixed(2) + ' &times; log&#8321;&#8320;(TVL)</span></div>';
    s += '<p class="chart-cap">Each dot is a traded token. The curve runs through the cloud, not through any one dot: the market pays less per TVL dollar as a protocol grows, which is why the biggest pre-token protocols are worth far less than a fixed multiple of their TVL would say.</p>';
    el.innerHTML = s;
  })();

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
      farmcost: function (a, b) { return a.farm_cost_usd - b.farm_cost_usd || a.rank - b.rank; },
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
    if (!list.length) { rowsEl.innerHTML = '<tr><td colspan="9" class="empty">No protocol matches these filters.</td></tr>'; return; }
    rowsEl.innerHTML = list.map(function (r) {
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImp) * 110));
      var badge = r.rank === 1 ? 'top1' : r.rank <= 3 ? 'top' + r.rank : '';
      var flag = r.off_watchlist_above_floor ? '<span class="flag">off-watchlist, above floor</span>' : '';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num"><span class="rankbadge ' + badge + '">' + r.rank + '</span></td>' +
        '<td><div class="pname">' + esc(r.name) + flag + '</div><div class="psub">' + esc(r.category || 'Uncategorised') + ' on ' + esc(chainsOf(r)) + '</div></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageFmt(r.age_days) + '</td>' +
        '<td class="num">' + money(r.predicted_mcap_usd) + '</td>' +
        '<td class="num"><span class="bar"><i style="width:' + w + 'px"></i><b>' + money(r.implied_value_usd) + '</b></span></td>' +
        '<td class="num">' + money2(r.farm_cost_usd) + '</td>' +
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
        '<td class="num"><span class="dim">—</span></td>' +
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
    var flagNote = r.off_watchlist_above_floor
      ? '<p class="note"><b>Off-watchlist, above floor.</b> This protocol passes every check the snapshot can show, yet the house watchlist leaves it out. The house&rsquo;s rule also uses DefiLlama&rsquo;s parent-protocol field, which the snapshot does not carry, so the visible record can neither confirm nor deny a parent. It is ranked on the visible record; weigh it accordingly.</p>'
      : '';
    detailEl.innerHTML =
      '<div class="d-kicker"><span>Rank ' + r.rank + ' of ' + D.rows.length + '</span><button class="d-close" type="button" id="dClose">Close</button></div>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="d-sub">' + esc(r.category || 'Uncategorised') + ' on ' + esc(r.chains.join(', ')) + '</p>' +
      flagNote +
      '<h3>Implied value</h3>' +
      '<div class="kv"><span>TVL</span><b>' + moneyFull(r.tvl_usd) + '</b></div>' +
      '<div class="kv"><span>Curve value (fitted: log&#8321;&#8320;(mcap) = ' + D.curve.intercept.toFixed(2) + ' + ' + D.curve.slope.toFixed(2) + ' &times; log&#8321;&#8320;(TVL))</span><b>' + moneyFull(step1) + '</b></div>' +
      '<div class="kv"><span>Seven-day growth (' + (r.change_7d === null ? 'not reported, taken as 0' : growthPct.toFixed(2) + '%') + ')</span><b>× ' + r.growth_multiplier.toFixed(4) + '</b></div>' +
      '<div class="kv"><span>Age with no token (' + (r.age_days === null ? 'unknown, taken as 365 days' : r.age_days + ' days') + ')</span><b>× ' + r.maturity_multiplier.toFixed(4) + '</b></div>' +
      '<div class="kv"><span>Chain breadth (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</span><b>× ' + r.breadth_multiplier.toFixed(4) + '</b></div>' +
      '<div class="kv total"><span>Implied value</span><b>' + moneyFull(r.implied_value_usd) + '</b></div>' +
      '<div class="math">curve(' + moneyFull(r.tvl_usd) + ') = <b>' + moneyFull(step1) + '</b><br>' +
      moneyFull(step1) + ' × ' + r.growth_multiplier.toFixed(6) + ' = <b>' + moneyFull(step2) + '</b><br>' +
      moneyFull(step2) + ' × ' + r.maturity_multiplier.toFixed(6) + ' = <b>' + moneyFull(step3) + '</b><br>' +
      moneyFull(step3) + ' × ' + r.breadth_multiplier.toFixed(6) + ' = <b>' + moneyFull(step4) + '</b></div>' +
      '<p class="note">Why rank ' + r.rank + ': ' + esc(r.name) + ' records no token and carries ' + money(r.tvl_usd) + ' of TVL, and the fitted curve prices that TVL at ' + money(r.predicted_mcap_usd) + ' from ' + D.curve.kept_n + ' traded comps. The page recomputes this row as ' + money(r.implied_value_usd) + ', the same number board.json carries. The curve&rsquo;s leave-one-out backtest says its typical prediction is off by &times;' + D.backtest.loo.median_factor.toFixed(2) + ', so read this as an order of magnitude, not a price.</p>' +
      '<h3>Farm plan &mdash; net ' + money2(r.farm_cost_usd) + '</h3>' +
      '<div class="kv"><span>Net farm cost (gas + fees)</span><b>' + money2(r.farm_cost_usd) + '</b></div>' +
      '<div class="kv"><span>Gas, at the assumed per-transaction prices</span><b>' + money2(r.farm_gas_usd) + '</b></div>' +
      '<div class="kv"><span>Fees the actions charge</span><b>' + money2(r.farm_fees_usd) + '</b></div>' +
      '<div class="kv"><span>Capital deployed (returned on exit)</span><b>' + money2(r.farm_capital_usd) + '</b></div>' +
      '<div class="kv"><span>Cost per $1M of implied value</span><b>' + money2((r.farm_cost_usd / r.implied_value_usd) * 1000000) + '</b></div>' +
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
