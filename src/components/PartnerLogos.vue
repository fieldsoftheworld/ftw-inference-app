<script setup lang="ts">
import awsLogo from '../assets/logos/powered-by-aws-white.png'
import tgLogo from '../assets/logos/taylor-geo-logo-ivory-rgb.svg'
</script>

<template>
  <div class="partner-logos">
    <a
      href="https://taylorgeospatial.org/"
      target="_blank"
      rel="noopener"
      aria-label="Taylor Geospatial Institute"
    >
      <img :src="tgLogo" alt="Taylor Geospatial Institute" class="tg" draggable="false" />
    </a>
    <span class="rule" aria-hidden="true"></span>
    <a href="https://aws.amazon.com/" target="_blank" rel="noopener" aria-label="Powered by AWS">
      <img :src="awsLogo" alt="Powered by AWS" class="aws" draggable="false" />
    </a>
  </div>
</template>

<style scoped>
/* Attribution overlay in the bottom-right map corner. No card or plate: just the
   two marks over the map. */
.partner-logos {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  pointer-events: none;
  user-select: none;
}

/* Both marks are ivory/white, so they wash out over bright imagery (desert, bare
   soil). A feathered vignette keeps them legible without adding a visible edge —
   it disappears over the dark basemap and only shows up where it is needed. */
.partner-logos::before {
  content: '';
  position: absolute;
  inset: -0.35rem -0.85rem;
  z-index: -1;
  background-color: rgba(0, 0, 0, 0.55);
  border-radius: 999px;
  /* Blurring the shape itself feathers every edge, so the scrim has no visible
     boundary the way a gradient-filled box would. */
  filter: blur(12px);
}

.partner-logos a {
  pointer-events: auto;
  display: flex;
  align-items: center;
  opacity: 0.92;
  transition: opacity 0.2s ease;
}

.partner-logos a:hover {
  opacity: 1;
}

.partner-logos img {
  display: block;
  width: auto;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.85)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9));
}

/* Co-branding rule, per the TG brand guide: a hairline in the logo colour. */
.partner-logos .rule {
  width: 1px;
  height: 1.75rem;
  background-color: rgba(244, 244, 235, 0.5);
}

.partner-logos .tg {
  height: 2rem;
}

.partner-logos .aws {
  height: 1.75rem;
}

@media (width <= 900px) {
  .partner-logos {
    gap: 0.5rem;
    right: 0.5rem;
    bottom: 0.5rem;
  }

  .partner-logos .rule {
    height: 1.25rem;
  }

  .partner-logos .tg {
    height: 1.5rem;
  }

  .partner-logos .aws {
    height: 1.25rem;
  }
}
</style>
