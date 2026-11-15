/* =====================================================================
   related.js - a flash card asks its fact a different way each day.

   A card remembers the fact behind it, not just the words of the
   question: "7 × 8", "the capital of Sweden", "Kenya is in Africa".
   From the fact this makes today's question:

   - Which way it's asked is picked by the date and the card, so it is
     the same all day (come back after lunch, same question) and
     different tomorrow.
   - How hard it is follows the card's Leitner box. Box 1 recognises
     (pick from four, true or false). Higher boxes have to recall it
     (type it in) or come at it backwards (56 ÷ 7, "Stockholm is the
     capital of...?"). Knowing one way round isn't the same as knowing it.
   - Got it wrong? sibling() gives a related question - the next fact
     along, a neighbouring country - to check it was understood, not
     just remembered.

   Each question comes with check(answer) so it marks itself. Typed
   answers forgive accents, capitals, "the", and one slip in a longer
   word ("Stokholm").

   GPL-3.0.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- a repeatable dice, seeded by the day and the card ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dice(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function pickR(r, a) { return a[Math.floor(r() * a.length)]; }
  function shuffleR(r, a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { var k = String(x); if (!s[k]) { s[k] = 1; o.push(x); } }); return o; }

  /* ---------- marking typed answers ---------- */
  function norm(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/^\s*the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  /* "Washington, D.C." also takes "Washington"; "Snowdon (Yr Wyddfa)" takes either name. */
  function forms(ans) {
    var a = String(ans), out = [a];
    var paren = a.match(/^(.*?)\s*\((.*)\)\s*$/); if (paren) out.push(paren[1], paren[2]);
    if (a.indexOf(",") > 0) out.push(a.split(",")[0]);
    return uniq(out.map(norm).filter(Boolean));
  }
  function edits(a, b) {           // Levenshtein, small strings only
    if (Math.abs(a.length - b.length) > 1) return 2;
    var p = [], i, j; for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) { var c = [i]; for (j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }
  function typed(ans) {
    var ok = forms(ans);
    return function (input) {
      var x = norm(input); if (!x) return false;
      if (/^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(ok[0])) return Number(x) === Number(ok[0]);
      return ok.some(function (o) { return x === o || (o.length >= 5 && !/\d/.test(o) && edits(x, o) <= 1); });
    };
  }
  function exact(ans) { return function (input) { return String(input) === String(ans); }; }

  /* ---------- question shapes ---------- */
  function mc(r, q, a, wrong, form) {
    var opts = shuffleR(r, uniq([a].concat(wrong.filter(function (w) { return String(w) !== String(a); }))).slice(0, 4));
    if (opts.indexOf(a) < 0) opts[0] = a, opts = shuffleR(r, opts);
    return { kind: "mc", q: q, a: String(a), opts: opts.map(String), check: exact(a), form: form || "Pick one" };
  }
  function tf(r, statement, isTrue, a, form) {
    return { kind: "tf", q: statement, a: isTrue ? "True" : "False", truth: isTrue, opts: ["True", "False"],
             check: function (input) { return (input === true || input === "True") === isTrue; }, form: form || "True or false?", answerText: a };
  }
  function type(q, a, form) { return { kind: "type", q: q, a: String(a), check: typed(a), form: form || "Type it" }; }

  /* ---------- times tables: 7 × 8 ---------- */
  function times(r, d, box) {
    var a = d.a, b = d.b, p = a * b;
    var F = {
      /* Wrong answers people actually give: the next or previous multiple,
         one table along, ten out. Enough of them that squares (10 × 10)
         still get four different options. */
      pick:    function () { return mc(r, a + " × " + b + " = ?", p, shuffleR(r, uniq([p + a, p - b, (a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), p + 10, p - 10, p + 1])
                                       .filter(function (x) { return x > 0 && x !== p; }))); },
      swap:    function () { return type(b + " × " + a + " = ?", p, "Same fact, other way round"); },
      divA:    function () { return type(p + " ÷ " + a + " = ?", b, "Backwards"); },
      divB:    function () { return type(p + " ÷ " + b + " = ?", a, "Backwards"); },
      missing: function () { return type(a + " × ? = " + p, b, "Missing number"); },
      truth:   function () { var t = r() < 0.5, x = t ? p : pickR(r, [p + a, p - a, p + b, p + 1].filter(function (y) { return y > 0 && y !== p; }));
                             return tf(r, a + " × " + b + " = " + x, t, a + " × " + b + " = " + p); },
      recall:  function () { return type(a + " × " + b + " = ?", p, "From memory"); }
    };
    var pool = box <= 1 ? ["pick", "truth"] : box === 2 ? ["pick", "truth", "swap", "missing"] : ["swap", "divA", "divB", "missing", "recall"];
    return F[pickR(r, pool)]();
  }
  function timesSibling(r, d) {
    var a = d.a, b = d.b, opts = [];
    if (b < 12) opts.push([a, b + 1]); if (b > 2) opts.push([a, b - 1]);
    if (a < 12) opts.push([a + 1, b]); if (a > 2) opts.push([a - 1, b]);
    var n = pickR(r, opts);
    var q = type(n[0] + " × " + n[1] + " = ?", n[0] * n[1], "A related one");
    q.fact = { subject: "maths", skill: "×" + Math.max(n[0], n[1]) + " table", front: n[0] + " × " + n[1], data: { k: "times", a: n[0], b: n[1] } };
    return q;
  }

  /* ---------- capitals ---------- */
  function geo() { return window.GEO_FACTS || null; }
  function capitalEntry(d) {
    var G = geo(); if (!G) return null;
    var list = d.set === "europe" ? G.EUROPE : G.WORLD;
    for (var i = 0; i < list.length; i++) if (list[i][0] === d.place) return { e: list[i], list: list };
    return null;
  }
  function capital(r, d, box) {
    var hit = capitalEntry(d); if (!hit) return null;
    var e = hit.e, list = hit.list, place = e[0], cap = e[1], trap = e[2];
    var others = shuffleR(r, list.filter(function (x) { return x !== e; }));
    var Cap = place.charAt(0).toUpperCase() + place.slice(1);
    var F = {
      pick:    function () { return mc(r, "What is the capital of " + place + "?", cap, (trap ? [trap] : []).concat(others.map(function (x) { return x[1]; }))); },
      reverse: function () { return mc(r, cap + " is the capital of which country?", Cap, others.map(function (x) { return x[0].charAt(0).toUpperCase() + x[0].slice(1); }), "Backwards"); },
      truth:   function () { var t = r() < 0.5, x = t ? cap : (trap || others[0][1]); return tf(r, "The capital of " + place + " is " + x + ".", t, "The capital of " + place + " is " + cap + "."); },
      recall:  function () { return type("Type the capital of " + place + ".", cap, "From memory"); }
    };
    var pool = box <= 1 ? ["pick", "truth"] : box === 2 ? ["pick", "reverse", "truth"] : ["reverse", "recall", "recall"];
    return F[pickR(r, pool)]();
  }
  function capitalSibling(r, d) {
    var hit = capitalEntry(d); if (!hit) return null;
    var n = pickR(r, hit.list.filter(function (x) { return x !== hit.e; }));
    var q = capital(r, { set: d.set, place: n[0] }, 1);
    q.form = "A related one";
    q.fact = { subject: "geography", skill: d.set === "europe" ? "Capitals of Europe" : "World capitals",
               front: "What is the capital of " + n[0] + "?", data: { k: "capital", set: d.set, place: n[0] } };
    return q;
  }

  /* ---------- continents ---------- */
  function continent(r, d, box) {
    var G = geo(); if (!G) return null;
    var e = G.CONTINENT.filter(function (x) { return x[0] === d.place; })[0]; if (!e) return null;
    var place = e[0], cont = e[1], Cap = place.charAt(0).toUpperCase() + place.slice(1);
    var F = {
      pick:    function () { return mc(r, "Which continent is " + place + " in?", cont, shuffleR(r, G.CONTINENTS)); },
      truth:   function () { var t = r() < 0.5, x = t ? cont : pickR(r, G.CONTINENTS.filter(function (c) { return c !== cont && c !== "Antarctica"; }));
                             return tf(r, Cap + " is in " + x + ".", t, Cap + " is in " + cont + "."); },
      reverse: function () { var notHere = shuffleR(r, G.CONTINENT.filter(function (x) { return x[1] !== cont; })).map(function (x) { return x[0].charAt(0).toUpperCase() + x[0].slice(1); });
                             return mc(r, "Which of these countries is in " + cont + "?", Cap, notHere, "Backwards"); },
      recall:  function () { return type("Which continent is " + place + " in? Type it.", cont, "From memory"); }
    };
    var pool = box <= 1 ? ["pick", "truth"] : box === 2 ? ["pick", "truth", "reverse"] : ["reverse", "recall"];
    return F[pickR(r, pool)]();
  }
  function continentSibling(r, d) {
    var G = geo(); if (!G) return null;
    var n = pickR(r, G.CONTINENT.filter(function (x) { return x[0] !== d.place; }));
    var q = continent(r, { place: n[0] }, 1); q.form = "A related one";
    q.fact = { subject: "geography", skill: "Continents & oceans", front: "Which continent is " + n[0] + " in?", data: { k: "continent", place: n[0] } };
    return q;
  }

  /* ---------- any multiple-choice question (Level Up, Dragons, Battle Stories) ---------- */
  function anyMc(r, card, d, box) {
    var a = card.back, opts = (d.opts || []).map(String);
    if (opts.indexOf(String(a)) < 0 || opts.length < 2) return null;
    var wrong = opts.filter(function (o) { return o !== String(a); });
    var short = String(a).length <= 30 && String(a).split(/\s+/).length <= 4;
    var F = {
      pick:   function () { return mc(r, card.front, a, shuffleR(r, wrong), "Pick one"); },
      truth:  function () { var t = r() < 0.5, x = t ? a : pickR(r, wrong); return tf(r, card.front + "\nAnswer: " + x, t, "The answer is " + a + "."); },
      recall: function () { return type(card.front, a, "From memory"); }
    };
    var pool = box <= 1 ? ["pick", "truth"] : box === 2 ? ["pick", "truth"].concat(short ? ["recall"] : []) : (short ? ["recall", "recall", "truth"] : ["truth", "pick"]);
    return F[pickR(r, pool)]();
  }

  /* ---------- no fact saved: show it, and you say whether you knew it ---------- */
  function self(card) {
    return { kind: "self", q: card.front, a: String(card.back), check: null, form: "Did you know it?" };
  }

  var MAKERS = { times: times, capital: capital, continent: continent };
  var SIBS = { times: timesSibling, capital: capitalSibling, continent: continentSibling };

  var HEHRelated = {
    /* Today's question for a card. Same all day; different tomorrow. */
    today: function (card, day) {
      var d = card.data || {}, box = card.box || 1;
      var r = dice(hash((day || today()) + "|" + (card.id != null ? card.id : card.front)));
      var q = null;
      try { q = MAKERS[d.k] ? MAKERS[d.k](r, d, box) : d.k === "mc" ? anyMc(r, card, d, box) : null; } catch (e) { q = null; }
      return q || self(card);
    },
    /* A different question on the same idea, after a wrong answer. */
    sibling: function (card, day) {
      var d = card.data || {}, r = dice(hash("sib|" + (day || today()) + "|" + (card.id != null ? card.id : card.front)));
      try { return SIBS[d.k] ? SIBS[d.k](r, d) : null; } catch (e) { return null; }
    },
    norm: norm, typed: typed, today_: today
  };
  window.HEHRelated = HEHRelated;
})();
