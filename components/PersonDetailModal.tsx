
import React from 'react';
import { Person, Site } from '../types';
import { PersonDetailContent } from './PersonDetailContent';
import { XIcon } from './Icons';

interface PersonDetailModalProps {
  person: Person;
  onClose: () => void;
  onSiteSelect: (site: Site) => void;
  sites: Site[];
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose, onSiteSelect, sites }) => {
  
  const findSiteById = (id: string | number): Site | undefined => {
      return sites.find(s => String(s.site_id) === String(id));
  }

  return (
    <div 
      className="fixed inset-0 z-[2000] flex md:items-center md:justify-center pointer-events-none"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 md:bg-black/60 pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div 
        className="
            absolute bottom-0 left-0 w-full bg-slate-800 border-t border-slate-600 shadow-2xl
            pointer-events-auto animate-slide-up
            rounded-t-2xl overflow-hidden
            flex flex-col
            h-[85vh] md:h-auto md:max-h-[85vh] md:max-w-3xl md:relative md:rounded-xl md:border md:shadow-xl
        "
      >
        {/* Mobile Drag Handle */}
        <div className="md:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={onClose}>
             <div className="w-12 h-1.5 bg-slate-600 rounded-full"></div>
        </div>

        <header className="px-4 py-3 md:p-5 border-b border-slate-700 flex justify-between items-center flex-shrink-0 bg-slate-800 sticky top-0 z-10">
          <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-100">{person.full_name}</h2>
              <p className="text-xs md:text-sm text-slate-400 font-mono">
                  {person.birth_year ? `${person.birth_year}` : '?'} - {person.death_year ? `${person.death_year}` : '?'}
              </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="Đóng"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-900/50">
          <PersonDetailContent 
            personId={person.person_id} 
            onSiteSelect={(siteId) => {
                const site = findSiteById(siteId);
                if (site) {
                    onSiteSelect(site);
                }
            }}
          />
        </div>
      </div>
    </div>
  );
};
