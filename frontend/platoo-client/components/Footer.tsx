import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Facebook, Instagram, Twitter, Send, MapPin, Phone, Mail } from "lucide-react"

const Footer = () => {
  return (
    <footer className="relative bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 pt-16 pb-8">
      {/* Decorative top wave */}
      <div className="absolute top-0 left-0 right-0 h-8 overflow-hidden">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="absolute bottom-0 w-full h-12 text-white"
          fill="currentColor"
        >
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
        </svg>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-orange-600">Platoo</h3>
              <div className="h-1 w-10 bg-orange-500 mt-2 rounded-full"></div>
            </div>
            <p className="text-gray-600">
              Delicious food delivered to your door, bringing restaurant-quality meals to your home with just a few
              taps.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-orange-500" />
                <span className="text-gray-600">123 Foodie Street, Tasty City</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-orange-500" />
                <span className="text-gray-600">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-orange-500" />
                <span className="text-gray-600">hello@platoo.com</span>
              </div>
            </div>

            {/* Social Icons */}
            <div className="flex space-x-4 pt-2">
              <a
                href="#"
                className="bg-white p-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <Facebook className="h-5 w-5 text-orange-500" />
                <span className="sr-only">Facebook</span>
              </a>
              <a
                href="#"
                className="bg-white p-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <Instagram className="h-5 w-5 text-orange-500" />
                <span className="sr-only">Instagram</span>
              </a>
              <a
                href="#"
                className="bg-white p-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <Twitter className="h-5 w-5 text-orange-500" />
                <span className="sr-only">Twitter</span>
              </a>
            </div>
          </div>

          {/* Quick Links Columns */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-gray-800">Explore</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/restaurants"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Restaurants
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  href="/offers"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Special Offers
                </Link>
              </li>
              <li>
                <Link
                  href="/popular"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Popular Items
                </Link>
              </li>
              <li>
                <Link
                  href="/near-me"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Near Me
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-6 text-gray-800">About</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-gray-600 hover:text-orange-500 transition-colors flex items-center">
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-gray-600 hover:text-orange-500 transition-colors flex items-center">
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/partners"
                  className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                >
                  <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                  Partner With Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Subscription */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Subscribe</h3>
            <p className="text-gray-600">Subscribe to our newsletter for exclusive offers and updates.</p>

            <div className="flex flex-col space-y-3">
              <div className="relative">
                <Input
                  type="email"
                  placeholder="Your email address"
                  className="pr-10 bg-white/80 backdrop-blur-sm border-orange-100 focus:border-orange-300"
                />
                <Button size="sm" className="absolute right-1 top-1 h-8 w-8 p-0 bg-orange-500 hover:bg-orange-600">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Subscribe</span>
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                By subscribing, you agree to our{" "}
                <Link href="/terms" className="text-orange-500 hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-orange-500 hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Help Links */}
            <div className="pt-4">
              <h3 className="text-lg font-bold mb-4 text-gray-800">Help</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/faq" className="text-gray-600 hover:text-orange-500 transition-colors flex items-center">
                    <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/support"
                    className="text-gray-600 hover:text-orange-500 transition-colors flex items-center"
                  >
                    <span className="h-1 w-2 bg-orange-400 rounded-full mr-2"></span>
                    Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section with Copyright */}
        <div className="mt-16 pt-8 border-t border-orange-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-600 text-sm">&copy; {new Date().getFullYear()} Platoo. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/terms" className="text-gray-600 hover:text-orange-500 text-sm">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-600 hover:text-orange-500 text-sm">
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-gray-600 hover:text-orange-500 text-sm">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

