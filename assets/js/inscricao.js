import { supa, $, $$, esc, brl } from './supa.js';
import { FUNCOES, SUPABASE_ANON_KEY, FECHAMENTO } from './config.js?v=3';
import { NOME_FAIXA } from '../../supabase/functions/_shared/tabelas.js';
import { cpfValido, dataValida } from '../../supabase/functions/_shared/validacao.js';
import { divisaoIdade, faixasPermitidas, pesosDisponiveis, podeAbsoluto, validarItens, rotuloCategoria, chaveCategoria, totalPedido } from '../../supabase/functions/_shared/categorias.js';

const BRUTUS = 'Brutus Jiu-Jitsu Clube';
const TERMO = `<p><b>Termo de Responsabilidade, Uso de Imagem e Dados — III Copa João Leão de Jiu-Jitsu</b></p>
<p>Declaro que sou o atleta ou o responsável legal pelo(s) atleta(s) inscrito(s) e que:</p>
<p><b>1. Saúde e riscos</b> — o(s) atleta(s) está(ão) em boas condições de saúde e apto(s) à prática de jiu-jitsu, e estou ciente de que se trata de esporte de contato com risco de lesões. Isento a organização (Brutus Jiu-Jitsu Clube), os apoiadores e os patrocinadores de responsabilidade por lesões decorrentes da prática esportiva, ressalvados os casos de negligência da organização.</p>
<p><b>2. Regulamento</b> — li e aceito o regulamento do campeonato, incluindo pesagem com kimono antes da primeira luta e desclassificação em caso de excesso de peso.</p>
<p><b>3. Imagem</b> — autorizo, sem custo, o uso da imagem e voz do(s) atleta(s) captadas no evento, para divulgação do campeonato e das entidades organizadoras e apoiadoras, em qualquer mídia.</p>
<p><b>4. Dados pessoais (LGPD)</b> — autorizo o tratamento dos dados informados exclusivamente para inscrição, cobrança, montagem das chaves e comunicação sobre o evento. Nome, academia e faixa do atleta serão exibidos publicamente nas chaves e resultados. Demais dados (CPF, contatos, data de nascimento) não são divulgados. Posso solicitar acesso, correção ou exclusão dos dados pelo contato da organização.</p>
<p><b>5. Veracidade</b> — as informações prestadas são verdadeiras, e informações falsas (idade, faixa, peso) podem levar à desclassificação.</p>`;

const mostrar = id => { for (const s of ['carregando', 'encerradas', 'form', 'pagar', 'sucesso', 'expirado']) $('#' + s).classList.toggle('oculto', s !== id); };
const cabecalhos = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };

// ---------- atletas ----------
let seq = 0;
function novoAtleta() {
  const n = ++seq;
  const el = document.createElement('div');
  el.className = 'atleta';
  el.innerHTML = `
    <header><h3>Atleta</h3><button type="button" class="rm">Remover</button></header>
    <label>Nome completo do atleta</label><input name="nome" required>
    <div class="linha2">
      <div><label>Data de nascimento</label><input name="nascimento" type="date" min="1940-01-01" max="2022-12-31" required></div>
      <div><label>Sexo</label><select name="sexo"><option value="">Selecione</option><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
    </div>
    <div class="info-div" data-div></div>
    <label>Faixa</label><select name="faixa"><option value="">Informe a data de nascimento</option></select>
    <div class="linha2">
      <div><label>Academia / equipe</label><select name="acadSel"><option value="${BRUTUS}">${BRUTUS}</option><option value="__outra">Outra</option></select>
        <input name="acadOutra" class="oculto" list="listaAcad" placeholder="Nome da academia" style="margin-top:6px"></div>
      <div><label>Professor</label><input name="professor"></div>
    </div>
    <label>Modalidades (R$ 20 cada)</label>
    <div class="mods">
      ${['gi', 'nogi'].map(m => `
      <div class="mod" data-mod="${m}">
        <label class="check"><input type="checkbox" name="${m}"> <span><b>${m === 'gi' ? 'Gi (com kimono)' : 'No-Gi (sem kimono)'}</b></span></label>
        <select name="${m}Peso" class="pesoSel oculto"></select>
        <label class="check oculto" data-abs><input type="checkbox" name="${m}Abs"> <span>Absoluto ${m === 'gi' ? 'Gi' : 'No-Gi'} (+ R$ 20)</span></label>
      </div>`).join('')}
    </div>
    <div class="erro" data-erro></div>`;
  el.querySelector('.rm').onclick = () => { el.remove(); renumerar(); atualizar(); };
  el.addEventListener('input', () => atualizarAtleta(el));
  el.addEventListener('change', () => atualizarAtleta(el));
  $('#atletas').append(el);
  renumerar();
  atualizarAtleta(el);
}
function renumerar() {
  const lista = $$('.atleta');
  lista.forEach((el, i) => {
    el.querySelector('h3').textContent = `Atleta ${i + 1}`;
    el.querySelector('.rm').classList.toggle('oculto', lista.length === 1);
  });
}

const val = (el, n) => el.querySelector(`[name="${n}"]`);
function dadosAtleta(el) {
  const acadSel = val(el, 'acadSel').value;
  const a = {
    nome: val(el, 'nome').value.trim(), nascimento: val(el, 'nascimento').value, sexo: val(el, 'sexo').value,
    faixa: val(el, 'faixa').value, professor: val(el, 'professor').value.trim(),
    academia: acadSel === '__outra' ? val(el, 'acadOutra').value.trim() : acadSel,
  };
  a.itens = [];
  for (const m of ['gi', 'nogi']) {
    if (val(el, m).checked) a.itens.push({ modalidade: m, tipo: 'peso', pesoId: val(el, m + 'Peso').value });
    if (val(el, m + 'Abs').checked && !val(el, m + 'Abs').closest('[data-abs]').classList.contains('oculto')) a.itens.push({ modalidade: m, tipo: 'absoluto' });
  }
  return a;
}

function atualizarAtleta(el) {
  const nasc = val(el, 'nascimento').value;
  const sexo = val(el, 'sexo').value;
  const div = nasc ? divisaoIdade(nasc) : null;
  const info = el.querySelector('[data-div]');
  info.textContent = nasc && !div ? 'Idade fora das categorias (mínimo 4 anos em 2026).' : div ? `Categoria de idade: ${rotuloCategoria(`gi|absoluto|${sexo || 'M'}|${div}|branca`).split(' · ')[2]}` : '';
  // faixas
  const fSel = val(el, 'faixa');
  const fAtual = fSel.value;
  const faixas = div ? faixasPermitidas(div).filter(f => f !== 'preta' || 2026 - Number(nasc.slice(0, 4)) >= 19) : [];
  const fHtml = div ? '<option value="">Selecione</option>' + faixas.map(f => `<option value="${f}">${NOME_FAIXA[f]}</option>`).join('') : '<option value="">Informe a data de nascimento</option>';
  if (fSel.dataset.h !== fHtml) { fSel.innerHTML = fHtml; fSel.dataset.h = fHtml; fSel.value = faixas.includes(fAtual) ? fAtual : ''; }
  // academia
  val(el, 'acadOutra').classList.toggle('oculto', val(el, 'acadSel').value !== '__outra');
  // modalidades
  for (const m of ['gi', 'nogi']) {
    const marcado = val(el, m).checked;
    const pSel = val(el, m + 'Peso');
    const pesos = div && sexo ? pesosDisponiveis(m, sexo, div) : [];
    const pHtml = '<option value="">Escolha a categoria de peso</option>' + pesos.map((p, i) =>
      `<option value="${p.id}">${p.nome} — ${p.max != null ? 'até ' + String(p.max).replace('.', ',') + ' kg' : 'acima de ' + String(pesos[i - 1].max).replace('.', ',') + ' kg'}</option>`).join('');
    if (pSel.dataset.h !== pHtml) { const v = pSel.value; pSel.innerHTML = pHtml; pSel.dataset.h = pHtml; pSel.value = pesos.some(p => p.id === v) ? v : ''; }
    pSel.classList.toggle('oculto', !marcado || !pesos.length);
    const abs = el.querySelector(`.mod[data-mod="${m}"] [data-abs]`);
    abs.classList.toggle('oculto', !marcado || !div || !podeAbsoluto(div));
  }
  atualizar();
}

function atualizar() {
  const linhas = [];
  let itens = 0;
  for (const el of $$('.atleta')) {
    const a = dadosAtleta(el);
    const div = a.nascimento ? divisaoIdade(a.nascimento) : null;
    for (const it of a.itens) {
      itens++;
      const ok = div && a.sexo && a.faixa && (it.tipo === 'absoluto' || it.pesoId);
      linhas.push(`<li><b>${esc(a.nome || 'Atleta')}</b> — ${ok ? esc(rotuloCategoria(chaveCategoria({ ...it, sexo: a.sexo, divisaoId: div, faixa: a.faixa }))) : 'complete os dados'} · R$ 20</li>`);
    }
  }
  $('#resumo').innerHTML = linhas.join('') || '<li class="muted">Marque pelo menos uma modalidade.</li>';
  $('#total').textContent = brl(totalPedido(Array(itens).fill(0)));
}

// ---------- envio ----------
function validarTudo() {
  const erros = [];
  const r = { nome: $('#rNome').value.trim(), cpf: $('#rCpf').value.replace(/\D/g, ''), whatsapp: $('#rZap').value.replace(/\D/g, ''), email: $('#rEmail').value.trim() };
  if (r.nome.length < 3) erros.push('Informe o nome de quem está inscrevendo.');
  if (!cpfValido(r.cpf)) erros.push('CPF inválido: confira os números.');
  if (r.whatsapp.length < 10) erros.push('WhatsApp com DDD.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) erros.push('E-mail inválido.');
  const atletas = $$('.atleta').map((el, i) => {
    const a = dadosAtleta(el);
    const e = [];
    if (a.nome.length < 3) e.push('informe o nome completo');
    if (!dataValida(a.nascimento)) e.push('informe uma data de nascimento válida');
    if (!a.sexo) e.push('informe o sexo');
    if (a.academia.length < 2) e.push('informe a academia');
    if (a.itens.some(it => it.tipo === 'peso' && !it.pesoId)) e.push('escolha a categoria de peso');
    if (!e.length) e.push(...validarItens(a, a.itens).map(x => x.charAt(0).toLowerCase() + x.slice(1)));
    el.querySelector('[data-erro]').textContent = e.length ? 'Corrija: ' + e.join('; ') : '';
    if (e.length) erros.push(`Atleta ${i + 1}: ${e.join('; ')}`);
    return a;
  });
  if (!$('#aceite').checked) erros.push('Marque o aceite do termo.');
  return { erros, r, atletas };
}

$('#form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const { erros, r, atletas } = validarTudo();
  const box = $('#erros');
  if (erros.length) { box.innerHTML = erros.map(e => `<div>• ${esc(e)}</div>`).join(''); box.classList.remove('oculto'); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  box.classList.add('oculto');
  const btn = $('#enviar');
  btn.disabled = true; btn.firstElementChild.textContent = 'Gerando PIX…';
  try {
    const resp = await fetch(`${FUNCOES}/criar-pedido`, { method: 'POST', headers: cabecalhos, body: JSON.stringify({ responsavel: r, atletas, termo: 'v1' }) });
    const d = await resp.json().catch(() => ({ erros: ['Erro de conexão. Tente novamente.'] }));
    if (!resp.ok) throw d.erros ?? ['Erro ao gerar o PIX.'];
    history.replaceState(null, '', `?pedido=${d.pedidoId}`);
    mostrarPix({ status: 'pendente', valor: d.valor, pixPayload: d.pixPayload, pixQrBase64: d.pixQrBase64, expiraEm: d.expiraEm });
    acompanhar(d.pedidoId);
  } catch (e) {
    const lista = Array.isArray(e) ? e : ['Erro de conexão. Verifique a internet e tente novamente.'];
    box.innerHTML = lista.map(x => `<div>• ${esc(x)}</div>`).join(''); box.classList.remove('oculto');
  } finally {
    btn.disabled = false; btn.firstElementChild.textContent = 'Gerar PIX';
  }
});

// ---------- PIX e status ----------
function mostrarPix(d) {
  $('#pixValor').textContent = brl(d.valor);
  $('#pixQr').src = `data:image/png;base64,${d.pixQrBase64}`;
  $('#pixCodigo').textContent = d.pixPayload;
  $('#pixExpira').textContent = `Pague até ${new Date(d.expiraEm).toLocaleString('pt-BR', { timeZone: 'America/Manaus', dateStyle: 'short', timeStyle: 'short' })} (horário de Manaus).`;
  $('#linkPedido').textContent = location.href;
  mostrar('pagar');
}
$('#copiar').onclick = async () => {
  try { await navigator.clipboard.writeText($('#pixCodigo').textContent); $('#copiar').firstElementChild.textContent = 'Copiado! ✓'; }
  catch { getSelection().selectAllChildren($('#pixCodigo')); }
  setTimeout(() => ($('#copiar').firstElementChild.textContent = 'Copiar código PIX'), 2500);
};

async function consultar(id) {
  const r = await fetch(`${FUNCOES}/status-pedido?id=${encodeURIComponent(id)}`, { headers: { apikey: SUPABASE_ANON_KEY } });
  if (!r.ok) throw new Error('status');
  return r.json();
}
function exibirStatus(d) {
  if (d.status === 'pago' || d.status === 'pago_fora_prazo') {
    const fora = d.status === 'pago_fora_prazo';
    $('#sucesso h2').textContent = fora ? 'Pagamento recebido fora do prazo' : 'Inscrição confirmada!';
    $('#sucesso h2').style.color = fora ? 'var(--dourado)' : 'var(--verde)';
    $('#sucesso p').textContent = fora ? 'A chave já estava fechada. A organização vai entrar em contato para a devolução.' : 'Pagamento recebido. Bom campeonato!';
    $('#sucLista').innerHTML = d.inscricoes.map(i => `<li><b>${esc(i.nome)}</b> — ${esc(i.categoria)}${i.status === 'pago_fora_prazo' ? ' <span class="selo">devolução</span>' : ''}</li>`).join('');
    if (d.grupoWhatsapp) $('#grupoLink').href = d.grupoWhatsapp;
    $('#grupoZap').classList.toggle('oculto', fora || !d.grupoWhatsapp);
    mostrar('sucesso');
    return true;
  }
  if (d.status === 'expirado' || d.status === 'cancelado') { mostrar('expirado'); return true; }
  if (d.status === 'pendente') mostrarPix(d);
  return false;
}
function acompanhar(id) {
  const t = setInterval(async () => {
    try { if (exibirStatus(await consultar(id))) clearInterval(t); } catch { /* tenta de novo */ }
  }, 5000);
}

// ---------- funil (anônimo: só um código aleatório do navegador, nenhum dado pessoal) ----------
let visitante = null;
try { visitante = localStorage.getItem('copa_v') || (crypto.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32); localStorage.setItem('copa_v', visitante); } catch { visitante = String(Math.random()).slice(2, 20); }
const marcar = etapa => supa.rpc('registrar_funil', { p_visitante: visitante, p_etapa: etapa }).then(() => {}, () => {});
let comecou = false;
$('#form').addEventListener('input', () => { if (!comecou) { comecou = true; marcar('comecou'); } });

// ---------- início ----------
async function iniciar() {
  $('#termo').innerHTML = TERMO;
  const pedido = new URLSearchParams(location.search).get('pedido');
  if (pedido) {
    try { if (!exibirStatus(await consultar(pedido))) acompanhar(pedido); return; }
    catch { history.replaceState(null, '', location.pathname); }
  }
  const { data } = await supa.from('v_publico_config').select('fase').maybeSingle();
  if ((data && data.fase !== 'inscricoes') || new Date() > FECHAMENTO) { mostrar('encerradas'); return; }
  const { data: acs } = await supa.from('v_academias').select('nome');
  $('#listaAcad').innerHTML = (acs ?? []).filter(a => a.nome !== BRUTUS).map(a => `<option value="${esc(a.nome)}">`).join('');
  marcar('visitou');
  novoAtleta();
  $('#addAtleta').onclick = () => { if ($$('.atleta').length >= 10) return alert('Máximo de 10 atletas por inscrição.'); novoAtleta(); };
  mostrar('form');
}
iniciar();
