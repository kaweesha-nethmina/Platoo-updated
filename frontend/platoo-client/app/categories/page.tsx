"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
  cuisines: string[];
}

interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  restaurant_id: {
    _id: string;
    name: string;
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetching categories and restaurants data
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const categoryResponse = await fetch("http://localhost:3001/api/category");
        const categoryData = await categoryResponse.json();

        const restaurantResponse = await fetch("http://localhost:3001/api/restaurants");
        const restaurantData = await restaurantResponse.json();

        setCategories(categoryData);
        setRestaurants(restaurantData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter categories based on search query
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <Header cartCount={1} />
      <div className="container py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Food Categories</h1>
            <p className="text-gray-500">Browse our menu by category</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search for categories..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Categories Tabs */}
          <Tabs defaultValue="all" className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="new">New</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Display filtered categories */}
          {isLoading ? (
            <div className="text-center py-12">Loading categories...</div>
          ) : filteredCategories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCategories.map((category) => (
  category.restaurant_id ? ( // Check if restaurant_id exists
    <Link
      href={`/restaurants/${category.restaurant_id._id}`} // Navigate to restaurant based on restaurant_id
      key={category._id}
    >
      <Card className="overflow-hidden h-48 relative group">
        <Image
          src={category.image_url || "/placeholder.svg"}
          alt={category.name}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center p-6">
          <div className="text-white">
            <h2 className="text-2xl font-bold mb-2">{category.name}</h2>
            <p className="text-white/80 mb-4">{category.description}</p>
            <Button
              variant="outline"
              className="bg-white/20 hover:bg-white/30 text-white border-white/40 backdrop-blur-sm"
            >
              Explore <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  ) : null // If restaurant_id is null, don't render the link
))}

            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl font-medium">No categories found</p>
            </div>
          )}

          {/* Restaurant by categories */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold">Restaurants by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((restaurant) => (
                <Link
                  href={`/restaurants/${restaurant._id}`}
                  key={restaurant._id}
                  className="overflow-hidden h-full"
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video relative">
                      <Image
                        src={restaurant.image || "/placeholder.svg"}
                        alt={restaurant.name}
                        fill
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-xl font-bold">{restaurant.name}</h3>
                      <p className="text-gray-500">{restaurant.cuisines.join(", ")}</p>
                      <p className="text-gray-700">Rating: {restaurant.rating}</p>
                      <p className="text-gray-700">Delivery Time: {restaurant.deliveryTime}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
