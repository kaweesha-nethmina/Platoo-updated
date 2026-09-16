import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Function to handle location selection and map rendering
const LocationPicker = ({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number, address: string) => void }) => {
  const [position, setPosition] = useState<[number, number]>([51.505, -0.09]); // Default position
  const [address, setAddress] = useState<string>("");

  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setPosition([lat, lng]);

      // Use Nominatim API to get the address for the clicked location
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
        .then((res) => res.json())
        .then((data) => {
          setAddress(data.display_name);
          onLocationSelected(lat, lng, data.display_name); // Send selected location to parent
        })
        .catch((err) => console.error("Error fetching address:", err));
    },
  });

  return (
    <MapContainer center={position} zoom={13} style={{ height: "400px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={position}>
        <Popup>{address || "Click to select a location"}</Popup>
      </Marker>
    </MapContainer>
  );
};

export default LocationPicker;
