import React, { useState, useMemo, useEffect } from "react";
import { useKerData, REAL } from "./lib/useKerData.js";
import AuthScreen from "./lib/AuthScreen.jsx";
import { auth as supaAuth } from "./lib/data.js";
import {
  Home, Wallet, Wrench, Receipt, Plus, ChevronLeft, ChevronRight, Building2,
  CircleDot, ArrowRight, X, FileText, Download, Users,
  Droplet, Zap, ShowerHead, DoorClosed, Snowflake, MoreHorizontal,
  Camera, MessageCircle, Copy, Check, UserPlus, LogOut,
  ClipboardList, BarChart3, ShieldCheck, AlertTriangle, Settings,
  FolderOpen, File, Image as ImageIcon, Search, Upload, Check as CheckIcon, MapPin, KeyRound
} from "lucide-react";

/* ============================================================
   KER GUI — « La maison » : le lien entre proprietaire et locataire.
   « Votre logement au Senegal, controle depuis votre telephone. »
   v3 : proprietaire + locataire + gestionnaire.
   - Controle des depenses au seuil configurable (§11)
   - Rapport mensuel automatique (§17)
   Renseignez SUPABASE_URL / SUPABASE_ANON_KEY pour passer en reel.
   Sinon -> MODE DEMO (donnees §32), sans jamais simuler de paiement reel.
   ============================================================ */
// Le vrai mode est déterminé dans useKerData.js (REAL). DEMO = son inverse.
const DEMO = !REAL;

/* Palette KËR — vert profond + doré (identité de marque).
   Les noms de tokens restent (teal/sun) mais portent les couleurs KËR. */
const T = {
  ink: "#0B3D34", paper: "#F7F4EC", card: "#FFFFFF",
  teal: "#0E5C4F", tealSoft: "#E2EEEA", sun: "#E7A335", sunSoft: "#FBEED6",
  paid: "#1E9E77", wait: "#E0A020", late: "#D2493B", prog: "#2C77C9",
  line: "#E6E0D2", mut: "#5E6B66",
};

/* Symbole KËR : deux chevrons (toit + lien montant). Réutilisable partout.
   animate=true : les deux chevrons se dessinent l'un après l'autre. */
function KerMark({ size = 40, onDark = false, animate = false }) {
  const top = onDark ? "#F7F4EC" : T.teal;
  const cls = animate ? "ker-draw" : "";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }} aria-label="KËR">
      <path className={cls} d="M 18 60 L 50 26 L 82 60" fill="none" stroke={top} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" style={animate ? { animationDelay: "0.05s" } : undefined} />
      <path className={cls} d="M 18 78 L 50 44 L 82 78" fill="none" stroke={T.sun} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" style={animate ? { animationDelay: "0.45s" } : undefined} />
    </svg>
  );
}

const fcfa = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " FCFA";
const MONTHS = ["Jan","Fev","Mar","Avr","Mai","Juin","Juil","Aout","Sep","Oct","Nov","Dec"];
const MONTHS_LONG = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];

const PROBLEM_CATS = [
  { key: "Eau", icon: Droplet, tint: "#2C77C9" },
  { key: "Electricite", icon: Zap, tint: "#E0A020" },
  { key: "Plomberie", icon: ShowerHead, tint: "#0E6E63" },
  { key: "Porte", icon: DoorClosed, tint: "#8A5416" },
  { key: "Climatisation", icon: Snowflake, tint: "#2C77C9" },
  { key: "Autre", icon: MoreHorizontal, tint: "#6B7C7A" },
];

const EXPENSE_CATS = ["Plomberie", "Electricite", "Peinture", "Menuiserie", "Nettoyage", "Autre"];

const seed = () => ({
  owner: { full_name: "Ibrahima", onboarded: true },
  manager: { full_name: "Cheikh" },     // gestionnaire sur place (§2 role 3)
  settings: { approval_threshold: 50000 }, // §11 seuil de validation
  properties: [{
    id: "p1", name: "Immeuble Parcelles", type: "immeuble",
    city: "Dakar", district: "Parcelles Assainies",
    units: [
      { id: "u1", label: "Appartement A", rent: 150000, due: 5, tenant: "Mamadou", code: "KER-45821",
        payments: mkHist(150000, ["paye","paye","paye","late","paye","paye","paye","wait"]) },
      { id: "u2", label: "Appartement B", rent: 150000, due: 5, tenant: "Awa", code: "KER-91043",
        payments: mkHist(150000, ["paye","paye","paye","paye","paye","paye","paye","paye"]) },
      { id: "u3", label: "Appartement C", rent: 150000, due: 5, tenant: "Fatou", code: "KER-33712",
        payments: mkHist(150000, ["paye","paye","paye","paye","paye","paye","paye","paye"]) },
      { id: "u4", label: "Appartement D", rent: 150000, due: 5, tenant: "Ousmane", code: "KER-58260",
        payments: mkHist(150000, ["paye","paye","paye","paye","paye","late","late","late"]) },
    ],
    problems: [
      { id: "m1", unitId: "u1", unit: "Appartement A", category: "Climatisation",
        desc: "La climatisation ne fonctionne plus depuis hier.", status: "nouveau", by: "Mamadou" },
      { id: "m2", unitId: "u4", unit: "Appartement D", category: "Plomberie",
        desc: "Fuite sous l'evier de la cuisine.", status: "en_cours", by: "Ousmane" },
    ],
    expenses: [
      { id: "e1", label: "Plomberie App. B", category: "Plomberie", amount: 25000, status: "auto_validee", by: "Cheikh" },
      { id: "e2", label: "Reparation portail", category: "Menuiserie", amount: 50000, status: "auto_validee", by: "Cheikh" },
      { id: "e3", label: "Peinture cage escalier", category: "Peinture", amount: 125000, status: "attente_validation", by: "Cheikh" },
    ],
  }],
  documents: [
    { id: "d1", category: "quittance", name: "Quittance Awa — dernier mois", unit: "Appartement B", date: "05/" + ((new Date().getMonth())||12) + "/" + new Date().getFullYear() },
    { id: "d2", category: "contrat", name: "Bail Mamadou", unit: "Appartement A", date: "12/01/2024" },
    { id: "d3", category: "facture", name: "Facture plomberie App. B", unit: "Appartement B", date: "02/" + (new Date().getMonth()+1) + "/" + new Date().getFullYear() },
  ],
});

function mkHist(rent, statuses) {
  const now = new Date();
  return statuses.map((s, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (statuses.length - 1 - i), 1);
    return {
      period: MONTHS[d.getMonth()] + " " + d.getFullYear(),
      amount: rent,
      status: s === "late" ? "en_retard" : s === "wait" ? "en_attente" : "paye",
      paid_at: s === "paye" ? "05/" + (d.getMonth()+1) + "/" + d.getFullYear() : null,
    };
  });
}

function StatusBadge({ status }) {
  const map = {
    paye: { c: T.paid, t: "Paye" }, en_attente: { c: T.wait, t: "En attente" },
    en_retard: { c: T.late, t: "En retard" }, nouveau: { c: T.late, t: "Nouveau" },
    en_cours: { c: T.prog, t: "En cours" }, resolu: { c: T.paid, t: "Resolu" },
    auto_validee: { c: T.paid, t: "Validee" }, attente_validation: { c: T.wait, t: "A valider" },
    approuvee: { c: T.paid, t: "Approuvee" }, refusee: { c: T.late, t: "Refusee" },
  };
  const s = map[status] || { c: T.mut, t: status };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
      fontWeight: 600, color: s.c, background: s.c + "18", padding: "4px 10px", borderRadius: 999 }}>
      <CircleDot size={12} /> {s.t}
    </span>
  );
}

function StatCard({ label, value, color, big }) {
  return (
    <div style={{ background: T.card, border: "1px solid " + T.line, borderRadius: 18, padding: "16px 18px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, color: T.mut, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: big ? 26 : 22, fontWeight: 800, color: color || T.ink, marginTop: 4, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function BigButton({ icon: Icon, label, sub, onClick, tint }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%",
      background: T.card, border: "1px solid " + T.line, borderRadius: 18, padding: "16px 18px", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
      <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: (tint || T.teal) + "18", color: tint || T.teal, display: "grid", placeItems: "center" }}><Icon size={22} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontWeight: 700, color: T.ink, fontSize: 16 }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 13, color: T.mut, marginTop: 2 }}>{sub}</span>}
      </span>
      <ArrowRight size={18} color={T.mut} />
    </button>
  );
}

function currentMonthStats(properties) {
  let expected = 0, paid = 0, late = 0, problems = 0, spend = 0, toValidate = 0;
  properties.forEach((p) => {
    p.units.forEach((u) => {
      const last = u.payments[u.payments.length - 1];
      expected += u.rent;
      if (last.status === "paye") paid += u.rent;
      if (last.status === "en_retard") late += u.rent;
    });
    problems += p.problems.filter((m) => m.status !== "resolu").length;
    p.expenses.forEach((e) => {
      if (e.status === "auto_validee" || e.status === "approuvee") spend += e.amount;
      if (e.status === "attente_validation") toValidate += 1;
    });
  });
  return { expected, paid, late, problems, spend, toValidate };
}

/* Rapport mensuel automatique (§17) — calcule a partir des seules donnees presentes */
function buildMonthlyReport(properties) {
  const now = new Date();
  const label = MONTHS_LONG[now.getMonth()] + " " + now.getFullYear();
  let expected = 0, paid = 0, lateCount = 0, spend = 0;
  let probNew = 0, probProg = 0, probDone = 0;
  properties.forEach((p) => {
    p.units.forEach((u) => {
      expected += 1;
      const last = u.payments[u.payments.length - 1];
      if (last.status === "paye") paid += 1;
      if (last.status === "en_retard") lateCount += 1;
    });
    p.problems.forEach((m) => {
      if (m.status === "nouveau") probNew += 1;
      else if (m.status === "en_cours") probProg += 1;
      else probDone += 1;
    });
    p.expenses.forEach((e) => { if (e.status === "auto_validee" || e.status === "approuvee") spend += e.amount; });
  });
  const situation = lateCount === 0 ? "ok" : "attention";
  return { label, expected, paid, lateCount, spend, probNew, probProg, probDone, situation };
}

export default function KerApp() {
  const [sessionState, setSessionState] = useState(null);

  // Authentification réelle (Supabase). En mode démo, on ne s'en sert pas.
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(!REAL); // en démo, rien à vérifier

  useEffect(() => {
    if (!REAL) return;
    let alive = true;
    supaAuth.me().then((me) => { if (alive) { setAuthUser(me); setAuthChecked(true); } })
      .catch(() => { if (alive) setAuthChecked(true); });
    return () => { alive = false; };
  }, []);

  // Source de données unique : démo si pas de clés Supabase, réel sinon.
  // Voir src/lib/useKerData.js — l'app appelle les mêmes fonctions dans les deux cas.
  const ker = useKerData();
  const db = ker.db;
  const session = sessionState;

  const recordPayment = (unitId, rent, leaseId) => ker.recordPayment(unitId, rent, leaseId);
  const addProblem = (unitId, category, desc, photoUrls) => ker.reportProblem(unitId, category, desc, photoUrls);
  const uploadProblemPhoto = (file) => ker.uploadProblemPhoto(file);
  const openPhoto = (path) => ker.photoUrl(path);
  const updateProfile = (patch) => ker.updateProfile(patch);
  const setProblemStatus = (id, status) => ker.setProblemStatus(id, status);
  const updateRepair = (id, patch) => ker.updateRepair(id, patch);
  const addExpense = (propId, label, category, amount, by, extra) => ker.addExpense(propId, label, category, amount, by, extra);
  const uploadExpenseReceipt = (file) => ker.uploadExpenseReceipt(file);
  const setExpenseStatus = (propId, id, status) => ker.setExpenseStatus(propId, id, status);
  const setThreshold = (value) => ker.setThreshold(value);
  const addDocument = (doc) => ker.addDocument(doc);
  const uploadDocument = (file, meta) => ker.uploadDocument(file, meta);
  const openDocument = (fileUrl) => ker.openDocument(fileUrl);
  const deleteDocument = (id, fileUrl) => ker.deleteDocument(id, fileUrl);
  const addProperty = (p) => ker.addProperty(p);
  const addUnit = (propId, u) => ker.addUnit(propId, u);
  const completeOnboarding = (payload) => ker.completeOnboarding(payload);
  const joinWithCode = (code, fullName) => ker.joinWithCode(code, fullName);
  const findUnitByCode = (code) => ker.findUnitByCode(code);

  // Sélection d'un espace : mémorise la session ET déclenche le chargement réel.
  const setSession = (s) => {
    setSessionState(s);
    if (s && s.role) ker.load(s.role);
  };

  // Déconnexion : en réel, on ferme la session Supabase et on revient à l'écran de connexion.
  const handleLogout = async () => {
    if (REAL) {
      try { await supaAuth.signOut(); } catch (e) {}
      setAuthUser(null);
    }
    setSessionState(null);
  };

  // --- Mode réel : exiger une connexion avant tout ---
  if (REAL) {
    if (!authChecked) {
      return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F7F4EC", color: "#5E6B66", fontFamily: "system-ui" }}>Chargement…</div>;
    }
    if (!authUser) {
      return <AuthScreen onAuthenticated={(me) => {
        setAuthUser(me);
        const r = (me && me.profile && me.profile.role) || "proprietaire";
        setSession({ role: r });
      }} />;
    }
    // connecté mais session pas encore posée (ex: rechargement de page)
    if (!session) {
      const r = (authUser.profile && authUser.profile.role) || "proprietaire";
      setSession({ role: r });
      return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F7F4EC", color: "#5E6B66", fontFamily: "system-ui" }}>Chargement…</div>;
    }
  }

  if (!session) return <RolePicker onPick={setSession} db={db} />;
  if (session.role === "proprietaire" && !db.owner.onboarded)
    return <Onboarding owner={db.owner} onDone={completeOnboarding} logout={handleLogout} />;
  if (session.role === "proprietaire")
    return <OwnerApp db={db} onRecord={recordPayment} onProblemStatus={setProblemStatus} onRepair={updateRepair} onOpenPhoto={openPhoto}
      onExpenseStatus={setExpenseStatus} onAddExpense={addExpense} onUploadReceipt={uploadExpenseReceipt} onThreshold={setThreshold} onAddDocument={addDocument}
      onUploadDocument={uploadDocument} onOpenDocument={openDocument} onDeleteDocument={deleteDocument}
      onAddProperty={addProperty} onAddUnit={addUnit} onUpdateProfile={updateProfile} logout={handleLogout} />;
  if (session.role === "gestionnaire")
    return <ManagerApp db={db} onProblemStatus={setProblemStatus} onAddExpense={addExpense} onUploadReceipt={uploadExpenseReceipt} logout={handleLogout} />;
  // Locataire en mode réel : s'il n'a pas encore de bail, on lui demande son code.
  if (session.role === "locataire" && REAL && !ker.tenantLease) {
    return <JoinScreen onJoin={joinWithCode} onFind={findUnitByCode}
      defaultName={(authUser && authUser.profile && authUser.profile.full_name) || ""} logout={handleLogout} />;
  }
  {
    // Unité à afficher pour le locataire : en réel, la première (unique) chargée.
    const tenantUnitId = session.unitId || (db.properties[0] && db.properties[0].units[0] && db.properties[0].units[0].id);
    return <TenantApp db={db} unitId={tenantUnitId} onRecord={recordPayment} onAddProblem={addProblem} onUploadPhoto={uploadProblemPhoto} logout={handleLogout} />;
  }
}

/* Écran locataire : rejoindre son logement avec un code d'invitation */
function JoinScreen({ onJoin, onFind, defaultName, logout }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultName || "");
  const [found, setFound] = useState(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const check = async () => {
    setError(null); setFound(null);
    if (!code.trim()) return;
    setChecking(true);
    try {
      const u = await onFind(code.trim());
      if (u) setFound(u);
      else setError("Ce code ne correspond à aucun logement.");
    } catch (e) { setError("Impossible de vérifier le code."); }
    finally { setChecking(false); }
  };

  const join = async () => {
    setError(null); setJoining(true);
    try {
      await onJoin(code.trim(), name.trim());
      // le chargement du bail se fait dans le hook ; l'app basculera vers l'espace locataire
    } catch (e) {
      setError((e && e.message) || "Impossible de rejoindre ce logement.");
      setJoining(false);
    }
  };

  return (
    <Shell>
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <KerMark size={54} />
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>Rejoindre mon logement</div>
        <div style={{ fontSize: 14, color: T.mut, marginTop: 6 }}>Entrez le code d'invitation communiqué par votre propriétaire.</div>
      </div>
      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <div>
          <div style={fieldLabel}>Votre nom</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Mamadou Diop" style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Code d'invitation</div>
          <input value={code} onChange={(e) => { setCode(e.target.value); setFound(null); }} placeholder="KER-45821"
            style={{ ...fieldInput, letterSpacing: "0.08em", textTransform: "uppercase" }} />
        </div>

        {!found && (
          <button onClick={check} disabled={checking || !code.trim()} style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: (checking || !code.trim()) ? 0.5 : 1 }}>
            {checking ? "Vérification…" : "Vérifier le code"}
          </button>
        )}

        {found && (
          <div style={{ background: T.tealSoft, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, color: T.mut }}>Logement trouvé</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{found.unit_label} · {found.property_name}</div>
            <div style={{ fontSize: 14, color: T.teal, fontWeight: 700, marginTop: 4 }}>{fcfa(found.rent)} / mois</div>
            <button onClick={join} disabled={joining} style={{ ...primaryBtn, width: "100%", justifyContent: "center", padding: 14, marginTop: 12, opacity: joining ? 0.6 : 1 }}>
              {joining ? "Un instant…" : "Rejoindre ce logement"}
            </button>
          </div>
        )}

        {error && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{error}</div>}

        <button onClick={logout} style={{ ...ghostBtn, justifyContent: "center", padding: 12, marginTop: 4 }}>Se déconnecter</button>
      </div>
    </Shell>
  );
}

function RolePicker({ onPick, db }) {
  const [code, setCode] = useState("");
  const units = db.properties[0].units;
  const match = units.find((u) => u.code.toUpperCase() === code.trim().toUpperCase());
  return (
    <Shell>
      <div style={{ paddingTop: 48, textAlign: "center" }}>
        <div className="ker-pop"><KerMark size={64} /></div>
        <div className="ker-rise" style={{ fontFamily: "'Inter', sans-serif", fontSize: 42, fontWeight: 800, color: T.ink, letterSpacing: "2px", marginTop: 12, animationDelay: "0.7s" }}>KËR</div>
        <div className="ker-rise" style={{ fontSize: 13, color: T.sun, marginTop: 2, fontWeight: 700, letterSpacing: "3px", animationDelay: "0.85s" }}>VOTRE BIEN. VOTRE CONTRÔLE.</div>
        <div className="ker-rise" style={{ fontSize: 14, color: T.mut, marginTop: 10, animationDelay: "1s" }}>Votre logement au Sénégal,<br/>contrôlé depuis votre téléphone.</div>
      </div>
      <div style={{ marginTop: 32, display: "grid", gap: 12 }}>
        <div className="ker-rise" style={{ fontSize: 13, color: T.mut, fontWeight: 600, animationDelay: "1.15s" }}>ESPACE PROPRIETAIRE</div>
        <div className="ker-rise" style={{ animationDelay: "1.22s" }}><BigButton icon={Building2} label={"Continuer comme " + db.owner.full_name} sub="Tableau de bord & patrimoine" tint={T.teal} onClick={() => onPick({ role: "proprietaire" })} /></div>
        <div className="ker-rise" style={{ fontSize: 13, color: T.mut, fontWeight: 600, marginTop: 12, animationDelay: "1.32s" }}>ESPACE GESTIONNAIRE</div>
        <div className="ker-rise" style={{ animationDelay: "1.39s" }}><BigButton icon={ClipboardList} label={"Continuer comme " + db.manager.full_name} sub="Biens sur place · depenses & problemes" tint={T.sun} onClick={() => onPick({ role: "gestionnaire" })} /></div>
        <div className="ker-rise" style={{ fontSize: 13, color: T.mut, fontWeight: 600, marginTop: 12, animationDelay: "1.49s" }}>ESPACE LOCATAIRE — via code d'invitation</div>
        <div className="ker-rise" style={{ background: T.card, border: "1px solid " + T.line, borderRadius: 18, padding: 16, animationDelay: "1.56s" }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KER-45821"
            style={{ width: "100%", border: "1px solid " + T.line, borderRadius: 12, padding: "12px 14px", fontSize: 16, fontFamily: "inherit", letterSpacing: "0.05em" }} />
          <button disabled={!match} onClick={() => onPick({ role: "locataire", unitId: match.id })}
            style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 10, padding: 13, opacity: match ? 1 : 0.4 }}>
            {match ? "Ouvrir l'espace de " + match.tenant : "Entrez un code valide"}
          </button>
          <div style={{ fontSize: 12, color: T.mut, marginTop: 8 }}>Codes demo : KER-45821 · KER-91043 · KER-33712 · KER-58260</div>
        </div>
      </div>
    </Shell>
  );
}

/* ===================== PROPRIETAIRE ===================== */
function OwnerApp({ db, onRecord, onProblemStatus, onRepair, onOpenPhoto, onExpenseStatus, onAddExpense, onUploadReceipt, onThreshold, onAddDocument, onUploadDocument, onOpenDocument, onDeleteDocument, onAddProperty, onAddUnit, onUpdateProfile, logout }) {
  const [view, setView] = useState({ name: "dashboard" });
  const [receipt, setReceipt] = useState(null);
  const [invite, setInvite] = useState(null);
  const [addProp, setAddProp] = useState(false);       // formulaire ajout logement
  const [addExp, setAddExp] = useState(false);         // formulaire ajout dépense
  const [addUnitFor, setAddUnitFor] = useState(null);  // formulaire ajout appartement (id du logement)
  const props = db.properties;
  const stats = useMemo(() => currentMonthStats(props), [props]);
  const items = [
    { n: "dashboard", i: Home, l: "Accueil" }, { n: "rents", i: Wallet, l: "Loyers" },
    { n: "expenses", i: Receipt, l: "Depenses" }, { n: "documents", i: FolderOpen, l: "Docs" },
  ];
  return (
    <Shell nav={<BottomNav items={items} active={view.name} onPick={(n) => setView({ name: n })} />}>
      {view.name === "dashboard" && <OwnerDashboard db={db} props={props} stats={stats} go={setView} logout={logout} />}
      {view.name === "properties" && <Properties props={props} go={setView} back={() => setView({ name: "dashboard" })} onAdd={() => setAddProp(true)} />}
      {view.name === "property" && <PropertyDetail property={props.find((p) => p.id === view.id)} back={() => setView({ name: "properties" })} onInvite={setInvite} onAddUnit={() => setAddUnitFor(view.id)} />}
      {view.name === "rents" && <Rents props={props} back={() => setView({ name: "dashboard" })} onRecord={onRecord} onReceipt={setReceipt} />}
      {view.name === "problems" && <Problems props={props} back={() => setView({ name: "dashboard" })} onStatus={onProblemStatus} onRepair={onRepair} onOpenPhoto={onOpenPhoto} />}
      {view.name === "expenses" && <OwnerExpenses props={props} threshold={db.settings.approval_threshold} back={() => setView({ name: "dashboard" })} onStatus={onExpenseStatus} go={setView} onAddClick={() => setAddExp(true)} />}
      {view.name === "settings" && <SettingsScreen threshold={db.settings.approval_threshold} onThreshold={onThreshold} back={() => setView({ name: "expenses" })} />}
      {view.name === "profile" && <ProfileScreen owner={db.owner} onSave={onUpdateProfile} back={() => setView({ name: "dashboard" })} />}
      {view.name === "report" && <MonthlyReport props={props} back={() => setView({ name: "dashboard" })} />}
      {view.name === "documents" && <Documents docs={db.documents || []} properties={props} back={() => setView({ name: "dashboard" })} onReceipts={() => setView({ name: "receipts" })} onUpload={onUploadDocument} onOpen={onOpenDocument} onDelete={onDeleteDocument} />}
      {view.name === "receipts" && <ReceiptsScreen receipts={db.receipts || []} back={() => setView({ name: "documents" })} />}
      {receipt && <ReceiptModal data={receipt} owner={db.owner} onSaved={onAddDocument} close={() => setReceipt(null)} />}
      {invite && <InviteModal unit={invite} close={() => setInvite(null)} />}
      {addProp && <AddPropertySheet close={() => setAddProp(false)} onAdd={(p) => { onAddProperty(p); setAddProp(false); }} />}
      {addExp && <AddExpenseSheet props={props} threshold={db.settings.approval_threshold} by={db.owner.full_name} onUploadReceipt={onUploadReceipt}
        close={() => setAddExp(false)} onAdd={async (propId, label, cat, amount, extra) => { await onAddExpense(propId, label, cat, amount, db.owner.full_name, extra); setAddExp(false); }} />}
      {addUnitFor && <AddUnitSheet close={() => setAddUnitFor(null)} onAdd={(u) => { onAddUnit(addUnitFor, u); setAddUnitFor(null); }} />}
    </Shell>
  );
}

/* Formulaire : ajouter un logement */
function AddPropertySheet({ close, onAdd }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("appartement");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [rent, setRent] = useState("");
  const rentNum = parseInt(("" + rent).replace(/\D/g, ""), 10) || 0;
  const valid = name.trim() && city.trim();
  return (
    <Sheet close={close} title="Ajouter un logement">
      <div style={{ display: "grid", gap: 12 }}>
        <FormField label="Nom du logement"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Immeuble Parcelles" style={fieldInput} /></FormField>
        <FormField label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} style={fieldInput}>
            <option value="maison">Maison</option><option value="appartement">Appartement</option>
            <option value="immeuble">Immeuble</option><option value="boutique">Boutique</option>
            <option value="local_commercial">Local commercial</option>
          </select>
        </FormField>
        <FormField label="Ville"><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex : Dakar" style={fieldInput} /></FormField>
        <FormField label="Quartier (optionnel)"><input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Ex : Parcelles Assainies" style={fieldInput} /></FormField>
        <div style={{ height: 1, background: T.line, margin: "2px 0" }} />
        <FormField label="Premier appartement / unité (optionnel)"><input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="Ex : Appartement A" style={fieldInput} /></FormField>
        <FormField label="Loyer (FCFA)"><input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="numeric" placeholder="150000" style={fieldInput} /></FormField>
        <button disabled={!valid} onClick={() => onAdd({ name: name.trim(), type, city: city.trim(), district: district.trim(), unitLabel: unitLabel.trim(), rent: rentNum })}
          style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: valid ? 1 : 0.4 }}>Enregistrer le logement</button>
      </div>
    </Sheet>
  );
}

/* Formulaire : ajouter un appartement à un logement */
function AddUnitSheet({ close, onAdd }) {
  const [label, setLabel] = useState("");
  const [rent, setRent] = useState("");
  const rentNum = parseInt(("" + rent).replace(/\D/g, ""), 10) || 0;
  const valid = label.trim();
  return (
    <Sheet close={close} title="Ajouter un appartement">
      <div style={{ display: "grid", gap: 12 }}>
        <FormField label="Nom de l'appartement / unité"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Appartement B" style={fieldInput} /></FormField>
        <FormField label="Loyer (FCFA)"><input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="numeric" placeholder="150000" style={fieldInput} /></FormField>
        <button disabled={!valid} onClick={() => onAdd({ label: label.trim(), rent: rentNum })}
          style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: valid ? 1 : 0.4 }}>Ajouter l'appartement</button>
      </div>
    </Sheet>
  );
}

function FormField({ label, children }) {
  return <div><div style={fieldLabel}>{label}</div>{children}</div>;
}

function OwnerDashboard({ db, props, stats, go, logout }) {
  const totalUnits = props.reduce((a, p) => a + p.units.length, 0);
  return (
    <div className="fade" style={{ paddingTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, color: T.mut }}>Bonjour</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700 }}>{db.owner.full_name}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => go({ name: "profile" })} style={navIcon} title="Mon profil"><Settings size={18} color={T.ink} /></button>
          <button onClick={logout} style={navIcon} title="Changer d'espace"><LogOut size={18} color={T.ink} /></button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: T.mut, margin: "14px 0 8px", fontWeight: 600 }}>MON PATRIMOINE — CE MOIS</div>
      <div style={{ display: "flex", gap: 10 }}>
        <StatCard label="Attendus" value={fcfa(stats.expected)} big />
        <StatCard label="Encaisses" value={fcfa(stats.paid)} color={T.paid} big />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <StatCard label="En retard" value={fcfa(stats.late)} color={T.late} />
        <StatCard label="Depenses" value={fcfa(stats.spend)} color={T.sun} />
      </div>
      {(stats.problems > 0 || stats.toValidate > 0) && (
        <div style={{ marginTop: 14, background: T.sunSoft, borderRadius: 16, padding: "14px 16px", fontSize: 14, color: "#8A5416" }}>
          <strong>A traiter :</strong>{" "}
          {stats.problems > 0 && stats.problems + " probleme" + (stats.problems > 1 ? "s" : "") + " ouvert" + (stats.problems > 1 ? "s" : "")}
          {stats.problems > 0 && stats.toValidate > 0 && " · "}
          {stats.toValidate > 0 && stats.toValidate + " depense" + (stats.toValidate > 1 ? "s" : "") + " a valider"}
        </div>
      )}
      <div style={{ fontSize: 13, color: T.mut, margin: "20px 0 10px", fontWeight: 600 }}>{totalUnits} logements · acces rapide</div>
      <div style={{ display: "grid", gap: 10 }}>
        <BigButton icon={Building2} label="Mes logements" sub={props.length + " bien" + (props.length>1?"s":"")} tint={T.teal} onClick={() => go({ name: "properties" })} />
        <BigButton icon={Wrench} label="Problemes" sub={stats.problems + " ouvert" + (stats.problems>1?"s":"")} tint={T.late} onClick={() => go({ name: "problems" })} />
        <BigButton icon={Receipt} label="Depenses" sub={stats.toValidate > 0 ? stats.toValidate + " a valider" : "A jour"} tint={T.sun} onClick={() => go({ name: "expenses" })} />
        <BigButton icon={BarChart3} label="Rapport mensuel" sub="Resume automatique" tint={T.prog} onClick={() => go({ name: "report" })} />
      </div>
    </div>
  );
}

function Properties({ props, go, back, onAdd }) {
  return (
    <Screen title="Mes logements" back={back} action={<button onClick={onAdd} style={addBtn}><Plus size={16} /> Ajouter</button>}>
      <div style={{ display: "grid", gap: 12 }}>
        {props.map((p) => (
          <button key={p.id} onClick={() => go({ name: "property", id: p.id })} style={cardBtn}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: T.tealSoft, color: T.teal, display: "grid", placeItems: "center", flexShrink: 0 }}><Building2 size={26} /></div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: T.mut, marginTop: 2 }}>{p.city} · {p.district} · {p.units.length} appartement{p.units.length>1?"s":""}</div>
            </div>
            <ArrowRight size={18} color={T.mut} />
          </button>
        ))}
      </div>
    </Screen>
  );
}

function PropertyDetail({ property, back, onInvite, onAddUnit }) {
  if (!property) return null;
  return (
    <Screen title={property.name} back={back} sub={property.city + " · " + property.district}>
      <div style={{ display: "grid", gap: 10 }}>
        {property.units.map((u) => {
          const last = u.payments[u.payments.length - 1];
          return (
            <div key={u.id} style={{ ...card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.sunSoft, color: T.sun, display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 800 }}>{u.label.slice(-1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{u.label}</div>
                  <div style={{ fontSize: 13, color: T.mut, display: "flex", alignItems: "center", gap: 6 }}><Users size={13} /> {u.tenant} · {fcfa(u.rent)}</div>
                </div>
                <StatusBadge status={last.status} />
              </div>
              <button onClick={() => onInvite(u)} style={{ ...ghostBtn, width: "100%", justifyContent: "center", marginTop: 12 }}>
                <UserPlus size={15} /> Inviter le locataire
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={onAddUnit} style={{ ...addBtn, width: "100%", justifyContent: "center", marginTop: 14, padding: "14px" }}><Plus size={16} /> Ajouter un appartement</button>
    </Screen>
  );
}

function Rents({ props, back, onRecord, onReceipt }) {
  const units = props.flatMap((p) => p.units.map((u) => ({ ...u, propName: p.name })));
  return (
    <Screen title="Loyers" back={back}>
      <div style={{ display: "grid", gap: 12 }}>
        {units.map((u) => {
          const last = u.payments[u.payments.length - 1];
          return (
            <div key={u.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{u.label} · {u.tenant}</div>
                  <div style={{ fontSize: 13, color: T.mut }}>Echeance : le {u.due} du mois</div>
                </div>
                <StatusBadge status={last.status} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 2px", letterSpacing: "-0.02em" }}>{fcfa(u.rent)}</div>
              <div style={{ display: "flex", gap: 5, margin: "10px 0" }}>
                {u.payments.slice(-8).map((p, i) => (
                  <div key={i} title={p.period + " — " + p.status} style={{ flex: 1, height: 8, borderRadius: 4, background: p.status === "paye" ? T.paid : p.status === "en_retard" ? T.late : T.wait, opacity: 0.85 }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {last.status !== "paye"
                  ? <button onClick={() => onRecord(u.id, u.rent)} style={{ ...primaryBtn, flex: 1 }}>Enregistrer le paiement</button>
                  : <button onClick={() => onReceipt({ unit: u, period: last.period, paid_at: last.paid_at })} style={{ ...ghostBtn, flex: 1 }}><FileText size={15} /> Quittance</button>}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

const REPAIR_STEPS = [
  { key: "nouveau", label: "Nouveau", tint: "#C0563F" },
  { key: "pris_en_charge", label: "Pris en charge", tint: "#E0A020" },
  { key: "devis", label: "Devis", tint: "#2C77C9" },
  { key: "en_intervention", label: "En intervention", tint: "#7A5CC0" },
  { key: "resolu", label: "Résolu", tint: "#1E9E77" },
];

function Problems({ props, back, onStatus, onRepair, onOpenPhoto }) {
  const items = props.flatMap((p) => p.problems.map((m) => ({ ...m, propName: p.name })));
  const [edit, setEdit] = useState(null);   // problème en cours d'édition (réparation)
  const openPhoto = async (path) => {
    if (!onOpenPhoto) return;
    const url = await onOpenPhoto(path);
    if (url) window.open(url, "_blank");
  };
  const stepMeta = (k) => REPAIR_STEPS.find((s) => s.key === k) || REPAIR_STEPS[0];
  return (
    <Screen title="Problemes signales" back={back}>
      <div style={{ display: "grid", gap: 12 }}>
        {items.length === 0 && <Empty text="Aucun probleme signale. Tout va bien." />}
        {items.map((m) => {
          const rs = m.repairStatus || "nouveau";
          const sm = stepMeta(rs);
          return (
            <div key={m.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{m.category}</div>
                <span style={{ background: sm.tint + "18", color: sm.tint, fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>{sm.label}</span>
              </div>
              <div style={{ fontSize: 13, color: T.mut, marginTop: 2 }}>{m.unit}</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>{m.desc}</div>

              {m.photos && m.photos.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {m.photos.map((ph, i) => (
                    <button key={i} onClick={() => openPhoto(ph)} style={{ display: "flex", alignItems: "center", gap: 6, background: T.tealSoft, color: T.teal, border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <ImageIcon size={14} /> Voir photo {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Récap intervention si renseigné */}
              {(m.artisan || m.amountEst || m.amountReal) && (
                <div style={{ background: T.paper, borderRadius: 12, padding: "10px 12px", marginTop: 10, fontSize: 13 }}>
                  {m.artisan && <div><span style={{ color: T.mut }}>Artisan : </span><b>{m.artisan}</b></div>}
                  {m.amountEst ? <div><span style={{ color: T.mut }}>Devis : </span><b>{fcfa(m.amountEst)}</b></div> : null}
                  {m.amountReal ? <div><span style={{ color: T.mut }}>Coût réel : </span><b>{fcfa(m.amountReal)}</b></div> : null}
                  {m.repairNote && <div style={{ marginTop: 4, color: T.ink }}>{m.repairNote}</div>}
                </div>
              )}

              {rs !== "resolu" && onRepair && (
                <button onClick={() => setEdit(m)} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 12, padding: 12 }}>
                  <Wrench size={15} /> Gérer la réparation
                </button>
              )}
              {rs !== "resolu" && !onRepair && (
                <button onClick={() => onStatus(m.id, "resolu")} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 12, padding: 12 }}>
                  Marquer résolu
                </button>
              )}
            </div>
          );
        })}
      </div>

      {edit && <RepairSheet problem={edit} onRepair={onRepair} close={() => setEdit(null)} />}
    </Screen>
  );
}

/* Feuille : piloter le workflow de réparation */
function RepairSheet({ problem, onRepair, close }) {
  const [rs, setRs] = useState(problem.repairStatus || "nouveau");
  const [artisan, setArtisan] = useState(problem.artisan || "");
  const [est, setEst] = useState(problem.amountEst ? String(problem.amountEst) : "");
  const [real, setReal] = useState(problem.amountReal ? String(problem.amountReal) : "");
  const [note, setNote] = useState(problem.repairNote || "");
  const [saving, setSaving] = useState(false);
  const toNum = (v) => parseInt(("" + v).replace(/\D/g, ""), 10) || null;

  const save = async () => {
    setSaving(true);
    await onRepair(problem.id, {
      repairStatus: rs, artisan: artisan.trim(),
      amountEst: toNum(est), amountReal: toNum(real), note: note.trim(),
    });
    setSaving(false);
    close();
  };

  return (
    <Sheet close={close} title="Gérer la réparation">
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div style={fieldLabel}>Étape</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REPAIR_STEPS.map((s) => {
              const on = rs === s.key;
              return (
                <button key={s.key} onClick={() => setRs(s.key)} style={{
                  padding: "8px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 700, border: "1px solid " + (on ? s.tint : T.line),
                  background: on ? s.tint : T.card, color: on ? "#fff" : T.mut }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <FormField label="Artisan (nom / téléphone)">
          <input value={artisan} onChange={(e) => setArtisan(e.target.value)} placeholder="Ex : Modou Plombier — 77…" style={fieldInput} />
        </FormField>
        <FormField label="Devis estimé (FCFA)">
          <input value={est} onChange={(e) => setEst(e.target.value)} inputMode="numeric" placeholder="Ex : 25000" style={fieldInput} />
        </FormField>
        <FormField label="Coût réel (FCFA)">
          <input value={real} onChange={(e) => setReal(e.target.value)} inputMode="numeric" placeholder="Ex : 22000" style={fieldInput} />
        </FormField>
        <FormField label="Note d'intervention">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex : Pièce changée, testé OK." style={{ ...fieldInput, resize: "none" }} />
        </FormField>
        <button onClick={save} disabled={saving} style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </Sheet>
  );
}

/* Depenses cote proprietaire : validation au seuil (§11) */
function OwnerExpenses({ props, threshold, back, onStatus, go, onAddClick }) {
  const items = props.flatMap((p) => p.expenses.map((e) => ({ ...e, propId: p.id, propName: p.name })));
  const pending = items.filter((e) => e.status === "attente_validation");
  const others = items.filter((e) => e.status !== "attente_validation");
  return (
    <Screen title="Depenses" back={back}
      action={<div style={{ display: "flex", gap: 8 }}>
        {onAddClick && <button onClick={onAddClick} style={addBtn}><Plus size={16} /> Ajouter</button>}
        <button onClick={() => go({ name: "settings" })} style={navIcon}><Settings size={18} /></button>
      </div>}>
      <div style={{ background: T.tealSoft, color: T.teal, borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={16} /> Au-dela de {fcfa(threshold)}, votre validation est requise.
      </div>
      {pending.length > 0 && <div style={{ fontSize: 13, color: T.mut, fontWeight: 600, marginBottom: 10 }}>A VALIDER</div>}
      <div style={{ display: "grid", gap: 12, marginBottom: pending.length ? 20 : 0 }}>
        {pending.map((e) => (
          <div key={e.id} style={{ ...card, borderColor: T.wait }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{e.label}</div>
                <div style={{ fontSize: 13, color: T.mut }}>{e.category} · saisi par {e.by}</div>
              </div>
              <StatusBadge status={e.status} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, margin: "8px 0", color: T.sun }}>{fcfa(e.amount)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onStatus(e.propId, e.id, "approuvee")} style={{ ...primaryBtn, flex: 1 }}>Approuver</button>
              <button onClick={() => onStatus(e.propId, e.id, "refusee")} style={{ ...dangerBtn, flex: 1 }}>Refuser</button>
            </div>
          </div>
        ))}
      </div>
      {others.length > 0 && <div style={{ fontSize: 13, color: T.mut, fontWeight: 600, marginBottom: 10 }}>HISTORIQUE</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {others.map((e) => (
          <div key={e.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: T.sunSoft, color: T.sun, display: "grid", placeItems: "center", flexShrink: 0 }}><Receipt size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{e.label}</div>
              <div style={{ fontSize: 13, color: T.mut }}>{fcfa(e.amount)} · {e.by}</div>
            </div>
            <StatusBadge status={e.status} />
          </div>
        ))}
      </div>
    </Screen>
  );
}

function SettingsScreen({ threshold, onThreshold, back }) {
  const [val, setVal] = useState(threshold);
  const steps = [25000, 50000, 100000, 150000];
  return (
    <Screen title="Controle des depenses" back={back}>
      <div style={card}>
        <div style={{ fontWeight: 700 }}>Seuil de validation</div>
        <div style={{ fontSize: 13, color: T.mut, marginTop: 4 }}>Toute depense superieure a ce montant devra etre approuvee par vous avant d'etre engagee.</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: T.teal, margin: "14px 0 6px", letterSpacing: "-0.02em" }}>{fcfa(val)}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {steps.map((s) => (
            <button key={s} onClick={() => setVal(s)} style={{
              flex: "1 1 40%", padding: "10px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              border: "2px solid " + (val === s ? T.teal : T.line), background: val === s ? T.tealSoft : T.card, color: val === s ? T.teal : T.ink }}>
              {fcfa(s)}
            </button>
          ))}
        </div>
        <button onClick={() => { onThreshold(val); back(); }} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 16, padding: 14 }}>Enregistrer</button>
      </div>
    </Screen>
  );
}

/* Rapport mensuel automatique (§17) */
function MonthlyReport({ props, back }) {
  const r = useMemo(() => buildMonthlyReport(props), [props]);
  return (
    <Screen title="Rapport mensuel" back={back} sub={r.label}>
      <div style={{ ...card, textAlign: "center", background: r.situation === "ok" ? T.tealSoft : T.sunSoft, border: "none" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: r.situation === "ok" ? T.paid : "#8A5416" }}>
          {r.situation === "ok" ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
          {r.situation === "ok" ? "Situation saine" : "Attention requise"}
        </div>
        <div style={{ fontSize: 13, color: r.situation === "ok" ? T.teal : "#8A5416", marginTop: 4 }}>
          {r.lateCount === 0 ? "Tous les loyers du mois sont a jour." : r.lateCount + " loyer" + (r.lateCount>1?"s":"") + " actuellement en retard."}
        </div>
      </div>

      <div style={{ fontSize: 13, color: T.mut, fontWeight: 600, margin: "18px 0 10px" }}>LOYERS</div>
      <div style={{ display: "flex", gap: 10 }}>
        <StatCard label="Attendus" value={r.expected} />
        <StatCard label="Payes" value={r.paid} color={T.paid} />
        <StatCard label="En retard" value={r.lateCount} color={T.late} />
      </div>

      <div style={{ fontSize: 13, color: T.mut, fontWeight: 600, margin: "18px 0 10px" }}>DEPENSES DU MOIS</div>
      <div style={{ ...card, fontSize: 24, fontWeight: 800, color: T.sun }}>{fcfa(r.spend)}</div>

      <div style={{ fontSize: 13, color: T.mut, fontWeight: 600, margin: "18px 0 10px" }}>PROBLEMES</div>
      <div style={{ display: "flex", gap: 10 }}>
        <StatCard label="Nouveaux" value={r.probNew} color={T.late} />
        <StatCard label="En cours" value={r.probProg} color={T.prog} />
        <StatCard label="Resolus" value={r.probDone} color={T.paid} />
      </div>

      <div style={{ fontSize: 12.5, color: T.mut, marginTop: 18, textAlign: "center" }}>
        Resume calcule automatiquement a partir des donnees du mois. Aucune information inventee.
      </div>
    </Screen>
  );
}

/* ===================== GESTIONNAIRE (§2 role 3) ===================== */
function ManagerApp({ db, onProblemStatus, onAddExpense, onUploadReceipt, logout }) {
  const [view, setView] = useState({ name: "home" });
  const [addOpen, setAddOpen] = useState(false);
  const props = db.properties; // en reel : filtres par property_managers (RLS)
  const threshold = db.settings.approval_threshold;
  const items = [
    { n: "home", i: Home, l: "Accueil" }, { n: "problems", i: Wrench, l: "Problemes" },
    { n: "expenses", i: Receipt, l: "Depenses" },
  ];
  return (
    <Shell nav={<BottomNav items={items} active={view.name} onPick={(n) => setView({ name: n })} />}>
      {view.name === "home" && (
        <div className="fade" style={{ paddingTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, color: T.mut }}>Gestionnaire</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700 }}>{db.manager.full_name}</div>
            </div>
            <button onClick={logout} style={navIcon}><LogOut size={18} color={T.ink} /></button>
          </div>
          <div style={{ fontSize: 13, color: T.mut, margin: "16px 0 10px", fontWeight: 600 }}>BIENS QUI VOUS SONT CONFIES</div>
          <div style={{ display: "grid", gap: 10 }}>
            {props.map((p) => (
              <div key={p.id} style={card}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: T.mut, marginTop: 2 }}>{p.city} · {p.units.length} appartements</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: T.mut, margin: "20px 0 10px", fontWeight: 600 }}>ACTIONS</div>
          <div style={{ display: "grid", gap: 10 }}>
            <BigButton icon={Receipt} label="Ajouter une depense" sub={"Auto-validee sous " + fcfa(threshold)} tint={T.sun} onClick={() => setAddOpen(true)} />
            <BigButton icon={Wrench} label="Problemes a traiter" sub="Suivi des interventions" tint={T.late} onClick={() => setView({ name: "problems" })} />
          </div>
        </div>
      )}
      {view.name === "problems" && <Problems props={props} back={() => setView({ name: "home" })} onStatus={onProblemStatus} />}
      {view.name === "expenses" && <ManagerExpenses props={props} threshold={threshold} back={() => setView({ name: "home" })} onAdd={() => setAddOpen(true)} />}
      {addOpen && <AddExpenseSheet props={props} threshold={threshold} by={db.manager.full_name} onUploadReceipt={onUploadReceipt}
        close={() => setAddOpen(false)} onAdd={async (propId, label, cat, amount, extra) => { await onAddExpense(propId, label, cat, amount, db.manager.full_name, extra); setAddOpen(false); }} />}
    </Shell>
  );
}

function ManagerExpenses({ props, threshold, back, onAdd }) {
  const items = props.flatMap((p) => p.expenses.map((e) => ({ ...e, propName: p.name })));
  return (
    <Screen title="Depenses" back={back} action={<button onClick={onAdd} style={addBtn}><Plus size={16} /> Ajouter</button>}>
      <div style={{ display: "grid", gap: 12 }}>
        {items.map((e) => (
          <div key={e.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: T.sunSoft, color: T.sun, display: "grid", placeItems: "center", flexShrink: 0 }}><Receipt size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{e.label}</div>
              <div style={{ fontSize: 13, color: T.mut }}>{fcfa(e.amount)}</div>
            </div>
            <StatusBadge status={e.status} />
          </div>
        ))}
      </div>
    </Screen>
  );
}

function AddExpenseSheet({ props, threshold, by, close, onAdd, onUploadReceipt }) {
  const [propId, setPropId] = useState(props[0].id);
  const [label, setLabel] = useState("");
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState(null);   // { name, path }
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const num = parseInt(amount.replace(/\D/g, ""), 10) || 0;
  const needsApproval = num > threshold;
  const valid = label.trim() && num > 0;

  const pickReceipt = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    if (file.size > 10 * 1024 * 1024) { setErr("Fichier trop lourd (max 10 Mo)."); return; }
    if (!onUploadReceipt) { setReceipt({ name: file.name, path: null }); return; }
    setUploading(true);
    try {
      const path = await onUploadReceipt(file);
      setReceipt({ name: file.name, path });
    } catch (e2) { setErr("Envoi du justificatif impossible."); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    setSaving(true);
    await onAdd(propId, label.trim(), cat, num, { supplier: supplier.trim(), spentAt, receiptUrl: receipt && receipt.path });
    setSaving(false);
  };

  return (
    <Sheet close={close} title="Ajouter une depense">
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={fieldLabel}>Bien concerne</div>
          <select value={propId} onChange={(e) => setPropId(e.target.value)} style={fieldInput}>
            {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabel}>Intitule</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Reparation fuite App. D" style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Categorie</div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={fieldInput}>
            {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabel}>Fournisseur (optionnel)</div>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex : Quincaillerie Diop" style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Date de la dépense</div>
          <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Montant (FCFA)</div>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Justificatif (photo ou PDF, optionnel)</div>
          {receipt ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.tealSoft, color: T.teal, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>
              <FileText size={15} /> <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{receipt.name}</span>
              <button onClick={() => setReceipt(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.late, display: "flex" }}><X size={14} /></button>
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: T.card, color: T.teal, border: "2px dashed " + T.teal, borderRadius: 12, padding: 12, cursor: uploading ? "default" : "pointer", fontWeight: 700, opacity: uploading ? 0.6 : 1 }}>
              <Upload size={16} /> {uploading ? "Envoi…" : "Joindre un justificatif"}
              <input type="file" accept="image/*,application/pdf" onChange={pickReceipt} disabled={uploading} style={{ display: "none" }} />
            </label>
          )}
        </div>
        {num > 0 && (
          <div style={{ borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600,
            background: needsApproval ? T.sunSoft : T.tealSoft, color: needsApproval ? "#8A5416" : T.teal,
            display: "flex", alignItems: "center", gap: 8 }}>
            {needsApproval ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            {needsApproval ? "Au-dessus de " + fcfa(threshold) + " — validation du proprietaire requise." : "Sous le seuil — sera validee automatiquement."}
          </div>
        )}
        {err && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
        <button disabled={!valid || saving || uploading} onClick={submit}
          style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: (valid && !saving && !uploading) ? 1 : 0.4 }}>
          {saving ? "Enregistrement…" : "Enregistrer la depense"}
        </button>
      </div>
    </Sheet>
  );
}

/* ===================== LOCATAIRE (§29) ===================== */
function TenantApp({ db, unitId, onRecord, onAddProblem, onUploadPhoto, logout }) {
  const [screen, setScreen] = useState("home");
  const prop = db.properties.find((p) => p.units.some((u) => u.id === unitId));
  const unit = prop.units.find((u) => u.id === unitId);
  const myProblems = prop.problems.filter((m) => m.unitId === unitId);
  const last = unit.payments[unit.payments.length - 1];
  const recent = unit.payments.slice(-3);

  if (screen === "report")
    return <ReportProblem unit={unit} back={() => setScreen("home")} onUploadPhoto={onUploadPhoto} onSubmit={(cat, desc, photos) => { onAddProblem(unitId, cat, desc, photos); setScreen("home"); }} />;
  if (screen === "receipts")
    return <ReceiptsScreen receipts={db.receipts || []} back={() => setScreen("home")} />;
  if (screen === "contact")
    return <ContactScreen contact={db.ownerContact} fallbackName={db.owner.full_name} back={() => setScreen("home")} />;

  return (
    <Shell>
      <div className="fade" style={{ paddingTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, color: T.mut }}>Bonjour</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700 }}>{unit.tenant}</div>
          </div>
          <button onClick={logout} style={navIcon}><LogOut size={18} color={T.ink} /></button>
        </div>
        <div style={{ marginTop: 18, background: T.card, border: "1px solid " + T.line, borderRadius: 20, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.teal, fontWeight: 700 }}><Home size={18} /> {unit.label}</div>
          <div style={{ fontSize: 13, color: T.mut, marginTop: 14 }}>Loyer mensuel</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{fcfa(unit.rent)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <div style={{ fontSize: 14, color: T.mut }}>Echeance : le {unit.due} du mois</div>
            <StatusBadge status={last.status} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            {recent.map((p, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", background: T.paper, borderRadius: 10, padding: "8px 4px" }}>
                <div style={{ fontSize: 11, color: T.mut }}>{p.period.split(" ")[0]}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.status === "paye" ? T.paid : p.status === "en_retard" ? T.late : T.wait, marginTop: 2 }}>
                  {p.status === "paye" ? "Paye" : p.status === "en_retard" ? "Retard" : "Attente"}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 13, color: T.mut, margin: "20px 0 10px", fontWeight: 600 }}>ACTIONS</div>
        <div style={{ display: "grid", gap: 10 }}>
          {last.status !== "paye" && <BigButton icon={Wallet} label="Enregistrer mon paiement" sub={fcfa(unit.rent)} tint={T.paid} onClick={() => onRecord(unitId, unit.rent, unit.leaseId)} />}
          <BigButton icon={Wrench} label="Signaler un probleme" sub="Eau, electricite, plomberie..." tint={T.late} onClick={() => setScreen("report")} />
          <BigButton icon={FileText} label="Mes quittances" sub="Preuves de paiement" tint={T.teal} onClick={() => setScreen("receipts")} />
          <BigButton icon={MessageCircle} label="Contacter le proprietaire" sub={db.owner.full_name} tint={T.sun} onClick={() => setScreen("contact")} />
        </div>
        {myProblems.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: T.mut, margin: "22px 0 10px", fontWeight: 600 }}>MES SIGNALEMENTS</div>
            <div style={{ display: "grid", gap: 10 }}>
              {myProblems.map((m) => (
                <div key={m.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{m.category}</div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div style={{ fontSize: 14, color: T.mut, marginTop: 6 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function ReportProblem({ unit, back, onSubmit, onUploadPhoto }) {
  const [cat, setCat] = useState(null);
  const [desc, setDesc] = useState("");
  const [photos, setPhotos] = useState([]);   // [{ name, path }]
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const addPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    if (file.size > 10 * 1024 * 1024) { setErr("Photo trop lourde (max 10 Mo)."); return; }
    if (!onUploadPhoto) { setErr("Envoi de photo indisponible."); return; }
    setUploading(true);
    try {
      const path = await onUploadPhoto(file);
      if (path) setPhotos((p) => [...p, { name: file.name, path }]);
      else setErr("La photo n'a pas pu être envoyée.");
    } catch (e2) { setErr("La photo n'a pas pu être envoyée."); }
    finally { setUploading(false); }
  };

  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    setSubmitting(true);
    await onSubmit(cat, desc.trim(), photos.map((p) => p.path));
  };

  return (
    <Shell>
      <Screen title="Signaler un probleme" back={back} sub={unit.label}>
        <div style={{ fontSize: 13, color: T.mut, marginBottom: 10, fontWeight: 600 }}>1. QUEL TYPE DE PROBLEME ?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PROBLEM_CATS.map((c) => {
            const active = cat === c.key;
            return (
              <button key={c.key} onClick={() => setCat(c.key)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                background: active ? c.tint + "18" : T.card, border: "2px solid " + (active ? c.tint : T.line),
                borderRadius: 16, padding: "18px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                <c.icon size={26} color={c.tint} />
                <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{c.key}</span>
              </button>
            );
          })}
        </div>
        {cat && (
          <div className="fade" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, color: T.mut, marginBottom: 10, fontWeight: 600 }}>2. AJOUTER DES PHOTOS (optionnel)</div>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: T.tealSoft, color: T.teal, borderRadius: 10, padding: "6px 10px", fontSize: 12.5, fontWeight: 600 }}>
                    <ImageIcon size={14} /> Photo {i + 1}
                    <button onClick={() => removePhoto(i)} style={{ border: "none", background: "transparent", cursor: "pointer", color: T.late, display: "flex" }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: T.tealSoft, color: T.teal, border: "2px dashed " + T.teal, borderRadius: 16, padding: 18, cursor: uploading ? "default" : "pointer", fontWeight: 700, opacity: uploading ? 0.6 : 1 }}>
              <Camera size={20} /> {uploading ? "Envoi de la photo…" : (photos.length ? "Ajouter une autre photo" : "Prendre / choisir une photo")}
              <input type="file" accept="image/*" capture="environment" onChange={addPhoto} disabled={uploading} style={{ display: "none" }} />
            </label>
            {err && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginTop: 10 }}>{err}</div>}
            <div style={{ fontSize: 13, color: T.mut, margin: "20px 0 10px", fontWeight: 600 }}>3. DECRIRE LE PROBLEME</div>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Ex : La climatisation ne fonctionne plus depuis hier."
              style={{ width: "100%", border: "1px solid " + T.line, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: "inherit", resize: "none" }} />
            <button disabled={!desc.trim() || submitting || uploading} onClick={submit}
              style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 14, padding: 15, fontSize: 16, opacity: (desc.trim() && !submitting && !uploading) ? 1 : 0.4 }}>
              {submitting ? "Envoi…" : "Envoyer le signalement"}
            </button>
          </div>
        )}
      </Screen>
    </Shell>
  );
}

function InviteModal({ unit, close }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard.writeText(unit.code); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return (
    <Sheet close={close} title={"Inviter · " + unit.label}>
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontSize: 13, color: T.mut }}>Code d'invitation</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 700, color: T.teal, letterSpacing: "0.04em", margin: "6px 0" }}>{unit.code}</div>
      </div>
      <button onClick={copy} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 12, padding: 14 }}>
        {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier le code</>}
      </button>
      <div style={{ fontSize: 12.5, color: T.mut, marginTop: 10, textAlign: "center" }}>Communiquez ce code à votre locataire. Il crée un compte « Locataire », entre ce code, et est rattaché automatiquement à {unit.label}.</div>
    </Sheet>
  );
}

function ReceiptModal({ data, owner, onSaved, close }) {
  const { unit, period, paid_at } = data;
  const [saved, setSaved] = useState(false);
  const saveDoc = () => {
    if (onSaved) onSaved({ category: "quittance", name: "Quittance " + unit.tenant + " — " + period, unit: unit.label, date: paid_at || "-" });
    setSaved(true);
  };
  const print = () => {
    const w = window.open("", "_blank");
    w.document.write("<html><head><title>Quittance " + period + "</title><style>"
      + "body{font-family:Georgia,serif;color:#1B2A2A;padding:48px;max-width:600px;margin:auto}"
      + "h1{font-size:22px;border-bottom:3px solid " + T.teal + ";padding-bottom:12px}"
      + ".row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee}"
      + ".label{color:#6B7C7A}.val{font-weight:700}"
      + ".stamp{margin-top:28px;color:" + T.paid + ";font-size:20px;font-weight:700;border:2px solid " + T.paid + ";display:inline-block;padding:8px 24px;border-radius:8px}"
      + "</style></head><body><h1>QUITTANCE DE LOYER</h1>"
      + "<div class='row'><span class='label'>Proprietaire</span><span class='val'>" + owner.full_name + "</span></div>"
      + "<div class='row'><span class='label'>Locataire</span><span class='val'>" + unit.tenant + "</span></div>"
      + "<div class='row'><span class='label'>Logement</span><span class='val'>" + unit.label + "</span></div>"
      + "<div class='row'><span class='label'>Periode</span><span class='val'>" + period + "</span></div>"
      + "<div class='row'><span class='label'>Montant</span><span class='val'>" + fcfa(unit.rent) + "</span></div>"
      + "<div class='row'><span class='label'>Date de paiement</span><span class='val'>" + (paid_at || "-") + "</span></div>"
      + "<div style='text-align:center'><div class='stamp'>PAYE</div></div>"
      + "<p style='margin-top:40px;font-size:12px;color:#999'>Genere par KER — Votre logement au Senegal.</p>"
      + "</body></html>");
    w.document.close(); w.print();
  };
  return (
    <Sheet close={close} title={"Quittance · " + period}>
      <div style={{ fontSize: 14, lineHeight: 1.9 }}>
        <Row k="Locataire" v={unit.tenant} /><Row k="Logement" v={unit.label} />
        <Row k="Periode" v={period} /><Row k="Montant" v={fcfa(unit.rent)} /><Row k="Paye le" v={paid_at || "-"} />
      </div>
      <button onClick={print} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 16, padding: 14 }}><Download size={16} /> Generer le PDF</button>
      <button onClick={saveDoc} disabled={saved} style={{ ...ghostBtn, width: "100%", justifyContent: "center", marginTop: 8, padding: 12, opacity: saved ? 0.6 : 1 }}>
        {saved ? <><CheckIcon size={15} /> Classee dans les documents</> : <><FolderOpen size={15} /> Classer dans mes documents</>}
      </button>
    </Sheet>
  );
}

/* ===================== QUITTANCES (preuves de paiement) ===================== */
// Génère et imprime le PDF d'une quittance à partir de ses données réelles.
function printReceipt(r) {
  const w = window.open("", "_blank");
  if (!w) return;
  const money = fcfa(r.amount);
  w.document.write("<html><head><title>Quittance " + (r.number || "") + "</title><style>"
    + "body{font-family:Georgia,serif;color:#0B3D34;padding:48px;max-width:620px;margin:auto}"
    + "h1{font-size:22px;border-bottom:3px solid #0E5C4F;padding-bottom:12px;margin-bottom:6px}"
    + ".num{color:#5E6B66;font-size:13px;margin-bottom:24px}"
    + ".row{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid #eee}"
    + ".label{color:#5E6B66}.val{font-weight:700}"
    + ".stamp{margin-top:28px;color:#1E9E77;font-size:20px;font-weight:700;border:2px solid #1E9E77;display:inline-block;padding:8px 24px;border-radius:8px}"
    + ".foot{margin-top:40px;font-size:12px;color:#999}"
    + "</style></head><body>"
    + "<h1>QUITTANCE DE LOYER</h1>"
    + "<div class='num'>N° " + (r.number || "—") + "</div>"
    + "<div class='row'><span class='label'>Propriétaire</span><span class='val'>" + (r.owner_name || "—") + "</span></div>"
    + "<div class='row'><span class='label'>Locataire</span><span class='val'>" + (r.tenant_name || "—") + "</span></div>"
    + "<div class='row'><span class='label'>Logement</span><span class='val'>" + (r.property_name || "") + " · " + (r.unit_label || "") + "</span></div>"
    + "<div class='row'><span class='label'>Période</span><span class='val'>" + (r.period || "—") + "</span></div>"
    + "<div class='row'><span class='label'>Montant réglé</span><span class='val'>" + money + "</span></div>"
    + "<div class='row'><span class='label'>Date de paiement</span><span class='val'>" + (r.paid_at || "—") + "</span></div>"
    + "<div style='text-align:center'><div class='stamp'>PAYÉ</div></div>"
    + "<p class='foot'>Quittance générée par KËR — Votre bien. Votre contrôle. "
    + "Ce document atteste le règlement du loyer indiqué ci-dessus.</p>"
    + "</body></html>");
  w.document.close();
  w.focus();
  w.print();
}

function ReceiptsScreen({ receipts, back }) {
  return (
    <Screen title="Mes quittances" back={back}>
      {(!receipts || receipts.length === 0) ? (
        <div style={{ textAlign: "center", color: T.mut, padding: "48px 20px" }}>
          <Receipt size={40} color={T.line} />
          <div style={{ marginTop: 12, fontSize: 15 }}>Aucune quittance pour l'instant.</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Une quittance est créée automatiquement à chaque paiement enregistré.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {receipts.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.property_name} · {r.unit_label}</div>
                  <div style={{ fontSize: 13, color: T.mut, marginTop: 2 }}>Période {r.period} · {r.tenant_name}</div>
                </div>
                <div style={{ background: T.paid + "18", color: T.paid, fontWeight: 700, fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>PAYÉ</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: "8px 0 2px" }}>{fcfa(r.amount)}</div>
              <div style={{ fontSize: 12, color: T.mut }}>N° {r.number} · réglé le {r.paid_at || "—"}</div>
              <button onClick={() => printReceipt(r)} style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 12, padding: 12 }}>
                <Download size={15} /> Télécharger la quittance (PDF)
              </button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

/* ===================== DOCUMENTS (§13) ===================== */
const DOC_META = {
  contrat:     { label: "Contrat",     icon: FileText,  tint: "#0E6E63" },
  quittance:   { label: "Quittance",   icon: Receipt,   tint: "#1F9D6B" },
  facture:     { label: "Facture",     icon: File,      tint: "#E8973A" },
  devis:       { label: "Devis",       icon: File,      tint: "#E0A020" },
  justificatif:{ label: "Justificatif",icon: File,      tint: "#2C77C9" },
  photo:       { label: "Photo",       icon: ImageIcon, tint: "#8A5416" },
  autre:       { label: "Autre",       icon: File,      tint: "#6B7C7A" },
};
const DOC_FILTERS = ["tous", "contrat", "quittance", "facture", "devis", "justificatif", "photo"];

function Documents({ docs, properties, back, onReceipts, onUpload, onOpen, onDelete }) {
  const [filter, setFilter] = useState("tous");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(null);   // fichier choisi, en attente de catégorie
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const list = docs.filter((d) => {
    const okCat = filter === "tous" || d.category === filter;
    const okQ = !q.trim() || (d.name || "").toLowerCase().includes(q.toLowerCase());
    return okCat && okQ;
  });

  const pickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr(null);
    // limite raisonnable : 10 Mo
    if (file.size > 10 * 1024 * 1024) { setErr("Fichier trop volumineux (max 10 Mo)."); return; }
    setPending({ file, category: "facture", name: file.name });
    e.target.value = ""; // permet de re-choisir le même fichier
  };

  const confirmUpload = async () => {
    if (!pending || !onUpload) return;
    setBusy(true); setErr(null);
    try {
      await onUpload(pending.file, { category: pending.category, name: pending.name });
      setPending(null);
    } catch (e) { setErr((e && e.message) || "Envoi impossible."); }
    finally { setBusy(false); }
  };

  const openDoc = async (d) => {
    if (!onOpen) return;
    const url = await onOpen(d.file_url);
    if (url) window.open(url, "_blank");
  };

  return (
    <Screen title="Mes documents" back={back}
      action={<label style={{ ...addBtn, cursor: "pointer" }}><Upload size={16} /> Ajouter
        <input type="file" accept="image/*,application/pdf" onChange={pickFile} style={{ display: "none" }} /></label>}>
      {onReceipts && (
        <button onClick={onReceipts} style={{ ...cardBtn, width: "100%", marginBottom: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: T.paid + "18", color: T.paid, display: "grid", placeItems: "center" }}><Receipt size={18} /></span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={{ display: "block", fontWeight: 700 }}>Quittances de loyer</span>
            <span style={{ display: "block", fontSize: 12.5, color: T.mut }}>Preuves de paiement générées automatiquement</span>
          </span>
          <ChevronRight size={18} color={T.mut} />
        </button>
      )}

      {err && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
        <Search size={16} color={T.mut} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un document"
          style={{ border: "none", outline: "none", fontSize: 14, fontFamily: "inherit", flex: 1, background: "transparent" }} />
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
        {DOC_FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              flexShrink: 0, padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 700, textTransform: "capitalize",
              border: "1px solid " + (on ? T.teal : T.line), background: on ? T.teal : T.card, color: on ? "#fff" : T.mut }}>
              {f === "tous" ? "Tous" : (DOC_META[f] ? DOC_META[f].label : f)}
            </button>
          );
        })}
      </div>
      {list.length === 0 ? <Empty text="Aucun document dans cette categorie." /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {list.map((d) => {
            const meta = DOC_META[d.category] || DOC_META.autre;
            const dateStr = d.date || (d.created_at ? new Date(d.created_at).toLocaleDateString("fr-FR") : "");
            return (
              <div key={d.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.tint + "18", color: meta.tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <meta.icon size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                  <div style={{ fontSize: 13, color: T.mut }}>{meta.label}{dateStr ? " · " + dateStr : ""}</div>
                </div>
                {d.file_url && <button onClick={() => openDoc(d)} style={navIcon} title="Ouvrir"><ArrowRight size={16} /></button>}
                {onDelete && <button onClick={() => onDelete(d.id, d.file_url)} style={navIcon} title="Supprimer"><X size={16} color={T.late} /></button>}
              </div>
            );
          })}
        </div>
      )}

      {/* Feuille : choisir la catégorie du fichier choisi */}
      {pending && (
        <Sheet close={() => setPending(null)} title="Classer le document">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13, color: T.mut, wordBreak: "break-all" }}>{pending.name}</div>
            <FormField label="Nom du document">
              <input value={pending.name} onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))} style={fieldInput} />
            </FormField>
            <FormField label="Catégorie">
              <select value={pending.category} onChange={(e) => setPending((p) => ({ ...p, category: e.target.value }))} style={fieldInput}>
                <option value="contrat">Contrat</option>
                <option value="facture">Facture</option>
                <option value="devis">Devis</option>
                <option value="justificatif">Justificatif</option>
                <option value="photo">Photo</option>
                <option value="autre">Autre</option>
              </select>
            </FormField>
            {err && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
            <button onClick={confirmUpload} disabled={busy} style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Envoi en cours…" : "Envoyer le document"}
            </button>
          </div>
        </Sheet>
      )}
    </Screen>
  );
}

/* ===================== PROFIL PROPRIÉTAIRE ===================== */
function ProfileScreen({ owner, onSave, back }) {
  const [name, setName] = useState(owner.full_name || "");
  const [phone, setPhone] = useState(owner.phone || "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);
  const save = async () => {
    setErr(null); setSaving(true); setDone(false);
    try {
      await onSave({ fullName: name.trim(), phone: phone.trim() });
      setDone(true); setTimeout(() => setDone(false), 2000);
    } catch (e) { setErr((e && e.message) || "Enregistrement impossible."); }
    finally { setSaving(false); }
  };
  return (
    <Shell>
      <Screen title="Mon profil" back={back}>
        <div style={{ display: "grid", gap: 14 }}>
          <FormField label="Nom complet">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Ibrahima Fall" style={fieldInput} />
          </FormField>
          <FormField label="Téléphone (avec indicatif pays)">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex : +221 77 123 45 67" style={fieldInput} inputMode="tel" />
          </FormField>
          <div style={{ fontSize: 12.5, color: T.mut }}>
            Ce numéro permet à vos locataires de vous contacter (WhatsApp, appel). Indiquez l'indicatif du pays : +221 pour le Sénégal, +33 pour la France, +1 pour les USA/Canada…
          </div>
          {err && <div style={{ background: T.late + "18", color: T.late, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, justifyContent: "center", padding: 14, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Enregistrement…" : done ? "✓ Enregistré" : "Enregistrer"}
          </button>
        </div>
      </Screen>
    </Shell>
  );
}

/* ===================== CONTACT ===================== */
// Nettoie un numéro pour WhatsApp (format E.164 sans + ni espaces).
function waNumber(phone) {
  if (!phone) return "";
  let p = ("" + phone).replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  // si numéro sénégalais local (commence par 7 et 9 chiffres), préfixer 221
  if (/^7\d{8}$/.test(p)) p = "221" + p;
  return p;
}

function ContactScreen({ contact, fallbackName, back }) {
  const name = (contact && contact.name) || fallbackName || "le propriétaire";
  const phone = contact && contact.phone;
  const wa = waNumber(phone);
  const hasPhone = Boolean(phone);
  return (
    <Shell>
      <Screen title="Contacter" back={back}>
        <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: T.tealSoft, color: T.teal, display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
            <Users size={30} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{name}</div>
          <div style={{ fontSize: 14, color: T.mut, marginTop: 2 }}>Propriétaire</div>
          {hasPhone && <div style={{ fontSize: 15, color: T.ink, marginTop: 8, fontWeight: 600 }}>{phone}</div>}
        </div>

        {!hasPhone ? (
          <div style={{ background: T.sunSoft, color: "#8A5416", borderRadius: 14, padding: 16, fontSize: 14, textAlign: "center" }}>
            Le propriétaire n'a pas encore renseigné de numéro de téléphone. Vous pourrez le contacter dès qu'il l'aura ajouté.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <a href={"https://wa.me/" + wa} target="_blank" rel="noreferrer"
              style={{ ...bigContactBtn, background: "#25D366" + "18", color: "#128C4B", border: "1px solid #25D36640" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}><MessageCircle size={22} /> <span style={{ fontWeight: 700 }}>WhatsApp</span></span>
              <ChevronRight size={18} />
            </a>
            <a href={"tel:" + ("" + phone).replace(/\s/g, "")}
              style={{ ...bigContactBtn, background: T.tealSoft, color: T.teal, border: "1px solid " + T.teal + "40" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}><Users size={22} /> <span style={{ fontWeight: 700 }}>Appeler</span></span>
              <ChevronRight size={18} />
            </a>
          </div>
        )}
        <div style={{ fontSize: 12.5, color: T.mut, marginTop: 16, textAlign: "center" }}>
          Vos échanges se font directement, hors de KËR.
        </div>
      </Screen>
    </Shell>
  );
}
const bigContactBtn = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: 16, textDecoration: "none", fontSize: 16 };

/* ===================== CONTACT (fin) ===================== */

/* ===================== ONBOARDING PROPRIETAIRE (§26) ===================== */
const PROP_TYPES = [
  { key: "maison", label: "Maison" }, { key: "appartement", label: "Appartement" },
  { key: "immeuble", label: "Immeuble" }, { key: "boutique", label: "Boutique" },
  { key: "local_commercial", label: "Local commercial" },
];

function Onboarding({ owner, onDone, logout }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ country: "", propertyName: "", type: "appartement", city: "", district: "", unitLabel: "Logement 1", tenant: "", rent: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const rentNum = parseInt(("" + f.rent).replace(/\D/g, ""), 10) || 0;
  const total = 5;

  const canNext =
    (step === 1 && f.country) ||
    (step === 2) ||
    (step === 3 && f.propertyName.trim() && f.city.trim()) ||
    (step === 4 && f.tenant.trim()) ||
    (step === 5 && rentNum > 0);

  const next = () => {
    if (step < total) return setStep(step + 1);
    onDone({ ...f, rent: rentNum });
  };

  return (
    <Shell>
      <div className="fade" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {step > 1
            ? <button onClick={() => setStep(step - 1)} style={navIcon}><ChevronLeft size={20} /></button>
            : <button onClick={logout} style={navIcon}><X size={18} /></button>}
          <div style={{ flex: 1 }}>
            <div style={{ height: 6, background: T.line, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: (step / total * 100) + "%", height: "100%", background: T.teal, transition: "width .3s" }} />
            </div>
          </div>
          <div style={{ fontSize: 13, color: T.mut, fontWeight: 700 }}>{step}/{total}</div>
        </div>

        <div style={{ marginTop: 28 }}>
          {step === 1 && (
            <StepWrap icon={MapPin} title="Ou vivez-vous ?" hint="Cela nous aide a adapter votre experience.">
              {["France", "Senegal", "Autre"].map((c) => (
                <ChoiceRow key={c} label={c} active={f.country === c} onClick={() => set("country", c)} />
              ))}
            </StepWrap>
          )}
          {step === 2 && (
            <StepWrap icon={Building2} title="Vous possedez un logement au Senegal ?" hint="KER est concu exactement pour ce cas.">
              <div style={{ ...card, textAlign: "center", padding: 24 }}>
                <div style={{ fontSize: 40 }}>🏠</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>Parfait.</div>
                <div style={{ fontSize: 14, color: T.mut, marginTop: 4 }}>Ajoutons votre premier bien en deux etapes.</div>
              </div>
            </StepWrap>
          )}
          {step === 3 && (
            <StepWrap icon={Building2} title="Votre premier logement" hint="Vous pourrez en ajouter d'autres ensuite.">
              <Field label="Nom du logement"><input value={f.propertyName} onChange={(e) => set("propertyName", e.target.value)} placeholder="Ex : Immeuble Parcelles" style={fieldInput} /></Field>
              <Field label="Type">
                <select value={f.type} onChange={(e) => set("type", e.target.value)} style={fieldInput}>
                  {PROP_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Ville"><input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex : Dakar" style={fieldInput} /></Field>
              <Field label="Quartier (optionnel)"><input value={f.district} onChange={(e) => set("district", e.target.value)} placeholder="Ex : Parcelles Assainies" style={fieldInput} /></Field>
            </StepWrap>
          )}
          {step === 4 && (
            <StepWrap icon={Users} title="Votre locataire" hint="Vous pourrez l'inviter a rejoindre l'application juste apres.">
              <Field label="Nom du logement / unite"><input value={f.unitLabel} onChange={(e) => set("unitLabel", e.target.value)} placeholder="Ex : Appartement A" style={fieldInput} /></Field>
              <Field label="Nom du locataire"><input value={f.tenant} onChange={(e) => set("tenant", e.target.value)} placeholder="Ex : Mamadou" style={fieldInput} /></Field>
            </StepWrap>
          )}
          {step === 5 && (
            <StepWrap icon={Wallet} title="Le loyer mensuel" hint="En FCFA. Vous pourrez le modifier plus tard.">
              <Field label="Montant du loyer (FCFA)"><input value={f.rent} onChange={(e) => set("rent", e.target.value)} inputMode="numeric" placeholder="150 000" style={{ ...fieldInput, fontSize: 22, fontWeight: 800 }} /></Field>
              {rentNum > 0 && <div style={{ fontSize: 14, color: T.teal, fontWeight: 700, marginTop: 4 }}>{fcfa(rentNum)} / mois</div>}
            </StepWrap>
          )}
        </div>

        <button disabled={!canNext} onClick={next}
          style={{ ...primaryBtn, width: "100%", justifyContent: "center", marginTop: 24, padding: 15, fontSize: 16, opacity: canNext ? 1 : 0.4 }}>
          {step < total ? "Continuer" : "Terminer et voir mon tableau de bord"}
        </button>
      </div>
    </Shell>
  );
}

function StepWrap({ icon: Icon, title, hint, children }) {
  return (
    <div className="fade">
      <div style={{ width: 52, height: 52, borderRadius: 14, background: T.tealSoft, color: T.teal, display: "grid", placeItems: "center", marginBottom: 14 }}><Icon size={26} /></div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
      {hint && <div style={{ fontSize: 14, color: T.mut, marginTop: 6 }}>{hint}</div>}
      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>{children}</div>
    </div>
  );
}
function ChoiceRow({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      background: active ? T.tealSoft : T.card, border: "2px solid " + (active ? T.teal : T.line),
      borderRadius: 14, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 16, color: T.ink }}>
      {label}
      {active && <CheckIcon size={20} color={T.teal} />}
    </button>
  );
}
function Field({ label, children }) {
  return <div><div style={fieldLabel}>{label}</div>{children}</div>;
}

function Shell({ children, nav }) {
  return (
    <div style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: nav ? 90 : 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 3px solid ` + T.sun + `; outline-offset: 2px; }
        textarea, input, select { color: ` + T.ink + `; }
        @media (prefers-reduced-motion: no-preference){
          .fade { animation: f .3s ease both; } @keyframes f { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:none;} }
          /* Entrée d'accueil : le symbole se dessine, le nom monte, les blocs cascadent */
          .ker-draw { stroke-dasharray: 130; stroke-dashoffset: 130; animation: kerDraw .5s ease forwards; }
          @keyframes kerDraw { to { stroke-dashoffset: 0; } }
          .ker-pop { animation: kerSpin .9s cubic-bezier(.2,.8,.2,1) both; }
          @keyframes kerSpin {
            from { opacity: 0; transform: rotate(-270deg) scale(.4); }
            60%  { opacity: 1; }
            to   { opacity: 1; transform: rotate(0deg) scale(1); }
          }
          .ker-rise { opacity:0; animation: kerRise .5s cubic-bezier(.2,.8,.2,1) forwards; }
          @keyframes kerRise { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform: none; } }
        }
        @media (prefers-reduced-motion: reduce){
          .ker-draw { stroke-dashoffset: 0; }
          .ker-pop, .ker-rise { opacity: 1; }
        }
      `}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
        {DEMO && <div style={{ background: T.sunSoft, color: "#8A5416", fontSize: 12.5, padding: "8px 14px", borderRadius: 12, margin: "12px 0 0", textAlign: "center", fontWeight: 600 }}>Mode demo — donnees de test.</div>}
        {children}
      </div>
      {nav}
    </div>
  );
}

function BottomNav({ items, active, onPick }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.card, borderTop: "1px solid " + T.line, display: "flex", justifyContent: "space-around", padding: "8px 0 12px", maxWidth: 480, margin: "0 auto" }}>
      {items.map((t) => {
        const on = active === t.n;
        return (
          <button key={t.n} onClick={() => onPick(t.n)} style={{ background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", gap: 3, color: on ? T.teal : T.mut, fontFamily: "inherit" }}>
            <t.i size={22} /><span style={{ fontSize: 11, fontWeight: 600 }}>{t.l}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Screen({ title, sub, back, action, children }) {
  return (
    <div className="fade" style={{ paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {back && <button onClick={back} style={navIcon}><ChevronLeft size={20} /></button>}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700 }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: T.mut }}>{sub}</div>}
        </div>
        {action}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Sheet({ title, children, close }) {
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "end center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: "22px 22px 0 0", padding: 22, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button onClick={close} style={navIcon}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid " + T.line, padding: "6px 0" }}><span style={{ color: T.mut }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span></div>;
}
function Empty({ text }) {
  return <div style={{ textAlign: "center", color: T.mut, padding: "40px 0", fontSize: 14 }}>{text}</div>;
}

const card = { background: T.card, border: "1px solid " + T.line, borderRadius: 18, padding: 16 };
const cardBtn = { ...card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "inherit" };
const navIcon = { width: 40, height: 40, borderRadius: 12, border: "1px solid " + T.line, background: T.card, display: "grid", placeItems: "center", cursor: "pointer" };
const addBtn = { display: "inline-flex", alignItems: "center", gap: 6, background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: "8px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const primaryBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.teal, color: "#fff", border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const ghostBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.tealSoft, color: T.teal, border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const dangerBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.late + "18", color: T.late, border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const fieldLabel = { fontSize: 13, color: T.mut, fontWeight: 600, marginBottom: 6 };
const fieldInput = { width: "100%", border: "1px solid " + T.line, borderRadius: 12, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", background: T.card };
