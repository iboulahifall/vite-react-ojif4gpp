import type { AnalysisResult, Finding, FindingDecision, FindingStatus } from './types';

export function findingStatus(f: Finding, decisions: Record<string, FindingDecision>): FindingStatus {
  return decisions[f.id]?.status ?? 'ouvert';
}

export interface AnalysisSummary {
  critical: number;
  toCheck: number;
  confirmed: number;
  questions: number;
  treated: number;
  dismissed: number;
}

/**
 * Compteurs de la page Analyse :
 * - critiques / à vérifier : constats encore ouverts ;
 * - confirmés : prestations présentes au CCTP et à la DPGF + constats traités ;
 * - questions : questions proposées sur des constats encore ouverts.
 */
export function summarize(a: AnalysisResult, decisions: Record<string, FindingDecision>): AnalysisSummary {
  const open = a.findings.filter((f) => findingStatus(f, decisions) === 'ouvert');
  const treated = a.findings.filter((f) => findingStatus(f, decisions) === 'traite').length;
  return {
    critical: open.filter((f) => f.level === 'critique').length,
    toCheck: open.filter((f) => f.level === 'verifier').length,
    confirmed: a.comparison.filter((c) => c.status === 'ok').length + treated,
    questions: open.filter((f) => f.question).length,
    treated,
    dismissed: a.findings.filter((f) => findingStatus(f, decisions) === 'ecarte').length,
  };
}

/** Constats et prestations propres à un document (panneau du DCE). */
export function docFacts(a: AnalysisResult, docId: string, decisions: Record<string, FindingDecision>) {
  const own = a.findings.filter((f) => f.source?.docId === docId && findingStatus(f, decisions) === 'ouvert');
  return {
    analysed: a.documentsRead.some((d) => d.docId === docId) || a.dpgf?.docId === docId,
    prestations: a.cctp?.docId === docId ? a.prestations.length : a.dpgf?.docId === docId ? a.dpgfLines.length : 0,
    critical: own.filter((f) => f.level === 'critique').length,
    questions: own.filter((f) => f.question).length,
  };
}
