from flask import Flask, send_from_directory, redirect, url_for
import os

app = Flask(__name__, static_folder='frontend', static_url_path='')

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join('frontend', path)):
        return send_from_directory('frontend', path)
    else:
        return send_from_directory('frontend', 'index.html')

@app.route('/dashboard')
def dashboard():
    return send_from_directory('frontend', 'dashboard.html')

@app.route('/investors')
def investors():
    return send_from_directory('frontend', 'investors.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
