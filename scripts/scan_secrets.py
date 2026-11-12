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

    # Target specific needles from actual .env
    needles = []
    if "DATABASE_URL" in secrets:
        db_url = secrets["DATABASE_URL"]
        needles.append(("DATABASE_URL_FULL", db_url))
        m_pass = re.search(r":([^@]+)@", db_url)
        if m_pass:
            db_pass = m_pass.group(1).split(":")[-1]
            if len(db_pass) > 4:
                needles.append(("DATABASE_PASSWORD", db_pass))

    if "AUTH_SECRET" in secrets:
        needles.append(("AUTH_SECRET", secrets["AUTH_SECRET"]))

    if "CLASS1_LICENSE_KEY" in secrets:
        needles.append(("CLASS1_LICENSE_KEY", secrets["CLASS1_LICENSE_KEY"]))

    print(f"Searching for {len(needles)} sensitive target tokens across repository...")

    # 2. Generic Regex for connection strings with embedded passwords (postgres://user:pass@...)
    embedded_pass_regex = re.compile(r"postgres(?:ql)?:\/\/[a-zA-Z0-9_\-\.\%\[\]]+:[^@\s\/\"'\`]+@[a-zA-Z0-9_\-\.\%\[\]]+", re.IGNORECASE)
    print("Scanning for connection strings with embedded credentials (postgres://user:pass@host)...")

    ignored_dirs = {".git", ".venv", "node_modules", "dist", ".pytest_cache", "__pycache__"}
    ignored_files = {".env"}

    real_leaks = []
    pattern_matches = []
    scanned_count = 0

    # Whitelisted mock fixtures strictly used in unit tests for verifying sanitization
    allowed_mock_fixtures = {
        "tests/auth-and-error.test.ts",
        ".env.example",
        "scripts/test_db_break_recovery.mjs",
        "scripts/scan_secrets.py"
    }

    for root, dirs, files in os.walk(os.getcwd()):
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        for file in files:
            if file in ignored_files:
                continue
            scanned_count += 1
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, os.getcwd()).replace("\\", "/")
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                    # Check exact needles from real .env
                    for label, needle in needles:
                        if needle in content:
                            real_leaks.append((rel_path, label))

                    # Check generic connection string regex
                    matches = embedded_pass_regex.findall(content)
                    for m in matches:
                        if "[REDACTED]" in m:
                            continue
                        if rel_path in allowed_mock_fixtures:
                            pattern_matches.append((rel_path, f"TEST_FIXTURE ({m})"))
                        else:
                            real_leaks.append((rel_path, f"EMBEDDED_CONNECTION_STRING ({m})"))
            except Exception as e:
                print(f"Warning: could not read {rel_path}: {e}")

    print(f"Scanned {scanned_count} files across repository tree.")
    print(f"\nRegex Pattern Matches Analyzed:")
    for rel_path, detail in pattern_matches:
        print(f"   [TEST_FIXTURE_AUDIT] {rel_path} -> {detail}")

    if real_leaks:
        print("\n❌ CRITICAL: Secret leak detected!")
        for rel_path, label in real_leaks:
            print(f"   [LEAK] {rel_path} contains {label}")
        sys.exit(1)
    else:
        print("\n✅ PASSED: 0 real credentials leaked across repository!")
        print("   - Live DATABASE_URL: 0 occurrences in repository files")
        print("   - Live AUTH_SECRET: 0 occurrences in repository files")
        print("   - Embedded connection string regex: 0 unmasked leaks in source or config")
        print("=" * 70)

if __name__ == "__main__":
    main()
