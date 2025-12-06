
import React, { useRef, useEffect, useState } from 'react';
import { Site, Person, ViewMode } from '../types';
import { 
  LocationMarkerIcon, 
  UsersIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  MenuIcon,
  GlobeAltIcon,
  SearchIcon
} from './Icons';

interface SidebarProps {
  items: (Site | Person)[];
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  listTitle: string;
  onSearch: (term: string) => void;
  onFilter: (type: string) => void;
  siteTypes: string[];
  selectedType: string;
  isLoading: boolean;
  onSiteSelect: (site: Site) => void;
  onPersonSelect: (person: Person) => void;
  selectedItem: Site | Person | null;
  
  // Mobile sheet control
  mobileSheetState: 'collapsed' | 'half' | 'full';
  setMobileSheetState: (state: 'collapsed' | 'half' | 'full') => void;

  // City Filtering
  cities: Site[];
  selectedCityId: string | number;
  onCitySelect: (id: string | number) => void;

  // Desktop Collapse
  isCollapsed: boolean;
  onToggleCollapse: () => void;

  // Retry action
  onRetry?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    items, viewMode, isLoading, onSiteSelect, onPersonSelect, selectedItem,
    mobileSheetState, setMobileSheetState,
    onSearch, onFilter, siteTypes, selectedType,
    cities, selectedCityId, onCitySelect,
    isCollapsed, onToggleCollapse,
    onRetry
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Helper to check if an item is selected
  const isItemSelected = (item: Site | Person) => {
      if (!selectedItem) return false;
      if ('site_id' in item && 'site_id' in selectedItem) {
          return item.site_id === selectedItem.site_id;
      }
      if ('person_id' in item && 'person_id' in selectedItem) {
          return item.person_id === selectedItem.person_id;
      }
      return false;
  };
  
  // Calculate mobile height class
  const getMobileHeightClass = () => {
      switch(mobileSheetState) {
          case 'collapsed': return 'h-7'; // Rất thấp, chỉ hiện thanh handle
          case 'half': return 'h-[50vh]';
          case 'full': return 'h-[92vh]';
      }
  };

  // Mobile sheet toggle handler
  const handleToggleSheet = () => {
      if (mobileSheetState === 'collapsed') setMobileSheetState('half');
      else if (mobileSheetState === 'half') setMobileSheetState('collapsed');
      else setMobileSheetState('collapsed');
  };

  // Scroll selected item into view on change
  useEffect(() => {
    if (selectedItem && listRef.current) {
        const selectedEl = listRef.current.querySelector('[data-selected="true"]');
        if (selectedEl) {
            selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
  }, [selectedItem]);

  return (
    <>
        {/* Floating Open Button (Desktop Only) */}
        {isCollapsed && (
            <button 
                onClick={onToggleCollapse}
                className="hidden md:flex absolute top-4 left-4 z-[400] items-center justify-center w-10 h-10 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white hover:border-sky-500 hover:shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all duration-300 group"
                title="Mở danh sách"
            >
                <MenuIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
        )}

        <aside 
            className={`
                fixed md:relative 
                bg-slate-950/95 backdrop-blur-xl 
                border-t border-slate-700 md:border-t-0 md:border-r md:border-slate-800
                text-slate-200 
                z-[20] /* Giảm z-index để thấp hơn SiteDetailPopup (z-30) */
                transition-all duration-500 cubic-bezier(0.25, 1, 0.5, 1)
                shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.5)] md:shadow-none
                flex flex-col
                w-full md:w-[360px] md:h-full
                
                /* Mobile Positioning */
                bottom-0 left-0 right-0
                ${getMobileHeightClass()}
                rounded-t-2xl md:rounded-none
                overflow-hidden

                /* Desktop Collapsing */
                ${isCollapsed ? 'md:-ml-[360px]' : 'md:ml-0'}
            `}
        >
            {/* --- Mobile Drag Handle --- */}
            <div 
                className="md:hidden w-full flex items-center justify-center h-7 cursor-pointer flex-shrink-0 hover:bg-white/5 transition-colors bg-slate-900 border-b border-slate-800 active:bg-slate-800"
                onClick={handleToggleSheet}
            >
                <div className="w-10 h-1 bg-slate-600 rounded-full"></div>
            </div>

            {/* --- Header Section --- */}
            <header className="px-4 py-2 md:px-5 md:py-5 flex-shrink-0 border-b border-slate-800/50 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-500/5 to-transparent pointer-events-none"></div>

                <div className="relative flex justify-between items-start">
                    {/* HIDDEN ON MOBILE to prevent duplication with top header */}
                    <div className="hidden md:flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center shadow-lg group">
                            <GlobeAltIcon className="w-6 h-6 text-sky-500 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white - 800 tracking-tight uppercase">
                                BẢN ĐỒ SỐ LỊCH SỬ
                            </h1>
                            <p className="text-[10px] font-bold tracking-[0.2em] text-sky-500 uppercase mt-0.5">
                                VIỆT NAM
                            </p>
                        </div>
                    </div>
                    
                    {/* Desktop Collapse Button */}
                    <button 
                        onClick={onToggleCollapse}
                        className="hidden md:flex p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                        title="Thu gọn"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* --- Filters --- */}
                <div className="mt-1 md:mt-6 space-y-3">
                    {/* City Filter */}
                    <div className="relative group">
                        <select 
                            value={selectedCityId}
                            onChange={(e) => onCitySelect(e.target.value)}
                            className="w-full appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-sm rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all cursor-pointer"
                        >
                            <option value="all">Tất cả khu vực</option>
                            {cities.map(city => (
                                <option key={city.site_id} value={city.site_id}>
                                    {city.site_name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 group-hover:text-slate-300">
                           <GlobeAltIcon className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Type Filter */}
                    {viewMode === 'sites' && (
                        <div className="relative group">
                            <select 
                                value={selectedType}
                                onChange={(e) => onFilter(e.target.value)}
                                className="w-full appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-sm rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all cursor-pointer"
                            >
                                <option value="all">Tất cả loại hình</option>
                                {siteTypes.filter(t => t !== 'all').map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500 group-hover:text-slate-300">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* --- Results Info --- */}
            <div className="px-5 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <span>{viewMode === 'sites' ? 'Địa điểm' : 'Nhân vật'}</span>
                <span className="text-sky-500">{items.length} kết quả</span>
            </div>

            {/* --- List Content --- */}
            <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                {isLoading ? (
                    <div className="p-5 space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="animate-pulse flex space-x-4">
                                <div className="rounded-full bg-slate-800 h-10 w-10"></div>
                                <div className="flex-1 space-y-2 py-1">
                                    <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                                    <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : items.length > 0 ? (
                    <ul className="pb-20 md:pb-0" ref={listRef}>
                        {items.map((item) => {
                            const isSelected = isItemSelected(item);
                            const isSite = 'site_name' in item;
                            const title = isSite ? (item as Site).site_name : (item as Person).full_name;
                            const subtitle = isSite 
                                ? (item as Site).site_type 
                                : `${(item as Person).birth_year || '?'} - ${(item as Person).death_year || '?'}`;

                            return (
                                <li key={isSite ? (item as Site).site_id : (item as Person).person_id}>
                                    <button
                                        onClick={() => isSite ? onSiteSelect(item as Site) : onPersonSelect(item as Person)}
                                        data-selected={isSelected}
                                        className={`
                                            w-full text-left px-5 py-4
                                            border-b border-slate-800/50
                                            transition-all duration-200
                                            flex items-start gap-4 group
                                            relative overflow-hidden
                                            ${isSelected 
                                                ? 'bg-sky-500/10' 
                                                : 'hover:bg-sky-900/20'
                                            }
                                        `}
                                    >
                                        {/* Active Indicator Line */}
                                        {isSelected && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500 shadow-[0_0_10px_#0ea5e9]"></div>
                                        )}

                                        {/* Icon */}
                                        <div className={`
                                            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300
                                            ${isSelected 
                                                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20' 
                                                : 'bg-slate-800 text-slate-500 border-slate-700 group-hover:border-sky-500/50 group-hover:text-sky-400 group-hover:shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                            }
                                        `}>
                                            {isSite ? <LocationMarkerIcon className="w-5 h-5" /> : <UsersIcon className="w-5 h-5" />}
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <h3 className={`
                                                font-bold text-base truncate transition-colors tracking-tight mb-0.5
                                                ${isSelected ? 'text-sky-400' : 'text-slate-100 group-hover:text-sky-300'}
                                            `}>
                                                {title}
                                            </h3>
                                            <p className={`
                                                text-xs font-medium truncate transition-colors
                                                ${isSelected ? 'text-sky-500/80' : 'text-slate-400 group-hover:text-sky-400/70'}
                                            `}>
                                                {subtitle}
                                            </p>
                                        </div>

                                        {/* Arrow (Visible on Hover/Active) */}
                                        <div className={`
                                            flex-shrink-0 self-center transition-all duration-300 transform
                                            ${isSelected 
                                                ? 'opacity-100 translate-x-0 text-sky-500' 
                                                : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 text-sky-500'
                                            }
                                        `}>
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                            <SearchIcon className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-slate-400 font-medium">Không tìm thấy kết quả nào</p>
                        <p className="text-slate-600 text-sm mt-2">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                        {onRetry && (
                            <button 
                                onClick={onRetry}
                                className="mt-6 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-sky-900/20"
                            >
                                Tải lại dữ liệu
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Footer / Copyright */}
            <div className="p-4 border-t border-slate-800 text-center">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
                    Historical Map Vietnam © 2025
                </p>
            </div>
        </aside>
    </>
  );
};
