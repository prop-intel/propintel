# Phase 3: User Navigation

## Overview

Connect NavUser component to session data and implement working logout functionality.

## Dependencies

- None (uses existing auth setup)

## Files to Modify

### `src/components/layout/nav-user.tsx`

Update to accept session user data and wire logout:

```typescript
"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

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

  // Generate initials for avatar fallback
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  const displayName = user.name ?? "User";
  const displayEmail = user.email ?? "";

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
              <DropdownMenuItem disabled>
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

### Key Changes from Original

1. **Prop type updated**: Changed from fixed `{ name: string; email: string; avatar: string }` to optional session-based type
2. **Avatar fallback**: Generate initials from user name instead of hardcoded "CN"
3. **Image source**: Use `user.image` from Google OAuth (was `user.avatar`)
4. **Logout wired**: Added `onClick={() => signOutAction()}` to logout menu item
5. **Disabled items**: Account, Billing, Notifications marked as `disabled` (future features)
6. **Removed Sparkles**: Removed "Upgrade to Pro" option (not applicable)

## Verification Steps

1. Log in with Google OAuth
2. Verify avatar shows Google profile picture
3. Verify name and email display correctly
4. Click "Log out" and verify redirect to `/login`
5. Verify avatar fallback shows initials when no image

## Acceptance Criteria

- [ ] NavUser displays logged-in user's name from session
- [ ] NavUser displays logged-in user's email from session
- [ ] Avatar shows Google profile picture
- [ ] Avatar fallback shows user initials (first letter of first and last name)
- [ ] Logout button triggers signOutAction
- [ ] User redirected to /login after logout
- [ ] Account, Billing, Notifications items are disabled (greyed out)
