import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useServer } from "@/context/ServerContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Menu, X, User, LogOut, Shield, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import Logo from "@/components/Logo";
import CartDrawer from "@/components/CartDrawer";

const BASE_LINKS = [
  { to: "/", label: "Accueil" },
  { to: "/factions", label: "Entreprises" },
  { to: "/joueurs", label: "Joueurs" },
  { to: "/actualites", label: "Actualités" },
  { to: "/reglement", label: "Règlement" },
  { to: "/boutique", label: "Boutique" },
];

const WL_LINK = { to: "/candidature", label: "Candidature" };

export default function Navbar() {
  const { user, logout } = useAuth();
  const server = useServer();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const wlActive = server.wl_mode !== "fa";
  const links = wlActive ? [...BASE_LINKS, WL_LINK] : BASE_LINKS;

  return (
    <header className="glass sticky top-0 z-50" data-testid="main-navbar">
      <div className="belgian-bar" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group" data-testid="nav-logo">
          <Logo size={44} className="group-hover:scale-105 transition-transform" />
          <div className="leading-none">
            <div className="font-display font-bold text-lg tracking-tight">Bruxelles RP</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#8B949E] font-mono">FiveM · Belgique</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Navigation Principale">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded transition-colors ${
                  isActive ? "text-[#E4B823]" : "text-[#8B949E] hover:text-white"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <CartDrawer />
          {user && user !== false ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="user-menu-trigger"
                  className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#E4B823] text-black flex items-center justify-center text-xs font-bold">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{user.username}</span>
                  {user.role === "admin" && <Shield size={14} className="text-[#E4B823]" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#0C1014] border-white/10">
                <DropdownMenuLabel className="text-[#8B949E] text-xs uppercase tracking-wider">Mon Compte</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/dashboard")} data-testid="menu-dashboard" className="cursor-pointer">
                  <LayoutDashboard size={14} className="mr-2" /> Tableau de Bord
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="menu-profile" className="cursor-pointer">
                  <User size={14} className="mr-2" /> Mon Personnage
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} data-testid="menu-admin" className="cursor-pointer">
                    <Shield size={14} className="mr-2" /> Panel Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-logout" className="cursor-pointer text-[#DC2626]">
                  <LogOut size={14} className="mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-login-btn" className="text-[#8B949E] hover:text-white hover:bg-white/5">
                Connexion
              </Button>
              <Button onClick={() => navigate("/register")} data-testid="nav-register-btn" className="bg-[#E4B823] text-black hover:bg-[#FCD34D] font-medium">
                Rejoindre
              </Button>
            </>
          )}
        </div>

        <div className="lg:hidden flex items-center gap-1">
          <CartDrawer />
          <button
            className="p-2 text-white"
            onClick={() => setOpen(!open)}
            data-testid="mobile-menu-toggle"
            aria-label="Menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/10 bg-[#050608] px-6 py-4 space-y-2" data-testid="mobile-menu">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-[#8B949E] hover:text-white"
              data-testid={`mobile-link-${l.label.toLowerCase()}`}
            >
              {l.label}
            </NavLink>
          ))}
          <div className="pt-3 border-t border-white/10 space-y-2">
            {user && user !== false ? (
              <>
                <Button onClick={() => { setOpen(false); navigate("/dashboard"); }} className="w-full bg-white/5">Tableau de Bord</Button>
                {user.role === "admin" && (
                  <Button onClick={() => { setOpen(false); navigate("/admin"); }} className="w-full bg-[#E4B823] text-black">Panel Admin</Button>
                )}
                <Button onClick={() => { setOpen(false); logout(); navigate("/"); }} variant="outline" className="w-full">Déconnexion</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setOpen(false); navigate("/login"); }} variant="outline" className="w-full">Connexion</Button>
                <Button onClick={() => { setOpen(false); navigate("/register"); }} className="w-full bg-[#E4B823] text-black">Rejoindre</Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
