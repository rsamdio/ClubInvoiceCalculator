#!/usr/bin/env python3
import os
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent

def minify_js(js: str) -> str:
    # Remove /* */ comments (naive, but safe enough for our codebase)
    js = re.sub(r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/", "", js)
    # Remove // comments (only when not in string) - simple line-based
    lines = []
    for line in js.splitlines():
        # Preserve URLs like http:// by only splitting when // starts a comment
        quote_open = False
        quote_char = ''
        out = []
        i = 0
        while i < len(line):
            c = line[i]
            if not quote_open and i+1 < len(line) and line[i] == '/' and line[i+1] == '/':
                # start of comment
                break
            out.append(c)
            if c in ('"', "'", '`'):
                if not quote_open:
                    quote_open = True
                    quote_char = c
                elif quote_char == c:
                    quote_open = False
                    quote_char = ''
            if c == '\\' and quote_open:
                # skip next char in string
                if i+1 < len(line):
                    out.append(line[i+1])
                    i += 1
            i += 1
        lines.append(''.join(out))
    js = '\n'.join(lines)
    # Collapse whitespace
    js = re.sub(r"\s+", " ", js)
    # Keep newlines between statements to avoid ASI pitfalls minimally
    js = re.sub(r"\s*;\s*", ";", js)
    js = re.sub(r"\s*\{\s*", "{", js)
    js = re.sub(r"\s*\}\s*", "}", js)
    js = re.sub(r"\s*\(\s*", "(", js)
    js = re.sub(r"\s*\)\s*", ")", js)
    js = re.sub(r"\s*,\s*", ",", js)
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

