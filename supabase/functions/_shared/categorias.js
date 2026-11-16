import { DIVISOES_IDADE, FAIXAS_POR_DIVISAO, PESOS, grupoPeso, NOME_FAIXA, IDADE_MIN_PRETA } from './tabelas.js';

export const ANO_EVENTO = 2026;
export const PRECO_ITEM = 20;
const MODALIDADES = { gi: 'Gi', nogi: 'No-Gi' };
const SEXOS = { M: 'Masculino', F: 'Feminino' };

export const idade = nascimentoISO => ANO_EVENTO - Number(String(nascimentoISO).slice(0, 4));

export function divisaoIdade(nascimentoISO) {
  const i = idade(nascimentoISO);
  return DIVISOES_IDADE.find(d => i >= d.min && i <= d.max)?.id ?? null;
}

export const faixasPermitidas = divisaoId => FAIXAS_POR_DIVISAO[divisaoId] ?? [];
export const pesosDisponiveis = (modalidade, sexo, divisaoId) => PESOS[modalidade]?.[sexo]?.[grupoPeso(divisaoId, sexo)] ?? [];
export const podeAbsoluto = divisaoId => (DIVISOES_IDADE.find(d => d.id === divisaoId)?.min ?? 0) >= 16;

export function chaveCategoria({ modalidade, tipo, sexo, divisaoId, faixa, pesoId }) {
  const base = [modalidade, tipo, sexo, divisaoId, faixa];
  return (tipo === 'peso' ? [...base, pesoId] : base).join('|');
}

export function parseChave(chave) {
  const [modalidade, tipo, sexo, divisaoId, faixa, pesoId] = chave.split('|');
  return tipo === 'peso' ? { modalidade, tipo, sexo, divisaoId, faixa, pesoId } : { modalidade, tipo, sexo, divisaoId, faixa };
}

const fmtKg = n => String(n).replace('.', ',');

export function rotuloCategoria(chave) {
  const c = parseChave(chave);
  const div = DIVISOES_IDADE.find(d => d.id === c.divisaoId)?.nome ?? c.divisaoId;
  const partes = [MODALIDADES[c.modalidade], SEXOS[c.sexo], div, NOME_FAIXA[c.faixa]];
  if (c.tipo === 'absoluto') return [...partes, 'Absoluto'].join(' · ');
  const tabela = pesosDisponiveis(c.modalidade, c.sexo, c.divisaoId);
  const i = tabela.findIndex(p => p.id === c.pesoId);
  const p = tabela[i];
  const limite = p.max != null ? `até ${fmtKg(p.max)} kg` : `acima de ${fmtKg(tabela[i - 1].max)} kg`;
  return [...partes, `${p.nome} (${limite})`].join(' · ');
}

// Erros em português; lista vazia = ok. `pesosJaConfirmados`: modalidades em que o atleta já tem peso confirmado.
export function validarItens(atleta, itens, { pesosJaConfirmados = [] } = {}) {
  const erros = [];
  const div = divisaoIdade(atleta.nascimento);
  if (!div) return ['Idade fora das categorias do campeonato (mínimo 4 anos no ano de 2026).'];
  if (!Object.hasOwn(SEXOS, atleta.sexo)) return ['Sexo inválido.'];
  if (itens.some(it => !Object.hasOwn(MODALIDADES, it.modalidade) || !['peso', 'absoluto'].includes(it.tipo)))
    return ['Modalidade inválida.'];
  if (!itens.length) erros.push('Escolha pelo menos uma modalidade.');
  const faixaOk = faixasPermitidas(div).includes(atleta.faixa) && !(atleta.faixa === 'preta' && idade(atleta.nascimento) < IDADE_MIN_PRETA);
  if (!faixaOk) erros.push('Faixa não permitida para a idade do atleta.');
  const vistos = new Set();
  for (const it of itens) {
    const k = `${it.modalidade}|${it.tipo}`;
    if (vistos.has(k)) erros.push(`Mais de uma inscrição de ${it.tipo === 'peso' ? 'peso' : 'absoluto'} em ${MODALIDADES[it.modalidade]}.`);
    vistos.add(k);
    if (it.tipo === 'peso' && !pesosDisponiveis(it.modalidade, atleta.sexo, div).some(p => p.id === it.pesoId))
      erros.push(`Categoria de peso inválida em ${MODALIDADES[it.modalidade]}.`);
    if (it.tipo === 'absoluto') {
      if (!podeAbsoluto(div)) erros.push('Absoluto é só para atletas a partir de 16 anos.');
      else if (!itens.some(o => o.tipo === 'peso' && o.modalidade === it.modalidade) && !pesosJaConfirmados.includes(it.modalidade))
        erros.push(`Para o Absoluto ${MODALIDADES[it.modalidade]} é preciso estar inscrito no peso do ${MODALIDADES[it.modalidade]}.`);
    }
  }
  return erros;
}

export const totalPedido = itens => itens.length * PRECO_ITEM;

export const normalizarNome = nome => String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const chaveDuplicidade = (nome, nascimento, modalidade, tipo) => [normalizarNome(nome), nascimento, modalidade, tipo].join('|');
