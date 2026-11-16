// Tabelas oficiais IBJJF/CBJJ usadas pela III Copa João Leão.
// Fontes (consultadas em 16/11/2026):
// - Idades e tempos de luta: IBJJF Rule Book v6.1 (2024), "Article 1 – Divisions and regulation match durations".
// - Faixas por idade: IBJJF Graduation System (2026-06-11), "Article 2 – Minimum ages".
// - Pesos Gi adulto/master/juvenil: IBJJF "tabela-gi-kg-majors.pdf".
// - Pesos kids: IBJJF "2025 KIDS WEIGHT LIST" (libras, com kimono) convertido para kg (1 casa decimal).
// - Pesos No-Gi adulto/master: tabela IBJJF No-Gi (kg).
// - No-Gi juvenil e kids: SEM tabela oficial localizada — ver comentário em PESOS.nogi.

export const DIVISOES_IDADE = [
  { id: 'pre-mirim-1', nome: 'Pré-Mirim 1', min: 4, max: 4 },
  { id: 'pre-mirim-2', nome: 'Pré-Mirim 2', min: 5, max: 5 },
  { id: 'pre-mirim-3', nome: 'Pré-Mirim 3', min: 6, max: 6 },
  { id: 'mirim-1', nome: 'Mirim 1', min: 7, max: 7 },
  { id: 'mirim-2', nome: 'Mirim 2', min: 8, max: 8 },
  { id: 'mirim-3', nome: 'Mirim 3', min: 9, max: 9 },
  { id: 'infantil-1', nome: 'Infantil 1', min: 10, max: 10 },
  { id: 'infantil-2', nome: 'Infantil 2', min: 11, max: 11 },
  { id: 'infantil-3', nome: 'Infantil 3', min: 12, max: 12 },
  { id: 'infanto-1', nome: 'Infanto-Juvenil 1', min: 13, max: 13 },
  { id: 'infanto-2', nome: 'Infanto-Juvenil 2', min: 14, max: 14 },
  { id: 'infanto-3', nome: 'Infanto-Juvenil 3', min: 15, max: 15 },
  { id: 'juvenil-1', nome: 'Juvenil 1', min: 16, max: 16 },
  { id: 'juvenil-2', nome: 'Juvenil 2', min: 17, max: 17 },
  { id: 'adulto', nome: 'Adulto', min: 18, max: 29 },
  { id: 'master-1', nome: 'Master 1', min: 30, max: 35 },
  { id: 'master-2', nome: 'Master 2', min: 36, max: 40 },
  { id: 'master-3', nome: 'Master 3', min: 41, max: 45 },
  { id: 'master-4', nome: 'Master 4', min: 46, max: 50 },
  { id: 'master-5', nome: 'Master 5', min: 51, max: 55 },
  { id: 'master-6', nome: 'Master 6', min: 56, max: 60 },
  { id: 'master-7', nome: 'Master 7', min: 61, max: 99 },
];

export const FAIXAS = ['branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta'];
export const NOME_FAIXA = {
  branca: 'Branca', cinza: 'Cinza', amarela: 'Amarela', laranja: 'Laranja', verde: 'Verde',
  azul: 'Azul', roxa: 'Roxa', marrom: 'Marrom', preta: 'Preta',
};

// Kids: cinza 4–15, amarela 7–15, laranja 10–15, verde 13–15 (cada cor inclui as variações branca/preta).
// 16–17: branca, azul, roxa. Adulto/master: marrom a partir de 18; preta a partir de 19 (18 só para campeão mundial marrom).
function faixasPara(idade) {
  if (idade <= 15) {
    const f = ['branca', 'cinza'];
    if (idade >= 7) f.push('amarela');
    if (idade >= 10) f.push('laranja');
    if (idade >= 13) f.push('verde');
    return f;
  }
  if (idade <= 17) return ['branca', 'azul', 'roxa'];
  return ['branca', 'azul', 'roxa', 'marrom', 'preta'];
}
export const FAIXAS_POR_DIVISAO = Object.fromEntries(DIVISOES_IDADE.map(d => [d.id, faixasPara(d.min)]));
export const IDADE_MIN_PRETA = 19;

const IDS = ['galo', 'pluma', 'pena', 'leve', 'medio', 'meio-pesado', 'pesado', 'super-pesado', 'pesadissimo'];
const NOMES = {
  galo: 'Galo', pluma: 'Pluma', pena: 'Pena', leve: 'Leve', medio: 'Médio', 'meio-pesado': 'Meio-Pesado',
  pesado: 'Pesado', 'super-pesado': 'Super-Pesado', pesadissimo: 'Pesadíssimo',
};
const tabela = maxs => maxs.map((max, i) => ({ id: IDS[i], nome: NOMES[IDS[i]], max }));
const kg = lbs => Math.round(lbs * 0.45359237 * 10) / 10;

// Kids (unissex), colunas por idade 4..15 — libras, com kimono.
const KIDS_LBS = [
  [26.0, 32.6, 39.6, 40.0, 46.6, 53.0, 60.0, 67.0, 71.0, 80.0, 89.0, 98.0],
  [32.6, 39.6, 42.0, 46.6, 53.0, 60.0, 67.0, 73.6, 80.0, 89.0, 98.0, 106.6],
  [40.0, 44.6, 48.6, 53.0, 60.0, 67.0, 73.6, 80.0, 89.0, 98.0, 106.6, 116.0],
  [46.6, 53.0, 55.6, 60.0, 67.0, 73.6, 80.0, 87.0, 98.0, 106.6, 116.0, 125.0],
  [53.0, 57.6, 62.0, 67.0, 73.6, 80.0, 87.0, 93.6, 106.6, 116.0, 125.0, 133.6],
  [60.0, 64.0, 69.0, 73.6, 80.0, 87.0, 93.6, 100.0, 116.0, 125.0, 133.6, 143.6],
  [66.6, 71.0, 75.6, 80.0, 87.0, 93.6, 100.0, 106.6, 125.0, 133.6, 143.6, 152.6],
  [73.0, 77.6, 82.6, 87.0, 93.6, 100.0, 106.6, 114.0, 133.6, 143.6, 152.6, 161.0],
];
const KIDS = Object.fromEntries(DIVISOES_IDADE.filter(d => d.min <= 15).map(d => {
  const col = d.min - 4;
  return [d.id, tabela([...KIDS_LBS.map(linha => kg(linha[col])), null])];
}));

const GI = {
  M: {
    ...KIDS,
    'juvenil-1': tabela([48.5, 53.5, 58.5, 64.0, 69.0, 74.0, 79.3, 84.3, null]),
    'juvenil-2': tabela([53.5, 58.5, 64.0, 69.0, 74.0, 79.3, 84.3, 89.3, null]),
    adulto: tabela([57.5, 64.0, 70.0, 76.0, 82.3, 88.3, 94.3, 100.5, null]),
  },
  F: {
    ...KIDS,
    juvenil: tabela([44.3, 48.3, 52.5, 56.5, 60.5, 65.0, 69.0, null]),
    adulto: tabela([48.5, 53.5, 58.5, 64.0, 69.0, 74.0, 79.3, null]),
  },
};

// No-Gi: adulto/master pela tabela IBJJF No-Gi.
// Juvenil: sem tabela oficial localizada → tabela Gi juvenil menos 2,0 kg (mesma diferença média Gi→No-Gi do adulto).
// Kids: sem tabela oficial localizada → mesma tabela kids (a lista kids já usa kimono leve "single weave").
const menos2 = t => t.map(p => ({ ...p, max: p.max == null ? null : Math.round((p.max - 2) * 10) / 10 }));
const NOGI = {
  M: {
    ...KIDS,
    'juvenil-1': menos2(GI.M['juvenil-1']),
    'juvenil-2': menos2(GI.M['juvenil-2']),
    adulto: tabela([55.5, 61.5, 67.5, 73.5, 79.5, 85.5, 91.5, 97.5, null]),
  },
  F: {
    ...KIDS,
    juvenil: menos2(GI.F.juvenil),
    adulto: tabela([46.5, 51.5, 56.5, 61.5, 66.5, 71.5, 76.5, null]),
  },
};

export const PESOS = { gi: GI, nogi: NOGI };

export function grupoPeso(divisaoId, sexo) {
  if (divisaoId === 'adulto' || divisaoId.startsWith('master')) return 'adulto';
  if (divisaoId.startsWith('juvenil')) return sexo === 'F' ? 'juvenil' : divisaoId;
  return divisaoId;
}

// Minutos por luta (IBJJF Rule Book, Art. 1).
export function TEMPO_LUTA_MIN(divisaoId, faixa) {
  if (divisaoId.startsWith('pre-mirim')) return 2;
  if (divisaoId.startsWith('mirim')) return 3;
  if (divisaoId.startsWith('infantil') || divisaoId.startsWith('infanto')) return 4;
  if (divisaoId.startsWith('juvenil')) return 5;
  if (divisaoId === 'adulto') return { branca: 5, azul: 6, roxa: 7, marrom: 8, preta: 10 }[faixa];
  if (divisaoId === 'master-1') return ['branca', 'azul'].includes(faixa) ? 5 : 6;
  return 5;
}
