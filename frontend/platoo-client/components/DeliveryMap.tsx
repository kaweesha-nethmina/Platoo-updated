// "use client";

// import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import { useEffect, useState } from "react";
// import L from "leaflet";

// interface Props {
//   driver: { lat: number; lng: number };
//   route: [number, number][]; // Path
// }

// // Custom Driver Icon
// const driverIcon = new L.Icon({
//   iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854894.png",
//   iconSize: [40, 40],
// });

// function MapUpdater({ center }: { center: [number, number] }) {
//   const map = useMap();
//   useEffect(() => {
//     map.setView(center, 13);
//   }, [center, map]);
//   return null;
// }

// export default function DeliveryMap({ driver, route }: Props) {
//   const [mapCenter, setMapCenter] = useState<[number, number]>([driver.lat, driver.lng]);

//   useEffect(() => {
//     if (route.length > 0) {
//       setMapCenter(route[0]); // If route available, center to route start
//     } else {
//       setMapCenter([driver.lat, driver.lng]); // Else center to driver
//     }
//   }, [route, driver]);

//   return (
//     <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true} style={{ height: "400px", width: "100%" }}>
//       <MapUpdater center={mapCenter} />
//       <TileLayer
//         attribution='&copy; OpenStreetMap contributors'
//         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//       />
      
//       {/* Always show Driver Marker */}
//       <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
//         <Popup>Driver Location</Popup>
//       </Marker>

//       {/* Show Route when available */}
//       {route.length > 0 && (
//         <Polyline positions={route} color="blue" />
//       )}
//     </MapContainer>
//   );
// }
"use client";

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import L from "leaflet";

interface Props {
  driver: { lat: number; lng: number };
  route: [number, number][]; // Path
}

// Custom Driver Icon
const driverIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854894.png", // driver motorbike icon
  iconSize: [40, 40],
});

// Custom Pickup (Restaurant) Icon
const pickupIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", // restaurant/pickup icon
  iconSize: [40, 40],
});

// Custom Drop-off (Customer) Icon
const dropoffIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/484/484167.png", // house icon
  iconSize: [40, 40],
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] && center[1]) {
      map.setView(center, 15, { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function DeliveryMap({ driver, route }: Props) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([driver.lat, driver.lng]);

  useEffect(() => {
    if (route && route.length > 0 && route[0][0] && route[0][1]) {
      setMapCenter(route[0]); // Center to start of route
    } else if (driver.lat && driver.lng) {
      setMapCenter([driver.lat, driver.lng]); // Else center to driver
    }
  }, [route, driver]);

  return (
    <MapContainer center={mapCenter} zoom={15} scrollWheelZoom={true} style={{ height: "400px", width: "100%" }}>
      <MapUpdater center={mapCenter} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Driver Marker */}
      {driver.lat && driver.lng && (
        <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
          <Popup>Driver Location</Popup>
        </Marker>
      )}

      {/* Pickup Location Marker (Restaurant) */}
      {route && route.length > 0 && (
        <Marker position={route[0]} icon={pickupIcon}>
          <Popup>Pickup Location (Restaurant)</Popup>
        </Marker>
      )}

      {/* Drop-off Location Marker (Customer) */}
      {route && route.length > 1 && (
        <Marker position={route[route.length - 1]} icon={dropoffIcon}>
          <Popup>Drop-off Location (Customer)</Popup>
        </Marker>
      )}

      {/* Route Line */}
      {route && route.length > 0 && (
        <Polyline positions={route} color="blue" />
      )}
    </MapContainer>
  );
}
