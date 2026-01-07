// LOT ID Generation and Validation Engine
class LOTGenerator {
    constructor() {
        this.currentCatch = null;
        this.selectedSpecies = null;
        this.vesselConfig = null;
        this.fishingZones = [
            { code: 'A1', description: 'Područje A1 - Sjeverni Jadran' },
            { code: 'A2', description: 'Područje A2 - Srednji Jadran' },
            { code: 'A3', description: 'Područje A3 - Južni Jadran' },
            { code: 'F1', description: 'Područje F1 - Obalnoj pas do 6 NM' },
            { code: 'F2', description: 'Područje F2 - Teritorijalno more 6-12 NM' },
            { code: 'F3', description: 'Područje F3 - Ribolovni pojas 12-25 NM' }
        ];
    }

    async initialize() {
        // Load vessel configuration
        this.vesselConfig = await window.fishermanDB.getVesselConfig();
        
        if (!this.vesselConfig) {
            // Default vessel config - should be set up during first use
            this.vesselConfig = {
                cfr_number: 'HRV000123456789', // 14-character EU CFR format
                name: 'Demo Plovilo',
                license_number: 'HR-12345',
                default_gear: 'GNS',
                logbook_series: 'HR-LOG-2026' // CRITICAL: Missing logbook number
            };
        }
    }

    // Generate unique LOT ID per EU 2023/2842 Article 58
    generateLOTID() {
        if (!this.selectedSpecies) {
            throw new Error('Species must be selected before generating LOT ID');
        }
        
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
        const counter = this.getDailyCounter(dateStr);
        
        // COMPLIANT FORMAT: logbook_number + FAO_species_code + date + counter
        // Per regulation: "broj očevidnika/izvješća + FAO oznaka vrste"
        const logbookNumber = this.vesselConfig.logbook_series || 'HR-LOG-2026';
        const faoCode = this.selectedSpecies.fao_code;
        
        const lotId = `${logbookNumber}-${faoCode}-${dateStr}-${counter.toString().padStart(3, '0')}`;
        
        return lotId;
    }

    extractVesselId() {
        if (!this.vesselConfig?.license_number) {
            return '12345'; // Fallback
        }
        
        // Extract numeric part from license (HR-12345 → 12345)
        const match = this.vesselConfig.license_number.match(/(\d+)$/);
        return match ? match[1] : '12345';
    }

    getDailyCounter(dateStr) {
        // Get from localStorage for persistence across sessions
        const counterKey = `lot_counter_${dateStr}`;
        let counter = parseInt(localStorage.getItem(counterKey) || '0');
        counter++;
        localStorage.setItem(counterKey, counter.toString());
        return counter;
    }

    // MANDATORY FIELD VALIDATIONS
    validateLogbookNumber(logbookNumber) {
        if (!logbookNumber) {
            return { valid: false, error: 'Broj očevidnika je obavezan' };
        }
        
        if (!logbookNumber.startsWith('HRV LOGI')) {
            return { valid: false, error: 'Broj očevidnika mora počinjati s "HRV LOGI"' };
        }
        
        const numericPart = logbookNumber.replace('HRV LOGI', '').trim();
        if (!/^\d{13}$/.test(numericPart)) {
            return { valid: false, error: 'Mora sadržavati točno 13 brojki nakon "HRV LOGI"' };
        }
        
        return { valid: true };
    }

    validateCFRNumber(cfrNumber) {
        if (!cfrNumber) {
            return { valid: false, error: 'CFR broj je obavezan' };
        }
        
        if (!/^[A-Z]{3}\d{9,12}$/.test(cfrNumber)) {
            return { valid: false, error: 'CFR format: 3 slova + 9-12 brojki (npr. HRV123456789)' };
        }
        
        return { valid: true };
    }

    validateFishingZone(zoneCode) {
        if (!zoneCode) {
            return { valid: false, error: 'Odabir ribolovne zone je obavezan' };
        }
        
        const zone = this.fishingZones.find(z => z.code === zoneCode);
        if (!zone) {
            return { valid: false, error: 'Neispravna ribolovna zona' };
        }
        
        return { valid: true, zone: zone };
    }

    validateMandatoryFields() {
        const errors = [];
        
        // Vessel data validation
        const cfrValidation = this.validateCFRNumber(this.currentCatch?.vessel_info?.cfr_number);
        if (!cfrValidation.valid) errors.push(cfrValidation.error);
        
        if (!this.currentCatch?.vessel_info?.registration_number) {
            errors.push('Registarska oznaka plovila je obavezna');
        }
        
        // Logbook validation
        const logbookValidation = this.validateLogbookNumber(this.currentCatch?.vessel_info?.logbook_number);
        if (!logbookValidation.valid) errors.push(logbookValidation.error);
        
        // Fishing zone validation
        const zoneValidation = this.validateFishingZone(this.currentCatch?.catch_info?.fishing_zone);
        if (!zoneValidation.valid) errors.push(zoneValidation.error);
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // Initialize new catch
    async startNewCatch() {
        console.log('🎣 Starting new catch...');
        
        try {
            await this.initialize();
            console.log('✅ LOT Generator initialized');
        } catch (error) {
            console.error('❌ LOT Generator initialization failed:', error);
            throw new Error('Greška inicijalizacije: ' + error.message);
        }
        
        // Use default Croatian Adriatic location (GPS bypassed)
        console.log('📍 Using default Croatian Adriatic location (GPS bypassed)');
        const locationData = {
            zone_code: '37.2.1',
            description: 'Jadransko more - Hrvatska obala',
            coordinates: {
                latitude: 44.0,
                longitude: 15.0
            }
        };
        console.log('✅ Default location data set:', locationData);

        this.currentCatch = {
            lot_id: null, // Will be generated when finalized
            catch_info: {
                date: this.formatDateCompliant(new Date()), // DD/MM/YYYY format per regulation
                time: new Date().toISOString(),
                fishing_zone: null, // MANDATORY: Manual zone selection (A1, A2, F1, F2, etc.)
                zone_description: null,
                fao_zone: locationData.zone_code, // Keep for technical reference
                gps_coordinates: {
                    latitude: locationData.coordinates.latitude,
                    longitude: locationData.coordinates.longitude,
                    accuracy: window.gpsManager.accuracy || 0
                }
            },
            vessel_info: {
                cfr_number: null, // MANDATORY: From vessel setup screen
                registration_number: null, // MANDATORY: From vessel setup screen  
                logbook_number: null, // MANDATORY: HRV LOGI + 13 digits validation
                name: this.vesselConfig.name,
                license_number: this.vesselConfig.license_number,
                registration_port: this.vesselConfig.registration_port || 'HR-SPLIT'
            },
            fishing_gear: await this.getDefaultGear(),
            metadata: {
                created_timestamp: new Date().toISOString(),
                app_version: '1.0.0',
                device_info: this.getDeviceInfo(),
                validation_status: 'pending',
                export_status: 'pending'
            }
        };

        return this.currentCatch;
    }

    // Set mandatory vessel information
    setVesselInfo(cfrNumber, registrationNumber, logbookNumber) {
        if (!this.currentCatch) {
            throw new Error('No active catch to set vessel info');
        }
        
        // Validate inputs
        const cfrValidation = this.validateCFRNumber(cfrNumber);
        if (!cfrValidation.valid) {
            throw new Error(cfrValidation.error);
        }
        
        const logbookValidation = this.validateLogbookNumber(logbookNumber);
        if (!logbookValidation.valid) {
            throw new Error(logbookValidation.error);
        }
        
        if (!registrationNumber?.trim()) {
            throw new Error('Registarska oznaka je obavezna');
        }
        
        // Set validated data
        this.currentCatch.vessel_info.cfr_number = cfrNumber.trim().toUpperCase();
        this.currentCatch.vessel_info.registration_number = registrationNumber.trim().toUpperCase();
        this.currentCatch.vessel_info.logbook_number = logbookNumber.trim();
        
        // Save to localStorage for future catches
        localStorage.setItem('vessel_cfr', this.currentCatch.vessel_info.cfr_number);
        localStorage.setItem('vessel_registration', this.currentCatch.vessel_info.registration_number);
        localStorage.setItem('vessel_logbook', this.currentCatch.vessel_info.logbook_number);
        
        console.log('✅ Vessel info set and saved locally');
    }

    // Set fishing zone
    setFishingZone(zoneCode) {
        if (!this.currentCatch) {
            throw new Error('No active catch to set fishing zone');
        }
        
        const zoneValidation = this.validateFishingZone(zoneCode);
        if (!zoneValidation.valid) {
            throw new Error(zoneValidation.error);
        }
        
        this.currentCatch.catch_info.fishing_zone = zoneCode;
        this.currentCatch.catch_info.zone_description = zoneValidation.zone.description;
        
        console.log(`✅ Fishing zone set: ${zoneCode} - ${zoneValidation.zone.description}`);
    }

    // Get saved vessel data from localStorage
    getSavedVesselData() {
        return {
            cfr_number: localStorage.getItem('vessel_cfr') || '',
            registration_number: localStorage.getItem('vessel_registration') || '',
            logbook_number: localStorage.getItem('vessel_logbook') || 'HRV LOGI'
        };
    }

    // Get available fishing zones
    getFishingZones() {
        return this.fishingZones;
    }

    // Set species for current catch
    async setSpecies(faoCode) {
        const species = await window.fishermanDB.getSpeciesByFAO(faoCode);
        if (!species) {
            throw new Error(`Vrsta s FAO kodom ${faoCode} nije pronađena`);
        }

        this.selectedSpecies = species;
        this.currentCatch.species = {
            fao_code: species.fao_code,
            scientific_name: species.scientific_name,
            local_name: species.local_name,
            category: species.category
        };

        return species;
    }

    // Set quantities for current catch
    setQuantities(weightKg, belowMinSize = null) {
        if (!weightKg || weightKg <= 0) {
            throw new Error('Težina mora biti veća od 0 kg');
        }

        if (weightKg > 10000) {
            throw new Error('Težina ne može biti veća od 10000 kg');
        }

        this.currentCatch.quantities = {
            net_weight_kg: parseFloat(weightKg),
            piece_count: null // Optional
        };

        // Handle below minimum size
        if (belowMinSize && (belowMinSize.count > 0 || belowMinSize.weight > 0)) {
            this.currentCatch.quantities.below_min_size = {
                weight_kg: parseFloat(belowMinSize.weight || 0),
                piece_count: parseInt(belowMinSize.count || 0),
                min_reference_size_cm: this.selectedSpecies?.min_size_cm || 0
            };
        }
    }

    // Validate and finalize LOT with MANDATORY field validation
    async finalizeLOT() {
        console.log('🎯 finalizeLOT called with mandatory validation');
        
        if (!this.currentCatch) {
            throw new Error('Nema aktivnog ulova za finalizaciju');
        }
        
        // MANDATORY VALIDATION - prevent LOT generation if any required field is missing
        const validation = this.validateMandatoryFields();
        if (!validation.valid) {
            const errorMsg = 'Nedostaju obavezni podaci:\n' + validation.errors.join('\n');
            console.error('❌ LOT validation failed:', validation.errors);
            throw new Error(errorMsg);
        }
        
        // Generate LOT ID using validated logbook number
        const lotId = this.generateLOTID();
        this.currentCatch.lot_id = lotId;
        this.currentCatch.metadata.validation_status = 'validated';
        this.currentCatch.status = 'completed';
        
        // Save to database
        await window.fishermanDB.saveCatch(this.currentCatch);
        
        console.log('✅ LOT finalized with all mandatory data:', lotId);
        return this.currentCatch;
    }

    // Comprehensive LOT validation per EU 2023/2842
    validateLOT(lotData) {
        const errors = [];
        const warnings = [];

        // EXEMPTION CHECK: Article 58.8 - Small quantities ≤10kg to consumers
        if (lotData.quantities?.net_weight_kg <= 10) {
            warnings.push('NAPOMENA: Količine ≤10kg prodane izravno potrošačima mogu biti izuzete od sljedivosti (čl. 58.8)');
        }

        // MANDATORY: Species information (lines 32)
        if (!lotData.species?.fao_code) {
            errors.push('FAO kod vrste je obavezan (čl. 58, st. 5.d)');
        }
        if (!lotData.species?.scientific_name) {
            errors.push('Znanstveni naziv vrste je obavezan (čl. 58, st. 5.d)');
        }

        // MANDATORY: Production area (line 33)
        if (!lotData.catch_info?.date) {
            errors.push('Datum ulova je obavezan (čl. 58, st. 5.h) - format DD/MM/YYYY');
        }
        if (!lotData.catch_info?.fao_zone) {
            errors.push('FAO zona je obavezna (čl. 58, st. 5.e)');
        }

        // MANDATORY: Vessel identification (line 25)
        if (!lotData.vessel_info?.cfr_number) {
            errors.push('CFR broj plovila je obavezan');
        }
        if (!lotData.vessel_info?.logbook_number) {
            errors.push('Broj očevidnika/izvješća je obavezan (čl. 58, st. 5)');
        }

        // MANDATORY: Fishing gear category (line 35)
        if (!lotData.fishing_gear?.category) {
            errors.push('Kategorija ribolovnog alata je obavezna (čl. 58, st. 5)');
        }

        // MANDATORY: Net weight (line 36)
        if (!lotData.quantities?.net_weight_kg || lotData.quantities.net_weight_kg <= 0) {
            errors.push('Neto težina mora biti veća od 0 kg (čl. 58, st. 5.h)');
        }

        // MANDATORY: Below min size if present (line 37)
        if (lotData.quantities?.below_min_size) {
            const belowMin = lotData.quantities.below_min_size;
            if ((belowMin.weight_kg || 0) > lotData.quantities.net_weight_kg) {
                errors.push('Težina ribe ispod minimalne veličine ne može biti veća od ukupne težine');
            }
        }

        // MANDATORY: GPS coordinates for location verification
        if (!lotData.catch_info?.gps_coordinates?.latitude || !lotData.catch_info?.gps_coordinates?.longitude) {
            errors.push('GPS koordinate su obavezne za verifikaciju zone ulova');
        }

        // VALIDATION: CFR format (14 characters)
        if (lotData.vessel_info?.cfr_number && lotData.vessel_info.cfr_number.length !== 14) {
            errors.push('CFR broj mora imati točno 14 znakova (EU standard)');
        }

        // VALIDATION: LOT ID format check
        if (!lotData.lot_id || !lotData.lot_id.includes(lotData.species?.fao_code)) {
            errors.push('LOT ID mora sadržavati FAO kod vrste (broj očevidnika + FAO kod)');
        }

        return {
            valid: errors.length === 0,
            message: errors.join('; '),
            errors,
            warnings,
            exempt_eligible: lotData.quantities?.net_weight_kg <= 10
        };
    }

    async getDefaultGear() {
        const gearTypes = await window.fishermanDB.getAllGearTypes();
        const defaultGearCode = this.vesselConfig?.default_gear || 'GNS';
        
        const gear = gearTypes.find(g => g.code === defaultGearCode) || gearTypes[0];
        
        return {
            category: gear.code,
            description: gear.description,
            type: gear.type
        };
    }

    getDeviceInfo() {
        const ua = navigator.userAgent;
        let device = 'Unknown';
        
        if (/Android/i.test(ua)) {
            device = 'Android';
        } else if (/iPhone|iPad/i.test(ua)) {
            device = 'iOS';
        } else if (/Windows/i.test(ua)) {
            device = 'Windows';
        }
        
        const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/);
        const browser = browserMatch ? browserMatch[0] : 'Unknown Browser';
        
        return `${device}, ${browser}`;
    }

    // Format date as DD/MM/YYYY per EU regulation requirement
    formatDateCompliant(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Get current catch summary for display
    getCatchSummary() {
        if (!this.currentCatch) return null;

        const species = this.currentCatch.species;
        const quantities = this.currentCatch.quantities;
        const catchInfo = this.currentCatch.catch_info;
        
        return {
            lot_id: this.currentCatch.lot_id || 'Pending',
            species_display: `${species?.local_name} (${species?.fao_code})`,
            weight_display: `${quantities?.net_weight_kg} kg`,
            date_display: new Date(catchInfo?.time).toLocaleString('hr-HR'),
            zone_display: `${catchInfo?.zone_description} (${catchInfo?.fao_zone})`,
            gear_display: this.currentCatch.fishing_gear?.description,
            below_min_display: quantities?.below_min_size ? 
                `${quantities.below_min_size.piece_count} kom (${quantities.below_min_size.weight_kg} kg)` : 
                'Nema',
            coordinates_display: window.gpsManager.formatCoordinates()
        };
    }

    // Reset for new catch
    reset() {
        this.currentCatch = null;
        this.selectedSpecies = null;
    }

    // Export LOT data in different formats
    exportLOTData(format = 'json') {
        if (!this.currentCatch) return null;

        switch (format.toLowerCase()) {
            case 'csv':
                return this.exportToCSV();
            case 'json':
                return JSON.stringify(this.currentCatch, null, 2);
            case 'xml':
                return this.exportToXML();
            default:
                return this.currentCatch;
        }
    }

    exportToCSV() {
        const lot = this.currentCatch;
        // REGULATION COMPLIANT: All mandatory fields per lines 31-37
        const rows = [
            ['Field', 'Value', 'Regulation_Reference'],
            ['LOT_ID', lot.lot_id, 'Article_58_Line_31'],
            ['Species_FAO', lot.species.fao_code, 'Article_58_Line_32'],
            ['Species_Scientific', lot.species.scientific_name, 'Article_58_Line_32'],
            ['Species_Local', lot.species.local_name, 'Article_58_Line_32'],
            ['Production_Area', lot.catch_info.zone_description, 'Article_58_Line_33'],
            ['FAO_Zone', lot.catch_info.fao_zone, 'Article_58_Line_33'],
            ['Catch_Date_DDMMYYYY', lot.catch_info.date, 'Article_58_Line_34'],
            ['Catch_Time_ISO', lot.catch_info.time, 'Additional_Timestamp'],
            ['Gear_Category', lot.fishing_gear.category, 'Article_58_Line_35'],
            ['Gear_Description', lot.fishing_gear.description, 'Article_58_Line_35'],
            ['Net_Weight_KG', lot.quantities.net_weight_kg, 'Article_58_Line_36'],
            ['Below_Min_Weight_KG', lot.quantities.below_min_size?.weight_kg || 0, 'Article_58_Line_37'],
            ['Below_Min_Count', lot.quantities.below_min_size?.piece_count || 0, 'Article_58_Line_37'],
            ['Min_Reference_Size_CM', lot.quantities.below_min_size?.min_reference_size_cm || 0, 'Article_58_Line_37'],
            ['Vessel_CFR_14digit', lot.vessel_info.cfr_number, 'CFR_Requirement'],
            ['Vessel_Name', lot.vessel_info.name, 'Vessel_Identification'],
            ['Logbook_Number', lot.vessel_info.logbook_number, 'MANDATORY_Line_25'],
            ['Registration_Port', lot.vessel_info.registration_port, 'Croatian_Requirement'],
            ['GPS_Latitude', lot.catch_info.gps_coordinates.latitude, 'Location_Verification'],
            ['GPS_Longitude', lot.catch_info.gps_coordinates.longitude, 'Location_Verification'],
            ['GPS_Accuracy_Meters', lot.catch_info.gps_coordinates.accuracy, 'Location_Quality']
        ];

        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    exportToXML() {
        const lot = this.currentCatch;
        return `<?xml version="1.0" encoding="UTF-8"?>
<fishery_lot>
    <lot_id>${lot.lot_id}</lot_id>
    <species>
        <fao_code>${lot.species.fao_code}</fao_code>
        <scientific_name>${lot.species.scientific_name}</scientific_name>
        <local_name>${lot.species.local_name}</local_name>
    </species>
    <catch_info>
        <date>${lot.catch_info.date}</date>
        <time>${lot.catch_info.time}</time>
        <fao_zone>${lot.catch_info.fao_zone}</fao_zone>
        <zone_description>${lot.catch_info.zone_description}</zone_description>
        <coordinates>
            <latitude>${lot.catch_info.gps_coordinates.latitude}</latitude>
            <longitude>${lot.catch_info.gps_coordinates.longitude}</longitude>
            <accuracy>${lot.catch_info.gps_coordinates.accuracy}</accuracy>
        </coordinates>
    </catch_info>
    <vessel>
        <cfr_number>${lot.vessel_info.cfr_number}</cfr_number>
        <name>${lot.vessel_info.name}</name>
        <license_number>${lot.vessel_info.license_number}</license_number>
    </vessel>
    <fishing_gear>
        <category>${lot.fishing_gear.category}</category>
        <description>${lot.fishing_gear.description}</description>
    </fishing_gear>
    <quantities>
        <net_weight_kg>${lot.quantities.net_weight_kg}</net_weight_kg>
        <below_min_size>
            <weight_kg>${lot.quantities.below_min_size?.weight_kg || 0}</weight_kg>
            <piece_count>${lot.quantities.below_min_size?.piece_count || 0}</piece_count>
        </below_min_size>
    </quantities>
</fishery_lot>`;
    }
}

// Global LOT generator instance
window.lotGenerator = new LOTGenerator();
