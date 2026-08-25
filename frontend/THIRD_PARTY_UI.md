Third-party UI components integrated (Focus + FlareLine)

This document records the selective extraction of UI components from two third-party UI kit repositories inspected for reuse in this ERP frontend. It is intentionally conservative: only presentation/UI primitives are adapted and incorporated. No template applications, services, routing, authentication, Firebase, or demo data are included.

1) Focus Flutter UI Kit
  - Repository: https://github.com/maxlam79/focus_flutter_ui_kit
  - Upstream license: MIT (copied into frontend/third_party/licenses/focus_flutter_ui_kit/LICENSE)
  - What was incorporated (Phase A):
    - Typography theme primitives (adapted): frontend/lib/presentation/ui/theme/fui_typography.dart
    - Button params and lightweight button theme primitives (adapted): frontend/lib/presentation/ui/components/button/
    - A corrected lightweight row layout helper: frontend/lib/presentation/ui/layout/fui_row.dart
  - What was NOT copied:
    - Demo pages, routing, services, entities, authentication, API clients, and data.
    - Heavy dependencies (charts/datagrids) were NOT added.

2) FlareLine UI Kit
  - Repository: https://github.com/FlutterFlareLine/FlareLine-UiKit
  - Upstream license: NONE FOUND (no explicit LICENSE file at time of inspection)
    - Because there is no license in the upstream repository, the project has NOT copied FlareLine source files yet. Any future incorporation from FlareLine requires explicit confirmation and possibly a legal review.
  - What was inspected: components and widget collections for potential sidebar/navigation and card widgets.
  - What was NOT copied: any code pending license clarification.

Notes and next steps:
 - This Phase A extraction is intentionally small and reversible. It introduces only presentation primitives and does not alter core app services, routing, or API usage.
 - The FUI files added are adapted to the ERP frontend package layout and use conservative implementations compatible with the current Flutter SDK.
 - FlareLine lacks an upstream license; do NOT distribute derived FlareLine code until a license is confirmed.
 - If fonts are required (e.g., Inter), a follow-up decision is required to add font files or use google_fonts. No font files were added in Phase A.
 - Any dependency additions (pubspec.yaml) will be proposed explicitly before modification.

Files added in Phase A (presentation):
 - frontend/lib/presentation/ui/theme/fui_typography.dart
 - frontend/lib/presentation/ui/components/button/fui_button_params.dart
 - frontend/lib/presentation/ui/components/button/fui_button_theme.dart
 - frontend/lib/presentation/ui/layout/fui_row.dart
 - frontend/third_party/licenses/focus_flutter_ui_kit/LICENSE
 - frontend/third_party/licenses/flareline_ui_kit/LICENSE (record noting missing upstream license)

If you approve, next actions (Phase A continued):
 - Optionally add minimal styling glue in app theme to use FUITypographyThemeLight.
 - Decide font approach (copy Inter fonts or use google_fonts); I will not add fonts until you choose.
 - Propose any minimal pubspec.yaml dependency additions if a copied component requires them.

Prepared by: Copilot (running in the repository-aware workflow). Do not commit these changes until you instruct me to do so.
