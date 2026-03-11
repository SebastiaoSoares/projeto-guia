from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import hashlib
import sqlite3
import secrets
from functools import wraps

# Importações atualizadas para suportar o modelo SaaS
from models.models import (
    init_db, get_db_connection, get_all_tasks, create_colaborador_com_card_e_tarefas,
    update_task_status, delete_task, get_dashboard_stats,
    get_onboarding_data_by_token, get_card_com_tarefas_e_colaborador,
    update_tarefa_status, get_colunas_by_empresa,
    get_colaborador_by_token, add_anotacao_criptografada
)

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def api_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session or 'empresa_id' not in session:
            return jsonify({"error": "Não autorizado ou sessão expirada"}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('plataforma/login.html')

@app.route('/cadastro')
@login_required # Apenas um gestor logado pode aceder à página para cadastrar outro
def cadastro():
    return render_template('plataforma/cadastro.html')

@app.route('/login/colaborador')
def login_colaborador():
    return render_template('plataforma/login_colaborador.html')

@app.route('/plataforma')
def plataforma():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    if session.get('role') == 'colaborador':
        return redirect(url_for('onboarding', token=session.get('token')))
    else:
        return render_template('plataforma/dashboard.html')

@app.route('/plataforma/dashboard')
@login_required
def dashboard():
    return render_template('plataforma/dashboard.html')

@app.route('/plataforma/onboarding')
def onboarding():
    token = request.args.get('token')
    if not token:
        return render_template('error.html', mensagem="Token de acesso não fornecido"), 400
    
    colaborador = get_colaborador_by_token(token)
    if not colaborador:
        return render_template('error.html', mensagem="Token inválido ou expirado"), 404
    
    session['user_id'] = colaborador['id']
    session['role'] = 'colaborador'
    session['token'] = token
    # Para o colaborador, não precisamos armazenar empresa_id na sessão, 
    # pois o token único é suficiente para buscar todos os dados com segurança.
    
    return render_template('plataforma/onboarding.html', token=token)

@app.route('/api/login', methods=['POST'])
def api_login():
    try:
        data = request.json
        email = data.get('email')
        senha = data.get('senha')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Busca o utilizador e a empresa à qual pertence
        cursor.execute('''
            SELECT id, empresa_id, nome, senha_hash, role, setor_id 
            FROM usuarios_sistema 
            WHERE email = ? AND ativo = 1
        ''', (email,))
        
        usuario = cursor.fetchone()
        conn.close()
        
        if usuario:
            hash_completo = usuario['senha_hash']
            salt, hash_real = hash_completo.split('$')
            hash_verificar = hashlib.sha256((senha + salt).encode()).hexdigest()
            
            if hash_verificar == hash_real:
                session['user_id'] = usuario['id']
                session['empresa_id'] = usuario['empresa_id']
                session['nome'] = usuario['nome']
                session['role'] = usuario['role']
                session['setor_id'] = usuario['setor_id']
                return jsonify({"success": True, "redirect": "/plataforma/dashboard"})
                
        return jsonify({"success": False, "error": "Email ou senha incorretos"}), 401
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/cadastro', methods=['POST'])
@api_login_required
def api_cadastro():
    """Cadastra um novo gestor/membro do RH na MESMA empresa de quem está logado"""
    try:
        data = request.json
        nome = data.get('nome')
        sobrenome = data.get('sobrenome')
        email = data.get('email')
        senha = data.get('senha')
        
        # Herdamos o empresa_id do utilizador logado
        empresa_id = session.get('empresa_id')
        
        if not all([nome, sobrenome, email, senha]):
            return jsonify({"success": False, "error": "Todos os campos são obrigatórios"}), 400
        
        salt = secrets.token_hex(8)
        hash_senha = hashlib.sha256((senha + salt).encode()).hexdigest()
        senha_hash = f"{salt}${hash_senha}"
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verifica se email já existe no sistema globalmente
        cursor.execute('SELECT id FROM usuarios_sistema WHERE email = ?', (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"success": False, "error": "Email já cadastrado"}), 400
        
        # Insere novo gestor para a mesma empresa
        cursor.execute('''
            INSERT INTO usuarios_sistema (empresa_id, nome, email, senha_hash, role, ativo)
            VALUES (?, ?, ?, ?, 'admin', 1)
        ''', (empresa_id, f"{nome} {sobrenome}", email, senha_hash))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True, 
            "redirect": "/plataforma/dashboard"
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/colunas', methods=['GET'])
@api_login_required
def api_get_colunas():
    empresa_id = session.get('empresa_id')
    colunas = get_colunas_by_empresa(empresa_id)
    return jsonify(colunas)

@app.route('/api/tasks', methods=['GET'])
@api_login_required
def api_get_tasks():
    empresa_id = session.get('empresa_id')
    tasks = get_all_tasks(empresa_id)
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
@api_login_required
def api_create_task():
    try:
        empresa_id = session.get('empresa_id')
        data = request.json
        result = create_colaborador_com_card_e_tarefas(empresa_id, data)
        
        if result and result.get('success'):
            return jsonify({
                "success": True, 
                "id": result['card_id'],
                "token": result['token']
            }), 201
        else:
            return jsonify({
                "success": False, 
                "error": result.get('error', 'Falha ao criar colaborador')
            }), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/cards/<int:card_id>', methods=['GET'])
@api_login_required
def api_get_card_detalhes(card_id):
    empresa_id = session.get('empresa_id')
    card_data = get_card_com_tarefas_e_colaborador(card_id, empresa_id)
    if card_data:
        return jsonify(card_data)
    return jsonify({"error": "Card não encontrado ou não pertence a esta empresa"}), 404

@app.route('/api/tasks/<int:task_id>/status', methods=['PATCH'])
@api_login_required
def api_update_status(task_id):
    empresa_id = session.get('empresa_id')
    data = request.json
    success = update_task_status(task_id, data['coluna_id'], empresa_id)
    return jsonify({"success": success})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@api_login_required
def api_delete_task(task_id):
    empresa_id = session.get('empresa_id')
    success = delete_task(task_id, empresa_id)
    return jsonify({"success": success})

# --- Rotas Acessíveis ao Colaborador (Baseadas no Token ou Ação Específica) ---

@app.route('/api/tarefas/<int:tarefa_id>', methods=['PATCH'])
def api_toggle_tarefa(tarefa_id):
    # Tanto o gestor quanto o colaborador podem alterar o status da tarefa.
    # O controlo exato de permissões pode ser expandido aqui futuramente.
    data = request.json
    success = update_tarefa_status(tarefa_id, data['concluida'])
    return jsonify({"success": success})

@app.route('/api/meu-onboarding', methods=['GET'])
def api_get_meu_onboarding():
    token = request.args.get('token')
    if not token:
        return jsonify({"error": "Token não fornecido"}), 401
    
    dados = get_onboarding_data_by_token(token)
    if dados:
        return jsonify(dados)
    return jsonify({"error": "Dados não encontrados"}), 404

@app.route('/api/anotacoes', methods=['POST'])
def api_salvar_anotacao():
    data = request.json
    token = data.get('token')
    anotacao = data.get('anotacao')
    
    if not token or anotacao is None:
        return jsonify({"error": "Dados incompletos"}), 400
    
    success = add_anotacao_criptografada(token, anotacao)
    return jsonify({"success": success})

@app.route('/api/dashboard/stats', methods=['GET'])
@api_login_required
def api_get_stats():
    empresa_id = session.get('empresa_id')
    stats = get_dashboard_stats(empresa_id)
    return jsonify(stats)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True)
