---
layout: page
title: "Likelihood-ratio estimation for unknown objects"
description: "An unknown estimation module for detecting out-of-distribution regions using foundation models and likelihood ratios."
img: assets/img/publication_preview/UEM_preview.png
importance: 2
category: research
related_publications: false
github: https://github.com/NazirNayal8/UEM-likelihood-ratio
---

## Overview

The unknown estimation module (UEM) detects out-of-distribution objects using likelihood-ratio scores on top of a semantic segmentation model. The implementation includes foundation-model segmentation heads, model checkpoints, and separate training stages for the segmentor and unknown estimation module.

The repository provides configurations and evaluation scripts for road-anomaly and Fishyscapes benchmarks.

## Resources

[Code and checkpoints](https://github.com/NazirNayal8/UEM-likelihood-ratio) · [Paper](https://arxiv.org/abs/2409.06424)

## Technologies

Python · PyTorch · Semantic segmentation · Uncertainty estimation
