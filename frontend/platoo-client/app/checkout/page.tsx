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
  
  // Location related states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<{
    address: string;
    lat: number;
    lng: number;
  } | null>(null);

  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

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

      const calcSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const calcTax = calcSubtotal * 0.08; // 8% tax
      const calcTotal = calcSubtotal + deliveryFee + calcTax;

      setSubtotal(calcSubtotal);
      setTax(calcTax);
      setTotal(calcTotal);
    } else {
      const item = localStorage.getItem("selectedItem");
      const quantity = localStorage.getItem("selectedQuantity") || "1";

      if (item) {
        const parsedItem = JSON.parse(item);
        setSelectedItem(parsedItem);
        setSelectedQuantity(parseInt(quantity));

        // Calculate for single item
        const selectedItemTotal = parsedItem.price * parseInt(quantity);
        const selectedItemTax = selectedItemTotal * 0.08;
        const selectedItemTotalWithTax = selectedItemTotal + deliveryFee + selectedItemTax;

        setSubtotal(selectedItemTotal);
        setTax(selectedItemTax);
        setTotal(selectedItemTotalWithTax);
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

  // Recalculate totals if single item quantity changes
  useEffect(() => {
    if (selectedItem && cartItems.length === 0) {
      const selectedItemTotal = selectedItem.price * selectedQuantity;
      const selectedItemTax = selectedItemTotal * 0.08;
      const selectedItemTotalWithTax = selectedItemTotal + deliveryFee + selectedItemTax;

      setSubtotal(selectedItemTotal);
      setTax(selectedItemTax);
      setTotal(selectedItemTotalWithTax);
    }
    // eslint-disable-next-line
  }, [selectedQuantity, selectedItem]);

  if (!userId) {
    alert("User is not logged in. Please log in before placing the order.");
    return null;
  }

  const handlePlaceOrder = async () => {
    if (
      !deliveryAddress || 
      !phone || 
      !email || 
      (!selectedItem && cartItems.length === 0) ||
      !deliveryLocation
    ) {
      console.log("Missing order details");
      return;
    }

    setIsProcessing(true);

    try {
      const itemsToSend =
        cartItems.length > 0
          ? cartItems.map((item) => ({
              menu_item_id: item.productId,
              quantity: item.quantity,
              price: item.price,
              name: item.name,
            }))
          : [
              {
                menu_item_id: selectedItem!._id,
                quantity: selectedQuantity,
                price: selectedItem!.price,
                name: selectedItem!.name,
              },
            ];

      // Always use the calculated total (which includes tax)
      const orderTotal = total;

      const orderPayload = {
        user_id: userId,
        restaurant_id: restaurant?._id,
        items: itemsToSend,
        total_amount: orderTotal,
        delivery_fee: deliveryFee,
        status: "pending",
        delivery_address: deliveryAddress,
        location: { // Match your backend schema
          lat: deliveryLocation.lat,
          lng: deliveryLocation.lng
        },
        phone,
        email,
      };

      localStorage.setItem("pending_order", JSON.stringify(orderPayload));

      const paymentData = {
        amount: orderTotal.toFixed(2),
        quantity: itemsToSend.reduce((acc, item) => acc + item.quantity, 0),
        name: "Food Order",
        currency: "USD",
        successUrl: "http://localhost:8000/payment-success",
        cancelUrl: "http://localhost:8000/checkout",
      };

      const response = await fetch("http://localhost:8081/product/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      if (response.ok && result.sessionUrl) {
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
                  onClick={() => {
                    const userData = localStorage.getItem("user");
                    if (userData) {
                      const user = JSON.parse(userData);
                      if (user.address) setDeliveryAddress(user.address);
                      if (user.phone) setPhone(user.phone);
                      if (user.email) setEmail(user.email);
                      if (user.location && user.location.lat && user.location.lng) {
                        setDeliveryLocation({
                          address: user.address || "",
                          lat: user.location.lat,
                          lng: user.location.lng,
                        });
                      }
                    }
                  }}
                >
                  <Sparkles className="w-4 h-4 text-red-500" />
                  Auto fill
                </Button>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter delivery address"
                      value={deliveryAddress}
                      readOnly
                      className="w-full bg-gray-50"
                    />
                    <Button
                      type="button"
                      onClick={() => setShowLocationModal(true)}
                      variant="outline"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Pick Location
                    </Button>
                  </div>
                  
                  {deliveryLocation && (
                    <div className="text-xs text-gray-500">
                      Location: {deliveryLocation.lat.toFixed(6)}, {deliveryLocation.lng.toFixed(6)}
                    </div>
                  )}
                  
                  <Input
                    type="text"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
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
                {(!deliveryAddress || !phone || !email || !deliveryLocation) && (
                  <div className="flex items-center text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span>
                      Please pick a delivery location and fill in phone and email
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
