---
layout: page
title: Projects
permalink: /projects/
description: Research and software projects I have enjoyed working on.
nav: true
nav_order: 2
display_categories: [research, university, side-hustle]
motif: plan
---

<!-- pages/projects.md: one numbered timeline, grouped by category and ordered by importance. -->
<div class="projects project-sequence">
{% assign step = 0 %}
{% for category in page.display_categories %}
{% assign categorized_projects = site.projects | where: "category", category %}
{% if categorized_projects.size == 0 %}{% continue %}{% endif %}
{% assign sorted_projects = categorized_projects | sort: "importance" %}
<section class="project-group" aria-labelledby="projects-{{ category }}">
<h2 class="category" id="projects-{{ category }}">{{ category | replace: '-', ' ' | capitalize }}</h2>
<ol class="project-timeline" data-project-timeline start="{{ step | plus: 1 }}">
{% for project in sorted_projects %}
{% assign step = step | plus: 1 %}
{% include project_step.liquid project=project step=step %}
{% endfor %}
</ol>
</section>
{% endfor %}
</div>
