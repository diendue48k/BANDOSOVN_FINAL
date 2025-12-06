
import { Site, SiteDetail, Person, PersonDetail, RouteData, AddressSearchResult, Event, Media } from '../types';

const API_BASE_URL = 'https://web-production-c3ccb.up.railway.app';

// --- Generic Helper for Fuzzy Property Access ---
const getProp = (obj: any, keys: string[]): any => {
    if (!obj) return undefined;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
    }
    return undefined;
};

// --- Raw Database Interfaces (Flexible) ---

interface RawData {
    [key: string]: any;
}

// --- Global Cache ---
let globalSiteCache: Site[] = [];
let globalPersonCache: Person[] = [];

interface ReferenceData {
    mediaMap: Map<string, RawData>;
    eventMediaRelations: RawData[];
    personEventRelations: RawData[];
    personMap: Map<string, RawData>;
    eventsCache: RawData[]; // Cache all events for fallback filtering
    isLoaded: boolean;
    isLoading: boolean;
}

const refData: ReferenceData = {
    mediaMap: new Map(),
    eventMediaRelations: [],
    personEventRelations: [],
    personMap: new Map(),
    eventsCache: [],
    isLoaded: false,
    isLoading: false
};

// --- Helper Functions ---

const cleanText = (text: any): string => {
    if (!text) return '';
    const str = String(text);
    // Remove citation markers like [1], [ 1 ], [1, 2], [1-3], etc.
    // Handles optional spaces inside brackets and list of numbers.
    return str.replace(/\[\s*\d+(?:[\s,;-]*\d+)*\s*\]/g, '')
              .replace(/\s+/g, ' ') // Collapse multiple spaces into one
              .trim();
};

const PROXY_LIST = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
];

const promiseAny = async <T>(promises: Promise<T>[]): Promise<T> => {
    return new Promise((resolve, reject) => {
        let errors: any[] = [];
        let pending = promises.length;
        if (pending === 0) return reject(new Error("No promises"));
        
        promises.forEach(p => {
            Promise.resolve(p).then(resolve).catch(e => {
                errors.push(e);
                pending--;
                if (pending === 0) reject(new Error("All promises rejected"));
            });
        });
    });
};

async function fetchWithRetry(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); 

    try {
        const response = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            if (response.status === 404) return null; 
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function fetchFromApi(endpoint: string): Promise<any> {
    const directUrl = `${API_BASE_URL}${endpoint}`;
    
    // Try direct fetch first (works if CORS is allowed or same domain)
    // Then try proxies
    const strategies = [
        () => fetchWithRetry(directUrl),
        ...PROXY_LIST.map(createUrl => () => {
            const url = createUrl(directUrl);
            return fetchWithRetry(url).then(json => {
                // Handle wrappers like AllOrigins
                if (json && json.contents) {
                    try { return JSON.parse(json.contents); } 
                    catch { return json.contents; }
                }
                return json;
            });
        })
    ];

    try {
        return await promiseAny(strategies.map(fn => fn()));
    } catch (e) {
        console.warn(`[API] Failed to fetch ${endpoint}`, e);
        return []; 
    }
}

const extractData = <T>(response: any): T[] => {
    if (!response) return [];
    
    // 1. Handle { count: ..., data: [...] } format (FastAPI Standard)
    if (response.data && Array.isArray(response.data)) {
        return response.data;
    }
    
    // 2. Handle standard array response
    if (Array.isArray(response)) {
        return response;
    }

    // 3. Handle Proxy wrapper { contents: ... } (Fallback if not caught in fetchFromApi)
    if (response.contents) {
         try {
             const inner = typeof response.contents === 'string' ? JSON.parse(response.contents) : response.contents;
             return extractData(inner);
         } catch { return []; }
    }

    // 4. Handle Single Object (Detail response that isn't wrapped in data array)
    if (typeof response === 'object' && response !== null) {
        // If it looks like a data object (has ID or Key), treat as array of 1
        if (response.site_id || response.event_id || response.person_id || Object.keys(response).length > 0) {
            return [response] as T[];
        }
    }
    
    return [];
};

// --- Data Loader Logic ---

export const ensureReferenceDataLoaded = async () => {
    if (refData.isLoaded || refData.isLoading) return;
    refData.isLoading = true;

    try {
        // Use /event (event_full_flat) instead of /events (fact_event) for richer data
        const [mediaRes, eventMediaRes, personEventRes, personsRes, eventsRes] = await Promise.all([
            fetchFromApi('/media'),
            fetchFromApi('/event_media'),
            fetchFromApi('/person_event'),
            fetchFromApi('/persons'),
            fetchFromApi('/event') 
        ]);

        const allMedia = extractData<RawData>(mediaRes);
        refData.mediaMap = new Map(allMedia.map(m => {
            const key = getProp(m, ['media_key', 'media_id']);
            return [String(key).trim(), m];
        }));

        refData.eventMediaRelations = extractData<RawData>(eventMediaRes);
        refData.personEventRelations = extractData<RawData>(personEventRes);
        refData.eventsCache = extractData<RawData>(eventsRes);

        const allPersons = extractData<RawData>(personsRes);
        refData.personMap = new Map(allPersons.map(p => {
            const key = getProp(p, ['person_key', 'person_id']);
            return [String(key).trim(), p];
        }));

        refData.isLoaded = true;
    } catch (e) {
        console.warn("[RefData] Load failed:", e);
    } finally {
        refData.isLoading = false;
    }
};

// --- Mappers ---

const parseAdditionalInfo = (infoStr?: string): { [key: string]: string } | undefined => {
    if (!infoStr) return undefined;
    try {
        const parsed = JSON.parse(infoStr);
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed;
        }
        return { "Thông tin": infoStr };
    } catch (e) {
        return { "Thông tin": infoStr };
    }
};

const mapSite = (item: RawData): Site => {
    // City Mapping
    const cityName = getProp(item, ['city_name']);
    if (cityName && !getProp(item, ['site_type'])) {
        const cityId = getProp(item, ['city_id', 'id']);
        return {
            site_id: cityId,
            site_name: cityName,
            site_type: 'Thành phố',
            latitude: Number(getProp(item, ['lat', 'latitude'])) || 0,
            longitude: Number(getProp(item, ['lng', 'longitude'])) || 0,
            address: '',
            description: '',
            additional_info: { 'City ID': String(cityId) },
            city_id: cityId
        };
    } 
    
    // Site Mapping
    const siteId = getProp(item, ['site_id', 'id']);
    const infoStr = getProp(item, ['additional_info', 'info']);
    const info = parseAdditionalInfo(infoStr) || {};
    
    // Explicitly check site_description first
    const desc = getProp(item, ['site_description', 'description', 'desc', 'summary', 'content']);

    return {
        site_id: siteId,
        site_name: getProp(item, ['site_name', 'name']) || 'Không tên',
        site_type: getProp(item, ['site_type', 'type']) || 'Di tích',
        latitude: Number(getProp(item, ['latitude', 'lat'])) || 0,
        longitude: Number(getProp(item, ['longitude', 'lng', 'long'])) || 0,
        address: getProp(item, ['address', 'addr']) || '',
        description: cleanText(desc), 
        established_year: getProp(item, ['established_year', 'year']),
        status: getProp(item, ['status']),
        city_id: getProp(item, ['city_id']),
        additional_info: info
    };
};

const mapPerson = (item: RawData): Person => {
    const bYear = getProp(item, ['birth_year', 'birth']);
    const dYear = getProp(item, ['death_year', 'death']);
    // Try to parse number if it is a string
    const parseYear = (val: any): number | undefined => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && val.trim() !== '') {
             const num = parseInt(val, 10);
             return isNaN(num) ? undefined : num;
        }
        return undefined;
    };

    return {
        person_id: getProp(item, ['person_id', 'id']),
        full_name: getProp(item, ['full_name', 'person_name', 'name']) || 'Không tên',
        birth_year: parseYear(bYear),
        death_year: parseYear(dYear)
    };
};

const hydrateEvents = (rawEvents: RawData[]): Event[] => {
    return rawEvents.map(evt => {
        const evtKey = getProp(evt, ['event_key', 'id']);
        const evtKeyStr = String(evtKey).trim();
        const evtId = getProp(evt, ['event_id', 'id']);
        const mainPersonKey = getProp(evt, ['main_person_key']);

        // 1. Join Media
        const relatedMediaKeys = refData.eventMediaRelations
            .filter(r => String(getProp(r, ['event_key', 'event_id'])).trim() === evtKeyStr)
            .map(r => String(getProp(r, ['media_key', 'media_id'])).trim());
        
        const eventMedia: Media[] = relatedMediaKeys
            .map(k => refData.mediaMap.get(k))
            .filter((m): m is RawData => !!m)
            .map(m => ({
                media_id: getProp(m, ['media_id', 'id']),
                media_url: getProp(m, ['media_url', 'url', 'link']) || '', 
                media_type: (getProp(m, ['media_type', 'type']) === 'video' || getProp(m, ['media_type']) === 'youtube') ? 'video' : 'image',
                caption: getProp(m, ['caption', 'event_name', 'title']) || '' 
            }));

        // 2. Join Persons (Intersection table + Main Person Key)
        const relatedPersonKeys = refData.personEventRelations
            .filter(r => String(getProp(r, ['event_key', 'event_id'])).trim() === evtKeyStr)
            .map(r => String(getProp(r, ['person_key', 'person_id'])).trim());

        if (mainPersonKey) {
            relatedPersonKeys.push(String(mainPersonKey).trim());
        }

        const uniquePersonKeys = Array.from(new Set(relatedPersonKeys));

        const eventPersons: Person[] = uniquePersonKeys
            .map(k => refData.personMap.get(k))
            .filter((p): p is RawData => !!p)
            .map(mapPerson);

        // Explicitly check event_description first
        const eventDesc = getProp(evt, ['event_description', 'description', 'desc', 'summary']);
        
        // Ensure start_date is a string to prevent regex crashes
        const rawDate = getProp(evt, ['event_date', 'date', 'start_date']);
        const startDateStr = rawDate !== undefined && rawDate !== null ? String(rawDate) : undefined;

        return {
            event_id: evtId,
            event_name: getProp(evt, ['event_name', 'name', 'title']) || 'Sự kiện',
            start_date: startDateStr,
            description: cleanText(eventDesc),
            media: eventMedia,
            persons: eventPersons,
            related_site_id: getProp(evt, ['site_key', 'site_id']) ? String(getProp(evt, ['site_key', 'site_id'])) : undefined, 
            related_site_name: '' 
        };
    });
};

// --- Public Fetch Functions ---

export const fetchCitiesList = async (): Promise<Site[]> => {
    try {
        const response = await fetchFromApi('/cities');
        const data = extractData<RawData>(response);
        return data.map(item => {
             const cityId = getProp(item, ['city_id', 'id']);
             return {
                site_id: cityId,
                site_name: getProp(item, ['city_name', 'name']) || 'Không tên',
                site_type: 'Thành phố',
                latitude: Number(getProp(item, ['lat', 'latitude'])) || 0,
                longitude: Number(getProp(item, ['lng', 'longitude'])) || 0,
                address: '',
                description: '',
                additional_info: { 'City ID': String(cityId) },
                city_id: cityId
             } as Site;
        }).filter(city => city.latitude && city.longitude);
    } catch (e) {
        console.warn("fetchCitiesList failed:", e);
        return [];
    }
};

export const fetchSites = async (): Promise<Site[]> => {
    const mappedSites: Site[] = [];
    try {
        const [sitesRes, citiesRes] = await Promise.all([
            fetchFromApi('/locations'), 
            fetchFromApi('/cities')
        ]);
        
        const sitesData = extractData<RawData>(sitesRes);
        const citiesData = extractData<RawData>(citiesRes);
        
        if (sitesData.length > 0) {
            sitesData.forEach(item => {
                const site = mapSite(item);
                if (site.latitude && site.longitude) mappedSites.push(site);
            });
        }
        
        if (citiesData.length > 0) {
            citiesData.forEach(item => {
                const citySite = mapSite(item);
                if (citySite.latitude && citySite.longitude) {
                    if (!mappedSites.find(s => String(s.site_id) === String(citySite.site_id) && s.site_type === 'Thành phố')) {
                        mappedSites.push(citySite);
                    }
                }
            });
        }
        
        globalSiteCache = mappedSites;
        return mappedSites;
    } catch (e) {
        console.warn("fetchSites failed:", e);
        return [];
    }
};

export const fetchPersons = async (): Promise<Person[]> => {
    try {
        // Ensure reference data is loaded to map cities
        await ensureReferenceDataLoaded();
        
        // Ensure sites are loaded for city mapping
        let sites = globalSiteCache;
        if (sites.length === 0) {
             const sitesRes = await fetchFromApi('/locations');
             sites = extractData<RawData>(sitesRes).map(mapSite);
        }
        
        // Searchable sites: Sort by name length descending to match specific names first
        // e.g. "Thừa Thiên Huế" before "Huế"
        const searchableSites = [...sites].sort((a, b) => b.site_name.length - a.site_name.length);

        const persons: Person[] = [];
        
        for (const rawPerson of refData.personMap.values()) {
            const person = mapPerson(rawPerson);
            const pKey = String(getProp(rawPerson, ['person_key', 'id'])).trim();
            const pId = String(getProp(rawPerson, ['person_id', 'id'])).trim();
            
            // Calculate related cities based on events AND text matching
            const relatedCityIds = new Set<string | number>();
            
            // Variables to track map location for the person
            let mapLocation: Site | undefined;

            // --- Strategy A: Event-based Mapping ---
            // 1. Check events linked via person_event table
            const linkedEventKeys = refData.personEventRelations
                .filter(r => {
                    const k = String(getProp(r, ['person_key', 'person_id'])).trim();
                    return k === pKey || k === pId;
                })
                .map(r => String(getProp(r, ['event_key', 'event_id'])).trim());

            // 2. Scan all events to find site -> city
            refData.eventsCache.forEach(evt => {
                const eKey = String(getProp(evt, ['event_key', 'id'])).trim();
                const mainPersonKey = String(getProp(evt, ['main_person_key'])).trim();

                const isLinked = linkedEventKeys.includes(eKey) || mainPersonKey === pKey;
                
                if (isLinked) {
                    const siteId = getProp(evt, ['site_id', 'site_key', 'location_id']);
                    if (siteId) {
                        const site = sites.find(s => String(s.site_id) === String(siteId));
                        // Link to both the city of the site AND the site ID itself (if the site is a city/region marker)
                        if (site) {
                             if (site.city_id) relatedCityIds.add(String(site.city_id));
                             if (site.site_type === 'Thành phố') relatedCityIds.add(String(site.site_id));
                        }
                    }
                }
            });
            
            // --- Strategy B: Text-based Mapping (Heuristic) ---
            // Check hometown, birth place, and bio for ANY site name, not just cities.
            const birthplace = getProp(rawPerson, ['birthplace', 'birth_place', 'place_of_birth', 'hometown']);
            const queQuan = getProp(rawPerson, ['address', 'que_quan']);
            const bio = getProp(rawPerson, ['biography', 'bio', 'description']);

            // Combine text for searching, prioritization: Place > Address > Bio
            const textToSearch = [birthplace, queQuan].filter(Boolean).join(' ').toLowerCase();
            const bioToSearch = bio ? String(bio).toLowerCase() : '';

            // We iterate through sorted sites to find the *first* (most specific) match
            for (const site of searchableSites) {
                const siteName = site.site_name.toLowerCase();
                if (siteName.length < 3) continue; // Skip very short names to avoid false positives

                let isMatch = false;

                // Check strict fields first
                if (textToSearch.includes(siteName)) {
                    isMatch = true;
                }
                // Fallback to bio: check for "sinh tại [Site]", "người [Site]", "quê [Site]"
                else if (
                    bioToSearch.includes(`sinh tại ${siteName}`) || 
                    bioToSearch.includes(`sinh ở ${siteName}`) || 
                    bioToSearch.includes(`người ${siteName}`) ||
                    bioToSearch.includes(`quê ${siteName}`)
                ) {
                     isMatch = true;
                }

                if (isMatch) {
                    // If it's a city, add to filtering list
                    if (site.site_type === 'Thành phố') {
                        relatedCityIds.add(String(site.site_id));
                    } else if (site.city_id) {
                        relatedCityIds.add(String(site.city_id));
                    }

                    // Assign map location if not yet set (First match is best due to sorting by length)
                    if (!mapLocation) {
                        mapLocation = site;
                    }
                }
            }

            person.related_city_ids = Array.from(relatedCityIds);
            
            // Assign map coordinates if found
            if (mapLocation) {
                person.latitude = mapLocation.latitude;
                person.longitude = mapLocation.longitude;
                person.location_name = mapLocation.site_name;
            } else if (relatedCityIds.size > 0) {
                // Fallback: if we found a related city ID via events but not via text match (rare), use that
                const firstCityId = Array.from(relatedCityIds)[0];
                const citySite = sites.find(s => String(s.site_id) === String(firstCityId));
                if (citySite) {
                    person.latitude = citySite.latitude;
                    person.longitude = citySite.longitude;
                    person.location_name = citySite.site_name;
                }
            }

            persons.push(person);
        }
        
        globalPersonCache = persons;
        return persons;
    } catch (e) {
        console.warn("fetchPersons failed:", e);
        return [];
    }
};

export const fetchSiteDetail = async (siteId: string | number): Promise<SiteDetail | null> => {
    let siteInfo: Site | null = null;
    let rawSiteData: RawData | null = null;
    
    // 1. Fetch Fresh Site Details
    try {
        const res = await fetchFromApi(`/locations/${siteId}`);
        const data = extractData<RawData>(res);
        if (data && data.length > 0) {
            rawSiteData = data[0];
            siteInfo = mapSite(rawSiteData);
        }
    } catch (e) {
        console.warn(`Specific fetch for site ${siteId} failed.`);
    }

    if (!siteInfo) {
        siteInfo = globalSiteCache.find(s => String(s.site_id) === String(siteId)) || null;
    }
    
    if (!siteInfo) return null;

    try {
        await ensureReferenceDataLoaded();

        let siteEventsRaw: RawData[] = [];

        // 2a. Primary Strategy: Backend Filtering
        try {
            const eventsRes = await fetchFromApi(`/event/location/${siteId}`);
            siteEventsRaw = extractData<RawData>(eventsRes);
        } catch (e) {
            console.warn("Backend event filtering failed, trying fallback.");
        }

        // 2b. Fallback Strategy: Client-side Filtering
        if (siteEventsRaw.length === 0 && refData.eventsCache.length > 0) {
            const siteKey = rawSiteData ? getProp(rawSiteData, ['site_key']) : null;
            const siteKeyStr = siteKey ? String(siteKey).trim() : null;
            const siteIdStr = String(siteId).trim();
            
            siteEventsRaw = refData.eventsCache.filter(evt => {
                // Check against site_key
                const evtSiteKey = getProp(evt, ['site_key']);
                if (evtSiteKey && siteKeyStr && String(evtSiteKey).trim() === siteKeyStr) {
                    return true;
                }
                // Check against site_id
                const evtSiteId = getProp(evt, ['site_id']);
                if (evtSiteId && String(evtSiteId).trim() === siteIdStr) {
                    return true;
                }
                return false;
            });
        }
        
        // 3. Hydrate
        const hydratedEvents = hydrateEvents(siteEventsRaw);

        return {
            ...siteInfo,
            events: hydratedEvents
        };
    } catch (error) {
        console.warn("fetchSiteDetail failed to load events:", error);
        return { ...siteInfo, events: [] };
    }
};

export const fetchPersonDetail = async (personId: string | number): Promise<PersonDetail | null> => {
    let rawPerson: RawData | null = null;
    let personInfo: Person | null = null;

    try {
        const res = await fetchFromApi(`/persons/${personId}`);
        const data = extractData<RawData>(res);
        if (data.length > 0) {
            rawPerson = data[0];
            personInfo = mapPerson(rawPerson);
        }
    } catch (e) { }

    if (!personInfo) {
         personInfo = globalPersonCache.find(p => String(p.person_id) === String(personId)) || null;
    }

    if (!personInfo) return null;
    
    try {
        await ensureReferenceDataLoaded();
        
        if (!rawPerson) {
             for (const p of refData.personMap.values()) {
                 const pId = getProp(p, ['person_id', 'id']);
                 if (String(pId) === String(personId)) {
                     rawPerson = p;
                     break;
                 }
             }
        }
        
        if (!rawPerson) {
             return { 
                ...personInfo, 
                biography: '', 
                events: [], 
                media: [] 
            };
        }

        const personKey = getProp(rawPerson, ['person_key', 'id']);
        const dbKey = String(personKey).trim();

        const linkedEventKeys = new Set(
            refData.personEventRelations
                .filter(r => String(getProp(r, ['person_key', 'person_id'])).trim() === dbKey)
                .map(r => String(getProp(r, ['event_key', 'event_id'])).trim())
        );

        const personEventsRaw = refData.eventsCache.filter(e => {
            const eKey = getProp(e, ['event_key', 'id']);
            return linkedEventKeys.has(String(eKey).trim());
        });

        const hydratedEvents = hydrateEvents(personEventsRaw);
        
        const personMedia: Media[] = [];
        hydratedEvents.forEach(e => {
            if (e.media) personMedia.push(...e.media);
        });

        // Map additional info (like birthplace from the example)
        const additionalInfo: { [key: string]: string } = {};
        const birthplace = getProp(rawPerson, ['birthplace', 'birth_place', 'place_of_birth']);
        if (birthplace) {
            additionalInfo['Quê quán'] = birthplace;
        }

        // Also merge any generic additional_info object
        const extraInfoStr = getProp(rawPerson, ['additional_info', 'info']);
        if (extraInfoStr) {
            const parsed = parseAdditionalInfo(extraInfoStr);
            if (parsed) Object.assign(additionalInfo, parsed);
        }

        return {
            ...personInfo,
            biography: cleanText(getProp(rawPerson, ['biography', 'bio', 'description'])),
            events: hydratedEvents,
            media: personMedia,
            additional_info: additionalInfo,
            latitude: personInfo.latitude,
            longitude: personInfo.longitude,
            location_name: personInfo.location_name
        };

    } catch (error) {
        console.warn("fetchPersonDetail failed:", error);
        return { ...personInfo, biography: '', events: [], media: [] };
    }
};

// --- Unchanged Service Functions ---

const formatDistance = (distanceMeters: number): string => {
    if (distanceMeters < 1) return '';
    if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(1)} km`;
    return `${Math.round(distanceMeters)} m`;
};

const getInstructionText = (maneuver: any, streetName: string): string => {
    const type = maneuver.type;
    const modifier = maneuver.modifier;
    let action = '';
    switch (type) {
        case 'depart': action = 'Khởi hành'; break;
        case 'arrive': return 'Bạn đã đến đích';
        case 'turn':
        case 'fork':
        case 'end of road':
             if (modifier && modifier.includes('left')) action = 'Rẽ trái';
             else if (modifier && modifier.includes('right')) action = 'Rẽ phải';
             else action = 'Rẽ';
             break;
        case 'roundabout': action = `Đi vào vòng xuyến (lối ra ${maneuver.exit || 1})`; break;
        default: action = 'Đi tiếp';
    }
    if (streetName) return `${action} vào ${streetName}`;
    return action;
};

export const fetchDirections = async (start: [number, number], end: [number, number]): Promise<RouteData> => {
    const [startLat, startLon] = start;
    const [endLat, endLon] = end;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); 
        const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?steps=true&geometries=geojson&overview=full`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`OSRM Status ${response.status}`);
        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error('No route found');
        const route = data.routes[0];
        const leg = route.legs[0];
        return {
            summary: {
                totalDistance: formatDistance(route.distance),
                totalDuration: `${Math.round(route.duration / 60)} phút`
            },
            steps: leg.steps.map((step: any) => ({
                instruction: getInstructionText(step.maneuver, step.name),
                distance: formatDistance(step.distance)
            })),
            routeGeometry: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])
        };
    } catch (error) {
        return {
            summary: {
                totalDistance: "N/A",
                totalDuration: "N/A"
            },
            steps: [{ instruction: "Chế độ offline hoặc lỗi dịch vụ.", distance: "" }],
            routeGeometry: [[startLat, startLon], [endLat, endLon]]
        };
    }
};

export const searchAddress = async (query: string): Promise<AddressSearchResult[]> => {
    if (!query || query.length < 3) return [];
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 4000);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'vi' }, signal: controller.signal });
        if (!response.ok) throw new Error('Nominatim fetch failed');
        const data = await response.json();
        return data.map((item: any) => ({
            name: item.display_name.split(',')[0],
            address: item.display_name,
            coordinates: [parseFloat(item.lat), parseFloat(item.lon)]
        }));
    } catch (error) {
        return [];
    }
};

export const reverseGeocode = async (coords: [number, number]): Promise<string> => {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 4000);
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}&zoom=18&addressdetails=1`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'vi' }, signal: controller.signal });
        if (!response.ok) throw new Error('Nominatim reverse failed');
        const data = await response.json();
        return data.display_name ? data.display_name.split(',')[0] : "Vị trí đã chọn";
    } catch (error) {
        return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
    }
};
