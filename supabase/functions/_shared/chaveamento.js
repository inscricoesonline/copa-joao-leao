// Geração de chave (IBJJF: eliminatória simples; trio pela regra do campeonato).
// Separação por academia: distribuição recursiva por metades — colegas de equipe ficam o mais longe possível.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar(lista, r) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const luta = (o) => ({ a1: null, a2: null, vencedor: null, metodo: null, prox_venc: null, prox_perd: null, papel: 'normal', ...o });

// Distribui `lista` em P posições (null = vaga/bye), separando academias.
function dividir(lista, P, r) {
  if (P === 1) return [lista[0] ?? null];
  if (P === 2) return [lista[0] ?? null, lista[1] ?? null];
  const cap = [Math.ceil(lista.length / 2), Math.floor(lista.length / 2)];
  const metades = [[], []];
  const grupos = new Map();
  for (const a of embaralhar(lista, r)) {
    if (!grupos.has(a.academia)) grupos.set(a.academia, []);
    grupos.get(a.academia).push(a);
  }
  const ordem = [...grupos.values()].sort((x, y) => y.length - x.length);
  for (const g of ordem) {
    const conta = [0, 0];
    for (const a of g) {
      const livres = [0, 1].filter(h => metades[h].length < cap[h]);
      livres.sort((h1, h2) =>
        conta[h1] - conta[h2] ||
        (cap[h2] - metades[h2].length) - (cap[h1] - metades[h1].length) ||
        (r() < 0.5 ? -1 : 1));
      const h = livres[0];
      metades[h].push(a);
      conta[h]++;
    }
  }
  return [...dividir(metades[0], P / 2, r), ...dividir(metades[1], P / 2, r)];
}

function trio(lista, r) {
  const a = embaralhar(lista, r);
  const conta = new Map();
  for (const x of a) conta.set(x.academia, (conta.get(x.academia) ?? 0) + 1);
  // C sai de uma academia repetida, para a L1 ser entre academias diferentes.
  const iC = Math.max(0, a.findIndex(x => conta.get(x.academia) >= 2));
  const [c] = a.splice(iC, 1);
  return {
    formato: 'trio',
    lutas: [
      luta({ ref: 'L1', rodada: 1, posicao: 1, a1: a[0].inscricaoId, a2: a[1].inscricaoId, prox_venc: { ref: 'L2', slot: 1 }, prox_perd: { ref: 'L3', slot: 1 } }),
      luta({ ref: 'L2', rodada: 2, posicao: 1, a2: c.inscricaoId, papel: 'final', prox_perd: { ref: 'L3', slot: 2 } }),
      luta({ ref: 'L3', rodada: 3, posicao: 1, papel: 'disputa-prata' }),
    ],
  };
}

export function gerarChave(atletas, seed) {
  const r = rng(seed);
  const n = atletas.length;
  if (n <= 1) return { formato: 'unico', lutas: [] };
  if (n === 3) return trio(atletas, r);
  let P = 2;
  while (P < n) P *= 2;
  const slots = dividir(atletas, P, r);
  const rodadas = Math.log2(P);
  const lutas = [];
  const porRef = {};
  for (let rod = 1; rod <= rodadas; rod++) {
    const qtd = P / 2 ** rod;
    for (let pos = 1; pos <= qtd; pos++) {
      const papel = rod === rodadas ? 'final' : rod === rodadas - 1 ? 'semi' : 'normal';
      const prox_venc = rod < rodadas ? { ref: `R${rod + 1}-${Math.ceil(pos / 2)}`, slot: pos % 2 ? 1 : 2 } : null;
      const l = luta({ ref: `R${rod}-${pos}`, rodada: rod, posicao: pos, papel, prox_venc });
      if (rod === 1) {
        l.a1 = slots[2 * pos - 2]?.inscricaoId ?? null;
        l.a2 = slots[2 * pos - 1]?.inscricaoId ?? null;
      }
      lutas.push(l);
      porRef[l.ref] = l;
    }
  }
  for (const l of lutas.filter(x => x.rodada === 1 && (!x.a1 || !x.a2))) {
    l.vencedor = l.a1 ?? l.a2;
    l.metodo = 'bye';
    porRef[l.prox_venc.ref][l.prox_venc.slot === 1 ? 'a1' : 'a2'] = l.vencedor;
  }
  return { formato: n === 2 ? 'dupla' : 'eliminatoria', lutas };
}
