"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, ListChecks, LogOut, Shield, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/actions";
import { isModerator, type UserRole } from "@/lib/auth/roles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
};

export function UserMenu({ username, displayName, avatarUrl, role }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    await signOutAction();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  }

  const label = displayName ?? username;
  const initials = label.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <Avatar>
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={label} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{label}</span>
            <span className="text-xs font-normal text-muted-foreground">
              @{username}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserIcon />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/saved">
            <Bookmark />
            Saved builds
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/perks">
            <ListChecks />
            My Perks
          </Link>
        </DropdownMenuItem>
        {isModerator(role) ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield />
              Admin panel
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
