import type { DceFile, Study } from '../types';
import type { AnalysisResult, ComparisonItem, DetectedPrestation, DpgfLine, Finding, SourceRef } from './types';
import { excerpt, hash, isHeading, normalizeText, sentences } from './text';
import { PRESTATION_RULES } from './prestationRules';
import { CLAUSE_RULES } from './clauseRules';
import { parseDpgf } from './dpgf';
import { FAMILIES } from '../catalog';

export interface AnalysisInput {
  study: Pick<Study, 'documents' | 'families' | 'lots'>;
  /** Texte des pièces écrites (RC, CCAP, CCTP…), page par page. */
  texts: { doc: DceFile; pages: string[] }[];
  /** Feuilles de la DPGF (lignes brutes). */
  dpgf?: { doc: DceFile; sheets: { name: string; rows: (string | number | null)[][] }[] };
  user: string;
  now?: Date;
}

/** Nombre maximum de constats d'une même règle par document. */
const MAX_PER_RULE = 3;

export function dceSignature(documents: DceFile[]): string {
  return hash(documents.map((d) => `${d.id}:${d.category}:${d.uploadedAt}`).sort().join('|'));
}

function src(doc: DceFile, page?: number, row?: number): SourceRef {
  return { docId: doc.id, docName: doc.name, page, row };
}

export function sourceLabel(s?: SourceRef): string {
  if (!s) return '';
  return `${s.docName}${s.page ? ` p.${s.page}` : ''}${s.row ? ` l.${s.row}` : ''}`;
}

function detectPrestations(pages: string[]): DetectedPrestation[] {
  const out: DetectedPrestation[] = [];
  for (const rule of PRESTATION_RULES) {
    const found: number[] = [];
    let first = '';
    pages.forEach((page, i) => {
      for (const s of sentences(page)) {
        if (rule.pattern.test(normalizeText(s))) {
          if (!found.includes(i + 1)) found.push(i + 1);
          // Extrait : de préférence une phrase de description plutôt qu'un titre.
          if (!first || (isHeading(first) && !isHeading(s))) first = s;
        }
      }
    });
    if (found.length) out.push({ ruleId: rule.id, familyId: rule.familyId, label: rule.label, pages: found, excerpt: excerpt(first) });
  }
  return out;
}

function clauseFindings(doc: DceFile, pages: string[]): Finding[] {
  const out: Finding[] = [];
  const count: Record<string, number> = {};
  pages.forEach((page, i) => {
    for (const s of sentences(page)) {
      if (isHeading(s)) continue;
      const n = normalizeText(s);
      for (const rule of CLAUSE_RULES) {
        if (!rule.pattern.test(n)) continue;
        // Une phrase = un constat (la règle la plus prioritaire), dans la limite par règle.
        if ((count[rule.id] ?? 0) >= (rule.max ?? MAX_PER_RULE)) break;
        count[rule.id] = (count[rule.id] ?? 0) + 1;
        const ex = excerpt(s);
        out.push({
          id: `clause-${rule.id}-${hash(doc.id + ex)}`,
          level: rule.level,
          category: 'clause',
          title: rule.title,
          detail: rule.detail,
          excerpt: ex,
          source: src(doc, i + 1),
          question: rule.question?.replace('{phrase}', excerpt(s, 160)),
        });
        break;
      }
    }
  });
  return out;
}

export function compare(prestations: DetectedPrestation[], lines: DpgfLine[]): ComparisonItem[] {
  const items: ComparisonItem[] = [];
  for (const rule of PRESTATION_RULES) {
    const p = prestations.find((x) => x.ruleId === rule.id);
    const refs = lines.filter((l) => l.ruleIds.includes(rule.id)).map((l) => l.ref || `l.${l.row}`);
    if (!p && refs.length === 0) continue;
    items.push({
      ruleId: rule.id,
      familyId: rule.familyId,
      label: rule.label,
      status: p && refs.length ? 'ok' : p ? 'cctp-seul' : 'dpgf-seul',
      cctpPages: p?.pages ?? [],
      dpgfRefs: refs,
    });
  }
  // Ordre de lecture : familles CFO puis CFA, dans l'ordre du catalogue.
  const famIndex = (id: string) => FAMILIES.findIndex((f) => f.id === id);
  return items.sort((a, b) => famIndex(a.familyId) - famIndex(b.familyId));
}

/**
 * Analyse automatique par règles : prestations du CCTP, lecture de la DPGF,
 * comparaison CCTP / DPGF et repérage des clauses à risque.
 * Les résultats sont des propositions à vérifier par le responsable.
 */
export function analyse(input: AnalysisInput): AnalysisResult {
  const now = input.now ?? new Date();
  const findings: Finding[] = [];
  const cctp = input.texts.find((t) => t.doc.category === 'CCTP');
  const prestations = cctp ? detectPrestations(cctp.pages) : [];

  let dpgfLines: DpgfLine[] = [];
  if (input.dpgf) {
    // Feuille retenue : celle qui donne le plus de lignes chiffrables.
    for (const sheet of input.dpgf.sheets) {
      const lines = parseDpgf(sheet.rows);
      if (lines.length > dpgfLines.length) dpgfLines = lines;
    }
  }

  // Pièces indispensables à l'analyse
  const dpgfDoc = input.study.documents.find((d) => d.category === 'DPGF');
  if (!cctp) {
    findings.push({ id: 'document-cctp-absent', level: 'critique', category: 'document', title: 'CCTP non analysé',
      detail: 'Aucun CCTP lisible (PDF ou Word) n’est importé : les prestations ne peuvent pas être détectées.',
      question: 'Pouvez-vous transmettre le CCTP du lot électricité ?' });
  } else if (cctp.pages.join('').trim().length < 50) {
    findings.push({ id: `document-cctp-vide-${cctp.doc.id}`, level: 'critique', category: 'document', title: 'CCTP sans texte exploitable',
      detail: 'Le CCTP semble être un scan (image) : son texte ne peut pas être lu automatiquement. Lecture manuelle nécessaire.',
      source: src(cctp.doc) });
  }
  if (!dpgfDoc) {
    findings.push({ id: 'document-dpgf-absente', level: 'critique', category: 'document', title: 'DPGF absente',
      detail: 'Sans DPGF, le cadre de réponse et les quantités sont à établir entièrement.',
      question: 'Pouvez-vous transmettre la DPGF (format Excel) du lot électricité ?' });
  } else if (!input.dpgf) {
    findings.push({ id: `document-dpgf-format-${dpgfDoc.id}`, level: 'verifier', category: 'document', title: 'DPGF non lisible automatiquement',
      detail: 'Seules les DPGF au format Excel (.xlsx) ou CSV sont lues. Demander la version Excel ou saisir la DPGF manuellement.',
      source: src(dpgfDoc), question: 'Pouvez-vous transmettre la DPGF au format Excel ?' });
  } else if (dpgfLines.length === 0) {
    findings.push({ id: `document-dpgf-structure-${dpgfDoc.id}`, level: 'verifier', category: 'document', title: 'Structure de DPGF non reconnue',
      detail: 'Les colonnes « Désignation » et « Unité » n’ont pas été trouvées : vérifier la DPGF manuellement.', source: src(dpgfDoc) });
  }

  // Comparaison CCTP / DPGF
  const comparison = cctp && dpgfLines.length ? compare(prestations, dpgfLines) : [];
  for (const c of comparison) {
    if (c.status === 'cctp-seul') {
      const transverse = PRESTATION_RULES.find((r) => r.id === c.ruleId)?.transverse;
      findings.push({ id: `ecart-cctp-${c.ruleId}`, level: transverse ? 'verifier' : 'critique', category: 'ecart', title: `Absent de la DPGF : ${c.label}`,
        detail: transverse
          ? 'Prestation transverse décrite au CCTP sans ligne dédiée dans la DPGF : à inclure dans les prix unitaires ou les frais de chantier.'
          : 'Prestation décrite au CCTP sans ligne correspondante dans la DPGF : risque d’oubli, ou prestation à répartir dans d’autres prix.',
        source: cctp ? src(cctp.doc, c.cctpPages[0]) : undefined,
        excerpt: prestations.find((p) => p.ruleId === c.ruleId)?.excerpt,
        question: `La prestation « ${c.label} » décrite au CCTP (p. ${c.cctpPages.join(', ')}) n’apparaît pas dans la DPGF : dans quel article doit-elle être chiffrée ?` });
    } else if (c.status === 'dpgf-seul' && dpgfDoc) {
      const line = dpgfLines.find((l) => l.ruleIds.includes(c.ruleId))!;
      findings.push({ id: `ecart-dpgf-${c.ruleId}`, level: 'verifier', category: 'ecart', title: `Non décrit au CCTP : ${c.label}`,
        detail: 'Ligne de DPGF sans description au CCTP : les spécifications (matériel, performances) sont à préciser.',
        source: src(dpgfDoc, undefined, line.row), excerpt: `${line.ref} ${line.designation}`.trim(),
        question: `Pouvez-vous préciser les spécifications attendues pour « ${line.designation} » (DPGF ${line.ref || `l.${line.row}`}) ?` });
    }
  }

  // Quantités
  if (dpgfDoc && dpgfLines.length) {
    const missing = dpgfLines.filter((l) => l.qty === null || l.qty === 0);
    if (missing.length > dpgfLines.length / 2) {
      findings.push({ id: `quantite-dpgf-vide-${dpgfDoc.id}`, level: 'critique', category: 'quantite', title: 'DPGF sans quantités',
        detail: `${missing.length} ligne(s) sur ${dpgfLines.length} sans quantité : le métré complet est à réaliser par l’entreprise.`, source: src(dpgfDoc) });
    } else {
      for (const l of missing) {
        findings.push({ id: `quantite-${hash(l.ref + l.designation)}`, level: 'verifier', category: 'quantite', title: `Quantité à établir : ${l.ref || `l.${l.row}`}`,
          detail: 'Ligne sans quantité dans la DPGF : quantité à établir au métré.', source: src(dpgfDoc, undefined, l.row), excerpt: l.designation });
      }
    }
    const unknown = dpgfLines.filter((l) => !l.ruleId);
    if (unknown.length) {
      findings.push({ id: `ecart-dpgf-non-reconnues-${hash(unknown.map((l) => l.ref + l.designation).join())}`, level: 'verifier', category: 'ecart',
        title: `${unknown.length} ligne(s) de DPGF non rattachée(s)`,
        detail: 'Ces lignes ne correspondent à aucune prestation connue : à rattacher manuellement.',
        source: src(dpgfDoc), excerpt: unknown.slice(0, 6).map((l) => `${l.ref} ${l.designation}`.trim()).join(' · ') });
    }
  }

  // Périmètre : prestations décrites mais famille exclue de l'étude
  for (const p of prestations) {
    if (!input.study.families.includes(p.familyId)) {
      const fam = FAMILIES.find((f) => f.id === p.familyId);
      findings.push({ id: `perimetre-${p.ruleId}`, level: 'verifier', category: 'perimetre', title: `Hors périmètre retenu : ${p.label}`,
        detail: `Le CCTP décrit cette prestation, mais la famille « ${fam?.label ?? p.familyId} »${fam && !input.study.lots.includes(fam.lot) ? ` (lot ${fam.lot})` : ''} est exclue de l’étude. Confirmer qu’elle n’est pas à chiffrer.`,
        source: cctp ? src(cctp.doc, p.pages[0]) : undefined, excerpt: p.excerpt });
    }
  }

  // Clauses à risque dans les pièces écrites
  for (const t of input.texts) findings.push(...clauseFindings(t.doc, t.pages));

  const order = { critique: 0, verifier: 1 };
  findings.sort((a, b) => order[a.level] - order[b.level]);

  return {
    runAt: now.toISOString(),
    runBy: input.user,
    dceSignature: dceSignature(input.study.documents),
    cctp: cctp ? { docId: cctp.doc.id, docName: cctp.doc.name, pages: cctp.pages.length } : undefined,
    dpgf: input.dpgf && dpgfDoc ? { docId: input.dpgf.doc.id, docName: input.dpgf.doc.name, lines: dpgfLines.length } : undefined,
    documentsRead: input.texts.map((t) => ({ docId: t.doc.id, docName: t.doc.name, pages: t.pages.length })),
    prestations,
    dpgfLines,
    comparison,
    findings,
  };
}
