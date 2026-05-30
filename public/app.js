const form = document.getElementById('formGasto');
const tabela = document.getElementById('tabelaGastos');
const mesFiltro = document.getElementById('mesFiltro');
const totalMes = document.getElementById('totalMes');
const maiorCategoria = document.getElementById('maiorCategoria');
const qtdRegistros = document.getElementById('qtdRegistros');
const categoriasResumo = document.getElementById('categoriasResumo');
const btnPDF = document.getElementById('btnPDF');
const btnLimparFiltro = document.getElementById('btnLimparFiltro');

let gastos = [];

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function dataBR(data) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function gastosDoMes() {
  const mes = mesFiltro.value;
  if (!mes) return [...gastos].sort((a,b) => b.data.localeCompare(a.data));
  return gastos.filter(g => g.data && g.data.startsWith(mes)).sort((a,b) => b.data.localeCompare(a.data));
}

async function carregar() {
  const resposta = await fetch('/api/gastos');
  gastos = await resposta.json();
  renderizar();
}

function renderizar() {
  const lista = gastosDoMes();
  const total = lista.reduce((acc, g) => acc + Number(g.valor || 0), 0);
  const porCategoria = {};

  lista.forEach(g => {
    porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.valor || 0);
  });

  const ranking = Object.entries(porCategoria).sort((a,b) => b[1] - a[1]);

  totalMes.textContent = BRL.format(total);
  qtdRegistros.textContent = lista.length;
  maiorCategoria.textContent = ranking[0] ? `${ranking[0][0]} • ${BRL.format(ranking[0][1])}` : '—';

  categoriasResumo.innerHTML = ranking.length
    ? ranking.map(([cat, val]) => `<div class="cat-row"><span>${escapar(cat)}</span><strong>${BRL.format(val)}</strong></div>`).join('')
    : '<p class="empty">Nenhum gasto neste mês.</p>';

  tabela.innerHTML = lista.length
    ? lista.map(g => `
      <tr>
        <td>${dataBR(g.data)}</td>
        <td>${escapar(g.categoria)}</td>
        <td>${escapar(g.descricao)}</td>
        <td class="valor">${BRL.format(Number(g.valor || 0))}</td>
        <td>${escapar(g.observacao || '—')}</td>
        <td><button class="btn delete" onclick="excluirGasto('${g.id}')">Excluir</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty">Nenhum gasto registrado para o filtro atual.</td></tr>';
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const novo = {
    data: document.getElementById('data').value,
    categoria: document.getElementById('categoria').value,
    descricao: document.getElementById('descricao').value,
    valor: Number(document.getElementById('valor').value),
    observacao: document.getElementById('observacao').value
  };

  const resposta = await fetch('/api/gastos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(novo)
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    alert(erro.error || 'Erro ao salvar gasto.');
    return;
  }

  form.reset();
  document.getElementById('data').value = hojeISO();
  await carregar();
});

window.excluirGasto = async function(id) {
  if (!confirm('Excluir este gasto?')) return;
  await fetch('/api/gastos/' + encodeURIComponent(id), { method: 'DELETE' });
  await carregar();
};

mesFiltro.addEventListener('change', renderizar);
btnLimparFiltro.addEventListener('click', () => {
  mesFiltro.value = '';
  renderizar();
});

btnPDF.addEventListener('click', () => {
  const lista = gastosDoMes();
  const mes = mesFiltro.value || 'todos-os-meses';
  const total = lista.reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const linhas = lista.map(g => `
    <tr>
      <td>${dataBR(g.data)}</td>
      <td>${escapar(g.categoria)}</td>
      <td>${escapar(g.descricao)}</td>
      <td>${BRL.format(Number(g.valor || 0))}</td>
      <td>${escapar(g.observacao || '—')}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Budget - ${escapar(mes)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
        h1 { margin-bottom: 4px; }
        .meta { color: #555; margin-bottom: 22px; }
        .total { font-size: 22px; font-weight: bold; margin: 18px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 9px; text-align: left; font-size: 13px; }
        th { background: #111; color: #fff; }
        @media print { button { display: none; } body { margin: 18mm; } }
      </style>
    </head>
    <body>
      <h1>Relatório de Gastos</h1>
      <div class="meta">Mês: ${escapar(mes)} • Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
      <div class="total">Total: ${BRL.format(total)}</div>
      <table>
        <thead>
          <tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Observação</th></tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="5">Nenhum gasto encontrado.</td></tr>'}</tbody>
      </table>
      <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
    </body>
    </html>
  `;

  const janela = window.open('', '_blank');
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
});

document.getElementById('data').value = hojeISO();
mesFiltro.value = mesAtual();
carregar();
