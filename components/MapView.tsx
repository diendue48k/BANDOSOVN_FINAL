
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Polyline, useMapEvents, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Site, RouteData } from '../types';
import { GlobeAltIcon, XIcon, PlusIcon, MinusIcon, ArrowRightIcon, UsersIcon } from './Icons';
import { SiteDetailContent } from './SiteDetailContent';

// --- Icon Creation & Fixes ---

try {
    // @ts-ignore
    if (L.Icon.Default.prototype._getIconUrl) {
        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
    }
} catch (e) {
    console.warn("Leaflet icon fix warning:", e);
}

// Simple flat marker as requested
const createMarkerIcon = (isSelected: boolean, type: string): L.DivIcon => {
  const isCity = type === 'Thành phố';
  const isPerson = type === 'Nhân vật';
  
  let color = '#0ea5e9'; 
  if (isCity) color = '#9333ea'; 
  if (isPerson) color = '#0ea5e9'; 

  const zIndex = isSelected ? 1000 : (isCity ? 900 : (isPerson ? 800 : 100)); 

  // SVG Paths
  const pinPath = "M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z";
  // User Group Icon Path (simplified for marker)
  const userPath = "M16.5 7.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM12 13.5c-4.418 0-8 2.239-8 5v1.5h16v-1.5c0-2.761-3.582-5-8-5z";

  const svgContent = isPerson 
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" style="width: ${isSelected ? '42px' : '32px'}; height: ${isSelected ? '42px' : '32px'}; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)); transition: all 0.2s ease;">
         <path fill-rule="evenodd" d="${userPath}" clip-rule="evenodd" />
       </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" style="width: ${isSelected ? '42px' : '32px'}; height: ${isSelected ? '42px' : '32px'}; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)); transition: all 0.2s ease;">
         <path fill-rule="evenodd" d="${pinPath}" clip-rule="evenodd" />
       </svg>`;

  const markerHtml = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: ${zIndex};">
      ${svgContent}
      ${isCity && !isSelected ? `<span style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.9); padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #475569; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">Khu vực</span>` : ''}
    </div>
  `;
  return L.divIcon({
    html: markerHtml,
    className: '', 
    iconSize: isSelected ? [42, 42] : [32, 32],
    iconAnchor: isSelected ? [21, 42] : [16, 32],
    popupAnchor: [0, isSelected ? -46 : -36],
  });
};

const userLocationIcon = L.divIcon({
    html: `
        <div class="relative flex items-center justify-center w-6 h-6">
            <span class="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75 animate-ping"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 bg-sky-500 border-2 border-white shadow-sm"></span>
        </div>
    `,
    className: '',
    iconSize: [24, 24],
});

const pickerIcon = L.divIcon({
    html: `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" style="width: 40px; height: 40px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">
          <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
        </svg>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
});


// --- Child Components ---

const MapController: React.FC<{ 
    selectedSite: Site | null; 
    isModalOpen: boolean; 
    activeCityLocation: [number, number] | null;
    isSidebarCollapsed: boolean;
}> = ({ selectedSite, isModalOpen, activeCityLocation, isSidebarCollapsed }) => {
  const map = useMap();

  useEffect(() => {
    // Invalidate size to ensure map fills container correctly after layout changes
    const timer = setTimeout(() => {
        try { if (map) map.invalidateSize(); } catch (e) {}
    }, 350);
    return () => clearTimeout(timer);
  }, [isModalOpen, map, isSidebarCollapsed]);

  useEffect(() => {
    if (selectedSite) {
        // Calculate offset to prevent marker being hidden behind UI
        const targetLatLng = L.latLng(selectedSite.latitude, selectedSite.longitude);
        const currentZoom = map.getZoom();
        const targetZoom = Math.max(currentZoom, 15); // Zoom in if too far out

        // Determine offset based on screen size
        const isMobile = window.innerWidth < 768;
        let xOffset = 0;
        let yOffset = 0;

        if (isMobile) {
            // Mobile: Bottom sheet covers roughly 65% of height when open
            // We want the marker in the top 35% visible area.
            // Center of visible area is roughly 17.5% from top.
            // Map center is 50%.
            // Shift map center DOWN by (50 - 20) = 30% of screen height so marker moves UP.
            yOffset = window.innerHeight * 0.25; 
        } else {
            // Desktop: Sidebar on left (360px)
            // If sidebar is open, we want marker centered in the remaining space on the right.
            // Shift map center LEFT by 180px so marker moves RIGHT.
            if (!isSidebarCollapsed) {
                xOffset = -180;
            }
        }

        // Project to pixel point at target zoom
        const point = map.project(targetLatLng, targetZoom);
        const targetPoint = point.add([xOffset, yOffset]);
        const newCenter = map.unproject(targetPoint, targetZoom);

        map.flyTo(newCenter, targetZoom, { animate: true, duration: 1.0 });

    } else if (activeCityLocation) {
        map.flyTo(activeCityLocation, 12, { animate: true, duration: 1.2 });
    }
  }, [selectedSite, activeCityLocation, map, isSidebarCollapsed]);

  return null;
};

// Listen to Zoom changes
const ZoomListener: React.FC<{ onZoomChange: (zoom: number) => void }> = ({ onZoomChange }) => {
    const map = useMapEvents({
        zoomend: () => onZoomChange(map.getZoom()),
        load: () => onZoomChange(map.getZoom())
    });
    return null;
};

const CustomZoomControl = () => {
    const map = useMap();
    return (
        <div className="absolute bottom-24 md:bottom-8 right-4 z-[400] flex flex-col bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-xl overflow-hidden">
            <button
                onClick={(e) => { e.stopPropagation(); map.zoomIn(); }}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-b border-slate-700/50 focus:outline-none"
                title="Phóng to"
            >
                <PlusIcon className="w-5 h-5" />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); map.zoomOut(); }}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                title="Thu nhỏ"
            >
                <MinusIcon className="w-5 h-5" />
            </button>
        </div>
    )
}

// Lightweight Popup Content for Persons
const PersonPopupCard: React.FC<{ site: Site; onViewDetails: () => void }> = ({ site, onViewDetails }) => {
    return (
        <div className="bg-[#1e293b] rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col w-full">
            <div className="relative w-full h-32 bg-slate-800 flex items-center justify-center">
                 <UsersIcon className="h-16 w-16 text-slate-600" />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
            </div>
            
            <div className="px-4 py-4 flex flex-col space-y-3">
                <h3 className="font-bold text-sky-400 truncate text-lg leading-tight">{site.site_name}</h3>
                
                <div className="min-h-[40px]">
                   <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{site.description}</p>
                </div>
                
                <div className="pt-2">
                    <button
                        onClick={onViewDetails}
                        className="w-full flex items-center justify-center text-sm font-bold text-white bg-sky-500 hover:bg-sky-400 transition-all duration-200 py-2 rounded-lg shadow-lg shadow-sky-900/20 active:scale-95"
                    >
                        Xem chi tiết 
                        <ArrowRightIcon className="h-4 w-4 ml-1.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

interface SiteMarkerProps {
    site: Site;
    isSelected: boolean;
    onSiteSelect: (site: Site | null) => void;
    onShowDirections?: (site: Site) => void;
}

const SiteMarker: React.FC<SiteMarkerProps> = ({ site, isSelected, onSiteSelect, onShowDirections }) => {
    const markerRef = useRef<L.Marker>(null);
    const type = site.site_type;
    const isPerson = type === 'Nhân vật';
    
    // Memoize icon creation
    const icon = useMemo(() => createMarkerIcon(isSelected, type), [isSelected, type]);

    // If selected via search/sidebar, make sure Popup is OPEN (or just rely on sidebar)
    // Actually, if selected via sidebar, we show the modal. We might want to animate marker but not necessarily open popup.
    // However, if the user clicked the marker (double click), selected is true.
    
    return (
        <Marker
            ref={markerRef}
            position={[site.latitude, site.longitude]}
            icon={icon}
            eventHandlers={{
                click: (e) => {
                    // Single click: Just open popup. Do NOT select globally yet.
                    e.originalEvent.stopPropagation();
                    e.target.openPopup();
                },
                dblclick: (e) => {
                    // Double click: Select globally (open sidebar/modal)
                    L.DomEvent.stopPropagation(e.originalEvent);
                    onSiteSelect(site);
                    markerRef.current?.closePopup();
                }
            }}
        >
           <Tooltip direction="top" offset={[0, isSelected ? -42 : -32]} opacity={1}>
                <span className="font-sans font-semibold text-slate-800">{site.site_name}</span>
           </Tooltip>
           
           <Popup 
                autoPan={true} 
                closeButton={false} 
                className="custom-popup"
                maxWidth={320}
                minWidth={320}
            >
                <div className="relative group">
                    <button
                        className="absolute top-2 right-2 z-[60] p-1.5 bg-black/40 hover:bg-black/70 text-white rounded-full transition-all backdrop-blur-sm shadow-md"
                        onClick={(e) => {
                            e.stopPropagation();
                            markerRef.current?.closePopup();
                        }}
                        title="Đóng"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                    
                    {isPerson ? (
                        <PersonPopupCard 
                            site={site} 
                            onViewDetails={() => {
                                onSiteSelect(site);
                                markerRef.current?.closePopup();
                            }}
                        />
                    ) : (
                        <SiteDetailContent 
                            siteId={site.site_id} 
                            isModal={false} 
                            onShowDetailModal={() => {
                                onSiteSelect(site);
                                markerRef.current?.closePopup();
                            }}
                            onShowDirections={() => {
                                if (onShowDirections) {
                                    onShowDirections(site);
                                    markerRef.current?.closePopup();
                                }
                            }}
                        />
                    )}
                </div>
            </Popup>
        </Marker>
    );
};

const RouteLayer: React.FC<{ routeGeometry: [number, number][], userLocation: [number, number], autoPanPadding: L.Point }> = ({ routeGeometry, userLocation, autoPanPadding }) => {
    const map = useMap();
    useEffect(() => {
        if (routeGeometry.length > 0) {
            const bounds = L.latLngBounds(routeGeometry);
            if(userLocation) bounds.extend(userLocation);
            map.flyToBounds(bounds, { padding: [50, 50], animate: true });
        }
    }, [routeGeometry, userLocation, map]);

    return (
        <>
            <Polyline positions={routeGeometry} color="#0ea5e9" weight={6} opacity={0.8} />
            <Polyline positions={routeGeometry} color="#38bdf8" weight={3} opacity={1} />
            <Marker position={userLocation} icon={userLocationIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    Vị trí của bạn
                </Tooltip>
            </Marker>
        </>
    );
};

const MapEventsHandler: React.FC<{ 
    isPicking: boolean, 
    onLocationPicked: (c: [number, number]) => void,
    onMapClick?: () => void,
    onHover: (l: L.LatLng | null) => void 
}> = ({ isPicking, onLocationPicked, onMapClick, onHover }) => {
    useMapEvents({
        click(e) {
            if (isPicking) onLocationPicked([e.latlng.lat, e.latlng.lng]);
            else if (onMapClick) onMapClick();
        },
        mousemove(e) {
            if (isPicking) onHover(e.latlng);
        },
        mouseout() {
            if (isPicking) onHover(null);
        }
    });
    return null;
};

// --- Main MapView Component ---

interface MapViewProps {
  sites: Site[];
  cities: Site[];
  selectedSite: Site | null;
  onSiteSelect: (site: Site | null) => void;
  onShowDetailModal: () => void;
  isModalOpen: boolean;
  
  route?: RouteData | null;
  userLocation?: [number, number] | null;
  onShowDirections?: (site: Site) => void;
  onClearDirections?: () => void;
  isGettingDirections?: boolean;
  
  isPickingLocation?: boolean;
  onLocationPicked?: (coords: [number, number]) => void;
  onCancelPicking?: () => void;
  onMapClick?: () => void;
  
  isDirectionsMode?: boolean;
  activeCityLocation?: [number, number] | null;
  isSidebarCollapsed?: boolean;
}

export const MapView: React.FC<MapViewProps> = (props) => {
  const { 
    sites, cities, selectedSite, onSiteSelect, onShowDetailModal, isModalOpen,
    route, userLocation, isGettingDirections, isPickingLocation, onLocationPicked, onCancelPicking,
    onMapClick, isDirectionsMode, activeCityLocation, isSidebarCollapsed, onShowDirections
  } = props;
  
  // Default to Vietnam view
  const vietnamCenter: [number, number] = [16.5, 107.0];
  const [hoverPosition, setHoverPosition] = useState<L.LatLng | null>(null);
  
  // Zoom State
  const [currentZoom, setCurrentZoom] = useState<number>(6);

  // Semantic Zoom Logic
  const displayItems = useMemo(() => {
      if (route) return []; 
      
      // If active city selected from sidebar (filtering mode), always show sites for that city
      if (activeCityLocation) return sites;

      // Threshold zoom level 8 for switching between Cities and Sites
      if (currentZoom < 8) {
          // Show Cities if available, otherwise fallback to sites
          // BUT if we are in 'Persons' mode (where site_type is 'Nhân vật'), just show them regardless of zoom if specific enough?
          // Actually for Persons, let's behave like sites.
          
          const hasPersons = sites.some(s => s.site_type === 'Nhân vật');
          if (hasPersons) return sites; // Always show persons if that's the current view

          return cities && cities.length > 0 ? cities : sites;
      }
      return sites;
  }, [currentZoom, cities, sites, route, activeCityLocation]);

  return (
    <div className="relative h-full w-full bg-slate-100">
        <MapContainer 
            center={vietnamCenter} 
            zoom={6} 
            scrollWheelZoom={true} 
            className="h-full w-full z-10"
            zoomControl={false}
        >
            <ZoomListener onZoomChange={setCurrentZoom} />
            <MapController 
                selectedSite={selectedSite} 
                isModalOpen={isModalOpen} 
                activeCityLocation={activeCityLocation || null} 
                isSidebarCollapsed={!!isSidebarCollapsed}
            />
            <CustomZoomControl />
            <MapEventsHandler 
                isPicking={!!isPickingLocation} 
                onLocationPicked={onLocationPicked || (() => {})} 
                onMapClick={onMapClick}
                onHover={setHoverPosition}
            />
            
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            
            {!route && displayItems.map(site => (
                <SiteMarker 
                    key={site.site_id}
                    site={site}
                    isSelected={selectedSite?.site_id === site.site_id}
                    onSiteSelect={onSiteSelect}
                    onShowDirections={onShowDirections}
                />
            ))}

            {route && userLocation && route.routeGeometry && (
                <RouteLayer routeGeometry={route.routeGeometry} userLocation={userLocation} autoPanPadding={L.point(0,0)} />
            )}
            
            {/* Picking Ghost Marker */}
            {isPickingLocation && hoverPosition && (
                <Marker position={hoverPosition} icon={pickerIcon} interactive={false} zIndexOffset={1000} />
            )}
        </MapContainer>

        {/* Picking UI Overlay */}
        {isPickingLocation && (
            <div className={`absolute top-24 md:top-4 z-20 pointer-events-none transition-all duration-300 w-full flex justify-center`}>
                <div className="bg-slate-800/90 backdrop-blur text-white px-5 py-3 rounded-full flex items-center gap-3 pointer-events-auto shadow-xl border border-white/10">
                    <GlobeAltIcon className="h-5 w-5 text-sky-400 animate-pulse" />
                    <span className="text-sm font-medium">Chọn vị trí trên bản đồ</span>
                    <button onClick={onCancelPicking} className="ml-2 p-1 hover:bg-white/10 rounded-full"><XIcon className="h-4 w-4" /></button>
                </div>
            </div>
        )}
        
        {/* Loading Overlay */}
        {isGettingDirections && (
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-30 flex items-center justify-center">
                <div className="bg-slate-900 p-4 rounded-xl flex items-center gap-3 shadow-2xl border border-slate-700">
                    <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-200 text-sm font-medium">Đang tìm đường...</span>
                </div>
             </div>
        )}
    </div>
  );
};
