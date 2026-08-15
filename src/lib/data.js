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

/* Petit utilitaire : lève une erreur lisible, jamais un objet brut. */
function ok({ data, error }) {
  if (error) throw new Error(error.message || "Une erreur est survenue.");
  return data;
}

/* ---------------- AUTH ---------------- */
export const auth = {
  async signUp({ email, password, fullName, role = "proprietaire" }) {
    return ok(await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role } },
    }));
  },
  async signIn({ email, password }) {
    return ok(await supabase.auth.signInWithPassword({ email, password }));
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
  async expenses() {
    return ok(await supabase.from("expenses").select("*").order("created_at", { ascending: false }));
  },
  async setExpenseStatus(id, status) {
    return ok(await supabase.from("expenses").update({ status }).eq("id", id).select().single());
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
  // Le statut (auto_validee / attente_validation) est décidé par un trigger SQL
  // selon settings.approval_threshold — le front n'a pas à en décider (§11).
  async addExpense(propertyId, e) {
    const { data: { user } } = await supabase.auth.getUser();
    return ok(await supabase.from("expenses")
      .insert({ ...e, property_id: propertyId, created_by: user.id })
      .select().single());
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
  async reportProblem(unitId, { category, description, photoUrl }) {
    const { data: { user } } = await supabase.auth.getUser();
    return ok(await supabase.from("maintenance_requests").insert({
      unit_id: unitId, reported_by: user.id, category, description,
      photo_url: photoUrl || null, status: "nouveau",
    }).select().single());
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

/* ---------------- QUITTANCES (preuves de paiement) ---------------- */
export const receipts = {
  // Toutes les quittances qui me concernent (RLS filtre : mes quittances locataire OU proprio)
  async mine() {
    return ok(await supabase.from("receipts").select("*").order("created_at", { ascending: false }));
  },
};

/* ---------------- STOCKAGE (photos, justificatifs) ---------------- */
export const storage = {
  // Bucket privé "documents" à créer dans Supabase. Upload compressé côté client
  // avant appel (§34) — voir compressImage dans l'app.
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
};
