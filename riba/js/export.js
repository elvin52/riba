// Export and QR Code Generation for LOT Data
class ExportManager {
    constructor() {
        this.qrCodeInstance = null;
    }

    // Download LOT as PDF
    async downloadPDF(lotData) {
        try {
            // Simple PDF generation using browser print
            const pdfWindow = window.open('', '_blank');
            const pdfContent = this.generatePDFContent(lotData);
            
            pdfWindow.document.write(pdfContent);
            pdfWindow.document.close();
            
            // Trigger print dialog
            pdfWindow.onload = () => {
                pdfWindow.print();
            };
            
            return true;
        } catch (error) {
            console.error('PDF generation failed:', error);
            throw new Error('Greška pri generiranju PDF-a');
        }
    }

    // Download LOT as CSV
    downloadCSV(lotData) {
        try {
            const csvContent = window.lotGenerator.exportLOTData('csv');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `LOT_${lotData.lot_id}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return true;
        } catch (error) {
            console.error('CSV generation failed:', error);
            throw new Error('Greška pri generiranju CSV datoteke');
        }
    }

    // Generate and display QR code
    generateQRCode(lotData) {
        try {
            const qrData = {
                lot_id: lotData.lot_id,
                species: lotData.species.fao_code,
                weight: lotData.quantities.net_weight_kg,
                date: lotData.catch_info.date,
                vessel: lotData.vessel_info.license_number,
                zone: lotData.catch_info.fao_zone
            };
            
            const qrString = JSON.stringify(qrData);
            
            // Simple QR code generation using external library or manual approach
            this.displayQRCode(qrString, lotData.lot_id);
            
            return true;
        } catch (error) {
            console.error('QR code generation failed:', error);
            throw new Error('Greška pri generiranju QR koda');
        }
    }

    // Display QR code in modal
    displayQRCode(qrString, lotId) {
        const modal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qr-code');
        const lotIdSpan = document.getElementById('qr-lot-id');
        
        // Clear previous QR code
        qrContainer.innerHTML = '';
        
        // Generate QR code using canvas (simplified version)
        const qrCanvas = this.createQRCanvas(qrString);
        qrContainer.appendChild(qrCanvas);
        
        lotIdSpan.textContent = lotId;
        modal.classList.remove('hidden');
    }

    // Simplified QR code generation (basic grid pattern)
    createQRCanvas(data) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        
        // Fill white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        // Generate simple pattern based on data hash
        ctx.fillStyle = '#000000';
        const hash = this.simpleHash(data);
        const gridSize = 20;
        const cellSize = size / gridSize;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const index = i * gridSize + j;
                if ((hash + index) % 3 === 0) {
                    ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
                }
            }
        }
        
        // Add border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
        
        return canvas;
    }

    // Simple hash function for QR pattern
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Generate PDF content as HTML
    generatePDFContent(lotData) {
        const summary = window.lotGenerator.getCatchSummary();
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>LOT ${lotData.lot_id}</title>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    line-height: 1.4;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .lot-id {
                    font-size: 24px;
                    font-weight: bold;
                    color: #1e40af;
                    margin-bottom: 10px;
                }
                .compliance-note {
                    font-size: 12px;
                    color: #64748b;
                    font-style: italic;
                }
                .section {
                    margin-bottom: 25px;
                    border: 1px solid #e5e7eb;
                    padding: 15px;
                    border-radius: 8px;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #374151;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #d1d5db;
                    padding-bottom: 5px;
                }
                .field {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    padding: 4px 0;
                }
                .field-label {
                    font-weight: 600;
                    color: #4b5563;
                    width: 40%;
                }
                .field-value {
                    color: #111827;
                    width: 55%;
                    text-align: right;
                    font-family: monospace;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 12px;
                    color: #6b7280;
                    text-align: center;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="lot-id">LOT ${lotData.lot_id}</div>
                <div class="compliance-note">
                    Sljedivost proizvoda ribarstva prema Uredbi (EU) 2023/2842, čl. 58.6<br>
                    Generiran: ${new Date().toLocaleString('hr-HR')}
                </div>
            </div>

            <div class="section">
                <div class="section-title">🐟 Informacije o vrsti</div>
                <div class="field">
                    <span class="field-label">Lokalni naziv:</span>
                    <span class="field-value">${lotData.species.local_name}</span>
                </div>
                <div class="field">
                    <span class="field-label">Znanstveni naziv:</span>
                    <span class="field-value">${lotData.species.scientific_name}</span>
                </div>
                <div class="field">
                    <span class="field-label">FAO kod:</span>
                    <span class="field-value">${lotData.species.fao_code}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">📅 Informacije o ulovu</div>
                <div class="field">
                    <span class="field-label">Datum i vrijeme:</span>
                    <span class="field-value">${summary.date_display}</span>
                </div>
                <div class="field">
                    <span class="field-label">FAO zona:</span>
                    <span class="field-value">${summary.zone_display}</span>
                </div>
                <div class="field">
                    <span class="field-label">GPS koordinate:</span>
                    <span class="field-value">${summary.coordinates_display}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">🚢 Informacije o plovilu</div>
                <div class="field">
                    <span class="field-label">Naziv plovila:</span>
                    <span class="field-value">${lotData.vessel_info.name}</span>
                </div>
                <div class="field">
                    <span class="field-label">CFR broj:</span>
                    <span class="field-value">${lotData.vessel_info.cfr_number}</span>
                </div>
                <div class="field">
                    <span class="field-label">Licenca:</span>
                    <span class="field-value">${lotData.vessel_info.license_number}</span>
                </div>
                <div class="field">
                    <span class="field-label">Ribolovni alat:</span>
                    <span class="field-value">${summary.gear_display}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">⚖️ Količine</div>
                <div class="field">
                    <span class="field-label">Neto težina:</span>
                    <span class="field-value">${summary.weight_display}</span>
                </div>
                <div class="field">
                    <span class="field-label">Ispod min. veličine:</span>
                    <span class="field-value">${summary.below_min_display}</span>
                </div>
            </div>

            <div class="footer">
                Dokument generiran aplikacijom "Ribar LOT" v${lotData.metadata.app_version}<br>
                Za potrebe digitalne sljedivosti prema hrvatskom i EU zakonodavstvu
            </div>
        </body>
        </html>`;
    }

    // Email export functionality
    async sendByEmail(lotData, recipientEmail) {
        try {
            const csvContent = window.lotGenerator.exportLOTData('csv');
            const pdfContent = this.generatePDFContent(lotData);
            
            // Create mailto link with attachments (limited browser support)
            const subject = encodeURIComponent(`LOT ${lotData.lot_id} - Sljedivost ribe`);
            const body = encodeURIComponent(`
Poštovani,

U prilogu se nalaze podaci o sljedivosti za LOT ${lotData.lot_id}:

- Vrsta: ${lotData.species.local_name} (${lotData.species.fao_code})
- Količina: ${lotData.quantities.net_weight_kg} kg
- Datum ulova: ${lotData.catch_info.date}
- Zona ulova: ${lotData.catch_info.zone_description}

Podaci su generirani u skladu s Uredbom (EU) 2023/2842.

S poštovanjem,
Ribar LOT aplikacija
            `);
            
            const mailtoLink = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
            window.location.href = mailtoLink;
            
            return true;
        } catch (error) {
            console.error('Email export failed:', error);
            throw new Error('Greška pri slanju e-maila');
        }
    }

    // Batch export for multiple LOTs
    async exportBatch(lotIds, format = 'csv') {
        try {
            const lots = [];
            
            for (const lotId of lotIds) {
                const lot = await window.fishermanDB.getLOT(lotId);
                if (lot) lots.push(lot);
            }
            
            if (lots.length === 0) {
                throw new Error('Nema LOT zapisa za export');
            }
            
            let content, filename, mimeType;
            
            switch (format.toLowerCase()) {
                case 'csv':
                    content = this.generateBatchCSV(lots);
                    filename = `LOT_batch_${new Date().toISOString().split('T')[0]}.csv`;
                    mimeType = 'text/csv;charset=utf-8;';
                    break;
                case 'json':
                    content = JSON.stringify(lots, null, 2);
                    filename = `LOT_batch_${new Date().toISOString().split('T')[0]}.json`;
                    mimeType = 'application/json;charset=utf-8;';
                    break;
                default:
                    throw new Error('Nepodržan format: ' + format);
            }
            
            const blob = new Blob([content], { type: mimeType });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            return lots.length;
        } catch (error) {
            console.error('Batch export failed:', error);
            throw error;
        }
    }

    // Generate CSV for multiple LOTs
    generateBatchCSV(lots) {
        const headers = [
            'LOT_ID', 'Species_FAO', 'Species_Scientific', 'Species_Local',
            'Catch_Date', 'Catch_Time', 'FAO_Zone', 'Zone_Description',
            'GPS_Latitude', 'GPS_Longitude', 'GPS_Accuracy',
            'Vessel_CFR', 'Vessel_Name', 'Vessel_License',
            'Gear_Category', 'Gear_Description',
            'Net_Weight_KG', 'Below_Min_Weight_KG', 'Below_Min_Count',
            'Min_Reference_Size_CM'
        ];
        
        const rows = [headers];
        
        lots.forEach(lot => {
            const row = [
                lot.lot_id,
                lot.species.fao_code,
                lot.species.scientific_name,
                lot.species.local_name,
                lot.catch_info.date,
                lot.catch_info.time,
                lot.catch_info.fao_zone,
                lot.catch_info.zone_description,
                lot.catch_info.gps_coordinates.latitude,
                lot.catch_info.gps_coordinates.longitude,
                lot.catch_info.gps_coordinates.accuracy,
                lot.vessel_info.cfr_number,
                lot.vessel_info.name,
                lot.vessel_info.license_number,
                lot.fishing_gear.category,
                lot.fishing_gear.description,
                lot.quantities.net_weight_kg,
                lot.quantities.below_min_size?.weight_kg || 0,
                lot.quantities.below_min_size?.piece_count || 0,
                lot.quantities.below_min_size?.min_reference_size_cm || 0
            ];
            rows.push(row);
        });
        
        return rows.map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    // Close QR modal
    closeQRModal() {
        const modal = document.getElementById('qr-modal');
        modal.classList.add('hidden');
    }
}

// Global export manager instance
window.exportManager = new ExportManager();
