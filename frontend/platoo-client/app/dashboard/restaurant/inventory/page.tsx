import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default function RestaurantInventory() {
  // Mock inventory data
  const inventoryItems = [
    {
      id: 1,
      name: "Basmati Rice",
      category: "Grains",
      quantity: 45,
      unit: "kg",
      minLevel: 10,
      maxLevel: 50,
      reorderLevel: 15,
      costPerUnit: 2.5,
      supplier: "Global Foods Inc.",
      lastUpdated: "2 days ago",
      status: "normal" // normal, low, critical
    },
    {
      id: 2,
      name: "Chicken Breast",
      category: "Meat",
      quantity: 12,
      unit: "kg",
      minLevel: 10,
      maxLevel: 30,
      reorderLevel: 15,
      costPerUnit: 8.75,
      supplier: "Premium Meats Ltd.",
      lastUpdated: "1 day ago",
      status: "low"
    },
    {
      id: 3,
      name: "Tomatoes",
      category: "Vegetables",
      quantity: 8,
      unit: "kg",
      minLevel: 5,
      maxLevel: 20,
      reorderLevel: 10,
      costPerUnit: 3.25,
      supplier: "Fresh Farms Co.",
      lastUpdated: "Today",
      status: "low"
    },
    {
      id: 4,
      name: "Yogurt",
      category: "Dairy",
      quantity: 25,
      unit: "liter",
      minLevel: 10,
      maxLevel: 30,
      reorderLevel: 15,
      costPerUnit: 2.0,
      supplier: "Dairy Delights",
      lastUpdated: "3 days ago",
      status: "normal"
    },
    {
      id: 5,
      name: "Garam Masala",
      category: "Spices",
      quantity: 2,
      unit: "kg",
      minLevel: 1,
      maxLevel: 5,
      reorderLevel: 2,
      costPerUnit: 12.5,
      supplier: "Spice World",
      lastUpdated: "1 week ago",
      status: "critical"
    },
    {
      id: 6,
      name: "Onions",
      category: "Vegetables",
      quantity: 30,
      unit: "kg",
      minLevel: 10,
      maxLevel: 40,
      reorderLevel: 15,
      costPerUnit: 1.75,
      supplier: "Fresh Farms Co.",
      lastUpdated: "2 days ago",
      status: "normal"
    },
    {
      id: 7,
      name: "Garlic",
      category: "Vegetables",
      quantity: 5,
      unit: "kg",
      minLevel: 3,
      maxLevel: 10,
      reorderLevel: 4,
      costPerUnit: 4.5,
      supplier: "Fresh Farms Co.",
      lastUpdated: "4 days ago",
      status: "low"
    },
    {
      id: 8,
      name: "Paneer",
      category: "Dairy",
      quantity: 15,
      unit: "kg",
      minLevel: 5,
      maxLevel: 20,
      reorderLevel: 8,
      costPerUnit: 7.25,
      supplier: "Dairy Delights",
      lastUpdated: "Yesterday",
      status: "normal"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'normal':
        return <Badge className="bg-green-500">Normal</Badge>;
      case 'low':
        return <Badge className="bg-yellow-500">Low</Badge>;
      case 'critical':
        return <Badge className="bg-red-500">Critical</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStockLevel = (item: any) => {
    const percentage = (item.quantity / item.maxLevel) * 100;
    return (
      <Progress 
        value={percentage} 
        className={`h-2 ${
          item.status === 'critical' ? 'bg-red-100' : 
          item.status === 'low' ? 'bg-yellow-100' : 
          'bg-green-100'
        }`}
      />
    );
  };

}