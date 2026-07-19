import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { cors } from 'hono/cors';

type Role = 'admin' | 'editor' | 'viewer';
type Env = { DB: D1Database; ASSETS: Fetcher };
type User = { id: string; name: string; email: string; role: Role };
type Vars = { user: User };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const enc = new TextEncoder();
const bytesToHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const randomHex = (n = 32) => bytesToHex(crypto.getRandomValues(new Uint8Array(n)).buffer);
const sha256 = async (value: string) => bytesToHex(await crypto.subtle.digest('SHA-256', enc.encode(value)));

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return bytesToHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 210000, hash: 'SHA-256' }, key, 256));
}

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};

app.use('/api/*', cors({ origin: origin => origin, credentials: true }));

app.use('/api/*', async (c, next) => {
  if (['/api/health', '/api/auth/status', '/api/auth/setup', '/api/auth/login'].includes(c.req.path)) return next();
  const token = getCookie(c, 'cebpar_session');
  if (!token) return c.json({ error: 'Sessão necessária.' }, 401);
  const tokenHash = await sha256(token);
  const row = await c.env.DB.prepare(`SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.deleted_at IS NULL`).bind(tokenHash, now()).first<User>();
  if (!row) return c.json({ error: 'Sessão expirada.' }, 401);
  c.set('user', row);
  await next();
});

const requireRole = (...roles: Role[]) => async (c: any, next: any) => roles.includes(c.get('user').role) ? next() : c.json({ error: 'Você não tem permissão para esta ação.' }, 403);
const json = async (c: any) => { try { return await c.req.json(); } catch { return {}; } };
const clean = (obj: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter(f => obj[f] !== undefined).map(f => [f, obj[f]]));

async function audit(db: D1Database, userId: string, module: string, recordId: string, action: string, before: unknown, after: unknown, reason?: string) {
  await db.prepare(`INSERT INTO audit_log(id,user_id,occurred_at,module,record_id,action,before_json,after_json,reason) VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(id(), userId, now(), module, recordId, action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, reason || null).run();
}

async function seedDemo(db: D1Database, userId: string) {
  const ts = now();
  const rows = [
    ['DEMO-001','UFV STF','Supremo Tribunal Federal','Usina Fotovoltaica','Setor Habitacional Catetinho, Brasília/DF','Em andamento','Aditivo contratual e operação',3.654],
    ['DEMO-002','UFV TSE','Tribunal Superior Eleitoral','Usina Fotovoltaica','Setor Habitacional Catetinho, Brasília/DF','Em andamento','Obra',4.018],
    ['DEMO-003','BESS Catetinho','','Sistema BESS','','Em estruturação','Instrução do processo de contratação',null],
    ['DEMO-004','CAESB','Companhia de Saneamento Ambiental do Distrito Federal','Autoprodução','','Em análise','Estudo de viabilidade',null],
    ['DEMO-005','UFV Flutuante Marinha','Marinha do Brasil','Usina Fotovoltaica Flutuante','Lago Paranoá, Brasília/DF','Em análise','Estudo preliminar',null],
    ['DEMO-006','Arena Energia','','Operação e Manutenção','','Em andamento','Acompanhamento de faturas',null],
    ['DEMO-007','UFV Marinha Santa Maria','Marinha do Brasil','Usina Fotovoltaica','','Aguardando definição de conexão','Recebimento de dados',2.77],
    ['DEMO-008','BRB/Inframerica','','Usina Fotovoltaica','','Em análise','Análise preliminar',3.00],
    ['DEMO-009','TJDFT','Tribunal de Justiça do Distrito Federal e dos Territórios','Estudo de Viabilidade','','Em prospecção','Definição do modelo de negócio',null],
    ['DEMO-010','TCDF','Tribunal de Contas do Distrito Federal','Estudo de Viabilidade','','Em prospecção','Prospecção',null]
  ];
  const statements = rows.map(r => db.prepare(`INSERT INTO projects(id,code,name,short_name,organization,project_type,location,status,phase,priority,criticality,dc_power_mwp,physical_progress,last_activity_at,created_at,created_by,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,'Média','Média',?,0,?,?,?,?,?)`)
    .bind(id(),r[0],r[1],r[1],r[2],r[3],r[4],r[5],r[6],r[7],ts,ts,userId,ts,userId));
  await db.batch(statements);
  const arena = await db.prepare(`SELECT id FROM projects WHERE code='DEMO-006'`).first<{id:string}>();
  if (arena) await db.prepare(`INSERT INTO pending_items(id,project_id,description,category,priority,criticality,status,origin,required_action,last_activity_at,created_at,created_by,updated_at,updated_by) VALUES(?,?,?,?,?,?,?, ?,?,?,?,?,?,?)`)
    .bind(id(),arena.id,'Atraso e inconsistência no recebimento de faturas da distribuidora','Faturamento','Alta','Alta','Aguardando distribuidora','Dados de demonstração','Cobrar regularização e validar as faturas recebidas',ts,ts,userId,ts,userId).run();
}

app.get('/api/health', c => c.json({ ok: true, time: now() }));
app.get('/api/auth/status', async c => {
  const count = await c.env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL`).first<{ n: number }>();
  return c.json({ needsSetup: !count?.n });
});
app.post('/api/auth/setup', async c => {
  const count = await c.env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL`).first<{ n: number }>();
  if (count?.n) return c.json({ error: 'Configuração inicial já realizada.' }, 409);
  const b = await json(c);
  if (!String(b.name || '').trim() || !String(b.email || '').trim() || typeof b.password !== 'string' || !b.password) return c.json({ error: 'Informe nome, e-mail e senha.' }, 400);
  const uid = id(), salt = randomHex(16), ts = now();
  await c.env.DB.prepare(`INSERT INTO users(id,name,email,password_hash,password_salt,role,created_at,updated_at) VALUES(?,?,?,?,?,'admin',?,?)`)
    .bind(uid, String(b.name).trim(), String(b.email).trim().toLowerCase(), await hashPassword(b.password, salt), salt, ts, ts).run();
  await audit(c.env.DB, uid, 'users', uid, 'create', null, { name: b.name, email: b.email, role: 'admin' });
  return c.json({ ok: true }, 201);
});
app.post('/api/auth/login', async c => {
  const b = await json(c);
  const user = await c.env.DB.prepare(`SELECT id,name,email,role,password_hash,password_salt FROM users WHERE email=? COLLATE NOCASE AND active=1 AND deleted_at IS NULL`).bind(String(b.email || '').trim()).first<any>();
  if (!user || !safeEqual(await hashPassword(String(b.password || ''), user.password_salt), user.password_hash)) return c.json({ error: 'E-mail ou senha inválidos.' }, 401);
  const token = randomHex(32), ts = now(), expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(`INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)`).bind(id(), user.id, await sha256(token), expires, ts).run();
  setCookie(c, 'cebpar_session', token, { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: 28800 });
  return c.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
app.post('/api/auth/logout', async c => { const t = getCookie(c, 'cebpar_session'); if (t) await c.env.DB.prepare(`DELETE FROM sessions WHERE token_hash=?`).bind(await sha256(t)).run(); deleteCookie(c, 'cebpar_session', { path: '/' }); return c.json({ ok: true }); });
app.get('/api/me', c => c.json({ user: c.get('user') }));

app.get('/api/dashboard', async c => {
  const [totals, pending, stale, recent] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) total, SUM(status='Em andamento') ongoing, SUM(status='Concluído') completed, SUM(CASE WHEN planned_end_date<date('now') AND status NOT IN ('Concluído','Cancelado') THEN 1 ELSE 0 END) delayed, COALESCE(SUM(dc_power_mwp),0) power, COALESCE(SUM(capex_estimated_cents),0) capex FROM projects WHERE deleted_at IS NULL`),
    c.env.DB.prepare(`SELECT SUM(CASE WHEN due_date<date('now') AND status NOT IN ('Concluída','Cancelada') THEN 1 ELSE 0 END) overdue, SUM(CASE WHEN due_date BETWEEN date('now') AND date('now','+7 day') AND status NOT IN ('Concluída','Cancelada') THEN 1 ELSE 0 END) next7, SUM(CASE WHEN due_date BETWEEN date('now') AND date('now','+30 day') AND status NOT IN ('Concluída','Cancelada') THEN 1 ELSE 0 END) next30 FROM pending_items WHERE deleted_at IS NULL`),
    c.env.DB.prepare(`SELECT id,name,last_activity_at FROM projects WHERE deleted_at IS NULL AND last_activity_at<datetime('now','-15 day') ORDER BY last_activity_at LIMIT 8`),
    c.env.DB.prepare(`SELECT a.*,u.name user_name FROM audit_log a JOIN users u ON u.id=a.user_id ORDER BY occurred_at DESC LIMIT 8`)
  ]);
  const phases = await c.env.DB.prepare(`SELECT phase label,COUNT(*) value FROM projects WHERE deleted_at IS NULL GROUP BY phase ORDER BY value DESC`).all();
  return c.json({ totals: totals.results[0] || {}, pending: pending.results[0] || {}, stale: stale.results, recent: recent.results, phases: phases.results });
});

const specs: Record<string, { table: string; module: string; fields: string[]; required: string[] }> = {
  projects: { table: 'projects', module: 'projects', required: ['code','name','project_type','status','phase'], fields: ['code','name','short_name','organization','project_type','business_model','location','description','owner_name','team','companies','status','phase','priority','criticality','dc_power_mwp','ac_power_mw','bess_power_mw','bess_energy_mwh','connection_voltage','generation_mode','distributor','annual_generation_mwh','technical_notes','capex_estimated_cents','capex_contracted_cents','annual_opex_cents','annual_revenue_cents','sei_process','contract_number','contractor','contract_value_cents','start_date','planned_end_date','actual_end_date','next_milestone','next_milestone_due','physical_progress','schedule_status','delay_reason'] },
  pending: { table: 'pending_items', module: 'pending', required: ['description','status'], fields: ['project_id','description','category','internal_owner','external_owner','due_date','priority','criticality','status','origin','required_action','comments','completed_at','completion_evidence'] },
  activities: { table: 'activities', module: 'activities', required: ['project_id','activity_date','title','activity_type'], fields: ['project_id','activity_date','title','description','action_taken','result','people','activity_type','future_action','future_due_date','next_owner'] },
  documents: { table: 'documents', module: 'documents', required: ['title','document_type'], fields: ['project_id','title','document_type','sei_number','official_letter_number','version_label','document_date','owner_name','status','external_url','file_key','notes'] }
};

for (const [route, spec] of Object.entries(specs)) {
  app.get(`/api/${route}`, async c => {
    const q = c.req.query('q') || '', project = c.req.query('project_id'), status = c.req.query('status');
    const clauses = ['t.deleted_at IS NULL'], values: unknown[] = [];
    if (q) { clauses.push(`(CAST(t.id AS TEXT) LIKE ? OR COALESCE(t.${route === 'projects' ? 'name' : route === 'activities' || route === 'documents' ? 'title' : 'description'},'') LIKE ?)`); values.push(`%${q}%`,`%${q}%`); }
    if (project && route !== 'projects') { clauses.push('t.project_id=?'); values.push(project); }
    if (status && route !== 'activities') { clauses.push('t.status=?'); values.push(status); }
    const order = route === 'activities' ? 't.activity_date DESC' : route === 'pending' ? 't.due_date IS NULL,t.due_date' : 't.updated_at DESC';
    const rows = await c.env.DB.prepare(`SELECT t.*${route === 'projects' ? '' : ',p.name project_name'} FROM ${spec.table} t ${route === 'projects' ? '' : 'LEFT JOIN projects p ON p.id=t.project_id'} WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT 500`).bind(...values).all();
    return c.json({ items: rows.results });
  });
  app.post(`/api/${route}`, requireRole('admin','editor'), async c => {
    const b = await json(c); for (const f of spec.required) if (!b[f]) return c.json({ error: `Campo obrigatório: ${f}` }, 400);
    const user = c.get('user'), rid = id(), ts = now(), data = clean(b, spec.fields);
    const base: Record<string,unknown> = { id: rid, ...data, created_at: ts, created_by: user.id, updated_at: ts, updated_by: user.id, version: 1 };
    if (route === 'projects' || route === 'pending') base.last_activity_at = ts;
    const keys = Object.keys(base); await c.env.DB.prepare(`INSERT INTO ${spec.table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...Object.values(base)).run();
    await audit(c.env.DB,user.id,spec.module,rid,'create',null,base,b.reason); return c.json({ item: base },201);
  });
  app.put(`/api/${route}/:id`, requireRole('admin','editor'), async c => {
    const rid=c.req.param('id'), b=await json(c), user=c.get('user');
    const before=await c.env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id=? AND deleted_at IS NULL`).bind(rid).first<any>();
    if(!before) return c.json({error:'Registro não encontrado.'},404);
    if(Number(b.version)!==Number(before.version)) return c.json({error:'Este registro foi alterado por outra pessoa. Atualize a tela antes de salvar.',conflict:true,current:before},409);
    const data=clean(b,spec.fields), ts=now(); data.updated_at=ts; data.updated_by=user.id; data.version=before.version+1; if(route==='projects'||route==='pending') data.last_activity_at=ts;
    const keys=Object.keys(data); await c.env.DB.prepare(`UPDATE ${spec.table} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=? AND version=?`).bind(...Object.values(data),rid,before.version).run();
    const after={...before,...data}; await audit(c.env.DB,user.id,spec.module,rid,'update',before,after,b.reason); return c.json({item:after});
  });
  app.delete(`/api/${route}/:id`, requireRole('admin'), async c => {
    const rid=c.req.param('id'), user=c.get('user'), before=await c.env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id=? AND deleted_at IS NULL`).bind(rid).first<any>();
    if(!before) return c.json({error:'Registro não encontrado.'},404); const ts=now();
    await c.env.DB.prepare(`UPDATE ${spec.table} SET deleted_at=?,updated_at=?,updated_by=?,version=version+1 WHERE id=?`).bind(ts,ts,user.id,rid).run();
    await audit(c.env.DB,user.id,spec.module,rid,'archive',before,{...before,deleted_at:ts}); return c.json({ok:true});
  });
}

app.get('/api/audit', async c => { const rows=await c.env.DB.prepare(`SELECT a.*,u.name user_name FROM audit_log a JOIN users u ON u.id=a.user_id ORDER BY occurred_at DESC LIMIT 500`).all(); return c.json({items:rows.results}); });
app.get('/api/users', requireRole('admin'), async c => { const rows=await c.env.DB.prepare(`SELECT id,name,email,role,active,created_at,updated_at,version FROM users WHERE deleted_at IS NULL ORDER BY name`).all(); return c.json({items:rows.results}); });
app.post('/api/users', requireRole('admin'), async c => { const b=await json(c); if(!String(b.name||'').trim()||!String(b.email||'').trim()||!['admin','editor','viewer'].includes(b.role)||typeof b.password!=='string'||!b.password)return c.json({error:'Preencha nome, e-mail, perfil e senha.'},400); const salt=randomHex(16),uid=id(),ts=now(),u=c.get('user'); await c.env.DB.prepare(`INSERT INTO users(id,name,email,password_hash,password_salt,role,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(uid,b.name,String(b.email).toLowerCase(),await hashPassword(b.password,salt),salt,b.role,ts,ts).run(); await audit(c.env.DB,u.id,'users',uid,'create',null,{name:b.name,email:b.email,role:b.role}); return c.json({ok:true},201); });
app.post('/api/trash/:module/:id/restore', requireRole('admin'), async c => { const spec=specs[c.req.param('module')]; if(!spec)return c.json({error:'Módulo inválido.'},400); const rid=c.req.param('id'),u=c.get('user'),before=await c.env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id=? AND deleted_at IS NOT NULL`).bind(rid).first<any>(); if(!before)return c.json({error:'Registro não encontrado na lixeira.'},404); await c.env.DB.prepare(`UPDATE ${spec.table} SET deleted_at=NULL,updated_at=?,updated_by=?,version=version+1 WHERE id=?`).bind(now(),u.id,rid).run(); await audit(c.env.DB,u.id,spec.module,rid,'restore',before,{...before,deleted_at:null}); return c.json({ok:true}); });

app.notFound(c => c.req.path.startsWith('/api/') ? c.json({ error: 'Rota não encontrada.' }, 404) : c.env.ASSETS.fetch(c.req.raw));
app.onError((err,c) => { console.error(err); return c.json({error:'Não foi possível concluir a operação.'},500); });
export default app;
