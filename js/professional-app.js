// Professional Fishermen Application Controller
class ProfessionalFishermanApp {
    constructor() {
        this.currentScreen = 'screen-vessel-setup';
        this.currentWeight = '0';
        this.currentQuantityType = 'WEIGHT'; // 'WEIGHT' | 'UNITS'
        this.isInitialized = false;
        this.allSpecies = [];
        this.selectedSpecies = null;
        this.selectedZoneCode = null; // Legacy - keeping for compatibility
        this.selectedFAOZone = null; // EU compliant FAO zone selection
        this.currentFAOZone = null;  // Currently active FAO zone
        this.vesselConfig = null;
        this.currentCatch = null;
        this.dailyStats = { count: 0, total_weight_kg: 0 };
        
        // Traceability data
        this.traceabilityData = {
            product_form: null,
            purpose_phase: null,
            destination: null
        };
    }

    async init() {
        try {
            console.log('🏢 Inicijalizacija profesionalne ribaske aplikacije...');
            
            // Initialize database and GPS
            await window.fishermanDB.init();
            this.allSpecies = await window.fishermanDB.getAllSpecies();
            this.dailyStats = await window.fishermanDB.getDailyStats();
            
            // Initialize vessel configuration and LOT managers
            await window.vesselConfigManager.loadConfig();
            window.lotManager.loadLOTPatternPreference();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Determine starting screen based on vessel configuration
            this.vesselConfig = window.vesselConfigManager.getConfig();
            if (!this.vesselConfig) {
                console.log('🚢 No vessel configuration - starting with setup');
                this.goToScreen('screen-vessel-setup');
                this.loadVesselSetupForm();
            } else {
                console.log('✅ Vessel configured - starting with fishing zone selection');
                this.goToScreen('screen-fishing-zone');
                this.renderFishingZones();
            }
            
            // Start time updates
            setInterval(() => this.updateDateTime(), 1000);
            
            this.isInitialized = true;
            console.log('🎣 Profesionalna aplikacija spremna!');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.showError('Greška inicijalizacije: ' + error.message);
        }
    }
    
    setupTraceabilityListeners() {
        // Product form change
        const productFormSelect = document.getElementById('product-form-select');
        if (productFormSelect) {
            productFormSelect.addEventListener('change', () => this.updateTraceabilityPreview());
        }
        
        // Purpose phase change
        const purposePhaseSelect = document.getElementById('purpose-phase-select');
        if (purposePhaseSelect) {
            purposePhaseSelect.addEventListener('change', () => this.updateTraceabilityPreview());
        }
        
        // Destination input change
        const destinationInput = document.getElementById('destination-input');
        if (destinationInput) {
            destinationInput.addEventListener('input', () => this.updateTraceabilityPreview());
        }
        
        // Quick destination buttons
        const destinationBtns = document.querySelectorAll('.destination-btn');
        destinationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const destination = e.target.getAttribute('data-destination');
                destinationInput.value = destination;
                this.updateTraceabilityPreview();
            });
        });
        
        // Back to quantity button
        const backToQuantityBtn = document.getElementById('back-to-quantity-btn');
        if (backToQuantityBtn) {
            backToQuantityBtn.addEventListener('click', () => this.goToScreen('screen-quantity'));
        }
        
        // Generate LOT button (final)
        const generateLotBtn = document.getElementById('generate-lot-btn');
        if (generateLotBtn) {
            generateLotBtn.addEventListener('click', () => this.generateProfessionalLOTWithTraceability());
        }
    }

    setupEventListeners() {
        // Vessel setup form
        const saveVesselBtn = document.getElementById('save-vessel-btn');
        if (saveVesselBtn) {
            saveVesselBtn.addEventListener('click', () => this.saveVesselData());
        }

        // Gear category validation
        const gearSelect = document.getElementById('gear-category-select');
        if (gearSelect) {
            gearSelect.addEventListener('change', () => this.validateGearCategory());
        }

        // Logbook input validation (HRVLOG format)
        const logbookInput = document.getElementById('logbook-input');
        if (logbookInput) {
            logbookInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                this.validateLogbookInput();
            });
        }

        // CFR input validation
        const cfrInput = document.getElementById('cfr-input');
        if (cfrInput) {
            cfrInput.addEventListener('input', () => this.validateCFRInput());
        }

        // Fishing zone confirmation
        const confirmZoneBtn = document.getElementById('confirm-zone-btn');
        if (confirmZoneBtn) {
            confirmZoneBtn.addEventListener('click', () => this.confirmFishingZone());
        }

        // Species search and selection
        const speciesSearch = document.getElementById('species-search');
        if (speciesSearch) {
            speciesSearch.addEventListener('input', (e) => this.filterSpecies(e.target.value));
        }

        // Quantity type selection buttons
        const quantityTypeBtns = document.querySelectorAll('.quantity-type-btn');
        quantityTypeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchQuantityType(e.target.dataset.type));
        });
        
        // Undersized catch radio buttons
        const undersizedRadios = document.querySelectorAll('input[name="undersized"]');
        undersizedRadios.forEach(radio => {
            radio.addEventListener('change', () => this.toggleUndersizedInput());
        });

        // Continue button (quantity screen)
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.goToTraceability());
        }

        // Traceability screen listeners
        this.setupTraceabilityListeners();

        // Export buttons
        const exportPDFBtn = document.getElementById('export-pdf');
        const exportCSVBtn = document.getElementById('export-csv');
        if (exportPDFBtn) exportPDFBtn.addEventListener('click', () => this.exportLOT('pdf'));
        if (exportCSVBtn) exportCSVBtn.addEventListener('click', () => this.exportLOT('csv'));
    }

    // VESSEL CONFIGURATION METHODS

    loadVesselSetupForm() {
        const savedConfig = window.vesselConfigManager.getConfig();
        if (!savedConfig) return;

        // Populate form with existing data
        const cfrInput = document.getElementById('cfr-input');
        const registrationInput = document.getElementById('registration-input');
        const logbookInput = document.getElementById('logbook-input');
        const vesselNameInput = document.getElementById('vessel-name-input');
        const fishermanNameInput = document.getElementById('fisherman-name-input');
        const companyNameInput = document.getElementById('company-name-input');
        const oibInput = document.getElementById('oib-input');

        if (cfrInput) cfrInput.value = savedConfig.cfr_number || '';
        if (registrationInput) registrationInput.value = savedConfig.registration_mark || '';
        if (logbookInput && savedConfig.logbook_number) {
            logbookInput.value = savedConfig.logbook_number.replace('HRVLOG', '').trim();
        }
        if (vesselNameInput) vesselNameInput.value = savedConfig.vessel_name || '';
        if (fishermanNameInput) fishermanNameInput.value = savedConfig.fisherman_name || '';
        if (companyNameInput) companyNameInput.value = savedConfig.company_name || '';
        if (oibInput) oibInput.value = savedConfig.oib || '';
    }

    // Get vessel form data from DOM elements
    getVesselFormData() {
        const cfrInput = document.getElementById('cfr-input');
        const registrationInput = document.getElementById('registration-input');
        const logbookInput = document.getElementById('logbook-input');
        const vesselNameInput = document.getElementById('vessel-name-input');
        const fishermanNameInput = document.getElementById('fisherman-name-input');
        const companyNameInput = document.getElementById('company-name-input');
        const oibInput = document.getElementById('oib-input');

        const logbookDigits = logbookInput ? logbookInput.value.trim() : '';
        const logbookNumber = logbookDigits ? 'HRVLOG' + logbookDigits : '';

        return {
            cfr_number: cfrInput ? cfrInput.value.trim() : '',
            registration_mark: registrationInput ? registrationInput.value.trim() : '',
            logbook_number: logbookNumber,
            vessel_name: vesselNameInput ? vesselNameInput.value.trim() : '',
            fisherman_name: fishermanNameInput ? fishermanNameInput.value.trim() : '',
            company_name: companyNameInput ? companyNameInput.value.trim() : '',
            oib: oibInput ? oibInput.value.trim() : '',
            // Default gear for EU compliance (not user-visible)
            fishing_gear_category: 'MIXED'
        };
    }

    async saveVesselData() {
        try {
            console.log(' Saving vessel configuration...');
            
            const vesselData = this.getVesselFormData();
            if (!this.validateVesselData(vesselData)) {
                return; // Validation failed, errors already shown
            }
            
            // Save to vessel config manager
            await window.vesselConfigManager.saveConfig(vesselData);
            this.vesselConfig = vesselData;
            
            console.log(' Vessel configuration saved');
            
            // Proceed to fishing zone selection
            this.goToScreen('screen-fishing-zone');
            this.renderFishingZones();
            
        } catch (error) {
            console.error(' Error saving vessel data:', error);
            this.showError('Greška pri spremanju podataka o plovilu: ' + error.message);
        }
    }
    
    // Real-time vessel input validation (less strict)
    validateVesselInputs(showErrors = true) {
        const vesselData = this.getVesselFormData();
        const errorDiv = document.getElementById('vessel-errors');
        const saveBtn = document.getElementById('save-vessel-btn');
        
        if (!errorDiv || !saveBtn) return true;
        
        const errors = [];
        
        // Relaxed validation - only check if fields are not empty
        if (!vesselData.cfr_number || vesselData.cfr_number.length < 3) {
            errors.push('CFR broj mora imati najmanje 3 znaka');
        }
        
        if (!vesselData.registration_mark || vesselData.registration_mark.length < 2) {
            errors.push('Registarska oznaka mora imati najmanje 2 znaka');
        }
        
        if (!vesselData.logbook_number || vesselData.logbook_number.length < 10) {
            errors.push('Broj očevidnika mora imati najmanje 10 brojki');
        }
        
        if (showErrors && errors.length > 0) {
            errorDiv.innerHTML = errors.map(err => `<div>${err}</div>`).join('');
            errorDiv.style.display = 'block';
        } else {
            errorDiv.style.display = 'none';
        }
        
        // Enable save button if no critical errors
        saveBtn.disabled = errors.length > 0;
        saveBtn.style.opacity = errors.length > 0 ? '0.5' : '1';
        
        return errors.length === 0;
    }

    validateLogbookInput() {
        const input = document.getElementById('logbook-input');
        const value = input.value.trim();
        
        if (value.length !== 13) {
            input.style.borderColor = '#dc2626';
            return false;
        } else {
            input.style.borderColor = '#10b981';
            return true;
        }
    }

    validateCFRInput() {
        const input = document.getElementById('cfr-input');
        const value = input.value.trim().toUpperCase();
        
        if (!/^[A-Z]{3}\d{11}$/.test(value)) {
            input.style.borderColor = '#dc2626';
            return false;
        } else {
            input.style.borderColor = '#10b981';
            return true;
        }
    }

    validateGearCategory() {
        const select = document.getElementById('gear-category-select');
        if (select.value) {
            select.style.borderColor = '#10b981';
            return true;
        } else {
            select.style.borderColor = '#dc2626';
            return false;
        }
    }

    // FISHING ZONE METHODS (EU 2023/2842 COMPLIANT)

    renderFishingZones() {
        const zoneGrid = document.getElementById('zone-grid');
        if (!zoneGrid) return;
        
        // EU compliant Croatian FAO zones
        const croatianFAOZones = [
            { code: "37.2.1", name: "Jadransko more - srednji dio", description: "Srednji Jadran (Split, Šibenik, Zadar)" },
            { code: "37.2.2", name: "Jadransko more - južni dio", description: "Južni Jadran (Dubrovnik, Korčula)" },
            { code: "37.1.1", name: "Jadransko more - sjeverni dio", description: "Sjeverni Jadran (Istra, Rijeka)" },
            { code: "37.1.2", name: "Jadransko more - obalni dio", description: "Obalni dio (do 12 NM)" },
            { code: "37.1.3", name: "Kvarnerski zaljev", description: "Kvarner i otoci" },
            { code: "37.3.1", name: "Jonsko more - sjeverni dio", description: "Južni Jadran - dublje" },
            { code: "37.3.2", name: "Jonsko more - srednji dio", description: "Otvoreno more" }
        ];
        
        zoneGrid.innerHTML = '';
        
        croatianFAOZones.forEach(zone => {
            const zoneBtn = document.createElement('button');
            zoneBtn.className = 'zone-btn fao-zone-btn';
            zoneBtn.innerHTML = `
                <div class="zone-code">FAO ${zone.code}</div>
                <div class="zone-name">${zone.name}</div>
                <div class="zone-desc">${zone.description}</div>
            `;
            
            zoneBtn.addEventListener('click', () => this.selectFAOZone(zone.code, zone.name, zone.description));
            zoneGrid.appendChild(zoneBtn);
        });
    }

    selectFAOZone(faoCode, zoneName, zoneDescription) {
        // Update UI selection
        document.querySelectorAll('.zone-btn').forEach(btn => btn.classList.remove('selected'));
        event.target.closest('.zone-btn').classList.add('selected');
        
        // Store EU compliant zone data
        this.selectedFAOZone = {
            code: faoCode,
            name: zoneName, 
            description: zoneDescription
        };
        
        // Show confirmation
        const zoneDescElement = document.getElementById('zone-description');
        const selectedZoneInfo = document.getElementById('selected-zone-info');
        const confirmBtn = document.getElementById('confirm-zone-btn');
        
        if (zoneDescElement) {
            zoneDescElement.innerHTML = `
                <strong>FAO ${faoCode}</strong><br>
                ${zoneName}<br>
                <small>${zoneDescription}</small>
            `;
        }
        if (selectedZoneInfo) selectedZoneInfo.style.display = 'block';
        if (confirmBtn) confirmBtn.style.display = 'block';
    }

    async confirmFishingZone() {
        if (!this.selectedFAOZone) {
            this.showError('Molimo odaberite FAO ribolovnu zonu');
            return;
        }
        
        try {
            // Validate FAO zone using LOT manager
            if (!window.lotManager.validateFAOZone(this.selectedFAOZone.code)) {
                throw new Error(`Nevažeća FAO zona: ${this.selectedFAOZone.code}`);
            }
            
            // Store for later use in LOT generation
            this.currentFAOZone = this.selectedFAOZone;
            
            console.log(' FAO zone confirmed:', this.selectedFAOZone);
            this.goToScreen('screen-species');
            this.renderSpeciesGrid();
        } catch (error) {
            this.showError('Greška pri odabiru FAO zone: ' + error.message);
        }
    }

    // SPECIES SELECTION METHODS

    async selectSpecies(faoCode) {
        try {
            this.selectedSpecies = await window.fishermanDB.getSpeciesByFAO(faoCode);
            
            // Update UI with species info
            document.getElementById('selected-species-name').textContent = this.selectedSpecies.local_name;
            document.getElementById('species-fao').textContent = this.selectedSpecies.fao_code;
            document.getElementById('species-scientific').textContent = this.selectedSpecies.scientific_name;
            
            // Reset weight and undersized inputs
            this.currentWeight = '0';
            document.getElementById('weight-display').value = this.currentWeight;
            document.getElementById('undersized-no').checked = true;
            document.getElementById('undersized-quantity-input').classList.add('hidden');
            
            this.goToScreen('screen-quantity');
            
        } catch (error) {
            this.showError('Greška pri odabiru vrste: ' + error.message);
        }
    }

    // QUANTITY AND UNDERSIZED CATCH METHODS (EU 2023/2842 DUAL SYSTEM)
    
    switchQuantityType(type) {
        this.currentQuantityType = type;
        
        // Update UI buttons
        document.querySelectorAll('.quantity-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');
        
        // Update labels and placeholders
        const quantityLabel = document.getElementById('quantity-label');
        const weightDisplay = document.getElementById('weight-display');
        const undersizedLabel = document.getElementById('undersized-quantity-label');
        const undersizedNote = document.getElementById('undersized-quantity-note');
        
        if (type === 'WEIGHT') {
            quantityLabel.textContent = 'UKUPNO KILOGRAM:';
            weightDisplay.placeholder = '0.0 kg';
            undersizedLabel.textContent = 'Količina ribe ispod min. veličine (kg) *';
            undersizedNote.textContent = 'Obavezno ako postoji riba ispod minimalne veličine (kg)';
        } else if (type === 'UNITS') {
            quantityLabel.textContent = 'UKUPNO KOMADA:';
            weightDisplay.placeholder = '0 kom';
            undersizedLabel.textContent = 'Broj jedinki ispod min. veličine (kom) *';
            undersizedNote.textContent = 'Obavezno ako postoji riba ispod minimalne veličine (komada)';
        }
        
        // Reset current weight display
        this.currentWeight = '0';
        weightDisplay.value = this.currentWeight;
        
        console.log(`✅ Quantity type switched to: ${type}`);
    }

    toggleUndersizedInput() {
        const undersizedYes = document.getElementById('undersized-yes');
        const quantityInput = document.getElementById('undersized-quantity-input');
        
        if (undersizedYes.checked) {
            quantityInput.classList.remove('hidden');
        } else {
            quantityInput.classList.add('hidden');
            document.getElementById('undersized-quantity').value = '';
        }
    }

    // PROFESSIONAL LOT GENERATION

    goToTraceability() {
        // Validate quantity first (dual system)
        const quantityValue = parseFloat(this.currentWeight);
        if (!quantityValue || quantityValue <= 0) {
            const quantityName = this.currentQuantityType === 'WEIGHT' ? 'težina' : 'broj komada';
            this.showError(`${quantityName.charAt(0).toUpperCase() + quantityName.slice(1)} mora biti veća od 0`);
            return;
        }
        
        // Reset traceability data
        this.traceabilityData = {
            product_form: null,
            purpose_phase: null,
            destination: null
        };
        
        // Clear form
        const productFormSelect = document.getElementById('product-form-select');
        const purposePhaseSelect = document.getElementById('purpose-phase-select');
        const destinationInput = document.getElementById('destination-input');
        
        if (productFormSelect) productFormSelect.value = '';
        if (purposePhaseSelect) purposePhaseSelect.value = '';
        if (destinationInput) destinationInput.value = '';
        
        this.updateTraceabilityPreview();
        this.goToScreen('screen-traceability');
    }
    
    updateTraceabilityPreview() {
        const productForm = document.getElementById('product-form-select')?.value;
        const purposePhase = document.getElementById('purpose-phase-select')?.value;
        const destination = document.getElementById('destination-input')?.value;
        
        // Update internal state
        this.traceabilityData.product_form = productForm || null;
        this.traceabilityData.purpose_phase = purposePhase || null;
        this.traceabilityData.destination = destination || null;
        
        // Check if all required fields are filled
        const isComplete = productForm && purposePhase && destination;
        const generateBtn = document.getElementById('generate-lot-btn');
        if (generateBtn) {
            generateBtn.disabled = !isComplete;
            generateBtn.style.opacity = isComplete ? '1' : '0.5';
        }
        
        // Update preview
        const previewDiv = document.getElementById('traceability-preview');
        if (previewDiv) {
            if (isComplete) {
                previewDiv.innerHTML = `
                    <div class="traceability-complete">
                        <h4>✅ Sljedivost kompletna</h4>
                        <p><strong>Oblik:</strong> ${productForm}</p>
                        <p><strong>Namjena:</strong> ${purposePhase}</p>
                        <p><strong>Odredište:</strong> ${destination}</p>
                    </div>
                `;
            } else {
                const missing = [];
                if (!productForm) missing.push('Oblik proizvoda');
                if (!purposePhase) missing.push('Namjena/faza');
                if (!destination) missing.push('Odredište');
                
                previewDiv.innerHTML = `
                    <p class="preview-note">⚠️ Nedostaju podaci: ${missing.join(', ')}</p>
                `;
            }
        }
    }
    
    async generateProfessionalLOTWithTraceability() {
        try {
            // Validate dual quantity inputs
            const quantityValue = parseFloat(this.currentWeight);
            if (!quantityValue || quantityValue <= 0) {
                const quantityName = this.currentQuantityType === 'WEIGHT' ? 'težina' : 'broj komada';
                throw new Error(`${quantityName.charAt(0).toUpperCase() + quantityName.slice(1)} mora biti veća od 0`);
            }

            if (!this.selectedSpecies) {
                throw new Error('Vrsta mora biti odabrana');
            }

            if (!this.vesselConfig) {
                throw new Error('Konfiguracija plovila je obavezna');
            }

            // Get undersized catch data (dual quantity system)
            const undersizedPresent = document.getElementById('undersized-yes').checked;
            let undersizedQuantity = 0;
            
            if (undersizedPresent) {
                undersizedQuantity = parseFloat(document.getElementById('undersized-quantity').value);
                if (!undersizedQuantity || undersizedQuantity <= 0) {
                    const quantityName = this.currentQuantityType === 'WEIGHT' ? 'količina' : 'broj jedinki';
                    throw new Error(`${quantityName.charAt(0).toUpperCase() + quantityName.slice(1)} ribe ispod minimalne veličine je obavezna`);
                }
                if (undersizedQuantity > quantityValue) {
                    const quantityName = this.currentQuantityType === 'WEIGHT' ? 'težine' : 'broja komada';
                    throw new Error(`Ispod minimalne veličine ne može biti veće od ukupne ${quantityName}`);
                }
            }
            
            // Validate traceability data
            if (!this.traceabilityData.product_form || !this.traceabilityData.purpose_phase || !this.traceabilityData.destination) {
                throw new Error('Svi podaci o sljedivosti su obavezni');
            }

            // Generate LOT using new architecture
            const lotId = window.lotManager.generateLOTIdentifier(
                this.selectedSpecies,
                this.vesselConfig,
                { pattern: window.lotManager.lotPatterns.WITH_DATE }
            );

            // Create comprehensive traceability record with Ministry data and EU-compliant dual quantity
            const catchData = {
                // EU 2023/2842 compliant production area
                production_area_type: "FAO_ZONE",
                fao_zone: this.currentFAOZone?.code || '37.2.1', // Use selected FAO zone
                area_description: this.currentFAOZone?.name || 'Jadransko more - srednji dio',
                catch_date: new Date(),
                // EU 2023/2842 dual quantity system
                quantity_type: this.currentQuantityType,
                net_weight_kg: this.currentQuantityType === 'WEIGHT' ? quantityValue : null,
                unit_count: this.currentQuantityType === 'UNITS' ? quantityValue : null,
                undersized_catch_present: undersizedPresent,
                undersized_quantity_kg: (undersizedPresent && this.currentQuantityType === 'WEIGHT') ? undersizedQuantity : null,
                undersized_unit_count: (undersizedPresent && this.currentQuantityType === 'UNITS') ? undersizedQuantity : null,
                // Ministry-required traceability fields
                product_form: this.traceabilityData.product_form,
                purpose_phase: this.traceabilityData.purpose_phase,
                destination: this.traceabilityData.destination
            };

            const traceabilityRecord = window.lotManager.createTraceabilityRecord(
                lotId,
                this.selectedSpecies,
                this.vesselConfig,
                catchData
            );

            console.log('✅ Professional LOT created:', traceabilityRecord);

            // Display result
            this.displayProfessionalLOTResult(traceabilityRecord);
            this.updateDailyStats();
            
            this.goToScreen('screen-result');
            
        } catch (error) {
            console.error('❌ LOT generation failed:', error);
            this.showError(error.message);
        }
    }
    
    // Legacy method - redirects to traceability
    async generateProfessionalLOT() {
        console.log('Legacy LOT generation called - redirecting to traceability');
        this.goToTraceability();
    }

    displayProfessionalLOTResult(record) {
        // Display human-readable summary
        const summaryElement = document.getElementById('lot-summary');
        if (summaryElement) {
            summaryElement.innerHTML = window.lotManager.formatHumanReadable(record);
        }

        // Store current record for export
        this.currentLOTRecord = record;
    }

    // EXPORT METHODS

    async exportLOT(format) {
        if (!this.currentLOTRecord) {
            this.showError('Nema LOT podataka za izvoz');
            return;
        }

        try {
            let exportData;
            let filename;
            let mimeType;

            switch (format) {
                case 'pdf':
                    // Use existing PDF export functionality
                    await this.downloadPDF();
                    return;
                    
                case 'csv':
                    exportData = window.lotManager.exportRecord(this.currentLOTRecord.lot_id, 'csv');
                    filename = `LOT_${this.currentLOTRecord.lot_id}_${Date.now()}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                case 'json':
                    exportData = window.lotManager.exportRecord(this.currentLOTRecord.lot_id, 'json');
                    filename = `LOT_${this.currentLOTRecord.lot_id}_${Date.now()}.json`;
                    mimeType = 'application/json';
                    break;
                    
                default:
                    throw new Error('Nepoznat format izvoza');
            }

            // Download file
            const blob = new Blob([exportData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`✅ Exported ${format.toUpperCase()}:`, filename);
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showError('Greška pri izvozu: ' + error.message);
        }
    }

    // UTILITY METHODS

    updateDailyStats() {
        if (this.currentLOTRecord) {
            this.dailyStats.count++;
            this.dailyStats.total_weight_kg += this.currentLOTRecord.quantity.net_weight_kg;
            
            // Update UI
            const countElement = document.getElementById('daily-count');
            const weightElement = document.getElementById('daily-weight');
            
            if (countElement) countElement.textContent = this.dailyStats.count;
            if (weightElement) weightElement.textContent = this.dailyStats.total_weight_kg.toFixed(1) + ' kg';
        }
    }

    showVesselError(message) {
        const errorDiv = document.getElementById('vessel-errors');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    showError(message) {
        // Create or update error modal
        alert(message); // Simplified for now
    }

    goToScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }

    updateDateTime() {
        const now = new Date();
        const timeStr = now.toLocaleString('hr-HR');
        const dateTimeElement = document.getElementById('date-time');
        if (dateTimeElement) {
            dateTimeElement.textContent = `📅 ${timeStr}`;
        }
    }

    // Render species grid for selection
    renderSpeciesGrid() {
        const speciesGrid = document.getElementById('species-grid');
        if (!speciesGrid || !this.allSpecies || this.allSpecies.length === 0) {
            console.warn('⚠️ Species grid not found or no species data');
            return;
        }
        
        console.log(`🐟 Rendering ${this.allSpecies.length} species`);
        
        // Group species by categories for better UX
        const categories = {
            'Bijela riba': ['BSS', 'SBG', 'DNT', 'DEC', 'CBM', 'SOL'],
            'Plava riba': ['PIL', 'MAC', 'HER', 'ANE'],
            'Ostalo': [] // Will contain remaining species
        };
        
        let gridHTML = '';
        
        // Add categorized species
        Object.entries(categories).forEach(([categoryName, faoCodes]) => {
            const categorySpecies = this.allSpecies.filter(species => 
                faoCodes.includes(species.fao_code)
            );
            
            if (categorySpecies.length > 0) {
                gridHTML += `<div class="species-category"><h4>${categoryName}</h4></div>`;
                
                categorySpecies.forEach(species => {
                    gridHTML += `
                        <div class="species-card" onclick="window.professionalApp.selectSpecies('${species.fao_code}')">
                            <div class="species-name">${species.local_name}</div>
                            <div class="species-fao">${species.fao_code}</div>
                        </div>`;
                });
            }
        });
        
        // Add remaining species in "Ostalo"
        const usedCodes = Object.values(categories).flat();
        const remainingSpecies = this.allSpecies.filter(species => 
            !usedCodes.includes(species.fao_code)
        );
        
        if (remainingSpecies.length > 0) {
            gridHTML += `<div class="species-category"><h4>Ostalo</h4></div>`;
            remainingSpecies.forEach(species => {
                gridHTML += `
                    <div class="species-card" onclick="window.professionalApp.selectSpecies('${species.fao_code}')">
                        <div class="species-name">${species.local_name}</div>
                        <div class="species-fao">${species.fao_code}</div>
                    </div>`;
            });
        }
        
        speciesGrid.innerHTML = gridHTML;
    }
    
    // Filter species based on search query
    filterSpecies(query) {
        if (!query || query.length < 2) {
            this.renderSpeciesGrid();
            return;
        }
        
        const filtered = this.allSpecies.filter(species => 
            species.local_name.toLowerCase().includes(query.toLowerCase()) ||
            species.fao_code.toLowerCase().includes(query.toLowerCase())
        );
        
        const speciesGrid = document.getElementById('species-grid');
        if (!speciesGrid) return;
        
        let gridHTML = '';
        filtered.forEach(species => {
            gridHTML += `
                <div class="species-card" onclick="window.professionalApp.selectSpecies('${species.fao_code}')">
                    <div class="species-name">${species.local_name}</div>
                    <div class="species-fao">${species.fao_code}</div>
                </div>`;
        });
        
        speciesGrid.innerHTML = gridHTML;
        console.log(`🔍 Filtered to ${filtered.length} species for "${query}"`);
    }

    async downloadPDF() {
        // Use existing PDF export functionality
        console.log('PDF export not implemented in professional version yet');
    }
}

// Initialize professional app
document.addEventListener('DOMContentLoaded', async () => {
    window.professionalFishermanApp = new ProfessionalFishermanApp();
    await window.professionalFishermanApp.init();
});

// Global compatibility functions
window.addDigit = function(digit) {
    const app = window.professionalFishermanApp;
    if (digit === '.' && app.currentWeight.includes('.')) return;
    if (app.currentWeight === '0' && digit !== '.') {
        app.currentWeight = digit;
    } else {
        app.currentWeight += digit;
    }
    document.getElementById('weight-display').value = app.currentWeight;
};

window.deleteDigit = function() {
    const app = window.professionalFishermanApp;
    app.currentWeight = app.currentWeight.slice(0, -1) || '0';
    document.getElementById('weight-display').value = app.currentWeight;
};

window.clearWeight = function() {
    const app = window.professionalFishermanApp;
    app.currentWeight = '0';
    document.getElementById('weight-display').value = app.currentWeight;
};

window.generateLOT = function() {
    window.professionalFishermanApp.generateProfessionalLOT();
};

window.goToScreen = function(screenId) {
    window.professionalFishermanApp.goToScreen(screenId);
};
