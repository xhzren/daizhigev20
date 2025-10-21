#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import time
from collections import defaultdict

# Configuration
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
OUTPUT_MD = os.path.join(ROOT, "详细清单.md")
IGNORE_DIRS = {".git", ".github", "node_modules", "venv", "env", "__pycache__", ".idea", ".vscode"}


def human_size(num: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num)
    for unit in units:
        if size < 1024:
            return f"{size:.2f}{unit}"
        size /= 1024
    return f"{size:.2f}PB"


def should_ignore(path_parts):
    return any(part in IGNORE_DIRS for part in path_parts)


def walk_and_collect(root: str):
    stats_by_dir = {}
    # Directory structure tree: parent -> [children]
    children_map = defaultdict(list)

    for current_root, dirs, files in os.walk(root):
        # skip ignored dirs
        rel_parts = os.path.relpath(current_root, root).split(os.sep)
        if rel_parts == ['.']:
            rel_parts = []
        if should_ignore(rel_parts):
            # mutate dirs in-place to prune walk
            dirs[:] = []
            continue
        # prune ignored children
        dirs[:] = [d for d in dirs if not should_ignore(rel_parts + [d])]

        total_size = 0
        for f in files:
            # skip hidden/system files
            if f.startswith('.'):
                continue
            try:
                fp = os.path.join(current_root, f)
                total_size += os.path.getsize(fp)
            except OSError:
                pass

        rel_path = os.path.relpath(current_root, root)
        if rel_path == '.':
            rel_path = ''
        stats_by_dir[rel_path] = {
            'path': rel_path,
            'files': len([f for f in files if not f.startswith('.')]),
            'dirs': len(dirs),
            'size': total_size,
            'depth': 0 if rel_path == '' else rel_path.count(os.sep) + 1,
        }

        # children map
        for d in dirs:
            child_rel = os.path.join(rel_path, d) if rel_path else d
            children_map[rel_path].append(child_rel)

    return stats_by_dir, children_map


def write_markdown(stats_by_dir, children_map, output_path: str):
    total_files = sum(s['files'] for s in stats_by_dir.values())
    total_dirs = len(stats_by_dir)
    total_size = sum(s['size'] for s in stats_by_dir.values())

    # Build section order: top-level dirs sorted by name (locale-insensitive)
    top_level = [c for c in children_map.get('', [])]
    top_level.sort()

    lines = []
    lines.append('# 项目文件详细清单')
    lines.append('')
    lines.append(f'- 生成时间：{time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())}')
    lines.append(f'- 根目录：{os.path.basename(ROOT)}')
    lines.append(f'- 目录总数（含根）：{total_dirs}')
    lines.append(f'- 文件总数：{total_files}')
    lines.append(f'- 累计文件体积：{human_size(total_size)}')
    lines.append('')
    lines.append('生成脚本：scripts/generate_detailed_list.py')
    lines.append('')
    lines.append('注：以下每一行的“文件数/子目录数/累计体积”为该目录下（仅本层文件，不含子目录内文件）的统计。')
    lines.append('')

    def emit_dir(rel_path: str, indent: int = 0):
        s = stats_by_dir.get(rel_path, None)
        if s is None:
            return
        prefix = '  ' * indent + '- '
        name = rel_path if rel_path else '(根目录)'
        lines.append(f"{prefix}{name}  （文件数：{s['files']}｜子目录数：{s['dirs']}｜累计体积：{human_size(s['size'])}）")
        # Sort children by name
        children = sorted(children_map.get(rel_path, []))
        for child in children:
            emit_dir(child, indent + 1)

    # Emit top-level
    emit_dir('')

    # Also provide a per-分类小结 for top-level children for quick scan
    lines.append('')
    lines.append('## 一级目录概览')
    lines.append('')
    for d in top_level:
        s = stats_by_dir[d]
        lines.append(f"- {d}：文件数 {s['files']}，子目录数 {s['dirs']}，本层体积 {human_size(s['size'])}")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def main():
    stats_by_dir, children_map = walk_and_collect(ROOT)
    write_markdown(stats_by_dir, children_map, OUTPUT_MD)
    print(f"已生成：{OUTPUT_MD}")


if __name__ == '__main__':
    sys.exit(main())
