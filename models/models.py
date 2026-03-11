import sqlite3
import secrets
import hashlib

DATABASE = 'guia.db'

def get_db_connection():
    """Estabelece a ligação com a base de dados SQLite e configura o retorno como dicionário."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Cria as tabelas do sistema preparadas para SaaS (Multi-empresa)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Empresas (Tenants)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. Utilizadores Administrativos (Gestores de cada Empresa)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios_sistema (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            setor_id INTEGER,
            ativo INTEGER DEFAULT 1,
            FOREIGN KEY (empresa_id) REFERENCES empresas (id)
        )
    ''')

    # 3. Colunas do Kanban (Dinâmicas por Empresa)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS colunas_kanban (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER,
            nome TEXT NOT NULL,
            ordem INTEGER NOT NULL,
            FOREIGN KEY (empresa_id) REFERENCES empresas (id)
        )
    ''')

    # 4. Checklists Padrão por Coluna/Setor
    # Aqui os setores definem o que deve ser feito com cada novo colaborador
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS checklists_padrao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coluna_id INTEGER,
            descricao TEXT NOT NULL,
            FOREIGN KEY (coluna_id) REFERENCES colunas_kanban (id)
        )
    ''')

    # 5. Colaboradores (Cards no Kanban)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS colaboradores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER,
            nome TEXT NOT NULL,
            email TEXT,
            cpf TEXT,
            token TEXT UNIQUE,
            coluna_id INTEGER,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas (id),
            FOREIGN KEY (coluna_id) REFERENCES colunas_kanban (id)
        )
    ''')

    # 6. Tarefas de Onboarding (O Checklist instanciado para o Colaborador)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tarefas_onboarding (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            colaborador_id INTEGER,
            coluna_id INTEGER,
            descricao TEXT NOT NULL,
            concluida INTEGER DEFAULT 0,
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores (id),
            FOREIGN KEY (coluna_id) REFERENCES colunas_kanban (id)
        )
    ''')

    # 7. Anotações Privadas do Colaborador (Guia de Bolso)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS anotacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            colaborador_id INTEGER,
            conteudo TEXT,
            data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (colaborador_id) REFERENCES colaboradores (id)
        )
    ''')

    conn.commit()
    conn.close()
    print("Base de dados 'guia.db' inicializada com estrutura SaaS.")

# --- FUNÇÕES DE BUSCA (READ) ---

def get_colunas_by_empresa(empresa_id):
    """Retorna as colunas do Kanban exclusivas de uma empresa."""
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM colunas_kanban WHERE empresa_id = ? ORDER BY ordem', (empresa_id,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_tasks(empresa_id):
    """Retorna todos os colaboradores (cards) de uma empresa."""
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT c.*, col.nome as coluna_nome 
        FROM colaboradores c
        LEFT JOIN colunas_kanban col ON c.coluna_id = col.id
        WHERE c.empresa_id = ?
    ''', (empresa_id,)).fetchall()
    conn.close()
    
    # Formatação para o Kanban frontend
    tasks = []
    for row in rows:
        tasks.append({
            "id": row['id'],
            "title": row['nome'],
            "email": row['email'],
            "cpf": row['cpf'],
            "status": row['coluna_id'], # Status agora é o ID da coluna
            "coluna_nome": row['coluna_nome'],
            "token": row['token']
        })
    return tasks

def get_colaborador_by_token(token):
    """Busca um colaborador pelo token (Não precisa de empresa_id pois o token é único globalmente)."""
    conn = get_db_connection()
    row = conn.execute('''
        SELECT c.*, e.nome as empresa_nome 
        FROM colaboradores c
        JOIN empresas e ON c.empresa_id = e.id
        WHERE c.token = ?
    ''', (token,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_onboarding_data_by_token(token):
    """Busca os dados do colaborador e as suas tarefas agrupadas por setor/coluna."""
    colaborador = get_colaborador_by_token(token)
    if not colaborador:
        return None
    
    conn = get_db_connection()
    
    # Buscar tarefas com o nome do setor (coluna) associado
    tarefas = conn.execute('''
        SELECT t.*, c.nome as setor_nome
        FROM tarefas_onboarding t
        JOIN colunas_kanban c ON t.coluna_id = c.id
        WHERE t.colaborador_id = ?
    ''', (colaborador['id'],)).fetchall()
    
    # Buscar as anotações
    anotacao = conn.execute('SELECT conteudo FROM anotacoes WHERE colaborador_id = ? ORDER BY data_registro DESC LIMIT 1', 
                            (colaborador['id'],)).fetchone()
    
    conn.close()
    
    colaborador['tarefas'] = [dict(t) for t in tarefas]
    colaborador['anotacoes'] = anotacao['conteudo'] if anotacao else ""
    return colaborador

def get_card_com_tarefas_e_colaborador(card_id, empresa_id):
    """Retorna os detalhes de um card específico para o Modal do Gestor."""
    conn = get_db_connection()
    card = conn.execute('SELECT * FROM colaboradores WHERE id = ? AND empresa_id = ?', (card_id, empresa_id)).fetchone()
    
    if not card:
        conn.close()
        return None
        
    tarefas = conn.execute('''
        SELECT t.*, c.nome as setor_nome
        FROM tarefas_onboarding t
        JOIN colunas_kanban c ON t.coluna_id = c.id
        WHERE t.colaborador_id = ?
    ''', (card_id,)).fetchall()
    
    anotacao = conn.execute('SELECT conteudo FROM anotacoes WHERE colaborador_id = ? ORDER BY data_registro DESC LIMIT 1', 
                            (card_id,)).fetchone()
    conn.close()
    
    return {
        "card": dict(card),
        "tarefas": [dict(t) for t in tarefas],
        "anotacoes": anotacao['conteudo'] if anotacao else ""
    }

# --- FUNÇÕES DE MANIPULAÇÃO (CREATE / UPDATE / DELETE) ---

def create_colaborador_com_card_e_tarefas(empresa_id, data):
    """Cria um colaborador, gera um token e o insere na primeira coluna da empresa."""
    try:
        token = secrets.token_hex(16)
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Encontra a primeira coluna desta empresa para ser o status inicial
        primeira_coluna = cursor.execute('SELECT id FROM colunas_kanban WHERE empresa_id = ? ORDER BY ordem LIMIT 1', (empresa_id,)).fetchone()
        coluna_inicial_id = primeira_coluna['id'] if primeira_coluna else None
        
        cursor.execute(
            'INSERT INTO colaboradores (empresa_id, nome, email, cpf, token, coluna_id) VALUES (?, ?, ?, ?, ?, ?)',
            (empresa_id, data.get('nome'), data.get('email'), data.get('cpf'), token, coluna_inicial_id)
        )
        
        card_id = cursor.lastrowid
        
        # Instanciar automaticamente as tarefas desta primeira coluna
        if coluna_inicial_id:
            _instanciar_tarefas_coluna_internal(cursor, card_id, coluna_inicial_id)
            
        conn.commit()
        conn.close()
        return {"success": True, "card_id": card_id, "token": token}
    except Exception as e:
        return {"success": False, "error": str(e)}

def _instanciar_tarefas_coluna_internal(cursor, colaborador_id, coluna_id):
    """Função interna auxiliar para copiar checklists padrão para as tarefas do colaborador."""
    # Verifica se já foram instanciadas tarefas para esta coluna/colaborador (para evitar duplicação)
    existentes = cursor.execute('SELECT id FROM tarefas_onboarding WHERE colaborador_id = ? AND coluna_id = ?', 
                               (colaborador_id, coluna_id)).fetchone()
    
    if not existentes:
        # Pega as tarefas padrão da coluna
        padroes = cursor.execute('SELECT descricao FROM checklists_padrao WHERE coluna_id = ?', (coluna_id,)).fetchall()
        
        for padrao in padroes:
            cursor.execute(
                'INSERT INTO tarefas_onboarding (colaborador_id, coluna_id, descricao) VALUES (?, ?, ?)',
                (colaborador_id, coluna_id, padrao['descricao'])
            )

def update_task_status(task_id, nova_coluna_id, empresa_id):
    """Atualiza a coluna de um card e aciona a criação das tarefas padrão do novo setor."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Atualiza a coluna no Kanban
    cursor.execute('UPDATE colaboradores SET coluna_id = ? WHERE id = ? AND empresa_id = ?', 
                   (nova_coluna_id, task_id, empresa_id))
    
    # Quando chega num setor novo, as tarefas daquele setor são atribuídas a ele
    _instanciar_tarefas_coluna_internal(cursor, task_id, nova_coluna_id)
    
    conn.commit()
    conn.close()
    return True

def update_tarefa_status(tarefa_id, concluida):
    """Marca uma tarefa de onboarding específica como concluída ou pendente."""
    conn = get_db_connection()
    conn.execute('UPDATE tarefas_onboarding SET concluida = ? WHERE id = ?', (1 if concluida else 0, tarefa_id))
    conn.commit()
    conn.close()
    return True

def delete_task(task_id, empresa_id):
    """Remove um colaborador do sistema."""
    conn = get_db_connection()
    # Apaga em cascata (manualmente via código para garantir)
    conn.execute('DELETE FROM tarefas_onboarding WHERE colaborador_id = ?', (task_id,))
    conn.execute('DELETE FROM anotacoes WHERE colaborador_id = ?', (task_id,))
    conn.execute('DELETE FROM colaboradores WHERE id = ? AND empresa_id = ?', (task_id, empresa_id))
    conn.commit()
    conn.close()
    return True

# --- FUNÇÕES COMPLEMENTARES ---

def add_anotacao_criptografada(token, texto):
    """Salva uma anotação vinculada ao token do colaborador."""
    colab = get_colaborador_by_token(token)
    if colab:
        conn = get_db_connection()
        # Se já existir uma anotação, podemos atualizar ou inserir uma nova. 
        # Aqui vamos fazer um UPSERT simples apagando a anterior e inserindo a nova.
        conn.execute('DELETE FROM anotacoes WHERE colaborador_id = ?', (colab['id'],))
        conn.execute('INSERT INTO anotacoes (colaborador_id, conteudo) VALUES (?, ?)', 
                     (colab['id'], texto))
        conn.commit()
        conn.close()
        return True
    return False

def get_dashboard_stats(empresa_id):
    """Retorna estatísticas básicas para o gráfico do Dashboard da Empresa."""
    conn = get_db_connection()
    total = conn.execute('SELECT COUNT(*) FROM colaboradores WHERE empresa_id = ?', (empresa_id,)).fetchone()[0]
    
    colunas_count = conn.execute('''
        SELECT col.nome, COUNT(c.id) as qtd
        FROM colunas_kanban col
        LEFT JOIN colaboradores c ON c.coluna_id = col.id AND c.empresa_id = ?
        WHERE col.empresa_id = ?
        GROUP BY col.id
    ''', (empresa_id, empresa_id)).fetchall()
    
    conn.close()
    return {
        "total_colaboradores": total, 
        "distribuicao": [{"setor": row['nome'], "quantidade": row['qtd']} for row in colunas_count]
    }
