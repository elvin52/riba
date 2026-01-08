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
        
        // Simplified destination selection
        const destinationSelect = document.getElementById('destination-select');
        if (destinationSelect) {
            destinationSelect.addEventListener('change', () => {
                this.handleDestinationChange();
                this.updateTraceabilityPreview();
            });
        }
        
        // Custom destination input
        const destinationCustom = document.getElementById('destination-custom');
        if (destinationCustom) {
            destinationCustom.addEventListener('input', () => this.updateTraceabilityPreview());
        }
        
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
        const fishermanNameInput = document.getElementById('fisherman-name-input');
        const gearSelect = document.getElementById('fishing-gear-select');

        if (cfrInput) cfrInput.value = savedConfig.cfr_number || '';
        if (registrationInput) registrationInput.value = savedConfig.registration_mark || '';
        if (logbookInput && savedConfig.logbook_number) {
            logbookInput.value = savedConfig.logbook_number.replace('HRVLOG', '').trim();
        }
        if (fishermanNameInput) fishermanNameInput.value = savedConfig.fisherman_name || '';
        if (gearSelect) gearSelect.value = savedConfig.fishing_gear_category || '';
    }

    // Get vessel form data from DOM elements
    getVesselFormData() {
        const cfrInput = document.getElementById('cfr-input');
        const registrationInput = document.getElementById('registration-input');
        const logbookInput = document.getElementById('logbook-input');
        const fishermanNameInput = document.getElementById('fisherman-name-input');

        const logbookDigits = logbookInput ? logbookInput.value.trim() : '';
        const logbookNumber = logbookDigits ? 'HRVLOG' + logbookDigits : '';

        const gearSelect = document.getElementById('fishing-gear-select');
        
        return {
            cfr_number: cfrInput ? cfrInput.value.trim() : '',
            registration_mark: registrationInput ? registrationInput.value.trim() : '',
            logbook_number: logbookNumber,
            fisherman_name: fishermanNameInput ? fishermanNameInput.value.trim() : '',
            fishing_gear_category: gearSelect ? gearSelect.value : 'MIXED'
        };
    }

    async saveVesselData() {
        try {
            console.log(' Saving vessel configuration...');
            
            const vesselData = this.getVesselFormData();
            
            // Save to vessel config manager (validation is handled internally)
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
        
        if (!vesselData.fisherman_name || vesselData.fisherman_name.length < 2) {
            errors.push('Ime ribara mora imati najmanje 2 znaka');
        }
        
        if (!vesselData.fishing_gear_category) {
            errors.push('Ribolovni alat je obavezan (EU 2023/2842)');
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
        
        // Croatian CFR format: 3 letters + 9-12 digits
        if (!/^[A-Z]{3}\d{9,12}$/.test(value)) {
            input.style.borderColor = '#dc2626';
            return false;
        } else {
            input.style.borderColor = '#10b981';
            return true;
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
        const destinationSelect = document.getElementById('destination-select');
        const destinationCustom = document.getElementById('destination-custom');
        
        if (productFormSelect) productFormSelect.value = '';
        if (purposePhaseSelect) purposePhaseSelect.value = '';
        if (destinationSelect) destinationSelect.value = '';
        if (destinationCustom) {
            destinationCustom.value = '';
            destinationCustom.classList.add('hidden');
        }
        
        this.updateTraceabilityPreview();
        this.goToScreen('screen-traceability');
    }
    
    // Handle destination selection changes (simplified for elderly users)
    handleDestinationChange() {
        const destinationSelect = document.getElementById('destination-select');
        const destinationCustom = document.getElementById('destination-custom');
        
        if (destinationSelect?.value === 'DRUGO') {
            // Show custom input for "other" option
            destinationCustom.classList.remove('hidden');
            destinationCustom.focus();
        } else {
            // Hide custom input for standard options
            destinationCustom.classList.add('hidden');
            destinationCustom.value = '';
        }
    }

    updateTraceabilityPreview() {
        const productForm = document.getElementById('product-form-select')?.value;
        const purposePhase = document.getElementById('purpose-phase-select')?.value;
        
        // Get destination from either dropdown or custom input
        const destinationSelect = document.getElementById('destination-select')?.value;
        const destinationCustom = document.getElementById('destination-custom')?.value;
        const destination = destinationSelect === 'DRUGO' ? destinationCustom : destinationSelect;
        
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
            
            // Handle both WEIGHT and UNITS quantity types
            if (this.currentLOTRecord.quantity.quantity_type === 'WEIGHT' && this.currentLOTRecord.quantity.net_weight_kg) {
                this.dailyStats.total_weight_kg += this.currentLOTRecord.quantity.net_weight_kg;
            } else if (this.currentLOTRecord.quantity.quantity_type === 'UNITS' && this.currentLOTRecord.quantity.unit_count) {
                // For units, we can't add to weight - could track units separately if needed
                // For now, keep weight stats for WEIGHT type only
            }
            
            // Update UI
            const countElement = document.getElementById('daily-count');
            const weightElement = document.getElementById('daily-weight');
            
            if (countElement) countElement.textContent = this.dailyStats.count;
            if (weightElement && this.dailyStats.total_weight_kg > 0) {
                weightElement.textContent = this.dailyStats.total_weight_kg.toFixed(1) + ' kg';
            }
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

    // Render species grid for selection with improved UX
    renderSpeciesGrid() {
        const speciesGrid = document.getElementById('species-grid');
        if (!speciesGrid || !this.allSpecies || this.allSpecies.length === 0) {
            console.warn('⚠️ Species grid not found or no species data');
            return;
        }
        
        console.log(`🐟 Rendering ${this.allSpecies.length} species with improved UX`);
        
        // Croatian fisherman-friendly categories with emojis and descriptions
        const categories = {
            '🐟 Bijela riba': {
                description: 'Najčešće ulovljene bijele ribe',
                species: ['BSS', 'SBG', 'RPG', 'DNT', 'CBM', 'SOL', 'SSB', 'BRB', 'PAC'],
                color: 'bg-blue-50 border-blue-200'
            },
            '🔵 Plava riba': {
                description: 'Sitna plava riba za tržište',
                species: ['PIL', 'ANE', 'MAC', 'VMA', 'HOM', 'HMM', 'SPR'],
                color: 'bg-indigo-50 border-indigo-200'
            },
            '🐙 Glavonošci': {
                description: 'Hobotnice, lignje i sipice',
                species: ['OCC', 'SQR', 'CTC', 'OCM', 'EDT', 'EOI'],
                color: 'bg-purple-50 border-purple-200'
            },
            '🦞 Školjke i rakovi': {
                description: 'Školjkaši i rakovi',
                species: ['LBE', 'SLO', 'NEP', 'DPS', 'MSM', 'OYF', 'SVE', 'SCR'],
                color: 'bg-orange-50 border-orange-200'
            },
            '🦈 Hrskavičnjače': {
                description: 'Morski psi i raže',
                species: ['DGS', 'SDS', 'SMD', 'RJC', 'SYC', 'SYT'],
                color: 'bg-gray-50 border-gray-200'
            },
            '🌊 Ostala morska riba': {
                description: 'Dodatne uobičajene vrste (20 najčešćih)',
                species: ['VEV', 'CTG', 'RKQ', 'KLK', 'AMB', 'TTO', 'MYL', 'JAI', 'UGR', 'CRA', 'FLE', 'TUR', 'RSK', 'GUG', 'GFB', 'WHB', 'BLU', 'ALB', 'BOG', 'MUL'], // Limited to 20 most common additional species
                color: 'bg-teal-50 border-teal-200'
            }
        };

        // Create modern tabbed interface with search
        let html = `
            <div class="species-interface">
                <!-- Search Bar for All Species -->
                <div class="species-search-container">
                    <div class="search-bar">
                        <input type="text" id="species-search" placeholder="🔍 Pretraži sve vrste..." onkeyup="window.professionalFishermanApp.filterSpecies(this.value)">
                    </div>
                    <div id="search-results" class="search-results hidden"></div>
                </div>

                <!-- Category Tabs -->
                <div class="category-tabs-container">
                    <div class="category-tabs" id="category-tabs">
        `;

        // Create tabs
        Object.keys(categories).forEach((categoryName, index) => {
            const isActive = index === 0 ? 'active' : '';
            const tabId = `tab-${index}`;
            html += `
                <button class="category-tab ${isActive}" data-category="${index}" onclick="window.professionalFishermanApp.showSpeciesCategory(${index})">
                    ${categoryName}
                </button>
            `;
        });

        html += `
                    </div>
                </div>

                <!-- Species Content Area -->
                <div class="species-content-area" id="species-content">
        `;

        // Create content for each category
        Object.entries(categories).forEach(([categoryName, categoryData], index) => {
            // Only show species that are explicitly listed in categories
            const categorySpecies = this.allSpecies.filter(species => 
                categoryData.species.includes(species.fao_code)
            );

            const isActive = index === 0 ? 'active' : 'hidden';
            
            html += `
                <div class="species-category-content ${isActive}" data-category="${index}">
                    <div class="category-header ${categoryData.color}">
                        <h3 class="category-title">${categoryName}</h3>
                        <p class="category-description">${categoryData.description}</p>
                        <div class="species-count">${categorySpecies.length} vrsta</div>
                    </div>
                    
                    <div class="species-grid-modern">
            `;

            // Add species cards with better design
            categorySpecies.forEach(species => {
                const emoji = species.emoji || '🐟';
                html += `
                    <div class="modern-species-card" onclick="window.professionalFishermanApp.selectSpecies('${species.fao_code}')">
                        <div class="species-emoji">${emoji}</div>
                        <div class="species-info">
                            <div class="species-name-modern">${species.local_name}</div>
                            <div class="species-scientific-small">${species.scientific_name || ''}</div>
                            <div class="species-fao-badge">${species.fao_code}</div>
                        </div>
                        <div class="select-indicator">
                            <span class="select-arrow">→</span>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        speciesGrid.innerHTML = html;
        
        // Initialize first category as active
        this.activeSpeciesCategory = 0;
    }

    // Show specific species category
    showSpeciesCategory(categoryIndex) {
        // Update active tab
        document.querySelectorAll('.category-tab').forEach((tab, index) => {
            if (index === categoryIndex) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active content
        document.querySelectorAll('.species-category-content').forEach((content, index) => {
            if (index === categoryIndex) {
                content.classList.remove('hidden');
                content.classList.add('active');
            } else {
                content.classList.add('hidden');
                content.classList.remove('active');
            }
        });

        this.activeSpeciesCategory = categoryIndex;
        console.log(`📂 Switched to category ${categoryIndex}`);
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
                <div class="species-card" onclick="window.professionalFishermanApp.selectSpecies('${species.fao_code}')">
                    <div class="species-name">${species.local_name}</div>
                    <div class="species-fao">${species.fao_code}</div>
                </div>`;
        });
        
        speciesGrid.innerHTML = gridHTML;
        console.log(`🔍 Filtered to ${filtered.length} species for "${query}"`);
    }

    async downloadPDF() {
        if (!this.currentLOTRecord) {
            this.showError('Nema LOT podataka za PDF izvoz');
            return;
        }

        try {
            // Generate PDF content using human-readable format
            const pdfContent = this.generatePDFContent(this.currentLOTRecord);
            
            // Create new window for printing
            const pdfWindow = window.open('', '_blank');
            pdfWindow.document.write(pdfContent);
            pdfWindow.document.close();
            
            // Auto-print when loaded
            pdfWindow.onload = () => {
                pdfWindow.print();
            };
            
            console.log('✅ PDF generated for LOT:', this.currentLOTRecord.lot_id);
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            this.showError('Greška pri generiranju PDF-a: ' + error.message);
        }
    }

    generatePDFContent(record) {
        const quantityDisplay = record.quantity.quantity_type === 'WEIGHT' 
            ? `${record.quantity.net_weight_kg} kg`
            : `${record.quantity.unit_count} kom`;
            
        const undersizedDisplay = record.quantity.undersized_catch_present
            ? (record.quantity.quantity_type === 'WEIGHT'
                ? `Da (${record.quantity.undersized_weight_kg || 0} kg)`
                : `Da (${record.quantity.undersized_unit_count || 0} kom)`)
            : 'Ne';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LOT ${record.lot_id} - Ribaška deklaracija</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .lot-info { border: 2px solid #333; padding: 15px; margin-bottom: 20px; }
        .section { margin-bottom: 15px; }
        .label { font-weight: bold; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐟 RIBAŠKA LOT DEKLARACIJA</h1>
        <h2>LOT ${record.lot_id}</h2>
    </div>
    
    <div class="lot-info">
        <div class="section">
            <span class="label">Datum ulova:</span> ${record.fishing.catch_date}${record.fishing.catch_time ? ` ${record.fishing.catch_time}` : ''}
        </div>
        <div class="section">
            <span class="label">Vrsta:</span> ${record.species.local_name} (${record.species.fao_code})
        </div>
        <div class="section">
            <span class="label">Znanstveni naziv:</span> ${record.species.scientific_name}
        </div>
        <div class="section">
            <span class="label">Područje proizvodnje:</span> ${record.production_area.description} (${record.production_area.fao_zone})
        </div>
        <div class="section">
            <span class="label">Količina:</span> ${quantityDisplay}
        </div>
        <div class="section">
            <span class="label">Ribaski alat:</span> ${record.fishing.fishing_gear_category}
        </div>
        <div class="section">
            <span class="label">Riba ispod minimalne veličine:</span> ${undersizedDisplay}
        </div>
    </div>
    
    <div class="lot-info">
        <h3>Podaci o plovilu</h3>
        <div class="section">
            <span class="label">CFR broj:</span> ${record.vessel.cfr_number}
        </div>
        <div class="section">
            <span class="label">Registarska oznaka:</span> ${record.vessel.registration_mark}
        </div>
        <div class="section">
            <span class="label">Broj očevidnika:</span> ${record.vessel.logbook_number}
        </div>
        ${record.vessel.vessel_name ? `<div class="section"><span class="label">Ime plovila:</span> ${record.vessel.vessel_name}</div>` : ''}
    </div>
    
    <div class="lot-info">
        <h3>Sljedivost</h3>
        <div class="section">
            <span class="label">Oblik proizvoda:</span> ${record.traceability.product_form}
        </div>
        <div class="section">
            <span class="label">Namjena/faza:</span> ${record.traceability.purpose_phase}
        </div>
        <div class="section">
            <span class="label">Odredište:</span> ${record.traceability.destination}
        </div>
    </div>
    
    <div class="footer">
        <p>Generirano: ${new Date().toLocaleString('hr-HR')}</p>
        <p>EU Uredba 2023/2842 - Sljedivost ribljih proizvoda</p>
    </div>
</body>
</html>`;
    }

    generateLabelContent(record) {
        const quantityDisplay = record.quantity.quantity_type === 'WEIGHT' 
            ? `${record.quantity.net_weight_kg} kg`
            : `${record.quantity.unit_count} kom`;

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Nalijepnica LOT ${record.lot_id}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 5px; 
            font-size: 14px;
            width: 350px;
        }
        .label-container { 
            border: 3px solid #000; 
            padding: 10px; 
            text-align: center;
        }
        .lot-number { 
            font-size: 24px; 
            font-weight: bold; 
            margin-bottom: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
        }
        .species { 
            font-size: 18px; 
            margin-bottom: 8px;
        }
        .details { 
            font-size: 12px; 
            margin: 5px 0;
        }
        .footer { 
            font-size: 10px; 
            margin-top: 10px;
            border-top: 1px solid #000;
            padding-top: 5px;
        }
    </style>
</head>
<body>
    <div class="label-container">
        <div class="lot-number">LOT ${record.lot_id}</div>
        <div class="species">${record.species.local_name}</div>
        <div class="species">(${record.species.fao_code})</div>
        <div class="details">Količina: ${quantityDisplay}</div>
        <div class="details">Datum: ${record.fishing.catch_date}</div>
        <div class="details">FAO zona: ${record.production_area.fao_zone}</div>
        <div class="details">CFR: ${record.vessel.cfr_number}</div>
        <div class="footer">EU 2023/2842 | ${this.formatDateDDMMYYYY(new Date())}</div>
    </div>
</body>
</html>`;
    }

    // Format date for Croatian compliance (DD/MM/YYYY)
    formatDateDDMMYYYY(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Filter species by search term (shows all species when searching)
    filterSpecies(searchTerm) {
        const searchResults = document.getElementById('search-results');
        const categoryTabs = document.getElementById('category-tabs').parentElement;
        const speciesContent = document.getElementById('species-content');
        
        if (!searchTerm || searchTerm.length < 2) {
            // Hide search results, show categories
            searchResults.classList.add('hidden');
            categoryTabs.style.display = 'block';
            speciesContent.style.display = 'block';
            return;
        }
        
        // Show search results, hide categories
        searchResults.classList.remove('hidden');
        categoryTabs.style.display = 'none';
        speciesContent.style.display = 'none';
        
        // Filter all species by search term
        const filteredSpecies = this.allSpecies.filter(species => 
            species.local_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            species.scientific_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            species.fao_code.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        // Display search results
        let html = `
            <div class="search-results-header">
                <h3>Rezultati pretrage: "${searchTerm}" (${filteredSpecies.length} vrsta)</h3>
            </div>
            <div class="species-grid-modern">
        `;
        
        filteredSpecies.forEach(species => {
            const emoji = species.emoji || '🐟';
            html += `
                <div class="modern-species-card" onclick="window.professionalFishermanApp.selectSpecies('${species.fao_code}')">
                    <div class="species-emoji">${emoji}</div>
                    <div class="species-info">
                        <div class="species-name-modern">${species.local_name}</div>
                        <div class="species-scientific-small">${species.scientific_name || ''}</div>
                        <div class="species-fao-badge">${species.fao_code}</div>
                    </div>
                    <div class="select-indicator">
                        <span class="select-arrow">→</span>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        searchResults.innerHTML = html;
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

window.generateLabel = function() {
    const app = window.professionalFishermanApp;
    if (!app.currentLOTRecord) {
        app.showError('Nema LOT podataka za generiranje nalijepnice');
        return;
    }

    try {
        // Generate printable label content
        const labelContent = app.generateLabelContent(app.currentLOTRecord);
        
        // Create new window for printing label
        const labelWindow = window.open('', '_blank', 'width=400,height=300');
        labelWindow.document.write(labelContent);
        labelWindow.document.close();
        
        // Auto-print when loaded
        labelWindow.onload = () => {
            labelWindow.print();
        };
        
        console.log('✅ Label generated for LOT:', app.currentLOTRecord.lot_id);
        
    } catch (error) {
        console.error('❌ Label generation failed:', error);
        app.showError('Greška pri generiranju nalijepnice: ' + error.message);
    }
};

window.downloadPDF = function() {
    const app = window.professionalFishermanApp;
    if (app && app.downloadPDF) {
        app.downloadPDF();
    } else {
        console.error('❌ PDF download not available');
    }
};

window.downloadCSV = function() {
    const app = window.professionalFishermanApp;
    if (app && app.exportLOT) {
        app.exportLOT('csv');
    } else {
        console.error('❌ CSV download not available');
    }
};

window.showQR = function() {
    const app = window.professionalFishermanApp;
    if (!app.currentLOTRecord) {
        app.showError('Nema LOT podataka za QR kod');
        return;
    }
    
    // Simple QR code placeholder - could be enhanced with QR library
    const modal = document.getElementById('qr-modal');
    const lotIdSpan = document.getElementById('qr-lot-id');
    if (modal && lotIdSpan) {
        lotIdSpan.textContent = app.currentLOTRecord.lot_id;
        modal.classList.remove('hidden');
    }
};

window.newCatch = function() {
    const app = window.professionalFishermanApp;
    if (app && app.goToScreen) {
        // Reset to fishing zone selection for new catch
        app.goToScreen('screen-fishing-zone');
        app.renderFishingZones();
    } else {
        console.error('❌ New catch function not available');
    }
};

window.closeModal = function() {
    const modal = document.getElementById('qr-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};
