---
title: "File System Memory Allocation Algorithms"
excerpt: "Implementation of Contiguous Allocation and Linked Allocation algorithms for file system memory management,=,"
collection: projects
permalink: /projects/file_system_memory_allocation
date: 2020-04-25
categories:
  - University Project
tags:
  - C++
  - University Course
  - Operating System
  - Memory Allocation
  - Algorithms
---

## Code
========
The code is available on github [here](https://github.com/NazirNayal8/file-system-space-allocation-analysis).

## Skills

* C++
* Algorithms
* Memory Allocation
* File System Management

## About

This project was part of the COMP304 Operating Systems class at Koç University.

The goal is implement and compare the performance of the Linked Allocation and Contiguous Allocation
algorithms. These algorithms are used to assign memory for newly created files in the operating system.
They also support the functionalities of extending, shrinking, or deleting a file.

## Notes About Memory Allocation Algorithms

Linked Allocation is costly when many lookup operations are required. This is because no matter which byte we intend to access,
we need to start from the beginning of the file and keep moving towards the destination byte. On the other hand, it is efficient in terms
of memory usage, because we do not necessarily need to find a consecutive set of blocks; as long as as the sum of available blocks is enough for the file
we can always place it.

As for Contiguous Allocation, it is much faster in terms of frequent access, as a simple offset calculation is enough for finding the required block or byte.
But this approach, on the other hand, is troublesome when we want to add new files or extend the size of already existing ones. This is because we must find a
consecutive set of blocks. So in case the sum of available blocks is enough for size of the new file, but non of these form a consecutive sequence, we will have to
perform a fragmentation operation, which is basically a re-ordering of the files in the memory system in a compressed way so that all empty space is accumulated
at the end of the memory, leaving enough space for the new file to be inserted.
