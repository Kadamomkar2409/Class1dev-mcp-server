import tempfile, subprocess, json, os, sys

project_root = r"E:\Nitrostack\Task Third\neon-mcp-server"

sample_before = """import openai

def analyze_text(text: str):
    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": text}],
        max_tokens=500
    )
    return response.choices[0].message.content
"""

sample_after = """import openai

def analyze_text(text: str):
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": text}],
        max_tokens=2000
    )
    return response.choices[0].message.content
"""

with tempfile.NamedTemporaryFile("w", delete=False, suffix=".py", encoding="utf-8") as f_before:
    f_before.write(sample_before)
    before_path = f_before.name

with tempfile.NamedTemporaryFile("w", delete=False, suffix=".py", encoding="utf-8") as f_after:
    f_after.write(sample_after)
    after_path = f_after.name

json_out = os.path.join(tempfile.gettempdir(), f"sample_out_{os.getpid()}.json")

try:
    cmd = [
        os.path.join(project_root, ".venv", "Scripts", "python.exe"),
        os.path.join(project_root, "python", "run_class1.py"),
        "--before", before_path,
        "--after", after_path,
        "--path", "app.py",
        "-n", "10000",
        "--json", json_out
    ]
    p = subprocess.run(cmd, capture_output=True, text=True, cwd=project_root)
    if p.returncode != 0:
        print("ERROR running engine:", p.stderr)
        sys.exit(p.returncode)

    with open(json_out, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("=" * 70)
    print("CLASS1 REAL ENGINE SAMPLE COMPARISON (numpy 2.4.6)")
    print("=" * 70)
    delta = data.get("delta", {})
    expected = delta.get("expected")
    p50 = delta.get("p50")
    p80 = delta.get("p80")
    p90 = delta.get("p90")
    p95 = delta.get("p95")
    worst = delta.get("worst")

    stored_expected = 3134.833626951535
    stored_p50 = 1962.6150557590718
    stored_p90 = 6403.191307466507

    print(f"expected: {expected}")
    print(f"  stored: {stored_expected}")
    print(f"  diff:   {expected - stored_expected}")
    print(f"p50:      {p50}")
    print(f"  stored: {stored_p50}")
    print(f"  diff:   {p50 - stored_p50}")
    print(f"p80:      {p80}")
    print(f"p90:      {p90}")
    print(f"  stored: {stored_p90}")
    print(f"  diff:   {p90 - stored_p90}")
    print(f"p95:      {p95}")
    print(f"worst:    {worst}")
    print("=" * 70)
    print(f"expected exact match? {expected == stored_expected}")
    print(f"p50 exact match?      {p50 == stored_p50}")
    print(f"p90 exact match?      {p90 == stored_p90}")

finally:
    for path in [before_path, after_path, json_out]:
        if os.path.exists(path):
            try:
                os.remove(path)
            except:
                pass
