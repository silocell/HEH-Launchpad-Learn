/* =====================================================================
   learn.js - one place every learning game reports to.

   A game calls HEHLearn.record({ subject, skill, ok, front, back })
   after each answer. The database does the rest (learn_record in
   learning.sql):

   - mastery: each answer moves a skill 30% of the way toward right (1)
     or wrong (0). Time away fades it back toward "not sure" (0.5),
     halving the gap every 30 days.
   - flash cards: a wrong answer with a question makes a card, or sends
     an existing one back to box 1. Getting that question right once it
     is due moves it up a box: review again in 0, 1, 3, 7, then 16 days.

   Because it all lives in the database against your account, it is the
   same on every device and every login.

   Answers are queued in this browser first and sent in small batches.
   If the server can't take them yet - offline, or the tables not set up
   - they wait here and go next time, so nothing played is lost.

   GPL-3.0, like the games.
   ===================================================================== */
(function () {
  "use strict";
  var sb = null, uid = null, state = "unknown", timer = null, sending = false;
  var QMAX = 300, BATCH = 60;

  function qkey() { return "hl.learnq." + (uid || "anon"); }
  function readQ() { try { return JSON.parse(localStorage.getItem(qkey()) || "[]"); } catch (e) { return []; } }
  function writeQ(q) {
    if (q.length > QMAX) q = q.slice(q.length - QMAX);
    try { localStorage.setItem(qkey(), JSON.stringify(q)); } catch (e) {}
  }
  function clip(s, n) { return s == null ? undefined : String(s).slice(0, n); }

  /* "Function not found" / "table not found" means learning.sql hasn't
     been run on this server yet: keep the queue, stop asking. */
  function missing(err) {
    var m = (err && (err.message || err.code || "")) + "";
    return /PGRST202|PGRST205|42P01|42883|Could not find|does not exist|404/.test(m) ||
           (err && (err.status === 404 || err.code === "PGRST202" || err.code === "PGRST205"));
  }

  function who() {
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      uid = s && s.user ? s.user.id : null;
      return uid;
    }, function () { return null; });
  }

  function flush() {
    timer = null;
    if (!sb || sending || state === "off") return Promise.resolve();
    return who().then(function (id) {
      if (!id) return;
      var q = readQ();
      if (!q.length) return;
      var batch = q.slice(0, BATCH);
      sending = true;
      return sb.rpc("learn_record", { items: batch }).then(function (r) {
        sending = false;
        if (r.error) {
          if (missing(r.error)) state = "off";
          return;
        }
        state = "on";
        writeQ(readQ().slice(batch.length));
        fire("recorded", r.data);
        if (batch.some(function (it) { return it.ok; })) pounds();
        if (readQ().length) return flush();
      }, function () { sending = false; });
    });
  }
  function soon() { if (!timer) timer = setTimeout(flush, 1500); }

  /* Launchpad Pounds. Right answers are counted on the server as they're
     filed; this asks the profile function whether that earned a Pound
     (each right answer has a small lucky chance, at most 3 a day) and
     says so. Once on arrival for a starting figure, then not more than
     every 15 seconds. The real site only - the lab has no Pounds. */
  var lastLP = null, lpAt = 0, lpWait = null;
  function pounds() {
    if (!sb || !sb.functions || document.documentElement.classList.contains("lab")) return;
    var gap = Date.now() - lpAt;
    if (gap < 15000) {
      if (!lpWait) lpWait = setTimeout(function () { lpWait = null; pounds(); }, 15000 - gap);
      return;
    }
    lpAt = Date.now();
    sb.functions.invoke("profile", { body: { action: "pounds", had: lastLP } }).then(function (r) {
      var d = r && r.data;
      if (!d || d.error || typeof d.pounds !== "number") return;
      if (lastLP !== null && d.pounds > lastLP) coin(d.pounds - lastLP, d.pounds);
      lastLP = d.pounds;
      fire("pounds", d);
    }, function () {});
  }
  function coin(n, total) {
    var t = document.createElement("div");
    t.setAttribute("role", "status");
    t.textContent = "🍀 Lucky! +🪙" + n + " Launchpad Pound" + (n === 1 ? "" : "s") + " - you have " + total + ".";
    t.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;padding:12px 18px;border-radius:999px;" +
      "background:linear-gradient(90deg,#d97706,#db2777);color:#fff;font:700 15px/1.2 system-ui,sans-serif;box-shadow:0 12px 30px -10px rgba(0,0,0,.5);" +
      "pointer-events:none;transition:opacity .4s";
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; }, 3200);
    setTimeout(function () { t.remove(); }, 3700);
  }

  var listeners = {};
  function fire(name, data) { (listeners[name] || []).forEach(function (f) { try { f(data); } catch (e) {} }); }

  var HEHLearn = {
    /* Hand over the page's own Supabase client. A second client on the
       same sign-in would refresh the same token twice. */
    use: function (client) {
      sb = client;
      who().then(function (id) { if (readQ().length) soon(); if (id) pounds(); });
      return HEHLearn;
    },
    /* For pages that don't make their own client (the flash cards, the
       progress page, Map Quest): make one the same way the games do. */
    connect: function () {
      if (sb) return sb;
      var lab = document.documentElement.classList.contains("lab");
      try {
        sb = window.supabase.createClient(
          lab ? "https://hehs.duckdns.org" : "https://hehs-live.duckdns.org",
          lab ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNzcxNTQzLCJleHAiOjIxMDgxMzE1NDN9.MFpgmA0d-KISwuCicZMUhnaEpVHY-Sw_jFp3Muck6FM"
              : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyODMyMjkwLCJleHAiOjIxMDgxOTIyOTB9.7gFhQa5RBwVtiOPLO7Qf2-aVEbkd5xgpLiN1J06Gybo",
          { auth: { persistSession: true, autoRefreshToken: true,
                    storage: (window.HEHAuth && window.HEHAuth.storage) || undefined } });
      } catch (e) { sb = null; }
      if (sb) HEHLearn.use(sb);
      return sb;
    },
    signedIn: function () { return who().then(function (id) { return !!id; }); },
    get client() { return sb; },
    get status() { return state; },

    /* One answer, or a list of them. */
    record: function (items) {
      if (!items) return;
      if (!Array.isArray(items)) items = [items];
      var clean = items.filter(function (it) { return it && it.subject && it.skill; }).map(function (it) {
        var o = { subject: clip(it.subject, 20).toLowerCase(), skill: clip(it.skill, 60), ok: !!it.ok };
        if (it.front) o.front = clip(it.front, 400);
        if (it.back != null && it.back !== "") o.back = clip(it.back, 200);
        if (it.note) o.note = clip(it.note, 400);
        if (it.game) o.game = clip(it.game, 20);
        /* The fact behind the question, so the flash card can ask it a
           different way each day. Small, or not at all. */
        if (it.data) { try { var d = JSON.stringify(it.data); if (d.length <= 1500) o.data = it.data; } catch (e) {} }
        return o;
      });
      if (!clean.length) return;
      who().then(function (id) {
        if (!id) return;                 // nobody signed in: nothing to file it under
        writeQ(readQ().concat(clean));
        soon();
      });
    },
    flush: flush,

    /* A small save file per game, on the account. Mirrored in this browser
       so a game still works before the tables exist, or offline. */
    save: function (game, data) {
      try { localStorage.setItem("hl.save." + game, JSON.stringify(data)); } catch (e) {}
      if (!sb) return Promise.resolve(false);
      return who().then(function (id) {
        if (!id || state === "off") return false;
        return sb.from("game_saves").upsert({ user_id: id, game: game, data: data, updated_at: new Date().toISOString() },
                                            { onConflict: "user_id,game" })
          .then(function (r) { if (r.error && missing(r.error)) state = "off"; return !r.error; });
      });
    },
    load: function (game) {
      var local = null;
      try { local = JSON.parse(localStorage.getItem("hl.save." + game)); } catch (e) {}
      if (!sb) return Promise.resolve(local);
      return who().then(function (id) {
        if (!id) return local;
        return sb.from("game_saves").select("data").eq("game", game).maybeSingle().then(function (r) {
          if (r.error) { if (missing(r.error)) state = "off"; return local; }
          return r.data ? r.data.data : local;
        });
      }, function () { return local; });
    },

    /* How well a skill is known right now, with the fade applied - the
       same sum the database does, so the dashboard and the next answer
       agree. */
    now: function (row) {
      if (!row) return 0.5;
      var days = (Date.now() - new Date(row.last_at).getTime()) / 864e5;
      return 0.5 + (row.mastery - 0.5) * Math.pow(0.5, Math.max(0, days) / 30);
    },
    level: function (m) {
      return m >= 0.8 ? "secure" : m >= 0.6 ? "getting there" : m >= 0.4 ? "not sure" : "needs work";
    },

    on: function (name, f) { (listeners[name] = listeners[name] || []).push(f); }
  };

  /* Last chance to send before the tab goes. */
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });

  window.HEHLearn = HEHLearn;
})();

/* Tablets: tapping a button twice quickly used to zoom the page (iPad
   Safari's double-tap zoom). touch-action: manipulation turns that off
   while keeping pinch-to-zoom; the touchend fallback covers older iPads,
   and still counts the second tap as a click. */
(function () {
  var st = document.createElement("style");
  st.textContent = "html,body{touch-action:manipulation}" +
    "button,a,input,select,label,[role=button],[onclick]{touch-action:manipulation;-webkit-tap-highlight-color:transparent}";
  document.head.appendChild(st);
  var last = 0;
  document.addEventListener("touchend", function (e) {
    var now = Date.now(), quick = now - last < 350;
    last = now;
    if (!quick || e.touches.length) return;
    var t = e.target;
    if (t.closest && t.closest("input,textarea,select,[contenteditable]")) return;
    e.preventDefault();                       /* stop the zoom... */
    var el = t.nodeType === 1 ? t : t.parentElement;
    if (el && el.click) el.click();           /* ...but keep the tap */
  }, { passive: false });
})();

/* =====================================================================
   Feedback for every learning game: a sound for right and wrong answers,
   "in a row" streaks, confetti for big moments, and a daily goal.
   It all hangs off HEHLearn.record, which every game already calls after
   an answer, so each game gets it without changing. Nothing here talks
   to the server. Sound starts after the first tap (phones insist) and
   the 🔊 button in the corner turns it off; that's remembered.
   ===================================================================== */
(function () {
  "use strict";
  if (!window.HEHLearn) return;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var quietMotion = false;
  try { quietMotion = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function lite() { return document.documentElement.classList.contains("lite"); }

  /* ---- sound ---- */
  var on = ls("hl.learn.sound") !== "off", ac = null, out = null;
  function audio() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = .8; out.connect(ac.destination);
    } catch (e) { ac = null; }
    return ac;
  }
  ["pointerdown", "keydown"].forEach(function (ev) { addEventListener(ev, function () { if (on) audio(); }, { passive: true, capture: true }); });
  function note(f, d, type, vol, when) {
    if (!on || !audio()) return;
    try {
      var t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol || .08, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var SFX = {
    right: function (streak) { var b = 72 + Math.min(streak, 12); note(mtof(b), .13, "triangle", .07); note(mtof(b + 7), .2, "triangle", .06, .07); },
    wrong: function () { note(196, .18, "sine", .07); note(165, .26, "sine", .06, .09); },
    streak: function () { [0, 4, 7, 12, 16].forEach(function (n, i) { note(mtof(72 + n), .16, "square", .04, i * .06); }); },
    goal: function () { [0, 4, 7, 12].forEach(function (n, i) { note(mtof(67 + n), .3, "triangle", .07, i * .11); }); note(mtof(79), .6, "triangle", .06, .5); },
    perfect: function () { [0, 7, 12, 16, 19, 24].forEach(function (n, i) { note(mtof(64 + n), .22, "triangle", .06, i * .07); }); }
  };

  /* ---- the little speaker button ---- */
  function button() {
    if (document.getElementById("hlLearnSnd")) return;
    var b = document.createElement("button");
    b.id = "hlLearnSnd"; b.type = "button";
    b.style.cssText = "position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9998;width:38px;height:38px;border-radius:50%;" +
      "border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.16);font-size:17px;line-height:1;cursor:pointer;padding:0;" +
      "-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)";
    function paint() { b.textContent = on ? "🔊" : "🔇"; b.title = on ? "Sounds on (tap to turn off)" : "Sounds off (tap to turn on)"; b.setAttribute("aria-label", b.title); }
    b.onclick = function () { on = !on; ls("hl.learn.sound", on ? "on" : "off"); paint(); if (on) { audio(); note(880, .1, "triangle", .06); } };
    paint();
    document.body.appendChild(b);
  }
  if (document.body) button(); else addEventListener("DOMContentLoaded", button);

  /* ---- toasts ---- */
  var toastEl = null, toastT = 0;
  function toast(txt, bg) {
    if (!toastEl) {
      toastEl = document.createElement("div"); toastEl.setAttribute("role", "status");
      toastEl.style.cssText = "position:fixed;left:50%;top:calc(62px + env(safe-area-inset-top));z-index:99998;transform:translate(-50%,-12px);opacity:0;" +
        "padding:10px 18px;border-radius:999px;color:#fff;font:800 15px/1.2 system-ui,sans-serif;box-shadow:0 12px 30px -10px rgba(0,0,0,.45);" +
        "pointer-events:none;transition:opacity .25s,transform .35s cubic-bezier(.2,.9,.3,1.3);white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden;text-overflow:ellipsis";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = txt; toastEl.style.background = bg || "linear-gradient(90deg,#f97316,#db2777)";
    toastEl.style.opacity = "1"; toastEl.style.transform = "translate(-50%,0)";
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.style.opacity = "0"; toastEl.style.transform = "translate(-50%,-12px)"; }, 2200);
  }

  /* ---- confetti ---- */
  function confetti(n) {
    if (quietMotion || lite()) return;
    var c = document.createElement("canvas"), x = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:99997;pointer-events:none";
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; document.body.appendChild(c); x.scale(dpr, dpr);
    var COL = ["#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e", "#ef4444", "#facc15"], P = [];
    for (var i = 0; i < (n || 120); i++) P.push({ x: innerWidth * (.2 + Math.random() * .6), y: innerHeight * .35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: COL[i % COL.length] });
    var t0 = performance.now();
    (function f(t) {
      var age = (t - t0) / 1000; x.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach(function (p) { p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - age / 2.4); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); });
      if (age < 2.4) requestAnimationFrame(f); else c.remove();
    })(t0);
  }
  function buzz(p) { try { if (navigator.vibrate && matchMedia("(pointer:coarse)").matches) navigator.vibrate(p); } catch (e) {} }

  /* ---- streaks and the daily goal ---- */
  var streak = 0, GOAL = 20;
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function dayCount() { var s = ls("hl.learn.day") || ""; var p = s.split("|"); return p[0] === today() ? +p[1] || 0 : 0; }
  function setDay(n) { ls("hl.learn.day", today() + "|" + n); }
  var STREAKS = { 3: "🔥 3 in a row!", 5: "🔥 5 in a row!", 10: "⚡ 10 in a row! Brilliant", 15: "🌟 15 in a row!", 20: "🏆 20 in a row! Unstoppable", 30: "🚀 30 in a row!" };

  function oneAnswer(ok) {
    if (ok) {
      streak++;
      if (streak > (+ls("hl.learn.beststreak") || 0)) ls("hl.learn.beststreak", String(streak));
      var n = dayCount() + 1; setDay(n);
      if (n === GOAL) { SFX.goal(); toast("🎯 Daily goal done: " + GOAL + " right answers today!", "linear-gradient(90deg,#16a34a,#0891b2)"); confetti(160); buzz([30, 40, 30]); return; }
      if (STREAKS[streak] || (streak > 30 && streak % 10 === 0)) {
        SFX.streak(); toast(STREAKS[streak] || "🚀 " + streak + " in a row!");
        if (streak >= 5) confetti(streak >= 10 ? 140 : 70);
        buzz(20);
      } else SFX.right(streak);
    } else {
      if (streak >= 3) toast("Streak ended at " + streak + " - you'll get the next one", "linear-gradient(90deg,#475569,#334155)");
      streak = 0; SFX.wrong(); buzz(40);
    }
  }
  function wholeRound(list) {
    var right = list.filter(function (it) { return it && it.ok; }).length;
    if (!list.length) return;
    var n = dayCount(), before = n; n += right; setDay(n);
    if (right === list.length && right >= 5) { SFX.perfect(); toast("🌟 Perfect round - all " + right + " right!"); confetti(160); }
    else if (before < GOAL && n >= GOAL) { SFX.goal(); toast("🎯 Daily goal done: " + GOAL + " right answers today!", "linear-gradient(90deg,#16a34a,#0891b2)"); confetti(140); }
  }

  var rec = HEHLearn.record;
  HEHLearn.record = function (items) {
    try {
      if (Array.isArray(items)) { if (items.length > 2) wholeRound(items); else items.forEach(function (it) { if (it) oneAnswer(!!it.ok); }); }
      else if (items) oneAnswer(!!items.ok);
    } catch (e) {}
    return rec.apply(this, arguments);
  };
  HEHLearn.fx = { toast: toast, confetti: confetti, sound: SFX, today: dayCount, goal: GOAL, streak: function () { return streak; } };
})();
