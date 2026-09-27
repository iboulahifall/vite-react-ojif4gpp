import type { DceCategory, DceDocType, DceFile, FileKind, Lot, Study } from './types';
import { DCE_DOCS, dceDocInfo, isDocRelevant } from './catalog';

/** Taille maximale d'un fichier importé. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = ['.pdf', '.xlsx', '.xlsm', '.xls', '.csv', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.txt', '.dwg', '.zip'];

export const CATEGORY_ORDER: DceCategory[] = [...DCE_DOCS.map((d) => d.type), 'AUTRE'];

export function categoryLabel(c: DceCategory): string {
  return c === 'AUTRE' ? 'Autres pièces' : dceDocInfo(c).label;
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function kindOf(name: string, mime = ''): FileKind {
  const ext = extensionOf(name);
  if (ext === '.pdf' || mime === 'application/pdf') return 'pdf';
  if (['.xlsx', '.xlsm', '.xls', '.csv'].includes(ext)) return 'excel';
  if (['.docx', '.doc'].includes(ext)) return 'word';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (ext === '.txt' || mime === 'text/plain') return 'text';
  return 'other';
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.()[\]]+/g, ' ');
}

/**
 * Classement automatique d'après le nom du fichier.
 * Les règles vont du plus spécifique au plus général ; l'utilisateur peut toujours reclasser.
 */
export function classifyFileName(name: string): DceCategory {
  const n = ` ${norm(name.replace(/\.[^.]+$/, ''))} `;
  const has = (re: RegExp) => re.test(n);
  if (has(/\bcctp\b|cahier des clauses techniques/)) return 'CCTP';
  if (has(/\bccap\b|cahier des clauses administratives/)) return 'CCAP';
  if (has(/\bdpgf\b|\bdqe\b|\bbpu\b|decomposition du prix|bordereau/)) return 'DPGF';
  if (has(/\brc\b|reglement (de )?(la )?consultation/)) return 'RC';
  const isPlan = has(/\bplans?\b|\bimplantation|\bschema|\bsynoptique|\bniveau\b|\br ?\+ ?\d|\bdwg\b/) || extensionOf(name) === '.dwg';
  const cfa = has(/\bcfa\b|courants? faibles?|\bssi\b|\bvdi\b|\bsecurite incendie|\bcontrole d ?acces|\bvideo|\bgtb\b|\bcablage/);
  const cfo = has(/\bcfo\b|courants? forts?|\beclairage|\bprises?\b|\bforce\b|\btgbt\b|\bdistribution|\belec/);
  if (cfa && (isPlan || !cfo)) return 'PLANS_CFA';
  if (cfo || (isPlan && has(/\belec/))) return 'PLANS_CFO';
  return 'AUTRE';
}

export type CategoryState = 'imported' | 'declared' | 'missing' | 'na';

export interface CategoryStatus {
  category: DceDocType;
  label: string;
  essential: boolean;
  state: CategoryState;
  files: DceFile[];
}

/** État de chaque pièce attendue : fichier importé, déclarée reçue sans fichier, manquante, sans objet. */
export function dceStatus(study: Pick<Study, 'documents' | 'dceDocs' | 'lots'>): CategoryStatus[] {
  return DCE_DOCS.map((info) => {
    const files = study.documents.filter((f) => f.category === info.type);
    const declared = study.dceDocs.find((d) => d.type === info.type)?.received ?? false;
    const state: CategoryState = !isDocRelevant(info.type, study.lots as Lot[])
      ? 'na'
      : files.length > 0 ? 'imported' : declared ? 'declared' : 'missing';
    return { category: info.type, label: info.label, essential: info.essential, state, files };
  });
}

export interface DceCompleteness {
  expected: number;
  imported: number;
  declared: number;
  missing: CategoryStatus[];
  unclassified: number;
}

export function dceCompleteness(study: Pick<Study, 'documents' | 'dceDocs' | 'lots'>): DceCompleteness {
  const st = dceStatus(study).filter((s) => s.state !== 'na');
  return {
    expected: st.length,
    imported: st.filter((s) => s.state === 'imported').length,
    declared: st.filter((s) => s.state === 'declared').length,
    missing: st.filter((s) => s.state === 'missing'),
    unclassified: study.documents.filter((f) => f.category === 'AUTRE').length,
  };
}

/** Après import ou reclassement : une catégorie contenant un fichier est déclarée reçue. */
export function syncDeclarations<T extends Pick<Study, 'documents' | 'dceDocs'>>(study: T): T['dceDocs'] {
  return study.dceDocs.map((d) => (study.documents.some((f) => f.category === d.type) ? { ...d, received: true } : d));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export interface RejectedFile { name: string; reason: string }

export function validateUpload(file: { name: string; size: number }): string | null {
  if (file.size === 0) return 'Fichier vide.';
  if (file.size > MAX_FILE_SIZE) return `Fichier trop volumineux (${formatFileSize(file.size)} > 50 Mo).`;
  return null;
}

/** « 12 p. », « 2 feuilles », « 850 mots » selon le type de fichier. */
export function formatFacts(d: Pick<DceFile, 'pages' | 'sheets' | 'words'>): string {
  if (d.pages !== undefined) return `${d.pages} p.`;
  if (d.sheets !== undefined) return `${d.sheets} feuille${d.sheets > 1 ? 's' : ''}`;
  if (d.words !== undefined) return `${d.words.toLocaleString('fr-FR')} mots`;
  return '—';
}
