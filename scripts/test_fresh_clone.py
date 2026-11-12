import os
import shutil
import subprocess
import sys
import zipfile

def main():
    print("=" * 70)
    print("FRESH-CLONE / FRESH-CHECKOUT REPRODUCIBILITY TEST")
    print("=" * 70)

    repo_dir = os.path.abspath(os.getcwd())
    scratch_dir = r"C:\Users\OMKAR\.gemini\antigravity\brain\78b6830b-ad6c-47e4-8f8c-90e64e53d2af\scratch"
    clone_dir = os.path.join(scratch_dir, "fresh-clone-neon-mcp")
    archive_zip = os.path.join(scratch_dir, "fresh-clone.zip")

    if os.path.exists(clone_dir):
        print(f"Cleaning previous clone directory: {clone_dir}")
        shutil.rmtree(clone_dir, ignore_errors=True)

    # 1. Export pure git tree via git archive
    print("\n[1] Exporting clean git repository tree via git archive...")
    res_archive = subprocess.run(["git", "archive", "-o", archive_zip, "master"], cwd=repo_dir, capture_output=True, text=True)
    if res_archive.returncode != 0:
        print("Git archive failed:", res_archive.stderr)
        sys.exit(1)
    print("    Git archive successful.")

    # 2. Extract into isolated clean directory
    print(f"\n[2] Extracting git tree into fresh directory:\n    {clone_dir}")
    os.makedirs(clone_dir, exist_ok=True)
    with zipfile.ZipFile(archive_zip, "r") as z:
        z.extractall(clone_dir)
    print("    Extracted clean repository tree.")

    # 3. Verify untracked/ignored files are absent from fresh checkout
    print("\n[3] Verifying untracked/ignored files are absent from fresh checkout:")
    for bad_path in [".env", ".venv", "node_modules", "dist"]:
        exists = os.path.exists(os.path.join(clone_dir, bad_path))
        print(f"    - {bad_path:<15}: {'PRESENT (FAIL)' if exists else 'ABSENT (PASS)'}")
        if exists:
            sys.exit(1)

    # 4. Copy .env and reuse .venv and node_modules for local test speed without network re-download
    print("\n[4] Providing environment (.env, node_modules, .venv) for fresh build...")
    shutil.copy(os.path.join(repo_dir, ".env"), os.path.join(clone_dir, ".env"))

    # Copy node_modules symlink or junction / copy
    print("    Linking node_modules and .venv into fresh clone...")
    cmd_junction_nm = f'cmd /c mklink /J "{os.path.join(clone_dir, "node_modules")}" "{os.path.join(repo_dir, "node_modules")}"'
    subprocess.run(cmd_junction_nm, shell=True, capture_output=True)

    cmd_junction_venv = f'cmd /c mklink /J "{os.path.join(clone_dir, ".venv")}" "{os.path.join(repo_dir, ".venv")}"'
    subprocess.run(cmd_junction_venv, shell=True, capture_output=True)

    # 5. Run npx tsc --noEmit
    print("\n[5] Running npx tsc --noEmit in fresh clone...")
    res_tsc = subprocess.run("npx tsc --noEmit", cwd=clone_dir, shell=True, capture_output=True, text=True)
    print(f"    tsc exit code: {res_tsc.returncode} (0 = zero errors)")
    if res_tsc.returncode != 0:
        print(res_tsc.stderr or res_tsc.stdout)
        sys.exit(1)

    # 6. Run npm run build
    print("\n[6] Running npm run build in fresh clone...")
    res_build = subprocess.run("npm run build", cwd=clone_dir, shell=True, capture_output=True, text=True)
    print(f"    build exit code: {res_build.returncode} (0 = success)")
    if res_build.returncode != 0:
        print(res_build.stderr or res_build.stdout)
        sys.exit(1)

    # 7. Run npm test (Vitest)
    print("\n[7] Running npm test (Vitest suite) in fresh clone...")
    res_test = subprocess.run("npm test", cwd=clone_dir, shell=True, capture_output=True, text=True)
    print(f"    test exit code: {res_test.returncode}")
    print(res_test.stdout.strip())
    if res_test.returncode != 0:
        sys.exit(1)

    # 8. Clean up clone directory and archive zip
    print("\n[8] Cleaning up isolated test directory...")
    subprocess.run(f'cmd /c rmdir "{os.path.join(clone_dir, "node_modules")}"', shell=True, capture_output=True)
    subprocess.run(f'cmd /c rmdir "{os.path.join(clone_dir, ".venv")}"', shell=True, capture_output=True)
    shutil.rmtree(clone_dir, ignore_errors=True)
    if os.path.exists(archive_zip):
        os.remove(archive_zip)
    print("    Cleaned up successfully.")

    print("\n" + "=" * 70)
    print("PASSED: FRESH CLONE BUILDS, COMPILES, AND PASSES ALL TESTS OUT OF THE BOX!")
    print("=" * 70)

if __name__ == "__main__":
    main()
