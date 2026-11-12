import sys
import os

# Add repo root to path so we can import python.run_class1
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from python.run_class1 import _init_footprint_placeholder

print("=== 1. INITIALIZING PLACEHOLDER ===")
_init_footprint_placeholder()

print("=== 2. IMPORTING cost_engine ===")
import cost_engine
print("Successfully imported cost_engine!")

names_from_init = [
    "resolve_intensity",
    "carbon_kg",
    "CarbonPrice",
    "simulate_carbon",
    "analyze_footprint_delta",
    "load_grid",
    "resolve_water",
    "water_m3",
    "simulate_water",
    "analyze_water_delta",
    "embodied_carbon_kg",
    "materials_adp_kg",
    "ewaste_kg_year",
    "footprint_report",
]

print("\n=== 3. VERIFYING ALL 13+1 NAMES ON cost_engine ===")
for name in names_from_init:
    assert hasattr(cost_engine, name), f"Missing {name} on cost_engine"
    val = getattr(cost_engine, name)
    print(f"  [x] cost_engine.{name}: {type(val).__name__}")

print("\n=== 4. VERIFYING BEHAVIOR ===")
# Verify footprint_report returns clean disclaimer
report = cost_engine.footprint_report()
print(f"  footprint_report() -> '{report}'")
assert report == "Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)"

# Verify functions raise NotImplementedError
for name in ["resolve_intensity", "carbon_kg", "simulate_carbon", "water_m3", "materials_adp_kg"]:
    fn = getattr(cost_engine, name)
    try:
        fn()
        raise AssertionError(f"Expected {name} to raise NotImplementedError")
    except NotImplementedError as e:
        print(f"  {name}() correctly raised NotImplementedError: {e}")

try:
    cost_engine.CarbonPrice.load()
    raise AssertionError("Expected CarbonPrice.load to raise NotImplementedError")
except NotImplementedError as e:
    print(f"  CarbonPrice.load() correctly raised NotImplementedError: {e}")

print("\nAll 13+1 names verified successfully!")

