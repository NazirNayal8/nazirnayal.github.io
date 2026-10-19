---
layout: page
title: "MixFlow: Mixed Source Distributions Improve Rectified Flows"
description: A training strategy that mixes conditional and unconditional source distributions to improve rectified-flow sampling.
img: assets/img/publication_preview/mixflow_main_figure.png
importance: 0
category: research
github: https://github.com/NazirNayal8/MixFlow
related_publications: false
---

## Overview

MixFlow combines conditional and unconditional source distributions when training rectified flows. The approach aims to straighten generation paths and improve the trade-off between sampling speed and image quality.

The repository contains training, inference, and curvature-evaluation tools, with experiment configurations for CIFAR-10, FFHQ, and AFHQv2. Experiments use PyTorch Lightning and Hydra.

## Resources

[Code](https://github.com/NazirNayal8/MixFlow) · [Paper](https://arxiv.org/abs/2604.09181) · [Workshop submission](https://openreview.net/forum?id=uWktyU3OIJ)

## Venue

ICLR 2026, 2nd DeLTa Workshop.
