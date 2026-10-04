"""Cria dez acessos fictícios usando somente a API administrativa oficial.

Execute: python scripts/create_demo_users.py
A chave administrativa é solicitada sem eco e não é gravada em arquivo.
"""
import csv
import base64
import getpass
import json
from pathlib import Path
import re
import secrets
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
NAMES = [
    'Ana Beatriz Oliveira', 'Mariana Santos', 'Juliana Costa',
    'Camila Rodrigues', 'Fernanda Almeida', 'Patrícia Lima',
    'Renata Carvalho', 'Bruna Martins', 'Larissa Gomes', 'Tatiana Ferreira',
]

def validate_key(key):
    """Recusa senha de banco e chave pública antes de fazer requisições."""
    if key.startswith('sb_secret_'):
        return
    if key.startswith('eyJ'):
        try:
            part = key.split('.')[1]
            claims = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
            if claims.get('role') == 'service_role':
                return
        except (ValueError, IndexError, UnicodeDecodeError):
            pass
    raise ValueError('Informe a chave secret (sb_secret_...) ou service_role. Senha do banco e chave anon/publishable não servem para criar usuários.')

def describe_error(error, key):
    if isinstance(error, HTTPError):
        try:
            body = json.loads(error.read().decode('utf-8'))
            message = body.get('msg') or body.get('message') or body.get('error_description') or body.get('error') or 'Resposta sem mensagem.'
            code = body.get('error_code') or body.get('code') or ''
            text = f'HTTP {error.code}: {code} {message}'
        except (ValueError, UnicodeDecodeError, AttributeError):
            text = f'HTTP {error.code}: falha na API do Supabase.'
    else:
        text = f'Falha de conexão: {getattr(error, "reason", error)}'
    return str(text).replace(key, '[chave ocultada]')

def main():
    config = (ROOT / 'js/config.js').read_text(encoding='utf-8')
    match = re.search(r"SUPABASE_URL\s*=\s*['\"]([^'\"]+)", config)
    if not match or 'SEU-PROJETO' in match.group(1):
        raise SystemExit('Configure a URL do projeto em js/config.js primeiro.')
    base = match.group(1).rstrip('/')
    print(f'Projeto: {base}')
    print('Serão criados 10 acessos fictícios de profissional (comissão 0%).')
    print('Use uma chave administrativa secret/service_role, nunca a chave pública.')
    print('Não digite a senha do banco. Cole a chave na próxima pergunta e pressione Enter; o texto ficará invisível.')
    key = getpass.getpass('Chave administrativa do Supabase (não será exibida): ').strip()
    if not key:
        raise SystemExit('Nenhuma chave informada. Nenhuma conta criada.')
    try:
        validate_key(key)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    # Chaves secret modernas usam apikey; service_role legada também é JWT.
    if key.startswith('eyJ'):
        headers['Authorization'] = f'Bearer {key}'

    def request(path, payload, extra=None):
        req = Request(base + path, data=json.dumps(payload).encode(),
                      headers={**headers, **(extra or {})}, method='POST')
        with urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None

    # Arquivo exclusivo por execução: não sobrescreve senhas anteriores.
    output = ROOT / f'acessos-ficticios-{secrets.token_hex(4)}.csv'
    successful = 0
    with output.open('x', encoding='utf-8-sig', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['nome', 'email', 'senha', 'situacao'])
        for number, name in enumerate(NAMES, 1):
            email = f'profissional{number:02d}@example.com'
            password = secrets.token_urlsafe(18) + 'aA1!'
            try:
                user = request('/auth/v1/admin/users', {
                    'email': email, 'password': password, 'email_confirm': True,
                    'user_metadata': {'full_name': name},
                })
            except (HTTPError, URLError, TimeoutError) as error:
                # Não altera contas já existentes nem expõe cabeçalhos/chave.
                print(f'{email}: não foi criada. {describe_error(error, key)}')
                if isinstance(error, HTTPError) and error.code in (401, 403):
                    print('Execução interrompida: confira a chave administrativa e o projeto.')
                    break
                continue
            user_id = user.get('id') or user.get('user', {}).get('id')
            if not user_id:
                writer.writerow([name, email, password, 'Auth retornou resposta inesperada; confira o painel'])
                file.flush()
                continue
            try:
                request('/rest/v1/profiles?on_conflict=id', {
                    'id': user_id, 'full_name': name,
                    'role': 'profissional', 'commission_rate': 0,
                }, {'Prefer': 'resolution=merge-duplicates,return=minimal'})
                status = 'Conta e perfil criados'
                successful += 1
            except (HTTPError, URLError, TimeoutError) as error:
                status = 'Conta criada; perfil precisa ser conferido no Supabase'
                print(describe_error(error, key))
            writer.writerow([name, email, password, status])
            file.flush()
            print(f'{name}: {status}')
    print(f'Contas e perfis completos: {successful}/10.')
    print(f'Acessos salvos em: {output.name}')
    print('O CSV contém apenas os acessos criados nesta execução; se nenhuma conta foi criada, terá somente o cabeçalho.')

if __name__ == '__main__':
    main()
