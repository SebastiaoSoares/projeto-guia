#!/usr/bin/env python3
"""
Script para provisionar um novo cliente (Empresa) no sistema GUIA SaaS.
Cria a Empresa, as Colunas padrão do Kanban e o primeiro usuário Gestor (RH).
"""

import sqlite3
import secrets
import hashlib
import sys

DATABASE = 'guia.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def hash_senha(senha):
    """Cria hash da senha usando SHA-256 + salt no padrão do sistema"""
    salt = secrets.token_hex(8)
    hash_obj = hashlib.sha256((senha + salt).encode())
    return f"{salt}${hash_obj.hexdigest()}"

def criar_nova_empresa(nome_empresa, nome_gestor, email_gestor, senha_gestor):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Cria a Empresa
        cursor.execute('INSERT INTO empresas (nome) VALUES (?)', (nome_empresa,))
        empresa_id = cursor.lastrowid
        print(f"\n[+] Empresa '{nome_empresa}' criada com ID: {empresa_id}")

        # 2. Cria as colunas padrão (Kanban) para esta empresa específica
        colunas_padrao = [
            ("RH", 1),
            ("SESMT (Saúde)", 2),
            ("TIC (Acessos)", 3),
            ("Integração Concluída", 4)
        ]
        
        for nome_coluna, ordem in colunas_padrao:
            cursor.execute(
                'INSERT INTO colunas_kanban (empresa_id, nome, ordem) VALUES (?, ?, ?)',
                (empresa_id, nome_coluna, ordem)
            )
        print(f"[+] {len(colunas_padrao)} colunas padrão criadas no Kanban para a empresa.")

        # 3. Cria o Gestor Principal (Admin/RH)
        senha_hash_completa = hash_senha(senha_gestor)

        cursor.execute('''
            INSERT INTO usuarios_sistema (empresa_id, nome, email, senha_hash, role, ativo)
            VALUES (?, ?, ?, ?, 'admin', 1)
        ''', (empresa_id, nome_gestor, email_gestor, senha_hash_completa))
        
        gestor_id = cursor.lastrowid
        print(f"[+] Gestor Master '{nome_gestor}' ({email_gestor}) cadastrado! ID: {gestor_id}")

        conn.commit()
        print("\n🚀 SETUP DA NOVA EMPRESA CLIENTE FINALIZADO COM SUCESSO!\n")
        
    except sqlite3.IntegrityError:
        print("[-] Erro: O email informado para o gestor já está em uso no sistema global.")
    except Exception as e:
        print(f"[-] Erro ao criar empresa: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print("Uso correto do script via terminal:")
        print("python criar_empresa.py \"Nome da Empresa\" \"Nome do Gestor\" \"email@gestor.com\" \"senha123\"")
        print("\nExemplo:")
        print("python criar_empresa.py \"Acme Corp\" \"Maria RH\" \"maria@acme.com\" \"123456\"")
        sys.exit(1)

    nome_empresa = sys.argv[1]
    nome_gestor = sys.argv[2]
    email_gestor = sys.argv[3]
    senha_gestor = sys.argv[4]

    print("="*50)
    print("🏢 GUIA SAAS: ONBOARDING DE NOVO CLIENTE 🏢")
    print("="*50)
    criar_nova_empresa(nome_empresa, nome_gestor, email_gestor, senha_gestor)
