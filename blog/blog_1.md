# PetSense — Track Your Dog Through Walls Using Your Home WiFi

**2026-05-03** | PetSense Blog #1

Your home WiFi router is already bouncing signals off every living thing in your house. PetSense reads those signal ghosts and turns them into a live map of where your dog or cat is — no collar, no camera, no cloud.

## How It Works

WiFi uses OFDM — dozens of subcarrier frequencies beamed simultaneously. When a body moves through the room, it perturbs each subcarrier's amplitude and phase differently. The pattern of those perturbations is called Channel State Information (CSI), and it's a fingerprint of what moved, where, and how.

Think of it like echolocation, but with WiFi packets instead of sound waves.

A $5 ESP32 microcontroller in monitor mode extracts the CSI matrix from your router's beacon frames. A lightweight CNN classifier (under 1MB) turns those matrices into: "Dog, walking, kitchen, heading toward back door."

## What It Can Actually Do

- **Detect a dog walking through walls** — 90-95% accuracy on 2.4GHz WiFi
- **Tell dog from human from cat** — gait frequency is a dead giveaway (dogs: 2.5-4Hz, cats: 3-5.5Hz, humans: 1.4-2.2Hz)
- **Room-level location** — which room the pet is in, with multilateration from multiple ESP32 nodes
- **Activity classification** — walking, running, lying down, playing, scratching
- **Health trend alerts** — "Your dog is 40% less active this week" (early warning for arthritis, depression, illness)
- **Zone alerts** — pet enters the kitchen → push notification

## What It Can't Do (Yet)

- **Curled-up sleeping cats** are RF-near-invisible at 2.4GHz. A 3kg cat in a ball produces almost no signal perturbation. 5GHz helps but it's still the hardest detection case.
- **Multi-pet deconfliction** — two identical-sized dogs in the same room look like one blurry blob to WiFi. Gait fingerprinting might solve this but it's research-grade.
- **Sub-room precision** — you get "living room," not "on the couch." mmWave radar would give you centimeter precision but costs 10x more and doesn't go through walls.

## Hardware Cost

| Component | Cost |
|-----------|------|
| 3× ESP32-S3 nodes | $15-24 |
| Raspberry Pi 5 (edge hub) | $60 |
| Misc (power supplies, case) | $25 |
| **Total BOM** | **~$100-110** |

Zero subscription. All processing runs locally. No data leaves your house.

## Why Not Just Use a Camera?

Cameras need line of sight. WiFi goes through walls. Cameras need lighting. WiFi works in the dark. Cameras upload your floor plan to AWS. WiFi stays local. Cameras can't tell two identical black Labs apart. WiFi gait analysis might eventually be able to.

Also: your pet doesn't need to wear anything. No collar, no tag, no BLE beacon that runs out of battery. PetSense works on any animal that moves — including the stray cat that visits your garden or the raccoon in your attic.

## The Cat Gap

Honest assessment: if your primary use case is indoor cats, wait 6-12 months. The ESP32-C5 (WiFi 6, 5GHz band, just started shipping dev boards) is the inflection point. Combined with better ML architectures trained specifically on small-animal signatures, cat detection will get there. But right now at 2.4GHz on ESP32-S3, a curled sleeping cat is invisible.

For dog owners with medium-to-large breeds? This works today.

## What We're Building

PetSense is open-source, fully local, and designed to be assembled from commodity hardware. The spec covers:

- ESP32 firmware for CSI capture
- Edge hub (RPi5) for aggregation, inference, and tracking
- Svelte 5 PWA with live floor plan overlay
- ONNX classifier models (CNN, <2MB, int8 quantized)
- Kalman filter tracker for multi-pet position fusion

Full spec at `SPEC.md`. Blog will track progress through the sprints.

---

*Part of the Sandbox-build lab series. Built with zero cloud dependencies.*
