import { supa, $, $$, esc } from './supa.js';
import { chaveHtml, podioHtml, formatoDe, hashTexto, CSS_CHAVE } from './chave-render.js';
import { DIVISOES_IDADE, NOME_FAIXA } from '../../supabase/functions/_shared/tabelas.js';
import { parseChave, rotuloCategoria, normalizarNome } from '../../supabase/functions/_shared/categorias.js';
import { gerarChave } from '../../supabase/functions/_shared/chaveamento.js';
import { podio, pontosEquipe } from '../../supabase/functions/_shared/resultados.js';
import { ordemCategoria } from '../../supabase/functions/_shared/agenda.js';

$('#cssChave').textContent = CSS_CHAVE;
$('#fDiv').innerHTML += DIVISOES_IDADE.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
$('#fFaixa').innerHTML += Object.entries(NOME_FAIXA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

let dados = null;     // { fase, cats: [{chave, rotulo, chave: {formato,lutas}, unicoId, podio}], pessoas }
const abertos = new Set();

async function carregar() {
  const { data: cfg } = await supa.from('v_publico_config').select('fase').maybeSingle();
  const fase = cfg?.fase ?? 'inscricoes';
  const { data: insc } = await supa.from('v_publico_inscritos').select('inscricao_id, nome, academia, faixa, categoria');
  const pessoas = Object.fromEntries((insc ?? []).map(i => [i.inscricao_id, i]));
  const porCat = {};
  for (const i of insc ?? []) (porCat[i.categoria] ??= []).push(i);
  let cats;
  if (['inscricoes', 'revisao'].includes(fase)) {
    cats = Object.entries(porCat).map(([chave, ats]) => {
      const lista = [...ats].sort((a, b) => a.inscricao_id.localeCompare(b.inscricao_id))
        .map(a => ({ inscricaoId: a.inscricao_id, nome: a.nome, academia: a.academia }));
      return { chave, rotulo: rotuloCategoria(chave), ch: gerarChave(lista, hashTexto(chave)), unicoId: lista[0]?.inscricaoId, ids: lista.map(a => a.inscricaoId) };
    });
  } else {
    const [{ data: cs }, { data: ls }] = await Promise.all([
      supa.from('v_publico_categorias').select('*'),
      supa.from('v_publico_lutas').select('*'),
    ]);
    const lutasPor = {};
    for (const l of ls ?? []) (lutasPor[l.categoria] ??= []).push(l);
    cats = (cs ?? []).map(c => {
      const lutas = lutasPor[c.chave] ?? [];
      const ch = { formato: formatoDe(lutas), lutas };
      const ids = lutas.length ? [...new Set(lutas.flatMap(l => [l.a1, l.a2]).filter(Boolean))] : (porCat[c.chave] ?? []).map(a => a.inscricao_id);
      const unicoId = ch.formato === 'unico' ? ids[0] : undefined;
      return { chave: c.chave, rotulo: c.rotulo, ch, unicoId, ids, tatame: c.tatame, podio: podio({ ...ch, unicoId }) };
    });
  }
  cats.sort((a, b) => ordemCategoria(a.chave) - ordemCategoria(b.chave) || a.chave.localeCompare(b.chave));
  dados = { fase, cats, pessoas };
  // academias no filtro
  const acads = [...new Set((insc ?? []).map(i => i.academia))].sort();
  const sel = $('#fAcad'), v = sel.value;
  sel.innerHTML = '<option value="">Todas as academias</option>' + acads.map(a => `<option>${esc(a)}</option>`).join('');
  sel.value = v;
  desenhar();
}

function desenhar() {
  const { fase, cats, pessoas } = dados;
  const previa = ['inscricoes', 'revisao'].includes(fase);
  $('#aviso').innerHTML = previa
    ? `<span class="selo previa">Prévia — pode mudar até 03/12</span> <span class="muted">Aparecem só inscrições pagas. A chave oficial sai em 03/12.</span>`
    : fase === 'evento' ? `<span class="selo vivo">Ao vivo</span> <span class="muted">Atualiza sozinho a cada 10 segundos.</span>`
    : `<span class="selo">Chave oficial</span>`;
  // agora/próxima por tatame
  if (!previa) {
    const todas = cats.flatMap(c => c.ch.lutas.map(l => ({ ...l, rotulo: c.rotulo })));
    $('#agora').innerHTML = [1, 2].map(t => {
      const fila = todas.filter(l => l.tatame === t && !l.vencedor && l.metodo !== 'bye').sort((a, b) => a.ordem_tatame - b.ordem_tatame);
      const nome = id => (id && pessoas[id] ? esc(pessoas[id].nome) : 'a definir');
      const linha = (l, tit) => l ? `<p><b>${tit}:</b> ${nome(l.a1)} × ${nome(l.a2)}<br><small class="muted">${esc(l.rotulo)}</small></p>` : '';
      return `<div class="card"><h3>Tatame ${t}</h3>${fila.length ? linha(fila[0], 'Agora') + linha(fila[1], 'Próxima') : '<p class="muted">Sem lutas pendentes.</p>'}</div>`;
    }).join('');
  } else $('#agora').innerHTML = '';

  const f = { busca: normalizarNome($('#fBusca').value), mod: $('#fMod').value, sexo: $('#fSexo').value, div: $('#fDiv').value, faixa: $('#fFaixa').value, acad: $('#fAcad').value };
  const visiveis = cats.filter(c => {
    const p = parseChave(c.chave);
    if (f.mod && p.modalidade !== f.mod) return false;
    if (f.sexo && p.sexo !== f.sexo) return false;
    if (f.div && p.divisaoId !== f.div) return false;
    if (f.faixa && p.faixa !== f.faixa) return false;
    if (f.acad && !c.ids.some(id => pessoas[id]?.academia === f.acad)) return false;
    if (f.busca && !c.ids.some(id => normalizarNome(pessoas[id]?.nome ?? '').includes(f.busca))) return false;
    return true;
  });
  const abrir = f.busca || f.acad || visiveis.length <= 3;
  $('#lista').innerHTML = visiveis.length ? visiveis.map(c => `
    <details class="cat" data-chave="${esc(c.chave)}" ${abrir || abertos.has(c.chave) ? 'open' : ''}>
      <summary>${esc(c.rotulo)} <span class="qtd">${c.ids.length} atleta(s)${c.tatame ? ' · Tatame ' + c.tatame : ''}</span>${c.podio && c.ch.formato !== 'unico' ? ' <span class="selo">Encerrada</span>' : ''}</summary>
      <div class="corpo">${chaveHtml(c.ch, pessoas, { unicoId: c.unicoId })}${previa ? '' : podioHtml(c.podio, pessoas)}</div>
    </details>`).join('') : `<p class="muted">${cats.length ? 'Nenhuma categoria com esses filtros.' : 'Ainda não há inscrições confirmadas.'}</p>`;
  $$('details.cat').forEach(d => d.addEventListener('toggle', () => d.open ? abertos.add(d.dataset.chave) : abertos.delete(d.dataset.chave)));

  const ranking = pontosEquipe(cats.map(c => ({ podio: c.podio, academiaDe: id => pessoas[id]?.academia ?? '?', unico: c.ch.formato === 'unico' })));
  $('#tabEquipes').innerHTML = '<tr><th>#</th><th>Academia</th><th>Pontos</th><th>🥇</th><th>🥈</th><th>🥉</th></tr>' +
    (ranking.length ? ranking.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.academia)}</td><td><b>${r.pontos}</b></td><td>${r.ouros}</td><td>${r.pratas}</td><td>${r.bronzes}</td></tr>`).join('')
      : '<tr><td colspan="6" class="muted">O ranking aparece conforme as categorias terminam.</td></tr>');
}

for (const id of ['fBusca', 'fMod', 'fSexo', 'fDiv', 'fFaixa', 'fAcad']) $('#' + id).addEventListener('input', () => dados && desenhar());
$('#abas').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#abas button').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('#vChaves').classList.toggle('oculto', b.dataset.aba !== 'chaves');
  $('#vEquipes').classList.toggle('oculto', b.dataset.aba !== 'equipes');
};

carregar().catch(() => ($('#lista').innerHTML = '<p class="erro">Não foi possível carregar. Verifique a internet.</p>'));
setInterval(() => { if (!document.hidden) carregar().catch(() => {}); }, 10000);
