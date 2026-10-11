/* Node Factory docs — shared behaviour. No dependencies. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ------------------------------------------------------------ number formatting (idle-game suffixes)
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (!isFinite(n)) return '∞';
    const neg = n < 0; n = Math.abs(n);
    if (n < 1000) {
      const s = n >= 100 ? n.toFixed(0) : n >= 10 ? +n.toFixed(1) : +n.toFixed(digits);
      return (neg ? '−' : '') + s;
    }
    const e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return (neg ? '−' : '') + n.toExponential(2).replace('e+', 'e');
    const v = n / Math.pow(1000, e);
    return (neg ? '−' : '') + (+v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)) + SUF[e];
  }
  const money = n => '$' + fmt(n);
  window.NF = { fmt, money };

  // ------------------------------------------------------------ nav
  const toggle = $('.nav-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    const nav = $('.nav'); const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });

  // back to top
  const top = $('.to-top');
  if (top) addEventListener('scroll', () => top.classList.toggle('show', scrollY > 900), { passive: true });

  // TOC scroll-spy
  const tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(tocLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { tocLinks.forEach(a => a.classList.remove('active')); map.get(e.target.id)?.classList.add('active'); }
    }), { rootMargin: '-20% 0px -70% 0px' });
    map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // ------------------------------------------------------------ lazy looping clips (GIF replacement)
  const vids = $$('video[data-loop]');
  if (vids.length) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const load = v => {
      if (v.dataset.loaded) return; v.dataset.loaded = 1;
      const n = v.dataset.loop;
      v.innerHTML = `<source src="assets/media/${n}.webm" type="video/webm"><source src="assets/media/${n}.mp4" type="video/mp4">`;
      v.load();
    };
    vids.forEach(v => {
      v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
      if (!v.poster) v.poster = `assets/media/${v.dataset.loop}.webp`;
      if (reduce) { v.controls = true; }
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) { load(v); if (!reduce) v.play().catch(() => {}); } else if (v.dataset.loaded) v.pause();
      }), { rootMargin: '200px' });
      vids.forEach(v => io.observe(v));
    } else vids.forEach(v => { load(v); v.play().catch(() => {}); });
  }

  // ------------------------------------------------------------ helpers for data rendering
  const D = { nodes: window.NODES || [], res: window.RESOURCES || [], names: window.RES_NAMES || {} };
  const resByKey = Object.fromEntries(D.res.map(r => [r.key, r]));
  const nodeByName = Object.fromEntries(D.nodes.map(n => [n.name, n]));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rname = k => D.names[k] || k;
  function chip(p, amount) {
    const r = resByKey[p.type] || {};
    const color = p.color || r.color || '#888';
    const shape = p.shape || r.shape || 'circle';
    const amt = amount !== undefined && amount !== null && amount !== 0 ? `<span class="amt">${fmt(amount)}</span>` : '';
    return `<span class="chip" style="--c:${color}"><i class="dot ${shape}"></i>${amt}${esc(rname(p.type))}</span>`;
  }
  const heatClass = h => h <= 0 ? 'heat-cold' : h <= 100 ? 'heat-ok' : h <= 250 ? 'heat-warm' : 'heat-hot';
  const nodeLink = name => {
    const any = name.endsWith(' (any)'), base = any ? name.slice(0, -6) : name, n = nodeByName[base];
    const tag = any ? ' <span class="small muted" title="Through a generic input port">(any)</span>' : '';
    return (n ? `<a href="nodes.html#${n.id}">${esc(base)}</a>` : esc(base)) + tag;
  };
  function valueRatio(n) {
    const val = ps => ps.reduce((s, p) => s + (resByKey[p.type]?.price || 0) * p.amount, 0);
    const i = val(n.inputs), o = val(n.outputs);
    return i > 0 && o > 0 && n.inputs.every(p => resByKey[p.type]?.sellable) ? o / i : null;
  }
  window.NF.chip = chip;

  // ------------------------------------------------------------ nodes page
  const nodeGrid = $('#node-grid');
  if (nodeGrid) {
    const special = {
      Market: [['Price', 'Sell price of the input resource'], ['Speed', 'Sells everything it receives']],
      Collector: [['Storage', 'Unlimited'], ['Auto', 'Auto Collect skill ($53K)']],
      Split: [['Ratio', 'Slider, default 50 / 50'], ['Type', 'Adapts to input']],
      Union: [['Inputs', 'Many, same type'], ['Output', 'Sum of inputs']],
      Researcher: [['Accepts', 'Model Lab requirements'], ['Stores', 'Research stock']],
      'Antimalware Cannon': [['Fire rate', '1 shot/s base, +1 per level'], ['Range', '+1% per level']],
      Fan: [['Cooling', '−30 heat per level'], ['Scaling', 'Linear, Fan Heat upgrades']],
    };
    nodeGrid.innerHTML = D.nodes.map(n => {
      const ins = n.inputs.length ? n.inputs.map(p => chip(p, n.name === 'Market' || n.name === 'Researcher' ? null : p.amount)).join('') : '<span class="none">no input</span>';
      const outs = n.outputs.length ? n.outputs.map(p => chip(p, n.name === 'Market' ? null : p.amount)).join('') : '<span class="none">no output</span>';
      const slots = n.start < 0 ? '∞' : n.start;
      const ratio = valueRatio(n);
      const cap = n.cap !== null ? `<div class="stat"><b>${fmt(n.cap)}/s</b><span>Capacity</span></div>` : '';
      const extra = (special[n.name] || []).map(([k, v]) => `<div class="stat" style="grid-column:1 / -1"><span>${k}</span> ${esc(v)}</div>`).join('');
      let details = '';
      if (n.slot || n.rate || n.autoscale || ratio) {
        const rows = [];
        if (ratio) rows.push(['Sell value added', `×${ratio.toFixed(2)}`]);
        if (n.autoscale) rows.push(['Auto-scaling', `×${n.autoscale[1]} every ${n.autoscale[0]} levels`]);
        if (n.rate) rows.push(['Rate upgrade (level n)', `${n.rate.currency === 'Money' ? '$' : ''}${fmt(n.rate.base)} × ${n.rate.growth}ⁿ ${n.rate.currency === 'Research' ? 'RP' : ''}`]);
        if (n.rate) rows.push(['Max rate level', fmt(n.rate.max)]);
        if (n.slot) rows.push(['Extra slot cost', `${fmt(n.slot.base)} × ${n.slot.growth}^(slots × ${n.slot.power}) ${n.slot.currency === 'Money' ? '$' : 'RP'}`]);
        if (n.slot) rows.push(['Buyable slots', n.slot.max]);
        if (n.slot) {
          const first = n.slot.base * Math.pow(n.slot.growth, Math.max(n.start, 0) * n.slot.power);
          rows.push(['Next slot', `${n.slot.currency === 'Money' ? '$' : ''}${fmt(first)}${n.slot.currency === 'Research' ? ' RP' : ''}`]);
        }
        details = `<details><summary>Costs &amp; scaling</summary><dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></details>`;
      }
      return `<article class="node" id="${n.id}" data-cat="${n.cat}" data-text="${esc((n.name + ' ' + n.desc + ' ' + n.inputs.concat(n.outputs).map(p => rname(p.type)).join(' ')).toLowerCase())}">
        <div class="node-head">${esc(n.name)}</div>
        <div class="node-body">
          <div class="node-top"><div class="screen"><img src="assets/img/icons/${n.icon}.webp" alt="" width="46" height="46" loading="lazy"></div>
          <p class="node-desc">${esc(n.desc)}</p></div>
          <div class="recipe">${ins}<span class="arrow">→</span>${outs}</div>
          <div class="stats">${cap}
            <div class="stat"><b class="${heatClass(n.heat)}">${n.heat > 0 ? '+' : ''}${n.heat}</b><span>Heat</span></div>
            <div class="stat"><b>${slots}</b><span>Start slots</span></div>
            ${extra}
          </div>
          ${details}
        </div></article>`;
    }).join('');

    const search = $('#node-search'); let cat = 'All';
    const apply = () => {
      const q = (search.value || '').trim().toLowerCase(); let shown = 0;
      $$('.node', nodeGrid).forEach(el => {
        const ok = (cat === 'All' || el.dataset.cat === cat) && (!q || el.dataset.text.includes(q));
        el.hidden = !ok; if (ok) shown++;
      });
      $('#node-count').textContent = `${shown} node${shown === 1 ? '' : 's'}`;
    };
    $$('.filter').forEach(b => b.addEventListener('click', () => {
      $$('.filter').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
      cat = b.dataset.cat; apply();
    }));
    search.addEventListener('input', apply); apply();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 50); }
  }

  // ------------------------------------------------------------ resources page
  const resBody = $('#res-body');
  if (resBody) {
    const rows = D.res.map(r => ({
      r, price: r.sellable ? r.price : null, max: r.sellable && r.price ? r.price * 2 : null,
    }));
    const render = list => {
      resBody.innerHTML = list.map(({ r, price, max }) => `<tr id="res-${r.key}" data-group="${r.group}">
        <td><span class="chip" style="--c:${r.color}"><i class="dot ${r.shape || 'circle'}"></i>${esc(r.name)}</span></td>
        <td>${esc(r.group)}</td>
        <td class="num">${price ? money(price) : '<span class="muted">—</span>'}</td>
        <td class="num">${max ? money(max) : '<span class="muted">—</span>'}</td>
        <td>${r.unit ? `<code>${esc(r.unit)}</code>` : ''}</td>
        <td>${r.producedBy.map(nodeLink).join(', ') || '<span class="muted">—</span>'}</td>
        <td>${[...new Set(r.usedBy)].map(nodeLink).join(', ') || (r.sellable ? '<span class="muted">Sell at Market</span>' : '<span class="muted">—</span>')}</td>
        <td class="small muted">${esc(r.note)}</td></tr>`).join('');
    };
    render(rows);
    let groupSel = 'All';
    const filterRows = () => $$('tr', resBody).forEach(tr => tr.hidden = !(groupSel === 'All' || tr.dataset.group === groupSel));
    $$('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort; const dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
      $$('th[data-sort]').forEach(x => x.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      const val = x => k === 'name' ? x.r.name : k === 'group' ? x.r.group : (x[k] ?? -1);
      rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
      render(rows); filterRows();
    }));
    $$('.filter[data-group]').forEach(b => b.addEventListener('click', () => {
      $$('.filter[data-group]').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
      groupSel = b.dataset.group; filterRows();
    }));
  }

  // ------------------------------------------------------------ models table
  const modelBody = $('#model-body');
  if (modelBody && window.MODELS) {
    modelBody.innerHTML = window.MODELS.map(m => `<tr>
      <td><b>${esc(m.name)}</b></td>
      <td class="num research">${fmt(m.base)}/s</td>
      <td class="num">×${m.growth}</td>
      <td>${m.req.map(([t, a, lvl]) => chip({ type: t }, a) + (lvl ? ` <span class="small muted">from L${lvl}</span>` : '')).join('<br>')}</td>
      <td class="num">×${m.reqGrowth}</td>
      <td class="small">${esc(m.unlock)}</td></tr>`).join('');
  }

  // ------------------------------------------------------------ heat table + bar
  const heatBody = $('#heat-body');
  if (heatBody && window.HEAT_TABLE) {
    heatBody.innerHTML = window.HEAT_TABLE.map(([range, m, s]) => {
      const col = s === 'Cool' ? 'heat-cold' : s === 'Safe' ? 'heat-ok' : s === 'Warning' ? 'heat-warm' : 'heat-hot';
      return `<tr><td>${range}</td><td class="num"><b class="${col}">×${m}</b></td><td class="${col}">${s}</td></tr>`;
    }).join('');
  }

  // ------------------------------------------------------------ calculators
  const num = id => parseFloat(($('#' + id) || {}).value) || 0;
  function bindCalc(ids, fn) {
    const els = ids.map(id => $('#' + id)).filter(Boolean);
    if (!els.length) return;
    els.forEach(e => e.addEventListener('input', fn)); fn();
  }
  // prestige
  bindCalc(['pc-life', 'pc-owned'], () => {
    const P = window.PRESTIGE || { threshold: 2e9, exponent: 0.35, mult: 150, perDouble: 150 };
    const L = num('pc-life'), owned = num('pc-owned');
    const total = L >= P.threshold ? Math.floor(P.mult * Math.pow(L / P.threshold, P.exponent)) : 0;
    const gain = Math.max(0, total - owned);
    const bonusNow = 1 + owned / P.perDouble, bonusAfter = 1 + (owned + gain) / P.perDouble;
    const patents = gain > 0 ? Math.max(1, Math.floor(Math.sqrt(gain / 10))) : 0;
    const nextNeed = P.threshold * Math.pow((total + 1) / P.mult, 1 / P.exponent);
    $('#pc-out').innerHTML = `<big>+${fmt(gain, 0)} AI Chips · +${fmt(patents, 0)} Patents</big><small>Production bonus ×${bonusNow.toFixed(2)} → <b>×${bonusAfter.toFixed(2)}</b>. The next chip needs ${money(nextNeed)} lifetime money.</small>`;
  });
  // heat equilibrium — mirrors HeatStat.CalculateMultiplier
  function heatMult(T) {
    if (T <= -272.99) return 1.6; if (T <= -200) return 1.5; if (T <= -150) return 1.4; if (T <= -100) return 1.3;
    if (T < 0) return 1.2; if (T < 20) return 1.1; if (T <= 60) return 1; if (T <= 100) return 0.9; if (T <= 500) return 0.7;
    return 0.2;
  }
  bindCalc(['hc-heat', 'hc-fans', 'hc-fanlvl', 'hc-bugs'], () => {
    const nodeHeat = num('hc-heat'), fans = num('hc-fans'), lvl = Math.max(1, num('hc-fanlvl')), bugs = num('hc-bugs');
    const fanHeat = -30 * lvl;
    const total = nodeHeat + fans * fanHeat + bugs * 100;
    const T = Math.max(-272.9999, 24 + total / 10);
    const mult = heatMult(T);
    $('#hc-out').innerHTML = `<big>${T.toFixed(1)} °C → ×${mult}</big><small>Each fan gives ${fmt(fanHeat)} heat. Total heat input ${fmt(total)}. The factory settles at 24 + total ÷ 10.</small>`;
  });
  // upgrade cost
  bindCalc(['uc-base', 'uc-growth', 'uc-level', 'uc-buy'], () => {
    const a0 = num('uc-base'), r = num('uc-growth') || 1, lvl = num('uc-level'), n = Math.max(1, num('uc-buy'));
    const a = a0 * Math.pow(r, lvl);
    const total = r === 1 ? a * n : a * (Math.pow(r, n) - 1) / (r - 1);
    $('#uc-out').innerHTML = `<big>${money(total)}</big><small>Next single level: ${money(a)}. Buying ${n} levels costs ${(total / a).toFixed(1)}× one level.</small>`;
  });
  // throughput
  bindCalc(['tp-cap', 'tp-heat', 'tp-bugs', 'tp-out'], () => {
    const cap = num('tp-cap'), hm = num('tp-heat') || 1, bugs = num('tp-bugs'), out = num('tp-out') || 1;
    const M = hm * Math.pow(0.75, bugs);
    $('#tp-res').innerHTML = `<big>${fmt(cap * M * out)} / s</big><small>Multiplier M = ${M.toFixed(3)}. Each input needs demand × ${fmt(cap * M)} per second to keep up.</small>`;
  });
  // node picker for throughput calculator
  const pick = $('#tp-node');
  if (pick) {
    const prods = D.nodes.filter(n => n.cap !== null && n.outputs.length);
    pick.innerHTML = '<option value="">Pick a node…</option>' + prods.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('');
    pick.addEventListener('change', () => {
      const n = prods.find(x => x.id === pick.value); if (!n) return;
      $('#tp-cap').value = n.cap; $('#tp-out').value = n.outputs[0].amount;
      $('#tp-cap').dispatchEvent(new Event('input'));
    });
  }
})();
