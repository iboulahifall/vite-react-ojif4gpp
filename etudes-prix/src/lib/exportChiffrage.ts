import type { Study } from '../domain/types';
import { buildUp, lineCost, lineSalePrice, SOURCE_LABELS, STATUS_LABELS } from '../domain/chiffrage';
import { FAMILIES } from '../domain/catalog';
import { loadExcelJs } from './excel';

/**
 * Classeur Excel du chiffrage : détail par famille (déboursé et prix de vente par ligne,
 * prêts à reporter dans la DPGF) et récapitulatif du déboursé sec au prix de vente.
 */
export async function chiffrageWorkbook(study: Study, supplierName: (id?: string) => string): Promise<Blob> {
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Études de Prix CFO/CFA';
  const b = buildUp(study.metre, study.chiffrage);
  const eur = '#,##0.00 €';

  const ws = wb.addWorksheet('Chiffrage', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = [
    { key: 'ref', width: 10 }, { key: 'des', width: 52 }, { key: 'u', width: 7 }, { key: 'q', width: 10 },
    { key: 'mat', width: 13 }, { key: 'h', width: 9 }, { key: 'mo', width: 13 }, { key: 'st', width: 13 }, { key: 'ds', width: 14 },
    { key: 'puv', width: 13 }, { key: 'pv', width: 15 }, { key: 'src', width: 20 }, { key: 'stat', width: 13 }, { key: 'sup', width: 22 }, { key: 'refsrc', width: 20 },
  ];
  ws.addRow([`${study.isDemo ? 'DONNÉES DE DÉMONSTRATION — ' : ''}${study.name} — ${study.reference}`]).font = { bold: true, size: 13 };
  ws.addRow([`Chiffrage au ${new Date().toLocaleDateString('fr-FR')} — coefficient de vente ${b.coefficient ?? '—'}`]);
  ws.addRow([]);
  const head = ws.addRow(['Poste', 'Désignation', 'U', 'Qté', 'Matériel', 'Heures', 'Main-d’œuvre', 'Sous-traitance', 'Déboursé sec', 'PU vente', 'Total vente HT', 'Origine du prix', 'Statut', 'Fournisseur', 'Référence']);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; });

  for (const fid of [...FAMILIES.map((f) => f.id), null]) {
    const lines = study.metre.filter((m) => m.familyId === fid && !m.removedFromDpgf);
    if (!lines.length) continue;
    const fam = FAMILIES.find((f) => f.id === fid);
    const title = ws.addRow(['', fam ? `${fam.lot} — ${fam.label}` : 'À rattacher']);
    title.font = { bold: true };
    for (const m of lines) {
      const p = study.chiffrage.lines.find((l) => l.metreLineId === m.id);
      const c = lineCost(m, p, study.chiffrage.params);
      const pv = lineSalePrice(c, b);
      ws.addRow({
        ref: m.ref, des: m.designation, u: m.unit, q: c.qty, mat: c.material, h: c.laborHours, mo: c.labor, st: c.subcontract, ds: c.total,
        puv: pv !== null && c.qty ? Math.round((pv / c.qty) * 100) / 100 : null, pv,
        src: c.missing ? 'MANQUANT' : p ? SOURCE_LABELS[p.source.kind] : '', stat: c.missing ? '' : p ? STATUS_LABELS[p.source.status] : '',
        sup: p?.source.supplierId ? supplierName(p.source.supplierId) : '', refsrc: p?.source.reference ?? '',
      });
    }
  }
  const tot = ws.addRow({ des: 'TOTAL', mat: b.material, h: b.laborHours, mo: b.labor, st: b.subcontract, ds: b.dryCost, pv: b.salePrice });
  tot.font = { bold: true };
  for (const k of ['mat', 'mo', 'st', 'ds', 'puv', 'pv']) ws.getColumn(k).numFmt = eur;

  const rs = wb.addWorksheet('Récapitulatif');
  rs.columns = [{ width: 38 }, { width: 18 }, { width: 14 }];
  rs.addRow(['Du déboursé sec au prix de vente']).font = { bold: true, size: 13 };
  rs.addRow([]);
  const p = study.chiffrage.params;
  const rows: [string, number, string][] = [
    ['Matériel', b.material, ''],
    ['Main-d’œuvre', b.labor, `${b.laborHours} h × ${p.hourlyRate} €/h`],
    ['Sous-traitance', b.subcontract, ''],
    ['DÉBOURSÉ SEC', b.dryCost, ''],
    ['Frais de chantier', b.siteCosts, `${p.siteCostsPct} % du DS`],
    ['Frais généraux', b.overhead, `${p.overheadPct} % (DS + FC)`],
    ['Aléas', b.risk, `${p.riskPct} % du DS`],
    ['PRIX DE REVIENT', b.costPrice, ''],
    ['Marge', b.margin, `${p.marginPct} % du PV`],
    ['PRIX DE VENTE HT', b.salePrice, `coef. ${b.coefficient ?? '—'}`],
  ];
  for (const [label, v, note] of rows) {
    const r = rs.addRow([label, v, note]);
    r.getCell(2).numFmt = eur;
    if (label === label.toUpperCase()) r.font = { bold: true };
  }
  rs.addRow([]);
  rs.addRow([`Lignes : ${b.lines} · sans prix : ${b.missing} · à confirmer : ${b.toConfirm} · estimées : ${b.estimated}`]);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
