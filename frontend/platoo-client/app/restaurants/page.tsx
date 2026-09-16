"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { useCart } from "@/hooks/useCart"
import { Search, MapPin, Star, Clock, Filter } from "lucide-react"

interface Restaurant {
  _id: string
  name: string
  image: string
  rating: number
  deliveryTime: string
  deliveryFee: string
  minOrder: string
  distance: string
  cuisines: string[]
  priceLevel: number
}

export default function RestaurantsPage() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCuisine, setSelectedCuisine] = useState<string>("all")
  const [priceRange, setPriceRange] = useState<number[]>([1, 4])
  const [maxDeliveryTime, setMaxDeliveryTime] = useState<number>(60)
  const [showFilters, setShowFilters] = useState(false)

  const cuisineTypes = [
    "All",
    "Italian",
    "Chinese",
    "Japanese",
    "Mexican",
    "Indian",
    "American",
    "Thai",
    "Mediterranean",
    "Fast Food",
  ]

  const { cartItems } = useCart(); // You can access cartItems, subtotal, etc.
  const cartCount = cartItems.length;

  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("http://localhost:3001/api/restaurants")
        if (response.ok) {
          const data: Restaurant[] = await response.json()
          setRestaurants(data)
          setFilteredRestaurants(data)
        } else {
          console.error("Failed to fetch restaurants")
        }
      } catch (error) {
        console.error("Error fetching restaurants:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRestaurants()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, selectedCuisine, priceRange, maxDeliveryTime, restaurants])

  const applyFilters = () => {
    let filtered = [...restaurants];
  
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(query) ||
          restaurant.cuisines.some((cuisine) => cuisine.toLowerCase().includes(query)),
      );
    }
  
    // Filter by selected cuisine
    if (selectedCuisine && selectedCuisine !== "all") {
      filtered = filtered.filter((restaurant) =>
        restaurant.cuisines.some(
          (cuisine) => cuisine.toLowerCase() === selectedCuisine.toLowerCase(),
        ),
      );
    }
  
    // Apply price range filter
    filtered = filtered.filter(
      (restaurant) => restaurant.priceLevel >= priceRange[0] && restaurant.priceLevel <= priceRange[1],
    );
  
    // Apply delivery time filter
    filtered = filtered.filter((restaurant) => {
      const deliveryTimeRange = restaurant.deliveryTime.includes("-")
        ? restaurant.deliveryTime.split("-").map((time) => parseInt(time.trim(), 10))
        : [parseInt(restaurant.deliveryTime.replace("min", "").trim(), 10), parseInt(restaurant.deliveryTime.replace("min", "").trim(), 10)];
      return deliveryTimeRange.length === 2 && deliveryTimeRange[1] <= maxDeliveryTime;
    });
    
  
    console.log("Filtered Restaurants:", filtered);  // Log filtered restaurants to debug
  
    setFilteredRestaurants(filtered);
  };
  

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const getPriceLevelString = (level: number) => {
    return Array(level).fill("LKR").join(" ") // Changed "$" to "LKR" for Sri Lankan Rupee
  }

  const handleRestaurantClick = (restaurantId: string) => {
    // Store the restaurant ID in localStorage when clicked
    localStorage.setItem("restaurantId", restaurantId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header cartCount={cartCount} />

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold mb-4">Restaurants in Sri Lanka</h1>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search for restaurants or cuisines"
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" className="md:w-auto" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button type="submit" className="bg-red-500 hover:bg-red-600 md:w-auto">
              Search
            </Button>
          </form>

          {showFilters && (
            <div className="mt-4 p-4 border rounded-md">
              <h3 className="font-medium mb-3">Filter Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Cuisine Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Cuisine Type</label>
                  <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cuisines</SelectItem>
                      {cuisineTypes.map((cuisine) => (
                        <SelectItem key={cuisine.toLowerCase()} value={cuisine.toLowerCase()}>
                          {cuisine}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Price Range: {getPriceLevelString(priceRange[0])} - {getPriceLevelString(priceRange[1])}
                  </label>
                  <Slider
                    defaultValue={[1, 4]}
                    min={1}
                    max={4}
                    step={1}
                    value={priceRange}
                    onValueChange={setPriceRange}
                    className="py-4"
                  />
                </div>

                {/* Max Delivery Time Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Max Delivery Time: {maxDeliveryTime} min</label>
                  <Slider
                    defaultValue={[60]}
                    min={10}
                    max={60}
                    step={5}
                    value={[maxDeliveryTime]}
                    onValueChange={(value) => setMaxDeliveryTime(value[0])}
                    className="py-4"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Restaurant Categories */}
        <div className="mb-8">
          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Restaurants</TabsTrigger>
              {/* <TabsTrigger value="featured">Featured</TabsTrigger>
              <TabsTrigger value="popular">Most Popular</TabsTrigger>
              <TabsTrigger value="new">New Arrivals</TabsTrigger>
              <TabsTrigger value="offers">Special Offers</TabsTrigger> */}
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="h-48 bg-gray-200 animate-pulse" />
                      <CardContent className="p-4">
                        <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3 mb-2" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredRestaurants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRestaurants.map((restaurant) => (
                    <Link href={`/restaurants/${restaurant._id}`} key={restaurant._id}>
                      <Card
                        className="overflow-hidden hover:shadow-md transition-shadow h-full"
                        onClick={() => handleRestaurantClick(restaurant._id)}
                      >
                        <div className="aspect-video relative">
                          <img
                            src={restaurant.image || "/placeholder.svg"}
                            alt={restaurant.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-white text-gray-900 flex items-center">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                              {restaurant.rating}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg text-gray-900">{restaurant.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {getPriceLevelString(restaurant.priceLevel)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {restaurant.cuisines.map((cuisine, index) => (
                              <span key={index} className="text-xs text-gray-500">
                                {cuisine}
                                {index < restaurant.cuisines.length - 1 ? " • " : ""}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-gray-500">
                              <Clock className="h-4 w-4 mr-1" />
                              {restaurant.deliveryTime}
                            </div>
                            <div className="flex items-center text-gray-500">
                              <MapPin className="h-4 w-4 mr-1" />
                              {restaurant.distance}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex justify-between items-center text-sm">
                            <span className="text-gray-500">Min: {restaurant.minOrder}</span>
                            <span className="text-gray-500">Delivery: {restaurant.deliveryFee}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🍽️</div>
                  <h3 className="text-xl font-medium mb-2">No restaurants found</h3>
                  <p className="text-gray-500 mb-6">Try adjusting your filters or search for something else</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("")
                      setSelectedCuisine("all")
                      setPriceRange([1, 4])
                      setMaxDeliveryTime(60)
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}

              {filteredRestaurants.length > 0 && (
                <div className="flex justify-center mt-8">
                  <Button variant="outline">Load More</Button>
                </div>
              )}
            </TabsContent>

            {/* Other tabs would have similar content but filtered differently */}
            <TabsContent value="featured">
              <div className="text-center py-12">
                <p className="text-gray-500">Featured restaurants will appear here</p>
              </div>
            </TabsContent>

            <TabsContent value="popular">
              <div className="text-center py-12">
                <p className="text-gray-500">Most popular restaurants will appear here</p>
              </div>
            </TabsContent>

            <TabsContent value="new">
              <div className="text-center py-12">
                <p className="text-gray-500">New restaurants will appear here</p>
              </div>
            </TabsContent>

            <TabsContent value="offers">
              <div className="text-center py-12">
                <p className="text-gray-500">Restaurants with special offers will appear here</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}
