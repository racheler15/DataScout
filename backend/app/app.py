from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return

@app.route('/api/hyse', methods=['POST'])
def initial_search():
    return

if __name__ == '__main__':
    app.run(debug=True)
