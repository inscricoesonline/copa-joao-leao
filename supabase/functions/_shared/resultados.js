// Avanço de resultados, pódio e pontuação por equipe.
export const METODOS = { pontos: 'Pontos', finalizacao: 'Finalização', wo: 'W.O.', desclassificacao: 'Desclassificação', peso: 'Não bateu o peso', bye: 'Passou direto' };
export const PONTOS = { ouro: 9, prata: 3, bronze: 1 };

const slotKey = s => (s === 1 ? 'a1' : 'a2');
const perdedor = l => (l.vencedor ? (l.vencedor === l.a1 ? l.a2 : l.a1) : null);

export function aplicarResultado(lutas, ref, vencedorId, metodo) {
  const nova = lutas.map(l => ({ ...l }));
  const l = nova.find(x => x.ref === ref);
  if (!l) throw new Error('Luta não encontrada');
  if (vencedorId !== l.a1 && vencedorId !== l.a2) throw new Error('Vencedor não está nesta luta');
  l.vencedor = vencedorId;
  l.metodo = metodo;
  if (l.prox_venc) nova.find(x => x.ref === l.prox_venc.ref)[slotKey(l.prox_venc.slot)] = vencedorId;
  if (l.prox_perd) nova.find(x => x.ref === l.prox_perd.ref)[slotKey(l.prox_perd.slot)] = perdedor(l);
  return nova;
}

export function podeDesfazer(lutas, ref) {
  const l = lutas.find(x => x.ref === ref);
  if (!l?.vencedor || l.metodo === 'bye') return false;
  return [l.prox_venc, l.prox_perd].filter(Boolean).every(p => !lutas.find(x => x.ref === p.ref).vencedor);
}

export function desfazerResultado(lutas, ref) {
  if (!podeDesfazer(lutas, ref)) throw new Error('Não dá para desfazer: a luta seguinte já tem resultado.');
  const nova = lutas.map(l => ({ ...l }));
  const l = nova.find(x => x.ref === ref);
  for (const p of [l.prox_venc, l.prox_perd].filter(Boolean)) nova.find(x => x.ref === p.ref)[slotKey(p.slot)] = null;
  l.vencedor = null;
  l.metodo = null;
  return nova;
}

// Retorna null enquanto a categoria não terminou.
export function podio(chave) {
  const { formato, lutas } = chave;
  if (formato === 'unico') return chave.unicoId ? { ouro: chave.unicoId, prata: null, bronzes: [] } : null;
  if (lutas.some(l => !l.vencedor)) return null;
  const get = ref => lutas.find(l => l.ref === ref);
  if (formato === 'trio') {
    const l3 = get('L3');
    return { ouro: get('L2').vencedor, prata: l3.vencedor, bronzes: [perdedor(l3)] };
  }
  const final = lutas.find(l => l.papel === 'final');
  const bronzes = lutas.filter(l => l.papel === 'semi' && l.metodo !== 'bye').map(perdedor).filter(Boolean);
  return { ouro: final.vencedor, prata: perdedor(final), bronzes };
}

// itens: [{ podio, academiaDe: id => nome, unico: boolean }]. Categoria de 1 atleta não pontua (IBJJF).
export function pontosEquipe(itens) {
  const t = new Map();
  const add = (academia, campo) => {
    if (!t.has(academia)) t.set(academia, { academia, pontos: 0, ouros: 0, pratas: 0, bronzes: 0 });
    const e = t.get(academia);
    e[campo + 's']++;
    e.pontos += PONTOS[campo];
  };
  for (const { podio: p, academiaDe, unico } of itens) {
    if (!p || unico) continue;
    if (p.ouro) add(academiaDe(p.ouro), 'ouro');
    if (p.prata) add(academiaDe(p.prata), 'prata');
    for (const b of p.bronzes) add(academiaDe(b), 'bronze');
  }
  return [...t.values()].sort((a, b) => b.pontos - a.pontos || b.ouros - a.ouros || b.pratas - a.pratas);
}
