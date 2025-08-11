# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an interactive digital divide storymap project for Bhimdhunga, Nagarjun that visualizes household-level digital access stories through an interactive map interface. The project effectively contrasts official digital divide statistics with lived experiences of residents, highlighting the gap between quantitative data and qualitative realities of digital access.

## Architecture

**Core Components:**
- `index.html` - Main HTML structure with splash screens, map container, and modal popup
- `script.js` - Leaflet.js map implementation with house data, geographic boundaries, and interactive markers
- `style.css` - Complete styling with responsive design, animations, and modal styling
- `ALIN_logo.jpg` - Logo for the All In Foundation splash screen

**Key Features:**
- Cinematic introduction sequence (splash screen → national statistics → geographic zoom-in)
- Interactive map using Leaflet.js with house markers categorized by digital access levels
- Modal popups containing multimedia stories, statistics, and personal testimonials
- Geographic boundary loading for Nepal, Bagmati Province, and Nagarjun Municipality
- Responsive design optimized for mobile devices

## Data Structure

5 household stories representing different digital access levels (high/medium/low) with:
- Geographic coordinates and access classifications
- Personal quotes, testimonials, and reality descriptions  
- Statistical data (internet speed, devices, costs, skills, services)
- Media references (videos from sample-videos.com, local audio files in audio/ directory)

## Development Commands

This is a static HTML/CSS/JavaScript project with no build process. To develop:
- Open `index.html` directly in a browser
- Use a local HTTP server for testing (e.g., `python -m http.server` or live server extensions)

## File Dependencies

- Leaflet.js CSS/JS loaded from CDN (unpkg.com)
- Media files referenced in house data (videos from sample-videos.com, local audio files in audio/ directory)
- No package.json or build tools required

## Styling System

CSS uses:
- CSS Grid for responsive layouts
- CSS animations and transitions
- CSS custom properties for consistent theming
- Mobile-first responsive design with breakpoints at 768px and 480px
- Color-coded access levels (green=high, yellow=medium, red=low)