import { supa, $, $$, esc } from './supa.js';
import { TEMPO_LUTA_MIN } from '../../supabase/functions/_shared/tabelas.js';
import { parseChave } from '../../supabase/functions/_shared/categorias.js';
import { METODOS } from '../../supabase/functions/_shared/resultados.js';

let tatame = 1, admin = false, lutas = [], cats = {}, pessoas = {}, escolha = { venc: null, metodo: null }, ultimo = null;

$('#login').addEventListener('submit', async ev => {
  ev.preventDefault();
  const { error } = await supa.auth.signInWithPassword({ email: $('#lEmail').value, password: $('#lSenha').value });
  if (error) { $('#lErro').textContent = 'E-mail ou senha incorretos.'; return; }
  iniciar();
});
$('#sair').onclick = async e => { e.preventDefault(); await supa.auth.signOut(); location.reload(); };

async function iniciar() {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;
  const { data: p } = await supa.from('perfis').select('papel, tatame').eq('user_id', user.id).maybeSingle();
  if (!p) { $('#lErro').textContent = 'Usuário sem permissão.'; await supa.auth.signOut(); return; }
  admin = p.papel === 'admin';
  tatame = p.tatame ?? 1;
  $('#escolheTat').classList.toggle('oculto', !admin);
  $('#login').classList.add('oculto'); $('#app').classList.remove('oculto'); $('#sair').classList.remove('oculto');
  await carregar();
  supa.channel('mesa').on('postgres_changes', { event: '*', schema: 'public', table: 'lutas' }, () => carregar()).subscribe();
  setInterval(carregar, 20000);
}
$('#escolheTat').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  tatame = Number(b.dataset.t);
  $$('#escolheTat button').forEach(x => x.setAttribute('aria-pressed', x === b));
  escolha = { venc: null, metodo: null };
  desenhar();
};

async function carregar() {
  const [l, c, i] = await Promise.all([
    supa.from('v_publico_lutas').select('*'),
    supa.from('v_publico_categorias').select('chave, rotulo'),
    supa.from('v_publico_inscritos').select('inscricao_id, nome, academia'),
  ]);
  lutas = l.data ?? []; cats = Object.fromEntries((c.data ?? []).map(x => [x.chave, x.rotulo]));
  pessoas = Object.fromEntries((i.data ?? []).map(x => [x.inscricao_id, x]));
  desenhar();
}

const fila = () => lutas.filter(l => l.tatame === tatame && !l.vencedor && l.metodo !== 'bye').sort((a, b) => a.ordem_tatame - b.ordem_tatame);
const nome = id => (id && pessoas[id] ? pessoas[id].nome : 'A definir');
const acad = id => (id && pessoas[id] ? pessoas[id].academia : '');

function desenhar() {
  $('#titulo').textContent = `MESÁRIO · TATAME ${tatame}`;
  const f = fila();
  // primeira luta com os dois atletas definidos
  const atual = f.find(l => l.a1 && l.a2);
  if (!atual) {
    $('#atual').innerHTML = `<div class="atual"><p>${f.length ? 'Aguardando resultado de outras lutas para definir os próximos atletas.' : 'Nenhuma luta pendente neste tatame. 🎉'}</p></div>`;
  } else {
    const c = parseChave(atual.categoria);
    const lado = id => `<button type="button" class="lado" data-venc="${id}" aria-pressed="${escolha.venc === id}">${esc(nome(id))}<small>${esc(acad(id))}</small></button>`;
    $('#atual').innerHTML = `<div class="atual" data-luta="${atual.id}">
      <div class="cat">Luta nº ${atual.ordem_tatame ?? ''} · ${esc(cats[atual.categoria] ?? atual.categoria)}</div>
      <div class="muted">Tempo: ${TEMPO_LUTA_MIN(c.divisaoId, c.faixa)} min · ${atual.papel === 'final' ? 'FINAL' : atual.papel === 'semi' ? 'Semifinal' : atual.papel === 'disputa-prata' ? 'Disputa de prata/bronze' : 'Rodada ' + atual.rodada}</div>
      <p style="margin:10px 0 0"><b>Toque no VENCEDOR:</b></p>
      ${lado(atual.a1)}<div class="vs">×</div>${lado(atual.a2)}
      <p style="margin:10px 0 0"><b>Como venceu:</b></p>
      <div class="metodos">${Object.entries(METODOS).filter(([k]) => k !== 'bye').map(([k, v]) =>
        `<button type="button" data-met="${k}" aria-pressed="${escolha.metodo === k}">${k === 'peso' ? 'Adversário não bateu o peso' : v}</button>`).join('')}</div>
      <button class="btn" id="confirmar" type="button" ${escolha.venc && escolha.metodo ? '' : 'disabled'} style="width:100%"><span>Confirmar resultado</span></button>
      <button class="btn fantasma pequeno" id="adiar" type="button" style="width:100%;margin-top:10px"><span>Chamar depois (atleta no outro tatame)</span></button>
      <p class="erro" id="mErro"></p></div>`;
  }
  $('#proximas').innerHTML = f.filter(l => l !== atual).slice(0, 5).map(l =>
    `<li><b>${esc(nome(l.a1))}</b> × <b>${esc(nome(l.a2))}</b><br><small class="muted">${esc(cats[l.categoria] ?? '')}</small></li>`).join('') || '<li class="muted">—</li>';
}

$('#atual').addEventListener('click', async e => {
  const v = e.target.closest('[data-venc]'), m = e.target.closest('[data-met]');
  if (v) { escolha.venc = v.dataset.venc; desenhar(); return; }
  if (m) { escolha.metodo = m.dataset.met; desenhar(); return; }
  if (e.target.closest('#adiar')) {
    const { error } = await supa.rpc('adiar_luta', { p_luta: $('[data-luta]').dataset.luta });
    if (error) { $('#mErro').textContent = error.message; return; }
    escolha = { venc: null, metodo: null };
    await carregar();
    return;
  }
  if (e.target.closest('#confirmar')) {
    const id = $('[data-luta]').dataset.luta;
    if (!confirm(`Confirmar vitória de ${nome(escolha.venc)} por ${METODOS[escolha.metodo]}?`)) return;
    const { error } = await supa.rpc('registrar_resultado', { p_luta: id, p_vencedor: escolha.venc, p_metodo: escolha.metodo });
    if (error) { $('#mErro').textContent = error.message; return; }
    ultimo = id;
    escolha = { venc: null, metodo: null };
    await carregar();
  }
});

$('#desfazer').onclick = async () => {
  const feitas = lutas.filter(l => l.tatame === tatame && l.vencedor && l.metodo !== 'bye').sort((a, b) => new Date(b.resultado_em) - new Date(a.resultado_em));
  const alvo = feitas.find(l => l.id === ultimo) ?? feitas[0];
  if (!alvo) return alert('Nenhum resultado para desfazer.');
  if (!confirm(`Desfazer o resultado de ${nome(alvo.a1)} × ${nome(alvo.a2)}?`)) return;
  const { error } = await supa.rpc('desfazer_resultado', { p_luta: alvo.id });
  if (error) return alert(error.message);
  ultimo = null;
  await carregar();
};

supa.auth.getSession().then(({ data }) => data.session && iniciar());
