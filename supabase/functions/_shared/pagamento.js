// Regras de pagamento (sem dependência de Deno/Node).
export const FECHAMENTO = new Date('2026-12-02T23:59:59-04:00');

export function expiracaoPix(agora = new Date()) {
  const em24h = new Date(agora.getTime() + 24 * 3600 * 1000);
  return em24h < FECHAMENTO ? em24h : FECHAMENTO;
}

// 'confirmar' | 'fora_prazo' | 'ignorar'
export function decidirWebhook({ pedido, fase }) {
  if (!['pendente', 'expirado'].includes(pedido.status)) return 'ignorar';
  if (['publicada', 'evento', 'encerrado'].includes(fase)) return 'fora_prazo';
  return 'confirmar';
}

// Ao confirmar um pagamento: inscrições cujo atleta/modalidade já está confirmado em outro pedido não entram (vão para devolução).
export function separarDuplicadas(inscricoes, dupsJaConfirmados) {
  const confirmar = [], duplicadas = [];
  for (const i of inscricoes) (dupsJaConfirmados.has(i.dup_chave) ? duplicadas : confirmar).push(i.id);
  return { confirmar, duplicadas };
}
