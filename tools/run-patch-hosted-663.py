from pathlib import Path

index_path = Path('index.html')
s = index_path.read_text(encoding='utf-8')
old = "const APP_CONFIG = Object.freeze({\n  name: 'Classroom Seating Planner',\n  shortName: 'Seating Planner',\n  version: '6.6.2',"
new = "const APP_CONFIG = Object.freeze({\n  name: 'Classroom Seating Planner',\n  shortName: 'Seating Planner',\n  version: '6.6.3',"
if s.count(old) != 1:
    raise SystemExit(f'APP_CONFIG version: expected exactly one contextual match, found {s.count(old)}')
index_path.write_text(s.replace(old, new, 1), encoding='utf-8')

patch_path = Path('tools/patch-hosted-663.py')
patch = patch_path.read_text(encoding='utf-8')
problem_line = 'replace_once("version: \'6.6.2\',", "version: \'6.6.3\',", \'APP_CONFIG version\')\n'
if patch.count(problem_line) != 1:
    raise SystemExit('Could not disable obsolete broad APP_CONFIG version replacement')
patch = patch.replace(problem_line, '', 1)
exec(compile(patch, str(patch_path), 'exec'))
