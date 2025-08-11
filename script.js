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
        id: 2,
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
        lat: 27.7466,
        lng: 85.2656,
        title: "The Elderly Couple's Struggle",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/elderly_couple.mp3",
        digitalAccess: "low",
        stats: {
            internetSpeed: "5 Mbps Shared",
            devices: "1 basic smartphone",
            monthlyDataCost: "NPR 500",
            digitalSkills: "Beginner",
            onlineServices: "None regularly used"
        },
        story: {
            quote: "\"The mobile is too complicated. We can't even book doctor appointments online anymore.\"",
            reality: "Official statistics count them as 'connected' because they own a smartphone, but they can't access most digital services independently.",
            testimonial: "Banks say 'use mobile banking,' hospitals say 'book online,' but nobody teaches us how. We feel left behind in our own neighborhood.",
            resident: "Laxmi & Ram Maharjan, Retired Teachers"
        }
    },
    {
        id: 3,
        lat: 27.7473,
        lng: 85.2663,
        title: "The Student's Dilemma",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/student_voice.mp3",
        digitalAccess: "medium",
        stats: {
            internetSpeed: "20 Mbps Shared",
            devices: "1 smartphone, 1 shared laptop",
            monthlyDataCost: "NPR 1,200",
            digitalSkills: "Intermediate",
            onlineServices: "Education, Social Media"
        },
        story: {
            quote: "\"I have internet but not reliable enough for online exams. Sometimes I walk to cyber cafe for important submissions.\"",
            reality: "Studies show 80% household internet penetration in the area, but quality and reliability aren't measured in these statistics.",
            testimonial: "My online classes freeze during monsoon. I've failed two assignments because of poor connection, but surveys count me as 'digitally literate.'",
            resident: "Priya Tamang, University Student"
        }
    },
    {
        id: 4,
        lat: 27.7464,
        lng: 85.2653,
        title: "The Small Business Owner",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4",
        audio: "audio/business_owner.mp3",
        digitalAccess: "medium",
        stats: {
            internetSpeed: "25 Mbps",
            devices: "2 smartphones, 1 laptop, 1 POS system",
            monthlyDataCost: "NPR 1,800",
            digitalSkills: "Self-taught",
            onlineServices: "Digital payments, Social media marketing"
        },
        story: {
            quote: "\"Digital payments brought more customers, but I lost many elderly ones who only know cash.\"",
            reality: "Government data shows increasing digital payment adoption, but doesn't capture the social exclusion of those who can't adapt.",
            testimonial: "I'm counted as a digital business success story, but I see daily how technology divides my community between those who can and cannot adapt.",
            resident: "Binod Shrestha, Grocery Shop Owner"
        }
    },
    {
        id: 5,
        lat: 27.7476,
        lng: 85.2666,
        title: "The Working Mother's Balance",
        video: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
        audio: "audio/working_mother.mp3",
        digitalAccess: "high",
        stats: {
            internetSpeed: "50 Mbps",
            devices: "3 smartphones, 2 laptops, 1 tablet",
            monthlyDataCost: "NPR 2,000",
            digitalSkills: "Advanced",
            onlineServices: "Work, Banking, Education, Healthcare"
        },
        story: {
            quote: "\"Technology helps me work from home, but my domestic help can't use the digital payment apps I prefer.\"",
            reality: "High digital usage statistics in the household mask the digital divide with domestic workers and service providers in the same locality.",
            testimonial: "I'm empowered by technology, but I see how it creates barriers between me and others in my community who lack digital skills.",
            resident: "Sunita Rajbhandari, Marketing Manager"
        }
    },
    {
        id: 1,
        lat: 27.72446628479255,
        lng: 85.22487217983753,
        title: "Digital Access at Majuwa Village House",
        locationName: "Traditional Village House, Majuwa",
        interviewCount: "2 residents interviewed",
        locationType: "village_house",
        video: "", // To be added when interview content is available
        audio: "", // To be added when interview content is available
        digitalAccess: "high", // Placeholder - to be determined based on interview data
        stats: {
            internetSpeed: "350 Mbps", // To be determined from interviews
            devices: "TBD", // To be determined from interviews
            monthlyDataCost: "TBD", // To be determined from interviews
            digitalSkills: "TBD", // To be determined from interviews
            onlineServices: "TBD" // To be determined from interviews
        },
        story: {
            quote: "", // To be added when interview content is available
            reality: "", // To be added when interview content is available
            testimonial: "", // To be added when interview content is available
            resident: "2 residents interviewed at Majuwa village house"
        },
        context: "First interview site in our digital divide research - traditional Nepali village building"
    }
];

// Custom colored circle icons based on digital access level
const getLocationIcon = (accessLevel) => {
    let color, className;
    
    switch(accessLevel) {
        case 'high':
            color = '#22c55e'; // Green for good connectivity
            className = 'access-marker high-access';
            break;
        case 'medium':
            color = '#fbbf24'; // Yellow for limited access
            className = 'access-marker medium-access';
            break;
        case 'low':
            color = '#ef4444'; // Red for poor connectivity/high digital divide
            className = 'access-marker low-access';
            break;
        default:
            color = '#6b7280'; // Gray for unknown
            className = 'access-marker';
    }
    
    return L.divIcon({
        html: `<div class="access-circle" style="background-color: ${color};"></div>`,
        iconSize: [35, 35],
        className: className,
        iconAnchor: [22.5, 22.5]
    });
};

// Store markers but don't add them immediately
let houseMarkers = [];
houseData.forEach(house => {
    const marker = L.marker([house.lat, house.lng], { icon: getLocationIcon(house.digitalAccess) })
        .on('click', () => openPopup(house));
    houseMarkers.push(marker);
});

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

// Geographic zoom sequence
async function startGeographicSequence() {
    const statsOverlay = document.getElementById('national-stats-overlay');
    
    // Wait for user input
    await waitForUserInput();
    
    // Phase 1: Fade out stats, show Nepal highlighted
    statsOverlay.style.animation = 'overlayFadeOut 1s ease-out forwards';
    
    setTimeout(async () => {
        statsOverlay.style.display = 'none';
        
        // Highlight Nepal prominently
        if (nepalPolygon) {
            if (nepalPolygon.setStyle) {
                nepalPolygon.setStyle({
                    color: '#34d399',
                    weight: 4,
                    opacity: 1,
                    fillColor: '#34d399',
                    fillOpacity: 0.2
                });
            } else {
                nepalPolygon.setStyle({
                    color: '#34d399',
                    weight: 4,
                    opacity: 1,
                    fillColor: '#34d399',
                    fillOpacity: 0.2
                });
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Phase 2: Zoom to Nepal and highlight Bagmati Province
        map.flyTo([27.7, 85.3], 8, {
            animate: true,
            duration: 2.5,
            easeLinearity: 0.1
        });
        
        setTimeout(() => {
            if (bagmatiPolygon) {
                if (bagmatiPolygon.setStyle) {
                    bagmatiPolygon.setStyle({
                        color: '#60a5fa',
                        weight: 4,
                        opacity: 1,
                        fillColor: '#60a5fa',
                        fillOpacity: 0.3
                    });
                } else {
                    bagmatiPolygon.setStyle({
                        color: '#60a5fa',
                        weight: 4,
                        opacity: 1,
                        fillColor: '#60a5fa',
                        fillOpacity: 0.3
                    });
                }
            }
        }, 1500);
        
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Phase 3: Zoom to Bagmati and highlight Nagarjun
        map.flyTo([27.75, 85.25], 11, {
            animate: true,
            duration: 2.5,
            easeLinearity: 0.1
        });
        
        setTimeout(() => {
            if (nagarjunPolygon) {
                if (nagarjunPolygon.setStyle) {
                    nagarjunPolygon.setStyle({
                        color: '#fbbf24',
                        weight: 4,
                        opacity: 1,
                        fillColor: '#fbbf24',
                        fillOpacity: 0.4
                    });
                } else {
                    nagarjunPolygon.setStyle({
                        color: '#fbbf24',
                        weight: 4,
                        opacity: 1,
                        fillColor: '#fbbf24',
                        fillOpacity: 0.4
                    });
                }
            }
        }, 1500);
        
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Phase 4: Final zoom to Bhimdhunga location
        map.flyTo([27.7469, 85.2658], 15, {
            animate: true,
            duration: 3,
            easeLinearity: 0.1
        });
        
        // Fade out all highlighting
        setTimeout(() => {
            if (nepalPolygon && nepalPolygon.setStyle) {
                nepalPolygon.setStyle({ opacity: 0, fillOpacity: 0 });
            }
            if (bagmatiPolygon && bagmatiPolygon.setStyle) {
                bagmatiPolygon.setStyle({ opacity: 0, fillOpacity: 0 });
            }
            if (nagarjunPolygon && nagarjunPolygon.setStyle) {
                nagarjunPolygon.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        }, 1000);
        
        // Phase 5: Add house markers
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
        }, 3500);
        
    }, 1000);
}

// Complete cinematic sequence on page load
window.addEventListener('load', async () => {
    const splashScreen = document.getElementById('splash-screen');
    const statsOverlay = document.getElementById('national-stats-overlay');
    
    // Initially hide stats overlay until we're ready
    statsOverlay.style.display = 'none';
    
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
            
            // Highlight Nepal behind overlay if loaded
            if (nepalPolygon) {
                if (nepalPolygon.setStyle) {
                    // Leaflet polygon
                    nepalPolygon.setStyle({
                        color: '#60a5fa',
                        weight: 4,
                        opacity: 1,
                        fillColor: '#60a5fa',
                        fillOpacity: 0.3
                    });
                } else {
                    // GeoJSON layer
                    nepalPolygon.setStyle({
                        color: '#60a5fa',
                        weight: 4,
                        opacity: 1,
                        fillColor: '#60a5fa',
                        fillOpacity: 0.3
                    });
                }
            }
            
            // Start the geographic sequence (waits for user input)
            startGeographicSequence();
            
        }, 1000);
    }, 4000);
});

// Modal elements
const modal = document.getElementById('popup-modal');
const closeBtn = document.querySelector('.close');

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
}

// Close modal when clicking X
closeBtn.onclick = function() {
    modal.style.display = 'none';
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