---
layout: archive
title: "Projects"
permalink: /projects/
author_profile: true
---

{% include base_path %a}

{% for post in site.projects %}
  {% include archive-single.html %}
{% endfor %}