---
layout: distill
title: A Dive into 3D Reconstruction Literature
description: A summary and literature review of the solutions proposed to solve the 3D reconstruction problem
tags: ai literature-review 3d computer-vision
giscus_comments: true
date: 2024-10-09
featured: False
related_publications: true

authors:
  - name: Nazir Nayal
    url: "nazirnayal.xyz"
    affiliations:
      name: MPI-INF

bibliography: 2024-10-04-a-dive-into-3d-reconstruction.bib

toc:
  - sidebar: left
 
---

# Introduction

  The goal of this post is to build a knowledge graph of the literature of 3D reconstruction in computer vision, which would allow for a smoother entry into the field for anyone beginning to work on this problem. I am building this post as I am learning and traversing the literature myself, hoping that I can help other save time. Please note that this covers the works and literature up to the end of 2024, so if you are reading this blog at a later time be careful.

---

# What is the problem we are solving ?

    The end goal of this area is to find ways to generate reliable representations for 3D scenes which can be used in different applications. The methods in this literature seek ways to build this representation. Most of these methods differ in terms of what kind of data is used to learn the 3D representations. Some tackle the problem using many 2D images of the same view, and other then try to generate the 3D representation by using fewer and fewer 2D images for efficiency and to overcome data scarcity.


# 3D Representations

- Meshes
- Point Clouds
- NeRF
- Gaussian Splats


# Methods based on Density of views

## Dense Views

## Sparse Views

# Per-Scene vs. Cross-Scene Methods

    Some existing methods optimize a model for a specific scene only, while other methods utilize large datasets to learn a strong prior such that a 3D scene representation can be achieved with a single forward pass.
