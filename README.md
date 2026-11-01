# 🩺 Clarity Care

**Turn confusing doctor discharge notes into simple instructions patients can actually understand.**

![Status](https://img.shields.io/badge/status-planning-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![Backend](https://img.shields.io/badge/backend-FastAPI%20%7C%20Spring%20Boot-009688)
![Database](https://img.shields.io/badge/database-Supabase%20PostgreSQL-3ECF8E)

> 🚧 **This project is in the planning stage.** This README describes the idea and the planned design. Code is coming soon.

## The Problem

Patients leaving the hospital often forget or misunderstand jargon-heavy discharge instructions. This leads to medication errors, poor recovery, and preventable hospital readmissions.

## The Idea

Clarity Care will convert raw, shorthand-heavy clinician notes into clear, 6th-grade reading level patient instruction sheets. A nurse reviews and approves every sheet before it reaches the patient, so nothing is missed or made up.

## Planned Features

- **Structured AI output:** the LLM fills a strict JSON schema (medications split into Start, Continue, and Stop; daily care; appointments; warning signs) at temperature 0.0.
- **Shorthand translation:** terms like `BID` become "twice a day (BID)", so nurses can verify quickly.
- **Placeholders for missing info:** if a detail is not in the note, the output says `[Ask Your Nurse: Missing Detail]` instead of guessing.
- **Number check:** a backend check flags any dose or quantity (e.g. `40mg`, `1.5L`) that is dropped or changed.
- **Nurse verification:** a split-screen UI where a nurse must confirm all Hold/Stop medications before exporting the patient PDF or translating it (e.g. Hindi, Marathi).

## Planned Workflow

```
Raw Note → LLM (JSON) → Number Check → Nurse Review → Patient PDF
```

## Example (Target Behavior)

**Input**
```
Hold Lisinopril 10mg until renal panel checked. Continue Metoprolol succinate 50mg PO daily.
```

**Output**
- 🔵 **Keep taking:** Metoprolol succinate, 50 mg, by mouth (PO), once a day
- 🔴 **STOP for now:** Lisinopril, 10 mg, until your kidney blood test is checked

## Planned Tech Stack

- **Frontend:** HTML/CSS/JS or React
- **Backend:** Python (FastAPI) or Java (Spring Boot)
- **AI:** LLM API with Structured Outputs
- **Database:** PostgreSQL (Supabase) with tables `discharge_records`, `structured_instructions`, `audit_checklist`

## Getting Started

Setup instructions will be added once the first version is built.

## Roadmap

- [ ] Build the backend pipeline (LLM extraction + number check)
- [ ] Build the nurse split-screen verification UI
- [ ] Patient PDF export
- [ ] Hindi and Marathi translation
- [ ] EHR/FHIR integration
- [ ] Voice-note dictation for doctors
- [ ] WhatsApp follow-up reminders

## Disclaimer

This is a prototype idea, not a certified medical device. All generated content must be reviewed by a qualified clinician before being given to a patient.

## License

MIT
