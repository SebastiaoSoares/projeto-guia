import os
from app import app
from models.models import db, Empresa, Gestor, Coluna
from werkzeug.security import generate_password_hash

def iniciar_banco():
    with app.app_context():
        # 1. Cria o banco SQLite e todas as tabelas
        db.create_all()
        
        # 2. Verifica se o admin já existe
        admin_existente = Gestor.query.filter_by(email="admin@admin.com").first()
        
        if not admin_existente:
            print("Populando o banco de dados SQLite...")
            
            # Cria a Empresa
            nova_empresa = Empresa(nome="Demonstração GUIA", cnpj="00.000.000/0001-00")
            db.session.add(nova_empresa)
            db.session.flush() # Para pegar o ID gerado
            
            # Cria as Colunas Padrão
            colunas_padrao = [
                {'nome': 'RH - Documentação', 'cor_hex': '#34C759', 'ordem': 1},
                {'nome': 'SESMT - Exames', 'cor_hex': '#FF9500', 'ordem': 2},
                {'nome': 'TI - Acessos', 'cor_hex': '#007AFF', 'ordem': 3},
                {'nome': 'Gestor - Acolhimento', 'cor_hex': '#AF52DE', 'ordem': 4}
            ]
            
            for col in colunas_padrao:
                db.session.add(Coluna(empresa_id=nova_empresa.id, nome=col['nome'], cor_hex=col['cor_hex'], ordem=col['ordem']))
            
            # Cria o usuário Admin
            senha_hash = generate_password_hash("admin")
            novo_gestor = Gestor(
                empresa_id=nova_empresa.id,
                nome="Administrador",
                email="admin@admin.com",
                senha_hash=senha_hash
            )
            db.session.add(novo_gestor)
            
            db.session.commit()
            print("✅ Banco criado e populado! (admin@admin.com / admin)")
        else:
            print("⚡ Banco já estava populado.")

if __name__ == '__main__':
    iniciar_banco()
