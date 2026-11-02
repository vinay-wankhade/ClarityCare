# 🩺 Clarity Care

**Healthcare Discharge Note → Patient Instruction Sheet Converter**

Converts raw, shorthand-heavy clinician discharge notes into clear, 6th-grade reading level patient instruction sheets. A nurse must verify the output before it can be exported as PDF.

## Core Guarantees
- **Zero omission** — every medication, dosage, and number from the source note is accounted for
- **Zero hallucination** — nothing is invented; missing details get the placeholder `[Ask Your Nurse: Missing Detail]`
- **Deterministic guardrails** — regex-based cross-validation of all numeric values

## Quick Start

```bash
# 1. Clone & navigate
cd clarity-care

# 2. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Set up environment
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# Edit .env and add your GEMINI_API_KEY

# 5. Run
python -m uvicorn backend.app.main:app --reload
```

Open **http://localhost:8000** in your browser.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI |
| Frontend | HTML / CSS / JS (no build step) |
| AI | Google Gemini API (structured JSON output, temperature 0.0) |
| Database | Supabase PostgreSQL (with SQLite fallback) |
| PDF Export | ReportLab |

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/records` | Submit raw note → AI pipeline → save |
| `GET` | `/api/records/{id}` | Fetch record + instructions + audit |
| `PATCH` | `/api/audit/{item_id}` | Nurse verifies an audit item |
| `POST` | `/api/records/{id}/verify` | Mark record as verified |
| `GET` | `/api/records/{id}/export` | Download PDF |

## Status Flow
```
pending → needs_review → verified → exported
```

## Running Tests
```bash
pytest tests/ -v
```
