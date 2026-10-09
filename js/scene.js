/* The 3rd Space — scroll-driven floor plan with draggable people.
   Row 1 walks in from the left and stops in its line.
   Row 2 (plus the people on the path) walks along the line, down through the door and into the room;
   four of them take the chairs at the table, two on each side facing each other.
   Anyone can be dragged and dropped anywhere on screen; they then walk back to their spot,
   going through the door if they need to get into (or out of) the room.
   Positions come from js/scene-data.js (generated from the Figma file by build_assets.py). */
(function () {
  "use strict";
  var D = window.SCENE_DATA;
  var sec = document.getElementById("scene");
  if (!D || !sec) return;

  var W = 1512, H = 1050, Y0 = 1250;          // stage = design area x 0..1512, y 1250..2300
  var stage = sec.querySelector(".stage");
  var box = sec.querySelector(".stage-box");
  var pin = sec.querySelector(".scene-pin");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // room interior and the door, in stage coordinates
  var ROOM = { x1: 135, x2: 1377, y1: 1780 - Y0, y2: 2177 - Y0 };
  var DOOR_OUT = [466, 1738 - Y0], DOOR_IN = [466, 1830 - Y0];
  var SPEED = 300;                              // walking speed when returning, stage px per second

  var people = [];
  var k = 1, edge = 0, P = 0;
  var cropTop = 0;                              // in compact mode the empty top of the stage is skipped

  // one line per character, popped up in a thought bubble when they get dragged out
  var LINES = [
    "Wait, my karaoke turn is next!",
    "Did someone say pizza?",
    "Okay, okay, back to the party.",
    "Feels safe and cozy in here.",
    "I left my Uno hand on the table!",
    "The movie's starting without me…",
    "This place hits different.",
    "Mood lighting is calling me back.",
    "Someone's singing Arijit. I'm in.",
    "Main character, returning to set.",
    "Fine. The comfy seats win.",
    "Popcorn won't eat itself.",
    "Hidden gem? Feels like home.",
    "Best. Night. Ever.",
    "Cheaper than brunch, way more fun.",
    "Gotta get that reel before 11.",
    "Open mic in five. Nervous!",
    "My people are in there.",
    "Snack break over. Vibes on.",
    "Who turned up the speakers? Me.",
    "Cozy, private, all ours.",
    "Can we stay one more hour?"
  ];
  // the people waiting in line outside think about getting in
  var QUEUE_LINES = [
    "Is it my turn yet?",
    "Next one in? That's me.",
    "Save my spot in line!",
    "Hold the door, I'm coming!",
    "I can hear the karaoke from here.",
    "Worth the wait, I swear.",
    "Can you see inside yet?",
    "Line's moving, line's moving!",
    "I'm on the list. Probably.",
    "Okay, I'll wait my turn.",
    "Hurry, the fun's in there!",
    "Back of the line again? Fine."
  ];
  function showBubble(o) {
    if (!o.bubble) {
      var b = document.createElement("div");
      b.className = "thought";
      b.textContent = o.qi != null ? QUEUE_LINES[o.qi % QUEUE_LINES.length] : LINES[o.index % LINES.length];
      pin.appendChild(b);
      o.bubble = b;
    }
    clearTimeout(o.bubbleTimer);
    o.bubble.classList.remove("is-gone");
  }
  function placeBubble(o, x, y) {
    if (!o.bubble) return;
    var r = box.getBoundingClientRect(), pr = pin.getBoundingClientRect();
    var px = r.left - pr.left + x * k, py = r.top - pr.top + (y - cropTop - o.h / 2) * k;
    var b = o.bubble, bw = b.offsetWidth, bh = b.offsetHeight;
    var left = px + 12, flip = left + bw > pr.width - 8;
    if (flip) left = px - 12 - bw;
    b.classList.toggle("is-left", flip);
    b.style.transform = "translate(" + left.toFixed(1) + "px," + Math.max(8, py - bh - 20).toFixed(1) + "px)";
  }
  function hideBubble(o, delay) {
    if (!o.bubble) return;
    clearTimeout(o.bubbleTimer);
    o.bubbleTimer = setTimeout(function () {
      if (!o.bubble) return;
      o.bubble.classList.add("is-gone");
      o.bubbleTimer = setTimeout(function () { if (o.bubble) { o.bubble.remove(); o.bubble = null; } }, 320);
    }, delay || 0);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function center(p) { return [p.x + p.w / 2, p.y - Y0 + p.h / 2]; }

  function addPerson(p, stateAt, queueIndex) {
    var img = document.createElement("img");
    img.src = "assets/people/" + p.n + ".svg";
    img.alt = "";
    img.draggable = false;
    img.title = "Drag me anywhere. I'll find my way back.";
    img.className = "person";
    img.style.left = p.x + "px";
    img.style.top = (p.y - Y0) + "px";
    img.style.width = p.w + "px";
    img.style.height = p.h + "px";
    stage.appendChild(img);
    var c0 = center(p);
    var o = {
      el: img, c0: c0, h: p.h, index: people.length, qi: queueIndex, override: null, bubble: null,
      stateAt: stateAt || function () { return { x: c0[0], y: c0[1], rot: 0, sc: 1 }; }
    };
    img._person = o;
    people.push(o);
    return o;
  }
  function draw(o, x, y, rot, sc) {
    o.el.style.transform = "translate(" + (x - o.c0[0]).toFixed(1) + "px," + (y - o.c0[1]).toFixed(1) +
      "px) rotate(" + rot.toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")";
  }

  /* ---------- row 1: slides in from the left */
  D.row1.slice().sort(function (a, b) { return b.x - a.x; }).forEach(function (p, j) {
    var start = 0.02 + j * 0.025, dur = 0.3, c = center(p);
    addPerson(p, function (P) {
      var t = clamp((P - start) / dur, 0, 1);
      var from = -(p.x + p.w + 40 + edge);      // start just off the left edge of the screen
      var dx = from * (1 - ease(t));
      return { x: c[0] + dx, y: c[1], rot: t > 0 && t < 1 ? Math.sin(dx / 9) * 7 : 0, sc: 1 };
    }, j);
  });

  /* ---------- walkers: people on the path first (closest to the door), then row 2 left to right */
  var walkersData = D.trail.slice().sort(function (a, b) { return b.y - a.y; })
    .concat(D.row2.slice().sort(function (a, b) { return a.x - b.x; }));

  var free = D.room.slice();                    // room spots from the design
  var SEATS = [                                 // chairs at the first table (design coords)
    { x: 743, y: 1958, r: 180 }, { x: 834, y: 1958, r: 180 },
    { x: 743, y: 2050, r: 0 }, { x: 834, y: 2050, r: 0 }
  ];
  var seatIndex = 0;
  var PATH = [[500, 1610], [478, 1690], [466, 1800]];

  function lengths(pts) {
    var L = [0];
    for (var j = 1; j < pts.length; j++) L.push(L[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    return L;
  }
  function along(pts, L, d) {
    for (var j = 1; j < L.length; j++) {
      if (d <= L[j]) {
        var f = clamp((d - L[j - 1]) / ((L[j] - L[j - 1]) || 1), 0, 1);
        return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f];
      }
    }
    return pts[pts.length - 1];
  }
  var ROW2_Y = 1532 - Y0;

  walkersData.forEach(function (p, i) {
    var c0 = center(p);
    var target, rotEnd = 0, scEnd = 1;
    var spot = -1;
    for (var n = 0; n < free.length; n++) { if (free[n].n === p.n) { spot = n; break; } }
    if (spot >= 0) {
      target = center(free[spot]);
      free.splice(spot, 1);
    } else {
      var s = SEATS[seatIndex++ % SEATS.length];
      target = [s.x, s.y - Y0];
      rotEnd = s.r;
      scEnd = 0.8;
    }
    var pts = [c0];
    if (p.y < 1600) pts.push([520, c0[1]]);
    PATH.forEach(function (d) { if (d[1] - Y0 > c0[1] + 5) pts.push([d[0], d[1] - Y0]); });
    pts.push(target);
    var lens = lengths(pts);
    var total = lens[lens.length - 1];
    var start = 0.34 + i * 0.022, dur = 0.3;
    // line 2 first walks in from the right edge of the screen (at the same time line 1 comes from the left)
    var entryStart = 0.02 + i * 0.02, entryDur = 0.3;
    var entryVia = p.y < 1600 ? [] : [[520, ROW2_Y]].concat(PATH.filter(function (d) { return d[1] - Y0 < c0[1] - 5; })
      .map(function (d) { return [d[0], d[1] - Y0]; }));

    addPerson(p, function (P) {
      if (P < start) {
        var te = clamp((P - entryStart) / entryDur, 0, 1);
        var ep = [[W + edge + 80, p.y < 1600 ? c0[1] : ROW2_Y]].concat(entryVia, [c0]);
        var el = lengths(ep), de = el[el.length - 1] * ease(te);
        var q = along(ep, el, de);
        return { x: q[0], y: q[1], rot: te > 0 && te < 1 ? Math.sin(de / 9) * 7 : 0, sc: 1 };
      }
      var t = clamp((P - start) / dur, 0, 1);
      var d = total * ease(t);
      var pt = along(pts, lens, d);
      var settle = clamp((t - 0.85) / 0.15, 0, 1);   // turn & sit over the last stretch
      var wob = t > 0 && t < 1 ? Math.sin(d / 9) * 7 * (1 - settle) : 0;
      return { x: pt[0], y: pt[1], rot: rotEnd * settle + wob, sc: 1 + (scEnd - 1) * settle };
    });
  });

  // room spots nobody walks to are people already inside
  free.forEach(function (p) { addPerson(p); });

  /* ---------- scroll rendering */
  function render() {
    people.forEach(function (o) {
      if (o.override) return;
      var s = o.stateAt(P);
      draw(o, s.x, s.y, s.rot, s.sc);
    });
  }
  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var full = Math.min(vw / W, (vh * 0.96) / H);
    // when the whole drawing would make its text too small (phones, portrait tablets), move the text
    // out of the drawing (.scene-copy) and show only the two lines and the room, as big as fits
    var compact = full < 0.62;
    sec.classList.toggle("scene--compact", compact);
    var visH = H;
    if (compact) {
      cropTop = 110;
      visH = 860;
      var copyH = 0;
      [].forEach.call(sec.querySelectorAll(".scene-copy"), function (c) { copyH += c.offsetHeight; });
      var avail = vh - copyH - 48;
      k = reduce ? vw / W : Math.min(vw / W, Math.max(avail, 120) / visH);
    } else {
      cropTop = 0;
      k = reduce ? vw / W : full;
    }
    k = Math.min(k, 1.2);
    box.style.width = W * k + "px";
    box.style.height = visH * k + "px";
    stage.style.transform = "translateY(" + (-cropTop * k).toFixed(2) + "px) scale(" + k + ")";
    edge = Math.max(0, (window.innerWidth - W * k) / 2) / k;
  }
  function progress() {
    if (reduce) return 1;
    var r = sec.getBoundingClientRect();
    var total = sec.offsetHeight - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 1;
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; P = progress(); render(); });
  }

  /* ---------- drag & drop */
  function toStage(e) {
    var r = box.getBoundingClientRect();
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k + cropTop];
  }
  function visibleArea() {                      // the part of the stage plane currently on screen
    var r = box.getBoundingClientRect(), pr = pin.getBoundingClientRect();
    return {
      x1: (Math.max(pr.left, 0) - r.left) / k + 25, x2: (Math.min(pr.right, window.innerWidth) - r.left) / k - 25,
      y1: (Math.max(pr.top, 0) - r.top) / k + cropTop + 25, y2: (Math.min(pr.bottom, window.innerHeight) - r.top) / k + cropTop - 25
    };
  }
  function inside(p) { return p[0] > ROOM.x1 && p[0] < ROOM.x2 && p[1] > ROOM.y1 && p[1] < ROOM.y2; }
  function aboveRoom(p) { return p[1] < ROOM.y1 - 30; }
  // from a point outside the room, walk around the walls (never through them) to just outside the door
  function aroundToDoor(p) {
    var pts = [];
    if (!aboveRoom(p)) {
      var side = p[0] < (ROOM.x1 + ROOM.x2) / 2 ? ROOM.x1 - 70 : ROOM.x2 + 70;
      if (p[0] > ROOM.x1 - 70 && p[0] < ROOM.x2 + 70) pts.push([side, p[1]]);   // below the room: step sideways
      else side = p[0];
      pts.push([side, DOOR_OUT[1]]);
    }
    pts.push(DOOR_OUT.slice());
    return pts;
  }
  function route(from, to) {
    var a = inside(from), b = inside(to);
    if (a && b) return [];
    if (!a && b) return aroundToDoor(from).concat([DOOR_IN.slice()]);
    if (a && !b) return [DOOR_IN.slice(), DOOR_OUT.slice()].concat(aboveRoom(to) ? [] : aroundToDoor(to).reverse().slice(1));
    if (aboveRoom(to)) return aroundToDoor(from).slice(0, -1);
    return [];
  }

  var dragging = null;
  stage.addEventListener("pointerdown", function (e) {
    var o = e.target._person;
    if (!o || e.button > 0) return;
    e.preventDefault();
    var pos;
    if (o.override) pos = o.override.pos.slice();
    else { var s = o.stateAt(P); pos = [s.x, s.y]; }
    var pt = toStage(e);
    o.override = { mode: "drag", pos: pos, off: [pos[0] - pt[0], pos[1] - pt[1]], dist: 0, way: [], wait: 0 };
    dragging = o;
    o.el.setPointerCapture(e.pointerId);
    o.el.classList.remove("is-returning");
    o.el.classList.add("is-dragging");
    draw(o, pos[0], pos[1], 8, 1.12);
    placeBubble(o, pos[0], pos[1]);
  });
  stage.addEventListener("pointermove", function (e) {
    if (!dragging || e.target !== dragging.el) return;
    var ov = dragging.override, pt = toStage(e), b = visibleArea();
    ov.pos = [clamp(pt[0] + ov.off[0], b.x1, b.x2), clamp(pt[1] + ov.off[1], b.y1, b.y2)];
    draw(dragging, ov.pos[0], ov.pos[1], 8, 1.12);
    placeBubble(dragging, ov.pos[0], ov.pos[1]);
  });
  function drop(e) {
    if (!dragging || e.target !== dragging.el) return;
    var o = dragging, ov = o.override, s = o.stateAt(P);
    dragging = null;
    o.el.classList.remove("is-dragging");
    o.el.classList.add("is-returning");
    ov.mode = "return";
    ov.way = route(ov.pos, [s.x, s.y]);
    ov.wait = 0.35;                             // a short beat before walking back
    showBubble(o);
    placeBubble(o, ov.pos[0], ov.pos[1]);
    startLoop();
  }
  stage.addEventListener("pointerup", drop);
  stage.addEventListener("pointercancel", drop);

  var running = false, last = 0;
  function step(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var busy = false;
    people.forEach(function (o) {
      var ov = o.override;
      if (!ov || ov.mode !== "return") return;
      busy = true;
      var home = o.stateAt(P);
      if (ov.wait > 0) { ov.wait -= dt; draw(o, ov.pos[0], ov.pos[1], 0, 1); placeBubble(o, ov.pos[0], ov.pos[1]); return; }
      var tgt = ov.way.length ? ov.way[0] : [home.x, home.y];
      var dx = tgt[0] - ov.pos[0], dy = tgt[1] - ov.pos[1], d = Math.hypot(dx, dy), stepLen = SPEED * dt;
      if (d <= stepLen) {
        ov.pos = tgt.slice();
        if (ov.way.length) ov.way.shift();
        else {
          o.override = null;
          o.el.classList.remove("is-returning");
          draw(o, home.x, home.y, home.rot, home.sc);
          placeBubble(o, home.x, home.y);
          hideBubble(o, 900);                   // let the thought linger a moment once they're back
          return;
        }
      } else {
        ov.pos = [ov.pos[0] + dx / d * stepLen, ov.pos[1] + dy / d * stepLen];
      }
      ov.dist += Math.min(stepLen, d);
      var rem = ov.way.length ? 999 : Math.hypot(home.x - ov.pos[0], home.y - ov.pos[1]);
      var settle = clamp(1 - rem / 60, 0, 1);
      draw(o, ov.pos[0], ov.pos[1], Math.sin(ov.dist / 9) * 7 * (1 - settle) + home.rot * settle, 1 + (home.sc - 1) * settle);
      placeBubble(o, ov.pos[0], ov.pos[1]);
    });
    if (busy) requestAnimationFrame(step); else running = false;
  }
  function startLoop() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(step);
  }

  layout();
  P = progress();
  render();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { layout(); onScroll(); });
})();
