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
/* Partner marks sit on the right; the smaller cloud credit sits on the left. */
.partner-logos {
  position: absolute;
  inset: 0;
  /* Below the .sidebar panels (z-index: 1000) on purpose: this is passive
     attribution, so the results panel and data cabinet must cover it rather
     than the other way round. On a tie the later DOM node would win, and
     PartnerLogos mounts after MapComponent. */
  z-index: 999;
  pointer-events: none;
  user-select: none;
}

.partner-row {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.cloud-credit {
  position: absolute;
  /* Beside the map attribution button. */
  left: 3rem;
  bottom: 4.25rem;
}

.partner-logos a {
  pointer-events: auto;
  display: flex;
  align-items: center;
}

.partner-logos a:focus-visible {
  outline: 2px solid #008888;
  outline-offset: 4px;
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

/* Compact marks leave room for the feedback card at narrower widths. */
@media (width <= 1400px) {
  .partner-row {
    gap: 0.5rem;
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
  .cloud-credit {
    opacity: 0.8;
  }

  .cloud-credit:hover,
  .cloud-credit:focus-visible {
    opacity: 1;
  }

  .partner-row {
    bottom: 2rem;
    gap: 0.375rem;
  }

  .partner-logos .tg {
    height: 1.125rem;
  }

  .partner-logos .microsoft {
    height: 0.875rem;
  }
}
</style>
