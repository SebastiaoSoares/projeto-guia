from flask_sqlalchemy import SQLAlchemy
import secrets
from datetime import datetime

# Instância do banco desvinculada do app (evita importação circular)
db = SQLAlchemy()

class Empresa(db.Model):
    __tablename__ = 'empresas'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    cnpj = db.Column(db.String(20), unique=True, nullable=False)
    data_cadastro = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    gestores = db.relationship('Gestor', backref='empresa', lazy=True)
    colaboradores = db.relationship('Colaborador', backref='empresa', lazy=True)
    colunas = db.relationship('Coluna', backref='empresa', lazy=True)

class Gestor(db.Model):
    __tablename__ = 'gestores'
    id = db.Column(db.Integer, primary_key=True)
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)
    is_rh = db.Column(db.Boolean, default=True)
    setor = db.Column(db.String(100), nullable=True)

class Coluna(db.Model):
    __tablename__ = 'colunas'
    id = db.Column(db.Integer, primary_key=True)
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    nome = db.Column(db.String(50), nullable=False)
    cor_hex = db.Column(db.String(7), default='#808080')
    ordem = db.Column(db.Integer, nullable=False, default=0)

class Colaborador(db.Model):
    __tablename__ = 'colaboradores'
    id = db.Column(db.Integer, primary_key=True)
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    coluna_id = db.Column(db.Integer, db.ForeignKey('colunas.id'), nullable=False)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    telefone = db.Column(db.String(20))
    cargo = db.Column(db.String(100), nullable=False)
    departamento = db.Column(db.String(100), nullable=False)
    # Geração automática e segura do token exigida no documento
    token_acesso = db.Column(db.String(64), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(16))
    status = db.Column(db.String(20), default='ativo')
    data_admissao = db.Column(db.DateTime, default=datetime.utcnow)

class ChecklistPadrao(db.Model):
    __tablename__ = 'checklists_padrao'
    id = db.Column(db.Integer, primary_key=True)
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    coluna_id = db.Column(db.Integer, db.ForeignKey('colunas.id'), nullable=False)
    titulo = db.Column(db.String(150), nullable=False)
    descricao = db.Column(db.Text)

class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    colaborador_id = db.Column(db.Integer, db.ForeignKey('colaboradores.id'), nullable=False)
    coluna_id = db.Column(db.Integer, db.ForeignKey('colunas.id'), nullable=False)
    titulo = db.Column(db.String(150), nullable=False)
    descricao = db.Column(db.Text)
    status = db.Column(db.String(20), default='pendente') # pendente, concluida

class LogAtividade(db.Model):
    __tablename__ = 'logs_atividade'
    id = db.Column(db.Integer, primary_key=True)
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresas.id'), nullable=False)
    usuario_id = db.Column(db.Integer, nullable=False)
    tipo_usuario = db.Column(db.String(20), nullable=False) # 'gestor' ou 'colaborador'
    acao = db.Column(db.String(255), nullable=False)
    data_hora = db.Column(db.DateTime, default=datetime.utcnow)
