"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShoppingCart, Search, MapPin, ChevronDown, X, Info, Clock, ThumbsUp, Phone } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/hooks/useCart";

interface UserDashboardProps {
  userId: string
}

function getRandomItems(array: any[], count: number) {
  if (!Array.isArray(array)) return [];
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export default function UserDashboard({ userId }: UserDashboardProps) {
  const [address, setAddress] = useState("Sri Lanka")
  const [searchQuery, setSearchQuery] = useState("")
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(true)
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const placeholderImage = "/placeholder.svg"
  // Use the useCart hook to get cart items and cart count
  const { cartItems } = useCart(); 
  const cartCount = cartItems.length; // Get the count of items in the cart

  useEffect(() => {
    async function fetchData() {
      try {
        const [menuRes, restRes] = await Promise.all([
          fetch("http://localhost:3001/api/menu-items"),
          fetch("http://localhost:3001/api/restaurants"),
        ]);
        const menuItemsData = await menuRes.json();
        const restaurantsData = await restRes.json();
        setMenuItems(menuItemsData);
        setRestaurants(restaurantsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);
  

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search logic if needed
  }

  const handleMenuItemClick = (item: any) => {
    localStorage.setItem('selectedItem', JSON.stringify(item))
    localStorage.setItem('selectedQuantity', '1')
    router.push('/checkout')
  }

  const handleRestaurantClick = (restaurantId: string) => {
    localStorage.setItem('restaurantId', restaurantId)
    router.push(`/restaurants/${restaurantId}`)
  }

  const randomMenuItems = getRandomItems(menuItems, 6)
  const randomRestaurants = getRandomItems(restaurants, 3)

  if (loading) {
    return <div className="text-center py-20">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <Header cartCount={cartCount} />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <div className="relative bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/backgroundHome.jpg')" }}>
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="container mx-auto px-6 pt-24 pb-16 relative z-1 flex flex-col lg:flex-row items-center justify-center text-center">
            {/* Left Side - Content */}
            <div className="text-white">
              <div className="flex items-center justify-center mb-6 text-lg">
                <MapPin className="h-5 w-5 text-red-500 mr-2" />
                <span>{address}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                Discover restaurants that deliver near you.
              </h1>
              <form onSubmit={handleSearch} className="relative max-w-md mx-auto mb-8">
                <Input
                  type="text"
                  placeholder="Enter your delivery address"
                  className="pr-16 h-12 rounded-full border-gray-300 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button
                  type="submit"
                  className="absolute right-0 top-0 h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
                >
                  <Search className="h-5 w-5 text-white" />
                </Button>
              </form>
              {/* Call to Action */}
              <div className="flex justify-center gap-6 mb-6">
                <Button className="bg-red-500 hover:bg-red-600 text-white py-2 px-6 rounded-full flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Order Now
                </Button>
                <Button className="bg-transparent border-2 border-white text-white py-2 px-6 rounded-full flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Learn More
                </Button>
              </div>
              {/* Icons */}
              <div className="flex justify-center gap-6 text-white">
                <div className="flex items-center space-x-2">
                  <Clock className="h-6 w-6 text-red-500" />
                  <span className="text-sm">Fast Delivery</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ThumbsUp className="h-6 w-6 text-red-500" />
                  <span className="text-sm">Highly Rated</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-6 w-6 text-red-500" />
                  <span className="text-sm">24/7 Support</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Popular Menu Items */}
        <section className="py-10 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Menu Items</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {randomMenuItems.map((item) => (
                <Card
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  key={item._id}
                  onClick={() => handleMenuItemClick(item)}
                >
                  <div className="aspect-square relative">
                    <img
                      src={item.image_url ? item.image_url : placeholderImage}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.src = placeholderImage; }}
                    />
                  </div>
                  <CardContent className="p-3 text-center">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    {item.price && (
                      <div className="text-sm text-gray-500 mt-1">
                        {typeof item.price === "number" ? `LKR ${item.price.toFixed(2)}` : item.price}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Restaurants */}
        <section className="py-10 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Restaurants</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {randomRestaurants.map((restaurant) => (
                <Card
                  className="overflow-hidden hover:shadow-md transition-shadow h-full cursor-pointer"
                  key={restaurant._id}
                  onClick={() => handleRestaurantClick(restaurant._id)}
                >
                  <div className="aspect-video relative">
                    <img
                      src={restaurant.image || placeholderImage}
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.src = placeholderImage; }}
                    />
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-white text-gray-900">★ {restaurant.rating}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{restaurant.name}</h3>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Array.isArray(restaurant.cuisines) && restaurant.cuisines.map((type: string, index: number) => (
                        <span key={index} className="text-xs text-gray-500">
                          {type}
                          {index < restaurant.cuisines.length - 1 ? " • " : ""}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{restaurant.deliveryTime}</span>
                      <span>{restaurant.deliveryFee} delivery</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button variant="outline" className="border-red-500 text-red-500 hover:bg-red-50">
                View All Restaurants
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold mb-2">Find Food</h3>
                <p className="text-gray-600">Browse restaurants and cuisines near you</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold mb-2">Place Order</h3>
                <p className="text-gray-600">Choose your favorite dishes and checkout</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold mb-2">Fast Delivery</h3>
                <p className="text-gray-600">Food is prepared and delivered to your door</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/* Footer */}
      <Footer />
      {/* Privacy Policy Popup */}
      {showPrivacyPolicy && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border p-4 z-20">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center mr-2">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-medium">What about Privacy Policy?</h3>
            </div>
            <button className="text-gray-400 hover:text-gray-500" onClick={() => setShowPrivacyPolicy(false)}>
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            At Platoo, your privacy is important to us. This policy explains how we collect and use your personal information when you use our services.
          </p>
          <a
            href="/privacy"
            className="text-sm text-red-500 font-medium hover:text-red-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            See more
          </a>

        </div>
      )}
    </div>
  )
}
