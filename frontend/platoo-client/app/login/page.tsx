"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/useUserContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { setUser } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
  
    try {
      const response = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.msg || "Login failed");
      }
  
      const token = data.token;
      const decoded = decodeToken(token);
  
      if (decoded?.id && decoded?.role) {
        // Clear old role-based IDs
        localStorage.removeItem("adminId");
        localStorage.removeItem("restaurantOwnerId");
        localStorage.removeItem("deliveryManId");
        localStorage.removeItem("userId");
  
        // Set role-based ID key
        switch (decoded.role) {
          case "admin":
            localStorage.setItem("adminId", decoded.id);
            break;
          case "restaurant_owner":
            localStorage.setItem("restaurantOwnerId", decoded.id);
            break;
          case "delivery_man":
            localStorage.setItem("deliveryManId", decoded.id);
            break;
          case "user":
          default:
            localStorage.setItem("userId", decoded.id);
            break;
        }
      }
  
      // Set token in localStorage
      localStorage.setItem("jwtToken", token);
  
      // Set token in context
      setUser({ token });
  
      toast({
        title: "Login successful",
        description: "You have been logged in successfully.",
      });
  
      router.push("/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  

  const decodeToken = (token: string) => {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch (error) {
      console.error("Error decoding token", error);
      return {};
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 bg-cover bg-center bg-fixed"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop')",
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <Card className="w-full max-w-md relative bg-white/20 backdrop-blur-md border-white/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-red-600/10 rounded-lg" />
        <CardHeader className="space-y-1 relative">
          <CardTitle className="text-3xl font-bold text-center text-white">
            Login to Platoo
          </CardTitle>
          <CardDescription className="text-center text-white/80">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-orange-300 hover:text-orange-200 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/30 border-white/30 text-white placeholder:text-white/60 focus:border-orange-400 focus:ring-orange-400"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 relative">
          <div className="text-center text-sm text-white">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-orange-300 hover:text-orange-200 hover:underline font-medium"
            >
              Register
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
