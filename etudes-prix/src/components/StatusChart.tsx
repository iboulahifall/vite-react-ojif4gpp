import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { StudyStatus } from '../domain/types';

interface Datum { status: StudyStatus; label: string; count: number }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <div className="font-semibold text-slate-900">{d.label}</div>
      <div className="text-slate-600">{d.count} étude{d.count > 1 ? 's' : ''} — cliquer pour voir</div>
    </div>
  );
}

/** Une seule série (nombre d'études par étape) : une couleur, valeurs affichées, pas de légende. */
export function StatusChart({ data }: { data: Datum[] }) {
  const navigate = useNavigate();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, left: -20, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fill: '#475569', fontSize: 12 }} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar
            dataKey="count"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
            className="cursor-pointer"
            onClick={(d) => navigate(`/etudes?statut=${(d as unknown as { payload: Datum }).payload.status}`)}
          >
            <LabelList dataKey="count" position="top" style={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
