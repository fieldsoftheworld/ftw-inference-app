import { ref } from 'vue'

// Incrementing counter (rather than a boolean) so a watcher fires every time
// focus is requested, even if the previous request never got reset.
const focusRequestId = ref(0)

export default function useLocationSearchFocus() {
  const requestLocationSearchFocus = () => {
    focusRequestId.value++
  }

  return {
    focusRequestId,
    requestLocationSearchFocus,
  }
}
