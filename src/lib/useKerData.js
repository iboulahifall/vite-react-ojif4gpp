/* KËR — useKerData
   ------------------------------------------------------------------
   Point d'entrée unique pour les données de l'app. Il bascule tout seul :
   - MODE DÉMO  (clés Supabase absentes) : état local en mémoire, données §32.
   - MODE RÉEL  (clés présentes)          : lit/écrit via data.js -> Supabase.

   L'app appelle toujours les mêmes fonctions (load, recordPayment,
   reportProblem, addExpense, setExpenseStatus, setProblemStatus,
   addDocument, completeOnboarding). Elle n'a pas à savoir quel mode
   est actif : la bascule est invisible.

   Installation :  placer ce fichier dans src/lib/ à côté de data.js.
   Utilisation dans App.jsx :
       const ker = useKerData();
       ker.load();                       // au démarrage
       await ker.recordPayment(unitId);  // etc.
*/
import { useCallback, useMemo, useRef, useState } from "react";
import { auth, owner, manager, tenant } from "./data.js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
export const REAL = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ---------- Données de démonstration (miroir de l'app, §32) ---------- */
const MONTHS = ["Jan","Fev","Mar","Avr","Mai","Juin","Juil","Aout","Sep","Oct","Nov","Dec"];
function mkHist(rent, statuses) {
  const now = new Date();
  return statuses.map((s, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (statuses.length - 1 - i), 1);
    return {
      period: MONTHS[d.getMonth()] + " " + d.getFullYear(),
      amount: rent,
      status: s === "late" ? "en_retard" : s === "wait" ? "en_attente" : "paye",
      paid_at: s === "paye" ? "05/" + (d.getMonth() + 1) + "/" + d.getFullYear() : null,
    };
  });
}
function demoSeed() {
  return {
    owner: { full_name: "Ibrahima", onboarded: true },
    manager: { full_name: "Cheikh" },
    settings: { approval_threshold: 50000 },
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
      { id: "d1", category: "quittance", name: "Quittance Awa — dernier mois", unit: "Appartement B", date: "05/" + (new Date().getMonth() + 1) + "/" + new Date().getFullYear() },
      { id: "d2", category: "contrat", name: "Bail Mamadou", unit: "Appartement A", date: "12/01/2024" },
      { id: "d3", category: "facture", name: "Facture plomberie App. B", unit: "Appartement B", date: "02/" + (new Date().getMonth() + 1) + "/" + new Date().getFullYear() },
    ],
  };
}

/* ---------- Adaptation : forme Supabase -> forme attendue par l'app ---------- */
/* L'app attend properties[].units[].payments[], problems[], expenses[].
   Supabase renvoie units(leases(rent_payments)). On normalise ici pour que
   les écrans n'aient aucune logique de mode. */
function adaptProperties(rows) {
  return (rows || []).map((p) => ({
    id: p.id, name: p.name, type: p.type, city: p.city, district: p.district,
    units: (p.units || []).map((u) => {
      const lease = (u.leases || [])[0] || {};
      const pays = (lease.rent_payments || []).map((r) => ({
        period: r.period, amount: r.amount, status: r.status, paid_at: r.paid_at,
      }));
      return {
        id: u.id, label: u.label, rent: u.rent_amount || lease.rent_amount || 0,
        due: u.due_day || 5, tenant: lease.tenant_name || "—", code: lease.code || "",
        payments: pays.length ? pays : mkHist(u.rent_amount || 0, ["wait"]),
      };
    }),
    problems: [], expenses: [],
  }));
}

/* ================================================================== */
export function useKerData() {
  const [db, setDb] = useState(demoSeed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const roleRef = useRef(null); // rôle courant en mode réel

  /* ----- MODE DÉMO : mutations locales (identiques à l'app actuelle) ----- */
  const demo = useMemo(() => ({
    recordPayment: (unitId) => setDb((d) => {
      const nd = structuredClone(d);
      const u = nd.properties.flatMap((p) => p.units).find((x) => x.id === unitId);
      const last = u.payments[u.payments.length - 1];
      last.status = "paye"; last.paid_at = new Date().toLocaleDateString("fr-FR");
      return nd;
    }),
    addProblem: (unitId, category, desc) => setDb((d) => {
      const nd = structuredClone(d);
      const prop = nd.properties.find((p) => p.units.some((u) => u.id === unitId));
      const u = prop.units.find((x) => x.id === unitId);
      prop.problems.unshift({ id: "m" + Date.now(), unitId, unit: u.label, category, desc, status: "nouveau", by: u.tenant });
      return nd;
    }),
    setProblemStatus: (id, status) => setDb((d) => {
      const nd = structuredClone(d);
      nd.properties.forEach((p) => p.problems.forEach((m) => { if (m.id === id) m.status = status; }));
      return nd;
    }),
    addExpense: (propId, label, category, amount, by) => setDb((d) => {
      const nd = structuredClone(d);
      const prop = nd.properties.find((p) => p.id === propId);
      const status = amount > nd.settings.approval_threshold ? "attente_validation" : "auto_validee";
      prop.expenses.unshift({ id: "e" + Date.now(), label, category, amount, status, by });
      return nd;
    }),
    setExpenseStatus: (propId, id, status) => setDb((d) => {
      const nd = structuredClone(d);
      const prop = nd.properties.find((p) => p.id === propId);
      prop.expenses.forEach((e) => { if (e.id === id) e.status = status; });
      return nd;
    }),
    setThreshold: (value) => setDb((d) => ({ ...d, settings: { ...d.settings, approval_threshold: value } })),
    addDocument: (doc) => setDb((d) => ({ ...d, documents: [{ id: "d" + Date.now(), ...doc }, ...(d.documents || [])] })),
    completeOnboarding: (payload) => setDb((d) => {
      const nd = structuredClone(d);
      nd.owner.onboarded = true;
      if (payload?.propertyName) {
        nd.properties.push({
          id: "p" + Date.now(), name: payload.propertyName, type: payload.type || "appartement",
          city: payload.city || "", district: payload.district || "",
          units: [{ id: "u" + Date.now(), label: payload.unitLabel || "Logement 1", rent: payload.rent || 0, due: 5,
            tenant: payload.tenant || "Locataire", code: "KER-" + Math.floor(10000 + Math.random() * 89999),
            payments: mkHist(payload.rent || 0, ["wait"]) }],
          problems: [], expenses: [],
        });
      }
      return nd;
    }),
  }), []);

  /* ----- Chargement initial ----- */
  const load = useCallback(async (role) => {
    if (!REAL) return; // en démo, le seed est déjà là
    roleRef.current = role;
    setLoading(true); setError(null);
    try {
      if (role === "proprietaire") {
        const [props, problems, expenses, documents] = await Promise.all([
          owner.properties(), owner.problems(), owner.expenses(), owner.documents(),
        ]);
        const adapted = adaptProperties(props);
        // rattacher problèmes/dépenses à leur logement
        adapted.forEach((p) => {
          p.problems = (problems || []).filter((m) => m.units?.property_id === p.id)
            .map((m) => ({ id: m.id, unitId: m.unit_id, unit: m.units?.label, category: m.category, desc: m.description, status: m.status, by: "—" }));
          p.expenses = (expenses || []).filter((e) => e.property_id === p.id)
            .map((e) => ({ id: e.id, label: e.description || e.category, category: e.category, amount: e.amount, status: e.status, by: "—" }));
        });
        // En réel : un propriétaire sans aucun logement doit passer par l'onboarding.
        setDb((d) => ({
          ...d,
          properties: adapted,
          documents: documents || [],
          owner: { ...d.owner, onboarded: adapted.length > 0 },
        }));
      } else if (role === "gestionnaire") {
        const props = await manager.properties();
        setDb((d) => ({ ...d, properties: adaptProperties(props) }));
      } else if (role === "locataire") {
        const lease = await tenant.myLease();
        // on stocke le bail brut ; les écrans locataire le lisent tel quel
        setDb((d) => ({ ...d, tenantLease: lease }));
      }
    } catch (e) {
      setError(e.message || "Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ----- Actions : réel si branché, sinon démo. Toujours re-synchronise. ----- */
  const wrap = (realFn, demoFn) => async (...args) => {
    if (!REAL) return demoFn(...args);
    setError(null);
    try {
      await realFn(...args);
      await load(roleRef.current); // relire pour refléter les triggers SQL
    } catch (e) {
      setError(e.message || "L'action a échoué. Réessayez.");
    }
  };

  const api = {
    db, loading, error, REAL,
    load,
    recordPayment: async (unitId, rentAmount) => {
      if (!REAL) return demo.recordPayment(unitId);
      setError(null);
      try {
        await owner.recordPaymentForUnit(unitId, rentAmount || 0);
        await load(roleRef.current || "proprietaire");
      } catch (e) { setError(e.message || "Enregistrement du paiement impossible."); }
    },
    reportProblem: wrap(
      (unitId, category, description) => tenant.reportProblem(unitId, { category, description }),
      demo.addProblem),
    setProblemStatus: wrap(
      (id, status) => owner.setProblemStatus(id, status),
      demo.setProblemStatus),
    addExpense: wrap(
      (propId, label, category, amount) => manager.addExpense(propId, { description: label, category, amount }),
      demo.addExpense),
    setExpenseStatus: wrap(
      (propId, id, status) => owner.setExpenseStatus(id, status),
      demo.setExpenseStatus),
    setThreshold: demo.setThreshold,     // réglage : local suffit (réel : table settings)
    addDocument: demo.addDocument,       // en réel : owner.documents() au prochain load
    // Ajouter un logement (propriétaire)
    addProperty: async (p) => {
      if (!REAL) {
        setDb((d) => {
          const nd = structuredClone(d);
          nd.properties.push({
            id: "p" + Date.now(), name: p.name, type: p.type || "appartement",
            city: p.city || "", district: p.district || "",
            units: [], problems: [], expenses: [],
          });
          return nd;
        });
        return;
      }
      setError(null);
      try {
        const prop = await owner.addProperty({ name: p.name, type: p.type || "appartement", city: p.city || "", district: p.district || "" });
        if (p.unitLabel) {
          await owner.addUnit(prop.id, { label: p.unitLabel, rent_amount: p.rent || 0, due_day: 5 });
        }
        await load("proprietaire");
      } catch (e) { setError(e.message || "Création du logement impossible."); }
    },
    // Ajouter un appartement/unité à un logement existant
    addUnit: async (propId, u) => {
      if (!REAL) {
        setDb((d) => {
          const nd = structuredClone(d);
          const prop = nd.properties.find((x) => x.id === propId);
          if (prop) prop.units.push({ id: "u" + Date.now(), label: u.label, rent: u.rent || 0, due: 5, tenant: "—", code: "KER-" + Math.floor(10000 + Math.random() * 89999), payments: mkHist(u.rent || 0, ["wait"]) });
          return nd;
        });
        return;
      }
      setError(null);
      try {
        await owner.addUnit(propId, { label: u.label, rent_amount: u.rent || 0, due_day: 5 });
        await load("proprietaire");
      } catch (e) { setError(e.message || "Ajout de l'appartement impossible."); }
    },
    completeOnboarding: async (payload) => {
      if (!REAL) return demo.completeOnboarding(payload);
      setError(null);
      try {
        if (payload && payload.propertyName) {
          const prop = await owner.addProperty({
            name: payload.propertyName,
            type: payload.type || "appartement",
            city: payload.city || "",
            district: payload.district || "",
          });
          await owner.addUnit(prop.id, {
            label: payload.unitLabel || "Logement 1",
            rent_amount: payload.rent || 0,
            due_day: 5,
          });
        }
        // marquer le profil comme onboardé (localement, pour sortir de l'écran d'onboarding)
        setDb((d) => ({ ...d, owner: { ...d.owner, onboarded: true } }));
        await load("proprietaire");
      } catch (e) {
        setError(e.message || "La création du logement a échoué.");
      }
    },
  };

  return api;
}
