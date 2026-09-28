import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { MapPin, Info, Navigation, Search, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [28.6139, 77.2090]; // Delhi [lat, lng] fallback

// Fix Leaflet's broken default icon paths in Vite/bundler environments
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Nominatim reverse geocode — resolves [lat, lng] to a human-readable address string.
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'CivicPulse/2.0 (hackathon)' } }
    );
    const data = await res.json();
    return data.display_name || '';
  } catch { return ''; }
}

/** Clicking the map moves the marker; the marker itself is also draggable. */
function DraggableMarker({ position, onPositionChange }) {
  useMapEvents({
    click(e) { onPositionChange([e.latlng.lat, e.latlng.lng]); },
  });

  return (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const ll = e.target.getLatLng();
          onPositionChange([ll.lat, ll.lng]);
        },
      }}
    />
  );
}

/** Imperatively pans the Leaflet map when location changes (e.g. via search or Locate Me). */
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 17, { duration: 0.8 });
  }, [center, map]);
  return null;
}

// Tier badge config — shows how the pin location was resolved.
const TIER_BADGE = {
  photo:   { emoji: '📸', label: 'From photo',   color: 'var(--color-signal-green)' },
  device:  { emoji: '📍', label: 'Device GPS',   color: 'var(--color-plum)' },
  search:  { emoji: '🔍', label: 'Search result', color: 'var(--color-signal-amber)' },
  default: { emoji: '⚠️', label: 'Default area', color: 'var(--color-fog)' },
};

export default function Step2Details({ issueData, onNext, onBack }) {
  const [description, setDescription] = useState('');

  // Location state
  const [location,        setLocation]        = useState(null);       // [lat, lng]
  const [locationTier,    setLocationTier]    = useState(null);       // 'photo'|'device'|'search'|'default'
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [isLocating,      setIsLocating]      = useState(false);

  // Search state
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching,   setIsSearching]   = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const searchRef = useRef(null);

  // ── Tier resolver: EXIF GPS → Device GPS → Default ─────────────────────────
  useEffect(() => {
    // Tier 1: Photo EXIF GPS (extracted in Step1 from raw File before upload)
    if (issueData.exifLocation) {
      setLocation(issueData.exifLocation);
      setLocationTier('photo');
      reverseGeocode(...issueData.exifLocation).then(setResolvedAddress);
      return;
    }

    // Tier 2: Device GPS
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll = [pos.coords.latitude, pos.coords.longitude];
          setLocation(ll);
          setLocationTier('device');
          reverseGeocode(...ll).then(setResolvedAddress);
          setIsLocating(false);
        },
        () => {
          // Tier 4: Default center — geolocation denied or timed out
          setLocation(DEFAULT_CENTER);
          setLocationTier('default');
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      // Tier 4: Default center — API unavailable
      setLocation(DEFAULT_CENTER);
      setLocationTier('default');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nominatim debounced search (450ms, India-scoped) ───────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&countrycodes=in`,
          { headers: { 'User-Agent': 'CivicPulse/2.0 (hackathon)' } }
        );
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside the search area
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePositionChange = useCallback((latlng) => {
    setLocation(latlng);
    reverseGeocode(...latlng).then(setResolvedAddress);
    // Keep existing tier — user is fine-tuning, not changing source
  }, []);

  function handleSearchSelect(result) {
    const ll = [parseFloat(result.lat), parseFloat(result.lon)];
    setLocation(ll);
    setLocationTier('search');
    setResolvedAddress(result.display_name);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  function handleLocateMe() {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = [pos.coords.latitude, pos.coords.longitude];
        setLocation(ll);
        setLocationTier('device');
        reverseGeocode(...ll).then(setResolvedAddress);
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  const handleNext = () => {
    if (!location) return;
    onNext({ ...issueData, description, location: { lat: location[0], lng: location[1] } });
  };

  // ── Severity style ─────────────────────────────────────────────────────────
  const severityStyle = issueData.severity === 'high'
    ? { color: 'var(--color-signal-red)',   backgroundColor: 'rgba(178,59,46,0.08)' }
    : issueData.severity === 'medium'
      ? { color: 'var(--color-signal-amber)', backgroundColor: 'rgba(198,125,45,0.08)' }
      : { color: 'var(--color-fog)',          backgroundColor: 'var(--color-stone-paper)' };

  const tier = locationTier ? TIER_BADGE[locationTier] : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="card-white p-4 sm:p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Confirm Details</h2>
          <p style={{ color: 'var(--color-fog)' }}>Our AI analyzed your photo. Refine the location if needed.</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* AI Results Display */}
          <div
            className="flex items-start gap-4 p-4"
            style={{ backgroundColor: 'var(--color-stone-paper)', borderRadius: '16px', border: '1px solid var(--color-stone-line)' }}
          >
            <img
              src={issueData.imageUrl}
              alt="Issue"
              className="w-20 h-20 object-cover shrink-0"
              style={{ borderRadius: 'var(--radius-image)', border: '1px solid var(--color-stone-line)' }}
            />
            <div>
              <h3 className="font-semibold">{issueData.title || 'Reported Issue'}</h3>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span
                  className="text-xs px-2 py-1 capitalize font-medium"
                  style={{ backgroundColor: 'rgba(62,122,84,0.1)', color: 'var(--color-signal-green)', borderRadius: 'var(--radius-badge)' }}
                >
                  {issueData.category?.replace('_', ' ')}
                </span>
                <span
                  className="text-xs px-2 py-1 capitalize font-medium"
                  style={{ ...severityStyle, borderRadius: 'var(--radius-badge)' }}
                >
                  {issueData.severity} Severity
                </span>
              </div>
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description <span style={{ color: 'var(--color-fog)' }}>(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any extra details here..."
              className="w-full p-3 resize-none h-24 transition-colors outline-none"
              style={{
                backgroundColor: 'rgba(34,31,38,0.02)',
                border: '1px solid var(--color-stone-line)',
                borderRadius: '12px',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-body-sm)',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--color-plum)'}
              onBlur={e  => e.currentTarget.style.borderColor = 'var(--color-stone-line)'}
            />
          </div>

          {/* Location Picker */}
          <div>
            {/* Header row: label + tier badge + Locate Me */}
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <MapPin size={16} style={{ color: 'var(--color-plum)' }} />
                Pinpoint Location
                {tier && (
                  <span
                    className="text-xs px-2 py-0.5 font-medium ml-1"
                    style={{ color: tier.color, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 'var(--radius-badge)' }}
                  >
                    {tier.emoji} {tier.label}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocating}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 transition-all"
                style={{
                  color: 'var(--color-plum)',
                  border: '1px solid var(--color-plum)',
                  borderRadius: 'var(--radius-badge)',
                  backgroundColor: 'transparent',
                  opacity: isLocating ? 0.6 : 1,
                  cursor: isLocating ? 'not-allowed' : 'pointer',
                }}
              >
                {isLocating
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Navigation size={12} />
                }
                {isLocating ? 'Locating…' : 'Locate Me'}
              </button>
            </div>

            <p className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--color-fog)' }}>
              <Info size={12} /> Click on the map or drag the pin to fine-tune the exact spot.
            </p>

            {/* Address Search Bar */}
            <div ref={searchRef} className="relative mb-3">
              <div
                className="flex items-center gap-2 px-3"
                style={{
                  border: '1px solid var(--color-stone-line)',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(34,31,38,0.02)',
                }}
              >
                {isSearching
                  ? <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--color-fog)' }} />
                  : <Search size={15} className="shrink-0" style={{ color: 'var(--color-fog)' }} />
                }
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Search address or landmark…"
                  className="w-full py-2.5 outline-none bg-transparent text-sm"
                  style={{ color: 'var(--color-ink)' }}
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <ul
                  className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden"
                  style={{
                    border: '1px solid var(--color-stone-line)',
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    boxShadow: '0 4px 16px rgba(34,31,38,0.12)',
                  }}
                >
                  {searchResults.map((result) => (
                    <li key={result.place_id}>
                      <button
                        type="button"
                        onClick={() => handleSearchSelect(result)}
                        className="w-full text-left px-3 py-3 text-sm transition-colors"
                        style={{ color: 'var(--color-ink)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-stone-paper)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span className="font-medium block truncate">{result.display_name.split(',')[0]}</span>
                        <span className="text-xs block truncate" style={{ color: 'var(--color-fog)' }}>
                          {result.display_name.split(',').slice(1, 3).join(',')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Leaflet Map */}
            <div className="h-62.5 overflow-hidden relative" style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--color-stone-line)' }}>
              {!location ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm" style={{ backgroundColor: 'var(--color-stone-paper)', color: 'var(--color-fog)' }}>
                  <div
                    className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-plum)', borderTopColor: 'transparent' }}
                  />
                  <span>Getting your location…</span>
                </div>
              ) : (
                <MapContainer
                  center={location}
                  zoom={16}
                  style={{ width: '100%', height: '100%' }}
                  zoomControl={true}
                  attributionControl={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a>'
                    maxZoom={19}
                  />
                  <MapController center={location} />
                  <DraggableMarker position={location} onPositionChange={handlePositionChange} />
                </MapContainer>
              )}
            </div>

            {/* Resolved address label */}
            {resolvedAddress && (
              <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: 'var(--color-fog)' }}>
                <MapPin size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--color-plum)' }} />
                <span className="line-clamp-2">{resolvedAddress}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        <button onClick={onBack} className="btn-secondary flex-1">Back</button>
        <button
          onClick={handleNext}
          disabled={!location}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
