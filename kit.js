/* =====================================================================
   kit.js - the homework engine behind Brainstorm Maths, XP Reader,
   Chemically Scientific and Word Passport.

   Each app hands Kit.start() its name, colours and two things:
     weekly(rng)  -> this week's tasks, each a list of items
     make(item)   -> turns one item ({t: topic, s: seed}) into a question
   and a list of practice topics.

   The week runs from Friday 9am to the next Friday 9am. Everyone gets
   the same SHAPE of homework; the numbers in it are seeded from the week
   and this device, so a task looks the same every time you come back to
   it. A question you get wrong comes back at the end of the task (in
   maths, as a fresh one on the same thing), so 100% means you got there,
   not that you never slipped.

   Every answer goes to HEHLearn.record, which feeds mastery, flash cards
   and the sounds, streaks and daily goal. Progress is saved through
   HEHLearn.save, so it follows the account to other devices.
   GPL-3.0, like the games.
   ===================================================================== */
(function () {
  "use strict";
  var Kit = {};
  window.Kit = Kit;

  /* ---------- small helpers ---------- */
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rngFrom(seed) {                       // mulberry32
    var a = 0; for (var i = 0; i < String(seed).length; i++) a = (a * 31 + String(seed).charCodeAt(i)) | 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  Kit.rng = rngFrom;
  Kit.int = function (r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); };
  Kit.pick = function (r, a) { return a[Math.floor(r() * a.length)]; };
  Kit.shuffle = function (r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  Kit.h = h;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var salt = ls("hl.kit.salt"); if (!salt) { salt = Math.random().toString(36).slice(2, 10); ls("hl.kit.salt", salt); }

  /* ---------- the week: Friday 9am to Friday 9am ---------- */
  function weekStart(now) {
    var d = new Date(now); d.setHours(9, 0, 0, 0);
    var back = (d.getDay() - 5 + 7) % 7; d.setDate(d.getDate() - back);
    if (d > now) d.setDate(d.getDate() - 7);
    return d;
  }
  function weekInfo() {
    var s = weekStart(new Date()), due = new Date(s); due.setDate(due.getDate() + 7);
    var id = s.getFullYear() + "-" + String(s.getMonth() + 1).padStart(2, "0") + "-" + String(s.getDate()).padStart(2, "0");
    var nth = function (n) { return n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"); };
    var label = due.toLocaleDateString("en-GB", { weekday: "long" }) + " " + nth(due.getDate()) + " " + due.toLocaleDateString("en-GB", { month: "long" }) + " 9am";
    return { id: id, due: due, label: label, left: due - new Date() };
  }

  /* ---------- answer checking ---------- */
  function plain(s) { return String(s == null ? "" : s).toLowerCase().replace(/[’']/g, "'").replace(/[.!?¡¿,;:]+/g, " ").replace(/\s+/g, " ").trim(); }
  function noAccents(s) { return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss") : s; }
  function parseNum(s) {
    s = String(s).replace(/[,\s£$%°]/g, "").replace(/−/g, "-");
    var f = /^(-?\d+)\/(\d+)$/.exec(s); if (f) return Number(f[1]) / Number(f[2]);
    return s === "" || isNaN(Number(s)) ? NaN : Number(s);
  }
  /* -> { ok, near (right apart from accents) } */
  Kit.check = function (q, given) {
    if (q.type === "num") {
      var n = parseNum(given); if (isNaN(n)) return { ok: false };
      var all = [q.a].concat(q.accept || []);
      return { ok: all.some(function (a) { return Math.abs(n - Number(a)) <= (q.tol || 1e-9); }) };
    }
    var g = plain(given), list = [q.a].concat(q.accept || []).map(plain);
    if (q.nospace) { g = g.replace(/\s+/g, "").replace(/×/g, "*"); list = list.map(function (x) { return x.replace(/\s+/g, "").replace(/×/g, "*"); }); }
    if (list.indexOf(g) >= 0) return { ok: true };
    if (list.map(noAccents).indexOf(noAccents(g)) >= 0) return { ok: true, near: true };
    return { ok: false };
  };

  /* ---------- speaking (language listening questions) ---------- */
  Kit.say = function (text, lang) {
    try {
      var s = window.speechSynthesis; if (!s) return false;
      s.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = 0.85;
      var v = s.getVoices().filter(function (x) { return x.lang && x.lang.toLowerCase().indexOf(lang.slice(0, 2).toLowerCase()) === 0; })[0];
      if (v) u.voice = v;
      s.speak(u); return true;
    } catch (e) { return false; }
  };
  Kit.canSay = function () { return !!window.speechSynthesis; };

  /* ---------- the family: one hat over all the homework apps ---------- */
  Kit.APPS = [
    { id: "hub", name: "My homework", icon: "🎒", url: "homework.html" },
    { id: "maths", name: "Brainstorm Maths", icon: "🧠", url: "maths.html", colour: "#1f6fde" },
    { id: "reader", name: "XP Reader", icon: "📚", url: "reader.html", colour: "#7c3aed" },
    { id: "science", name: "Chemically Scientific", icon: "🧪", url: "science.html", colour: "#0f9d58" },
    { id: "languages", name: "Word Passport", icon: "🛂", url: "languages.html", colour: "#ea580c" }
  ];
  Kit.switcher = function (current) {
    var brand = document.querySelector(".k-top .k-brand"); if (!brand) return;
    var me = Kit.APPS.filter(function (a) { return a.id === current; })[0] || Kit.APPS[0];
    var btn = h("button", "k-brand k-switch"); btn.type = "button"; btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
    btn.textContent = me.icon + " " + me.name + " ▾";
    var menu = h("div", "k-menu"); menu.hidden = true; menu.setAttribute("role", "menu");
    Kit.APPS.forEach(function (a) {
      var it = h("a", "k-mi" + (a.id === current ? " on" : "")); it.href = a.url; it.setAttribute("role", "menuitem");
      it.appendChild(h("span", null, a.icon)); it.appendChild(h("b", null, a.name));
      if (a.id !== "hub") { var sm = Kit.summary()[a.id]; it.appendChild(h("small", null, sm && sm.week === weekInfo().id ? sm.pc + "%" : "")); }
      menu.appendChild(it);
    });
    brand.replaceWith(btn); btn.after(menu);
    btn.onclick = function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
    document.addEventListener("click", function () { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") menu.hidden = true; });
  };
  /* a small summary of each app's week, so the hub and the switcher can show it */
  Kit.summary = function () { try { return JSON.parse(ls("hl.kit.sum") || "{}") || {}; } catch (e) { return {}; } };
  Kit.week = weekInfo;

  /* ---------- the app ---------- */
  Kit.start = function (app) {
    Kit.app = app;
    var main = document.getElementById("main");
    document.documentElement.style.setProperty("--ac", app.colour || "#1f6fde");
    document.documentElement.style.setProperty("--ac2", app.colour2 || "#0ea5e9");
    var W = weekInfo();
    var S = null;            // saved progress for this app (and variant)
    var xpEl = document.getElementById("kXp");
    Kit.switcher(app.id);

    function key() { return "kit-" + app.id + (app.variant ? "-" + app.variant() : ""); }
    function blank() { return { week: W.id, tasks: {}, xp: (S && S.xp) || 0, prac: (S && S.prac) || {}, last: (S && S.last) || null }; }
    function load() {
      var p = window.HEHLearn ? HEHLearn.load(key()) : Promise.resolve(JSON.parse(ls("hl.save." + key()) || "null"));
      return p.then(function (d) {
        S = d && typeof d === "object" ? d : null;
        if (!S) S = blank();
        if (S.week !== W.id) {                 // new week: remember how last week went, start fresh
          var lastPc = S.week ? overall(S, tasksFor(S.week)) : null;
          var keep = { xp: S.xp || 0, prac: S.prac || {}, stats: S.stats || {}, last: S.week ? { week: S.week, pc: lastPc } : S.last };
          S = blank(); S.xp = keep.xp; S.prac = keep.prac; S.last = keep.last; S.stats = keep.stats;
          save();
        }
      }, function () { S = blank(); });
    }
    function save() {
      if (window.HEHLearn) HEHLearn.save(key(), S);
      else ls("hl.save." + key(), JSON.stringify(S));
      paintXp();
      try {
        var sum = Kit.summary(), ts = tasksFor(W.id), left = 0;
        ts.forEach(function (t) { if (pc(t) < 100) left++; });
        sum[app.id] = { week: W.id, pc: overall(S, ts), left: left, tasks: ts.length, xp: S.xp || 0, variant: app.variant ? app.variant() : null, at: Date.now() };
        ls("hl.kit.sum", JSON.stringify(sum));
        if (window.HEHLearn) HEHLearn.save("kit-summary", sum);
      } catch (e) {}
    }
    function stat(skill, ok) {
      S.stats = S.stats || {};
      var x = S.stats[skill] = S.stats[skill] || { r: 0, n: 0 };
      x.n++; if (ok) x.r++;
    }
    function paintXp() { if (xpEl) xpEl.textContent = "⚡ " + Number(S && S.xp || 0).toLocaleString("en-GB") + " XP"; }

    /* this week's tasks, the same every time for this device */
    var cacheWeek = {};
    function tasksFor(weekId) {
      var k = weekId + "|" + (app.variant ? app.variant() : "");
      if (!cacheWeek[k]) cacheWeek[k] = app.weekly(rngFrom(app.id + "|" + k + "|" + salt), weekId);
      return cacheWeek[k];
    }
    function tState(t) {
      var st = S.tasks[t.key];
      if (!st) st = S.tasks[t.key] = { res: [], extra: 0 };
      return st;
    }
    function pc(t, st) {
      st = st || S.tasks[t.key]; if (!st) return 0;
      var right = 0; for (var i = 0; i < t.items.length; i++) if (st.res[i] === "right" || st.res[i] === "read") right++;
      return Math.round(100 * right / t.items.length);
    }
    function overall(s, ts) {
      var tot = 0, got = 0;
      ts.forEach(function (t) { var st = s.tasks[t.key]; tot += t.items.length; if (st) for (var i = 0; i < t.items.length; i++) if (st.res[i] === "right" || st.res[i] === "read") got++; });
      return tot ? Math.round(100 * got / tot) : 0;
    }

    /* ---------- home ---------- */
    function home() {
      window.scrollTo(0, 0);
      main.textContent = "";
      var hero = h("div", "k-hero");
      hero.appendChild(h("h1", null, app.name));
      hero.appendChild(h("p", null, app.blurb));
      hero.appendChild(h("div", "k-big", app.icon));
      main.appendChild(hero);
      if (app.extraHome) app.extraHome(main, function () { load().then(home); });

      var ts = tasksFor(W.id);
      var card = h("section", "k-card k-due");
      var hd = h("div", "k-head");
      hd.appendChild(h("h2", null, "Homework due " + W.label));
      var g = h("div", "k-gauge"); var all = overall(S, ts);
      g.appendChild(h("small", null, all >= 100 ? "Done ✅" : Math.ceil(W.left / 864e5) + " days left"));
      g.appendChild(h("span", null, all + "%")); g.lastChild.style.color = all >= 100 ? "var(--good)" : all > 0 ? "var(--warn)" : "var(--soft)";
      hd.appendChild(g); card.appendChild(hd);
      var rows = h("div", "k-rows");
      ts.forEach(function (t) {
        var p = pc(t), row = h("div", "k-row");
        var tt = h("div", "k-t", t.title); if (t.sub) tt.appendChild(h("small", null, t.sub)); row.appendChild(tt);
        var stt = S.tasks[t.key];
        if (stt && stt.asked) tt.appendChild(h("small", "k-first", "✔ " + Math.round(100 * stt.first / stt.asked) + "% right first time"));
        row.appendChild(h("span", "k-pc " + (p >= 100 ? "full" : p > 0 ? "part" : "none"), p + "%"));
        var b = h("button", "k-btn" + (p >= 100 ? " done" : ""), p >= 100 ? "Complete ✓" : p > 0 ? "Continue ›" : "Start ›"); b.type = "button";
        b.onclick = function () { runTask(t); };
        row.appendChild(b); rows.appendChild(row);
      });
      card.appendChild(rows);
      if (S.last && S.last.pc != null) { var lw = h("p", "k-note", "Last week: " + S.last.pc + "%."); lw.style.cssText = "margin:0 16px 14px"; card.appendChild(lw); }
      main.appendChild(card);

      if (app.stats && S.stats && Object.keys(S.stats).length) {
        var sc = h("section", "k-card"), sh = h("div", "k-head"); sh.appendChild(h("h2", null, "How you're doing")); sh.appendChild(h("span", "k-note", "Right answers, by topic")); sc.appendChild(sh);
        var list = h("div", "k-stats");
        Object.keys(S.stats).map(function (k) { return [k, S.stats[k]]; }).filter(function (x) { return x[1].n >= 2; })
          .sort(function (a, b) { return a[1].r / a[1].n - b[1].r / b[1].n; }).slice(0, 12).forEach(function (x) {
            var pcx = Math.round(100 * x[1].r / x[1].n), row = h("div", "k-stat");
            row.appendChild(h("span", null, x[0]));
            var bar = h("div", "k-bar"), fill = h("i"); fill.style.width = pcx + "%"; fill.style.background = pcx >= 80 ? "var(--good)" : pcx >= 50 ? "var(--warn)" : "var(--bad)"; bar.appendChild(fill);
            row.appendChild(bar); row.appendChild(h("b", null, pcx + "%")); list.appendChild(row);
          });
        sc.appendChild(list);
        sc.appendChild(h("p", "k-note", "Red topics first: they're where practice helps most.")); sc.lastChild.style.cssText = "margin:0 16px 14px";
        main.appendChild(sc);
      }
      if (app.practice && app.practice.length) {
        var pcard = h("section", "k-card");
        var ph = h("div", "k-head"); ph.appendChild(h("h2", null, "Free practice")); ph.appendChild(h("span", "k-note", "Any topic, any time")); pcard.appendChild(ph);
        var grid = h("div", "k-grid");
        app.practice.forEach(function (p) {
          var b = h("button", "k-topic"); b.type = "button";
          b.appendChild(h("b", null, (p.icon ? p.icon + " " : "") + p.title));
          var best = S.prac[p.key];
          b.appendChild(h("small", null, p.sub ? p.sub + (best != null ? " · best " + best + "%" : "") : best != null ? "Best " + best + "%" : "Not tried yet"));
          var bar = h("div", "k-bar"), fill = h("i"); fill.style.width = (best || 0) + "%"; bar.appendChild(fill); b.appendChild(bar);
          b.onclick = function () { if (p.run) runCustom(p); else runPractice(p); };
          grid.appendChild(b);
        });
        pcard.appendChild(grid); main.appendChild(pcard);
      }
      if (app.footHome) app.footHome(main);
      paintXp();
    }

    /* ---------- running a weekly task ---------- */
    function runTask(t) {
      var st = tState(t);
      function nextIndex() {
        for (var i = 0; i < t.items.length; i++) if (!st.res[i]) return i;          // first time through
        for (i = 0; i < t.items.length; i++) if (st.res[i] === "wrong") return i;   // then the ones to fix
        return -1;
      }
      var typedRight = [];   // for notebook checks: { code, q, a }
      var sinceCheck = 0;
      function step() {
        var i = nextIndex();
        if (i < 0) return finished(t);
        var it = t.items[i];
        var retry = st.res[i] === "wrong";
        var seedBump = retry ? (st.tries = (st.tries || 0) + 1) * 1000 : 0;
        var q = app.make(Object.assign({}, it, { s: it.s + seedBump, i: i, retry: retry }));
        var code = (t.code || "") + String.fromCharCode(65 + (i % 26));
        if (app.notebook && sinceCheck >= 4 && typedRight.length >= 2 && !retry) { sinceCheck = 0; return notebookCheck(typedRight, step); }
        show(q, { kicker: t.title, code: code, dots: t.items.map(function (_, k) { return st.res[k] === "right" || st.res[k] === "read" ? "ok" : st.res[k] === "wrong" ? "no" : k === i ? "now" : ""; }), retry: retry },
          function (ok, gave) {
            if (q.type === "read") st.res[i] = "read";
            else {
              if (!retry) st.first = (st.first || 0) + (ok ? 1 : 0), st.asked = (st.asked || 0) + 1;
              st.res[i] = ok ? "right" : "wrong";
              stat(q.skill || t.title, ok);
            }
            if (ok && (q.type === "num" || q.type === "text")) { typedRight.push({ code: code, q: q, a: q.shown || q.a }); sinceCheck++; }
            S.xp = (S.xp || 0) + (q.type === "read" ? Math.round((q.words || 100) / 10) : ok ? (retry ? 5 : 10) : 1);
            save();
          }, step, home);
      }
      step();
    }
    function finished(t) {
      main.textContent = "";
      var c = h("div", "k-q");
      c.appendChild(h("div", "k-kicker", t.title));
      c.appendChild(h("div", "k-big", "100%"));
      c.appendChild(h("p", null, "Task complete. " + (app.doneLine || "Nice work.")));
      if (window.HEHLearn && HEHLearn.fx) { HEHLearn.fx.confetti(90); HEHLearn.fx.sound.perfect(); }
      var row = h("div", "k-actions"), b = h("button", "k-btn", "Back to homework"); b.type = "button"; b.onclick = home; row.appendChild(b);
      c.appendChild(row); main.appendChild(c); b.focus();
    }

    /* "Notebook check": pick an answer you wrote down a few questions ago.
       It's why you write your working in your book. */
    function notebookCheck(list, then) {
      var r = rngFrom(Date.now()), pickd = list[Math.floor(r() * list.length)];
      var right = String(pickd.a), opts = [right];
      list.forEach(function (x) { if (opts.length < 4 && opts.indexOf(String(x.a)) < 0) opts.push(String(x.a)); });
      var n = Number(right);
      for (var k = 1; opts.length < 4 && k < 20; k++) { var v = isNaN(n) ? right + " ".repeat(k) : String(n + (k % 2 ? k : -k)); if (opts.indexOf(v) < 0 && v.trim() !== "") opts.push(v); }
      var q = { type: "mc", q: "What was your answer to question " + pickd.code + "?", opts: Kit.shuffle(r, opts.map(function (o) { return o.trim(); })), a: right,
                why: "Question " + pickd.code + " was: " + pickd.q.q + " The answer was " + right + ". Writing your answers and working in your book makes this easy.", check: true };
      show(q, { kicker: "📓 Notebook check", code: pickd.code, dots: [] }, function () {}, then, home);
    }

    /* ---------- a game of the app's own (Word Passport's match-up, speed round) ---------- */
    function runCustom(p) {
      window.scrollTo(0, 0); main.textContent = "";
      p.run(main, {
        home: home,
        xp: function (n) { S.xp = (S.xp || 0) + n; save(); },
        best: function (score) { if (S.prac[p.key] == null || score > S.prac[p.key]) { S.prac[p.key] = score; save(); return true; } return false; },
        record: function (ok, q) { stat(q.skill || p.title, ok); if (window.HEHLearn) HEHLearn.record({ subject: app.subject, skill: q.skill || p.title, ok: ok, front: q.q || "", back: String(q.a || ""), game: app.id }); }
      });
    }

    /* ---------- practice: ten from one topic ---------- */
    function runPractice(p) {
      var n = p.n || 10, i = 0, right = 0, missed = [], r = rngFrom(Date.now() + p.key);
      var seeds = []; for (var k = 0; k < n; k++) seeds.push(Math.floor(r() * 1e9));
      function step() {
        if (i >= n) return done();
        var item = p.items ? p.items(i, seeds[i]) : { t: p.key, s: seeds[i], i: i };
        var q = app.make(item);
        show(q, { kicker: (p.icon ? p.icon + " " : "") + p.title, code: "P" + (i + 1), dots: seeds.map(function (_, k) { return k < i ? (missed.indexOf(k) >= 0 ? "no" : "ok") : k === i ? "now" : ""; }) },
          function (ok) { if (q.type === "read" || ok) right++; else missed.push(i); if (q.type !== "read") stat(q.skill || p.title, ok); S.xp = (S.xp || 0) + (ok ? 5 : 1); save(); }, function () { i++; step(); }, home);
      }
      function done() {
        var score = Math.round(100 * right / n);
        if (S.prac[p.key] == null || score > S.prac[p.key]) S.prac[p.key] = score;
        save();
        main.textContent = "";
        var c = h("div", "k-q");
        c.appendChild(h("div", "k-kicker", (p.icon ? p.icon + " " : "") + p.title));
        c.appendChild(h("div", "k-big", right + " / " + n));
        c.appendChild(h("p", null, right === n ? "Perfect." : right >= n * .7 ? "Good going. Have another go to beat it." : "Keep at it - read the explanations and try again."));
        var row = h("div", "k-actions");
        var a = h("button", "k-btn", "Again"); a.type = "button"; a.onclick = function () { runPractice(p); };
        var b = h("button", "k-btn ghost", "Back"); b.type = "button"; b.onclick = home;
        row.appendChild(a); row.appendChild(b); c.appendChild(row); main.appendChild(c); a.focus();
      }
      step();
    }

    /* ---------- one question on screen ---------- */
    function show(q, meta, onAnswer, next, quit) {
      window.scrollTo(0, 0);
      main.textContent = "";
      var c = h("div", "k-q");
      var hd = h("div", "k-qhead");
      hd.appendChild(h("span", "k-kicker", meta.kicker));
      if (meta.code) hd.appendChild(h("span", "k-code", meta.code));
      var ds = h("div", "k-dots"); (meta.dots || []).slice(0, 30).forEach(function (d) { ds.appendChild(h("i", d)); }); hd.appendChild(ds);
      var stop = h("button", "k-btn ghost", "Stop"); stop.type = "button"; stop.style.minWidth = "0"; stop.onclick = function () { off(); quit(); }; hd.appendChild(stop);
      c.appendChild(hd);
      if (meta.retry) c.appendChild(h("div", "k-check", "Have another go at this one."));

      if (q.type === "read") {
        var rd = h("div", "k-read");
        if (q.title) rd.appendChild(h("h3", null, q.title));
        q.paras.forEach(function (p) { rd.appendChild(h("p", null, p)); });
        c.appendChild(rd);
        var go = h("button", "k-btn", "I've read it ›"); go.type = "button";
        go.onclick = function () { onAnswer(true); next(); };
        var row0 = h("div", "k-actions"); row0.appendChild(go);
        if (q.say && Kit.canSay()) { var sy = h("button", "k-say", "🔊 Read it to me"); sy.type = "button"; sy.onclick = function () { Kit.say(q.paras.join(" "), q.say); }; row0.appendChild(sy); }
        c.appendChild(row0); main.appendChild(c); return;
      }

      if (q.lead) c.appendChild(h("p", "k-note", q.lead));
      if (q.recap) {                       // the text again, folded away, for a second go
        var dt = h("details", "k-read k-recap"); dt.style.cssText = "margin:0 0 12px;font-size:1rem;background:var(--row);border-radius:12px;padding:8px 12px";
        dt.appendChild(h("summary", null, q.recapLabel || "Read it again")); dt.lastChild.style.cssText = "font-family:system-ui,sans-serif;font-weight:700;cursor:pointer";
        q.recap.forEach(function (p) { dt.appendChild(h("p", null, p)); }); c.appendChild(dt);
      }
      var qt = h("div", "k-qtext"); if (q.html) qt.innerHTML = q.html; else qt.textContent = q.q; c.appendChild(qt);
      if (q.say && Kit.canSay()) {
        var say = h("button", "k-say", "🔊 Listen"); say.type = "button"; say.onclick = function () { Kit.say(q.say.text, q.say.lang); };
        c.appendChild(say); say.style.marginBottom = "12px";
        setTimeout(function () { Kit.say(q.say.text, q.say.lang); }, 250);
      }
      var answered = false, inp = null, built = [];
      function finish(given, optBtn) {
        if (answered) return; answered = true; off();
        var res = q.type === "mc" ? { ok: given === q.a } : q.type === "order" ? Kit.check({ a: q.a, accept: q.accept }, given) : Kit.check(q, given);
        if (q.type === "mc") bs.forEach(function (x) { x[0].disabled = true; if (x[1] === q.a) x[0].classList.add("right"); else if (x[1] === given) x[0].classList.add("wrong"); });
        if (inp) { inp.disabled = true; inp.classList.add(res.ok ? "right" : "wrong"); }
        if (checkBtn) checkBtn.hidden = true;
        onAnswer(res.ok, given);
        if (window.HEHLearn && !q.check) HEHLearn.record({ subject: app.subject, skill: q.skill || meta.kicker, ok: res.ok, front: q.q || q.prompt || "", back: String(q.shown || q.a), note: q.why || "", game: app.id, data: q.type === "mc" ? { k: "mc", opts: q.opts } : undefined });
        var fb = h("div", "k-fb " + (res.ok ? "ok" : "no"));
        fb.appendChild(h("b", null, res.ok ? (res.near ? "Right - but check the accents: " + (q.shown || q.a) : pickGood()) : "Not quite - the answer is " + (q.shown || q.a) + (q.unit ? " " + q.unit : "") + "."));
        if (q.why) fb.appendChild(document.createTextNode(q.why));
        if (q.steps && (!res.ok || q.alwaysSteps)) { var ol = h("ol", "k-steps"); q.steps.forEach(function (s) { ol.appendChild(h("li", null, s)); }); fb.appendChild(ol); }
        c.appendChild(fb);
        var nx = h("button", "k-btn", "Next ›"); nx.type = "button"; nx.onclick = next;
        var ra = h("div", "k-actions"); ra.appendChild(nx); c.appendChild(ra);
        setTimeout(function () { nx.focus({ preventScroll: true }); fb.scrollIntoView({ block: "nearest" }); }, 30);
      }
      var bs = [], checkBtn = null;
      if (q.type === "mc") {
        var opts = h("div", "k-opts");
        q.opts.forEach(function (o, k) {
          var b = h("button", "k-opt"); b.type = "button"; b.appendChild(h("kbd", null, "ABCD"[k] || "")); b.appendChild(document.createTextNode(o));
          b.onclick = function () { finish(o, b); }; bs.push([b, o]); opts.appendChild(b);
        });
        c.appendChild(opts);
      } else if (q.type === "order") {
        var line = h("div", "k-tokens"), pool = h("div", "k-tokens");
        pool.style.borderStyle = "solid";
        q.tokens.forEach(function (tk) {
          var b = h("button", "k-tok", tk); b.type = "button";
          b.onclick = function () {
            if (answered || b.classList.contains("used")) return;
            b.classList.add("used"); built.push(tk);
            var chip = h("button", "k-tok", tk); chip.type = "button";
            chip.onclick = function () { if (answered) return; var k = Array.prototype.indexOf.call(line.children, chip); built.splice(k, 1); chip.remove(); b.classList.remove("used"); };
            line.appendChild(chip);
          };
          pool.appendChild(b);
        });
        c.appendChild(line); c.appendChild(pool);
        checkBtn = h("button", "k-btn", "Check"); checkBtn.type = "button";
        checkBtn.onclick = function () { if (built.length) finish(built.join(" ")); };
        var ro = h("div", "k-actions"); ro.appendChild(checkBtn); c.appendChild(ro);
      } else {
        var row = h("div", "k-in");
        inp = h("input"); inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("autocapitalize", "off");
        if (q.type === "num") inp.setAttribute("inputmode", q.neg || q.frac ? "text" : "decimal");
        inp.placeholder = q.ph || (q.type === "num" ? "Your answer" : "Type your answer");
        inp.setAttribute("aria-label", "Your answer");
        row.appendChild(inp);
        if (q.unit) row.appendChild(h("span", "k-unit", q.unit));
        checkBtn = h("button", "k-btn", "Check"); checkBtn.type = "button";
        checkBtn.onclick = function () { if (inp.value.trim()) finish(inp.value); };
        row.appendChild(checkBtn); c.appendChild(row);
        inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); finish(inp.value); } });
        if (q.accents && q.accents.length) {
          var acc = h("div", "k-accents");
          q.accents.forEach(function (ch) { var b = h("button", null, ch); b.type = "button"; b.onclick = function () { var s0 = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, s0) + ch + inp.value.slice(inp.selectionEnd || s0); inp.focus(); inp.setSelectionRange(s0 + 1, s0 + 1); }; acc.appendChild(b); });
          c.appendChild(acc);
        }
        if (q.hint) c.appendChild(h("p", "k-note", q.hint));
      }
      main.appendChild(c);
      if (inp && !matchMedia("(pointer:coarse)").matches) inp.focus();
      function key(e) {
        if (answered || q.type !== "mc") return;
        var x = "ABCD".indexOf(String(e.key).toUpperCase()); if (x < 0) x = "1234".indexOf(e.key);
        if (x >= 0 && bs[x]) bs[x][0].click();
      }
      function off() { document.removeEventListener("keydown", key); }
      document.addEventListener("keydown", key);
    }
    var GOOD = ["Yes!", "Spot on.", "Correct.", "That's it.", "Nailed it.", "Right."];
    function pickGood() { return GOOD[Math.floor(Math.random() * GOOD.length)]; }

    main.appendChild(h("p", "k-note", "Loading…"));
    if (window.HEHLearn && HEHLearn.connect) HEHLearn.connect();
    load().then(home);
    Kit.reload = function () { cacheWeek = {}; load().then(home); };
  };
})();
