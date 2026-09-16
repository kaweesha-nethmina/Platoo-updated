"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Star, Clock, MapPin, Heart, Minus, Plus, ShoppingCart, X } from "lucide-react"
import { useCart } from "@/hooks/useCart"; // Import the useCart hook

interface MenuItem {
  _id: string
  name: string
  description: string
  price: number
  image_url: string
  is_veg: boolean
  is_available: boolean
  category_id: string
}

interface MenuCategory {
  _id: string
  name: string
  description: string
  image_url: string
}

interface Restaurant {
  _id: string
  name: string
  image: string
  rating: number
  reviewCount: number
  deliveryTime: string
  deliveryFee: string
  minOrder: string
  distance: string
  address: string
  cuisines: string[]
  priceLevel: number
  description: string
}

interface CartItem {
  id: string
  menuItemId: string
  name: string
  price: number
  quantity: number
}

export default function RestaurantPage() {
  const { id } = useParams()
  const router = useRouter()
  const { cartItems } = useCart()
  const cartCount = cartItems.length;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menu, setMenu] = useState<MenuCategory[]>([]) // Initialize with an empty array
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]) // Initialize with an empty array for menu items
  const [isLoading, setIsLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);


  useEffect(() => {
    const fetchRestaurantData = async () => {
      setIsLoading(true)
      try {
        // Fetch restaurant data using the restaurant ID from the URL
        const restaurantResponse = await fetch(`http://localhost:3001/api/restaurants/${id}`)
        const restaurantData: Restaurant = await restaurantResponse.json()
        setRestaurant(restaurantData)

        // Fetch menu details for the restaurant
        const menuResponse = await fetch(`http://localhost:3001/api/restaurants/${id}/details`)
        const menuData = await menuResponse.json()

        if (menuData && Array.isArray(menuData.categories)) {
          setMenu(menuData.categories)
          setMenuItems(menuData.menuItems) // Set the menu items here
          if (menuData.categories.length > 0) {
            setActiveCategory(menuData.categories[0]._id)
          }
        } else {
          console.warn("Menu categories are not in the expected format:", menuData)
          setMenu([]) // Set an empty array if the categories are not in the expected format
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRestaurantData()

    // Load cart from localStorage if available
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
  }, [id])

  useEffect(() => {
    // Save cart to localStorage whenever it changes
    localStorage.setItem("cart", JSON.stringify(cart))
  }, [cart])

  const addToCart = async (item: MenuItem) => {
    try {
      // Retrieve userId from localStorage
      const userId = localStorage.getItem("userId");
  
      if (!userId) {
        console.error("User is not logged in. Cart operation cannot proceed.");
        return;
      }
  
      // Send POST request to API to add item to cart
      const response = await fetch("http://localhost:3005/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId, // Send userId along with the cart data
          productId: item._id, // Ensure we are sending `productId`, matching your Cart model
          name: item.name,
          price: item.price, // Only the item price (no delivery fee or tax)
          quantity: 1, // Default to 1, but adjust based on the logic if needed
          image: item.image_url, // Pass the image URL here
        }),
      });
  
      if (response.ok) {
        const cartData = await response.json();
        console.log("Item added to cart:", cartData);
  
        // Update local state for cart
        setCart((prevCart) => [
          ...prevCart,
          {
            id: `cart-${Date.now()}`,
            menuItemId: item._id,
            name: item.name,
            price: item.price,
            quantity: 1,
            image: item.image_url, // Store the item image URL here
          },
        ]);
  
        // Show cart after adding item
        setIsCartOpen(true);
      } else {
        console.error("Failed to add item to cart");
      }
    } catch (error) {
      console.error("Error adding item to cart:", error);
    }
  };
  
  
  


const orderNow = (item: MenuItem) => {
  // Set the selected item and navigate to checkout
  setSelectedItem(item);
  setSelectedQuantity(1); // Start with quantity 1

  // Store the selected item in localStorage
  localStorage.setItem('selectedItem', JSON.stringify(item));
  localStorage.setItem('selectedQuantity', '1'); // Optionally store the quantity

  // Navigate to the checkout page
  router.push("/checkout"); // Navigate to checkout page
};




  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getCartItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header cartCount={getCartItemCount()} />
        <div className="flex justify-center items-center h-[50vh]">
          <p className="text-gray-500">Loading restaurant information...</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header cartCount={getCartItemCount()} />
        <div className="flex flex-col justify-center items-center h-[50vh]">
          <p className="text-gray-500 mb-4">Restaurant not found</p>
          <Button onClick={() => router.push("/restaurants")}>Back to Restaurants</Button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header cartCount={cartCount} />

      <main className="pb-20">
        <div className="relative h-64 md:h-80 bg-gray-200">
          <img
            src={restaurant.image || "/placeholder.svg"}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          <div className="absolute bottom-0 left-0 w-full p-6 text-white">
            <div className="max-w-[1400px] mx-auto flex items-end">
              <div className="mr-4 bg-white rounded-lg p-1 shadow-md">
                <img
                  src={restaurant.image || "/placeholder.svg"}
                  alt={`${restaurant.name} logo`}
                  className="w-20 h-20 object-cover rounded"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{restaurant.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                    <span>{restaurant.rating}</span>
                    <span className="ml-1 text-sm">({restaurant.reviewCount} reviews)</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{restaurant.deliveryTime}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{restaurant.distance}</span>
                  </div>
                  <Badge variant="outline" className="bg-white/20 text-white border-white/40">
                    {Array(restaurant.priceLevel).fill("$").join("")}
                  </Badge>
                </div>
              </div>
              <div className="ml-auto">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Heart className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/4">
              <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
                <h3 className="font-bold text-lg mb-4">Menu</h3>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="pr-4 space-y-1">
                    {menu.map((category) => (
                      <button
                        key={category._id}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          activeCategory === category._id
                            ? "bg-red-50 text-red-500 font-medium"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={() => setActiveCategory(category._id)}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="md:w-3/4">
              {menu.length > 0 &&
                menu
                  .filter((category) => category._id === activeCategory) // Show only active category
                  .map((category) => {
                    const filteredMenuItems = menuItems.filter(
                      (item) => item.category_id === category._id
                    )

                    return (
                      <div key={category._id}>
                        <h2 className="font-bold text-xl mb-4">{category.name}</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {filteredMenuItems.length > 0 ? (
                            filteredMenuItems.map((item) => (
                              <Card key={item._id} className="overflow-hidden">
                                <div className="flex p-4">
                                  <div className="flex-1 pr-4">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <h3 className="font-bold">{item.name}</h3>
                                        <div className="flex gap-2 mt-1">
                                          {item.is_veg && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs bg-green-50 border-green-200 text-green-700"
                                            >
                                              Vegetarian
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="font-bold">LKR {item.price.toFixed(2)}</div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>
                                    <div className="mt-3 flex justify-between items-center">
                                      <Button
                                        className="bg-orange-500 hover:bg-red-600 px-6 py-2"
                                        onClick={() => addToCart(item)}
                                      >
                                        Add to Cart
                                      </Button>
                                      <Button
                                        className="bg-green-600 hover:bg-red-600 px-6 py-2"
                                        onClick={() => orderNow(item)} // Order Now button functionality
                                      >
                                        Order Now
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="w-24 h-24 flex-shrink-0">
                                    <img
                                      src={item.image_url || "/placeholder.svg"}
                                      alt={item.name}
                                      className="w-full h-full object-cover rounded-md"
                                    />
                                  </div>
                                </div>
                              </Card>
                            ))
                          ) : (
                            <div>No items in this category</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

