class KanbanBoard {
    constructor() {
        this.board = document.querySelector('.kanban-columns');
        this.api = window.apiService;
        this.colunas = [];
        this.colaboradores = [];
        this.draggedCard = null;
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
    }

    async loadData() {
        this.colunas = await this.api.getColunas();
        this.colaboradores = await this.api.getColaboradores();
        this.renderBoard();
        this.updateStats();
    }

    renderBoard() {
        this.board.innerHTML = '';
        
        if (this.colunas.length === 0) {
            this.board.innerHTML = '<div style="padding: 40px; text-align: center; color: #999; width: 100%;">Nenhuma coluna configurada para sua empresa.</div>';
            return;
        }

        this.colunas.forEach(coluna => {
            const cardsNaColuna = this.colaboradores.filter(c => c.coluna_id === coluna.id);
            
            const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.setAttribute('data-column-id', coluna.id);
        
        columnEl.innerHTML = `
            <div class="column-header">
                <h3>
                    <span style="width: 12px; height: 12px; border-radius: 50%; background: ${coluna.cor_hex}"></span>
                    ${coluna.nome}
                </h3>
                <div class="column-header-actions">
                    <span class="column-count">${cardsNaColuna.length}</span>
                    <button class="btn-config-col rh-only" onclick="window.kanbanBoard.openChecklistsModal(${coluna.id}, '${coluna.nome}')" title="Configurar Tarefas Padrão">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
            <div class="tasks-container" data-column-id="${coluna.id}">
                    ${cardsNaColuna.map(c => this.createCardHTML(c, coluna.cor_hex)).join('')}
                </div>
            `;
            
            this.board.appendChild(columnEl);
        });
        
        this.setupDragAndDrop();
    }

    createCardHTML(colaborador, corHex) {
        const iniciais = colaborador.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        return `
            <div class="task-card" draggable="true" data-card-id="${colaborador.id}" style="border-left-color: ${corHex}">
                <div class="task-header">
                    <div class="task-tags">
                        <span class="task-tag" style="background: ${corHex}20; color: ${corHex}">
                            ${colaborador.departamento}
                        </span>
                    </div>
                    <div class="task-actions">
                        <button class="task-action-btn" title="Ver Detalhes" onclick="window.kanbanBoard.openCollaboratorDetails(${colaborador.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <h4 class="task-title">${colaborador.nome}</h4>
                <p class="task-description">${colaborador.cargo}</p>
                
                <div class="task-footer">
                    <div class="task-assignee">
                        <div class="assignee-avatar">${iniciais}</div>
                        <span class="assignee-name">Token: ${colaborador.token}</span>
                    </div>
                </div>
            </div>
        `;
    }

    setupDragAndDrop() {
        const cards = document.querySelectorAll('.task-card');
        const containers = document.querySelectorAll('.tasks-container');

        cards.forEach(card => {
            card.addEventListener('dragstart', () => {
                this.draggedCard = card;
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedCard = null;
            });
        });

        containers.forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                container.classList.add('drag-over');
                
                const afterElement = this.getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(this.draggedCard);
                } else {
                    container.insertBefore(this.draggedCard, afterElement);
                }
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', async e => {
                e.preventDefault();
                container.classList.remove('drag-over');
                
                const cardId = this.draggedCard.getAttribute('data-card-id');
                const novaColunaId = container.getAttribute('data-column-id');
                
                // Atualiza na API
                const success = await this.api.moverCard(cardId, novaColunaId);
                if (success) {
                    await this.loadData(); // Recarrega para atualizar contadores e banco
                }
            });
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async createNewTask(formElement) {
        const formData = new FormData(formElement);
        const dados = {
            nome: formData.get('nome'),
            cargo: formData.get('cargo'),
            departamento: formData.get('departamento'),
            email: formData.get('email')
        };

        const success = await this.api.criarColaborador(dados);
        if (success) {
            await this.loadData();
        }
        return success;
    }

    updateStats() {
        const countElements = document.querySelectorAll('.column-count');
        if (countElements.length > 0 && this.colaboradores) {
            // Atualiza o card de estatística global (o primeiro com a classe column-count no DOM é o card de stats)
            const globalStat = document.querySelector('.stat-info .column-count');
            if (globalStat) {
                globalStat.textContent = this.colaboradores.length;
            }
        }
    }

    // --- LÓGICA DO MODAL DE CHECKLISTS ---
    
    async openChecklistsModal(colunaId, colunaNome) {
        document.getElementById('currentColunaId').value = colunaId;
        document.getElementById('checklistModalTitle').innerHTML = `<i class="fas fa-list-check" style="color: #FF3B30;"></i> Tarefas Padrão - ${colunaNome}`;
        document.getElementById('checklistsModal').style.display = 'flex';
        await this.loadChecklists(colunaId);
    }

    async loadChecklists(colunaId) {
        const listContainer = document.getElementById('checklistsList');
        listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando tarefas...</p>';
        
        const checklists = await this.api.getChecklists(colunaId);
        listContainer.innerHTML = '';
        
        if (checklists.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 20px; background: #FFF; border-radius: 8px; border: 1px dashed #CCC;"><p style="color: #999; font-size: 0.9rem;">Nenhuma tarefa configurada para esta coluna.</p></div>';
            return;
        }
        
        checklists.forEach(item => {
            const escapedTitle = item.titulo.replace(/'/g, "\\'");
            const escapedDesc = item.descricao ? item.descricao.replace(/'/g, "\\'") : '';
            
            const div = document.createElement('div');
            div.className = 'checklist-item';
            div.innerHTML = `
                <div class="checklist-item-info" style="flex: 1;">
                    <strong><i class="fas fa-check-circle" style="color: #34C759; margin-right: 5px;"></i> ${item.titulo}</strong>
                    <small>${item.descricao || 'Nenhuma descrição detalhada.'}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-action-sm" onclick="window.kanbanBoard.editChecklistPrompt(${item.id}, '${escapedTitle}', '${escapedDesc}', ${colunaId})" title="Editar Tarefa" style="background: #E5F0FF; color: #007AFF; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-checklist" onclick="window.kanbanBoard.deleteChecklist(${item.id}, ${colunaId})" title="Remover Tarefa">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    async editChecklistPrompt(checklistId, oldTitle, oldDesc, colunaId) {
        const newTitle = prompt("Edite o título da tarefa:", oldTitle);
        if (newTitle === null) return; // Se a pessoa clicou em Cancelar
        
        let newDesc = prompt("Edite a descrição (opcional):", oldDesc);
        if (newDesc === null) newDesc = oldDesc;

        if (newTitle.trim() !== '') {
            const success = await window.apiService.updateChecklist(checklistId, { titulo: newTitle, descricao: newDesc });
            if (success) {
                await this.loadChecklists(colunaId); // Recarrega a listinha
            } else {
                alert('Erro ao atualizar a tarefa.');
            }
        } else {
            alert('O título não pode ficar vazio.');
        }
    }

    async deleteChecklist(checklistId, colunaId) {
        if (confirm('Tem certeza que deseja remover esta tarefa padrão? Ela não será mais gerada para novos colaboradores nesta coluna.')) {
            const success = await window.apiService.deleteChecklist(checklistId);
            if (success) {
                await this.loadChecklists(colunaId);
            } else {
                alert('Erro ao excluir a tarefa. Apenas RH pode excluir tarefas.');
            }
        }
    }

    // --- LÓGICA DA EQUIPE ---
    async openEquipeModal() {
        document.getElementById('equipeModal').style.display = 'flex';
        await this.loadEquipe();
    }

    async loadEquipe() {
        const container = document.getElementById('equipeList');
        container.innerHTML = '<p style="text-align:center; color:#999; padding: 15px;"><i class="fas fa-spinner fa-spin"></i> Carregando equipe...</p>';
        
        const equipe = await this.api.getEquipe();
        container.innerHTML = '';
        
        if (equipe.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999; padding: 15px;">Nenhum membro encontrado.</p>';
            return;
        }
        
        equipe.forEach(membro => {
            const badgeClass = membro.is_rh ? 'bg-rh' : 'bg-setor';
            const badgeText = membro.is_rh ? 'RH / Admin' : `Setor: ${membro.setor}`;
            
            container.innerHTML += `
                <div class="checklist-item" style="margin-bottom: 8px;">
                    <div class="checklist-item-info">
                        <strong>${membro.nome}</strong>
                        <small>${membro.email}</small>
                    </div>
                    <span style="font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: 600; background: ${membro.is_rh ? '#FFE5E5' : '#E5F0FF'}; color: ${membro.is_rh ? '#FF3B30' : '#007AFF'};">
                        ${badgeText}
                    </span>
                </div>
            `;
        });
    }

    async createNewEquipeMember(formElement) {
        const formData = new FormData(formElement);
        const isRh = formData.get('is_rh') === 'true';
        
        const dados = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            senha: formData.get('senha'),
            is_rh: isRh,
            setor: isRh ? 'RH' : formData.get('setor')
        };

        const result = await this.api.createMembroEquipe(dados);
        if (result.success) {
            await this.loadEquipe();
            formElement.reset();
            document.getElementById('setorInputGroup').style.display = 'none';
        } else {
            alert('Erro: ' + result.erro);
        }
        return result.success;
    }

    // --- LÓGICA DE GERENCIAR COLUNAS (SETORES) ---
    async openGerenciarColunasModal() {
        document.getElementById('gerenciarColunasModal').style.display = 'flex';
        await this.loadColunasAdminList();
    }

    async loadColunasAdminList() {
        const container = document.getElementById('colunasAdminList');
        container.innerHTML = '<p style="text-align:center; color:#999; padding: 15px;"><i class="fas fa-spinner fa-spin"></i> Carregando setores...</p>';
        
        // Recarrega os dados fresquinhos da API
        this.colunas = await this.api.getColunas();
        container.innerHTML = '';
        
        if (this.colunas.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999; padding: 15px;">Nenhuma fase cadastrada.</p>';
            return;
        }
        
        this.colunas.forEach(col => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'checklist-item';
            itemDiv.style.marginBottom = '8px';
            itemDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <input type="color" id="cor-edit-${col.id}" value="${col.cor_hex}" style="width: 28px; height: 28px; border: 1px solid #CCC; border-radius: 4px; cursor: pointer; padding: 0;">
                    <input type="text" id="nome-edit-${col.id}" value="${col.nome}" style="flex: 1; padding: 6px 10px; border: 1px solid #EAEAEA; border-radius: 4px; font-size: 0.9rem;">
                </div>
                <div style="display: flex; gap: 5px; margin-left: 10px;">
                    <button class="btn-action-sm" onclick="window.kanbanBoard.saveColunaEdit(${col.id})" title="Salvar Alteração" style="background: #E5F0FF; color: #007AFF; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-save"></i>
                    </button>
                    <button class="btn-action-sm" onclick="window.kanbanBoard.deleteColuna(${col.id})" title="Excluir Fase" style="background: #FFE5E5; color: #FF3B30; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(itemDiv);
        });
    }

    async createNewColuna(formElement) {
        const formData = new FormData(formElement);
        const dados = {
            nome: formData.get('nome'),
            cor_hex: formData.get('cor_hex')
        };

        const success = await this.api.createColuna(dados);
        if (success) {
            formElement.reset();
            await this.loadColunasAdminList();
            await this.loadData(); // Atualiza o Kanban visualmente por trás
        } else {
            alert('Erro ao criar a coluna.');
        }
    }

    async saveColunaEdit(id) {
        const nome = document.getElementById(`nome-edit-${id}`).value;
        const cor_hex = document.getElementById(`cor-edit-${id}`).value;
        
        const success = await this.api.updateColuna(id, { nome, cor_hex });
        if (success) {
            await this.loadColunasAdminList();
            await this.loadData(); // Atualiza o Kanban visualmente
        } else {
            alert('Erro ao atualizar a coluna.');
        }
    }

    async deleteColuna(id) {
        if (confirm('Atenção: Você está prestes a excluir este Setor/Fase inteira. Tem certeza?')) {
            const result = await this.api.deleteColuna(id);
            if (result.success) {
                await this.loadColunasAdminList();
                await this.loadData(); // Atualiza o Kanban visualmente
            } else {
                alert('Erro: ' + result.erro);
            }
        }
    }

    async openCollaboratorDetails(colaboradorId) {
        const modal = document.getElementById('taskDetailModal');
        const modalBody = document.getElementById('detailModalBody');
        const modalTitle = document.getElementById('detailNomeColaborador');

        // Mostra o modal em estado de carregamento
        modal.style.display = 'flex';
        modalBody.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #FF3B30;"></i><p style="margin-top: 10px; color: #888;">Carregando detalhes...</p></div>';

        // Busca os dados na API
        const dados = await this.api.getColaboradorDetalhes(colaboradorId);

        if (!dados) {
            modalBody.innerHTML = '<div style="color: #FF3B30; text-align: center; padding: 20px;"><i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i><br>Erro ao carregar os dados.</div>';
            return;
        }

        modalTitle.innerHTML = `<i class="fas fa-user-circle" style="color: #FF3B30; margin-right: 8px;"></i> ${dados.nome}`;

        // Monta a lista de tarefas da coluna atual
        let tarefasHtml = '';
        if (dados.tarefas && dados.tarefas.length > 0) {
            tarefasHtml = dados.tarefas.map(t => {
                const isConcluida = t.status === 'concluida';
                return `
                    <div class="task-item">
                        <div class="task-checkbox ${isConcluida ? 'checked' : ''}" onclick="window.kanbanBoard.toggleTaskStatus(${t.id}, this)">
                            <i class="fas fa-check"></i>
                        </div>
                        <div class="task-text" style="${isConcluida ? 'text-decoration: line-through; color: #999;' : ''}">
                            <strong>${t.titulo}</strong>
                            ${t.descricao ? `<span style="display:block; font-size: 0.8rem; color: #777;">${t.descricao}</span>` : ''}
                        </div>
                        <span class="task-status ${isConcluida ? 'completed' : 'pending'}">${isConcluida ? 'Concluída' : 'Pendente'}</span>
                    </div>
                `;
            }).join('');
        } else {
            tarefasHtml = '<div style="text-align:center; padding: 20px; background: #FFF; border-radius: 6px; color: #888; border: 1px dashed #CCC;">Nenhuma tarefa pendente para este colaborador nesta fase.</div>';
        }

        // Renderiza o conteúdo do modal
        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <span>Cargo</span>
                    <strong>${dados.cargo}</strong>
                </div>
                <div class="detail-item">
                    <span>Departamento</span>
                    <strong>${dados.departamento}</strong>
                </div>
                <div class="detail-item">
                    <span>E-mail</span>
                    <strong>${dados.email || 'Não informado'}</strong>
                </div>
                <div class="detail-item">
                    <span>Token (Guia de Bolso)</span>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <strong class="detail-token">${dados.token}</strong>
                    </div>
                </div>
            </div>

            <h4 style="margin-bottom: 12px; color: #333; font-size: 1rem;"><i class="fas fa-list-check" style="color: #FF3B30; margin-right: 5px;"></i> Checklist da Fase Atual</h4>
            <div class="task-list">
                ${tarefasHtml}
            </div>
        `;
    }

    async toggleTaskStatus(taskId, element) {
        const isChecked = element.classList.contains('checked');
        const newStatus = isChecked ? 'pendente' : 'concluida';

        // Desabilita cliques duplos rápidos
        element.style.pointerEvents = 'none';

        // Atualização visual otimista
        element.classList.toggle('checked');
        const textDiv = element.nextElementSibling;
        const badge = element.parentElement.querySelector('.task-status');

        if (!isChecked) {
            textDiv.style.textDecoration = 'line-through';
            textDiv.style.color = '#999';
            badge.className = 'task-status completed';
            badge.textContent = 'Concluída';
        } else {
            textDiv.style.textDecoration = 'none';
            textDiv.style.color = '#333';
            badge.className = 'task-status pending';
            badge.textContent = 'Pendente';
        }

        // Chama a API
        const success = await this.api.toggleTaskGestor(taskId, newStatus);
        
        if (!success) {
            alert('Erro ao atualizar a tarefa. Verifique a conexão.');
            // Reverte em caso de erro
            element.classList.toggle('checked');
            if (isChecked) {
                textDiv.style.textDecoration = 'line-through';
                textDiv.style.color = '#999';
                badge.className = 'task-status completed';
                badge.textContent = 'Concluída';
            } else {
                textDiv.style.textDecoration = 'none';
                textDiv.style.color = '#333';
                badge.className = 'task-status pending';
                badge.textContent = 'Pendente';
            }
        }
        
        element.style.pointerEvents = 'auto';
    }

    setupEventListeners() {
        // Eventos adicionais se necessários
    }
}

// Inicializa o Kanban quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.kanbanBoard = new KanbanBoard();
    window.kanbanBoard.init();
});