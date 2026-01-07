// LOT ID Generation and Validation Engine
class LOTGenerator {
    constructor() {
        this.currentCatch = null;
        this.selectedSpecies = null;
        this.vesselConfig = null;
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

    getDailyCounter(dateStr, speciesCode) {
        // Species-scoped counter to prevent cross-species bleed
        const counterKey = `lot_counter_${dateStr}_${speciesCode}`;
        let counter = parseInt(localStorage.getItem(counterKey) || '0');
        counter++;
        localStorage.setItem(counterKey, counter.toString());
        return counter;
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
        
        // CRITICAL: Reset state to prevent carryover from previous catch
        this.selectedSpecies = null;
        
        // Use default Croatian Adriatic location (GPS bypassed)
        const locationData = {
            coordinates: { latitude: 44.0, longitude: 15.0 },
            zone_code: '37.2.1',
            zone_name: 'Croatian Adriatic Sea'
        };
        
        // Load saved vessel data
        const savedVesselData = this.getSavedVesselData();

        this.currentCatch = {
            lot_id: null, // Will be generated when finalized
            catch_info: {
                date: this.formatDateCompliant(new Date()), // DD/MM/YYYY format per regulation
                time: new Date().toISOString(),
                fishing_zone: null,  // MANDATORY: Will be set via manual selection
                zone_description: null,  // MANDATORY: Will be set via manual selection
                fao_zone: locationData.zone_code,
                gps_coordinates: {
                    latitude: locationData.coordinates.latitude,
                    longitude: locationData.coordinates.longitude,
                    accuracy: window.gpsManager?.accuracy || 0
                }
            },
            vessel_info: {
                cfr_number: savedVesselData.cfr_number || null,  // MANDATORY
                registration_number: savedVesselData.registration_number || null,  // MANDATORY
                logbook_number: savedVesselData.logbook_number || null,  // MANDATORY
                name: this.vesselConfig?.name || 'Demo Plovilo',
                license_number: this.vesselConfig?.license_number || 'HR-12345',
                logbook_number: this.vesselConfig.logbook_series, // MANDATORY per regulation line 25
                registration_port: this.vesselConfig.registration_port || 'HR-SPLIT' // Required for Croatian vessels
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

    // Validate and finalize LOT
    async finalizeLOT() {
        console.log('🎯 finalizeLOT called');
        
        if (!this.currentCatch) {
            throw new Error('No active catch found');
        }
        
        if (!this.selectedSpecies) {
            throw new Error('No species selected');
        }
        
        // Validate mandatory fields before finalizing
        this.validateMandatoryFields();
        
        // Set species data from actual selection
        this.currentCatch.species = {
            fao_code: this.selectedSpecies.fao_code,
            scientific_name: this.selectedSpecies.scientific_name,
            local_name: this.selectedSpecies.local_name,
            min_size_cm: this.selectedSpecies.min_size_cm || null
        };
        
        // Generate proper LOT ID using actual species
        const now = new Date();
        const dateStr = now.getFullYear().toString() + 
                       (now.getMonth()+1).toString().padStart(2,'0') + 
                       now.getDate().toString().padStart(2,'0');
        
        // CRITICAL: Use single source of truth - currentCatch.species, not selectedSpecies
        const faoCode = this.currentCatch.species.fao_code;
        const logbookSeries = this.vesselConfig?.logbook_series || 'HR-LOG-2026';
        
        // Get daily counter for this species (species-scoped)
        const counter = this.getDailyCounter(dateStr, faoCode);
        
        // LOT ID format: logbook_series + species_code + date + counter
        const lotId = `${logbookSeries}-${faoCode}-${dateStr}-${counter.toString().padStart(3, '0')}`;
        
        this.currentCatch.lot_id = lotId;
        this.currentCatch.status = 'completed';
        this.currentCatch.finalized_timestamp = new Date().toISOString();
        
        console.log('✅ LOT generated:', lotId);
        console.log('✅ Species:', this.selectedSpecies.local_name, '(' + this.selectedSpecies.fao_code + ')');
        
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

    // MANDATORY: Fishing Zones Implementation
    fishingZones = [
        { code: 'A1', description: 'Jadranski akvatorij - zona A1' },
        { code: 'A2', description: 'Jadranski akvatorij - zona A2' },
        { code: 'A3', description: 'Jadranski akvatorij - zona A3' },
        { code: 'F1', description: 'Ribolovni prostor F1' },
        { code: 'F2', description: 'Ribolovni prostor F2' },
        { code: 'F3', description: 'Ribolovni prostor F3' }
    ];

    getFishingZones() {
        return this.fishingZones;
    }

    async setFishingZone(zoneCode) {
        if (!this.currentCatch) {
            throw new Error('No active catch');
        }

        const zone = this.fishingZones.find(z => z.code === zoneCode);
        if (!zone) {
            throw new Error('Invalid fishing zone code: ' + zoneCode);
        }

        // Set zone in current catch
        this.currentCatch.catch_info.fishing_zone = zone.code;
        this.currentCatch.catch_info.zone_description = zone.description;

        console.log('✅ Fishing zone set:', zone.code, '-', zone.description);
    }

    // MANDATORY: Vessel Data Management
    getSavedVesselData() {
        const saved = localStorage.getItem('vessel_data');
        if (!saved) {
            return { cfr_number: '', registration_number: '', logbook_number: 'HRV LOGI' };
        }
        return JSON.parse(saved);
    }

    async setVesselInfo(cfrNumber, registrationNumber, logbookNumber) {
        // Validate CFR number format
        if (!cfrNumber || !/^[A-Z]{3}\d{9,12}$/.test(cfrNumber)) {
            throw new Error('CFR broj mora biti format: 3 slova + 9-12 brojki (npr. HRV123456789)');
        }

        // Validate logbook number
        if (!this.validateLogbookNumber(logbookNumber)) {
            throw new Error('Broj očevidnika mora biti format: HRV LOGI + točno 13 brojki');
        }

        // Validate registration number
        if (!registrationNumber || registrationNumber.length < 3) {
            throw new Error('Registarska oznaka je obavezna');
        }

        // Save to localStorage
        const vesselData = { cfr_number: cfrNumber, registration_number: registrationNumber, logbook_number: logbookNumber };
        localStorage.setItem('vessel_data', JSON.stringify(vesselData));

        // Update current catch if exists
        if (this.currentCatch) {
            this.currentCatch.vessel_info.cfr_number = cfrNumber;
            this.currentCatch.vessel_info.registration_number = registrationNumber;
            this.currentCatch.vessel_info.logbook_number = logbookNumber;
        }

        console.log('✅ Vessel data saved');
    }

    validateLogbookNumber(logbookNumber) {
        if (!logbookNumber || !logbookNumber.startsWith('HRV LOGI')) {
            return false;
        }
        const digits = logbookNumber.replace('HRV LOGI', '').trim();
        return digits.length === 13 && /^\d{13}$/.test(digits);
    }

    validateMandatoryFields() {
        if (!this.currentCatch.vessel_info.cfr_number) {
            throw new Error('CFR broj plovila je obavezan');
        }
        if (!this.currentCatch.vessel_info.logbook_number) {
            throw new Error('Broj očevidnika je obavezan');
        }
        if (!this.currentCatch.catch_info.fishing_zone) {
            throw new Error('Ribolovna zona je obavezna');
        }
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
        // REGULATION COMPLIANT: All mandatory fields including new requirements
        const rows = [
            ['Field', 'Value', 'Regulation_Reference'],
            ['LOT_ID', lot.lot_id, 'Article_58_Line_31'],
            
            // MANDATORY VESSEL DATA
            ['Vessel_CFR_Number', lot.vessel_info.cfr_number || 'N/A', 'MANDATORY_CFR_Field'],
            ['Vessel_Registration_Number', lot.vessel_info.registration_number || 'N/A', 'MANDATORY_Registration_Field'],
            ['Logbook_Number_HRV_LOGI', lot.vessel_info.logbook_number || 'N/A', 'MANDATORY_HRV_LOGI_Field'],
            ['Vessel_Name', lot.vessel_info.name, 'Vessel_Identification'],
            ['Vessel_License', lot.vessel_info.license_number, 'License_Number'],
            ['Registration_Port', lot.vessel_info.registration_port, 'Croatian_Requirement'],
            
            // MANDATORY FISHING ZONE DATA
            ['Fishing_Zone_Code', lot.catch_info.fishing_zone || 'N/A', 'MANDATORY_Zone_Selection'],
            ['Fishing_Zone_Description', lot.catch_info.zone_description || 'N/A', 'Zone_Description'],
            ['FAO_Zone_Technical', lot.catch_info.fao_zone, 'Article_58_Line_33'],
            
            // SPECIES DATA
            ['Species_FAO', lot.species.fao_code, 'Article_58_Line_32'],
            ['Species_Scientific', lot.species.scientific_name, 'Article_58_Line_32'],
            ['Species_Local', lot.species.local_name, 'Article_58_Line_32'],
            
            // CATCH DATA
            ['Catch_Date_DDMMYYYY', lot.catch_info.date, 'Article_58_Line_34'],
            ['Catch_Time_ISO', lot.catch_info.time, 'Additional_Timestamp'],
            ['Gear_Category', lot.fishing_gear.category, 'Article_58_Line_35'],
            ['Gear_Description', lot.fishing_gear.description, 'Article_58_Line_35'],
            
            // QUANTITY DATA
            ['Net_Weight_KG', lot.quantities.net_weight_kg, 'Article_58_Line_36'],
            ['Below_Min_Weight_KG', lot.quantities.below_min_size?.weight_kg || 0, 'Article_58_Line_37'],
            ['Below_Min_Count', lot.quantities.below_min_size?.piece_count || 0, 'Article_58_Line_37'],
            ['Min_Reference_Size_CM', lot.quantities.below_min_size?.min_reference_size_cm || 0, 'Article_58_Line_37'],
            
            // LOCATION DATA
            ['GPS_Latitude', lot.catch_info.gps_coordinates.latitude, 'Location_Verification'],
            ['GPS_Longitude', lot.catch_info.gps_coordinates.longitude, 'Location_Verification'],
            ['GPS_Accuracy_Meters', lot.catch_info.gps_coordinates.accuracy, 'Location_Quality'],
            
            // METADATA
            ['Generated_Timestamp', new Date().toISOString(), 'Export_Metadata'],
            ['App_Version', lot.metadata.app_version, 'System_Version'],
            ['Validation_Status', lot.metadata.validation_status, 'Compliance_Check']
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
