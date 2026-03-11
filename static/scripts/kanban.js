/**
 * kanban.js
 * Gerenciamento do quadro Kanban com integração completa à API SaaS (Multi-tenant)
 */

class KanbanBoard {
    constructor() {
        this.columns = {};
        this.draggedCard = null;
        this.colunas = [];
        this.init();
    }

    async init() {
        await this.loadColunas();
        this.setupDragAndDrop();
        await this.loadCollaborators();
        this.setupSearch();
        // this.setupFilters(); // Filtros podem ser reativados posteriormente caso necessário
    }

    async loadColunas() {
        // Carregar colunas dinâmicas exclusivas da empresa da API
        this.colunas = await ApiService.getColunas();
        
        const container = document.querySelector('.kanban-columns');
        if (container) container.innerHTML = ''; // Limpa o contentor antes de renderizar
        
        // Mapear colunas para elementos DOM
        this.colunas.forEach((coluna, index) => {
            const columnElement = this.criarColunaDOM(coluna, index);
            // Guardamos a referência usando o ID da coluna para o drag and drop
            this.columns[coluna.id] = columnElement; 
        });
    }

    criarColunaDOM(coluna, index) {
        const container = document.querySelector('.kanban-columns');
        if (!container) return null;
        
        // Gerar uma cor para a borda baseada no índice para diferenciação visual
        const cores = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6'];
        const cor = cores[index % cores.length];

        const columnHtml = `
            <div class="kanban-column" id="coluna-${coluna.id}" data-coluna-id="${coluna.id}">
                <div class="column-header" style="border-top: 4px solid ${cor};">
                    <h3>${coluna.nome}</h3>
                    <span class="column-count">0</span>
                </div>
                <div class="tasks-container" data-coluna-id="${coluna.id}"></div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', columnHtml);
        return container.querySelector(`#coluna-${coluna.id} .tasks-container`);
    }

    async loadCollaborators() {
        try {
            const tasks = await ApiService.getTasks();
            
            // Limpar todas as colunas
            Object.values(this.columns).forEach(col => {
                if (col) col.innerHTML = '';
            });

            // Renderizar cards
            tasks.forEach(task => this.renderCard(task));
            this.updateColumnCounts();
            
        } catch (error) {
            console.error('Erro ao carregar colaboradores:', error);
            showNotification('Erro ao carregar dados do servidor', 'error');
        }
    }

    renderCard(task) {
        const card = document.createElement('div');
        
        card.className = `task-card`;
        card.dataset.id = task.id;
        card.setAttribute('draggable', 'true');

        // Iniciais para o avatar
        const initials = task.title.split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'NO';

        card.innerHTML = `
            <div class="task-header">
                <div class="task-tags">
                    <span class="task-tag" style="background: #E5E5EA; color: #333;">
                        ${task.coluna_nome ? task.coluna_nome.toUpperCase() : 'NOVO'}
                    </span>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn view-task" title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="task-action-btn delete-task" title="Remover do Fluxo">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="task-title">${task.title}</h4>
            <p class="task-description">${task.email || 'Sem e-mail registado'}</p>
            
            <div class="task-footer">
                <div class="task-assignee">
                    <div class="assignee-avatar">${initials}</div>
                    <span class="assignee-name">Token: ${task.token.substring(0, 6)}...</span>
                </div>
            </div>
        `;

        // Event listeners
        this.attachCardEvents(card, task.id);
        
        // Adicionar à coluna correta baseada no coluna_id (status)
        const targetColumn = this.columns[task.status];
        if (targetColumn) {
            targetColumn.appendChild(card);
        } else {
            console.warn(`Coluna ${task.status} não encontrada para o card ${task.id}`);
        }
    }

    attachCardEvents(card, taskId) {
        card.querySelector('.view-task')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTaskDetails(taskId);
        });

        card.querySelector('.delete-task')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTask(card, taskId);
        });

        card.addEventListener('dragstart', (e) => {
            this.draggedCard = card;
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', taskId);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            this.draggedCard = null;
            card.classList.remove('dragging');
            card.style.opacity = '1';
        });
    }

    async showTaskDetails(cardId) {
        const detalhes = await ApiService.getCardDetalhes(cardId);
        if (!detalhes) return;
        
        this.renderTaskModal(detalhes);
    }

    renderTaskModal(detalhes) {
        let modal = document.getElementById('taskDetailModal');
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = 'taskDetailModal';
        modal.className = 'task-modal-overlay';
        modal.style.display = 'flex';
        
        const card = detalhes.card;
        const tarefas = detalhes.tarefas;
        
        // Agrupar tarefas por setor (coluna) dinamicamente
        const tarefasPorSetor = {};
        tarefas.forEach(t => {
            if (!tarefasPorSetor[t.setor_nome]) {
                tarefasPorSetor[t.setor_nome] = [];
            }
            tarefasPorSetor[t.setor_nome].push(t);
        });
        
        let tarefasHtml = '';
        if (tarefas.length === 0) {
            tarefasHtml = '<p style="color: #666; font-style: italic;">Nenhum checklist associado até ao momento.</p>';
        } else {
            for (const [setor, lista] of Object.entries(tarefasPorSetor)) {
                tarefasHtml += `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #666; margin-bottom: 10px;">${setor}</h4>
                        <div class="task-list">
                `;
                
                lista.forEach(tarefa => {
                    tarefasHtml += `
                        <div class="task-item" data-tarefa-id="${tarefa.id}">
                            <div class="task-checkbox ${tarefa.concluida ? 'checked' : ''}" 
                                 onclick="window.kanbanBoard.toggleTarefa(${tarefa.id}, ${!tarefa.concluida})">
                                <i class="fas fa-check"></i>
                            </div>
                            <div class="task-text">${tarefa.descricao}</div>
                            <span class="task-status ${tarefa.concluida ? 'completed' : 'pending'}">
                                ${tarefa.concluida ? 'Concluído' : 'Pendente'}
                            </span>
                        </div>
                    `;
                });
                
                tarefasHtml += `</div></div>`;
            }
        }
        
        modal.innerHTML = `
            <div class="task-modal" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>${card.nome}</h3>
                    <button class="close-modal" onclick="document.getElementById('taskDetailModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        <div>
                            <p><strong>Email:</strong> ${card.email || 'Não informado'}</p>
                            <p><strong>CPF:</strong> ${card.cpf || 'Não informado'}</p>
                        </div>
                        <div>
                            <p><strong>Token de Acesso:</strong> 
                                <span style="background: #f0f0f0; padding: 2px 5px; border-radius: 4px; font-family: monospace;">${card.token}</span>
                            </p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 30px;">
                        <h4 style="margin-bottom: 15px;">Checklist de Tarefas (Progresso)</h4>
                        ${tarefasHtml}
                    </div>
                    
                    <div>
                        <h4 style="margin-bottom: 15px;">Anotações do Colaborador</h4>
                        <textarea id="anotacoesTextarea" class="form-control" rows="4" 
                                  placeholder="Anotações pessoais do colaborador" disabled>${detalhes.anotacoes || 'O colaborador ainda não registou anotações.'}</textarea>
                        <small style="color: #888;">As anotações são geridas pelo próprio colaborador no seu Guia de Bolso.</small>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async toggleTarefa(tarefaId, concluida) {
        const result = await ApiService.toggleTarefa(tarefaId, concluida);
        
        if (result.success) {
            const checkbox = document.querySelector(`.task-item[data-tarefa-id="${tarefaId}"] .task-checkbox`);
            const status = document.querySelector(`.task-item[data-tarefa-id="${tarefaId}"] .task-status`);
            
            if (checkbox) {
                if (concluida) {
                    checkbox.classList.add('checked');
                    status.textContent = 'Concluído';
                    status.className = 'task-status completed';
                } else {
                    checkbox.classList.remove('checked');
                    status.textContent = 'Pendente';
                    status.className = 'task-status pending';
                }
            }
            this.loadCollaborators();
        }
    }

    async createNewTask(form) {
        const formData = new FormData(form);
        
        // Os dados enviados são muito mais simples agora.
        // O backend assume a inserção na primeira coluna e instancia as tarefas padrão.
        const newColaborador = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            cpf: formData.get('cpf')
        };
        
        const result = await ApiService.createTask(newColaborador);
        
        if (result.success) {
            // A notificação pode mostrar o token para o RH partilhar com o colaborador
            showNotification(`Colaborador adicionado! Token de Acesso: ${result.token}`, 'success');
            
            // Opcional: alert para o utilizador copiar facilmente
            prompt('Copie o Token para enviar ao novo colaborador:', result.token);
            
            this.loadCollaborators();
            return true;
        } else {
            showNotification('Erro ao adicionar colaborador', 'error');
            return false;
        }
    }

    setupDragAndDrop() {
        // Obter os contentores de tarefas pelas classes em vez dos ids fixos
        document.querySelectorAll('.kanban-column').forEach(column => {
            const taskContainer = column.querySelector('.tasks-container');
            if (!taskContainer) return;

            column.addEventListener('dragover', e => {
                e.preventDefault();
                column.style.backgroundColor = 'rgba(0, 122, 255, 0.05)';
            });

            column.addEventListener('dragleave', () => {
                column.style.backgroundColor = '';
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.style.backgroundColor = '';

                if (!this.draggedCard) return;
                
                const taskId = this.draggedCard.dataset.id;
                const novaColunaId = column.dataset.colunaId; // Lê o ID da coluna de destino
                
                if (this.draggedCard.parentNode !== taskContainer) {
                    taskContainer.appendChild(this.draggedCard);
                    
                    // O backend irá atualizar a fase e instanciar tarefas da nova fase automaticamente
                    const result = await ApiService.updateTaskStatus(taskId, novaColunaId);
                    
                    if (result.success) {
                        showNotification('Colaborador movido de fase com sucesso!', 'success');
                        this.updateColumnCounts();
                    } else {
                        showNotification('Erro ao mover colaborador', 'error');
                        this.loadCollaborators(); // Reverte a UI em caso de falha
                    }
                }
            });
        });
    }

    async deleteTask(cardElement, taskId) {
        if (confirm('Tem a certeza de que deseja remover este colaborador do fluxo? Esta ação apagará também o seu checklist.')) {
            const result = await ApiService.deleteTask(taskId);
            
            if (result.success) {
                cardElement.remove();
                this.updateColumnCounts();
                showNotification('Colaborador arquivado com sucesso!', 'success');
            } else {
                showNotification('Erro ao arquivar colaborador', 'error');
            }
        }
    }

    updateColumnCounts() {
        Object.keys(this.columns).forEach(colunaId => {
            const container = this.columns[colunaId];
            if (!container) return;
            
            const count = container.querySelectorAll('.task-card').length;
            const header = container.closest('.kanban-column')?.querySelector('.column-count');
            if (header) header.textContent = count;
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            
            document.querySelectorAll('.task-card').forEach(card => {
                const title = card.querySelector('.task-title')?.textContent.toLowerCase() || '';
                const description = card.querySelector('.task-description')?.textContent.toLowerCase() || '';
                const matches = title.includes(term) || description.includes(term);
                
                card.style.display = matches ? 'block' : 'none';
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.kanbanBoard = new KanbanBoard();
});
