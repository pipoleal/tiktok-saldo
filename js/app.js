/**
 * app.js
 * Ponto de entrada: estado da aplicação, orquestração entre storage, finance,
 * exchange-rate e ui. Não contém regras financeiras nem manipulação de DOM direta
 * fora do necessário para orquestrar eventos.
 */

const AppState = {
  lancamentos: [],
  cotacao: null,
  config: null,
  filtros: {
    categoria: 'todos',
    periodo: 'todos',
    customInicio: null,
    customFim: null,
    ordenacao: 'recentes',
  },
};

/**
 * Converte uma string de valor no formato brasileiro (ex: "1.234,56" ou "2,56")
 * para número (ex: 1234.56). Retorna NaN se inválido.
 * @param {string} str
 * @returns {number}
 */
function parseMoneyInput(str) {
  if (typeof str !== 'string') return NaN;
  const limpo = str.trim();
  if (!limpo) return NaN;
  // remove separador de milhar (ponto) e troca vírgula decimal por ponto
  const normalizado = limpo.replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(normalizado);
  return Number.isFinite(valor) ? valor : NaN;
}

// ---------- Recalcular tudo e re-renderizar ----------

function recalcAndRender() {
  AppState.lancamentos = Storage.getLancamentos();
  AppState.config = Storage.getConfig();

  UI.renderDashboard({
    lancamentos: AppState.lancamentos,
    cotacao: AppState.cotacao,
    config: AppState.config,
  });

  renderFilteredTable();
  UI.renderChart(AppState.lancamentos);
}

function renderFilteredTable() {
  const { categoria, periodo, customInicio, customFim, ordenacao } = AppState.filtros;

  // saldo acumulado sempre calculado sobre TODOS os lançamentos, em ordem cronológica
  const comSaldo = Finance.computeRunningBalances(AppState.lancamentos);
  const porId = new Map(comSaldo.map((l) => [l.id, l]));

  let filtrados = Finance.filterByCategory(AppState.lancamentos, categoria);
  filtrados = Finance.filterByPeriod(filtrados, periodo, { inicio: customInicio, fim: customFim });

  // aplica o saldo acumulado calculado globalmente
  filtrados = filtrados.map((l) => porId.get(l.id) || l);

  // ordena cronologicamente e depois inverte se necessário
  filtrados = Finance.sortChronological(filtrados);
  if (ordenacao === 'recentes') filtrados = filtrados.reverse();

  // Ao filtrar por Missões, a tabela prioriza a exibição em Real (R$).
  const moedaPrincipal = categoria === 'missoes' ? 'brl' : 'usd';
  UI.renderLancamentos(filtrados, AppState.cotacao, { moedaPrincipal });
}

// ---------- Cotação ----------

async function refreshRate({ silent = false } = {}) {
  const resultado = await ExchangeRate.getExchangeRate();
  AppState.cotacao = resultado;

  if (!resultado) {
    UI.openModal('manualRateModal');
  } else if (!silent && resultado.stale) {
    UI.showToast('Não foi possível atualizar a cotação. Usando a última cotação disponível.', 'warning');
  } else if (!silent) {
    UI.showToast('Cotação atualizada com sucesso.', 'success');
  }

  recalcAndRender();
}

// ---------- Formulário de lançamento ----------

function handleFormSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('formId').value;
  const origemSelecionada = document.getElementById('formOrigem').value;
  const novaCategoria = document.getElementById('formNovaCategoria').value.trim();
  const dataISO = document.getElementById('formData').value;
  const tipo = document.getElementById('formTipo').value;
  const valorStr = document.getElementById('formValor').value;
  const observacao = document.getElementById('formObservacao').value.trim();

  const valor = parseMoneyInput(valorStr);

  if (!dataISO) {
    UI.showToast('Informe uma data válida.', 'error');
    return;
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    UI.showToast('Informe um valor válido maior que zero (ex: 2,56).', 'error');
    return;
  }

  let origem = origemSelecionada;
  if (novaCategoria) {
    origem = novaCategoria.toUpperCase();
    const config = Storage.getConfig();
    if (!config.categorias.includes(origem)) {
      const categorias = [...config.categorias, origem];
      Storage.updateConfig({ categorias });
      UI.renderOrigemOptions(categorias, origem);
    }
  }

  const dados = { tipo, origem, data: dataISO, valorDolar: valor, observacao };

  if (id) {
    Storage.updateLancamento(id, dados);
    UI.showToast('✓ Lançamento atualizado', 'success');
  } else {
    Storage.addLancamento(dados);
    UI.showToast('✓ Lançamento adicionado', 'success');
  }

  UI.resetForm();
  document.getElementById('formNovaCategoria').value = '';
  const config = Storage.getConfig();
  UI.renderOrigemOptions(config.categorias, config.categorias[0]);
  recalcAndRender();
}

function handleCancelEdit() {
  UI.resetForm();
  document.getElementById('formNovaCategoria').value = '';
}

function handleTableClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === 'edit') {
    const item = AppState.lancamentos.find((l) => l.id === id);
    if (item) UI.fillFormForEdit(item);
    return;
  }

  if (action === 'delete') {
    UI.askConfirm('Tem certeza que deseja excluir este lançamento?', () => {
      Storage.deleteLancamento(id);
      UI.showToast('✓ Lançamento removido', 'success');
      recalcAndRender();
    });
  }
}

// ---------- Filtros ----------

function handleCategoriaFilterClick(event) {
  const btn = event.target.closest('button[data-filter-categoria]');
  if (!btn) return;
  document.querySelectorAll('[data-filter-categoria]').forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  AppState.filtros.categoria = btn.dataset.filterCategoria;
  renderFilteredTable();
}

function handlePeriodoChange() {
  const valor = document.getElementById('filterPeriodo').value;
  AppState.filtros.periodo = valor;
  const custom = valor === 'personalizado';
  document.getElementById('filterInicio').classList.toggle('hidden', !custom);
  document.getElementById('filterFim').classList.toggle('hidden', !custom);
  renderFilteredTable();
}

function handleCustomRangeChange() {
  AppState.filtros.customInicio = document.getElementById('filterInicio').value || null;
  AppState.filtros.customFim = document.getElementById('filterFim').value || null;
  renderFilteredTable();
}

function handleOrdenacaoChange() {
  AppState.filtros.ordenacao = document.getElementById('filterOrdenacao').value;
  renderFilteredTable();
}

// ---------- Configurações ----------

function openSettingsModal() {
  const config = Storage.getConfig();
  document.getElementById('cfgMetaPrincipal').value = config.metaPrincipal.toFixed(2).replace('.', ',');
  document.getElementById('cfgMetaSecundaria').value = config.metaSecundaria.toFixed(2).replace('.', ',');
  document.getElementById('cfgMetaSemanal').value = config.metaSemanal.toFixed(2).replace('.', ',');
  document.getElementById('cfgMetaSaque').value = config.metaSaqueDolar.toFixed(2).replace('.', ',');
  document.getElementById('cfgMetaSaqueSecundaria').value = config.metaSaqueSecundaria
    .toFixed(2)
    .replace('.', ',');
  document.getElementById('cfgCotacaoManual').value = config.cotacaoManual
    ? config.cotacaoManual.toFixed(2).replace('.', ',')
    : '';
  UI.openModal('settingsModal');
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const campos = {
    metaPrincipal: parseMoneyInput(document.getElementById('cfgMetaPrincipal').value),
    metaSecundaria: parseMoneyInput(document.getElementById('cfgMetaSecundaria').value),
    metaSemanal: parseMoneyInput(document.getElementById('cfgMetaSemanal').value),
    metaSaqueDolar: parseMoneyInput(document.getElementById('cfgMetaSaque').value),
    metaSaqueSecundaria: parseMoneyInput(document.getElementById('cfgMetaSaqueSecundaria').value),
  };

  for (const [chave, valor] of Object.entries(campos)) {
    if (!Number.isFinite(valor) || valor <= 0) {
      UI.showToast('Todas as metas devem ser números maiores que zero.', 'error');
      return;
    }
    void chave;
  }

  const cotacaoManualStr = document.getElementById('cfgCotacaoManual').value.trim();
  let cotacaoManual = null;
  if (cotacaoManualStr) {
    const valor = parseMoneyInput(cotacaoManualStr);
    if (!Number.isFinite(valor) || valor <= 0) {
      UI.showToast('Cotação manual inválida.', 'error');
      return;
    }
    cotacaoManual = Finance.roundMoney(valor);
  }

  Storage.updateConfig({ ...campos, cotacaoManual });

  if (cotacaoManual && (!AppState.cotacao || AppState.cotacao.source === 'Manual')) {
    AppState.cotacao = { rate: cotacaoManual, source: 'Manual', timestamp: new Date().toISOString(), manual: true };
    Storage.saveCotacao(AppState.cotacao);
  }

  UI.closeModal('settingsModal');
  UI.showToast('Configurações salvas.', 'success');
  recalcAndRender();
}

function handleEditMetaSemanal() {
  const config = Storage.getConfig();
  const atual = config.metaSemanal.toFixed(2).replace('.', ',');
  const novo = window.prompt('Nova meta semanal (US$):', atual);
  if (novo === null) return;
  const valor = parseMoneyInput(novo);
  if (!Number.isFinite(valor) || valor <= 0) {
    UI.showToast('Valor inválido para a meta semanal.', 'error');
    return;
  }
  Storage.updateConfig({ metaSemanal: Finance.roundMoney(valor) });
  UI.showToast('Meta semanal atualizada.', 'success');
  recalcAndRender();
}

// ---------- Cotação manual obrigatória ----------

function handleManualRateSave() {
  const valor = parseMoneyInput(document.getElementById('manualRateInput').value);
  if (!Number.isFinite(valor) || valor <= 0) {
    UI.showToast('Informe uma cotação válida (ex: 5,40).', 'error');
    return;
  }
  AppState.cotacao = ExchangeRate.setManualRate(valor);
  UI.closeModal('manualRateModal');
  UI.showToast('Cotação manual salva.', 'success');
  recalcAndRender();
}

// ---------- Backup ----------

function handleClearAll() {
  UI.askConfirm(
    'Tem certeza que deseja apagar TODOS os lançamentos? Esta ação não pode ser desfeita.',
    () => {
      Storage.clearAllLancamentos();
      UI.showToast('Todos os dados foram apagados.', 'success');
      recalcAndRender();
    }
  );
}

async function handleImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;

  const resultado = await ExportImport.importBackupFile(file);
  if (!resultado.ok) {
    UI.showToast(`Falha ao importar: ${resultado.error}`, 'error');
    return;
  }

  const config = Storage.getConfig();
  UI.renderOrigemOptions(config.categorias, config.categorias[0]);
  UI.showToast(`✓ Backup importado (${resultado.total} lançamentos).`, 'success');
  recalcAndRender();
}

// ---------- Tema ----------

function toggleTheme() {
  const atual = Storage.getConfig().tema === 'dark' ? 'dark' : 'light';
  const novo = atual === 'dark' ? 'light' : 'dark';
  Storage.updateConfig({ tema: novo });
  UI.applyTheme(novo);
  UI.renderChart(AppState.lancamentos);
}

// ---------- Seed inicial ----------

function initSeedIfNeeded() {
  const status = Storage.getSeedStatus();
  const lancamentosExistentes = Storage.getLancamentos();

  // Primeira execução: nenhum status salvo e nenhum lançamento — carrega os
  // dados de exemplo já como lançamentos, mas mantém o status "pendente" até
  // o usuário confirmar ou descartar via o banner.
  if (!status && lancamentosExistentes.length === 0) {
    Storage.confirmSeedData();
    Storage.setSeedStatus('pendente');
    document.getElementById('seedBanner').classList.remove('hidden');
    return;
  }

  // Sessão anterior encerrada sem decisão: reexibe o banner.
  if (status === 'pendente') {
    document.getElementById('seedBanner').classList.remove('hidden');
  }
}

function handleSeedConfirm() {
  Storage.setSeedStatus('confirmado');
  document.getElementById('seedBanner').classList.add('hidden');
  UI.showToast('Dados de exemplo confirmados como reais.', 'success');
}

function handleSeedDiscard() {
  UI.askConfirm('Deseja descartar os dados de exemplo e começar com o sistema vazio?', () => {
    Storage.discardSeedData();
    document.getElementById('seedBanner').classList.add('hidden');
    UI.showToast('Dados de exemplo descartados.', 'success');
    recalcAndRender();
  });
}

// ---------- Inicialização ----------

function bindEvents() {
  document.getElementById('lancamentoForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('btnCancelEdit').addEventListener('click', handleCancelEdit);

  document.getElementById('lancamentosTableBody').addEventListener('click', handleTableClick);
  document.getElementById('lancamentosCards').addEventListener('click', handleTableClick);

  document
    .querySelectorAll('[data-filter-categoria]')
    .forEach((btn) => btn.addEventListener('click', handleCategoriaFilterClick));
  document.getElementById('filterPeriodo').addEventListener('change', handlePeriodoChange);
  document.getElementById('filterInicio').addEventListener('change', handleCustomRangeChange);
  document.getElementById('filterFim').addEventListener('change', handleCustomRangeChange);
  document.getElementById('filterOrdenacao').addEventListener('change', handleOrdenacaoChange);

  document.getElementById('btnRefreshRate').addEventListener('click', () => refreshRate());

  document.getElementById('btnSettings').addEventListener('click', openSettingsModal);
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
  document.getElementById('btnEditMetaSemanal').addEventListener('click', handleEditMetaSemanal);

  document.getElementById('btnManualRateSave').addEventListener('click', handleManualRateSave);

  document.getElementById('btnExportJSON').addEventListener('click', () => ExportImport.exportJSON());
  document.getElementById('btnExportCSV').addEventListener('click', () => ExportImport.exportCSV());
  document.getElementById('btnImportJSON').addEventListener('click', () =>
    document.getElementById('fileImportInput').click()
  );
  document.getElementById('fileImportInput').addEventListener('change', handleImportFile);
  document.getElementById('btnClearAll').addEventListener('click', handleClearAll);

  document.getElementById('btnSeedConfirm').addEventListener('click', handleSeedConfirm);
  document.getElementById('btnSeedDiscard').addEventListener('click', handleSeedDiscard);

  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => UI.closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.classList.add('hidden');
    });
  });
}

async function init() {
  UI.initConfirmModal();

  const config = Storage.getConfig();
  UI.applyTheme(config.tema);

  UI.renderOrigemOptions(config.categorias, config.categorias[0]);
  UI.resetForm();

  bindEvents();

  initSeedIfNeeded();

  AppState.cotacao = Storage.getCotacao();
  recalcAndRender();

  await refreshRate({ silent: true });
  ExchangeRate.startAutoRefresh((resultado) => {
    AppState.cotacao = resultado;
    recalcAndRender();
  });
}

document.addEventListener('DOMContentLoaded', init);
