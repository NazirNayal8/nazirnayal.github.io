---
title: 'Bayesian Networks'
date: 2020-12-11
permalink: /blog/tutorials/bayes_nets
tags:
  - Artificial Intelligence
  - Probabilities
  - Random Variables
categories:
  - Tutorial
  - Artificial Intelligence
layout: splash
excerpt: Summary of Basic Concepts
---

# Bayesian Networks

A method used to represent Joint Distributions implicitly using conditional independence and local interactions.

# Representation

It is represented as a directed acyclic graph. Each variable is a Node, and a directed edge from node `A` to node `B` means that the random variable `B` is a function of random variable `A`. In other words, a random variable is a function of the random variables in its parent nodes.

Every node `A` stores a table that represents the conditional probability of random variable `A` given every combination of values its parents could take.

$$P(A | Parents(A))$$


<figure>
    <img src="/images/bayes_net/bayes_net_example.png" alt='missing' />
    <figcaption> Source: https://inst.eecs.berkeley.edu/~cs188/sp20/assets/lecture/lec-18-handout.pdf </figcaption>
</figure>

# From Conditional to Joint

In order to extract the joint distribution from the local conditionals, we can use the following formula:

$$ P(X_1, X_2, \dots , X_n) = \prod_{i=1}^n P(X_i|Parents(X_i))$$


# Size of a Bayesian Network

In order to store a table that represents an ordinary joint distribution of `N` variables where each variable can take `d` values, one would need $O(d^N)$ entries which is too large.

One important advantage of Bayesian Networks is that they reduce this size needed to store a join distribution by storing different small parts from which we can reconstruct the joint distribution. Every node contains a table that determines its value for every combination of values of its parents. If we assume that every node has no more than `k` parents, this would mean that every node has a table of size $O(d^{k+1})$ ($k + 1$ comes from the fact that we encode the parents and the node itself), so for `N` nodes, we would get a total of $O(Nd^k)$, which is a reduction that depends on `k`, the maximum number of possible parents.

# Does a Bayesian Network Graph imply Causality ?

No, not all the time. It is easier to think of the graph as if it means that a certain variable (parent) is causing another variable (child), but that is not always the case. Rather, it only means that there is a direct conditional dependency between variables.


# How to check for Independence in a Bayesian Networks

If two variables do not have a direct connection, this does **not** mean that they are independent, they might indirectly influence each other through other nodes.

For example in this graph below, `A` and `B` are not necessarily independent because they can influence each other through `B`.

<p align="center">
<img width="450" height="60" src="/images/bayes_net/causal_chain.png">
</p>

Nevertheless, we can prove **conditional independence** of some cases. For example, in the network above, we can say that `C` is conditionally independent from `A` given `B`. The intuition is that since a value of `B` was given, it already holds the influence from `A`, or another way to think of it that the influence between `A` and `C` was blocked by `B`.

There are 3 types of simple 3-node graphs which are simple to analyze and will be used to detect properties in Bayesian Networks. These graphs are **causal chains**, **common cause**, and **common effect**.


## Causal Chains

From this structure we can only say that `C` is conditionally independent of `A` given `B`. (can be proven mathematically)

<p align="center">
<img width="450" height="60" src="/images/bayes_net/causal_chain.png">
</p>

## Common Cause

Here, we can say that `B` and `C` are independent given `A`. (can be proven mathematically)

<p align="center">
<img width="150" height="210" src="/images/bayes_net/common_cause.png">
</p>


## Common Effect

Here, `A` and `B` are in fact fully independent, but they are not independent given `C`.

<p align="center">
<img width="150" height="210" src="/images/bayes_net/common_effect.png">
</p>


# Detect if 2 nodes are conditionally independent from the graph structure

We can do this by tracing the undirected path between any two nodes on the graph. For every 3 consecutive nodes on the path, we check if they satisfy conditional independence. In order to do the check, we simply identify to which type this triplet belongs (causal chain, common cause, common effect). If we find any triplet on the path to voilate independence then we assume that conditional independence between source and target node is **not guaranteed**. The triplets which imply conditional independence are called **Inactive Triplets**, whereas triplets that violate conditional independence are called **Active Triplets**. The following figure summarizes the triplet cases.

<p align="center">
<img width="437" height="500" src="/images/bayes_net/triplets.png">
</p>


This approach is called **D-Separation**.

# Markov Blanket

For a given node `X`, we can say that it is conditionally independent of all other nodes given its Markov Blanket. A **Markove Blanket** for a node consists of its parents, children, and children's parents. Like in the image below.

<p align="center">
<img width="500" height="400" src="/images/bayes_net/markov_blanket.png">
</p>

# Probabilistic Inference

The act of calculating the probability that some random variables take certain values from a join distribution.

# Inference by Enumeration

This is basically the brute force way of calculating a certain probability, where we first take the sum of the probabilities of all the hidden random variables to eliminate them, and then calculate the desired probability of the target and evidence.

**Note**: Hidden variables are the rest of the random variables which are neither in the target set, nor in the evidence set. Evidence contains the random variables which make the condition of the probability calculated.

Enumeration gives an exact answer but is exponential in complexity.

Steps of performing Inference by Enumeration

1. From each probability table, select the entries whose rows are consistent with the evidence. That is, if we have two variables `A` and `B` in the evidence, and both take values `a` and `b` respectively, then select all rows for which variables `A` and `B` have values `a` and `b` respectively.
2. For all the hidden variables, sum out their values. This means compute the sum of probabilities for all combinations of hidden variables values. This operation is called **marginalization**.
$$P(Q, e_1 \dots e_n) = \sum_{h_1 \dots h_r} P(Q, h_1 \dots h_r, e_1 \dots e_k)$$
3. Normalize the the the values left so that their sum is 1 and they form a valid distribution.

$$ Z = \sum_q P(Q, e_1 \dots e_k) \space \space , \space \space P(Q | e_1 \dots e_k) = \frac{1}{Z} P(Q | e_1 \dots e_k)$$
