/* Page settings for the NeoCloud Deployment Requirements Survey.
   The questions themselves live in survey.js (shared with the Apps Script backend). */
window.FORM_CONFIG = {
  formId: "neocloud-requirements",            // must match FORMS in apps-script/Code.gs
  project: "OCP AI Computing Continuum",
  projectShort: "AICC",
  projectUrl: "https://www.opencompute.org/projects/aicc/",
  mailingList: "https://ocp-all.groups.io/g/ocp-aicc",
  heading: "NeoCloud Deployment Requirements Survey",
  lede: "Help the OCP AI Computing Continuum project understand what NeoCloud providers need at three repeatable deployment sizes. Your answers inform the project’s open specifications and reference architectures.",
  facts: ["50 multiple-choice questions", "About 20–25 minutes", "Small / Medium / Large profiles"],
  deadline: "",                               // UTC, e.g. "2027-01-31T07:59:00Z"; "" = open until closed by hand
  deadlineLabel: "",                          // e.g. "January 30, 2027 at 11:59 PM PT"
  closed: false,                              // true closes the survey now
  endpoint: "",                               // Apps Script web-app /exec URL; "" = preview mode (nothing is sent)
  privacyUrl: "https://www.opencompute.org/privacy",
  draftKey: "aicc-neocloud-draft"             // answers in progress are kept in the visitor's own browser under this key
};
