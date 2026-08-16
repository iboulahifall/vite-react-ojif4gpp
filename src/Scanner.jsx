/* WALLU — Scanner de documents (OCR)
   Extrait le texte d'une photo via Tesseract.js (chargé depuis un CDN).
   Gratuit, tourne dans le navigateur, aucune donnée envoyée à un serveur. */

   import React, { useState, useRef } from "react";
   import { ChevronLeft, Camera, Copy, Check, FileText, RefreshCw } from "lucide-react";
   
   const C = {
     ink: "#0B3D34", paper: "#F7F4EC", card: "#FFFFFF",
     teal: "#0E5C4F", tealSoft: "#E2EEEA", sun: "#E7A335",
     good: "#1E9E77", bad: "#D2493B", line: "#E6E0D2", mut: "#5E6B66",
   };
   
   // Charge Tesseract depuis le CDN une seule fois (mémorisé).
   let tesseractPromise = null;
   function loadTesseract() {
     if (window.Tesseract) return Promise.resolve(window.Tesseract);
     if (tesseractPromise) return tesseractPromise;
     tesseractPromise = new Promise((resolve, reject) => {
       const s = document.createElement("script");
       s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
       s.onload = () => resolve(window.Tesseract);
       s.onerror = () => reject(new Error("Chargement de l'OCR impossible (vérifiez la connexion)."));
       document.head.appendChild(s);
     });
     return tesseractPromise;
   }
   
   export function DocumentScanner({ back }) {
     const [status, setStatus] = useState("idle"); // idle | loading | working | done | error
     const [progress, setProgress] = useState(0);
     const [text, setText] = useState("");
     const [error, setError] = useState(null);
     const [preview, setPreview] = useState(null);
     const [copied, setCopied] = useState(false);
     const [onlyDigits, setOnlyDigits] = useState(false);
     const fileRef = useRef(null);
   
     const onPick = async (e) => {
       const file = (e.target.files || [])[0];
       if (!file) return;
       setError(null); setText(""); setCopied(false);
       setPreview(URL.createObjectURL(file));
       try {
         setStatus("loading");
         const Tesseract = await loadTesseract();
         setStatus("working"); setProgress(0);
         // fra + eng pour couvrir français et documents mixtes
         const { data } = await Tesseract.recognize(file, "fra+eng", {
           logger: (m) => { if (m.status === "recognizing text" && m.progress != null) setProgress(Math.round(m.progress * 100)); },
         });
         setText((data && data.text ? data.text : "").trim());
         setStatus("done");
       } catch (err) {
         setError((err && err.message) || "Extraction impossible.");
         setStatus("error");
       }
     };
   
     const displayed = onlyDigits ? (text.match(/[\d.,\s]+/g) || []).join(" ").replace(/\s+/g, " ").trim() : text;
   
     const copy = async () => {
       try { await navigator.clipboard.writeText(displayed); setCopied(true); setTimeout(() => setCopied(false), 1500); }
       catch (e) { /* ignore */ }
     };
   
     const reset = () => { setStatus("idle"); setText(""); setPreview(null); setError(null); setProgress(0); if (fileRef.current) fileRef.current.value = ""; };
   
     return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Scanner un document</div>
             <div style={{ fontSize: 13, color: C.mut }}>Extraire le texte d'une photo</div>
           </div>
         </div>
   
         {error && <div style={errorBox}>{error}</div>}
   
         {status === "idle" && (
           <div style={{ ...cardBox, textAlign: "center", padding: "36px 20px" }}>
             <Camera size={34} color={C.teal} />
             <div style={{ fontWeight: 700, color: C.ink, marginTop: 10 }}>Photographiez un document</div>
             <div style={{ fontSize: 13, color: C.mut, marginTop: 4, marginBottom: 18 }}>Facture, quittance, relevé de compteur, contrat… Le texte imprimé net donne les meilleurs résultats.</div>
             <label style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
               <Camera size={17} /> Prendre / choisir une photo
               <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: "none" }} />
             </label>
           </div>
         )}
   
         {(status === "loading" || status === "working") && (
           <div style={{ ...cardBox, textAlign: "center", padding: "36px 20px" }}>
             {preview && <img src={preview} alt="" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 10, marginBottom: 16 }} />}
             <div style={{ fontWeight: 700, color: C.ink }}>{status === "loading" ? "Préparation de l'OCR…" : "Lecture du texte…"}</div>
             {status === "working" && (
               <>
                 <div style={{ height: 8, background: C.line, borderRadius: 20, overflow: "hidden", margin: "14px 0 6px" }}>
                   <div style={{ height: "100%", width: progress + "%", background: C.teal, transition: "width .2s" }} />
                 </div>
                 <div style={{ fontSize: 12, color: C.mut }}>{progress}%</div>
               </>
             )}
             {status === "loading" && <div style={{ fontSize: 12.5, color: C.mut, marginTop: 8 }}>Premier scan : téléchargement de l'outil (quelques secondes).</div>}
           </div>
         )}
   
         {status === "done" && (
           <>
             {preview && <img src={preview} alt="" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 10, marginBottom: 12, display: "block" }} />}
   
             <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
               <div style={{ fontWeight: 700, color: C.ink, flex: 1 }}>Texte extrait</div>
               <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.mut, cursor: "pointer" }}>
                 <input type="checkbox" checked={onlyDigits} onChange={(e) => setOnlyDigits(e.target.checked)} /> Chiffres seuls
               </label>
             </div>
   
             {displayed ? (
               <textarea readOnly value={displayed} rows={8} style={{ ...input, resize: "vertical", fontFamily: "monospace", fontSize: 13 }} />
             ) : (
               <div style={{ ...cardBox, color: C.mut, fontSize: 13 }}>Aucun texte détecté. Réessayez avec une photo plus nette et bien cadrée.</div>
             )}
   
             <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
               <button onClick={copy} disabled={!displayed} style={{ ...primaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: displayed ? 1 : 0.5 }}>
                 {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier</>}
               </button>
               <button onClick={reset} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={15} /> Nouveau</button>
             </div>
           </>
         )}
   
         {status === "error" && (
           <button onClick={reset} style={{ ...primaryBtn, marginTop: 12 }}>Réessayer</button>
         )}
       </div>
     );
   }
   
   /* ---- styles ---- */
   const iconBtn = { width: 38, height: 38, borderRadius: 11, border: "1px solid " + C.line, background: C.card, display: "grid", placeItems: "center", cursor: "pointer", color: C.ink };
   const cardBox = { background: C.card, border: "1px solid " + C.line, borderRadius: 16, padding: 16 };
   const errorBox = { background: "#D2493B18", color: "#D2493B", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 12 };
   const input = { width: "100%", border: "1px solid " + C.line, borderRadius: 11, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", background: C.card, color: C.ink, boxSizing: "border-box" };
   const primaryBtn = { background: C.teal, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" };
   const ghostBtn = { background: C.card, color: C.ink, border: "1px solid " + C.line, borderRadius: 12, padding: "12px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
   