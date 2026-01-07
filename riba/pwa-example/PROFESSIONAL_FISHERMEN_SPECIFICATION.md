# Professional Fishermen LOT System - Complete Specification

## 🎯 **UPDATED DATA MODEL**

### **1. Vessel Configuration (One-time Setup)**
```typescript
interface VesselConfiguration {
    cfr_number: string;           // MANDATORY: 3 letters + 11 digits (e.g., HRV123456789012)
    registration_mark: string;    // MANDATORY: Vessel registration mark
    logbook_number: string;       // MANDATORY: HRVLOG + 13 digits
    fishing_gear_category: string; // MANDATORY: FAO/EU category (e.g., GNS, LLS)
    vessel_name?: string;         // Optional vessel name
    created_timestamp: string;    // ISO timestamp
    updated_timestamp: string;    // ISO timestamp
}
```

### **2. Traceability Record (Separate from LOT)**
```typescript
interface TraceabilityRecord {
    // LOT identifier (simple, human-readable)
    lot_id: string;               // e.g., "HRVLOG1234567890123-DEC-20260107"
    
    // Species information
    species: {
        fao_code: string;         // 3-letter FAO code (e.g., DEC)
        scientific_name: string;  // e.g., "Dentex dentex"
        local_name: string;       // e.g., "Zubatac"
    };
    
    // Fishing information
    fishing: {
        fao_zone: string;         // e.g., "37.2.1"
        catch_date: string;       // DD/MM/YYYY format
        catch_time?: string;      // Optional HH:MM format
        fishing_gear_category: string; // FAO code (e.g., GNS)
    };
    
    // Vessel information (explicit fields, NOT parsed from LOT)
    vessel: {
        cfr_number: string;       // Full CFR number
        registration_mark: string;
        logbook_number: string;   // Full HRVLOG number
        vessel_name?: string;
    };
    
    // Quantity information
    quantity: {
        net_weight_kg: number;
        units?: number;
        undersized_catch_present: boolean;
        undersized_quantity_kg?: number; // Only if undersized_catch_present = true
    };
    
    // Metadata
    metadata: {
        created_timestamp: string;
        record_version: string;
        compliance_standard: string; // "EU_2023_2842"
    };
}
```

## 🔧 **LOT GENERATION PATTERNS**

### **Available Patterns:**
1. **SIMPLE**: `{LOGBOOK}-{FAO_SPECIES}`
2. **WITH_DATE**: `{LOGBOOK}-{FAO_SPECIES}-{DATE}`
3. **WITH_COUNTER**: `{LOGBOOK}-{FAO_SPECIES}-{COUNTER}`
4. **CUSTOM**: User-defined pattern

### **Examples:**
```javascript
// Pattern: SIMPLE
"HRVLOG1234567890123-DEC"

// Pattern: WITH_DATE  
"HRVLOG1234567890123-DEC-20260107"

// Pattern: WITH_COUNTER
"HRVLOG1234567890123-DEC-001"

// Pattern: CUSTOM
"HRVLOG1234567890123-DEC-A1-001" // User-defined
```

## ⚠️ **STRICT VALIDATION RULES**

### **Pre-LOT Generation Validation:**
```javascript
function validateLOTPrerequisites(species, vesselConfig) {
    const errors = [];
    
    // Species validation
    if (!species?.fao_code) errors.push('Species FAO code required');
    
    // Vessel validation
    if (!vesselConfig?.cfr_number) errors.push('CFR number required');
    if (!vesselConfig?.logbook_number) errors.push('Logbook number required');
    if (!/^HRVLOG\d{13}$/.test(vesselConfig.logbook_number)) {
        errors.push('Invalid logbook format (must be HRVLOG + 13 digits)');
    }
    
    return { valid: errors.length === 0, errors };
}
```

### **Traceability Record Validation:**
```javascript
function validateTraceabilityRecord(record) {
    const errors = [];
    
    // CRITICAL: LOT must contain species code
    if (!record.lot_id.includes(record.species.fao_code)) {
        errors.push(`LOT ID must contain species code ${record.species.fao_code}`);
    }
    
    // Undersized catch logic
    if (record.quantity.undersized_catch_present === true) {
        if (!record.quantity.undersized_quantity_kg) {
            errors.push('Undersized quantity required when present');
        }
        if (record.quantity.undersized_quantity_kg > record.quantity.net_weight_kg) {
            errors.push('Undersized quantity cannot exceed total');
        }
    } else if (record.quantity.undersized_catch_present === false) {
        if (record.quantity.undersized_quantity_kg > 0) {
            errors.push('Undersized quantity not allowed when false');
        }
    }
    
    return { valid: errors.length === 0, errors };
}
```

## 📊 **EXAMPLE CORRECT LOT + RECORD OUTPUT**

### **LOT Generation Process:**
```javascript
// 1. Vessel configured once
const vesselConfig = {
    cfr_number: "HRV123456789012",
    registration_mark: "ST-456-RB", 
    logbook_number: "HRVLOG1234567890123",
    fishing_gear_category: "GNS",
    vessel_name: "Adriatic Star"
};

// 2. Species selected
const species = {
    fao_code: "DEC",
    scientific_name: "Dentex dentex", 
    local_name: "Zubatac"
};

// 3. Generate LOT (simple identifier)
const lotId = "HRVLOG1234567890123-DEC-20260107";

// 4. Create complete traceability record
const record = {
    lot_id: "HRVLOG1234567890123-DEC-20260107",
    species: { fao_code: "DEC", scientific_name: "Dentex dentex", local_name: "Zubatac" },
    fishing: { fao_zone: "37.2.1", catch_date: "07/01/2026", fishing_gear_category: "GNS" },
    vessel: { cfr_number: "HRV123456789012", registration_mark: "ST-456-RB", logbook_number: "HRVLOG1234567890123" },
    quantity: { net_weight_kg: 5.0, undersized_catch_present: false, undersized_quantity_kg: null }
};
```

### **Human-Readable Output:**
```
LOT HRVLOG1234567890123-DEC-20260107
📅 Datum: 07/01/2026
🐟 Vrsta: Zubatac (DEC)
📍 Zona: 37.2.1
⚖️ Težina: 5.0 kg  
🎣 Alat: GNS
🚢 CFR: HRV123456789012
📋 Očevidnik: HRVLOG1234567890123
⚠️ Ispod min.: Ne
```

### **CSV Export:**
```csv
LOT_ID,CATCH_DATE,SPECIES_FAO,SPECIES_NAME,FAO_ZONE,NET_WEIGHT_KG,GEAR_CATEGORY,CFR_NUMBER,LOGBOOK_NUMBER,UNDERSIZED_PRESENT,UNDERSIZED_KG
HRVLOG1234567890123-DEC-20260107,07/01/2026,DEC,Zubatac,37.2.1,5.0,GNS,HRV123456789012,HRVLOG1234567890123,false,0
```

## 🏗️ **ARCHITECTURE BENEFITS**

### **✅ What's Fixed:**
- **No hardcoded species codes** - LOT uses actual selected species
- **Single source of truth** - All data in traceability record, not parsed from LOT
- **Proper validation** - Species FAO code MUST match LOT ID
- **One-time vessel setup** - No re-entering vessel data
- **FAO/EU compliant gear** - Dropdown selection, not free text
- **Boolean undersized logic** - Clear yes/no with conditional quantity
- **Structured exports** - JSON, CSV, human-readable formats

### **✅ Key Principles:**
1. **LOT ≠ Traceability Record** - LOT is just an identifier
2. **Simplicity > Automation** - Human-readable patterns
3. **Validation First** - Prevent illegal LOTs at generation time
4. **Offline-First** - No government system integration
5. **Professional Grade** - EU 2023/2842 compliant

## 🎯 **USER WORKFLOW**

### **First-Time Setup (Once):**
1. Enter CFR number (HRV123456789012)
2. Enter registration mark (ST-456-RB)
3. Enter logbook number (HRVLOG1234567890123)
4. Select gear category from dropdown (GNS)
5. Save configuration → persisted locally

### **Daily Catch Recording:**
1. Select fishing zone (A1, A2, F1, F2, etc.)
2. Select species (Zubatac - DEC)
3. Enter weight (5.0 kg)
4. Undersized catch? No/Yes + quantity if yes
5. Generate LOT → Creates complete traceability record

### **Export Options:**
- Human-readable summary (for display)
- CSV (for spreadsheet import)
- JSON (for system integration)
- PDF (visual report)

This architecture ensures **legal compliance**, **data integrity**, and **professional usability** for Croatian fishermen operating under EU regulations.
