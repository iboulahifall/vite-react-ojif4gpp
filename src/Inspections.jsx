/* WALLU — Contrôle logement (états des lieux / inspections)
   Écrans : liste des inspections d'un logement + création.
   Autonome : styles internes (couleurs WALLU), données via ./lib/data.js */

   import React, { useState, useEffect } from "react";
   import { inspections as api } from "./lib/data.js";
   import {
     ChevronLeft, Plus, Trash2, ClipboardCheck, LogIn, LogOut, Repeat, Calendar, FileText, Download,
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
   
           <div style={fieldLabel}>Type</div>
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
   
           <div style={fieldLabel}>Titre (facultatif)</div>
           <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Entrée Modou - Mars 2026" style={input} />
   
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>
             {busy ? "Création…" : "Créer et remplir"}
           </button>
         </div>
       </div>
     );
   }
   
   /* Écran : détail d'une inspection — pièces, éléments, saisie */
   export function InspectionDetail({ inspectionId, back }) {
     const [data, setData] = useState(null);
     const [error, setError] = useState(null);
     const [addingRoom, setAddingRoom] = useState(false);
     const [addItemFor, setAddItemFor] = useState(null);  // room object
     const [editItem, setEditItem] = useState(null);      // item object
     const [attaching, setAttaching] = useState(false);   // upload en cours
   
     const load = async () => {
       try { setData(await api.detail(inspectionId)); }
       catch (e) { setError((e && e.message) || "Erreur de chargement."); }
     };
     useEffect(() => { load(); }, [inspectionId]);
   
     const totalItems = data ? data.rooms.reduce((n, r) => n + r.items.length, 0) : 0;
     const notedItems = data ? data.rooms.reduce((n, r) => n + r.items.filter(isNoted).length, 0) : 0;
   
     const onAddRoom = async (name) => {
       try {
         const pos = data ? data.rooms.length : 0;
         await api.addRoom(inspectionId, name, pos);
         setAddingRoom(false);
         await load();
       } catch (e) { setError((e && e.message) || "Impossible d'ajouter la pièce."); }
     };
   
     const onRemoveRoom = async (roomId) => {
       try { await api.removeRoom(roomId); await load(); }
       catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     const onAddItem = async (room, { label, itemKind }) => {
       try {
         const pos = room.items.length;
         await api.addItem(room.id, { label, itemKind, position: pos });
         setAddItemFor(null);
         await load();
       } catch (e) { setError((e && e.message) || "Impossible d'ajouter l'élément."); }
     };
   
     const onRemoveItem = async (itemId) => {
       try { await api.removeItem(itemId); await load(); }
       catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     const onSaveItem = async (itemId, patch) => {
       try { await api.updateItem(itemId, patch); setEditItem(null); await load(); }
       catch (e) { setError((e && e.message) || "Enregistrement impossible."); }
     };
   
     const setStatus = async (status) => {
       try { await api.update(inspectionId, { status }); await load(); }
       catch (e) { setError((e && e.message) || "Impossible de changer le statut."); }
     };
   
     const onAddAttachment = async (e) => {
       const files = Array.from(e.target.files || []);
       if (!files.length) return;
       setAttaching(true);
       try {
         const current = (data && data.attachments) || [];
         const added = [];
         for (const f of files) {
           const res = await api.uploadAttachment(f);
           // on stocke "chemin|nom" pour garder le nom lisible du fichier
           added.push(res.path + "|" + res.name);
         }
         await api.setAttachments(inspectionId, [...current, ...added]);
         await load();
       } catch (err) { setError((err && err.message) || "Impossible de joindre le fichier."); }
       setAttaching(false);
     };
   
     const onOpenAttachment = async (entry) => {
       const path = entry.split("|")[0];
       try {
         const url = await api.attachmentUrl(path);
         if (url) window.open(url, "_blank");
       } catch (e) { setError("Impossible d'ouvrir le fichier."); }
     };
   
     const onRemoveAttachment = async (entry) => {
       try {
         const current = (data && data.attachments) || [];
         await api.setAttachments(inspectionId, current.filter((a) => a !== entry));
         await load();
       } catch (e) { setError((e && e.message) || "Suppression impossible."); }
     };
   
     const [applying, setApplying] = useState(false);
     const onApplyTemplate = async () => {
       setApplying(true);
       try { await api.applyTemplate(inspectionId); await load(); }
       catch (e) { setError((e && e.message) || "Impossible de générer le modèle."); }
       setApplying(false);
     };
   
     if (!data) return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>État des lieux</div>
         </div>
         {error ? <div style={errorBox}>{error}</div> : <div style={{ color: C.mut, fontSize: 14, padding: "20px 0" }}>Chargement…</div>}
       </div>
     );
   
     const typeLabel = TYPE_LABEL[data.type] || "Inspection";
   
     return (
       <div style={{ paddingTop: 16 }}>
         {/* en-tête */}
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, lineHeight: 1.15 }}>{data.title || typeLabel}</div>
             <div style={{ fontSize: 12.5, color: C.mut }}>{typeLabel} · {fmtDate(data.performed_at || data.created_at)}</div>
           </div>
           <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, color: "#fff", background: STATUS_COLOR[data.status] || C.mut }}>
             {STATUS_LABEL[data.status] || data.status}
           </span>
         </div>
   
         {error && <div style={errorBox}>{error}</div>}
   
         {/* stats */}
         <div style={{ display: "flex", gap: 16, background: C.card, border: "1px solid " + C.line, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
           <Stat n={data.rooms.length} l="pièces" />
           <Stat n={totalItems} l="éléments" />
           <Stat n={notedItems} l="notés" color={C.good} />
         </div>
   
         {/* pièces */}
         {data.rooms.length === 0 && (
           <div style={emptyBox}>
             <div style={{ fontWeight: 700, color: C.ink }}>Aucune pièce</div>
             <div style={{ fontSize: 13, color: C.mut, marginTop: 4, marginBottom: 14 }}>Ajoutez les pièces une par une, ou générez un modèle standard complet.</div>
             <button onClick={onApplyTemplate} disabled={applying} style={{ ...primaryBtn, opacity: applying ? 0.6 : 1 }}>
               {applying ? "Génération…" : "✨ Utiliser le modèle standard"}
             </button>
           </div>
         )}
   
         {data.rooms.map((room) => (
           <div key={room.id} style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
             <div style={{ display: "flex", alignItems: "center", padding: "11px 14px", borderBottom: room.items.length ? "1px solid " + C.line : "none" }}>
               <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: C.ink }}>{room.name}</div>
               <span style={{ fontSize: 12, color: C.mut, marginRight: 8 }}>{room.items.length} élément{room.items.length > 1 ? "s" : ""}</span>
               <button onClick={() => onRemoveRoom(room.id)} style={{ border: "none", background: "transparent", color: C.bad, cursor: "pointer", padding: 4 }} title="Supprimer la pièce"><Trash2 size={15} /></button>
             </div>
   
             {room.items.map((it) => (
               <button key={it.id} onClick={() => setEditItem(it)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + C.line, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                 <span style={{ flex: 1 }}>
                   <span style={{ display: "block", fontSize: 14, color: C.ink }}>{it.label}</span>
                   {it.comment && <span style={{ display: "block", fontSize: 12, color: C.mut, marginTop: 1 }}>{it.comment}</span>}
                   {it.item_kind === "compteur" && it.meter_value != null && <span style={{ display: "block", fontSize: 12, color: C.mut, marginTop: 1 }}>{it.meter_value} {it.meter_unit || ""}</span>}
                   {it.item_kind === "cle" && it.count_value != null && <span style={{ display: "block", fontSize: 12, color: C.mut, marginTop: 1 }}>{it.count_value} clé{it.count_value > 1 ? "s" : ""}</span>}
                 </span>
                 {it.item_kind === "etat" && <ConditionBadge condition={it.condition} />}
                 {(it.photo_urls && it.photo_urls.length > 0) && <span style={{ fontSize: 12, color: C.mut }}>{it.photo_urls.length} 📷</span>}
               </button>
             ))}
   
             <button onClick={() => setAddItemFor(room)} style={{ width: "100%", padding: "10px 14px", background: "transparent", border: "none", color: C.teal, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
               <Plus size={14} style={{ verticalAlign: "-2px" }} /> Ajouter un élément
             </button>
           </div>
         ))}
   
         <button onClick={() => setAddingRoom(true)} style={{ ...primaryBtn, marginTop: 4, marginBottom: 10 }}>
           <Plus size={16} style={{ verticalAlign: "-3px" }} /> Ajouter une pièce
         </button>
   
         {/* documents joints (PDF et autres) */}
         <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
           <div style={{ fontWeight: 700, fontSize: 14.5, color: C.ink, marginBottom: 10 }}>Documents joints</div>
           {(data.attachments && data.attachments.length > 0) ? (
             data.attachments.map((entry, i) => {
               const name = entry.split("|")[1] || "Document";
               return (
                 <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid " + C.line }}>
                   <button onClick={() => onOpenAttachment(entry)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.teal, fontSize: 13.5, fontWeight: 600 }}>
                     <FileText size={16} /> {name}
                   </button>
                   <button onClick={() => onRemoveAttachment(entry)} style={{ border: "none", background: "transparent", color: C.bad, cursor: "pointer", padding: 4 }} title="Retirer"><Trash2 size={14} /></button>
                 </div>
               );
             })
           ) : (
             <div style={{ fontSize: 12.5, color: C.mut, marginBottom: 10 }}>Aucun document. Joignez un PDF (ancien état des lieux, contrat…).</div>
           )}
           <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, color: C.teal, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
             <Plus size={15} /> {attaching ? "Envoi…" : "Ajouter un document"}
             <input type="file" accept=".pdf,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*" multiple onChange={onAddAttachment} style={{ display: "none" }} />
           </label>
         </div>
   
         {/* export PDF */}
         {data.rooms.length > 0 && (
           <button onClick={() => printInspection(data)} style={{ width: "100%", background: C.card, color: C.ink, border: "1px solid " + C.line, borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
             <Download size={16} /> Télécharger le PDF
           </button>
         )}
   
         {/* statut : finaliser */}
         {data.status !== "finalise" && data.status !== "signe" && data.rooms.length > 0 && (
           <button onClick={() => setStatus("finalise")} style={{ width: "100%", background: C.good, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", marginBottom: 30 }}>
             Finaliser l'état des lieux
           </button>
         )}
         {(data.status === "finalise" || data.status === "signe") && (
           <button onClick={() => setStatus("en_cours")} style={{ width: "100%", background: "transparent", color: C.mut, border: "1px solid " + C.line, borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", marginBottom: 30 }}>
             Rouvrir pour modifier
           </button>
         )}
   
         {addingRoom && <AddRoomSheet onAdd={onAddRoom} close={() => setAddingRoom(false)} />}
         {addItemFor && <AddItemSheet room={addItemFor} onAdd={onAddItem} close={() => setAddItemFor(null)} />}
         {editItem && <ItemEditor item={editItem} onSave={onSaveItem} onRemove={onRemoveItem} close={() => setEditItem(null)} />}
       </div>
     );
   }
   
   /* Un élément est "noté" s'il a un état renseigné, un relevé, ou un nombre */
   function isNoted(it) {
     if (it.item_kind === "compteur") return it.meter_value != null;
     if (it.item_kind === "cle") return it.count_value != null;
     return it.condition && it.condition !== "non_verifie";
   }
   
   /* Génère et imprime le PDF d'un état des lieux à partir de ses données réelles. */
   function printInspection(data) {
     const w = window.open("", "_blank");
     if (!w) return;
     const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
     const typeLabel = TYPE_LABEL[data.type] || "Inspection";
     const propName = (data.units && data.units.properties && data.units.properties.name) || "";
     const unitName = (data.units && data.units.label) || "";
     const lieu = [propName, unitName].filter(Boolean).join(" · ");
   
     // rendu d'un élément selon son type
     const itemLine = (it) => {
       let right = "";
       if (it.item_kind === "compteur") right = (it.meter_value != null ? esc(it.meter_value) + " " + esc(it.meter_unit || "") : "—");
       else if (it.item_kind === "cle") right = (it.count_value != null ? esc(it.count_value) + " clé(s)" : "—");
       else right = esc(COND_LABEL[it.condition] || "Non vérifié");
       const comment = it.comment ? "<div class='cmt'>" + esc(it.comment) + "</div>" : "";
       const photos = (it.photo_urls && it.photo_urls.length) ? "<span class='ph'>" + it.photo_urls.length + " photo(s)</span>" : "";
       return "<div class='item'><div class='iline'><span class='ilabel'>" + esc(it.label) + "</span><span class='ival'>" + right + " " + photos + "</span></div>" + comment + "</div>";
     };
   
     const roomsHtml = (data.rooms || []).map((room) =>
       "<h2>" + esc(room.name) + "</h2>" + (room.items.length ? room.items.map(itemLine).join("") : "<div class='empty'>Aucun élément</div>")
     ).join("");
   
     w.document.write("<html><head><title>État des lieux — " + esc(lieu) + "</title><style>"
       + "body{font-family:Georgia,serif;color:#0B3D34;padding:40px;max-width:680px;margin:auto}"
       + "h1{font-size:22px;border-bottom:3px solid #0E5C4F;padding-bottom:10px;margin-bottom:4px}"
       + ".sub{color:#5E6B66;font-size:14px;margin-bottom:6px}"
       + ".meta{color:#5E6B66;font-size:13px;margin-bottom:22px}"
       + "h2{font-size:14px;color:#0E5C4F;text-transform:uppercase;letter-spacing:.05em;margin:22px 0 8px;border-bottom:1px solid #E6E0D2;padding-bottom:5px}"
       + ".item{padding:7px 0;border-bottom:1px solid #f0ede4}"
       + ".iline{display:flex;justify-content:space-between;gap:12px}"
       + ".ilabel{color:#0B3D34}.ival{font-weight:700;text-align:right;white-space:nowrap}"
       + ".cmt{color:#5E6B66;font-size:12.5px;font-style:italic;margin-top:2px}"
       + ".ph{color:#999;font-weight:400;font-size:11px}"
       + ".empty{color:#999;font-size:12.5px;font-style:italic;padding:4px 0}"
       + ".notes{margin-top:22px;padding:12px;background:#F7F4EC;border-radius:8px;font-size:13px}"
       + ".foot{margin-top:32px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px}"
       + "</style></head><body>"
       + "<h1>ÉTAT DES LIEUX — WALLU</h1>"
       + "<div class='sub'>" + esc(data.title || typeLabel) + "</div>"
       + "<div class='meta'>" + esc(typeLabel) + (lieu ? " · " + esc(lieu) : "") + " · " + fmtDate(data.performed_at || data.created_at)
       + " · Statut : " + esc(STATUS_LABEL[data.status] || data.status) + "</div>"
       + roomsHtml
       + (data.general_notes ? "<div class='notes'><b>Observations générales</b><br>" + esc(data.general_notes) + "</div>" : "")
       + "<p class='foot'>Document généré par WALLU à partir des seules données enregistrées. "
       + "Les photos sont conservées dans l'application et consultables en ligne.</p>"
       + "</body></html>");
     w.document.close();
     w.focus();
     w.print();
   }
   
   function Stat({ n, l, color }) {
     return (
       <div><span style={{ fontSize: 19, fontWeight: 800, color: color || C.ink }}>{n}</span><span style={{ fontSize: 12, color: C.mut }}> {l}</span></div>
     );
   }
   
   const COND_LABEL = { neuf: "Neuf", bon: "Bon", moyen: "Moyen", mauvais: "Mauvais", absent: "Absent", non_verifie: "Non vérifié" };
   const COND_STYLE = {
     neuf: { bg: "#E1F5EE", fg: "#04342C" }, bon: { bg: "#E1F5EE", fg: "#0F6E56" },
     moyen: { bg: "#FAEEDA", fg: "#854F0B" }, mauvais: { bg: "#FCEBEB", fg: "#A32D2D" },
     absent: { bg: "#F1EFE8", fg: "#5F5E5A" }, non_verifie: { bg: "#F1EFE8", fg: "#888780" },
   };
   function ConditionBadge({ condition }) {
     const s = COND_STYLE[condition] || COND_STYLE.non_verifie;
     return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: s.bg, color: s.fg }}>{COND_LABEL[condition] || condition}</span>;
   }
   
   /* Feuille : ajouter une pièce */
   function AddRoomSheet({ onAdd, close }) {
     const [name, setName] = useState("");
     const [busy, setBusy] = useState(false);
     const SUGGEST = ["Salon", "Cuisine", "Chambre", "Salle de bain", "WC", "Entrée", "Couloir", "Extérieur"];
     const submit = async () => { if (!name.trim()) return; setBusy(true); await onAdd(name.trim()); setBusy(false); };
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 14 }}>Ajouter une pièce</div>
           <div style={fieldLabel}>Nom de la pièce</div>
           <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Salon" style={input} />
           <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
             {SUGGEST.map((s) => (
               <button key={s} onClick={() => setName(s)} style={{ border: "1px solid " + C.line, background: C.card, borderRadius: 20, padding: "5px 11px", fontSize: 12.5, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
             ))}
           </div>
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter"}</button>
         </div>
       </div>
     );
   }
   
   /* Feuille : ajouter un élément à une pièce */
   function AddItemSheet({ room, onAdd, close }) {
     const [label, setLabelV] = useState("");
     const [kind, setKind] = useState("etat");
     const [busy, setBusy] = useState(false);
     const SUGGEST = ["Murs", "Sol", "Plafond", "Fenêtres", "Porte", "Prises électriques", "Interrupteurs", "Éclairage"];
     const submit = async () => { if (!label.trim()) return; setBusy(true); await onAdd(room, { label: label.trim(), itemKind: kind }); setBusy(false); };
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Ajouter un élément</div>
           <div style={{ fontSize: 13, color: C.mut, marginBottom: 14 }}>Pièce : {room.name}</div>
   
           <div style={fieldLabel}>Type</div>
           <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
             {[["etat", "État"], ["compteur", "Compteur"], ["cle", "Clés"]].map(([k, l]) => {
               const on = kind === k;
               return <button key={k} onClick={() => setKind(k)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "2px solid " + (on ? C.teal : C.line), background: on ? C.tealSoft : C.card, color: on ? C.teal : C.mut, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;
             })}
           </div>
   
           <div style={fieldLabel}>Nom de l'élément</div>
           <input value={label} onChange={(e) => setLabelV(e.target.value)} placeholder={kind === "compteur" ? "Ex : Compteur électricité" : kind === "cle" ? "Ex : Clés remises" : "Ex : Murs"} style={input} />
           {kind === "etat" && (
             <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
               {SUGGEST.map((s) => (
                 <button key={s} onClick={() => setLabelV(s)} style={{ border: "1px solid " + C.line, background: C.card, borderRadius: 20, padding: "5px 11px", fontSize: 12.5, color: C.ink, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
               ))}
             </div>
           )}
   
           <button onClick={submit} disabled={busy} style={{ ...primaryBtn, marginTop: 18, opacity: busy ? 0.6 : 1 }}>{busy ? "Ajout…" : "Ajouter"}</button>
         </div>
       </div>
     );
   }
   
   /* Éditeur d'un élément : état/commentaire/photos, ou compteur, ou clés */
   function ItemEditor({ item, onSave, onRemove, close }) {
     const [condition, setCondition] = useState(item.condition || "non_verifie");
     const [comment, setComment] = useState(item.comment || "");
     const [photos, setPhotos] = useState(item.photo_urls || []);
     const [meterValue, setMeterValue] = useState(item.meter_value != null ? String(item.meter_value) : "");
     const [meterUnit, setMeterUnit] = useState(item.meter_unit || (item.label.toLowerCase().includes("eau") ? "m³" : "kWh"));
     const [countValue, setCountValue] = useState(item.count_value != null ? String(item.count_value) : "");
     const [busy, setBusy] = useState(false);
     const [uploading, setUploading] = useState(false);
   
     const onPickPhoto = async (e) => {
       const files = Array.from(e.target.files || []);
       if (!files.length) return;
       setUploading(true);
       try {
         const paths = [];
         for (const f of files) { paths.push(await api.uploadPhoto(f)); }
         setPhotos((prev) => [...prev, ...paths]);
       } catch (err) { /* silencieux : on garde ce qui a marché */ }
       setUploading(false);
     };
     const removePhoto = (i) => setPhotos((prev) => prev.filter((_, k) => k !== i));
   
     const save = async () => {
       setBusy(true);
       const patch = { comment, photoUrls: photos };
       if (item.item_kind === "etat") patch.condition = condition;
       if (item.item_kind === "compteur") { patch.meterValue = meterValue === "" ? null : Number(meterValue); patch.meterUnit = meterUnit; }
       if (item.item_kind === "cle") patch.countValue = countValue === "" ? null : parseInt(countValue, 10);
       await onSave(item.id, patch);
       setBusy(false);
     };
   
     return (
       <div onClick={close} style={overlay}>
         <div onClick={(e) => e.stopPropagation()} style={sheet}>
           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: C.ink }}>{item.label}</div>
             <button onClick={() => onRemove(item.id)} style={{ border: "none", background: "transparent", color: C.bad, cursor: "pointer" }} title="Supprimer l'élément"><Trash2 size={17} /></button>
           </div>
   
           {item.item_kind === "etat" && (
             <>
               <div style={fieldLabel}>État constaté</div>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                 {["neuf", "bon", "moyen", "mauvais", "absent", "non_verifie"].map((k) => {
                   const on = condition === k;
                   const s = COND_STYLE[k];
                   return <button key={k} onClick={() => setCondition(k)} style={{ padding: "10px", borderRadius: 8, border: "2px solid " + (on ? s.fg : C.line), background: on ? s.bg : C.card, color: on ? s.fg : C.mut, fontWeight: on ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{COND_LABEL[k]}</button>;
                 })}
               </div>
             </>
           )}
   
           {item.item_kind === "compteur" && (
             <>
               <div style={fieldLabel}>Relevé</div>
               <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                 <input value={meterValue} onChange={(e) => setMeterValue(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Ex : 4521" style={{ ...input, flex: 1 }} />
                 <input value={meterUnit} onChange={(e) => setMeterUnit(e.target.value)} placeholder="kWh" style={{ ...input, width: 90 }} />
               </div>
             </>
           )}
   
           {item.item_kind === "cle" && (
             <>
               <div style={fieldLabel}>Nombre de clés remises</div>
               <input value={countValue} onChange={(e) => setCountValue(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Ex : 3" style={{ ...input, marginBottom: 18 }} />
             </>
           )}
   
           <div style={fieldLabel}>Commentaire</div>
           <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Observations…" style={{ ...input, resize: "vertical", marginBottom: 18 }} />
   
           <div style={fieldLabel}>Photos ({photos.length})</div>
           <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
             {photos.map((p, i) => (
               <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, background: "#D3D1C7", display: "grid", placeItems: "center", color: "#5F5E5A", fontSize: 11 }}>
                 📷
                 <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: C.bad, color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0 }}>×</button>
               </div>
             ))}
             <label style={{ width: 72, height: 72, borderRadius: 8, border: "1px dashed " + C.line, display: "grid", placeItems: "center", cursor: "pointer", color: C.mut, fontSize: 11, textAlign: "center" }}>
               {uploading ? "…" : "+ Photo"}
               <input type="file" accept="image/*" multiple onChange={onPickPhoto} style={{ display: "none" }} />
             </label>
           </div>
   
           <button onClick={save} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
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
   const fieldLabel = { fontSize: 12.5, color: C.mut, fontWeight: 700, marginBottom: 7 };
   const input = { width: "100%", border: "1px solid " + C.line, borderRadius: 11, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", background: C.card, color: C.ink, boxSizing: "border-box" };
   const primaryBtn = { width: "100%", background: C.teal, color: "#fff", border: "none", borderRadius: 12, padding: 15, fontWeight: 700, fontSize: 16, cursor: "pointer", fontFamily: "inherit" };
   