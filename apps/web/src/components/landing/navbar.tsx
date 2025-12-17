"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session } = useSession();
  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-background/80 fixed left-0 right-0 top-0 z-50 backdrop-blur-md"
    >
      <div className="container relative mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          Brand-Sight.com
        </Link>

        <nav className="text-muted-foreground absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 text-sm font-medium md:flex">
          <Link
            href="/#features"
            className="hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="/how-it-works"
            className="hover:text-foreground transition-colors"
          >
            How it Works
          </Link>
          <Link
            href="/enterprise"
            className="hover:text-foreground transition-colors"
          >
            Enterprise
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="gap-2"
              >
                <LogOut className="size-4" />
                Log Out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground hidden text-sm font-medium sm:block"
              >
                Sign In
              </Link>
              <Link href="/dashboard">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
