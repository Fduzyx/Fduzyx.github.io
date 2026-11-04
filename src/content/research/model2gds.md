---
title: Model2GDS — Reproducible Systolic-Array Design
heroTitle: From model predictions to routed arrays.
cardTitle: Model2GDS & Chip Design
description: My individual ISSCC 2027 Code-a-Chip project, with exact numerical and cycle agreement across 441 model-to-RTL checks.
order: 3
year: "Oct–Nov 2026"
category: Individual project · ISSCC 2027 Code-a-Chip
tags: [Model-to-RTL, Systolic Arrays, EDA]
image: /images/research/model2gds.webp
imageAlt: "Detail of the Model2GDS 4×4 systolic-array routing view."
status: Merged into the official Code-a-Chip repository
statusChecked: "2026-11-04"
role: Individual project author
resources:
  - title: Open the notebook
    url: https://github.com/sscs-ose/sscs-ose-code-a-chip.github.io/blob/main/ISSCC27/submitted_notebooks/Model2GDS/Model2GDS.ipynb
  - title: Official contribution · PR 205
    url: https://github.com/sscs-ose/sscs-ose-code-a-chip.github.io/pull/205
  - title: Project notebook and supporting files
    url: https://github.com/sscs-ose/sscs-ose-code-a-chip.github.io/tree/main/ISSCC27/submitted_notebooks/Model2GDS
sections:
  - id: contribution
    title: An executable path from model to RTL
    paragraphs:
      - "Model2GDS is my individual ISSCC 2027 Code-a-Chip project. I developed the independent numerical and token-cycle models, parameterized SystemVerilog RTL, and verification workflow, then connected them in an executable notebook. Readers can replay the comparisons from preserved inputs and RTL observations, through parsers and structured results, to the figures shown here. The physical implementation uses an existing open-source RTL-to-GDS toolchain."
  - id: validation
    title: Exact agreement across three array sizes
    paragraphs:
      - "The numerical model checks matrix-multiplication results; the token-cycle model predicts completion in counted rising clock edges. Across the 2×2, 4×4, and 8×8 arrays, both models matched the recorded RTL in all 441 test runs. The maximum absolute cycle difference was zero. These checks make the array’s arithmetic and completion timing independently reproducible."
  - id: physical
    title: Routed 2×2 and 4×4 arrays
    paragraphs:
      - "I implemented the 2×2 and 4×4 arrays in SKY130 with a 20 ns clock target using an open-source RTL-to-GDS flow. The routing views and area figures below come from that implementation study. Its recipe, metric extraction, and saved physical-design records are included in the notebook’s supplement, so readers can trace each reported value to its source."
  - id: outcome
    title: Merged into IEEE SSCS Code-a-Chip
    paragraphs:
      - "IEEE SSCS merged Model2GDS into its official Code-a-Chip repository through PR #205. The notebook, RTL, verification cases, preserved results, and reproduction instructions are available together in the ISSCC 2027 submission directory."
---

Model2GDS is my individual ISSCC 2027 Code-a-Chip project, now merged into the official IEEE SSCS repository. I built an executable path from independent numerical and token-cycle models to recorded RTL behavior across three systolic-array sizes. The notebook also connects routed 2×2 and 4×4 implementations to their physical-design records and area estimates.
