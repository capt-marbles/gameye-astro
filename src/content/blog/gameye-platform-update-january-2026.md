---
title: "Gameye Platform Update: January 2026"
excerpt: "Admin Panel v2.5.0 and orchestrator improvements focused on stability, throughput, and day-to-day operator experience."
publishDate: 2026-02-17T18:22:09.000Z
updatedDate: 2026-02-17T18:39:54.000Z
author: "Gameye Team"
category: "Product Updates"
tags:
  - "platform"
  - "orchestrator"
  - "admin-panel"
coverImage: "https://gameye.com/wp-content/uploads/2026/02/image-8.png"
coverImageAlt: "Gameye platform update"
legacyUrl: "https://gameye.com/blog/gameye-platform-update-january-2026/"
featured: true
---

We are sharing our latest platform improvements across the Admin Panel and orchestrator runtime. This release targets reliability under load while improving day-to-day operational visibility.

## Admin Panel (v2.5.0)

The admin panel received a full navigation and usability refresh with:

- A new dashboard for application-level visibility.
- Streamlined application configuration and management views.
- Direct container control from the panel (start and stop).
- Container history tracking for operational context.
- Manual Docker webhook triggers for release workflows.
- Better visibility across nodes, pools, images, and tags.

## Orchestrator Enhancements

This release resolves critical networking and session placement issues while increasing throughput:

- Fixed host-network port conflict handling. Session-start requests now fail gracefully when collisions occur.
- Improved throughput under high session churn.
- Increased overall orchestrator stability.
- Updated placement strategy to prioritize bare-metal capacity before cloud capacity.

## What This Means for Teams

- Fewer avoidable deployment failures.
- Better multiplayer performance at peak concurrency.
- Faster operator workflows for live fleet control.
- Stronger infrastructure observability during incidents.

## Technical Direction

These updates continue the core approach behind the platform:

- Orchestrate sessions through a straightforward API workflow.
- Avoid building and maintaining a custom orchestration layer.
- Improve redundancy with multi-provider region strategy and failover.

One API call, one session, with stronger control around it.
