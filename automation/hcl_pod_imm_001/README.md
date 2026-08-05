# HCL-POD-IMM-001 — Unreal Engine 5.8 GitHub Control Plane

This branch is the isolated control plane for the Huckleberry Podcast Lounge immersive upscale.

## Governing pipeline

**Unreal Engine 5.8 first → bounded Blender refinement → Unreal Engine 5.8 final proof**

Blender remains locked until actual Unreal Stage A evidence establishes the bounded Stage B scope.

## Frozen authority

- `HCL-POD-3D-002` is the sole spatial and dimensional authority.
- `HCL-POD-3D-003-R1` is the Founder-approved visual target.
- Frozen source GLB SHA-256:
  `4e3ff72c99805b7a80bbd2b57b999dfed7c8f30f926874d51c1ba7ebf60c8402`
- A0 transfer-kit archive SHA-256:
  `fe9ef8150d26357e3243e01367da95a1df468c2204cd246b5cd52a857362ccec`

## Highest-leverage move

Register one Windows workstation with Unreal Engine 5.8 as a GitHub Actions self-hosted runner. After that, the `HCL POD IMM 001 — UE5.8 Stage A` workflow can:

1. verify the frozen source hash;
2. verify Unreal Engine 5.8 and the isolated branch;
3. launch the Grand Core UE5.8 master project in a visible GPU session;
4. open the Stage A import and evidence session;
5. collect logs, screenshots, video, receipts, and the completed return folder;
6. package the return as a GitHub Actions artifact.

## One-time workstation setup

1. Clone `SnkrsEnvy/lab` on the Windows Unreal workstation.
2. Check out branch `huckleberry/imm-001`.
3. Extract the A0 transfer kit to:
   `C:\HCL_POD\HCL_POD_IMM_001_A0_UNREAL_TRANSFER_LAUNCH_KIT`
4. Confirm Unreal Engine 5.8 is installed at:
   `C:\Program Files\Epic Games\UE_5.8`
5. In GitHub open:
   **SnkrsEnvy/lab → Settings → Actions → Runners → New self-hosted runner → Windows x64**
6. Copy the temporary registration token.
7. From PowerShell in the repository root run:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\automation\hcl_pod_imm_001\Register-HCLPodUE58Runner.ps1 -RegistrationToken "PASTE_TEMPORARY_TOKEN_HERE"
   ```

8. Start the interactive runner:

   ```text
   automation\hcl_pod_imm_001\Start-HCLPodRunner.cmd
   ```

Keep the runner window open. It is intentionally interactive rather than installed as a Windows service so Unreal can use the signed-in display and GPU session.

## Stage A execution

In the repository Actions tab:

1. select **HCL POD IMM 001 — UE5.8 Stage A**;
2. run `preflight`;
3. after preflight passes, run `interactive-stage-a`;
4. follow the transfer kit's operator quick start;
5. import the frozen GLB using Unreal 5.8 Interchange **Import Into Level**;
6. save, close, fresh-reopen, inspect, capture, and complete the return packet;
7. close Unreal when finished so the workflow can package the evidence.

## Local paths

- Unreal project in repository:
  `<repo>\unreal\GrandCore.uproject`
- Isolated content path in Unreal:
  `/Game/HCL_POD/IMM_001/`
- Review map:
  `HCL_POD_IMM_001_ReviewMap`
- Transfer kit:
  `C:\HCL_POD\HCL_POD_IMM_001_A0_UNREAL_TRANSFER_LAUNCH_KIT`
- Evidence return:
  `C:\HCL_POD\HCL_POD_IMM_001_STAGE_A_RETURN`
- Runner:
  `C:\actions-runner-hcl-pod`

## Claim boundary

This automation proves transfer integrity, source hash, environment presence, launch, returned files, logs, and archive integrity. It does not independently prove visual correctness, collision quality, camera quality, or runtime success. Those conclusions require inspection of the actual Unreal evidence.
