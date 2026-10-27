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
        if (readQ().length) return flush();
      }, function () { sending = false; });
    });
  }
  function soon() { if (!timer) timer = setTimeout(flush, 1500); }

  var listeners = {};
  function fire(name, data) { (listeners[name] || []).forEach(function (f) { try { f(data); } catch (e) {} }); }

  var HEHLearn = {
    /* Hand over the page's own Supabase client. A second client on the
       same sign-in would refresh the same token twice. */
    use: function (client) {
      sb = client;
      who().then(function () { if (readQ().length) soon(); });
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
