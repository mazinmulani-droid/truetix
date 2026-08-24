"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for leaflet markers in Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapUpdater({ center, cinemas, userLoc }: { center: [number, number], cinemas: any[], userLoc: any }) {
  const map = useMap();
  useEffect(() => {
    if (userLoc && cinemas.length > 0) {
      const bounds = L.latLngBounds([[userLoc.lat, userLoc.lng]]);
      
      // Only include cinemas that are actually nearby (within 100km) in the auto-zoom bounds
      let addedToBounds = false;
      cinemas.forEach(c => {
        if (c.lat && c.lng && c.distance !== undefined && c.distance < 100) {
          bounds.extend([c.lat, c.lng]);
          addedToBounds = true;
        }
      });
      
      // If we found local cinemas, fit bounds. Otherwise, just center on user with zoom 13
      if (addedToBounds) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } else {
        map.setView([userLoc.lat, userLoc.lng], 13);
      }
    } else {
      map.setView(center, 11);
    }
  }, [center, cinemas, userLoc, map]);
  return null;
}

export default function CinemaMap({ 
  mapCenter, 
  userLoc, 
  cinemas 
}: { 
  mapCenter: [number, number], 
  userLoc: {lat: number, lng: number} | null, 
  cinemas: any[] 
}) {
  return (
    <div className="w-full h-[400px] mb-12 rounded-2xl overflow-hidden border-2 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.15)] relative z-0">
      <MapContainer center={mapCenter} zoom={11} scrollWheelZoom={false} className="w-full h-full z-0">
        {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
          <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
            url={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        <MapUpdater center={mapCenter} cinemas={cinemas} userLoc={userLoc} />
        
        {userLoc && (
          <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon}>
            <Popup className="text-black font-bold">You are here</Popup>
          </Marker>
        )}

        {cinemas.map((c) => c.lat && c.lng && (
          <Marker key={c.id} position={[c.lat, c.lng]} icon={icon}>
            <Popup className="text-black">
              <strong>{c.name}</strong><br/>
              {c.distance && <span>{c.distance.toFixed(1)} km away</span>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
