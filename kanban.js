// Kanban Board Functionality for TaskFlow

class KanbanBoard {
    constructor() {
        this.columns = document.querySelectorAll('.kanban-column');
        this.tasks = document.querySelectorAll('.task-card');
        this.currentDraggedTask = null;
        this.init();
    }
    
    init() {
        this.setupDragAndDrop();
        this.setupTaskActions();
        this.setupFilters();
        this.loadTasks();
        this.setupNewTaskModal();
    }
    
    setupDragAndDrop() {
        // Make tasks draggable
        this.tasks.forEach(task => {
            task.setAttribute('draggable', 'true');
            
            task.addEventListener('dragstart', (e) => {
                this.currentDraggedTask = task;
                setTimeout(() => {
                    task.style.opacity = '0.4';
                }, 0);
                e.dataTransfer.effectAllowed = 'move';
            });
            
            task.addEventListener('dragend', () => {
                task.style.opacity = '1';
                this.currentDraggedTask = null;
            });
        });
        
        // Setup column drop zones
        this.columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                column.style.backgroundColor = 'rgba(255, 59, 48, 0.05)';
            });
            
            column.addEventListener('dragleave', () => {
                column.style.backgroundColor = '';
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.style.backgroundColor = '';
                
                if (this.currentDraggedTask) {
                    const tasksContainer = column.querySelector('.tasks-container');
                    tasksContainer.appendChild(this.currentDraggedTask);
                    this.updateTaskCount(column);
                    
                    // Update task status based on column
                    this.updateTaskStatus(this.currentDraggedTask, column);
                    
                    // Show notification
                    this.showNotification(`Tarefa movida para: ${column.querySelector('.column-header h3').textContent}`, 'success');
                    
                    // Save to localStorage
                    this.saveTasks();
                }
            });
        });
    }
    
    updateTaskCount(column) {
        const countElement = column.querySelector('.column-count');
        const tasksCount = column.querySelectorAll('.task-card').length;
        countElement.textContent = tasksCount;
    }
    
    updateTaskStatus(task, column) {
        const columnType = column.classList[1]; // column-todo, column-progress, etc.
        const statusMap = {
            'column-todo': 'pending',
            'column-progress': 'in_progress',
            'column-review': 'in_review',
            'column-done': 'completed'
        };
        
        task.dataset.status = statusMap[columnType] || 'pending';
        
        // Update visual indicator
        task.classList.remove('status-pending', 'status-progress', 'status-review', 'status-done');
        task.classList.add(`status-${statusMap[columnType]}`);
    }
    
    setupTaskActions() {
        document.addEventListener('click', (e) => {
            // Edit task
            if (e.target.closest('.edit-task')) {
                const taskCard = e.target.closest('.task-card');
                this.openEditModal(taskCard);
            }
            
            // Delete task
            if (e.target.closest('.delete-task')) {
                const taskCard = e.target.closest('.task-card');
                if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                    taskCard.remove();
                    this.showNotification('Tarefa excluída com sucesso!', 'success');
                    this.saveTasks();
                    
                    // Update column counts
                    this.columns.forEach(column => this.updateTaskCount(column));
                }
            }
            
            // Complete checklist item
            if (e.target.closest('.checklist-item input[type="checkbox"]')) {
                const checkbox = e.target;
                const checklistItem = checkbox.closest('.checklist-item');
                const progressBar = checklistItem.closest('.task-card')?.querySelector('.checklist-fill');
                
                if (progressBar) {
                    const totalItems = checklistItem.closest('.task-checklist')?.querySelectorAll('.checklist-item').length || 0;
                    const checkedItems = checklistItem.closest('.task-checklist')?.querySelectorAll('.checklist-item input[type="checkbox"]:checked').length || 0;
                    const percentage = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;
                    
                    progressBar.style.width = `${percentage}%`;
                    
                    // Update checklist summary
                    const summary = checklistItem.closest('.task-card')?.querySelector('.checklist-summary span');
                    if (summary) {
                        summary.textContent = `${checkedItems}/${totalItems} concluído`;
                    }
                }
                
                this.saveTasks();
            }
        });
    }
    
    setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const searchInput = document.querySelector('.dashboard-search input');
        
        // Priority/Status Filters
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filterType = button.dataset.filter;
                const filterValue = button.dataset.value;
                
                this.tasks.forEach(task => {
                    if (filterType === 'all') {
                        task.style.display = 'block';
                    } else if (filterType === 'priority') {
                        task.style.display = task.classList.contains(`priority-${filterValue}`) ? 'block' : 'none';
                    } else if (filterType === 'status') {
                        task.style.display = task.dataset.status === filterValue ? 'block' : 'none';
                    }
                });
                
                // Update active filter button
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
        
        // Search filter
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                
                this.tasks.forEach(task => {
                    const title = task.querySelector('.task-title')?.textContent.toLowerCase() || '';
                    const description = task.querySelector('.task-description')?.textContent.toLowerCase() || '';
                    const assignee = task.querySelector('.assignee-name')?.textContent.toLowerCase() || '';
                    
                    const isVisible = title.includes(searchTerm) || 
                                      description.includes(searchTerm) || 
                                      assignee.includes(searchTerm);
                    
                    task.style.display = isVisible ? 'block' : 'none';
                });
            });
        }
    }
    
    setupNewTaskModal() {
        const newTaskBtn = document.querySelector('.btn-new-task');
        const modalOverlay = document.querySelector('.task-modal-overlay');
        const closeModalBtn = document.querySelector('.close-modal');
        const cancelBtn = document.querySelector('.btn-cancel');
        const saveTaskBtn = document.querySelector('.btn-save-task');
        const taskForm = document.getElementById('taskForm');
        
        if (!newTaskBtn || !modalOverlay) return;
        
        // Open modal
        newTaskBtn.addEventListener('click', () => {
            modalOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Reset form
            if (taskForm) {
                taskForm.reset();
                taskForm.dataset.mode = 'create';
                modalOverlay.querySelector('.modal-header h3').textContent = 'Nova Tarefa';
            }
        });
        
        // Close modal
        const closeModal = () => {
            modalOverlay.style.display = 'none';
            document.body.style.overflow = '';
        };
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        // Save task
        if (saveTaskBtn && taskForm) {
            saveTaskBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (this.validateTaskForm(taskForm)) {
                    if (taskForm.dataset.mode === 'create') {
                        this.createNewTask(taskForm);
                    } else {
                        this.updateTask(taskForm);
                    }
                    
                    closeModal();
                }
            });
        }
    }
    
    validateTaskForm(form) {
        const title = form.querySelector('#taskTitle');
        const description = form.querySelector('#taskDescription');
        
        let isValid = true;
        
        if (!title.value.trim()) {
            this.showFormError(title, 'O título é obrigatório');
            isValid = false;
        } else {
            this.clearFormError(title);
        }
        
        if (!description.value.trim()) {
            this.showFormError(description, 'A descrição é obrigatória');
            isValid = false;
        } else {
            this.clearFormError(description);
        }
        
        return isValid;
    }
    
    showFormError(input, message) {
        input.style.borderColor = '#FF3B30';
        
        let errorElement = input.nextElementSibling;
        if (!errorElement?.classList.contains('form-error')) {
            errorElement = document.createElement('div');
            errorElement.className = 'form-error';
            errorElement.style.color = '#FF3B30';
            errorElement.style.fontSize = '0.85rem';
            errorElement.style.marginTop = '5px';
            input.parentNode.insertBefore(errorElement, input.nextSibling);
        }
        
        errorElement.textContent = message;
    }
    
    clearFormError(input) {
        input.style.borderColor = '#34C759';
        const errorElement = input.nextElementSibling;
        if (errorElement?.classList.contains('form-error')) {
            errorElement.remove();
        }
    }
    
    createNewTask(form) {
        const formData = new FormData(form);
        const taskData = {
            id: Date.now(),
            title: formData.get('title'),
            description: formData.get('description'),
            priority: formData.get('priority'),
            department: formData.get('department'),
            assignee: formData.get('assignee'),
            deadline: formData.get('deadline'),
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Create task element
        const taskElement = this.createTaskElement(taskData);
        
        // Add to appropriate column
        const targetColumn = document.querySelector('.column-todo .tasks-container');
        targetColumn.appendChild(taskElement);
        
        // Update column count
        this.updateTaskCount(targetColumn.closest('.kanban-column'));
        
        // Show success message
        this.showNotification('Tarefa criada com sucesso!', 'success');
        
        // Save to localStorage
        this.saveTasks();
        
        // Reset form
        form.reset();
    }
    
    createTaskElement(taskData) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-card ${taskData.priority}-priority`;
        taskElement.dataset.id = taskData.id;
        taskElement.dataset.status = taskData.status;
        
        const priorityLabels = {
            'high': 'ALTA',
            'medium': 'MÉDIA',
            'low': 'BAIXA'
        };
        
        const assigneeInitials = taskData.assignee.split(' ').map(n => n[0]).join('').toUpperCase();
        
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-tags">
                    <span class="task-tag tag-priority-${taskData.priority}">
                        ${priorityLabels[taskData.priority] || 'PRIORIDADE'}
                    </span>
                    <span class="task-tag tag-${taskData.department}">
                        ${taskData.department.toUpperCase()}
                    </span>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit-task" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action-btn delete-task" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="task-title">${taskData.title}</h4>
            <p class="task-description">${taskData.description}</p>
            <div class="task-footer">
                <div class="task-assignee">
                    <div class="assignee-avatar">${assigneeInitials}</div>
                    <span class="assignee-name">${taskData.assignee}</span>
                </div>
                <div class="task-deadline">
                    <i class="far fa-calendar"></i>
                    <span>${this.formatDate(taskData.deadline)}</span>
                </div>
            </div>
        `;
        
        // Make draggable
        taskElement.setAttribute('draggable', 'true');
        this.setupTaskDragEvents(taskElement);
        
        return taskElement;
    }
    
    setupTaskDragEvents(taskElement) {
        taskElement.addEventListener('dragstart', (e) => {
            this.currentDraggedTask = taskElement;
            setTimeout(() => {
                taskElement.style.opacity = '0.4';
            }, 0);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        taskElement.addEventListener('dragend', () => {
            taskElement.style.opacity = '1';
            this.currentDraggedTask = null;
        });
    }
    
    openEditModal(taskCard) {
        const modalOverlay = document.querySelector('.task-modal-overlay');
        const modal = modalOverlay.querySelector('.task-modal');
        const form = document.getElementById('taskForm');
        
        if (!modalOverlay || !form) return;
        
        // Populate form with task data
        const taskId = taskCard.dataset.id;
        form.dataset.taskId = taskId;
        form.dataset.mode = 'edit';
        
        // Get task data (in a real app, this would come from a data store)
        const taskData = {
            title: taskCard.querySelector('.task-title').textContent,
            description: taskCard.querySelector('.task-description').textContent,
            priority: taskCard.classList.contains('high-priority') ? 'high' : 
                     taskCard.classList.contains('medium-priority') ? 'medium' : 'low',
            department: taskCard.querySelector('.task-tag:not(.tag-priority)')?.textContent.toLowerCase().trim() || 'geral',
            assignee: taskCard.querySelector('.assignee-name').textContent,
            deadline: taskCard.querySelector('.task-deadline span').textContent
        };
        
        // Set form values
        form.querySelector('#taskTitle').value = taskData.title;
        form.querySelector('#taskDescription').value = taskData.description;
        form.querySelector('#taskPriority').value = taskData.priority;
        form.querySelector('#taskDepartment').value = taskData.department;
        form.querySelector('#taskAssignee').value = taskData.assignee;
        form.querySelector('#taskDeadline').value = taskData.deadline;
        
        // Update modal title
        modal.querySelector('.modal-header h3').textContent = 'Editar Tarefa';
        
        // Show modal
        modalOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    updateTask(form) {
        const taskId = form.dataset.taskId;
        const taskCard = document.querySelector(`.task-card[data-id="${taskId}"]`);
        
        if (!taskCard) return;
        
        const formData = new FormData(form);
        
        // Update task card
        taskCard.querySelector('.task-title').textContent = formData.get('title');
        taskCard.querySelector('.task-description').textContent = formData.get('description');
        taskCard.querySelector('.assignee-name').textContent = formData.get('assignee');
        taskCard.querySelector('.task-deadline span').textContent = formData.get('deadline');
        
        // Update priority
        taskCard.classList.remove('high-priority', 'medium-priority', 'low-priority');
        taskCard.classList.add(`${formData.get('priority')}-priority`);
        
        // Update priority tag
        const priorityTag = taskCard.querySelector('.tag-priority-high, .tag-priority-medium, .tag-priority-low');
        if (priorityTag) {
            priorityTag.className = `task-tag tag-priority-${formData.get('priority')}`;
            priorityTag.textContent = formData.get('priority') === 'high' ? 'ALTA' : 
                                     formData.get('priority') === 'medium' ? 'MÉDIA' : 'BAIXA';
        }
        
        // Update assignee avatar
        const assigneeInitials = formData.get('assignee').split(' ').map(n => n[0]).join('').toUpperCase();
        taskCard.querySelector('.assignee-avatar').textContent = assigneeInitials;
        
        // Show success message
        this.showNotification('Tarefa atualizada com sucesso!', 'success');
        
        // Save to localStorage
        this.saveTasks();
    }
    
    formatDate(dateString) {
        if (!dateString) return 'Sem data';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    showNotification(message, type = 'info') {
        // Use main.js notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback simple notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#34C759' : type === 'error' ? '#FF3B30' : '#007AFF'};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
            
            // Add animations
            if (!document.querySelector('#kanbanNotifications')) {
                const style = document.createElement('style');
                style.id = 'kanbanNotifications';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes slideOut {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100%); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }
    
    saveTasks() {
        const tasks = [];
        
        document.querySelectorAll('.task-card').forEach(taskCard => {
            const column = taskCard.closest('.kanban-column');
            const status = column ? 
                column.classList.contains('column-todo') ? 'pending' :
                column.classList.contains('column-progress') ? 'in_progress' :
                column.classList.contains('column-review') ? 'in_review' : 'completed' 
                : 'pending';
            
            tasks.push({
                id: taskCard.dataset.id || Date.now(),
                title: taskCard.querySelector('.task-title')?.textContent || '',
                description: taskCard.querySelector('.task-description')?.textContent || '',
                priority: taskCard.classList.contains('high-priority') ? 'high' : 
                         taskCard.classList.contains('medium-priority') ? 'medium' : 'low',
                department: taskCard.querySelector('.task-tag:not(.tag-priority)')?.textContent || 'Geral',
                assignee: taskCard.querySelector('.assignee-name')?.textContent || '',
                deadline: taskCard.querySelector('.task-deadline span')?.textContent || '',
                status: status,
                position: Array.from(taskCard.parentNode.children).indexOf(taskCard)
            });
        });
        
        localStorage.setItem('kanbanTasks', JSON.stringify(tasks));
    }
    
    loadTasks() {
        const savedTasks = localStorage.getItem('kanbanTasks');
        
        if (savedTasks) {
            const tasks = JSON.parse(savedTasks);
            
            // Clear existing tasks (except template/placeholder)
            document.querySelectorAll('.task-card:not(.task-template)').forEach(task => task.remove());
            
            // Add saved tasks
            tasks.forEach(task => {
                const taskElement = this.createTaskElement(task);
                const targetColumn = this.getColumnByStatus(task.status);
                
                if (targetColumn) {
                    const tasksContainer = targetColumn.querySelector('.tasks-container');
                    
                    // Insert at saved position
                    const existingTasks = tasksContainer.querySelectorAll('.task-card');
                    if (task.position < existingTasks.length) {
                        tasksContainer.insertBefore(taskElement, existingTasks[task.position]);
                    } else {
                        tasksContainer.appendChild(taskElement);
                    }
                    
                    // Update task status
                    this.updateTaskStatus(taskElement, targetColumn);
                }
            });
            
            // Update all column counts
            this.columns.forEach(column => this.updateTaskCount(column));
        }
    }
    
    getColumnByStatus(status) {
        const statusMap = {
            'pending': 'column-todo',
            'in_progress': 'column-progress',
            'in_review': 'column-review',
            'completed': 'column-done'
        };
        
        const columnClass = statusMap[status] || 'column-todo';
        return document.querySelector(`.${columnClass}`);
    }
}

// Initialize Kanban Board when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.kanbanBoard = new KanbanBoard();
    
    // Make kanban filter function available globally
    window.filterKanbanByDepartment = function(department) {
        const tasks = document.querySelectorAll('.task-card');
        
        tasks.forEach(task => {
            const taskDepartment = task.querySelector('.task-tag:not(.tag-priority)')?.textContent || '';
            const shouldShow = department === 'Todos' || 
                             taskDepartment.toLowerCase().includes(department.toLowerCase());
            
            task.style.display = shouldShow ? 'block' : 'none';
        });
        
        // Update active filter in sidebar
        document.querySelectorAll('.department-list a').forEach(link => {
            link.classList.remove('active');
            if (link.textContent.includes(department)) {
                link.classList.add('active');
            }
        });
    };
});

// Add drag and drop touch support for mobile
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', handleTouchStart, {passive: false});
    document.addEventListener('touchmove', handleTouchMove, {passive: false});
    document.addEventListener('touchend', handleTouchEnd);
}

let touchDragged = null;
let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
    const task = e.target.closest('.task-card');
    if (task) {
        touchDragged = task;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        task.style.transition = 'none';
    }
}

function handleTouchMove(e) {
    if (!touchDragged) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    touchDragged.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    touchDragged.style.zIndex = '1000';
    touchDragged.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
}

function handleTouchEnd(e) {
    if (!touchDragged) return;
    
    // Reset position
    touchDragged.style.transform = '';
    touchDragged.style.transition = 'all 0.3s ease';
    touchDragged.style.zIndex = '';
    touchDragged.style.boxShadow = '';
    
    // Find drop target (simplified version)
    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const column = elementBelow?.closest('.kanban-column');
    
    if (column && touchDragged.parentNode !== column.querySelector('.tasks-container')) {
        const tasksContainer = column.querySelector('.tasks-container');
        if (tasksContainer) {
            tasksContainer.appendChild(touchDragged);
            
            // Update kanban board
            if (window.kanbanBoard) {
                window.kanbanBoard.updateTaskCount(column);
                window.kanbanBoard.updateTaskStatus(touchDragged, column);
                window.kanbanBoard.saveTasks();
            }
        }
    }
    
    touchDragged = null;
}
