from flask import Flask, send_from_directory, redirect, url_for
import os

app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory('frontend', 'index_dark.html')

@app.route('/dashboard')
def dashboard():
    return send_from_directory('frontend', 'dashboard_dark.html')

@app.route('/investors')
def investors():
    return send_from_directory('frontend', 'investors_dark.html')

@app.route('/screenshots')
def screenshots():
    return send_from_directory('frontend', 'dark_mode_screenshots.html')

@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory('frontend/css', path)

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('frontend/js', path)

@app.route('/images/<path:path>')
def send_images(path):
    return send_from_directory('frontend/images', path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
