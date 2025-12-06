
import React from 'react';
import { Site, Person } from '../types';
import { SiteDetailContent } from './SiteDetailContent';
import { XIcon, DirectionsIcon } from './Icons';

interface SiteDetailPopupProps {
  site: Site;
  onClose: () => void;
  onPersonSelect: (person: Person) => void;
  onShowDirections: (site: Site) => void;
}

export const SiteDetailPopup: React.FC<SiteDetailPopupProps> = ({ site, onClose, onPersonSelect, onShowDirections }) => {
  return (
    <>
        <div 
        className="fixed z-[2000] flex flex-col shadow-2xl bg-slate-900/95 backdrop-blur-xl border-slate-700 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bottom-0 left-0 right-0 h-[65vh] rounded-t-2xl border-t border-x animate-slide-up md:top-4 md:right-4 md:bottom-4 md:left-auto md:h-auto md:w-[400px] md:rounded-2xl md:border"
        >
        {/* Header */}
        <header className="px-5 py-4 border-b border-slate-800 flex justify-between items-start flex-shrink-0 bg-slate-900/50 rounded-t-2xl">
            <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-xl font-bold text-sky-400 leading-tight mb-1">{site.site_name}</h2>
            <p className="text-xs text-slate-500 font-mono truncate">{site.site_type}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                    onClick={() => onShowDirections(site)}
                    className="p-2 bg-slate-800 hover:bg-sky-600 text-sky-400 hover:text-white rounded-full transition-colors border border-slate-700"
                    title="Chỉ đường tới đây"
                >
                    <DirectionsIcon className="h-5 w-5" />
                </button>
                <button 
                    onClick={onClose}
                    className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-colors border border-slate-700"
                    aria-label="Đóng"
                >
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
        </header>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-5">
            <SiteDetailContent 
                siteId={site.site_id} 
                isModal={true} 
                isCompact={true} // Force compact layout for side panel
                onPersonSelect={onPersonSelect} 
            />
        </div>
        </div>
    </>
  );
};
