import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Package, Receipt, Car, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/app/inventory", label: "Inventory", icon: Package },
  { to: "/app/expenses", label: "Expenses", icon: Receipt },
  { to: "/app/logbook", label: "Logbook", icon: Car },
  { to: "/app/listing-ai", label: "Listing AI", icon: Sparkles },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border safe-bottom">
      <ul className="grid grid-cols-5 max-w-lg mx-auto">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
