import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Locate } from 'lucide-react';
import { STATUS_COLORS_HEX } from '../lib/constants.js';
import { parseLocation } from '../lib/utils.js';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [28.6139, 77.2090]; // Delhi [lat, lng]
const DEFAULT_ZOOM = 13;

const CATEGORY_EMOJI = {
  pothole:      '🕳️',
  streetlight:  '💡',
  water_leak:   '💧',
  waste:        '🗑️',
  other:        '📍',
};

/**
 * Helper component: programmatically pan/zoom the map when userLocation changes.
 * react-leaflet requires this pattern since the map instance lives outside React state.
 */
function FlyToLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.flyTo(location, 17, { duration: 1 });
  }, [location, map]);
  return null;
}

/**
 * Helper component: fire onCenterChange when the user pans the map.
 */
function CenterTracker({ onCenterChange }) {
  const map = useMap();
  useEffect(() => {
    if (!onCenterChange) return;
    const handler = () => {
      const c = map.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
    };
    map.on('moveend', handler);
    return () => map.off('moveend', handler);
  }, [map, onCenterChange]);
  return null;
}

export function Map({ issues = [], onIssueClick, onCenterChange }) {
  const [userLocation, setUserLocation] = useState(null);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn('Geolocation denied:', err.message)
    );
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        {/* Humanitarian OpenStreetMap (HOT) tiles — 100% free, no API key, no watermarks, hosted by OSM France */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a>'
          maxZoom={19}
        />

        <FlyToLocation location={userLocation} />
        <CenterTracker onCenterChange={onCenterChange} />

        {/* Issue markers */}
        {issues.map((issue) => {
          // Handle PostGIS location (EWKB/WKT) OR legacy { lat, lng } object
          const loc = parseLocation(issue.location) || (issue.lat && issue.lng ? { lat: issue.lat, lng: issue.lng } : null);
          if (!loc) return null;
          const { lat, lng } = loc;

          const color = STATUS_COLORS_HEX[issue.status] ?? STATUS_COLORS_HEX.open;
          const radius = (issue.upvotes ?? 0) >= 5 ? 12 : 9;

          return (
            <CircleMarker
              key={issue.id}
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                fillOpacity: 1,
                color: '#FFFFFF',
                weight: 2,
              }}
            >
              <Popup>
                <div
                  style={{
                    minWidth: '180px',
                    maxWidth: '240px',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-ink)',
                  }}
                >
                  {/* Issue header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{CATEGORY_EMOJI[issue.category] ?? '📍'}</span>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', lineHeight: '1.3', margin: 0 }}>
                        {issue.title}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--color-fog)', marginTop: '2px', textTransform: 'capitalize' }}>
                        {issue.category?.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Status + upvotes */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      style={{
                        backgroundColor: STATUS_COLORS_HEX[issue.status] ?? 'var(--color-fog)',
                        color: issue.status === 'in_progress' ? 'var(--color-ink)' : '#ffffff',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {issue.status?.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-fog)' }}>
                      👍 {issue.upvotes ?? 0}
                    </span>
                  </div>

                  {/* Case ID */}
                  <div className="case-id-chip" style={{ marginBottom: onIssueClick ? '8px' : '0' }}>
                    CP-{issue.id?.slice(0, 6).toUpperCase()}
                  </div>

                  {onIssueClick && (
                    <button
                      onClick={() => onIssueClick(issue)}
                      className="btn-secondary"
                      style={{ width: '100%', fontSize: '12px', padding: '6px 12px', marginTop: '4px' }}
                    >
                      View details →
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* User "You are here" blue dot */}
        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={10}
            pathOptions={{ fillColor: '#3b82f6', fillOpacity: 1, color: '#ffffff', weight: 3 }}
          />
        )}
      </MapContainer>

      {/* My Location button */}
      <button
        id="btn-use-my-location"
        onClick={handleUseMyLocation}
        className="absolute bottom-4 right-4 flex items-center gap-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-offset-2"
        style={{
          backgroundColor: 'var(--color-stone-white)',
          color: 'var(--color-plum)',
          border: '1px solid var(--color-stone-line)',
          borderRadius: 'var(--radius-control)',
          boxShadow: 'var(--shadow-card)',
          padding: '10px 16px',
          fontSize: '13px',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          cursor: 'pointer',
          zIndex: 1000,        // Must be above Leaflet's own controls
          position: 'absolute',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-plum)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-stone-line)'; }}
      >
        <Locate size={14} />
        My Location
      </button>
    </div>
  );
}
