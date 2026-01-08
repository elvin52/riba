// Professional Fishermen Vessel Configuration Manager
class VesselConfigManager {
    constructor() {
        this.config = null;
        this.storageKey = 'fishermen_vessel_config';
    }

    // Load persistent vessel configuration
    async loadConfig() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.config = JSON.parse(saved);
                return this.config;
            }
            return null;
        } catch (error) {
            console.error('Failed to load vessel config:', error);
            return null;
        }
    }

    // Save vessel configuration (one-time setup)
    async saveConfig(configData) {
        // Clean and normalize input BEFORE validation
        const cleanedConfig = {
            cfr_number: (configData.cfr_number || '').trim().toUpperCase(),
            registration_mark: (configData.registration_mark || '').trim().toUpperCase(),
            logbook_number: (configData.logbook_number || '').trim().toUpperCase(),
            fishing_gear_category: configData.fishing_gear_category || 'MIXED',
            vessel_name: configData.vessel_name?.trim() || '',
            fisherman_name: (configData.fisherman_name || '').trim()
        };

        const validation = this.validateConfig(cleanedConfig);
        if (!validation.valid) {
            throw new Error(validation.errors.join('; '));
        }

        this.config = {
            ...cleanedConfig,
            created_timestamp: new Date().toISOString(),
            updated_timestamp: new Date().toISOString()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(this.config));
        return this.config;
    }

    // Validate vessel configuration
    validateConfig(config) {
        const errors = [];

        // CFR Number validation (Croatian format: 3 letters + 9-12 digits)
        if (!config.cfr_number) {
            errors.push('CFR number is mandatory');
        } else if (!/^[A-Z]{3}\d{9,12}$/.test(config.cfr_number)) {
            errors.push('CFR number must be 3 letters + 9-12 digits (e.g., HRV000000000)');
        }

        // Registration Mark validation
        if (!config.registration_mark) {
            errors.push('Vessel registration mark is mandatory');
        } else if (config.registration_mark.length < 2) {
            errors.push('Registration mark too short');
        }

        // Logbook Number validation (HRVLOG + 13 digits)
        if (!config.logbook_number) {
            errors.push('Logbook number is mandatory');
        } else if (!/^HRVLOG\d{13}$/.test(config.logbook_number)) {
            errors.push('Logbook number must be HRVLOG + 13 digits');
        }

        // Croatian fisherman requirements
        if (!config.fisherman_name || config.fisherman_name.length < 2) {
            errors.push('Fisherman name is mandatory (minimum 2 characters)');
        }

        // Fishing Gear Category - optional for Croatian fishermen, auto-set to default
        if (!config.fishing_gear_category) {
            config.fishing_gear_category = 'MIXED'; // Auto-set default for Croatian compliance
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Get predefined FAO/EU fishing gear categories
    getValidGearCategories() {
        return [
            'MIXED', // Mixed gear types - Croatian default
            'GNS', // Gillnets and entangling nets - Set gillnets (anchored)
            'GND', // Gillnets and entangling nets - Driftnets
            'GTR', // Gillnets and entangling nets - Trammel nets
            'LLS', // Lines and hooks - Set longlines
            'LLD', // Lines and hooks - Drifting longlines
            'LHP', // Lines and hooks - Handlines and pole-lines (hand operated)
            'LHM', // Lines and hooks - Handlines and pole-lines (mechanized)
            'FPO', // Traps - Pots
            'PS1', // Surrounding nets - Purse seines
            'OTB', // Trawls - Bottom otter trawls
            'PTB', // Trawls - Bottom pair trawls
            'TBN'  // Trawls - Bottom trawls nei
        ];
    }


    // Check if vessel is configured
    isConfigured() {
        return this.config !== null;
    }

    // Get current configuration
    getConfig() {
        return this.config;
    }

    // Update configuration
    async updateConfig(updates) {
        if (!this.config) {
            throw new Error('No configuration exists to update');
        }

        const updatedConfig = { ...this.config, ...updates };
        updatedConfig.updated_timestamp = new Date().toISOString();
        
        return await this.saveConfig(updatedConfig);
    }

}

// Initialize global vessel config manager
window.vesselConfigManager = new VesselConfigManager();
