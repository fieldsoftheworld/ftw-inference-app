import PointerInteraction from 'ol/interaction/Pointer'

class Drag extends PointerInteraction {
  constructor() {
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

  return feature.getProperties()?.properties?.name === 'drawVectorLayer'
}

/**
 * @param {import('ol/MapBrowserEvent.js').default} evt Map browser event.
 */
function handleDragEvent(evt) {
  if (!this.coordinate_) return

  const deltaX = evt.coordinate[0] - this.coordinate_[0]
  const deltaY = evt.coordinate[1] - this.coordinate_[1]

  const geometry = this.feature_ && this.feature_.getGeometry()
  geometry?.translate(deltaX, deltaY)

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

export default Drag
