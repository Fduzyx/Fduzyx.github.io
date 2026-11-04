---
title: GPU Memory-System Co-simulation
heroTitle: Observing the GPU memory system.
cardTitle: GPU Architecture & Simulation
description: An L2 cache observer that preserves simulated cycles, instructions, and output in a three-way trace replay.
order: 2
year: "Apr 2026 – present"
category: Undergraduate research · Fudan University
tags: [GPU, GPGPU-Sim, Memory Systems]
image: /images/research/gpu-simulation.webp
imageAlt: "Editorial illustration of GPU hardware and its memory system."
status: "Open pull request · #151"
statusChecked: "2026-11-04"
role: L2 observer design & implementation
resources:
  - title: L2 cache observer · PR 151
    url: https://github.com/accel-sim/gpgpu-sim_distribution/pull/151
  - title: Observer interface and event semantics
    url: https://github.com/accel-sim/gpgpu-sim_distribution/blob/2beb8a461c50918caa2475b9c2075a1a73ec8934/doc/l2-cache-observer.md
sections:
  - id: contribution
    title: An optional interface for cache events
    paragraphs:
      - "I designed and implemented an optional callback interface for accepted L2 accesses in GPGPU-Sim. A consumer can register one observer per simulator instance and collect cache activity without putting tool-specific counters or dependencies into the simulator. I also added registration checks, directed cache tests, and usage documentation so that integrations have a defined event contract."
  - id: method
    title: One accepted access, one event
    paragraphs:
      - "With a callback registered, the observer reports an accepted call to the L2 data_cache::access() path after native statistics have been updated. An event carries the original access address, request metadata, access type, and statistics status. Separate GPU-cycle and cache-call timestamps preserve the two timing contexts. The status follows the same select_stats_status() result used by the simulator’s own accounting."
  - id: validation
    title: Unchanged results in a three-way replay
    paragraphs:
      - "I replayed the Rodinia backprop 4096 SASS traces in three configurations: the unmodified simulator, the candidate with no observer registered, and the candidate with an observer attached. All three completed both kernels with identical cycle and instruction totals and matching normalized output. The observer preserved the simulator’s reported behavior in this replay while exposing its accepted L2 accesses."
      - "Directed production-cache tests also cover pending hits, sector misses, rejection and retry, address mutation, write allocation, non-global access types, and registration errors. Ten native-behavior summaries matched unmodified dev and remained unchanged with an observer attached and after unregistration."
  - id: outcome
    title: A public simulator contribution
    paragraphs:
      - "I submitted the observer, its documentation, and opt-in tests as pull request #151 to Accel-Sim’s GPGPU-Sim repository. The pull request is open for review."
---

Memory-system comparisons need events with precise timing and accounting semantics. Within a Fudan University project comparing a C++ GPU model with RTL, I built an optional L2 cache observer for GPGPU-Sim. It exposes accepted accesses through a small callback interface and makes each event traceable to the simulator’s native statistics.
