import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Plus, Edit, Trash2, CalendarIcon, Tag, Percent, Users, ShoppingBag } from "lucide-react"
import { format } from "date-fns"

export default function RestaurantPromotions() {
  // Mock promotion data
  const promotions = [
    {
      id: 1,
      name: "Weekend Special",
      description: "Get 20% off on all orders above $30 during weekends",
      type: "percentage",
      value: 20,
      code: "WEEKEND20",
      minOrder: 30,
      startDate: new Date(2023, 2, 15),
      endDate: new Date(2023, 4, 30),
      isActive: true,
      usageLimit: 500,
      usageCount: 215,
      applicableItems: "All menu items",
      exclusions: "Cannot be combined with other offers",
    },
    {
      id: 2,
      name: "Happy Hours",
      description: "Buy 1 Get 1 Free on selected beverages between 2-5 PM",
      type: "bogo",
      value: 100,
      code: "HAPPYHOUR",
      minOrder: 0,
      startDate: new Date(2023, 2, 1),
      endDate: new Date(2023, 5, 30),
      isActive: true,
      usageLimit: 1000,
      usageCount: 456,
      applicableItems: "Selected beverages only",
      exclusions: "Valid only between 2-5 PM",
    },
    {
      id: 3,
      name: "First Order",
      description: "Get $10 off on your first order with us",
      type: "fixed",
      value: 10,
      code: "FIRST10",
      minOrder: 25,
      startDate: new Date(2023, 0, 1),
      endDate: new Date(2023, 11, 31),
      isActive: true,
      usageLimit: 2000,
      usageCount: 876,
      applicableItems: "All menu items",
      exclusions: "One-time use per customer",
    },
    {
      id: 4,
      name: "Summer Special",
      description: "15% discount on all summer special menu items",
      type: "percentage",
      value: 15,
      code: "SUMMER15",
      minOrder: 0,
      startDate: new Date(2023, 5, 1),
      endDate: new Date(2023, 7, 31),
      isActive: false,
      usageLimit: 1500,
      usageCount: 0,
      applicableItems: "Summer special menu items only",
      exclusions: "Cannot be combined with other offers",
    },
    {
      id: 5,
      name: "Loyalty Reward",
      description: "25% off for customers who have ordered more than 10 times",
      type: "percentage",
      value: 25,
      code: "LOYAL25",
      minOrder: 0,
      startDate: new Date(2023, 1, 1),
      endDate: new Date(2023, 11, 31),
      isActive: true,
      usageLimit: 1000,
      usageCount: 342,
      applicableItems: "All menu items",
      exclusions: "Only for customers with 10+ orders",
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Promotions & Offers</h1>
        <p className="text-muted-foreground">Create and manage special offers and discounts for your customers.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            type="search"
            placeholder="Search promotions..."
            className="w-full"
            prefix={<Search className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Promotions</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Promotion</DialogTitle>
                <DialogDescription>Design a special offer to attract more customers.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" placeholder="Promotion name" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="description" className="text-right pt-2">
                    Description
                  </Label>
                  <Textarea id="description" placeholder="Describe your promotion..." className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Type
                  </Label>
                  <Select>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select promotion type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Discount</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="bogo">Buy One Get One</SelectItem>
                      <SelectItem value="free-item">Free Item</SelectItem>
                      <SelectItem value="free-delivery">Free Delivery</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="value" className="text-right">
                    Value
                  </Label>
                  <div className="col-span-3 flex items-center">
                    <Input id="value" type="number" placeholder="20" />
                    <span className="ml-2">%</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">
                    Promo Code
                  </Label>
                  <Input id="code" placeholder="SUMMER20" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="min-order" className="text-right">
                    Min. Order
                  </Label>
                  <div className="col-span-3 flex items-center">
                    <span className="mr-2">$</span>
                    <Input id="min-order" type="number" placeholder="30" />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Date Range</Label>
                  <div className="col-span-3 flex flex-col gap-2 sm:flex-row">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal sm:w-[200px]">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          <span>Start Date</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal sm:w-[200px]">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          <span>End Date</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="usage-limit" className="text-right">
                    Usage Limit
                  </Label>
                  <Input id="usage-limit" type="number" placeholder="1000" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="applicable-items" className="text-right pt-2">
                    Applicable Items
                  </Label>
                  <Textarea
                    id="applicable-items"
                    placeholder="Which menu items does this apply to?"
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="exclusions" className="text-right pt-2">
                    Exclusions
                  </Label>
                  <Textarea
                    id="exclusions"
                    placeholder="Any exclusions or special conditions?"
                    className="col-span-3"
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="col-span-4 flex items-center space-x-2">
                    <Switch id="active" defaultChecked />
                    <Label htmlFor="active">Activate this promotion immediately</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Create Promotion</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 pt-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promo) => (
              <Card key={promo.id} className={promo.isActive ? "" : "opacity-70"}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{promo.name}</CardTitle>
                      <CardDescription className="mt-1">{promo.description}</CardDescription>
                    </div>
                    <Badge variant={promo.isActive ? "default" : "outline"}>
                      {promo.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="font-medium">Code:</span>
                      <code className="rounded bg-muted px-1 py-0.5">{promo.code}</code>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Percent className="h-4 w-4 text-primary" />
                      <span className="font-medium">Value:</span>
                      <span>
                        {promo.type === "percentage"
                          ? `${promo.value}% off`
                          : promo.type === "fixed"
                            ? `$${promo.value} off`
                            : promo.type === "bogo"
                              ? "Buy 1 Get 1 Free"
                              : "Special Offer"}
                      </span>
                    </div>
                    {promo.minOrder > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        <span className="font-medium">Min. Order:</span>
                        <span>${promo.minOrder}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium">Period:</span>
                      <span>
                        {format(promo.startDate, "MMM d")} - {format(promo.endDate, "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">Usage:</span>
                      <span>
                        {promo.usageCount} / {promo.usageLimit}
                      </span>
                      <div className="ml-1 h-2 w-24 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${(promo.usageCount / promo.usageLimit) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-0">
                  <div className="flex items-center">
                    <Switch id={`active-${promo.id}`} checked={promo.isActive} />
                    <Label htmlFor={`active-${promo.id}`} className="ml-2">
                      Active
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Similar content for other tabs (active, upcoming, expired) */}
        <TabsContent value="active" className="space-y-4 pt-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {promotions
              .filter((promo) => promo.isActive)
              .map((promo) => (
                <Card key={promo.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{promo.name}</CardTitle>
                        <CardDescription className="mt-1">{promo.description}</CardDescription>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-medium">Code:</span>
                        <code className="rounded bg-muted px-1 py-0.5">{promo.code}</code>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Percent className="h-4 w-4 text-primary" />
                        <span className="font-medium">Value:</span>
                        <span>
                          {promo.type === "percentage"
                            ? `${promo.value}% off`
                            : promo.type === "fixed"
                              ? `$${promo.value} off`
                              : promo.type === "bogo"
                                ? "Buy 1 Get 1 Free"
                                : "Special Offer"}
                        </span>
                      </div>
                      {promo.minOrder > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <ShoppingBag className="h-4 w-4 text-primary" />
                          <span className="font-medium">Min. Order:</span>
                          <span>${promo.minOrder}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium">Period:</span>
                        <span>
                          {format(promo.startDate, "MMM d")} - {format(promo.endDate, "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-medium">Usage:</span>
                        <span>
                          {promo.usageCount} / {promo.usageLimit}
                        </span>
                        <div className="ml-1 h-2 w-24 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${(promo.usageCount / promo.usageLimit) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-0">
                    <div className="flex items-center">
                      <Switch id={`active-${promo.id}`} checked={true} />
                      <Label htmlFor={`active-${promo.id}`} className="ml-2">
                        Active
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

