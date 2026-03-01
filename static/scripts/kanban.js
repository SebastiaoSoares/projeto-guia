/**
 * kanban.js
 * Gere a interface de arrastar e soltar (Drag & Drop) e a lógica de apresentação
 * dos colaboradores no fluxo de onboarding.
 */

class KanbanBoard {
    constructor() {
        // Mapeamento das novas colunas do fluxo de Onboarding
        this.columns = {
            'rh': document.getElementById('rh-column'),
            'ti': document.getElementById('ti-column'),
            'sesmt': document.getElementById('sesmt-column'),
            'gestao': document.getElementById('done-column') // Usando o done-column para Gestão
        };
        
        this.draggedCard = null;
        this.init();
    }

    async init() {
        this.setupDragAndDrop();
        await this.loadCollaborators();
    }

    // 1. CARREGAR DADOS
    async loadCollaborators() {
        let tasks = [];
        
        // Tenta carregar do Back-end (API Flask)
        if (window.ApiService && typeof window.ApiService.getTasks === 'function') {
            try {
                tasks = await window.ApiService.getTasks();
            } catch (e) {
                console.warn("API indisponível, a usar LocalStorage.");
                tasks = this.loadFromLocalStorage();
            }
        } else {
            // Fallback para LocalStorage se a API não estiver conectada
            tasks = this.loadFromLocalStorage();
        }

        // Limpa as colunas
        Object.values(this.columns).forEach(col => {
            if (col) col.innerHTML = '';
        });

        // Renderiza os cards nas colunas corretas
        if (tasks && tasks.length > 0) {
            tasks.forEach(task => this.renderCard(task));
        }
        
        this.updateColumnCounts();
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('guia_collaborators');
        return saved ? JSON.parse(saved) : [];
    }

    saveToLocalStorage(task) {
        const tasks = this.loadFromLocalStorage();
        // Atualiza se existir, adiciona se for novo
        const existingIndex = tasks.findIndex(t => t.id === task.id);
        if (existingIndex >= 0) {
            tasks[existingIndex] = task;
        } else {
            tasks.push(task);
        }
        localStorage.setItem('guia_collaborators', JSON.stringify(tasks));
    }

    deleteFromLocalStorage(taskId) {
        let tasks = this.loadFromLocalStorage();
        tasks = tasks.filter(t => t.id !== taskId);
        localStorage.setItem('guia_collaborators', JSON.stringify(tasks));
    }

    // 2. CRIAR NOVO COLABORADOR (Recebe o formulário do HTML)
    async createNewTask(form) {
        const formData = new FormData(form);
        
        const newCollaborator = {
            title: formData.get('title') || 'Novo Colaborador',
            description: formData.get('description') || '',
            priority: formData.get('priority') || 'medium',
            department: formData.get('department') || 'rh',
            deadline: formData.get('deadline') || 'A definir',
            status: formData.get('department') || 'rh'
        };

        // Salvar no Back-end ou LocalStorage
        if (window.ApiService && typeof window.ApiService.createTask === 'function') {
            try {
                const result = await window.ApiService.createTask(newCollaborator);
                newCollaborator.id = result.success ? result.id : 'colab-' + Date.now();
            } catch(e) {
                newCollaborator.id = 'colab-' + Date.now();
                this.saveToLocalStorage(newCollaborator);
            }
        } else {
            newCollaborator.id = 'colab-' + Date.now();
            this.saveToLocalStorage(newCollaborator);
        }

        this.renderCard(newCollaborator);
        this.updateColumnCounts();
        if (typeof window.showNotification === 'function') {
            window.showNotification('Colaborador adicionado ao fluxo!', 'success');
        } else {
            alert('Colaborador adicionado ao fluxo!');
        }
    }

    // 3. RENDERIZAR O CARD NO HTML
    renderCard(data) {
        const card = document.createElement('div');
        const isUrgent = data.priority === 'high';
        
        card.className = `task-card ${isUrgent ? 'high-priority' : 'medium-priority'}`;
        card.dataset.id = data.id;
        card.setAttribute('draggable', 'true');
        // Guarda os dados originais no elemento para facilitar atualizações
        card.dataset.taskData = JSON.stringify(data);

        // Gera as iniciais para o Avatar (Ex: Maria Silva -> MS)
        const initials = data.title.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'NO';
        
        // Define os rótulos baseado no departamento
        const deptLabels = { 'rh': 'RH', 'ti': 'TI', 'sesmt': 'SESMT', 'gestao': 'GESTÃO' };
        const deptLabel = deptLabels[data.department] || 'RH';

        const priorityBg = isUrgent ? 'rgba(255, 59, 48, 0.1)' : '#E5E5EA';
        const priorityColor = isUrgent ? '#FF3B30' : '#333';
        const priorityText = isUrgent ? 'URGENTE' : 'NO PRAZO';

        card.innerHTML = `
            <div class="task-header">
                <div class="task-tags">
                    <span class="task-tag" style="background: ${priorityBg}; color: ${priorityColor};">${priorityText}</span>
                    <span class="task-tag" style="background: #E5E5EA; color: #333;">${deptLabel}</span>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn delete-task" title="Arquivar Colaborador"><i class="fas fa-archive"></i></button>
                </div>
            </div>
            <h4 class="task-title">${data.title}</h4>
            <p class="task-description">${data.description}</p>
            <div class="task-footer">
                <div class="task-assignee">
                    <div class="assignee-avatar">${initials}</div>
                    <span class="assignee-name">Em Integração</span>
                </div>
                <div class="task-deadline"><i class="far fa-calendar"></i><span>${data.deadline}</span></div>
            </div>
        `;

        // Adiciona eventos aos botões internos
        card.querySelector('.delete-task').addEventListener('click', () => this.deleteTask(card, data.id));

        // Adiciona eventos de Drag & Drop ao Card
        card.addEventListener('dragstart', (e) => {
            this.draggedCard = card;
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', data.id);
            // Efeito visual transparente enquanto arrasta
            setTimeout(() => card.style.opacity = '0.5', 0);
        });

        card.addEventListener('dragend', () => {
            this.draggedCard = null;
            card.classList.remove('dragging');
            card.style.opacity = '1';
            this.updateColumnCounts();
        });

        // Encontra a coluna correta para inserir
        const targetColumn = this.columns[data.department] || this.columns['rh'];
        if (targetColumn) {
            targetColumn.appendChild(card);
        }
    }

    // 4. LÓGICA DE DRAG & DROP DAS COLUNAS
    setupDragAndDrop() {
        Object.keys(this.columns).forEach(deptKey => {
            const column = this.columns[deptKey];
            if (!column) return;

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

                if (this.draggedCard && this.draggedCard.parentNode !== column) {
                    column.appendChild(this.draggedCard);
                    
                    // Recupera os dados do card
                    const taskId = this.draggedCard.dataset.id;
                    let taskData = JSON.parse(this.draggedCard.dataset.taskData);
                    
                    // Atualiza o departamento/status
                    taskData.department = deptKey;
                    taskData.status = deptKey;
                    this.draggedCard.dataset.taskData = JSON.stringify(taskData);
                    
                    // Atualiza o rótulo visual (Tag) no card
                    const deptLabels = { 'rh': 'RH', 'ti': 'TI', 'sesmt': 'SESMT', 'gestao': 'GESTÃO' };
                    const tags = this.draggedCard.querySelectorAll('.task-tag');
                    if(tags.length >= 2) {
                        tags[1].textContent = deptLabels[deptKey] || deptKey.toUpperCase();
                    }

                    // Salva a alteração
                    if (window.ApiService && typeof window.ApiService.updateTaskStatus === 'function') {
                        try {
                            await window.ApiService.updateTaskStatus(taskId, deptKey);
                        } catch(err) {
                            this.saveToLocalStorage(taskData);
                        }
                    } else {
                        this.saveToLocalStorage(taskData);
                    }

                    if (typeof window.showNotification === 'function') {
                        window.showNotification('Colaborador movido para a próxima etapa!', 'success');
                    }
                    
                    this.updateColumnCounts();
                }
            });
        });
    }

    // 5. APAGAR/ARQUIVAR TAREFA
    async deleteTask(cardElement, taskId) {
        if (confirm('Tem a certeza que deseja arquivar este colaborador do fluxo?')) {
            cardElement.remove();
            
            if (window.ApiService && typeof window.ApiService.deleteTask === 'function') {
                try {
                    await window.ApiService.deleteTask(taskId);
                } catch(e) {
                    this.deleteFromLocalStorage(taskId);
                }
            } else {
                this.deleteFromLocalStorage(taskId);
            }

            this.updateColumnCounts();
            
            if (typeof window.showNotification === 'function') {
                window.showNotification('Processo arquivado com sucesso!', 'success');
            }
        }
    }

    // 6. ATUALIZAR CONTADORES DOS CABEÇALHOS
    updateColumnCounts() {
        Object.values(this.columns).forEach(column => {
            if (!column) return;
            const count = column.querySelectorAll('.task-card').length;
            
            // O badge fica num elemento "irmão" acima do contentor de tarefas
            const header = column.previousElementSibling; 
            if (header) {
                const badge = header.querySelector('.column-count');
                if (badge) badge.textContent = count;
            }
        });
    }

    // Validação do Formulário (chamado pelo main.js)
    validateTaskForm(form) {
        const title = form.querySelector('#taskTitle').value;
        const desc = form.querySelector('#taskDescription').value;
        return title.trim() !== '' && desc.trim() !== '';
    }
}