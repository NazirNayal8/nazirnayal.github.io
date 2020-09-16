---
title: "Air Traffic Control Simulation"
excerpt: "Operating Systems Course"
collection: projects
permalink: /projects/air_traffic_control
---

## Code

The code is available on github [here](https://github.com/NazirNayal8/air-traffic-control-with-pthreads).

## Skills

* C++
* Multi-Threading
* Problem Solving

## About

This project was a part of COMP304 Operating Systems course at Koç University.

The goal was to create a simulation for a traffic tower in an airport. The tower should
regulate the the permissions for landing and departing airplanes so that no clash happens.

Essentially, the purpose of the project is to use the `pthread` interface of thread control in `C` language
for regulating the landing and departing requests, as well as the available landing resources, which in this case are
landing routes.


## Implementation

I implemented the project using `C++` and `pthread` library imported from `C`.

At different time intervals, different request can come arbitrarily to the air traffic tower. There are 3 types of requests

* Landing
* Departing
* Emergency

Each of the types has its type of priority and its duration depending on several parameters such as the size of the plane, the chosen landing resource ...etc.

The first version of the implementation uses `pthreads` to manage the allocation of the resources by the means of pre-assigned priorities. The pre-assigned priorities might cause a case of starvation when many requests of higher priority outnumber those of less priority. So we had to devise a strategy that would help to avoid starvation of any type as much as possible.


The strategy I used was to set a certain `threshold` value. When the number of waiting planes of each of the two main types (landing, departing) exceeds this threshold, then a `crowded policy` is put into action. In the `crowded policy` 1 plane of less priority is served for every 2 planes of higher priority.
This strategy preserves the relative priority between the two types, and at the same time guarantees the progress of the type of less priority.
