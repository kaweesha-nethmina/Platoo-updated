"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  AlertCircle, 
  Plus, 
  Minus, 
  Sparkles, 
  X, 
  Search,
  Loader2,
  LocateFixed,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/hooks/useCart";

// Declare leaflet types
declare global {
  interface Window {
    L: any;
  }
}

interface MenuItem {
  _id: string;
  productId?: string;
  menuItemId?: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_veg: boolean;
  is_available: boolean;
  category_id: string;
}

interface Restaurant {
  _id: string;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: string;
  minOrder: string;
  distance: string;
  address: string;
  cuisines: string[];
  priceLevel: number;
  description: string;
}

interface CartItem {
  id: string;
  productId: string;
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// Location Picker Modal Component
const LocationPickerModal = ({
  isOpen,
  onClose,
  onSelectLocation,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: { address: string; lat: number; lng: number }) => void;
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [locationSelected, setLocationSelected] = useState(false);
  const [manualCoordinates, setManualCoordinates] = useState({ lat: "", lng: "" });
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);

  // Load Leaflet
  useEffect(() => {
    if (!isOpen) return;
    
    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        initializeMap();
        setIsMapLoading(false);
      };
      script.onerror = () => {
        setMapError("Failed to load map resources");
        setIsMapLoading(false);
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
      setIsMapLoading(false);
    }

    return () => {
      if (map) {
        map.remove();
        setMap(null);
        setMarker(null);
      }
    };
  }, [isOpen]);

  // Initialize map
  const initializeMap = () => {
    if (!mapRef.current || !window.L) return;

    try {
      const defaultLocation = [6.9271, 79.8612]; // Default to Colombo, Sri Lanka
      const mapInstance = window.L.map(mapRef.current).setView(defaultLocation, 13);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance);

      // Add click event listener to map
      mapInstance.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        placeMarker(lat, lng);
        getAddressFromCoordinates(lat, lng);
      });

      setMap(mapInstance);
      setMapError(null);
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError("Failed to initialize map. Please try again later.");
    }
  };

  // Place marker on map
  const placeMarker = (lat: number, lng: number) => {
    if (!map) return;
    
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      const newMarker = window.L.marker([lat, lng], { draggable: true }).addTo(map);
      newMarker.on("dragend", (e: any) => {
        const position = e.target.getLatLng();
        getAddressFromCoordinates(position.lat, position.lng);
        setManualCoordinates({
          lat: position.lat.toString(),
          lng: position.lng.toString(),
        });
      });
      setMarker(newMarker);
    }
    
    map.setView([lat, lng], 16);
    setManualCoordinates({
      lat: lat.toString(),
      lng: lng.toString(),
    });
    setLocationSelected(true);
  };

  // Get address from coordinates
  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "CheckoutPage/1.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.display_name) {
        const address = data.display_name;
        setSearchValue(address);
        setSelectedLocation({
          address,
          lat,
          lng,
        });
      } else {
        const coordsAddress = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSearchValue(coordsAddress);
        setSelectedLocation({
          address: coordsAddress,
          lat,
          lng,
        });
      }
    } catch (error) {
      console.error("Error fetching address:", error);
      const coordsAddress = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setSearchValue(coordsAddress);
      setSelectedLocation({
        address: coordsAddress,
        lat,
        lng,
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Search for location
  const searchLocation = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "CheckoutPage/1.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data);
      
      if (data.length > 0) {
        setShowSearchResults(true);
      } else {
        setMapError("No locations found. Try a different search term.");
        setTimeout(() => setMapError(null), 3000);
      }
    } catch (error) {
      console.error("Error searching location:", error);
      setMapError("Search failed. Please try again or enter coordinates manually.");
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    if (e.target.value.length > 2) {
      searchLocation(e.target.value);
    } else {
      setShowSearchResults(false);
    }
  };

  // Handle search result selection
  const handleSelectSearchResult = (result: any) => {
    if (!map) return;

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    placeMarker(lat, lng);
    map.setView([lat, lng], 16);
    
    setSearchValue(result.display_name);
    setSelectedLocation({
      address: result.display_name,
      lat,
      lng,
    });
    setShowSearchResults(false);
  };

  // Handle manual coordinate input
  const handleManualCoordinateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualCoordinates({
      ...manualCoordinates,
      [e.target.name]: e.target.value,
    });
  };

  // Apply manual coordinates
  const applyManualCoordinates = () => {
    const lat = parseFloat(manualCoordinates.lat);
    const lng = parseFloat(manualCoordinates.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMapError("Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.");
      setTimeout(() => setMapError(null), 5000);
      return;
    }

    if (!map) return;

    placeMarker(lat, lng);
    getAddressFromCoordinates(lat, lng);
  };

  // Use selected location
  const handleUseLocation = () => {
    if (selectedLocation) {
      onSelectLocation(selectedLocation);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-red-500" />
            Pick Delivery Location
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {mapError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            {mapError}
          </div>
        )}

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Input
              placeholder="Search for a location or click on the map"
              value={searchValue}
              onChange={handleSearchInputChange}
              className="w-full pr-10"
            />
            {isSearching ? (
              <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-gray-400" />
            ) : (
              <Search 
                className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
                onClick={() => searchLocation(searchValue)}
              />
            )}

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual coordinates input */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-md">
            <div>
              <label className="text-sm font-medium">Latitude</label>
              <Input
                name="lat"
                value={manualCoordinates.lat}
                onChange={handleManualCoordinateChange}
                placeholder="e.g. 6.9271"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Longitude</label>
              <Input
                name="lng"
                value={manualCoordinates.lng}
                onChange={handleManualCoordinateChange}
                placeholder="e.g. 79.8612"
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Button 
                onClick={applyManualCoordinates}
                className="w-full bg-red-500 hover:bg-red-600"
                disabled={!manualCoordinates.lat || !manualCoordinates.lng}
              >
                Apply Coordinates
              </Button>
            </div>
          </div>

          {/* Map container */}
          <div className="relative border rounded-md overflow-hidden" style={{ height: "300px" }}>
            {isMapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                <span className="ml-2">Loading map...</span>
              </div>
            )}
            <div ref={mapRef} className="h-full w-full"></div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              className="bg-red-500 hover:bg-red-600"
              disabled={!selectedLocation}
              onClick={handleUseLocation}
            >
              Use This Location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Checkout Page Component
export default function CheckoutPage() {
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(300.0);
  const [tax, setTax] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<{ address?: string; phone?: string; email?: string; location?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  // Location related states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  // Idempotency-Key: generated once per checkout attempt and reused on retries
  // so a double-click/second attempt can never mint a duplicate order. Reset
  // only after the checkout actually succeeds.
  const idempotencyKeyRef = useRef<string | null>(null);
  const getOrCreateIdempotencyKey = (): string => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return idempotencyKeyRef.current;
  };

  // The delivery fee shown to the customer is the same value the order-service
  // resolves server-side (from the restaurant record). Parsing mirrors the
  // backend so the displayed total always matches what gets charged.
  const parseDeliveryFee = (raw?: string | number | null): number => {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
    if (typeof raw === "string") {
      const m = raw.replace(/,/g, "").match(/\d+(\.\d+)?/);
      if (m) {
        const n = Number(m[0]);
        if (Number.isFinite(n) && n >= 0) return n;
      }
    }
    return 0;
  };

  // Calculate totals
  useEffect(() => {
    const restaurantId = localStorage.getItem("restaurantId");
    if (restaurantId) {
      fetch(`http://localhost:3001/api/restaurants/${restaurantId}`)
        .then((res) => res.json())
        .then(setRestaurant)
        .catch((err) => console.error("Failed to fetch restaurant:", err));
    }

    const cart = localStorage.getItem("checkoutCart");
    if (cart) {
      const items: CartItem[] = JSON.parse(cart);
      setCartItems(items);
    } else {
      const item = localStorage.getItem("selectedItem");
      const quantity = localStorage.getItem("selectedQuantity") || "1";

      if (item) {
        const parsedItem = JSON.parse(item);
        setSelectedItem(parsedItem);
        setSelectedQuantity(parseInt(quantity));
      }
    }

    return () => {
      localStorage.removeItem("checkoutCart");
      localStorage.removeItem("selectedItem");
      localStorage.removeItem("selectedQuantity");
    };
    // Only run on mount
    // eslint-disable-next-line
  }, []);

  // Use the restaurant's authoritative delivery fee when available.
  useEffect(() => {
    if (restaurant) {
      setDeliveryFee(parseDeliveryFee(restaurant.deliveryFee));
    }
  }, [restaurant]);

  // Keep the money math in sync with the data it depends on.
  useEffect(() => {
    if (cartItems.length > 0) {
      const calcSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const calcTax = calcSubtotal * 0.08;
      setSubtotal(calcSubtotal);
      setTax(calcTax);
      setTotal(calcSubtotal + deliveryFee + calcTax);
      return;
    }

    if (selectedItem) {
      const selectedItemTotal = selectedItem.price * selectedQuantity;
      const selectedItemTax = selectedItemTotal * 0.08;
      setSubtotal(selectedItemTotal);
      setTax(selectedItemTax);
      setTotal(selectedItemTotal + deliveryFee + selectedItemTax);
    }
    // eslint-disable-next-line
  }, [cartItems, selectedItem, selectedQuantity, deliveryFee]);

  if (!userId) {
    if (typeof window !== "undefined") {
      alert("User is not logged in. Please log in before placing the order.");
    }
    return null;
  }

  // Reverse-geocode coordinates into a human-readable address (Nominatim)
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "CheckoutPage/1.0",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    }
    return `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // Read the device's current location and reverse-geocode it
  const useMyLocation = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setErrors((prev) => ({ ...prev, location: "Geolocation is not supported by this browser." }));
      return;
    }
    setIsLocating(true);
    setErrors((prev) => ({ ...prev, location: "" }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        setDeliveryLocation({ address, lat: latitude, lng: longitude });
        setDeliveryAddress(address);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        let message = "Unable to get your current location. Please try picking a location manually.";
        if (err.code === err.PERMISSION_DENIED) {
          message = "Location permission denied. Allow location access or pick a location on the map.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = "Your location is unavailable. Pick a location on the map instead.";
        } else if (err.code === err.TIMEOUT) {
          message = "Timed out getting your location. Please try again.";
        }
        setErrors((prev) => ({ ...prev, location: message }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  // Fill the form from the user profile (when available) and pull the device
  // location so delivery address/coords don't have to be typed by hand.
  const handleAutoFill = async () => {
    let user: any = null;

    const cachedUser = localStorage.getItem("user");
    if (cachedUser) {
      try {
        user = JSON.parse(cachedUser);
      } catch {
        user = null;
      }
    }

    // Try to fetch the freshest profile from user-service
    try {
      if (userId) {
        const res = await fetch(`/api/proxy/user/auth/user/${userId}`);
        if (res.ok) {
          user = await res.json();
        }
      }
    } catch (error) {
      console.error("Failed to fetch freshest profile, falling back to cached data:", error);
    }

    if (user) {
      if (user.address) setDeliveryAddress(user.address);
      if (user.phone) setPhone(user.phone);
      if (user.email) setEmail(user.email);

      const savedLocation = user.location && Number.isFinite(user.location?.lat) && Number.isFinite(user.location?.lng)
        ? user.location
        : null;
      if (savedLocation) {
        setDeliveryLocation({
          address: user.address || `Location at ${savedLocation.lat}, ${savedLocation.lng}`,
          lat: savedLocation.lat,
          lng: savedLocation.lng,
        });
      }

      setErrors((prev) => ({
        ...prev,
        address: user.address ? "" : prev.address,
        phone: user.phone ? "" : prev.phone,
        email: user.email ? "" : prev.email,
        location: savedLocation ? "" : prev.location,
      }));
    }

    // If the user has no saved location, use the device's current location
    const hasSavedLocation = !!(user && user.location && Number.isFinite(user.location?.lat) && Number.isFinite(user.location?.lng));
    if (!hasSavedLocation) {
      useMyLocation();
    }
  };

  // Client-side validation for the checkout form
  const validateForm = (): boolean => {
    const newErrors: { address?: string; phone?: string; email?: string; location?: string } = {};

    if (!deliveryAddress.trim()) {
      newErrors.address = "Delivery address is required.";
    } else if (deliveryAddress.trim().length < 5) {
      newErrors.address = "Please enter a valid delivery address.";
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^(?:\+94|0)?7\d{8}$/.test(phone.trim())) {
      newErrors.phone = "Enter a valid Sri Lankan phone number (e.g. 07XXXXXXXX or +947XXXXXXXX).";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }

    if (!deliveryLocation) {
      newErrors.location = "Please pick a delivery location before placing the order.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setSubmitted(true);
    } else {
      setSubmitted(false);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    const hasItems = !!(selectedItem || cartItems.length > 0);
    if (!hasItems || !validateForm()) {
      console.log("Missing order details");
      return;
    }

    setIsProcessing(true);

    try {
      // Only identifiers + quantities are sent to the order-service. Prices,
      // totals, delivery fee, status, and identity are derived server-side
      // from the catalog and the verified JWT — never accepted from the client.
      const itemsToSend = cartItems.length > 0
          ? cartItems.map((item) => {
              // Cart items can carry the menu id under either name depending on
              // which path created them (cart-service uses `productId`, the
              // cart page re-maps it to `menuItemId`). Resolve whichever is
              // present so menu_item_id is never undefined.
              const menu_item_id = item.menuItemId ?? item.productId;
              return {
                menu_item_id,
                quantity: Number(item.quantity),
              };
            })
          : [
              {
                menu_item_id: selectedItem?._id ?? selectedItem?.productId ?? selectedItem?.menuItemId,
                quantity: Number(selectedQuantity),
              },
            ];

      const orderPayload = {
        restaurant_id: restaurant?._id,
        items: itemsToSend,
        delivery_address: deliveryAddress,
        location: { // Match your backend schema
          // The map/marker and auto-fill paths can produce string lat/lng
          // (e.g. "7.291418" or 6.9271); the order-service rejects anything
          // that is not typeof 'number'. Coerce explicitly at the payload
          // boundary so numeric coordinates always reach the server.
          lat: Number(deliveryLocation!.lat),
          lng: Number(deliveryLocation!.lng),
        },
        phone,
        email,
      };

      localStorage.setItem("pending_order", JSON.stringify(orderPayload));

      // Persist the order first so the payment amount can be recomputed
      // server-side from the stored order (never trust the client's amount).
      const orderResponse = await fetch("/api/proxy/order/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": getOrCreateIdempotencyKey(),
          // (V-08) Authorization removed — BFF proxy injects Bearer from the httpOnly cookie
        },
        body: JSON.stringify(orderPayload),
      });

      if (!orderResponse.ok) {
        // Capture the server's actual rejection reason — the browser only gets
        // "Failed to create order." otherwise)Skip; this surfaces which field
        // order-service's createOrder validation rejected so we stop guessing.
        void orderResponse.clone().text().then((t) => console.error("createOrder 400 body:", t));
        console.error("Failed to create order.");
        setIsProcessing(false);
        return;
      }

      const orderResult = await orderResponse.json();
      if (!orderResult?.order?._id) {
        console.error("No order id returned.");
        setIsProcessing(false);
        return;
      }

      localStorage.setItem("order_id", orderResult.order.order_id);

      const paymentData = {
        orderId: orderResult.order._id,
        currency: "USD",
      };

      const response = await fetch("/api/proxy/pay/product/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      if (response.ok && result.sessionUrl) {
        // Checkout succeeded; a fresh key for any future order.
        idempotencyKeyRef.current = null;
        window.location.href = result.sessionUrl;
      } else {
        console.error("Payment session failed.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error placing order:", error);
      setIsProcessing(false);
    }
  };

  // Handle location selection
  const handleLocationSelect = (location: { address: string; lat: number; lng: number }) => {
    setDeliveryAddress(location.address);
    setDeliveryLocation(location);
    setErrors((prev) => ({ ...prev, address: "", location: "" }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header cartCount={cartItems.length || 1} />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-2/3 space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-red-500" />
                  <div>
                    <CardTitle>Order Details</CardTitle>
                    <CardDescription>
                      Provide your delivery address, phone, and email
                    </CardDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="text-sm flex items-center gap-2 px-3 py-1 rounded-md"
                  onClick={handleAutoFill}
                >
                  <Sparkles className="w-4 h-4 text-red-500" />
                  Auto fill
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Enter delivery address"
                        value={deliveryAddress}
                        readOnly
                        className={`w-full bg-gray-50 ${errors.address || errors.location ? "border-red-500" : ""}`}
                      />
                      <Button
                        type="button"
                        onClick={useMyLocation}
                        variant="outline"
                        disabled={isLocating}
                        className="whitespace-nowrap"
                      >
                        {isLocating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <LocateFixed className="h-4 w-4 mr-2" />
                        )}
                        Use My Location
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setShowLocationModal(true)}
                        variant="outline"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Pick Location
                      </Button>
                    </div>
                    {errors.address && (
                      <p className="mt-1 text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.address}
                      </p>
                    )}
                    {!errors.address && errors.location && (
                      <p className="mt-1 text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.location}
                      </p>
                    )}
                  </div>
                  
                  {deliveryLocation && (
                    <div className="text-xs text-gray-500">
                      Location: {deliveryLocation.lat.toFixed(6)}, {deliveryLocation.lng.toFixed(6)}
                    </div>
                  )}
                  
                  <div>
                    <Input
                      type="tel"
                      placeholder="Enter your phone number"
                      value={phone}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^0-9+]/g, "").slice(0, 15);
                        setPhone(sanitized);
                        setErrors((prev) => ({ ...prev, phone: "" }));
                      }}
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.phone}
                      </p>
                    )}
                  </div>
                  <div>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors((prev) => ({ ...prev, email: "" }));
                      }}
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardFooter className="flex-col space-y-4">
                <Button
                  className="w-full bg-red-500 hover:bg-red-600"
                  disabled={isProcessing}
                  onClick={handlePlaceOrder}
                >
                  {isProcessing ? <>Processing Order...</> : <>Place Order</>}
                </Button>
                {submitted && Object.values(errors).some(Boolean) && (
                  <div className="flex items-center text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span>
                      Please fix the highlighted fields before placing the order
                    </span>
                  </div>
                )}
              </CardFooter>
            </Card>
          </div>
          <div className="w-full lg:w-1/3">
            <div className="sticky top-4">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.length > 0 ? (
                      cartItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-sm text-gray-500">
                              Qty: {item.quantity}
                            </span>
                          </div>
                          <div className="font-bold">
                            LKR {(item.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))
                    ) : selectedItem ? (
                      <div
                        key={selectedItem._id}
                        className="flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{selectedItem.name}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              className="px-4 py-1"
                              onClick={() =>
                                setSelectedQuantity((prev) => Math.max(prev - 1, 1))
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span>{selectedQuantity}</span>
                            <Button
                              variant="outline"
                              className="px-4 py-1"
                              onClick={() => setSelectedQuantity((prev) => prev + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="font-bold">
                          LKR {(selectedItem.price * selectedQuantity).toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <p>No items in cart</p>
                    )}
                  </div>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>LKR {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Delivery Fee</span>
                      <span>LKR {deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>LKR {tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>LKR {total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSelectLocation={handleLocationSelect}
      />

      <Footer />
    </div>
  );
}
