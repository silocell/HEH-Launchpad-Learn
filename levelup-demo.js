/* Level Up demo (levelup.html?demo=1, e.g. from lu.chausima.com).
   No account and no server: this answers Level Up's requests in the same
   shape the real "levelup" function does, from a small built-in bank of
   Year 7 questions. Points, levels, tasks, the chest and the shop all work,
   but they are pretend and live only in this tab - gone when it closes. */
(function () {
  "use strict";
  var on = false;
  try {
    if (/[?&]demo=1(&|$)/.test(location.search)) sessionStorage.setItem("lu.demo", "1");
    on = sessionStorage.getItem("lu.demo") === "1";
  } catch (e) {}
  window.LUDemo = { on: on };
  if (!on) return;

  /* subject, topic, question, right answer, three wrong ones, hint, explanation */
  var BANK = [
    ["maths", "Times tables", "What is 7 × 8?", "56", ["54", "48", "64"], "Double 7 × 4.", "7 × 4 = 28, and double 28 is 56."],
    ["maths", "Times tables", "What is 9 × 12?", "108", ["96", "118", "112"], "10 × 12, take away one 12.", "10 × 12 = 120, minus 12 is 108."],
    ["maths", "Fractions", "What is 1/2 + 1/4?", "3/4", ["2/6", "1/6", "2/4"], "Make the bottoms the same first.", "1/2 is 2/4, so 2/4 + 1/4 = 3/4."],
    ["maths", "Fractions", "Which is bigger: 3/5 or 2/3?", "2/3", ["3/5", "They are equal", "You can't tell"], "Turn both into fifteenths.", "3/5 = 9/15 and 2/3 = 10/15, so 2/3 is bigger."],
    ["maths", "Negative numbers", "What is −3 + 8?", "5", ["−11", "11", "−5"], "Start at −3 and count up 8.", "Counting up 8 from −3 passes 0 and lands on 5."],
    ["maths", "Negative numbers", "What is −4 × −3?", "12", ["−12", "−7", "7"], "Two negatives multiplied…", "A negative times a negative is positive: 4 × 3 = 12."],
    ["maths", "Algebra", "Solve 2x + 5 = 17.", "6", ["11", "8.5", "7"], "Take 5 from both sides first.", "2x = 12, so x = 6."],
    ["maths", "Algebra", "Simplify 3a + 2b + a − b.", "4a + b", ["4a + 3b", "3a + b", "5ab"], "Collect the a's, then the b's.", "3a + a = 4a and 2b − b = b, so 4a + b."],
    ["maths", "Percentages", "What is 25% of 80?", "20", ["25", "40", "16"], "25% is a quarter.", "A quarter of 80 is 20."],
    ["maths", "Area", "A rectangle is 6 cm by 4 cm. What is its area?", "24 cm²", ["20 cm²", "10 cm²", "24 cm"], "Area of a rectangle is length × width.", "6 × 4 = 24, and area is in square centimetres."],
    ["maths", "Angles", "Angles on a straight line add up to…", "180°", ["90°", "360°", "100°"], "A straight line is half a full turn.", "A full turn is 360°, so half of it is 180°."],
    ["maths", "Order of operations", "What is 3 + 4 × 2?", "11", ["14", "10", "9"], "Multiply before you add.", "4 × 2 = 8 first, then 3 + 8 = 11."],
    ["english", "Word classes", "In \"The quick fox jumped\", which word is the verb?", "jumped", ["quick", "fox", "The"], "Which word is the action?", "A verb is a doing word: the fox jumped."],
    ["english", "Word classes", "Which word is an adverb? \"She sang loudly.\"", "loudly", ["sang", "She", "song"], "It tells you how she sang.", "Adverbs describe verbs, and often end in -ly."],
    ["english", "Punctuation", "Which sentence uses an apostrophe correctly?", "The dog's bone was buried.", ["The dogs' bone was buried.", "The dog's were barking.", "The dogs bone's was buried."], "One dog owns the bone.", "One dog, so the apostrophe goes before the s: dog's."],
    ["english", "Techniques", "\"The wind whispered through the trees\" is an example of…", "personification", ["a simile", "alliteration", "onomatopoeia"], "Can wind really whisper?", "Giving the wind a human action (whispering) is personification."],
    ["english", "Techniques", "\"As brave as a lion\" is…", "a simile", ["a metaphor", "personification", "a pun"], "Look for 'as' or 'like'.", "A simile compares using 'as' or 'like'."],
    ["english", "Spelling", "Which spelling is correct?", "necessary", ["neccessary", "necessery", "nesessary"], "One collar, two sleeves.", "necessary has one c and two s's - like a shirt with one collar and two sleeves."],
    ["english", "Sentences", "Which is a complete sentence?", "The bus arrived late.", ["Because the bus.", "Arrived late the.", "When the bus arrived"], "It needs a subject and a verb, and makes sense alone.", "'The bus arrived late.' has a subject (bus), a verb (arrived) and makes sense on its own."],
    ["english", "Vocabulary", "What does \"reluctant\" mean?", "unwilling", ["excited", "quick", "angry"], "Think of dragging your feet.", "Reluctant means not wanting to do something."],
    ["science", "Cells", "Which part of a cell controls what it does?", "the nucleus", ["the cell wall", "the cytoplasm", "the vacuole"], "It holds the genetic material.", "The nucleus contains DNA, the cell's instructions."],
    ["science", "Cells", "Which of these do plant cells have but animal cells don't?", "a cell wall", ["a nucleus", "a cell membrane", "cytoplasm"], "Think about what keeps a plant stiff.", "Plant cells have a cell wall (and chloroplasts); animal cells don't."],
    ["science", "Particles", "In which state are particles furthest apart?", "gas", ["solid", "liquid", "they're the same"], "Which spreads out to fill any room?", "Gas particles move fast and are far apart."],
    ["science", "Particles", "Ice turning into water is called…", "melting", ["freezing", "condensing", "evaporating"], "Solid to liquid.", "Melting is a solid changing into a liquid."],
    ["science", "Forces", "What is the unit of force?", "newton (N)", ["kilogram (kg)", "joule (J)", "metre (m)"], "Named after Isaac.", "Force is measured in newtons."],
    ["science", "Forces", "A ball rolling across grass slows down because of…", "friction", ["gravity pushing it", "magnetism", "upthrust"], "The grass rubs against it.", "Friction acts against motion and slows the ball."],
    ["science", "Acids and alkalis", "What pH is neutral?", "7", ["0", "14", "1"], "Pure water.", "pH 7 is neutral; lower is acid, higher is alkali."],
    ["science", "Space", "Why do we have day and night?", "The Earth spins on its axis.", ["The Sun moves round the Earth.", "The Moon blocks the Sun.", "The Earth orbits the Sun."], "It takes 24 hours.", "Earth spins once a day, so each side faces the Sun then turns away."],
    ["science", "Energy", "Which of these is a renewable energy source?", "wind", ["coal", "oil", "natural gas"], "It won't run out.", "Wind is renewable; coal, oil and gas are fossil fuels and will run out."],
    ["science", "Living things", "What do plants need for photosynthesis?", "light, water and carbon dioxide", ["soil, oxygen and sugar", "only water", "darkness and heat"], "Think about what a plant takes in.", "Plants use light energy to turn water and carbon dioxide into glucose and oxygen."]
  ];
  var TASKS = [
    { key: "t1", name: "Maths warm-up", topic: "Mixed maths", subject: "maths", of: 5 },
    { key: "t2", name: "Word work", topic: "English", subject: "english", of: 5 },
    { key: "t3", name: "Science check", topic: "Science", subject: "science", of: 5 }
  ];
  var SHOP = [
    { id: "t-rookie", kind: "title", name: "Rookie", cost: 0 }, { id: "t-brain", kind: "title", name: "Big Brain", cost: 60 }, { id: "t-legend", kind: "title", name: "Legend", cost: 200 },
    { id: "c-classic", kind: "theme", name: "Classic", cost: 0 }, { id: "c-ocean", kind: "theme", name: "Ocean", cost: 50 }, { id: "c-sunset", kind: "theme", name: "Sunset", cost: 50 },
    { id: "c-forest", kind: "theme", name: "Forest", cost: 80 }, { id: "c-galaxy", kind: "theme", name: "Galaxy", cost: 150 },
    { id: "a-rocket", kind: "badge", name: "Rocket", cost: 0 }, { id: "a-star", kind: "badge", name: "Star", cost: 40 }, { id: "a-bolt", kind: "badge", name: "Lightning", cost: 60 },
    { id: "a-owl", kind: "badge", name: "Owl", cost: 90 }, { id: "a-crown", kind: "badge", name: "Crown", cost: 150 }, { id: "a-dragon", kind: "badge", name: "Dragon", cost: 250 }
  ];
  var KEY = "lu.demo.state", st;
  try { st = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { st = null; }
  if (!st) st = { pts: 0, xp: 0, streak: 0, done: {}, right: {}, owned: ["t-rookie", "c-classic", "a-rocket"], wear: { title: "t-rookie", theme: "c-classic", badge: "a-rocket" }, chest: null, topics: {}, seen: [], q: {} };
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function level() { return 1 + Math.floor(st.xp / 100); }
  function state() {
    var allDone = TASKS.every(function (t) { return (st.done[t.key] || 0) >= t.of; });
    return {
      pts: st.pts, streak: st.streak, level: level(), into: st.xp % 100, need: 100,
      wear: st.wear, owned: st.owned, shop: SHOP,
      tasks: TASKS.map(function (t) { return { key: t.key, name: t.name, topic: t.topic, of: t.of, done: st.done[t.key] || 0, right: st.right[t.key] || 0 }; }),
      topics: Object.keys(st.topics).map(function (k) { var x = st.topics[k]; return { name: k, subject: x.subject, acc: Math.round(100 * x.r / x.n), level: 1 + Math.floor(x.r / 4) }; }),
      chest: st.chest ? { ready: true, opened: true, got: st.chest.got, what: st.chest.what, run: 1 } : { ready: allDone, opened: false, run: 0 },
      insights: insights(),
      ai: { writer: "the Launchpad (demo questions)", checker: "a teacher's answer key" }
    };
  }
  function insights() {
    var t = Object.keys(st.topics);
    if (!t.length) return ["This is a demo: answer a few questions and it starts spotting what you're good at.", "In the real Level Up, AI writes new questions that match how you're doing."];
    var best = t.sort(function (a, b) { var x = st.topics[a], y = st.topics[b]; return y.r / y.n - x.r / x.n; });
    var out = ["Strongest so far: " + best[0] + "."];
    if (best.length > 1) out.push("Worth more practice: " + best[best.length - 1] + ".");
    out.push("Demo points are pretend and reset when you close this tab.");
    return out;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pickQ(task) {
    var t = TASKS.filter(function (x) { return x.key === task; })[0];
    var pool = BANK.map(function (b, i) { return i; }).filter(function (i) { return !t || BANK[i][0] === t.subject; });
    var fresh = pool.filter(function (i) { return st.seen.indexOf(i) < 0; });
    if (!fresh.length) { st.seen = st.seen.filter(function (i) { return pool.indexOf(i) < 0; }); fresh = pool; }
    var i = fresh[Math.floor(Math.random() * fresh.length)];
    st.seen.push(i);
    return i;
  }
  var CODES = { maths: "MA", english: "EN", science: "SC" };
  function next(task) {
    var i = pickQ(task), b = BANK[i], t = TASKS.filter(function (x) { return x.key === task; })[0];
    var id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    st.q[id] = { i: i, task: task, hint: false };
    save();
    return {
      id: id, code: CODES[b[0]] + "-" + (i + 1), task: t ? t.name : "Free practice", subject: b[0], topic: b[1], level: level(),
      q: b[2], options: shuffle([b[3]].concat(b[4])), hasHint: true,
      of: t ? t.of : 0, qNo: t ? (st.done[task] || 0) + 1 : 0
    };
  }
  function answer(id, pick) {
    var q = st.q[id]; if (!q) throw new Error("That question has expired - try the next one.");
    var b = BANK[q.i], right = pick === b[3], gained = right ? (q.hint ? 5 : 10) : 0;
    delete st.q[id];
    st.pts += gained; st.xp += right ? 20 : 5; st.streak = right ? st.streak + 1 : 0;
    var tp = st.topics[b[1]] = st.topics[b[1]] || { subject: b[0], r: 0, n: 0 }; tp.n++; if (right) tp.r++;
    var taskDone = false, bonus = 0, t = TASKS.filter(function (x) { return x.key === q.task; })[0];
    if (t) {
      st.done[t.key] = (st.done[t.key] || 0) + 1; if (right) st.right[t.key] = (st.right[t.key] || 0) + 1;
      if (st.done[t.key] >= t.of) { taskDone = true; bonus = 20; st.pts += bonus; }
    }
    save();
    var r = state();
    r.right = right; r.answer = b[3]; r.explain = b[6]; r.gained = gained; r.taskDone = taskDone; r.bonus = bonus;
    r.moved = st.xp % 100 < 20 && right ? "Level " + level() + " reached!" : "";
    r.canExplain = !right;
    return r;
  }
  var lastExplain = {};
  function respond(body) {
    switch (body.action) {
      case "state": return state();
      case "next": return next(body.task);
      case "hint": { var q = st.q[body.id]; if (!q) throw new Error("That question has expired."); q.hint = true; save(); lastExplain[body.id] = q.i; return { hint: BANK[q.i][5] }; }
      case "answer": { var qi = st.q[body.id] && st.q[body.id].i; var r = answer(body.id, body.pick); lastExplain[body.id] = qi; return r; }
      case "explain": { var b = BANK[lastExplain[body.id]]; return { more: b ? "Step by step: " + b[5] + " " + b[6] + " In the real Level Up, an AI explains it in more detail." : "Try the next one." }; }
      case "report": return { said: "Thanks! (In the demo, reports aren't sent anywhere.)" };
      case "chest": {
        if (st.chest) throw new Error("Today's chest is already open.");
        var roll = Math.random(), what = roll > .97 ? "jackpot" : roll > .85 ? "big" : roll > .5 ? "good" : "small";
        var got = { jackpot: 500, big: 120, good: 50, small: 20 }[what];
        st.chest = { got: got, what: what }; st.pts += got; save();
        var s = state(); s.prize = { what: what, got: got, base: got, runBonus: 0, run: 1 }; return s;
      }
      case "buy": {
        var it = SHOP.filter(function (x) { return x.id === body.item; })[0];
        if (!it) throw new Error("That isn't in the shop.");
        if (st.owned.indexOf(it.id) >= 0) throw new Error("You already have that.");
        if (st.pts < it.cost) throw new Error("Not enough pence yet - answer a few more!");
        st.pts -= it.cost; st.owned.push(it.id); st.wear[it.kind] = it.id; save(); return state();
      }
      case "wear": {
        var w = SHOP.filter(function (x) { return x.id === body.item; })[0];
        if (!w || st.owned.indexOf(w.id) < 0) throw new Error("Buy it first.");
        st.wear[w.kind] = w.id; save(); return state();
      }
    }
    throw new Error("The demo can't do that.");
  }
  window.LUDemo.api = function (body) {
    return new Promise(function (ok, no) { setTimeout(function () { try { ok(respond(body || {})); } catch (e) { no(e); } }, 120); });
  };
  /* say so, once, at the top */
  function banner() {
    var b = document.createElement("div");
    b.setAttribute("role", "note");
    b.style.cssText = "position:sticky;top:0;z-index:50;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:8px 16px;background:#fff7c2;color:#3b2f00;border-bottom:1px solid #e8d34a;font:14px/1.4 system-ui,sans-serif";
    b.innerHTML = '<span style="flex:1;min-width:220px"><b>Demo:</b> sample questions and pretend points, kept only until you close this tab. Nothing is saved or sent.</span>' +
      '<a href="https://hw.chausima.com" style="color:#3b2f00;font-weight:700">Get the real Level Up</a>';
    document.body.insertBefore(b, document.body.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();
})();
