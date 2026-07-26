#!/usr/bin/env python3
import os
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent

def _strip_js_line_comment(line: str) -> str:
    """Remove // comments without touching // or content inside strings."""
    quote_open = False
    quote_char = ''
    out = []
    i = 0
    while i < len(line):
        c = line[i]
        if not quote_open and i + 1 < len(line) and line[i] == '/' and line[i + 1] == '/':
            break
        out.append(c)
        if c in ('"', "'", '`'):
            if not quote_open:
                quote_open = True
                quote_char = c
            elif quote_char == c:
                quote_open = False
                quote_char = ''
        if c == '\\' and quote_open and i + 1 < len(line):
            out.append(line[i + 1])
            i += 1
        i += 1
    return ''.join(out)


def _apply_outside_strings(js: str, pattern: str, repl: str) -> str:
    """Apply a regex substitution only to code outside string/template literals.

    Critical: naive \\s* around }() breaks dues format strings like
    `${x.toFixed(2)} + ${y}` → `${x.toFixed(2)}+ ${y}` which broke PDF totals.
    """
    parts = []
    buf = []
    quote_open = False
    quote_char = ''
    i = 0
    while i < len(js):
        c = js[i]
        if quote_open:
            buf.append(c)
            if c == '\\' and i + 1 < len(js):
                buf.append(js[i + 1])
                i += 2
                continue
            if c == quote_char:
                parts.append(''.join(buf))
                buf = []
                quote_open = False
                quote_char = ''
            i += 1
            continue
        if c in ('"', "'", '`'):
            if buf:
                parts.append(re.sub(pattern, repl, ''.join(buf)))
                buf = []
            quote_open = True
            quote_char = c
            buf.append(c)
            i += 1
            continue
        buf.append(c)
        i += 1
    if buf:
        chunk = ''.join(buf)
        parts.append(re.sub(pattern, repl, chunk) if not quote_open else chunk)
    return ''.join(parts)


def minify_js(js: str) -> str:
    # Remove /* */ comments (naive, but safe enough for our codebase)
    js = re.sub(r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/", "", js)
    js = '\n'.join(_strip_js_line_comment(line) for line in js.splitlines())
    # Collapse whitespace outside strings only
    js = _apply_outside_strings(js, r"\s+", " ")
    js = _apply_outside_strings(js, r"\s*;\s*", ";")
    js = _apply_outside_strings(js, r"\s*\{\s*", "{")
    js = _apply_outside_strings(js, r"\s*\}\s*", "}")
    js = _apply_outside_strings(js, r"\s*\(\s*", "(")
    js = _apply_outside_strings(js, r"\s*\)\s*", ")")
    js = _apply_outside_strings(js, r"\s*,\s*", ",")
    return js.strip()

def minify_css(css: str) -> str:
    css = re.sub(r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/", "", css)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*{\s*", "{", css)
    css = re.sub(r"\s*}\s*", "}", css)
    css = re.sub(r"\s*;\s*", ";", css)
    css = re.sub(r"\s*:\s*", ":", css)
    css = re.sub(r";}", "}", css)
    return css.strip()

def write_minified(src: Path, dest: Path, minifier):
    text = src.read_text(encoding='utf-8')
    dest.write_text(minifier(text), encoding='utf-8')
    print(f"Minified {src.name} -> {dest.name}")

def main():
    # CSS
    css_src = BASE / "styles.css"
    if css_src.exists():
        write_minified(css_src, BASE / "styles.min.css", minify_css)

    # JS files (own code only)
    js_files = [
        BASE / "app.js",
        BASE / "modules" / "security.js",
        BASE / "modules" / "calculations.js",
        BASE / "pdf-worker.js",
    ]
    for src in js_files:
        if src.exists():
            dest = src.with_name(src.stem + ".min.js")
            write_minified(src, dest, minify_js)

if __name__ == "__main__":
    main()

