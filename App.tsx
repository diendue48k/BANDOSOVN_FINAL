
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MapView } from './components/MapView';
import { SiteDetailModal } from './components/SiteDetailModal';
import { SiteDetailPopup } from './components/SiteDetailPopup'; // Import Popup component
import { PersonDetailModal } from './components/PersonDetailModal';
import { Site, Person, ViewMode, RouteData } from './types';
import { fetchSites, fetchPersons, fetchDirections, reverseGeocode, fetchCitiesList } from './services/apiService';
import { GlobalSearch, ViewModeToggle } from './components/GlobalSearch';
import { DirectionsPanel } from './components/DirectionsPanel';

interface LocationPoint {
    name: string;
    coords: [number, number] | null;
}

const App: React.FC = () => {
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [citiesList, setCitiesList] = useState<Site[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>('sites');
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // City Filtering State
  const [selectedCityId, setSelectedCityId] = useState<string | number>('all');
  const [activeCityLocation, setActiveCityLocation] = useState<[number, number] | null>(null);

  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [mobileSheetState, setMobileSheetState] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Directions State
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [isGettingDirections, setIsGettingDirections] = useState(false);
  const [isDirectionsMode, setIsDirectionsMode] = useState(false);
  
  // Lifted Directions Input State
  const [directionStart, setDirectionStart] = useState<LocationPoint>({ name: '', coords: null });
  const [directionEnd, setDirectionEnd] = useState<LocationPoint>({ name: '', coords: null });
  
  // Picking State
  const [pickingField, setPickingField] = useState<'start' | 'end' | null>(null);

  const loadData = useCallback(async () => {
      setIsLoading(true);
      try {
          // Chain fetches to ensure sites are loaded before persons (for city mapping in fetchPersons)
          const sites = await fetchSites();
          setAllSites(sites);
          
          const cities = await fetchCitiesList();
          setCitiesList(cities);
          
          // Now fetch persons (internally it will use the site cache)
          const persons = await fetchPersons();
          setAllPersons(persons);
      } catch (error) {
          console.warn("Error during data load:", error);
          setAllSites([]);
          setAllPersons([]);
          setCitiesList([]);
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    loadData();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(coords);
          // Default start to user location if available and empty
          setDirectionStart(prev => !prev.coords ? { name: 'Vị trí của bạn', coords } : prev);
        },
        (error) => console.log('Geolocation error:', error),
        { enableHighAccuracy: true }
      );
    }
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (viewMode === 'sites') {
      return allSites.filter(site => {
        const matchesSearch = site.site_name.toLowerCase().includes(term);
        const matchesType = selectedType === 'all' || site.site_type === selectedType;
        
        // City Filter logic
        let matchesCity = true;
        if (selectedCityId !== 'all') {
            // Match if site.city_id matches selected
            // OR if the site IS the selected city (so the city marker stays visible)
            matchesCity = String(site.city_id) === String(selectedCityId) || String(site.site_id) === String(selectedCityId);
        }

        return matchesSearch && matchesType && matchesCity;
      });
    } else {
       return allPersons.filter(person => {
          const matchesSearch = person.full_name.toLowerCase().includes(term);
          let matchesCity = true;
          if (selectedCityId !== 'all') {
              // Check if person is related to the selected city
              if (person.related_city_ids && person.related_city_ids.length > 0) {
                  matchesCity = person.related_city_ids.some(id => String(id) === String(selectedCityId));
              } else {
                  // If no city data, filter out when a specific city is selected
                  matchesCity = false;
              }
          }
          return matchesSearch && matchesCity;
       });
    }
  }, [allSites, allPersons, viewMode, searchTerm, selectedType, selectedCityId]);

  // Derive sites specifically for map view to handle type safety and 'persons' view mode logic
  const mapSites = useMemo(() => {
    if (viewMode === 'sites') {
        return filteredItems as Site[];
    }
    
    // In persons mode, we want to visualize the PERSONS themselves as "sites" if they have coordinates
    if (viewMode === 'persons') {
        const persons = filteredItems as Person[];
        // Map persons with coordinates to "Virtual Sites" so the map can render them
        return persons
            .filter(p => p.latitude && p.longitude)
            .map(p => ({
                site_id: `p-${p.person_id}`, // Unique virtual ID
                site_name: p.full_name,
                site_type: 'Nhân vật', // Special type for rendering
                latitude: p.latitude!,
                longitude: p.longitude!,
                address: p.location_name || '',
                description: `Sinh/Quê quán: ${p.location_name}. Năm sinh: ${p.birth_year || '?'}`,
                city_id: undefined,
                // Custom properties to help identification in handleSiteSelect
                personId: p.person_id,
                isPerson: true
            } as any as Site));
    }
    
    return allSites;
  }, [viewMode, filteredItems, allSites]);

  const siteTypes = useMemo(() => {
    // Only show types present in the filtered view
    const types = new Set(allSites.map(s => s.site_type));
    return ['all', ...Array.from(types)];
  }, [allSites]);

  const handleCitySelect = (id: string | number) => {
      setSelectedCityId(id);
      setSelectedSite(null); // Clear selected site when changing city
      
      if (id !== 'all') {
          const city = citiesList.find(c => String(c.site_id) === String(id));
          if (city) {
              setActiveCityLocation([city.latitude, city.longitude]);
          }
      } else {
          setActiveCityLocation(null);
      }
  };

  const handleSiteSelect = (site: Site | null) => {
    if (site && (site as any).isPerson) {
        // Handle selection of a Person Marker
        const personId = (site as any).personId;
        const person = allPersons.find(p => p.person_id === personId);
        if (person) {
            handlePersonSelect(person);
        }
    } else {
        // Normal Site Selection
        setSelectedSite(site);
        setSelectedPerson(null);
    }
  };

  const handlePersonSelect = (person: Person) => {
    setSelectedPerson(person);
    // REMOVED: setMobileSheetState('half') - PersonDetailModal handles visibility
  };

  const handleCloseModals = () => {
      setSelectedSite(null);
      setSelectedPerson(null);
  };
  
  const handleGlobalSearchSelect = (item: Site | Person) => {
      if ('site_id' in item) {
          handleSiteSelect(item as Site);
          setViewMode('sites');
      } else {
          handlePersonSelect(item as Person);
          setViewMode('persons');
      }
  };

  const handleShowDirections = async (site: Site) => {
      // Close detail modal
      setSelectedSite(null);
      
      // Open directions mode and set destination
      setIsDirectionsMode(true);
      setDirectionEnd({
          name: site.site_name,
          coords: [site.latitude, site.longitude]
      });
      // Ensure start is set to user location if not already set
      if (!directionStart.coords && userLocation) {
          setDirectionStart({ name: 'Vị trí của bạn', coords: userLocation });
      }
  };
  
  const handleClearDirections = () => {
      setRoute(null);
      setIsDirectionsMode(false);
      setPickingField(null);
  };

  const handleFindRoute = async (startCoords: [number, number], startName: string, endCoords: [number, number], endName: string) => {
      setPickingField(null);
      setIsGettingDirections(true);
      
      const routeData = await fetchDirections(startCoords, endCoords);
      setRoute(routeData);
      
      setIsGettingDirections(false);
  };
  
  const handlePickLocation = (coords: [number, number]) => {
      reverseGeocode(coords).then(name => {
         if (pickingField === 'start') {
             setDirectionStart({ name, coords });
         } else if (pickingField === 'end') {
             setDirectionEnd({ name, coords });
         }
         setPickingField(null);
      });
  };

  const toggleMobileMenu = () => {
      setMobileSheetState(prev => prev === 'collapsed' ? 'half' : 'collapsed');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Sidebar - HIDDEN in Directions Mode OR when a Detail View is active on Mobile */}
      <div className={`
          ${isDirectionsMode ? 'hidden' : 'block'} 
          ${(selectedSite || selectedPerson) ? 'hidden md:block' : ''}
      `}>
        <Sidebar 
            items={filteredItems}
            viewMode={viewMode}
            onSetViewMode={setViewMode}
            listTitle={viewMode === 'sites' ? 'Danh sách địa điểm' : 'Danh sách nhân vật'}
            onSearch={setSearchTerm}
            onFilter={setSelectedType}
            siteTypes={siteTypes}
            selectedType={selectedType}
            isLoading={isLoading}
            onSiteSelect={handleSiteSelect}
            onPersonSelect={handlePersonSelect}
            selectedItem={selectedSite || selectedPerson}
            mobileSheetState={mobileSheetState}
            setMobileSheetState={setMobileSheetState}
            // City Filter Props
            cities={citiesList}
            selectedCityId={selectedCityId}
            onCitySelect={handleCitySelect}
            // Retry Action
            onRetry={loadData}
            // Desktop Collapse State
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      <main className="flex-grow relative h-full">
        {/* NEW MOBILE HEADER: Fixed at the top */}
        {!isDirectionsMode && (
            <header className="md:hidden absolute top-0 left-0 right-0 z-[60] bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 text-center shadow-2xl">
                <h1 className="text-base font-black text-white leading-tight tracking-wider uppercase drop-shadow-md">
                    BẢN ĐỒ SỐ LỊCH SỬ
                </h1>
                <p className="text-[10px] font-bold text-sky-500 tracking-[0.4em] mt-1 uppercase">
                    VIỆT NAM
                </p>
            </header>
        )}

        {/* Search & Filter - Hide when in Directions Mode */}
        {!isDirectionsMode && (
            <div className={`absolute z-50 flex flex-col md:flex-row gap-2 md:items-center pointer-events-none transition-all duration-300
                ${isSidebarCollapsed ? 'md:left-20' : 'md:left-6'}
                md:right-auto md:top-4 
                /* Mobile Positioning */
                top-[4.5rem] left-4 right-4 
            `}>
                <div className="w-full md:w-96 pointer-events-auto">
                    <GlobalSearch 
                        allSites={allSites} 
                        allPersons={allPersons} 
                        viewMode={viewMode} 
                        onSelect={handleGlobalSearchSelect}
                        onSearchChange={setSearchTerm}
                        onMenuClick={toggleMobileMenu}
                    />
                </div>
                <div className="pointer-events-auto">
                    <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                </div>
            </div>
        )}
        
        <MapView 
            sites={mapSites} 
            cities={citiesList} 
            selectedSite={selectedSite}
            onSiteSelect={handleSiteSelect}
            onShowDetailModal={() => {}}
            isModalOpen={!!selectedSite || !!selectedPerson}
            route={route}
            userLocation={userLocation}
            onShowDirections={handleShowDirections}
            onClearDirections={handleClearDirections}
            isGettingDirections={isGettingDirections}
            isPickingLocation={pickingField !== null}
            onLocationPicked={handlePickLocation}
            onCancelPicking={() => setPickingField(null)}
            onMapClick={() => {
                if (window.innerWidth < 768 && mobileSheetState !== 'collapsed') {
                    setMobileSheetState('collapsed');
                }
            }}
            isDirectionsMode={isDirectionsMode}
            activeCityLocation={activeCityLocation}
            isSidebarCollapsed={isSidebarCollapsed}
        />

        {selectedSite && !isDirectionsMode && (
            <>
                {/* Desktop Modal */}
                <div className="hidden md:block">
                    <SiteDetailModal 
                        site={selectedSite} 
                        onClose={handleCloseModals} 
                        onPersonSelect={handlePersonSelect}
                        onShowDirections={handleShowDirections}
                    />
                </div>
                {/* Mobile Bottom Sheet Popup - Trồi lên từ dưới */}
                <div className="md:hidden">
                    <SiteDetailPopup
                        site={selectedSite}
                        onClose={handleCloseModals}
                        onPersonSelect={handlePersonSelect}
                        onShowDirections={handleShowDirections}
                    />
                </div>
            </>
        )}

        {selectedPerson && (
            <PersonDetailModal 
                person={selectedPerson} 
                onClose={handleCloseModals}
                onSiteSelect={(site) => {
                    handleSiteSelect(site);
                    setViewMode('sites');
                }}
                sites={allSites}
            />
        )}
        
        {isDirectionsMode && (
            <div className={`${pickingField ? 'hidden md:block' : 'block'}`}>
                <DirectionsPanel 
                    routeData={route}
                    onFindRoute={handleFindRoute}
                    onCancel={handleClearDirections}
                    userLocation={userLocation}
                    startPoint={directionStart}
                    endPoint={directionEnd}
                    onStartPointChange={setDirectionStart}
                    onEndPointChange={setDirectionEnd}
                    pickingField={pickingField}
                    onPickStart={() => setPickingField('start')}
                    onPickEnd={() => setPickingField('end')}
                />
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
