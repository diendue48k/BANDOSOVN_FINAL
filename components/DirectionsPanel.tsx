
import React, { useState, useEffect, useRef } from 'react';
import { RouteData, AddressSearchResult } from '../types';
import { XIcon, LocationMarkerIcon, UserLocationIcon, SwapIcon, ArrowLeftIcon, TurnLeftIcon, TurnRightIcon, ArrowUpIcon, GlobeAltIcon } from './Icons';
import { searchAddress } from '../services/apiService';
import { useDebounce } from '../hooks/useDebounce';

interface LocationInputProps {
    value: string;
    onChange: (val: string) => void;
    onSelect: (result: AddressSearchResult) => void;
    placeholder: string;
    isUserLocationAllowed?: boolean;
    onSelectUserLocation?: () => void;
    autoFocus?: boolean;
    className?: string;
    icon?: React.ReactNode;
    onPickFromMap?: () => void;
    isPicking?: boolean;
}

const LocationInput: React.FC<LocationInputProps> = ({ 
    value, onChange, onSelect, placeholder, 
    isUserLocationAllowed, onSelectUserLocation, autoFocus, className, icon,
    onPickFromMap, isPicking
}) => {
    const [results, setResults] = useState<AddressSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const debouncedQuery = useDebounce(value, 300);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isFocused || debouncedQuery.length < 3) {
            setResults([]);
            return;
        }

        const fetchAddresses = async () => {
            setIsLoading(true);
            try {
                const data = await searchAddress(debouncedQuery);
                setResults(data);
            } catch (err) {
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAddresses();
    }, [debouncedQuery, isFocused]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (result: AddressSearchResult) => {
        onSelect(result);
        setIsFocused(false);
    };

    return (
        <div className={`relative w-full group ${isFocused ? 'z-50' : 'z-0'}`} ref={containerRef}>
             <div className={`
                relative flex items-center bg-slate-800/50 rounded-lg border focus-within:bg-slate-800 transition-all duration-200
                ${isPicking 
                    ? 'border-sky-500/70 ring-1 ring-sky-500/30 bg-slate-800' 
                    : 'border-slate-700/50 focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/30'
                }
                ${className}
            `}>
                <div className="pl-3 pr-2 flex-shrink-0 flex items-center justify-center opacity-70">
                    {icon}
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="w-full bg-transparent border-none py-3 px-1 text-slate-100 placeholder-slate-500 focus:ring-0 text-sm font-medium leading-relaxed"
                />
                
                {/* Actions */}
                <div className="flex items-center pr-2 gap-1">
                    {/* Pick Map Button */}
                    {onPickFromMap && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPickFromMap();
                            }}
                            className={`p-1.5 rounded-full transition-all duration-200 focus:outline-none flex items-center justify-center
                                ${isPicking 
                                    ? 'text-sky-400 bg-sky-900/40 ring-1 ring-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.3)] animate-pulse' 
                                    : 'text-slate-500 hover:text-sky-400 hover:bg-slate-700'
                                }
                            `}
                            title="Chọn địa điểm trên bản đồ"
                        >
                             <GlobeAltIcon className="h-4 w-4" />
                        </button>
                    )}

                    {/* Clear Text Button */}
                    {value ? (
                        <button 
                            type="button"
                            onClick={() => onChange('')}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-full transition-colors focus:outline-none"
                            title="Xóa nội dung"
                        >
                            <XIcon className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Picking Indicator Text - Now Relative to push content down */}
            {isPicking && (
                <div className="mt-1.5 ml-9 text-xs text-sky-400 font-medium animate-pulse flex items-center">
                    <div className="w-1.5 h-1.5 bg-sky-400 rounded-full mr-1.5"></div>
                    Đang chọn trên bản đồ...
                </div>
            )}

            {isFocused && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto ring-1 ring-black/20 custom-scrollbar">
                    {isUserLocationAllowed && onSelectUserLocation && value.length < 3 && (
                        <button
                            onClick={() => {
                                onSelectUserLocation();
                                setIsFocused(false);
                            }}
                            className="w-full text-left flex items-center px-4 py-3 hover:bg-slate-700/50 text-sky-400 transition-colors border-b border-slate-700/50"
                        >
                            <UserLocationIcon className="h-4 w-4 mr-3" />
                            <span className="font-semibold text-sm">Vị trí của bạn</span>
                        </button>
                    )}
                    
                    {isLoading && <div className="p-3 text-sm text-slate-400 text-center italic">Đang tìm kiếm...</div>}
                    
                    {!isLoading && results.length === 0 && debouncedQuery.length >= 3 && (
                        <div className="p-3 text-sm text-slate-400 text-center italic">Không tìm thấy kết quả.</div>
                    )}

                    {results.map((result, idx) => (
                        <button
                            key={`${result.name}-${idx}`}
                            onClick={() => handleSelect(result)}
                            className="w-full text-left flex items-center px-4 py-2.5 hover:bg-slate-700/50 transition-colors group"
                        >
                            <LocationMarkerIcon className="h-4 w-4 text-slate-500 group-hover:text-slate-400 mr-3 flex-shrink-0" />
                            <div className="min-w-0">
                                <div className="font-medium text-slate-200 text-sm truncate">{result.name}</div>
                                <div className="text-xs text-slate-500 truncate">{result.address}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const getManeuverIcon = (instruction: string) => {
    const lower = instruction.toLowerCase();
    const iconClass = "w-6 h-6 text-slate-400 group-hover:text-sky-400 transition-colors";
    
    if (lower.includes('trái')) return <TurnLeftIcon className={iconClass} />;
    if (lower.includes('phải')) return <TurnRightIcon className={iconClass} />;
    if (lower.includes('đích') || lower.includes('đến')) return <LocationMarkerIcon className="w-6 h-6 text-red-500" />;
    if (lower.includes('khởi hành')) return <div className="w-4 h-4 rounded-full bg-slate-400 ring-4 ring-slate-800" />;
    if (lower.includes('vòng xuyến')) return <div className="w-5 h-5 rounded-full border-2 border-slate-400 border-dashed" />;
    
    return <ArrowUpIcon className={iconClass} />;
};

interface LocationPoint {
    name: string;
    coords: [number, number] | null;
}

interface DirectionsPanelProps {
    routeData: RouteData | null;
    onFindRoute: (startCoords: [number, number], startName: string, endCoords: [number, number], endName: string) => void;
    onCancel: () => void;
    userLocation: [number, number] | null;
    startPoint: LocationPoint;
    endPoint: LocationPoint;
    onStartPointChange: (pt: LocationPoint) => void;
    onEndPointChange: (pt: LocationPoint) => void;
    pickingField: 'start' | 'end' | null;
    onPickStart: () => void;
    onPickEnd: () => void;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({ 
    routeData, onFindRoute, onCancel, userLocation,
    startPoint, endPoint, onStartPointChange, onEndPointChange,
    pickingField, onPickStart, onPickEnd
}) => {
    
    // Auto-search when both points are set
    useEffect(() => {
        if (startPoint.coords && endPoint.coords && startPoint.name && endPoint.name) {
            onFindRoute(startPoint.coords, startPoint.name, endPoint.coords, endPoint.name);
        }
    }, [startPoint.coords, endPoint.coords]);

    const handleSwap = () => {
        const temp = startPoint;
        onStartPointChange(endPoint);
        onEndPointChange(temp);
    };

    return (
        <div className="absolute top-0 left-0 h-full w-full md:w-[400px] z-[1000] flex flex-col bg-slate-900 shadow-2xl border-r border-slate-800">
            
            {/* Header */}
            <div className="bg-slate-900 z-30 px-4 py-3 flex items-center gap-3 shrink-0 border-b border-slate-800">
                <button 
                    onClick={onCancel} 
                    className="p-2 -ml-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
                    title="Đóng"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-100">Chỉ đường</h2>
                </div>
            </div>

            {/* Inputs Area */}
            <div className="p-4 bg-slate-900 z-20 shrink-0 border-b border-slate-800 shadow-sm relative">
                <div className="flex gap-3 relative items-start">
                    <div className="flex flex-col items-center justify-start gap-1 pt-3 pb-2 h-full">
                         <div className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                         <div className="w-0.5 h-full bg-gradient-to-b from-slate-400 to-red-500 my-1 min-h-[40px]"></div>
                         <LocationMarkerIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                    </div>
                    {/* Inputs Stack */}
                    <div className="flex-grow flex flex-col gap-3">
                         <LocationInput
                            value={startPoint.name}
                            onChange={(val) => onStartPointChange({ ...startPoint, name: val, coords: val ? startPoint.coords : null })}
                            onSelect={(res) => onStartPointChange({ name: res.name, coords: res.coordinates })}
                            placeholder="Chọn điểm đi"
                            isUserLocationAllowed={!!userLocation}
                            onSelectUserLocation={() => onStartPointChange({ name: 'Vị trí của bạn', coords: userLocation })}
                            onPickFromMap={onPickStart}
                            isPicking={pickingField === 'start'}
                        />
                        <LocationInput
                            value={endPoint.name}
                            onChange={(val) => onEndPointChange({ ...endPoint, name: val, coords: val ? endPoint.coords : null })}
                            onSelect={(res) => onEndPointChange({ name: res.name, coords: res.coordinates })}
                            placeholder="Chọn điểm đến"
                            onPickFromMap={onPickEnd}
                            isPicking={pickingField === 'end'}
                        />
                    </div>

                     {/* Swap Button */}
                     <div className="flex-shrink-0 self-center pl-1 pt-1">
                        <button 
                            onClick={handleSwap}
                            className="p-2 bg-slate-800 text-slate-400 hover:text-sky-400 hover:bg-slate-700 rounded-full transition-all focus:outline-none active:rotate-180 duration-300 border border-slate-700"
                            title="Đổi chiều"
                        >
                            <SwapIcon className="h-5 w-5 rotate-90" />
                        </button>
                     </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-slate-900">
                {!routeData ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4 p-6">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2 border border-slate-700/50">
                            <LocationMarkerIcon className="h-8 w-8 text-slate-600" />
                        </div>
                        <p className="text-center text-slate-400 text-sm max-w-[200px]">
                            Chọn điểm trên bản đồ hoặc nhập địa chỉ để bắt đầu.
                        </p>
                    </div>
                ) : (
                    <div className="pb-20">
                        {/* Summary Card */}
                        <div className="bg-slate-800/50 p-5 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-3xl font-bold text-sky-400 tracking-tight">
                                    {routeData.summary.totalDuration}
                                </span>
                                <span className="text-lg text-slate-400 font-medium">
                                    ({routeData.summary.totalDistance})
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">Tuyến đường nhanh nhất hiện tại</p>
                        </div>

                        {/* Steps List */}
                        <div className="px-4 py-4 space-y-6">
                            {routeData.steps.map((step, index) => (
                                <div key={index} className="flex gap-4 group">
                                    <div className="mt-0.5 flex-shrink-0">
                                        {getManeuverIcon(step.instruction)}
                                    </div>
                                    <div className="flex-1 pb-4 border-b border-slate-800 group-last:border-0">
                                        <p className="text-sm text-slate-200 leading-snug" dangerouslySetInnerHTML={{ __html: step.instruction }}></p>
                                        {step.distance && (
                                            <p className="text-xs text-slate-500 font-mono mt-1">{step.distance}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                             <div className="flex gap-4 pt-2">
                                <LocationMarkerIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
                                <div>
                                    <p className="text-sm text-slate-200 font-semibold">Đến {endPoint.name}</p>
                                </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
