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

// Marker reference storage for highlighting
let markerReferences = {
    houses: [],
    khajaghar: [],
    school: null,
    streetInterviews: [],
    areas: []
};

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
        youtubeId: "dQw4w9WgXcQ", // Example YouTube video ID - replace with actual interviews
        audio: "audio/family1_testimony.mp3",
        digitalAccess: "high",
        ageCategory: "digital_native",
        selfEfficacy: "high_confidence",
        ageJourneyOrder: 4,
        efficacyJourneyOrder: 4,
        profile: {
            headshot: "https://via.placeholder.com/120x120/3b82f6/ffffff?text=R.S.",
            role: "Software Engineer & Family Head",
            description: "A tech professional who works remotely while managing a digitally connected household. Despite having advanced digital access, his family faces challenges of screen time management and maintaining human connections."
        },
        photos: [
            {
                image: "https://via.placeholder.com/400x200/f1f5f9/64748b?text=Home+Office+Setup",
                quote: "\"In the past when there is no phone all the family members sit together... but after all the people got phones everybody enjoys their own, not like before\" - Digital Divide Reality"
            },
            {
                image: "https://via.placeholder.com/400x200/f1f5f9/64748b?text=Family+Tech+Time",
                quote: "\"The older generation doesn't have knowledge about technology, but new generation went too far, that's why we have to teach the older generation\" - Generational Gap"
            },
            {
                image: "https://via.placeholder.com/400x200/f1f5f9/64748b?text=Digital+Learning",
                quote: "\"Online class was so difficult because data didn't work properly... we have to go on the height, top of the hills because of poor network\" - Network Challenges"
            }
        ],
        stats: {
            internetSpeed: "100 Mbps Fiber",
            devices: "5 smartphones, 3 laptops, 2 tablets",
            monthlyDataCost: "NPR 2,500",
            digitalSkills: "Advanced",
            onlineServices: "Banking, Shopping, Education, Work"
        },
        story: {
            quote: "\"Everyday argument. We scold them but still they don't respond properly... Classic tech is worst\" - Internet Provider Issues",
            reality: "Despite having high-speed connectivity, the family experiences the social costs of digital saturation and infrastructure reliability issues that affect daily life.",
            testimonial: "Connection cost NPR 17,000, 7-8 years ago. Speed varies - 350mbps in some homes, 50-80mbps in others. But the real cost is how technology changed our family dynamics.",
            resident: "Sachin & Family, Digital Divide Experience"
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
        ageCategory: "late_adopter",
        selfEfficacy: "low_persistence",
        ageJourneyOrder: 3,
        efficacyJourneyOrder: 2,
        participant: "Principal", // Reference to actual interview participant
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
        ageCategory: "elderly",
        selfEfficacy: "complete_avoidance",
        ageJourneyOrder: 1,
        efficacyJourneyOrder: 1,
        participant: "Maili Tamang", // Reference to actual interview participant
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
    },
    {
        id: 10,
        lat: 27.717359398869263,
        lng: 85.33453670762191,
        title: "ALIN Foundation Building",
        digitalAccess: "foundation",
        isFoundation: true,
        foundation: {
            name: "All In Foundation",
            mission: "ALIN is a social impact company that works in various sectors to address the unjust walls of power and privilege in Nepal and beyond.",
            description: "All In Solutions Fellowship is an interdisciplinary fellowship that focuses on innovative solutions to Nepal's (or global) complex problems.",
            logo: "ALIN_logo.jpg",
            // teamPhotos: [
            //     {
            //         name: "Research Fellow 1",
            //         role: "Digital Divide Researcher",
            //         photo: "https://via.placeholder.com/150x150/3b82f6/ffffff?text=RF1",
            //         bio: "Focuses on rural-urban digital transition patterns"
            //     },
            //     {
            //         name: "Research Fellow 2", 
            //         role: "Community Technology Coordinator",
            //         photo: "https://via.placeholder.com/150x150/10b981/ffffff?text=RF2",
            //         bio: "Specializes in community-based digital literacy programs"
            //     },
            //     {
            //         name: "Research Fellow 3",
            //         role: "Data Storytelling Specialist", 
            //         photo: "https://via.placeholder.com/150x150/f59e0b/ffffff?text=RF3",
            //         bio: "Creates multimedia narratives from research findings"
            //     }
            // ],
            faq: [
                {
                    question: "What is the All In Fellowship?",
                    answer: "The All In Fellowship supports early-career researchers investigating digital equity challenges in Nepal. Fellows conduct community-based research to understand how digital technologies impact daily life across different demographics and geographic areas."
                },
                {
                    question: "How was this storymap project created?",
                    answer: "This interactive storymap was developed through extensive fieldwork in Bhimdhunga, Nagarjun Municipality. Fellows conducted household interviews, collected multimedia testimonials, and mapped the geographic distribution of digital access to create this comprehensive view of the local digital divide."
                },
                {
                    question: "What other projects has this fellowship cohort created?",
                    answer: "This cohort has produced research on digital payment adoption in rural markets, online education accessibility during COVID-19, and intergenerational technology transfer within families. Each project combines quantitative data with personal stories to reveal the human impact of digital divides."
                },
                {
                    question: "How can communities use this research?",
                    answer: "This research provides evidence for policy makers, community organizations, and technology providers to design more inclusive digital services. The stories and data help identify specific barriers and successful adaptation strategies that can inform broader digital equity initiatives."
                }
            ],
            fellowshipProjects: [
                {
                    title: "Mankiri",
                    description: "A campaign aiming to promote the visibility and foster solidarity and open discussion on mental health of peri and post menopausal women",
                    status: "Completed",
                    link: "#team-mankiri"
                },
                {
                    title: "Shreejanshil",
                    description: "A documentary journey into the daily struggles, hopes and change in the Dom community",
                    status: "Completed",
                    link: "#team-shreejanshil"
                }
            ]
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
    let color, className, iconHtml;
    
    switch(accessLevel) {
        case 'high':
            color = '#22c55e'; // Green for good connectivity
            className = 'house-marker high-access';
            iconHtml = `<i class="fa-solid fa-house fa-beat" style="color: ${color}; font-size: 24px;"></i>`;
            break;
        case 'medium':
            color = '#fbbf24'; // Yellow for limited access
            className = 'house-marker medium-access';
            iconHtml = `<i class="fa-solid fa-house fa-beat" style="color: ${color}; font-size: 24px;"></i>`;
            break;
        case 'low':
            color = '#ef4444'; // Red for poor connectivity/high digital divide
            className = 'house-marker low-access';
            iconHtml = `<i class="fa-solid fa-house fa-beat" style="color: ${color}; font-size: 24px;"></i>`;
            break;
        case 'foundation':
            color = '#dc2626'; // Red for foundation
            className = 'foundation-marker';
            iconHtml = `<i class="fa-solid fa-location-dot fa-beat" style="color: ${color}; font-size: 28px;"></i>`;
            break;
        default:
            color = '#6b7280'; // Gray for unknown
            className = 'house-marker';
            iconHtml = `<i class="fa-solid fa-house fa-beat" style="color: ${color}; font-size: 24px;"></i>`;
    }
    
    return L.divIcon({
        html: iconHtml,
        iconSize: [30, 30],
        className: className,
        iconAnchor: [15, 25]
    });
};

// Area data kept for reference (not used for markers, but for future community information)

// Store markers but don't add them immediately
let houseMarkers = [];
let foundationLabel = null;
let foundationHouse = null;

houseData.forEach(house => {
    const marker = L.marker([house.lat, house.lng], { icon: getLocationIcon(house.digitalAccess) })
        .on('click', () => openPopup(house));
    houseMarkers.push(marker);
    
    // Store reference for highlighting system (only non-foundation houses)
    if (!house.isFoundation) {
        markerReferences.houses.push(marker);
    }
    
    // Create label for foundation marker
    if (house.isFoundation) {
        foundationHouse = house; // Store reference to foundation house data
        foundationLabel = L.marker([house.lat - 0.001, house.lng], {
            icon: L.divIcon({
                html: '<div class="foundation-label">All In Foundation</div>',
                className: 'foundation-label-container',
                iconSize: [140, 28],
                iconAnchor: [70, 14]
            })
        }).on('click', () => openPopup(foundationHouse));
    }
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
    wardOfficeCircle = L.circle([27.732760, 85.233694], {
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
    const wardLabel = L.marker([27.732760, 85.233714], {
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
    wardOfficeMarker = L.marker([27.732760, 85.233694], {
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
    
    // Store reference for highlighting system
    markerReferences.school = schoolMarker;
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
        
        // Store reference for highlighting system with location name
        khajagharMarker.options.title = location.name;
        markerReferences.khajaghar.push(khajagharMarker);
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
        
        // Store reference for highlighting system with location name
        interviewMarker.options.title = location.name;
        markerReferences.streetInterviews.push(interviewMarker);
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
    console.log('startVideoSequence called');
    const statsOverlay = document.getElementById('national-stats-overlay');
    const videoOverlay = document.getElementById('cinematic-video-overlay');
    const cinematicVideo = document.getElementById('cinematic-video');
    const skipButton = document.getElementById('skip-video');
    
    console.log('Waiting for user input...');
    // Wait for user input
    await waitForUserInput();
    console.log('User input received, proceeding with video...');
    
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
            
            // Show navbar after cinematic sequence
            showNavbar();
            
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
            
            // Add foundation label if it exists
            if (foundationLabel) {
                setTimeout(() => {
                    foundationLabel.addTo(map);
                }, houseMarkers.length * 200 + 200);
            }
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
    
    // Load geographic boundaries in background (don't wait for it)
    console.log('Starting boundary loading in background...');
    loadGeographicBoundaries().catch(error => {
        console.warn('Boundary loading failed, continuing without boundaries:', error);
    });
    
    // Phase 1: Show ALIN splash screen for 4 seconds
    console.log('Starting splash screen sequence...');
    setTimeout(() => {
        console.log('Phase 1: Fading out splash screen...');
        splashScreen.style.animation = 'splashFadeOut 1s ease-out forwards';
        
        // Phase 2: Show Nepal map with statistics overlay
        setTimeout(() => {
            console.log('Phase 2: Showing statistics overlay...');
            splashScreen.style.display = 'none';
            statsOverlay.style.display = 'flex';
            
            // Start the video sequence (waits for user input) - no Nepal highlighting
            console.log('Starting video sequence...');
            startVideoSequence();
            
        }, 1000);
    }, 4000);
});

// Modal elements
const modal = document.getElementById('popup-modal');
const closeBtn = document.querySelector('.close');

// Function to open Shop popup
function openShopPopup() {
    // Hide navbar
    hideNavbar();
    
    document.getElementById('popup-title').textContent = 'Local Shop - Community Commerce Hub';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Neighborhood Shop';
    document.getElementById('interview-count').textContent = 'Commercial Digital Services';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'COMMERCE';
    accessBadge.className = 'badge commerce-access';
    
    // Show resident content, hide foundation content
    document.getElementById('resident-content').style.display = 'block';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'block';
    
    // Update profile section
    document.getElementById('resident-headshot').src = 'https://via.placeholder.com/120x120/ea580c/ffffff?text=🏪';
    document.getElementById('resident-name').textContent = 'Shop Owner';
    document.getElementById('resident-role').textContent = 'Local Business Owner';
    document.getElementById('resident-description').textContent = 'Local shops serve as important digital transition points in the community. They introduce customers to digital payment systems while maintaining traditional cash services.';
    
    // Update photo collage
    document.getElementById('photo-1').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Digital+Payment+System';
    document.getElementById('photo-2').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Customer+Service';
    document.getElementById('photo-3').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Local+Commerce';
    
    document.getElementById('quote-1').textContent = '"Digital payments have changed our business, but we still need to serve customers who prefer cash transactions."';
    document.getElementById('quote-2').textContent = '"Some elderly customers struggle with mobile banking apps."';
    document.getElementById('quote-3').textContent = '"We help bridge the gap between traditional and digital commerce."';
    
    // Update first video
    document.getElementById('video-1-heading').textContent = '🎥 Shop Operations';
    document.getElementById('youtube-video').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    
    // Hide second and third video sections (not needed for shop)
    document.getElementById('video-2-section').style.display = 'none';
    document.getElementById('video-3-section').style.display = 'none';
    
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
    // Hide navbar
    hideNavbar();
    
    document.getElementById('popup-title').textContent = `${location.name} - Street Interview`;
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Public Space Interview';
    document.getElementById('interview-count').textContent = 'Street-level Perspectives';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'INTERVIEW';
    accessBadge.className = 'badge interview-access';
    
    // Show resident content, hide foundation content
    document.getElementById('resident-content').style.display = 'block';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'block';
    
    // Update profile section - check if this is Maili Tamang (Street Interview 3)
    if (location.name === 'Street Interview 3') {
        document.getElementById('resident-headshot').src = '/home/rimal/test-project/interviews/street interview/street interview 3/Maili Tamang.JPG';
        document.getElementById('resident-name').textContent = 'Maili Tamang';
        document.getElementById('resident-role').textContent = 'Elderly Community Member (Complete Digital Avoidance)';
        document.getElementById('resident-description').textContent = 'Traditional homemaker representing complete digital non-participation. Her perspective on mobile phones reveals generational concerns about technology adoption and cultural values.';
    } else {
        document.getElementById('resident-headshot').src = 'https://via.placeholder.com/120x120/6366f1/ffffff?text=🎤';
        document.getElementById('resident-name').textContent = 'Community Members';
        document.getElementById('resident-role').textContent = 'Street Interview Participants';
        document.getElementById('resident-description').textContent = 'Street-level conversations capture spontaneous insights about digital access, mobile data usage, and how people navigate digital services while moving through their community.';
    }
    
    // Update photo collage
    document.getElementById('photo-1').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Street+Interviews';
    document.getElementById('photo-2').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Mobile+Usage';
    document.getElementById('photo-3').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Public+Spaces';
    
    // Update quotes and video based on location
    if (location.name === 'Street Interview 3') {
        document.getElementById('quote-1').textContent = '"I don\'t need these machines. My hands and voice have served me well for 70 years."';
        document.getElementById('quote-2').textContent = '"When neighbors need help with technology, they ask their children, not me. I stick to what I know."';
        document.getElementById('quote-3').textContent = '"My grandchildren live in their phones. I worry they\'re forgetting how to live in the real world."';
        
        // Maili's actual video
        document.getElementById('video-1-heading').textContent = '🎥 Perception of Mobile Phones - Maili Tamang';
        document.getElementById('youtube-video').src = 'https://drive.google.com/file/d/1TtkMt7IbRgbdaof_zOenLbqyy5MuRDcg/preview';
    } else {
        document.getElementById('quote-1').textContent = '"Street interviews reveal the everyday challenges people face with digital services in public spaces."';
        document.getElementById('quote-2').textContent = '"Mobile data is expensive but necessary for staying connected while away from home."';
        document.getElementById('quote-3').textContent = '"Public wifi is unreliable, so we depend on our phone data plans."';
        
        document.getElementById('video-1-heading').textContent = '🎥 Street Conversations';
        document.getElementById('youtube-video').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    }
    
    // Hide second and third video sections (not needed for interviews)
    document.getElementById('video-2-section').style.display = 'none';
    document.getElementById('video-3-section').style.display = 'none';
    
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
    // Hide navbar
    hideNavbar();
    
    document.getElementById('popup-title').textContent = `${location.name} - Community Tea Shop`;
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Traditional Tea Shop (Khajaghar)';
    document.getElementById('interview-count').textContent = 'Community Gathering Place';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'SOCIAL HUB';
    accessBadge.className = 'badge social-access';
    
    // Show resident content, hide foundation content
    document.getElementById('resident-content').style.display = 'block';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'block';
    
    // Update profile section
    document.getElementById('resident-headshot').src = 'https://via.placeholder.com/120x120/dc2626/ffffff?text=☕';
    document.getElementById('resident-name').textContent = 'Tea Shop Owner';
    document.getElementById('resident-role').textContent = 'Community Hub Keeper';
    document.getElementById('resident-description').textContent = 'Traditional khajaghar serve as important social spaces where community members share information about digital services, help each other with online forms, and discuss the challenges of adapting to digital systems.';
    
    // Update photo collage
    document.getElementById('photo-1').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Tea+Shop+Gathering';
    document.getElementById('photo-2').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Community+Discussions';
    document.getElementById('photo-3').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Digital+Help';
    
    document.getElementById('quote-1').textContent = '"The khajaghar is where people come to discuss everything - from local news to digital services."';
    document.getElementById('quote-2').textContent = '"Customers often help each other with smartphone apps over tea."';
    document.getElementById('quote-3').textContent = '"We share knowledge about online forms and digital payments here."';
    
    // Check if this is Khajaghar 2 (with 3 videos) or Khajaghar 1 (with 1 video)
    if (location.name === "Khajaghar 2") {
        // Khajaghar 2 - Aman Tamang (17, digital native) - Show all 3 videos with Google Drive links
        document.getElementById('resident-name').textContent = 'Aman Tamang';
        document.getElementById('resident-role').textContent = '17-year-old Digital Native';
        document.getElementById('resident-description').textContent = 'Young community member who represents the digital native generation, helping bridge the gap between traditional community spaces and modern digital connectivity.';
        
        // Update quotes for Aman's perspective
        document.getElementById('quote-1').textContent = '"I help older people at the khajaghar with their phones and online forms. They know so much about life, I know about technology."';
        document.getElementById('quote-2').textContent = '"My friends and I use this place differently than our parents - we come here to share WiFi and help the community with digital stuff."';
        document.getElementById('quote-3').textContent = '"The khajaghar is changing. Now people bring their phones and ask for help with apps, not just tea."';
        document.getElementById('video-1-heading').textContent = '🎥 Tea Shop Stories - Part 1';
        document.getElementById('youtube-video').src = 'https://drive.google.com/file/d/1JKIY2IFiJJuLgO3dgnPX0r7kZfSR9HZs/preview';
        
        document.getElementById('video-2-section').style.display = 'block';
        document.getElementById('video-2-heading').textContent = '🎥 Tea Shop Stories - Part 2';
        document.getElementById('second-video').src = 'https://drive.google.com/file/d/1hLANscn_QwqB7kikdPvgiBnBowQRBiYf/preview';
        
        document.getElementById('video-3-section').style.display = 'block';
        document.getElementById('video-3-heading').textContent = '🎥 Tea Shop Stories - Part 3';
        document.getElementById('third-video').src = 'https://drive.google.com/file/d/1AtMPVtt5veyhsd_PKRIl9ruxG7pzGo7n/preview';
    } else {
        // Khajaghar 1 - Sunita Tamang (Cultural Learning Enthusiast)
        document.getElementById('resident-name').textContent = 'Sunita Tamang';
        document.getElementById('resident-role').textContent = 'Cultural Learning Enthusiast (Middle-age)';
        document.getElementById('resident-description').textContent = 'Middle-aged community member who uses technology selectively for cultural preservation, particularly learning Tibetan language online while maintaining traditional social connections.';
        
        // Update quotes for Sunita's perspective
        document.getElementById('quote-1').textContent = '"I use YouTube to learn Tibetan because preserving our culture is important."';
        document.getElementById('quote-2').textContent = '"I only use technology for things that matter to me. Not everything needs to be digital."';
        document.getElementById('quote-3').textContent = '"Technology helps me connect with our heritage, but I still prefer face-to-face conversations."';
        
        document.getElementById('video-1-heading').textContent = '🎥 Cultural Learning & Selective Technology Use';
        document.getElementById('youtube-video').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
        
        // Hide second and third video sections for Khajaghar 1
        document.getElementById('video-2-section').style.display = 'none';
        document.getElementById('video-3-section').style.display = 'none';
    }
    
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
    // Hide navbar
    hideNavbar();
    
    document.getElementById('popup-title').textContent = 'Local School - Digital Education Hub';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Educational Institution';
    document.getElementById('interview-count').textContent = 'Digital Learning Center';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'EDUCATION';
    accessBadge.className = 'badge education-access';
    
    // Show resident content, hide foundation content
    document.getElementById('resident-content').style.display = 'block';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'block';
    
    // Update profile section
    document.getElementById('resident-headshot').src = 'https://via.placeholder.com/120x120/3b82f6/ffffff?text=🎓';
    document.getElementById('resident-name').textContent = 'Principal';
    document.getElementById('resident-role').textContent = 'Late Digital Adopter (Learned at 40)';
    document.getElementById('resident-description').textContent = 'School principal who learned technology at age 40, representing the late adopter category. Now leads digital education initiatives while understanding the challenges of adult digital learning.';
    
    // Update photo collage
    document.getElementById('photo-1').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Computer+Lab';
    document.getElementById('photo-2').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Digital+Classroom';
    document.getElementById('photo-3').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Student+Learning';
    
    document.getElementById('quote-1').textContent = '"I learned computers at 40 when I became principal. If I can learn, anyone can - but it takes patience."';
    document.getElementById('quote-2').textContent = '"I understand why parents are scared of technology. I was too. But I had to learn to help our students."';
    document.getElementById('quote-3').textContent = '"Now I teach other teachers who are afraid of technology. We learn together, slowly but surely."';
    
    // Update first Google Drive video
    document.getElementById('video-1-heading').textContent = '🎥 School Tour';
    document.getElementById('youtube-video').src = 'https://drive.google.com/file/d/1zT7sWLhgh04hFKervNl-XXM05D327a62/preview';
    
    // Show second video section (only for school)
    document.getElementById('video-2-section').style.display = 'block';
    document.getElementById('video-2-heading').textContent = '🎥 Classroom Activities';
    document.getElementById('second-video').src = 'https://drive.google.com/file/d/1SdOqhntIZ9mNKYQdcfT3A7TbUyR-UOeE/preview';
    
    // Hide third video section (not needed for school)
    document.getElementById('video-3-section').style.display = 'none';
    
    // Hide statistics section for school
    document.getElementById('resident-stats').style.display = 'none';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to open Ward Office popup
function openWardOfficePopup() {
    // Hide navbar
    hideNavbar();
    
    document.getElementById('popup-title').textContent = 'Nagarjun Municipality Ward 8 Office';
    
    // Update location information  
    document.getElementById('location-name').textContent = 'Ward Office - Government Building';
    document.getElementById('interview-count').textContent = 'Administrative Center';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = 'GOVERNMENT';
    accessBadge.className = 'badge government-access';
    
    // Show resident content, hide foundation content
    document.getElementById('resident-content').style.display = 'block';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'block';
    
    // Update profile section
    document.getElementById('resident-headshot').src = 'https://via.placeholder.com/120x120/7c3aed/ffffff?text=🏛️';
    document.getElementById('resident-name').textContent = 'Ward Office Administration';
    document.getElementById('resident-role').textContent = 'Government Officials';
    document.getElementById('resident-description').textContent = 'The Ward Office facilitates digital service delivery including online forms, digital payments for municipal services, and e-governance initiatives. It serves as a bridge between traditional governance and digital transformation.';
    
    // Update photo collage
    document.getElementById('photo-1').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Government+Office';
    document.getElementById('photo-2').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Digital+Services';
    document.getElementById('photo-3').src = 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Public+Access';
    
    document.getElementById('quote-1').textContent = '"The Ward Office serves as the local administrative hub connecting residents with digital government services."';
    document.getElementById('quote-2').textContent = '"We encourage online applications, but many residents still prefer in-person visits."';
    document.getElementById('quote-3').textContent = '"Digital literacy training helps residents access government services independently."';
    
    // Update first video
    document.getElementById('video-1-heading').textContent = '🎥 Ward Office Services';
    document.getElementById('youtube-video').src = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    
    // Hide second and third video sections (not needed for ward office)
    document.getElementById('video-2-section').style.display = 'none';
    document.getElementById('video-3-section').style.display = 'none';
    
    // Hide statistics section for ward office
    document.getElementById('resident-stats').style.display = 'none';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to hide/show navbar
function hideNavbar() {
    const navbar = document.getElementById('navbar');
    navbar.classList.add('hidden');
}

function showNavbar() {
    const navbar = document.getElementById('navbar');
    navbar.classList.remove('hidden');
}

// Function to open popup with digital divide story
function openPopup(house) {
    document.getElementById('popup-title').textContent = house.title;
    
    // Update location information
    document.getElementById('location-name').textContent = house.locationName || '';
    document.getElementById('interview-count').textContent = house.interviewCount || '';
    
    // Update access level badge
    const accessBadge = document.getElementById('access-badge');
    accessBadge.textContent = house.digitalAccess.toUpperCase();
    accessBadge.className = `badge ${house.digitalAccess}-access`;
    
    // Hide navbar when panel opens
    hideNavbar();
    
    // Check if this is a foundation house
    if (house.isFoundation) {
        openFoundationPopup(house);
        return;
    }
    
    // Show resident content, hide foundation content
    document.getElementById('resident-content').style.display = 'block';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'block';
    
    // Update profile section
    document.getElementById('resident-headshot').src = house.profile?.headshot || 'https://via.placeholder.com/120x120/e2e8f0/64748b?text=Photo';
    document.getElementById('resident-name').textContent = house.story.resident || 'Resident Name';
    document.getElementById('resident-role').textContent = house.profile?.role || 'Community Member';
    document.getElementById('resident-description').textContent = house.profile?.description || house.story.testimonial || '[Profile description to be added]';
    
    // Update photo collage
    document.getElementById('photo-1').src = house.photos?.[0]?.image || 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Daily+Life+Photo';
    document.getElementById('photo-2').src = house.photos?.[1]?.image || 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Technology+Photo';
    document.getElementById('photo-3').src = house.photos?.[2]?.image || 'https://via.placeholder.com/400x200/f1f5f9/64748b?text=Community+Photo';
    
    document.getElementById('quote-1').textContent = house.photos?.[0]?.quote || house.story.quote || '"Living between tradition and technology"';
    document.getElementById('quote-2').textContent = house.photos?.[1]?.quote || '"Digital tools change how we work and learn"';
    document.getElementById('quote-3').textContent = house.photos?.[2]?.quote || '"Our community helps each other adapt"';
    
    // Update first video
    document.getElementById('video-1-heading').textContent = '🎥 Their Story';
    const youtubeId = house.youtubeId || 'dQw4w9WgXcQ'; // Default placeholder
    document.getElementById('youtube-video').src = `https://www.youtube.com/embed/${youtubeId}`;
    
    // Hide second and third video sections for household stories
    document.getElementById('video-2-section').style.display = 'none';
    document.getElementById('video-3-section').style.display = 'none';
    
    // Update digital statistics
    document.getElementById('internet-speed').textContent = house.stats.internetSpeed || 'TBD';
    document.getElementById('devices').textContent = house.stats.devices || 'TBD';
    document.getElementById('monthly-cost').textContent = house.stats.monthlyDataCost || 'TBD';
    document.getElementById('digital-skills').textContent = house.stats.digitalSkills || 'TBD';
    document.getElementById('online-services').textContent = house.stats.onlineServices || 'TBD';
    
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Function to handle foundation-specific popup content
function openFoundationPopup(house) {
    const foundation = house.foundation;
    
    // Hide resident content, show foundation content
    document.getElementById('resident-content').style.display = 'none';
    document.getElementById('foundation-content').style.display = 'block';
    document.getElementById('resident-stats').style.display = 'none';
    
    // Update foundation header
    document.getElementById('foundation-logo').src = foundation.logo;
    document.getElementById('foundation-name').textContent = foundation.name;
    document.getElementById('foundation-mission').textContent = foundation.mission;
    document.getElementById('foundation-description').textContent = foundation.description;
    
    // Show single team photo
    const teamGrid = document.getElementById('team-grid');
    teamGrid.innerHTML = '';
    const teamPhotoDiv = document.createElement('div');
    teamPhotoDiv.className = 'team-photo-container';
    teamPhotoDiv.innerHTML = `
        <img src="photos/team_members.jpg" alt="Fellowship Team" class="team-group-photo">
        <p class="team-caption">All In Foundation Fellowship Research Team</p>
    `;
    teamGrid.appendChild(teamPhotoDiv);
    
    // Populate FAQ list
    const faqList = document.getElementById('faq-list');
    faqList.innerHTML = '';
    foundation.faq.forEach(item => {
        const faqDiv = document.createElement('div');
        faqDiv.className = 'faq-item';
        faqDiv.innerHTML = `
            <div class="faq-question">
                <h4>${item.question}</h4>
                <span class="faq-toggle">+</span>
            </div>
            <div class="faq-answer">
                <p>${item.answer}</p>
            </div>
        `;
        
        // Add click handler for FAQ toggle
        const questionDiv = faqDiv.querySelector('.faq-question');
        const answerDiv = faqDiv.querySelector('.faq-answer');
        const toggle = faqDiv.querySelector('.faq-toggle');
        
        questionDiv.addEventListener('click', () => {
            if (answerDiv.style.display === 'block') {
                answerDiv.style.display = 'none';
                toggle.textContent = '+';
            } else {
                answerDiv.style.display = 'block';
                toggle.textContent = '−';
            }
        });
        
        faqList.appendChild(faqDiv);
    });
    
    // Populate projects grid
    const projectsGrid = document.getElementById('projects-grid');
    projectsGrid.innerHTML = '';
    foundation.fellowshipProjects.forEach(project => {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'project-item';
        projectDiv.innerHTML = `
            <h4 class="project-title">${project.title}</h4>
            <p class="project-description">${project.description}</p>
            <div class="project-footer">
                <span class="project-status">${project.status}</span>
                <a href="${project.link}" class="project-link">Learn More →</a>
            </div>
        `;
        projectsGrid.appendChild(projectDiv);
    });
    
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
    // Stop YouTube video by clearing the src
    document.getElementById('youtube-video').src = '';
    document.getElementById('popup-audio').pause();
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        modal.classList.remove('show');
        document.getElementById('map').classList.remove('map-with-panel');
        
        // Show navbar again
        showNavbar();
        
        // Hide custom content
        const customContent = document.getElementById('custom-content');
        if (customContent) {
            customContent.style.display = 'none';
        }
        
        // Show access badge again
        document.querySelector('.access-indicator').style.display = 'flex';
        
        // Clear active nav button
        clearActiveNavButton();
        
        setTimeout(() => {
            modal.style.display = 'none';
            map.invalidateSize();
        }, 300);
        document.getElementById('youtube-video').src = '';
        document.getElementById('popup-audio').pause();
    }
}

// Navigation bar functionality
document.addEventListener('DOMContentLoaded', function() {
    // FAQ button - opens ALIN Foundation panel
    document.getElementById('nav-faq').addEventListener('click', function() {
        if (foundationHouse) {
            // Move map to show ALIN foundation building
            map.setView([foundationHouse.lat, foundationHouse.lng], 16);
            // Open the foundation panel after a short delay for smooth transition
            setTimeout(() => {
                openPopup(foundationHouse);
                setActiveNavButton('nav-faq');
            }, 300);
        }
    });

    // About button - opens about panel
    document.getElementById('nav-about').addEventListener('click', function() {
        openAboutPanel();
        setActiveNavButton('nav-about');
    });

    // Stories button - shows stories overview
    document.getElementById('nav-stories').addEventListener('click', function() {
        openStoriesPanel();
        setActiveNavButton('nav-stories');
    });

    // Statistics button - shows aggregated data
    document.getElementById('nav-statistics').addEventListener('click', function() {
        openStatisticsPanel();
        setActiveNavButton('nav-statistics');
    });

    // Map Legend button - shows legend
    document.getElementById('nav-legend').addEventListener('click', function() {
        openLegendPanel();
        setActiveNavButton('nav-legend');
    });

    // Reset View button - resets map view
    document.getElementById('nav-reset').addEventListener('click', function() {
        resetMapView();
        clearActiveNavButton();
    });
    
    // Initialize mode selector and progression controls (delay to avoid splash screen conflicts)
    setTimeout(() => {
        initializeModeSelector();
        initializeProgressionControls();
    }, 100);
});

// Helper function to set active navigation button
function setActiveNavButton(buttonId) {
    // Remove active class from all buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    // Add active class to clicked button
    document.getElementById(buttonId).classList.add('active');
}

// Helper function to clear active navigation button
function clearActiveNavButton() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
}

// Reset map view function
function resetMapView() {
    map.setView([27.733, 85.240], 15);
    // Close any open modals
    if (modal.classList.contains('show')) {
        closeBtn.onclick();
    }
}

// About panel function
function openAboutPanel() {
    // Create about content
    const aboutContent = {
        title: "About This Project",
        isCustomPanel: true,
        content: {
            header: {
                title: "Digital Divide Research in Bhimdhunga",
                subtitle: "Understanding lived experiences behind statistics"
            },
            sections: [
                {
                    title: "Project Overview",
                    content: "This interactive storymap explores the digital divide in Bhimdhunga, Nagarjun Municipality Ward 8. Through household interviews and multimedia testimonials, we reveal the human stories behind digital access statistics."
                },
                {
                    title: "Methodology", 
                    content: "Our research team conducted extensive fieldwork including household interviews, geographic mapping, and multimedia documentation to create a comprehensive view of digital access challenges and adaptations in this community."
                },
                {
                    title: "Key Themes",
                    content: "The project examines intergenerational technology transfer, urban-rural digital bridges, educational technology gaps, and community-based digital support networks."
                }
            ]
        }
    };
    
    openCustomPanel(aboutContent);
}

// Stories overview panel
function openStoriesPanel() {
    const storiesContent = {
        title: "Household Digital Stories",
        isCustomPanel: true,
        content: {
            header: {
                title: "9 Household Stories",
                subtitle: "Click on any house marker to explore individual stories"
            },
            houseList: houseData.filter(house => !house.isFoundation)
        }
    };
    
    openCustomPanel(storiesContent);
}

// Statistics panel
function openStatisticsPanel() {
    // Calculate aggregated statistics
    const houses = houseData.filter(house => !house.isFoundation);
    const highAccess = houses.filter(house => house.digitalAccess === 'high').length;
    const mediumAccess = houses.filter(house => house.digitalAccess === 'medium').length;
    const lowAccess = houses.filter(house => house.digitalAccess === 'low').length;
    
    const statsContent = {
        title: "Digital Access Statistics",
        isCustomPanel: true,
        content: {
            header: {
                title: "Aggregated Community Data",
                subtitle: "Statistical overview of digital access in Bhimdhunga"
            },
            stats: {
                highAccess: highAccess,
                mediumAccess: mediumAccess,
                lowAccess: lowAccess,
                total: houses.length
            }
        }
    };
    
    openCustomPanel(statsContent);
}

// Legend panel
function openLegendPanel() {
    const legendContent = {
        title: "Map Legend",
        isCustomPanel: true,
        content: {
            header: {
                title: "Map Symbols & Colors",
                subtitle: "Understanding the map interface"
            },
            legend: [
                { icon: "fa-house", color: "#22c55e", label: "High Digital Access", description: "Households with reliable internet and digital skills" },
                { icon: "fa-house", color: "#fbbf24", label: "Medium Digital Access", description: "Households with some digital access but facing barriers" },
                { icon: "fa-house", color: "#ef4444", label: "Low Digital Access", description: "Households with limited or no digital access" },
                { icon: "fa-location-dot", color: "#dc2626", label: "All In Foundation", description: "Research organization headquarters" },
                { icon: "fa-building", color: "#7c3aed", label: "Ward Office", description: "Government administrative center" },
                { icon: "fa-graduation-cap", color: "#3b82f6", label: "School", description: "Educational institution" },
                { icon: "fa-mug-hot", color: "#dc2626", label: "Khajaghar", description: "Traditional tea shops and community gathering places" },
                { icon: "fa-shop", color: "#ea580c", label: "Local Shop", description: "Commercial establishments" },
                { icon: "fa-comments", color: "#6366f1", label: "Street Interviews", description: "Public space interview locations" }
            ]
        }
    };
    
    openCustomPanel(legendContent);
}

// Generic function to open custom panels
function openCustomPanel(content) {
    // Hide navbar
    hideNavbar();
    
    // Hide resident and foundation content
    document.getElementById('resident-content').style.display = 'none';
    document.getElementById('foundation-content').style.display = 'none';
    document.getElementById('resident-stats').style.display = 'none';
    
    // Update modal title and basic info
    document.getElementById('popup-title').textContent = content.title;
    document.getElementById('location-name').textContent = content.content.header?.subtitle || '';
    document.getElementById('interview-count').textContent = '';
    
    // Hide access badge for custom panels
    document.querySelector('.access-indicator').style.display = 'none';
    
    // Create and show custom content
    let customContent = document.getElementById('custom-content');
    if (!customContent) {
        customContent = document.createElement('div');
        customContent.id = 'custom-content';
        customContent.className = 'custom-content';
        document.querySelector('.popup-body').appendChild(customContent);
    }
    
    customContent.style.display = 'block';
    
    // Generate content based on type
    if (content.content.sections) {
        // About panel
        customContent.innerHTML = `
            <div class="custom-header">
                <h3>${content.content.header.title}</h3>
                <p class="custom-subtitle">${content.content.header.subtitle}</p>
            </div>
            ${content.content.sections.map(section => `
                <div class="custom-section">
                    <h4>${section.title}</h4>
                    <p>${section.content}</p>
                </div>
            `).join('')}
        `;
    } else if (content.content.houseList) {
        // Stories panel
        customContent.innerHTML = `
            <div class="custom-header">
                <h3>${content.content.header.title}</h3>
                <p class="custom-subtitle">${content.content.header.subtitle}</p>
            </div>
            <div class="stories-grid">
                ${content.content.houseList.map(house => `
                    <div class="story-card" onclick="openPopup(houseData.find(h => h.id === ${house.id}))">
                        <div class="story-access-badge ${house.digitalAccess}">${house.digitalAccess.toUpperCase()}</div>
                        <h4>${house.title}</h4>
                        <p>${house.story?.quote || 'Click to read their story'}</p>
                        <span class="story-resident">${house.story?.resident || 'Community Member'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (content.content.stats) {
        // Statistics panel
        const stats = content.content.stats;
        customContent.innerHTML = `
            <div class="custom-header">
                <h3>${content.content.header.title}</h3>
                <p class="custom-subtitle">${content.content.header.subtitle}</p>
            </div>
            <div class="stats-overview">
                <div class="stat-card-large high">
                    <div class="stat-number">${stats.highAccess}</div>
                    <div class="stat-label">High Access Households</div>
                    <div class="stat-percentage">${Math.round((stats.highAccess/stats.total)*100)}%</div>
                </div>
                <div class="stat-card-large medium">
                    <div class="stat-number">${stats.mediumAccess}</div>
                    <div class="stat-label">Medium Access Households</div>
                    <div class="stat-percentage">${Math.round((stats.mediumAccess/stats.total)*100)}%</div>
                </div>
                <div class="stat-card-large low">
                    <div class="stat-number">${stats.lowAccess}</div>
                    <div class="stat-label">Low Access Households</div>
                    <div class="stat-percentage">${Math.round((stats.lowAccess/stats.total)*100)}%</div>
                </div>
            </div>
        `;
    } else if (content.content.legend) {
        // Legend panel
        customContent.innerHTML = `
            <div class="custom-header">
                <h3>${content.content.header.title}</h3>
                <p class="custom-subtitle">${content.content.header.subtitle}</p>
            </div>
            <div class="legend-list">
                ${content.content.legend.map(item => `
                    <div class="legend-item">
                        <div class="legend-icon">
                            <i class="fa-solid ${item.icon}" style="color: ${item.color}; font-size: 1.2rem;"></i>
                        </div>
                        <div class="legend-text">
                            <h4>${item.label}</h4>
                            <p>${item.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.add('show');
    document.getElementById('map').classList.add('map-with-panel');
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
}

// Update close functionality to handle custom panels
const originalCloseHandler = closeBtn.onclick;
closeBtn.onclick = function() {
    // Hide custom content
    const customContent = document.getElementById('custom-content');
    if (customContent) {
        customContent.style.display = 'none';
    }
    
    // Show access badge again
    document.querySelector('.access-indicator').style.display = 'flex';
    
    // Show navbar again
    showNavbar();
    
    // Clear active nav button
    clearActiveNavButton();
    
    // Call original close handler
    originalCloseHandler.call(this);
};

// ==========================================
// AUTO-PROGRESSION SYSTEM FOR GUIDED MODES
// ==========================================

let currentMode = 'manual';
let progressionActive = false;
let currentStoryIndex = 0;
let progressionTimer = null;
let progressionCountdown = 15;
let isPaused = false;

// Journey definitions with thematic bridges
const journeyModes = {
    'age-journey': {
        name: 'Age-Based Journey',
        theme: 'From Elderly to Digital Native',
        description: 'Experience how digital adoption varies across generations, following the Douglas Adams technology framework.',
        locations: [
            { 
                type: 'street_interview', 
                name: 'Street Interview 3', 
                participant: 'Maili Tamang', 
                ageGroup: 'Elderly (Complete Non-user)',
                bridge: "We begin with complete digital avoidance - a choice to remain disconnected from technologies that feel foreign and threatening..."
            },
            { 
                type: 'khajaghar', 
                name: 'Khajaghar 1', 
                participant: 'Sunita Tamang', 
                ageGroup: 'Middle-age (Learning Tibetan Online)',
                bridge: "Moving to selective adoption - technology becomes useful when it serves cultural values and personal meaning..."
            },
            { 
                type: 'school', 
                participant: 'Principal', 
                ageGroup: 'Late Adopter (Learned at 40)',
                bridge: "Professional necessity drives learning - adult acquisition of digital skills through workplace requirements..."
            },
            { 
                type: 'khajaghar', 
                name: 'Khajaghar 2', 
                participant: 'Aman Tamang', 
                ageGroup: 'Digital Native (17 years old)',
                bridge: "Finally, we meet those for whom technology is natural - digital natives who bridge traditional and digital worlds..."
            }
        ]
    },
    'efficacy-spectrum': {
        name: 'Self-Efficacy Spectrum',
        theme: 'From Complete Avoidance to High Confidence',
        description: 'Journey through different levels of digital confidence and self-efficacy, revealing the third-level digital divide.',
        locations: [
            { 
                type: 'street_interview', 
                name: 'Street Interview 3', 
                participant: 'Maili Tamang', 
                efficacy: 'Complete Avoidance',
                bridge: "Starting with complete avoidance - when digital technologies feel too risky or complex to attempt..."
            },
            { 
                type: 'house', 
                id: 3, 
                participant: 'Tej Lama', 
                efficacy: 'Low Persistence',
                bridge: "Moving to low persistence - 'if I can't learn it, I leave it' - limited tolerance for digital difficulty..."
            },
            { 
                type: 'khajaghar', 
                name: 'Khajaghar 1', 
                participant: 'Sunita Tamang', 
                efficacy: 'Selective Confidence',
                bridge: "Developing selective confidence - success in specific digital domains like cultural learning builds targeted expertise..."
            },
            { 
                type: 'khajaghar', 
                name: 'Khajaghar 2', 
                participant: 'Aman Tamang', 
                efficacy: 'High Confidence',
                bridge: "Reaching high confidence - digital native integration where technology becomes a natural extension of capability..."
            }
        ]
    }
};

// Mode selector initialization - merged with main DOMContentLoaded

function initializeModeSelector() {
    const modeBtn = document.getElementById('mode-selector-btn');
    const modeOptions = document.querySelectorAll('.mode-option');
    
    // Check if elements exist before adding event listeners
    if (!modeBtn || modeOptions.length === 0) {
        console.warn('Mode selector elements not found');
        return;
    }
    
    // Handle mode selection
    modeOptions.forEach(option => {
        option.addEventListener('click', function() {
            const selectedMode = this.dataset.mode;
            switchMode(selectedMode);
            
            // Update active state
            modeOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            // Update button text
            const icon = this.querySelector('i').className;
            const text = this.textContent.trim();
            modeBtn.innerHTML = `<i class="${icon}"></i> ${text}`;
        });
    });
}

function switchMode(mode) {
    if (progressionActive) {
        stopProgression();
    }
    
    currentMode = mode;
    
    if (mode === 'manual') {
        hideProgressionPanel();
    } else {
        startGuidedJourney(mode);
    }
}

function startGuidedJourney(mode) {
    const journey = journeyModes[mode];
    if (!journey) return;
    
    currentStoryIndex = 0;
    progressionActive = true;
    isPaused = false;
    
    showProgressionPanel(journey);
    goToStory(0);
}

function showProgressionPanel(journey) {
    const panel = document.getElementById('auto-progression-panel');
    panel.style.display = 'block';
    
    document.getElementById('total-stories').textContent = journey.locations.length;
    document.getElementById('current-story-theme').textContent = journey.theme;
    
    updateProgressDisplay();
}

function hideProgressionPanel() {
    document.getElementById('auto-progression-panel').style.display = 'none';
    progressionActive = false;
    if (progressionTimer) {
        clearInterval(progressionTimer);
        progressionTimer = null;
    }
}

function goToStory(index) {
    const journey = journeyModes[currentMode];
    if (!journey || index >= journey.locations.length) {
        completeJourney();
        return;
    }
    
    // Show thematic bridge if moving to a new story (not the first one)
    if (index > 0 && currentStoryIndex !== index) {
        showThematicBridge(journey.locations[index], () => {
            proceedToStory(index);
        });
    } else {
        proceedToStory(index);
    }
}

function proceedToStory(index) {
    const journey = journeyModes[currentMode];
    currentStoryIndex = index;
    const location = journey.locations[index];
    
    updateProgressDisplay();
    
    // Highlight the active marker before animation
    highlightActiveMarker(location);
    
    animateToLocation(location);
    
    // Start countdown timer
    if (!isPaused) {
        startCountdownTimer();
    }
}

function showThematicBridge(location, callback) {
    const overlay = document.getElementById('thematic-bridge-overlay');
    const progressFill = document.getElementById('bridge-progress-fill');
    const timer = document.getElementById('bridge-timer');
    
    // Update bridge content
    document.getElementById('bridge-title').textContent = `Next: ${location.participant}`;
    document.getElementById('bridge-text').textContent = location.bridge;
    
    // Show overlay
    overlay.style.display = 'flex';
    
    // Animate bridge transition
    let bridgeCountdown = 4;
    timer.textContent = bridgeCountdown;
    progressFill.style.width = '0%';
    
    const bridgeInterval = setInterval(() => {
        bridgeCountdown--;
        timer.textContent = bridgeCountdown;
        progressFill.style.width = ((4 - bridgeCountdown) / 4 * 100) + '%';
        
        if (bridgeCountdown <= 0) {
            clearInterval(bridgeInterval);
            overlay.style.display = 'none';
            callback();
        }
    }, 1000);
}

function animateToLocation(location) {
    let coords, openFunction;
    
    switch (location.type) {
        case 'house':
            const house = houseData.find(h => h.id === location.id);
            coords = [house.lat, house.lng];
            openFunction = () => openPopup(house);
            break;
        case 'school':
            coords = [27.724667, 85.228028];
            openFunction = () => openSchoolPopup();
            break;
        case 'street_interview':
            if (location.name === 'Street Interview 3') {
                // Street Interview 3 coordinates (Maili Tamang)
                coords = [27.726789, 85.240472];
                openFunction = () => openStreetInterviewPopup({name: 'Street Interview 3'});
            }
            break;
        case 'khajaghar':
            if (location.name === 'Khajaghar 1') {
                coords = [27.724592, 85.224491];
                openFunction = () => openKhajagharPopup({name: 'Khajaghar 1', lat: 27.724592, lng: 85.224491});
            } else if (location.name === 'Khajaghar 2') {
                coords = [27.739199, 85.236208];
                openFunction = () => openKhajagharPopup({name: 'Khajaghar 2', lat: 27.739199, lng: 85.236208});
            }
            break;
    }
    
    if (coords) {
        map.flyTo(coords, 16, {
            animate: true,
            duration: 2
        });
        
        setTimeout(() => {
            openFunction();
        }, 2500);
    }
}

function updateProgressDisplay() {
    const journey = journeyModes[currentMode];
    const location = journey.locations[currentStoryIndex];
    
    document.getElementById('current-story-num').textContent = currentStoryIndex + 1;
    document.getElementById('current-story-title').textContent = location.participant;
    
    // Update progress bar
    const progressPercent = ((currentStoryIndex + 1) / journey.locations.length) * 100;
    document.getElementById('progress-fill').style.width = progressPercent + '%';
    
    // Update control buttons
    document.getElementById('prev-story-btn').disabled = currentStoryIndex === 0;
    document.getElementById('next-story-btn').disabled = currentStoryIndex === journey.locations.length - 1;
}

function startCountdownTimer() {
    progressionCountdown = 15;
    updateCountdownDisplay();
    
    progressionTimer = setInterval(() => {
        if (!isPaused) {
            progressionCountdown--;
            updateCountdownDisplay();
            
            if (progressionCountdown <= 0) {
                nextStory();
            }
        }
    }, 1000);
}

function updateCountdownDisplay() {
    document.getElementById('timer-countdown').textContent = progressionCountdown;
}

function initializeProgressionControls() {
    const prevBtn = document.getElementById('prev-story-btn');
    const nextBtn = document.getElementById('next-story-btn');
    const pauseBtn = document.getElementById('pause-progression-btn');
    const exitBtn = document.getElementById('exit-progression-btn');
    
    // Check if elements exist before adding event listeners
    if (!prevBtn || !nextBtn || !pauseBtn || !exitBtn) {
        console.warn('Progression control elements not found');
        return;
    }
    
    prevBtn.addEventListener('click', prevStory);
    nextBtn.addEventListener('click', nextStory);
    pauseBtn.addEventListener('click', togglePause);
    exitBtn.addEventListener('click', exitProgression);
}

function prevStory() {
    if (currentStoryIndex > 0) {
        clearInterval(progressionTimer);
        goToStory(currentStoryIndex - 1);
    }
}

function nextStory() {
    clearInterval(progressionTimer);
    goToStory(currentStoryIndex + 1);
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-progression-btn');
    
    if (isPaused) {
        btn.innerHTML = '<i class="fas fa-play"></i> Resume';
        btn.classList.add('paused');
    } else {
        btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        btn.classList.remove('paused');
        if (progressionCountdown > 0) {
            startCountdownTimer();
        }
    }
}

function exitProgression() {
    stopProgression();
    switchMode('manual');
    
    // Reset mode selector to manual
    document.querySelector('.mode-option[data-mode="manual"]').click();
}

function stopProgression() {
    progressionActive = false;
    isPaused = false;
    if (progressionTimer) {
        clearInterval(progressionTimer);
        progressionTimer = null;
    }
    
    // Clear all highlighting when stopping progression
    clearAllMarkerHighlights();
    
    hideProgressionPanel();
}

function completeJourney() {
    stopProgression();
    alert(`🎉 Journey Complete!\n\nYou've experienced the ${journeyModes[currentMode].name} journey through Bhimdhunga's digital divide stories.\n\nFeel free to continue exploring manually or try the other guided journey mode.`);
    switchMode('manual');
}

// ==========================================
// MARKER HIGHLIGHTING SYSTEM
// ==========================================

function highlightActiveMarker(location) {
    // First clear any existing highlights
    clearAllMarkerHighlights();
    
    // Add guided mode class to map container
    document.getElementById('map').classList.add('guided-mode-active');
    
    switch (location.type) {
        case 'house':
            highlightHouseMarker(location.id);
            break;
        case 'school':
            highlightSchoolMarker();
            break;
        case 'street_interview':
            highlightStreetInterviewMarker(location.name);
            break;
        case 'khajaghar':
            highlightKhajagharMarker(location.name);
            break;
    }
}

function highlightHouseMarker(houseId) {
    // Find the house marker by looking for the house data
    const house = houseData.find(h => h.id === houseId);
    if (house) {
        // House markers are FontAwesome icons, need to find them by coordinates
        const houseMarkers = markerReferences.houses;
        houseMarkers.forEach(marker => {
            if (marker.getLatLng().lat === house.lat && marker.getLatLng().lng === house.lng) {
                const markerElement = marker.getElement();
                if (markerElement) {
                    markerElement.classList.add('marker-active');
                }
            }
        });
    }
}

function highlightSchoolMarker() {
    if (markerReferences.school) {
        const markerElement = markerReferences.school.getElement();
        if (markerElement) {
            markerElement.classList.add('marker-active');
        }
    }
}

function highlightStreetInterviewMarker(interviewName) {
    markerReferences.streetInterviews.forEach(marker => {
        if (marker.options.title === interviewName) {
            const markerElement = marker.getElement();
            if (markerElement) {
                markerElement.classList.add('marker-active');
            }
        }
    });
}

function highlightKhajagharMarker(khajagharName) {
    markerReferences.khajaghar.forEach(marker => {
        if (marker.options.title === khajagharName) {
            const markerElement = marker.getElement();
            if (markerElement) {
                markerElement.classList.add('marker-active');
            }
        }
    });
}

function clearAllMarkerHighlights() {
    // Remove guided mode class from map container
    document.getElementById('map').classList.remove('guided-mode-active');
    
    // Clear all marker-active classes
    document.querySelectorAll('.marker-active').forEach(element => {
        element.classList.remove('marker-active');
    });
    
    // Clear area highlights
    document.querySelectorAll('.area-circle-active').forEach(element => {
        element.classList.remove('area-circle-active');
    });
}