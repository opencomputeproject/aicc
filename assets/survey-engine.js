/* Survey engine: renders window.SURVEY (survey.js) with the page settings in window.FORM_CONFIG (config.js).
   One section per page, a progress bar, per-tier S/M/L grids, ranking, display logic, answers kept in the
   browser while in progress, a review step, and private edit links from the confirmation email. */
(function () {
  "use strict";
  const C = window.FORM_CONFIG, S = window.SURVEY;
  const $ = id => document.getElementById(id);
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v === false || v == null) continue; if (k === "class") e.className = v; else e.setAttribute(k, v === true ? "" : v); }
    kids.flat(Infinity).forEach(k => { if (k != null && k !== false) e.append(k.nodeType ? k : String(k)); });
    return e;
  };
  const TIERS = S.tiers;                         // [["S","Small"],…]
  const QS = [], QBY = {};
  S.sections.forEach((s, si) => s.questions.forEach(q => { q.section = si; q.label = {}; q.options.forEach(([c, l]) => { q.label[c] = l; }); QS.push(q); QBY[q.id] = q; }));
  const TIER_Q = QBY[S.tierSource];
  const LIQUID_NOTE = "Asked only when Question 20 includes direct-to-chip, CDU, rear-door or immersion cooling.";

  /* ---------- header ---------- */
  $("eyebrow").textContent = `${C.project} · ${C.projectShort}`;
  $("heading").textContent = C.heading;
  $("lede").textContent = C.lede;
  (C.facts || []).forEach(f => $("facts").append(el("li", null, f)));
  $("privacyLink").href = C.privacyUrl;
  ["projLink", "projPage", "closedLink", "doneLink"].forEach(id => { $(id).href = C.projectUrl; });
  $("listLink").href = C.mailingList;
  const foot = $("footer");
  foot.append(`${C.project} (${C.projectShort}) · ${S.title} · `, el("a", { href: C.projectUrl, target: "_blank", rel: "noopener" }, "Project page"),
    " · ", el("a", { href: C.mailingList, target: "_blank", rel: "noopener" }, "Mailing list"));
  if (C.deadline) {
    $("deadline").hidden = false; $("deadlineText").textContent = `Responses close ${C.deadlineLabel || new Date(C.deadline).toUTCString()}`;
    const d = Math.ceil((new Date(C.deadline) - new Date()) / 864e5);
    $("countdown").textContent = d > 1 ? `${d} days left` : d === 1 ? "Closes today" : "Closed";
  }
  $("previewBar").hidden = !!C.endpoint;
  const isClosed = () => C.closed === true || (!!C.deadline && new Date() > new Date(C.deadline));

  /* ---------- pages ---------- */
  const PAGES = [{ title: "About you", contact: true }].concat(S.sections.map((s, i) => ({ title: s.title, section: i })));
  const pagesBox = $("pages");
  const CONTACT = [
    ["firstName", "First name", true, "given-name", 100], ["lastName", "Last name", true, "family-name", 100],
    ["email", "Work email", true, "email", 254], ["company", "Organization", false, "organization", 150],
    ["jobTitle", "Job title", false, "organization-title", 150]];

  function contactPage() {
    const f = (id, label, req, ac, max) => el("label", { class: "f", "data-contact": id },
      el("span", { class: "lbl" }, label, req ? el("span", { class: "req" }, "*") : el("span", { class: "optional" }, " (optional)")),
      el("input", { type: id === "email" ? "email" : "text", id: "c_" + id, autocomplete: ac, maxlength: max }),
      el("span", { class: "err" }, id === "email" ? "Enter a valid email address, like name@company.com." : `Enter your ${label.toLowerCase()}.`));
    const by = Object.fromEntries(CONTACT.map(c => [c[0], f(...c)]));
    by.company.insertBefore(el("span", { class: "hint" }, "Leave blank to respond without naming your organization."), by.company.querySelector("input"));
    return el("div", { class: "fields" }, el("div", { class: "two" }, by.firstName, by.lastName), el("div", { class: "two" }, by.email, by.company), by.jobTitle);
  }

  function optLabel(q, code) { return q.label[code] || code; }

  function renderQ(q) {
    const box = el("fieldset", { class: "q", "data-q": q.id, id: "q_" + q.id });
    box.append(el("legend", { class: "qhead" }, el("span", { class: "qno" }, "Q" + q.n), el("span", { class: "qtitle" }, q.title, q.required ? el("span", { class: "req", "aria-hidden": "true" }, "*") : null)));
    box.append(el("p", { class: "qtext" }, q.text));
    if (q.help) box.append(el("p", { class: "hint" }, q.help));
    if (S.logic[q.id]) box.append(el("p", { class: "hint logic" }, LIQUID_NOTE));
    const name = q.id;
    if (q.type === "single" || q.type === "multi") {
      if (q.max) box.append(el("p", { class: "hint" }, `Select up to ${q.max}.`));
      const list = el("div", { class: "opts" + (q.options.length > 6 ? " cols" : "") });
      q.options.forEach(([code, label]) => {
        list.append(el("label", { class: "opt" }, el("input", { type: q.type === "single" ? "radio" : "checkbox", name, value: code }), el("span", null, label)));
      });
      box.append(list);
      if (q.other) box.append(el("label", { class: "f other", hidden: true }, el("span", { class: "lbl" }, "Please describe"), el("input", { type: "text", id: q.id + "_other", maxlength: 200 })));
      if (q.comment) {
        const ta = el("textarea", { id: q.id + "_comment", rows: 4, maxlength: q.comment.max });
        const cnt = el("span", { class: "counter" });
        const upd = () => { const n = ta.value.length; cnt.textContent = `${n.toLocaleString()} / ${q.comment.max.toLocaleString()}`; cnt.className = "counter" + (n > q.comment.max * 0.9 ? " near" : ""); };
        ta.addEventListener("input", upd); upd();
        box.append(el("label", { class: "f comment" }, el("span", { class: "lbl" }, q.comment.label), ta, cnt));
      }
    } else if (q.type === "grid1" || q.type === "gridN") {
      if (q.max) box.append(el("p", { class: "hint" }, `Select up to ${q.max} for each profile.`));
      const t = el("table", { class: "mx" });
      t.append(el("thead", null, el("tr", null, el("th", { scope: "col", class: "ans" }, el("span", { class: "sr" }, "Answer")),
        TIERS.map(([k, n]) => el("th", { scope: "col", "data-t": k }, n)))));
      const tb = el("tbody");
      q.options.forEach(([code, label], i) => {
        const id = `${q.id}_${i}`;
        tb.append(el("tr", null, el("th", { scope: "row", class: "ans", id }, label),
          TIERS.map(([k, n]) => el("td", { "data-t": k }, el("label", { class: "cell" },
            el("input", { type: q.type === "grid1" ? "radio" : "checkbox", name: `${name}_${k}`, value: code, "aria-label": `${label}, ${n}` }))))));
      });
      t.append(tb);
      box.append(el("div", { class: "mxwrap" }, t));
    } else if (q.type === "rank") {
      const list = el("ol", { class: "rank" });
      for (let i = 0; i < q.count; i++) {
        const sel = el("select", { id: `${q.id}_r${i}`, "aria-label": `Rank ${i + 1}` }, el("option", { value: "" }, "Choose…"),
          q.options.map(([c, l]) => el("option", { value: c }, l)));
        list.append(el("li", null, el("span", { class: "rk" }, String(i + 1)), sel));
      }
      box.append(list);
    }
    box.append(el("span", { class: "err", role: "alert" }));
    return box;
  }

  PAGES.forEach((p, i) => {
    const sec = el("section", { class: "step page", "data-page": i, hidden: true });
    sec.append(el("div", { class: "stephead" }, el("span", { class: "stepno" }, p.contact ? "BEFORE YOU START" : `SECTION ${i} OF ${S.sections.length}`), el("h2", { tabindex: "-1" }, p.title)));
    if (p.contact) {
      sec.append(el("p", { class: "stepnote" }, "We use these details to send your confirmation and a private link to change your answers."));
      sec.append(contactPage());
    } else {
      const s = S.sections[p.section];
      if (s.note) sec.append(el("p", { class: "stepnote" }, s.note));
      sec.append(el("div", { class: "qs" }, s.questions.map(renderQ)));
    }
    pagesBox.append(sec);
  });

  /* ---------- reading and writing answers ---------- */
  const form = $("form");
  const inputs = (name) => [...form.querySelectorAll(`input[name="${name}"]`)];
  function readQ(q) {
    if (q.type === "single") { const c = inputs(q.id).find(i => i.checked); return c ? c.value : ""; }
    if (q.type === "multi") return inputs(q.id).filter(i => i.checked).map(i => i.value);
    if (q.type === "grid1") { const o = {}; TIERS.forEach(([k]) => { const c = inputs(`${q.id}_${k}`).find(i => i.checked); o[k] = c ? c.value : ""; }); return o; }
    if (q.type === "gridN") { const o = {}; TIERS.forEach(([k]) => { o[k] = inputs(`${q.id}_${k}`).filter(i => i.checked).map(i => i.value); }); return o; }
    if (q.type === "rank") return [...Array(q.count)].map((_, i) => $(`${q.id}_r${i}`).value);
  }
  function readAll() {
    const a = {};
    QS.forEach(q => {
      a[q.id] = readQ(q);
      if (q.other) a[q.id + "_other"] = $(q.id + "_other").value.trim();
      if (q.comment) a[q.id + "_comment"] = $(q.id + "_comment").value.trim();
    });
    return a;
  }
  function readContact() { const c = {}; CONTACT.forEach(([id]) => { c[id] = $("c_" + id).value.trim(); }); return c; }
  function fill(answers, contact) {
    answers = answers || {};
    QS.forEach(q => {
      const v = answers[q.id];
      if (q.type === "single") inputs(q.id).forEach(i => { i.checked = i.value === v; });
      else if (q.type === "multi") inputs(q.id).forEach(i => { i.checked = Array.isArray(v) && v.includes(i.value); });
      else if (q.type === "grid1") TIERS.forEach(([k]) => inputs(`${q.id}_${k}`).forEach(i => { i.checked = !!v && v[k] === i.value; }));
      else if (q.type === "gridN") TIERS.forEach(([k]) => inputs(`${q.id}_${k}`).forEach(i => { i.checked = !!v && Array.isArray(v[k]) && v[k].includes(i.value); }));
      else if (q.type === "rank") for (let i = 0; i < q.count; i++) $(`${q.id}_r${i}`).value = (Array.isArray(v) && q.label[v[i]]) ? v[i] : "";
      if (q.other) $(q.id + "_other").value = answers[q.id + "_other"] || "";
      if (q.comment) { const t = $(q.id + "_comment"); t.value = answers[q.id + "_comment"] || ""; t.dispatchEvent(new Event("input")); }
    });
    if (contact) CONTACT.forEach(([id]) => { if (contact[id] != null) $("c_" + id).value = contact[id]; });
    refresh();
  }

  /* ---------- display logic ---------- */
  // Tiers answered "NA" in the tier question are not offered and are left out of every later S/M/L question.
  function activeTiers(a) {
    const v = (a || readAll())[TIER_Q.id] || {};
    return TIERS.map(t => t[0]).filter(k => v[k] !== "NA");
  }
  function shown(q, a, act) {
    const r = S.logic[q.id];
    if (!r) return true;
    const v = a[r.q] || {};
    return act.some(k => (v[k] || []).some(c => r.any.includes(c)));
  }
  function tiersFor(q, act) { return q.id === TIER_Q.id ? TIERS.map(t => t[0]) : act; }

  function refresh() {
    const a = readAll(), act = activeTiers(a);
    QS.forEach(q => {
      const box = $("q_" + q.id);
      box.hidden = !shown(q, a, act);
      if (q.type === "grid1" || q.type === "gridN") {
        const on = tiersFor(q, act);
        box.querySelectorAll("[data-t]").forEach(c => { c.hidden = !on.includes(c.dataset.t); });
      }
      if (q.other) { const o = box.querySelector(".other"); o.hidden = a[q.id] !== q.other; }
      if (q.type === "rank") {
        const used = a[q.id];
        for (let i = 0; i < q.count; i++) [...$(`${q.id}_r${i}`).options].forEach(o => { o.disabled = !!o.value && used.includes(o.value) && used[i] !== o.value; });
      }
    });
  }

  // Exclusive options ("None…") clear the other choices in the same list or tier, and the reverse.
  form.addEventListener("change", e => {
    const t = e.target;
    if (t.type === "checkbox" && t.checked && t.name) {
      const qid = t.name.replace(/_[SML]$/, ""), q = QBY[qid];
      if (q && q.exclusive) {
        const group = inputs(t.name);
        if (q.exclusive.includes(t.value)) group.forEach(i => { if (i !== t) i.checked = false; });
        else group.forEach(i => { if (q.exclusive.includes(i.value)) i.checked = false; });
      }
      if (q && q.max) {
        const n = inputs(t.name).filter(i => i.checked).length;
        if (n > q.max) { t.checked = false; flash(qid, q.type === "gridN" ? `Select up to ${q.max} for each profile.` : `Select up to ${q.max}.`); }
      }
    }
    refresh(); clearErr(t); saveDraft();
  });
  form.addEventListener("input", e => { clearErr(e.target); saveDraft(); });

  /* ---------- validation ---------- */
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function setErr(box, msg) { box.classList.toggle("invalid", !!msg); const e = box.querySelector(":scope > .err"); if (e) e.textContent = msg || ""; return !msg; }
  function clearErr(t) { const b = t.closest && t.closest(".invalid"); if (b) setErr(b, ""); }
  function flash(qid, msg) { const b = $("q_" + qid); setErr(b, msg); }
  const tierName = k => TIERS.find(t => t[0] === k)[1];

  function problem(q, a, act) {
    const v = a[q.id];
    if (q.type === "single") {
      if (q.required && !v) return "Choose one answer.";
      if (q.other && v === q.other && !a[q.id + "_other"]) return "Please describe your organization.";
    }
    if (q.type === "multi") {
      if (q.required && !v.length) return "Select at least one answer.";
      if (q.max && v.length > q.max) return `Select up to ${q.max}.`;
    }
    if (q.type === "grid1" && q.required) {
      const miss = tiersFor(q, act).filter(k => !v[k]);
      if (miss.length) return `Choose an answer for ${miss.map(tierName).join(", ")}.`;
    }
    if (q.type === "gridN") {
      const on = tiersFor(q, act);
      if (q.required) { const miss = on.filter(k => !v[k].length); if (miss.length) return `Select at least one answer for ${miss.map(tierName).join(", ")}.`; }
      if (q.max) { const over = on.filter(k => v[k].length > q.max); if (over.length) return `Select up to ${q.max} for ${over.map(tierName).join(", ")}.`; }
    }
    if (q.type === "rank") {
      const filled = v.filter(Boolean);
      if (q.required && filled.length < q.count) return `Choose all ${q.count} ranks.`;
      if (new Set(filled).size !== filled.length) return "Each criterion can be ranked only once.";
    }
    return "";
  }
  function validatePage(i) {
    let first = null;
    if (PAGES[i].contact) {
      CONTACT.forEach(([id, , req]) => {
        const box = form.querySelector(`[data-contact="${id}"]`), v = $("c_" + id).value.trim();
        const ok = (!req || v) && (id !== "email" || EMAIL.test(v));
        box.classList.toggle("invalid", !ok); if (!ok && !first) first = box;
      });
    } else {
      const a = readAll(), act = activeTiers(a);
      if (TIER_Q.section === PAGES[i].section && !act.length) {
        const b = $("q_" + TIER_Q.id); setErr(b, "At least one profile must be offered. Choose a size for Small, Medium or Large."); first = first || b;
      }
      S.sections[PAGES[i].section].questions.forEach(q => {
        if (!shown(q, a, act)) return;
        const b = $("q_" + q.id), msg = problem(q, a, act);
        if (!(q === TIER_Q && !act.length)) setErr(b, msg);
        if (msg && !first) first = b;
      });
    }
    return first;
  }

  /* ---------- navigation ---------- */
  let page = 0, furthest = 0;
  const reviewIndex = PAGES.length;
  function show(i, focus) {
    page = i; furthest = Math.max(furthest, i);
    const inReview = i === reviewIndex;
    form.hidden = inReview; $("review").hidden = !inReview;
    document.querySelectorAll(".page").forEach(p => { p.hidden = +p.dataset.page !== i; });
    $("backBtn").hidden = i === 0;
    $("nextBtn").textContent = i === PAGES.length - 1 ? (EDIT ? "Review my changes" : "Review my answers") : "Next";
    $("formErr").textContent = "";
    const pct = Math.round(Math.min(i, PAGES.length) / PAGES.length * 100);
    $("progressFill").style.width = pct + "%"; $("progressBar").setAttribute("aria-valuenow", pct);
    $("progressLabel").textContent = inReview ? "Review" : i === 0 ? "Before you start" : `Section ${i} of ${S.sections.length}`;
    $("progressPct").textContent = pct + "%";
    if (inReview) buildReview();
    toc();
    if (focus !== false) {
      const h = inReview ? $("reviewHead") : document.querySelector(`.page[data-page="${i}"] h2`);
      window.scrollTo({ top: $("progress").getBoundingClientRect().top + window.scrollY - 16, behavior: "smooth" });
      if (h) h.focus({ preventScroll: true });
    }
    saveDraft();
  }
  function toc() {
    const box = $("toc"); box.innerHTML = "";
    PAGES.concat([{ title: "Review and submit" }]).forEach((p, i) => {
      const b = el("button", { type: "button", class: "tocbtn" + (i === page && !DONE ? " on" : "") + (i <= furthest && i !== page ? " seen" : ""), disabled: DONE || i > furthest, "aria-current": i === page && !DONE ? "step" : false }, p.title);
      b.onclick = () => go(i);
      box.append(el("li", null, b));
    });
  }
  // Moving forward checks every page in between; moving back never blocks.
  function go(target) {
    if (target <= page) return show(target);
    for (let i = page; i < target && i < PAGES.length; i++) {
      const bad = validatePage(i);
      if (bad) { if (i !== page) show(i, false); $("formErr").textContent = "Some answers need attention. They are marked in red."; bad.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    }
    show(target);
  }
  form.addEventListener("submit", e => { e.preventDefault(); go(page + 1); });
  $("backBtn").onclick = () => show(page - 1);
  $("editBtn").onclick = () => show(PAGES.length - 1);

  /* ---------- review ---------- */
  function answerText(q, a, act) {
    const v = a[q.id], L = c => optLabel(q, c);
    if (!shown(q, a, act)) return "Not asked (no liquid cooling, rear-door or immersion in Question 20)";
    if (q.type === "single") return v ? L(v) + (q.other && v === q.other && a[q.id + "_other"] ? `: ${a[q.id + "_other"]}` : "") : "No answer";
    if (q.type === "multi") return (v.length ? v.map(L).join("\n") : "None selected") + (q.comment && a[q.id + "_comment"] ? `\n\nComment: ${a[q.id + "_comment"]}` : "");
    if (q.type === "grid1" || q.type === "gridN") return tiersFor(q, act).map(k => {
      const x = v[k]; return `${tierName(k)}: ${q.type === "grid1" ? (x ? L(x) : "No answer") : (x.length ? x.map(L).join("; ") : "None selected")}`;
    }).join("\n");
    if (q.type === "rank") return v.map((c, i) => `${i + 1}. ${c ? L(c) : "—"}`).join("\n");
  }
  function buildReview() {
    const a = readAll(), act = activeTiers(a), c = readContact(), box = $("reviewList"); box.innerHTML = "";
    const dl = (rows) => el("dl", null, rows.map(([k, v]) => [el("dt", null, k), el("dd", null, v)]));
    const sec = (title, idx, rows, open) => {
      const ch = el("button", { type: "button", class: "linkbtn" }, "Change"); ch.onclick = () => show(idx);
      return el("details", { class: "rv", open }, el("summary", null, el("span", null, title), ch), dl(rows));
    };
    box.append(sec("About you", 0, [["Name", `${c.firstName} ${c.lastName}`], ["Email", c.email], ["Organization", c.company || "Not given"], ["Job title", c.jobTitle || "Not given"],
      ["Profiles offered", act.map(tierName).join(", ")]], true));
    S.sections.forEach((s, i) => box.append(sec(`${i + 1}. ${s.title}`, i + 1, s.questions.map(q => [`Q${q.n} ${q.title}`, answerText(q, a, act)]), false)));
  }

  /* ---------- submit ---------- */
  // Only what was asked is sent: hidden questions and tiers that aren't offered are left out.
  function payload() {
    const a = readAll(), act = activeTiers(a), out = {};
    QS.forEach(q => {
      if (!shown(q, a, act)) return;
      let v = a[q.id];
      if (q.type === "grid1" || q.type === "gridN") { const on = tiersFor(q, act), o = {}; on.forEach(k => { o[k] = v[k]; }); v = o; }
      out[q.id] = v;
      if (q.other && a[q.id] === q.other) out[q.id + "_other"] = a[q.id + "_other"];
      if (q.comment && a[q.id + "_comment"]) out[q.id + "_comment"] = a[q.id + "_comment"];
    });
    return Object.assign({ formId: C.formId, version: S.version }, readContact(), { consent: $("consent").checked, answers: out, website: $("website").value },
      EDIT ? { editRef: EDIT.ref, editToken: EDIT.t } : {});
  }
  $("confirmBtn").onclick = async () => {
    if (isClosed()) return showClosed();
    const row = $("consentRow");
    if (!$("consent").checked) { row.classList.add("invalid"); $("sendErr").textContent = "Please accept the privacy terms to submit."; return; }
    for (let i = 0; i < PAGES.length; i++) if (validatePage(i)) return go(PAGES.length);   // shows the first page with a problem
    const b = $("confirmBtn"); b.disabled = true; b.textContent = "Sending…"; $("sendErr").textContent = "";
    const data = payload();
    let ref = "NC-PREVIEW";
    try {
      if (C.endpoint) {
        const r = await fetch(C.endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) });
        const j = await r.json();
        if (!j.ok) { const e = new Error(j.error || "The server did not accept your answers."); e.limited = !!j.limited; throw e; }
        ref = j.ref || ref;
      }
      clearDraft();
      $("doneName").textContent = data.firstName; $("doneRef").textContent = ref; $("doneEmail").textContent = data.email;
      if (EDIT) { $("doneTitle").textContent = "Changes saved"; $("doneLead").textContent = "A confirmation of your updated answers is on its way to"; }
      $("demoNote").hidden = !!C.endpoint;
      $("review").hidden = true; $("progress").hidden = true; $("previewBar").hidden = true; $("done").hidden = false; DONE = true; toc();
      $("doneTitle").focus({ preventScroll: true }); window.scrollTo({ top: $("done").offsetTop - 20, behavior: "smooth" });
    } catch (err) {
      $("sendErr").textContent = `Your answers were not sent: ${err.message}` + (err.limited ? "" : " Please try again in a minute. Your answers are still saved in this browser.");
    } finally { b.disabled = false; b.textContent = EDIT ? "Save my changes" : "Submit my answers"; }
  };
  $("consent").addEventListener("change", () => { $("consentRow").classList.remove("invalid"); $("sendErr").textContent = ""; });

  /* ---------- answers in progress, kept in this browser only ---------- */
  let DONE = false, EDIT = null, saveTimer = 0;
  const store = { get() { try { return JSON.parse(localStorage.getItem(C.draftKey) || "null"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(C.draftKey, JSON.stringify(v)); } catch (e) { /* storage off: nothing kept */ } },
    clear() { try { localStorage.removeItem(C.draftKey); } catch (e) { /* ignore */ } } };
  function saveDraft() {
    if (EDIT || DONE || !READY) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set({ version: S.version, at: Date.now(), page: Math.min(page, PAGES.length - 1), furthest, contact: readContact(), answers: readAll() }), 300);
  }
  function clearDraft() { clearTimeout(saveTimer); store.clear(); }
  $("draftClear").onclick = () => {
    if (!confirmReset()) return;
    clearDraft(); form.reset(); fill({}); $("consent").checked = false; furthest = 0; $("draftBar").hidden = true; show(0);
  };
  // A second click within 5 seconds confirms, so a stray click doesn't wipe 20 minutes of answers.
  let armed = 0;
  function confirmReset() {
    if (Date.now() - armed < 5000) return true;
    armed = Date.now(); $("draftClear").textContent = "Select again to clear all answers";
    setTimeout(() => { $("draftClear").textContent = "Start over"; }, 5000); return false;
  }

  /* ---------- closed ---------- */
  function showClosed() {
    form.hidden = true; $("review").hidden = true; $("previewBar").hidden = true; $("draftBar").hidden = true; $("progress").hidden = true; $("editBar").hidden = true;
    $("closedText").textContent = (C.deadlineLabel ? `Responses closed ${C.deadlineLabel}. ` : "") + "Thank you to everyone who took part.";
    $("closedNote").hidden = false; document.querySelector(".rail .panel").hidden = true;
  }

  /* ---------- sample answers for preview mode ---------- */
  $("sampleBtn").onclick = () => {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const real = q => q.options.map(o => o[0]).filter(c => !/^(DK|NA)$/.test(c) && !(q.exclusive || []).includes(c) && c !== q.other);
    const a = {};
    QS.forEach(q => {
      const codes = real(q);
      if (q.type === "single") a[q.id] = pick(codes);
      else if (q.type === "multi") { const s = codes.filter(() => Math.random() < 0.3).slice(0, q.max || 99); a[q.id] = s.length ? s : [codes[0]]; }
      else if (q.type === "grid1") { a[q.id] = {}; TIERS.forEach(([k], i) => { a[q.id][k] = codes[Math.min(codes.length - 1, Math.floor(codes.length * (i + Math.random()) / 3))]; }); }
      else if (q.type === "gridN") { a[q.id] = {}; TIERS.forEach(([k]) => { const s = codes.filter(() => Math.random() < 0.35).slice(0, q.max || 99); a[q.id][k] = s.length ? s : [codes[0]]; }); }
      else if (q.type === "rank") a[q.id] = codes.slice().sort(() => Math.random() - 0.5).slice(0, q.count);
    });
    a.q20 = { S: ["COOL_01", "COOL_02"], M: ["COOL_02", "COOL_04"], L: ["COOL_04", "COOL_05"] };
    a.q50_comment = "Example comment: we need a common quick-disconnect spec for mixed-vendor racks.";
    fill(a, { firstName: "Example", lastName: "Respondent", email: "example@company.com", company: "Example NeoCloud", jobTitle: "Infrastructure Architect" });
    document.querySelectorAll(".invalid").forEach(b => setErr(b, ""));
    saveDraft();
  };

  /* ---------- start ---------- */
  let READY = false;
  async function start() {
    if (isClosed()) { showClosed(); return; }
    const q = new URLSearchParams(location.search), ref = q.get("edit"), t = q.get("t");
    if (ref && t && C.endpoint) {
      const bar = $("editBar"); bar.hidden = false; bar.textContent = `Loading response ${ref}…`; form.hidden = true;
      try {
        const u = `${C.endpoint}?action=load&formId=${encodeURIComponent(C.formId)}&ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(t)}`;
        const j = await (await fetch(u)).json();
        if (!j.ok) throw new Error(j.error || "This edit link could not be opened.");
        EDIT = { ref, t };
        fill(j.data.answers, j.data.contact);
        bar.textContent = ""; bar.append(el("strong", null, `Changing response ${ref}. `), "Go through the sections you want to change, then review and save. Your original submission date stays the same.");
        $("confirmBtn").textContent = "Save my changes"; furthest = PAGES.length;
        form.hidden = false;
      } catch (err) {
        bar.textContent = `${err.message} You can still fill in a new response on this page.`; form.hidden = false;
      }
    } else {
      const d = store.get();
      if (d && d.answers) {
        fill(d.answers, d.contact);
        furthest = Math.min(d.furthest || 0, PAGES.length - 1);
        page = Math.min(d.page || 0, PAGES.length - 1);
        $("draftText").textContent = `Welcome back. We restored the answers saved in this browser on ${new Date(d.at).toLocaleString()}.`;
        $("draftBar").hidden = false;
      }
    }
    refresh(); READY = true;
    show(page, false);
  }
  start();
})();
