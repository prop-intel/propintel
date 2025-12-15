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
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md"
    >
      <div className="container relative mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          Brandsight
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2">
          <Link href="/#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="/how-it-works" className="hover:text-foreground transition-colors">
            How it Works
          </Link>
          <Link href="/enterprise" className="hover:text-foreground transition-colors">
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
              <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:block">
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
