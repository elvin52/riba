// GPS and Location Services for FAO Zone Detection
class GPSManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.accuracy = null;
        this.lastUpdate = null;
    }

    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation nije podržana u ovom pregledniku'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000, // 10 seconds
                maximumAge: 300000 // 5 minutes cache
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp)
                    };
                    this.accuracy = position.coords.accuracy;
                    this.lastUpdate = new Date();
                    resolve(this.currentPosition);
                },
                (error) => {
                    let message = 'Greška pri dohvaćanju lokacije';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Pristup lokaciji je odbačen. Molimo omogućite lokaciju u postavkama.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Lokacija nije dostupna. Provjerite GPS signal.';
                            break;
                        case error.TIMEOUT:
                            message = 'Timeout pri dohvaćanju lokacije. Pokušajte ponovno.';
                            break;
                    }
                    reject(new Error(message));
                },
                options
            );
        });
    }

    startWatching() {
        if (!navigator.geolocation) {
            console.warn('Geolocation nije podržana');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000 // 1 minute
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date(position.timestamp)
                };
                this.accuracy = position.coords.accuracy;
                this.lastUpdate = new Date();
                
                // Update UI
                this.updateLocationDisplay();
            },
            (error) => {
                console.warn('GPS watch error:', error.message);
            },
            options
        );
    }

    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    async getFAOZone() {
        if (!this.currentPosition) {
            await this.getCurrentPosition();
        }

        const { latitude, longitude } = this.currentPosition;
        
        // Get FAO zone from database
        const faoZone = await window.fishermanDB.getFAOZoneByCoordinates(latitude, longitude);
        
        if (faoZone) {
            return {
                zone_code: faoZone.zone_code,
                description: faoZone.description,
                coordinates: { latitude, longitude }
            };
        }

        // Default to Croatian waters if no specific zone found
        return {
            zone_code: '37.2.1',
            description: 'Jadransko more - Hrvatska obala',
            coordinates: { latitude, longitude }
        };
    }

    updateLocationDisplay() {
        const locationStatus = document.getElementById('location-status');
        if (!locationStatus) return;

        if (this.currentPosition) {
            const accuracy = this.accuracy ? Math.round(this.accuracy) : '?';
            locationStatus.textContent = `📍 GPS: ±${accuracy}m`;
            locationStatus.classList.add('gps-active');
        } else {
            locationStatus.textContent = '📍 Dohvaćam lokaciju...';
            locationStatus.classList.remove('gps-active');
        }
    }

    isLocationAccurate() {
        return this.accuracy && this.accuracy <= 50; // 50m accuracy threshold
    }

    getLocationAge() {
        if (!this.lastUpdate) return null;
        return Date.now() - this.lastUpdate.getTime();
    }

    async requestPermission() {
        if (!navigator.permissions) {
            // Fallback - try to get position directly
            try {
                await this.getCurrentPosition();
                return 'granted';
            } catch (error) {
                return 'denied';
            }
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            if (permission.state === 'granted') {
                return 'granted';
            } else if (permission.state === 'prompt') {
                // Try to trigger permission prompt
                try {
                    await this.getCurrentPosition();
                    return 'granted';
                } catch (error) {
                    return 'denied';
                }
            } else {
                return 'denied';
            }
        } catch (error) {
            // Fallback
            try {
                await this.getCurrentPosition();
                return 'granted';
            } catch (error) {
                return 'denied';
            }
        }
    }

    // Format coordinates for display
    formatCoordinates() {
        if (!this.currentPosition) return 'N/A';
        
        const { latitude, longitude } = this.currentPosition;
        const latDir = latitude >= 0 ? 'N' : 'S';
        const lonDir = longitude >= 0 ? 'E' : 'W';
        
        const latDeg = Math.abs(latitude).toFixed(4);
        const lonDeg = Math.abs(longitude).toFixed(4);
        
        return `${latDeg}°${latDir}, ${lonDeg}°${lonDir}`;
    }

    // Check if coordinates are in Croatian waters (rough approximation)
    isInCroatianWaters() {
        if (!this.currentPosition) return false;
        
        const { latitude, longitude } = this.currentPosition;
        
        // Rough bounding box for Croatian Adriatic waters
        return (
            latitude >= 42.0 && latitude <= 46.5 &&
            longitude >= 13.0 && longitude <= 19.5
        );
    }

    // Get distance from shore (approximation)
    getDistanceFromShore() {
        if (!this.currentPosition) return null;
        
        const { latitude, longitude } = this.currentPosition;
        
        // Very rough approximation - distance from Croatian coastline
        // This would need proper calculation in production
        if (longitude < 14.5) {
            return 'Blizu obale (<5 nm)';
        } else if (longitude < 16.0) {
            return 'Srednja udaljenost (5-20 nm)';
        } else {
            return 'Dalje od obale (>20 nm)';
        }
    }

    // Validation for fishing areas
    validateFishingLocation() {
        if (!this.currentPosition) {
            return { 
                valid: false, 
                message: 'Lokacija nije dostupna' 
            };
        }

        if (!this.isInCroatianWaters()) {
            return { 
                valid: false, 
                message: 'Lokacija nije u hrvatskim vodama' 
            };
        }

        if (!this.isLocationAccurate()) {
            return { 
                valid: false, 
                message: `GPS signal nedovoljno točan (±${Math.round(this.accuracy)}m)` 
            };
        }

        const age = this.getLocationAge();
        if (age && age > 300000) { // 5 minutes
            return { 
                valid: false, 
                message: 'GPS lokacija je zastara (>5 min)' 
            };
        }

        return { 
            valid: true, 
            message: 'Lokacija potvrđena' 
        };
    }
}

// Global GPS manager instance
window.gpsManager = new GPSManager();
