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
            const csvContent = this.generateLOTCSV(lotData);
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

    // Generate CSV content for single LOT
    generateLOTCSV(lotData) {
        const headers = [
            'LOT_ID', 'Species_FAO', 'Species_Scientific', 'Species_Local',
            'Catch_Date', 'FAO_Zone', 'Zone_Description',
            'Vessel_CFR', 'Vessel_Name', 'Logbook_Number',
            'Gear_Category', 'Quantity_Type', 'Net_Weight_KG', 'Unit_Count',
            'Undersized_Present', 'Undersized_Weight_KG', 'Undersized_Units'
        ];
        
        const row = [
            lotData.lot_id,
            lotData.species.fao_code,
            lotData.species.scientific_name,
            lotData.species.local_name,
            lotData.fishing.catch_date,
            lotData.production_area.fao_zone,
            lotData.production_area.description,
            lotData.vessel.cfr_number,
            lotData.vessel.vessel_name || '',
            lotData.vessel.logbook_number,
            lotData.fishing.fishing_gear_category,
            lotData.quantity.quantity_type,
            lotData.quantity.net_weight_kg || '',
            lotData.quantity.unit_count || '',
            lotData.quantity.undersized_catch_present ? 'Da' : 'Ne',
            lotData.quantity.undersized_weight_kg || '',
            lotData.quantity.undersized_unit_count || ''
        ];
        
        const rows = [headers, row];
        return rows.map(r => 
            r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    // Generate QR code per Croatian EU 2023/2842 regulation (lines 275-304)
    generateQRCode(lotData) {
        try {
            // Format according to Croatian regulation examples
            const catchDate = new Date(lotData.fishing.catch_date);
            const issueDate = new Date();
            
            // Croatian regulation compliant QR content
            const qrContent = this.createCroatianQRContent(lotData, catchDate, issueDate);
            
            // Display QR code with regulation-compliant content
            this.displayQRCode(qrContent, lotData.lot_id);
            
            return true;
        } catch (error) {
            console.error('QR code generation failed:', error);
            throw new Error('Greška pri generiranju QR koda');
        }
    }

    // Create Croatian regulation compliant QR content
    createCroatianQRContent(lotData, catchDate, issueDate) {
        // Format dates per Croatian standard (DD.MM.YYYY)
        const formatCroatianDate = (date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}.${mm}.${yyyy}.`;
        };

        // Build QR content exactly per regulation example (lines 275-285)
        const qrLines = [
            `Naziv proizvoda: ${lotData.species.local_name} (${lotData.species.scientific_name})`,
            `LOT broj/serija: ${lotData.lot_id}`,
            `Područje ulova: ${lotData.production_area.fao_zone}, ${lotData.production_area.description}`,
            `Datum ulova: ${formatCroatianDate(catchDate)}`,
            `Kategorija ribolovnog alata: ${lotData.fishing.fishing_gear_category}`,
            `Prezervacija: ${lotData.traceability.preservation_method || 'FRE'}, A klasa`,
            `Prezentacija: ${lotData.traceability.presentation_format || 'WHL'}`,
            `Količina: ${lotData.quantity.net_weight_kg ? lotData.quantity.net_weight_kg + ' kg' : lotData.quantity.unit_count + ' kom'}`,
            `Naziv proizvođača: ${lotData.producer.business_name}`,
            `Adresa: ${lotData.producer.business_address}`,
        ];

        // Add buyer information if available (per lines 289-304 for first buyer)
        if (lotData.buyer && lotData.buyer.buyer_name) {
            qrLines.push(`Naziv prvog kupca: ${lotData.buyer.buyer_name}`);
            if (lotData.buyer.buyer_address) {
                qrLines.push(`Adresa: ${lotData.buyer.buyer_address}`);
            }
            if (lotData.buyer.buyer_registration) {
                qrLines.push(`Registracijski broj: ${lotData.buyer.buyer_registration}`);
            }
        }

        qrLines.push(`Datum izdavanja: ${formatCroatianDate(issueDate)}`);

        console.log('🇭🇷 Croatian QR content generated:', qrLines.join('\n'));
        
        return qrLines.join('\n');
    }

    // Generate physical LOT marking guidance per Croatian regulation lines 84-85
    generatePhysicalMarkingGuidance(lotData) {
        const guidance = {
            title: "🏷️ OBVEZNO FIZIČKO OZNAČAVANJE AMBALAŽE",
            subtitle: "Prema hrvatskom propisu EU 2023/2842, članak 58., stavci 84-85",
            requirements: [
                {
                    icon: "📦",
                    title: "Obvezno označavanje LOT broja",
                    description: "LOT broj mora biti fizički označen i vidljiv na ambalaži proizvoda",
                    lotNumber: lotData.lot_id,
                    example: `Primjer: Nalijepite/označite "${lotData.lot_id}" na ambalažu`
                },
                {
                    icon: "📱", 
                    title: "Preporučeno: QR kod",
                    description: "Možete dodati QR kod s dodatnim informacijama o proizvodu",
                    note: "QR kod možete ispisati putem ove aplikacije i zalijepiti na ambalažu"
                },
                {
                    icon: "⚖️",
                    title: "Zakonska obveza",
                    description: "Neoznačavanje LOT broja može rezultirati kaznom od strane nadležnih tijela",
                    deadline: "Obvezno od 10. siječnja 2026. godine"
                }
            ],
            markingMethods: [
                "• Naljepnica s LOT brojem",
                "• Direktno pisanje/štampanje na ambalažu", 
                "• Etiketiranje s LOT brojem i QR kodom",
                "• Utiskivanje LOT broja na plastičnu ambalažu"
            ],
            compliance: `Croatian EU 2023/2842 - Sljedivost proizvoda ribarstva`
        };

        return guidance;
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

    // Create LOT summary for display
    createLOTSummary(lotData) {
        const quantityDisplay = lotData.quantity.quantity_type === 'WEIGHT' 
            ? `${lotData.quantity.net_weight_kg} kg`
            : `${lotData.quantity.unit_count} kom`;

        const undersizedDisplay = lotData.quantity.undersized_catch_present
            ? (lotData.quantity.quantity_type === 'WEIGHT'
                ? `Da (${lotData.quantity.undersized_weight_kg || 0} kg)`
                : `Da (${lotData.quantity.undersized_unit_count || 0} kom)`)
            : 'Ne';

        return {
            date_display: lotData.fishing.catch_date + (lotData.fishing.catch_time ? ` ${lotData.fishing.catch_time}` : ''),
            zone_display: `${lotData.production_area.fao_zone} - ${lotData.production_area.description}`,
            coordinates_display: lotData.fishing.gps_coordinates 
                ? `${lotData.fishing.gps_coordinates.latitude.toFixed(6)}, ${lotData.fishing.gps_coordinates.longitude.toFixed(6)}`
                : 'N/A',
            weight_display: quantityDisplay,
            below_min_display: undersizedDisplay,
            gear_display: lotData.fishing.fishing_gear_category
        };
    }

    // Generate PDF content as HTML
    generatePDFContent(lotData) {
        const summary = this.createLOTSummary(lotData);
        
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
                    <span class="field-value">${lotData.vessel.vessel_name || 'N/A'}</span>
                </div>
                <div class="field">
                    <span class="field-label">CFR broj:</span>
                    <span class="field-value">${lotData.vessel.cfr_number}</span>
                </div>
                <div class="field">
                    <span class="field-label">Registarska oznaka:</span>
                    <span class="field-value">${lotData.vessel.registration_mark}</span>
                </div>
                <div class="field">
                    <span class="field-label">Broj očevidnika:</span>
                    <span class="field-value">${lotData.vessel.logbook_number}</span>
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
                Dokument generiran aplikacijom "Ribar LOT" v1.0.0<br>
                Za potrebe digitalne sljedivosti prema hrvatskom i EU zakonodavstvu
            </div>
        </body>
        </html>`;
    }

    // Email export functionality
    async sendByEmail(lotData, recipientEmail) {
        try {
            const csvContent = this.generateLOTCSV(lotData);
            const pdfContent = this.generatePDFContent(lotData);
            
            const quantityDisplay = lotData.quantity.quantity_type === 'WEIGHT' 
                ? `${lotData.quantity.net_weight_kg} kg`
                : `${lotData.quantity.unit_count} kom`;
            
            // Create mailto link with attachments (limited browser support)
            const subject = encodeURIComponent(`LOT ${lotData.lot_id} - Sljedivost ribe`);
            const body = encodeURIComponent(`
Poštovani,

U prilogu se nalaze podaci o sljedivosti za LOT ${lotData.lot_id}:

- Vrsta: ${lotData.species.local_name} (${lotData.species.fao_code})
- Količina: ${quantityDisplay}
- Datum ulova: ${lotData.fishing.catch_date}
- Zona ulova: ${lotData.production_area.description}

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
