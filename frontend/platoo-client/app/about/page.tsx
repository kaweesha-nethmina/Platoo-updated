"use client";

import { useCart } from "@/hooks/useCart"; // Import the useCart hook
import { UtensilsCrossed, Users, Clock, Award, MapPin, Phone, Mail, Globe } from "lucide-react";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AboutPage() {
  // Use the useCart hook to get cart items and cart count
  const { cartItems } = useCart(); // You can access cartItems, subtotal, etc.
  const cartCount = cartItems.length; // Get the count of items in the cart

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Add the Header */}
      <Header cartCount={cartCount} />

      <div className="container py-8">
        <div className="flex flex-col gap-8">
          {/* Hero Section */}
          <div className="relative rounded-xl overflow-hidden h-[300px] md:h-[400px]">
            <Image
              src="/aboutUsBanner.png?height=800&width=1600"
              alt="About Platoo"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center">
              <div className="text-white p-8 md:p-12 max-w-2xl">
                <h1 className="text-4xl md:text-5xl font-bold mb-4">About Platoo</h1>
                <p className="text-lg text-white/90">Connecting food lovers with the best restaurants since 2020</p>
              </div>
            </div>
          </div>

          {/* Our Story */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Our Story</h2>
              <p className="text-gray-600 mb-4">
                Platoo was founded in 2020 with a simple mission: to connect food lovers with the best restaurants in
                their area. What started as a small startup with just a handful of restaurant partners has grown into a
                platform serving thousands of customers daily across multiple cities.
              </p>
              <p className="text-gray-600">
                Our team is passionate about food and technology, and we're constantly innovating to provide the best
                possible experience for both our customers and restaurant partners. We believe that everyone deserves
                access to great food, delivered quickly and reliably.
              </p>
            </div>
            <div className="relative h-[300px] rounded-xl overflow-hidden">
              <Image src="/story.png?height=600&width=800" alt="Platoo team" fill className="object-cover" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="bg-orange-100 p-3 rounded-full mb-4">{stat.icon}</div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</h3>
                  <p className="text-gray-500">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          {/* Our Values */}
          <div>
            <h2 className="text-3xl font-bold mb-6 text-center">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {values.map((value) => (
                <Card key={value.title}>
                  <CardContent className="p-6">
                    <div className="bg-orange-100 p-3 rounded-full w-fit mb-4">{value.icon}</div>
                    <h3 className="text-xl font-bold mb-2">{value.title}</h3>
                    <p className="text-gray-600">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Team */}
          <div>
            <h2 className="text-3xl font-bold mb-6 text-center">Meet Our Team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {team.map((member) => (
                <Card key={member.name} className="overflow-hidden">
                  <div className="aspect-square relative">
                    <Image src={member.image || "/placeholder.svg"} alt={member.name} fill className="object-cover" />
                  </div>
                  <CardContent className="p-4 text-center">
                    <h3 className="font-bold">{member.name}</h3>
                    <p className="text-gray-500 text-sm">{member.role}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-3xl font-bold mb-4">Contact Us</h2>
              <p className="text-gray-600 mb-6">
                Have questions, feedback, or want to partner with us? We'd love to hear from you!
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-gray-600">123 Food Street, Cuisine City, FC 10001</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-gray-600">+1 (555) 123-4567</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-gray-600">info@platoo.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Website</p>
                    <p className="text-gray-600">www.platoo.com</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative h-[300px] rounded-xl overflow-hidden">
              <Image src="/contactUs.png?height=600&width=800" alt="Office location" fill className="object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Add Footer */}
      <Footer />
    </div>
  );
}

const stats = [
  {
    value: "500+",
    label: "Restaurant Partners",
    icon: <UtensilsCrossed className="h-6 w-6 text-orange-500" />,
  },
  {
    value: "100K+",
    label: "Happy Customers",
    icon: <Users className="h-6 w-6 text-orange-500" />,
  },
  {
    value: "30 min",
    label: "Average Delivery Time",
    icon: <Clock className="h-6 w-6 text-orange-500" />,
  },
  {
    value: "15+",
    label: "Cities Served",
    icon: <MapPin className="h-6 w-6 text-orange-500" />,
  },
];

const values = [
  {
    title: "Quality First",
    description: "We partner only with restaurants that meet our high standards for food quality and preparation.",
    icon: <Award className="h-6 w-6 text-orange-500" />,
  },
  {
    title: "Customer Satisfaction",
    description:
      "Our customers are at the heart of everything we do. We're committed to providing an exceptional experience.",
    icon: <Users className="h-6 w-6 text-orange-500" />,
  },
  {
    title: "Innovation",
    description:
      "We're constantly improving our platform and services to make food delivery faster, more reliable, and more convenient.",
    icon: <Globe className="h-6 w-6 text-orange-500" />,
  },
];

const team = [
  {
    name: "Kaweesha Nethmina",
    role: "CEO & Founder",
    image: "/kawee.jpg?height=300&width=300",
  },
  {
    name: "Hiruni Chamathka",
    role: "CTO",
    image: "/hiruni.jpg?height=300&width=300",
  },
  {
    name: "Desima Weerasinhe",
    role: "Head of Operations",
    image: "/desima.jpg?height=300&width=300",
  },
  {
    name: "Nimesh ....",
    role: "Marketing Director",
    image: "/nimesh.jpg?height=300&width=300",
  },
];
