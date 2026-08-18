/**
 * export.js
 * Exportação/Importação de backups em JSON e exportação em CSV.
 */

const BACKUP_VERSION = 1;

/**
 * Dispara o download de um arquivo no navegador (sem servidor).
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Exporta todos os lançamentos e configurações em um arquivo JSON de backup.
 */
function exportJSON() {
  const payload = {
    versao: BACKUP_VERSION,
    exportadoEm: new Date().toISOString(),
    lancamentos: Storage.getLancamentos(),
    config: Storage.getConfig(),
  };
  downloadFile(
    `tiktok-saldo-backup-${nowStamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
}

/**
 * Exporta os lançamentos em CSV compatível com Excel/Google Sheets.
 */
function exportCSV() {
  const lancamentos = Finance.computeRunningBalances(Storage.getLancamentos());
  const cotacao = Storage.getCotacao();
  const rate = cotacao ? cotacao.rate : 0;

  const header = [
    'Tipo',
    'Origem',
    'Data',
    'Valor (US$)',
    'Valor (R$)',
    'Saldo acumulado (US$)',
    'Saldo acumulado (R$)',
    'Observacao',
  ];
  const linhas = lancamentos.map((l) => [
    l.tipo === 'ganho' ? 'Ganho' : 'Saque',
    l.origem,
    ExchangeRate.formatDateBr(l.data),
    l.valorDolar.toFixed(2).replace('.', ','),
    ExchangeRate.convertUsdToBrl(l.valorDolar, rate).toFixed(2).replace('.', ','),
    l.saldoAcumulado.toFixed(2).replace('.', ','),
    ExchangeRate.convertUsdToBrl(l.saldoAcumulado, rate).toFixed(2).replace('.', ','),
    (l.observacao || '').replace(/[\r\n]+/g, ' '),
  ]);

  const escapeCsv = (value) => {
    const str = String(value);
    if (/[";\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [header, ...linhas].map((row) => row.map(escapeCsv).join(';'));
  const csvContent = '﻿' + csvRows.join('\r\n'); // BOM para acentuação correta no Excel

  downloadFile(`tiktok-saldo-lancamentos-${nowStamp()}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

/**
 * Valida a estrutura de um lançamento importado.
 * @param {*} item
 * @returns {boolean}
 */
function isValidLancamento(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.tipo !== 'ganho' && item.tipo !== 'saque') return false;
  if (typeof item.origem !== 'string' || !item.origem.trim()) return false;
  if (typeof item.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.data)) return false;
  if (typeof item.valorDolar !== 'number' || !Number.isFinite(item.valorDolar) || item.valorDolar < 0) {
    return false;
  }
  return true;
}

/**
 * Valida e normaliza o conteúdo de um backup JSON.
 * @param {string} rawText
 * @returns {{ok: true, lancamentos: Array, config: object|null} | {ok: false, error: string}}
 */
function parseBackupJSON(rawText) {
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return { ok: false, error: 'O arquivo não é um JSON válido.' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Formato de backup inválido.' };
  }

  const lancamentosRaw = Array.isArray(data.lancamentos) ? data.lancamentos : data;
  if (!Array.isArray(lancamentosRaw)) {
    return { ok: false, error: 'O backup não contém uma lista de lançamentos.' };
  }

  const lancamentos = [];
  for (const item of lancamentosRaw) {
    if (!isValidLancamento(item)) {
      return { ok: false, error: 'Um ou mais lançamentos do arquivo estão em formato inválido.' };
    }
    lancamentos.push({
      id: typeof item.id === 'string' && item.id ? item.id : Storage.generateId(),
      tipo: item.tipo,
      origem: item.origem,
      data: item.data,
      valorDolar: Finance.roundMoney(item.valorDolar),
      observacao: typeof item.observacao === 'string' ? item.observacao : '',
      criadoEm: typeof item.criadoEm === 'string' ? item.criadoEm : new Date().toISOString(),
    });
  }

  const config = data.config && typeof data.config === 'object' ? data.config : null;

  return { ok: true, lancamentos, config };
}

/**
 * Lê um arquivo File (input type=file) como texto.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}

/**
 * Importa um backup a partir de um File, substituindo os dados atuais.
 * @param {File} file
 * @returns {Promise<{ok: boolean, error?: string, total?: number}>}
 */
async function importBackupFile(file) {
  if (!file) return { ok: false, error: 'Nenhum arquivo selecionado.' };
  if (!file.name.toLowerCase().endsWith('.json')) {
    return { ok: false, error: 'Selecione um arquivo .json exportado por este sistema.' };
  }

  let text;
  try {
    text = await readFileAsText(file);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  const parsed = parseBackupJSON(text);
  if (!parsed.ok) return parsed;

  Storage.saveLancamentos(parsed.lancamentos);
  if (parsed.config) {
    Storage.updateConfig(parsed.config);
  }
  Storage.setSeedStatus('confirmado');

  return { ok: true, total: parsed.lancamentos.length };
}

window.ExportImport = {
  exportJSON,
  exportCSV,
  importBackupFile,
  parseBackupJSON,
};
