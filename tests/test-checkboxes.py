import http.server, socketserver, threading
from playwright.sync_api import sync_playwright

PORT = 8999
DIRECTORY = 'E:/SRM site/srm-compass/dist'
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

httpd = socketserver.TCPServer(('', PORT), Handler)
t = threading.Thread(target=httpd.serve_forever)
t.daemon = True
t.start()

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 360, 'height': 800})
    
    page.goto(f'http://localhost:{PORT}/eligibility/')
    page.wait_for_load_state('networkidle')
    elig_boxes = page.evaluate('''() => {
        return Array.from(document.querySelectorAll('.subject-checkbox-label')).map(el => {
            const r = el.getBoundingClientRect();
            const input = el.querySelector('input[type="checkbox"]');
            const inR = input ? input.getBoundingClientRect() : null;
            return {
                text: el.innerText.trim(),
                labelHeight: Math.round(r.height),
                inputWidth: inR ? Math.round(inR.width) : null,
                inputHeight: inR ? Math.round(inR.height) : null
            };
        });
    }''')
    print('Eligibility checkboxes over HTTP:', elig_boxes)

    page.goto(f'http://localhost:{PORT}/programmes/')
    page.wait_for_load_state('networkidle')
    prog_boxes = page.evaluate('''() => {
        return Array.from(document.querySelectorAll('.checkbox-label')).map(el => {
            const r = el.getBoundingClientRect();
            const input = el.querySelector('input[type="checkbox"]');
            const inR = input ? input.getBoundingClientRect() : null;
            return {
                text: el.innerText.trim(),
                labelHeight: Math.round(r.height),
                inputWidth: inR ? Math.round(inR.width) : null,
                inputHeight: inR ? Math.round(inR.height) : null
            };
        });
    }''')
    print('Programmes checkboxes over HTTP:', prog_boxes)
    browser.close()

httpd.shutdown()
