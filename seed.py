import os
from app import app
from models.models import db, Empresa, Gestor, Coluna
from werkzeug.security import generate_password_hash

def iniciar_banco():
    with app.app_context():
        # 1. Cria o banco SQLite e todas as tabelas
        db.create_all()
        
        # 2. Verifica se o admin da Empresa 1 já existe para evitar duplicação
        admin_existente = Gestor.query.filter_by(email="admin1@acesso.com").first()
        
        if not admin_existente:
            print("Populando o banco de dados SQLite com as duas empresas...")
            
            # --- CRIANDO A EMPRESA 1 ---
            empresa1 = Empresa(nome="Acesso 1", cnpj="11.111.111/0001-11")
            db.session.add(empresa1)
            
            # --- CRIANDO A EMPRESA 2 ---
            empresa2 = Empresa(nome="Acesso 2", cnpj="22.222.222/0001-22")
            db.session.add(empresa2)
            
            # Flush para pegar os IDs gerados no banco antes do commit final
            db.session.flush() 
            
            # --- CRIANDO AS COLUNAS PADRÃO PARA AS DUAS EMPRESAS ---
            colunas_padrao = [
                {'nome': 'RH - Documentação', 'cor_hex': '#34C759', 'ordem': 1},
                {'nome': 'SESMT - Exames', 'cor_hex': '#FF9500', 'ordem': 2},
                {'nome': 'TI - Acessos', 'cor_hex': '#007AFF', 'ordem': 3},
                {'nome': 'Gestor - Acolhimento', 'cor_hex': '#AF52DE', 'ordem': 4}
            ]
            
            for col in colunas_padrao:
                # Adiciona as colunas para a Empresa 1
                db.session.add(Coluna(empresa_id=empresa1.id, nome=col['nome'], cor_hex=col['cor_hex'], ordem=col['ordem']))
                # Adiciona as colunas para a Empresa 2
                db.session.add(Coluna(empresa_id=empresa2.id, nome=col['nome'], cor_hex=col['cor_hex'], ordem=col['ordem']))
            
            # --- CRIANDO O GESTOR DA EMPRESA 1 ---
            senha_hash1 = generate_password_hash("admin")
            gestor1 = Gestor(
                empresa_id=empresa1.id,
                nome="Admin E1",
                email="admin1@acesso.com",
                senha_hash=senha_hash1
            )
            db.session.add(gestor1)
            
            # --- CRIANDO O GESTOR DA EMPRESA 2 ---
            senha_hash2 = generate_password_hash("admin")
            gestor2 = Gestor(
                empresa_id=empresa2.id,
                nome="Admin E2",
                email="admin2@acesso.com",
                senha_hash=senha_hash2
            )
            db.session.add(gestor2)
            
            # Confirma as alterações no banco de dados
            db.session.commit()
            
            print("✅ Banco criado e populado!")
            print("🏢 Empresa Acesso 1: Login: admin1@acesso.com | Senha: admin")
            print("🏢 Empresa Acesso 2: Login: admin2@acesso.com | Senha: admin")
        else:
            print("⚡ Banco já estava populado.")

if __name__ == '__main__':
    iniciar_banco()
