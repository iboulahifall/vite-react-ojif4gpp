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
   
   /* ---- styles ---- */
   const iconBtn = { width: 38, height: 38, borderRadius: 11, border: "1px solid " + C.line, background: C.card, display: "grid", placeItems: "center", cursor: "pointer", color: C.ink };
   const cardBox = { background: C.card, border: "1px solid " + C.line, borderRadius: 16, padding: 16, marginBottom: 12 };
   const fieldLabel = { fontSize: 12.5, color: C.mut, fontWeight: 700, marginBottom: 7 };
   const input = { width: "100%", border: "1px solid " + C.line, borderRadius: 11, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", background: C.card, color: C.ink, boxSizing: "border-box" };
   const errorBox = { background: "#D2493B18", color: "#D2493B", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 };
   const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "end center", zIndex: 50 };
   const sheet = { width: "100%", maxWidth: 440, background: C.paper, borderRadius: "20px 20px 0 0", padding: "22px 18px 30px", maxHeight: "90vh", overflowY: "auto" };
   const primaryBtn = { width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit" };
   