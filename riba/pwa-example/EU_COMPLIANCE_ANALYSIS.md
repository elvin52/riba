# EU 2023/2842 Digitalna Sljedivost - Analiza Usklađenosti i Plan Razvoja

## 📋 **ANALIZA TRENUTNOG SUSTAVA**

### ✅ **ŠTO JE IMPLEMENTIRANO (COMPLIANCE POSTIGNUTO)**

| Zahtjev EU Uredbe | Status | Implementacija |
|---|---|---|
| Jedinstveni identifikacijski broj LOT-a | ✅ **GOTOVO** | `HRVLOG1234567890123-DNT-20260107` |
| FAO troslovna oznaka vrste | ✅ **GOTOVO** | Službeni FAO kodovi (DNT, ne DEC) |
| Znanstveni naziv vrste | ✅ **GOTOVO** | `Dentex dentex` |
| Datum ulova (DD/MM/YYYY) | ✅ **GOTOVO** | `07/01/2026` |
| Kategorija ribolovnog alata | ✅ **GOTOVO** | FAO/EU kategorije (GNS, LLS, itd.) |
| Neto količina (kg) | ✅ **GOTOVO** | `5.0 kg` |
| CFR broj plovila | ✅ **GOTOVO** | `HRV123456789012` |
| Broj očevidnika | ✅ **GOTOVO** | `HRVLOG1234567890123` |
| Količina ispod min. veličine | ✅ **GOTOVO** | Boolean + količina |
| Digitalna pohrana | ✅ **GOTOVO** | localStorage + IndexedDB |
| Osnovni elektronski export | ✅ **GOTOVO** | CSV, JSON |
| Offline-first pristup | ✅ **GOTOVO** | Neovisno o internetu |

### ❌ **KRITIČNI NEDOSTACI ZA PUNU EU USKLAĐENOST**

#### **1. PODRUČJE PROIZVODNJE (VISOKI PRIORITET)**
- **Problem:** Hardkodiran `FAO zone: "37.2.1"`
- **EU Zahtjev:** Točno područje proizvodnje (FAO zona ili HR uzgoj)
- **Rješenje:** Dinamički odabir FAO podzona

#### **2. KOLIČINA U BROJEVIMA JEDINKI (VISOKI PRIORITET)**
- **Problem:** Samo kg podrška
- **EU Zahtjev:** `"u kilogramima neto mase ili prema potrebi, broju jedinki"`
- **Rješenje:** Dual input - kg ili broj komada

#### **3. XML EXPORT ZA VLASTI (VISOKI PRIORITET)**
- **Problem:** Samo CSV/JSON export
- **EU Zahtjev:** `"elektroničkih datoteka (PDF, XML, CSV)"`
- **Rješenje:** XML struktura za vlasti

#### **4. KOMBINIRANJE LOT-OVA <30KG (VISOKI PRIORITET)**
- **Problem:** 1 LOT = 1 vrsta
- **EU Izuzeće:** `"proizvodi... čija je ukupna količina manja od 30 kg i sastoje se od nekoliko vrsta"`
- **Rješenje:** Multi-species LOT podrška

#### **5. DISTRIBUCIJSKI LANAC (SREDNJI PRIORITET)**
- **Problem:** Samo početni LOT
- **EU Zahtjev:** `"pratiti proizvod sve do maloprodaje ili krajnjeg korisnika"`
- **Rješenje:** Chain-of-custody sustav

---

## 🎯 **PLAN RAZVOJA - PRIORITIZIRANE FAZE**

### **FAZA 1: KRITIČNA USKLAĐENOST (2-3 tjedna)**

#### **1.1 Dinamičko Područje Proizvodnje**
```typescript
// Nova struktura
production_area: {
    type: "FAO_ZONE" | "AQUACULTURE_LOCATION",
    fao_zone: "37.2.1" | "37.2.2" | "37.1.3", // Jadran podzone
    aquaculture_location: "HR-001-SPLIT", // Za uzgoj
    description: "Jadransko more - srednji dio"
}
```

**Implementacija:**
- UI za odabir FAO podzona (37.2.1, 37.2.2, 37.1.1, 37.1.2, 37.1.3)
- Podrška za označavanje lokacije akvakulture (budućnost)
- Validacija da zona odgovara hrvatskim vodama

#### **1.2 Dual Quantity System**
```typescript
// Proširena količina
quantity: {
    net_weight_kg: number | null,     // Postojeće
    unit_count: number | null,        // NOVO - broj jedinki
    quantity_type: "WEIGHT" | "UNITS", // NOVO - tip mjerenja
    undersized_weight_kg?: number,   // Postojeće
    undersized_unit_count?: number   // NOVO - broj ispod min.
}
```

**Implementacija:**
- UI toggle: "Kilograma" vs "Broj jedinki"
- Validacija da je jedan od dva unesen
- Export prilagođen dual sistemu

#### **1.3 XML Export za Vlasti**
```xml
<!-- Nova XML struktura -->
<fisheries_lot xmlns="http://hr.gov.minpo.ribarstvo/2026">
    <lot_id>HRVLOG1234567890123-DNT-20260107</lot_id>
    <species>
        <fao_code>DNT</fao_code>
        <scientific_name>Dentex dentex</scientific_name>
    </species>
    <production_area>
        <fao_zone>37.2.1</fao_zone>
        <description>Jadransko more</description>
    </production_area>
    <catch_info>
        <date>2026-01-07</date>
        <gear_category>GNS</gear_category>
    </catch_info>
    <!-- ... -->
</fisheries_lot>
```

#### **1.4 Multi-Species LOT <30kg**
```typescript
// Nova struktura za kombinirani LOT
combined_lot: {
    is_combined: boolean,
    total_weight_kg: number, // Mora biti <30kg
    species_breakdown: Array<{
        species: SpeciesInfo,
        weight_kg?: number,
        unit_count?: number,
        undersized_present: boolean
    }>,
    production_area: ProductionArea, // Isto područje
    vessel: VesselInfo, // Isto plovilo  
    catch_date: Date // Isti dan
}
```

### **FAZA 2: DODATNE FUNKCIONALNOSTI (3-4 tjedna)**

#### **2.1 Tržišni Standardi**
- Dodavanje polja za tržišne standarde (veličina, klasa, itd.)
- UI za odabir standarda ovisno o vrsti
- Validacija usklađenosti sa standardima

#### **2.2 Distribucijski Lanac**
- QR kod za praćenje LOT-a kroz lanac
- Sustav za predaju LOT-a sljedećem subjektu
- Elektronska razmjena s kupcima

#### **2.3 Logika Izuzeća**
- Automatska detekcija malih količina (<10kg)
- UI napomena o izuzećima
- Opcijska aktivacija izuzeća

### **FAZA 3: PROŠIRENJA (2-3 mjeseca)**

#### **3.1 Aquaculture Support**
- Podrška za uzgajališta (lokacijski kodovi)
- Datum izlova vs datum ulova
- Specifični podaci za akvakulture

#### **3.2 Elektronska Razmjena**
- Email automatizacija za slanje LOT podataka
- API za integraciju s trgovcima
- Web portal za vlasti

---

## 🚨 **RIZICI I OGRANIČENJA**

### **Visoki Rizik:**
1. **Složenost Multi-Species LOT-a** - Može potkopati jednostavnost
2. **XML Standard** - Nema službenih shema od MINPOa
3. **Validacija FAO zona** - Trebaju točne granice
4. **Distribucijski lanac** - Složen sustav izvan dosega MVP-a

### **Ograničenja:**
1. **Offline-first pristup** - Otežava real-time razmjenu
2. **PWA arhitektura** - Možda treba native app za napredne funkcije
3. **Podatkovni model** - Značajne promjene postojeće strukture

---

## 📊 **IMPLEMENTACIJSKI PRISTUP**

### **Strategija Kompatibilnosti:**
1. **Postojeći single-species LOT** - Ostaje kao glavna funkcionalnost
2. **Multi-species kao dodatan mod** - Opt-in funkcionalnost  
3. **Postupni prelazak** - Korisnici mogu birati pristup

### **Tehničke Smjernice:**
```javascript
// Proširena arhitektura
window.lotManager = {
    // Postojeće
    generateLOTIdentifier(),
    createTraceabilityRecord(),
    
    // NOVO - Multi-species
    generateCombinedLOT(),
    createCombinedTraceabilityRecord(),
    validateCombinedLOT(),
    
    // NOVO - Export formati
    exportToXML(),
    exportForAuthorities(),
    exportForDistribution()
}
```

### **Migracijski Plan:**
1. **Faza 1:** Dodavanje novih funkcionalnosti bez mijenjanja postojećih
2. **Faza 2:** Postupno prebacivanje na prošireni model
3. **Faza 3:** Deprecation starih metoda (6+ mjeseci)

---

## 🎯 **PRIORITETI ZA SLJEDEĆIH 30 DANA**

| Prioritet | Zadatak | Vrijeme | Compliance Impact |
|---|---|---|---|
| 🔴 **P0** | FAO zona odabir | 5 dana | **Kritični** |
| 🔴 **P0** | Dual quantity (kg/units) | 3 dana | **Kritični** |
| 🟠 **P1** | XML export | 7 dana | **Visoki** |
| 🟠 **P1** | Multi-species LOT | 10 dana | **Visoki** |
| 🟡 **P2** | Tržišni standardi | 5 dana | **Srednji** |

### **Prvi Korak - FAO Zona Odabir:**
```javascript
// Implementacija FAO podzona za Hrvatsku
const CROATIAN_FAO_ZONES = {
    "37.2.1": "Jadransko more - srednji dio",
    "37.2.2": "Jadransko more - južni dio", 
    "37.1.1": "Jadransko more - sjeverni dio",
    "37.1.3": "Kvarnerski zaljev"
};
```

**Ovaj plan osigurava punu EU usklađenost uz zadržavanje jednostavnosti postojeće aplikacije.**
