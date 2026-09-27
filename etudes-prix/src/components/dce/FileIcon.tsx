import { File, FileImage, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';
import type { FileKind } from '../../domain/types';

const MAP = {
  pdf: { Icon: FileText, cls: 'text-red-600' },
  excel: { Icon: FileSpreadsheet, cls: 'text-emerald-600' },
  word: { Icon: FileType2, cls: 'text-blue-600' },
  image: { Icon: FileImage, cls: 'text-violet-600' },
  text: { Icon: FileText, cls: 'text-slate-500' },
  other: { Icon: File, cls: 'text-slate-500' },
};

export function FileIcon({ kind, size = 18 }: { kind: FileKind; size?: number }) {
  const { Icon, cls } = MAP[kind];
  return <Icon size={size} className={`shrink-0 ${cls}`} aria-hidden />;
}
