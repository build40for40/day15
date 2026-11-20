/* Expectation Manager: shared concept engine.
 * One scripted, live-feeling project ("Northwind Outfitters" x "Studio Halcyon") that every
 * visual concept plays back. Concepts subscribe to events and draw them their own way.
 * The engine also ships a "dock" (ticker, choice card, controls, truth meter) and an
 * "exports" panel that turns the same project state into a contract, budget sheet, deck,
 * SOW and delivery plan. Loaded inline into every concept by concepts/build.mjs.
 */
(function () {
  'use strict';

  /* ---------- Cast (Samira's five lenses + the coach) ---------- */
  var CAST = {
    coach:       { id: 'coach',       name: 'Wisp',  role: 'Coach',                     tag: 'Fairy godmother', protects: 'Everyone getting heard, gently', color: '#f2c86b' },
    client:      { id: 'client',      name: 'Maya',  role: 'Client marketing lead',     tag: 'Client',          protects: 'The reason the project exists', color: '#ff7a59' },
    agency:      { id: 'agency',      name: 'Jonah', role: 'Agency creative lead',      tag: 'Agency',          protects: 'The team’s ability to do good work', color: '#a67cff' },
    cfo:         { id: 'cfo',         name: 'Priya', role: 'Client finance director',   tag: 'CFO',             protects: 'The money', color: '#35c9e0' },
    procurement: { id: 'procurement', name: 'Tomas', role: 'Procurement and legal',     tag: 'Procurement',     protects: 'The agreement, and the bad day', color: '#5b8cff' },
    delivery:    { id: 'delivery',    name: 'Kai',   role: 'Delivery and tech lead',    tag: 'Delivery',        protects: 'The promise can be built', color: '#ff6fb5' }
  };
  var PEOPLE = ['client', 'agency', 'cfo', 'procurement', 'delivery'];

  /* ---------- The twelve things the project truth must settle ---------- */
  var SECTIONS = [
    { id: 'goal',        label: 'The real goal',        lens: 'client' },
    { id: 'audience',    label: 'Who it is for',        lens: 'client' },
    { id: 'success',     label: 'Success we can check', lens: 'client' },
    { id: 'scope',       label: 'What we are making',   lens: 'agency' },
    { id: 'budget',      label: 'The money',            lens: 'cfo' },
    { id: 'contingency', label: 'If it costs more',     lens: 'cfo' },
    { id: 'signoff',     label: 'Who signs off',        lens: 'agency' },
    { id: 'feedback',    label: 'Feedback rounds',      lens: 'agency' },
    { id: 'done',        label: 'What done means',      lens: 'delivery' },
    { id: 'timeline',    label: 'Dates that cannot move', lens: 'delivery' },
    { id: 'ownership',   label: 'Who owns the work',    lens: 'procurement' },
    { id: 'disagree',    label: 'When we disagree',     lens: 'procurement' }
  ];
  var STATUS_TEXT = { empty: 'Not asked yet', amber: 'One side has said it', green: 'Agreed', conflict: 'In conflict' };
  var STATUS_COLOR = { empty: '#8a8fa3', amber: '#ffb020', green: '#34d27b', conflict: '#ff4d5e' };

  function defaultFacts() {
    return {
      client: 'Northwind Outfitters', agency: 'Studio Halcyon',
      project: 'Spring trail-season campaign',
      envelope: 180000, microsite: null,
      contingency: null, rounds: null, roundDays: null, voucher: false,
      signoff: null, launch: null, ownership: null, stopWord: null, mediaExcluded: false
    };
  }

  /* ---------- The script ---------- */
  function S(from, to, ch, text, extra) { var b = { t: 'say', from: from, to: to, ch: ch, text: text }; for (var k in extra) b[k] = extra[k]; return b; }
  var P = 'private', R = 'room';
  var BEATS = [
    S('coach', 'client', P, 'Hi Maya. Picture a year from now, and the campaign went brilliantly. What is different for Northwind?', { hat: 'client' }),
    S('client', 'coach', P, 'More people picking us over the big names for their first serious pair of trail shoes.', {
      set: [{ s: 'goal', st: 'amber', by: ['client'], v: 'Make Northwind the first choice for people buying their first serious trail shoes.' }] }),
    S('coach', 'agency', P, 'Jonah, in your own words, what is Northwind really trying to achieve?', { hat: 'agency' }),
    S('agency', 'coach', P, 'A bold hero film people talk about. Big awareness.'),
    { t: 'conflict', section: 'goal', a: 'client', b: 'agency', aText: 'first choice for first-time trail buyers', bText: 'a hero film people talk about' },
    S('coach', 'all', R, 'Two true things. Maya needs first-time buyers choosing Northwind. Jonah wants work people talk about. Could the film be how you get there?', { hat: 'client' }),
    S('agency', 'all', R, 'Yes. A film that makes a beginner feel brave is the one people talk about.', {
      set: [{ s: 'goal', st: 'green', by: ['client', 'agency'], v: 'Make Northwind the first choice for first-time trail buyers. The film is the way, not the goal.', axiom: 'The film serves the first-time runner, not our showreel.' }] }),

    S('coach', 'client', P, 'Who is the one person you picture watching it?', { hat: 'client' }),
    S('client', 'coach', P, 'About 30, just signed up for a first 10k, scared of looking like a beginner. We surveyed 800 customers.', {
      set: [{ s: 'audience', st: 'amber', by: ['client'], v: 'First-time 10k runners around 30 who worry about looking like beginners (800-customer survey).' }] }),
    S('agency', 'coach', P, 'We were picturing seasoned ultra runners. Mountains, drone shots.'),
    { t: 'conflict', section: 'audience', a: 'client', b: 'agency', aText: 'nervous first-time 10k runners', bText: 'seasoned ultra runners' },
    S('agency', 'all', R, 'That changes the footage completely. Local park trails, ordinary shoes, nervous first steps.', {
      set: [{ s: 'audience', st: 'green', by: ['client', 'agency'], v: 'First-time 10k runners around 30. Local trails, ordinary shoes, nervous first steps.', axiom: 'Show beginners, never heroes on ridgelines.' }] }),

    S('coach', 'client', P, 'How would you and your boss know it worked?', { hat: 'client' }),
    S('client', 'coach', P, 'Trail range sales up 15% on last spring by 30 June. Last spring was £1.1M.', {
      set: [{ s: 'success', st: 'amber', by: ['client'], v: 'Trail range sales up 15% on last spring (£1.1M) by 30 June.' }] }),
    S('agency', 'coach', P, 'We planned to report views. Around five million.'),
    { t: 'conflict', section: 'success', a: 'client', b: 'agency', aText: 'sales up 15% by 30 June', bText: 'five million views' },
    S('coach', 'all', R, 'Views are a signal. Sales are the verdict. Can you track both?', { hat: 'client' }),
    S('agency', 'all', R, 'Yes. Tracked links on every cut.', {
      set: [{ s: 'success', st: 'green', by: ['client', 'agency'], v: 'Trail sales up 15% on last spring (£1.1M baseline) by 30 June. Views are a side signal.', axiom: 'Sales are the verdict. Views are only a signal.' }] }),

    S('coach', 'cfo', P, 'Priya, how firm is the budget?', { hat: 'cfo' }),
    S('cfo', 'coach', P, '£180k, everything in. Not a pound more without the board.', {
      set: [{ s: 'budget', st: 'amber', by: ['cfo'], v: '£180,000, all in. More needs board approval.' }] }),
    S('agency', 'coach', P, 'Our proposal is £240k: the film, six cuts, a microsite and launch events.', {
      set: [{ s: 'scope', st: 'amber', by: ['agency'], v: 'Hero film, six social cuts, microsite and launch events.' }] }),
    { t: 'conflict', section: 'budget', a: 'cfo', b: 'agency', aText: '£180k, firm', bText: '£240k proposed' },
    {
      t: 'choice', section: 'budget', hat: 'cfo', rec: 2,
      prompt: 'The money and the scope do not match. How should the room settle it?',
      options: [
        { label: 'Cut to the must-haves', note: '£180k. Film and six cuts only.', line: 'Cut to the must-haves: film and six cuts, at £180k.',
          facts: { microsite: 'none', envelope: 180000 },
          set: [{ s: 'budget', st: 'green', by: ['cfo', 'agency'], v: '£180,000 all in. Film and six cuts.', axiom: 'The must-haves fit the money. Nothing else is promised.' },
                { s: 'scope', st: 'green', by: ['agency', 'client', 'cfo'], v: 'Hero film (60s) and six 15s social cuts. Microsite and launch events dropped.' }] },
        { label: 'Raise to £215k', note: 'Needs board approval. Microsite stays.', line: 'Raise to £215k with board approval, keep the microsite.',
          facts: { microsite: 'in', envelope: 215000 },
          set: [{ s: 'budget', st: 'green', by: ['cfo', 'agency'], v: '£215,000 all in, subject to board approval.', axiom: 'The board has approved £215k, and not a pound more.' },
                { s: 'scope', st: 'green', by: ['agency', 'client', 'cfo'], v: 'Hero film, six 15s cuts and microsite. Launch events dropped.' }] },
        { label: 'Phase it', note: '£180k now. Microsite is phase 2.', line: 'Phase it: £180k now, the microsite as phase 2.',
          facts: { microsite: 'phase2', envelope: 180000 },
          set: [{ s: 'budget', st: 'green', by: ['cfo', 'agency'], v: '£180,000 all in for phase 1. Phase 2 priced separately.', axiom: 'Phase 1 fits the money. Phase 2 earns its own budget.' },
                { s: 'scope', st: 'green', by: ['agency', 'client', 'cfo'], v: 'Phase 1: hero film and six cuts. Phase 2: microsite, priced separately.' }] }
      ]
    },

    S('coach', 'all', R, 'Next gap. Nobody has said what happens if something costs more.', { hat: 'cfo' }),
    {
      t: 'choice', section: 'contingency', hat: 'cfo', rec: 0,
      prompt: 'What cushion do you want, and who can spend it?',
      options: [
        { label: '£20k, client holds it', note: 'Spend needs Priya’s OK.', line: '£20k cushion, held by Maya, spend needs Priya’s OK.',
          facts: { contingency: 20000, contingencyHolder: 'Client (Maya), spend approved by Priya' },
          set: [{ s: 'contingency', st: 'green', by: ['cfo', 'agency', 'client'], v: '£20k cushion held by the client. Any spend needs the finance director’s OK.', axiom: 'Every extra pound has a named owner.' }] },
        { label: '£12k, agency can use £4k', note: '£4k for creative fixes without asking.', line: '£12k cushion. The agency may use £4k for creative fixes.',
          facts: { contingency: 12000, contingencyHolder: 'Client, agency may draw £4k for creative fixes' },
          set: [{ s: 'contingency', st: 'green', by: ['cfo', 'agency', 'client'], v: '£12k cushion. The agency can use £4k for creative fixes, the rest needs approval.', axiom: 'Every extra pound has a named owner.' }] },
        { label: 'No cushion', note: 'Fixed fee. Extras quoted first.', line: 'No cushion. Fixed fee, and extras are quoted in writing first.',
          facts: { contingency: 0, contingencyHolder: 'None. Extras quoted in writing before work starts' },
          set: [{ s: 'contingency', st: 'green', by: ['cfo', 'agency', 'client'], v: 'No cushion. Fixed fee. Extras are quoted in writing before any work.', axiom: 'No surprise work. Extras are priced before they are done.' }] }
      ]
    },

    S('coach', 'client', P, 'Maya, who has the final say on the work?', { hat: 'agency' }),
    S('agency', 'coach', P, 'Last time, feedback came from eleven people over three weeks.'),
    S('client', 'coach', P, 'Sam Okafor, our marketing director. The CEO should see it at two checkpoints.', {
      set: [{ s: 'signoff', st: 'amber', by: ['client'], v: 'Sam Okafor, marketing director, signs off. CEO sees two checkpoints.', facts: { signoff: 'Sam Okafor, Marketing Director' } }] }),
    S('agency', 'all', R, 'One name and two CEO checkpoints works for us.', {
      set: [{ s: 'signoff', st: 'green', by: ['client', 'agency'], v: 'Sam Okafor signs off. The CEO sees two checkpoints. Everyone else advises.', axiom: 'One name signs off. Everyone else advises.' }] }),
    {
      t: 'choice', section: 'feedback', hat: 'agency', rec: 0,
      prompt: 'How many rounds of feedback, and how fast?',
      options: [
        { label: '2 rounds, 5 days each', note: 'Calm and thorough.', line: 'Two rounds, five working days each.',
          facts: { rounds: 2, roundDays: 5, voucher: false },
          set: [{ s: 'feedback', st: 'green', by: ['agency', 'client'], v: 'Two rounds of consolidated feedback, five working days each.', axiom: 'Feedback is consolidated, with a limit, and on time.' }] },
        { label: '3 rounds, 3 days each', note: 'Quick and more of them.', line: 'Three rounds, three working days each.',
          facts: { rounds: 3, roundDays: 3, voucher: false },
          set: [{ s: 'feedback', st: 'green', by: ['agency', 'client'], v: 'Three rounds of consolidated feedback, three working days each.', axiom: 'Feedback is consolidated, with a limit, and on time.' }] },
        { label: '2 rounds + 1 rethink', note: 'One big-rethink voucher.', line: 'Two rounds, plus one big-rethink voucher.',
          facts: { rounds: 2, roundDays: 5, voucher: true },
          set: [{ s: 'feedback', st: 'green', by: ['agency', 'client'], v: 'Two rounds, five working days each, plus one big-rethink voucher.', axiom: 'Feedback is consolidated, with a limit, and on time.' }] }
      ]
    },

    S('coach', 'delivery', P, 'Kai, is there a word here that could mean two things to two people?', { hat: 'delivery' }),
    S('delivery', 'all', R, '“Hero film”: 60 seconds or 30? And does “launch” include running it as paid ads?', {
      set: [{ s: 'done', st: 'amber', by: ['delivery'], v: 'Hero film 60s master and six 15s cuts, delivered as final files.' }] }),
    S('client', 'all', R, 'I assumed Halcyon would upload it and run the paid media.'),
    S('agency', 'all', R, 'Media buying is not in the price.'),
    { t: 'conflict', section: 'done', a: 'client', b: 'agency', aText: 'agency runs paid media', bText: 'media is not in the price' },
    S('procurement', 'all', R, 'Then write it down. Media spend sits outside this agreement.', {
      set: [{ s: 'done', st: 'green', by: ['client', 'agency', 'delivery', 'procurement'], v: 'Hero film 60s and six 15s cuts, delivered as final files. Client publishes. Media spend is outside this agreement.', facts: { mediaExcluded: true }, axiom: 'Media spend lives outside this agreement, and we say so in writing.' }] }),

    S('coach', 'client', P, 'Which date cannot move?', { hat: 'delivery' }),
    S('client', 'coach', P, '14 March, the start of trail season.', {
      set: [{ s: 'timeline', st: 'amber', by: ['client'], v: 'Launch on 14 March 2027.', facts: { launch: '14 March 2027' } }] }),
    S('delivery', 'all', R, 'Then we shoot in a two-week January window. I need talent and location access by 8 December.', {
      set: [{ s: 'timeline', st: 'green', by: ['client', 'delivery', 'agency'], v: 'Launch 14 March 2027. Two-week shoot in January. Client supplies talent and locations by 8 December.', axiom: 'Launch is 14 March. The client supplies talent and locations by 8 December.' }] }),

    S('coach', 'procurement', P, 'Tomas, what must be in writing?', { hat: 'procurement' }),
    S('procurement', 'all', R, 'Who owns the film, the footage and the music licences when we are done?'),
    {
      t: 'choice', section: 'ownership', hat: 'procurement', rec: 0,
      prompt: 'Who owns the work at the end?',
      options: [
        { label: 'Client owns the film', note: 'Agency may show it in its portfolio.', line: 'The client owns the final film. The agency may show it in its portfolio.',
          facts: { ownership: 'Client owns the final film and music licences. Agency may show the film in its portfolio.' },
          set: [{ s: 'ownership', st: 'green', by: ['procurement', 'agency', 'client'], v: 'Client owns the final film. The agency may show it in its portfolio.', axiom: 'Who owns the work is written down before the work starts.' }] },
        { label: '24-month licence', note: 'Then renew.', line: 'The client licenses the film for 24 months, then renews.',
          facts: { ownership: 'Agency retains ownership. Client holds a 24-month licence, then renews.' },
          set: [{ s: 'ownership', st: 'green', by: ['procurement', 'agency', 'client'], v: 'Client licenses the film for 24 months, then renews.', axiom: 'Who owns the work is written down before the work starts.' }] },
        { label: 'Client owns film and footage', note: 'Agency gets a showreel licence.', line: 'The client owns the film and raw footage. The agency gets a showreel licence.',
          facts: { ownership: 'Client owns the final film and raw footage. Agency holds a showreel licence.' },
          set: [{ s: 'ownership', st: 'green', by: ['procurement', 'agency', 'client'], v: 'Client owns the film and raw footage. The agency holds a showreel licence.', axiom: 'Who owns the work is written down before the work starts.' }] }
      ]
    },
    S('procurement', 'all', R, 'And how do we pause a row without blame?'),
    S('coach', 'all', R, 'A stop word. Say “pineapple” and everything pauses for a day. Budget rows go to Priya and Jonah. Creative rows go to Sam. I will chair if neither can.', { hat: 'procurement' }),
    S('agency', 'all', R, 'Pineapple it is.', {
      set: [{ s: 'disagree', st: 'green', by: ['client', 'agency', 'cfo', 'procurement', 'delivery'], v: 'Say “pineapple” to pause any row for 24 hours, no blame. Budget goes to Priya and Jonah, creative to Sam, Wisp chairs.', facts: { stopWord: 'pineapple' }, axiom: 'Say “pineapple” to pause any row for 24 hours, no blame.' }] }),
    { t: 'done', text: 'That is all twelve. Your project truth is ready, in the format each of you needs.' }
  ];

  /* ---------- Session ---------- */
  function createSession(opts) {
    opts = opts || {};
    var listeners = [];
    var s = {
      cast: CAST, people: PEOPLE, sections: SECTIONS,
      state: null, pending: null, speed: opts.speed || 1, playing: false, finished: false,
      beatIndex: 0, countdown: 0, waiting: true
    };
    var timers = [];
    var tick = null;

    function reset() {
      timers.forEach(clearTimeout); timers = [];
      if (tick) { clearInterval(tick); tick = null; }
      var sec = {};
      SECTIONS.forEach(function (x) { sec[x.id] = { id: x.id, label: x.label, lens: x.lens, status: 'empty', value: '', by: [] }; });
      s.state = { sections: sec, facts: defaultFacts(), axioms: [], log: [] };
      s.pending = null; s.finished = false; s.beatIndex = 0; s.countdown = 0; s.waiting = true;
    }
    function emit(ev) { ev.state = s.state; listeners.slice().forEach(function (f) { try { f(ev, s.state); } catch (e) { console.error(e); } }); }
    s.on = function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; };

    function applySet(list) {
      (list || []).forEach(function (u) {
        var sec = s.state.sections[u.s]; if (!sec) return;
        var prev = sec.status;
        if (u.v !== undefined) sec.value = u.v;
        sec.status = u.st;
        if (u.by) u.by.forEach(function (p) { if (sec.by.indexOf(p) < 0) sec.by.push(p); });
        if (u.facts) for (var k in u.facts) s.state.facts[k] = u.facts[k];
        if (u.axiom && s.state.axioms.every(function (a) { return a.section !== u.s; })) s.state.axioms.push({ section: u.s, text: u.axiom });
        emit({ type: 'set', section: u.s, prev: prev, status: u.st, value: sec.value, by: sec.by.slice(), axiom: u.axiom || null });
        if (u.st === 'green' && prev !== 'green') emit({ type: 'agree', section: u.s, by: sec.by.slice() });
      });
    }
    function dur(b) {
      if (b.t === 'conflict') return 2600 / s.speed;
      if (b.t === 'done') return 600;
      return Math.max(1900, 1300 + 30 * (b.text || '').length) / s.speed;
    }
    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }

    function step() {
      if (s.pending) return;
      if (!s.playing) { s.waiting = true; return; }
      s.waiting = false;
      var b = BEATS[s.beatIndex];
      if (!b) return;
      s.beatIndex++;
      var d = dur(b);
      if (b.t === 'say') {
        var ev = { type: 'say', from: b.from, to: b.to, channel: b.ch, text: b.text, hat: b.hat || null, ms: d };
        s.state.log.push({ from: b.from, to: b.to, ch: b.ch, text: b.text });
        emit(ev);
        if (b.set) after(d * 0.55, function () { applySet(b.set); });
        after(d, step);
      } else if (b.t === 'conflict') {
        applySet([{ s: b.section, st: 'conflict', by: [b.a, b.b] }]);
        emit({ type: 'conflict', section: b.section, a: b.a, b: b.b, aText: b.aText, bText: b.bText, ms: d });
        after(d, step);
      } else if (b.t === 'choice') {
        s.pending = b; s.countdown = 12;
        emit({ type: 'choice', section: b.section, prompt: b.prompt, options: b.options, rec: b.rec, hat: b.hat });
        startTick();
      } else if (b.t === 'done') {
        s.finished = true; s.playing = false;
        emit({ type: 'done', text: b.text });
      }
    }
    function startTick() {
      if (tick) clearInterval(tick);
      tick = setInterval(function () {
        if (!s.pending) { clearInterval(tick); tick = null; return; }
        if (!s.playing) return;
        s.countdown -= 0.25;
        emit({ type: 'countdown', value: Math.max(0, Math.ceil(s.countdown)) });
        if (s.countdown <= 0) s.choose(s.pending.rec);
      }, 250);
    }
    s.choose = function (i) {
      var b = s.pending; if (!b) return;
      var o = b.options[i]; if (!o) return;
      s.pending = null; if (tick) { clearInterval(tick); tick = null; }
      for (var k in o.facts) s.state.facts[k] = o.facts[k];
      s.state.log.push({ from: 'coach', to: 'all', ch: R, text: o.line });
      emit({ type: 'resolved', section: b.section, index: i, option: o, fromViewer: s.countdown > 0 });
      emit({ type: 'say', from: 'coach', to: 'all', channel: R, text: o.line, hat: b.hat || null, ms: 1800 });
      after(900 / s.speed, function () { applySet(o.set); });
      after(2300 / s.speed, step);
    };
    s.apply = function (list) { applySet(list); };
    s.announce = function (ev) { emit(ev); };
    s.play = function () { if (s.finished) return; if (s.playing) return; s.playing = true; emit({ type: 'play' }); if (s.waiting && !s.pending) step(); };
    s.pause = function () { s.playing = false; emit({ type: 'pause' }); };
    s.restart = function () { var was = true; reset(); emit({ type: 'reset' }); s.playing = false; if (was) s.play(); };
    s.setSpeed = function (n) { s.speed = n; emit({ type: 'speed', value: n }); };
    s.progress = function () {
      var g = 0, c = 0; SECTIONS.forEach(function (x) { var st = s.state.sections[x.id].status; if (st === 'green') g++; if (st === 'conflict') c++; });
      return { green: g, conflicts: c, total: SECTIONS.length };
    };
    reset();
    if (opts.autoplay !== false) setTimeout(function () { s.play(); }, opts.delay || 700);
    return s;
  }

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k]; else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) { return '£' + Math.round(n).toLocaleString('en-GB'); }
  function nameOf(id) { return id === 'all' ? 'the room' : CAST[id].name; }

  /* ---------- Exports: one project truth, five formats ---------- */
  function val(st, id, extra) {
    var sec = st.sections[id];
    if (!sec.value) return '⟨pending: ' + sec.label.toLowerCase() + '⟩';
    return sec.value + (sec.status === 'amber' ? ' (one side only)' : sec.status === 'conflict' ? ' (in conflict)' : '') + (extra || '');
  }
  function pend(x, label) { return x === null || x === undefined || x === '' ? '⟨pending: ' + label + '⟩' : x; }

  function budgetLines(st) {
    var f = st.facts;
    var lines = [
      ['Strategy and concept development', 20000],
      ['Hero film shoot (two days, crew, kit)', 74000],
      ['Post-production and sound', 24000],
      ['Six 15-second social cuts', 18000],
      ['Music licensing (24 months)', 8000],
      ['Project management and travel', 16000]
    ];
    if (f.microsite === 'in') lines.push(['Campaign microsite', 35000]);
    return lines;
  }
  function budgetTotals(st) {
    var lines = budgetLines(st), sub = lines.reduce(function (a, l) { return a + l[1]; }, 0);
    var cont = st.facts.contingency === null ? 0 : st.facts.contingency;
    return { lines: lines, sub: sub, cont: cont, total: sub + cont };
  }

  function buildExports(st) {
    var f = st.facts, S_ = st.sections;
    var t = budgetTotals(st);
    var rounds = f.rounds === null ? '⟨pending: feedback rounds⟩' : f.rounds + ' rounds, ' + f.roundDays + ' working days each' + (f.voucher ? ', plus one big-rethink voucher' : '');
    var phase2 = f.microsite === 'phase2' ? 'Phase 2 (not committed): campaign microsite, priced separately, around £35,000.' : f.microsite === 'none' ? 'Not included: microsite and launch events.' : f.microsite === 'in' ? 'Not included: launch events.' : '⟨pending: what is out of scope⟩';
    var cap = (f.microsite === 'in' ? 215000 : 180000);

    var contract = [
      ['h1', 'Heads of Terms: Services Agreement'],
      ['meta', f.client + ' and ' + f.agency + '. Draft for signature. Prepared from the agreed project truth.'],
      ['h2', '1. Services'], ['p', val(st, 'scope')],
      ['h2', '2. Fees and payment'],
      ['p', t.cont === 0 && f.contingency === 0 ? 'Fixed fee of ' + money(t.total) + ', excluding VAT and media spend.' : 'Fees of ' + money(t.sub) + ', plus a contingency of ' + (f.contingency === null ? '⟨pending: contingency⟩' : money(t.cont)) + ', not to exceed ' + money(cap) + ' without written board approval.'],
      ['li', ['30% on signature', '40% on completion of the shoot', '30% on delivery of final files', 'Invoices paid within 30 days']],
      ['h2', '3. Contingency and changes'], ['p', val(st, 'contingency')],
      ['p', 'Any change to scope is quoted in writing and approved by ' + pend(f.signoff, 'approver') + ' before work begins.'],
      ['h2', '4. Approvals and feedback'], ['p', val(st, 'signoff')], ['p', 'Feedback: ' + rounds + '.'],
      ['h2', '5. Ownership'], ['p', pend(f.ownership, 'ownership')],
      ['h2', '6. Exclusions'], ['p', f.mediaExcluded ? 'Paid media spend and buying sit outside this agreement. The client publishes the final files.' : '⟨pending: media spend⟩'],
      ['h2', '7. Disagreements'], ['p', val(st, 'disagree')],
      ['h2', '8. Termination'], ['p', 'Either party may end the agreement with 30 days’ written notice. Work completed to that date is paid for.']
    ];

    var sheetRows = t.lines.map(function (l) { return [l[0], money(l[1])]; });
    sheetRows.push(['Subtotal', money(t.sub)]);
    sheetRows.push(['Contingency' + (f.contingency === null ? ' (pending)' : ''), f.contingency === null ? '⟨pending⟩' : money(t.cont)]);
    sheetRows.push(['Total', f.contingency === null ? money(t.sub) + ' + contingency' : money(t.total)]);
    var budget = [
      ['h1', 'Budget: ' + f.project],
      ['meta', 'Envelope ' + money(cap) + '. Excludes VAT and paid media.'],
      ['table', { head: ['Line', 'Cost'], rows: sheetRows, total: true }],
      ['p', 'Held by: ' + pend(f.contingencyHolder, 'who holds contingency')],
      ['p', phase2],
      ['h2', 'Payment schedule'],
      ['table', { head: ['When', 'Share', 'Amount'], rows: [['Signature', '30%', money(t.total * 0.3)], ['Shoot complete', '40%', money(t.total * 0.4)], ['Final files delivered', '30%', money(t.total * 0.3)]] }],
      ['h2', 'Costs nobody should be surprised by'],
      ['li', [f.mediaExcluded ? 'Paid media spend: outside this budget, client’s own.' : '⟨pending: media spend⟩', 'Talent fees and location permits: client supplies, not included.', 'Music licences: 24 months, renewal priced at the time.']]
    ];

    var deck = [
      { title: 'Spring trail season', bullets: [f.client + ' × ' + f.agency, 'A film that makes beginners feel brave'] },
      { title: 'Why we are doing this', bullets: [val(st, 'goal')] },
      { title: 'Who it is for', bullets: [val(st, 'audience')] },
      { title: 'How we will know it worked', bullets: [val(st, 'success')] },
      { title: 'What we are making', bullets: [val(st, 'scope'), phase2] },
      { title: 'Dates', bullets: [val(st, 'timeline')] },
      { title: 'How we will work together', bullets: [val(st, 'signoff'), 'Feedback: ' + rounds, val(st, 'disagree')] },
      { title: 'What we need from you', bullets: ['Talent and locations by 8 December', 'One consolidated round of feedback each time', f.signoff ? 'Sign-off from ' + f.signoff : '⟨pending: approver⟩'] }
    ];

    var sow = [
      ['h1', 'Statement of Work'],
      ['meta', f.agency + ' for ' + f.client + '. Generated from the agreed project truth.'],
      ['h2', 'Objective'], ['p', val(st, 'goal')],
      ['h2', 'In scope'], ['p', val(st, 'scope')],
      ['h2', 'Out of scope'], ['p', phase2], ['p', f.mediaExcluded ? 'Paid media buying and campaign management.' : '⟨pending: media⟩'],
      ['h2', 'Deliverables'], ['li', ['One 60-second hero film master', 'Six 15-second social cuts', 'Final files, with tracked links on every cut']],
      ['h2', 'Assumptions'], ['li', [val(st, 'audience'), 'Client supplies talent and locations by 8 December.', 'Client consolidates feedback into one list per round.']],
      ['h2', 'Approval and feedback'], ['p', val(st, 'signoff')], ['p', rounds + '.'],
      ['h2', 'Acceptance'], ['p', val(st, 'done')],
      ['h2', 'Fee'], ['p', f.contingency === null ? '⟨pending: fee⟩' : money(t.total) + ' including contingency. Changes are quoted in writing first.']
    ];

    var plan = [
      ['h1', 'Delivery plan and definition of done'],
      ['meta', 'For the tech and delivery lead. Everything here can be checked.'],
      ['h2', 'Done means'], ['p', val(st, 'done')],
      ['h2', 'Milestones'],
      ['table', { head: ['When', 'What is true'], rows: [['8 December', 'Talent and locations confirmed by the client'], ['January (2 weeks)', 'Shoot complete'], ['Mid February', 'Round 1 feedback in, round 2 under way'], ['Early March', 'Final files delivered and approved'], ['14 March 2027', 'Launch']] }],
      ['h2', 'Depends on'], ['li', ['Client: talent, locations, one list of feedback per round', 'Procurement: signed agreement before the shoot', 'Finance: first payment on signature']],
      ['h2', 'After launch'], ['p', f.mediaExcluded ? 'The client publishes and runs media. Files are handed over as masters.' : '⟨pending: who runs it after launch⟩'],
      ['h2', 'If time runs short'], ['p', f.microsite === 'none' ? 'Social cuts 5 and 6 ship a week after launch.' : 'The microsite ships after the film and cuts.']
    ];

    return [
      { id: 'procurement', who: 'Tomas', role: 'Procurement', file: 'Contract', fmt: 'Word', kind: 'doc', doc: contract },
      { id: 'cfo', who: 'Priya', role: 'CFO', file: 'Budget', fmt: 'Excel', kind: 'sheet', doc: budget },
      { id: 'client', who: 'Maya', role: 'Brand', file: 'Deck', fmt: 'PowerPoint', kind: 'deck', deck: deck },
      { id: 'agency', who: 'Jonah', role: 'Agency', file: 'SOW', fmt: 'Word', kind: 'doc', doc: sow },
      { id: 'delivery', who: 'Kai', role: 'Delivery', file: 'Plan', fmt: 'Checklist', kind: 'doc', doc: plan }
    ];
  }

  function plainText(x) {
    if (x.kind === 'deck') return x.deck.map(function (s, i) { return 'Slide ' + (i + 1) + ': ' + s.title + '\n' + s.bullets.map(function (b) { return '- ' + b; }).join('\n'); }).join('\n\n');
    return x.doc.map(function (b) {
      if (b[0] === 'h1') return '# ' + b[1] + '\n'; if (b[0] === 'h2') return '\n## ' + b[1];
      if (b[0] === 'li') return b[1].map(function (i) { return '- ' + i; }).join('\n');
      if (b[0] === 'table') return [b[1].head.join(' | ')].concat(b[1].rows.map(function (r) { return r.join(' | '); })).join('\n');
      return b[1];
    }).join('\n');
  }
  function pendHtml(s) {
    return esc(s).replace(/⟨([^⟩]*)⟩/g, '<span class="emx-pend">$1</span>').replace(/\((one side only|in conflict)\)/g, '<span class="emx-flag">$1</span>');
  }
  function docHtml(x) {
    if (x.kind === 'deck') return '<div class="emx-deck">' + x.deck.map(function (s, i) {
      return '<div class="emx-slide"><span class="emx-sn">' + (i + 1) + '</span><h4>' + pendHtml(s.title) + '</h4><ul>' + s.bullets.map(function (b) { return '<li>' + pendHtml(b) + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
    return '<div class="emx-' + x.kind + '">' + x.doc.map(function (b) {
      if (b[0] === 'h1') return '<h3>' + pendHtml(b[1]) + '</h3>';
      if (b[0] === 'h2') return '<h4>' + pendHtml(b[1]) + '</h4>';
      if (b[0] === 'meta') return '<p class="emx-meta">' + pendHtml(b[1]) + '</p>';
      if (b[0] === 'li') return '<ul>' + b[1].map(function (i) { return '<li>' + pendHtml(i) + '</li>'; }).join('') + '</ul>';
      if (b[0] === 'table') {
        var tb = b[1];
        return '<div class="emx-scroll"><table><thead><tr>' + tb.head.map(function (h, i) { return '<th>' + (x.kind === 'sheet' ? String.fromCharCode(65 + i) + ' · ' : '') + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          tb.rows.map(function (r, ri) { var last = tb.total && ri >= tb.rows.length - 3; return '<tr' + (last ? ' class="emx-sum"' : '') + '>' + r.map(function (c) { return '<td>' + pendHtml(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      }
      return '<p>' + pendHtml(b[1]) + '</p>';
    }).join('') + '</div>';
  }

  /* ---------- Styles for dock and exports (themed by CSS variables) ---------- */
  var CSS = [
    '.emd,.emx{--em-bg:#10131c;--em-panel:#181c28;--em-fg:#eef0f6;--em-mut:#9aa1b5;--em-line:#2a3042;--em-acc:#f2c86b;--em-ok:#34d27b;--em-warn:#ffb020;--em-bad:#ff4d5e;--em-font:system-ui,sans-serif;--em-mono:ui-monospace,Menlo,monospace;--em-radius:10px;font-family:var(--em-font);color:var(--em-fg)}',
    '.emd{background:var(--em-panel);border:1px solid var(--em-line);border-radius:var(--em-radius);display:grid;gap:10px;padding:12px;min-width:0}',
    '.emd *{box-sizing:border-box}',
    '.emd-tick{display:flex;gap:10px;align-items:flex-start;min-height:44px;font-size:14px;line-height:1.4}',
    '.emd-chip{flex:none;font:700 11px/1 var(--em-mono);letter-spacing:.06em;text-transform:uppercase;color:#10131c;padding:5px 7px;border-radius:4px;margin-top:2px}',
    '.emd-to{color:var(--em-mut);font-size:12px}',
    '.emd-priv{font:600 10px/1 var(--em-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--em-mut);border:1px solid var(--em-line);padding:3px 5px;border-radius:4px;margin-left:6px;white-space:nowrap}',
    '.emd-choice{border:1px solid var(--em-acc);border-radius:var(--em-radius);padding:12px;display:grid;gap:10px;background:color-mix(in srgb,var(--em-acc) 8%,var(--em-panel))}',
    '.emd-choice h5{margin:0;font-size:14px;font-weight:600}',
    '.emd-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
    '.emd-opt{all:unset;box-sizing:border-box;cursor:pointer;border:1px solid var(--em-line);border-radius:8px;padding:9px 10px;display:grid;gap:3px;background:var(--em-bg);font-size:13px;line-height:1.35}',
    '.emd-opt:hover,.emd-opt:focus-visible{border-color:var(--em-acc)}',
    '.emd-opt b{font-weight:600}.emd-opt span{color:var(--em-mut);font-size:12px}',
    '.emd-opt.rec{border-color:color-mix(in srgb,var(--em-acc) 60%,var(--em-line))}',
    '.emd-cd{font:12px var(--em-mono);color:var(--em-mut)}',
    '.emd-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.emd-btn{all:unset;box-sizing:border-box;cursor:pointer;font:600 12px/1 var(--em-mono);letter-spacing:.04em;padding:8px 10px;border:1px solid var(--em-line);border-radius:7px;background:var(--em-bg);color:var(--em-fg)}',
    '.emd-btn:hover,.emd-btn:focus-visible{border-color:var(--em-acc)}.emd-btn[aria-pressed=true]{background:var(--em-acc);color:#10131c;border-color:var(--em-acc)}',
    '.emd-meter{flex:1;min-width:150px;display:grid;gap:4px;font:12px var(--em-mono);color:var(--em-mut)}',
    '.emd-track{height:6px;border-radius:3px;background:var(--em-line);overflow:hidden}.emd-fill{height:100%;background:var(--em-ok);transition:width .5s}',
    '.emd-pulse{animation:emdp 1.2s ease-in-out infinite}@keyframes emdp{50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--em-acc) 35%,transparent)}}',
    '@media (prefers-reduced-motion:reduce){.emd-pulse{animation:none}.emd-fill{transition:none}}',
    '.emx{background:var(--em-panel);border:1px solid var(--em-line);border-radius:var(--em-radius);min-width:0;overflow:hidden}',
    '.emx *{box-sizing:border-box}',
    '.emx-tabs{display:flex;overflow-x:auto;border-bottom:1px solid var(--em-line)}',
    '.emx-tab{all:unset;cursor:pointer;flex:none;padding:10px 14px;font-size:13px;border-bottom:2px solid transparent;display:grid;gap:2px}',
    '.emx-tab:hover,.emx-tab:focus-visible{background:var(--em-bg)}.emx-tab[aria-selected=true]{border-bottom-color:var(--em-acc)}',
    '.emx-tab b{font-weight:600}.emx-tab small{color:var(--em-mut);font:11px var(--em-mono)}',
    '.emx-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 14px;color:var(--em-mut);font-size:12px;flex-wrap:wrap}',
    '.emx-body{padding:4px 14px 16px;max-height:420px;overflow:auto;font-size:13px;line-height:1.5}',
    '.emx-body h3{font-size:17px;margin:10px 0 2px}.emx-body h4{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--em-mut);margin:14px 0 4px;font-family:var(--em-mono)}',
    '.emx-body p{margin:3px 0}.emx-body ul{margin:3px 0;padding-left:18px}.emx-meta{color:var(--em-mut)}',
    '.emx-pend{background:color-mix(in srgb,var(--em-warn) 22%,transparent);color:var(--em-warn);border-radius:3px;padding:0 4px;font-family:var(--em-mono);font-size:12px}',
    '.emx-flag{color:var(--em-warn);font-size:11px;font-family:var(--em-mono)}',
    '.emx-scroll{overflow-x:auto}.emx table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}',
    '.emx th,.emx td{border:1px solid var(--em-line);padding:5px 8px;text-align:left}.emx th{background:var(--em-bg);font:600 11px var(--em-mono);color:var(--em-mut)}',
    '.emx-sum td{font-weight:600;background:var(--em-bg)}.emx-sheet td:last-child,.emx-sheet th:last-child{text-align:right}',
    '.emx-deck{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;padding-top:10px}',
    '.emx-slide{position:relative;aspect-ratio:16/10;max-width:100%;background:var(--em-bg);border:1px solid var(--em-line);border-radius:6px;padding:12px;overflow:auto}',
    '.emx-slide h4{margin:0 0 6px;font:700 13px var(--em-font);letter-spacing:0;text-transform:none;color:var(--em-fg)}',
    '.emx-slide ul{font-size:12px;padding-left:15px}.emx-sn{position:absolute;right:8px;top:6px;font:11px var(--em-mono);color:var(--em-mut)}'
  ].join('\n');
  function injectCss() { if (document.getElementById('em-css')) return; var st = el('style', { id: 'em-css' }); st.textContent = CSS; document.head.appendChild(st); }

  function mountExports(host, session) {
    injectCss();
    var cur = 'procurement', box = el('div', { class: 'emx' });
    host.appendChild(box);
    function render() {
      var xs = buildExports(session.state);
      box.innerHTML = '';
      var tabs = el('div', { class: 'emx-tabs', role: 'tablist' });
      xs.forEach(function (x) {
        tabs.appendChild(el('button', { class: 'emx-tab', role: 'tab', 'aria-selected': String(x.id === cur), onclick: function () { cur = x.id; render(); } },
          [el('b', { text: x.who + ' · ' + x.file }), el('small', { text: x.role + ' → ' + x.fmt })]));
      });
      var x = xs.filter(function (y) { return y.id === cur; })[0];
      var copy = el('button', { class: 'emd-btn', text: 'Copy as text', onclick: function (e) {
        var b = e.currentTarget, txt = plainText(x);
        function ok() { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy as text'; }, 1400); }
        try { navigator.clipboard.writeText(txt).then(ok, function () { b.textContent = 'Select and copy'; }); } catch (err) { b.textContent = 'Select and copy'; }
      } });
      var p = session.progress();
      box.appendChild(tabs);
      box.appendChild(el('div', { class: 'emx-head' }, [el('span', { text: 'Built live from the project truth · ' + p.green + ' of ' + p.total + ' agreed. Highlighted gaps fill in as people answer. Exports as ' + x.fmt + ' in the real app.' }), copy]));
      var body = el('div', { class: 'emx-body' }); body.innerHTML = docHtml(x); box.appendChild(body);
    }
    var queued = false;
    session.on(function (ev) { if (ev.type === 'set' || ev.type === 'resolved' || ev.type === 'reset') { if (!queued) { queued = true; setTimeout(function () { queued = false; render(); }, 120); } } });
    render();
    return { render: render, el: box };
  }

  /* ---------- Dock: ticker, choice card, controls, truth meter ---------- */
  function mountDock(host, session, o) {
    o = o || {}; injectCss();
    var dock = el('div', { class: 'emd' });
    var tick = el('div', { class: 'emd-tick' }, [el('span', { class: 'emd-to', text: 'Press play. Wisp is about to start the conversations.' })]);
    var choiceBox = el('div', { hidden: '' });
    var playBtn = el('button', { class: 'emd-btn', 'aria-pressed': 'true', text: 'Pause', onclick: function () { if (session.finished) return; session.playing ? session.pause() : session.play(); } });
    var speeds = [1, 2, 4].map(function (n) { return el('button', { class: 'emd-btn', 'aria-pressed': String(n === session.speed), text: n + '×', onclick: function () { session.setSpeed(n); } }); });
    var restart = el('button', { class: 'emd-btn', text: 'Restart', onclick: function () { session.restart(); } });
    var fill = el('div', { class: 'emd-fill', style: 'width:0%' });
    var meterTxt = el('span', { text: 'Project truth 0 of 12 agreed' });
    var meter = el('div', { class: 'emd-meter' }, [meterTxt, el('div', { class: 'emd-track' }, [fill])]);
    var exBtn = el('button', { class: 'emd-btn', 'aria-pressed': 'false', text: 'Show the five exports' });
    var bar = el('div', { class: 'emd-bar' }, [playBtn].concat(speeds, [restart, meter, exBtn]));
    dock.appendChild(tick); dock.appendChild(choiceBox); dock.appendChild(bar);
    host.appendChild(dock);
    var exHost = el('div', { hidden: '', style: 'margin-top:10px' }); host.appendChild(exHost);
    var ex = mountExports(exHost, session);
    exBtn.addEventListener('click', function () { var open = exHost.hidden; exHost.hidden = !open; exBtn.setAttribute('aria-pressed', String(open)); exBtn.textContent = open ? 'Hide exports' : 'Show the five exports'; exBtn.classList.remove('emd-pulse'); });

    function sync() {
      var p = session.progress();
      fill.style.width = (p.green / p.total * 100) + '%';
      meterTxt.textContent = 'Project truth ' + p.green + ' of ' + p.total + ' agreed' + (p.conflicts ? ' · ' + p.conflicts + ' in conflict' : '');
      playBtn.textContent = session.finished ? 'Done' : session.playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', String(session.playing));
      speeds.forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent === session.speed + '×')); });
    }
    session.on(function (ev) {
      if (ev.type === 'say') {
        tick.innerHTML = '';
        var c = CAST[ev.from];
        tick.appendChild(el('span', { class: 'emd-chip', style: 'background:' + c.color, text: c.name }));
        var to = ev.to === 'all' ? 'to everyone' : 'to ' + nameOf(ev.to);
        tick.appendChild(el('span', {}, [el('span', { class: 'emd-to', text: to }), ev.channel === 'private' ? el('span', { class: 'emd-priv', text: 'one to one' }) : null, el('br'), ev.text]));
      } else if (ev.type === 'conflict') {
        tick.innerHTML = '';
        tick.appendChild(el('span', { class: 'emd-chip', style: 'background:var(--em-bad);color:#fff', text: 'Conflict' }));
        tick.appendChild(el('span', {}, [CAST[ev.a].name + ': ' + ev.aText + '. ' + CAST[ev.b].name + ': ' + ev.bText + '.']));
      } else if (ev.type === 'choice') {
        choiceBox.hidden = false; choiceBox.className = 'emd-choice'; choiceBox.innerHTML = '';
        var cd = el('span', { class: 'emd-cd', text: '' });
        choiceBox.appendChild(el('h5', { text: 'Your call. ' + ev.prompt }));
        var opts = el('div', { class: 'emd-opts' });
        ev.options.forEach(function (op, i) {
          opts.appendChild(el('button', { class: 'emd-opt' + (i === ev.rec ? ' rec' : ''), onclick: function () { session.choose(i); } }, [el('b', { text: op.label }), el('span', { text: op.note + (i === ev.rec ? ' (Wisp suggests)' : '') })]));
        });
        choiceBox.appendChild(opts); choiceBox.appendChild(cd);
        choiceBox._cd = cd;
      } else if (ev.type === 'countdown') {
        if (choiceBox._cd) choiceBox._cd.textContent = 'Wisp picks the suggestion in ' + ev.value + 's. Choose to change the project.';
      } else if (ev.type === 'resolved') {
        choiceBox.hidden = true; choiceBox.innerHTML = '';
      } else if (ev.type === 'done') {
        tick.innerHTML = ''; tick.appendChild(el('span', { class: 'emd-chip', style: 'background:' + CAST.coach.color, text: 'Wisp' })); tick.appendChild(el('span', { text: ev.text }));
        exBtn.classList.add('emd-pulse');
      } else if (ev.type === 'reset') {
        choiceBox.hidden = true; tick.innerHTML = ''; tick.appendChild(el('span', { class: 'emd-to', text: 'Starting again.' })); exBtn.classList.remove('emd-pulse');
      }
      sync();
    });
    sync();
    return { dock: dock, exports: ex, sync: sync };
  }

  window.EM = {
    CAST: CAST, PEOPLE: PEOPLE, SECTIONS: SECTIONS, BEATS: BEATS, STATUS_COLOR: STATUS_COLOR, STATUS_TEXT: STATUS_TEXT,
    createSession: createSession, mountDock: mountDock, mountExports: mountExports,
    el: el, esc: esc, money: money, buildExports: buildExports
  };
})();
