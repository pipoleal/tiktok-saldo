/**
 * finance.js
 * Funções financeiras puras: arredondamento, saldo, totais, metas.
 * Nenhuma dependência de DOM ou storage.
 */

const ORIGEM_TIKTOK = 'TIK TOK';
const ORIGEM_MISSOES = 'MISSOES TIK TOK';
const ORIGEM_OUTRO = 'OUTRO';

/**
 * Corrige erros de ponto flutuante arredondando para 2 casas decimais.
 * @param {number} value
 * @returns {number}
 */
function roundMoney(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Soma uma lista de números com arredondamento seguro a cada passo.
 * @param {number[]} values
 * @returns {number}
 */
function sumMoney(values) {
  return roundMoney(values.reduce((acc, v) => roundMoney(acc + v), 0));
}

/**
 * Ordena lançamentos cronologicamente (data crescente, depois criadoEm crescente).
 * Não muta o array original.
 * @param {Array} lancamentos
 * @returns {Array}
 */
function sortChronological(lancamentos) {
  return [...lancamentos].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    const aCriado = a.criadoEm || '';
    const bCriado = b.criadoEm || '';
    if (aCriado !== bCriado) return aCriado < bCriado ? -1 : 1;
    return 0;
  });
}

/**
 * Calcula o saldo acumulado (running balance) para cada lançamento em ordem cronológica.
 * Ganhos somam, saques subtraem.
 * @param {Array} lancamentos
 * @returns {Array} lançamentos com propriedade saldoAcumulado adicionada (não muta originais)
 */
function computeRunningBalances(lancamentos) {
  const ordenados = sortChronological(lancamentos);
  let saldo = 0;
  return ordenados.map((item) => {
    const delta = item.tipo === 'saque' ? -item.valorDolar : item.valorDolar;
    saldo = roundMoney(saldo + delta);
    return { ...item, saldoAcumulado: saldo };
  });
}

/**
 * Calcula o saldo disponível total (ganhos - saques).
 * @param {Array} lancamentos
 * @returns {number}
 */
function calculateBalance(lancamentos) {
  const ganhos = lancamentos.filter((l) => l.tipo === 'ganho');
  const saques = lancamentos.filter((l) => l.tipo === 'saque');
  const totalGanhos = sumMoney(ganhos.map((l) => l.valorDolar));
  const totalSaques = sumMoney(saques.map((l) => l.valorDolar));
  return roundMoney(totalGanhos - totalSaques);
}

/**
 * Calcula todos os totais usados no dashboard.
 * @param {Array} lancamentos
 * @returns {object}
 */
function getTotals(lancamentos) {
  const ganhos = lancamentos.filter((l) => l.tipo === 'ganho');
  const saques = lancamentos.filter((l) => l.tipo === 'saque');

  const totalTikTok = sumMoney(
    ganhos.filter((l) => l.origem === ORIGEM_TIKTOK).map((l) => l.valorDolar)
  );
  const totalMissoes = sumMoney(
    ganhos.filter((l) => l.origem === ORIGEM_MISSOES).map((l) => l.valorDolar)
  );
  const totalOutros = sumMoney(
    ganhos
      .filter((l) => l.origem !== ORIGEM_TIKTOK && l.origem !== ORIGEM_MISSOES)
      .map((l) => l.valorDolar)
  );
  const totalGanhos = sumMoney(ganhos.map((l) => l.valorDolar));
  const totalSaques = sumMoney(saques.map((l) => l.valorDolar));
  const saldoDisponivel = roundMoney(totalGanhos - totalSaques);

  return {
    totalTikTok,
    totalMissoes,
    totalOutros,
    totalGanhos,
    totalSaques,
    saldoDisponivel,
  };
}

/**
 * Retorna a segunda-feira (início da semana) da data informada, em ISO (YYYY-MM-DD).
 * @param {Date} date
 * @returns {string}
 */
function getWeekStartISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domingo, 1 = segunda...
  const diff = day === 0 ? -6 : 1 - day; // volta até a segunda-feira
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

/**
 * Converte um Date para string ISO YYYY-MM-DD (local, sem timezone shift).
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula o total de ganhos da semana atual (segunda a domingo).
 * @param {Array} lancamentos
 * @param {Date} referencia
 * @returns {{total: number, weekStart: string, weekEnd: string, days: number}}
 */
function calculateWeeklyTotal(lancamentos, referencia = new Date()) {
  const weekStart = getWeekStartISO(referencia);
  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = toISODate(weekEndDate);

  const doSemana = lancamentos.filter(
    (l) => l.tipo === 'ganho' && l.data >= weekStart && l.data <= weekEnd
  );
  const total = sumMoney(doSemana.map((l) => l.valorDolar));

  return { total, weekStart, weekEnd };
}

/**
 * Calcula o progresso de uma meta.
 * @param {number} atual
 * @param {number} meta
 * @returns {{percentual: number, percentualVisual: number, falta: number}}
 */
function calculateGoalProgress(atual, meta) {
  if (!meta || meta <= 0) {
    return { percentual: 0, percentualVisual: 0, falta: 0 };
  }
  const percentual = roundMoney((atual / meta) * 100);
  const percentualVisual = Math.min(100, Math.max(0, percentual));
  const falta = roundMoney(Math.max(0, meta - atual));
  return { percentual, percentualVisual, falta };
}

/**
 * Agrupa ganhos por data (ISO) somando valores, útil para gráfico de evolução.
 * @param {Array} lancamentos
 * @returns {Array<{data: string, total: number}>} ordenado por data crescente
 */
function groupGanhosPorDia(lancamentos) {
  const ganhos = lancamentos.filter((l) => l.tipo === 'ganho');
  const mapa = new Map();
  ganhos.forEach((l) => {
    const atual = mapa.get(l.data) || 0;
    mapa.set(l.data, roundMoney(atual + l.valorDolar));
  });
  return Array.from(mapa.entries())
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

/**
 * Filtra lançamentos por período pré-definido.
 * @param {Array} lancamentos
 * @param {'hoje'|'semana'|'mes'|'personalizado'} periodo
 * @param {{inicio?: string, fim?: string}} customRange
 * @returns {Array}
 */
function filterByPeriod(lancamentos, periodo, customRange = {}) {
  if (!periodo || periodo === 'todos') return lancamentos;
  const hoje = new Date();
  const hojeISO = toISODate(hoje);

  if (periodo === 'hoje') {
    return lancamentos.filter((l) => l.data === hojeISO);
  }
  if (periodo === 'semana') {
    const weekStart = getWeekStartISO(hoje);
    const weekEndDate = new Date(weekStart + 'T00:00:00');
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = toISODate(weekEndDate);
    return lancamentos.filter((l) => l.data >= weekStart && l.data <= weekEnd);
  }
  if (periodo === 'mes') {
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const fimMesDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const fimMes = toISODate(fimMesDate);
    return lancamentos.filter((l) => l.data >= inicioMes && l.data <= fimMes);
  }
  if (periodo === 'personalizado') {
    const { inicio, fim } = customRange;
    return lancamentos.filter((l) => {
      if (inicio && l.data < inicio) return false;
      if (fim && l.data > fim) return false;
      return true;
    });
  }
  return lancamentos;
}

/**
 * Filtra lançamentos por categoria/tipo (para os filtros do dashboard).
 * @param {Array} lancamentos
 * @param {'todos'|'tiktok'|'missoes'|'saques'} categoria
 * @returns {Array}
 */
function filterByCategory(lancamentos, categoria) {
  if (!categoria || categoria === 'todos') return lancamentos;
  if (categoria === 'tiktok') {
    return lancamentos.filter((l) => l.tipo === 'ganho' && l.origem === ORIGEM_TIKTOK);
  }
  if (categoria === 'missoes') {
    return lancamentos.filter((l) => l.tipo === 'ganho' && l.origem === ORIGEM_MISSOES);
  }
  if (categoria === 'saques') {
    return lancamentos.filter((l) => l.tipo === 'saque');
  }
  return lancamentos;
}

// Exposto globalmente (sem módulos ES para simplicidade em file:// e GitHub Pages)
window.Finance = {
  ORIGEM_TIKTOK,
  ORIGEM_MISSOES,
  ORIGEM_OUTRO,
  roundMoney,
  sumMoney,
  sortChronological,
  computeRunningBalances,
  calculateBalance,
  getTotals,
  getWeekStartISO,
  toISODate,
  calculateWeeklyTotal,
  calculateGoalProgress,
  groupGanhosPorDia,
  filterByPeriod,
  filterByCategory,
};
