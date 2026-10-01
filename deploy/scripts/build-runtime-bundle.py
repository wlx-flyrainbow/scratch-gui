#!/usr/bin/env python3
"""Package already built runtime code without secrets or host dependencies."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('family', choices=['xianglin', 'zhimeng'])
parser.add_argument('output', type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[2]
root = repo / 'origin-server' if args.family == 'xianglin' else repo
entry = root / ('dist/src/main.js' if args.family == 'xianglin' else 'backend/server.js')
if not entry.is_file():
    raise SystemExit('Build the API on a development or CI machine before packaging')
if args.output.exists():
    raise SystemExit('Output already exists; use a new filename')
tracked = subprocess.check_output(['git', '-C', str(repo), 'ls-files', '-z']).decode().split('\0')
prefixes = ('src/', 'schemas/') if args.family == 'xianglin' else ('backend/', 'website/', 'scripts/')
files = {}
for item in tracked:
    if not item:
        continue
    path = repo / item
    try:
        relative = path.relative_to(root)
    except ValueError:
        continue
    name = str(relative)
    if name in ('package.json', 'package-lock.json') or name.startswith(prefixes):
        if any(part.startswith('.') or part == 'node_modules' for part in relative.parts):
            continue
        if name.startswith('website/data/') and name != 'website/data/teacher-channels.json':
            continue
        if path.is_symlink() or not path.is_file():
            raise SystemExit('Runtime source must be a regular existing file: ' + name)
        files[name] = path
if args.family == 'xianglin':
    for path in (root / 'dist').rglob('*'):
        if path.is_file():
            if path.is_symlink():
                raise SystemExit('Build output cannot contain symlinks')
            files[str(path.relative_to(root))] = path
manifest = {'schema': 1, 'family': args.family, 'node_major': 24,
            'source_revision': subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD']).decode().strip(),
            'source_dirty': bool(subprocess.check_output(['git', '-C', str(repo), 'status', '--porcelain'])),
            'dependency_lock_sha256': hashlib.sha256((root / 'package-lock.json').read_bytes()).hexdigest(),
            'files': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in sorted(files.items())}}
args.output.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(args.output, 'w:gz') as archive:
    for name, path in sorted(files.items()):
        archive.add(path, arcname=name, recursive=False)
    blob = json.dumps(manifest, indent=2).encode()
    info = tarfile.TarInfo('release-manifest.json')
    info.size = len(blob)
    info.mode = 0o600
    archive.addfile(info, io.BytesIO(blob))
print(json.dumps({'bundle': str(args.output.resolve()), 'files': len(files),
                  'source_revision': manifest['source_revision'], 'source_dirty': manifest['source_dirty']}))
