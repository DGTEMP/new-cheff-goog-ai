import html.parser
class MyParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.target_path = []
    def handle_starttag(self, tag, attrs):
        if tag in ('meta', 'link', 'img', 'br', 'input', 'hr'): return
        self.stack.append((tag, dict(attrs)))
        for k, v in attrs:
            if k == 'id' and v == 'modal-perfil-mesa':
                self.target_path = list(self.stack)
    def handle_endtag(self, tag):
        if tag in ('meta', 'link', 'img', 'br', 'input', 'hr'): return
        if self.stack: self.stack.pop()

parser = MyParser()
with open('configuracoes.html', 'r', encoding='utf-8') as f:
    parser.feed(f.read())
for tag, attrs in parser.target_path:
    print(f'<{tag} id="{attrs.get("id", "")}" class="{attrs.get("class", "")}">')
