// Professional Fishermen Application Controller
class ProfessionalFishermanApp {
    constructor() {
        this.currentScreen = 'screen-vessel-setup';
        this.currentWeight = '0';
        this.isInitialized = false;
        this.allSpecies = [];
        this.selectedSpecies = null;
        this.selectedZoneCode = null;
        this.vesselConfig = null;
        this.currentCatch = null;
        this.dailyStats = { count: 0, total_weight_kg: 0 };
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

    setupEventListeners() {
        // Vessel setup form
        const saveVesselBtn = document.getElementById('save-vessel-btn');
        if (saveVesselBtn) {
            saveVesselBtn.addEventListener('click', () => this.saveVesselConfiguration());
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

        // Undersized catch radio buttons
        const undersizedRadios = document.querySelectorAll('input[name="undersized"]');
        undersizedRadios.forEach(radio => {
            radio.addEventListener('change', () => this.toggleUndersizedInput());
        });

        // Continue button (quantity screen)
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.generateProfessionalLOT());
        }

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
        const gearSelect = document.getElementById('gear-category-select');

        if (cfrInput) cfrInput.value = savedConfig.cfr_number || '';
        if (registrationInput) registrationInput.value = savedConfig.registration_mark || '';
        if (logbookInput && savedConfig.logbook_number) {
            logbookInput.value = savedConfig.logbook_number.replace('HRVLOG', '').trim();
        }
        if (vesselNameInput) vesselNameInput.value = savedConfig.vessel_name || '';
        if (gearSelect) gearSelect.value = savedConfig.fishing_gear_category || '';
    }

    async saveVesselConfiguration() {
        try {
            const cfrInput = document.getElementById('cfr-input');
            const registrationInput = document.getElementById('registration-input');
            const logbookInput = document.getElementById('logbook-input');
            const vesselNameInput = document.getElementById('vessel-name-input');
            const gearSelect = document.getElementById('gear-category-select');
            const errorDiv = document.getElementById('vessel-errors');

            const configData = {
                cfr_number: cfrInput.value.trim().toUpperCase(),
                registration_mark: registrationInput.value.trim().toUpperCase(),
                logbook_number: `HRVLOG${logbookInput.value.trim()}`,
                vessel_name: vesselNameInput.value.trim(),
                fishing_gear_category: gearSelect.value
            };

            // Validate and save configuration
            this.vesselConfig = await window.vesselConfigManager.saveConfig(configData);
            
            console.log('✅ Vessel configuration saved:', this.vesselConfig);
            
            // Clear any errors
            errorDiv.style.display = 'none';
            
            // Proceed to fishing zone selection
            this.goToScreen('screen-fishing-zone');
            this.renderFishingZones();
            
        } catch (error) {
            console.error('❌ Vessel configuration save failed:', error);
            this.showVesselError(error.message);
        }
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

    // FISHING ZONE METHODS

    renderFishingZones() {
        const zoneGrid = document.getElementById('zone-grid');
        if (!zoneGrid) return;
        
        const zones = window.lotGenerator.getFishingZones();
        zoneGrid.innerHTML = '';
        
        zones.forEach(zone => {
            const zoneBtn = document.createElement('button');
            zoneBtn.className = 'zone-btn';
            zoneBtn.innerHTML = `
                <div class="zone-code">${zone.code}</div>
                <div class="zone-desc">${zone.description}</div>
            `;
            
            zoneBtn.addEventListener('click', () => this.selectFishingZone(zone.code, zone.description));
            zoneGrid.appendChild(zoneBtn);
        });
    }

    selectFishingZone(zoneCode, zoneDescription) {
        // Update UI selection
        document.querySelectorAll('.zone-btn').forEach(btn => btn.classList.remove('selected'));
        event.target.closest('.zone-btn').classList.add('selected');
        
        this.selectedZoneCode = zoneCode;
        
        // Show confirmation
        const zoneDescElement = document.getElementById('zone-description');
        const selectedZoneInfo = document.getElementById('selected-zone-info');
        const confirmBtn = document.getElementById('confirm-zone-btn');
        
        if (zoneDescElement) zoneDescElement.textContent = zoneDescription;
        if (selectedZoneInfo) selectedZoneInfo.style.display = 'block';
        if (confirmBtn) confirmBtn.style.display = 'block';
    }

    async confirmFishingZone() {
        if (!this.selectedZoneCode) {
            this.showError('Molimo odaberite ribolovnu zonu');
            return;
        }
        
        try {
            await window.lotGenerator.setFishingZone(this.selectedZoneCode);
            console.log('✅ Fishing zone confirmed:', this.selectedZoneCode);
            this.goToScreen('screen-species');
        } catch (error) {
            this.showError('Greška pri odabiru zone: ' + error.message);
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

    // QUANTITY AND UNDERSIZED CATCH METHODS

    toggleUndersizedInput() {
        const undersizedYes = document.getElementById('undersized-yes');
        const quantityInput = document.getElementById('undersized-quantity-input');
        
        if (undersizedYes.checked) {
            quantityInput.classList.remove('hidden');
        } else {
            quantityInput.classList.add('hidden');
            document.getElementById('undersized-weight').value = '';
        }
    }

    // PROFESSIONAL LOT GENERATION

    async generateProfessionalLOT() {
        try {
            // Validate inputs
            const weight = parseFloat(this.currentWeight);
            if (!weight || weight <= 0) {
                throw new Error('Težina mora biti veća od 0 kg');
            }

            if (!this.selectedSpecies) {
                throw new Error('Vrsta mora biti odabrana');
            }

            if (!this.vesselConfig) {
                throw new Error('Konfiguracija plovila je obavezna');
            }

            // Get undersized catch data
            const undersizedPresent = document.getElementById('undersized-yes').checked;
            let undersizedWeight = 0;
            
            if (undersizedPresent) {
                undersizedWeight = parseFloat(document.getElementById('undersized-weight').value);
                if (!undersizedWeight || undersizedWeight <= 0) {
                    throw new Error('Količina ribe ispod minimalne veličine je obavezna');
                }
                if (undersizedWeight > weight) {
                    throw new Error('Količina ribe ispod minimalne veličine ne može biti veća od ukupne težine');
                }
            }

            // Generate LOT using new architecture
            const lotId = window.lotManager.generateLOTIdentifier(
                this.selectedSpecies,
                this.vesselConfig,
                { pattern: window.lotManager.lotPatterns.WITH_DATE }
            );

            // Create comprehensive traceability record
            const catchData = {
                fao_zone: '37.2.1', // Croatian Adriatic
                catch_date: new Date(),
                net_weight_kg: weight,
                undersized_catch_present: undersizedPresent,
                undersized_quantity_kg: undersizedPresent ? undersizedWeight : null
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

    // Legacy method compatibility
    filterSpecies(query) {
        // Implement species filtering logic
        console.log('Filtering species:', query);
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
