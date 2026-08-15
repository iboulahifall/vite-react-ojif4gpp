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
import { auth, owner, manager, tenant, receipts, docs as docsApi, notifications as notifApi } from "./data.js";

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
    receipts: [
      { id: "r1", number: "KER-Q-2026-000001", tenant_name: "Awa", owner_name: "Ibrahima", property_name: "Immeuble Parcelles", unit_label: "Appartement B", period: "2026-07", amount: 150000, paid_at: "2026-07-05" },
    ],
    notifications: [
      { id: "n1", title: "Nouveau problème signalé", body: "Plomberie — Appartement B", read: false, created_at: new Date().toISOString() },
      { id: "n2", title: "Dépense à valider", body: "Réparation toiture — 120000 FCFA", read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
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
    managerCode: p.manager_code || "",
    units: (p.units || []).map((u) => {
      const lease = (u.leases || [])[0] || {};
      const pays = (lease.rent_payments || []).map((r) => ({
        period: r.period, amount: r.amount, status: r.status, paid_at: r.paid_at,
      }));
      return {
        id: u.id, label: u.label, rent: u.rent_amount || lease.rent_amount || 0,
        due: u.due_day || 5, tenant: lease.tenant_name || "—",
        code: u.invite_code || "",
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
        const [props, problems, expenses, documents, recs, meProf, notifs] = await Promise.all([
          owner.properties(), owner.problems(), owner.expenses(), owner.documents(),
          receipts.mine().catch(() => []),
          auth.me().catch(() => null),
          notifApi.list().catch(() => []),
        ]);
        const adapted = adaptProperties(props);
        // rattacher problèmes/dépenses à leur logement
        adapted.forEach((p) => {
          p.problems = (problems || []).filter((m) => m.units?.property_id === p.id)
            .map((m) => ({ id: m.id, unitId: m.unit_id, unit: m.units?.label, category: m.category, desc: m.description, status: m.status, by: "—", photos: m.photo_urls || (m.photo_url ? [m.photo_url] : []),
              repairStatus: m.repair_status || "nouveau", artisan: m.artisan || "", amountEst: m.amount_est || null, amountReal: m.amount_real || null, repairNote: m.repair_note || "" }));
          p.expenses = (expenses || []).filter((e) => e.property_id === p.id)
            .map((e) => ({ id: e.id, label: e.description || e.category, category: e.category, amount: e.amount, status: e.status, by: "—", supplier: e.supplier || "", spentAt: e.spent_at || null, receiptUrl: e.receipt_url || null }));
        });
        // En réel : un propriétaire sans aucun logement doit passer par l'onboarding.
        const prof = (meProf && meProf.profile) || {};
        setDb((d) => ({
          ...d,
          properties: adapted,
          documents: documents || [],
          receipts: recs || [],
          notifications: notifs || [],
          owner: { ...d.owner, onboarded: adapted.length > 0,
                   full_name: prof.full_name || d.owner.full_name,
                   phone: prof.phone || d.owner.phone || "" },
        }));
      } else if (role === "gestionnaire") {
        const [props, meProf] = await Promise.all([
          manager.properties(),
          auth.me().catch(() => null),
        ]);
        const prof = (meProf && meProf.profile) || {};
        setDb((d) => ({ ...d, properties: adaptProperties(props),
          manager: { ...d.manager, full_name: prof.full_name || d.manager.full_name } }));
      } else if (role === "locataire") {
        const lease = await tenant.myLease();
        if (lease && lease.units) {
          const u = lease.units;
          const prop = u.properties || {};
          const pays = (lease.rent_payments || []).map((r) => ({
            period: r.period, amount: r.amount, status: r.status, paid_at: r.paid_at,
          }));
          // On fabrique une "propriété" à une unité, pour réutiliser l'écran locataire.
          const unit = {
            id: u.id, label: u.label, rent: lease.rent_amount || u.rent_amount || 0,
            due: lease.due_day || u.due_day || 5, tenant: "Vous",
            code: u.invite_code || "", leaseId: lease.id,
            payments: pays.length ? pays : mkHist(lease.rent_amount || 0, ["wait"]),
          };
          const recs = await receipts.mine().catch(() => []);
          const ownerContact = await tenant.ownerContact().catch(() => null);
          setDb((d) => ({
            ...d, tenantLease: lease, receipts: recs || [], ownerContact: ownerContact,
            properties: [{ id: prop.id || "p_t", name: prop.name || "Mon logement", city: prop.city || "", district: "", units: [unit], problems: [], expenses: [] }],
          }));
        } else {
          setDb((d) => ({ ...d, tenantLease: null }));
        }
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
    recordPayment: async (unitId, rentAmount, leaseId) => {
      if (!REAL) return demo.recordPayment(unitId);
      setError(null);
      try {
        if (roleRef.current === "locataire" && leaseId) {
          const now = new Date();
          const period = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
          await tenant.recordPayment(leaseId, { period, amount: rentAmount || 0 });
          await load("locataire");
        } else {
          await owner.recordPaymentForUnit(unitId, rentAmount || 0);
          await load(roleRef.current || "proprietaire");
        }
      } catch (e) { setError(e.message || "Enregistrement du paiement impossible."); }
    },
    reportProblem: wrap(
      (unitId, category, description, photoUrls) => tenant.reportProblem(unitId, { category, description, photoUrls }),
      demo.addProblem),
    // Uploader une photo de problème, renvoie son chemin (réel) ou null (démo)
    uploadProblemPhoto: async (file) => {
      if (!REAL) return null;
      try { return await tenant.uploadProblemPhoto(file); } catch (e) { setError(e.message || "Envoi de la photo impossible."); return null; }
    },
    photoUrl: async (path) => {
      if (!REAL || !path) return null;
      try { return await tenant.photoUrl(path); } catch (e) { return null; }
    },
    setProblemStatus: wrap(
      (id, status) => owner.setProblemStatus(id, status),
      demo.setProblemStatus),
    updateRepair: async (id, patch) => {
      if (!REAL) {
        setDb((d) => {
          const nd = structuredClone(d);
          for (const p of nd.properties) {
            const m = (p.problems || []).find((x) => x.id === id);
            if (m) Object.assign(m, patch);
          }
          return nd;
        });
        return;
      }
      setError(null);
      try { await owner.updateRepair(id, patch); await load("proprietaire"); }
      catch (e) { setError(e.message || "Mise à jour de la réparation impossible."); }
    },
    addExpense: async (propId, label, category, amount, by, extra) => {
      const threshold = (db.settings && db.settings.approval_threshold) || 50000;
      const status = amount > threshold ? "attente_validation" : "auto_validee";
      if (!REAL) return demo.addExpense(propId, label, category, amount, by);
      setError(null);
      try {
        await manager.addExpense(propId, {
          description: label, category, amount, status,
          supplier: (extra && extra.supplier) || null,
          spentAt: (extra && extra.spentAt) || null,
          receiptUrl: (extra && extra.receiptUrl) || null,
        });
        await load(roleRef.current || "proprietaire");
      } catch (e) { setError(e.message || "Ajout de la dépense impossible."); }
    },
    uploadExpenseReceipt: async (file) => {
      if (!REAL) return null;
      try { return await manager.uploadExpenseReceipt(file); } catch (e) { setError(e.message || "Envoi du justificatif impossible."); return null; }
    },
    deleteExpense: async (propId, id, receiptUrl) => {
      if (!REAL) {
        setDb((d) => {
          const nd = structuredClone(d);
          const p = nd.properties.find((x) => x.id === propId);
          if (p) p.expenses = (p.expenses || []).filter((e) => e.id !== id);
          return nd;
        });
        return;
      }
      setError(null);
      try { await owner.deleteExpense(id, receiptUrl); await load(roleRef.current || "proprietaire"); }
      catch (e) { setError(e.message || "Suppression de la dépense impossible."); }
    },
    setExpenseStatus: wrap(
      (propId, id, status) => owner.setExpenseStatus(id, status),
      demo.setExpenseStatus),
    setThreshold: demo.setThreshold,     // réglage : local suffit (réel : table settings)
    addDocument: demo.addDocument,       // en réel : owner.documents() au prochain load
    // --- Profil (nom, téléphone) ---
    updateProfile: async (patch) => {
      if (!REAL) { setDb((d) => ({ ...d, owner: { ...d.owner, ...(patch.fullName ? { full_name: patch.fullName } : {}), ...(patch.phone ? { phone: patch.phone } : {}) } })); return; }
      setError(null);
      try {
        await auth.updateProfile(patch);
        setDb((d) => ({ ...d, owner: { ...d.owner, full_name: patch.fullName ?? d.owner.full_name, phone: patch.phone ?? d.owner.phone } }));
      } catch (e) { setError(e.message || "Mise à jour du profil impossible."); throw e; }
    },
    // --- Affectation gestionnaire ---
    findPropertyByCode: async (code) => {
      if (!REAL) return { property_name: "Immeuble Parcelles", city: "Dakar" };
      return manager.findPropertyByCode(code);
    },
    joinAsManager: async (code, fullName) => {
      if (!REAL) { await load("gestionnaire"); return "demo"; }
      setError(null);
      const id = await manager.joinAsManager(code, fullName);
      await load("gestionnaire");
      return id;
    },
    managerHasProperties: (db.properties && db.properties.length > 0),
    // --- Notifications ---
    notifications: db.notifications || [],
    markNotificationsRead: async () => {
      if (!REAL) { setDb((d) => ({ ...d, notifications: (d.notifications || []).map((n) => ({ ...n, read: true })) })); return; }
      try { await notifApi.markAllRead(); setDb((d) => ({ ...d, notifications: (d.notifications || []).map((n) => ({ ...n, read: true })) })); }
      catch (e) {}
    },
    // --- Documents (upload/consultation/suppression réels) ---
    uploadDocument: async (file, meta) => {
      if (!REAL) {
        // démo : on ajoute juste une entrée locale
        setDb((d) => ({ ...d, documents: [{ id: "d" + Date.now(), category: meta.category || "autre", name: meta.name || file.name, date: new Date().toLocaleDateString("fr-FR") }, ...(d.documents || [])] }));
        return;
      }
      setError(null);
      try {
        await docsApi.add(file, meta);
        const list = await docsApi.list();
        setDb((d) => ({ ...d, documents: list || [] }));
      } catch (e) { setError(e.message || "Envoi du document impossible."); throw e; }
    },
    openDocument: async (fileUrl) => {
      if (!REAL || !fileUrl) return null;
      try { return await docsApi.open(fileUrl); } catch (e) { setError(e.message || "Ouverture impossible."); return null; }
    },
    deleteDocument: async (id, fileUrl) => {
      if (!REAL) { setDb((d) => ({ ...d, documents: (d.documents || []).filter((x) => x.id !== id) })); return; }
      setError(null);
      try {
        await docsApi.remove(id, fileUrl);
        const list = await docsApi.list();
        setDb((d) => ({ ...d, documents: list || [] }));
      } catch (e) { setError(e.message || "Suppression impossible."); }
    },
    // --- Parcours locataire ---
    tenantLease: db.tenantLease || null,
    receipts: db.receipts || [],
    findUnitByCode: async (code) => {
      if (!REAL) {
        const u = demoSeed().properties[0].units.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
        return u ? { unit_label: u.label, property_name: "Immeuble Parcelles", rent: u.rent } : null;
      }
      return tenant.findUnitByCode(code);
    },
    joinWithCode: async (code, fullName) => {
      if (!REAL) { await load("locataire"); return "demo"; }
      setError(null);
      const leaseId = await tenant.joinWithCode(code, fullName); // peut throw → géré par l'appelant
      await load("locataire");
      return leaseId;
    },
    // Code d'invitation réel d'une unité (pour l'écran "Inviter le locataire")
    inviteCode: async (unitId, fallback) => {
      if (!REAL) return fallback || "";
      try { return await owner.unitInviteCode(unitId); } catch (e) { return fallback || ""; }
    },
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