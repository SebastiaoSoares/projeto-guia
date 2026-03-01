from flask import Flask, render_template, request, jsonify
from models.models import (
    init_db, get_all_tasks, create_task, 
    update_task_status, delete_task, 
    get_dashboard_stats, get_onboarding_data
)

app = Flask(__name__)

# Inicializa o banco de dados (ou ativa o Mock em caso de falha)
init_db()

# ==========================================
# ----------- ROTAS DO FRONT-END -----------
# ==========================================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/plataforma')
def plataforma():
    global IS_AUTHENTICATED
    if not IS_AUTHENTICATED:
        return render_template('plataforma/login.html')
    
    if request.user.role == 'colaborador':
        return render_template('plataforma/onboarding.html')
    else:
        return render_template('plataforma/dashboard.html')

@app.route('/plataforma/dashboard')
def dashboard():
    return render_template('plataforma/dashboard.html')

@app.route('/plataforma/onboarding')
def onboarding():
    return render_template('plataforma/onboarding.html')

# ==========================================
# -------------- ROTAS DA API --------------
# ==========================================

# --- KANBAN ---
@app.route('/api/tasks', methods=['GET'])
def api_get_tasks():
    tasks = get_all_tasks()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def api_create_task():
    data = request.json
    task_id = create_task(data)
    if task_id:
        return jsonify({"success": True, "id": task_id}), 201
    return jsonify({"success": False, "error": "Falha ao criar tarefa"}), 500

@app.route('/api/tasks/<int:task_id>/status', methods=['PATCH'])
def api_update_status(task_id):
    data = request.json
    success = update_task_status(task_id, data['status'])
    return jsonify({"success": success})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def api_delete_task(task_id):
    success = delete_task(task_id)
    return jsonify({"success": success})

# --- DASHBOARD STATS ---
@app.route('/api/dashboard/stats', methods=['GET'])
def api_get_stats():
    stats = get_dashboard_stats()
    return jsonify(stats)

# --- ONBOARDING ---
@app.route('/api/onboarding/progress', methods=['GET'])
def api_get_onboarding():
    progress = get_onboarding_data()
    return jsonify(progress)

if __name__ == '__main__':
    app.run(debug=True)