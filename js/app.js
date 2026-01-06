// Main Application Controller
class FishermanApp {
    constructor() {
        this.currentScreen = 'screen-species'; // Skip home, go directly to species selection
        this.currentWeight = '0';
        this.isInitialized = false;
        this.allSpecies = [];
        this.dailyStats = { count: 0, total_weight_kg: 0 };
    }

    async init() {
        try {
            console.log('🐟 Inicijaliziranje Ribar LOT aplikacije...');
            
            // Check if global objects exist
            if (!window.fishermanDB) {
                throw new Error('FishermanDB nije učitan');
            }
            if (!window.gpsManager) {
                throw new Error('GPSManager nije učitan');
            }
            if (!window.lotGenerator) {
                throw new Error('LOTGenerator nije učitan');
            }
            
            // Initialize database
            console.log('📦 Inicijaliziranje baze podataka...');
            await window.fishermanDB.init();
            console.log('✅ Baza podataka inicijalizirana');
            
            // GPS bypassed - using default Croatian location
            console.log('📍 GPS bypassed - using default Croatian Adriatic location');
            console.log('✅ Location set to default Croatian waters');
            
            // Load species data
            console.log('🐟 Učitavam podatke o vrstama...');
            this.allSpecies = await window.fishermanDB.getAllSpecies();
            console.log(`✅ Učitano ${this.allSpecies.length} vrsta riba`);
            
            // Load daily stats
            console.log('📊 Učitavam dnevne statistike...');
            this.dailyStats = await window.fishermanDB.getDailyStats();
            console.log('✅ Statistike učitane');
            
            // Setup UI
            console.log('🎨 Postavljam korisničko sučelje...');
            this.setupEventListeners();
            this.updateDateTime();
            this.updateDailyCount();
            this.renderSpeciesGrid();
            
            // Automatically start new catch (skip "Novi Ulov" screen)
            console.log('🚀 Automatski pokretanje novog ulova...');
            await window.lotGenerator.startNewCatch();
            console.log('✅ Novi ulov automatski pokrenut');
            
            // Navigate directly to species selection
            this.goToScreen('screen-species');
            console.log('📱 Navigiran na izbor vrsta');
            
            // Start time updates
            setInterval(() => this.updateDateTime(), 1000);
            
            this.isInitialized = true;
            console.log('🎣 Aplikacija spremna - direktno na izbor vrsta!');
            
        } catch (error) {
            console.error('❌ Detaljne greške pri inicijalizaciji:');
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Full error object:', error);
            
            // Show user-friendly error
            const errorMsg = error.message || 'Nepoznata greška pri pokretanju';
            this.showError('Greška pri pokretanju aplikacije: ' + errorMsg);
        }
    }

    setupEventListeners() {
        // New catch button
        const newCatchBtn = document.getElementById('new-catch-btn');
        if (newCatchBtn) {
            newCatchBtn.addEventListener('click', () => this.startNewCatch());
        }

        // Species search
        const speciesSearch = document.getElementById('species-search');
        if (speciesSearch) {
            speciesSearch.addEventListener('input', (e) => this.filterSpecies(e.target.value));
        }

        // Below min size checkbox
        const belowMinCheckbox = document.getElementById('below-min-size');
        if (belowMinCheckbox) {
            belowMinCheckbox.addEventListener('change', (e) => this.toggleMinSizeInputs(e.target.checked));
        }

        // Continue button (quantity screen)
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.generateLOT());
        }

        // Modal close events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') || e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        // Prevent form submission on enter
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }

    async startNewCatch() {
        console.log('🚀 IMMEDIATE: startNewCatch function called');
        try {
            console.log('🎯 App.startNewCatch() called - INSIDE TRY BLOCK');
            this.showLoading('new-catch-btn', 'Priprema ulova...');
            
            // Check if lotGenerator exists
            if (!window.lotGenerator) {
                throw new Error('LOTGenerator nije dostupan');
            }
            
            console.log('🎯 Calling lotGenerator.startNewCatch()');
            // Initialize new catch
            await window.lotGenerator.startNewCatch();
            console.log('✅ lotGenerator.startNewCatch() completed');
            
            // Navigate to species selection
            console.log('🎯 Navigating to species screen');
            this.goToScreen('screen-species');
            console.log('✅ Navigation completed');
            
        } catch (error) {
            console.error('❌ DETAILED startNewCatch error:');
            console.error('Error name:', error?.name);
            console.error('Error message:', error?.message);
            console.error('Error stack:', error?.stack);
            console.error('Error type:', typeof error);
            console.error('Full error object:', error);
            console.error('Error constructor:', error?.constructor?.name);
            
            // Show user-friendly error
            const errorMsg = error?.message || 'Nepoznata greška';
            this.showError('Greška pokretanja ulova: ' + errorMsg);
        } finally {
            this.hideLoading('new-catch-btn', '🎣 NOVI ULOV');
        }
    }

    renderSpeciesGrid() {
        const grid = document.getElementById('species-grid');
        if (!grid) return;

        // Group species by fisherman-friendly categories
        const categories = {
            'Bijela riba': { 
                filter: ['fish'], 
                subcategories: {
                    'Donosne ribe': ['BSS', 'SBG', 'RPG', 'DEC', 'DEP', 'CBM', 'MGR'], // Sea bass, sea bream, red bream, dentex, corvina, meagre
                    'Sitna riba': ['BOG', 'SPC', 'PIC', 'BPI', 'ANN', 'SWA'], // Small white fish like bogue, picarel, annular bream
                    'Plosnate ribe': ['SOL', 'TUR', 'PLZ', 'PLE', 'LEZ'], // Flatfish like sole, turbot, plaice
                    'Ostala bijela riba': null // All other fish
                }
            },
            'Plava riba': {
                filter: ['fish'],
                codes: ['PIL', 'SAA', 'ANE', 'SPR', 'MAC', 'VMA', 'HOM', 'HMM', 'GAR'] // Sardines, anchovies, mackerel, horse mackerel
            },
            'Velika plava riba': {
                filter: ['fish'], 
                codes: ['BFT', 'ALB', 'BON', 'LTA', 'BLT', 'SWO', 'MSP', 'AMB', 'LEE', 'DOL'] // Tuna, swordfish, amberjack
            },
            'Glavonošci': {
                filter: ['cephalopod'],
                codes: null // All cephalopods
            },
            'Hrskavičnjače': {
                filter: ['cartilaginous'],
                codes: null // All sharks and rays  
            },
            'Rakovi': {
                filter: ['crustacean'], 
                codes: null // All crustaceans
            },
            'Školjkaši': {
                filter: ['mollusk'],
                codes: null // All mollusks
            },
            'Ostali organizmi': {
                filter: ['echinoderm', 'sponge', 'cnidarian', 'worm', 'gastropod', 'tunicate', 'other'],
                codes: null // Sea urchins, sponges, corals, worms
            }
        };

        grid.innerHTML = '<div class="category-tabs"></div><div class="category-content"></div>';
        
        const tabsContainer = grid.querySelector('.category-tabs');
        const contentContainer = grid.querySelector('.category-content');
        
        let activeCategory = 'Bijela riba'; // Default to most common category
        
        // Create category tabs
        Object.keys(categories).forEach((categoryName, index) => {
            const tab = document.createElement('button');
            tab.className = `category-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = categoryName;
            tab.onclick = () => this.showCategory(categoryName, categories, tabsContainer, contentContainer);
            tabsContainer.appendChild(tab);
        });
        
        // Show initial category
        this.showCategory(activeCategory, categories, tabsContainer, contentContainer);
    }

    showCategory(categoryName, categories, tabsContainer, contentContainer) {
        // Update active tab
        tabsContainer.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.textContent === categoryName);
        });
        
        const category = categories[categoryName];
        let speciesInCategory = [];
        
        // Filter species by category
        if (category.codes) {
            // Specific FAO codes
            speciesInCategory = this.allSpecies.filter(species => 
                category.codes.includes(species.fao_code)
            );
        } else {
            // Filter by category type
            speciesInCategory = this.allSpecies.filter(species => 
                category.filter.includes(species.category)
            );
        }
        
        contentContainer.innerHTML = '';
        
        // Handle subcategories for complex categories like "Bijela riba"
        if (category.subcategories) {
            Object.entries(category.subcategories).forEach(([subName, codes]) => {
                const subSection = document.createElement('div');
                subSection.className = 'species-subcategory';
                
                const subTitle = document.createElement('h4');
                subTitle.className = 'subcategory-title';
                subTitle.textContent = subName;
                subSection.appendChild(subTitle);
                
                const subGrid = document.createElement('div');
                subGrid.className = 'species-subgrid';
                
                let subSpecies;
                if (codes) {
                    subSpecies = speciesInCategory.filter(species => codes.includes(species.fao_code));
                } else {
                    // "Ostala bijela riba" - all fish not in other subcategories
                    const usedCodes = Object.values(category.subcategories)
                        .filter(c => c !== null)
                        .flat();
                    subSpecies = speciesInCategory.filter(species => !usedCodes.includes(species.fao_code));
                }
                
                subSpecies.forEach(species => {
                    subGrid.appendChild(this.createSpeciesButton(species));
                });
                
                subSection.appendChild(subGrid);
                contentContainer.appendChild(subSection);
            });
        } else {
            // Simple category - show all species in grid
            const categoryGrid = document.createElement('div');
            categoryGrid.className = 'species-subgrid';
            
            speciesInCategory.forEach(species => {
                categoryGrid.appendChild(this.createSpeciesButton(species));
            });
            
            contentContainer.appendChild(categoryGrid);
        }
    }

    createSpeciesButton(species) {
        const button = document.createElement('button');
        button.className = 'species-btn';
        button.onclick = () => this.selectSpecies(species.fao_code);
        
        button.innerHTML = `
            <div class="emoji">${species.emoji}</div>
            <div class="name">${species.local_name}</div>
            <div class="fao">${species.fao_code}</div>
        `;
        
        return button;
    }

    filterSpecies(searchTerm) {
        const grid = document.getElementById('species-grid');
        if (!grid) return;

        const buttons = grid.querySelectorAll('.species-btn');
        const term = searchTerm.toLowerCase();

        buttons.forEach(button => {
            const text = button.textContent.toLowerCase();
            const visible = text.includes(term) || term === '';
            button.style.display = visible ? 'flex' : 'none';
        });
    }

    async selectSpecies(faoCode) {
        try {
            const species = await window.lotGenerator.setSpecies(faoCode);
            
            // Update UI with species info
            document.getElementById('selected-species-name').textContent = species.local_name;
            document.getElementById('species-fao').textContent = species.fao_code;
            document.getElementById('species-scientific').textContent = species.scientific_name;
            
            // Reset weight input
            this.currentWeight = '0';
            document.getElementById('weight-display').value = this.currentWeight;
            
            // Navigate to quantity screen
            this.goToScreen('screen-quantity');
            
        } catch (error) {
            console.error('Greška pri odabiru vrste:', error);
            this.showError(error.message);
        }
    }

    addDigit(digit) {
        if (digit === '.' && this.currentWeight.includes('.')) return;
        if (this.currentWeight === '0' && digit !== '.') {
            this.currentWeight = digit;
        } else {
            this.currentWeight += digit;
        }
        
        // Limit to reasonable values
        const numValue = parseFloat(this.currentWeight);
        if (numValue > 9999) {
            this.currentWeight = '9999';
        }
        
        document.getElementById('weight-display').value = this.currentWeight;
        this.validateWeight();
    }

    deleteDigit() {
        if (this.currentWeight.length > 1) {
            this.currentWeight = this.currentWeight.slice(0, -1);
        } else {
            this.currentWeight = '0';
        }
        document.getElementById('weight-display').value = this.currentWeight;
        this.validateWeight();
    }

    clearWeight() {
        this.currentWeight = '0';
        document.getElementById('weight-display').value = this.currentWeight;
        this.validateWeight();
    }

    validateWeight() {
        const continueBtn = document.getElementById('continue-btn');
        const weight = parseFloat(this.currentWeight);
        
        if (weight > 0 && weight <= 9999) {
            continueBtn.disabled = false;
            continueBtn.classList.remove('disabled');
        } else {
            continueBtn.disabled = true;
            continueBtn.classList.add('disabled');
        }
    }

    toggleMinSizeInputs(show) {
        const inputs = document.getElementById('min-size-inputs');
        if (show) {
            inputs.classList.remove('hidden');
        } else {
            inputs.classList.add('hidden');
            // Clear values
            document.getElementById('min-size-count').value = '';
            document.getElementById('min-size-weight').value = '';
        }
    }

    async generateLOT() {
        try {
            this.showLoading('continue-btn', 'Generiram LOT...');
            
            const weight = parseFloat(this.currentWeight);
            if (weight <= 0) {
                throw new Error('Težina mora biti veća od 0 kg');
            }

            // Get below min size data if applicable
            let belowMinSize = null;
            const belowMinCheckbox = document.getElementById('below-min-size');
            if (belowMinCheckbox.checked) {
                const count = parseInt(document.getElementById('min-size-count').value) || 0;
                const weight_below = parseFloat(document.getElementById('min-size-weight').value) || 0;
                
                if (count > 0 || weight_below > 0) {
                    belowMinSize = { count, weight: weight_below };
                }
            }

            // Set quantities
            window.lotGenerator.setQuantities(weight, belowMinSize);
            
            // Finalize LOT
            const lotData = await window.lotGenerator.finalizeLOT();
            
            // Display result
            this.displayLOTResult(lotData);
            
            // Update daily stats
            this.dailyStats.count++;
            this.dailyStats.total_weight_kg += weight;
            this.updateDailyCount();
            
            // Navigate to result screen
            this.goToScreen('screen-result');
            
        } catch (error) {
            console.error('Greška pri generiranju LOT-a:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading('continue-btn', 'DALJE');
        }
    }

    displayLOTResult(lotData) {
        const summary = window.lotGenerator.getCatchSummary();
        const container = document.getElementById('lot-summary');
        
        container.innerHTML = `
            <h3>LOT ${summary.lot_id}</h3>
            <div class="lot-detail">
                <span class="label">📅 Datum i vrijeme:</span>
                <span class="value">${summary.date_display}</span>
            </div>
            <div class="lot-detail">
                <span class="label">🐟 Vrsta:</span>
                <span class="value">${summary.species_display}</span>
            </div>
            <div class="lot-detail">
                <span class="label">📍 Zona:</span>
                <span class="value">${summary.zone_display}</span>
            </div>
            <div class="lot-detail">
                <span class="label">⚖️ Težina:</span>
                <span class="value">${summary.weight_display}</span>
            </div>
            <div class="lot-detail">
                <span class="label">🎣 Alat:</span>
                <span class="value">${summary.gear_display}</span>
            </div>
            <div class="lot-detail">
                <span class="label">⚠️ Ispod min.:</span>
                <span class="value">${summary.below_min_display}</span>
            </div>
            <div class="lot-detail">
                <span class="label">🌍 Koordinate:</span>
                <span class="value">${summary.coordinates_display}</span>
            </div>
        `;
    }

    // Screen navigation
    goToScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }

    // Export functions
    async downloadPDF() {
        try {
            const lotData = window.lotGenerator.currentCatch;
            if (!lotData) throw new Error('Nema LOT podataka');
            
            await window.exportManager.downloadPDF(lotData);
            this.showSuccess('PDF je spreman za preuzimanje');
        } catch (error) {
            this.showError('Greška pri preuzimanju PDF-a: ' + error.message);
        }
    }

    async downloadCSV() {
        try {
            const lotData = window.lotGenerator.currentCatch;
            if (!lotData) throw new Error('Nema LOT podataka');
            
            window.exportManager.downloadCSV(lotData);
            this.showSuccess('CSV datoteka preuzeta');
        } catch (error) {
            this.showError('Greška pri preuzimanju CSV-a: ' + error.message);
        }
    }

    showQR() {
        try {
            const lotData = window.lotGenerator.currentCatch;
            if (!lotData) throw new Error('Nema LOT podataka');
            
            window.exportManager.generateQRCode(lotData);
        } catch (error) {
            this.showError('Greška pri generiranju QR koda: ' + error.message);
        }
    }

    closeModal() {
        window.exportManager.closeQRModal();
    }

    newCatch() {
        // Reset LOT generator
        window.lotGenerator.reset();
        
        // Reset UI
        this.currentWeight = '0';
        document.getElementById('species-search').value = '';
        this.filterSpecies('');
        
        // Go back to home screen
        this.goToScreen('screen-home');
    }

    // Utility functions
    updateDateTime() {
        const dateTimeElement = document.getElementById('date-time');
        if (dateTimeElement) {
            const now = new Date();
            dateTimeElement.textContent = `📅 ${now.toLocaleDateString('hr-HR')} ${now.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    updateDailyCount() {
        const countElement = document.getElementById('daily-count');
        if (countElement) {
            countElement.textContent = this.dailyStats.count;
        }
    }

    showLocationWarning() {
        const locationStatus = document.getElementById('location-status');
        if (locationStatus) {
            locationStatus.textContent = '📍⚠️ GPS potreban';
            locationStatus.style.color = '#dc2626';
        }
    }

    showLoading(buttonId, message) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = true;
            button.innerHTML = `<span class="spinner"></span> ${message}`;
        }
    }

    hideLoading(buttonId, originalText) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    showError(message) {
        alert('❌ Greška: ' + message);
    }

    showSuccess(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = '✅ ' + message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1001;
            font-weight: 600;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    // Offline status management
    updateOfflineStatus() {
        const offlineStatus = document.getElementById('offline-status');
        if (offlineStatus) {
            if (navigator.onLine) {
                offlineStatus.textContent = '💾 Online: ✓';
                offlineStatus.style.color = '#10b981';
            } else {
                offlineStatus.textContent = '💾 Offline: ✓';
                offlineStatus.style.color = '#f59e0b';
            }
        }
    }

    // Vessel configuration (for first-time setup)
    async setupVessel() {
        const vesselConfig = await window.fishermanDB.getVesselConfig();
        if (!vesselConfig) {
            // Show vessel setup dialog
            const vesselName = prompt('Naziv plovila:');
            const licenseNumber = prompt('Broj licence (HR-XXXXX):');
            const cfrNumber = prompt('CFR broj plovila:');
            
            if (vesselName && licenseNumber && cfrNumber) {
                const config = {
                    name: vesselName,
                    license_number: licenseNumber,
                    cfr_number: cfrNumber,
                    default_gear: 'GNS'
                };
                
                await window.fishermanDB.saveVesselConfig(config);
                this.showSuccess('Konfiguracija plovila spremljena');
            }
        }
    }
}

// Global functions for UI interactions
function goToScreen(screenId) {
    window.fishermanApp.goToScreen(screenId);
}

function addDigit(digit) {
    window.fishermanApp.addDigit(digit);
}

function deleteDigit() {
    window.fishermanApp.deleteDigit();
}

function clearWeight() {
    window.fishermanApp.clearWeight();
}

function generateLOT() {
    window.fishermanApp.generateLOT();
}

function downloadPDF() {
    window.fishermanApp.downloadPDF();
}

function downloadCSV() {
    window.fishermanApp.downloadCSV();
}

function showQR() {
    window.fishermanApp.showQR();
}

function closeModal() {
    window.fishermanApp.closeModal();
}

function newCatch() {
    window.fishermanApp.newCatch();
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.fishermanApp = new FishermanApp();
    await window.fishermanApp.init();
});

// Handle online/offline events
window.addEventListener('online', () => {
    window.fishermanApp?.updateOfflineStatus();
});

window.addEventListener('offline', () => {
    window.fishermanApp?.updateOfflineStatus();
});
