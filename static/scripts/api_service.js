class ApiService {
    constructor() {
        this.baseUrl = '/api';
    }

    async getColunas() {
        try {
            const response = await fetch(`${this.baseUrl}/colunas`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar colunas:', error);
            return [];
        }
    }

    async createColuna(dados) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao criar coluna:', error);
            return false;
        }
    }

    async updateColuna(id, dados) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao atualizar coluna:', error);
            return false;
        }
    }

    async deleteColuna(id) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.erro || 'Erro ao deletar coluna');
            return { success: true };
        } catch (error) {
            console.error('Erro:', error);
            return { success: false, erro: error.message };
        }
    }

    async getColaboradores() {
        try {
            const response = await fetch(`${this.baseUrl}/colaboradores`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar colaboradores:', error);
            return [];
        }
    }

    async criarColaborador(dados) {
        try {
            const response = await fetch(`${this.baseUrl}/colaboradores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao criar colaborador:', error);
            return false;
        }
    }

    async moverCard(colaboradorId, novaColunaId) {
        try {
            const response = await fetch(`${this.baseUrl}/mover_card`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    colaborador_id: colaboradorId,
                    nova_coluna_id: novaColunaId
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao mover card:', error);
            return false;
        }
    }

    // --- NOVAS FUNÇÕES PARA O CHECKLIST PADRÃO ---
    
    async getChecklists(colunaId) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas/${colunaId}/checklists`);
            if (!response.ok) throw new Error('Erro ao buscar checklists');
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async createChecklist(colunaId, dados) {
        try {
            const response = await fetch(`${this.baseUrl}/colunas/${colunaId}/checklists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao criar checklist:', error);
            return false;
        }
    }

    async updateChecklist(checklistId, dados) {
        try {
            const response = await fetch(`${this.baseUrl}/checklists/${checklistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao atualizar checklist:', error);
            return false;
        }
    }

    async deleteChecklist(checklistId) {
        try {
            const response = await fetch(`${this.baseUrl}/checklists/${checklistId}`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao deletar checklist:', error);
            return false;
        }
    }

    async getColaboradorDetalhes(colaboradorId) {
        try {
            const response = await fetch(`${this.baseUrl}/colaboradores/${colaboradorId}/detalhes`);
            if (!response.ok) throw new Error('Erro ao buscar detalhes do colaborador');
            return await response.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    async toggleTaskGestor(taskId, status) {
        try {
            const response = await fetch(`${this.baseUrl}/gestor/tarefas/${taskId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            return response.ok;
        } catch (error) {
            console.error('Erro ao atualizar tarefa:', error);
            return false;
        }
    }

    // --- NOVAS FUNÇÕES DA EQUIPE ---
    async getEquipe() {
        try {
            const response = await fetch(`${this.baseUrl}/equipe`);
            if (!response.ok) throw new Error('Erro ao buscar equipe');
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async createMembroEquipe(dados) {
        try {
            const response = await fetch(`${this.baseUrl}/equipe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.erro || 'Erro ao criar membro');
            return { success: true };
        } catch (error) {
            console.error('Erro:', error);
            return { success: false, erro: error.message };
        }
    }
}

// Instância global para ser usada em outros arquivos
window.apiService = new ApiService();