// Monta caminhos respeitando a base de publicação (raiz "/" em produção;
// subpasta, como "/cadastro-membros/", na demonstração do GitHub Pages).
export const BASE = import.meta.env.BASE_URL || '/';
export const caminho = (p = '') => BASE + String(p).replace(/^\/+/, '');
