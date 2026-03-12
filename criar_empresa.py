import sys
import random
from werkzeug.security import generate_password_hash

# Importamos o app e o banco de dados da aplicação principal
from app import app
from models.models import db, Empresa, Gestor, Coluna

def setup_empresa(nome_empresa, nome_gestor, email_gestor, senha_gestor):
    # O app_context() é obrigatório para usar o banco de dados do Flask em scripts externos
    with app.app_context():
        try:
            # 1. Garante que o banco e todas as tabelas (incluindo 'empresas') existam
            db.create_all()
            
            # 2. Verifica se o e-mail do gestor já existe no SaaS
            if Gestor.query.filter_by(email=email_gestor).first():
                print(f"[-] Erro: O e-mail '{email_gestor}' já está em uso por outro gestor.")
                return

            # Gera um CNPJ fictício para testes (pode ser adaptado para receber via sys.argv depois se quiser)
            cnpj_gerado = f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}/0001-{random.randint(10,99)}"

            # 3. Cria a Empresa
            nova_empresa = Empresa(nome=nome_empresa, cnpj=cnpj_gerado)
            db.session.add(nova_empresa)
            db.session.flush() # Flush envia pro banco temporariamente para pegarmos o ID gerado

            # 4. Cria as Colunas Padrão da nova empresa (Conforme PDF: RH, SESMT, TIC...)
            colunas_padrao = [
                {'nome': 'RH - Documentação', 'cor_hex': '#34C759', 'ordem': 1},
                {'nome': 'SESMT - Exames', 'cor_hex': '#FF9500', 'ordem': 2},
                {'nome': 'TI - Acessos', 'cor_hex': '#007AFF', 'ordem': 3},
                {'nome': 'Gestor - Acolhimento', 'cor_hex': '#AF52DE', 'ordem': 4}
            ]
            
            for col in colunas_padrao:
                nova_coluna = Coluna(
                    empresa_id=nova_empresa.id,
                    nome=col['nome'],
                    cor_hex=col['cor_hex'],
                    ordem=col['ordem']
                )
                db.session.add(nova_coluna)

            # 5. Cria o Gestor Admin
            senha_hash = generate_password_hash(senha_gestor)
            novo_gestor = Gestor(
                empresa_id=nova_empresa.id,
                nome=nome_gestor,
                email=email_gestor,
                senha_hash=senha_hash,
                is_rh=True,
                setor='RH'
            )
            db.session.add(novo_gestor)
            
            # Efetiva todas as operações no banco de dados
            db.session.commit()
            
            print("\n" + "="*50)
            print("✅ SETUP DA EMPRESA CONCLUÍDO COM SUCESSO! ✅")
            print("="*50)
            print(f"🏢 Empresa: {nome_empresa} (CNPJ: {cnpj_gerado})")
            print(f"👤 Gestor Admin: {nome_gestor}")
            print(f"📧 E-mail (Login): {email_gestor}")
            print(f"🔑 Senha: {senha_gestor}")
            print("="*50 + "\n")

        except Exception as e:
            db.session.rollback()
            print(f"[-] Ocorreu um erro crítico ao criar a empresa: {str(e)}")

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Uso correto do script:")
        print('python criar_empresa.py "Nome da Empresa" "Nome do Gestor" "email@gestor.com" "senha123"')
    else:
        print("="*50)
        print("🏢 GUIA SAAS: ONBOARDING DE NOVO CLIENTE 🏢")
        print("="*50)
        setup_empresa(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])