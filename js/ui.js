/**
 * ui.js
 * Toda a manipulação de DOM/renderização. Não contém regras financeiras
 * (essas ficam em finance.js) nem acesso direto ao localStorage (storage.js).
 */

const UI = {};

// ---------- Toasts ----------

UI.showToast = function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
};

// ---------- Modais ----------

UI.openModal = function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};

UI.closeModal = function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

let confirmCallback = null;

UI.askConfirm = function askConfirm(text, onConfirm) {
  document.getElementById('confirmModalText').textContent = text;
  confirmCallback = onConfirm;
  UI.openModal('confirmModal');
};

UI.initConfirmModal = function initConfirmModal() {
  document.getElementById('confirmModalOk').addEventListener('click', () => {
    UI.closeModal('confirmModal');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
  document.getElementById('confirmModalCancel').addEventListener('click', () => {
    UI.closeModal('confirmModal');
    confirmCallback = null;
  });
};

// ---------- Select de origem ----------

UI.renderOrigemOptions = function renderOrigemOptions(categorias, selectedValue) {
  const select = document.getElementById('formOrigem');
  select.innerHTML = '';
  categorias.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selectedValue) opt.selected = true;
    select.appendChild(opt);
  });
};

// ---------- Dashboard ----------

UI.renderRateBar = function renderRateBar(cotacao) {
  const rateValueEl = document.getElementById('rateValue');
  const rateUpdatedEl = document.getElementById('rateUpdatedAt');
  const warningEl = document.getElementById('rateWarning');
  const warningTextEl = document.getElementById('rateWarningText');

  if (!cotacao) {
    rateValueEl.textContent = 'US$ 1 = R$ —';
    rateUpdatedEl.textContent = 'Cotação indisponível. Configure uma cotação manual.';
    warningEl.classList.remove('hidden');
    warningTextEl.textContent =
      'Não foi possível obter a cotação automaticamente e não há cotação salva. Informe uma cotação manual em Configurações.';
    return;
  }

  rateValueEl.textContent = `US$ 1 = ${ExchangeRate.formatBrl(cotacao.rate)}`;
  rateUpdatedEl.textContent = `Última atualização: ${ExchangeRate.formatDateTimeBr(cotacao.timestamp)}${
    cotacao.manual ? ' (manual)' : ''
  }`;

  if (cotacao.stale) {
    warningEl.classList.remove('hidden');
    warningTextEl.textContent =
      'Não foi possível atualizar a cotação. Utilizando a última cotação disponível.';
  } else {
    warningEl.classList.add('hidden');
  }
};

UI.renderDashboard = function renderDashboard({ lancamentos, cotacao, config }) {
  const totals = Finance.getTotals(lancamentos);
  const rate = cotacao ? cotacao.rate : 0;

  document.getElementById('heroBalanceUsd').textContent = ExchangeRate.formatUsd(totals.saldoDisponivel);
  document.getElementById('heroBalanceBrl').textContent = ExchangeRate.formatBrl(
    ExchangeRate.convertUsdToBrl(totals.saldoDisponivel, rate)
  );

  document.getElementById('cardTotalRecebido').textContent = ExchangeRate.formatUsd(totals.totalGanhos);
  document.getElementById('cardTotalTikTok').textContent = ExchangeRate.formatUsd(totals.totalTikTok);
  document.getElementById('cardTotalMissoes').textContent = ExchangeRate.formatUsd(totals.totalMissoes);
  document.getElementById('cardTotalSacado').textContent = ExchangeRate.formatUsd(totals.totalSaques);
  document.getElementById('cardSaldoDisponivel').textContent = ExchangeRate.formatUsd(totals.saldoDisponivel);
  document.getElementById('cardSaldoDisponivelBrl').textContent = ExchangeRate.formatBrl(
    ExchangeRate.convertUsdToBrl(totals.saldoDisponivel, rate)
  );

  UI.renderRateBar(cotacao);
  UI.renderGoals({ lancamentos, totals, cotacao, config });
};

function setProgress(barId, percentId, footerTextId, faltaId, atual, meta, atualLabel) {
  const { percentual, percentualVisual, falta } = Finance.calculateGoalProgress(atual, meta);
  document.getElementById(barId).style.width = `${percentualVisual}%`;
  document.getElementById(percentId).textContent = `${percentual.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`;
  if (footerTextId) {
    document.getElementById(footerTextId).textContent = `${atualLabel} / ${ExchangeRate.formatUsd(meta)}`;
  }
  if (faltaId) {
    document.getElementById(faltaId).textContent = `Faltam ${ExchangeRate.formatUsd(falta)}`;
  }
  return { percentual, percentualVisual, falta };
}

UI.renderGoals = function renderGoals({ lancamentos, totals, cotacao, config }) {
  const rate = cotacao ? cotacao.rate : 0;
  const saldo = totals.saldoDisponivel;

  // Meta principal (em USD)
  setProgress(
    'goalPrincipalBar',
    'goalPrincipalPercent',
    'goalPrincipalText',
    'goalPrincipalFalta',
    saldo,
    config.metaPrincipal,
    ExchangeRate.formatUsd(saldo)
  );

  // Meta secundária (equivalente em reais, mas comparada em USD conforme especificação: 40.000 USD)
  setProgress(
    'goalSecundariaBar',
    'goalSecundariaPercent',
    'goalSecundariaText',
    'goalSecundariaFalta',
    saldo,
    config.metaSecundaria,
    ExchangeRate.formatUsd(saldo)
  );

  // Meta semanal
  const semana = Finance.calculateWeeklyTotal(lancamentos);
  const mediaDiaria = Finance.roundMoney(semana.total / 7);
  setProgress(
    'goalSemanalBar',
    'goalSemanalPercent',
    'goalSemanalText',
    'goalSemanalFalta',
    semana.total,
    config.metaSemanal,
    ExchangeRate.formatUsd(semana.total)
  );
  document.getElementById('goalSemanalMedia').textContent = ExchangeRate.formatUsd(mediaDiaria);

  // Saques
  const saqueProgress = setProgress(
    'goalSaqueMetaBar',
    'goalSaqueMetaPercent',
    'goalSaqueMetaText',
    null,
    totals.totalSaques,
    config.metaSaqueDolar,
    ExchangeRate.formatUsd(totals.totalSaques)
  );
  document.getElementById('goalSaqueMetaBrl').textContent = `${ExchangeRate.formatBrl(
    ExchangeRate.convertUsdToBrl(totals.totalSaques, rate)
  )} de ${ExchangeRate.formatBrl(ExchangeRate.convertUsdToBrl(config.metaSaqueDolar, rate))}`;

  setProgress(
    'goalSaqueMaiorBar',
    'goalSaqueMaiorPercent',
    'goalSaqueMaiorText',
    null,
    totals.totalSaques,
    config.metaSaqueSecundaria,
    ExchangeRate.formatUsd(totals.totalSaques)
  );
  document.getElementById('goalSaqueMaiorBrl').textContent = `${ExchangeRate.formatBrl(
    ExchangeRate.convertUsdToBrl(totals.totalSaques, rate)
  )} de ${ExchangeRate.formatBrl(ExchangeRate.convertUsdToBrl(config.metaSaqueSecundaria, rate))}`;

  void saqueProgress;
};

// ---------- Tabela / lista de lançamentos ----------

function origemBadgeClass(origem) {
  if (origem === Finance.ORIGEM_TIKTOK) return 'badge--tiktok';
  if (origem === Finance.ORIGEM_MISSOES) return 'badge--missoes';
  return 'badge--outro';
}

UI.renderLancamentos = function renderLancamentos(lancamentosParaExibir, cotacao, options = {}) {
  const table = document.getElementById('lancamentosTable');
  const tbody = document.getElementById('lancamentosTableBody');
  const cardsList = document.getElementById('lancamentosCards');
  const emptyState = document.getElementById('emptyState');

  tbody.innerHTML = '';
  cardsList.innerHTML = '';

  if (lancamentosParaExibir.length === 0) {
    emptyState.classList.remove('hidden');
    table.classList.add('hidden');
    cardsList.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  table.classList.remove('hidden');
  cardsList.classList.remove('hidden');

  const rate = cotacao ? cotacao.rate : 0;

  lancamentosParaExibir.forEach((item) => {
    const convertido = ExchangeRate.convertUsdToBrl(item.valorDolar, rate);
    const valorSinal = item.tipo === 'saque' ? '−' : '';

    // Linha da tabela (desktop)
    const tr = document.createElement('tr');

    const tdOrigem = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${origemBadgeClass(item.origem)}`;
    badge.textContent = item.origem;
    tdOrigem.appendChild(badge);
    tr.appendChild(tdOrigem);

    const tdData = document.createElement('td');
    tdData.textContent = ExchangeRate.formatDateBr(item.data);
    tr.appendChild(tdData);

    const tdValor = document.createElement('td');
    tdValor.className = `ta-right ${item.tipo === 'saque' ? 'text-danger' : 'text-success'}`;
    tdValor.textContent = `${valorSinal}${ExchangeRate.formatUsd(item.valorDolar)}`;
    tr.appendChild(tdValor);

    const tdSaldo = document.createElement('td');
    tdSaldo.className = 'ta-right';
    tdSaldo.textContent = ExchangeRate.formatUsd(item.saldoAcumulado);
    tr.appendChild(tdSaldo);

    const tdConvertido = document.createElement('td');
    tdConvertido.className = 'ta-right';
    tdConvertido.textContent = ExchangeRate.formatBrl(convertido);
    tr.appendChild(tdConvertido);

    const tdTipo = document.createElement('td');
    tdTipo.textContent = item.tipo === 'ganho' ? 'Ganho' : 'Saque';
    tr.appendChild(tdTipo);

    const tdAcoes = document.createElement('td');
    tdAcoes.className = 'table-actions';
    const btnEdit = document.createElement('button');
    btnEdit.className = 'link-btn';
    btnEdit.type = 'button';
    btnEdit.textContent = 'Editar';
    btnEdit.dataset.action = 'edit';
    btnEdit.dataset.id = item.id;
    const btnDelete = document.createElement('button');
    btnDelete.className = 'link-btn link-btn--danger';
    btnDelete.type = 'button';
    btnDelete.textContent = 'Excluir';
    btnDelete.dataset.action = 'delete';
    btnDelete.dataset.id = item.id;
    tdAcoes.appendChild(btnEdit);
    tdAcoes.appendChild(btnDelete);
    tr.appendChild(tdAcoes);

    tbody.appendChild(tr);

    // Card (mobile)
    const card = document.createElement('div');
    card.className = 'entry-card';

    const cardTop = document.createElement('div');
    cardTop.className = 'entry-card__top';
    const cardBadge = document.createElement('span');
    cardBadge.className = `badge ${origemBadgeClass(item.origem)}`;
    cardBadge.textContent = item.origem;
    const cardDate = document.createElement('span');
    cardDate.className = 'entry-card__date';
    cardDate.textContent = ExchangeRate.formatDateBr(item.data);
    cardTop.appendChild(cardBadge);
    cardTop.appendChild(cardDate);

    const cardValue = document.createElement('div');
    cardValue.className = `entry-card__value ${item.tipo === 'saque' ? 'text-danger' : 'text-success'}`;
    cardValue.textContent = `${valorSinal}${ExchangeRate.formatUsd(item.valorDolar)}`;

    const cardMeta = document.createElement('div');
    cardMeta.className = 'entry-card__meta';
    cardMeta.textContent = `Saldo: ${ExchangeRate.formatUsd(item.saldoAcumulado)} · ${ExchangeRate.formatBrl(convertido)} · ${
      item.tipo === 'ganho' ? 'Ganho' : 'Saque'
    }`;

    card.appendChild(cardTop);
    card.appendChild(cardValue);
    card.appendChild(cardMeta);

    if (item.observacao) {
      const obs = document.createElement('div');
      obs.className = 'entry-card__obs';
      obs.textContent = item.observacao;
      card.appendChild(obs);
    }

    const cardActions = document.createElement('div');
    cardActions.className = 'entry-card__actions';
    const cardBtnEdit = document.createElement('button');
    cardBtnEdit.className = 'link-btn';
    cardBtnEdit.type = 'button';
    cardBtnEdit.textContent = 'Editar';
    cardBtnEdit.dataset.action = 'edit';
    cardBtnEdit.dataset.id = item.id;
    const cardBtnDelete = document.createElement('button');
    cardBtnDelete.className = 'link-btn link-btn--danger';
    cardBtnDelete.type = 'button';
    cardBtnDelete.textContent = 'Excluir';
    cardBtnDelete.dataset.action = 'delete';
    cardBtnDelete.dataset.id = item.id;
    cardActions.appendChild(cardBtnEdit);
    cardActions.appendChild(cardBtnDelete);
    card.appendChild(cardActions);

    cardsList.appendChild(card);
  });

  void options;
};

// ---------- Formulário ----------

UI.fillFormForEdit = function fillFormForEdit(item) {
  document.getElementById('formId').value = item.id;
  document.getElementById('formOrigem').value = item.origem;
  document.getElementById('formData').value = item.data;
  document.getElementById('formTipo').value = item.tipo;
  document.getElementById('formValor').value = item.valorDolar.toFixed(2).replace('.', ',');
  document.getElementById('formObservacao').value = item.observacao || '';
  document.getElementById('formTitle').textContent = 'Editar lançamento';
  document.getElementById('btnSubmitForm').textContent = 'Salvar alterações';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
  document.getElementById('lancamentoForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

UI.resetForm = function resetForm() {
  document.getElementById('lancamentoForm').reset();
  document.getElementById('formId').value = '';
  document.getElementById('formData').valueAsDate = new Date();
  document.getElementById('formTitle').textContent = 'Novo lançamento';
  document.getElementById('btnSubmitForm').textContent = 'Adicionar lançamento';
  document.getElementById('btnCancelEdit').classList.add('hidden');
};

// ---------- Gráfico ----------

let chartInstance = null;

UI.renderChart = function renderChart(lancamentos) {
  const canvas = document.getElementById('earningsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const dados = Finance.groupGanhosPorDia(lancamentos).slice(-30);
  const labels = dados.map((d) => ExchangeRate.formatDateBr(d.data));
  const valores = dados.map((d) => d.total);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#c7cad1' : '#5b616e';

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = valores;
    chartInstance.options.scales.x.ticks.color = textColor;
    chartInstance.options.scales.y.ticks.color = textColor;
    chartInstance.options.scales.x.grid.color = gridColor;
    chartInstance.options.scales.y.grid.color = gridColor;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Ganhos (US$)',
          data: valores,
          backgroundColor: '#6c5ce7',
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ExchangeRate.formatUsd(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (value) => ExchangeRate.formatUsd(value),
          },
          beginAtZero: true,
        },
      },
    },
  });
};

// ---------- Tema ----------

UI.applyTheme = function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('btnThemeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
};

window.UI = UI;
