# OCP AI Computing Continuum (AICC) – Surveys

Branded surveys for the [OCP AI Computing Continuum project](https://www.opencompute.org/projects/aicc/), hosted on GitHub Pages. The first is the **NeoCloud Deployment Requirements Survey**: 50 multiple-choice questions comparing Small, Medium and Large deployment profiles.

Live page (once Pages is on): https://opencomputeproject.github.io/aicc/forms/neocloud-requirements/

## How it works

```
Respondent's browser → survey page (GitHub Pages) → Apps Script web app → "Survey Results" Google Sheet
```

The page shows one section per page with a progress bar, keeps answers in the respondent's own browser while they work (so a closed tab loses nothing), shows a review step, then posts the response as JSON to the Apps Script. The script checks every answer again, writes one row to the **Responses** tab and emails the respondent a confirmation with a private link to change their answers.

## Layout

```
index.html                                Landing page (links to the survey and the project)
assets/form.css                           OCP brand styles (shared with the Innovation Village forms)
assets/survey-engine.js                   Survey engine: pages, S/M/L grids, ranking, logic, drafts, review, edit links
assets/ocp-logo.png, aicc-icon.svg/.png   Logos (the PNG icon is for emails)
forms/neocloud-requirements/index.html    Page shell
forms/neocloud-requirements/config.js     Page settings: backend URL, deadline, links
forms/neocloud-requirements/survey.js     THE QUESTIONS: also pasted into Apps Script as "Survey"
apps-script/Code.gs                       Backend
```

## Set up the backend (once)

1. Open the **Survey Results** Sheet (AICC Drive folder) → **Extensions → Apps Script**. Name the project, e.g. "AICC NeoCloud survey".
2. Replace the contents of `Code.gs` with `apps-script/Code.gs`.
3. Click **+** next to Files → **Script**, name it `Survey`, and paste `forms/neocloud-requirements/survey.js` into it. Save.
4. Pick `setup` in the toolbar and click **Run**. Allow the permissions (if Google says the app isn't verified: **Advanced → Go to … (unsafe)**; it's your own script). The Sheet gets a **Responses** tab (154 columns) and a **Codebook** tab.
5. **Deploy → New deployment → Web app**. Execute as: *Me*. Who has access: *Anyone*. Copy the `/exec` URL.
6. Paste it into `forms/neocloud-requirements/config.js` as `endpoint`, commit, and bump the `?v=` stamps in `forms/neocloud-requirements/index.html`.

While `endpoint` is empty the page runs in **preview mode**: nothing is sent, and a "Fill with sample answers" button helps test it.

## The Sheet

- **Responses**: Submitted, Reference, contact details, then one column per question (S/M/L questions get one column per tier, rankings one per rank), then Survey version, Privacy consent, Last edited, and staff columns **Status** and **Notes**. The form never writes the staff columns after a row is created.
- Cells hold the stable **codes** from the survey document (e.g. `LOAD_04`). Select-all answers list codes separated by `; `.
- `SKIP` = not asked (that tier isn't offered, or Q21–Q22 were hidden). `NONE` = asked, nothing selected. `DK` and `NA` are real answers.
- **Codebook** lists every question, its columns, codes and wording. Run `writeCodebook` after changing wording.

## Survey logic

- A tier answered **Not applicable** in Q3 isn't offered: it disappears from every later S/M/L question and is stored as `SKIP`. At least one tier must be offered.
- Q21–Q22 are asked only when Q20 includes rear-door, direct-to-chip, a CDU or immersion cooling (COOL_03–06, COOL_08) for an offered tier.
- Required: every single-choice and S/M/L single-choice question, Q2, Q12 (up to 3 per tier), Q49 (exactly 5 ranked). Q50 allows up to 5. Other select-all lists and S/M/L checkbox grids are optional.
- "None" answers (ENV_01, BAR_10, WTR_01, SUI_06, REG_10) can't be combined with other answers.

## Changing questions

1. Edit `survey.js` and bump its `version`. Never change or reuse an option code once responses arrive.
2. Paste the new `survey.js` into the Apps Script `Survey` file. If you added, removed or renamed a question, change the matching **Responses** headers too (or point `tab` at a new tab and run `setup`), then run `checkColumns`.
3. **Deploy → Manage deployments → pencil → Version: New version → Deploy** (the URL stays the same).
4. Commit and bump the `?v=` stamps.

Anyone mid-survey on the old version is asked to reload; their answers are kept in their browser.

## Protection

Server-side validation of every answer against the survey, formula-injection guard on typed text, rate limits (5 submissions or edits per email per hour, 20 a minute overall), honeypot field, signed edit links (HMAC; secret in Script Properties), deadline enforced on the server, script lock, and a column guard that refuses to save if the Sheet's headers and the survey disagree.

## Closing

Set the same deadline (UTC) in `CONFIG.closes` in Code.gs, `deadline` in config.js and `data-closes` on the landing page. At that time the script refuses responses and edits, the survey page shows a closed notice, and the landing page marks it CLOSED.

## Brand

Colors follow *OCP Brand Guidelines v3-1*: green `#8DC63F`, gray `#5F6062`, indigo `#343895` / `#262673` / `#19194D`. Type is Franklin Gothic where installed, with Libre Franklin as the fallback.
