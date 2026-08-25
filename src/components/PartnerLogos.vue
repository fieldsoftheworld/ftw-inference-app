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
  /* The Contribute FAB owns the corner itself (right: 1rem, 56px across), so the
     logos sit to its left, centred on the same line. */
  --fab-size: 3.5rem;
  --fab-inset: 1rem;

  position: absolute;
  right: calc(var(--fab-inset) + var(--fab-size) + 1.5rem);
  bottom: calc(var(--fab-inset) + (var(--fab-size) - 2rem) / 2);
  /* Below the .sidebar panels (z-index: 1000) on purpose: this is passive
     attribution, so the results panel and data cabinet must cover it rather
     than the other way round. On a tie the later DOM node would win, and
     PartnerLogos mounts after MapComponent. */
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  pointer-events: none;
  user-select: none;
  opacity: 0.72;
  transition: opacity 0.2s ease;
}

/* Descendant links keep pointer-events, so hovering either mark still matches. */
.partner-logos:hover {
  opacity: 0.95;
}

.partner-logos a {
  pointer-events: auto;
  display: flex;
  align-items: center;
}

.partner-logos img {
  display: block;
  width: auto;
}

/* Co-branding rule, per the TG brand guide: a hairline in the logo colour. */
.partner-logos .rule {
  width: 1px;
  height: 1.75rem;
  background-color: rgba(244, 244, 235, 0.45);
}

.partner-logos .tg {
  height: 2rem;
}

.partner-logos .aws {
  height: 1.75rem;
}

/* Too narrow to sit beside the FAB without crowding the feedback card, so stack
   above it instead. */
@media (width <= 900px) {
  .partner-logos {
    gap: 0.5rem;
    right: var(--fab-inset);
    bottom: calc(var(--fab-inset) + var(--fab-size) + 0.5rem);
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
