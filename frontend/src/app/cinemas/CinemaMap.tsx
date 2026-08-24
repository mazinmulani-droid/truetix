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
      // Add up to 3 closest cinemas to bounds
      cinemas.slice(0, 3).forEach(c => {
        if (c.lat && c.lng) bounds.extend([c.lat, c.lng]);
      });
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
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
