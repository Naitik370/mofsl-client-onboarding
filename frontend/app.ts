type CaseRow = Record<string, string | number | boolean | Record<string,string>>;
type MisReport = {
  generatedAt: string;
  summary: Record<string, number>;
  pipeline: Array<{stage:string; count:number; averageAging:number}>;
  groups: Array<Record<string, string | number>>;
  cases: CaseRow[];
};
type Meta = {statuses:Array<{status:string; stage:string}>; locations:string[]; segments:string[]; slaDays:number};
type ImportRow = CaseRow & {valid:boolean; error:string};
type User = {id:number; username:string; displayName:string; role:"admin"|"operations"|"cse"|"mofsl"|"viewer"};
type ValidationContext = {knownReferences?:Set<string>};

const $ = <T extends Element = HTMLElement>(selector:string) => document.querySelector(selector) as T;
const $$ = <T extends Element = HTMLElement>(selector:string) => [...document.querySelectorAll(selector)] as T[];
let meta:Meta = {statuses:[], locations:[], segments:[], slaDays:7};
let report:MisReport | null = null;
let caseRows:CaseRow[] = [];
let historyRows:CaseRow[] = [];
let importRows:ImportRow[] = [];
let editingId:number | null = null;
let referenceLocked = false;
let dimension = "cseName";
let currentUser:User | null = null;
const cseStatuses = new Set(["Request Received from CSE","Resubmitted by CSE","Discrepancy Resolution Received","Resubmitted Form Received - Under Review"]);
const mofslStatuses = new Set(["Query Raised by MOFSL","Query Resolved - Resubmitted to MOFSL","Account Opened","Communication Sent - Case Closed"]);
const entryTypes = new Set(["New","Resubmission","Discrepancy Resolution","Modification"]);
const accountTypes = new Set(["Individual","HUF","Corporate","NRI","Minor"]);
const channels = new Set(["Physical","Digital"]);
const owners = new Set(["Operations","CSE","MOFSL"]);
const queryStatuses = new Set(["Query Raised to CSE - Missing Information","Discrepancy Raised to CSE","Form Returned to CSE","Query Raised by MOFSL"]);
const automaticDateFields:Record<string,string> = {
  "Request Received from CSE":"inwardDate",
  "Physical Form Submitted to CSE":"outwardDate",
  "Digital Form Sent to Client":"outwardDate",
  "Resubmitted by CSE":"resubmissionDate",
  "Discrepancy Resolution Received":"resubmissionDate",
  "Resubmitted Form Received - Under Review":"resubmissionDate",
  "Signed Form Received from CSE":"signedFormDate",
  "Submitted to MOFSL":"submittedDate",
  "Account Opened":"accountOpeningDate",
};

async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials:"same-origin",
    headers: {"Content-Type":"application/json", ...(options.headers || {})},
  });
  const body = await response.json();
  if (response.status === 401 && path !== "/api/auth/login") showLogin("Your session expired. Sign in again.");
  if (!response.ok) throw new Error((body.errors || [body.error || "Request failed"]).join(" | "));
  return body;
}

function escapeHtml(value:unknown):string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char] || char));
}

function formatDate(value:unknown):string {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}

function localToday():string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0,10);
}

function applyAutomaticDates(payload:Record<string,string>):Record<string,string> {
  const result = {...payload};
  if (currentUser?.role !== "admin" || result.autoCaptureDates !== "true") return result;
  const field = automaticDateFields[result.status];
  if (field && !result[field]) result[field] = localToday();
  return result;
}

function statusBadge(status:unknown):string {
  const text = String(status || "");
  const cls = ["Account Opened","Communication Sent - Case Closed"].includes(text) ? "closed" :
    ["On Hold","Rejected","Cancelled by Client"].includes(text) ? "exception" : "";
  return `<span class="status ${cls}">${escapeHtml(text)}</span>`;
}

function toast(message:string):void {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 2600);
}

function showView(name:string):void {
  if (!currentUser) return;
  if (name === "users" && currentUser.role !== "admin") return;
  if (["entry","upload"].includes(name) && currentUser.role === "viewer") return;
  if (name === "upload" && !["admin","operations"].includes(currentUser.role)) return;
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-item").forEach(button => {
    const active = (button as HTMLElement).dataset.view === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const titles:Record<string,string> = {
    dashboard:"MIS Overview", analysis:"Performance MIS", cases:"Case Register",
    entry:editingId ? "Edit Entry" : "New Entry", upload:"Bulk Upload", history:"Audit History", users:"User Administration",
  };
  $("#view-title").textContent = titles[name] || "MOFSL Client Onboarding";
  if (name === "history") renderHistory();
  if (name === "users") loadUsers();
}

function showLogin(message = ""):void {
  currentUser = null;
  ($("#boot-screen") as HTMLElement).hidden = true;
  ($("#app-shell") as HTMLElement).hidden = true;
  ($("#login-screen") as HTMLElement).hidden = false;
  const error = $("#login-error") as HTMLElement;
  error.hidden = !message;
  error.textContent = message;
}

function applyRoleUi():void {
  if (!currentUser) return;
  ($("#boot-screen") as HTMLElement).hidden = true;
  ($("#login-screen") as HTMLElement).hidden = true;
  ($("#app-shell") as HTMLElement).hidden = false;
  $("#current-user").textContent = currentUser.displayName;
  $("#current-role").textContent = currentUser.role === "viewer" ? "Management Viewer" : currentUser.role.toUpperCase();
  $$("[data-admin]").forEach(item => (item as HTMLElement).hidden = currentUser!.role !== "admin");
  $$("[data-write]").forEach(item => (item as HTMLElement).hidden = currentUser!.role === "viewer");
  $$("[data-bulk]").forEach(item => (item as HTMLElement).hidden = !["admin","operations"].includes(currentUser!.role));
  const entryType = ($("#case-form") as HTMLFormElement).elements.namedItem("entryType") as HTMLSelectElement;
  if (currentUser.role === "mofsl") {
    entryType.innerHTML = "<option>Modification</option>";
  } else if (currentUser.role === "cse") {
    entryType.innerHTML = "<option>New</option><option>Resubmission</option><option>Discrepancy Resolution</option>";
  } else {
    entryType.innerHTML = "<option>New</option><option>Resubmission</option><option>Discrepancy Resolution</option><option>Modification</option>";
  }
  const cseName = ($("#case-form") as HTMLFormElement).elements.namedItem("cseName") as HTMLInputElement;
  cseName.readOnly = currentUser.role === "cse";
  if (currentUser.role === "cse") cseName.value = currentUser.displayName;
}

async function loadAll(showMessage = false):Promise<void> {
  try {
    const params = new URLSearchParams({
      dimension,
      start: ($("#filter-start") as HTMLInputElement)?.value || "",
      end: ($("#filter-end") as HTMLInputElement)?.value || "",
    });
    [meta, report, caseRows, historyRows] = await Promise.all([
      api<Meta>("/api/meta"),
      api<MisReport>(`/api/reports?${params}`),
      api<CaseRow[]>("/api/cases"),
      api<CaseRow[]>("/api/history"),
    ]);
    $("#api-state").textContent = "Reporting API online";
    $("#api-dot").classList.add("online");
    populateMasters();
    renderAll();
    if (showMessage) toast("Report refreshed");
  } catch (error) {
    $("#api-state").textContent = "Reporting API unavailable";
    $("#api-dot").classList.remove("online");
    toast((error as Error).message);
  }
}

function populateMasters():void {
  const statusSelect = $("#status-select") as HTMLSelectElement;
  const previous = statusSelect.value;
  const allowed = meta.statuses.filter(item =>
    !currentUser || ["admin","operations","viewer"].includes(currentUser.role) ||
    (currentUser.role === "cse" ? cseStatuses.has(item.status) : mofslStatuses.has(item.status))
  );
  statusSelect.innerHTML = allowed.map(item => `<option>${escapeHtml(item.status)}</option>`).join("");
  if (previous) statusSelect.value = previous;
  const filter = $("#status-filter") as HTMLSelectElement;
  const filterValue = filter.value;
  filter.innerHTML = `<option value="">All statuses</option>${meta.statuses.map(item => `<option>${escapeHtml(item.status)}</option>`).join("")}`;
  filter.value = filterValue;
  for (const [name, values] of [["location", meta.locations], ["segment", meta.segments]] as const) {
    const select = ($("#case-form") as HTMLFormElement).elements.namedItem(name) as HTMLSelectElement;
    const value = select.value;
    select.innerHTML = values.map(item => `<option>${escapeHtml(item)}</option>`).join("");
    if (value) select.value = value;
  }
}

function renderAll():void {
  if (!report) return;
  renderKpis();
  renderPipeline();
  renderQuality();
  renderAttention();
  renderMis();
  renderCases();
  renderHistory();
  $("#generated-at").textContent = `Generated ${new Date(report.generatedAt).toLocaleString("en-IN")} from the reporting API`;
}

function renderKpis():void {
  const s = report!.summary;
  const items = [
    ["Open cases", s.open, "Active workload", ""],
    ["Closed cases", s.closed, "Account opened", "good"],
    ["RFT", `${s.rftPercent}%`, `${s.rft} RFT / ${s.nrft} NRFT`, "good"],
    ["Avg net TAT", `${s.averageNetTat}d`, `Gross ${s.averageGrossTat}d`, ""],
    ["SLA breaches", s.slaBreaches, `Above ${meta.slaDays} working days`, s.slaBreaches ? "bad" : "good"],
    ["Exceptions", s.rejected + s.cancelled, `${s.rejected} rejected, ${s.cancelled} cancelled`, "bad"],
  ];
  $("#kpis").innerHTML = items.map(([label,value,note,cls]) =>
    `<div class="kpi ${cls}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`
  ).join("");
}

function renderPipeline():void {
  const max = Math.max(1, ...report!.pipeline.map(item => item.count));
  $("#pipeline").innerHTML = report!.pipeline.map(item =>
    `<div class="pipeline-row">
      <span>${item.stage}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${item.count / max * 100}%"></div></div>
      <strong>${item.count}</strong>
      <small>${item.averageAging}d avg</small>
    </div>`
  ).join("");
}

function renderQuality():void {
  const s = report!.summary;
  $("#quality-summary").innerHTML = `
    <div class="quality-meter"><div><strong>${s.rftPercent}%</strong><span>Right first time</span></div><div class="meter"><i style="width:${s.rftPercent}%"></i></div></div>
    <div class="quality-grid">
      <div><span>NRFT rate</span><strong>${s.nrftPercent}%</strong></div>
      <div><span>On hold</span><strong>${s.onHold}</strong></div>
      <div><span>Rejected</span><strong>${s.rejected}</strong></div>
      <div><span>Cancelled</span><strong>${s.cancelled}</strong></div>
    </div>
    <p class="report-note">Rejected and cancelled cases are shown here but excluded from final RFT and average TAT.</p>`;
}

function renderAttention():void {
  const finished = new Set(["Account Opened","Communication Sent - Case Closed","Rejected","Cancelled by Client"]);
  const rows = report!.cases.filter(row => !finished.has(String(row.status)) && (Boolean(row.slaBreach) || row.status === "On Hold")).slice(0, 10);
  $("#attention-table").innerHTML = rows.length ? rows.map(row =>
    `<tr><td><strong>${escapeHtml(row.referenceId)}</strong></td><td>${escapeHtml(row.clientName)}</td>
      <td>${escapeHtml(row.location)}</td><td>${escapeHtml(row.cseName || "Unassigned")}</td>
      <td>${escapeHtml(row.stage)}</td><td><strong class="${row.slaBreach ? "danger-text" : ""}">${row.netTat}d</strong></td>
      <td>${escapeHtml(row.owner)}</td><td>${statusBadge(row.status)}</td></tr>`
  ).join("") : emptyRow(8, "No cases currently require attention.");
}

function renderMis():void {
  const labels:Record<string,string> = {cseName:"CSE", location:"Location", segment:"Vertical / Segment"};
  $("#dimension-heading").textContent = labels[dimension];
  $("#mis-table").innerHTML = report!.groups.length ? report!.groups.map(row =>
    `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td>${row.total}</td><td>${row.open}</td><td>${row.closed}</td>
      <td>${row.rft}</td><td>${row.nrft}</td><td><strong>${row.rftPercent}%</strong></td>
      <td>${row.averageNetTat}d</td><td>${row.slaBreaches}</td><td>${row.exceptions}</td></tr>`
  ).join("") : emptyRow(10, "No MIS data for the selected period.");
}

function renderCases():void {
  const query = (($("#search-input") as HTMLInputElement)?.value || "").toLowerCase();
  const status = ($("#status-filter") as HTMLSelectElement)?.value || "";
  const derived = new Map((report?.cases || []).map(row => [String(row.caseId), row]));
  const rows = caseRows.filter(row =>
    (!query || Object.values(row).join(" ").toLowerCase().includes(query)) &&
    (!status || row.status === status)
  );
  $("#case-table").innerHTML = rows.length ? rows.map(row => {
    const metrics = derived.get(String(row.caseId)) || row;
    return `<tr><td><strong>${escapeHtml(row.referenceId)}</strong><small class="subline">${escapeHtml(row.entryType)}</small></td>
      <td>${escapeHtml(row.clientName)}</td><td>${escapeHtml(metrics.panMasked || "Protected")}</td>
      <td>${formatDate(row.inwardDate)}</td><td>${escapeHtml(row.stage)}</td><td>${statusBadge(row.status)}</td>
      <td>${metrics.queryCount ?? "-"}</td><td>${metrics.queryHoldDays ?? "-"}d</td>
      <td><span class="rft ${metrics.rft === "RFT" ? "yes" : "no"}">${escapeHtml(metrics.rft || "-")}</span></td>
      <td>${metrics.netTat ?? "-"}d</td><td>${currentUser?.role === "viewer" ? "" : `<button class="text-btn edit-case" data-id="${row.id}">${["cse","mofsl"].includes(currentUser?.role || "") ? "Add update" : "Edit"}</button>`}</td></tr>`;
  }).join("") : emptyRow(11, "No matching operational entries.");
}

function renderHistory():void {
  $("#history-table").innerHTML = historyRows.length ? historyRows.map(row =>
    `<tr><td>${new Date(String(row.timestamp)).toLocaleString("en-IN")}</td><td><strong>${escapeHtml(row.referenceId)}</strong></td>
      <td>${escapeHtml(row.previous || "-")}</td><td>${statusBadge(row.status)}</td><td>${escapeHtml(row.stage)}</td>
      <td>${escapeHtml(row.changedBy)}</td><td>${escapeHtml(row.owner)}</td><td class="notes-cell">${escapeHtml(row.notes)}</td></tr>`
  ).join("") : emptyRow(8, "No status changes recorded.");
}

function emptyRow(columns:number, message:string):string {
  return `<tr><td colspan="${columns}"><div class="empty-state">${message}</div></td></tr>`;
}

function formPayload():Record<string,string> {
  return Object.fromEntries(new FormData($("#case-form") as HTMLFormElement).entries()) as Record<string,string>;
}

function validateFrontEnd(payload:Record<string,string>, context:ValidationContext = {}):string[] {
  const errors:string[] = [];
  const required:Record<string,string> = {requestId:"Request ID",clientName:"Client name",pan:"PAN No",inwardDate:"Inward date",status:"Latest status"};
  Object.entries(required).forEach(([key,label]) => { if (!payload[key]?.trim()) errors.push(`${label} is required`); });
  if (payload.entryType !== "New" && !payload.referenceId?.trim()) errors.push("Reference ID is required for related entries");
  if (payload.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(payload.pan)) errors.push("PAN No must use the standard PAN format");
  if (!entryTypes.has(payload.entryType)) errors.push("Entry type is invalid");
  if (!accountTypes.has(payload.accountType)) errors.push("Account type is invalid");
  if (!channels.has(payload.channel)) errors.push("Channel is invalid");
  if (!owners.has(payload.owner)) errors.push("Current owner is invalid");
  if (payload.status && !meta.statuses.some(item => item.status === payload.status)) errors.push("Latest status is not in the Status Master");
  if (payload.location && !meta.locations.includes(payload.location)) errors.push("Location is not in the Location Master");
  if (payload.segment && !meta.segments.includes(payload.segment)) errors.push("Segment is not in the Segment Master");
  if (payload.accountOpeningDate && payload.inwardDate && payload.accountOpeningDate < payload.inwardDate) errors.push("Account opening date cannot precede inward date");
  if (["Account Opened","Communication Sent - Case Closed"].includes(payload.status) && (!payload.accountNumber || !payload.accountOpeningDate)) errors.push("A closed case requires account number and account opening date");
  if (queryStatuses.has(payload.status) && !payload.queryDetails?.trim()) errors.push("Query / event details are required for query or discrepancy statuses");
  if (payload.status === "Physical Form Submitted to CSE" && payload.channel !== "Physical") errors.push("Physical form submission requires the Physical channel");
  if (payload.status === "Digital Form Sent to Client" && payload.channel !== "Digital") errors.push("Digital form submission requires the Digital channel");
  const reference = payload.referenceId?.trim().toLowerCase();
  if (reference && payload.entryType !== "New" && !context.knownReferences?.has(reference)) {
    errors.push("Create the original case before adding a related entry");
  }
  return errors;
}

function showFormErrors(errors:string[]):void {
  const box = $("#form-errors") as HTMLElement;
  box.hidden = errors.length === 0;
  box.innerHTML = errors.map(error => `<div>${escapeHtml(error)}</div>`).join("");
}

function syncReferenceField():void {
  const form = $("#case-form") as HTMLFormElement;
  const reference = form.elements.namedItem("referenceId") as HTMLInputElement;
  const isNew = (form.elements.namedItem("entryType") as HTMLSelectElement).value === "New";
  reference.readOnly = referenceLocked || isNew;
  reference.required = !isNew;
  reference.placeholder = isNew ? "Generated when saved" : "Existing Reference ID";
  if (isNew && !referenceLocked) reference.value = "";
}

function resetForm():void {
  const form = $("#case-form") as HTMLFormElement;
  form.reset();
  referenceLocked = false;
  $("#form-title").textContent = "New operational entry";
  editingId = null;
  syncReferenceField();
  showFormErrors([]);
  if (currentUser?.role === "cse") {
    (form.elements.namedItem("cseName") as HTMLInputElement).value = currentUser.displayName;
  }
}

function editCase(id:number):void {
  const row = caseRows.find(item => Number(item.id) === id);
  if (!row) return;
  const form = $("#case-form") as HTMLFormElement;
  Object.entries(row).forEach(([key,value]) => {
    const control = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | null;
    if (control) control.value = String(value ?? "");
  });
  referenceLocked = true;
  (form.elements.namedItem("referenceId") as HTMLInputElement).readOnly = true;
  if (currentUser && ["cse","mofsl"].includes(currentUser.role)) {
    editingId = null;
    const entryType = form.elements.namedItem("entryType") as HTMLSelectElement;
    entryType.value = currentUser.role === "mofsl" ? "Modification" : "Resubmission";
    $("#form-title").textContent = `Add update for ${row.referenceId}`;
  } else {
    editingId = id;
    $("#form-title").textContent = `Edit ${row.referenceId} / ${row.requestId}`;
  }
  syncReferenceField();
  showView("entry");
  window.scrollTo({top:0, behavior:"smooth"});
}

async function saveForm(event:SubmitEvent):Promise<void> {
  event.preventDefault();
  const payload = applyAutomaticDates(formPayload());
  const errors = validateFrontEnd(payload, {
    knownReferences:new Set(caseRows.map(row => String(row.referenceId).trim().toLowerCase())),
  });
  showFormErrors(errors);
  if (errors.length) return;
  const button = $("#save-case") as HTMLButtonElement;
  const wasEditing = editingId !== null;
  button.disabled = true;
  try {
    const saved = await api<CaseRow>(editingId ? `/api/cases/${editingId}` : "/api/cases", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    resetForm();
    await loadAll();
    showView("cases");
    toast(wasEditing ? "Entry updated" : `Entry saved · ${saved.referenceId}`);
  } catch (error) {
    showFormErrors([(error as Error).message]);
  } finally {
    button.disabled = false;
  }
}

function parseCsvLine(line:string):string[] {
  const values:string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(text:string):ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines.shift()!).map(value => value.trim().toLowerCase().replace(/\s+/g, ""));
  const knownReferences = new Set(caseRows.map(row => String(row.referenceId).trim().toLowerCase()));
  return lines.map(line => {
    const values = parseCsvLine(line);
    const raw:Record<string,string> = {};
    headers.forEach((header,index) => raw[header] = (values[index] || "").trim());
    const row = {
      referenceId:raw.referenceid || "", requestId:raw.requestid || "", entryType:raw.entrytype || "New",
      clientName:raw.clientname || "", pan:raw.panno || raw.pan || "", accountType:raw.accounttype || "Individual",
      channel:raw.channel || "Physical", location:raw.location || meta.locations[0], segment:raw.segment || meta.segments[0],
      rmName:raw.rmname || "", cseName:raw.csename || "", processorName:raw.processorname || "",
      owner:raw.owner || "Operations", inwardDate:raw.inwarddate || "", outwardDate:raw.outwarddate || "",
      resubmissionDate:raw.resubmissiondate || "", signedFormDate:raw.signedformdate || "",
      submittedDate:raw.submittedtomofsldate || "", accountOpeningDate:raw.accountopeningdate || "",
      accountNumber:raw.accountnumber || "", status:raw.lateststatus || raw.status || "",
      queryDetails:raw.querydetails || "", remarks:raw.remarks || "",
    };
    const errors = validateFrontEnd(row, {knownReferences});
    return {...row, valid:errors.length === 0, error:errors.join(" | ")} as ImportRow;
  });
}

function previewImport(rows:ImportRow[]):void {
  importRows = rows;
  const valid = rows.filter(row => row.valid).length;
  $("#validation-count").textContent = `${valid} valid of ${rows.length} rows`;
  $("#validation-results").innerHTML = rows.length ? `<div class="validation-list">${rows.map(row =>
    `<div class="validation-row ${row.valid ? "valid" : "invalid"}"><strong>${escapeHtml(row.referenceId || row.requestId || row.clientName || "Unidentified row")}</strong><span>${row.valid ? "Ready to import" : escapeHtml(row.error)}</span></div>`
  ).join("")}</div>` : "No rows found.";
  ($("#import-valid") as HTMLButtonElement).disabled = valid === 0;
}

async function importValid():Promise<void> {
  const button = $("#import-valid") as HTMLButtonElement;
  button.disabled = true;
  let imported = 0;
  const failures:string[] = [];
  for (const row of importRows.filter(item => item.valid)) {
    const {valid:_valid, error:_error, ...payload} = row;
    try {
      await api("/api/cases", {method:"POST", body:JSON.stringify(payload)});
      imported += 1;
    } catch (error) {
      failures.push(`${row.referenceId || row.requestId || row.clientName}: ${(error as Error).message}`);
    }
  }
  await loadAll();
  toast(`${imported} rows imported${failures.length ? `, ${failures.length} rejected by API` : ""}`);
  previewImport([]);
  if (failures.length) $("#validation-results").innerHTML = failures.map(escapeHtml).join("<br>");
}

async function login(event:SubmitEvent):Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    currentUser = await api<User>("/api/auth/login", {method:"POST", body:JSON.stringify(payload)});
    applyRoleUi();
    resetForm();
    await loadAll();
    showView("dashboard");
    form.reset();
  } catch (error) {
    showLogin((error as Error).message);
  }
}

async function logout():Promise<void> {
  try {
    await api("/api/auth/logout", {method:"POST", body:"{}"});
  } finally {
    showLogin();
  }
}

async function loadUsers():Promise<void> {
  if (currentUser?.role !== "admin") return;
  try {
    const users = await api<CaseRow[]>("/api/users");
    $("#users-table").innerHTML = users.map(user =>
      `<tr><td><strong>${escapeHtml(user.username)}</strong></td><td>${escapeHtml(user.displayName)}</td>
       <td><span class="role-badge">${escapeHtml(user.role)}</span></td><td>${user.isActive ? "Active" : "Disabled"}</td>
       <td>${formatDate(String(user.createdAt).slice(0,10))}</td></tr>`
    ).join("");
  } catch (error) {
    toast((error as Error).message);
  }
}

async function createUserFromForm(event:SubmitEvent):Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const errorBox = $("#user-errors") as HTMLElement;
  try {
    await api("/api/users", {method:"POST", body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
    form.reset();
    errorBox.hidden = true;
    await loadUsers();
    toast("User created");
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = (error as Error).message;
  }
}

async function bootstrap():Promise<void> {
  try {
    currentUser = await api<User>("/api/auth/me");
    applyRoleUi();
    resetForm();
    await loadAll();
  } catch {
    showLogin();
  }
}

$$("[data-view]").forEach(button => button.addEventListener("click", () => showView((button as HTMLElement).dataset.view!)));
$("#login-form").addEventListener("submit", event => login(event as SubmitEvent));
$("#logout-btn").addEventListener("click", logout);
$("#user-form").addEventListener("submit", event => createUserFromForm(event as SubmitEvent));
$("#refresh-btn").addEventListener("click", () => loadAll(true));
$("#apply-filters").addEventListener("click", () => loadAll(true));
$("#clear-filters").addEventListener("click", () => {
  ($("#filter-start") as HTMLInputElement).value = "";
  ($("#filter-end") as HTMLInputElement).value = "";
  loadAll(true);
});
$$("[data-dimension]").forEach(button => button.addEventListener("click", async () => {
  dimension = (button as HTMLElement).dataset.dimension!;
  $$("[data-dimension]").forEach(item => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  await loadAll();
}));
$("#search-input").addEventListener("input", renderCases);
$("#status-filter").addEventListener("change", renderCases);
$("#case-table").addEventListener("click", event => {
  const button = (event.target as Element).closest(".edit-case") as HTMLElement | null;
  if (button) editCase(Number(button.dataset.id));
});
$("#case-form").addEventListener("submit", event => saveForm(event as SubmitEvent));
((($("#case-form") as HTMLFormElement).elements.namedItem("entryType")) as HTMLSelectElement).addEventListener("change", syncReferenceField);
$("#clear-form").addEventListener("click", resetForm);
$("#choose-file").addEventListener("click", () => ($("#csv-input") as HTMLInputElement).click());
$("#csv-input").addEventListener("change", event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => previewImport(parseCsv(String(reader.result)));
  reader.readAsText(file);
});
$("#import-valid").addEventListener("click", importValid);
$("#download-template").addEventListener("click", () => {
  const content = "Reference ID,Request ID,Entry Type,Client Name,PAN No,Account Type,Channel,Location,Segment,CSE Name,Processor Name,Owner,Inward Date,Latest Status\n,REQ-201,New,Example Client,ABCDE1234F,Individual,Physical,Mumbai,Retail,CSE A,Ops A,Operations,2026-07-29,Request Received from CSE\n";
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], {type:"text/csv"}));
  anchor.download = "client-onboarding-upload-template.csv";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
});

bootstrap();
