/* WALLU — Contrôle logement (états des lieux / inspections)
   Écrans : liste des inspections d'un logement + création.
   Autonome : styles internes (couleurs WALLU), données via ./lib/data.js */

   import React, { useState, useEffect } from "react";
   import { inspections as api } from "./lib/data.js";
   import {
     ChevronLeft, Plus, Trash2, ClipboardCheck, LogIn, LogOut, Repeat, Calendar,
   } from "lucide-react";
   
   /* Couleurs WALLU (alignées sur le thème de l'app) */
   const C = {
     ink: "#0B3D34", paper: "#F7F4EC", card: "#FFFFFF",
     teal: "#0E5C4F", tealSoft: "#E2EEEA", sun: "#E7A335", sunSoft: "#FBEED6",
     good: "#1E9E77", wait: "#E0A020", bad: "#D2493B",
     line: "#E6E0D2", mut: "#5E6B66",
   };
   
   /* Libellés lisibles pour les types et statuts */
   const TYPE_LABEL = { entree: "État des lieux d'entrée", sortie: "État des lieux de sortie", periodique: "Inspection périodique" };
   const TYPE_ICON = { entree: LogIn, sortie: LogOut, periodique: Repeat };
   const STATUS_LABEL = { brouillon: "Brouillon", en_cours: "En cours", finalise: "Finalisé", signe: "Signé" };
   const STATUS_COLOR = { brouillon: C.mut, en_cours: C.wait, finalise: C.good, signe: C.teal };
   
   function fmtDate(d) {
     if (!d) return "";
     try { return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
     catch (e) { return d; }
   }
   
   /* Écran : liste des inspections d'un logement (unité) */
   export function InspectionsList({ unitId, unitLabel, back, openDetail }) {
     const [list, setList] = useState(null);   // null = chargement
     const [error, setError] = useState(null);
     const [creating, setCreating] = useState(false);
   
     const load = async () => {
       try { setList(await api.listForUnit(unitId)); }
       catch (e) { setError((e && e.message) || "Erreur de chargement."); setList([]); }
     };
     useEffect(() => { load(); }, [unitId]);
   
     const onCreate = async ({ type, title }) => {
       setError(null);
       try {
         const insp = await api.create(unitId, { type, title });
         setCreating(false);
         await load();
         if (openDetail) openDetail(insp.id);   // ouvre directement la nouvelle inspection
       } catch (e) { setError((e && e.message) || "Impossible de créer l'inspection."); }
     };
   
     const onDelete = async (id) => {
       try { await api.remove(id); await load(); }
       catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Contrôle logement</div>
             {unitLabel && <div style={{ fontSize: 13, color: C.mut }}>{unitLabel}</div>}
           </div>
           <button onClick={() => setCreating(true)} style={addBtn}><Plus size={16} /> Nouveau</button>
         </div>
   
         {error && <div style={errorBox}>{error}</div>}
   
         {list === null && <div style={{ color: C.mut, fontSize: 14, padding: "20px 0" }}>Chargement…</div>}
   
         {list && list.length === 0 && (
           <div style={emptyBox}>
             <ClipboardCheck size={30} color={C.mut} />
             <div style={{ fontWeight: 700, marginTop: 8, color: C.ink }}>Aucun état des lieux</div>
             <div style={{ fontSize: 13, color: C.mut, marginTop: 4 }}>Créez un état des lieux d'entrée, de sortie ou une inspection périodique.</div>
           </div>
         )}
   
         {list && list.map((insp) => {
           const Icon = TYPE_ICON[insp.type] || ClipboardCheck;
           return (
             <div key={insp.id} style={rowCard}>
               <button onClick={() => openDetail && openDetail(insp.id)} style={rowMain}>
                 <span style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: C.tealSoft, color: C.teal, display: "grid", placeItems: "center" }}>
                   <Icon size={18} />
                 </span>
                 <span style={{ flex: 1, textAlign: "left" }}>
                   <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: C.ink }}>
                     {insp.title || TYPE_LABEL[insp.type] || "Inspection"}
                   </span>
                   <span style={{ display: "block", fontSize: 12.5, color: C.mut, marginTop: 1 }}>
                     <Calendar size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                     {fmtDate(insp.performed_at || insp.created_at)}
                   </span>
                 </span>
                 <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, color: "#fff", background: STATUS_COLOR[insp.status] || C.mut }}>
                   {STATUS_LABEL[insp.status] || insp.status}
                 </span>
               </button>
               <button onClick={() => onDelete(insp.id)} style={delBtn} title="Supprimer"><Trash2 size={16} /></button>
             </div>
           );
         })}
   
         {creating && <CreateSheet onCreate={onCreate} close={() => setCreating(false)} />}
       </div>
     );
   }
   
   /* Feuille de création d'une inspection */
   function CreateSheet({ onCreate, close }) {
     const [type, setType] = useState("entree");
     const [title, setTitle] = useState("");
     const [busy, setBusy] = useState(false);
   
     const submit = async () => {
       setBusy(true);
       await onCreate({ type, title: title.trim() || null });
       setBusy(false);
     };
   
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 14 }}>Nouvel état des lieux</div>
   
           <div style={label}>Type</div>
           <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
             {[["entree", "État des lieux d'entrée", LogIn], ["sortie", "État des lieux de sortie", LogOut], ["periodique", "Inspection périodique", Repeat]].map(([k, l, Icon]) => {
               const on = type === k;
               return (
                 <button key={k} onClick={() => setType(k)} style={{
                   display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
                   background: on ? C.tealSoft : C.card, border: "2px solid " + (on ? C.teal : C.line),
                   borderRadius: 12, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit",
                 }}>
                   <span style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: (on ? C.teal : C.mut) + "18", color: on ? C.teal : C.mut, display: "grid", placeItems: "center" }}>
                     <Icon size={17} />
                   </span>
                   <span style={{ fontWeight: 700, fontSize: 14.5, color: C.ink }}>{l}</span>
                 </button>
               );
             })}
           </div>
   
           <div style={label}>Titre (facultatif)</div>
           <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Entrée Modou - Mars 2026" style={input} />
   
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>
             {busy ? "Création…" : "Créer et remplir"}
           </button>
         </div>
       </div>
     );
   }
   
   /* ---- styles ---- */
   const iconBtn = { width: 38, height: 38, borderRadius: 11, border: "1px solid " + C.line, background: C.card, display: "grid", placeItems: "center", cursor: "pointer", color: C.ink };
   const addBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: C.teal, color: "#fff", border: "none", borderRadius: 10, padding: "9px 13px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" };
   const rowCard = { display: "flex", alignItems: "center", gap: 4, background: C.card, border: "1px solid " + C.line, borderRadius: 14, marginBottom: 10, overflow: "hidden" };
   const rowMain = { flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" };
   const delBtn = { width: 44, alignSelf: "stretch", border: "none", borderLeft: "1px solid " + C.line, background: "transparent", color: C.bad, cursor: "pointer", display: "grid", placeItems: "center" };
   const errorBox = { background: "#D2493B18", color: "#D2493B", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 };
   const emptyBox = { textAlign: "center", padding: "40px 20px", background: C.card, border: "1px solid " + C.line, borderRadius: 16 };
   const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "end center", zIndex: 50 };
   const sheet = { width: "100%", maxWidth: 440, background: C.paper, borderRadius: "20px 20px 0 0", padding: "22px 18px 30px", maxHeight: "90vh", overflowY: "auto" };
   const label = { fontSize: 12.5, color: C.mut, fontWeight: 700, marginBottom: 7 };
   const input = { width: "100%", border: "1px solid " + C.line, borderRadius: 11, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", background: C.card, color: C.ink, boxSizing: "border-box" };
   const primaryBtn = { width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit" };
   