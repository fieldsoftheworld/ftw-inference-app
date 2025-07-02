import PointerInteraction from 'ol/interaction/Pointer'
import { containsCoordinate } from 'ol/extent'
import { getArea } from 'ol/sphere'

class Drag extends PointerInteraction {
  constructor(areaValues = null, currentGridExtent = null) {
    super({
      handleDownEvent: handleDownEvent,
      handleDragEvent: handleDragEvent,
      handleMoveEvent: handleMoveEvent,
      handleUpEvent: handleUpEvent,
    })

    /**
     * @type {import('ol/coordinate.js').Coordinate}
     * @private
     */
    this.coordinate_ = null

    /**
     * @type {string|undefined}
     * @private
     */
    this.cursor_ = 'pointer'

    /**
     * @type {Feature}
     * @private
     */
    this.feature_ = null

    /**
     * @type {string|undefined}
     * @private
     */
    this.previousCursor_ = undefined

    /**
     * @type {Object|null}
     * @private
     */
    this.areaValues_ = areaValues

    /**
     * @type {import('ol/extent').Extent|null}
     * @private
     */
    this.currentGridExtent_ = currentGridExtent

    /**
     * @type {import('ol/Feature').default|null}
     * @private
     */
    this.lastValidFeature_ = null

    /**
     * @type {boolean}
     * @private
     */
    this.isInvalid_ = false

    /**
     * @type {number|null}
     * @private
     */
    this.invalidTimeout_ = null
  }

  /**
   * Update the area values and grid extent for validation
   * @param {Object} areaValues - The area constraints
   * @param {import('ol/extent').Extent} currentGridExtent - The current grid extent
   */
  updateValidationParams(areaValues, currentGridExtent) {
    this.areaValues_ = areaValues
    this.currentGridExtent_ = currentGridExtent
  }

  /**
   * Store the last valid feature state
   * @param {import('ol/Feature').default} feature - The valid feature to store
   */
  setLastValidFeature(feature) {
    this.lastValidFeature_ = feature.clone()
  }

  /**
   * Set the invalid state to trigger visual feedback
   */
  setInvalidState() {
    this.isInvalid_ = true

    // Clear any existing timeout
    if (this.invalidTimeout_) {
      clearTimeout(this.invalidTimeout_)
    }

    // Trigger style refresh for the layer
    this.triggerStyleRefresh()

    // Clear invalid state after 2 seconds
    this.invalidTimeout_ = setTimeout(() => {
      this.clearInvalidState()
    }, 2000)
  }

  /**
   * Clear the invalid state
   */
  clearInvalidState() {
    this.isInvalid_ = false
    if (this.invalidTimeout_) {
      clearTimeout(this.invalidTimeout_)
      this.invalidTimeout_ = null
    }

    // Trigger style refresh for the layer
    this.triggerStyleRefresh()
  }

  /**
   * Check if the feature is currently in invalid state
   * @return {boolean} True if invalid, false otherwise
   */
  isInvalid() {
    return this.isInvalid_
  }

  /**
   * Trigger a style refresh for the layer
   */
  triggerStyleRefresh() {
    if (this.feature_) {
      // Trigger a change event to refresh the style
      this.feature_.changed()
    }
  }
}

/**
 * @param {import('ol/MapBrowserEvent.js').default} evt Map browser event.
 * @return {boolean} `true` to start the drag sequence.
 */
function handleDownEvent(evt) {
  const map = evt.map

  const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    return feature
  })

  if (feature && feature.getProperties()?.properties?.name === 'drawVectorLayer') {
    this.coordinate_ = evt.coordinate
    this.feature_ = feature
  }

  return feature?.getProperties()?.properties?.name === 'drawVectorLayer'
}

/**
 * @param {import('ol/MapBrowserEvent.js').default} evt Map browser event.
 */
function handleDragEvent(evt) {
  if (!this.coordinate_) return

  const deltaX = evt.coordinate[0] - this.coordinate_[0]
  const deltaY = evt.coordinate[1] - this.coordinate_[1]

  const geometry = this.feature_ && this.feature_.getGeometry()
  if (!geometry) return

  // Store the original position before translation
  const originalCoordinates = geometry.getCoordinates()

  // Apply the translation
  geometry.translate(deltaX, deltaY)

  // Validate the new position
  const isValid = validateBoundingBox(this.feature_, this.areaValues_, this.currentGridExtent_)

  if (!isValid) {
    // Revert to the original position if invalid
    geometry.setCoordinates(originalCoordinates)

    // Set invalid state and trigger visual feedback
    this.setInvalidState()

    // Show warning message
    if (typeof window !== 'undefined' && window.showSnackbar) {
      window.showSnackbar({
        type: 'warning',
        text: 'Cannot drag bounding box outside the selected grid area.',
        duration: 3000,
      })
    }
  } else {
    // Clear invalid state if the new position is valid
    this.clearInvalidState()

    // Update the last valid feature if the new position is valid
    this.lastValidFeature_ = this.feature_.clone()
  }

  this.coordinate_[0] = evt.coordinate[0]
  this.coordinate_[1] = evt.coordinate[1]
}

/**
 * @param {import('ol/MapBrowserEvent.js').default} evt Event.
 */
function handleMoveEvent(evt) {
  if (this.cursor_) {
    const map = evt.map
    const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
      return feature
    })
    const element = evt.map.getTargetElement()
    if (feature) {
      if (element.style.cursor != this.cursor_) {
        this.previousCursor_ = element.style.cursor
        element.style.cursor = this.cursor_
      }
    } else if (this.previousCursor_ !== undefined) {
      element.style.cursor = this.previousCursor_
      this.previousCursor_ = undefined
    }
  }
}

/**
 * @return {boolean} `false` to stop the drag sequence.
 */
function handleUpEvent() {
  this.coordinate_ = null
  this.feature_ = null
  return false
}

/**
 * Validate if a bounding box feature is within constraints
 * @param {import('ol/Feature').default} feature - The feature to validate
 * @param {Object} areaValues - Area constraints
 * @param {import('ol/extent').Extent} currentGridExtent - The grid extent
 * @return {boolean} True if valid, false otherwise
 */
function validateBoundingBox(feature, areaValues, currentGridExtent) {
  if (!feature || !currentGridExtent) return true

  const geometry = feature.getGeometry()
  if (!geometry) return true

  // Check if all coordinates are within the grid extent
  const coordinates = geometry.getCoordinates()[0]
  const isWithinExtent = coordinates.every((coord) => containsCoordinate(currentGridExtent, coord))

  if (!isWithinExtent) {
    return false
  }

  // Check area constraints if areaValues are provided
  if (areaValues) {
    const area = getArea(geometry, { projection: 'EPSG:3857' }) / 1000000 // Convert to square kilometers

    if (area > areaValues.max_area_km2 || area < areaValues.min_area_km2) {
      return false
    }
  }

  return true
}

export default Drag
