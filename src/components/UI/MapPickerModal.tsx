import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, Search, Map as MapIcon, Navigation, Check, Loader2, Globe } from 'lucide-react';

// Fix for Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { address: string, lat: number, lng: number, staticMapUrl: string }) => void;
  initialAddress?: string;
}

// Component to handle map center updates
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Component to handle map clicks
function MapEvents({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({ isOpen, onClose, onConfirm, initialAddress }) => {
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<[number, number]>([39.9334, 32.8597]); // Ankara default
  const [zoom, setZoom] = useState(13);
  const [mapType, setMapType] = useState<'sat' | 'street'>('sat');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (initialAddress && isOpen) {
      handleSearch(initialAddress);
    }
  }, [isOpen]);

  const handleSearch = async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: { 'User-Agent': 'ForensicCanvasApp/1.0' }
      });
      const data = await response.json();
      setSearchResults(data);
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setSelectedLocation(newPos);
        setResolvedAddress(display_name);
        setZoom(18);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (result: any) => {
    const newPos: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
    setSelectedLocation(newPos);
    setResolvedAddress(result.display_name);
    setSearchQuery(result.display_name);
    setSearchResults([]);
    setZoom(18);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setSelectedLocation([lat, lng]);
    // Reverse geocode
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'User-Agent': 'ForensicCanvasApp/1.0' }
      });
      const data = await response.json();
      if (data.display_name) {
        setResolvedAddress(data.display_name);
        setSearchQuery(data.display_name);
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }
  };

  const handleConfirm = () => {
    setIsConfirming(true);
    // Generate static map URL (using Yandex as it has good satellite imagery for Turkey)
    const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${selectedLocation[1]},${selectedLocation[0]}&z=18&l=sat&size=650,450`;
    
    // Pre-load image to ensure it works
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      onConfirm({
        address: resolvedAddress || searchQuery,
        lat: selectedLocation[0],
        lng: selectedLocation[1],
        staticMapUrl
      });
      setIsConfirming(false);
      onClose();
    };
    img.onerror = () => {
      // Fallback or error notification could be here
      onConfirm({
        address: resolvedAddress || searchQuery,
        lat: selectedLocation[0],
        lng: selectedLocation[1],
        staticMapUrl
      });
      setIsConfirming(false);
      onClose();
    };
    img.src = staticMapUrl;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#1a1a1a] border border-[#F5C518]/30 w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F5C518]/10 rounded-2xl flex items-center justify-center text-[#F5C518] shadow-lg shadow-[#F5C518]/5">
              <Globe size={28} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest">AKILLI KONUM VE UYDU SİSTEMİ</h3>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">Olay Yeri Koordinatlarını ve Uydu Görüntüsünü Hassas Olarak Belirleyin</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Sidebar / Search Section */}
          <div className="w-full md:w-80 bg-[#151515] border-r border-[#333] p-6 flex flex-col gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#F5C518] uppercase tracking-widest ml-1">Adres veya Koordinat Ara</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Sokak, mahalle, şehir..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-2xl pl-4 pr-12 py-3 text-sm text-white focus:border-[#F5C518] outline-none transition-all placeholder:text-gray-700"
                />
                <button 
                  onClick={() => handleSearch(searchQuery)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#F5C518] text-black rounded-xl hover:scale-105 transition-transform"
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left p-3 rounded-2xl bg-[#1a1a1a] border border-[#333] hover:border-[#F5C518]/50 hover:bg-[#222] transition-all group"
                  >
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed group-hover:text-white transition-colors line-clamp-2">
                      {result.display_name}
                    </p>
                  </button>
                ))
              ) : isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                  <Loader2 size={32} className="animate-spin mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Aranıyor...</span>
                </div>
              ) : (
                <div className="text-center py-12 px-4 border-2 border-dashed border-[#222] rounded-3xl">
                  <Navigation size={24} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-[10px] text-gray-600 font-medium">Arama yaparak veya haritaya tıklayarak konum seçin.</p>
                </div>
              )}
            </div>

            {/* Map Type Switcher */}
            <div className="bg-[#0a0a0a] p-1 rounded-2xl border border-[#333] flex">
              <button 
                onClick={() => setMapType('sat')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  mapType === 'sat' ? 'bg-[#F5C518] text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Globe size={14} />
                Uydu
              </button>
              <button 
                onClick={() => setMapType('street')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  mapType === 'street' ? 'bg-[#F5C518] text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <MapIcon size={14} />
                Sokak
              </button>
            </div>
          </div>

          {/* Map Area */}
          <div className="flex-1 relative bg-[#0a0a0a]">
            <MapContainer 
              center={selectedLocation} 
              zoom={zoom} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <ChangeView center={selectedLocation} zoom={zoom} />
              <TileLayer
                url={mapType === 'sat' 
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                }
                attribution='&copy; ESRI, OpenStreetMap'
              />
              <MapEvents onLocationSelect={handleMapClick} />
              <Marker position={selectedLocation} />
            </MapContainer>

            {/* Location Badge (Overlay) */}
            <div className="absolute top-6 left-6 right-6 z-[1000] pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-xl mx-auto">
                <div className="w-10 h-10 bg-[#F5C518] text-black rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Navigation size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[9px] font-black text-[#F5C518] uppercase tracking-[0.2em] mb-0.5">Seçili Konum</h4>
                  <p className="text-[11px] text-white font-bold truncate leading-tight">
                    {resolvedAddress || 'Konum Belirlenmedi'}
                  </p>
                </div>
              </div>
            </div>

            {/* Coordinates Badge */}
            <div className="absolute bottom-6 left-6 z-[1000] pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-[10px] font-mono text-[#F5C518] flex gap-4">
                <span>LAT: {selectedLocation[0].toFixed(6)}</span>
                <div className="w-px h-3 bg-white/10" />
                <span>LNG: {selectedLocation[1].toFixed(6)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#1a1a1a] border-t border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Sistem Aktif: Uydu Verileri Güncel</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-3 text-[11px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
            >
              Vazgeç
            </button>
            <button 
              onClick={handleConfirm}
              disabled={isConfirming}
              className="px-8 py-3 bg-gradient-to-r from-[#F5C518] to-[#d4a017] text-black text-xs font-black rounded-2xl shadow-xl shadow-[#F5C518]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest disabled:opacity-50"
            >
              {isConfirming ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              KONUMU VE HARİTAYI ONAYLA
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
