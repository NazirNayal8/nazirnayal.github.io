---
title: "Invent Analytics"
excerpt: "Software Engineering Intern"
collection: experience
type: "Software Engineering intern"
permalink: /experience/invent_analytics
date: 2020-07-09
location: "Istanbul, Turkey"
---

## Location

Istanbul, Turkey

## Duration

From July 2020 to September 2020

## About the Company

Invent Analytics is a company specialized in providing analytics solutions to retailers
by using different machine learning and data science techniques. Their main activities include
inventory management and sales forecasting.

## My Role

Throughout the internship period, I developed a machine learning pipeline using the Walmart sales data provided in
the famous [M5 Forecasting Challenge](https://www.kaggle.com/c/m5-forecasting-accuracy).

After conducting a thorough study about the top solution that scored the highest in the challenge, I worked on devising a model which
utilizes different interesting ideas and observations from different solutions. Then, I started spent the rest of the time implementing, testing,
and refining the model's performance by tuning different parameters and doing further feature engineering.

## Skills Learned

* Handling time series data.
* Feature Engineering and Extraction.
* Building full Machine Learning pipelines.
* Estimating the distribution of the data to decide on how to model it.
* Usage of Gradient Boosting algorithms such as XGBoost and Light GBM.
* Hyperparameter optimization.
* Creating and evaluating Machine Learning ensemble models.
* Improved my python skills.

## Challenges Faced

There were two tasks that I spent the most time on and where challenging to handle.

### 1. Choosing features

There was a wide range of features that could be extracted and appended to the
training data, such as lags and rolling features, but these features had different impacts and effect levels on the model.
Also, having many features would significantly slow down the training process, so I had to choose the least but most effective ones.
Therefore, I had to keep trying different values and different techniques to decide on the best feature set, which was
more time consuming than I expected.

### 2. Hyperparameter optimization

Deciding on the parameters for gradient boosting algorithms was the most difficult part. There were numerous important parameters
to manipulate. I attempted using some packages that can help in optimizing the parameters instead of doing a brute force search.
I tried using [hyperopt](https://github.com/hyperopt/hyperopt) package in python, which uses Bayesian optimization algorithms to find the best set of parameters.
The library was not as fast as required but it was better than the other options I have attempted.
