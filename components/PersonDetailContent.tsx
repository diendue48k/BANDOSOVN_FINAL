
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchPersonDetail } from '../services/apiService';
import { PersonDetail, Event, Media } from '../types';
import { CalendarIcon, LocationMarkerIcon, CameraIcon, VideoCameraIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, UsersIcon, BuildingLibraryIcon, FlagIcon, InformationCircleIcon, LightBulbIcon } from './Icons';

const detailCache = new Map<string | number, PersonDetail>();

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

// --- Helper to extract events from biography text ---
const extractEventsFromBio = (biography?: string): Event[] => {
    if (!biography) return [];
    
    const events: Event[] = [];
    // Split by sentences (simple heuristic: split by period followed by space or newline)
    // We allow standard sentence endings (.!?) or newlines
    const sentences = biography.split(/(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s+|\n+/);

    sentences.forEach((sentence, index) => {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length < 10) return; // Skip too short

        // Regex to find years: matches "năm 1xxx" or "năm 2xxx"
        // Also captures things like "Năm 1527,"
        const yearMatch = cleanSentence.match(/(?:năm|Năm)\s+(\d{4})/);
        
        if (yearMatch) {
            const year = yearMatch[1];
            
            // Check if this looks like an event description
            // Simple logic: If it contains a year, treat it as a potential event
            
            events.push({
                event_id: `extracted-bio-${index}-${year}`,
                event_name: `Sự kiện năm ${year}`, // Generic title
                start_date: year,
                description: cleanSentence,
                // Custom property injected for UI logic, not part of strict interface but valid in JS runtime
                // We'll cast to any when rendering to access this
                is_extracted: true 
            } as any);
        }
    });

    return events;
};

const SkeletonLoader: React.FC = () => (
    <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column Skeleton */}
        <div className="space-y-4">
            <div className="h-40 w-40 bg-slate-700 rounded-full mx-auto"></div>
            <div className="h-6 bg-slate-700 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2 mx-auto"></div>
        </div>
        {/* Right Column Skeleton */}
        <div className="md:col-span-2 space-y-8">
            {/* Biography Skeleton */}
            <div className="space-y-2">
                 <div className="h-4 bg-slate-700 rounded w-full"></div>
                 <div className="h-4 bg-slate-700 rounded w-5/6"></div>
            </div>
            {/* Timeline Skeleton */}
            <div>
                <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="h-20 bg-slate-700 rounded"></div>
            </div>
            {/* Gallery Skeleton */}
            <div>
                <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="h-40 bg-slate-700 rounded-lg"></div>
            </div>
             {/* Video Gallery Skeleton */}
            <div>
                <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="h-40 bg-slate-700 rounded-lg"></div>
            </div>
        </div>
    </div>
);


const TimelineEventItem: React.FC<{ event: Event, isLast: boolean, onSiteSelect: (siteId: string | number) => void }> = ({ event, isLast, onSiteSelect }) => {
    const hasRelatedSite = event.related_site_id && event.related_site_name;
    // @ts-ignore - access injected property
    const isExtracted = event.is_extracted; 
    
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
                        Trích từ tiểu sử
                    </span>
                )}
            </div>
            
            {(event.start_date) && (
                <p className="text-xs text-slate-400 mb-2 font-mono">{event.start_date}</p>
            )}
            
            <p className="text-sm text-slate-300 leading-relaxed mb-3 text-justify">{event.description}</p>

            {hasRelatedSite && (
                <button
                    onClick={() => onSiteSelect(event.related_site_id!)} 
                    className="flex items-center text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors group bg-sky-500/10 hover:bg-sky-500/20 px-3 py-1.5 rounded-full"
                >
                    <LocationMarkerIcon className="h-4 w-4 mr-2" />
                    Xem địa điểm: {event.related_site_name}
                </button>
            )}
        </li>
    );
};


interface PersonDetailContentProps {
  personId: string | number;
  onSiteSelect: (siteId: string | number) => void;
}

export const PersonDetailContent: React.FC<PersonDetailContentProps> = ({ personId, onSiteSelect }) => {
  const [detail, setDetail] = useState<PersonDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const imageThumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [showImageThumbNav, setShowImageThumbNav] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      if (detailCache.has(personId)) {
        setDetail(detailCache.get(personId)!);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        setSelectedImageIndex(0);
        setSelectedVideoIndex(0);
        const data = await fetchPersonDetail(personId);
        if (data) {
          detailCache.set(personId, data);
          setDetail(data);
        } else {
          setError('Không tìm thấy thông tin chi tiết cho nhân vật này.');
        }
      } catch (err) {
        setError('Đã xảy ra lỗi khi tải dữ liệu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [personId]);

  const allMedia = useMemo(() => {
    if (!detail) return [];
    const eventMedia = detail.events.flatMap(event => event.media || []);
    return [...detail.media, ...eventMedia];
  }, [detail]);

  const images = useMemo(() => allMedia.filter(m => m.media_type === 'image'), [allMedia]);
  const videos = useMemo(() => allMedia.filter(m => m.media_type === 'video'), [allMedia]);

  const profileImage = useMemo(() => {
    if (!images || images.length === 0) return null;
    const portrait = images.find(img => img.caption.includes('Chân dung') || img.caption.includes('Tượng đài'));
    return portrait?.media_url || images[0]?.media_url;
  }, [images]);

  // Combined Events: API Events + Extracted from Bio
  const sortedEvents = useMemo(() => {
    if (!detail) return [];
    
    // 1. Get real API events
    const apiEvents = detail.events || [];
    
    // 2. Extract fuzzy events from biography
    const bioEvents = extractEventsFromBio(detail.biography);
    
    // 3. Merge
    // Use a simple deduplication strategy: if an API event has the same year, prefer API
    const mergedEvents = [...apiEvents];
    
    bioEvents.forEach(bioEvt => {
       const bioYear = extractYear(bioEvt.start_date);
       // Only add if we don't have a specific API event for this exact year (optional heuristic)
       // For now, let's include them all to be safe, as bio often contains context not in DB
       // unless it's an exact duplicate description
       const isDuplicate = apiEvents.some(apiEvt => 
           extractYear(apiEvt.start_date) === bioYear && 
           apiEvt.description.includes(bioEvt.description.substring(0, 20))
       );
       
       if (!isDuplicate) {
           mergedEvents.push(bioEvt);
       }
    });

    return mergedEvents.sort((a, b) => {
      const yearA = extractYear(a.start_date);
      const yearB = extractYear(b.start_date);
      return yearA - yearB;
    });
  }, [detail]);
  
  // Scroll selected image thumbnail into view
  useEffect(() => {
    if (selectedImageIndex > 0 && images.length > 0 && imageThumbnailRefs.current[selectedImageIndex]) {
        imageThumbnailRefs.current[selectedImageIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }
  }, [selectedImageIndex, images.length]);
  
  // Check if thumbnail navigation is needed
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

  const handleNextImage = () => {
      if (images.length > 0) {
        setSelectedImageIndex(prev => (prev + 1) % images.length);
      }
  };
  const handlePrevImage = () => {
    if (images.length > 0) {
        setSelectedImageIndex(prev => (prev - 1 + images.length) % images.length);
    }
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

  const getIconForKey = (key: string) => {
    switch (key) {
        case 'Quê quán':
            return LocationMarkerIcon;
        case 'Trình độ học vấn':
            return BuildingLibraryIcon;
        case 'Lý luận chính trị':
            return FlagIcon;
        case 'Nghề nghiệp, chức vụ':
            return InformationCircleIcon;
        default:
            return InformationCircleIcon;
    }
  };

  if (isLoading) return <SkeletonLoader />;
  if (error) return <p className="text-red-400 italic p-3">{error}</p>;
  if (!detail) return <p className="text-slate-400 p-3">Không có dữ liệu.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
        {/* Sidebar Column */}
        <div className="flex flex-col items-center text-center mb-8 md:mb-0">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-slate-700 mb-4 ring-4 ring-slate-600 shadow-lg flex items-center justify-center">
                {profileImage ? (
                    <img 
                        src={profileImage}
                        alt={`Chân dung ${detail.full_name}`}
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <UsersIcon className="h-20 w-20 text-slate-500" />
                )}
            </div>
            <h3 className="text-xl font-bold text-slate-100">{detail.full_name}</h3>
            <p className="text-slate-400 font-mono">({detail.birth_year} - {detail.death_year})</p>

            {detail.additional_info && (
                <div className="mt-6 pt-6 border-t border-slate-700 text-left w-full space-y-4">
                    {Object.entries(detail.additional_info).map(([key, value]) => {
                        const Icon = getIconForKey(key);
                        return (
                            <div key={key} className="flex items-start gap-x-3">
                                <Icon className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong className="font-semibold text-slate-200 block text-sm">{key}</strong>
                                    <span className="text-slate-300 text-sm">{value}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Main Content Column */}
        <div className="md:col-span-2 space-y-8">
            <p className="text-slate-300 mb-6 text-base leading-relaxed text-justify">{detail.biography || 'Đang cập nhật tiểu sử.'}</p>

            <section>
                <h3 className="text-xl font-bold text-sky-400 mb-4 flex items-center">
                    <CalendarIcon className="h-6 w-6 mr-3" />
                    Dòng thời gian Sự kiện
                </h3>
                <ul className="space-y-8 border-l-2 border-slate-600">
                    {sortedEvents.length > 0 ? sortedEvents.map((event, index) => (
                       <TimelineEventItem 
                            key={event.event_id}
                            event={event}
                            isLast={index === sortedEvents.length - 1}
                            onSiteSelect={onSiteSelect}
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
    </div>
  );
};
