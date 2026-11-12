"""Class1 Runner Wrapper
---------------------
Safe entrypoint for Class1Dev cost estimation.
Upstream class1 0.1.0 (PyPI) omitted the optional ecological footprint module
(cost_engine/footprint.py) from both its wheel and sdist distributions.

This wrapper injects a minimal, explicitly labelled placeholder in sys.modules
before takeoff.estimate_pr is imported.
- All unused footprint math functions raise NotImplementedError.
- No invented numbers are returned.
- footprint_report returns a clear disclaimer.
"""
from __future__ import annotations
import sys
import types


def _init_footprint_placeholder():
    """Register placeholder cost_engine.footprint module in sys.modules."""
    mod = types.ModuleType("cost_engine.footprint")
    mod.__doc__ = "Placeholder for missing upstream cost_engine.footprint in class1 0.1.0."

    def _not_implemented(*args, **kwargs):
        raise NotImplementedError("Ecological footprint is disabled: cost_engine.footprint is missing from class1 0.1.0")

    class _CarbonPrice:
        @classmethod
        def load(cls, *args, **kwargs):
            raise NotImplementedError("CarbonPrice is disabled: cost_engine.footprint is missing from class1 0.1.0")

    def _footprint_report(baseline=None, pr=None, n=120_000, region=None) -> str:
        return "Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)"

    mod.CarbonPrice = _CarbonPrice
    mod.resolve_intensity = _not_implemented
    mod.carbon_kg = _not_implemented
    mod.simulate_carbon = _not_implemented
    mod.analyze_footprint_delta = _not_implemented
    mod.load_grid = _not_implemented
    mod.resolve_water = _not_implemented
    mod.water_m3 = _not_implemented
    mod.simulate_water = _not_implemented
    mod.analyze_water_delta = _not_implemented
    mod.embodied_carbon_kg = _not_implemented
    mod.materials_adp_kg = _not_implemented
    mod.ewaste_kg_year = _not_implemented
    mod.footprint_report = _footprint_report

    sys.modules["cost_engine.footprint"] = mod


def main():
    _init_footprint_placeholder()
    from takeoff.estimate_pr import main as takeoff_main
    sys.exit(takeoff_main(sys.argv[1:]))


if __name__ == "__main__":
    main()

