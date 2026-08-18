# Controle de Saldo — TikTok Lives

Sistema web para controlar os valores recebidos através de lives e missões do TikTok, substituindo uma planilha manual. Funciona **100% no navegador** — sem backend, sem banco de dados, sem chaves secretas. Todos os dados ficam salvos no `localStorage` do próprio navegador.

## Funcionalidades

- Dashboard com saldo atual (USD e BRL), totais por origem (TikTok, Missões), total sacado e saldo disponível.
- Cotação USD/BRL automática (API pública), com atualização periódica, botão manual e fallback para a última cotação salva.
- Cadastro, edição e exclusão de lançamentos (ganhos e saques).
- Cálculo automático e recorrente do saldo — nunca é digitado manualmente.
- Metas: principal (USD), secundária (equivalente em reais) e semanal, com barras de progresso.
- Área de saques com metas próprias.
- Gráfico de evolução diária dos ganhos (Chart.js via CDN).
- Filtros por categoria e período, ordenação por data.
- Exportação em JSON (backup completo) e CSV (Excel/Google Sheets).
- Importação de backup JSON com validação.
- Tema claro/escuro.
- Layout responsivo (desktop, tablet e celular).

## Estrutura do projeto

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js            # orquestração e eventos
│   ├── storage.js        # acesso ao localStorage
│   ├── finance.js        # regras financeiras puras (saldo, metas, totais)
│   ├── exchange-rate.js  # cotação USD/BRL e formatação
│   ├── ui.js              # renderização de tela
│   └── export.js         # exportação/importação de backup
├── assets/
├── README.md
└── .gitignore
```

## Como usar localmente

Basta abrir o arquivo `index.html` diretamente no navegador — não é necessário nenhum servidor, build ou instalação.

## Como publicar no GitHub Pages

1. **Criar o repositório**
   - Crie um repositório novo no GitHub (público ou privado, o GitHub Pages funciona em ambos nos planos atuais).

2. **Enviar os arquivos**
   - Coloque todos os arquivos deste projeto (`index.html`, pasta `css/`, pasta `js/`, `README.md`, etc.) na raiz do repositório.
   - Faça commit e push para a branch principal (`main`).

3. **Ativar o GitHub Pages**
   - No repositório, vá em **Settings → Pages**.
   - Em "Source", selecione a branch `main` e a pasta `/ (root)`.
   - Clique em **Save**.

4. **Acessar o site**
   - Após alguns minutos, o GitHub mostrará a URL pública, no formato:
     `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
   - Abra essa URL no navegador (inclusive no celular).

## Backup dos dados

Os dados ficam salvos apenas no navegador em que o site foi usado (localStorage). Para não perdê-los:

1. Clique em **"Exportar JSON"** na seção "Backup e dados".
2. Um arquivo `tiktok-saldo-backup-AAAAMMDD-HHMM.json` será baixado — guarde-o em local seguro (Google Drive, e-mail, pendrive, etc.).
3. Repita esse processo periodicamente, especialmente antes de limpar o navegador ou trocar de dispositivo.

Use **"Exportar CSV"** se quiser apenas abrir os lançamentos numa planilha (Excel/Google Sheets) — esse formato não é usado para restaurar dados, apenas para leitura/análise.

## Restaurar um backup

1. Clique em **"Importar backup"**.
2. Selecione o arquivo `.json` gerado anteriormente pela função "Exportar JSON".
3. O sistema valida o conteúdo do arquivo antes de importar. Se o arquivo estiver corrompido ou em formato inválido, uma mensagem de erro é exibida e nada é alterado.
4. Após a importação, todos os lançamentos e configurações do backup substituem os dados atuais do navegador.

> Atenção: importar um backup substitui os lançamentos atualmente salvos neste navegador. Se quiser manter os dados atuais, exporte-os primeiro.

## Cotação do dólar

- A cotação é buscada automaticamente ao abrir o site, atualizada a cada 30 minutos e pode ser atualizada manualmente pelo botão "Atualizar cotação".
- Se a API estiver indisponível, o sistema usa a última cotação salva no navegador e exibe um aviso.
- Se nunca houve uma cotação salva e a API falhar, o sistema pede que você informe uma cotação manual (em Configurações ou na tela que aparece automaticamente).

## Tecnologias

- HTML5, CSS3 e JavaScript puro (sem frameworks de frontend).
- [Chart.js](https://www.chartjs.org/) via CDN, apenas para o gráfico de evolução.
- APIs públicas de cotação (sem necessidade de chave/API key): AwesomeAPI como fonte principal e open.er-api.com como alternativa em caso de falha.

## Sobre a privacidade dos dados

Nenhum dado financeiro é enviado a servidores externos. As únicas requisições de rede feitas pelo site são para buscar a cotação do dólar (valor público, sem dados pessoais). Todos os lançamentos, metas e configurações permanecem apenas no `localStorage` do navegador utilizado.
