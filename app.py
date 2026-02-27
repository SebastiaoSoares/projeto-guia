from flask import Flask, render_template, request, jsonify
from models.task_model import init_db, get_all_tasks, create_task, update_task_status

app = Flask(__name__)

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/onboarding')
def onboarding():
    return render_template('onboarding.html')

@app.route('/api/tasks', methods=['GET'])
def api_get_tasks():
    tasks = get_all_tasks()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def api_create_task():
    data = request.json
    task_id = create_task(data)
    return jsonify({"success": True, "id": task_id}), 201

@app.route('/api/tasks/<int:task_id>/status', methods=['PUT'])
def api_update_status(task_id):
    data = request.json
    update_task_status(task_id, data['status'])
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True)
