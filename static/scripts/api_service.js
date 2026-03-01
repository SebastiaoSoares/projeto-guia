const ApiService = {
    async getTasks() {
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) throw new Error('Falha ao buscar tarefas');
            return await response.json();
        } catch (error) {
            console.error("Erro na API:", error);
            const saved = localStorage.getItem('kanbanTasksFallback');
            return saved ? JSON.parse(saved) : [];
        }
    },

    async createTask(taskData) {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao criar:", error);
            return { success: false };
        }
    },

    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            return { success: false };
        }
    },

    async deleteTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error("Erro ao deletar:", error);
            return { success: false };
        }
    },

    async getDashboardStats() {
        try {
            const response = await fetch('/api/dashboard/stats');
            return await response.json();
        } catch (error) {
            console.error("Erro ao buscar stats:", error);
            return null;
        }
    }
};

window.ApiService = ApiService;