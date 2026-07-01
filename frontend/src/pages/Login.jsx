import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import Logo from "@/components/Logo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const u = await login(email, password);
      toast.success(`Bienvenue, ${u.username}`);
      navigate(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Logo size={64} className="mx-auto" showRing />
          <h1 className="font-display text-3xl font-bold tracking-tight mt-6">Connexion</h1>
          <p className="text-[#8B949E] text-sm mt-2">Accédez à votre Espace Joueur</p>
        </div>

        <form onSubmit={submit} className="space-y-5 border border-white/10 rounded p-8 bg-[#0C1014]">
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Email</Label>
            <Input
              id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Mot de Passe</Label>
            <Input
              id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password-input"
              className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30"
            />
          </div>
          {error && <div className="text-sm text-[#DC2626] bg-[#DC2626]/10 border border-[#DC2626]/20 rounded p-3" data-testid="login-error">{error}</div>}
          <Button type="submit" disabled={loading} data-testid="login-submit-btn" className="w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] h-11 font-semibold">
            {loading ? "Connexion..." : "Se Connecter"}
          </Button>
          <div className="text-sm text-center text-[#8B949E]">
            Pas de compte ? <Link to="/register" className="text-[#E4B823] hover:underline" data-testid="login-to-register">Créer un compte</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
