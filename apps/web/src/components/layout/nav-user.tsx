"use client";

import { useState, useEffect } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { signOutAction } from "@/server/actions/signout";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function NavUser({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}) {
  const { isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDeleteRequest = async () => {
    setIsSubmitting(true);
    // Simulate sending the request (in production, this would call an API)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setRequestSent(true);
  };

  const handleCloseAccountDialog = () => {
    setAccountDialogOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setRequestSent(false);
      setDeleteReason("");
    }, 200);
  };

  // Generate initials for avatar fallback
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  const displayName = user.name ?? "User";
  const displayEmail = user.email ?? "";

  if (!mounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image ?? undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{displayEmail}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image ?? undefined} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setAccountDialogOpen(true)}>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOutAction()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Account Dialog */}
        <Dialog open={accountDialogOpen} onOpenChange={handleCloseAccountDialog}>
          <DialogContent className="sm:max-w-md">
            {requestSent ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="p-4 bg-green-500/10 rounded-full text-green-500">
                  <CheckCircle2 className="size-12" />
                </div>
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-center">Request Sent!</DialogTitle>
                  <DialogDescription className="text-center">
                    We&apos;ve received your account deletion request. Our team will review it and get back to you within 48 hours.
                  </DialogDescription>
                </DialogHeader>
                <Button onClick={handleCloseAccountDialog} variant="outline">
                  Close
                </Button>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Account Settings</DialogTitle>
                  <DialogDescription>
                    Manage your account preferences and settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Account Information</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><span className="font-medium">Name:</span> {user.name ?? "Not set"}</p>
                      <p><span className="font-medium">Email:</span> {user.email ?? "Not set"}</p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm text-destructive mb-2">Delete Account</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Request to permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="delete-reason">Reason for leaving (optional)</Label>
                      <Textarea
                        id="delete-reason"
                        placeholder="Please let us know why you want to delete your account..."
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleCloseAccountDialog}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteRequest}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Request Account Deletion"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
