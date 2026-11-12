import re
import os
import sys

def main():
    print("=" * 70)
    print("VALIDATING ALL FILE REFERENCES IN README.MD")
    print("=" * 70)

    with open("README.md", "r", encoding="utf-8") as f:
        content = f.read()

    # Extract all files from directory tree block
    tree_match = re.search(r"```text\s+neon-mcp-server/\n(.*?)```", content, re.DOTALL)
    tree_files = []
    if tree_match:
        # Stack of (indent_level, directory_name)
        dir_stack = []
        for raw_line in tree_match.group(1).splitlines():
            line = raw_line.rstrip()
            if not line:
                continue
            
            # Count leading indentation characters (spaces, │, ├, └, ─)
            m_item = re.search(r"[├└]──\s+([^\s#]+)", line)
            if not m_item:
                continue
            item_name = m_item.group(1).strip()
            indent = m_item.start()

            # Pop directories from stack that have equal or deeper indentation
            while dir_stack and dir_stack[-1][0] >= indent:
                dir_stack.pop()

            if item_name.endswith("/"):
                # Directory
                dname = item_name[:-1]
                dir_stack.append((indent, dname))
            else:
                # File
                dirs = [d[1] for d in dir_stack]
                full_rel = os.path.join(*dirs, item_name).replace("\\", "/") if dirs else item_name
                tree_files.append(full_rel)

    # Also extract any backtick-quoted filenames in README text
    code_files = []
    for match in re.finditer(r'`([a-zA-Z0-9_\-\./\\]+\.[a-zA-Z0-9]+)`', content):
        val = match.group(1).replace("\\", "/")
        if any(val.startswith(p) for p in ["src/", "scripts/", "python/", "tests/"]) or val in [
            "Dockerfile", "package.json", "tsconfig.json", "drizzle.config.ts",
            ".gitignore", ".env.example", ".env", "requirements-class1.txt"
        ]:
            code_files.append(val)

    all_files = sorted(list(set(tree_files + code_files)))
    print(f"Extracted {len(all_files)} total distinct file paths from README.md:\n")

    missing = []
    for fpath in all_files:
        exists = os.path.exists(fpath)
        status = "EXISTS" if exists else "MISSING"
        print(f"  {fpath:<50} [{status}]")
        if not exists:
            missing.append(fpath)

    print("\n" + "=" * 70)
    if missing:
        print(f"FAILED: {len(missing)} referenced files do NOT exist on disk:")
        for m in missing:
            print(f"  ❌ {m}")
        sys.exit(1)
    else:
        print(f"PASSED: All {len(all_files)} files referenced in README.md exist on disk!")
        print("=" * 70)

if __name__ == "__main__":
    main()
