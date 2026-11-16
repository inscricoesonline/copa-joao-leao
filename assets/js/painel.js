import { supa, $, $$, esc, brl } from './supa.js';
import { chaveHtml, CSS_CHAVE } from './chave-render.js';
import { NOME_FAIXA, TEMPO_LUTA_MIN } from '../../supabase/functions/_shared/tabelas.js';
import { divisaoIdade, faixasPermitidas, pesosDisponiveis, podeAbsoluto, chaveCategoria, parseChave, rotuloCategoria, chaveDuplicidade, normalizarNome, PRECO_ITEM } from '../../supabase/functions/_shared/categorias.js';
import { gerarChave } from '../../supabase/functions/_shared/chaveamento.js';
import { ordemCategoria, distribuirTatames, filaTatame } from '../../supabase/functions/_shared/agenda.js';
import { medalhasNecessarias, numeroDeLutas, taxaConversao } from '../../supabase/functions/_shared/controle.js';

$('#cssChave').textContent = CSS_CHAVE;
const ST = { pendente: 'Aguardando pagamento', confirmada: 'Confirmada', cancelada: 'Cancelada', pago_fora_prazo: 'Pago fora do prazo' };
const FASES = { inscricoes: 'Inscrições abertas', revisao: 'Inscrições fechadas (revisão)', publicada: 'Chave oficial publicada', evento: 'Dia do evento (ao vivo)', encerrado: 'Encerrado' };
let user = null, D = { insc: [], acads: [], fase: '', cats: [], lutas: [] };

const erro = e => alert('Não foi possível: ' + (e?.message ?? e));
const chk = ({ error, data }) => { if (error) throw error; return data; };

// ---------- login ----------
$('#login').addEventListener('submit', async ev => {
  ev.preventDefault();
  $('#lErro').textContent = '';
  const { error } = await supa.auth.signInWithPassword({ email: $('#lEmail').value, password: $('#lSenha').value });
  if (error) { $('#lErro').textContent = 'E-mail ou senha incorretos.'; return; }
  iniciar();
});
$('#sair').onclick = async e => { e.preventDefault(); await supa.auth.signOut(); location.reload(); };

async function iniciar() {
  const { data: { user: u } } = await supa.auth.getUser();
  if (!u) return;
  const { data: perfil } = await supa.from('perfis').select('papel').eq('user_id', u.id).maybeSingle();
  if (perfil?.papel !== 'admin') { $('#lErro').textContent = 'Este usuário não é da organização.'; await supa.auth.signOut(); return; }
  user = u;
  $('#login').classList.add('oculto'); $('#app').classList.remove('oculto'); $('#sair').classList.remove('oculto');
  await carregar();
  supa.channel('painel').on('postgres_changes', { event: '*', schema: 'public', table: 'inscricoes' }, () => carregar()).subscribe();
}

async function carregar() {
  const [insc, acads, cfg, cats, lutas] = await Promise.all([
    supa.from('inscricoes').select('*, atletas(*, academias(id, nome)), pedidos(status, forma, valor, expira_em, responsaveis(nome, cpf, whatsapp, email))').order('criado_em', { ascending: false }).limit(5000),
    supa.from('academias').select('id, nome').order('nome'),
    supa.from('config').select('chave, valor'),
    supa.from('categorias').select('*'),
    supa.from('lutas').select('*'),
  ]);
  const [ped, desp, fun] = await Promise.all([
    supa.from('pedidos').select('id, status, forma, valor, valor_liquido, expira_em, criado_em, responsaveis(nome, whatsapp), inscricoes(atletas(nome))').limit(5000),
    supa.from('despesas').select('*').order('criado_em'),
    supa.from('funil').select('visitante, etapa').limit(20000),
  ]);
  D.pedidos = chk(ped); D.despesas = chk(desp); D.funil = chk(fun);
  D.insc = chk(insc); D.acads = chk(acads); D.cats = chk(cats); D.lutas = chk(lutas);
  D.fase = chk(cfg).find(c => c.chave === 'fase')?.valor;
  // pedido pendente vencido = expirado
  for (const i of D.insc) if (i.status === 'pendente' && i.pedidos?.status === 'pendente' && new Date(i.pedidos.expira_em) < new Date()) i._expirado = true;
  $('#faseAtual').innerHTML = `Fase atual: <span class="selo previa">${esc(FASES[D.fase] ?? D.fase)}</span>`;
  desenharInsc(); desenharResumo(); desenharAcad(); desenharCats(); desenharAjustes(); desenharControle();
}

// ---------- abas ----------
$('#abas').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#abas button').forEach(x => x.setAttribute('aria-pressed', x === b));
  $$('.aba').forEach(s => s.classList.toggle('oculto', s.id !== b.dataset.aba));
};

// ---------- inscrições ----------
function linhaVisivel(i) {
  const q = normalizarNome($('#iBusca').value);
  if ($('#iStatus').value && i.status !== $('#iStatus').value) return false;
  if ($('#iForma').value && (i.status !== 'confirmada' || i.forma !== $('#iForma').value)) return false;
  if ($('#iStatus').value === 'pendente' && i._expirado) return false;
  if (q && !normalizarNome(`${i.atletas?.nome} ${i.pedidos?.responsaveis?.nome ?? ''}`).includes(q)) return false;
  return true;
}
function desenharInsc() {
  const vis = D.insc.filter(linhaVisivel);
  $('#iConta').textContent = `${vis.length} inscrição(ões) na lista`;
  $('#tInsc').innerHTML = '<tr><th>Atleta</th><th>Categoria</th><th>Status</th><th>Responsável</th><th>Ações</th></tr>' + vis.map(i => {
    const a = i.atletas, r = i.pedidos?.responsaveis;
    const st = i._expirado ? 'PIX expirado' : ST[i.status];
    const acoes = [];
    if (['pendente', 'pago_fora_prazo'].includes(i.status)) acoes.push(`<button class="mini ouro" data-conf="${i.id}">Confirmar manual</button>`);
    if (i.status !== 'cancelada') acoes.push(`<button class="mini" data-edit="${i.id}">Editar</button>`, `<button class="mini" data-canc="${i.id}">Cancelar</button>`);
    return `<tr><td><b>${esc(a?.nome)}</b><br><small class="muted">${esc(a?.academias?.nome)} · ${esc(a?.nascimento?.split('-').reverse().join('/'))}</small></td>
      <td style="white-space:normal;min-width:220px">${esc(rotuloCategoria(i.categoria))}</td>
      <td><span class="selo ${i.status}">${esc(st)}</span>${i.status === 'confirmada' ? ` <span class="selo ${i.forma}">${esc(i.forma)}</span>` : ''}${i.justificativa ? `<br><small class="muted">${esc(i.justificativa)}</small>` : ''}${i.cancel_motivo ? `<br><small class="muted">${esc(i.cancel_motivo)}</small>` : ''}</td>
      <td>${r ? `${esc(r.nome)}<br><small class="muted">${esc(r.whatsapp)}</small>` : '<small class="muted">cadastro manual</small>'}</td>
      <td class="acoes">${acoes.join('')}</td></tr>`;
  }).join('');
}
for (const id of ['iBusca', 'iStatus', 'iForma']) $('#' + id).addEventListener('input', desenharInsc);
$('#tInsc').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.conf) dlgConfirmar([b.dataset.conf]);
  if (b.dataset.edit) dlgEditar(D.insc.find(i => i.id === b.dataset.edit));
  if (b.dataset.canc) cancelar(D.insc.find(i => i.id === b.dataset.canc));
};

function abrirDlg(html, aoSalvar) {
  const f = $('#dlgForm');
  f.innerHTML = html + `<p class="erro" id="dErro"></p><div class="barra"><button class="btn pequeno" value="ok"><span>Salvar</span></button><button class="btn pequeno fantasma" value="cancel" formnovalidate><span>Voltar</span></button></div>`;
  f.onsubmit = async ev => {
    if (ev.submitter?.value === 'cancel') return;
    ev.preventDefault();
    try { await aoSalvar(f); $('#dlg').close(); await carregar(); } catch (e) { $('#dErro').textContent = e.message ?? String(e); }
  };
  $('#dlg').showModal();
}

function dlgConfirmar(ids) {
  abrirDlg(`<h2>Confirmar manualmente</h2>
    <label class="check"><input type="radio" name="forma" value="dinheiro" checked> <span>Pago em dinheiro (R$ ${PRECO_ITEM} por modalidade)</span></label>
    <label class="check"><input type="radio" name="forma" value="abonado"> <span>Abonado / isento</span></label>
    <label>Observação (obrigatória se abonado)</label><input name="just" placeholder="ex.: bolsista do projeto social">`,
  async f => {
    const forma = f.forma.value, just = f.just.value.trim();
    if (forma === 'abonado' && !just) throw new Error('Informe o motivo do abono.');
    chk(await supa.rpc('confirmar_manual', { p_inscricoes: ids, p_forma: forma, p_justificativa: just || null }));
  });
}

async function cancelar(i) {
  const motivo = prompt(`Cancelar a inscrição de ${i.atletas?.nome}?\nInforme o motivo (ex.: desistiu — devolvido por fora):`);
  if (!motivo) return;
  try {
    chk(await supa.from('inscricoes').update({ status: 'cancelada', cancel_motivo: motivo }).eq('id', i.id));
    await tirarDaChave(i);
    await carregar();
  } catch (e) { erro(e); }
}

// Atleta cancelado depois da chave publicada: sem resultados na categoria → ressorteia;
// com resultados → W.O. na luta pendente dele (ou aviso, se o adversário ainda não está definido).
async function tirarDaChave(i) {
  const lutasCat = D.lutas.filter(l => l.categoria === i.categoria);
  if (!lutasCat.some(l => l.a1 === i.id || l.a2 === i.id)) return;
  const comResultado = lutasCat.some(l => l.vencedor && l.metodo !== 'bye');
  if (!comResultado) {
    await carregar();
    if (!confirmadasPorCat()[i.categoria]) { chk(await supa.from('categorias').delete().eq('chave', i.categoria)); return; }
    const t = D.cats.find(c => c.chave === i.categoria)?.tatame ?? 1;
    const { catsJson, lutasJson } = montar([i.categoria], { tatameFixo: { [i.categoria]: t }, ordemInicial: { 1: maxOrdem(1), 2: maxOrdem(2) } });
    chk(await supa.rpc('publicar_chave', { p_categorias: catsJson, p_lutas: lutasJson }));
    alert('A categoria foi ressorteada sem o atleta cancelado.');
    return;
  }
  const pend = lutasCat.find(l => !l.vencedor && (l.a1 === i.id || l.a2 === i.id));
  if (pend?.a1 && pend?.a2) {
    chk(await supa.rpc('registrar_resultado', { p_luta: pend.id, p_vencedor: pend.a1 === i.id ? pend.a2 : pend.a1, p_metodo: 'wo' }));
    alert('W.O. registrado: o adversário avançou.');
  } else if (pend) alert('Atenção: o adversário dele ainda não está definido. Quando a luta aparecer para o mesário, ele deve marcar W.O.');
}

const optsAcad = sel => D.acads.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.nome)}</option>`).join('');
function camposAtleta(a = {}) {
  return `<label>Nome</label><input name="nome" value="${esc(a.nome ?? '')}" required>
    <div class="linha2"><div><label>Nascimento</label><input name="nasc" type="date" value="${esc(a.nascimento ?? '')}" required></div>
    <div><label>Sexo</label><select name="sexo"><option value="M" ${a.sexo === 'M' ? 'selected' : ''}>Masculino</option><option value="F" ${a.sexo === 'F' ? 'selected' : ''}>Feminino</option></select></div></div>
    <label>Faixa</label><select name="faixa">${Object.entries(NOME_FAIXA).map(([k, v]) => `<option value="${k}" ${a.faixa === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <label>Academia</label><select name="acad">${optsAcad(a.academia_id)}<option value="__nova">+ Nova academia…</option></select>
    <input name="acadNova" placeholder="Nome da nova academia" style="margin-top:6px">
    <label>Professor</label><input name="prof" value="${esc(a.professor ?? '')}">`;
}
async function academiaId(f) {
  if (f.acad.value !== '__nova') return f.acad.value;
  const nome = f.acadNova.value.trim();
  if (nome.length < 2) throw new Error('Informe o nome da nova academia.');
  const ex = D.acads.find(a => a.nome.toLowerCase() === nome.toLowerCase());
  return ex ? ex.id : chk(await supa.from('academias').insert({ nome }).select('id').single()).id;
}
const pesoOpts = (mod, sexo, div, sel) => pesosDisponiveis(mod, sexo, div).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.nome}${p.max ? ' (até ' + p.max + ' kg)' : ''}</option>`).join('');

function dlgEditar(i) {
  const a = i.atletas, c = parseChave(i.categoria);
  abrirDlg(`<h2>Editar inscrição</h2>${camposAtleta(a)}
    <label>Categoria de peso (${c.modalidade === 'gi' ? 'Gi' : 'No-Gi'})</label>
    ${c.tipo === 'peso' ? `<select name="peso">${pesoOpts(c.modalidade, a.sexo, divisaoIdade(a.nascimento), c.pesoId)}</select><small class="muted">Se mudar idade/sexo, confira o peso de novo após salvar.</small>` : '<p class="muted">Absoluto (sem peso)</p>'}`,
  async f => {
    const div = divisaoIdade(f.nasc.value);
    if (!div) throw new Error('Data de nascimento fora das categorias.');
    if (!faixasPermitidas(div).includes(f.faixa.value)) throw new Error('Faixa não permitida para a idade.');
    const acId = await academiaId(f);
    chk(await supa.from('atletas').update({ nome: f.nome.value.trim(), nascimento: f.nasc.value, sexo: f.sexo.value, faixa: f.faixa.value, academia_id: acId, professor: f.prof.value.trim() }).eq('id', a.id));
    // recalcula todas as inscrições deste atleta
    for (const x of D.insc.filter(y => y.atleta_id === a.id)) {
      const cx = parseChave(x.categoria);
      let pesoId = x.id === i.id && f.peso ? f.peso.value : cx.pesoId;
      if (cx.tipo === 'peso' && !pesosDisponiveis(cx.modalidade, f.sexo.value, div).some(p => p.id === pesoId)) pesoId = pesosDisponiveis(cx.modalidade, f.sexo.value, div)[0].id;
      const categoria = chaveCategoria({ modalidade: cx.modalidade, tipo: cx.tipo, sexo: f.sexo.value, divisaoId: div, faixa: f.faixa.value, pesoId });
      chk(await supa.from('inscricoes').update({ categoria, dup_chave: chaveDuplicidade(f.nome.value, f.nasc.value, cx.modalidade, cx.tipo) }).eq('id', x.id));
    }
  });
}

$('#novo').onclick = () => {
  abrirDlg(`<h2>Cadastrar atleta (já confirmado)</h2>${camposAtleta({ academia_id: D.acads.find(a => a.nome.startsWith('Brutus'))?.id })}
    <label>Modalidades</label>
    <label class="check"><input type="checkbox" name="gi"> <span>Gi — peso:</span></label><select name="giPeso"></select>
    <label class="check"><input type="checkbox" name="giAbs"> <span>Absoluto Gi</span></label>
    <label class="check"><input type="checkbox" name="nogi"> <span>No-Gi — peso:</span></label><select name="nogiPeso"></select>
    <label class="check"><input type="checkbox" name="nogiAbs"> <span>Absoluto No-Gi</span></label>
    <label>Forma</label><select name="forma"><option value="dinheiro">Pago em dinheiro</option><option value="abonado">Abonado / isento</option></select>
    <label>Observação (obrigatória se abonado)</label><input name="just">`,
  async f => {
    const div = divisaoIdade(f.nasc.value);
    if (!div) throw new Error('Data de nascimento fora das categorias.');
    if (!faixasPermitidas(div).includes(f.faixa.value)) throw new Error('Faixa não permitida para a idade.');
    if (f.forma.value === 'abonado' && !f.just.value.trim()) throw new Error('Informe o motivo do abono.');
    const itens = [];
    for (const m of ['gi', 'nogi']) {
      if (f[m].checked) itens.push({ modalidade: m, tipo: 'peso', pesoId: f[m + 'Peso'].value });
      if (f[m + 'Abs'].checked) { if (!podeAbsoluto(div)) throw new Error('Absoluto só a partir de 16 anos.'); itens.push({ modalidade: m, tipo: 'absoluto' }); }
    }
    if (!itens.length) throw new Error('Marque pelo menos uma modalidade.');
    const acId = await academiaId(f);
    const ped = chk(await supa.from('pedidos').insert({ valor: f.forma.value === 'abonado' ? 0 : itens.length * PRECO_ITEM, status: 'pago', forma: f.forma.value, pago_em: new Date().toISOString() }).select('id').single());
    const at = chk(await supa.from('atletas').insert({ nome: f.nome.value.trim(), nascimento: f.nasc.value, sexo: f.sexo.value, faixa: f.faixa.value, academia_id: acId, professor: f.prof.value.trim() }).select('id').single());
    chk(await supa.from('inscricoes').insert(itens.map(it => ({
      pedido_id: ped.id, atleta_id: at.id, modalidade: it.modalidade, tipo: it.tipo,
      categoria: chaveCategoria({ ...it, sexo: f.sexo.value, divisaoId: div, faixa: f.faixa.value }),
      dup_chave: chaveDuplicidade(f.nome.value, f.nasc.value, it.modalidade, it.tipo),
      status: 'confirmada', forma: f.forma.value, justificativa: f.just.value.trim() || null,
      valor: f.forma.value === 'abonado' ? 0 : PRECO_ITEM, confirmado_por: user.id, confirmado_em: new Date().toISOString(),
    }))));
  });
  const f = $('#dlgForm');
  const atualizaPesos = () => {
    const div = divisaoIdade(f.nasc.value);
    for (const m of ['gi', 'nogi']) f[m + 'Peso'].innerHTML = div ? pesoOpts(m, f.sexo.value, div) : '<option>Informe o nascimento</option>';
  };
  f.nasc.onchange = f.sexo.onchange = atualizaPesos;
};

// CSV
$('#csv').onclick = () => {
  const cab = ['Atleta', 'Nascimento', 'Sexo', 'Faixa', 'Academia', 'Professor', 'Categoria', 'Status', 'Forma', 'Valor', 'Observação', 'Responsável', 'CPF responsável', 'WhatsApp', 'E-mail', 'Inscrito em'];
  const q = v => { const s = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };
  const linhas = D.insc.map(i => {
    const a = i.atletas, r = i.pedidos?.responsaveis;
    return [a?.nome, a?.nascimento, a?.sexo, NOME_FAIXA[a?.faixa], a?.academias?.nome, a?.professor, rotuloCategoria(i.categoria), i._expirado ? 'PIX expirado' : ST[i.status], i.forma, i.valor, i.justificativa ?? i.cancel_motivo, r?.nome, r?.cpf, r?.whatsapp, r?.email, new Date(i.criado_em).toLocaleString('pt-BR')].map(q).join(';');
  });
  const blob = new Blob(['﻿' + [cab.map(q).join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inscricoes-copa-joao-leao.csv'; a.click();
};

// ---------- resumo ----------
function desenharResumo() {
  const conf = D.insc.filter(i => i.status === 'confirmada');
  const soma = f => conf.filter(i => i.forma === f).reduce((s, i) => s + Number(i.valor), 0);
  const atletas = new Set(conf.map(i => i.atleta_id)).size;
  const k = (t, v) => `<div class="kpi">${t}<b>${v}</b></div>`;
  $('#kpis').innerHTML = k('Atletas confirmados', atletas) + k('Inscrições confirmadas', conf.length) + k('Recebido por PIX', brl(soma('pix'))) +
    k('Recebido em dinheiro', brl(soma('dinheiro'))) + k('Abonados', conf.filter(i => i.forma === 'abonado').length) +
    k('Aguardando pagamento', D.insc.filter(i => i.status === 'pendente' && !i._expirado).length);
  const dev = D.insc.filter(i => i.status === 'pago_fora_prazo');
  $('#tDev').innerHTML = '<tr><th>Atleta</th><th>Responsável</th><th>WhatsApp</th><th>Valor</th><th>Motivo</th></tr>' +
    (dev.length ? dev.map(i => `<tr><td>${esc(i.atletas?.nome)}</td><td>${esc(i.pedidos?.responsaveis?.nome)}</td><td>${esc(i.pedidos?.responsaveis?.whatsapp)}</td><td>${brl(i.valor)}</td><td>${esc(i.cancel_motivo ?? 'pago após publicação da chave')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Nenhuma.</td></tr>');
}

// ---------- academias ----------
function desenharAcad() {
  const conta = {};
  for (const i of D.insc.filter(x => x.status === 'confirmada')) conta[i.atletas?.academia_id] = (conta[i.atletas?.academia_id] ?? 0) + 1;
  const o = D.acads.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
  $('#mDe').innerHTML = o; $('#mPara').innerHTML = o;
  $('#tAcad').innerHTML = '<tr><th>Academia</th><th>Inscrições confirmadas</th></tr>' + D.acads.map(a => `<tr><td>${esc(a.nome)}</td><td>${conta[a.id] ?? 0}</td></tr>`).join('');
}
$('#mesclar').onclick = async () => {
  const de = $('#mDe').selectedOptions[0], para = $('#mPara').selectedOptions[0];
  if (!confirm(`Juntar "${de.text}" em "${para.text}"? "${de.text}" deixa de existir.`)) return;
  try { chk(await supa.rpc('mesclar_academias', { p_de: de.value, p_para: para.value })); await carregar(); } catch (e) { erro(e); }
};

// ---------- categorias ----------
const confirmadasPorCat = () => {
  const m = {};
  for (const i of D.insc.filter(x => x.status === 'confirmada')) (m[i.categoria] ??= []).push(i);
  return m;
};
function desenharCats() {
  const m = confirmadasPorCat();
  const chaves = Object.keys(m).sort((a, b) => ordemCategoria(a) - ordemCategoria(b));
  $('#tCats').innerHTML = '<tr><th>Categoria</th><th>Atletas</th><th>Ação</th></tr>' + chaves.map(k => {
    const n = m[k].length;
    const c = parseChave(k);
    const vizinhas = c.tipo === 'peso' ? pesosDisponiveis(c.modalidade, c.sexo, c.divisaoId).filter(p => p.id !== c.pesoId)
      .map(p => chaveCategoria({ ...c, pesoId: p.id })) : [];
    return `<tr><td style="white-space:normal">${esc(rotuloCategoria(k))}</td><td>${n}${n === 1 ? ' <span class="selo pago_fora_prazo">sozinho</span>' : ''}</td>
      <td>${n === 1 && vizinhas.length ? `<select data-juntar="${esc(k)}"><option value="">Juntar com…</option>${vizinhas.map(v => `<option value="${esc(v)}">${esc(rotuloCategoria(v).split(' · ').at(-1))}${m[v] ? ` (${m[v].length})` : ''}</option>`).join('')}</select>` : ''}</td></tr>`;
  }).join('');
}
$('#tCats').onchange = async e => {
  const s = e.target.closest('select[data-juntar]'); if (!s?.value) return;
  const ins = confirmadasPorCat()[s.dataset.juntar];
  if (!confirm(`Mover ${ins[0].atletas?.nome} para "${rotuloCategoria(s.value)}"?`)) { s.value = ''; return; }
  try { chk(await supa.from('inscricoes').update({ categoria: s.value }).in('id', ins.map(i => i.id))); await carregar(); } catch (e) { erro(e); }
};

// ---------- chaves e fases ----------
$('#chaves').addEventListener('click', async e => {
  const b = e.target.closest('[data-fase]'); if (!b) return;
  if (!confirm(`Mudar a fase para "${FASES[b.dataset.fase]}"?`)) return;
  try { chk(await supa.from('config').update({ valor: b.dataset.fase }).eq('chave', 'fase')); await carregar(); } catch (er) { erro(er); }
});

function montar(chavesCat, { tatameFixo = {}, ordemInicial = { 1: 0, 2: 0 } } = {}) {
  const m = confirmadasPorCat();
  const geradas = chavesCat.map(k => {
    const ats = m[k].map(i => ({ inscricaoId: i.id, nome: i.atletas?.nome, academia: i.atletas?.academias?.nome ?? '' }));
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647; // cabe em int do Postgres
    const ch = gerarChave(ats, seed);
    const c = parseChave(k);
    return { k, seed, ch, minutos: TEMPO_LUTA_MIN(c.divisaoId, c.faixa) };
  });
  const tat = { ...distribuirTatames(geradas.map(g => ({ chave: g.k, numLutas: g.ch.lutas.filter(l => l.metodo !== 'bye').length, minutos: g.minutos }))), ...tatameFixo };
  const lutasJson = [];
  for (const t of [1, 2]) {
    const cats = geradas.filter(g => tat[g.k] === t).sort((a, b) => ordemCategoria(a.k) - ordemCategoria(b.k));
    const fila = filaTatame(Object.fromEntries(cats.map(g => [g.k, g.ch.lutas])), cats.map(g => g.k));
    const ordem = Object.fromEntries(fila.map(f => [`${f.chaveCat}#${f.ref}`, f.ordem + ordemInicial[t]]));
    for (const g of cats) for (const l of g.ch.lutas) lutasJson.push({
      categoria: g.k, ref: l.ref, rodada: l.rodada, posicao: l.posicao, papel: l.papel, a1: l.a1, a2: l.a2, vencedor: l.vencedor, metodo: l.metodo,
      prox_venc_ref: l.prox_venc?.ref ?? null, prox_venc_slot: l.prox_venc?.slot ?? null, prox_perd_ref: l.prox_perd?.ref ?? null, prox_perd_slot: l.prox_perd?.slot ?? null,
      tatame: t, ordem_tatame: ordem[`${g.k}#${l.ref}`] ?? null,
    });
  }
  const catsJson = geradas.map(g => ({ chave: g.k, rotulo: rotuloCategoria(g.k), tatame: tat[g.k], ordem: ordemCategoria(g.k), seed: g.seed }));
  return { catsJson, lutasJson };
}

$('#publicar').onclick = async () => {
  await carregar(); // dados frescos: ninguém confirmado agora pode ficar de fora
  const chavesCat = Object.keys(confirmadasPorCat());
  if (!chavesCat.length) return alert('Não há inscrições confirmadas.');
  if (D.lutas.some(l => l.vencedor && l.metodo !== 'bye')) return alert('Já existem resultados registrados. Use "Ressortear categoria" para ajustes pontuais.');
  if (!confirm(`Publicar a chave oficial de ${chavesCat.length} categorias? Um novo sorteio substitui qualquer chave publicada antes.`)) return;
  try {
    const { catsJson, lutasJson } = montar(chavesCat);
    chk(await supa.rpc('publicar_chave', { p_categorias: catsJson, p_lutas: lutasJson, p_completo: true }));
    alert('Chave oficial publicada!'); await carregar();
  } catch (e) { erro(e); }
};

function desenharAjustes() {
  const v = $('#ajCat').value;
  $('#ajCat').innerHTML = D.cats.sort((a, b) => a.ordem - b.ordem).map(c => `<option value="${esc(c.chave)}">${esc(c.rotulo)} (T${c.tatame})</option>`).join('') || '<option value="">Publique a chave primeiro</option>';
  if (v) $('#ajCat').value = v;
  mostrarPrevia();
}
function mostrarPrevia() {
  const k = $('#ajCat').value;
  if (!k) { $('#previaCat').innerHTML = ''; return; }
  const lutas = D.lutas.filter(l => l.categoria === k);
  const pessoas = Object.fromEntries(D.insc.map(i => [i.id, { nome: i.atletas?.nome, academia: i.atletas?.academias?.nome }]));
  const formato = !lutas.length ? 'unico' : lutas.some(l => l.ref === 'L1') ? 'trio' : lutas.length === 1 ? 'dupla' : 'eliminatoria';
  $('#previaCat').innerHTML = chaveHtml({ formato, lutas }, pessoas, { unicoId: confirmadasPorCat()[k]?.[0]?.id });
}
$('#ajCat').onchange = mostrarPrevia;
const maxOrdem = t => Math.max(0, ...D.lutas.filter(l => l.tatame === t).map(l => l.ordem_tatame ?? 0));
$('#moverTat').onclick = async () => {
  const k = $('#ajCat').value, t = Number($('#ajTat').value);
  if (!k) return;
  try {
    let n = maxOrdem(t);
    chk(await supa.from('categorias').update({ tatame: t }).eq('chave', k));
    const ls = D.lutas.filter(l => l.categoria === k && l.metodo !== 'bye').sort((a, b) => a.ordem_tatame - b.ordem_tatame);
    for (const l of ls) chk(await supa.from('lutas').update({ tatame: t, ordem_tatame: ++n }).eq('id', l.id));
    await carregar();
  } catch (e) { erro(e); }
};
$('#ressortear').onclick = async () => {
  const k = $('#ajCat').value; if (!k) return;
  if (!confirmadasPorCat()[k]) return alert('A categoria não tem inscrições confirmadas.');
  if (!confirm('Ressortear esta categoria com as inscrições confirmadas de agora?')) return;
  try {
    const t = D.cats.find(c => c.chave === k)?.tatame ?? 1;
    const { catsJson, lutasJson } = montar([k], { tatameFixo: { [k]: t }, ordemInicial: { 1: maxOrdem(1), 2: maxOrdem(2) } });
    chk(await supa.rpc('publicar_chave', { p_categorias: catsJson, p_lutas: lutasJson }));
    await carregar();
  } catch (e) { erro(e); }
};

supa.auth.getSession().then(({ data }) => data.session && iniciar());

// ---------- controle e custos ----------
const kpi = (t, v, sub = '') => `<div class="kpi">${t}<b>${v}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</div>`;
const lista = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(k)}</span><b>${v}</b></div>`).join('') || '<p class="muted">—</p>';

function desenharControle() {
  // funil
  const etapa = e => new Set(D.funil.filter(f => f.etapa === e).map(f => f.visitante)).size;
  const visitou = etapa('visitou'), comecou = etapa('comecou');
  const pix = D.pedidos.filter(p => p.forma === 'pix');
  const gerou = pix.length, pagou = pix.filter(p => ['pago', 'pago_fora_prazo'].includes(p.status)).length;
  const desist = pix.filter(p => ['pendente', 'expirado'].includes(p.status));
  $('#kFunil').innerHTML = kpi('Abriram a inscrição', visitou) + kpi('Começaram a preencher', comecou, `${taxaConversao(comecou, visitou)}% de quem abriu`) +
    kpi('Chegaram no PIX', gerou, `${taxaConversao(gerou, comecou)}% de quem começou`) + kpi('Pagaram', pagou, `${taxaConversao(pagou, gerou)}% de quem chegou no PIX`) +
    kpi('Desistiram no PIX', desist.length, `${taxaConversao(desist.length, gerou)}% de quem chegou no PIX`);
  $('#tDesist').innerHTML = '<tr><th>Responsável</th><th>WhatsApp</th><th>Atletas</th><th>Valor</th><th>Situação</th></tr>' + (desist.length ? desist.map(p => {
    const vencido = new Date(p.expira_em) < new Date();
    const zap = (p.responsaveis?.whatsapp ?? '').replace(/\D/g, '');
    return `<tr><td>${esc(p.responsaveis?.nome)}</td><td>${zap ? `<a href="https://wa.me/55${esc(zap)}" target="_blank" rel="noopener">${esc(p.responsaveis?.whatsapp)}</a>` : ''}</td>
      <td style="white-space:normal">${esc([...new Set((p.inscricoes ?? []).map(i => i.atletas?.nome))].join(', '))}</td><td>${brl(p.valor)}</td><td>${vencido ? 'PIX expirado' : 'Aguardando'}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="muted">Ninguém por enquanto.</td></tr>');

  // financeiro
  const pagos = pix.filter(p => p.status === 'pago');
  const bruto = pagos.reduce((s, p) => s + Number(p.valor), 0);
  const liquido = pagos.reduce((s, p) => s + Number(p.valor_liquido ?? p.valor), 0);
  const conf = D.insc.filter(i => i.status === 'confirmada');
  const dinheiro = conf.filter(i => i.forma === 'dinheiro').reduce((s, i) => s + Number(i.valor), 0);
  const abonados = conf.filter(i => i.forma === 'abonado').length;
  const devolver = D.insc.filter(i => i.status === 'pago_fora_prazo').reduce((s, i) => s + Number(i.valor), 0);
  const despTotal = D.despesas.reduce((s, d) => s + Number(d.valor), 0);
  const despPagas = D.despesas.filter(d => d.pago).reduce((s, d) => s + Number(d.valor), 0);
  const saldo = liquido + dinheiro - despTotal - devolver;
  $('#kFin').innerHTML = kpi('PIX recebido (bruto)', brl(bruto)) + kpi('Taxas do Asaas', brl(bruto - liquido)) + kpi('PIX líquido', brl(liquido)) +
    kpi('Dinheiro', brl(dinheiro)) + kpi('Abonados', abonados, `deixaram de entrar ${brl(abonados * PRECO_ITEM)}`) + kpi('A devolver', brl(devolver)) +
    kpi('Despesas', brl(despTotal), `${brl(despPagas)} já pagas`) +
    kpi('Saldo previsto', `<span style="color:${saldo >= 0 ? 'var(--verde)' : '#ff6b6b'}">${brl(saldo)}</span>`, 'líquido + dinheiro − despesas − devoluções');
  $('#tDesp').innerHTML = '<tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Situação</th><th></th></tr>' + (D.despesas.length ? D.despesas.map(d =>
    `<tr><td>${esc(d.descricao)}</td><td>${esc(d.categoria)}</td><td>${brl(d.valor)}</td><td><button class="mini" data-dpago="${d.id}">${d.pago ? 'Pago ✓' : 'A pagar'}</button></td><td><button class="mini" data-ddel="${d.id}">Excluir</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">Nenhuma despesa lançada.</td></tr>');

  // evento
  const porCat = {};
  for (const i of conf) porCat[i.categoria] = (porCat[i.categoria] ?? 0) + 1;
  const tamanhos = Object.values(porCat);
  const med = medalhasNecessarias(tamanhos);
  let minutos = 0;
  for (const [k, n] of Object.entries(porCat)) { const c = parseChave(k); minutos += numeroDeLutas(n) * (TEMPO_LUTA_MIN(c.divisaoId, c.faixa) + 2); }
  const horas = minutos / 2 / 60;
  $('#kEvento').innerHTML = kpi('Atletas', new Set(conf.map(i => i.atleta_id)).size) +
    kpi('Categorias', tamanhos.length, `${tamanhos.filter(n => n === 1).length} com atleta sozinho`) +
    kpi('Medalhas', med.total, `${med.ouro} ouro, ${med.prata} prata, ${med.bronze} bronze`) +
    kpi('Lutas previstas', tamanhos.reduce((s, n) => s + numeroDeLutas(n), 0)) +
    kpi('Duração estimada', `${Math.floor(horas)}h${String(Math.round((horas % 1) * 60)).padStart(2, '0')}`, '2 tatames, 2 min entre lutas');
  const grupo = c => { const d = parseChave(c).divisaoId; return d.startsWith('master') ? 'Master' : d === 'adulto' ? 'Adulto' : d.startsWith('juvenil') ? 'Juvenil' : 'Kids'; };
  const cont = f => { const o = {}; for (const i of conf) { const k = f(i); o[k] = (o[k] ?? 0) + 1; } return o; };
  $('#lIdade').innerHTML = lista(cont(i => grupo(i.categoria)));
  $('#lMod').innerHTML = lista(cont(i => { const c = parseChave(i.categoria); return (c.modalidade === 'gi' ? 'Gi' : 'No-Gi') + (c.tipo === 'absoluto' ? ' (Absoluto)' : ''); }));
  $('#lAcad').innerHTML = lista(cont(i => i.atletas?.academias?.nome ?? '?'));
}

$('#fDesp').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  try {
    chk(await supa.from('despesas').insert({ descricao: f.desc.value.trim(), categoria: f.cat.value, valor: Number(f.valor.value), pago: f.pago.checked }));
    f.reset(); await carregar();
  } catch (er) { erro(er); }
});
$('#tDesp').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.dpago) { const d = D.despesas.find(x => x.id === b.dataset.dpago); chk(await supa.from('despesas').update({ pago: !d.pago }).eq('id', d.id)); }
    if (b.dataset.ddel && confirm('Excluir esta despesa?')) chk(await supa.from('despesas').delete().eq('id', b.dataset.ddel));
    await carregar();
  } catch (er) { erro(er); }
};
