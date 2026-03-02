"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Briefcase, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resume", label: "My Resume", icon: FileText },
  { href: "/jds", label: "Job Listings", icon: Briefcase },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

function SidebarContent({
  onClose,
}: {
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b">
        <span className="text-xl font-bold text-primary">JobFit Pro</span>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">JobFit Pro v0.1</p>
      </div>
    </aside>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </div>

      {/* Mobile: overlay drawer */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <SidebarContent onClose={onClose} />
          </div>
        </>
      )}
    </>
  );
}
