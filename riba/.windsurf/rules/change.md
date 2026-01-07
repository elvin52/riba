---
trigger: always_on
---

CONTEXT

The app is used by professional fishermen (ribarstvo), not aquaculture.

Current problems:

LOT numbers contain hardcoded or incorrect FAO species codes

CFR and logbook numbers are implicitly embedded or missing

LOT structure is overcomplicated and non-compliant

Users must re-enter vessel data every time

Fishing gear is incorrectly handled as free text

REQUIRED CHANGES
1. INPUT CONFIGURATION (ONE-TIME SETUP)

Implement a persistent vessel configuration that is entered once and reused automatically:

CFR number of the vessel (MANDATORY, explicit field)

Vessel registration mark

Logbook number (format: HRVLOG + 13 digits)

Fishing gear category (FAO / EU category, NOT free text)

This data must be:

Stored locally (or user profile)

Automatically attached to every LOT record

Editable, but NOT required on every entry

2. LOT NUMBER LOGIC (CRITICAL)

Change LOT generation rules as follows:

LOT number must be simple and human-readable

LOT number does NOT have to contain all data

LOT number must be unique per vessel per day

Allowed LOT patterns (examples):

{LOGBOOK_NUMBER}-{FAO_SPECIES}

{LOGBOOK_NUMBER}-{FAO_SPECIES}-{DATE}

User-defined LOT string (manual override allowed)

Explicit rules:

DO NOT hardcode any FAO species code

FAO species code used in LOT MUST match the selected species

LOT must NEVER contradict the species metadata

Sequence counters are OPTIONAL and must be disableable

LOT ≠ full traceability record
LOT is only an identifier. Full data lives in the record.

3. TRACEABILITY RECORD (SEPARATE FROM LOT)

Each LOT record must explicitly store (as structured fields):

LOT identifier

FAO 3-alpha species code + scientific name

FAO fishing zone (e.g. 37.2.1)

Catch date (DD/MM/YYYY) — time optional, not required

Net quantity (kg or units)

CFR number (explicit field, not parsed from LOT)

Logbook number (explicit field)

Fishing gear category

Undersized catch present (boolean)

If undersized = true → quantity of undersized catch

DO NOT infer data by parsing the LOT string.

4. VALIDATION RULES

Implement strict validation:

Species FAO code must match selected species

LOT must not contain a different FAO code than the species

CFR and logbook must exist before LOT creation

Gear must be from predefined category list

If undersized = false → no undersized quantity allowed

5. OUTPUT

The system must be able to export the traceability record as:

Human-readable summary (for display)

Structured data (JSON / CSV) suitable for PDF or email export

IMPORTANT

Do NOT integrate with government systems

Do NOT assume Google Play or mobile-only

Offline-first logic is preferred

Simplicity > automation

Deliver:

Updated data model (fields + types)

LOT generation function (pseudocode or code)

Validation rules

Example of a correct LOT + record output