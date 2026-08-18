/**
 * storage.js
 * Camada de acesso ao localStorage. Toda a persistência do app passa por aqui.
 * Trata indisponibilidade do localStorage (modo privado, cota excedida, etc).
 */

const STORAGE_KEYS = {
  LANCAMENTOS: 'tiktokSaldo.lancamentos',
  CONFIG: 'tiktokSaldo.config',
  COTACAO: 'tiktokSaldo.cotacao',
  SEED_STATUS: 'tiktokSaldo.seedStatus', // 'pendente' | 'confirmado' | 'descartado'
};

const DEFAULT_CONFIG = {
  metaPrincipal: 7000,
  metaSecundaria: 40000,
  metaSemanal: 40000,
  metaSaqueDolar: 450,
  metaSaqueSecundaria: 2500,
  cotacaoManual: null,
  tema: 'light',
  categorias: ['TIK TOK', 'MISSOES TIK TOK', 'OUTRO'],
};

/**
 * Verifica se o localStorage está disponível no ambiente atual.
 * @returns {boolean}
 */
function isStorageAvailable() {
  try {
    const testKey = '__tiktokSaldo_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const STORAGE_OK = isStorageAvailable();
let memoryFallback = {}; // usado somente se localStorage não estiver disponível

function safeGet(key) {
  try {
    if (STORAGE_OK) return window.localStorage.getItem(key);
    return memoryFallback[key] ?? null;
  } catch (e) {
    console.warn('Falha ao ler do localStorage:', e);
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (STORAGE_OK) {
      window.localStorage.setItem(key, value);
    } else {
      memoryFallback[key] = value;
    }
    return true;
  } catch (e) {
    console.warn('Falha ao salvar no localStorage (dados podem não persistir):', e);
    memoryFallback[key] = value;
    return false;
  }
}

function readJSON(key, fallback) {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Dados corrompidos em "${key}", usando padrão.`, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  return safeSet(key, JSON.stringify(value));
}

/**
 * Gera um id único simples (sem dependência externa).
 * @returns {string}
 */
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Lançamentos ----------

function getLancamentos() {
  return readJSON(STORAGE_KEYS.LANCAMENTOS, []);
}

function saveLancamentos(lancamentos) {
  return writeJSON(STORAGE_KEYS.LANCAMENTOS, lancamentos);
}

function addLancamento(lancamento) {
  const lancamentos = getLancamentos();
  const novo = {
    id: generateId(),
    tipo: lancamento.tipo,
    origem: lancamento.origem,
    data: lancamento.data,
    valorDolar: Finance.roundMoney(lancamento.valorDolar),
    observacao: lancamento.observacao || '',
    criadoEm: new Date().toISOString(),
  };
  lancamentos.push(novo);
  saveLancamentos(lancamentos);
  return novo;
}

function updateLancamento(id, dados) {
  const lancamentos = getLancamentos();
  const idx = lancamentos.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  lancamentos[idx] = {
    ...lancamentos[idx],
    ...dados,
    valorDolar: Finance.roundMoney(dados.valorDolar ?? lancamentos[idx].valorDolar),
  };
  saveLancamentos(lancamentos);
  return lancamentos[idx];
}

function deleteLancamento(id) {
  const lancamentos = getLancamentos();
  const filtrados = lancamentos.filter((l) => l.id !== id);
  saveLancamentos(filtrados);
  return filtrados.length !== lancamentos.length;
}

function clearAllLancamentos() {
  saveLancamentos([]);
}

// ---------- Configuração ----------

function getConfig() {
  const saved = readJSON(STORAGE_KEYS.CONFIG, null);
  if (!saved) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...saved };
}

function saveConfig(config) {
  return writeJSON(STORAGE_KEYS.CONFIG, config);
}

function updateConfig(partial) {
  const atual = getConfig();
  const novo = { ...atual, ...partial };
  saveConfig(novo);
  return novo;
}

// ---------- Cotação ----------

function getCotacao() {
  return readJSON(STORAGE_KEYS.COTACAO, null);
}

function saveCotacao(cotacao) {
  return writeJSON(STORAGE_KEYS.COTACAO, cotacao);
}

// ---------- Seed / dados de exemplo ----------

const SEED_GANHOS = [
  { origem: 'TIK TOK', data: '2026-08-13', valorDolar: 2.56 },
  { origem: 'TIK TOK', data: '2026-08-13', valorDolar: 0.07 },
  { origem: 'TIK TOK', data: '2026-08-14', valorDolar: 8.65 },
  { origem: 'TIK TOK', data: '2026-08-17', valorDolar: 1.54 },
  { origem: 'MISSOES TIK TOK', data: '2026-08-17', valorDolar: 5.49 },
  { origem: 'TIK TOK', data: '2026-08-17', valorDolar: 0.40 },
  { origem: 'MISSOES TIK TOK', data: '2026-08-17', valorDolar: 5.82 },
];

const SEED_SAQUES = [
  { origem: 'TIK TOK', data: '2026-08-17', valorDolar: 0.44 },
  { origem: 'TIK TOK', data: '2026-08-18', valorDolar: 0.07 },
];

function getSeedStatus() {
  return safeGet(STORAGE_KEYS.SEED_STATUS);
}

function setSeedStatus(status) {
  safeSet(STORAGE_KEYS.SEED_STATUS, status);
}

/**
 * Monta os lançamentos de exemplo (sem persistir ainda).
 *
 * Os timestamps de criação são deliberadamente no PASSADO (base - N segundos),
 * nunca no futuro. Isso garante que qualquer lançamento real adicionado pelo
 * usuário logo após o carregamento da página — inclusive na mesma data de um
 * lançamento de exemplo, o que pode acontecer já que os dados de exemplo usam
 * datas fixas que podem coincidir com o dia atual — sempre seja ordenado
 * corretamente como o mais recente no desempate por data.
 * @returns {Array}
 */
function buildSeedLancamentos() {
  const itens = [
    ...SEED_GANHOS.map((item) => ({ ...item, tipo: 'ganho' })),
    ...SEED_SAQUES.map((item) => ({ ...item, tipo: 'saque' })),
  ];
  const base = Date.now();
  const total = itens.length;
  return itens.map((item, index) => ({
    id: generateId(),
    tipo: item.tipo,
    origem: item.origem,
    data: item.data,
    valorDolar: Finance.roundMoney(item.valorDolar),
    observacao: '',
    criadoEm: new Date(base - (total - index) * 1000).toISOString(),
  }));
}

/**
 * Confirma o uso dos dados de exemplo, gravando-os como lançamentos reais.
 */
function confirmSeedData() {
  const seed = buildSeedLancamentos();
  saveLancamentos(seed);
  setSeedStatus('confirmado');
}

/**
 * Descarta os dados de exemplo, deixando o sistema vazio.
 */
function discardSeedData() {
  saveLancamentos([]);
  setSeedStatus('descartado');
}

// Exposto globalmente
window.Storage = {
  STORAGE_OK,
  DEFAULT_CONFIG,
  getLancamentos,
  saveLancamentos,
  addLancamento,
  updateLancamento,
  deleteLancamento,
  clearAllLancamentos,
  getConfig,
  saveConfig,
  updateConfig,
  getCotacao,
  saveCotacao,
  getSeedStatus,
  setSeedStatus,
  confirmSeedData,
  discardSeedData,
  generateId,
};
