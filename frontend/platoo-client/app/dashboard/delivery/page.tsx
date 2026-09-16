"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, MapPin, Edit, Search } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  vehicleNumber?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export default function DeliveryPersonProfile() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState<UserProfile>({ name: "", email: "", phone: "" });
  const [searchValue, setSearchValue] = useState("");
  const [map, setMap] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
    const deliveryManId = localStorage.getItem("deliveryManId");
    if (!token || !deliveryManId) {
      router.push("/login");
      return;
    }
    fetchUserData(token, deliveryManId);
  }, []);

  const fetchUserData = async (token: string, userId: string) => {
    const res = await fetch(`http://localhost:4000/api/auth/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUser(data);
    setFormData({
      name: data.name,
      email: data.email,
      phone: data.phone,
      vehicleNumber: data.vehicleNumber,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  };

  useEffect(() => {
    if (activeTab === "location" && typeof window !== "undefined" && mapRef.current && !map) {
      if (!window.L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => initializeMap();
        document.body.appendChild(script);
      } else {
        initializeMap();
      }
    }
  }, [activeTab, map]);

  const initializeMap = () => {
    if (!mapRef.current || !window.L) return;
    const mapInstance = window.L.map(mapRef.current).setView(
      [formData.latitude || 20.5937, formData.longitude || 78.9629],
      13
    );
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance);

    if (formData.latitude && formData.longitude) {
      const newMarker = window.L.marker([formData.latitude, formData.longitude], { draggable: true }).addTo(mapInstance);
      newMarker.on("dragend", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      });
      setMarker(newMarker);
    }

    mapInstance.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        const newMarker = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
        setMarker(newMarker);
      }
    });

    setMap(mapInstance);
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async () => {
    const userId = localStorage.getItem("deliveryManId");
    await fetch(`http://localhost:4000/api/auth/update/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
      body: JSON.stringify(formData),
    });
    toast.success("Profile updated successfully!");
    setIsEditing(false);
    setTimeout(() => router.refresh(), 1000);
  };

  const handleSearchAddress = async () => {
    if (!searchValue.trim()) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchValue)}`);
    const data = await res.json();
    if (data.length > 0) {
      const { lat, lon, display_name } = data[0];
      setFormData((prev) => ({ ...prev, latitude: parseFloat(lat), longitude: parseFloat(lon), address: display_name }));
      if (map) {
        map.setView([lat, lon], 15);
        if (marker) {
          marker.setLatLng([lat, lon]);
        } else {
          const newMarker = window.L.marker([lat, lon], { draggable: true }).addTo(map);
          setMarker(newMarker);
        }
      }
    }
  };

  const handleSaveLocation = async () => {
    const userId = localStorage.getItem("deliveryManId");
    if (!userId) return;
  
    try {
      await fetch(`http://localhost:4000/api/auth/update/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
        },
        body: JSON.stringify({
          address: formData.address,
          latitude: formData.latitude,
          longitude: formData.longitude,
        }),
      });
  
      // ✅ Save driver location into localStorage as well
      if (formData.latitude !== undefined && formData.longitude !== undefined) {
        localStorage.setItem("driverLatitude", formData.latitude.toString());
        localStorage.setItem("driverLongitude", formData.longitude.toString());
        console.log("✅ Driver location saved in localStorage:", {
          lat: formData.latitude,
          lng: formData.longitude,
        });
      }
  
      toast.success("Location updated successfully!");
      setTimeout(() => router.refresh(), 1000);
    } catch (error) {
      console.error("❌ Error saving location:", error);
      toast.error("Failed to save location!");
    }
  };
  
  if (!user) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="animate-spin w-8 h-8 text-gray-500" />
    </div>
  );

  const navItems = [
    { title: "Dashboard", href: "/dashboard", icon: "home" },
    { title: "Pending Deliveries", href: "/dashboard/delivery/pending-deliveries", icon: "truck" },
    { title: "Earnings", href: "/dashboard/delivery/earnings", icon: "dollar-sign" },
    { title: "Profile", href: "/dashboard/delivery", icon: "user" },
  ];

  return (
    <DashboardLayout navItems={navItems}>
      <div className="p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="profile" onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex justify-center mb-6">
            <TabsTrigger value="profile" className="px-6 py-2 text-lg rounded-full data-[state=active]:bg-primary data-[state=active]:text-white">
              Profile Info
            </TabsTrigger>
            <TabsTrigger value="location" className="px-6 py-2 text-lg rounded-full data-[state=active]:bg-primary data-[state=active]:text-white">
              Location
            </TabsTrigger>
          </TabsList>

          {/* Profile Editing */}
          <TabsContent value="profile">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Delivery Person Profile</CardTitle>
                <CardDescription>Edit your personal details below</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input name="name" value={formData.name} onChange={handleProfileChange} placeholder="Full Name" disabled={!isEditing} />
                <Input name="email" value={formData.email} onChange={handleProfileChange} placeholder="Email" disabled={!isEditing} />
                <Input name="phone" value={formData.phone} onChange={handleProfileChange} placeholder="Phone Number" disabled={!isEditing} />
                <Input name="vehicleNumber" value={formData.vehicleNumber} onChange={handleProfileChange} placeholder="Vehicle Number" disabled={!isEditing} />
                {isEditing ? (
                  <Button onClick={handleSaveProfile} className="w-full">Save Changes</Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="w-full hover:bg-gray-100">
                    <Edit className="h-4 w-4 mr-2" /> Edit Profile
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Location Updating */}
          <TabsContent value="location">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex gap-2 items-center">
                  <MapPin className="h-5 w-5 text-red-500" /> Delivery Person Location
                </CardTitle>
                {formData.address && (
                  <CardDescription>Your current address: {formData.address}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-2">
                  <Input placeholder="Search for an address..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
                  <Button onClick={handleSearchAddress} className="bg-blue-500 hover:bg-blue-600">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={handleSaveLocation} className="w-full bg-red-600 hover:bg-red-700 text-white">Save Location</Button>
                <div ref={mapRef} className="w-full h-[400px] rounded-md border"></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
