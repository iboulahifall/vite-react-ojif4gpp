import { describe, expect, it } from 'vitest';
import { HttpStudyRepository } from './httpRepository';
import type { SyncStatus } from './repository';
import type { Study } from '../domain/types';

/** Faux serveur reproduisant le protocole de l'API (versions, 409). */
function fakeServer() {
  const rows = new Map<string, { version: number; data: Study }>();
  let initialized = false;
  let down = false;
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (down) throw new TypeError('Failed to fetch');
    const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const m = url.match(/^\/api\/studies\/([^?]+)(?:\?baseVersion=(\d+))?$/);
    if (url === '/api/studies') return j({ initialized, items: [...rows.values()] });
    if (url === '/api/suppliers') return j({ initialized: false, items: [] });
    if (url === '/api/settings') return method === 'GET' ? j({ data: null }) : j({ ok: true });
    if (m && method === 'PUT') {
      const body = JSON.parse(String(init!.body)) as { data: Study; baseVersion: number | null };
      const row = rows.get(m[1]);
      if ((row && body.baseVersion !== row.version) || (!row && body.baseVersion)) return j({ detail: {} }, 409);
      const version = (row?.version ?? 0) + 1;
      rows.set(m[1], { version, data: body.data });
      initialized = true;
      return j({ version });
    }
    if (m && method === 'DELETE') { rows.delete(m[1]); return new Response(null, { status: 204 }); }
    return j({}, 404);
  }) as unknown as typeof fetch;
  return { f, rows, calls, setDown: (v: boolean) => { down = v; } };
}

const study = (id: string, name = id) => ({ id, reference: id, name, status: 'analyse', dueDate: '2026-10-01' }) as unknown as Study;

describe('dépôt serveur (HTTP)', () => {
  it('base vierge → null (création de la démonstration), puis n’envoie que les études modifiées', async () => {
    const srv = fakeServer();
    const repo = new HttpStudyRepository('', srv.f, 0);
    expect(await repo.loadStudies()).toBeNull();
    await repo.saveStudies([study('a'), study('b')]);
    await repo.flush();
    expect([...srv.rows.keys()]).toEqual(['a', 'b']);
    srv.calls.length = 0;
    await repo.saveStudies([study('a', 'A modifiée'), study('b')]);
    await repo.flush();
    expect(srv.calls).toEqual(['PUT /api/studies/a']);
    expect(srv.rows.get('a')).toMatchObject({ version: 2, data: { name: 'A modifiée' } });
    // Suppression
    await repo.saveStudies([study('a', 'A modifiée')]);
    await repo.flush();
    expect(srv.calls.at(-1)).toBe('DELETE /api/studies/b?baseVersion=1');
    expect(srv.rows.has('b')).toBe(false);
  });

  it('ne réécrase jamais une modification faite sur un autre poste (409 → conflit signalé)', async () => {
    const srv = fakeServer();
    const a = new HttpStudyRepository('', srv.f, 0);
    await a.loadStudies();
    await a.saveStudies([study('x')]);
    await a.flush();
    const b = new HttpStudyRepository('', srv.f, 0);
    expect((await b.loadStudies())?.map((s) => s.id)).toEqual(['x']);
    await a.saveStudies([study('x', 'Poste A')]);
    await a.flush();
    const states: SyncStatus[] = [];
    b.subscribe((s) => states.push(s));
    await b.saveStudies([study('x', 'Poste B')]);
    await b.flush();
    expect(srv.rows.get('x')?.data.name).toBe('Poste A');
    expect(states.at(-1)).toMatchObject({ state: 'conflict', conflicts: ['x'] });
  });

  it('serveur injoignable : garde les modifications et les renvoie au retour du serveur', async () => {
    const srv = fakeServer();
    const repo = new HttpStudyRepository('', srv.f, 0);
    await repo.loadStudies();
    srv.setDown(true);
    const states: string[] = [];
    repo.subscribe((s) => states.push(`${s.state}:${s.pending}`));
    await repo.saveStudies([study('a')]);
    await repo.flush();
    expect(states.at(-1)).toBe('offline:1');
    expect(repo.hasPendingChanges()).toBe(true);
    srv.setDown(false);
    await repo.flush();
    expect(srv.rows.has('a')).toBe(true);
    expect(states.at(-1)).toBe('saved:0');
  });
});
