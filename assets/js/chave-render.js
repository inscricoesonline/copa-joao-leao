// Desenho de chaves (usado na página pública e no painel).
import { esc } from './supa.js';
import { METODOS } from '../../supabase/functions/_shared/resultados.js';

export const hashTexto = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0; return h; };

export function formatoDe(lutas) {
  if (!lutas.length) return 'unico';
  if (lutas.some(l => l.ref === 'L1')) return 'trio';
  return lutas.length === 1 ? 'dupla' : 'eliminatoria';
}

const NOMES_RODADA = (r, total) => r === total ? 'Final' : r === total - 1 ? 'Semifinal' : r === total - 2 ? 'Quartas' : `Rodada ${r}`;

function atletaHtml(id, luta, pessoas) {
  if (!id) return `<div class="at vazio">${luta.metodo === 'bye' ? '—' : 'A definir'}</div>`;
  const p = pessoas[id] ?? { nome: 'Atleta retirado', academia: '' };
  const venceu = luta.vencedor === id;
  return `<div class="at${venceu ? ' venc' : luta.vencedor ? ' perd' : ''}"><b>${esc(p.nome)}</b><small>${esc(p.academia)}</small></div>`;
}

function lutaHtml(l, pessoas, titulo) {
  const met = l.vencedor && l.metodo && l.metodo !== 'bye' ? `<span class="met">${esc(METODOS[l.metodo] ?? l.metodo)}</span>` : '';
  const tat = l.tatame && !l.vencedor ? `<span class="met">Tatame ${l.tatame}${l.ordem_tatame ? ' · nº ' + l.ordem_tatame : ''}</span>` : '';
  return `<div class="luta${l.metodo === 'bye' ? ' bye' : ''}">${titulo ? `<div class="lt">${esc(titulo)}</div>` : ''}${atletaHtml(l.a1, l, pessoas)}${atletaHtml(l.a2, l, pessoas)}${met}${tat}</div>`;
}

// chave: { formato, lutas }, pessoas: { id: {nome, academia} }
export function chaveHtml(chave, pessoas, { unicoId } = {}) {
  const { formato, lutas } = chave;
  if (formato === 'unico') {
    const p = pessoas[unicoId];
    return `<p class="muted">Apenas 1 atleta inscrito${p ? `: <b>${esc(p.nome)}</b> (${esc(p.academia)})` : ''}.</p>`;
  }
  if (formato === 'trio') {
    const g = r => lutas.find(l => l.ref === r);
    return `<div class="rodadas">${lutaHtml(g('L1'), pessoas, 'Luta 1')}${lutaHtml(g('L2'), pessoas, 'Final (ouro)')}${lutaHtml(g('L3'), pessoas, 'Prata / bronze')}</div>`;
  }
  const total = Math.max(...lutas.map(l => l.rodada));
  let html = '<div class="rodadas">';
  for (let r = 1; r <= total; r++) {
    const daRodada = lutas.filter(l => l.rodada === r).sort((a, b) => a.posicao - b.posicao);
    html += `<div class="rodada"><div class="rt">${NOMES_RODADA(r, total)}</div>${daRodada.map(l => lutaHtml(l, pessoas)).join('')}</div>`;
  }
  return html + '</div>';
}

export function podioHtml(p, pessoas) {
  if (!p) return '';
  const n = id => (id && pessoas[id] ? `${esc(pessoas[id].nome)} <small>${esc(pessoas[id].academia)}</small>` : '—');
  return `<div class="podio"><div>🥇 ${n(p.ouro)}</div>${p.prata ? `<div>🥈 ${n(p.prata)}</div>` : ''}${p.bronzes.map(b => `<div>🥉 ${n(b)}</div>`).join('')}</div>`;
}

export const CSS_CHAVE = `
.rodadas { display: flex; gap: 14px; overflow-x: auto; padding: 6px 2px 10px; -webkit-overflow-scrolling: touch; }
.rodada { display: flex; flex-direction: column; justify-content: space-around; gap: 10px; min-width: 210px; }
.rt { font-family: var(--titulo); text-transform: uppercase; color: var(--cinza); font-size: .9rem; }
.luta { background: var(--preto); border: 1px solid var(--linha); border-radius: 8px; overflow: hidden; min-width: 210px; }
.luta.bye { opacity: .6; }
.lt { font-size: .75rem; text-transform: uppercase; font-weight: 700; color: var(--dourado); padding: 4px 8px; background: var(--preto3); }
.at { padding: 6px 8px; border-bottom: 1px solid var(--preto3); line-height: 1.2; }
.at small { display: block; color: var(--cinza); font-size: .75rem; }
.at.venc { background: rgba(242,181,29,.15); border-left: 3px solid var(--dourado); }
.at.venc b { color: var(--dourado); }
.at.perd { opacity: .55; }
.at.vazio { color: #777; font-style: italic; }
.met { display: block; font-size: .72rem; color: var(--cinza); padding: 3px 8px; }
.podio { display: grid; gap: 4px; margin-top: 8px; padding: 10px; background: var(--preto); border: 1px solid var(--dourado2); border-radius: 8px; }
.podio small { color: var(--cinza); }`;
