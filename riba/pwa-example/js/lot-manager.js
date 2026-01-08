// Professional Fishermen LOT Management System
class LOTManager {
    constructor() {
        this.traceabilityRecords = new Map();
        this.lotPatterns = {
            SIMPLE: '{LOGBOOK}-{FAO_SPECIES}',
            WITH_DATE: '{LOGBOOK}-{FAO_SPECIES}-{DATE}',
            WITH_COUNTER: '{LOGBOOK}-{FAO_SPECIES}-{COUNTER}',
            CUSTOM: null // User-defined
        };
        this.currentPattern = this.lotPatterns.SIMPLE;
    }

    // Generate LOT identifier (separate from traceability record)
    generateLOTIdentifier(species, vesselConfig, options = {}) {
        const validation = this.validateLOTPrerequisites(species, vesselConfig);
        if (!validation.valid) {
            throw new Error(`LOT generation failed: ${validation.errors.join('; ')}`);
        }

        const faoCode = species.fao_code;
        const logbookNumber = vesselConfig.logbook_number;
        // Use actual catch date, not current timestamp
        const catchDate = options.catch_date || new Date();
        const dateStr = this.formatDateForLOT(catchDate);
        
        let lotId;
        
        switch (options.pattern || this.currentPattern) {
            case this.lotPatterns.SIMPLE:
                lotId = `${logbookNumber}-${faoCode}`;
                break;
                
            case this.lotPatterns.WITH_DATE:
                lotId = `${logbookNumber}-${faoCode}-${dateStr}`;
                break;
                
            case this.lotPatterns.WITH_COUNTER:
                const counter = options.useCounter ? this.getDailyCounter(logbookNumber, faoCode, dateStr) : this.getSimpleCounter(logbookNumber, faoCode);
                lotId = `${logbookNumber}-${faoCode}-${counter.toString().padStart(3, '0')}`;
                break;
                
            case this.lotPatterns.CUSTOM:
                if (!options.customPattern) {
                    throw new Error('Custom pattern specified but not provided');
                }
                lotId = this.applyCustomPattern(options.customPattern, {
                    logbook: logbookNumber,
                    species: faoCode,
                    date: dateStr,
                    counter: options.useCounter ? this.getDailyCounter(logbookNumber, faoCode, dateStr) : this.getSimpleCounter(logbookNumber, faoCode)
                });
                break;
                
            default:
                // Croatian fishermen prefer predictable LOT numbers
                lotId = `${logbookNumber}-${faoCode}`;
        }

        // Optional validation: LOT may contain species code (per EU flexibility)
        if (!lotId.includes(faoCode)) {
            console.log(`Info: LOT ID ${lotId} does not contain species code ${faoCode} (allowed per EU regulations)`);
        }

        return lotId;
    }
    
    // Get FAO zone description for Croatian waters
    getFAOZoneDescription(faoZone) {
        const CROATIAN_FAO_ZONES = {
            "37.2.1": "Jadransko more - srednji dio",
            "37.2.2": "Jadransko more - južni dio", 
            "37.1.1": "Jadransko more - sjeverni dio",
            "37.1.2": "Jadransko more - sjeverni dio (obalni)",
            "37.1.3": "Kvarnerski zaljev",
            "37.3.1": "Jonsko more - sjeverni dio",
            "37.3.2": "Jonsko more - srednji dio"
        };
        return CROATIAN_FAO_ZONES[faoZone] || `FAO zona ${faoZone}`;
    }
    
    // Validate FAO zone for Croatian waters
    validateFAOZone(faoZone) {
        const validZones = ["37.2.1", "37.2.2", "37.1.1", "37.1.2", "37.1.3", "37.3.1", "37.3.2"];
        return validZones.includes(faoZone);
    }

    // Create complete traceability record (separate from LOT ID)
    createTraceabilityRecord(lotId, species, vesselConfig, catchData) {
        const record = {
            // LOT identifier
            lot_id: lotId,
            
            // Species information
            species: {
                fao_code: species.fao_code,
                scientific_name: species.scientific_name,
                local_name: species.local_name
            },
            
            // Fishing information with EU-compliant production area
            fishing: {
                catch_date: this.formatDateDDMMYYYY(catchData.catch_date),
                catch_time: catchData.catch_time || null, // Optional
                fishing_gear_category: vesselConfig.fishing_gear_category
            },
            
            // EU 2023/2842 compliant production area
            production_area: {
                type: catchData.production_area_type || "FAO_ZONE", // "FAO_ZONE" | "AQUACULTURE_LOCATION"
                fao_zone: catchData.fao_zone, // e.g., "37.2.1", "37.2.2", "37.1.1", "37.1.2", "37.1.3"
                aquaculture_location: catchData.aquaculture_location || null, // e.g., "HR-001-SPLIT"
                description: catchData.area_description || this.getFAOZoneDescription(catchData.fao_zone)
            },
            
            // Vessel information (explicit fields, not parsed from LOT)
            vessel: {
                cfr_number: vesselConfig.cfr_number,
                registration_mark: vesselConfig.registration_mark,
                logbook_number: vesselConfig.logbook_number,
                vessel_name: vesselConfig.vessel_name || null
            },
            
            // EU 2023/2842 compliant dual quantity system
            quantity: {
                quantity_type: catchData.quantity_type || "WEIGHT", // "WEIGHT" | "UNITS"
                net_weight_kg: catchData.quantity_type === "WEIGHT" ? parseFloat(catchData.net_weight_kg) : null,
                unit_count: catchData.quantity_type === "UNITS" ? parseInt(catchData.unit_count) : null,
                undersized_catch_present: Boolean(catchData.undersized_catch_present),
                undersized_weight_kg: (catchData.undersized_catch_present && catchData.quantity_type === "WEIGHT") ? 
                    parseFloat(catchData.undersized_quantity_kg || 0) : null,
                undersized_unit_count: (catchData.undersized_catch_present && catchData.quantity_type === "UNITS") ?
                    parseInt(catchData.undersized_unit_count || 0) : null
            },
            
            // Traceability information (Ministry requirements)
            traceability: {
                product_form: catchData.product_form,        // e.g., "SVJEŽ", "SMRZNUT", "FILETI"
                purpose_phase: catchData.purpose_phase,      // e.g., "PRODAJA", "PRERADA", "KONZUM"
                destination: catchData.destination           // e.g., "TRŽNICA SPLIT", "NA PLOVILU", "HLADNJAČA"
            },
            
            // Metadata
            metadata: {
                created_timestamp: new Date().toISOString(),
                record_version: '1.0',
                compliance_standard: 'EU_2023_2842'
            }
        };

        // Validate complete record
        const validation = this.validateTraceabilityRecord(record);
        if (!validation.valid) {
            throw new Error(`Traceability record validation failed: ${validation.errors.join('; ')}`);
        }

        // Add flat compatibility fields for test compatibility (while keeping nested structure)
        record.lot_identifier = record.lot_id;
        record.species_fao_code = record.species.fao_code;
        record.species_scientific_name = record.species.scientific_name;
        record.production_area_description = record.production_area.description; // Keep nested structure intact
        record.catch_date = record.fishing.catch_date;
        record.cfr_number = record.vessel.cfr_number;
        record.logbook_number = record.vessel.logbook_number;
        record.fishing_gear_category = record.fishing.fishing_gear_category;
        record.net_quantity = record.quantity.net_weight_kg || record.quantity.unit_count;

        // Store record in both localStorage and Map for export functionality
        localStorage.setItem(`lot_${lotId}`, JSON.stringify(record));
        this.traceabilityRecords.set(lotId, record);
        
        return record;
    }

    // Validate LOT generation prerequisites
    validateLOTPrerequisites(species, vesselConfig) {
        const errors = [];

        if (!species || !species.fao_code) {
            errors.push('Species with FAO code is required');
        }

        if (!vesselConfig || !vesselConfig.logbook_number) {
            errors.push('Vessel logbook number is required');
        }

        if (!vesselConfig || !vesselConfig.cfr_number) {
            errors.push('Vessel CFR number is required');
        }

        if (vesselConfig && vesselConfig.logbook_number && !/^HRVLOG\d{13}$/.test(vesselConfig.logbook_number)) {
            errors.push('Invalid logbook number format (must be HRVLOG + 13 digits)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Validate complete traceability record
    validateTraceabilityRecord(record) {
        const errors = [];

        // LOT ID validation
        if (!record.lot_id) {
            errors.push('LOT ID is required');
        }

        // Species validation
        if (!record.species?.fao_code) {
            errors.push('Species FAO code is required');
        }

        // Optional: LOT may contain species code (per EU flexibility)
        // Note: Ministry allows LOT creation without mandatory FAO code inclusion
        if (record.lot_id && record.species?.fao_code && !record.lot_id.includes(record.species.fao_code)) {
            // This is informational only - not an error per EU 2023/2842 flexibility
            console.log(`Info: LOT ID ${record.lot_id} does not contain species code ${record.species.fao_code} (allowed per regulations)`);
        }

        // Vessel validation
        if (!record.vessel?.cfr_number) {
            errors.push('CFR number is required');
        }
        if (!record.vessel?.logbook_number) {
            errors.push('Logbook number is required');
        }

        // Fishing validation (check correct locations)
        if (!record.production_area?.fao_zone && !record.fishing?.fao_zone) {
            errors.push('FAO fishing zone is required');
        }
        if (!record.fishing?.catch_date) {
            errors.push('Catch date is required');
        }
        if (!record.fishing?.fishing_gear_category) {
            errors.push('Fishing gear category is required');
        }

        // Quantity validation - check based on quantity type
        if (record.quantity?.quantity_type === 'WEIGHT') {
            if (!record.quantity.net_weight_kg || record.quantity.net_weight_kg <= 0) {
                errors.push('Net weight must be greater than 0 kg when quantity type is WEIGHT');
            }
        } else if (record.quantity?.quantity_type === 'UNITS') {
            if (!record.quantity.unit_count || record.quantity.unit_count <= 0) {
                errors.push('Unit count must be greater than 0 when quantity type is UNITS');
            }
        }

        // EU 2023/2842 dual quantity validation
        if (!record.quantity?.quantity_type || !['WEIGHT', 'UNITS'].includes(record.quantity.quantity_type)) {
            errors.push('Quantity type must be either WEIGHT or UNITS');
        }
        
        // Undersized catch validation based on quantity type
        if (record.quantity?.undersized_catch_present === true) {
            if (record.quantity.quantity_type === 'WEIGHT') {
                if (!record.quantity.undersized_weight_kg || record.quantity.undersized_weight_kg <= 0) {
                    errors.push('Undersized weight required when undersized catch is present');
                }
                if (record.quantity.undersized_weight_kg > record.quantity.net_weight_kg) {
                    errors.push('Undersized weight cannot exceed total net weight');
                }
            } else if (record.quantity.quantity_type === 'UNITS') {
                if (!record.quantity.undersized_unit_count || record.quantity.undersized_unit_count <= 0) {
                    errors.push('Undersized unit count required when undersized catch is present');
                }
                if (record.quantity.undersized_unit_count > record.quantity.unit_count) {
                    errors.push('Undersized unit count cannot exceed total unit count');
                }
            }
        } else if (record.quantity?.undersized_catch_present === false) {
            if (record.quantity.undersized_weight_kg && record.quantity.undersized_weight_kg > 0) {
                errors.push('Undersized weight not allowed when undersized catch is false');
            }
            if (record.quantity.undersized_unit_count && record.quantity.undersized_unit_count > 0) {
                errors.push('Undersized unit count not allowed when undersized catch is false');
            }
        }
        
        // Ministry traceability validation (optional for basic EU compliance)
        // Note: These fields are only required for complete Ministry submission
        if (record.traceability) {
            if (record.traceability.product_form && !record.traceability.purpose_phase) {
                errors.push('Purpose/phase required when product form specified');
            }
            if (record.traceability.purpose_phase && !record.traceability.destination) {
                errors.push('Destination required when purpose/phase specified');
            }
        }
        
        // EU 2023/2842 production area validation
        if (!record.production_area?.fao_zone) {
            errors.push('FAO zone is mandatory per EU regulation');
        } else if (!this.validateFAOZone(record.production_area.fao_zone)) {
            errors.push(`Invalid FAO zone: ${record.production_area.fao_zone}. Must be Croatian waters.`);
        }
        
        if (!record.production_area?.description) {
            errors.push('Production area description is mandatory');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Get daily counter for vessel+species (optional)
    getDailyCounter(logbookNumber, faoCode, dateStr) {
        const counterKey = `daily_counter_${logbookNumber}_${faoCode}_${dateStr}`;
        let counter = parseInt(localStorage.getItem(counterKey) || '0');
        counter++;
        localStorage.setItem(counterKey, counter.toString());
        return counter;
    }

    // Get simple counter for vessel+species (Croatian style - predictable)
    getSimpleCounter(logbookNumber, faoCode) {
        const counterKey = `simple_counter_${logbookNumber}_${faoCode}`;
        let counter = parseInt(localStorage.getItem(counterKey) || '0');
        counter++;
        localStorage.setItem(counterKey, counter.toString());
        return counter;
    }
    
    // Format quantity display for dual quantity system
    formatQuantityDisplay(quantity) {
        if (quantity.quantity_type === 'WEIGHT') {
            return `${quantity.net_weight_kg} kg`;
        } else if (quantity.quantity_type === 'UNITS') {
            return `${quantity.unit_count} kom`;
        }
        return 'Nedefinirano';
    }
    
    // Format undersized display for dual quantity system
    formatUndersizedDisplay(quantity) {
        if (!quantity.undersized_catch_present) {
            return 'Ne';
        }
        
        if (quantity.quantity_type === 'WEIGHT' && quantity.undersized_weight_kg) {
            return `Da (${quantity.undersized_weight_kg} kg)`;
        } else if (quantity.quantity_type === 'UNITS' && quantity.undersized_unit_count) {
            return `Da (${quantity.undersized_unit_count} kom)`;
        }
        
        return 'Da';
    }
    
    // Format XML export for general use
    formatXML(record) {
        const timestamp = new Date().toISOString();
        const quantityDisplay = record.quantity.quantity_type === 'WEIGHT' 
            ? `<net_weight_kg>${record.quantity.net_weight_kg}</net_weight_kg>`
            : `<unit_count>${record.quantity.unit_count}</unit_count>`;
            
        const undersizedXML = record.quantity.undersized_catch_present
            ? (record.quantity.quantity_type === 'WEIGHT'
                ? `<undersized_weight_kg>${record.quantity.undersized_weight_kg || 0}</undersized_weight_kg>`
                : `<undersized_unit_count>${record.quantity.undersized_unit_count || 0}</undersized_unit_count>`)
            : '';
            
        return `<?xml version="1.0" encoding="UTF-8"?>
<fisheries_lot xmlns="http://hr.gov.minpo.ribarstvo/2026" generated="${timestamp}">
    <lot_identification>
        <lot_id>${this.escapeXML(record.lot_id)}</lot_id>
        <creation_date>${record.metadata.created_timestamp}</creation_date>
        <compliance_standard>${record.metadata.compliance_standard}</compliance_standard>
    </lot_identification>
    
    <species_information>
        <fao_code>${record.species.fao_code}</fao_code>
        <scientific_name>${this.escapeXML(record.species.scientific_name)}</scientific_name>
        <local_name>${this.escapeXML(record.species.local_name)}</local_name>
    </species_information>
    
    <production_area>
        <type>${record.production_area.type}</type>
        <fao_zone>${record.production_area.fao_zone}</fao_zone>
        <description>${this.escapeXML(record.production_area.description)}</description>
        ${record.production_area.aquaculture_location ? `<aquaculture_location>${this.escapeXML(record.production_area.aquaculture_location)}</aquaculture_location>` : ''}
    </production_area>
    
    <catch_information>
        <catch_date>${record.fishing.catch_date}</catch_date>
        ${record.fishing.catch_time ? `<catch_time>${record.fishing.catch_time}</catch_time>` : ''}
        <fishing_gear_category>${record.fishing.fishing_gear_category}</fishing_gear_category>
    </catch_information>
    
    <vessel_information>
        <cfr_number>${record.vessel.cfr_number}</cfr_number>
        <registration_mark>${this.escapeXML(record.vessel.registration_mark)}</registration_mark>
        <logbook_number>${record.vessel.logbook_number}</logbook_number>
        ${record.vessel.vessel_name ? `<vessel_name>${this.escapeXML(record.vessel.vessel_name)}</vessel_name>` : ''}
    </vessel_information>
    
    <quantity_information>
        <quantity_type>${record.quantity.quantity_type}</quantity_type>
        ${quantityDisplay}
        <undersized_catch_present>${record.quantity.undersized_catch_present}</undersized_catch_present>
        ${undersizedXML}
    </quantity_information>
    
    <traceability_information>
        <product_form>${this.escapeXML(record.traceability.product_form)}</product_form>
        <purpose_phase>${this.escapeXML(record.traceability.purpose_phase)}</purpose_phase>
        <destination>${this.escapeXML(record.traceability.destination)}</destination>
    </traceability_information>
</fisheries_lot>`;
    }
    
    // Format XML export specifically for Croatian authorities (MINPO)
    formatXMLForAuthorities(record) {
        const timestamp = new Date().toISOString();
        const quantityElement = record.quantity.quantity_type === 'WEIGHT'
            ? `<kolicina_kg>${record.quantity.net_weight_kg}</kolicina_kg>`
            : `<broj_jedinki>${record.quantity.unit_count}</broj_jedinki>`;
            
        const undersizedElement = record.quantity.undersized_catch_present
            ? (record.quantity.quantity_type === 'WEIGHT'
                ? `<ispod_minimalne_kg>${record.quantity.undersized_weight_kg || 0}</ispod_minimalne_kg>`
                : `<ispod_minimalne_kom>${record.quantity.undersized_unit_count || 0}</ispod_minimalne_kom>`)
            : `<ispod_minimalne>false</ispod_minimalne>`;
            
        return `<?xml version="1.0" encoding="UTF-8"?>
<evidencija_lot xmlns="http://minpo.gov.hr/ribarstvo/sljedivost/2026" verzija="1.0" generirano="${timestamp}">
    <osnovni_podaci>
        <lot_broj>${this.escapeXML(record.lot_id)}</lot_broj>
        <datum_kreiranja>${record.fishing.catch_date}</datum_kreiranja>
        <standard_uskladjenosti>EU_2023_2842</standard_uskladjenosti>
    </osnovni_podaci>
    
    <vrsta>
        <fao_kod>${record.species.fao_code}</fao_kod>
        <znanstveni_naziv>${this.escapeXML(record.species.scientific_name)}</znanstveni_naziv>
        <lokalni_naziv>${this.escapeXML(record.species.local_name)}</lokalni_naziv>
    </vrsta>
    
    <podrucje_proizvodnje>
        <tip>${record.production_area.type === 'FAO_ZONE' ? 'FAO_ZONA' : 'AKVAKULTURA'}</tip>
        <fao_zona>${record.production_area.fao_zone}</fao_zona>
        <opis>${this.escapeXML(record.production_area.description)}</opis>
    </podrucje_proizvodnje>
    
    <podaci_ulova>
        <datum_ulova>${record.fishing.catch_date}</datum_ulova>
        <kategorija_alata>${record.fishing.fishing_gear_category}</kategorija_alata>
    </podaci_ulova>
    
    <plovilo>
        <cfr_broj>${record.vessel.cfr_number}</cfr_broj>
        <registarska_oznaka>${this.escapeXML(record.vessel.registration_mark)}</registarska_oznaka>
        <broj_ocjevidnika>${record.vessel.logbook_number}</broj_ocjevidnika>
        ${record.vessel.vessel_name ? `<ime_plovila>${this.escapeXML(record.vessel.vessel_name)}</ime_plovila>` : ''}
    </plovilo>
    
    <kolicina>
        <tip_mjerenja>${record.quantity.quantity_type === 'WEIGHT' ? 'TEZINA' : 'BROJ_JEDINKI'}</tip_mjerenja>
        ${quantityElement}
        <ispod_minimalne_velicine>${record.quantity.undersized_catch_present}</ispod_minimalne_velicine>
        ${undersizedElement}
    </kolicina>
    
    <sljedivost>
        <oblik_proizvoda>${this.escapeXML(record.traceability.product_form)}</oblik_proizvoda>
        <namjena_faza>${this.escapeXML(record.traceability.purpose_phase)}</namjena_faza>
        <odrediste>${this.escapeXML(record.traceability.destination)}</odrediste>
    </sljedivost>
    
    <certifikacija>
        <digitalno_potpisano>false</digitalno_potpisano>
        <datum_izvoza>${timestamp}</datum_izvoza>
        <verzija_aplikacije>${record.metadata.record_version}</verzija_aplikacije>
    </certifikacija>
</evidencija_lot>`;
    }
    
    // Escape XML special characters
    escapeXML(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Format date for LOT (YYYYMMDD)
    formatDateForLOT(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}${month}${day}`;
    }

    // Format date for traceability record (DD/MM/YYYY)
    formatDateDDMMYYYY(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Apply custom LOT pattern
    applyCustomPattern(pattern, data) {
        return pattern
            .replace('{LOGBOOK}', data.logbook)
            .replace('{SPECIES}', data.species)
            .replace('{FAO_SPECIES}', data.species)
            .replace('{DATE}', data.date)
            .replace('{COUNTER}', data.counter);
    }

    // Export traceability record
    exportRecord(lotId, format = 'human_readable') {
        const record = this.traceabilityRecords.get(lotId);
        if (!record) {
            throw new Error(`No traceability record found for LOT ${lotId}`);
        }

        switch (format) {
            case 'human_readable':
                return this.formatHumanReadable(record);
            case 'json':
                return JSON.stringify(record, null, 2);
            case 'csv':
                return this.formatCSV(record);
            case 'xml':
                return this.formatXML(record);
            case 'xml_authorities':
                return this.formatXMLForAuthorities(record);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    // Format human-readable summary
    formatHumanReadable(record) {
        return `
LOT ${record.lot_id}
📅 Datum: ${record.fishing.catch_date}${record.fishing.catch_time ? ` ${record.fishing.catch_time}` : ''}
🐟 Vrsta: ${record.species.local_name} (${record.species.fao_code})
🌊 Područje: ${record.production_area.description} (${record.production_area.fao_zone})
⚖️ Količina: ${this.formatQuantityDisplay(record.quantity)}
🎣 Alat: ${record.fishing.fishing_gear_category}
🚢 CFR: ${record.vessel.cfr_number}
📋 Očevidnik: ${record.vessel.logbook_number}
⚠️ Ispod min.: ${this.formatUndersizedDisplay(record.quantity)}
📦 Oblik: ${record.traceability.product_form}
🎯 Namjena: ${record.traceability.purpose_phase}
📍 Odredište: ${record.traceability.destination}
`.trim();
    }

    // Format CSV export
    formatCSV(record) {
        const headers = [
            'LOT_ID', 'CATCH_DATE', 'SPECIES_FAO', 'SPECIES_NAME', 
            'PRODUCTION_AREA_TYPE', 'FAO_ZONE', 'AREA_DESCRIPTION', 
            'QUANTITY_TYPE', 'NET_WEIGHT_KG', 'UNIT_COUNT', 'GEAR_CATEGORY', 'CFR_NUMBER', 
            'LOGBOOK_NUMBER', 'UNDERSIZED_PRESENT', 'UNDERSIZED_WEIGHT_KG', 'UNDERSIZED_UNIT_COUNT',
            'PRODUCT_FORM', 'PURPOSE_PHASE', 'DESTINATION'
        ];
        
        const values = [
            record.lot_id,
            record.fishing.catch_date,
            record.species.fao_code,
            record.species.local_name,
            record.production_area.type,
            record.production_area.fao_zone,
            record.production_area.description,
            record.quantity.quantity_type,
            record.quantity.net_weight_kg || '',
            record.quantity.unit_count || '',
            record.fishing.fishing_gear_category,
            record.vessel.cfr_number,
            record.vessel.logbook_number,
            record.quantity.undersized_catch_present,
            record.quantity.undersized_weight_kg || 0,
            record.quantity.undersized_unit_count || 0,
            record.traceability.product_form,
            record.traceability.purpose_phase,
            record.traceability.destination
        ];

        return headers.join(',') + '\n' + values.join(',');
    }

    // Get all records
    getAllRecords() {
        return Array.from(this.traceabilityRecords.values());
    }

    // Set LOT pattern preference
    setLOTPattern(pattern) {
        if (!Object.values(this.lotPatterns).includes(pattern) && pattern !== null) {
            throw new Error('Invalid LOT pattern');
        }
        this.currentPattern = pattern;
        localStorage.setItem('lot_pattern_preference', pattern);
    }

    // Load LOT pattern preference
    loadLOTPatternPreference() {
        const saved = localStorage.getItem('lot_pattern_preference');
        if (saved && Object.values(this.lotPatterns).includes(saved)) {
            this.currentPattern = saved;
        }
    }
}

// Initialize global LOT manager
window.lotManager = new LOTManager();
