import {MapContainer,TileLayer,useMapEvents,Marker,} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import markerIcon from
  'leaflet/dist/images/marker-icon.png';
import markerIcon2x from
  'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from
  'leaflet/dist/images/marker-shadow.png';
import type { MapClickHandlerProps, Position } from '../types';

type CollectionMapProps = {
  selectedPosition: Position | null;
  onSelect: (latitude: number, longitude: number) => void;
};

function MapClickHandler({
  onSelect,
}: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onSelect(
        event.latlng.lat,
        event.latlng.lng
      );
    },
  });

  return null;
}

const selectedLocationIcon = new Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,

  iconSize: [25, 41],
  iconAnchor: [12, 41],

  shadowSize: [41, 41],

  popupAnchor: [1, -34],
});

export default function CollectionMap({
  selectedPosition,
  onSelect,
}: CollectionMapProps) {
  return (
    <MapContainer
      center={[35.13, 136.91]}
      zoom={13}
      style={{ height: '400px', width: '100%' }}
    >
      <TileLayer
        attribution={
          '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'
        }
        url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
      />

      <MapClickHandler onSelect={onSelect} />

      {/* 地図上の地点が選択されたとき、マーカーを表示 */}
      {selectedPosition !== null && (
        <Marker
          position={[
            selectedPosition.latitude,
            selectedPosition.longitude,
          ]}
          icon={selectedLocationIcon}
        />
      )}
      
    </MapContainer>
  );
}
