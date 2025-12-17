"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

export function QRShare() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label="Share this page"
        >
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this page</DialogTitle>
          <DialogDescription>
            Scan the QR code to share this page with others
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative aspect-square w-full max-w-[280px] rounded-lg border bg-white p-4">
            <Image
              src="/qr/qrcode.png"
              alt="QR code to share this page"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center space-y-2">
            <p className="font-semibold text-lg">www.Brand-Sight.com</p>
            <p className="text-sm text-muted-foreground">
              Point your camera at the QR code to visit this page
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

