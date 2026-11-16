// Números de controle do evento (painel).

// Medalhas para comprar: 1 atleta = ouro; 2 = ouro+prata; 3 = ouro+prata+bronze; 4+ = ouro+prata+2 bronzes.
export function medalhasNecessarias(tamanhos) {
  const m = { ouro: 0, prata: 0, bronze: 0 };
  for (const n of tamanhos) {
    if (n >= 1) m.ouro++;
    if (n >= 2) m.prata++;
    if (n === 3) m.bronze += 1;
    if (n >= 4) m.bronze += 2;
  }
  return { ...m, total: m.ouro + m.prata + m.bronze };
}

// Lutas de uma categoria: eliminatória tem n-1; trio (regra do campeonato) tem 3.
export const numeroDeLutas = n => (n <= 1 ? 0 : n === 3 ? 3 : n - 1);

export const taxaConversao = (parte, todo) => (todo ? Math.round((parte / todo) * 1000) / 10 : 0);
