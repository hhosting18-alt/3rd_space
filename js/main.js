/* The 3rd Space — menu, marquees, vibe switcher, gallery pager, contact form */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- menu */
  var menuBtn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");
  if (menuBtn && menu) {
    var closeBtn = menu.querySelector(".menu-close");
    var setMenu = function (open) {
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
      (open ? closeBtn : menuBtn).focus();
    };
    menuBtn.addEventListener("click", function () { setMenu(true); });
    closeBtn.addEventListener("click", function () { setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) setMenu(false);
    });
  }

  /* ---------------- continuous marquees
     data-dir="left"  -> content moves right-to-left (new items enter from the right)
     data-dir="right" -> content moves left-to-right
     data-speed       -> pixels per second */
  var marquees = [].slice.call(document.querySelectorAll(".marquee"));
  marquees.forEach(function (m) {
    var track = m.querySelector(".marquee-track");
    m._original = [].slice.call(track.children).map(function (n) { return n.cloneNode(true); });
  });

  function buildMarquee(m) {
    var track = m.querySelector(".marquee-track");
    track.style.animation = "none";
    track.innerHTML = "";
    m._original.forEach(function (n) { track.appendChild(n.cloneNode(true)); });
    // repeat the set until one copy is wider than the viewport
    var guard = 0;
    while (track.scrollWidth < m.clientWidth + 50 && guard++ < 20) {
      m._original.forEach(function (n) { appendClone(track, n); });
    }
    // duplicate the whole set once so translateX(-50%) loops seamlessly
    [].slice.call(track.children).forEach(function (n) { appendClone(track, n); });
    var speed = parseFloat(m.dataset.speed) || 50;
    track.style.setProperty("--dur", (track.scrollWidth / 2 / speed).toFixed(2) + "s");
    track.style.animation = "";
  }
  function appendClone(track, n) {
    var c = n.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    c.querySelectorAll("a").forEach(function (a) { a.tabIndex = -1; });
    if (c.tagName === "A") c.tabIndex = -1;
    track.appendChild(c);
  }
  function buildAll() { if (!reduceMotion) marquees.forEach(buildMarquee); }
  buildAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildAll);
  var resizeTimer, lastW = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildAll, 200);
  });

  /* ---------------- "Whether it's a..." photo stack */
  var stack = document.querySelector(".stack");
  if (stack) {
    var cards = [].slice.call(stack.querySelectorAll(".polaroid"));
    var buttons = [].slice.call(document.querySelectorAll(".vibe-list button"));
    // positions in % of the stack box (from the Figma frame)
    var SLOTS = {
      front: { l: 0, t: 19.7, w: 67.1, z: 10 },
      a: { l: 50.9, t: 0, w: 49.1, z: 1 },
      b: { l: 12.9, t: 10.7, w: 58.2, z: 2 },
      c: { l: 22.5, t: 42.1, w: 58.2, z: 4 },
      d: { l: 50.9, t: 60.4, w: 49.1, z: 3 }
    };
    var slots = { front: 0, a: 4, b: 3, c: 1, d: 2 };
    var nextVictim = 0, victims = ["c", "b", "d", "a"];

    var place = function () {
      cards.forEach(function (card, i) {
        var name = null;
        Object.keys(slots).forEach(function (k) { if (slots[k] === i) name = k; });
        var s = SLOTS[name || "front"];
        card.style.left = s.l + "%";
        card.style.top = s.t + "%";
        card.style.width = s.w + "%";
        card.style.zIndex = name ? s.z : 0;
        card.classList.toggle("is-front", name === "front");
        card.classList.toggle("is-hidden", !name);
      });
    };
    var activate = function (i) {
      if (slots.front === i) return;
      var from = null;
      Object.keys(slots).forEach(function (k) { if (slots[k] === i) from = k; });
      if (!from) { from = victims[nextVictim++ % victims.length]; }
      slots[from] = slots.front;
      slots.front = i;
      var card = cards[i];
      card.classList.remove("is-entering");
      void card.offsetWidth; // restart the animation
      if (!reduceMotion) card.classList.add("is-entering");
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.card === i)); });
      place();
    };
    cards.forEach(function (c) {
      c.addEventListener("animationend", function () { c.classList.remove("is-entering"); });
    });
    buttons.forEach(function (b) {
      var go = function () { activate(+b.dataset.card); };
      b.addEventListener("mouseenter", go);
      b.addEventListener("focus", go);
      b.addEventListener("click", go);
    });
    place();
  }

  /* ---------------- gallery pager */
  var pages = document.querySelector(".grid-pages");
  if (pages) {
    var gtrack = pages.querySelector(".grid-track");
    var count = gtrack.children.length;
    var prev = document.querySelector("[data-page='prev']");
    var next = document.querySelector("[data-page='next']");
    var label = document.querySelector(".pager-label");
    var index = 0;
    var show = function (i) {
      index = Math.max(0, Math.min(count - 1, i));
      gtrack.style.transform = "translateX(" + (-100 * index) + "%)";
      [].slice.call(gtrack.children).forEach(function (p, j) {
        p.setAttribute("aria-hidden", String(j !== index));
        p.inert = j !== index;
      });
      prev.disabled = index === 0;
      next.disabled = index === count - 1;
      label.textContent = (index + 1) + " / " + count;
    };
    prev.addEventListener("click", function () { show(index - 1); });
    next.addEventListener("click", function () { show(index + 1); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    });
    show(0);
  }

  /* ---------------- contact form: opens the visitor's email app with the details filled in */
  var form = document.querySelector(".form");
  if (form) {
    var note = form.querySelector(".form-note");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var name = (d.get("name") || "").trim();
      var phone = (d.get("phone") || "").trim();
      var email = (d.get("email") || "").trim();
      var event = (d.get("event") || "").trim();
      if (!name) { note.textContent = "Add your name so we know who to reply to."; form.elements["name"].focus(); return; }
      if (!phone && !email) { note.textContent = "Add a phone number or email so we can get back to you."; form.elements["phone"].focus(); return; }
      var body = "Name: " + name + "\nPhone: " + phone + "\nEmail: " + email + "\n\nAbout the event:\n" + event;
      window.location.href = "mailto:hello@thirdspace.in?subject=" +
        encodeURIComponent("Booking enquiry from " + name) + "&body=" + encodeURIComponent(body);
      note.textContent = "Opening your email app with your details. Hit send there and we’ll get back in a jiffy.";
    });
  }

  /* ---------------- footer crowd: legs that actually step
     The crowd is one flat drawing, so here it's loaded inline and each person's lower body is cut along
     the hip and the crotch line into a back leg and a front leg (clip paths), which swing from the hip in
     opposite directions. The legs only ever close in from the drawn stride, so no gaps open up.
     Everything above the hips stays put. Path numbers are the order of <path>s in assets/svg/crowd.svg. */
  var crowdImg = document.querySelector("img.crowd");
  var CROWD_PATHS = 339;
  var CROWD_LEGS = [
    { hip: [31, 88], crotch: 31, phase: 0.00, paths: [320, 321, 322, 316, 323, 319, 318, 317, 315, 314, 338] },
    { hip: [56, 80], crotch: 57, phase: 0.55, paths: [40, 39, 31, 38, 55, 56, 53, 54, 52] },
    { hip: [113, 74], crotch: 113, phase: 0.25, paths: [3, 2, 19, 4, 20, 21, 15, 18, 16, 17] },
    { hip: [170, 100], crotch: 168, phase: 0.75, paths: [288, 286, 294, 295, 300, 301, 291, 293, 312, 292, 299, 305, 304, 306, 307] },
    { hip: [244, 66], crotch: 245, phase: 0.10, paths: [150, 153, 152, 151, 146, 149, 148, 147, 139, 140, 141, 144, 172, 173] },
    { hip: [306, 88], crotch: 307, phase: 0.60, paths: [239, 238, 242, 241, 236, 247, 248, 240, 237, 245, 246, 277, 244, 276] },
    { hip: [382, 100], crotch: 384, phase: 0.35, paths: [108, 107, 124, 123] },
    { hip: [452, 106], crotch: 452, phase: 0.85, paths: [182, 179, 180, 181, 186, 227, 183, 184, 185, 226, 217, 215, 216, 214, 228] },
    { hip: [516, 96], crotch: 521, phase: 0.45, paths: [61, 88, 90, 94, 91, 87, 89, 63, 64, 66, 81, 106, 65, 80, 105] }
  ];
  var STEP_SECONDS = 0.9;   // one step (stride -> feet together -> stride)
  var LEG_SWING = 13;       // degrees each leg swings in from the drawn stride
  if (crowdImg && !reduceMotion && window.fetch && window.DOMParser) {
    fetch(crowdImg.src)
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(rigCrowd)
      .catch(function () { /* keep the plain image */ });
  }
  function rigCrowd(txt) {
    var SVGNS = "http://www.w3.org/2000/svg";
    var parsed = new DOMParser().parseFromString(txt, "image/svg+xml").documentElement;
    if (!parsed || parsed.nodeName.toLowerCase() !== "svg") return;
    var svg = document.importNode(parsed, true);
    var paths = svg.querySelectorAll("path");
    if (paths.length !== CROWD_PATHS) return;   // the drawing changed: keep the plain image
    var space = paths[0].parentNode.parentNode;   // the group whose coordinates are the drawing's 0..576 x 0..216
    var defs = document.createElementNS(SVGNS, "defs");
    space.insertBefore(defs, space.firstChild);
    var OV = 4;                                    // overlap at the hip so the seam never shows
    var people = CROWD_LEGS.map(function (p, k) {
      var hx = p.hip[0], hy = p.hip[1], cx = p.crotch;
      var regions = {
        u: "-60,-60 700,-60 700," + (hy + OV) + " -60," + (hy + OV),
        b: "-60," + (hy - OV) + " " + (hx + 0.6) + "," + (hy - OV) + " " + (cx + 0.6) + ",240 -60,240",
        f: (hx - 0.6) + "," + (hy - OV) + " 700," + (hy - OV) + " 700,240 " + (cx - 0.6) + ",240"
      };
      Object.keys(regions).forEach(function (nm) {
        var cp = document.createElementNS(SVGNS, "clipPath");
        cp.setAttribute("id", "crowd-" + k + nm);
        var pg = document.createElementNS(SVGNS, "polygon");
        pg.setAttribute("points", regions[nm]);
        cp.appendChild(pg);
        defs.appendChild(cp);
      });
      var person = { hx: hx, hy: hy, phase: p.phase, back: [], front: [] };
      p.paths.forEach(function (i) {
        var leaf = paths[i].parentNode, holder = leaf.parentNode;
        var wrap = document.createElementNS(SVGNS, "g");
        holder.insertBefore(wrap, leaf);           // same spot, so the drawing order is unchanged
        ["u", "b", "f"].forEach(function (nm) {
          var g = document.createElementNS(SVGNS, "g");
          var c = document.createElementNS(SVGNS, "g");
          c.setAttribute("clip-path", "url(#crowd-" + k + nm + ")");
          c.appendChild(nm === "f" ? leaf : leaf.cloneNode(true));
          g.appendChild(c);
          wrap.appendChild(g);
          if (nm === "b") person.back.push(g);
          if (nm === "f") person.front.push(g);
        });
      });
      return person;
    });

    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("class", crowdImg.getAttribute("class") + " is-rigged");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    crowdImg.parentNode.replaceChild(svg, crowdImg);

    // feet come together while the group pauses at either end / turns around
    var walkAnim = null;
    function walking() {
      if (!walkAnim && svg.getAnimations) {
        svg.getAnimations().forEach(function (a) { if (a.animationName === "crowd-walk") walkAnim = a; });
      }
      if (!walkAnim || !walkAnim.effect) return true;
      var pr = walkAnim.effect.getComputedTiming().progress;
      if (pr == null) return true;
      return (pr > 0.04 && pr < 0.46) || (pr > 0.54 && pr < 0.96);
    }
    var visible = true, raf = 0, last = 0, still = 0;
    function frame(now) {
      raf = 0;
      if (!visible) return;
      var dt = Math.min(0.1, (now - last) / 1000 || 0.016);
      last = now;
      still += ((walking() ? 0 : 1) - still) * Math.min(1, dt * 4);
      var t = now / 1000 / STEP_SECONDS;
      people.forEach(function (m) {
        var s = (1 - Math.cos(2 * Math.PI * (t + m.phase))) / 2;   // 0 = drawn stride, 1 = feet together
        s = s + (1 - s) * still;
        var a = (LEG_SWING * s).toFixed(2), piv = " " + m.hx + " " + m.hy + ")";
        var tb = "rotate(-" + a + piv, tf = "rotate(" + a + piv;
        m.back.forEach(function (g) { g.setAttribute("transform", tb); });
        m.front.forEach(function (g) { g.setAttribute("transform", tf); });
      });
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    if ("IntersectionObserver" in window) {      // only animate while the footer is on screen
      visible = false;
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }, { rootMargin: "100px" }).observe(svg);
    } else {
      start();
    }
  }

  /* ---------------- floating scroll bar: just the purple bar, no track (the native one is hidden in CSS) */
  var thumb = document.createElement("div");
  thumb.className = "scroll-thumb";
  thumb.setAttribute("aria-hidden", "true");
  document.body.appendChild(thumb);
  var thumbH = 0, maxScroll = 0, queued = false;
  function sizeThumb() {
    var vh = window.innerHeight, docH = document.documentElement.scrollHeight;
    maxScroll = docH - vh;
    thumb.hidden = maxScroll <= 2;
    thumbH = Math.max(40, vh * vh / docH);
    thumb.style.height = thumbH + "px";
    moveThumb();
  }
  function moveThumb() {
    var y = maxScroll > 0 ? window.scrollY / maxScroll * (window.innerHeight - thumbH) : 0;
    thumb.style.transform = "translateY(" + y.toFixed(1) + "px)";
  }
  window.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; moveThumb(); });
  }, { passive: true });
  window.addEventListener("resize", sizeThumb);
  window.addEventListener("load", sizeThumb);
  if (window.ResizeObserver) new ResizeObserver(sizeThumb).observe(document.body);
  sizeThumb();

  var grabY = 0, grabScroll = 0;
  thumb.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    grabY = e.clientY;
    grabScroll = window.scrollY;
    thumb.setPointerCapture(e.pointerId);
    thumb.classList.add("is-dragging");
  });
  thumb.addEventListener("pointermove", function (e) {
    if (!thumb.classList.contains("is-dragging")) return;
    var track = window.innerHeight - thumbH;
    var y = grabScroll + (e.clientY - grabY) / (track || 1) * maxScroll;
    window.scrollTo({ top: y, behavior: "instant" });
  });
  function release() { thumb.classList.remove("is-dragging"); }
  thumb.addEventListener("pointerup", release);
  thumb.addEventListener("pointercancel", release);
})();
