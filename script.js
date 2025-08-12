// Initialize map with wide view of Nepal for cinematic zoom-in
const map = L.map('map').setView([28.1, 84.1], 7);

// Add ESRI World Imagery satellite tile layer for better terrain visualization
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
}).addTo(map);

// Global variables to store boundary polygons
let nepalPolygon = null;
let bagmatiPolygon = null;
let nagarjunPolygon = null;

// Async function to load official Nepal government boundaries including disputed territories
async function loadGeographicBoundaries() {
    console.log('Starting to load official Nepal government boundaries...');
    
    try {
        // Load Nepal country boundary including Kalapani, Lipulekh, and Limpiyadhura territories (2020 update)
        console.log('Loading official Nepal boundary with disputed territories...');
        const nepalResponse = await fetch('https://raw.githubusercontent.com/Acesmndr/nepal-geojson/master/generated-geojson/nepal-with-provinces-acesmndr.geojson');
        
        if (!nepalResponse.ok) {
            console.warn('Primary official source failed, trying alternative...');
            // Fallback to alternative official boundary source
            const fallbackResponse = await fetch('https://raw.githubusercontent.com/din751/nepal_boundary/main/nepal.geojson');
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                await loadNepalBoundaryData(fallbackData, 'fallback official source');
                return;
            }
            throw new Error(`Nepal official data fetch failed: ${nepalResponse.status}`);
        }
        
        const nepalData = await nepalResponse.json();
        await loadNepalBoundaryData(nepalData, 'primary official source');
        
    } catch (error) {
        console.warn('Error loading official geographic boundaries:', error);
        console.log('Attempting to load from government-verified sources...');
        await loadGovernmentVerifiedBoundaries();
    }
}

// Function to process Nepal boundary data from official sources
async function loadNepalBoundaryData(nepalData, source) {
    console.log(`Nepal boundary data loaded from ${source}, features count:`, nepalData.features?.length);
    
    // Verify if this includes the 2020 updates (Kalapani region)
    const hasDisputedTerritories = await verifyDisputedTerritories(nepalData);
    console.log('Disputed territories (Kalapani, Lipulekh, Limpiyadhura) included:', hasDisputedTerritories);
    
    // Create Nepal boundary (country or combined provinces)
    nepalPolygon = L.geoJSON(nepalData, {
        style: {
            color: '#34d399',
            weight: 3,
            opacity: 0.8,
            fillColor: '#34d399',
            fillOpacity: 0.1
        }
    }).addTo(map);
    console.log('Official Nepal boundary added to map successfully');

    // Extract Bagmati Province if available
    await loadProvinceFromData(nepalData);
    
    // Load municipalities from separate official source
    await loadOfficialMunicipalityBoundaries();
}

// Verify if boundary data includes the disputed territories added in 2020
async function verifyDisputedTerritories(geoJsonData) {
    try {
        // Check for coordinates in the Kalapani region (approximately 30.2°N, 80.8°E)
        const features = geoJsonData.features || [geoJsonData];
        
        for (const feature of features) {
            if (feature.geometry && feature.geometry.coordinates) {
                const coords = JSON.stringify(feature.geometry.coordinates);
                // Look for coordinates that would indicate inclusion of western disputed areas
                if (coords.includes('80.8') || coords.includes('80.9')) {
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.warn('Error verifying disputed territories:', error);
        return false;
    }
}

// Load from government-verified community sources as fallback
async function loadGovernmentVerifiedBoundaries() {
    try {
        console.log('Loading from government-verified community sources...');
        
        // Try Open Knowledge Nepal which uses government data
        const oknpResponse = await fetch('https://localboundries.oknp.org/data/country.geojson');
        if (oknpResponse.ok) {
            const oknpData = await oknpResponse.json();
            await loadNepalBoundaryData(oknpData, 'Open Knowledge Nepal (government-verified)');
            return;
        }
        
        // Final fallback to mesaugat repository with note about limitations
        console.warn('Using community-maintained boundaries - may not include complete disputed territories');
        const communityResponse = await fetch('https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-states.geojson');
        if (communityResponse.ok) {
            const communityData = await communityResponse.json();
            await loadNepalBoundaryData(communityData, 'community-maintained (limitations noted)');
            return;
        }
        
        throw new Error('All official and verified boundary sources failed');
        
    } catch (error) {
        console.warn('All official boundary sources failed:', error);
        console.log('Falling back to simplified boundaries with disclaimer...');
        loadFallbackBoundaries();
    }
}

// Extract province boundaries from combined data
async function loadProvinceFromData(nepalData) {
    console.log('Extracting Bagmati Province from official data...');
    
    // Look for Bagmati Province in the features
    const bagmatiFeature = nepalData.features?.find(feature => {
        const props = feature.properties || {};
        const name = props.ADM1_EN || props.PROVINCE || props.NAME || '';
        return name.toLowerCase().includes('bagmati') || name === '3' || name === 'Province 3';
    });
    
    if (bagmatiFeature) {
        console.log('Bagmati Province found in official data:', bagmatiFeature.properties);
        bagmatiPolygon = L.geoJSON(bagmatiFeature, {
            style: {
                color: '#60a5fa',
                weight: 3,
                opacity: 0,
                fillColor: '#60a5fa',
                fillOpacity: 0
            }
        }).addTo(map);
        console.log('Bagmati Province boundary added from official data');
    } else {
        console.warn('Bagmati Province not found in official data, loading from districts...');
        await loadDistrictBoundaries();
    }
}

// Load municipalities from official sources
async function loadOfficialMunicipalityBoundaries() {
    try {
        console.log('Loading official municipality boundaries...');
        
        // Try official/verified municipality data
        const sources = [
            'https://raw.githubusercontent.com/Acesmndr/nepal-geojson/master/generated-geojson/municipalities.geojson',
            'https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-municipalities.geojson'
        ];
        
        for (const source of sources) {
            try {
                const response = await fetch(source);
                if (response.ok) {
                    const data = await response.json();
                    await findNagarjunInData(data, source);
                    return;
                }
            } catch (err) {
                console.warn(`Failed to load from ${source}:`, err);
            }
        }
        
        console.warn('No municipality data sources available');
    } catch (error) {
        console.warn('Error loading official municipality boundaries:', error);
    }
}

// Find Nagarjun Municipality in the data
async function findNagarjunInData(municipalityData, source) {
    console.log(`Searching for Nagarjun Municipality in ${source}...`);
    console.log('Municipality data loaded, features count:', municipalityData.features?.length);
    
    // Search for Nagarjun Municipality
    const nagarjunFeature = municipalityData.features?.find(feature => {
        const name = feature.properties.NAME || '';
        return name.toLowerCase().includes('nagarjun');
    });
    
    if (nagarjunFeature) {
        console.log('Nagarjun Municipality found:', nagarjunFeature.properties);
        nagarjunPolygon = L.geoJSON(nagarjunFeature, {
            style: {
                color: '#fbbf24',
                weight: 3,
                opacity: 0,
                fillColor: '#fbbf24',
                fillOpacity: 0
            }
        }).addTo(map);
        console.log('Nagarjun Municipality boundary added successfully');
    } else {
        console.warn('Nagarjun Municipality not found in current data');
        // Log available municipality names for debugging
        const municipalityNames = municipalityData.features?.map(f => 
            f.properties.NAME || ''
        ).filter(name => name && name.toLowerCase().includes('nagar')).slice(0, 10);
        console.log('Sample municipalities with "nagar":', municipalityNames);
    }
}

// Load district boundaries as fallback for province data
async function loadDistrictBoundaries() {
    try {
        console.log('Loading official district boundaries as fallback...');
        
        // Try official district sources
        const sources = [
            'https://raw.githubusercontent.com/Acesmndr/nepal-geojson/master/generated-geojson/districts.geojson',
            'https://raw.githubusercontent.com/mesaugat/geoJSON-Nepal/master/nepal-districts-new.geojson'
        ];
        
        for (const source of sources) {
            try {
                const districtResponse = await fetch(source);
                if (!districtResponse.ok) continue;
                
                const districtData = await districtResponse.json();
                console.log(`District data loaded from ${source}, features count:`, districtData.features?.length);
                
                // Find Kathmandu district (where Nagarjun Municipality is located)
                const kathmanduFeature = districtData.features?.find(feature => {
                    const name = feature.properties.NAME || feature.properties.DISTRICT || '';
                    return name.toLowerCase().includes('kathmandu');
                });
                
                if (kathmanduFeature) {
                    console.log('Kathmandu District found as regional boundary:', kathmanduFeature.properties);
                    // Use this as proxy for Bagmati Province if province data wasn't found
                    if (!bagmatiPolygon) {
                        bagmatiPolygon = L.geoJSON(kathmanduFeature, {
                            style: {
                                color: '#60a5fa',
                                weight: 3,
                                opacity: 0,
                                fillColor: '#60a5fa',
                                fillOpacity: 0
                            }
                        }).addTo(map);
                        console.log('Using Kathmandu District as regional boundary proxy');
                    }
                }
                return; // Success, exit function
                
            } catch (err) {
                console.warn(`Failed to load districts from ${source}:`, err);
            }
        }
        
        console.warn('All district boundary sources failed');
        
    } catch (error) {
        console.warn('Error loading district boundaries:', error);
    }
}

// Fallback function with simplified boundaries (NOTE: Does not include Kalapani disputed territories)
function loadFallbackBoundaries() {
    console.log('Loading fallback boundaries...');
    console.warn('WARNING: Fallback boundaries do not include Kalapani, Lipulekh, and Limpiyadhura territories');
    
    // More accurate Nepal outline (simplified but recognizable shape)
    const nepalOutline = [
        [30.447, 80.056], [30.42, 80.52], [30.35, 81.0], [30.25, 81.5], [30.15, 82.0], 
        [30.05, 82.5], [29.95, 83.0], [29.85, 83.5], [29.75, 84.0], [29.65, 84.5],
        [29.55, 85.0], [29.45, 85.5], [29.35, 86.0], [29.25, 86.5], [29.15, 87.0],
        [29.05, 87.5], [28.95, 88.0], [28.85, 88.201], [28.7, 88.15], [28.5, 88.0],
        [28.3, 87.8], [28.1, 87.6], [27.9, 87.4], [27.7, 87.2], [27.5, 87.0],
        [27.3, 86.8], [27.1, 86.6], [26.9, 86.4], [26.7, 86.2], [26.5, 86.0],
        [26.4, 85.8], [26.35, 85.6], [26.3, 85.4], [26.25, 85.2], [26.2, 85.0],
        [26.25, 84.8], [26.3, 84.6], [26.35, 84.4], [26.4, 84.2], [26.45, 84.0],
        [26.5, 83.8], [26.55, 83.6], [26.6, 83.4], [26.65, 83.2], [26.7, 83.0],
        [26.8, 82.8], [26.9, 82.6], [27.0, 82.4], [27.1, 82.2], [27.2, 82.0],
        [27.3, 81.8], [27.4, 81.6], [27.5, 81.4], [27.6, 81.2], [27.7, 81.0],
        [27.8, 80.8], [27.9, 80.6], [28.0, 80.4], [28.2, 80.2], [28.5, 80.1],
        [28.8, 80.05], [29.2, 80.03], [29.6, 80.04], [30.0, 80.05], [30.447, 80.056]
    ];
    
    nepalPolygon = L.polygon(nepalOutline, {
        color: '#34d399',
        weight: 3,
        opacity: 0.8,
        fillColor: '#34d399',
        fillOpacity: 0.1,
        className: 'nepal-highlight'
    }).addTo(map);
    
    // Bagmati Province outline (more realistic shape around Kathmandu valley)
    const bagmatiOutline = [
        [28.3949, 84.9180], [28.35, 85.1], [28.3, 85.3], [28.25, 85.5], [28.2, 85.7], 
        [28.1, 85.9], [28.0, 86.0], [27.9, 86.1], [27.8, 86.15], [27.7, 86.1654],
        [27.6, 86.1], [27.5, 86.05], [27.4, 85.95], [27.3, 85.85], [27.2, 85.75],
        [27.1, 85.65], [27.0873, 85.55], [27.1, 85.45], [27.12, 85.35], [27.15, 85.25],
        [27.2, 85.15], [27.25, 85.05], [27.3, 84.98], [27.4, 84.94], [27.5, 84.92],
        [27.6, 84.91], [27.7, 84.915], [27.8, 84.92], [27.9, 84.93], [28.0, 84.95],
        [28.1, 84.98], [28.2, 85.0], [28.3, 85.02], [28.3949, 84.9180]
    ];
    
    bagmatiPolygon = L.polygon(bagmatiOutline, {
        color: '#60a5fa',
        weight: 3,
        opacity: 0,
        fillColor: '#60a5fa',
        fillOpacity: 0,
        className: 'bagmati-highlight'
    }).addTo(map);
    
    // Nagarjun Municipality outline (more detailed local boundary)
    const nagarjunOutline = [
        [27.7800, 85.2200], [27.7780, 85.2250], [27.7750, 85.2300], [27.7720, 85.2350],
        [27.7690, 85.2400], [27.7650, 85.2450], [27.7600, 85.2500], [27.7550, 85.2550],
        [27.7500, 85.2600], [27.7450, 85.2650], [27.7400, 85.2700], [27.7380, 85.2750],
        [27.7360, 85.2800], [27.7350, 85.2850], [27.7340, 85.2900], [27.7335, 85.2950],
        [27.7330, 85.3000], [27.7325, 85.3050], [27.7320, 85.3100], [27.7315, 85.3150],
        [27.7310, 85.3200], [27.7280, 85.3180], [27.7250, 85.3160], [27.7220, 85.3140],
        [27.7190, 85.3120], [27.7160, 85.3100], [27.7130, 85.3080], [27.7100, 85.3060],
        [27.7070, 85.3040], [27.7040, 85.3020], [27.7010, 85.3000], [27.6980, 85.2980],
        [27.6950, 85.2960], [27.6920, 85.2940], [27.6900, 85.2920], [27.6920, 85.2900],
        [27.6940, 85.2880], [27.6960, 85.2860], [27.6980, 85.2840], [27.7000, 85.2820],
        [27.7020, 85.2800], [27.7040, 85.2780], [27.7060, 85.2760], [27.7080, 85.2740],
        [27.7100, 85.2720], [27.7120, 85.2700], [27.7140, 85.2680], [27.7160, 85.2660],
        [27.7180, 85.2640], [27.7200, 85.2620], [27.7220, 85.2600], [27.7240, 85.2580],
        [27.7260, 85.2560], [27.7280, 85.2540], [27.7300, 85.2520], [27.7320, 85.2500],
        [27.7340, 85.2480], [27.7360, 85.2460], [27.7380, 85.2440], [27.7400, 85.2420],
        [27.7420, 85.2400], [27.7440, 85.2380], [27.7460, 85.2360], [27.7480, 85.2340],
        [27.7500, 85.2320], [27.7520, 85.2300], [27.7540, 85.2280], [27.7560, 85.2260],
        [27.7580, 85.2240], [27.7600, 85.2220], [27.7650, 85.2210], [27.7700, 85.2205],
        [27.7750, 85.2202], [27.7800, 85.2200]
    ];
    
    nagarjunPolygon = L.polygon(nagarjunOutline, {
        color: '#fbbf24',
        weight: 3,
        opacity: 0,
        fillColor: '#fbbf24',
        fillOpacity: 0,
        className: 'nagarjun-highlight'
    }).addTo(map);
    
    console.log('Fallback boundaries loaded successfully');
}


// Digital divide stories from Bhimdhunga, Nagarjun
const houseData = [
    {
        id: 1,
        lat: 27.725362, 
        lng: 85.224747,
        title: "The IT Professional's Home",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/family1_testimony.mp3",
        digitalAccess: "high",
        stats: {
            internetSpeed: "100 Mbps Fiber",
            devices: "5 smartphones, 3 laptops, 2 tablets",
            monthlyDataCost: "NPR 2,500",
            digitalSkills: "Advanced",
            onlineServices: "Banking, Shopping, Education, Work"
        },
        story: {
            quote: "\"Technology has transformed our lives completely. I work from home, kids attend online classes, we do everything digital.\"",
            reality: "Despite having all the tools, the family struggles with information overload and cyber security concerns. The children spend 8+ hours on screens daily.",
            testimonial: "The statistics show we're digitally connected, but we've lost human connection. My 12-year-old prefers texting over talking.",
            resident: "Rajesh Shrestha, Software Engineer"
        }
    },
    {
        id: 2,
        lat: 27.738000,
        lng: 85.238667,
        title: "Connected Family Home",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/family2_testimony.mp3",
        digitalAccess: "high",
        stats: {
            internetSpeed: "50 Mbps Fiber",
            devices: "4 smartphones, 2 laptops, 1 tablet",
            monthlyDataCost: "NPR 1,800",
            digitalSkills: "Good",
            onlineServices: "Banking, Education, Shopping"
        },
        story: {
            quote: "\"Our children can do homework online, but when internet fails, they struggle with offline alternatives.\"",
            reality: "High-speed internet enables digital learning, but creates dependency. Power outages and connectivity issues significantly impact daily routines.",
            testimonial: "We're digitally connected but realize how dependent we've become. During the last internet outage, even simple tasks became difficult.",
            resident: "Maya Shrestha, Teacher"
        }
    },
    {
        id: 3,
        lat: 27.738500,
        lng: 85.237750,
        title: "Multi-generational Digital Divide",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/family3_voices.mp3",
        digitalAccess: "medium",
        stats: {
            internetSpeed: "25 Mbps",
            devices: "5 smartphones, 1 laptop",
            monthlyDataCost: "NPR 1,500",
            digitalSkills: "Mixed - youth advanced, elders basic",
            onlineServices: "Social media, some banking"
        },
        story: {
            quote: "\"My grandchildren help me with digital payments, but I worry about being dependent on them.\"",
            reality: "Three generations under one roof experience different levels of digital comfort, creating both support networks and dependencies.",
            testimonial: "The young ones are always on phones helping us older people with apps and forms. It's good but also makes us feel helpless sometimes.",
            resident: "Bishnu Maharjan, Retired Government Officer"
        }
    },
    {
        id: 4,
        lat: 27.739389,
        lng: 85.236333,
        title: "Small Business Digital Transition",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/business_family.mp3",
        digitalAccess: "high",
        stats: {
            internetSpeed: "75 Mbps",
            devices: "3 smartphones, 2 laptops, POS system",
            monthlyDataCost: "NPR 2,200",
            digitalSkills: "Business-focused",
            onlineServices: "Digital payments, inventory, social marketing"
        },
        story: {
            quote: "\"Digital payments increased our customers, but we lost some elderly regulars who prefer cash only.\"",
            reality: "Business digitization brings efficiency and new customers while potentially excluding those less comfortable with technology.",
            testimonial: "Our business grew with digital tools, but we see how it creates barriers for some community members who struggle with technology.",
            resident: "Raju Tamang, Shop Owner"
        }
    },
    {
        id: 5,
        lat: 27.731611,
        lng: 85.236083,
        title: "Rural-Urban Digital Bridge",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/rural_urban_family.mp3",
        digitalAccess: "medium",
        stats: {
            internetSpeed: "20 Mbps (inconsistent)",
            devices: "4 smartphones, 1 shared laptop",
            monthlyDataCost: "NPR 1,200",
            digitalSkills: "Developing",
            onlineServices: "Remittances, video calls, basic banking"
        },
        story: {
            quote: "\"We moved here from the village for better internet, but still help relatives back home with digital services.\"",
            reality: "Families serve as digital bridges between rural areas and urban connectivity, supporting extended networks while managing their own digital adaptation.",
            testimonial: "Every week relatives call asking us to help them with online forms or digital payments. We're like the tech support for our whole extended family.",
            resident: "Kamala Gurung, Homemaker"
        }
    },
    {
        id: 6,
        lat: 27.729194,
        lng: 85.234389,
        title: "Elderly Couple's Adaptation Journey",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/elderly_adaptation.mp3",
        digitalAccess: "low",
        stats: {
            internetSpeed: "10 Mbps (shared)",
            devices: "2 basic smartphones",
            monthlyDataCost: "NPR 800",
            digitalSkills: "Limited but learning",
            onlineServices: "WhatsApp, some banking"
        },
        story: {
            quote: "\"Our grandchildren taught us WhatsApp, but online banking still scares us.\"",
            reality: "Senior citizens face the steepest learning curve in digital adoption, often relying on family members for digital tasks while trying to maintain independence.",
            testimonial: "We want to learn but worry about making mistakes with money online. The buttons are small and the language is confusing.",
            resident: "Devi & Hari Pradhan, Retired Farmers"
        }
    },
    {
        id: 7,
        lat: 27.726012,
        lng: 85.224607,
        title: "Young Professional's Home Office",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/remote_worker.mp3",
        digitalAccess: "high",
        stats: {
            internetSpeed: "100 Mbps dedicated",
            devices: "2 laptops, 3 smartphones, tablet, smart TV",
            monthlyDataCost: "NPR 3,000",
            digitalSkills: "Expert level",
            onlineServices: "All digital - work, banking, entertainment, shopping"
        },
        story: {
            quote: "\"I live completely digital, but I see how it isolates me from neighbors who aren't as connected.\"",
            reality: "Remote workers represent the most digitally integrated segment but often become inadvertent examples of digital inequality in their communities.",
            testimonial: "My internet is faster than some offices, but my elderly neighbor asks me to help with basic phone calls because her connection is unreliable.",
            resident: "Anita Shrestha, Software Developer"
        }
    },
    {
        id: 8,
        lat: 27.726464,
        lng: 85.224558,
        title: "Student Family Struggles",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/student_family.mp3",
        digitalAccess: "medium",
        stats: {
            internetSpeed: "15 Mbps (inconsistent)",
            devices: "3 smartphones, 1 shared laptop",
            monthlyDataCost: "NPR 1,000",
            digitalSkills: "Students advanced, parents basic",
            onlineServices: "Education, social media, limited banking"
        },
        story: {
            quote: "\"During online classes, we have to choose which child gets to use the laptop for homework.\"",
            reality: "Educational digitization reveals household resource constraints, where sharing devices becomes a daily challenge affecting children's academic performance.",
            testimonial: "When both kids have online assignments, one has to wait. The internet slows down when everyone is using it, and classes get interrupted.",
            resident: "Sita Maharjan, Mother of Two Students"
        }
    },
    {
        id: 9,
        lat: 27.726005,
        lng: 85.224614,
        title: "Extended Family Digital Hub",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/extended_family.mp3",
        digitalAccess: "high",
        stats: {
            internetSpeed: "60 Mbps fiber",
            devices: "8 smartphones, 3 laptops, 2 tablets, smart appliances",
            monthlyDataCost: "NPR 2,500",
            digitalSkills: "Mixed across generations",
            onlineServices: "Comprehensive digital services"
        },
        story: {
            quote: "\"Our house became the family tech support center - relatives come here for internet and digital help.\"",
            reality: "Well-connected households often become informal community digital service centers, supporting extended networks while managing their own high usage demands.",
            testimonial: "Every weekend relatives visit to video call family abroad, print documents, or get help with government forms online. We're like a one-family internet cafe.",
            resident: "Ramesh Tamang, Joint Family Head"
        }
    }
];

// Community area stories from Nagarjun Municipality Ward 8
const areaData = [
    {
        id: 1,
        lat: 27.732,
        lng: 85.240,
        title: "Majuwa Community Area",
        areaName: "Majuwa",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/majuwa_community.mp3",
        communityType: "traditional_village",
        digitalAccess: "mixed",
        stats: {
            households: "45 households",
            internetCoverage: "78% coverage",
            averageSpeed: "15-25 Mbps",
            digitalLiteracy: "45% adults, 85% youth",
            mainChallenges: "Infrastructure gaps, cost barriers"
        },
        story: {
            quote: "\"We live between two worlds - our traditional village life and the digital age demanding connection.\"",
            community_voice: "Majuwa represents the intersection of traditional Nepali village culture with modern digital demands. While younger generations adapt quickly, older community members struggle with the rapid technological changes.",
            digital_divide: "The community shows stark contrasts - tech-savvy youth helping elderly neighbors access government services online, while traditional practices continue alongside smartphone usage.",
            resident: "Community Leaders & Residents of Majuwa"
        },
        challenges: [
            "Inconsistent internet connectivity during monsoon",
            "High data costs relative to local incomes", 
            "Limited digital literacy programs for seniors",
            "Language barriers with English-only interfaces"
        ]
    },
    {
        id: 2,
        lat: 27.728,
        lng: 85.245,
        title: "Thaple Community Area", 
        areaName: "Thaple",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/thaple_voices.mp3",
        communityType: "mixed_residential",
        digitalAccess: "moderate",
        stats: {
            households: "62 households",
            internetCoverage: "82% coverage", 
            averageSpeed: "20-40 Mbps",
            digitalLiteracy: "58% adults, 90% youth",
            mainChallenges: "Quality inconsistency, digital skills gap"
        },
        story: {
            quote: "\"Every family has smartphones, but not every family knows how to use them for anything beyond calls and social media.\"",
            community_voice: "Thaple has better infrastructure than neighboring areas but faces quality and reliability issues. The community is actively working on digital inclusion initiatives.",
            digital_divide: "While most households have internet access, there's a significant divide in how effectively different demographics utilize digital services - from basic communication to accessing healthcare and education services online.",
            resident: "Thaple Community Development Committee"
        },
        challenges: [
            "Service interruptions affect home-based businesses",
            "Lack of local technical support",
            "Digital payment adoption slow among elderly",
            "Online education challenges during COVID highlighted gaps"
        ]
    },
    {
        id: 3,
        lat: 27.735,
        lng: 85.238,
        title: "Buspark Community Area",
        areaName: "Buspark", 
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/buspark_interviews.mp3",
        communityType: "commercial_residential",
        digitalAccess: "high",
        stats: {
            households: "38 households + businesses",
            internetCoverage: "95% coverage",
            averageSpeed: "30-50 Mbps", 
            digitalLiteracy: "72% adults, 95% youth",
            mainChallenges: "Digital security, information overload"
        },
        story: {
            quote: "\"Being near the bus park means we're connected to everything - roads, internet, opportunities, but also all the problems that come with connectivity.\"",
            community_voice: "Buspark area benefits from commercial infrastructure with high-speed internet and digital services, but faces challenges of urban digital life including security concerns and information management.",
            digital_divide: "The divide here isn't about access but about digital wellness and security. High connectivity brings cybersecurity risks, online fraud attempts, and the challenge of managing information overload.",
            resident: "Local Business Owners & Residents"
        },
        challenges: [
            "Cybersecurity threats and online fraud attempts",
            "Information overload affecting productivity", 
            "Privacy concerns with multiple digital services",
            "Balancing screen time in families"
        ]
    }
];

// Custom house icons based on digital access level
const getLocationIcon = (accessLevel) => {
    let color, className;
    
    switch(accessLevel) {
        case 'high':
            color = '#22c55e'; // Green for good connectivity
            className = 'house-marker high-access';
            break;
        case 'medium':
            color = '#fbbf24'; // Yellow for limited access
            className = 'house-marker medium-access';
            break;
        case 'low':
            color = '#ef4444'; // Red for poor connectivity/high digital divide
            className = 'house-marker low-access';
            break;
        default:
            color = '#6b7280'; // Gray for unknown
            className = 'house-marker';
    }
    
    return L.divIcon({
        html: `<i class="fa-solid fa-house fa-beat" style="color: ${color}; font-size: 24px;"></i>`,
        iconSize: [30, 30],
        className: className,
        iconAnchor: [15, 25]
    });
};

// Area data kept for reference (not used for markers, but for future community information)

// Store markers but don't add them immediately
let houseMarkers = [];
houseData.forEach(house => {
    const marker = L.marker([house.lat, house.lng], { icon: getLocationIcon(house.digitalAccess) })
        .on('click', () => openPopup(house));
    houseMarkers.push(marker);
});

// Community area circles (oval overlays with center + radius)
let thapleCircle = null;
let busparkCircle = null; 
let wardOfficeCircle = null;
let majuwaCircle = null;

// Area text labels
let areaLabels = [];
let wardOfficeMarker = null;
let schoolMarker = null;
let khajagharMarkers = [];
let streetInterviewMarkers = [];
let shopMarker = null;

// Create area circular overlays
function createAreaBoundaries() {
    // Thaple: blue theme, 400m radius
    thapleCircle = L.circle([27.738486, 85.235668], {
        color: '#2563eb',
        weight: 3,
        opacity: 0,
        fillColor: '#3b82f6',
        fillOpacity: 0,
        radius: 400,
        className: 'thaple-highlight'
    }).addTo(map);
    
    // Bhimdhunga Buspark: orange theme, 350m radius
    busparkCircle = L.circle([27.729622, 85.236152], {
        color: '#ea580c',
        weight: 3,
        opacity: 0,
        fillColor: '#f97316',
        fillOpacity: 0,
        radius: 350,
        className: 'buspark-highlight'
    }).addTo(map);
    
    // Ward Office: purple theme, 50m radius (reduced)
    wardOfficeCircle = L.circle([27.730474, 85.234039], {
        color: '#7c3aed',
        weight: 3,
        opacity: 0,
        fillColor: '#8b5cf6',
        fillOpacity: 0,
        radius: 50,
        className: 'wardoffice-highlight'
    }).addTo(map);
    
    // Majuwa: green theme, 250m radius
    majuwaCircle = L.circle([27.725122, 85.226066], {
        color: '#16a34a',
        weight: 3,
        opacity: 0,
        fillColor: '#22c55e',
        fillOpacity: 0,
        radius: 250,
        className: 'majuwa-highlight'
    }).addTo(map);
    
    // Add text labels for all areas
    createAreaLabels();
    
    // Create government building icon for Ward Office
    createWardOfficeMarker();
    
    // Create school icon
    createSchoolMarker();
    
    // Create khajaghar (tea shop) markers
    createKhajagharMarkers();
    
    // Create street interview markers
    createStreetInterviewMarkers();
    
    // Create shop marker
    createShopMarker();
}

// Create text labels for areas
function createAreaLabels() {
    const labelStyle = {
        permanent: true,
        direction: 'center',
        className: 'area-label'
    };
    
    // Thaple label
    const thapleLabel = L.marker([27.738486, 85.235668], {
        icon: L.divIcon({
            html: '<div class="area-text-label">Thaple</div>',
            className: 'area-label-container',
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        })
    }).addTo(map);
    areaLabels.push(thapleLabel);
    
    // Buspark label
    const busparkLabel = L.marker([27.729622, 85.236152], {
        icon: L.divIcon({
            html: '<div class="area-text-label">Buspark</div>',
            className: 'area-label-container',
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        })
    }).addTo(map);
    areaLabels.push(busparkLabel);
    
    // Majuwa label
    const majuwaLabel = L.marker([27.725122, 85.226066], {
        icon: L.divIcon({
            html: '<div class="area-text-label">Majuwa</div>',
            className: 'area-label-container',
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        })
    }).addTo(map);
    areaLabels.push(majuwaLabel);
    
    // Ward Office label (positioned slightly above the building icon)
    const wardLabel = L.marker([27.730474, 85.234059], {
        icon: L.divIcon({
            html: '<div class="area-text-label ward-label">Ward Office</div>',
            className: 'area-label-container',
            iconSize: [80, 20],
            iconAnchor: [40, 10]
        })
    }).addTo(map);
    areaLabels.push(wardLabel);
}

// Create government building marker for Ward Office
function createWardOfficeMarker() {
    wardOfficeMarker = L.marker([27.730474, 85.234039], {
        icon: L.divIcon({
            html: `
                <div class="government-building-icon">
                    <div class="building-base"></div>
                    <div class="building-pillars">
                        <div class="pillar"></div>
                        <div class="pillar"></div>
                        <div class="pillar"></div>
                    </div>
                    <div class="building-roof"></div>
                </div>
            `,
            className: 'ward-office-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 35]
        })
    }).on('click', () => openWardOfficePopup()).addTo(map);
}

// Create school marker
function createSchoolMarker() {
    schoolMarker = L.marker([27.724667, 85.228028], {
        icon: L.divIcon({
            html: `
                <div class="school-icon">
                    <div class="school-symbol">🎓</div>
                    <div class="school-base">
                        <div class="school-text">School</div>
                    </div>
                </div>
            `,
            className: 'school-marker',
            iconSize: [50, 45],
            iconAnchor: [25, 40]
        })
    }).on('click', () => openSchoolPopup()).addTo(map);
}

// Create khajaghar (tea shop) markers
function createKhajagharMarkers() {
    // Khajaghar locations (positioned around the community areas)
    const khajagharLocations = [
        {
            lat: 27.724592,
            lng: 85.224491,
            name: "Khajaghar 1"
        },
        {
            lat: 27.739199,
            lng: 85.236208,
            name: "Khajaghar 2"
        }
    ];
    
    khajagharLocations.forEach((location, index) => {
        const khajagharMarker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                html: `<i class="fa-solid fa-mug-hot fa-bounce" style="color: #dc2626; font-size: 20px;"></i>`,
                iconSize: [25, 25],
                className: 'khajaghar-marker',
                iconAnchor: [12.5, 20]
            })
        }).on('click', () => openKhajagharPopup(location)).addTo(map);
        
        khajagharMarkers.push(khajagharMarker);
    });
}

// Create street interview markers
function createStreetInterviewMarkers() {
    // Street interview locations
    const interviewLocations = [
        {
            lat: 27.731906,
            lng: 85.236138,
            name: "Street Interview 1",
            interviewType: "pedestrian"
        },
        {
            lat: 27.737444,
            lng: 85.233972,
            name: "Street Interview 2", 
            interviewType: "community"
        },
        {
            lat: 27.726670,
            lng: 85.224680,
            name: "Street Interview 3",
            interviewType: "neighborhood"
        }
    ];
    
    interviewLocations.forEach((location, index) => {
        const interviewMarker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                html: `<i class="fa-solid fa-comments fa-beat" style="color: #6366f1; font-size: 18px;"></i>`,
                iconSize: [22, 22],
                className: 'interview-marker',
                iconAnchor: [11, 18]
            })
        }).on('click', () => openStreetInterviewPopup(location)).addTo(map);
        
        streetInterviewMarkers.push(interviewMarker);
    });
}

// Create shop marker
function createShopMarker() {
    shopMarker = L.marker([27.729750, 85.236056], {
        icon: L.divIcon({
            html: `<i class="fa-solid fa-shop" style="color: #ea580c; font-size: 20px;"></i>`,
            iconSize: [25, 25],
            className: 'shop-marker',
            iconAnchor: [12.5, 20]
        })
    }).on('click', () => openShopPopup()).addTo(map);
}

// Enhanced cinematic sequence with user interaction
let userInteracted = false;

// Input detection for continuing the sequence
function waitForUserInput() {
    return new Promise((resolve) => {
        const handleInput = () => {
            if (!userInteracted) {
                userInteracted = true;
                document.removeEventListener('click', handleInput);
                document.removeEventListener('keydown', handleInput);
                resolve();
            }
        };
        
        document.addEventListener('click', handleInput);
        document.addEventListener('keydown', handleInput);
    });
}

// Cinematic video sequence to replace manual zoom
async function startVideoSequence() {
    const statsOverlay = document.getElementById('national-stats-overlay');
    const videoOverlay = document.getElementById('cinematic-video-overlay');
    const cinematicVideo = document.getElementById('cinematic-video');
    const skipButton = document.getElementById('skip-video');
    
    // Wait for user input
    await waitForUserInput();
    
    // Phase 1: Fade out stats, show video
    statsOverlay.style.animation = 'overlayFadeOut 1s ease-out forwards';
    
    setTimeout(() => {
        statsOverlay.style.display = 'none';
        videoOverlay.style.display = 'flex';
        videoOverlay.classList.add('video-fade-in');
        
        // Play the video
        cinematicVideo.currentTime = 0;
        cinematicVideo.play().catch(e => {
            console.warn('Video autoplay failed:', e);
            // If autoplay fails, skip directly to map
            skipToMap();
        });
        
        // Skip button functionality
        skipButton.onclick = skipToMap;
        
        // When video ends, automatically go to map
        cinematicVideo.onended = skipToMap;
        
    }, 1000);
    
    function skipToMap() {
        videoOverlay.classList.add('video-fade-out');
        cinematicVideo.pause();
        
        setTimeout(() => {
            videoOverlay.style.display = 'none';
            videoOverlay.classList.remove('video-fade-in', 'video-fade-out');
            
            // Set map to Nagarjun Municipality Ward 8 center
            map.setView([27.733, 85.240], 15);
            
            // Create area boundaries
            createAreaBoundaries();
            
            // Start area highlighting sequence
            setTimeout(() => {
                startAreaHighlighting();
            }, 1000);
            
        }, 500);
    }
    
    // Load all Nagarjun areas at once - no dramatic sequence
    function startAreaHighlighting() {
        // Show all areas immediately with subtle highlighting
        if (thapleCircle) {
            thapleCircle.setStyle({
                color: '#2563eb',
                weight: 2,
                opacity: 0.7,
                fillColor: '#3b82f6',
                fillOpacity: 0.15
            });
        }
        
        if (busparkCircle) {
            busparkCircle.setStyle({
                color: '#ea580c',
                weight: 2,
                opacity: 0.7,
                fillColor: '#f97316',
                fillOpacity: 0.15
            });
        }
        
        if (wardOfficeCircle) {
            wardOfficeCircle.setStyle({
                color: '#7c3aed',
                weight: 2,
                opacity: 0.7,
                fillColor: '#8b5cf6',
                fillOpacity: 0.15
            });
        }
        
        if (majuwaCircle) {
            majuwaCircle.setStyle({
                color: '#16a34a',
                weight: 2,
                opacity: 0.7,
                fillColor: '#22c55e',
                fillOpacity: 0.15
            });
        }
        
        // Add house markers immediately after areas load
        setTimeout(() => {
            houseMarkers.forEach((marker, index) => {
                setTimeout(() => {
                    marker.addTo(map);
                    const element = marker.getElement();
                    if (element) {
                        element.style.animation = 'markerDrop 0.6s ease-out';
                    }
                }, index * 200);
            });
        }, 500);
    }
}

// Complete cinematic sequence on page load
window.addEventListener('load', async () => {
    const splashScreen = document.getElementById('splash-screen');
    const statsOverlay = document.getElementById('national-stats-overlay');
    const videoOverlay = document.getElementById('cinematic-video-overlay');
    
    // Initially hide overlays until we're ready
    statsOverlay.style.display = 'none';
    videoOverlay.style.display = 'none';
    
    // Load geographic boundaries in background
    console.log('Starting boundary loading...');
    await loadGeographicBoundaries();
    
    // Phase 1: Show ALIN splash screen for 4 seconds
    setTimeout(() => {
        splashScreen.style.animation = 'splashFadeOut 1s ease-out forwards';
        
        // Phase 2: Show Nepal map with statistics overlay
        setTimeout(() => {
            splashScreen.style.display = 'none';
            statsOverlay.style.display = 'flex';
            
            // Start the video sequence (waits for user input) - no Nepal highlighting
            startVideoSequence();
            
        }, 1000);
    }, 4000);
});

// Modal elements
const modal = document.getElementById('popup-modal');
const closeBtn = document.querySelector('.close');

// Function to open Shop popup
function openShopPopup() {
    document.getElementById('popup-title').textContent = 'Local Shop - Community Commerce Hub';
    document.getElementById('popup-video').src = '';
    document.getElementById('popup-audio').src = '';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Neighborhood Shop';
    document.getElementById('interview-count').textContent = 'Commercial Digital Services';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'COMMERCE';
    accessBadge.className = 'badge commerce-access';
    
    // Update content with shop information
    document.getElementById('resident-quote').textContent = '"Digital payments have changed our business, but we still need to serve customers who prefer cash transactions."';
    document.getElementById('resident-name').textContent = '— Shop Owner';
    document.getElementById('resident-testimonial').textContent = 'Local shops serve as important digital transition points in the community. They introduce customers to digital payment systems while maintaining traditional cash services. Shop owners often help customers navigate digital payment apps and mobile banking.';
    document.getElementById('reality-text').textContent = 'Shops experience the digital divide directly through customer payment preferences. While digital payments increase efficiency and reduce cash handling risks, they can exclude customers uncomfortable with technology.';
    
    // Update statistics with shop data
    document.getElementById('internet-speed').textContent = '30 Mbps business connection';
    document.getElementById('devices').textContent = 'POS system, business smartphone, calculator';
    document.getElementById('monthly-cost').textContent = 'NPR 1,500 (business plan)';
    document.getElementById('digital-skills').textContent = 'Payment systems, inventory apps';
    document.getElementById('online-services').textContent = 'Digital payments, mobile banking, suppliers';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to open Street Interview popup
function openStreetInterviewPopup(location) {
    document.getElementById('popup-title').textContent = `${location.name} - Street Interview`;
    document.getElementById('popup-video').src = '';
    document.getElementById('popup-audio').src = '';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Public Space Interview';
    document.getElementById('interview-count').textContent = 'Street-level Perspectives';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'INTERVIEW';
    accessBadge.className = 'badge interview-access';
    
    // Update content with street interview information
    document.getElementById('resident-quote').textContent = '"Street interviews reveal the everyday challenges people face with digital services in public spaces."';
    document.getElementById('resident-name').textContent = '— Community Members';
    document.getElementById('resident-testimonial').textContent = 'Street-level conversations capture spontaneous insights about digital access, mobile data usage, and how people navigate digital services while moving through their community. These interviews provide unfiltered perspectives on digital divide realities.';
    document.getElementById('reality-text').textContent = 'Public space interviews often reveal different digital behaviors than household interviews, showing how people adapt to connectivity challenges while away from home wifi and reliable power sources.';
    
    // Update statistics with interview data
    document.getElementById('internet-speed').textContent = 'Mobile data dependent';
    document.getElementById('devices').textContent = 'Personal smartphones';
    document.getElementById('monthly-cost').textContent = 'Variable data plans';
    document.getElementById('digital-skills').textContent = 'Practical mobile skills';
    document.getElementById('online-services').textContent = 'On-the-go digital needs';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to open Khajaghar popup
function openKhajagharPopup(location) {
    document.getElementById('popup-title').textContent = `${location.name} - Community Tea Shop`;
    document.getElementById('popup-video').src = '';
    document.getElementById('popup-audio').src = '';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Traditional Tea Shop (Khajaghar)';
    document.getElementById('interview-count').textContent = 'Community Gathering Place';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'SOCIAL HUB';
    accessBadge.className = 'badge social-access';
    
    // Update content with khajaghar information
    document.getElementById('resident-quote').textContent = '"The khajaghar is where people come to discuss everything - from local news to digital services. It\'s our informal information center."';
    document.getElementById('resident-name').textContent = '— Local Tea Shop Owner';
    document.getElementById('resident-testimonial').textContent = 'Traditional khajaghar serve as important social spaces where community members share information about digital services, help each other with online forms, and discuss the challenges of adapting to digital systems. They often become informal digital literacy centers.';
    document.getElementById('reality-text').textContent = 'While khajaghar don\'t typically have formal internet access, they play a crucial role in the digital divide story as spaces where people share knowledge about digital services and help each other navigate online systems.';
    
    // Update statistics with khajaghar data
    document.getElementById('internet-speed').textContent = 'Personal mobile data only';
    document.getElementById('devices').textContent = 'Customer smartphones, radio';
    document.getElementById('monthly-cost').textContent = 'Varies by customer';
    document.getElementById('digital-skills').textContent = 'Community knowledge sharing';
    document.getElementById('online-services').textContent = 'Informal digital help center';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to open School popup
function openSchoolPopup() {
    document.getElementById('popup-title').textContent = 'Local School - Digital Education Hub';
    document.getElementById('popup-video').src = '';
    document.getElementById('popup-audio').src = '';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Educational Institution';
    document.getElementById('interview-count').textContent = 'Digital Learning Center';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'EDUCATION';
    accessBadge.className = 'badge education-access';
    
    // Update content with school information
    document.getElementById('resident-quote').textContent = '"Technology has transformed how our students learn, but the digital divide affects which students can fully participate."';
    document.getElementById('resident-name').textContent = '— School Administration';
    document.getElementById('resident-testimonial').textContent = 'The school serves as a digital bridge in the community, providing computer labs and internet access for students. However, homework requiring internet access creates challenges for students from households with limited connectivity.';
    document.getElementById('reality-text').textContent = 'While the school has good digital infrastructure, students\' varying levels of home internet access create educational inequalities. Online learning during COVID-19 highlighted these disparities in digital access among families.';
    
    // Update statistics with school data
    document.getElementById('internet-speed').textContent = 'High-speed institutional connection';
    document.getElementById('devices').textContent = 'Computer lab, tablets, smart boards';
    document.getElementById('monthly-cost').textContent = 'Educational funding';
    document.getElementById('digital-skills').textContent = 'Teachers trained in digital pedagogy';
    document.getElementById('online-services').textContent = 'E-learning platforms, digital resources';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to open Ward Office popup
function openWardOfficePopup() {
    document.getElementById('popup-title').textContent = 'Nagarjun Municipality Ward 8 Office';
    document.getElementById('popup-video').src = '';
    document.getElementById('popup-audio').src = '';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Ward Office - Government Building';
    document.getElementById('interview-count').textContent = 'Administrative Center';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'GOVERNMENT';
    accessBadge.className = 'badge government-access';
    
    // Update content with government office information
    document.getElementById('resident-quote').textContent = '"The Ward Office serves as the local administrative hub connecting residents with digital government services."';
    document.getElementById('resident-name').textContent = '— Ward Office Administration';
    document.getElementById('resident-testimonial').textContent = 'The Ward Office facilitates digital service delivery including online forms, digital payments for municipal services, and e-governance initiatives. It serves as a bridge between traditional governance and digital transformation.';
    document.getElementById('reality-text').textContent = 'While the office promotes digital services, many residents still prefer in-person visits for government transactions, highlighting the ongoing digital divide in public service delivery.';
    
    // Update statistics with government office data
    document.getElementById('internet-speed').textContent = 'High-speed fiber connection';
    document.getElementById('devices').textContent = 'Government workstations, public terminals';
    document.getElementById('monthly-cost').textContent = 'Government funded';
    document.getElementById('digital-skills').textContent = 'Staff trained in e-governance';
    document.getElementById('online-services').textContent = 'Birth certificates, tax payments, permits';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to open popup with digital divide story
function openPopup(house) {
    document.getElementById('popup-title').textContent = house.title;
    document.getElementById('popup-video').src = house.video || '';
    document.getElementById('popup-audio').src = house.audio || '';
    
    // Update location information
    document.getElementById('location-name').textContent = house.locationName || '';
    document.getElementById('interview-count').textContent = house.interviewCount || '';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = house.digitalAccess.toUpperCase();
    accessBadge.className = `badge ${house.digitalAccess}-access`;
    
    // Update story content - handle empty fields gracefully
    document.getElementById('resident-quote').textContent = house.story.quote || '[Interview content to be added]';
    document.getElementById('resident-name').textContent = house.story.resident ? `— ${house.story.resident}` : '';
    document.getElementById('resident-testimonial').textContent = house.story.testimonial || '[Interview content to be added]';
    document.getElementById('reality-text').textContent = house.story.reality || '[Analysis to be added based on interview data]';
    
    // Update digital statistics - handle TBD values
    document.getElementById('internet-speed').textContent = house.stats.internetSpeed || 'TBD';
    document.getElementById('devices').textContent = house.stats.devices || 'TBD';
    document.getElementById('monthly-cost').textContent = house.stats.monthlyDataCost || 'TBD';
    document.getElementById('digital-skills').textContent = house.stats.digitalSkills || 'TBD';
    document.getElementById('online-services').textContent = house.stats.onlineServices || 'TBD';
    
    // Add context information if available
    if (house.context) {
        console.log('Location context:', house.context);
    }
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Close modal when clicking X
closeBtn.onclick = function() {
    modal.classList.remove('show');
    document.getElementById('map').classList.remove('map-with-panel');
    setTimeout(() => {
        modal.style.display = 'none';
        map.invalidateSize();
    }, 300);
    document.getElementById('popup-video').pause();
    document.getElementById('popup-audio').pause();
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
        document.getElementById('popup-video').pause();
        document.getElementById('popup-audio').pause();
    }
}