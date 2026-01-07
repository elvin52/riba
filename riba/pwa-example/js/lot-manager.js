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
                const counter = options.useCounter ? this.getDailyCounter(logbookNumber, faoCode, dateStr) : '';
                lotId = counter ? `${logbookNumber}-${faoCode}-${counter.toString().padStart(3, '0')}` : `${logbookNumber}-${faoCode}`;
                break;
                
            case this.lotPatterns.CUSTOM:
                if (!options.customPattern) {
                    throw new Error('Custom pattern specified but not provided');
                }
                lotId = this.applyCustomPattern(options.customPattern, {
                    logbook: logbookNumber,
                    species: faoCode,
                    date: dateStr,
                    counter: options.useCounter ? this.getDailyCounter(logbookNumber, faoCode, dateStr) : ''
                });
                break;
                
            default:
                lotId = `${logbookNumber}-${faoCode}`;
        }

        // Optional validation: LOT may contain species code (per EU flexibility)
        if (!lotId.includes(faoCode)) {
            console.log(`Info: LOT ID ${lotId} does not contain species code ${faoCode} (allowed per EU regulations)`);
        }

        return lotId;
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
            
            // Fishing information
            fishing: {
                fao_zone: catchData.fao_zone,
                catch_date: this.formatDateDDMMYYYY(catchData.catch_date),
                catch_time: catchData.catch_time || null, // Optional
                fishing_gear_category: vesselConfig.fishing_gear_category
            },
            
            // Vessel information (explicit fields, not parsed from LOT)
            vessel: {
                cfr_number: vesselConfig.cfr_number,
                registration_mark: vesselConfig.registration_mark,
                logbook_number: vesselConfig.logbook_number,
                vessel_name: vesselConfig.vessel_name || null
            },
            
            // Quantity information
            quantity: {
                net_weight_kg: parseFloat(catchData.net_weight_kg),
                units: catchData.units || null,
                undersized_catch_present: Boolean(catchData.undersized_catch_present),
                undersized_quantity_kg: catchData.undersized_catch_present ? 
                    parseFloat(catchData.undersized_quantity_kg || 0) : null
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

        // Store record
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

        // Fishing validation
        if (!record.fishing?.fao_zone) {
            errors.push('FAO fishing zone is required');
        }
        if (!record.fishing?.catch_date) {
            errors.push('Catch date is required');
        }
        if (!record.fishing?.fishing_gear_category) {
            errors.push('Fishing gear category is required');
        }

        // Quantity validation
        if (!record.quantity?.net_weight_kg || record.quantity.net_weight_kg <= 0) {
            errors.push('Net weight must be greater than 0 kg');
        }

        // Undersized catch validation
        if (record.quantity?.undersized_catch_present === true) {
            if (!record.quantity.undersized_quantity_kg || record.quantity.undersized_quantity_kg <= 0) {
                errors.push('Undersized quantity required when undersized catch is present');
            }
            if (record.quantity.undersized_quantity_kg > record.quantity.net_weight_kg) {
                errors.push('Undersized quantity cannot exceed total net weight');
            }
        } else if (record.quantity?.undersized_catch_present === false) {
            if (record.quantity.undersized_quantity_kg && record.quantity.undersized_quantity_kg > 0) {
                errors.push('Undersized quantity not allowed when undersized catch is false');
            }
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
📍 Zona: ${record.fishing.fao_zone}
⚖️ Težina: ${record.quantity.net_weight_kg} kg
🎣 Alat: ${record.fishing.fishing_gear_category}
🚢 CFR: ${record.vessel.cfr_number}
📋 Očevidnik: ${record.vessel.logbook_number}
⚠️ Ispod min.: ${record.quantity.undersized_catch_present ? 
    `Da (${record.quantity.undersized_quantity_kg} kg)` : 'Ne'}
`.trim();
    }

    // Format CSV export
    formatCSV(record) {
        const headers = [
            'LOT_ID', 'CATCH_DATE', 'SPECIES_FAO', 'SPECIES_NAME', 
            'FAO_ZONE', 'NET_WEIGHT_KG', 'GEAR_CATEGORY', 'CFR_NUMBER', 
            'LOGBOOK_NUMBER', 'UNDERSIZED_PRESENT', 'UNDERSIZED_KG'
        ];
        
        const values = [
            record.lot_id,
            record.fishing.catch_date,
            record.species.fao_code,
            record.species.local_name,
            record.fishing.fao_zone,
            record.quantity.net_weight_kg,
            record.fishing.fishing_gear_category,
            record.vessel.cfr_number,
            record.vessel.logbook_number,
            record.quantity.undersized_catch_present,
            record.quantity.undersized_quantity_kg || 0
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
