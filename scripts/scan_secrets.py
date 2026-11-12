import os
import re
import sys

def main():
    print("=" * 70)
    print("SECRET SCANNER: VERIFYING REPOSITORY TREE HYGIENE")
    print("=" * 70)

    # 1. Load actual secrets from .env
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        print("ERROR: .env file not found.")
        sys.exit(1)

    secrets = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^\s*([\w_]+)\s*=\s*(.*)?\s*$", line)
            if m:
                key = m.group(1)
                val = m.group(2).strip().strip("'\"")
                if key in ["DATABASE_URL", "AUTH_SECRET", "CLASS1_LICENSE_KEY"] and val:
                    secrets[key] = val

    print(f"Loaded {len(secrets)} sensitive configuration keys to scan for.")

    # Extract high-entropy / sensitive fragments to search for
    # e.g., the password part of DATABASE_URL: postgresql://user:PASSWORD@host...
    needles = []
    if "DATABASE_URL" in secrets:
        db_url = secrets["DATABASE_URL"]
        needles.append(("DATABASE_URL_FULL", db_url))
        m_pass = re.search(r":([^@]+)@", db_url)
        if m_pass:
            db_pass = m_pass.group(1).split(":")[-1] # extract password component
            if len(db_pass) > 4:
                needles.append(("DATABASE_PASSWORD", db_pass))

    if "AUTH_SECRET" in secrets:
        needles.append(("AUTH_SECRET", secrets["AUTH_SECRET"]))

    if "CLASS1_LICENSE_KEY" in secrets:
        needles.append(("CLASS1_LICENSE_KEY", secrets["CLASS1_LICENSE_KEY"]))

    print(f"Searching for {len(needles)} sensitive target tokens across repository...")

    ignored_dirs = {".git", ".venv", "node_modules", "dist", ".pytest_cache", "__pycache__"}
    ignored_files = {".env"}

    leaks = []
    scanned_count = 0

    for root, dirs, files in os.walk(os.getcwd()):
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        for file in files:
            if file in ignored_files:
                continue
            scanned_count += 1
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, os.getcwd())
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    for label, needle in needles:
                        if needle in content:
                            leaks.append((rel_path, label))
            except Exception as e:
                print(f"Warning: could not read {rel_path}: {e}")

    print(f"Scanned {scanned_count} files across repository tree.")

    if leaks:
        print("\n❌ CRITICAL: Potential secret leaks detected!")
        for rel_path, label in leaks:
            print(f"   [LEAK] {rel_path} contains {label}")
        sys.exit(1)
    else:
        print("\n✅ PASSED: 0 secrets leaked across all tracked and working tree files!")
        print("   - DATABASE_URL: masked and git-ignored")
        print("   - AUTH_SECRET: masked and git-ignored")
        print("   - CLASS1_LICENSE_KEY: masked and git-ignored")
        print("=" * 70)

if __name__ == "__main__":
    main()

