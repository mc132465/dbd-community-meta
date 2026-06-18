"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { mainNav } from "@/config/nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MobileNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/search">Search</Link>
        </DropdownMenuItem>
        {mainNav.map((item) =>
          item.disabled ? (
            <DropdownMenuItem
              key={item.title}
              disabled
              className="justify-between"
            >
              {item.title}
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.title} asChild>
              <Link href={item.href}>{item.title}</Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
