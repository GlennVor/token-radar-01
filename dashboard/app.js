// Token Radar dashboard: renders window.RADAR with no network. The board is sortable and
// filterable, every row opens a detail view with its model breakdown and farm plan, and the live
// section shows the protocols that already trade. Farm plans are generated here from the same
// rules as lib/model.ts, so the page and board.json agree step for step.

(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var money = function (n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  };
  var pct = function (n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(2) + '%';
    var cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
    return '<span class="' + cls + '">' + s + '</span>';
  };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  // ---- farm plan: the same rules as lib/model.ts farmSteps, so the page matches board.json ----
  function chainOf(row) { return row.chains.length > 0 ? row.chains[0] : 'its main chain'; }
  function capitalFor(row) {
    if (row.tvl_usd >= 5000000000) return 250;
    if (row.tvl_usd >= 1000000000) return 150;
    if (row.tvl_usd >= 100000000) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) {
      return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares; the vault\'s own page shows which strategy the deposit follows.';
    }
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) {
      return 'Mint $' + capital + ' of the protocol\'s yield-bearing asset on ' + chain + ' and hold it in the same wallet.';
    }
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) {
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and leave the supply position open.';
    }
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) {
      return 'Provide $' + capital + ' of liquidity to ' + name + '\'s main pool on ' + chain + ' and keep the position open.';
    }
    if (c.indexOf('yield') >= 0 || c.indexOf('aggregator') >= 0) {
      return 'Deposit $' + capital + ' into ' + name + '\'s highest-TVL strategy on ' + chain + ' and keep the position open.';
    }
    if (c.indexOf('bridge') >= 0) {
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds inside its app.';
    }
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) {
      return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' and keep the receipt token.';
    }
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis') >= 0) {
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    }
    if (c.indexOf('prediction') >= 0) {
      return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    }
    if (c.indexOf('stable') >= 0) {
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    }
    if (c.indexOf('insurance') >= 0) {
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    }
    if (c.indexOf('payment') >= 0) {
      return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' and keep the receipts.';
    }
    if (c.indexOf('chain') >= 0) {
      return 'Bridge $' + capital + ' to the chain ' + name + ' runs on and use one of its native apps.';
    }
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(row) {
    var chain = chainOf(row);
    var capital = capitalFor(row);
    var hold = holdDaysFor(row.age_days);
    var gas = capital >= 150 ? 8 : 4;
    var action = actionFor(row, capital, chain);
    var steps = [
      { text: 'Set aside a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline, never in a screenshot or a chat.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: action, cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action each week on ' + chain + ', such as a deposit, a swap, a vote or a claim, so the wallet reads as active rather than one-off.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page from its official site and claim only from the link it publishes.', cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction hash in a farm log, so you can repeat the position on another wallet or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' },
    ];
    return steps.map(function (s) { return s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.'; });
  }

  // ---- header stats ----
  var topImplied = R.rows.reduce(function (a, b) { return a + b.implied_value_usd; }, 0);
  $('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + R.board_size + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + R.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + R.early_size + '</dd></div>' +
    '<div><dt>Live tokens</dt><dd>' + R.live_size + '</dd></div>' +
    '<div><dt>Total implied value</dt><dd>' + money(topImplied) + '</dd></div>';
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · watchlist floor ' + money(R.floor_usd) + ' · model ' + R.model_version + ' · ' + esc(R.source);
  $('methodMeta').textContent = 'Model ' + R.model_version + ': implied = TVL × category multiple × growth factor × maturity factor. Multiples computed from this snapshot at run time; nothing is hardcoded by name.';

  // ---- filters ----
  var cats = [];
  var chains = [];
  R.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort();
  chains.sort();
  $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  var state = { q: '', cat: '', chain: '', set: '', minTvl: 0, sort: 'rank', dir: 1 };
  var selected = null;

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.set === 'watchlist' && !r.watchlist) return false;
      if (state.set === 'early' && r.watchlist) return false;
      if (r.tvl_usd < state.minTvl) return false;
      return true;
    });
  }

  function sortVal(r, key) {
    if (key === 'name' || key === 'category') return (r[key] || '').toLowerCase();
    if (key === 'chains') return (r.chains[0] || '').toLowerCase();
    if (key === 'age_days') return r.age_days === null ? -1 : r.age_days;
    if (key === 'change_7d') return r.change_7d === null ? -9999 : r.change_7d;
    return r[key];
  }
  function renderBoard() {
    var rows = filtered();
    rows.sort(function (a, b) {
      var va = sortVal(a, state.sort);
      var vb = sortVal(b, state.sort);
      if (va < vb) return -1 * state.dir;
      if (va > vb) return 1 * state.dir;
      return a.rank - b.rank;
    });
    $('boardCount').textContent = rows.length + ' of ' + R.board_size + ' rows';
    $('rows').innerHTML = rows.map(function (r) {
      var age = r.age_days === null ? '—' : r.age_days + 'd';
      var pill = r.watchlist ? '<span class="pill">Watchlist</span>' : '<span class="pill early">Early find</span>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong> ' + pill + '<br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age + '</td>' +
        '<td class="num">' + r.category_multiple.toFixed(3) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="9">No protocols match these filters.</td></tr>';
    document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
    });
  }

  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) r = R.rows[i];
    if (!r) return;
    selected = slug;
    var growthPct = clamp(r.change_7d === null ? 0 : r.change_7d, -60, 120);
    var ageTxt = r.age_days === null ? 'unknown (counts as 365 days)' : r.age_days + ' days';
    $('dKicker').textContent = 'Rank #' + r.rank + ' · ' + (r.watchlist ? 'Watchlist' : 'Early find') + ' · ' + (r.category || 'Uncategorised');
    $('dName').textContent = r.name;
    $('dSub').textContent = r.slug + ' · ' + r.chains.join(', ') + (r.listed_at ? ' · listed ' + r.listed_at : '');
    $('dStats').innerHTML =
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(2) + '%') + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + ageTxt + '</dd></div>';
    $('dFormula').textContent =
      money(r.tvl_usd) + ' TVL × ' + r.category_multiple.toFixed(3) + ' (' + (r.category || 'Unknown') + ' multiple) × ' +
      r.growth_multiplier.toFixed(4) + ' (growth, 7d ' + (r.change_7d === null ? 'unreported' : growthPct.toFixed(2) + '%') + ') × ' +
      r.maturity_multiplier.toFixed(4) + ' (maturity) = ' + money(r.implied_value_usd) + '.';
    $('dSteps').innerHTML = farmSteps(r).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    $('detail').hidden = false;
    renderBoard();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- live tokens ----
  $('liveRows').innerHTML = R.live.map(function (p) {
    return '<tr><td><strong>' + esc(p.name) + '</strong></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td>' + esc(p.chains.slice(0, 3).join(', ')) + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- multiples table ----
  $('multRows').innerHTML = R.multiples.map(function (m) {
    return '<tr><td>' + esc(m.category) + '</td>' +
      '<td class="num">' + m.multiple.toFixed(3) + '</td>' +
      '<td class="num">' + m.samples + '</td>' +
      '<td>' + (m.fallback ? 'Fewer than 3 priced protocols — global median' : 'Median of priced protocols in this category') + '</td></tr>';
  }).join('');

  // ---- events ----
  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('set').addEventListener('change', function (e) { state.set = e.target.value; renderBoard(); });
  $('minTvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); renderBoard(); });
  $('reset').addEventListener('click', function () {
    state.q = ''; state.cat = ''; state.chain = ''; state.set = ''; state.minTvl = 0; state.sort = 'rank'; state.dir = 1;
    $('q').value = ''; $('cat').value = ''; $('chain').value = ''; $('set').value = ''; $('minTvl').value = '0';
    renderBoard();
  });
  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = 1; }
      renderBoard();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });
  $('dClose').addEventListener('click', function () {
    selected = null;
    $('detail').hidden = true;
    renderBoard();
  });

  renderBoard();
})();
