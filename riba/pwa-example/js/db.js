// IndexedDB Manager for Offline-First LOT Storage
class FishermanDB {
    constructor() {
        this.dbName = 'FishermanLOT';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = async () => {
                this.db = request.result;
                
                // Preload reference data if this is a new database
                if (this.db.__needsPreload) {
                    console.log('🔄 Preloading reference data...');
                    try {
                        await this.preloadReferenceDataAsync();
                        console.log('✅ Reference data preloaded');
                        delete this.db.__needsPreload;
                    } catch (error) {
                        console.warn('⚠️ Failed to preload reference data:', error);
                    }
                }
                
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // LOT Records Store
                if (!db.objectStoreNames.contains('lots')) {
                    const lotStore = db.createObjectStore('lots', { keyPath: 'lot_id' });
                    lotStore.createIndex('date', 'catch_info.date', { unique: false });
                    lotStore.createIndex('species', 'species.fao_code', { unique: false });
                    lotStore.createIndex('vessel', 'vessel_info.cfr_number', { unique: false });
                }
                
                // Species Reference Data
                if (!db.objectStoreNames.contains('species')) {
                    const speciesStore = db.createObjectStore('species', { keyPath: 'fao_code' });
                    speciesStore.createIndex('local_name', 'local_name', { unique: false });
                }
                
                // FAO Zones Reference Data
                if (!db.objectStoreNames.contains('fao_zones')) {
                    const zoneStore = db.createObjectStore('fao_zones', { keyPath: 'zone_code' });
                    zoneStore.createIndex('coordinates', ['lat_min', 'lat_max', 'lon_min', 'lon_max'], { unique: false });
                }
                
                // Fishing Gear Reference Data
                if (!db.objectStoreNames.contains('gear_types')) {
                    const gearStore = db.createObjectStore('gear_types', { keyPath: 'code' });
                }
                
                // App Configuration
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }
                
                // Mark that we need to preload data after initialization
                event.target.result.__needsPreload = true;
            };
        });
    }

    async preloadReferenceDataAsync() {
        // Comprehensive Croatian Adriatic species from official popis.csv
        const speciesData = [
            // Fish species
            { fao_code: 'PAC', scientific_name: 'Pagellus erythrinus', local_name: 'Arbun', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'SBA', scientific_name: 'Pagellus acarne', local_name: 'Batoglavac', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'UUC', scientific_name: 'Uranoscopus scaber', local_name: 'Bežmek', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'BOG', scientific_name: 'Boops boops', local_name: 'Bukva', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'MGC', scientific_name: 'Chelon ramada', local_name: 'Cipal balavac', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'MGA', scientific_name: 'Chelon auratus', local_name: 'Cipal zlatar', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'SNQ', scientific_name: 'Scorpaena notata', local_name: 'Crveni bodeč', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'CTB', scientific_name: 'Diplodus vulgaris', local_name: 'Fratar', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'AHH', scientific_name: 'Atherina hepsetus', local_name: 'Gavun', emoji: '🐟', min_size_cm: 9, category: 'fish' },
            { fao_code: 'ATB', scientific_name: 'Atherina boyeri', local_name: 'Gavunić', emoji: '🐟', min_size_cm: 9, category: 'fish' },
            { fao_code: 'SPC', scientific_name: 'Spicara smaris', local_name: 'Gira oblica', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'PIC', scientific_name: 'Spicara flexuosa', local_name: 'Gira oštrulja', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'MNZ', scientific_name: 'Lophius spp', local_name: 'Grdobina', emoji: '🐟', min_size_cm: 30, category: 'fish' },
            { fao_code: 'MGR', scientific_name: 'Argyrosomus regius', local_name: 'Hama', emoji: '🐟', min_size_cm: 30, category: 'fish' },
            { fao_code: 'ELE', scientific_name: 'Anguilla anguilla', local_name: 'Jegulja', emoji: '🐍', min_size_cm: 37, category: 'fish' },
            { fao_code: 'BRB', scientific_name: 'Spondyliosoma cantharus', local_name: 'Kantar', emoji: '🐟', min_size_cm: 23, category: 'fish' },
            { fao_code: 'CBR', scientific_name: 'Serranus cabrilla', local_name: 'Kanjac', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'CBM', scientific_name: 'Sciaena umbra', local_name: 'Kavala', emoji: '🐟', min_size_cm: 30, category: 'fish' },
            { fao_code: 'WRF', scientific_name: 'Polyprion americanus', local_name: 'Kirnja glavulja', emoji: '🐟', min_size_cm: 45, category: 'fish' },
            { fao_code: 'SBG', scientific_name: 'Sparus aurata', local_name: 'Komarča', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'COB', scientific_name: 'Umbrina cirrosa', local_name: 'Koraf', emoji: '🐟', min_size_cm: 30, category: 'fish' },
            { fao_code: 'JOD', scientific_name: 'Zeus faber', local_name: 'Kovač', emoji: '🐟', min_size_cm: 30, category: 'fish' },
            { fao_code: 'DOL', scientific_name: 'Coryphaena hippurus', local_name: 'Lampuga', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'SOL', scientific_name: 'Solea solea', local_name: 'List', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'BSS', scientific_name: 'Dicentrarchus labrax', local_name: 'Lubin', emoji: '🐟', min_size_cm: 42, category: 'fish' },
            { fao_code: 'BPI', scientific_name: 'Spicara maena', local_name: 'Modraš', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'MMH', scientific_name: 'Muraena helena', local_name: 'Murina', emoji: '🐍', min_size_cm: 0, category: 'fish' },
            { fao_code: 'SBR', scientific_name: 'Pagellus bogaraveo', local_name: 'Okan', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'HKE', scientific_name: 'Merluccius merluccius', local_name: 'Oslić', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'SSB', scientific_name: 'Lithognathus mormyrus', local_name: 'Ovčica', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'RPG', scientific_name: 'Pagrus pagrus', local_name: 'Pagar', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'SHR', scientific_name: 'Diplodus puntazzo', local_name: 'Pic', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'SRK', scientific_name: 'Serranus scriba', local_name: 'Pirka', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'WHG', scientific_name: 'Merlangius merlangus', local_name: 'Pišmolj', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'TUR', scientific_name: 'Scophthalmus maximus', local_name: 'Romb', emoji: '🐟', min_size_cm: 30, category: 'fish' },
            { fao_code: 'SLM', scientific_name: 'Sarpa salpa', local_name: 'Salpa', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'BLU', scientific_name: 'Pomatomus saltatrix', local_name: 'Strijelka', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'SWA', scientific_name: 'Diplodus sargus', local_name: 'Šarag', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'YRS', scientific_name: 'Sphyraena sphyraena', local_name: 'Škaram', emoji: '🐟', min_size_cm: 25, category: 'fish' },
            { fao_code: 'RSE', scientific_name: 'Scorpaena scrofa', local_name: 'Škrpina', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'BBS', scientific_name: 'Scorpaena porcus', local_name: 'Škrpun', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'ANN', scientific_name: 'Diplodus annularis', local_name: 'Špar', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'MUT', scientific_name: 'Mullus barbatus', local_name: 'Trlja blatarica', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'MUR', scientific_name: 'Mullus surmuletus', local_name: 'Trlja kamenjarka', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'COE', scientific_name: 'Conger conger', local_name: 'Ugor', emoji: '🐍', min_size_cm: 58, category: 'fish' },
            { fao_code: 'WHB', scientific_name: 'Micromesistius poutassou', local_name: 'Ugotica', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'SBS', scientific_name: 'Oblada melanura', local_name: 'Ušata', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'WRM', scientific_name: 'Labrus merula', local_name: 'Vrana', emoji: '🐟', min_size_cm: 12, category: 'fish' },
            { fao_code: 'DNT', scientific_name: 'Dentex dentex', local_name: 'Zubatac', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'DGX', scientific_name: 'Dentex gibbosus', local_name: 'Zubatac krunaš', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            
            // Cephalopods
            { fao_code: 'OCC', scientific_name: 'Octopus vulgaris', local_name: 'Hobotnica', emoji: '🐙', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'SQR', scientific_name: 'Loligo vulgaris', local_name: 'Lignja', emoji: '🦑', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'OCM', scientific_name: 'Eledone spp', local_name: 'Muzgavac', emoji: '🐙', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'EOI', scientific_name: 'Eledone cirrhosa', local_name: 'Muzgavac bijeli', emoji: '🐙', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'EDT', scientific_name: 'Eledone moschata', local_name: 'Muzgavac crni', emoji: '🐙', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'CTC', scientific_name: 'Sepia officinalis', local_name: 'Sipa', emoji: '🦑', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'SQU', scientific_name: 'Ommastrephidae', local_name: 'Lignjuni', emoji: '🦑', min_size_cm: 0, category: 'cephalopod' },
            { fao_code: 'CTL', scientific_name: 'Sepiidae, Sepiolidae', local_name: 'Sipice', emoji: '🦑', min_size_cm: 0, category: 'cephalopod' },
            
            // Cartilaginous fish (sharks, rays)
            { fao_code: 'TTO', scientific_name: 'Tetronarce nobiliana', local_name: 'Drhtulja mrkulja', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'TTR', scientific_name: 'Dasyatis marmorata', local_name: 'Drhtulja šarulja', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'MYL', scientific_name: 'Myliobatis aquila', local_name: 'Golub', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'SYC', scientific_name: 'Scyliorhinus canicula', local_name: 'Mačka bljedica', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'SYT', scientific_name: 'Scyliorhinus stellaris', local_name: 'Mačka mrkulja', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'SCL', scientific_name: 'Scyliorhinus spp', local_name: 'Mačke', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'DGS', scientific_name: 'Squalus acanthias', local_name: 'Pas kostelj', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'SDS', scientific_name: 'Mustelus asterias', local_name: 'Pas mekuš', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'SMD', scientific_name: 'Mustelus mustelus', local_name: 'Pas mekuš čukov', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'MPT', scientific_name: 'Mustelus punctulatus', local_name: 'Pjegavi pas', emoji: '🦈', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'RJC', scientific_name: 'Raja clavata', local_name: 'Raža kamenica', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'JAI', scientific_name: 'Raja miraletus', local_name: 'Barakokula', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'JAR', scientific_name: 'Raja radula', local_name: 'Raža tuponoska', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            { fao_code: 'RJU', scientific_name: 'Raja undulata', local_name: 'Raža vijošarka', emoji: '🐟', min_size_cm: 0, category: 'cartilaginous' },
            
            // Small pelagic fish
            { fao_code: 'GAR', scientific_name: 'Belone belone', local_name: 'Iglica', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'ANE', scientific_name: 'Engraulis encrasicolus', local_name: 'Inćun', emoji: '🐟', min_size_cm: 9, category: 'fish' },
            { fao_code: 'SPR', scientific_name: 'Sprattus sprattus', local_name: 'Papalina', emoji: '🐟', min_size_cm: 7, category: 'fish' },
            { fao_code: 'VMA', scientific_name: 'Scomber colias', local_name: 'Plavica', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'MAC', scientific_name: 'Scomber scombrus', local_name: 'Skuša', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'PIL', scientific_name: 'Sardina pilchardus', local_name: 'Srdela', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'SAA', scientific_name: 'Sardinella aurita', local_name: 'Srdela golema', emoji: '🐟', min_size_cm: 11, category: 'fish' },
            { fao_code: 'HOM', scientific_name: 'Trachurus trachurus', local_name: 'Šarun', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'HMM', scientific_name: 'Trachurus mediterraneus', local_name: 'Šarun mediteranski', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            
            // Crustaceans
            { fao_code: 'LBE', scientific_name: 'Homarus gammarus', local_name: 'Hlap', emoji: '🦞', min_size_cm: 24, category: 'crustacean' },
            { fao_code: 'SLO', scientific_name: 'Palinurus elephas', local_name: 'Jastog', emoji: '🦞', min_size_cm: 9, category: 'crustacean' },
            { fao_code: 'MTS', scientific_name: 'Squilla mantis', local_name: 'Kanoća', emoji: '🦐', min_size_cm: 0, category: 'crustacean' },
            { fao_code: 'DPS', scientific_name: 'Parapenaeus longirostris', local_name: 'Kozica', emoji: '🦐', min_size_cm: 0, category: 'crustacean' },
            { fao_code: 'YLL', scientific_name: 'Scyllarides latus', local_name: 'Kuka', emoji: '🦞', min_size_cm: 16, category: 'crustacean' },
            { fao_code: 'CRB', scientific_name: 'Callinectes sapidus', local_name: 'Plavi rak', emoji: '🦀', min_size_cm: 0, category: 'crustacean' },
            { fao_code: 'SCR', scientific_name: 'Maja squinado', local_name: 'Rakovica', emoji: '🦀', min_size_cm: 12, category: 'crustacean' },
            { fao_code: 'NEP', scientific_name: 'Nephrops norvegicus', local_name: 'Škamp', emoji: '🦞', min_size_cm: 20, category: 'crustacean' },
            { fao_code: 'SCY', scientific_name: 'Scyllarus arctus', local_name: 'Zezavac', emoji: '🦞', min_size_cm: 16, category: 'crustacean' },
            
            // Mollusks
            { fao_code: 'MSM', scientific_name: 'Mytilus galloprovincialis', local_name: 'Dagnja', emoji: '🦪', min_size_cm: 0, category: 'mollusk' },
            { fao_code: 'SJA', scientific_name: 'Pecten jacobaeus', local_name: 'Jakovljeva kapica', emoji: '🦪', min_size_cm: 10, category: 'mollusk' },
            { fao_code: 'OYF', scientific_name: 'Ostrea edulis', local_name: 'Kamenica', emoji: '🦪', min_size_cm: 0, category: 'mollusk' },
            { fao_code: 'SVE', scientific_name: 'Chamelea gallina', local_name: 'Kokoš', emoji: '🐚', min_size_cm: 2.5, category: 'mollusk' },
            { fao_code: 'CTG', scientific_name: 'Ruditapes decussatus', local_name: 'Kućica', emoji: '🐚', min_size_cm: 2.5, category: 'mollusk' },
            { fao_code: 'RKQ', scientific_name: 'Arca noae', local_name: 'Kunjka', emoji: '🐚', min_size_cm: 0, category: 'mollusk' },
            { fao_code: 'VSC', scientific_name: 'Chlamys varia', local_name: 'Mala kapica', emoji: '🦪', min_size_cm: 0, category: 'mollusk' },
            { fao_code: 'VEV', scientific_name: 'Venus verrucosa', local_name: 'Prnjavica, Brbavica', emoji: '🐚', min_size_cm: 2.5, category: 'mollusk' },
            { fao_code: 'KLK', scientific_name: 'Callista chione', local_name: 'Rumenka', emoji: '🐚', min_size_cm: 0, category: 'mollusk' },
            { fao_code: 'SCX', scientific_name: 'Pectinidae', local_name: 'Kapice', emoji: '🦪', min_size_cm: 0, category: 'mollusk' },
            
            // Additional crustaceans
            { fao_code: 'GIT', scientific_name: 'Penaeus monodon', local_name: 'Tigrasta kozica', emoji: '🦐', min_size_cm: 0, category: 'crustacean' },
            
            // Other marine organisms
            { fao_code: 'SIU', scientific_name: 'Sipunculus nudus', local_name: 'Bibi (morski štrcaljac)', emoji: '🪱', min_size_cm: 0, category: 'other' },
            { fao_code: 'UKB', scientific_name: 'Arbacia lixula', local_name: 'Crni ježinac', emoji: '🦔', min_size_cm: 0, category: 'echinoderm' },
            { fao_code: 'COL', scientific_name: 'Corallium rubrum', local_name: 'Crveni koralj', emoji: '🪸', min_size_cm: 0, category: 'cnidarian' },
            { fao_code: 'URM', scientific_name: 'Paracentrotus lividus', local_name: 'Ježinac hridinski', emoji: '🦔', min_size_cm: 0, category: 'echinoderm' },
            { fao_code: 'SSG', scientific_name: 'Microcosmus vulgaris', local_name: 'Morska jaja', emoji: '🥚', min_size_cm: 0, category: 'tunicate' },
            { fao_code: 'WOR', scientific_name: 'Polychaeta', local_name: 'Morski crvi', emoji: '🪱', min_size_cm: 0, category: 'worm' },
            { fao_code: 'GAS', scientific_name: 'Gastropoda', local_name: 'Puževi ostali', emoji: '🐌', min_size_cm: 0, category: 'gastropod' },
            { fao_code: 'QGO', scientific_name: 'Spongia officinalis', local_name: 'Spužva obična', emoji: '🧽', min_size_cm: 0, category: 'sponge' },
            { fao_code: 'SPO', scientific_name: 'Spongiidae', local_name: 'Spužve', emoji: '🧽', min_size_cm: 0, category: 'sponge' },
            { fao_code: 'HFT', scientific_name: 'Holothuria tubulosa', local_name: 'Trp obični', emoji: '🥒', min_size_cm: 0, category: 'echinoderm' },
            { fao_code: 'CUX', scientific_name: 'Holothuroidea', local_name: 'Trpovi', emoji: '🥒', min_size_cm: 0, category: 'echinoderm' },
            { fao_code: 'FXX', scientific_name: 'Eunice spp.', local_name: 'Veliki morski crvi', emoji: '🪱', min_size_cm: 0, category: 'worm' },
            { fao_code: 'MUE', scientific_name: 'Murex spp', local_name: 'Volci', emoji: '🐌', min_size_cm: 0, category: 'gastropod' },
            
            // Additional fish missed earlier
            { fao_code: 'YFX', scientific_name: 'Symphodus spp.', local_name: 'Lumbraci, Hinci', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'GPX', scientific_name: 'Epinephelus spp', local_name: 'Kirnje', emoji: '🐟', min_size_cm: 40, category: 'fish' },
            { fao_code: 'GUX', scientific_name: 'Triglidae', local_name: 'Kokoti', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'MUL', scientific_name: 'Mugilidae', local_name: 'Cipli', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'PLZ', scientific_name: 'Pleuronectidae', local_name: 'Iverci', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'PLE', scientific_name: 'Pleuronectes platessa', local_name: 'Iverak zlatopjeg', emoji: '🐟', min_size_cm: 27, category: 'fish' },
            { fao_code: 'LEZ', scientific_name: 'Lepidorhombus spp', local_name: 'Patarače', emoji: '🐟', min_size_cm: 20, category: 'fish' },
            { fao_code: 'WEX', scientific_name: 'Trachinus spp', local_name: 'Pauci', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'SFS', scientific_name: 'Lepidopus caudatus', local_name: 'Repaš zmijičnjak (mač)', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'FOX', scientific_name: 'Phycis spp', local_name: 'Tabinje', emoji: '🐟', min_size_cm: 15, category: 'fish' },
            { fao_code: 'MSP', scientific_name: 'Tetrapturus belone', local_name: 'Iglan', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            
            // Large pelagic fish
            { fao_code: 'AMB', scientific_name: 'Seriola dumerili', local_name: 'Gof', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'SWO', scientific_name: 'Xiphias gladius', local_name: 'Iglun', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'LEE', scientific_name: 'Lichia amia', local_name: 'Lica', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'LTA', scientific_name: 'Euthynnus alletteratus', local_name: 'Luc', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'BON', scientific_name: 'Sarda sarda', local_name: 'Palamida', emoji: '🐟', min_size_cm: 18, category: 'fish' },
            { fao_code: 'BLT', scientific_name: 'Auxis rochei', local_name: 'Trup', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'ALB', scientific_name: 'Thunnus alalunga', local_name: 'Tuna albakora', emoji: '🐟', min_size_cm: 0, category: 'fish' },
            { fao_code: 'BFT', scientific_name: 'Thunnus thynnus', local_name: 'Tuna plavoperajna', emoji: '🐟', min_size_cm: 115, category: 'fish' }
        ];
        
        // Check if data already exists
        const existingSpecies = await this.getAllSpecies();
        if (existingSpecies.length > 0) {
            console.log('📊 Reference data already exists, skipping preload');
            return;
        }
        
        // Preload species data
        const speciesTransaction = this.db.transaction(['species'], 'readwrite');
        const speciesStore = speciesTransaction.objectStore('species');
        
        for (const species of speciesData) {
            try {
                speciesStore.add(species);
            } catch (error) {
                console.warn('Species already exists:', species.fao_code);
            }
        }
        
        await new Promise((resolve, reject) => {
            speciesTransaction.oncomplete = resolve;
            speciesTransaction.onerror = reject;
        });
        
        // Preload FAO zones for Croatian waters
        const faoZones = [
            {
                zone_code: '37.2.1',
                description: 'Jadransko more - Hrvatska obala',
                lat_min: 42.0,
                lat_max: 46.0,
                lon_min: 13.0,
                lon_max: 19.0
            },
            {
                zone_code: '37.2.2',
                description: 'Jadransko more - Italijanska obala',
                lat_min: 40.0,
                lat_max: 46.0,
                lon_min: 12.0,
                lon_max: 16.0
            }
        ];
        
        const zoneTransaction = this.db.transaction(['fao_zones'], 'readwrite');
        const zoneStore = zoneTransaction.objectStore('fao_zones');
        
        for (const zone of faoZones) {
            try {
                zoneStore.add(zone);
            } catch (error) {
                console.warn('Zone already exists:', zone.zone_code);
            }
        }
        
        await new Promise((resolve, reject) => {
            zoneTransaction.oncomplete = resolve;
            zoneTransaction.onerror = reject;
        });
        
        // Preload fishing gear types
        const gearTypes = [
            { code: 'GNS', description: 'Mreže pridnene - pojedinačne', type: 'nets' },
            { code: 'GTR', description: 'Mreže pridnene - kombinacija', type: 'nets' },
            { code: 'LLS', description: 'Parangal pridneni', type: 'longlines' },
            { code: 'LLD', description: 'Parangal u driftu', type: 'longlines' },
            { code: 'LHP', description: 'Udice i štapovi', type: 'hooks' },
            { code: 'FPO', description: 'Stacionarne zamke', type: 'traps' }
        ];
        
        const gearTransaction = this.db.transaction(['gear_types'], 'readwrite');
        const gearStore = gearTransaction.objectStore('gear_types');
        
        for (const gear of gearTypes) {
            try {
                gearStore.add(gear);
            } catch (error) {
                console.warn('Gear type already exists:', gear.code);
            }
        }
        
        await new Promise((resolve, reject) => {
            gearTransaction.oncomplete = resolve;
            gearTransaction.onerror = reject;
        });
    }

    // LOT Operations
    async saveLOT(lotData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lots'], 'readwrite');
            const store = transaction.objectStore('lots');
            
            const request = store.add(lotData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getLOT(lotId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lots'], 'readonly');
            const store = transaction.objectStore('lots');
            
            const request = store.get(lotId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTodaysLOTs() {
        const today = new Date().toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lots'], 'readonly');
            const store = transaction.objectStore('lots');
            const index = store.index('date');
            
            const request = index.getAll(today);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllLOTs() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lots'], 'readonly');
            const store = transaction.objectStore('lots');
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Species Operations
    async getAllSpecies() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['species'], 'readonly');
            const store = transaction.objectStore('species');
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSpeciesByFAO(faoCode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['species'], 'readonly');
            const store = transaction.objectStore('species');
            
            const request = store.get(faoCode);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async searchSpecies(searchTerm) {
        const allSpecies = await this.getAllSpecies();
        const term = searchTerm.toLowerCase();
        
        return allSpecies.filter(species => 
            species.local_name.toLowerCase().includes(term) ||
            species.scientific_name.toLowerCase().includes(term) ||
            species.fao_code.toLowerCase().includes(term)
        );
    }

    // FAO Zone Operations
    async getFAOZoneByCoordinates(lat, lon) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['fao_zones'], 'readonly');
            const store = transaction.objectStore('fao_zones');
            
            const request = store.getAll();
            request.onsuccess = () => {
                const zones = request.result;
                const matchedZone = zones.find(zone => 
                    lat >= zone.lat_min && lat <= zone.lat_max &&
                    lon >= zone.lon_min && lon <= zone.lon_max
                );
                resolve(matchedZone);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Gear Type Operations
    async getAllGearTypes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gear_types'], 'readonly');
            const store = transaction.objectStore('gear_types');
            
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Configuration Operations
    async saveConfig(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');
            
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getConfig(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    // Vessel Configuration
    async saveVesselConfig(vesselData) {
        return this.saveConfig('vessel', vesselData);
    }

    async getVesselConfig() {
        return this.getConfig('vessel');
    }

    // Data Export for Sync
    async exportAllData() {
        const lots = await this.getAllLOTs();
        const config = await this.getVesselConfig();
        
        return {
            lots,
            vessel_config: config,
            export_timestamp: new Date().toISOString(),
            app_version: '1.0.0'
        };
    }

    // Statistics
    async getDailyStats() {
        const todaysLOTs = await this.getTodaysLOTs();
        const totalWeight = todaysLOTs.reduce((sum, lot) => 
            sum + (lot.quantities?.net_weight_kg || 0), 0
        );
        
        return {
            count: todaysLOTs.length,
            total_weight_kg: totalWeight,
            date: new Date().toISOString().split('T')[0]
        };
    }
}

// Global database instance
window.fishermanDB = new FishermanDB();
