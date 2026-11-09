// MODO DEMONSTRAÇÃO: imita o subconjunto do cliente Supabase usado pelo painel,
// aplicando as mesmas regras do banco (status inicial, campos imutáveis,
// auditoria, papéis). Não entra no build de produção.
import {
  banco, salvar, auditar, nomeBusca, USUARIOS_DEMO, fotoIlustrativa, dataUrlParaBlob, blobParaDataUrl,
} from './dados-demo.js';

const SESSAO = 'demo-setor46-sessao';
const ouvintes = new Set();

const erro = (message) => ({ message });
const normal = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ehData = (c) => /_at$|^data_|_data$/.test(c);

function sessaoAtual() {
  try { return JSON.parse(sessionStorage.getItem(SESSAO) || 'null'); } catch { return null; }
}
function usuarioAtual() {
  const s = sessaoAtual();
  return s ? USUARIOS_DEMO.find((u) => u.user_id === s.user.id) : null;
}

function comparar(a, b, coluna) {
  if (ehData(coluna) && a && b && (String(a).includes('T') || String(b).includes('T'))) {
    return new Date(a) - new Date(b);
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

class Consulta {
  constructor(tabela) {
    this.tabela = tabela;
    this.filtros = [];
    this.op = 'select';
    this.colunas = '*';
    this.opcoes = {};
  }

  select(colunas = '*', opcoes = {}) { if (this.op === 'select') { this.colunas = colunas; this.opcoes = opcoes; } else this.retornar = true; return this; }
  insert(v) { this.op = 'insert'; this.valor = v; return this; }
  update(v) { this.op = 'update'; this.valor = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filtros.push((r) => String(r[c]) === String(v)); return this; }
  neq(c, v) { this.filtros.push((r) => String(r[c]) !== String(v)); return this; }
  in(c, l) { this.filtros.push((r) => l.map(String).includes(String(r[c]))); return this; }
  gte(c, v) { this.filtros.push((r) => r[c] != null && comparar(r[c], v, c) >= 0); return this; }
  lt(c, v) { this.filtros.push((r) => r[c] != null && comparar(r[c], v, c) < 0); return this; }
  like(c, p) { const re = new RegExp(`^${p.split('%').map(esc).join('.*')}$`); this.filtros.push((r) => re.test(String(r[c] ?? ''))); return this; }
  ilike(c, p) { const re = new RegExp(`^${p.split('%').map(esc).join('.*')}$`, 'i'); this.filtros.push((r) => re.test(String(r[c] ?? ''))); return this; }
  order(c, { ascending = true } = {}) { this.ordem = { c, ascending }; return this; }
  range(a, b) { this.intervalo = [a, b]; return this; }
  limit(n) { this.limite = n; return this; }
  maybeSingle() { this.unico = 'talvez'; return this; }
  single() { this.unico = 'um'; return this; }
  then(ok, falha) { return this.executar().then(ok, falha); }

  async executar() {
    const u = usuarioAtual();
    if (!u) return { data: null, error: erro('permission denied: sessão encerrada'), count: null };
    const db = banco();
    const linhas = db[this.tabela];
    if (!linhas) return { data: null, error: erro(`tabela ${this.tabela} inexistente`) };
    if (this.tabela === 'auditoria' && u.papel !== 'admin') return { data: [], error: null };
    const alvo = linhas.filter((r) => this.filtros.every((f) => f(r)));

    if (this.op === 'insert') return this.inserir(db, u);
    if (this.op === 'update') return this.atualizar(db, u, alvo);
    if (this.op === 'delete') return { data: null, error: erro('permission denied: exclusão direta não permitida') };

    let res = [...alvo];
    if (this.ordem) {
      const { c, ascending } = this.ordem;
      res.sort((a, b) => comparar(a[c] ?? '', b[c] ?? '', c) * (ascending ? 1 : -1));
    }
    const count = res.length;
    if (this.intervalo) res = res.slice(this.intervalo[0], this.intervalo[1] + 1);
    if (this.limite) res = res.slice(0, this.limite);
    if (this.colunas.includes('congregacoes(')) {
      res = res.map((r) => ({ ...r, congregacoes: { nome: db.congregacoes.find((g) => g.id === r.congregacao_id)?.nome || '' } }));
    }
    res = res.map((r) => structuredClone(r));
    if (this.opcoes.head) return { data: null, count, error: null };
    if (this.unico) {
      if (this.unico === 'um' && res.length !== 1) return { data: null, error: erro('Registro não encontrado') };
      return { data: res[0] || null, error: null };
    }
    return { data: res, count: this.opcoes.count ? count : null, error: null };
  }

  inserir(db) {
    if (this.tabela !== 'congregacoes') return { data: null, error: erro('permission denied') };
    const v = this.valor;
    if (db.congregacoes.some((g) => normal(g.nome) === normal(v.nome))) return { data: null, error: erro('duplicate key value violates unique constraint "congregacoes_nome_unico"') };
    const agora = new Date().toISOString();
    const nova = { id: db.proximo.congregacao++, ativa: true, endereco: null, cidade: null, dirigente: null, ...v, created_at: agora, updated_at: agora };
    db.congregacoes.push(nova);
    salvar();
    return { data: this.retornar ? [nova] : null, error: null };
  }

  atualizar(db, u, alvo) {
    const tab = this.tabela;
    if (tab === 'configuracoes' && u.papel !== 'admin') return { data: [], error: null };
    if (!['cadastros', 'congregacoes', 'configuracoes'].includes(tab)) return { data: null, error: erro('permission denied') };
    const agora = new Date().toISOString();
    for (const r of alvo) {
      const antes = { ...r };
      const v = { ...this.valor };
      if (tab === 'cadastros') {
        for (const k of ['id', 'protocolo', 'created_at', 'consentimento_lgpd', 'consentimento_em', 'consentimento_versao', 'consentimento_responsavel', 'aprovado_em', 'aprovado_por']) delete v[k];
      }
      Object.assign(r, v, { updated_at: agora });
      if (tab === 'cadastros') {
        r.updated_by = u.user_id;
        r.nome_busca = nomeBusca(r.nome);
        if (r.status !== antes.status) {
          r.aprovado_em = r.status === 'APROVADO' ? agora : null;
          r.aprovado_por = r.status === 'APROVADO' ? u.user_id : null;
          auditar(r.status === 'APROVADO' ? 'cadastro_aprovado' : 'cadastro_marcado_pendente', r.id, { protocolo: r.protocolo }, u.email);
        }
        const campos = Object.keys(v).filter((k) => !['status', 'updated_at'].includes(k) && JSON.stringify(antes[k] ?? null) !== JSON.stringify(r[k] ?? null));
        if (campos.length) auditar('cadastro_editado', r.id, { protocolo: r.protocolo, campos }, u.email);
      }
    }
    salvar();
    return { data: this.retornar ? structuredClone(alvo) : null, error: null };
  }
}

function resumo() {
  const db = banco();
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const c = db.cadastros;
  return {
    total: c.length,
    pendentes: c.filter((x) => x.status === 'PENDENTE').length,
    aprovados: c.filter((x) => x.status === 'APROVADO').length,
    mes_atual: c.filter((x) => new Date(x.created_at) >= inicioMes).length,
    por_congregacao: db.congregacoes.map((g) => {
      const l = c.filter((x) => x.congregacao_id === g.id);
      return {
        id: g.id, nome: g.nome, ativa: g.ativa, total: l.length, pendentes: l.filter((x) => x.status === 'PENDENTE').length, aprovados: l.filter((x) => x.status === 'APROVADO').length,
      };
    }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)),
  };
}

export function criarClienteDemo() {
  return {
    from: (tabela) => new Consulta(tabela),

    async rpc(nome, args = {}) {
      const u = usuarioAtual();
      if (!u) return { data: null, error: erro('Permissão negada.') };
      const db = banco();
      if (nome === 'dashboard_resumo') return { data: resumo(), error: null };
      if (nome === 'admin_registrar_acao') {
        auditar(args.p_acao, args.p_entidade_id || null, args.p_detalhes || {}, u.email);
        salvar();
        return { data: null, error: null };
      }
      if (nome === 'admin_excluir_cadastro') {
        if (u.papel !== 'admin') return { data: null, error: erro('Permissão negada: apenas administradores podem excluir cadastros.') };
        const i = db.cadastros.findIndex((c) => c.id === args.p_id);
        if (i < 0) return { data: null, error: erro('Cadastro não encontrado.') };
        const [c] = db.cadastros.splice(i, 1);
        delete db.fotos[c.foto_path];
        auditar('cadastro_excluido', c.id, { protocolo: c.protocolo, foto_removida: !!c.foto_path }, u.email);
        salvar();
        return { data: { protocolo: c.protocolo }, error: null };
      }
      return { data: null, error: erro(`Função ${nome} indisponível na demonstração.`) };
    },

    storage: {
      from: () => ({
        async download(caminho) {
          if (!usuarioAtual()) return { data: null, error: erro('permission denied') };
          const db = banco();
          if (db.fotos[caminho]) return { data: dataUrlParaBlob(db.fotos[caminho]), error: null };
          if (db.cadastros.some((c) => c.foto_path === caminho && c.protocolo.includes('DEMO'))) {
            return { data: await fotoIlustrativa(caminho), error: null };
          }
          return { data: null, error: erro('Object not found') };
        },
        async upload(caminho, blob) {
          if (!usuarioAtual()) return { data: null, error: erro('permission denied') };
          banco().fotos[caminho] = await blobParaDataUrl(blob);
          salvar();
          return { data: { path: caminho }, error: null };
        },
        async remove(caminhos) {
          const u = usuarioAtual();
          if (!u || u.papel !== 'admin') return { data: [], error: null };
          const db = banco();
          caminhos.forEach((c) => delete db.fotos[c]);
          salvar();
          return { data: caminhos.map((name) => ({ name })), error: null };
        },
        async createSignedUrl(caminho) {
          const r = await this.download(caminho);
          return r.error ? r : { data: { signedUrl: URL.createObjectURL(r.data) }, error: null };
        },
      }),
    },

    auth: {
      async signInWithPassword({ email, password }) {
        const u = USUARIOS_DEMO.find((x) => x.email === String(email).toLowerCase() && x.senha === password);
        if (!u) return { data: null, error: erro('Invalid login credentials') };
        const session = { user: { id: u.user_id, email: u.email }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
        sessionStorage.setItem(SESSAO, JSON.stringify(session));
        ouvintes.forEach((f) => f('SIGNED_IN', session));
        return { data: { session }, error: null };
      },
      async getSession() { return { data: { session: sessaoAtual() }, error: null }; },
      async signOut() {
        sessionStorage.removeItem(SESSAO);
        ouvintes.forEach((f) => f('SIGNED_OUT', null));
        return { error: null };
      },
      onAuthStateChange(fn) {
        ouvintes.add(fn);
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(fn) } } };
      },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser() { return { data: {}, error: null }; },
    },
  };
}
