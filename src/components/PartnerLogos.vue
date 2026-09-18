<script setup lang="ts">
import awsLogo from '../assets/logos/powered-by-aws-white.png'
import microsoftLogo from '../assets/logos/ai4g_dark.svg'
import tgLogo from '../assets/logos/taylor-geo-logo-ivory-rgb.svg'
</script>

<template>
  <div class="partner-logos">
    <div class="partner-row">
      <a
        href="https://taylorgeospatial.org/"
        target="_blank"
        rel="noopener"
        aria-label="Taylor Geospatial"
      >
        <img :src="tgLogo" alt="Taylor Geospatial" class="tg" draggable="false" />
      </a>
      <span class="rule" aria-hidden="true"></span>
      <a
        href="https://www.microsoft.com/en-us/research/group/ai-for-good-research-lab/"
        target="_blank"
        rel="noopener"
        aria-label="Microsoft AI for Good Lab"
      >
        <img
          :src="microsoftLogo"
          alt="Microsoft AI for Good Lab"
          class="microsoft"
          draggable="false"
        />
      </a>
    </div>
    <a
      href="https://aws.amazon.com/"
      target="_blank"
      rel="noopener"
      aria-label="Powered by AWS"
      class="cloud-credit"
    >
      <img :src="awsLogo" alt="Powered by AWS" class="aws" draggable="false" />
    </a>
  </div>
</template>

<style scoped>
/* Transparent partner marks sit above a separate, smaller cloud credit. */
.partner-logos {
  /* Leave room for the Contribute FAB on wide screens. */
  --fab-size: 3.5rem;
  --fab-inset: 1rem;

  position: absolute;
  right: calc(var(--fab-inset) + var(--fab-size) + 1rem);
  bottom: var(--fab-inset);
  /* Below the .sidebar panels (z-index: 1000) on purpose: this is passive
     attribution, so the results panel and data cabinet must cover it rather
     than the other way round. On a tie the later DOM node would win, and
     PartnerLogos mounts after MapComponent. */
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  pointer-events: none;
  user-select: none;
}

.partner-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
}

.partner-logos a {
  pointer-events: auto;
  display: flex;
  align-items: center;
  transition: opacity 0.2s ease;
}

.partner-logos a:focus-visible {
  outline: 2px solid #008888;
  outline-offset: 4px;
}

.partner-logos .cloud-credit {
  opacity: 0.55;
}

.partner-logos .cloud-credit:hover,
.partner-logos .cloud-credit:focus-visible {
  opacity: 1;
}

.partner-logos img {
  display: block;
  width: auto;
}

/* Co-branding rule, per the TG brand guide: a hairline in the logo colour. */
.partner-logos .rule {
  width: 1px;
  height: 1.5rem;
  background-color: #f4f4eb;
}

.partner-logos .tg {
  height: 1.75rem;
}

.partner-logos .microsoft {
  height: 1.25rem;
}

.partner-logos .aws {
  height: 0.875rem;
}

/* Too narrow to sit beside the FAB without crowding the feedback card, so the
   logos take the corner and the FAB moves up (see .contribute-fab). */
@media (width <= 1280px) {
  .partner-logos {
    right: var(--fab-inset);
  }

  .partner-row {
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
  }

  .partner-logos .rule {
    height: 1.25rem;
  }

  .partner-logos .tg {
    height: 1.375rem;
  }

  .partner-logos .microsoft {
    height: 1rem;
  }

  .partner-logos .aws {
    height: 0.75rem;
  }
}

@media (width <= 600px) {
  .partner-row {
    gap: 0.375rem;
    padding: 0.5rem;
  }

  .partner-logos .tg {
    height: 1.125rem;
  }

  .partner-logos .microsoft {
    height: 0.875rem;
  }
}
</style>
