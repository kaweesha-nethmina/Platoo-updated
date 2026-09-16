import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-cover bg-center bg-gradient-to-b from-orange-50 to-orange-100"
      style={{ backgroundImage: 'url(/mainBackground.jpeg)' }}
    >
      <div className="bg-black bg-opacity-70 w-full min-h-screen flex flex-col items-center justify-center">
        <div className="container flex flex-col items-center justify-center gap-6 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
            Platoo
          </h1>
          <p className="text-xl text-gray-200">
            Your favorite food ordering platform
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Link href="/login">Login</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-orange-600 text-orange-600 bg-white hover:bg-orange-50"
            >
              <Link href="/register">Register</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}