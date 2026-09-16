"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from 'lucide-react'

// Define user roles to match your backend
export enum UserRole {
  ADMIN = "admin",
  RESTAURANT_OWNER = "restaurant_owner",
  USER = "user",
  DELIVERY_MAN = "delivery_man",
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: UserRole.USER,
    phone: "",
    address: "",
    restaurantName: "",
    vehicleNumber: "",
  })
  const [formErrors, setFormErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    restaurantName: "",
    vehicleNumber: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setFormErrors({ ...formErrors, [name]: "" }) // Clear errors on input change
  }

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role: value as UserRole }))
    setFormErrors({
      ...formErrors,
      restaurantName: "",
      vehicleNumber: "",
    }) // Clear specific errors when role changes
  }

  // Frontend validation function
  const validateForm = () => {
    let errors = { name: "", email: "", password: "", confirmPassword: "", phone: "", address: "", restaurantName: "", vehicleNumber: "" }
    let isValid = true

    // Name validation
    if (!formData.name) {
      errors.name = "Full Name is required"
      isValid = false
    }

    // Email validation
    if (!formData.email) {
      errors.email = "Email is required"
      isValid = false
    } else if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(formData.email)) {
      errors.email = "Please enter a valid Gmail address"
      isValid = false
    }

    // Phone number validation (only for USER role)
    if (formData.role === UserRole.USER && !formData.phone) {
      errors.phone = "Phone number is required"
      isValid = false
    } else if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      errors.phone = "Phone number should be exactly 10 digits"
      isValid = false
    }

    // Password validation
    if (!formData.password) {
      errors.password = "Password is required"
      isValid = false
    } else if (formData.password.length < 8) {
      errors.password = "Password should be at least 8 characters"
      isValid = false
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
      isValid = false
    }

    // Address validation (required for all roles)
    if (!formData.address) {
      errors.address = "Address is required"
      isValid = false
    }

    // Role-based validation
    if (formData.role === UserRole.RESTAURANT_OWNER && !formData.restaurantName) {
      errors.restaurantName = "Restaurant Name is required"
      isValid = false
    }

    if (formData.role === UserRole.DELIVERY_MAN && !formData.vehicleNumber) {
      errors.vehicleNumber = "Vehicle Number is required"
      isValid = false
    }

    setFormErrors(errors)
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const { confirmPassword, ...dataToSend } = formData // Remove confirmPassword from request data

      const response = await fetch("http://localhost:4000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.msg || "Registration failed")
      }

      toast({
        title: "Registration successful",
        description: "Your account has been created successfully.",
      })

      router.push("/login")
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 bg-cover bg-center bg-fixed"
      style={{ 
        backgroundImage: "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2074&auto=format&fit=crop')",
      }}
    >
      <div className="fixed inset-0 bg-black/60" />
      
      <Card className="w-full max-w-lg relative bg-white/20 backdrop-blur-md border-white/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-red-600/10 rounded-lg" />
        <CardHeader className="space-y-1 relative">
          <CardTitle className="text-3xl font-bold text-center text-white">Create an account</CardTitle>
          <CardDescription className="text-center text-white/80">
            Enter your information to create your Platoo account
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">Full Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
                className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
              />
              {formErrors.name && <p className="text-red-500 text-sm">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
              />
              {formErrors.email && <p className="text-red-500 text-sm">{formErrors.email}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
                />
                {formErrors.password && <p className="text-red-500 text-sm">{formErrors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
                />
                {formErrors.confirmPassword && <p className="text-red-500 text-sm">{formErrors.confirmPassword}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Account Type</Label>
              <RadioGroup 
                value={formData.role} 
                onValueChange={handleRoleChange}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={UserRole.USER} id="user" className="border-white text-white" />
                  <Label htmlFor="user" className="cursor-pointer text-white">
                    Customer
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={UserRole.RESTAURANT_OWNER} id="restaurant" className="border-white text-white" />
                  <Label htmlFor="restaurant" className="cursor-pointer text-white">
                    Restaurant Owner
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value={UserRole.DELIVERY_MAN} id="delivery" className="border-white text-white" />
                  <Label htmlFor="delivery" className="cursor-pointer text-white">
                    Delivery Person
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={handleChange}
                required
                className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
              />
              {formErrors.phone && <p className="text-red-500 text-sm">{formErrors.phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-white">Address</Label>
              <Input
                id="address"
                name="address"
                placeholder="123 Main St, City, Country"
                value={formData.address}
                onChange={handleChange}
                required
                className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
              />
              {formErrors.address && <p className="text-red-500 text-sm">{formErrors.address}</p>}
            </div>

            {formData.role === UserRole.RESTAURANT_OWNER && (
              <div className="space-y-2">
                <Label htmlFor="restaurantName" className="text-white">Restaurant Name</Label>
                <Input
                  id="restaurantName"
                  name="restaurantName"
                  placeholder="Your Restaurant Name"
                  value={formData.restaurantName}
                  onChange={handleChange}
                  required
                  className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
                />
                {formErrors.restaurantName && <p className="text-red-500 text-sm">{formErrors.restaurantName}</p>}
              </div>
            )}

            {formData.role === UserRole.DELIVERY_MAN && (
              <div className="space-y-2">
                <Label htmlFor="vehicleNumber" className="text-white">Vehicle Number</Label>
                <Input
                  id="vehicleNumber"
                  name="vehicleNumber"
                  placeholder="ABC-1234"
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  required
                  className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
                />
                {formErrors.vehicleNumber && <p className="text-red-500 text-sm">{formErrors.vehicleNumber}</p>}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 relative">
          <div className="text-center text-sm text-white">
            Already have an account?{" "}
            <Link href="/login" className="text-orange-300 hover:text-orange-200 hover:underline font-medium">
              Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
