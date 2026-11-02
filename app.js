/* ═══════════════════════════════════════════════════════════
   Clarity Care – Frontend Application Logic
   ═══════════════════════════════════════════════════════════ */

(() => {
    "use strict";

    // ── State ─────────────────────────────────────────────
    let currentRecordId = null;
    let currentStatus = null;
    let auditItems = [];
    let guardrailAcknowledged = false;

    // ── DOM References ────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elPatientRef = $("#patient-ref");
    const elRawNote = $("#raw-note");
    const elCharCount = $("#char-count");
    const elBtnProcess = $("#btn-process");
    const elBtnLoader = $("#btn-loader");
    const elBtnSample = $("#btn-sample");
    const elInputPanel = $("#input-panel");
    const elResultsPanel = $("#results-panel");
    const elRecordId = $("#record-id-display");
    const elStatusBadge = $("#status-badge");
    const elGuardrailBanner = $("#guardrail-banner");
    const elGuardrailMessage = $("#guardrail-message");
    const elGuardrailList = $("#guardrail-list");
    const elBtnAckGuardrail = $("#btn-ack-guardrail");
    const elAuditCount = $("#audit-count");
    const elPatientInstructions = $("#patient-instructions");
    const elExtractedDataView = $("#extracted-data-view");
    const elAuditList = $("#audit-list");
    const elBtnVerify = $("#btn-verify");
    const elBtnExport = $("#btn-export");
    const elBtnNew = $("#btn-new");
    const elNavStatus = $("#nav-status");
    const elToastContainer = $("#toast-container");

    // ── Sample Discharge Note ─────────────────────────────
    const SAMPLE_NOTE = `Pt: 64yo M w/ PMH HTN, DM2, CKD3, admitted for CHF exacerbation.

Dx: Acute decompensated CHF (EF 35%). Volume overload, BNP 1840.

MEDS:
- START Furosemide (Lasix) 40mg PO BID — new for fluid management
- START KCl 20mEq PO daily — to replace potassium lost with diuretic
- CHANGE Metoprolol succinate 50mg PO QD (was 25mg) — uptitrated for rate control
- CONTINUE Lisinopril 10mg PO QD
- CONTINUE Atorvastatin 40mg PO QHS
- CONTINUE Metformin 1000mg PO BID
- HOLD Amlodipine 5mg — hold until f/u with cardiology, BP currently well-controlled

DAILY CARE:
- Weigh yourself every morning before eating, same scale
- Fluid restriction: 1.5L/day maximum
- Low sodium diet: <2g Na/day
- Record daily weights and bring log to follow-up
- Elevate legs when sitting

FOLLOW-UP:
- Cardiology f/u in 5-7 days — call to schedule
- PCP visit within 2 weeks
- BMP + BNP labs in 3 days
- Repeat echo in 4-6 weeks

WARNING SIGNS:
Call doctor if: weight gain >3lbs in 1 day or >5lbs in 1 week, increased swelling in legs/ankles, new or worsening cough, dizziness
ER immediately if: SOB at rest or worsening SOB, CP, fainting, HR >120 bpm or <50 bpm`;

    // ── Utilities ─────────────────────────────────────────

    function setNavStatus(text, type = "ready") {
        const dot = elNavStatus.querySelector(".status-dot");
        const label = elNavStatus.querySelector(".status-text");
        label.textContent = text;
        dot.style.background =
            type === "processing" ? "var(--accent-amber)" :
            type === "error" ? "var(--accent-red)" :
            "var(--accent-green)";
    }

    function showToast(message, type = "info") {
        const icons = { success: "✅", error: "❌", info: "ℹ️" };
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
        elToastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = "toastOut 0.25s ease forwards";
            setTimeout(() => toast.remove(), 260);
        }, 4000);
    }

    function setLoading(loading) {
        if (loading) {
            elBtnProcess.classList.add("loading");
            elBtnProcess.disabled = true;
            setNavStatus("Processing…", "processing");
        } else {
            elBtnProcess.classList.remove("loading");
            elBtnProcess.disabled = false;
            setNavStatus("Ready");
        }
    }

    function updateStatusBadge(status) {
        currentStatus = status;
        elStatusBadge.textContent = status.replace("_", " ");
        elStatusBadge.className = `status-badge ${status}`;

        // Update button states
        elBtnVerify.disabled = status !== "needs_review";
        elBtnExport.disabled = status !== "verified" && status !== "exported";
    }

    // ── API Calls ─────────────────────────────────────────

    async function apiPost(url, body) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Request failed");
        }
        return res.json();
    }

    async function apiGet(url) {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Request failed");
        }
        return res.json();
    }

    async function apiPatch(url) {
        const res = await fetch(url, { method: "PATCH" });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || "Request failed");
        }
        return res.json();
    }

    // ── Render Patient View ───────────────────────────────

    function renderPatientView(data) {
        const plain = data.plain_language || data.extraction;
        if (!plain) {
            elPatientInstructions.innerHTML = `<p style="color:var(--text-muted)">No instructions generated yet.</p>`;
            return;
        }

        let html = "";

        // Diagnosis
        if (plain.diagnosis_summary) {
            html += `
            <div class="instruction-section">
                <div class="section-title"><span class="section-icon">🏥</span> What Happened</div>
                <div class="section-content"><p>${escapeHtml(plain.diagnosis_summary)}</p></div>
            </div>`;
        }

        // Medications
        const meds = plain.medications || {};
        const categories = [
            { key: "start_or_changed", label: "New or Changed Medications", cls: "start", icon: "🆕" },
            { key: "continue", label: "Continue Taking", cls: "continue", icon: "🔄" },
            { key: "hold_or_stop", label: "Medications to Hold or Stop", cls: "stop", icon: "⛔" },
        ];

        for (const cat of categories) {
            const items = meds[cat.key] || [];
            if (items.length === 0) continue;

            html += `
            <div class="instruction-section">
                <div class="section-title"><span class="section-icon">${cat.icon}</span> ${cat.label}</div>
                <span class="med-category-label ${cat.cls}">${items.length} medication${items.length !== 1 ? 's' : ''}</span>
                <table class="med-table">
                    <thead><tr>
                        <th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Notes</th>
                    </tr></thead>
                    <tbody>
                        ${items.map(m => `<tr>
                            <td><strong>${escapeHtml(m.name)}</strong></td>
                            <td>${escapeHtml(m.dose)}</td>
                            <td>${escapeHtml(m.route)}</td>
                            <td>${escapeHtml(m.frequency)}</td>
                            <td>${escapeHtml(m.notes || "—")}</td>
                        </tr>`).join("")}
                    </tbody>
                </table>
            </div>`;
        }

        // Daily Care
        const care = plain.daily_care || [];
        if (care.length > 0) {
            html += `
            <div class="instruction-section">
                <div class="section-title"><span class="section-icon">🏠</span> Daily Care</div>
                <div class="section-content">
                    ${care.map(c => `<div class="care-item"><span class="care-bullet">●</span> ${escapeHtml(c)}</div>`).join("")}
                </div>
            </div>`;
        }

        // Appointments & Labs
        const appts = plain.appointments_and_labs || [];
        if (appts.length > 0) {
            html += `
            <div class="instruction-section">
                <div class="section-title"><span class="section-icon">📅</span> Appointments & Labs</div>
                <div class="section-content">
                    ${appts.map(a => `<div class="care-item"><span class="care-bullet">●</span> ${escapeHtml(a)}</div>`).join("")}
                </div>
            </div>`;
        }

        // Warning Signs
        const warnings = plain.warning_signs || {};
        const callDoc = warnings.call_doctor || [];
        const er = warnings.emergency_room || [];

        if (callDoc.length > 0 || er.length > 0) {
            html += `<div class="instruction-section">
                <div class="section-title"><span class="section-icon">⚠️</span> Warning Signs</div>
                <div class="section-content">`;

            if (callDoc.length > 0) {
                html += `<p style="color:var(--accent-amber);font-weight:600;margin-bottom:8px;">📞 Call Your Doctor If:</p>`;
                html += callDoc.map(w => `<div class="warning-item doctor"><span class="warning-bullet">▸</span> ${escapeHtml(w)}</div>`).join("");
            }
            if (er.length > 0) {
                html += `<p style="color:var(--accent-red);font-weight:600;margin:12px 0 8px;">🚨 Go to the ER Immediately If:</p>`;
                html += er.map(w => `<div class="warning-item er"><span class="warning-bullet">▸</span> ${escapeHtml(w)}</div>`).join("");
            }

            html += `</div></div>`;
        }

        elPatientInstructions.innerHTML = html;
    }

    // ── Render Extracted Data ─────────────────────────────

    function renderExtractedData(data) {
        const extraction = data.extraction;
        if (!extraction) {
            elExtractedDataView.innerHTML = `<p style="color:var(--text-muted)">No extraction data available.</p>`;
            return;
        }

        const json = JSON.stringify(extraction, null, 2);
        const highlighted = syntaxHighlightJSON(json);
        elExtractedDataView.innerHTML = `
            <div class="json-block">
                <pre>${highlighted}</pre>
            </div>`;
    }

    function syntaxHighlightJSON(json) {
        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                let cls = "json-number";
                if (/^"/.test(match)) {
                    cls = /:$/.test(match) ? "json-key" : "json-string";
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    }

    // ── Render Audit Trail ────────────────────────────────

    function renderAuditTrail(items) {
        auditItems = items;
        const verified = items.filter(i => i.is_verified).length;
        elAuditCount.textContent = `${verified}/${items.length}`;

        if (items.length === 0) {
            elAuditList.innerHTML = `<p style="color:var(--text-muted)">No audit items.</p>`;
            return;
        }

        elAuditList.innerHTML = items.map(item => `
            <div class="audit-item ${item.is_verified ? 'verified' : ''}" data-id="${item.id}" id="audit-item-${item.id}">
                <div class="audit-checkbox">
                    <span class="audit-checkbox-icon">✓</span>
                </div>
                <div class="audit-details">
                    <div class="audit-source">${escapeHtml(item.source_entity)}</div>
                    <div class="audit-mapped">→ ${escapeHtml(item.mapped_output)}</div>
                </div>
            </div>
        `).join("");

        // Attach click handlers
        $$(".audit-item").forEach(el => {
            el.addEventListener("click", () => toggleAuditItem(parseInt(el.dataset.id)));
        });
    }

    async function toggleAuditItem(itemId) {
        try {
            const updated = await apiPatch(`/api/audit/${itemId}`);
            // Update local state
            auditItems = auditItems.map(i =>
                i.id === itemId ? { ...i, is_verified: updated.is_verified } : i
            );
            renderAuditTrail(auditItems);
            showToast(
                updated.is_verified ? "Audit item verified" : "Audit item unmarked",
                "success"
            );
        } catch (err) {
            showToast(`Failed: ${err.message}`, "error");
        }
    }

    // ── Render Guardrail Warnings ─────────────────────────

    function renderGuardrailWarnings(warnings) {
        if (!warnings || warnings.missing_values.length === 0) {
            elGuardrailBanner.classList.add("hidden");
            guardrailAcknowledged = true;
            return;
        }

        guardrailAcknowledged = false;
        elGuardrailBanner.classList.remove("hidden");
        elGuardrailMessage.textContent = warnings.message;
        elGuardrailList.innerHTML = warnings.missing_values
            .map(v => `<li>${escapeHtml(v)}</li>`)
            .join("");
        elBtnAckGuardrail.classList.remove("hidden");
        elBtnVerify.disabled = true;
    }

    // ── Full Render ───────────────────────────────────────

    function renderResult(data) {
        currentRecordId = data.id;
        elRecordId.textContent = `#${data.id}`;
        updateStatusBadge(data.status);

        renderPatientView(data);
        renderExtractedData(data);
        renderGuardrailWarnings(data.guardrail_warnings);

        // Show results panel
        elResultsPanel.classList.remove("hidden");
        elResultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ── Event Handlers ────────────────────────────────────

    // Character count
    elRawNote.addEventListener("input", () => {
        elCharCount.textContent = `${elRawNote.value.length} characters`;
    });

    // Load sample note
    elBtnSample.addEventListener("click", () => {
        elRawNote.value = SAMPLE_NOTE;
        elPatientRef.value = "PT-2024-0847";
        elCharCount.textContent = `${SAMPLE_NOTE.length} characters`;
        showToast("Sample discharge note loaded", "info");
    });

    // Process note
    elBtnProcess.addEventListener("click", async () => {
        const patientRef = elPatientRef.value.trim();
        const rawNote = elRawNote.value.trim();

        if (!patientRef) {
            showToast("Please enter a patient reference", "error");
            elPatientRef.focus();
            return;
        }
        if (rawNote.length < 10) {
            showToast("Discharge note is too short", "error");
            elRawNote.focus();
            return;
        }

        setLoading(true);

        try {
            const result = await apiPost("/api/records", {
                patient_ref: patientRef,
                raw_note: rawNote,
            });

            // Load audit items
            const audits = await apiGet(`/api/records/${result.id}/audit`);
            renderResult(result);
            renderAuditTrail(audits);

            showToast("Discharge note processed successfully!", "success");
        } catch (err) {
            showToast(`Error: ${err.message}`, "error");
            setNavStatus("Error", "error");
        } finally {
            setLoading(false);
        }
    });

    // Acknowledge guardrail
    elBtnAckGuardrail.addEventListener("click", () => {
        guardrailAcknowledged = true;
        elBtnAckGuardrail.textContent = "✓ Acknowledged";
        elBtnAckGuardrail.disabled = true;
        elBtnVerify.disabled = currentStatus !== "needs_review";
        showToast("Guardrail warning acknowledged", "info");
    });

    // Verify record
    elBtnVerify.addEventListener("click", async () => {
        if (!currentRecordId) return;

        if (!guardrailAcknowledged) {
            showToast("Please acknowledge the guardrail warning first", "error");
            return;
        }

        try {
            await apiPost(`/api/records/${currentRecordId}/verify`, {});
            updateStatusBadge("verified");
            showToast("Record verified by nurse!", "success");
        } catch (err) {
            showToast(`Cannot verify: ${err.message}`, "error");
        }
    });

    // Export PDF
    elBtnExport.addEventListener("click", async () => {
        if (!currentRecordId) return;

        try {
            const res = await fetch(`/api/records/${currentRecordId}/export`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || "Export failed");
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `clarity_care_${currentRecordId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            updateStatusBadge("exported");
            showToast("PDF exported successfully!", "success");
        } catch (err) {
            showToast(`Export failed: ${err.message}`, "error");
        }
    });

    // New note
    elBtnNew.addEventListener("click", () => {
        currentRecordId = null;
        currentStatus = null;
        auditItems = [];
        guardrailAcknowledged = false;

        elPatientRef.value = "";
        elRawNote.value = "";
        elCharCount.textContent = "0 characters";
        elResultsPanel.classList.add("hidden");
        elGuardrailBanner.classList.add("hidden");

        // Reset tabs
        $$(".tab").forEach(t => t.classList.remove("active"));
        $$(".tab-content").forEach(t => t.classList.remove("active"));
        $("#tab-patient").classList.add("active");
        $("#content-patient-view").classList.add("active");

        elInputPanel.scrollIntoView({ behavior: "smooth" });
        showToast("Ready for a new note", "info");
    });

    // Tab switching
    $$(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;

            $$(".tab").forEach(t => t.classList.remove("active"));
            $$(".tab-content").forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            $(`#content-${target}`).classList.add("active");
        });
    });

    // ── Helpers ───────────────────────────────────────────

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
})();
