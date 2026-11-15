(function () {
  "use strict";
  var RS = window.RS || {};
  var places = RS.places || {};
  var routes = RS.routes || [];
  var cfg = RS.config || {};
  var T = RS.t || {};
  var LOCALE = RS.locale || "en-US";

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && k in v ? v[k] : m; }); }
  function waLink(text) { return "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(text); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(v) { var p = String(v || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function reduced() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function paxText(n) {
    n = Number(n) || 1;
    if (n > 40) return "40+ " + T.paxN;
    return n + " " + (n === 1 ? T.pax1 : T.paxN);
  }
  function vehicleFor(pax) {
    pax = Number(pax) || 1;
    var v = T.vehicle || [];
    if (pax <= 3) return v[0];
    if (pax <= 6) return v[1];
    if (pax <= 10) return v[2];
    if (pax <= 40) return v[3];
    return v[4];
  }
  function fmtDate(v) {
    var d = parseISO(v);
    if (!d) return "";
    return d.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function quoteText(q) {
    var from = places[q.from] ? places[q.from].label : q.from;
    var to = places[q.to] ? places[q.to].label : T.waOther;
    var t = fmt(T.waHi, { from: from, to: to });
    if (q.date) t += fmt(T.waOn, { date: fmtDate(q.date) });
    if (q.pax) t += fmt(T.waFor, { pax: paxText(q.pax) });
    t += ".";
    if (q.addr) t += fmt(T.waAddr, { addr: q.addr });
    return t;
  }

  function connected(from) {
    var out = {};
    routes.forEach(function (r) {
      if (r.from === from) out[r.to] = 1;
      if (r.to === from && places[r.from] && places[r.from].kind !== "service") out[r.from] = 1;
    });
    Object.keys(places).forEach(function (id) {
      var qf = places[id].quoteFrom;
      if (qf && qf.indexOf(from) > -1) out[id] = 1;
    });
    delete out[from];
    return Object.keys(out);
  }
  function findRoute(from, to) {
    var exact = routes.filter(function (r) { return r.from === from && r.to === to; })[0];
    if (exact) return { route: exact, reverse: false };
    var rev = routes.filter(function (r) { return r.from === to && r.to === from; })[0];
    if (rev) return { route: rev, reverse: true };
    return null;
  }

  var KINDS = ["airport", "city", "town", "beach", "park", "service"];
  function fillSelect(sel, ids, placeholder, includeOther) {
    var cur = sel.value;
    var html = '<option value="">' + esc(placeholder) + "</option>";
    KINDS.forEach(function (k) {
      var group = ids.filter(function (id) { return places[id] && places[id].kind === k; })
        .sort(function (a, b) { return places[a].label.localeCompare(places[b].label, LOCALE); });
      if (!group.length) return;
      html += '<optgroup label="' + esc((T.groups || {})[k] || k) + '">' + group.map(function (id) {
        return '<option value="' + id + '">' + esc(places[id].label) + "</option>";
      }).join("") + "</optgroup>";
    });
    if (includeOther) html += '<option value="other">' + esc(T.other) + "</option>";
    sel.innerHTML = html;
    if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
  }
  function allOrigins() {
    var ids = {};
    routes.forEach(function (r) {
      ids[r.from] = 1;
      if (places[r.to] && places[r.to].kind !== "service") ids[r.to] = 1;
    });
    return Object.keys(ids);
  }

  function routeCard(found, q) {
    var r = found.route;
    var title = found.reverse ? (places[q.from].name + (RS.lang === "es" ? " a " : " to ") + places[q.to].name) : r.title;
    var meta = '<span class="num">' + esc(r.duration) + "</span>";
    if (q.pax) meta += "<span>" + esc(vehicleFor(q.pax)) + "</span>";
    if (q.date) meta += "<span>" + esc(fmtDate(q.date)) + "</span>";
    var rev = found.reverse ? '<p class="note">' + esc(T.reverse) + "</p>" : "";
    return '<article class="result match">' +
      '<div><span class="pill">' + esc(T["private"]) + '</span><h3 style="margin-top:8px">' + esc(title) + '</h3><div class="result-meta">' + meta + "</div>" + rev + "</div>" +
      '<div class="result-actions"><div class="price num"><small>' + esc(T.from) + "</small>$" + r.price + "</div>" +
      '<button class="btn btn-primary" type="button" data-book="' + r.slug + '">' + esc(T.book) + "</button>" +
      '<a class="btn btn-ghost" href="' + esc(RS.urls[r.slug]) + '">' + esc(T.details) + "</a></div>" +
      '<p class="note" style="grid-column:1/-1">' + esc(T.priceNote) + ' <a href="' + waLink(quoteText(q)) + '" target="_blank" rel="noopener">' + esc(T.askWA) + "</a>.</p>" +
      "</article>";
  }
  function quoteCard(q) {
    return '<article class="result">' +
      '<div><span class="pill pill-orange">' + esc(T.quotePill) + '</span><h3 style="margin-top:8px">' + esc(T.quoteH) + "</h3>" +
      '<p class="note" style="margin-top:6px">' + esc(T.quoteP) + "</p></div>" +
      '<div class="result-actions"><a class="btn btn-wa" href="' + waLink(quoteText(q)) + '" target="_blank" rel="noopener">' + RS.icons.wa + esc(T.quoteWA) + "</a>" +
      '<a class="btn btn-ghost" href="' + esc(RS.contactUrl) + '">' + esc(T.useForm) + "</a></div></article>";
  }

  function initSearch(form) {
    var from = $("[name=from]", form), to = $("[name=to]", form), out = form.parentNode.querySelector(".results");
    fillSelect(from, allOrigins(), T.choosePickup, false);
    if (form.dataset.from) from.value = form.dataset.from;
    function refreshTo() {
      var ids = from.value ? connected(from.value) : [];
      fillSelect(to, ids, from.value ? T.chooseDest : T.chooseFirst, !!from.value);
      to.disabled = !from.value;
    }
    refreshTo();
    from.addEventListener("change", refreshTo);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = {
        from: from.value, to: to.value,
        date: ($('input[type=hidden][name=date]', form) || {}).value,
        pax: ($("[name=pax]", form) || {}).value,
        addr: (($("[name=addr]", form) || {}).value || "").trim()
      };
      if (!q.from) { from.focus(); return; }
      if (!q.to) { to.focus(); return; }
      RS.lastQuery = q;
      var found = q.to === "other" ? null : findRoute(q.from, q.to);
      out.innerHTML = found ? routeCard(found, q) : quoteCard(q);
      out.setAttribute("tabindex", "-1");
      out.focus({ preventScroll: true });
      out.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" });
    });
  }

  /* ---------- Date picker ---------- */
  var DOW = (function () {
    var monFirst = RS.lang === "es";
    var base = new Date(2024, 0, monFirst ? 1 : 7); // a Monday or a Sunday
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(base); d.setDate(base.getDate() + i);
      out.push({ short: d.toLocaleDateString(LOCALE, { weekday: "short" }).replace(".", ""), long: d.toLocaleDateString(LOCALE, { weekday: "long" }) });
    }
    return { names: out, monFirst: monFirst };
  })();
  var openPicker = null;

  function initDatePicker(wrap) {
    var input = $(".date-display", wrap), hidden = $("input[type=hidden]", wrap);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var focusISO = iso(today);
    var pop = null;

    function build() {
      pop = document.createElement("div");
      pop.className = "dp";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", T.dp.dialog);
      pop.hidden = true;
      pop.innerHTML =
        '<div class="dp-head"><button type="button" class="dp-nav" data-dp="prev" aria-label="' + esc(T.dp.prev) + '">‹</button>' +
        '<p class="dp-title" aria-live="polite"></p>' +
        '<button type="button" class="dp-nav" data-dp="next" aria-label="' + esc(T.dp.next) + '">›</button></div>' +
        '<div class="dp-dow">' + DOW.names.map(function (n) { return '<span title="' + esc(n.long) + '">' + esc(n.short) + "</span>"; }).join("") + "</div>" +
        '<div class="dp-grid" role="grid"></div>' +
        '<div class="dp-foot"><button type="button" class="dp-link" data-dp="today">' + esc(T.dp.today) + '</button><button type="button" class="dp-link" data-dp="clear">' + esc(T.dp.clear) + "</button></div>";
      wrap.appendChild(pop);
      pop.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b || b.disabled) return;
        var act = b.getAttribute("data-dp");
        if (act === "prev") { shift(-1); return; }
        if (act === "next") { shift(1); return; }
        if (act === "today") { choose(iso(today)); return; }
        if (act === "clear") { hidden.value = ""; input.value = ""; close(true); return; }
        if (b.dataset.iso) choose(b.dataset.iso);
      });
      pop.addEventListener("keydown", onKey);
    }
    function shift(m) {
      var next = new Date(view.getFullYear(), view.getMonth() + m, 1);
      if (next < new Date(today.getFullYear(), today.getMonth(), 1)) return;
      view = next;
      var f = parseISO(focusISO);
      f = new Date(view.getFullYear(), view.getMonth(), Math.min(f.getDate(), 28));
      focusISO = iso(f < today ? today : f);
      render();
    }
    function render() {
      var title = view.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
      $(".dp-title", pop).textContent = title.charAt(0).toUpperCase() + title.slice(1);
      $('[data-dp="prev"]', pop).disabled = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();
      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var lead = (first.getDay() + (DOW.monFirst ? 6 : 0)) % 7;
      var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var sel = hidden.value;
      var html = "";
      for (var i = 0; i < lead; i++) html += '<span class="dp-empty"></span>';
      for (var d = 1; d <= days; d++) {
        var date = new Date(view.getFullYear(), view.getMonth(), d), v = iso(date);
        var past = date < today;
        var cls = "dp-day" + (v === iso(today) ? " is-today" : "") + (v === sel ? " is-sel" : "");
        html += '<button type="button" class="' + cls + '" data-iso="' + v + '"' + (past ? " disabled" : "") +
          ' tabindex="' + (v === focusISO ? "0" : "-1") + '"' + (v === sel ? ' aria-pressed="true"' : "") +
          ' aria-label="' + esc(date.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" })) + '">' + d + "</button>";
      }
      $(".dp-grid", pop).innerHTML = html;
    }
    function place() {
      pop.classList.remove("dp-right");
      var r = wrap.getBoundingClientRect();
      if (r.left + pop.offsetWidth > document.documentElement.clientWidth - 12) pop.classList.add("dp-right");
    }
    function open() {
      if (!pop) build();
      if (openPicker && openPicker !== api) openPicker.close();
      var sel = parseISO(hidden.value);
      if (sel) { view = new Date(sel.getFullYear(), sel.getMonth(), 1); focusISO = hidden.value; }
      render();
      pop.hidden = false;
      input.setAttribute("aria-expanded", "true");
      place();
      openPicker = api;
      var f = $('.dp-day[tabindex="0"]', pop) || $(".dp-day:not([disabled])", pop);
      if (f) f.focus();
    }
    function close(refocus) {
      if (!pop || pop.hidden) return;
      pop.hidden = true;
      input.setAttribute("aria-expanded", "false");
      if (openPicker === api) openPicker = null;
      if (refocus) input.focus();
    }
    function choose(v) {
      hidden.value = v;
      input.value = fmtDate(v);
      focusISO = v;
      close(true);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(true); return; }
      var b = e.target.closest(".dp-day");
      if (!b) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); shift(e.key === "PageUp" ? -1 : 1); var f0 = $('.dp-day[tabindex="0"]', pop); if (f0) f0.focus(); return; }
      if (!step) return;
      e.preventDefault();
      var d = parseISO(b.dataset.iso); d.setDate(d.getDate() + step);
      if (d < today) return;
      focusISO = iso(d);
      if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) view = new Date(d.getFullYear(), d.getMonth(), 1);
      render();
      var f = $('.dp-day[tabindex="0"]', pop); if (f) f.focus();
    }
    input.addEventListener("click", function () { pop && !pop.hidden ? close() : open(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); open(); }
      if (e.key === "Escape") close();
      if ((e.key === "Backspace" || e.key === "Delete") && hidden.value) { hidden.value = ""; input.value = ""; }
    });
    document.addEventListener("pointerdown", function (e) { if (pop && !pop.hidden && !wrap.contains(e.target)) close(); });
    var api = { close: close };
    wrap._dp = { set: function (v) { if (v) { hidden.value = v; input.value = fmtDate(v); } else { hidden.value = ""; input.value = ""; } } };
  }

  /* ---------- Booking dialog ---------- */
  var dlg;
  function openBook(slug) {
    var r = routes.filter(function (x) { return x.slug === slug; })[0];
    if (!r) return;
    dlg = dlg || $("#book-dialog");
    var q = RS.lastQuery && RS.lastQuery.to ? RS.lastQuery : { from: r.from, to: r.to };
    $("#book-title", dlg).textContent = r.title;
    var chips = [];
    if (q.pax) chips.push(paxText(q.pax) + ", " + vehicleFor(q.pax));
    if (q.addr) chips.push(fmt(T.chipAddr, { addr: q.addr }));
    $(".book-summary", dlg).innerHTML = chips.map(function (c) { return '<span class="pill">' + esc(c) + "</span>"; }).join("");
    var slot = $(".wt-slot", dlg);
    slot.className = "wt-slot";
    if (r.wetravelUuid && !RS.preview) {
      var cal = cfg.wetravelWidget === "calendar";
      var sid = cal ? "wetravel_embed_calendar" : "wetravel_package_listing";
      dlg.classList.toggle("wide", cal);
      slot.classList.add("ready");
      slot.innerHTML = "";
      var old = document.getElementById(sid);
      if (old) old.remove();
      var holder = document.createElement("div");
      var s = document.createElement("script");
      s.src = "https://cdn.wetravel.com/widgets/" + (cal ? "embed_calendar.js" : "embed_packages.js");
      s.id = sid;
      s.setAttribute("data-env", "https://www.wetravel.com");
      s.setAttribute("data-version", "v0.3");
      s.setAttribute("data-uid", cfg.wetravelUid);
      s.setAttribute("data-uuid", r.wetravelUuid);
      s.setAttribute("data-color", cfg.wetravelColor);
      s.setAttribute("data-text", T.wtText);
      if (cal) { s.setAttribute("data-title", T.wtTitle); s.setAttribute("data-position", "center"); }
      else s.setAttribute("data-showreviews", "true");
      holder.appendChild(s);
      slot.appendChild(holder);
      var fallback = function () {
        if (slot.querySelector("iframe") || slot.textContent.trim()) return;
        slot.classList.remove("ready");
        slot.innerHTML = '<div class="wt-msg"><span>' + esc(T.wtSlow) + "</span>" +
          (r.bookLink ? '<a class="btn btn-blue" href="' + esc(r.bookLink) + '" target="_blank" rel="noopener">' + esc(T["continue"]) + "</a>" : "") + "</div>";
      };
      s.onerror = fallback;
      setTimeout(fallback, 7000);
    } else if (r.wetravelUuid && RS.preview) {
      dlg.classList.remove("wide");
      slot.innerHTML = '<div class="wt-msg"><strong>' + esc(T.previewWidget) + "</strong><span>" + esc(T.previewWidget2) + "</span>" +
        (r.bookLink ? '<a class="btn btn-blue" href="' + esc(r.bookLink) + '" target="_blank" rel="noopener">' + esc(T.openBooking) + "</a>" : "") + "</div>";
    } else if (r.bookLink) {
      slot.innerHTML = '<div class="wt-msg"><span>' + esc(T.continueP) + '</span><a class="btn btn-blue" href="' + esc(r.bookLink) + '" target="_blank" rel="noopener">' + esc(T.continue) + "</a></div>";
    } else {
      slot.innerHTML = '<div class="wt-msg"><span>' + esc(T.soon) + "</span></div>";
    }
    $(".book-wa", dlg).innerHTML = '<a class="btn btn-wa" href="' + waLink(quoteText(q.to ? q : { from: r.from, to: r.to })) + '" target="_blank" rel="noopener">' + RS.icons.wa + esc(T.bookWA) + "</a>";
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-book]");
    if (b) { e.preventDefault(); openBook(b.getAttribute("data-book")); return; }
    if (e.target.closest("[data-close]")) { dlg && dlg.close(); return; }
    if (dlg && e.target === dlg) dlg.close();
  });

  /* ---------- Nav ---------- */
  var tog = $(".nav-toggle");
  if (tog) tog.addEventListener("click", function () {
    var nav = $(".nav"); var open = nav.classList.toggle("open");
    tog.setAttribute("aria-expanded", open ? "true" : "false");
  });

  /* ---------- Contact form ---------- */
  $$("form[data-contact]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var st = $(".form-status", f);
      var bad = $$("[required]", f).filter(function (el) { el.value = el.value.trim(); return !el.value || (el.type === "email" && !/^\S+@\S+\.\S+$/.test(el.value)); });
      $$("[aria-invalid]", f).forEach(function (el) { el.removeAttribute("aria-invalid"); });
      if (bad.length) {
        bad.forEach(function (el) { el.setAttribute("aria-invalid", "true"); });
        st.className = "form-status err";
        st.textContent = fmt(T.formMissing, { fields: bad.map(function (el) { return (T.fields || {})[el.name] || el.name; }).join(", ") });
        bad[0].focus();
        return;
      }
      if (RS.preview || !cfg.web3formsKey) {
        st.className = "form-status ok";
        st.textContent = RS.preview ? T.formPreview : T.formSetup;
        return;
      }
      var data = new FormData(f);
      data.append("access_key", cfg.web3formsKey);
      data.append("subject", T.subject);
      data.append("language", RS.lang || "en");
      st.className = "form-status"; st.textContent = T.sending;
      fetch("https://api.web3forms.com/submit", { method: "POST", body: data })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.success) throw new Error();
          st.className = "form-status ok"; st.textContent = T.sent; f.reset();
          $$("[data-datepicker]", f).forEach(function (w) { w._dp && w._dp.set(""); });
        })
        .catch(function () { st.className = "form-status err"; st.textContent = T.fail; });
    });
  });

  $$("[data-datepicker]").forEach(initDatePicker);
  $$("form.search").forEach(initSearch);
})();
