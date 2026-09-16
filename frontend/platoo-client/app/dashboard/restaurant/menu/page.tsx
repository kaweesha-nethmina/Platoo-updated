"use client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  ArrowUpDown,
  Filter,
  ImagePlus,
} from "lucide-react";

// Currency formatting function for LKR
function formatLKR(amount: string) {
  const number = Number(amount);
  if (isNaN(number)) return amount;
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    currencyDisplay: 'symbol'
  }).format(number);
}

// Interfaces
interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: string;
  image_url?: string;
  is_available: boolean;
  is_veg: boolean;
}

interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  image_url: string;
  is_active: boolean;
  itemCount: number;
}

export default function MenuPage() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<Omit<Category, "id" | "itemCount">>({
    restaurant_id: "",  // Empty for now, will be fetched
    name: "",
    description: "",
    image_url: "",
    is_active: true,
  });

  // Menu item dialog state
  const initialItemForm = {
    name: "",
    description: "",
    price: "",
    category_id: "",
    is_available: true,
    is_veg: false,
    image_url: "",
  };
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [restaurantId, setRestaurantId] = useState<string | null>(null);  // state to hold restaurantId

  // Fetch restaurantId based on the logged-in owner
  useEffect(() => {
    const ownerId = localStorage.getItem("restaurantOwnerId");  // Fetch the ownerId from localStorage
    if (!ownerId) return;  // If no ownerId is available, exit

    const fetchRestaurantId = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/restaurants/owner/${ownerId}`);
        if (!response.ok) throw new Error("Failed to fetch restaurant data");
        const data = await response.json();
        
        if (data.length > 0) {
          const restaurant = data[0];
          setRestaurantId(restaurant._id); // Set the restaurantId from the fetched data
          setCategoryForm((prevForm) => ({ ...prevForm, restaurant_id: restaurant._id }));
        } else {
          console.error("No restaurant found for this owner");
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error);
      }
    };

    fetchRestaurantId();
  }, []);

  // Fetch menu items and categories for the specific restaurant
  useEffect(() => {
    if (!restaurantId) return;  // Ensure restaurantId is available before fetching items and categories

    const fetchMenuItems = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/menu-items/restaurant/${restaurantId}`);
        if (!response.ok) throw new Error("Failed to fetch menu items");
        const data = await response.json();
        const normalized = data.map((item: any) => ({
          ...item,
          id: item._id || item.id,
        }));
        setMenuItems(normalized);
      } catch (error) {
        console.error("Error fetching menu items:", error);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/category/${restaurantId}`);
        if (!response.ok) throw new Error("Failed to fetch categories");
        const data = await response.json();
        const normalized = data.map((category: any) => ({
          ...category,
          id: category._id || category.id,
        }));
        setCategories(normalized);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchMenuItems();
    fetchCategories();
  }, [restaurantId]);

  // Filtering
  const filteredItems = menuItems.filter((item) => {
    if (selectedCategory !== "all" && item.category_id !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Category CRUD handlers
  const openAddCategoryDialog = () => {
    setEditingCategory(null);
    setCategoryForm({
      restaurant_id: restaurantId || "",  // Automatically filled with restaurantId
      name: "",
      description: "",
      image_url: "",
      is_active: true,
    });
    setIsCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      restaurant_id: category.restaurant_id,
      name: category.name,
      description: category.description,
      image_url: category.image_url,
      is_active: category.is_active,
    });
    setIsCategoryDialogOpen(true);
  };

  const handleCategoryFormChange = (field: keyof Omit<Category, "id" | "itemCount">, value: any) => {
    setCategoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddCategory = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      if (!response.ok) throw new Error("Failed to add category");
      const newCategory: Category = await response.json();
      setCategories((prev) => [...prev, newCategory]);
      setIsCategoryDialogOpen(false);
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    try {
      const response = await fetch(`http://localhost:3001/api/category/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editingCategory, ...categoryForm }),
      });
      if (!response.ok) throw new Error("Failed to update category");
      const updated: Category = await response.json();
      setCategories((prev) =>
        prev.map((cat) => (cat.id === updated.id ? updated : cat))
      );
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/category/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete category");
      setCategories((prevCategories) => prevCategories.filter((category) => category.id !== id));
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // Menu item handlers
  const openAddItemDialog = () => {
    setSelectedItem(null);
    setItemForm(initialItemForm);
    setIsAddItemOpen(true);
  };

  const handleEditItem = (item: MenuItem) => {
    setSelectedItem(item);
    setItemForm({
      name: item.name || "",
      description: item.description || "",
      price: item.price?.toString() || "",
      category_id: item.category_id || "",
      is_available: item.is_available ?? true,
      is_veg: item.is_veg ?? false,
      image_url: item.image_url || "",
    });
    setIsAddItemOpen(true);
  };

  const handleAddItem = async (newItem: Omit<MenuItem, "id">) => {
    try {
      const response = await fetch("http://localhost:3001/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!response.ok) throw new Error("Failed to add menu item");
      const created: MenuItem = await response.json();
      setMenuItems((prev) => [...prev, created]);
    } catch (error) {
      console.error("Error adding menu item:", error);
    }
  };

  const handleUpdateItem = async (updatedItem: MenuItem) => {
    try {
      const response = await fetch(`http://localhost:3001/api/menu-items/${updatedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem),
      });
      if (!response.ok) throw new Error("Failed to update menu item");
      const updatedData: MenuItem = await response.json();
      setMenuItems((prevItems) =>
        prevItems.map((item) => (item.id === updatedData.id ? updatedData : item))
      );
    } catch (error) {
      console.error("Error updating menu item:", error);
    }
  };
  const handleToggleAvailability = async (id: string) => {
    try {
      const updatedAvailability = !menuItems.find((item) => item.id === id)?.is_available;
      const response = await fetch(`http://localhost:3001/api/menu-items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: updatedAvailability }),
      });
      if (!response.ok) throw new Error("Failed to update availability");
      const updatedItem: MenuItem = await response.json();
      setMenuItems((prevItems) =>
        prevItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
    } catch (error) {
      console.error("Error toggling availability:", error);
    }
  };
  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/menu-items/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete menu item");
      setMenuItems((prevItems) => prevItems.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error deleting menu item:", error);
    }
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground">Create and manage your restaurant menu items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAddCategoryDialog}>
            Manage Categories
          </Button>
          <Button onClick={openAddItemDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Tabs for Menu Items and Categories */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items">Menu Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        {/* Menu Items Tab Content */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search menu items..."
                  className="pl-8 w-[200px] sm:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader className="p-4">
              <CardTitle>Menu Items</CardTitle>
              <CardDescription>{filteredItems.length} items found</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>
                      <div className="flex items-center">
                        Status
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Popular</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image_url || "/placeholder.svg"}
                            alt={item.name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categories.find((cat) => cat.id === item.category_id)?.name || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      {/* Price in LKR */}
                      <TableCell>{formatLKR(item.price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={() => handleToggleAvailability(item.id)}
                          />
                          <span className={item.is_available ? "text-green-600" : "text-red-600"}>
                            {item.is_available ? "Available" : "Unavailable"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.is_veg && <Badge className="bg-orange-500 hover:bg-orange-600">Vegetarian</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditItem(item)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab Content */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle>Menu Categories</CardTitle>
              <CardDescription>Organize your menu with categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <Card key={category.id} className="overflow-hidden shadow-md group flex flex-col">
                    {/* Category Image */}
                    <div className="relative h-40 w-full bg-gray-100">
                      <img
                        src={category.image_url || "/placeholder.svg"}
                        alt={category.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    {/* Card Content */}
                    <CardContent className="flex-1 flex flex-col justify-between p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{category.name}</h3>
                          <span className="text-sm text-muted-foreground">{category.itemCount} items</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditCategoryDialog(category)}
                            className="hover:bg-muted"
                          >
                            <Edit className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-red-100 text-red-600"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      {/* Description below name */}
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{category.description}</p>
                      )}
                      <div className="mt-3">
                        <Badge variant={category.is_active ? "default" : "secondary"}>
                          {category.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {/* Add New Category Card */}
                <Card className="border-dashed flex items-center justify-center min-h-[200px]">
                  <CardContent className="flex flex-col items-center justify-center w-full h-full p-6">
                    <Button
                      variant="ghost"
                      className="w-full h-24"
                      onClick={openAddCategoryDialog}
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Add New Category
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the details of your category"
                : "Add a new category to your restaurant"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="Category name"
                value={categoryForm.name}
                onChange={(e) => handleCategoryFormChange("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                placeholder="Category description"
                value={categoryForm.description}
                onChange={(e) => handleCategoryFormChange("description", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-image">Image URL</Label>
              <Input
                id="category-image"
                placeholder="https://example.com/image.jpg"
                value={categoryForm.image_url}
                onChange={(e) => handleCategoryFormChange("image_url", e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="category-active"
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => handleCategoryFormChange("is_active", checked)}
              />
              <Label htmlFor="category-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
            >
              {editingCategory ? "Update Category" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Menu Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Menu Item" : "Add New Menu Item"}</DialogTitle>
            <DialogDescription>
              {selectedItem
                ? "Update the details of your menu item"
                : "Add a new item to your restaurant menu"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 p-1">
              {/* Image Upload/Preview */}
              <div className="space-y-2">
                <Label htmlFor="item-image">Item Image</Label>
                <div className="flex items-center justify-center border-2 border-dashed rounded-md p-4">
                  {itemForm.image_url ? (
                    <div className="text-center">
                      <img
                        src={itemForm.image_url}
                        alt={itemForm.name}
                        className="mx-auto h-32 w-32 rounded-md object-cover"
                      />
                      <Button variant="outline" size="sm" className="mt-2" disabled>
                        <ImagePlus className="mr-2 h-4 w-4" /> Change Image
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImagePlus className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="mt-2">
                        <Button variant="outline" size="sm" disabled>
                          Upload Image
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">PNG, JPG or GIF, max 2MB</p>
                    </div>
                  )}
                </div>
                <Input
                  id="item-image"
                  placeholder="Image URL"
                  value={itemForm.image_url}
                  onChange={(e) => setItemForm((f) => ({ ...f, image_url: e.target.value }))}
                />
              </div>
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="item-name">Item Name</Label>
                <Input
                  id="item-name"
                  placeholder="Enter item name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="item-description">Description</Label>
                <Textarea
                  id="item-description"
                  placeholder="Enter item description"
                  value={itemForm.description}
                  onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              {/* Price and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-price">Price</Label>
                  <Input
                    id="item-price"
                    placeholder="Rs 0.00"
                    type="number"
                    value={itemForm.price}
                    onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-category">Category</Label>
                  <select
                    id="item-category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={itemForm.category_id}
                    onChange={(e) => setItemForm((f) => ({ ...f, category_id: e.target.value }))}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Availability and Veg Switches */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="item-available"
                    checked={itemForm.is_available}
                    onCheckedChange={(checked) =>
                      setItemForm((f) => ({ ...f, is_available: checked }))
                    }
                  />
                  <Label htmlFor="item-available">Available</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="item-veg"
                    checked={itemForm.is_veg}
                    onCheckedChange={(checked) =>
                      setItemForm((f) => ({ ...f, is_veg: checked }))
                    }
                  />
                  <Label htmlFor="item-veg">Vegetarian</Label>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddItemOpen(false);
              setSelectedItem(null);
              setItemForm(initialItemForm);
            }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Validate required fields
                if (!itemForm.name || !itemForm.category_id || !itemForm.price) return;
                const newItem = {
                  ...itemForm,
                  price: itemForm.price,
                };
                if (selectedItem) {
                  await handleUpdateItem({ ...selectedItem, ...newItem });
                } else {
                  await handleAddItem(newItem as any);
                }
                setIsAddItemOpen(false);
                setSelectedItem(null);
                setItemForm(initialItemForm);
              }}
            >
              {selectedItem ? "Update Item" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
