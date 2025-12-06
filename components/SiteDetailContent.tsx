
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchSiteDetail } from '../services/apiService';
import { SiteDetail, Event, Media, Person } from '../types';
import { CalendarIcon, UserGroupIcon, CameraIcon, ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, PauseIcon, VideoCameraIcon, LocationMarkerIcon, TagIcon, BuildingLibraryIcon, CheckCircleIcon, InformationCircleIcon, DirectionsIcon, LightBulbIcon } from './Icons';

// --- Reusable Cache for Fetched Details ---
const detailCache = new Map<string | number, SiteDetail>();

// --- YouTube URL Helper ---
const getYouTubeEmbedUrl = (url?: string): string | null => {
    if (!url) return null;
    let videoId: string | null = null;
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
        videoId = match[1];
    }

    if (videoId) {
        const params = new URLSearchParams({
            autoplay: '0',
            rel: '0',
            modestbranding: '1',
            iv_load_policy: '3'
        });
        return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }
    return null;
};

// --- Helper for fuzzy date sorting ---
const extractYear = (dateStr?: string | number): number => {
    if (!dateStr) return -Infinity; 
    const str = String(dateStr);
    const match = str.match(/\d{4}/);
    if (match) {
        return parseInt(match[0], 10);
    }
    return -Infinity;
};

// --- Helper to extract events from description text ---
const extractEventsFromDescription = (description?: string): Event[] => {
    if (!description) return [];
    
    const events: Event[] = [];
    // Split by sentences (simple heuristic: split by period followed by space or newline)
    // We allow standard sentence endings (.!?) or newlines
    const sentences = description.split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s+|\n+/);

    sentences.forEach((sentence, index) => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length < 10) return; // Skip too short

        // Regex to find years: matches "năm 1xxx" or "năm 2xxx"
        // Also captures things like "Năm 1527,"
        const yearMatch = cleanSentence.match(/(?:năm|Năm)\s+(\d{4})/);
        
        if (yearMatch) {
            const year = yearMatch[1];
            
            events.push({
                event_id: `extracted-desc-${index}-${year}`,
                event_name: `Sự kiện năm ${year}`, // Generic title
                start_date: year,
                description: cleanSentence,
                // Custom property injected for UI logic
                is_extracted: true 
            } as any);
        }
    });

    return events;
};

// --- Helper Components ---

const SkeletonLoader: React.FC<{ isModal: boolean }> = ({ isModal }) => {
    if (isModal) {
        return (
            <div className="animate-pulse space-y-8">
                {/* Summary Skeleton */}
                <div className="space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                    <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                </div>
                {/* Info Skeleton */}
                <div className="h-10 bg-slate-700 rounded w-1/2"></div>
                {/* Timeline Skeleton */}
                <div>
                    <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
                    <div className="space-y-6">
                        <div className="h-28 bg-slate-700 rounded"></div>
                        <div className="h-28 bg-slate-700 rounded"></div>
                    </div>
                </div>
                 {/* Gallery Skeleton */}
                <div>
                    <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
                    <div className="h-40 bg-slate-700 rounded-lg"></div>
                     <div className="grid grid-cols-4 gap-2 mt-2">
                        <div className="h-16 bg-slate-700 rounded"></div>
                        <div className="h-16 bg-slate-700 rounded"></div>
                    </div>
                </div>
            </div>
        )
    }
    return (
        <div className="animate-pulse space-y-3 p-3 w-full bg-slate-800 rounded-xl">
            <div className="h-32 bg-slate-700 rounded-lg"></div>
            <div className="h-6 bg-slate-700 rounded w-3/4 mt-2"></div>
            <div className="h-4 bg-slate-700 rounded w-full"></div>
            <div className="h-4 bg-slate-700 rounded w-2/3"></div>
        </div>
    );
};

const PopupSlideshow: React.FC<{ media: Media[] }> = ({ media }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (media.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length);
        }, 3500); // Change image every 3.5 seconds

        return () => clearInterval(timer);
    }, [media.length]);

    if (media.length === 0) {
        return (
            <div className="w-full h-40 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <CameraIcon className="h-10 w-10 text-slate-500" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-40 bg-slate-900 overflow-hidden">
            {media.map((item, index) => (
                <img
                    key={item.media_id}
                    src={item.media_url}
                    alt={item.caption}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out ${index === currentIndex ? 'opacity-100 scale-105' : 'opacity-0 scale-100'}`}
                />
            ))}
            {/* Gradient Overlay for Text Visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80"></div>
            
            {media.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 z-10">
                    {media.map((_, index) => (
                        <div
                            key={`dot-${index}`}
                            className={`rounded-full transition-all duration-300 shadow-sm ${index === currentIndex ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`}
                        ></div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TimelineEventItem: React.FC<{ event: Event, isLast: boolean }> = ({ event, isLast }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);

    // @ts-ignore - access injected property
    const isExtracted = event.is_extracted;

    const hasMedia = event.media && event.media.length > 0;
    const mediaCount = event.media?.length || 0;
    const currentMedia = hasMedia ? event.media![currentImageIndex] : null;

    const handleNext = useCallback(() => {
        setCurrentImageIndex((prev) => (prev + 1) % mediaCount);
    }, [mediaCount]);

    const handlePrev = useCallback(() => {
        setCurrentImageIndex((prev) => (prev - 1 + mediaCount) % mediaCount);
    }, [mediaCount]);

    useEffect(() => {
        if (!isPlaying || mediaCount <= 1 || currentMedia?.media_type === 'video') {
            return;
        }
        const timer = setInterval(() => {
            handleNext();
        }, 5000);
        return () => clearInterval(timer);
    }, [isPlaying, mediaCount, handleNext, currentMedia]);

    useEffect(() => {
        if (currentMedia?.media_type === 'video') {
            setIsPlaying(false);
        }
    }, [currentImageIndex, currentMedia]);
    
    const handleManualNext = () => {
        handleNext();
        setIsPlaying(false);
    };

    const handleManualPrev = () => {
        handlePrev();
        setIsPlaying(false);
    };

    return (
        <li className={`relative pl-8 ${isExtracted ? 'opacity-90' : ''}`}>
            <div className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-slate-800 ${isExtracted ? 'bg-slate-500' : 'bg-sky-500'}`}></div>
            {!isLast && <div className="absolute left-0 top-1 h-full w-0.5 bg-slate-600"></div>}
            
            <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className={`font-semibold text-lg ${isExtracted ? 'text-slate-300' : 'text-slate-100'}`}>
                    {event.event_name}
                </p>
                {isExtracted && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-400 uppercase tracking-wide border border-slate-600 flex items-center gap-1">
                        <LightBulbIcon className="w-3 h-3" />
                        Trích từ mô tả
                    </span>
                )}
            </div>

            {(event.start_date) && (
                <p className="text-xs text-slate-400 mb-1 font-mono">{event.start_date}</p>
            )}

            {hasMedia && currentMedia && (
                <div 
                    className="relative my-4 group"
                    onMouseEnter={() => currentMedia.media_type === 'image' && setIsPlaying(false)}
                    onMouseLeave={() => currentMedia.media_type === 'image' && setIsPlaying(true)}
                >
                    <div className="aspect-video w-full bg-slate-700 rounded-lg overflow-hidden shadow-lg">
                       {currentMedia.media_type === 'video' ? (() => {
                            const embedUrl = getYouTubeEmbedUrl(currentMedia.media_url);
                            if (embedUrl) {
                                return (
                                    <iframe
                                        key={currentMedia.media_id}
                                        src={embedUrl}
                                        title={currentMedia.caption}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full"
                                    ></iframe>
                                );
                            }
                            return (
                                <video
                                    key={currentMedia.media_id}
                                    src={currentMedia.media_url}
                                    controls
                                    className="w-full h-full object-contain bg-black"
                                >
                                    Trình duyệt của bạn không hỗ trợ thẻ video.
                                </video>
                            );
                        })() : (
                            <img 
                                key={currentMedia.media_id}
                                src={currentMedia.media_url} 
                                alt={currentMedia.caption} 
                                className="w-full h-full object-cover animate-fade-in-image" 
                            />
                        )}
                    </div>

                    {mediaCount > 1 && (
                        <>
                            <button 
                                onClick={handleManualPrev}
                                aria-label="Previous media"
                                className="absolute top-1/2 left-2 -translate-y-1/2 p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                                <ChevronLeftIcon className="h-5 w-5" />
                            </button>
                            <button 
                                onClick={handleManualNext}
                                aria-label="Next media"
                                className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                                <ChevronRightIcon className="h-5 w-5" />
                            </button>
                            
                            {currentMedia.media_type === 'image' && (
                                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
                                        className="p-1.5 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-300 hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    >
                                        {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                                    </button>
                                </div>
                            )}

                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs font-mono rounded-md">
                                {currentImageIndex + 1} / {mediaCount}
                            </div>
                        </>
                    )}
                    <p className="text-center text-sm italic text-slate-400 mt-2">{currentMedia.caption}</p>
                </div>
            )}
            
            <p className="text-sm text-slate-300 leading-relaxed text-justify">{event.description}</p>
        </li>
    );
};


// --- Main Component ---

interface SiteDetailContentProps {
  siteId: string | number;
  isModal: boolean;
  isCompact?: boolean; 
  onShowDetailModal?: () => void;
  onPersonSelect?: (person: Person) => void;
  onShowDirections?: () => void;
}

export const SiteDetailContent: React.FC<SiteDetailContentProps> = ({ siteId, isModal, isCompact = false, onShowDetailModal, onPersonSelect, onShowDirections }) => {
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const imageThumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [showImageThumbNav, setShowImageThumbNav] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      setDetail(null);
      setSelectedImageIndex(0);
      setSelectedVideoIndex(0);

      let data: SiteDetail | null = null;
      if (detailCache.has(siteId)) {
        data = detailCache.get(siteId)!;
      } else {
        try {
          data = await fetchSiteDetail(siteId);
          if (data) {
            detailCache.set(siteId, data);
          }
        } catch (err) {
          setError('Đã xảy ra lỗi khi tải dữ liệu.');
          console.error(err);
          setIsLoading(false);
          return;
        }
      }

      if (data) {
        setDetail(data);
      } else {
        setError('Không tìm thấy thông tin chi tiết cho địa điểm này.');
      }
      
      setIsLoading(false);
    };

    loadDetails();
  }, [siteId]);

  const allEventMedia = useMemo(() => {
    if (!detail?.events) return [];
    return detail.events.flatMap(event => event.media || []);
  }, [detail?.events]);

  const images = useMemo(() => allEventMedia.filter(m => m.media_type === 'image'), [allEventMedia]);
  const videos = useMemo(() => allEventMedia.filter(m => m.media_type === 'video'), [allEventMedia]);

  const relatedPersons = useMemo(() => {
    if (!detail) return [];
    const personsMap = new Map<string | number, Person>();
    detail.events.forEach(event => {
        event.persons?.forEach(person => {
            if (!personsMap.has(person.person_id)) {
                personsMap.set(person.person_id, person);
            }
        });
    });
    return Array.from(personsMap.values());
  }, [detail]);

  useEffect(() => {
    if(isModal && imageThumbnailRefs.current[selectedImageIndex] && selectedImageIndex > 0) {
        imageThumbnailRefs.current[selectedImageIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }
  }, [selectedImageIndex, isModal]);
  
  useEffect(() => {
    const checkThumbNav = () => {
        if(thumbnailContainerRef.current) {
            const { scrollWidth, clientWidth } = thumbnailContainerRef.current;
            setShowImageThumbNav(scrollWidth > clientWidth);
        }
    };
    const timer = setTimeout(checkThumbNav, 100);
    window.addEventListener('resize', checkThumbNav);
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', checkThumbNav);
    }
  }, [images]);

  // Combined Events: API Events + Extracted from Description
  const sortedEvents = useMemo(() => {
    if (!detail) return [];
    
    // 1. Get real API events
    const apiEvents = detail.events || [];
    
    // 2. Extract fuzzy events from description
    const descEvents = extractEventsFromDescription(detail.description);
    
    // 3. Merge
    const mergedEvents = [...apiEvents];
    
    descEvents.forEach(descEvt => {
       const descYear = extractYear(descEvt.start_date);
       // Dedup: skip if API already has an event for this year
       const isDuplicate = apiEvents.some(apiEvt => 
           extractYear(apiEvt.start_date) === descYear && 
           apiEvt.description.includes(descEvt.description.substring(0, 20))
       );
       
       if (!isDuplicate) {
           mergedEvents.push(descEvt);
       }
    });

    return mergedEvents.sort((a, b) => {
      const yearA = extractYear(a.start_date);
      const yearB = extractYear(b.start_date);
      return yearA - yearB;
    });
  }, [detail]);
  
  const handleNextImage = () => {
      if (images.length > 0) setSelectedImageIndex(prev => (prev + 1) % images.length);
  };
  const handlePrevImage = () => {
    if (images.length > 0) setSelectedImageIndex(prev => (prev - 1 + images.length) % images.length);
  };
  
  const handleThumbnailScroll = (direction: 'left' | 'right') => {
      if (thumbnailContainerRef.current) {
          const scrollAmount = thumbnailContainerRef.current.clientWidth * 0.8;
          thumbnailContainerRef.current.scrollBy({
              left: direction === 'left' ? -scrollAmount : scrollAmount,
              behavior: 'smooth'
          });
      }
  };


  if (isLoading) return <SkeletonLoader isModal={isModal} />;
  if (error) return <div className="bg-slate-800 p-4 rounded-xl text-red-400 text-sm italic">{error}</div>;
  if (!detail) return <div className="bg-slate-800 p-4 rounded-xl text-slate-400 text-sm">Không có dữ liệu.</div>;
  
  // --- RENDER LOGIC ---

  // CARD VIEW (Popup)
  if (!isModal) {
    const popupDescription = detail.description || sortedEvents[0]?.description || 'Thông tin chi tiết đang được cập nhật.';
    return (
        <div className="bg-[#1e293b] rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col w-full">
            <PopupSlideshow media={images.slice(0, 5)} />
            
            <div className="px-4 py-4 flex flex-col space-y-3">
                <h3 className="font-bold text-sky-400 truncate text-lg leading-tight">{detail.site_name}</h3>
                
                <div className="min-h-[64px]">
                   <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{popupDescription}</p>
                </div>
                
                <div className="pt-2 flex gap-2">
                    {onShowDetailModal && (
                        <button
                            onClick={onShowDetailModal}
                            className="flex-1 flex items-center justify-center text-sm font-bold text-white bg-sky-500 hover:bg-sky-400 transition-all duration-200 py-2 rounded-lg shadow-lg shadow-sky-900/20 active:scale-95"
                        >
                            Xem chi tiết 
                            <ArrowRightIcon className="h-4 w-4 ml-1.5" />
                        </button>
                    )}
                    {onShowDirections && (
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowDirections();
                            }}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-sky-400 hover:text-white rounded-lg transition-colors border border-slate-600 active:scale-95"
                            title="Chỉ đường tới đây"
                         >
                            <DirectionsIcon className="h-5 w-5" />
                         </button>
                    )}
                </div>
            </div>
            
            {/* Triangular arrow (handled by CSS now, but fallback if needed) */}
        </div>
    );
  }

  // MODAL / SIDEBAR VIEW
  const gridClass = isCompact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';
  const colSpanClass = isCompact ? '' : 'sm:col-span-2';

  return (
    <div className="flex flex-col space-y-8">
        <p className={`text-slate-300 leading-relaxed text-base text-justify`}>{detail.description || 'Chưa có mô tả.'}</p>

        <section>
            <h3 className="text-lg font-bold text-sky-400 mb-3">Thông tin chi tiết</h3>
            <div className="bg-slate-700/50 p-4 rounded-lg">
                <ul className={`grid ${gridClass} gap-x-6 gap-y-4 text-sm`}>
                    {detail.address && (
                        <li className="flex items-start gap-x-3">
                            <LocationMarkerIcon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <strong className="font-semibold text-slate-200 block">Địa chỉ</strong>
                                <span className="text-slate-300">{detail.address}</span>
                            </div>
                        </li>
                    )}
                    <li className="flex items-start gap-x-3">
                        <TagIcon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <strong className="font-semibold text-slate-200 block">Loại hình</strong>
                            <span className="text-slate-300 capitalize">{detail.site_type}</span>
                        </div>
                    </li>
                    {/* ... other details ... */}
                    {detail.established_year && (
                        <li className="flex items-start gap-x-3">
                            <BuildingLibraryIcon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <strong className="font-semibold text-slate-200 block">Năm thành lập</strong>
                                <span className="text-slate-300">{detail.established_year}</span>
                            </div>
                        </li>
                    )}
                    {detail.status && (
                        <li className="flex items-start gap-x-3">
                            <CheckCircleIcon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <strong className="font-semibold text-slate-200 block">Tình trạng</strong>
                                <span className="text-slate-300">{detail.status}</span>
                            </div>
                        </li>
                    )}
                    {detail.additional_info && (
                        <li className={`${colSpanClass} flex items-start gap-x-3`}>
                            <InformationCircleIcon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <strong className="font-semibold text-slate-200 block mb-2">Thông số khác</strong>
                                <dl className={`grid ${gridClass} gap-x-4 gap-y-1 text-slate-300`}>
                                    {Object.entries(detail.additional_info).map(([key, value]) => (
                                        <React.Fragment key={key}>
                                            <dt className="font-medium text-slate-400">{key}:</dt>
                                            <dd>{value}</dd>
                                        </React.Fragment>
                                    ))}
                                </dl>
                            </div>
                        </li>
                    )}
                    {relatedPersons.length > 0 && (
                        <li className={`${colSpanClass} flex items-start gap-x-3`}>
                            <UserGroupIcon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <strong className="font-semibold text-slate-200 block mb-2">Nhân vật liên quan ({relatedPersons.length})</strong> 
                                <div className="flex flex-wrap gap-2">
                                    {relatedPersons.map(p => (
                                        <button
                                            key={p.person_id}
                                            onClick={() => onPersonSelect?.(p)}
                                            className="text-xs font-semibold text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                                        >
                                            {p.full_name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </li>
                    )}
                </ul>
            </div>
        </section>

        <section>
            <h3 className="text-xl font-bold text-sky-400 mb-4 flex items-center">
                <CalendarIcon className="h-6 w-6 mr-3" />
                Dòng thời gian
            </h3>
            <ul className="space-y-8 border-l-2 border-slate-600">
                {sortedEvents.length > 0 ? sortedEvents.map((event, index) => (
                    <TimelineEventItem 
                        key={event.event_id}
                        event={event}
                        isLast={index === sortedEvents.length - 1}
                    />
                )) : <p className="pl-8 text-sm text-slate-400 italic">Chưa có thông tin sự kiện.</p>}
            </ul>
        </section>

        <section>
            <h3 className="text-xl font-bold text-sky-400 mb-3 flex items-center">
                <CameraIcon className="h-6 w-6 mr-3" />
                Thư viện ảnh
            </h3>
            {images.length > 0 ? (
                 <div className="space-y-3">
                    <div className="relative w-full aspect-video bg-slate-900/50 rounded-lg overflow-hidden group shadow-lg">
                        <img 
                            key={images[selectedImageIndex]?.media_id}
                            src={images[selectedImageIndex]?.media_url || ''} 
                            alt={images[selectedImageIndex]?.caption || 'Selected view'} 
                            className="w-full h-full object-cover transition-opacity duration-300 ease-in-out animate-fade-in-image" 
                        />
                        {images.length > 1 && (
                            <>
                                <button onClick={handlePrevImage} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-sky-400 z-10"><ChevronLeftIcon className="h-6 w-6" /></button>
                                <button onClick={handleNextImage} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-sky-400 z-10"><ChevronRightIcon className="h-6 w-6" /></button>
                            </>
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="relative">
                            <div ref={thumbnailContainerRef} className="video-thumbnail-container flex overflow-x-auto space-x-3 py-2 px-1">
                                {images.map((item, index) => (
                                    <button 
                                        ref={el => { imageThumbnailRefs.current[index] = el; }}
                                        key={item.media_id} 
                                        onClick={() => setSelectedImageIndex(index)} 
                                        className={`relative w-28 h-20 flex-shrink-0 rounded-lg overflow-hidden transition-all duration-300 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 ${selectedImageIndex === index ? 'ring-sky-400 scale-105 shadow-lg' : 'ring-transparent hover:scale-105'}`}
                                    >
                                        <img 
                                            src={item.media_url} 
                                            alt={item.caption} 
                                            className={`w-full h-full object-cover transition-opacity ${selectedImageIndex === index ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} 
                                        />
                                    </button>
                                ))}
                            </div>
                            {showImageThumbNav && (
                                <>
                                    <button
                                        onClick={() => handleThumbnailScroll('left')}
                                        className="absolute top-1/2 -translate-y-1/2 left-1 z-10 p-1.5 bg-slate-800/60 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-full shadow-lg transition-all"
                                        aria-label="Scroll thumbnails left"
                                    >
                                        <ChevronLeftIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => handleThumbnailScroll('right')}
                                        className="absolute top-1/2 -translate-y-1/2 right-1 z-10 p-1.5 bg-slate-800/60 hover:bg-slate-800/90 backdrop-blur-sm text-white rounded-full shadow-lg transition-all"
                                        aria-label="Scroll thumbnails right"
                                    >
                                        <ChevronRightIcon className="h-5 w-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : <p className="text-sm text-slate-400 italic">Chưa có hình ảnh.</p>}
        </section>

        <section>
            <h3 className="text-xl font-bold text-sky-400 mb-3 flex items-center">
                <VideoCameraIcon className="h-6 w-6 mr-3" />
                Thư viện Video
            </h3>
            {videos.length > 0 ? (
                <div className="space-y-3">
                    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                        {(() => {
                            const video = videos[selectedVideoIndex];
                            if (!video) return null;
                            const embedUrl = getYouTubeEmbedUrl(video.media_url);

                            if (embedUrl) {
                                return (
                                    <iframe
                                        key={video.media_id}
                                        src={embedUrl}
                                        title={video.caption}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full"
                                    ></iframe>
                                );
                            }
                            
                            return (
                                <video 
                                    key={video.media_id}
                                    src={video.media_url} 
                                    controls 
                                    className="w-full h-full"
                                >
                                    Trình duyệt của bạn không hỗ trợ video.
                                </video>
                            );
                        })()}
                    </div>
                    {videos.length > 1 && (
                        <div className="video-thumbnail-container flex overflow-x-auto space-x-3 py-2 -mx-6 px-6">
                            {videos.map((video, index) => (
                                <button 
                                    key={video.media_id}
                                    onClick={() => setSelectedVideoIndex(index)}
                                    className={`relative w-40 flex-shrink-0 aspect-video rounded-lg overflow-hidden transition-all duration-300 transform focus:outline-none ${selectedVideoIndex === index ? 'ring-2 ring-sky-400 scale-105 shadow-lg' : 'ring-1 ring-transparent hover:scale-105'}`}
                                >
                                    <img 
                                        src={video.thumbnail_url || 'https://picsum.photos/200/120'}
                                        alt={video.caption} 
                                        className={`w-full h-full object-cover transition-opacity ${selectedVideoIndex === index ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`} 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                    <p className="absolute bottom-1.5 left-2 right-2 text-xs font-semibold text-white truncate">
                                        {video.caption}
                                    </p>
                                    {selectedVideoIndex === index && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                            <PlayIcon className="h-8 w-8 text-white/80" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

            ): <p className="text-sm text-slate-400 italic">Chưa có video.</p>}
        </section>
    </div>
  );
};
