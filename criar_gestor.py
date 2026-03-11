#!/usr/bin/env python3
"""
Script para gerenciar usuários adicionais nas empresas cadastradas no sistema GUIA
Execute: python criar_gestor.py
"""

import sqlite3
import hashlib
import secrets
from getpass import getpass

DATABASE = 'guia.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def hash_senha(senha):
    """Cria hash da senha usando SHA-256 + salt"""
    salt = secrets.token_hex(8)
    hash_obj = hashlib.sha256((senha + salt).encode())
    return f"{salt}${hash_obj.hexdigest()}"

def listar_empresas():
    """Lista as empresas (clientes SaaS) disponíveis no sistema"""
    conn = get_db_connection()
    empresas = conn.execute('SELECT id, nome FROM empresas ORDER BY id').fetchall()
    conn.close()
    return empresas

def criar_gestor_interativo():
    """Cria um novo gestor atrelado a uma empresa específica"""
    print("\n" + "="*50)
    print("👤  CRIAR NOVO USUÁRIO  👤")
    print("="*50)
    
    empresas = listar_empresas()
    
    if not empresas:
        print("\n⚠️ Nenhuma empresa cadastrada no sistema!")
        print("⚠️ Execute primeiro o script 'criar_empresa.py' para cadastrar um cliente/empresa.")
        return
    
    print("\n🏢 Empresas disponíveis no SaaS:")
    for emp in empresas:
        print(f"   {emp['id']}. {emp['nome']}")
    
    try:
        empresa_id = int(input("\nID da Empresa para este usuário: ").strip())
        if not any(e['id'] == empresa_id for e in empresas):
            print("❌ ID de empresa inválido!")
            return
    except ValueError:
        print("❌ Valor inválido!")
        return

    print("\n📝 Preencha os dados do usuário:")
    
    nome = input("Nome completo: ").strip()
    while not nome:
        print("❌ Nome não pode estar vazio!")
        nome = input("Nome completo: ").strip()
    
    email = input("Email: ").strip().lower()
    while not email or '@' not in email:
        print("❌ Email inválido!")
        email = input("Email: ").strip().lower()
    
    print("\n👑 Níveis de acesso:")
    print("   1. Admin (Gestor RH com acesso total ao Kanban)")
    print("   2. Setor (Agente de setor específico)")
    
    try:
        role_opcao = int(input("Nível de acesso (1 ou 2) [padrão=1]: ").strip() or "1")
        role = 'admin' if role_opcao == 1 else 'setor'
    except ValueError:
        role = 'admin'
    
    print("\n🔐 Defina a senha:")
    senha1 = getpass("Senha: ")
    senha2 = getpass("Confirme a senha: ")
    
    while senha1 != senha2 or len(senha1) < 6:
        if len(senha1) < 6:
            print("❌ A senha deve ter pelo menos 6 caracteres!")
        else:
            print("❌ As senhas não coincidem!")
        senha1 = getpass("Senha: ")
        senha2 = getpass("Confirme a senha: ")
    
    sucesso, mensagem = salvar_usuario(empresa_id, nome, email, senha1, role)
    
    if sucesso:
        print("\n" + "✅"*15)
        print("🎉 USUÁRIO CRIADO COM SUCESSO!")
        print("✅"*15)
        print(f"\n🏢 Empresa ID: {empresa_id}")
        print(f"📧 Email: {email}")
        print(f"👤 Nome: {nome}")
        print(f"👑 Nível: {role}")
    else:
        print(f"\n❌ Erro: {mensagem}")

def salvar_usuario(empresa_id, nome, email, senha, role):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id FROM usuarios_sistema WHERE email = ?', (email,))
        if cursor.fetchone():
            conn.close()
            return False, "Email já cadastrado globalmente no SaaS!"
        
        senha_hash = hash_senha(senha)
        
        cursor.execute('''
            INSERT INTO usuarios_sistema 
            (empresa_id, nome, email, senha_hash, role, ativo)
            VALUES (?, ?, ?, ?, ?, 1)
        ''', (empresa_id, nome, email, senha_hash, role))
        
        usuario_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return True, f"Usuário criado com ID: {usuario_id}"
        
    except sqlite3.IntegrityError:
        return False, "Email já cadastrado!"
    except Exception as e:
        return False, f"Erro: {str(e)}"

def listar_usuarios():
    """Lista todos os usuários e as empresas às quais pertencem"""
    conn = get_db_connection()
    usuarios = conn.execute('''
        SELECT u.id, u.nome, u.email, u.role, e.nome as empresa_nome, u.ativo
        FROM usuarios_sistema u
        JOIN empresas e ON u.empresa_id = e.id
        ORDER BY e.nome, u.id
    ''').fetchall()
    conn.close()
    
    if usuarios:
        print("\n" + "="*70)
        print(f"{'ID':<4} | {'EMPRESA':<15} | {'NOME':<20} | {'ROLE':<6} | {'EMAIL'}")
        print("="*70)
        for u in usuarios:
            status = "✅" if u['ativo'] else "❌"
            print(f"{u['id']:<4} | {u['empresa_nome']:<15} | {u['nome']:<20} | {u['role']:<6} | {u['email']}")
    else:
        print("\n📭 Nenhum usuário cadastrado no sistema ainda.")
    return usuarios

def resetar_senha():
    usuarios = listar_usuarios()
    if not usuarios:
        return
        
    try:
        user_id = int(input("\nID do usuário para resetar senha: "))
        
        conn = get_db_connection()
        cursor = conn.cursor()
        usuario = cursor.execute('SELECT nome FROM usuarios_sistema WHERE id = ?', (user_id,)).fetchone()
        
        if not usuario:
            print("❌ Usuário não encontrado!")
            conn.close()
            return
            
        print(f"\n🔄 Resetando senha para: {usuario['nome']}")
        nova_senha = getpass("Nova senha: ")
        confirma = getpass("Confirme a nova senha: ")
        
        if nova_senha != confirma:
            print("❌ As senhas não coincidem!")
            conn.close()
            return
            
        senha_hash = hash_senha(nova_senha)
        
        cursor.execute('UPDATE usuarios_sistema SET senha_hash = ? WHERE id = ?', (senha_hash, user_id))
        conn.commit()
        conn.close()
        print("✅ Senha alterada com sucesso!")
        
    except ValueError:
        print("❌ ID inválido!")

def menu_principal():
    while True:
        print("\n" + "="*50)
        print("🔧  GUIA SaaS - GESTÃO DE USUÁRIOS  🔧")
        print("="*50)
        print("1. 👤 Criar novo usuário (para uma Empresa)")
        print("2. 📋 Listar todos os usuários do sistema")
        print("3. 🔑 Resetar senha de usuário")
        print("4. 🚪 Sair")
        print("="*50)
        
        opcao = input("\nEscolha uma opção: ").strip()
        
        if opcao == '1':
            criar_gestor_interativo()
        elif opcao == '2':
            listar_usuarios()
        elif opcao == '3':
            resetar_senha()
        elif opcao == '4':
            print("\n👋 Até logo!")
            break
        else:
            print("❌ Opção inválida!")

if __name__ == '__main__':
    try:
        # Testa rapidamente se o BD está inicializado (se existe a tabela empresas)
        conn = get_db_connection()
        try:
            conn.execute("SELECT 1 FROM empresas LIMIT 1")
        except sqlite3.OperationalError:
            print("⚠️ Base de dados não inicializada!")
            print("Por favor, rode o app.py pelo menos uma vez para criar as tabelas.")
            sys.exit(1)
        finally:
            conn.close()
            
        menu_principal()
    except KeyboardInterrupt:
        print("\n\n👋 Operação cancelada pelo usuário.")
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
