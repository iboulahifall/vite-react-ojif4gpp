import React, { useState } from "react";
import { Building2, ClipboardList, Home as HomeIcon } from "lucide-react";
import { auth } from "./data.js";

/* ============================================================
   WALLU — Écran d'authentification (email + mot de passe)
   Utilisé uniquement en mode réel (clés Supabase présentes).
   Gère : connexion, inscription (avec choix du rôle), erreurs.
   ============================================================ */

const T = {
  ink: "#0B3D34", paper: "#F7F4EC", card: "#FFFFFF",
  teal: "#0E5C4F", tealSoft: "#E2EEEA", sun: "#E7A335", sunSoft: "#FBEED6",
  line: "#E6E0D2", mut: "#5E6B66", late: "#D2493B",
};

function WalluMark({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "inline-block" }} aria-label="WALLU">
      <path d="M 18 60 L 50 26 L 82 60" fill="none" stroke={T.teal} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 18 78 L 50 44 L 82 78" fill="none" stroke={T.sun} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ROLES = [
  { key: "proprietaire", label: "Propriétaire", sub: "Je possède un ou plusieurs logements", icon: Building2 },
  { key: "gestionnaire", label: "Gestionnaire", sub: "Je gère des biens sur place", icon: ClipboardList },
  { key: "locataire", label: "Locataire", sub: "Je loue un logement", icon: HomeIcon },
];

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "otp"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("proprietaire");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  // OTP par email
  const [otpSent, setOtpSent] = useState(false); // false = étape email, true = étape code
  const [otpCode, setOtpCode] = useState("");

  const submit = async () => {
    setError(null); setInfo(null);
    if (mode === "otp") return; // le mode OTP a ses propres boutons
    if (!email.trim() || !password) { setError("Renseignez votre email et votre mot de passe."); return; }
    if (mode === "signup" && !fullName.trim()) { setError("Indiquez votre nom."); return; }
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        await auth.signUp({ email: email.trim(), password, fullName: fullName.trim(), role });
        // Selon la config Supabase, l'email peut demander une confirmation.
        setInfo("Compte créé. Si une confirmation par email est demandée, vérifiez votre boîte mail, puis connectez-vous.");
        setMode("signin");
      } else {
        await auth.signIn({ email: email.trim(), password });
        const me = await auth.me();
        onAuthenticated(me);
      }
    } catch (e) {
      const msg = (e && e.message) || "Une erreur est survenue.";
      // Messages plus clairs pour les cas fréquents
      if (/invalid login/i.test(msg)) setError("Email ou mot de passe incorrect.");
      else if (/already registered|already exists/i.test(msg)) setError("Un compte existe déjà avec cet email. Connectez-vous.");
      else if (/email not confirmed/i.test(msg)) setError("Email non confirmé. Vérifiez votre boîte mail.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // OTP email — étape 1 : envoyer le code à 6 chiffres
  const sendOtp = async () => {
    setError(null); setInfo(null);
    if (!email.trim()) { setError("Renseignez votre email."); return; }
    setLoading(true);
    try {
      await auth.sendEmailOtp({ email: email.trim() });
      setOtpSent(true);
      setInfo("Code envoyé. Vérifiez votre boîte mail (et les spams) puis saisissez-le ci-dessous.");
    } catch (e) {
      const msg = (e && e.message) || "Une erreur est survenue.";
      // shouldCreateUser=false : email inconnu => Supabase renvoie souvent une erreur générique
      if (/signups? not allowed|user not found|not found/i.test(msg)) {
        setError("Aucun compte n'est associé à cet email. Créez d'abord un compte.");
      } else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // OTP email — étape 2 : vérifier le code et ouvrir la session
  const verifyOtp = async () => {
    setError(null); setInfo(null);
    const code = otpCode.replace(/\s/g, "");
    if (!code || code.length < 6) { setError("Saisissez le code à 6 chiffres reçu par email."); return; }
    setLoading(true);
    try {
      await auth.verifyEmailOtp({ email: email.trim(), token: code });
      const me = await auth.me();
      onAuthenticated(me);
    } catch (e) {
      const msg = (e && e.message) || "Une erreur est survenue.";
      if (/expired|invalid|token/i.test(msg)) setError("Code incorrect ou expiré. Renvoyez un code.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus-visible, button:focus-visible { outline: 3px solid ${T.sun}; outline-offset: 2px; }`}</style>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 18px 40px" }}>
        <div style={{ textAlign: "center", paddingTop: 44 }}>
          <WalluMark size={56} />
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "2px", marginTop: 10 }}>WALLU</div>
          <div style={{ fontSize: 12.5, color: T.sun, marginTop: 2, fontWeight: 700, letterSpacing: "3px" }}>TON BIEN, DANS TA MAIN.</div>
        </div>

        {/* onglets connexion / inscription / code par email */}
        <div style={{ display: "flex", gap: 8, background: T.tealSoft, borderRadius: 14, padding: 5, marginTop: 28 }}>
          {[["signin", "Connexion"], ["signup", "Créer un compte"], ["otp", "Code email"]].map(([k, l]) => (
            <button key={k} onClick={() => { setMode(k); setError(null); setInfo(null); setOtpSent(false); setOtpCode(""); }}
              style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
                background: mode === k ? T.card : "transparent", color: mode === k ? T.teal : T.mut }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
          {mode === "signup" && (
            <>
              <Field label="Votre nom">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex : Ibrahima Fall" style={inp} />
              </Field>
              <div>
                <div style={lbl}>Vous êtes…</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {ROLES.map((r) => {
                    const on = role === r.key;
                    return (
                      <button key={r.key} onClick={() => setRole(r.key)} style={{
                        display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
                        background: on ? T.tealSoft : T.card, border: "2px solid " + (on ? T.teal : T.line),
                        borderRadius: 14, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: (on ? T.teal : T.mut) + "18", color: on ? T.teal : T.mut, display: "grid", placeItems: "center" }}>
                          <r.icon size={18} />
                        </span>
                        <span>
                          <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>{r.label}</span>
                          <span style={{ display: "block", fontSize: 12.5, color: T.mut }}>{r.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" style={inp} autoComplete="email" disabled={mode === "otp" && otpSent} />
          </Field>
          {mode !== "otp" && (
            <Field label="Mot de passe">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Au moins 6 caractères" style={inp} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </Field>
          )}
          {mode === "otp" && otpSent && (
            <Field label="Code reçu par email">
              <input inputMode="numeric" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="6 chiffres" style={{ ...inp, letterSpacing: "6px", fontSize: 20, textAlign: "center" }} autoComplete="one-time-code" maxLength={6} />
            </Field>
          )}

          {error && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{error}</div>}
          {info && <div style={{ background: T.tealSoft, color: T.teal, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{info}</div>}

          {mode === "otp" ? (
            !otpSent ? (
              <button onClick={sendOtp} disabled={loading} style={{
                background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15,
                fontWeight: 700, fontSize: 16, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Un instant…" : "Recevoir un code"}
              </button>
            ) : (
              <>
                <button onClick={verifyOtp} disabled={loading} style={{
                  background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15,
                  fontWeight: 700, fontSize: 16, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Vérification…" : "Valider le code"}
                </button>
                <button onClick={sendOtp} disabled={loading} style={{
                  background: "transparent", color: T.teal, border: "none", padding: 4,
                  fontWeight: 600, fontSize: 13.5, cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}>
                  Je n'ai rien reçu — renvoyer un code
                </button>
              </>
            )
          ) : (
            <button onClick={submit} disabled={loading} style={{
              background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15,
              fontWeight: 700, fontSize: 16, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Un instant…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><div style={lbl}>{label}</div>{children}</div>;
}
const lbl = { fontSize: 13, color: T.mut, fontWeight: 600, marginBottom: 6 };
const inp = { width: "100%", border: "1px solid " + T.line, borderRadius: 12, padding: "13px 14px", fontSize: 15, fontFamily: "inherit", background: "#FFFFFF", color: T.ink };
