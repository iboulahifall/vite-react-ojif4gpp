/* WALLU — Facturation locative : configuration d'un bail (Lot B)
   Le propriétaire définit loyer, périodicité, jour d'échéance, caution et frais. */

   import React, { useState, useEffect } from "react";
   import { billing as api } from "./lib/data.js";
   import { ChevronLeft, Plus, Trash2, Check } from "lucide-react";
   
   const C = {
     ink: "#0B3D34", paper: "#F7F4EC", card: "#FFFFFF",
     teal: "#0E5C4F", tealSoft: "#E2EEEA", sun: "#E7A335",
     good: "#1E9E77", bad: "#D2493B", line: "#E6E0D2", mut: "#5E6B66",
   };
   
   const PERIODS = [
     ["mensuel", "Mensuel"], ["trimestriel", "Trimestriel"],
     ["semestriel", "Semestriel"], ["annuel", "Annuel"],
   ];
   const fcfa = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " FCFA";
   
   export function LeaseConfig({ unitId, unitLabel, back }) {
     const [lease, setLease] = useState(undefined); // undefined = chargement
     const [error, setError] = useState(null);
     const [saved, setSaved] = useState(false);
   
     // champs
     const [rent, setRent] = useState("");
     const [periodicity, setPeriodicity] = useState("mensuel");
     const [dueDay, setDueDay] = useState("5");
     const [deposit, setDeposit] = useState("");
     const [depositStatus, setDepositStatus] = useState("non_verse");
     const [fees, setFees] = useState([]);
     const [addingFee, setAddingFee] = useState(false);
   
     const load = async () => {
       try {
         const leaseId = await api.ensureLease(unitId);
         const l = await api.getLease(unitId);
         setLease(l || { id: leaseId });
         if (l) {
           setRent(l.rent_amount ? String(l.rent_amount) : "");
           setPeriodicity(l.periodicity || "mensuel");
           setDueDay(l.due_day != null ? String(l.due_day) : "5");
           setDeposit(l.deposit_amount ? String(l.deposit_amount) : "");
           setDepositStatus(l.deposit_status || "non_verse");
           setFees(l.fees || []);
         }
       } catch (e) { setError((e && e.message) || "Chargement impossible."); setLease(null); }
     };
     useEffect(() => { load(); }, [unitId]);
   
     const save = async () => {
       setError(null); setSaved(false);
       try {
         await api.configureLease(lease.id, {
           rentAmount: Number(rent) || 0,
           periodicity,
           dueDay: parseInt(dueDay, 10) || 1,
           depositAmount: Number(deposit) || 0,
           depositStatus,
         });
         setSaved(true); setTimeout(() => setSaved(false), 2000);
       } catch (e) { setError((e && e.message) || "Enregistrement impossible."); }
     };
   
     const onAddFee = async ({ label, amount }) => {
       try {
         await api.addFee(lease.id, { kind: "recurrent", label, amount });
         setAddingFee(false);
         const l = await api.getLease(unitId);
         setFees(l ? l.fees : []);
       } catch (e) { setError((e && e.message) || "Ajout du frais impossible."); }
     };
     const onRemoveFee = async (feeId) => {
       try { await api.removeFee(feeId); setFees((prev) => prev.filter((f) => f.id !== feeId)); }
       catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     const recurringTotal = fees.filter((f) => f.kind === "recurrent" && f.active).reduce((s, f) => s + (f.amount || 0), 0);
     const totalPerPeriod = (Number(rent) || 0) + recurringTotal;
   
     if (lease === undefined) return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Configurer le bail</div>
         </div>
         <div style={{ color: C.mut, fontSize: 14, padding: "20px 0" }}>Chargement…</div>
       </div>
     );
   
     return (
       <div style={{ paddingTop: 16, paddingBottom: 30 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Configurer le bail</div>
             {unitLabel && <div style={{ fontSize: 13, color: C.mut }}>{unitLabel}</div>}
           </div>
         </div>
   
         {error && <div style={errorBox}>{error}</div>}
   
         {/* Loyer */}
         <div style={cardBox}>
           <div style={fieldLabel}>Loyer</div>
           <input value={rent} onChange={(e) => setRent(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Ex : 150000" style={input} />
           <div style={{ fontSize: 12, color: C.mut, marginTop: 4 }}>en FCFA, hors frais</div>
   
           <div style={{ ...fieldLabel, marginTop: 16 }}>Périodicité</div>
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
             {PERIODS.map(([k, l]) => {
               const on = periodicity === k;
               return <button key={k} onClick={() => setPeriodicity(k)} style={{ padding: "10px", borderRadius: 10, border: "2px solid " + (on ? C.teal : C.line), background: on ? C.tealSoft : C.card, color: on ? C.teal : C.mut, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;
             })}
           </div>
   
           <div style={{ ...fieldLabel, marginTop: 16 }}>Jour d'échéance</div>
           <input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} inputMode="numeric" placeholder="5" style={{ ...input, width: 100 }} />
           <div style={{ fontSize: 12, color: C.mut, marginTop: 4 }}>jour du mois où le loyer est dû</div>
         </div>
   
         {/* Frais récurrents */}
         <div style={cardBox}>
           <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
             <div style={{ ...fieldLabel, marginBottom: 0, flex: 1 }}>Frais récurrents</div>
             <button onClick={() => setAddingFee(true)} style={{ color: C.teal, fontWeight: 700, fontSize: 13, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Ajouter</button>
           </div>
           <div style={{ fontSize: 12, color: C.mut, marginBottom: 10 }}>Ajoutés au loyer à chaque période (charges, gardiennage…).</div>
           {fees.filter((f) => f.kind === "recurrent").length === 0
             ? <div style={{ fontSize: 13, color: C.mut }}>Aucun frais récurrent.</div>
             : fees.filter((f) => f.kind === "recurrent").map((f) => (
               <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid " + C.line }}>
                 <div style={{ flex: 1 }}>
                   <div style={{ fontSize: 14, color: C.ink }}>{f.label}</div>
                   <div style={{ fontSize: 12.5, color: C.mut }}>{fcfa(f.amount)}</div>
                 </div>
                 <button onClick={() => onRemoveFee(f.id)} style={{ border: "none", background: "transparent", color: C.bad, cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
               </div>
             ))}
         </div>
   
         {/* Caution */}
         <div style={cardBox}>
           <div style={fieldLabel}>Caution (dépôt de garantie)</div>
           <input value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Ex : 300000" style={input} />
           <div style={{ ...fieldLabel, marginTop: 16 }}>Statut de la caution</div>
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
             {[["non_verse", "Non versée"], ["detenue", "Détenue"]].map(([k, l]) => {
               const on = depositStatus === k;
               return <button key={k} onClick={() => setDepositStatus(k)} style={{ padding: "10px", borderRadius: 10, border: "2px solid " + (on ? C.teal : C.line), background: on ? C.tealSoft : C.card, color: on ? C.teal : C.mut, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;
             })}
           </div>
           <div style={{ fontSize: 12, color: C.mut, marginTop: 8 }}>La restitution (avec retenues éventuelles) se fera à la sortie, via l'état des lieux.</div>
         </div>
   
         {/* Récap */}
         <div style={{ background: C.ink, borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
           <div style={{ display: "flex", justifyContent: "space-between", color: "#9FE1CB", fontSize: 13, marginBottom: 6 }}>
             <span>Loyer</span><span>{fcfa(Number(rent) || 0)}</span>
           </div>
           {recurringTotal > 0 && (
             <div style={{ display: "flex", justifyContent: "space-between", color: "#9FE1CB", fontSize: 13, marginBottom: 6 }}>
               <span>Frais récurrents</span><span>{fcfa(recurringTotal)}</span>
             </div>
           )}
           <div style={{ display: "flex", justifyContent: "space-between", color: "#fff", fontWeight: 800, fontSize: 17, borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: 8, marginTop: 4 }}>
             <span>Total / période</span><span>{fcfa(totalPerPeriod)}</span>
           </div>
         </div>
   
         <button onClick={save} style={{ ...primaryBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
           {saved ? <><Check size={17} /> Enregistré</> : "Enregistrer le bail"}
         </button>
   
         {addingFee && <AddFeeSheet onAdd={onAddFee} close={() => setAddingFee(false)} />}
       </div>
     );
   }
   
   function AddFeeSheet({ onAdd, close }) {
     const [label, setLabel] = useState("");
     const [amount, setAmount] = useState("");
     const [busy, setBusy] = useState(false);
     const SUGGEST = ["Charges eau/électricité", "Gardiennage", "Entretien", "Ordures ménagères"];
     const submit = async () => { if (!label.trim() || !amount) return; setBusy(true); await onAdd({ label: label.trim(), amount: Number(amount) }); setBusy(false); };
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 14 }}>Ajouter un frais récurrent</div>
           <div style={fieldLabel}>Libellé</div>
           <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Charges eau/électricité" style={input} />
           <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
             {SUGGEST.map((s) => <button key={s} onClick={() => setLabel(s)} style={{ border: "1px solid " + C.line, background: C.card, borderRadius: 20, padding: "5px 11px", fontSize: 12.5, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>)}
           </div>
           <div style={{ ...fieldLabel, marginTop: 16 }}>Montant (FCFA)</div>
           <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Ex : 10000" style={input} />
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter"}</button>
         </div>
       </div>
     );
   }
   
   /* Écran : les échéances d'un bail (génération + suivi paiement) */
   export function EcheancesScreen({ unitId, unitLabel, back }) {
     const [lease, setLease] = useState(undefined);
     const [list, setList] = useState([]);
     const [error, setError] = useState(null);
     const [busy, setBusy] = useState(false);
     const [detailEch, setDetailEch] = useState(null);
   
     const refresh = async (autogen) => {
       try {
         const l = await api.getLease(unitId);
         setLease(l);
         if (!l) { setList([]); return; }
         if (autogen) { await api.generateEcheances(unitId); }
         setList(await api.listEcheances(l.id));
       } catch (e) { setError((e && e.message) || "Chargement impossible."); setLease(null); }
     };
     useEffect(() => { refresh(true); }, [unitId]);
   
     const generate = async () => {
       setBusy(true); setError(null);
       try { const r = await api.generateEcheances(unitId); await refresh(false); }
       catch (e) { setError((e && e.message) || "Génération impossible."); }
       setBusy(false);
     };
   
     const togglePaid = async (p) => {
       try {
         await api.setEcheanceStatus(p.id, p.status === "paye" ? "en_attente" : "paye");
         await refresh(false);
       } catch (e) { setError((e && e.message) || "Mise à jour impossible."); }
     };
   
     const statusOf = (p) => {
       if (p.status === "paye") return { label: "Payé", color: C.good };
       // en retard si due_date dépassée
       if (p.due_date && new Date(p.due_date) < new Date(new Date().toISOString().slice(0, 10))) return { label: "En retard", color: C.bad };
       return { label: "À payer", color: C.sun };
     };
   
     const totalDu = list.filter((p) => p.status !== "paye").reduce((s, p) => s + (p.amount || 0), 0);
   
     if (lease === undefined) return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Échéances</div>
         </div>
         <div style={{ color: C.mut, fontSize: 14, padding: "20px 0" }}>Chargement…</div>
       </div>
     );
   
     return (
       <div style={{ paddingTop: 16, paddingBottom: 30 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Échéances</div>
             {unitLabel && <div style={{ fontSize: 13, color: C.mut }}>{unitLabel}</div>}
           </div>
         </div>
   
         {error && <div style={errorBox}>{error}</div>}
   
         {!lease && <div style={{ ...cardBox, textAlign: "center", color: C.mut }}>Configurez d'abord le bail (loyer, périodicité).</div>}
   
         {lease && (
           <>
             {totalDu > 0 && (
               <div style={{ background: C.ink, borderRadius: 16, padding: "16px 18px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <span style={{ color: "#9FE1CB", fontSize: 13 }}>Total dû</span>
                 <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>{fcfa(totalDu)}</span>
               </div>
             )}
   
             {list.length === 0 && (
               <div style={{ ...cardBox, textAlign: "center", color: C.mut }}>Aucune échéance. Cliquez ci-dessous pour les générer.</div>
             )}
   
             {list.map((p) => {
               const s = statusOf(p);
               return (
                 <div key={p.id} style={{ ...cardBox, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                   <button onClick={() => setDetailEch(p)} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                     <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{p.period}</div>
                     <div style={{ fontSize: 12.5, color: C.mut }}>{fcfa(p.amount)}{p.due_date ? " · échéance " + p.due_date : ""}</div>
                   </button>
                   <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: "#fff", background: s.color }}>{s.label}</span>
                   <button onClick={() => togglePaid(p)} style={{ border: "1px solid " + (p.status === "paye" ? C.line : C.teal), background: p.status === "paye" ? C.card : C.teal, color: p.status === "paye" ? C.mut : "#fff", borderRadius: 9, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                     {p.status === "paye" ? "Annuler" : "Payé"}
                   </button>
                 </div>
               );
             })}
   
             <button onClick={generate} disabled={busy} style={{ ...primaryBtn, marginTop: 8, opacity: busy ? 0.6 : 1 }}>
               {busy ? "Génération…" : "Générer les échéances manquantes"}
             </button>
           </>
         )}
   
         {detailEch && <EcheanceDetailSheet echeance={detailEch} leaseId={lease.id} onChange={() => refresh(false)} close={() => setDetailEch(null)} />}
       </div>
     );
   }
   
   /* Feuille : détail d'une échéance + frais ponctuels */
   function EcheanceDetailSheet({ echeance, leaseId, onChange, close }) {
     const [fees, setFees] = useState(null);
     const [adding, setAdding] = useState(false);
     const [error, setError] = useState(null);
   
     const load = async () => {
       try { setFees(await api.feesForEcheance(echeance.id)); }
       catch (e) { setError((e && e.message) || "Chargement impossible."); setFees([]); }
     };
     useEffect(() => { load(); }, [echeance.id]);
   
     const onAdd = async ({ label, amount }) => {
       try {
         await api.addPonctuelFee(leaseId, echeance.id, { label, amount });
         setAdding(false);
         await load(); onChange && onChange();
       } catch (e) { setError((e && e.message) || "Ajout impossible."); }
     };
     const onRemove = async (feeId) => {
       try { await api.removePonctuelFee(feeId, echeance.id); await load(); onChange && onChange(); }
       catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     const base = echeance.base_rent != null ? echeance.base_rent : echeance.amount;
     const extra = (fees || []).reduce((s, f) => s + (f.amount || 0), 0);
   
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{echeance.period}</div>
           <div style={{ fontSize: 13, color: C.mut, marginBottom: 16 }}>{echeance.due_date ? "Échéance le " + echeance.due_date : ""}</div>
   
           {error && <div style={errorBox}>{error}</div>}
   
           {/* composition */}
           <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 12, padding: 14, marginBottom: 16 }}>
             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
               <span style={{ color: C.mut }}>Loyer + charges</span><span style={{ color: C.ink, fontWeight: 700 }}>{fcfa(base)}</span>
             </div>
             {fees === null && <div style={{ fontSize: 13, color: C.mut }}>Chargement…</div>}
             {(fees || []).map((f) => (
               <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid " + C.line }}>
                 <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{f.label}</span>
                 <span style={{ fontSize: 14, color: C.ink }}>{fcfa(f.amount)}</span>
                 <button onClick={() => onRemove(f.id)} style={{ border: "none", background: "transparent", color: C.bad, cursor: "pointer", padding: 2 }}><Trash2 size={14} /></button>
               </div>
             ))}
             <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.ink, borderTop: "2px solid " + C.line, paddingTop: 8, marginTop: 6 }}>
               <span>Total</span><span>{fcfa(base + extra)}</span>
             </div>
           </div>
   
           <button onClick={() => setAdding(true)} style={{ ...primaryBtn }}>
             <Plus size={16} style={{ verticalAlign: "-3px" }} /> Ajouter un frais ponctuel
           </button>
   
           {adding && <AddPonctuelSheet onAdd={onAdd} close={() => setAdding(false)} />}
         </div>
       </div>
     );
   }
   
   function AddPonctuelSheet({ onAdd, close }) {
     const [label, setLabel] = useState("");
     const [amount, setAmount] = useState("");
     const [busy, setBusy] = useState(false);
     const SUGGEST = ["Pénalité de retard", "Réparation", "Frais de dossier", "Régularisation charges"];
     const submit = async () => { if (!label.trim() || !amount) return; setBusy(true); await onAdd({ label: label.trim(), amount: Number(amount) }); setBusy(false); };
     return (
       <div onClick={close} style={{ ...overlay, zIndex: 60 }}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 14 }}>Frais ponctuel</div>
           <div style={fieldLabel}>Libellé</div>
           <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Pénalité de retard" style={input} />
           <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
             {SUGGEST.map((s) => <button key={s} onClick={() => setLabel(s)} style={{ border: "1px solid " + C.line, background: C.card, borderRadius: 20, padding: "5px 11px", fontSize: 12.5, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>)}
           </div>
           <div style={{ ...fieldLabel, marginTop: 16 }}>Montant (FCFA)</div>
           <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Ex : 5000" style={input} />
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter"}</button>
         </div>
       </div>
     );
   }
   
   /* Écran : suivi de la caution (dépôt de garantie) */
   export function DepositScreen({ unitId, unitLabel, back }) {
     const [lease, setLease] = useState(undefined);
     const [deductions, setDeductions] = useState([]);
     const [exits, setExits] = useState([]);
     const [error, setError] = useState(null);
     const [adding, setAdding] = useState(false);
   
     const load = async () => {
       try {
         const l = await api.getLease(unitId);
         setLease(l);
         if (l) {
           setDeductions(await api.listDeductions(l.id));
           setExits(await api.exitInspections(unitId));
         }
       } catch (e) { setError((e && e.message) || "Chargement impossible."); setLease(null); }
     };
     useEffect(() => { load(); }, [unitId]);
   
     const totalDed = deductions.reduce((s, d) => s + (d.amount || 0), 0);
     const deposit = lease ? (lease.deposit_amount || 0) : 0;
     const net = Math.max(0, deposit - totalDed);
   
     const STATUS = {
       non_verse: { label: "Non versée", color: C.mut },
       detenue: { label: "Détenue", color: C.teal },
       restituee: { label: "Restituée", color: C.good },
       partiellement_restituee: { label: "Partiellement restituée", color: C.sun },
     };
   
     const markHeld = async () => {
       try { await api.markDepositHeld(lease.id); await load(); }
       catch (e) { setError((e && e.message) || "Action impossible."); }
     };
     const restitute = async () => {
       try { await api.restituteDeposit(lease.id); await load(); }
       catch (e) { setError((e && e.message) || "Restitution impossible."); }
     };
     const onAddDed = async (d) => {
       try { await api.addDeduction(lease.id, d); setAdding(false); await load(); }
       catch (e) { setError((e && e.message) || "Ajout impossible."); }
     };
     const onRemoveDed = async (id) => {
       try { await api.removeDeduction(id); await load(); }
       catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     if (lease === undefined) return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Caution</div>
         </div>
         <div style={{ color: C.mut, fontSize: 14, padding: "20px 0" }}>Chargement…</div>
       </div>
     );
   
     const st = lease ? (STATUS[lease.deposit_status] || STATUS.non_verse) : STATUS.non_verse;
     const isReturned = lease && (lease.deposit_status === "restituee" || lease.deposit_status === "partiellement_restituee");
   
     return (
       <div style={{ paddingTop: 16, paddingBottom: 30 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Caution</div>
             {unitLabel && <div style={{ fontSize: 13, color: C.mut }}>{unitLabel}</div>}
           </div>
         </div>
   
         {error && <div style={errorBox}>{error}</div>}
   
         {!lease && <div style={{ ...cardBox, textAlign: "center", color: C.mut }}>Configurez d'abord le bail.</div>}
   
         {lease && (
           <>
             {/* montant + statut */}
             <div style={{ background: C.ink, borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <span style={{ color: "#9FE1CB", fontSize: 12, letterSpacing: 1, fontWeight: 600 }}>DÉPÔT DE GARANTIE</span>
                 <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: "#fff", background: st.color }}>{st.label}</span>
               </div>
               <div style={{ color: "#fff", fontSize: 30, fontWeight: 800, marginTop: 4 }}>{fcfa(deposit)}</div>
               {isReturned && <div style={{ color: "#9FE1CB", fontSize: 13, marginTop: 6 }}>Restitué : {fcfa(lease.deposit_returned || 0)}{lease.deposit_returned_at ? " · " + lease.deposit_returned_at : ""}</div>}
             </div>
   
             {deposit === 0 && <div style={{ ...cardBox, color: C.mut, fontSize: 13, marginBottom: 14 }}>Aucune caution définie. Renseignez-la dans « Configurer le bail ».</div>}
   
             {/* retenues */}
             <div style={cardBox}>
               <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                 <div style={{ ...fieldLabel, marginBottom: 0, flex: 1 }}>Retenues</div>
                 {!isReturned && <button onClick={() => setAdding(true)} style={{ color: C.teal, fontWeight: 700, fontSize: 13, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} style={{ verticalAlign: "-2px" }} /> Ajouter</button>}
               </div>
               <div style={{ fontSize: 12, color: C.mut, marginBottom: 10 }}>Dégâts ou impayés déduits de la caution (liés à l'état des lieux de sortie).</div>
               {deductions.length === 0
                 ? <div style={{ fontSize: 13, color: C.mut }}>Aucune retenue.</div>
                 : deductions.map((d) => (
                   <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid " + C.line }}>
                     <div style={{ flex: 1 }}>
                       <div style={{ fontSize: 14, color: C.ink }}>{d.label}</div>
                       {d.inspection_id && <div style={{ fontSize: 11.5, color: C.mut }}>Lié à un état des lieux</div>}
                     </div>
                     <span style={{ fontSize: 14, color: C.bad, fontWeight: 700 }}>-{fcfa(d.amount)}</span>
                     {!isReturned && <button onClick={() => onRemoveDed(d.id)} style={{ border: "none", background: "transparent", color: C.bad, cursor: "pointer", padding: 2 }}><Trash2 size={14} /></button>}
                   </div>
                 ))}
             </div>
   
             {/* net à restituer */}
             <div style={{ background: C.tealSoft, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink, marginBottom: 4 }}>
                 <span>Caution</span><span>{fcfa(deposit)}</span>
               </div>
               {totalDed > 0 && (
                 <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.bad, marginBottom: 4 }}>
                   <span>Total retenues</span><span>-{fcfa(totalDed)}</span>
                 </div>
               )}
               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: C.ink, borderTop: "1px solid rgba(0,0,0,.1)", paddingTop: 8, marginTop: 4 }}>
                 <span>À restituer</span><span>{fcfa(net)}</span>
               </div>
             </div>
   
             {/* actions */}
             {lease.deposit_status === "non_verse" && deposit > 0 && (
               <button onClick={markHeld} style={{ ...primaryBtn, marginBottom: 10 }}>Marquer la caution reçue</button>
             )}
             {lease.deposit_status === "detenue" && (
               <button onClick={restitute} style={{ ...primaryBtn, background: C.good, marginBottom: 10 }}>Restituer la caution ({fcfa(net)})</button>
             )}
             {isReturned && (
               <div style={{ textAlign: "center", color: C.good, fontWeight: 700, fontSize: 14, padding: 10 }}>✓ Caution {st.label.toLowerCase()}</div>
             )}
           </>
         )}
   
         {adding && <AddDeductionSheet exits={exits} onAdd={onAddDed} close={() => setAdding(false)} />}
       </div>
     );
   }
   
   function AddDeductionSheet({ exits, onAdd, close }) {
     const [label, setLabel] = useState("");
     const [amount, setAmount] = useState("");
     const [inspectionId, setInspectionId] = useState("");
     const [busy, setBusy] = useState(false);
     const SUGGEST = ["Réparation mur", "Nettoyage", "Loyer impayé", "Remplacement équipement"];
     const submit = async () => { if (!label.trim() || !amount) return; setBusy(true); await onAdd({ label: label.trim(), amount: Number(amount), inspectionId: inspectionId || null }); setBusy(false); };
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 14 }}>Ajouter une retenue</div>
           <div style={fieldLabel}>Motif</div>
           <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Réparation mur salon" style={input} />
           <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
             {SUGGEST.map((s) => <button key={s} onClick={() => setLabel(s)} style={{ border: "1px solid " + C.line, background: C.card, borderRadius: 20, padding: "5px 11px", fontSize: 12.5, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>)}
           </div>
           <div style={{ ...fieldLabel, marginTop: 16 }}>Montant (FCFA)</div>
           <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Ex : 25000" style={input} />
           {exits && exits.length > 0 && (
             <>
               <div style={{ ...fieldLabel, marginTop: 16 }}>Lier à un état des lieux de sortie (facultatif)</div>
               <select value={inspectionId} onChange={(e) => setInspectionId(e.target.value)} style={{ ...input, appearance: "auto" }}>
                 <option value="">Aucun</option>
                 {exits.map((ex) => <option key={ex.id} value={ex.id}>{ex.title || "État des lieux de sortie"}{ex.performed_at ? " · " + ex.performed_at : ""}</option>)}
               </select>
             </>
           )}
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter la retenue"}</button>
         </div>
       </div>
     );
   }
   
   /* ---- styles ---- */
   const iconBtn = { width: 38, height: 38, borderRadius: 11, border: "1px solid " + C.line, background: C.card, display: "grid", placeItems: "center", cursor: "pointer", color: C.ink };
   const cardBox = { background: C.card, border: "1px solid " + C.line, borderRadius: 16, padding: 16, marginBottom: 12 };
   const fieldLabel = { fontSize: 12.5, color: C.mut, fontWeight: 700, marginBottom: 7 };
   const input = { width: "100%", border: "1px solid " + C.line, borderRadius: 11, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", background: C.card, color: C.ink, boxSizing: "border-box" };
   const errorBox = { background: "#D2493B18", color: "#D2493B", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 };
   const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "end center", zIndex: 50 };
   const sheet = { width: "100%", maxWidth: 440, background: C.paper, borderRadius: "20px 20px 0 0", padding: "22px 18px 30px", maxHeight: "90vh", overflowY: "auto" };
   const primaryBtn = { width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit" };
   