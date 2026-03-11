/**
 * onboarding.js
 * Lógica exclusiva da visão do Colaborador (O "Guia de Bolso")
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Extrai o token da URL atual
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showNotification('Token inválido ou não fornecido', 'error');
        return;
    }

    await carregarDadosOnboarding(token);
    setupAnotacoes(token);
});

async function carregarDadosOnboarding(token) {
    const dados = await ApiService.getMeuOnboarding(token);
    
    if (!dados) {
        document.getElementById('onboarding-content').innerHTML = `
            <div class="error-state">
                <h3>Ops! Não conseguimos carregar o seu guia.</h3>
                <p>Verifique se o seu link está correto ou contacte o RH.</p>
            </div>
        `;
        return;
    }

    // Preenche cabeçalho
    const bemVindoEl = document.getElementById('nome-colaborador');
    if (bemVindoEl) bemVindoEl.textContent = dados.nome;

    const emailEl = document.getElementById('email-colaborador');
    if (emailEl) emailEl.textContent = dados.email || 'Email não registado';

    // Agrupar tarefas por Setor/Fase
    const tarefasPorSetor = {};
    dados.tarefas.forEach(t => {
        if (!tarefasPorSetor[t.setor_nome]) {
            tarefasPorSetor[t.setor_nome] = [];
        }
        tarefasPorSetor[t.setor_nome].push(t);
    });

    renderizarLinhaDoTempo(tarefasPorSetor, dados.coluna_id);

    // Preenche anotações
    const anotacoesEl = document.getElementById('minhas-anotacoes');
    if (anotacoesEl && dados.anotacoes) {
        anotacoesEl.value = dados.anotacoes;
    }
}

function renderizarLinhaDoTempo(tarefasPorSetor, colunaAtualId) {
    const container = document.getElementById('timeline-tarefas');
    if (!container) return;

    if (Object.keys(tarefasPorSetor).length === 0) {
        container.innerHTML = '<p class="text-muted">A sua jornada está a ser preparada. Em breve as suas tarefas aparecerão aqui!</p>';
        return;
    }

    let html = '';
    
    for (const [setor, lista] of Object.entries(tarefasPorSetor)) {
        html += `
            <div class="timeline-setor">
                <h3 class="setor-titulo"><i class="fas fa-building"></i> Fase: ${setor}</h3>
                <div class="tarefas-lista">
        `;
        
        lista.forEach(tarefa => {
            const isConcluida = tarefa.concluida === 1;
            
            html += `
                <div class="tarefa-item ${isConcluida ? 'concluida' : ''}" data-id="${tarefa.id}">
                    <label class="custom-checkbox">
                        <input type="checkbox" 
                               ${isConcluida ? 'checked' : ''} 
                               onchange="alternarTarefa(${tarefa.id}, this.checked)">
                        <span class="checkmark"></span>
                        <span class="tarefa-texto">${tarefa.descricao}</span>
                    </label>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }

    container.innerHTML = html;
}

// Função global para a checkbox acionar a API
window.alternarTarefa = async function(tarefaId, isChecked) {
    // Reutiliza a função do api_service.js
    const result = await ApiService.toggleTarefa(tarefaId, isChecked);
    
    if (result.success) {
        const itemEl = document.querySelector(`.tarefa-item[data-id="${tarefaId}"]`);
        if (itemEl) {
            if (isChecked) {
                itemEl.classList.add('concluida');
            } else {
                itemEl.classList.remove('concluida');
            }
        }
    } else {
        // Reverte visualmente se falhar
        const checkbox = document.querySelector(`.tarefa-item[data-id="${tarefaId}"] input`);
        if (checkbox) checkbox.checked = !isChecked;
    }
}

function setupAnotacoes(token) {
    const btnSalvar = document.getElementById('btn-salvar-anotacoes');
    const textarea = document.getElementById('minhas-anotacoes');

    if (btnSalvar && textarea) {
        btnSalvar.addEventListener('click', async () => {
            const btnOriginalText = btnSalvar.innerHTML;
            btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            btnSalvar.disabled = true;

            const sucesso = await ApiService.salvarAnotacao(token, textarea.value);
            
            if (sucesso.success) {
                showNotification('Anotações guardadas com segurança!', 'success');
            }

            btnSalvar.innerHTML = btnOriginalText;
            btnSalvar.disabled = false;
        });
    }
}
