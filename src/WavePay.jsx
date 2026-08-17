/* WALLU — Paiement Wave (Voie 2 : lien/QR pré-rempli, sans API)
   Génère un QR code + un lien Wave vers le numéro du bénéficiaire,
   avec le montant affiché clairement. Le locataire paie dans son app Wave. */

   import React, { useState, useEffect, useRef } from "react";
   import { ChevronLeft, Copy, Check, Smartphone, Share2 } from "lucide-react";
   
   const C = {
     ink: "#0B3D34", paper: "#F7F4EC", card: "#FFFFFF",
     teal: "#0E5C4F", tealSoft: "#E2EEEA", sun: "#E7A335",
     good: "#1E9E77", bad: "#D2493B", line: "#E6E0D2", mut: "#5E6B66",
     wave: "#1DC8F2", // bleu Wave
   };
   
   // Charge la librairie QRCode depuis le CDN une seule fois.
   let qrPromise = null;
   function loadQR() {
     if (window.QRCode) return Promise.resolve(window.QRCode);
     if (qrPromise) return qrPromise;
     qrPromise = new Promise((resolve, reject) => {
       const s = document.createElement("script");
       s.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
       s.onload = () => resolve(window.QRCode);
       s.onerror = () => reject(new Error("Chargement du QR code impossible."));
       document.head.appendChild(s);
     });
     return qrPromise;
   }
   
   // Normalise un numéro sénégalais en format international sans espaces.
   function normalizePhone(raw) {
     let p = (raw || "").replace(/[^\d+]/g, "");
     if (p.startsWith("+")) return p;
     if (p.startsWith("221")) return "+" + p;
     if (p.startsWith("0")) p = p.slice(1);
     return "+221" + p;
   }
   
   // Construit le lien de paiement Wave vers un numéro, avec montant.
   function buildWaveLink(phone, amount) {
     const n = normalizePhone(phone).replace("+", "");
     // Lien Wave "pay" vers un numéro. Le montant est passé en paramètre ; s'il
     // n'est pas pris en compte par Wave, il reste affiché en clair dans l'app.
     return "https://pay.wave.com/m/" + n + "/c/xof?amount=" + Math.round(amount || 0);
   }
   
   const fcfa = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " FCFA";
   
   export function WavePayScreen({ phone, amount, label, back }) {
     const [copied, setCopied] = useState(false);
     const [qrError, setQrError] = useState(false);
     const qrRef = useRef(null);
     const link = buildWaveLink(phone, amount);
     const cleanPhone = normalizePhone(phone);
   
     useEffect(() => {
       let cancelled = false;
       (async () => {
         try {
           const QRCode = await loadQR();
           if (cancelled || !qrRef.current) return;
           qrRef.current.innerHTML = "";
           new QRCode(qrRef.current, {
             text: link, width: 200, height: 200,
             colorDark: "#0B3D34", colorLight: "#ffffff",
           });
         } catch (e) { setQrError(true); }
       })();
       return () => { cancelled = true; };
     }, [link]);
   
     const copy = async () => {
       try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
       catch (e) { /* ignore */ }
     };
   
     const openWave = () => { window.open(link, "_blank"); };
   
     const share = async () => {
       const msg = "Paiement WALLU" + (label ? " — " + label : "") + "\nMontant : " + fcfa(amount) + "\nWave : " + cleanPhone + "\n" + link;
       if (navigator.share) {
         try { await navigator.share({ title: "Paiement Wave", text: msg }); } catch (e) { /* annulé */ }
       } else {
         try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
       }
     };
   
     return (
       <div style={{ paddingTop: 16 }}>
         <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
           {back && <button onClick={back} style={iconBtn}><ChevronLeft size={20} /></button>}
           <div style={{ flex: 1 }}>
             <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: C.ink }}>Payer avec Wave</div>
             {label && <div style={{ fontSize: 13, color: C.mut }}>{label}</div>}
           </div>
         </div>
   
         {/* montant en évidence */}
         <div style={{ background: C.ink, borderRadius: 16, padding: "18px 20px", textAlign: "center", marginBottom: 16 }}>
           <div style={{ color: "#9FE1CB", fontSize: 12, letterSpacing: 1, fontWeight: 600 }}>MONTANT À PAYER</div>
           <div style={{ color: "#fff", fontSize: 30, fontWeight: 800, marginTop: 4 }}>{fcfa(amount)}</div>
         </div>
   
         {/* QR code */}
         <div style={{ ...cardBox, textAlign: "center" }}>
           <div style={{ fontSize: 13, color: C.mut, marginBottom: 12 }}>Scannez ce code avec l'application Wave</div>
           <div style={{ display: "flex", justifyContent: "center" }}>
             {qrError
               ? <div style={{ color: C.bad, fontSize: 13, padding: 20 }}>QR indisponible. Utilisez le lien ci-dessous.</div>
               : <div ref={qrRef} style={{ padding: 10, background: "#fff", borderRadius: 12, display: "inline-block" }} />}
           </div>
           <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid " + C.line }}>
             <div style={{ fontSize: 12, color: C.mut }}>Bénéficiaire Wave</div>
             <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: 0.5 }}>{cleanPhone}</div>
           </div>
         </div>
   
         {/* actions */}
         <button onClick={openWave} style={{ ...primaryBtn, background: C.wave, color: C.ink, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
           <Smartphone size={17} /> Ouvrir dans Wave
         </button>
   
         <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
           <button onClick={copy} style={{ ...ghostBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
             {copied ? <><Check size={15} /> Copié</> : <><Copy size={15} /> Copier le lien</>}
           </button>
           <button onClick={share} style={{ ...ghostBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
             <Share2 size={15} /> Partager
           </button>
         </div>
   
         {/* rappel */}
         <div style={{ background: C.tealSoft, borderRadius: 12, padding: "12px 14px", marginTop: 16, fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>
           <b>Comment ça marche :</b> le locataire scanne le QR ou ouvre le lien, vérifie le montant et paie dans Wave. Une fois l'argent reçu, le propriétaire marque le loyer comme payé dans WALLU.
         </div>
       </div>
     );
   }
   
   /* ---- styles ---- */
   const iconBtn = { width: 38, height: 38, borderRadius: 11, border: "1px solid " + C.line, background: C.card, display: "grid", placeItems: "center", cursor: "pointer", color: C.ink };
   const cardBox = { background: C.card, border: "1px solid " + C.line, borderRadius: 16, padding: 18 };
   const primaryBtn = { width: "100%", border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" };
   const ghostBtn = { background: C.card, color: C.ink, border: "1px solid " + C.line, borderRadius: 12, padding: "12px 14px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" };
   