/**
 * exchange-rate.js
 * Busca e cache da cotação USD/BRL. Nenhuma chave de API é necessária —
 * ambas as APIs usadas são públicas e gratuitas, acessíveis direto do navegador.
 */

const RATE_SOURCES = [
  {
    nome: 'AwesomeAPI',
    url: 'https://economia.awesomeapi.com.br/last/USD-BRL',
    parse: (json) => {
      const bid = json && json.USDBRL && json.USDBRL.bid;
      const valor = parseFloat(bid);
      return Number.isFinite(valor) ? valor : null;
    },
  },
  {
    nome: 'open.er-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (json) => {
      const valor = json && json.rates && json.rates.BRL;
      return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
    },
  },
];

const AUTO_REFRESH_MS = 30 * 60 * 1000; // 30 minutos
const FETCH_TIMEOUT_MS = 8000;

let autoRefreshTimer = null;

/**
 * Faz fetch com timeout para não travar a UI se a API não responder.
 */
async function fetchComTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tenta buscar a cotação em cada fonte, na ordem, até obter sucesso.
 * @returns {Promise<{rate: number, source: string, timestamp: string}|null>}
 */
async function fetchFromSources() {
  for (const fonte of RATE_SOURCES) {
    try {
      const json = await fetchComTimeout(fonte.url, FETCH_TIMEOUT_MS);
      const rate = fonte.parse(json);
      if (rate && rate > 0) {
        return { rate: Finance.roundMoney(rate), source: fonte.nome, timestamp: new Date().toISOString() };
      }
    } catch (e) {
      console.warn(`Falha ao buscar cotação em ${fonte.nome}:`, e.message);
    }
  }
  return null;
}

/**
 * Obtém a cotação USD/BRL atual, com estratégia de fallback:
 * 1. Cotação manual configurada pelo usuário (se definida).
 * 2. API pública (AwesomeAPI, depois open.er-api.com).
 * 3. Última cotação salva no localStorage.
 * 4. null (indica que o app deve pedir uma cotação manual).
 *
 * @param {{force?: boolean}} options
 * @returns {Promise<{rate: number, source: string, timestamp: string, manual?: boolean, stale?: boolean}|null>}
 */
async function getExchangeRate(options = {}) {
  const config = Storage.getConfig();
  if (config.cotacaoManual && config.cotacaoManual > 0 && !options.force) {
    // cotação manual tem prioridade apenas quando explicitamente habilitada
    // (o app decide quando usar; aqui apenas expomos a opção via updateConfig)
  }

  const resultado = await fetchFromSources();
  if (resultado) {
    Storage.saveCotacao(resultado);
    return resultado;
  }

  // API falhou: usar última cotação salva
  const ultima = Storage.getCotacao();
  if (ultima && ultima.rate > 0) {
    return { ...ultima, stale: true };
  }

  // Nunca houve cotação: usar manual se existir
  if (config.cotacaoManual && config.cotacaoManual > 0) {
    return {
      rate: config.cotacaoManual,
      source: 'Manual',
      timestamp: new Date().toISOString(),
      manual: true,
    };
  }

  return null;
}

/**
 * Define uma cotação manual informada pelo usuário e a persiste como cotação atual.
 * @param {number} valor
 */
function setManualRate(valor) {
  const rate = Finance.roundMoney(valor);
  const registro = { rate, source: 'Manual', timestamp: new Date().toISOString(), manual: true };
  Storage.saveCotacao(registro);
  Storage.updateConfig({ cotacaoManual: rate });
  return registro;
}

/**
 * Converte um valor em dólar para reais usando a cotação informada.
 * @param {number} usd
 * @param {number} rate
 * @returns {number}
 */
function convertUsdToBrl(usd, rate) {
  if (!rate || rate <= 0) return 0;
  return Finance.roundMoney(usd * rate);
}

/**
 * Formata um valor em dólar no padrão brasileiro: US$ 15,59
 * @param {number} value
 * @returns {string}
 */
function formatUsd(value) {
  const v = Finance.roundMoney(value || 0);
  return `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formata um valor em reais no padrão brasileiro: R$ 85,42
 * @param {number} value
 * @returns {string}
 */
function formatBrl(value) {
  const v = Finance.roundMoney(value || 0);
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para o padrão brasileiro DD/MM/AAAA.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDateBr(isoDate) {
  if (!isoDate) return '';
  const [ano, mes, dia] = isoDate.split('-');
  if (!ano || !mes || !dia) return isoDate;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte uma data no formato DD/MM/AAAA para ISO YYYY-MM-DD.
 * @param {string} brDate
 * @returns {string|null}
 */
function parseDateBrToISO(brDate) {
  if (!brDate) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate.trim());
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

/**
 * Formata timestamp ISO para "DD/MM/AAAA às HH:MM".
 * @param {string} isoTimestamp
 * @returns {string}
 */
function formatDateTimeBr(isoTimestamp) {
  if (!isoTimestamp) return '—';
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

/**
 * Inicia atualização automática periódica da cotação.
 * @param {function} onUpdate callback chamado com o resultado de cada atualização
 */
function startAutoRefresh(onUpdate) {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(async () => {
    const resultado = await getExchangeRate();
    if (onUpdate) onUpdate(resultado);
  }, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
}

window.ExchangeRate = {
  getExchangeRate,
  setManualRate,
  convertUsdToBrl,
  formatUsd,
  formatBrl,
  formatDateBr,
  parseDateBrToISO,
  formatDateTimeBr,
  startAutoRefresh,
  stopAutoRefresh,
  AUTO_REFRESH_MS,
};
