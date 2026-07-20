import { Link } from "@tanstack/react-router";
import { Bus, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg hero-gradient text-primary-foreground">
            <Bus className="h-5 w-5" />
          </span>
          CampusShuttle
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/">Today</NavLink>
          <NavLink to="/schedule">Schedule</NavLink>
          <NavLink to="/map">Live Map</NavLink>
          <NavLink to="/announcements">Announcements</NavLink>
          {user && <NavLink to="/drive">Drive</NavLink>}
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <span className="hidden items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground sm:inline-flex">
                  <Shield className="h-3 w-3" /> Admin
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-1 border-t px-4 py-2 md:hidden">
        <NavLink to="/">Today</NavLink>
        <NavLink to="/schedule">Schedule</NavLink>
        <NavLink to="/map">Map</NavLink>
        <NavLink to="/announcements">News</NavLink>
        {user && <NavLink to="/drive">Drive</NavLink>}
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}
