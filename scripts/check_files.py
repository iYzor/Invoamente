"""Verificação estática de recursos, IDs e seletores das páginas."""
from pathlib import Path
from html.parser import HTMLParser
import re

ROOT = Path(__file__).resolve().parent.parent
class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.resources = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('src', 'href'):
            if key in attrs:
                self.resources.append(attrs[key])

errors = []
for file in ROOT.glob('*.html'):
    page = Page()
    page.feed(file.read_text(encoding='utf-8'))
    for id in set(page.ids):
        if page.ids.count(id) > 1:
            errors.append(f'{file.name}: ID duplicado {id}')
    for resource in page.resources:
        if not resource.startswith(('https:', '#')) and not (ROOT / resource).exists():
            errors.append(f'{file.name}: recurso ausente {resource}')
    for resource in page.resources:
        if resource.startswith('js/'):
            source = (ROOT / resource).read_text(encoding='utf-8')
            for id in re.findall(r"\$\('#([\w-]+)'\)", source):
                if id not in page.ids:
                    errors.append(f'{file.name}: seletor ausente #{id}')
for file in (ROOT / 'js').glob('*.js'):
    for resource in re.findall(r"from '([^']+)'", file.read_text(encoding='utf-8')):
        if resource.startswith('.') and not (file.parent / resource).exists():
            errors.append(f'{file.name}: import ausente {resource}')
print(f'{len(list(ROOT.glob("*.html")))} páginas e {len(list((ROOT / "js").glob("*.js")))} módulos verificados.')
print('\n'.join(errors) if errors else 'Recursos, imports, IDs e seletores: OK.')
raise SystemExit(bool(errors))
