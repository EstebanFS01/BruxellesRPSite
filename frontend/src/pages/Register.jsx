import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import Logo from "@/components/Logo";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const u = await register(form);
      toast.success(`Compte Créé. Bienvenue ${u.username} !`);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Logo size={64} className="mx-auto" showRing />
          <h1 className="font-display text-3xl font-bold tracking-tight mt-6">Créer un Compte</h1>
          <p className="text-[#8B949E] text-sm mt-2">Rejoignez Bruxelles RP</p>
        </div>

        <form onSubmit={submit} className="space-y-5 border border-white/10 rounded p-8 bg-[#0C1014]">
          <div>
            <Label htmlFor="username" className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Prénom + Nom RP</Label>
            <Input id="username" required minLength={3} maxLength={32} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              data-testid="register-username-input" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              data-testid="register-email-input" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-[#8B949E]">Mot de Passe</Label>
            <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              data-testid="register-password-input" className="mt-2 bg-transparent border-white/10 focus:border-[#E4B823] focus-visible:ring-[#E4B823]/30" />
            <p className="text-xs text-[#8B949E] mt-2">Minimum 6 Caractères</p>
          </div>
          {error && <div className="text-sm text-[#DC2626] bg-[#DC2626]/10 border border-[#DC2626]/20 rounded p-3" data-testid="register-error">{error}</div>}
          <Button type="submit" disabled={loading} data-testid="register-submit-btn" className="w-full bg-[#E4B823] text-black hover:bg-[#FCD34D] h-11 font-semibold">
            {loading ? "Création..." : "Créer mon Compte"}
          </Button>
          <div className="text-sm text-center text-[#8B949E]">
            Déjà un compte ? <Link to="/login" className="text-[#E4B823] hover:underline" data-testid="register-to-login">Se Connecter</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
