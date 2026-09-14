"""Consistent SQLite backup, including committed WAL changes."""
from pathlib import Path
import datetime
import os
import sqlite3

os.umask(0o077)
directory = Path('/var/lib/casadelastartas/backups')
directory.mkdir(mode=0o700, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target = directory / f'business-{stamp}.sqlite'
temporary = target.with_suffix('.tmp')
with sqlite3.connect('file:/var/lib/casadelastartas/business.sqlite?mode=ro', uri=True) as source:
    with sqlite3.connect(temporary) as backup:
        source.backup(backup)
        assert backup.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
temporary.replace(target)
for old in sorted(directory.glob('business-*.sqlite'), reverse=True)[14:]:
    old.unlink()
print(f'Backup verified: {target.name}')
