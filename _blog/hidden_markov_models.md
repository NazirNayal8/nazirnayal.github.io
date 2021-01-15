title: 'Hidden Markov Models'
date: 2020-12-23
permalink: /blog/tutorials/hidden_markov_models
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

# Markov Models

A Bayesian Network that takes the shape of a time series, where every node represents a state at time $t$.

$$P(X_t \| X_{t-1})$$

Equation $(1)$ represents the **transition probabilities**, and they are assumed to be stationary at all times.

Thus, the two main components needed to define a Markov Model are:
* Transition Probabilities $P(X_t \| X_{t - 1})$
* Initial State Probabilities $P(X_1)$

<p align="center">
<img width="570" height="170" src="/images/hmm/markov_model.png">
</p>

# Conditional Independence Implications of Markov Models

* Past and Future are independent given the present.
* Each time step only depends on the previous. (First Order Markov Property)

# Joint Distribution of Markov Models

$$P(X_1, X_2, \dots, X_T) = P(X_1)\prod_{t=2}^T P(X_t \| X_{t - 1})$$

# Mini-Forward Algorithm

Used to calculate the probability of a certain state at time $t$.

  $$P(x_t) = \sum_{x_{t-1}} P(x_t \| x_{t-1}) P(x_{t-1})$$


# Stationary Distributions

When calculating the distribution of a state at a time close to infinity, we will notice that the probabilities converge to a fixed value over time regardless of the initial distribution we started with, which means that the distribution at a later enough time becomes independent from the initial distribution.

$$ P_{\infin(X)}  = P_{\infin + 1}(X) = \sum_x P(X \| x) P_{\infin}(x)$$

We can use the equation above to solve for the stationary distribution. The variables are the probabilities of every possible value of the random variable at time infinity. So if a random variable can take 2 values, we have a system of 2 equations to solve. We can also benefit from the fact that the probabilities of the values sum to 1.


# Hidden Markov Models (HMM)

In this version of Markov Models, we do not see the distribution directly at every time step, but we observe outputs (effects) at every time step, and we attempt to use these outputs to infer the underlying distribution. In other words, we have additional variables that represent observations that are related to the original variables that we are interested in.

An HMM is defined by:
* Initial Distribution $P(X_1)$
* Transitions: $P(X_t \| X_{t-1})$
* Emissions: $P(E_t \| X_t)$


# Conditional Independence Implications of HMMs

* Markov Hidden Process: Future depends on past via present
* Current observation is independent of all else given current state

# Filtering Problem

This problem is about determining the value of a state given all previous states and all previous evidence. This problem is hard to solve exactly due to large number of variables involved. Therefore we attempt approximate solutions.

It can be formally defined as the tracking of $B_t(X) = P(X_t \| e_1, \dots, e_t)$, which represents our belief of the variable at time $t$.

$B(X))$ can be updated either when **time passes**, or when we **get new evidence**.

$$P(E_t \| X_1, \dots, X_t, \dots, X_T, E_1, \dots, E_T) = P(E_t \| X_t)$$

# Inference Base Cases

<p align="center">
<img width="700" height="300" src="/images/hmm/hmm_base_cases.png">
</p>

Each of these base cases corresponds to a way through which we can update out beliefs. We either update our belief based on time passage and its effects on the distribution, or through observing an evidence variable.

# Updating Belief Based on Time Passage

We know $x_1$, and we want to use it to update our belief of $x_2$.

$$
\begin{aligned}
P(x_2) & = \sum_{x_1} P(x_1, x_2) \\
 &=  \sum_{x_1} P(x_1) P(x_2 \| x_1)
\end{aligned}
$$

Notice that in the previous equation we suddenly incorporated $x_1$ and summed over its values. This is valid because summing over all values of $x_1$ will have no effect if it is not incorporated in $P(x_1, x_2)$. This helps because we already know information about $x_1$ which we can use to update our belief of $x_2$.

Assume our current belief of $X_t$ is given as follows (we know its values):

$$B(X_t) = P(X_t \| e_{1:t})$$

After one time step, we want to know (we introduce $x_t$ like we did previously because we have a belief about it which w e can use):

 $$
\begin{aligned}
 P(X_{t + 1} \| e_{1:t}) & = \sum_{x_t} P(X_{t + 1}, x_t \| e_{1:t}) \\
 & = \sum_{x_t} P(X_{t + 1} \| x_t, e_{1:t}) P(x_t \| e_{1:t}) \space \space (we \space know  \space P(x_t \| e_{1:t})) \\
 & = \sum_{x_t} P(X_{t + 1} \| x_t) P(x_t \| e_{1:t}) \space \space (independence \space of \space evidence \space given \space parent)
\end{aligned}
 $$

 We can write these equations compactly as follows:

 $$B(X_{t + 1}) = \sum_{x_t}P(X_{t + 1} \| x_t) B(x_t)$$

 **Interpretation**: To update Belief about a variable, for ever possible value of its parent, we multiply the probability of the current variable occurring given the value of its parent with the belief we have about that value of the parent.

 As time passes, uncertainty accumulates.

# Updating Belief Based on Observation

In this formulation, we have $P(x_1)$, and an evidence $P(E \| X)$. We would like to update our belief given the evidence $P(X_1 \| e_1)$:

$$
\begin{aligned}
P(x_1 \| e_1) & =  \frac{P(x_1, e_1)}{P(e_1)} \\
& \propto P(x_1, e_1) \\
& = P(x_1) P(e_1 \| x_1)
\end{aligned}
$$

Assume we have a current belief $P(X \| previous \space evidence)$:

$$ B'(X_{t + 1}) = P(X_{t + 1} \| e_{1:t})$$

Now given the evidence of $X_{t + 1}$, we want to update the belief:

$$
\begin{aligned}
P(X_{t + 1} \| e_{1:t + 1}) & = \frac{P(X_{t + 1}, e_{t + 1} \| e_{1:t})}{P(e_{t + 1} \| e_{1:t})} \\
& \propto P(X_{t + 1}, e_{t + 1} \| e_{1:t}) \\
& = P(e_{t + 1} \| e_{1:t}, X_{t + 1}) P(X_{t + 1} \| e_{1:t}) \\
& = P(e_{t + 1} \| X_{t + 1}) P(X_{t + 1} \| e_{1:t})
\end{aligned}
$$

This can be written compactly as:

$$B(X_{t + 1}) \propto P(e_{t + 1} \| X_{t + 1}) B'(X_{t + 1})$$

# The Forward Algorithm

Incorporate both belief and evidence in the update.

$$P(x_t \| e_{1:t}) \propto P(e_t \|x_t) \sum_{x_{t-1}} P(x_t \|x_{t-1}) P(x_{t - 1}, e_{1:t-1})$$

# Online Belief Updates

For Every time step, start with current $P(X \| evidence)$

* Update for time:

$$P(x_t \| e_{1:t-1}) = \sum_{x_{t-1}} P(x_{t-1} \|e_{1:t-1}) P(x_t \| x_{t - 1})$$

* Update for evidence:

$$P(x_t \| e_{1:t}) \propto P(x_t \| e_{1:t-1}) P(e_t \| x_t)$$


# Particle Filtering

In this approach we track samples of a variables $X$ instead of all its values. The samples are called Particles. Time per step is linear in the number of samples. The number of samples needed may be large. For every step, we use the current samples to generate new samples. In memory they are stored as a list of samples. This is how robot localization works.

In this scheme, each variable is moved (to its next state) by sampling its next position from the transition probability model.

$$x' = sample(P(X' \| x))$$

We do this for every sample. This represents an update based on time passage.

**How do we update based on evidence ?**: two Steps

* Weight: We use a logic similar to Likelihood Weighting, where we keep elements that match the evidence with high weights and shrink the elements who have low probability given the evidence.
* Resample: After assigning weights to samples based on their matching of the evidence, we resample from the previous samples based on the weight of each. This would increase the multiplicity of samples with high weights and neglect samples with very low contributions.

# State Trellis

A graph of states and transitions over time. Every state is a node, and every transition is edge with a value equal to the probability of the transition. Each path on this graph represents a sequence of states. The product of the weights on a path is the sequence's probability along with the evidence.

# Viterbi Algorithm

Finds the most probable next state.

$$
\begin{aligned}
M_t(x_t) & = \max_{x_{1:t}} P(x_{1:t-1}, x_t, e_{1:t}) \\
& = P(e_t \| x_t) \max_{x_{t-1}} P(x_t \| x_{t-1}) M_{t-1}(x_{t-1})
\end{aligned}
$$

where $M_t(x_t)$ is probability of the most likely transition to the current state. Same as Forward algorithm but here we take max instead of sum.
