// Ordem do dia e distribuição das categorias entre os tatames.
import { parseChave } from './categorias.js';
import { DIVISOES_IDADE } from './tabelas.js';

const idxDiv = Object.fromEntries(DIVISOES_IDADE.map((d, i) => [d.id, i]));
const grupoEtario = div => (DIVISOES_IDADE.find(d => d.id === div)?.min ?? 0) <= 15 ? 0 : 1; // kids | 16+

// Ordem: kids Gi → 16+ Gi (pesos, depois absolutos) → kids No-Gi → 16+ No-Gi (pesos, depois absolutos).
// Dentro: divisão de idade crescente (kids → juvenil → adulto → master).
export function ordemCategoria(chave) {
  const c = parseChave(chave);
  return (c.modalidade === 'gi' ? 0 : 1) * 10000
    + grupoEtario(c.divisaoId) * 1000
    + (c.tipo === 'absoluto' ? 1 : 0) * 100
    + idxDiv[c.divisaoId];
}

// Guloso: na ordem do dia, cada categoria vai para o tatame com menos tempo acumulado.
export function distribuirTatames(cats, nTatames = 2) {
  const tempo = Array(nTatames).fill(0);
  const res = {};
  const ordenadas = [...cats].sort((a, b) => ordemCategoria(a.chave) - ordemCategoria(b.chave));
  for (const c of ordenadas) {
    const t = tempo.indexOf(Math.min(...tempo));
    res[c.chave] = t + 1;
    tempo[t] += c.numLutas * c.minutos;
  }
  return res;
}

// Fila de um tatame: categorias na ordem dada; dentro, rodada a rodada. Lutas "bye" não entram.
// Se a próxima luta repetir atleta da luta anterior, puxa a primeira luta seguinte sem repetição.
export function filaTatame(lutasPorCat, ordemCats) {
  const pend = [];
  for (const cat of ordemCats)
    for (const l of [...(lutasPorCat[cat] ?? [])].sort((a, b) => a.rodada - b.rodada || (a.posicao ?? 0) - (b.posicao ?? 0)))
      if (l.metodo !== 'bye') pend.push({ ...l, chaveCat: cat });
  const fila = [];
  const atletas = l => [l.a1, l.a2].filter(Boolean);
  while (pend.length) {
    const ant = fila.at(-1);
    // Conflito = repete atleta da luta anterior, ou é rodada seguinte da mesma categoria (o vencedor acabou de lutar).
    const conflita = l => ant && (atletas(l).some(a => atletas(ant).includes(a)) || (l.chaveCat === ant.chaveCat && l.rodada > ant.rodada));
    const j = conflita(pend[0]) ? pend.findIndex(l => !conflita(l)) : 0;
    const i = j > 0 ? j : 0;
    const [l] = pend.splice(i, 1);
    fila.push(l);
  }
  return fila.map((l, i) => ({ ref: l.ref, chaveCat: l.chaveCat, ordem: i + 1 }));
}
