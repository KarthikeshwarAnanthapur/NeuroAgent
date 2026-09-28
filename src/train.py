"""
train.py — Agentic AI Orchestrator / Training Interface
=========================================================
This module serves as the top-level orchestrator for the NeuroAgent pipeline.

In its current form it:
  1. Loads raw EEG data
  2. Preprocesses the signal
  3. Runs ICA
  4. Extracts features
  5. Invokes the Agentic AI to reason over components and make decisions
  6. Applies removals and saves the clean EEG + decision report

The "training" aspect refers to fine-tuning or updating the agent's
internal heuristics based on human expert feedback (human-in-the-loop).
"""

import json
import time
from pathlib import Path
from typing  import Optional

# ── LOCAL MODULES ─────────────────────────────────────────────────────────────

from load_data  import load_eeg, list_raw_files
from preprocess import run_preprocessing
from ica        import fit_ica, auto_detect_artifacts, extract_component_features, apply_ica
from features   import extract_all_features


# ── PATHS ─────────────────────────────────────────────────────────────────────

MODELS_DIR    = Path(__file__).resolve().parents[1] / "models"
PROCESSED_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"
REPORTS_DIR   = PROCESSED_DIR / "reports"


# ── AGENTIC AI STUB ──────────────────────────────────────────────────────────

class NeuroAgentAI:
    """
    Agentic AI reasoning engine for ICA component decision-making.

    This stub implements a rule-based fallback. Replace the `reason()` method
    with an LLM-powered agent (e.g. via OpenAI / Gemini function-calling) that:
      - Receives component features + auto-detection suggestions
      - Reasons over evidence (Observe → Analyze → Reason → Act → Evaluate)
      - Returns a list of component indices to exclude

    The agent loop is:
        while quality_not_acceptable:
            inspect_components()
            make_exclusion_decision()
            reconstruct_eeg()
            evaluate_quality()
    """

    def __init__(self, model: str = "rule-based"):
        self.model = model
        self.iteration = 0
        self.max_iterations = 5

    def observe(self, features: dict, component_features: list[dict],
                auto_suggestions: list[int]) -> dict:
        """Gather all evidence for reasoning."""
        return {
            "n_channels":       features["n_channels"],
            "duration_sec":     features["duration_sec"],
            "auto_suggestions": auto_suggestions,
            "component_info":   component_features,
            "artifact_summary": features["artifact_scores"],
        }

    def reason(self, observation: dict) -> list[int]:
        """
        Decide which ICA components to exclude.

        Rule-based fallback:
          - Accept auto-detected artifacts from EOG/ECG
          - Also exclude components with very high kurtosis (> 10)
        """
        exclude = list(observation["auto_suggestions"])

        for comp in observation["component_info"]:
            if comp["kurtosis"] > 10 and comp["component_id"] not in exclude:
                exclude.append(comp["component_id"])

        print(f"[agent] Iteration {self.iteration + 1}: "
              f"Excluding components {sorted(exclude)}")
        return sorted(exclude)

    def evaluate(self, features_before: dict,
                 features_after: dict) -> dict:
        """
        Compare quality metrics before/after ICA removal.
        Returns a quality report and whether the result is acceptable.
        """
        # Simple metric: reduction in muscle-band artifact score
        muscle_before = sum(features_before["artifact_scores"]["muscle_score"])
        muscle_after  = sum(features_after["artifact_scores"]["muscle_score"])
        improvement   = (muscle_before - muscle_after) / (muscle_before + 1e-9)

        quality_score  = max(0.0, min(1.0, 0.5 + improvement))
        is_acceptable  = quality_score >= 0.6 or self.iteration >= self.max_iterations - 1

        return {
            "quality_score":  round(quality_score, 4),
            "muscle_reduction": round(float(improvement), 4),
            "is_acceptable":  is_acceptable,
            "iteration":      self.iteration + 1,
        }

    def run_loop(self, raw_original, ica, auto_suggestions,
                 component_features, features_original):
        """
        Closed-loop processing: reason → act → evaluate → repeat.
        """
        raw_current = raw_original.copy()

        for self.iteration in range(self.max_iterations):
            observation = self.observe(
                features_original, component_features, auto_suggestions
            )
            exclude = self.reason(observation)

            raw_clean       = apply_ica(ica, raw_current, exclude)
            features_clean  = extract_all_features(raw_clean)
            evaluation      = self.evaluate(features_original, features_clean)

            print(f"[agent] Quality score: {evaluation['quality_score']:.4f} "
                  f"(muscle reduction: {evaluation['muscle_reduction']:.2%})")

            if evaluation["is_acceptable"]:
                print(f"[agent] Result accepted at iteration {self.iteration + 1}.")
                return raw_clean, exclude, evaluation

            # On next iteration — refine (placeholder for LLM feedback loop)
            raw_current = raw_clean

        return raw_clean, exclude, evaluation


# ── PIPELINE ORCHESTRATOR ────────────────────────────────────────────────────

def run_pipeline(filename: Optional[str] = None,
                 ica_config:  dict = None,
                 prep_config: dict = None) -> dict:
    """
    End-to-end NeuroAgent pipeline.

    Parameters
    ----------
    filename   : EEG filename in data/raw/ (auto-selects first if None)
    ica_config : overrides for ICA configuration
    prep_config: overrides for preprocessing configuration

    Returns
    -------
    report : dict with pipeline results and quality metrics
    """
    start = time.time()

    # ── 1. Load ──────────────────────────────────────────────────────────────
    files = list_raw_files()
    if not files:
        raise RuntimeError("No EEG files found in data/raw/. "
                           "Please upload an EEG recording.")

    target = filename or files[0]
    print(f"\n{'='*60}")
    print(f"  NeuroAgent Pipeline — {target}")
    print(f"{'='*60}\n")

    raw = load_eeg(target)

    # ── 2. Preprocess ────────────────────────────────────────────────────────
    raw = run_preprocessing(raw, config=prep_config,
                             save_as="preprocessed_raw.fif")
    features_raw = extract_all_features(raw)

    # ── 3. ICA ───────────────────────────────────────────────────────────────
    ica             = fit_ica(raw, config=ica_config)
    auto_result     = auto_detect_artifacts(ica, raw, config=ica_config)
    comp_features   = extract_component_features(ica, raw)

    # ── 4. Agentic AI reasoning loop ─────────────────────────────────────────
    agent = NeuroAgentAI()
    raw_clean, excluded, evaluation = agent.run_loop(
        raw_original       = raw,
        ica                = ica,
        auto_suggestions   = auto_result["all_indices"],
        component_features = comp_features,
        features_original  = features_raw,
    )

    # ── 5. Save clean EEG ────────────────────────────────────────────────────
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    clean_path = PROCESSED_DIR / "clean_eeg.fif"
    raw_clean.save(str(clean_path), overwrite=True, verbose=False)
    print(f"\n[pipeline] Clean EEG saved → {clean_path}")

    # ── 6. Build report ──────────────────────────────────────────────────────
    elapsed = round(time.time() - start, 2)
    report  = {
        "input_file":        target,
        "n_channels":        raw.info["nchan"],
        "duration_sec":      round(raw.times[-1], 2),
        "sfreq":             raw.info["sfreq"],
        "excluded_components": excluded,
        "n_excluded":        len(excluded),
        "quality_score":     evaluation["quality_score"],
        "muscle_reduction":  evaluation["muscle_reduction"],
        "iterations":        evaluation["iteration"],
        "elapsed_sec":       elapsed,
        "output_file":       str(clean_path),
        "status":            "success",
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / "pipeline_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"[pipeline] Report saved → {report_path}")
    print(f"[pipeline] Done in {elapsed}s\n")

    return report


# ── HUMAN FEEDBACK ───────────────────────────────────────────────────────────

def apply_human_feedback(accepted_components: list[int],
                          rejected_components: list[int],
                          raw_path: str = "preprocessed_raw.fif") -> str:
    """
    Apply human expert overrides to ICA component decisions.

    Parameters
    ----------
    accepted_components : components the expert wants to KEEP (override removal)
    rejected_components : components the expert wants to REMOVE (override keep)
    raw_path            : preprocessed file to re-apply ICA to

    Returns
    -------
    Path to the corrected clean EEG file.
    """
    import mne
    from mne.preprocessing import read_ica

    # Load preprocessed raw
    raw = mne.io.read_raw_fif(str(PROCESSED_DIR / raw_path),
                               preload=True, verbose=False)

    # Reload ICA (assume it was saved)
    ica_path = MODELS_DIR / "ica_solution.fif"
    if not ica_path.exists():
        raise FileNotFoundError(
            "ICA solution not found. Run the pipeline first."
        )
    ica = read_ica(str(ica_path))

    # Merge human decisions with agent decisions
    current_exclude = set(ica.exclude)
    current_exclude -= set(accepted_components)  # un-exclude accepted
    current_exclude |= set(rejected_components)  # add rejected

    ica.exclude = sorted(current_exclude)
    raw_clean   = raw.copy()
    ica.apply(raw_clean, verbose=False)

    out_path = PROCESSED_DIR / "clean_eeg_human_reviewed.fif"
    raw_clean.save(str(out_path), overwrite=True, verbose=False)
    print(f"[feedback] Human-reviewed clean EEG → {out_path}")
    return str(out_path)


# ── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    report = run_pipeline()
    print("\n── Pipeline Report ────────────────────────────────")
    for k, v in report.items():
        print(f"  {k:25s}: {v}")
    print("────────────────────────────────────────────────\n")
