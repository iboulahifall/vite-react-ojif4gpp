/* KËR — Couche de données Supabase
   ------------------------------------------------------------------
   Remplace l'état local de démo par de vraies requêtes.
   L'isolation par rôle est garantie par les policies RLS (fichier
   001_schema.sql) : ces fonctions ne re-filtrent pas la sécurité,
   elles s'appuient dessus. Une requête ne renverra JAMAIS les données
   d'un autre utilisateur, même si le front se trompe.

   Installation :  npm i @supabase/supabase-js
   Variables .env : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
*/
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);

/* Compression d'image côté navigateur (avant upload).
   Réduit la taille (max 1600px) et la qualité, pour économiser le stockage
   et accélérer l'envoi. Les PDF et non-images passent tels quels. */
export async function compressImage(file, { maxSize = 1600, quality = 0.72 } = {}) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  // les GIF (animés) ne se compressent pas bien : on laisse passer
  if (file.type === "image/gif") return file;
  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    let { width, height } = img;
    if (width > maxSize || height > maxSize) {
      if (width >= height) { height = Math.round(height * maxSize / width); width = maxSize; }
      else { width = Math.round(width * maxSize / height); height = maxSize; }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    // si la compression n'aide pas, on garde l'original
    if (blob.size >= file.size) return file;
    const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch (e) {
    return file; // en cas d'échec, on envoie l'original
  }
}

/* Petit utilitaire : lève une erreur lisible, jamais un objet brut. */
function ok({ data, error }) {
  if (error) throw new Error(error.message || "Une erreur est survenue.");
  return data;
}

/* ---------------- AUTH ---------------- */
export const auth = {
  async updateProfile({ fullName, phone, country }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");
    const patch = {};
    if (fullName !== undefined) patch.full_name = fullName;
    if (phone !== undefined) patch.phone = phone;
    if (country !== undefined) patch.country = country;
    return ok(await supabase.from("profiles").update(patch).eq("id", user.id).select().single());
  },
  async signUp({ email, password, fullName, role = "proprietaire" }) {
    return ok(await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role } },
    }));
  },
  async signIn({ email, password }) {
    return ok(await supabase.auth.signInWithPassword({ email, password }));
  },
  /* Connexion par code email (OTP à 6 chiffres, gratuit, sans mot de passe).
     Étape 1 : envoyer le code. shouldCreateUser=false pour ne pas créer de
     compte fantôme si l'email est inconnu — on veut juste connecter un compte
     existant. Si tu veux autoriser l'inscription par code, passe-le à true. */
  async sendEmailOtp({ email, allowSignup = false }) {
    return ok(await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: allowSignup },
    }));
  },
  /* Étape 2 : vérifier le code saisi et ouvrir la session. */
  async verifyEmailOtp({ email, token }) {
    return ok(await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    }));
  },
  async signOut() { return ok(await supabase.auth.signOut()); },
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const profile = ok(await supabase.from("profiles").select("*").eq("id", user.id).single());
    return { ...user, profile };
  },
  onChange(cb) { return supabase.auth.onAuthStateChange((_e, s) => cb(s)); },
};

/* ---------------- PROPRIÉTAIRE ---------------- */
export const owner = {
  // Patrimoine complet en une lecture (RLS filtre sur owner_id = auth.uid()).
  async properties() {
    return ok(await supabase
      .from("properties")
      .select("*, units(*, leases(*, rent_payments(*)))")
      .order("created_at", { ascending: true }));
  },
  async addProperty(p) {
    const { data: { user } } = await supabase.auth.getUser();
    return ok(await supabase.from("properties").insert({ ...p, owner_id: user.id }).select().single());
  },
  async addUnit(propertyId, u) {
    return ok(await supabase.from("units").insert({ ...u, property_id: propertyId }).select().single());
  },
  // S'assurer qu'un bail actif existe pour cette unité (en crée un si besoin).
  async ensureLease(unitId, rentAmount) {
    const existing = await supabase.from("leases").select("id").eq("unit_id", unitId).eq("active", true).maybeSingle();
    if (existing.data && existing.data.id) return existing.data.id;
    const created = ok(await supabase.from("leases").insert({
      unit_id: unitId, rent_amount: rentAmount || 0, active: true,
    }).select().single());
    return created.id;
  },
  // Enregistrer un paiement pour une unité (crée le bail à la volée si nécessaire).
  async recordPaymentForUnit(unitId, rentAmount) {
    const leaseId = await this.ensureLease(unitId, rentAmount);
    const now = new Date();
    const period = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    return ok(await supabase.from("rent_payments").insert({
      lease_id: leaseId, period, amount: rentAmount || 0, status: "paye", method: "autre",
      paid_at: now.toISOString().slice(0, 10),
    }).select().single());
  },
  async problems() {
    return ok(await supabase.from("maintenance_requests").select("*, units(label, property_id)").order("created_at", { ascending: false }));
  },
  async setProblemStatus(id, status) {
    return ok(await supabase.from("maintenance_requests").update({ status }).eq("id", id).select().single());
  },
  async updateRepair(id, patch) {
    const clean = {};
    if (patch.repairStatus !== undefined) clean.repair_status = patch.repairStatus;
    if (patch.artisan !== undefined) clean.artisan = patch.artisan;
    if (patch.amountEst !== undefined) clean.amount_est = patch.amountEst;
    if (patch.amountReal !== undefined) clean.amount_real = patch.amountReal;
    if (patch.note !== undefined) clean.repair_note = patch.note;
    if (patch.repairStatus === "resolu") clean.status = "resolu";
    else if (patch.repairStatus && patch.repairStatus !== "nouveau") clean.status = "en_cours";
    return ok(await supabase.from("maintenance_requests").update(clean).eq("id", id).select().single());
  },
  async expenses() {
    return ok(await supabase.from("expenses").select("*").order("created_at", { ascending: false }));
  },
  async setExpenseStatus(id, status) {
    return ok(await supabase.from("expenses").update({ status }).eq("id", id).select().single());
  },
  async deleteExpense(id, receiptUrl) {
    if (receiptUrl) { try { await supabase.storage.from("documents").remove([receiptUrl]); } catch (e) {} }
    ok(await supabase.from("expenses").delete().eq("id", id));
    return true;
  },
  async documents() {
    return ok(await supabase.from("documents").select("*").order("created_at", { ascending: false }));
  },
  // Invitation : le "code" est le lease.id encodé ; ici on renvoie le bail cible.
  async createInvite(leaseId) {
    return ok(await supabase.from("leases").select("id, unit_id, units(label)").eq("id", leaseId).single());
  },
};

/* ---------------- GESTIONNAIRE ---------------- */
export const manager = {
  // RLS ne renvoie que les biens présents dans property_managers pour ce gestionnaire.
  async properties() {
    return ok(await supabase.from("properties").select("*, units(*)").order("created_at", { ascending: true }));
  },
  // Valider un code d'affectation (renvoie le logement).
  async findPropertyByCode(code) {
    const { data, error } = await supabase.rpc("find_property_by_manager_code", { p_code: code });
    if (error) throw new Error(error.message);
    return (data && data[0]) || null;
  },
  // Rejoindre un logement comme gestionnaire.
  async joinAsManager(code, fullName) {
    const { data, error } = await supabase.rpc("join_as_manager", { p_code: code, p_full_name: fullName || null });
    if (error) throw new Error(error.message);
    return data;
  },
  // Le statut (auto_validee / attente_validation) est décidé par un trigger SQL
  // selon settings.approval_threshold — le front n'a pas à en décider (§11).
  async addExpense(propertyId, e) {
    const { data: { user } } = await supabase.auth.getUser();
    const row = {
      property_id: propertyId, created_by: user.id,
      description: e.description, category: e.category, amount: e.amount,
      status: e.status,
    };
    if (e.supplier !== undefined) row.supplier = e.supplier;
    if (e.spentAt !== undefined) row.spent_at = e.spentAt;
    if (e.receiptUrl !== undefined) row.receipt_url = e.receiptUrl;
    return ok(await supabase.from("expenses").insert(row).select().single());
  },
  // Uploader un justificatif de dépense, renvoie son chemin
  async uploadExpenseReceipt(rawFile) {
    const file = await compressImage(rawFile);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");
    const safe = (file.name || "justificatif").replace(/[^\w.\-]/g, "_");
    const path = user.id + "/depenses/" + Date.now() + "-" + safe;
    const { data, error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return data.path;
  },
  async setProblemStatus(id, status) {
    return ok(await supabase.from("maintenance_requests").update({ status }).eq("id", id).select().single());
  },
};

/* ---------------- LOCATAIRE ---------------- */
export const tenant = {
  // RLS ne renvoie que le bail dont tenant_id = auth.uid().
  async myLease() {
    return ok(await supabase
      .from("leases")
      .select("*, units(*, properties(name, city)), rent_payments(*)")
      .eq("active", true)
      .maybeSingle());
  },
  // Enregistrer un paiement = insérer une ligne (jamais un vrai débit — §7).
  async recordPayment(leaseId, { period, amount, method = "autre", note }) {
    return ok(await supabase.from("rent_payments").insert({
      lease_id: leaseId, period, amount, method, status: "paye",
      paid_at: new Date().toISOString().slice(0, 10), note,
    }).select().single());
  },
  async reportProblem(unitId, { category, description, photoUrls }) {
    const { data: { user } } = await supabase.auth.getUser();
    const paths = photoUrls || [];
    return ok(await supabase.from("maintenance_requests").insert({
      unit_id: unitId, reported_by: user.id, category, description,
      photo_url: paths[0] || null, photo_urls: paths, status: "nouveau",
    }).select().single());
  },
  // Uploade une photo de problème dans le bucket "documents", renvoie le chemin.
  async uploadProblemPhoto(rawFile) {
    const file = await compressImage(rawFile);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");
    const safe = (file.name || "photo.jpg").replace(/[^\w.\-]/g, "_");
    const path = user.id + "/problemes/" + Date.now() + "-" + safe;
    const { data, error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return data.path;
  },
  // Lien signé pour afficher une photo de problème
  async photoUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  },
  // Contact du propriétaire du logement du locataire connecté (nom, téléphone).
  async ownerContact() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // via son bail actif -> unité -> logement -> propriétaire
    const lease = ok(await supabase
      .from("leases")
      .select("units(properties(owner_id))")
      .eq("tenant_id", user.id).eq("active", true).maybeSingle());
    const ownerId = lease && lease.units && lease.units.properties && lease.units.properties.owner_id;
    if (!ownerId) return null;
    const prof = ok(await supabase.from("profiles").select("full_name, phone").eq("id", ownerId).single());
    return { name: prof.full_name, phone: prof.phone || null };
  },
  async myDocuments() {
    return ok(await supabase.from("documents").select("*").order("created_at", { ascending: false }));
  },
  // Valider un code d'invitation (renvoie l'unité correspondante, ou null).
  async findUnitByCode(code) {
    const { data, error } = await supabase.rpc("find_unit_by_code", { p_code: code });
    if (error) throw new Error(error.message);
    return (data && data[0]) || null;
  },
  // Rejoindre une unité via un code : crée le bail et renvoie son id.
  async joinWithCode(code, fullName) {
    const { data, error } = await supabase.rpc("join_unit_with_code", { p_code: code, p_full_name: fullName || null });
    if (error) throw new Error(error.message);
    return data; // lease id
  },
};

/* ---------------- OWNER : code d'invitation d'une unité ---------------- */
owner.unitInviteCode = async function (unitId) {
  const { data, error } = await supabase.from("units").select("invite_code").eq("id", unitId).single();
  if (error) throw new Error(error.message);
  return data.invite_code;
};

/* ---------------- NOTIFICATIONS ---------------- */
export const notifications = {
  async list() {
    return ok(await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50));
  },
  async markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    return ok(await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false));
  },
};

/* ---------------- QUITTANCES (preuves de paiement) ---------------- */
export const receipts = {
  // Toutes les quittances qui me concernent (RLS filtre : mes quittances locataire OU proprio)
  async mine() {
    return ok(await supabase.from("receipts").select("*").order("created_at", { ascending: false }));
  },
};

/* ---------------- CONTRÔLE LOGEMENT (états des lieux / inspections) ---------------- */
export const inspections = {
  // Liste des inspections d'une unité (logement), plus récentes d'abord.
  async listForUnit(unitId) {
    return ok(await supabase.from("inspections")
      .select("*")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false }));
  },

  // Toutes les inspections accessibles à l'utilisateur (RLS filtre proprio/gestionnaire/locataire).
  async listAll() {
    return ok(await supabase.from("inspections")
      .select("*, units(label, property_id, properties(name))")
      .order("created_at", { ascending: false }));
  },

  // Crée une inspection (en-tête). type = 'entree' | 'sortie' | 'periodique'.
  async create(unitId, { type, title, scheduledAt, leaseId }) {
    const { data: { user } } = await supabase.auth.getUser();
    return ok(await supabase.from("inspections").insert({
      unit_id: unitId,
      lease_id: leaseId || null,
      type,
      title: title || null,
      scheduled_at: scheduledAt || null,
      created_by: user ? user.id : null,
      status: "brouillon",
    }).select().single());
  },

  // Détail complet d'une inspection : en-tête + pièces + éléments.
  async detail(inspectionId) {
    const insp = ok(await supabase.from("inspections")
      .select("*, units(label, property_id, properties(name))")
      .eq("id", inspectionId).single());
    const rooms = ok(await supabase.from("inspection_rooms")
      .select("*")
      .eq("inspection_id", inspectionId)
      .order("position", { ascending: true }));
    const roomIds = rooms.map((r) => r.id);
    let items = [];
    if (roomIds.length) {
      items = ok(await supabase.from("inspection_items")
        .select("*")
        .in("room_id", roomIds)
        .order("position", { ascending: true }));
    }
    // regroupe les éléments dans leur pièce
    const byRoom = {};
    for (const it of items) { (byRoom[it.room_id] = byRoom[it.room_id] || []).push(it); }
    return { ...insp, rooms: rooms.map((r) => ({ ...r, items: byRoom[r.id] || [] })) };
  },

  // Change le statut (brouillon -> en_cours -> finalise -> signe) et notes générales.
  async update(inspectionId, patch) {
    const clean = {};
    if (patch.status !== undefined) clean.status = patch.status;
    if (patch.title !== undefined) clean.title = patch.title;
    if (patch.generalNotes !== undefined) clean.general_notes = patch.generalNotes;
    if (patch.performedAt !== undefined) clean.performed_at = patch.performedAt;
    return ok(await supabase.from("inspections").update(clean).eq("id", inspectionId).select().single());
  },

  async remove(inspectionId) {
    return ok(await supabase.from("inspections").delete().eq("id", inspectionId));
  },

  // ----- PIÈCES -----
  async addRoom(inspectionId, name, position = 0) {
    return ok(await supabase.from("inspection_rooms").insert({
      inspection_id: inspectionId, name, position,
    }).select().single());
  },
  async removeRoom(roomId) {
    return ok(await supabase.from("inspection_rooms").delete().eq("id", roomId));
  },

  // ----- ÉLÉMENTS -----
  // kind = 'etat' | 'compteur' | 'cle'
  async addItem(roomId, { label, itemKind = "etat", position = 0 }) {
    return ok(await supabase.from("inspection_items").insert({
      room_id: roomId, label, item_kind: itemKind, position,
    }).select().single());
  },
  // Met à jour un élément (état, commentaire, photos, relevé compteur, nb clés).
  async updateItem(itemId, patch) {
    const clean = {};
    if (patch.condition !== undefined) clean.condition = patch.condition;
    if (patch.comment !== undefined) clean.comment = patch.comment;
    if (patch.photoUrls !== undefined) clean.photo_urls = patch.photoUrls;
    if (patch.meterValue !== undefined) clean.meter_value = patch.meterValue;
    if (patch.meterUnit !== undefined) clean.meter_unit = patch.meterUnit;
    if (patch.countValue !== undefined) clean.count_value = patch.countValue;
    if (patch.label !== undefined) clean.label = patch.label;
    return ok(await supabase.from("inspection_items").update(clean).eq("id", itemId).select().single());
  },
  async removeItem(itemId) {
    return ok(await supabase.from("inspection_items").delete().eq("id", itemId));
  },

  // Uploade une photo d'inspection dans le bucket "documents", renvoie le chemin.
  async uploadPhoto(rawFile) {
    const file = await compressImage(rawFile);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");
    const safe = (file.name || "photo.jpg").replace(/[^\w.\-]/g, "_");
    const path = user.id + "/inspections/" + Date.now() + "-" + safe;
    const { data, error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return data.path;
  },
  // Lien signé pour afficher une photo d'inspection.
  async photoUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  },

  // ----- DOCUMENTS JOINTS (PDF et autres fichiers) -----
  // Uploade un fichier joint (PDF, image, doc...) dans le bucket "documents".
  async uploadAttachment(rawFile) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");
    // On ne compresse pas les fichiers non-image (ex : PDF) — envoi tel quel.
    let file = rawFile;
    if (rawFile && rawFile.type && rawFile.type.startsWith("image/")) {
      file = await compressImage(rawFile);
    }
    const safe = (file.name || "fichier").replace(/[^\w.\-]/g, "_");
    const path = user.id + "/inspections-docs/" + Date.now() + "-" + safe;
    const { data, error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return { path: data.path, name: file.name || safe };
  },
  // Met à jour la liste des fichiers joints d'une inspection.
  async setAttachments(inspectionId, attachments) {
    return ok(await supabase.from("inspections").update({ attachments }).eq("id", inspectionId).select().single());
  },
  // Lien signé pour ouvrir un fichier joint.
  async attachmentUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  },

  // ----- MODÈLE PRÉ-REMPLI -----
  // Génère d'un coup les pièces + éléments standards d'un logement.
  // Ne fait rien si l'inspection a déjà des pièces (évite les doublons).
  async applyTemplate(inspectionId) {
    // Le modèle : chaque pièce avec ses éléments (kind 'etat' par défaut).
    const TEMPLATE = [
      { name: "Entrée / Couloir", items: ["Porte d'entrée", "Serrure", "Murs", "Sol", "Plafond", "Interrupteurs", "Éclairage"] },
      { name: "Salon", items: ["Murs", "Sol", "Plafond", "Fenêtres", "Volets / rideaux", "Prises électriques", "Interrupteurs", "Éclairage", "Climatiseur / ventilateur"] },
      { name: "Chambre", items: ["Murs", "Sol", "Plafond", "Fenêtres", "Volets", "Placard / penderie", "Prises électriques", "Interrupteurs", "Éclairage", "Climatiseur / ventilateur"] },
      { name: "Cuisine", items: ["Murs", "Sol", "Plafond", "Évier", "Robinetterie", "Plan de travail", "Placards", "Plaques de cuisson", "Prises électriques", "Éclairage", "Évacuation eaux"] },
      { name: "Salle de bain / WC", items: ["Murs", "Sol", "Lavabo", "Robinetterie", "Douche / baignoire", "WC", "Chasse d'eau", "Miroir", "Ventilation", "Éclairage"] },
      { name: "Extérieur / Commun", items: ["Cour", "Portail", "Mur de clôture", "Façade", "Toiture"] },
    ];
    // Éléments spéciaux (compteurs + clés) regroupés dans une pièce "Général".
    const GENERAL = {
      name: "Compteurs & clés",
      special: [
        { label: "Compteur électricité", kind: "compteur", unit: "kWh" },
        { label: "Compteur eau", kind: "compteur", unit: "m³" },
        { label: "Clés remises", kind: "cle" },
      ],
    };

    // Sécurité : ne pas dupliquer si déjà des pièces
    const existing = ok(await supabase.from("inspection_rooms").select("id").eq("inspection_id", inspectionId));
    if (existing && existing.length > 0) return { skipped: true };

    let pos = 0;
    // 1) crée les pièces standards + leurs éléments
    for (const room of TEMPLATE) {
      const r = ok(await supabase.from("inspection_rooms")
        .insert({ inspection_id: inspectionId, name: room.name, position: pos++ })
        .select().single());
      const rows = room.items.map((label, i) => ({
        room_id: r.id, label, item_kind: "etat", position: i,
      }));
      if (rows.length) ok(await supabase.from("inspection_items").insert(rows));
    }
    // 2) crée la pièce "Compteurs & clés" avec les éléments spéciaux
    const g = ok(await supabase.from("inspection_rooms")
      .insert({ inspection_id: inspectionId, name: GENERAL.name, position: pos++ })
      .select().single());
    const grows = GENERAL.special.map((s, i) => ({
      room_id: g.id, label: s.label, item_kind: s.kind,
      meter_unit: s.unit || null, position: i,
    }));
    ok(await supabase.from("inspection_items").insert(grows));

    return { skipped: false };
  },
};

/* ---------------- STOCKAGE (photos, justificatifs) ---------------- */
export const storage = {
  // Bucket privé "documents". Chemin = {user_id}/{timestamp}-{nom}
  async upload(path, file) {
    const { data, error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return data.path;
  },
  async signedUrl(path, seconds = 3600) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, seconds);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },
  async remove(path) {
    const { error } = await supabase.storage.from("documents").remove([path]);
    if (error) throw new Error(error.message);
    return true;
  },
};

/* ---------------- DOCUMENTS (gestion complète) ---------------- */
export const docs = {
  // Uploade un fichier + crée la ligne en base. Renvoie le document créé.
  async add(rawFile, { category = "autre", name, propertyId = null, unitId = null }) {
    const file = await compressImage(rawFile);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");
    // chemin unique dans le bucket, préfixé par l'id user (isolation)
    const safeName = (name || file.name || "fichier").replace(/[^\w.\-]/g, "_");
    const path = user.id + "/" + Date.now() + "-" + safeName;
    await storage.upload(path, file);
    const row = ok(await supabase.from("documents").insert({
      owner_id: user.id, property_id: propertyId, unit_id: unitId,
      category, name: name || rawFile.name, file_url: path,
    }).select().single());
    return row;
  },
  // Liste mes documents (RLS filtre selon le rôle)
  async list() {
    return ok(await supabase.from("documents").select("*").order("created_at", { ascending: false }));
  },
  // Lien signé temporaire pour consulter/télécharger
  async open(fileUrl) {
    return storage.signedUrl(fileUrl, 3600);
  },
  // Supprime le fichier + la ligne
  async remove(id, fileUrl) {
    if (fileUrl) { try { await storage.remove(fileUrl); } catch (e) {} }
    ok(await supabase.from("documents").delete().eq("id", id));
    return true;
  },
};
