import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
from models.models import db, Empresa, Gestor, Colaborador, Coluna, Task, ChecklistPadrao, LogAtividade

app = Flask(__name__)

# --- CORREÇÃO DO BANCO: Forçando caminho absoluto na raiz do projeto ---
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'guia.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Carregar a secret key de forma segura, com caminho absoluto também
try:
    with open(os.path.join(basedir, "secret.key"), "rb") as f:
        app.config['SECRET_KEY'] = f.read()
except FileNotFoundError:
    # Fallback seguro caso a chave não seja encontrada no momento da inicialização
    app.config['SECRET_KEY'] = b'chave_temporaria_segura_123'

db.init_app(app)

# --- DECORATORS PARA CONTROLE DE ACESSO ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def gestor_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('tipo_usuario') != 'gestor':
            flash('Acesso restrito a gestores.', 'danger')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def rh_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_rh'):
            return jsonify({'erro': 'Acesso negado. Permissão exclusiva do RH.'}), 403
        return f(*args, **kwargs)
    return decorated_function

# --- ROTAS DE AUTENTICAÇÃO ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        senha = request.form.get('senha')
        
        gestor = Gestor.query.filter_by(email=email).first()
        if gestor and check_password_hash(gestor.senha_hash, senha):
            session['user_id'] = gestor.id
            session['empresa_id'] = gestor.empresa_id
            session['nome'] = gestor.nome
            session['tipo_usuario'] = 'gestor'
            session['is_rh'] = gestor.is_rh
            session['setor'] = gestor.setor
            return redirect(url_for('dashboard'))
            
        flash('E-mail ou senha inválidos', 'danger')
    return render_template('plataforma/login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/login_colaborador', methods=['GET', 'POST'])
def login_colaborador():
    if request.method == 'POST':
        token = request.form.get('token')
        colaborador = Colaborador.query.filter_by(token_acesso=token).first()
        
        if colaborador:
            session['colaborador_id'] = colaborador.id
            session['empresa_id'] = colaborador.empresa_id
            session['nome'] = colaborador.nome
            session['tipo_usuario'] = 'colaborador'
            return redirect(url_for('onboarding'))
            
        flash('Token inválido', 'danger')
    return render_template('plataforma/login_colaborador.html')

# --- ROTAS PRINCIPAIS ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/cadastro')
def cadastro():
    # Como o cadastro é via CLI (regra de negócio), não temos página pública.
    flash('O cadastro de novas empresas é feito internamente. Entre em contato com a equipe comercial.', 'info')
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
@gestor_required
def dashboard():
    empresa = Empresa.query.get(session.get('empresa_id'))
    return render_template('plataforma/dashboard.html', 
                           nome_gestor=session.get('nome'),
                           is_rh=session.get('is_rh'),
                           setor_gestor=session.get('setor'),
                           nome_empresa=empresa.nome if empresa else 'Empresa')

@app.route('/onboarding')
def onboarding():
    if session.get('tipo_usuario') != 'colaborador':
        return redirect(url_for('login_colaborador'))
    return render_template('plataforma/onboarding.html', nome_colaborador=session.get('nome'))

# --- API ENDPOINTS (DASHBOARD GESTOR) ---
@app.route('/api/colunas', methods=['GET', 'POST'])
@login_required
def gerenciar_colunas():
    empresa_id = session.get('empresa_id')
    
    if request.method == 'GET':
        colunas = Coluna.query.filter_by(empresa_id=empresa_id).order_by(Coluna.ordem).all()
        return jsonify([{
            'id': c.id,
            'nome': c.nome,
            'cor_hex': c.cor_hex,
            'ordem': c.ordem
        } for c in colunas])
        
    if request.method == 'POST':
        if not session.get('is_rh'):
            return jsonify({'erro': 'Acesso negado. Apenas RH.'}), 403
            
        dados = request.json
        # Pega a última ordem para colocar a nova coluna no final
        max_ordem = db.session.query(db.func.max(Coluna.ordem)).filter_by(empresa_id=empresa_id).scalar() or 0
        
        nova_coluna = Coluna(
            empresa_id=empresa_id,
            nome=dados['nome'],
            cor_hex=dados.get('cor_hex', '#808080'),
            ordem=max_ordem + 1
        )
        db.session.add(nova_coluna)
        db.session.commit()
        return jsonify({'mensagem': 'Coluna criada', 'id': nova_coluna.id}), 201

@app.route('/api/colunas/<int:coluna_id>', methods=['PUT', 'DELETE'])
@login_required
@rh_required
def editar_excluir_coluna(coluna_id):
    empresa_id = session.get('empresa_id')
    coluna = Coluna.query.filter_by(id=coluna_id, empresa_id=empresa_id).first()
    
    if not coluna:
        return jsonify({'erro': 'Coluna não encontrada'}), 404
        
    if request.method == 'DELETE':
        # Trava de Segurança: Verifica se tem algum colaborador nesta coluna
        qtd_colaboradores = Colaborador.query.filter_by(coluna_id=coluna.id).count()
        if qtd_colaboradores > 0:
            return jsonify({'erro': 'Não é possível excluir uma fase que possui colaboradores. Mova-os para outra fase primeiro.'}), 400
            
        ChecklistPadrao.query.filter_by(coluna_id=coluna.id).delete()
        Task.query.filter_by(coluna_id=coluna.id).delete()
        db.session.delete(coluna)
        db.session.commit()
        return jsonify({'mensagem': 'Coluna excluída com sucesso'})
        
    if request.method == 'PUT':
        dados = request.json
        if 'nome' in dados:
            coluna.nome = dados['nome']
        if 'cor_hex' in dados:
            coluna.cor_hex = dados['cor_hex']
        db.session.commit()
        return jsonify({'mensagem': 'Coluna atualizada'})

@app.route('/api/colunas/<int:coluna_id>/checklists', methods=['GET', 'POST'])
@login_required
@gestor_required
def gerenciar_checklists_coluna(coluna_id):
    empresa_id = session.get('empresa_id')
    
    coluna = Coluna.query.filter_by(id=coluna_id, empresa_id=empresa_id).first()
    if not coluna:
        return jsonify({'erro': 'Coluna não encontrada ou acesso negado'}), 404
        
    if request.method == 'GET':
        checklists = ChecklistPadrao.query.filter_by(coluna_id=coluna_id, empresa_id=empresa_id).all()
        return jsonify([{
            'id': c.id,
            'titulo': c.titulo,
            'descricao': c.descricao
        } for c in checklists])
        
    # Protege a criação de checklists apenas para RH
    if request.method == 'POST':
        if not session.get('is_rh'):
            return jsonify({'erro': 'Acesso negado. Apenas RH.'}), 403
            
        dados = request.json
        if not dados or not dados.get('titulo'):
            return jsonify({'erro': 'Título é obrigatório'}), 400
            
        novo_checklist = ChecklistPadrao(
            empresa_id=empresa_id,
            coluna_id=coluna_id,
            titulo=dados.get('titulo'),
            descricao=dados.get('descricao', '')
        )
        db.session.add(novo_checklist)
        db.session.commit()
        return jsonify({'mensagem': 'Tarefa padrão criada com sucesso', 'id': novo_checklist.id}), 201

@app.route('/api/checklists/<int:checklist_id>', methods=['PUT', 'DELETE'])
@login_required
@rh_required
def editar_deletar_checklist_padrao(checklist_id):
    empresa_id = session.get('empresa_id')
    checklist = ChecklistPadrao.query.filter_by(id=checklist_id, empresa_id=empresa_id).first()
    
    if not checklist:
        return jsonify({'erro': 'Tarefa padrão não encontrada'}), 404
        
    if request.method == 'DELETE':
        db.session.delete(checklist)
        db.session.commit()
        return jsonify({'mensagem': 'Tarefa padrão removida com sucesso'}), 200
        
    if request.method == 'PUT':
        dados = request.json
        if 'titulo' in dados:
            checklist.titulo = dados['titulo']
        if 'descricao' in dados:
            checklist.descricao = dados['descricao']
        db.session.commit()
        return jsonify({'mensagem': 'Tarefa padrão atualizada com sucesso'})

@app.route('/api/colaboradores', methods=['GET', 'POST'])
@login_required
def gerenciar_colaboradores():
    empresa_id = session.get('empresa_id')
    
    if request.method == 'GET':
        colaboradores = Colaborador.query.filter_by(empresa_id=empresa_id).all()
        return jsonify([{
            'id': c.id,
            'nome': c.nome,
            'cargo': c.cargo,
            'departamento': c.departamento,
            'coluna_id': c.coluna_id,
            'status': c.status,
            'token': c.token_acesso
        } for c in colaboradores])
        
    if request.method == 'POST':
        if not session.get('is_rh'):
            return jsonify({'erro': 'Acesso negado. Apenas RH pode cadastrar colaboradores.'}), 403

        dados = request.json
        primeira_coluna = Coluna.query.filter_by(empresa_id=empresa_id).order_by(Coluna.ordem).first()
        
        if not primeira_coluna:
            return jsonify({'erro': 'Nenhuma coluna configurada para esta empresa.'}), 400
            
        novo_colaborador = Colaborador(
            empresa_id=empresa_id,
            nome=dados['nome'],
            email=dados.get('email'),
            telefone=dados.get('telefone'),
            cargo=dados['cargo'],
            departamento=dados['departamento'],
            coluna_id=primeira_coluna.id
        )
        db.session.add(novo_colaborador)
        db.session.commit()
        
        _instanciar_tarefas_coluna_internal(novo_colaborador.id, primeira_coluna.id, empresa_id)
        
        return jsonify({'mensagem': 'Colaborador criado com sucesso', 'id': novo_colaborador.id}), 201

@app.route('/api/mover_card', methods=['POST'])
@login_required
def mover_card():
    dados = request.json
    colaborador_id = dados.get('colaborador_id')
    nova_coluna_id = dados.get('nova_coluna_id')
    empresa_id = session.get('empresa_id')
    
    colaborador = Colaborador.query.filter_by(id=colaborador_id, empresa_id=empresa_id).first()
    if not colaborador:
        return jsonify({'erro': 'Colaborador não encontrado'}), 404
        
    colaborador.coluna_id = nova_coluna_id
    db.session.commit()
    
    _instanciar_tarefas_coluna_internal(colaborador.id, nova_coluna_id, empresa_id)
    
    return jsonify({'mensagem': 'Card movido com sucesso'})

@app.route('/api/colaboradores/<int:colab_id>/detalhes', methods=['GET'])
@login_required
@gestor_required
def detalhes_colaborador(colab_id):
    empresa_id = session.get('empresa_id')
    colaborador = Colaborador.query.filter_by(id=colab_id, empresa_id=empresa_id).first()
    
    if not colaborador:
        return jsonify({'erro': 'Colaborador não encontrado'}), 404

    # Busca as tarefas APENAS da coluna atual em que o colaborador está
    tarefas = Task.query.filter_by(colaborador_id=colaborador.id, coluna_id=colaborador.coluna_id).all()

    return jsonify({
        'id': colaborador.id,
        'nome': colaborador.nome,
        'cargo': colaborador.cargo,
        'departamento': colaborador.departamento,
        'email': colaborador.email,
        'telefone': colaborador.telefone,
        'token': colaborador.token_acesso,
        'tarefas': [{
            'id': t.id,
            'titulo': t.titulo,
            'descricao': t.descricao,
            'status': t.status
        } for t in tarefas]
    })

@app.route('/api/gestor/tarefas/<int:task_id>', methods=['POST'])
@login_required
@gestor_required
def gestor_atualizar_tarefa(task_id):
    empresa_id = session.get('empresa_id')
    
    # Verifica se a tarefa pertence a um colaborador da empresa do gestor (segurança)
    task = Task.query.join(Colaborador).filter(
        Task.id == task_id,
        Colaborador.empresa_id == empresa_id
    ).first()

    if not task:
        return jsonify({'erro': 'Tarefa não encontrada'}), 404

    dados = request.json
    task.status = dados.get('status', task.status)
    db.session.commit()
    return jsonify({'mensagem': 'Tarefa atualizada com sucesso'})

# --- NOVAS ROTAS DE EQUIPE (GESTORES) ---
@app.route('/api/equipe', methods=['GET', 'POST'])
@login_required
@rh_required
def gerenciar_equipe():
    empresa_id = session.get('empresa_id')
    
    if request.method == 'GET':
        equipe = Gestor.query.filter_by(empresa_id=empresa_id).all()
        return jsonify([{
            'id': g.id,
            'nome': g.nome,
            'email': g.email,
            'is_rh': g.is_rh,
            'setor': g.setor
        } for g in equipe])
        
    if request.method == 'POST':
        dados = request.json
        if Gestor.query.filter_by(email=dados['email']).first():
            return jsonify({'erro': 'E-mail já cadastrado.'}), 400
            
        novo_membro = Gestor(
            empresa_id=empresa_id,
            nome=dados['nome'],
            email=dados['email'],
            senha_hash=generate_password_hash(dados['senha']),
            is_rh=dados['is_rh'],
            setor=dados.get('setor', 'RH') if dados['is_rh'] else dados.get('setor')
        )
        db.session.add(novo_membro)
        db.session.commit()
        return jsonify({'mensagem': 'Membro da equipe adicionado com sucesso', 'id': novo_membro.id}), 201

def _instanciar_tarefas_coluna_internal(colaborador_id, coluna_id, empresa_id):
    checklists = ChecklistPadrao.query.filter_by(coluna_id=coluna_id, empresa_id=empresa_id).all()
    
    for padrao in checklists:
        tarefa_existente = Task.query.filter_by(
            colaborador_id=colaborador_id,
            coluna_id=coluna_id,
            titulo=padrao.titulo
        ).first()
        
        if not tarefa_existente:
            nova_task = Task(
                colaborador_id=colaborador_id,
                coluna_id=coluna_id,
                titulo=padrao.titulo,
                descricao=padrao.descricao,
                status='pendente'
            )
            db.session.add(nova_task)
            
    db.session.commit()

# --- API ENDPOINTS (GUIA DE BOLSO - COLABORADOR) ---
@app.route('/api/minhas_tarefas', methods=['GET'])
def minhas_tarefas():
    if session.get('tipo_usuario') != 'colaborador':
        return jsonify({'erro': 'Acesso negado'}), 403
        
    colaborador_id = session.get('colaborador_id')
    colaborador = Colaborador.query.get(colaborador_id)
    
    tarefas = Task.query.filter_by(colaborador_id=colaborador_id, coluna_id=colaborador.coluna_id).all()
    
    return jsonify([{
        'id': t.id,
        'titulo': t.titulo,
        'descricao': t.descricao,
        'status': t.status
    } for t in tarefas])

@app.route('/api/atualizar_tarefa/<int:task_id>', methods=['POST'])
def atualizar_tarefa(task_id):
    if session.get('tipo_usuario') != 'colaborador':
        return jsonify({'erro': 'Acesso negado'}), 403
        
    colaborador_id = session.get('colaborador_id')
    task = Task.query.filter_by(id=task_id, colaborador_id=colaborador_id).first()
    
    if not task:
        return jsonify({'erro': 'Tarefa não encontrada'}), 404
        
    dados = request.json
    task.status = dados.get('status', task.status)
    db.session.commit()
    
    return jsonify({'mensagem': 'Tarefa atualizada com sucesso'})

if __name__ == '__main__':
    with app.app_context():
        # Agora ele vai criar a tabela "guia.db" com o caminho absoluto corrigido.
        db.create_all()
    app.run(debug=True)
