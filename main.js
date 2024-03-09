import KML from 'ol/format/KML.js'
import { Heatmap as HeatmapLayer, Layer, Tile as TileLayer } from 'ol/layer.js'
import { getCenter, getWidth } from 'ol/extent.js'
// import earthquakeData from './data/OtherCSV/emdat_earthquake.csv'
import emdat_data from './data/emdat_data.csv'
import './style.css'
import { Map, View, Overlay } from 'ol'
import Feature from 'ol/Feature.js'
//import OSM from 'ol/source/OSM';

import VectorLayer from 'ol/layer/Vector.js'
import MultiPoint from 'ol/geom/MultiPoint.js'

import GeoJSON from 'ol/format/GeoJSON'
import { Circle, GeometryCollection, Point, Polygon } from 'ol/geom.js'
import { OSM, Vector as VectorSource } from 'ol/source.js'
import { fromLonLat, toLonLat, get } from 'ol/proj.js'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js'

import $ from 'jquery'

///Global Constants
const VISUAL_TYPE_CIRCLES = 0
const VISUAL_TYPE_HEAT_MAP = 1
let visualTypeOptions = [VISUAL_TYPE_CIRCLES, VISUAL_TYPE_HEAT_MAP]
let visualTypeOptionsNames = ['Circles', 'Heat Map']
let visualTypeArray = [
  VISUAL_TYPE_CIRCLES,
  VISUAL_TYPE_CIRCLES,
  VISUAL_TYPE_CIRCLES,
  VISUAL_TYPE_CIRCLES
]

let csvData = emdat_data
let csvDataSource = emdat_data //todo propagate

let features = getFeatures(csvData)
refreshDropdowns(csvData)

class CanvasLayer extends Layer {
  constructor (options, dim) {
    super(options)

    this.features = options.features
    this.dim = options.dim

    this.svg = d3
      .select(document.createElement('div'))
      .append('svg')
      .style('position', 'absolute')

    //this.svg.append('path').datum(this.features).attr('class', 'boundary');
  }
}

const styles = [
  /* We are using two different styles for the polygons:
   *  - The first style is for the polygons themselves.
   *  - The second style is to draw the vertices of the polygons.
   *    In a custom `geometry` function the vertices of a polygon are
   *    returned as `MultiPoint` geometry, which will be used to render
   *    the style.
   */
  new Style({
    stroke: new Stroke({
      color: 'blue',
      width: 3
    }),
    fill: new Fill({
      color: 'rgba(0, 0, 255, 0.1)'
    })
  }),
  new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({
        color: 'orange'
      })
    }),
    geometry: function (feature) {
      // return the coordinates of the first ring of the polygon
      const coordinates = feature.getGeometry().getCoordinates()[0]
      return new MultiPoint(coordinates)
    }
  })
]

const view = new View({
  center: [0, 0],
  zoom: 2
})

function getFeatures (
  quadrantData,
  field,
  visualType = VISUAL_TYPE_CIRCLES,
  disasterVal,
  quadNumber
) {
  //cycle through the JSON data.
  //let projection = map2.getView().getProjection();
  let magnitudes = []
  for (let i = 0; i < quadrantData.length; i++) {
    let data = quadrantData[i]
    if (data['Disaster Type'] != disasterVal) continue

    let fieldData
    if (field == 'Q2/Q3') {
      let q2_field = $('#select' + 2).val()
      let q3_field = $('#select' + 3).val()
      let q2_fieldData;
      let q3_fieldData;
      if (!(data[q2_field] == undefined || data[q3_field] == undefined)) {
        q2_fieldData = data[q2_field].replace(/[^0-9.]/g, '')
        q3_fieldData = data[q3_field].replace(/[^0-9.]/g, '')
      }
      else {
        q2_fieldData = 0
        q3_fieldData = 1
      }

      fieldData = q2_fieldData / q3_fieldData
      if (fieldData == Infinity || fieldData == NaN) {
        fieldData = 0
      }
    } else {
      let selected_field = data.hasOwnProperty(field) ? field : 'Dis Mag Value'

      if (!(data[selected_field] == undefined)) {
        fieldData = data[selected_field].replace(/[^0-9.]/g, '')
      }
      else {
        fieldData = 0;
      }

    }

    let magnitude = Number(fieldData)
    if (isNaN(magnitude)) magnitude = 0
    magnitudes.push(magnitude)
    
  }

  let normalizedMags = []
  let maxMag = Math.max(...magnitudes)
  let minMag = Math.min(...magnitudes)
  console.log("#minVal" + (quadNumber + 1))
  console.log($("#minVal" + (quadNumber + 1)))
  $("#minVal" + (quadNumber + 1)).text(minMag)
  $("#maxVal" + (quadNumber + 1)).text(maxMag)
  magnitudes.forEach(m => {
    let normal = (m - minMag) / (maxMag - minMag)
    normalizedMags.push(normal)
  })

  let features = []
  for (let i = 0; i < quadrantData.length; i++) {
    let data = quadrantData[i]
    // filter data by disaster
    disasterVal = disasterVal ? disasterVal : 'Earthquake'
    if (data['Disaster Type'] != disasterVal) continue

    let longitude = Number(
      data.Longitude.replace(new RegExp('[A-Za-z]', ''), '')
    )
    let magnitude = normalizedMags[i]
    if (isNaN(longitude)) {
      let test = 0
    }
    let latitude = Number(data.Latitude.replace(new RegExp('[A-Za-z]', '')))
    let point = [longitude, latitude]
    //let center = transform(fromLonLat([-122.48, 37.67]))
    let center = [-122.48, 37.67]
    let feature = null
    if (visualType == VISUAL_TYPE_CIRCLES) {
      feature = new Feature({ //point
        geometry: new Circle(
          fromLonLat(point, get('EPSG:3857')),
          (1000000 / 2) * magnitude
        )
      })
      feature.set('data', data)
    } else {
      feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: fromLonLat(point, get('EPSG:3857')),
          data: data
        },
        properties: { magnitude: magnitude }
      }
    }

    features.push(feature)
  }

  return features
}

function createNewVectorLayer (layerFeatures) {
  return new VectorLayer({
    source: new VectorSource({
      features: layerFeatures,
      style: {
        'circle-radius': 30,
        'circle-fill-color': 'red'
      }
    })
  })
}

function createVectorLayerFromSource (vectorSource) {
  return new VectorLayer({
    source: vectorSource,
    style: {
      'stroke-color': '#003180',
      'fill-color': 'rgba(255, 255, 255, 0.6)'
    }
  })
}

function createHeatLayerFromSource (vectorSource) {
  const heatMapLayer = new HeatmapLayer({
    source: vectorSource,
    blur: 15,
    radius: 10,
    weight: function (feature) {
      // 2012_Earthquakes_Mag5.kml stores the magnitude of each earthquake in a
      // standards-violating <magnitude> tag in each Placemark.  We extract it from
      // the Placemark's name instead.
      //const name = feature.get('name');
      const magnitude = feature.values_.magnitude //parseFloat(name.substr(2));
      return magnitude
    }
  })
  return heatMapLayer
}

const vectorLayer1 = new VectorLayer({
  source: new VectorSource({
    features: features,
    style: {
      'circle-radius': 30,
      'circle-fill-color': 'red'
    }
  })
})

const vectorLayer2 = new VectorLayer({
  source: new VectorSource({
    features: features,
    style: {
      'circle-radius': 30,
      'circle-fill-color': 'red'
    }
  })
})

const vectorLayer3 = new VectorLayer({
  source: new VectorSource({
    features: features,
    style: {
      'circle-radius': 30,
      'circle-fill-color': 'red'
    }
  })
})

const vectorLayer4 = new VectorLayer({
  source: new VectorSource({
    features: features,
    style: {
      'circle-radius': 30,
      'circle-fill-color': 'red'
    }
  })
})

let circleRadiiLayerFeatures = []
let heatMapLayerFeatures = []
let heatMapData = {
  type: 'FeatureCollection',
  features: heatMapLayerFeatures
}

let testCoordinates = []
// initializeCircleRadiiQuadrant(1, csvDataSource);
// initializeHeatMapQuadrant(csvDataSource)

function initializeCircleRadiiQuadrant (quadrantNum, quadrantData) {
  //Let's cycle through the JSON data.
  //let projection = map2.getView().getProjection();z
  for (let i = 0; i < quadrantData.length; i++) {
    let data = quadrantData[i]
    let longitude = Number(
      data.Longitude.replace(new RegExp('[A-Za-z]', ''), '')
    )
    let magnitude = Number(data['Dis Mag Value'])
    if (isNaN(longitude)) {
      let test = 0
    }
    let latitude = Number(data.Latitude.replace(new RegExp('[A-Za-z]', '')))
    let point = [longitude, latitude]
    //let center = transform(fromLonLat([-122.48, 37.67]))
    let center = [-122.48, 37.67]
    let feature = new Feature( //point
      //1e6
      {
        geometry: new Circle(
          fromLonLat(point, get('EPSG:3857')),
          10000 * magnitude
        )
      }
    )
    circleRadiiLayerFeatures.push(feature)
  }
}

function initializeHeatMapQuadrant (quadrantData) {
  const e = 4500000
  for (let i = 0; i < quadrantData.length; i++) {
    let data = quadrantData[i]
    let longitude = Number(
      data.Longitude.replace(new RegExp('[A-Za-z]', ''), '')
    )
    let magnitude = Number(data['Dis Mag Value'])
    if (isNaN(longitude)) {
      let test = 0
    }
    let latitude = Number(data.Latitude.replace(new RegExp('[A-Za-z]', '')))
    let point = [longitude, latitude]
    testCoordinates.push(point)
    let center = [-122.48, 37.67]
    let feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: fromLonLat(point, get('EPSG:3857'))
      },
      properties: { magnitude: magnitude }
    }
    heatMapLayerFeatures.push(feature)
  }
}

const image = new CircleStyle({
  radius: 5,
  fill: null,
  stroke: new Stroke({ color: 'red', width: 1 })
})

const circleMagLayer = new VectorLayer({
  source: new VectorSource({
    features: circleRadiiLayerFeatures,
    style: {
      'circle-radius': 30,
      'circle-fill-color': 'red'
    }
  })
})

const heatMapLayer = new HeatmapLayer({
  source: new VectorSource({
    features: new GeoJSON().readFeatures(heatMapData, {
      dataProjection: 'EPSG:3857',
      featureProject: 'EPSG:3857'
    })
  }),
  blur: 15,
  radius: 10,
  weight: function (feature) {
    // 2012_Earthquakes_Mag5.kml stores the magnitude of each earthquake in a
    // standards-violating <magnitude> tag in each Placemark.  We extract it from
    // the Placemark's name instead.
    //const name = feature.get('name');
    const magnitude = feature.values_.magnitude //parseFloat(name.substr(2));
    return magnitude
  }
})

let maps = []
InitializeMaps()
function InitializeMaps () {
  let initialLayers = []
  for (let i = 0; i < 4; i++) {
    let vectorSource = new VectorSource({
      features: features,
      style: {
        'circle-radius': 30,
        'circle-fill-color': 'red'
      }
    })
    initialLayers[i] = createVectorLayerFromSource(vectorSource)
  }
  //let initialLayers = [vectorLayer1, circleMagLayer, heatMapLayer, vectorLayer4];
  initialLayers.forEach(function (layer, index) {
    let map = createNewMap(index + 1, layer)
    maps.push(map)
  })
}

function createNewMap (mapIndex, layer) {
  let map = new Map({
    target: 'map' + mapIndex,
    layers: [new TileLayer({ source: new OSM() }), layer],
    view: view
  })
  return map
}

let dims = Object.entries(csvData[0])
  .filter(([_, y]) => y != '' && !isNaN(y))
  .map(([x, _]) => x)

function getUniqueValues (data, fieldName) {
  let uniqueValues = new Set()
  for (let item of data) {
    uniqueValues.add(item[fieldName])
  }
  return Array.from(uniqueValues)
}

let opts = getUniqueValues(csvData, 'Disaster Type')

// boolean flags for whether each quadrant is map or chart
let mapOrChart = [true, true, true, true]
// function either makes a chart or restores a map for
// quadrant q based on flags in mapOrChart
function makeChart (q) {
  // if quadrant q is a map, draw a chart
  if (mapOrChart[q - 1]) {
    // toggle flag and change button label
    mapOrChart[q - 1] = false
    d3.select('#chart' + q).attr('value', 'Map')

    // select map div
    let sel = d3.select('#map' + q)

    // remove old svg canvas
    sel.selectAll('svg').remove()

    // insert svg canvas as first child of map div
    let svg = sel
      .insert('svg', ':first-child')
      .attr('width', '100%')
      .attr('height', '100%')
      //.attr("style", "border:1px solid black")
      .style('position', 'relative')

    // hide ol-viewport so it doesn't cover menus/buttons
    sel.selectAll('.ol-viewport').style('visibility', 'hidden')

    // store width/height of svg canvas
    let canvasWidth = Number(svg.style('width').slice(0, -2))
    let canvasHeight = Number(svg.style('height').slice(0, -2))

    // function filter empty strings and such from csv data
    function stringFilter (str) {
      return (
        str != null && str !== ' ' && str !== '' && Number.isFinite(Number(str))
      )
    }

    // get data and attribute name for specific quadrant
    let scatterData = getFilteredQuadrantData(csvDataSource, q)
    let chosenField = scatterData[0]

    // initialize min/max x/y values to set up scales
    let minY = Number(scatterData[1][0][chosenField])
    let maxY = Number(scatterData[1][0][chosenField])
    let minX = Number(scatterData[1][0]['Year'])
    let maxX = Number(scatterData[1][0]['Year'])

    // create xy coordinate pairs from scatterData, filtering points without
    // valid attributes, and push into scatterPoints array
    // get min/max x/y values as well
    let scatterPoints = []
    for (let i = 0; i < scatterData[1].length; i++) {
      if (
        !stringFilter(scatterData[1][i][chosenField]) ||
        !stringFilter(scatterData[1][i]['Year'])
      ) {
        continue
      }
      let xVal = Number(scatterData[1][i]['Year'])
      let yVal = Number(scatterData[1][i][chosenField])
      let point = [xVal, yVal]
      scatterPoints.push(point)

      minY = Math.min(minY, yVal)
      maxY = Math.max(maxY, yVal)
      minX = Math.min(minX, xVal)
      maxX = Math.max(maxX, xVal)
    }

    // variables for chart margin/padding
    let xMargin = 30 + 4 * ('' + maxY).length
    let yMargin = 40
    let padding = 10

    // x,y scales to translate disaster data to svg coordinates
    let xScale = d3
      .scaleLinear()
      .domain([minX, maxX])
      .range([xMargin, canvasWidth - padding])
    let yScale = d3
      .scaleLinear()
      .domain([minY, maxY])
      .range([canvasHeight - yMargin, padding])
    // flipped y scale for yAxis
    let yScaleFlipped = d3
      .scaleLinear()
      .domain([minY, maxY])
      .range([padding, canvasHeight - yMargin])

    // color scale
    let colorScale = d3
      .scaleLinear()
      .domain([minY, maxY])
      .range(['blue', 'red'])

    // create x,y axes
    let xAxis = d3
      .axisBottom()
      .scale(xScale)
      .ticks(10)
      .tickFormat(tick => String(tick))
    let yAxis = d3
      .axisLeft()
      .scale(yScale)
      .ticks(10)
      .tickFormat(tick => String(tick))

    // plot points as circles
    svg
      .selectAll('circle')
      .data(scatterPoints)
      .enter()
      .append('circle')
      .attr('r', 4)
      .attr('cx', function (datum) {
        return xScale(datum[0])
      })
      .attr('cy', function (datum) {
        return yScale(datum[1])
      })
      .style('fill', function (datum) {
        return colorScale(datum[1])
      })

    // append x,y axes
    svg
      .append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + (canvasHeight - yMargin) + ')')
      .call(xAxis)
    svg
      .append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(' + xMargin + ',0)')
      .call(yAxis)

    // append x axis label
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', (canvasWidth + xMargin) / 2)
      .attr('y', canvasHeight - 5)
      .text('Year')
  }
  // else, quadrant q is a chart, so restore map
  else {
    // toggle flag and and change button label
    mapOrChart[q - 1] = true
    d3.select('#chart' + q).attr('value', 'Chart')

    // select map div
    let sel = d3.select('#map' + q)

    // restore ol-viewport visibility
    sel.selectAll('.ol-viewport').style('visibility', null)

    // remove svg canvas
    sel.selectAll('svg').remove()
  }
}

// for each quadrant
for (let i = 1; i < 5; i++) {
  // add event handler to each menu
  d3.select('#select' + i).on('change', function (e) {
    dropDownChange(e, i)
  })

  // Q2/Q3 option specific to last quadrant
  if (i == 4) {
    d3.select('#select' + i)
      .append('option')
      .text('Q2/Q3')
  }

  for (let j = 0; j < visualTypeOptions.length; j++) {
    d3.select('#visual-type' + i)
      .on('change', function (e) {
        onVisChange(e)
      })
      .selectAll('option')
      .data(visualTypeOptionsNames)
      .join('option')
      .attr('value', function (d) {
        return j
      })
      .text(function (d) {
        return d
      })
  }

  // add click handler to chart-or-map buttons
  d3.select('#chart' + i).on('click', function (e) {
    makeChart(i)
  })

  // rotate dims
  let firstElement = dims.shift()
  dims.push(firstElement)
}

// wrapper function the run when the vis changes and refresh maps
function onVisChange (event) {
  let quadrantNumber = Number(
    event.target.id.charAt(event.target.id.length - 1)
  )
  visualTypeArray[quadrantNumber - 1] = event.target.selectedIndex
  refreshMaps(
    csvData,
    $('#visual-type' + (event.target.value + 1)).val(),
    quadrantNumber,
    event.target.selectedIndex
  )
}

//drop down change handler
let dropDownChange = (e, i) => {
  refreshMaps(csvData, e.target.value, i, visualTypeArray[i - 1])
}

// File upload handler
$('#fileForm').on('change', e => {
  let files = e.target.files // FileList object
  // use the 1st file from the list
  let f = files[0]
  const reader = new FileReader() // Create a new FileReader object
  let fileContent

  // Define the onload function that will be called when the file is loaded
  reader.onload = function (event) {
    fileContent = event.target.result // Get the file content as a string
    csvData = d3.csvParse(fileContent)
    refreshDropdowns(csvData)
    refreshMaps(csvData)
  }

  reader.readAsText(f)
})

// Create and stylize the tooltip
maps.forEach((map, i) => {
  var tooltip = document.getElementById('tooltip' + i)
  var overlay = new Overlay({
    element: tooltip,
    offset: [10, 0],
    positioning: 'bottom-left'
  })
  map.addOverlay(overlay)

  function displayTooltip (evt) {
    var pixel = evt.pixel
    var feature = map.forEachFeatureAtPixel(pixel, function (feature) {
      return feature
    })
    tooltip.style.display = feature ? '' : 'none'
    if (feature) {
      overlay.setPosition(evt.coordinate)
      tooltip.innerHTML = JSON.stringify(feature.get('data'), null, 2)
    }
  }

  //reader.readAsText(f)
})

//refrash all maps or map i
const refreshMaps = (data, field = null, i = null, visualType) => {
  const refreshMap = (m, mNumber) => {
    let selectedField = field || $('#select' + (mNumber + 1)).val()
    let disaterVal = $('#disaster-select' + (mNumber + 1)).val()
    let features = getFeatures(data, selectedField, visualType, disaterVal, mNumber)
    let mSource = null
    //A vector source for circles

    let l = m.getLayers().getArray()[1]
    //Choose a visual type.  Circles or Heatmap
    if (visualType == VISUAL_TYPE_CIRCLES) {
      mSource = new VectorSource({
        features: features,
        style: {
          'circle-radius': 30,
          'circle-fill-color': 'red'
        }
      })
      m.setLayers([
        new TileLayer({ source: new OSM() }),
        createVectorLayerFromSource(mSource)
      ])
    }
    //A vector source for heat map
    else {
      let heatMapData = {
        type: 'FeatureCollection',
        features: features
      }

      mSource = new VectorSource({
        features: new GeoJSON().readFeatures(heatMapData, {
          dataProjection: 'EPSG:3857',
          featureProject: 'EPSG:3857'
        })
      })
      m.setLayers([
        new TileLayer({ source: new OSM() }),
        createHeatLayerFromSource(mSource)
      ])
    }
  }

  // refresh one map at i or all the maps
  if (!i) {
    maps.forEach((m, mNumber) => {
      refreshMap(m, mNumber)
    })
  } else {
    let m = maps[i - 1]
    refreshMap(m, i - 1)

    // updates scatterplot if drawn in quadrant i
    if (!mapOrChart[i - 1]) {
      mapOrChart[i - 1] = true
      makeChart(i)
    }
  }
}

// general function to refresh the value of the dropdowns when new data is loaded
function refreshDropdowns (data) {
  let dims = new Set()
  for (let i = 1; i < 200; i++) {
    let dims2 = Object.entries(data[i])
      .filter(([_, y]) => y != '' && !isNaN(y))
      .map(([x, _]) => x)
    dims2 = dims2.filter(
      item =>
        !(
          item.includes('Month') ||
          item.includes('Year') ||
          item.includes('Day') ||
          item.includes('Longitude') ||
          item.includes('Latitude')
        )
    )
    dims2.forEach(dim => dims.add(dim))
  }
  dims = Array.from(dims)
  let opts = getUniqueValues(data, 'Disaster Type')

  // for each quadrant
  for (let i = 1; i < 5; i++) {
    let elementID = '#select' + i
    let disasterElementID = '#disaster-select' + i
    // add event handler to each menu
    d3.select(elementID).on('change', function (e) {
      dropDownChange(e, i)
    })

    $(elementID).empty()

    d3.select(disasterElementID).on('change', function (e) {
      dropDownChange({ target: { value: $(elementID).val() } }, i)
    })

    $(disasterElementID).empty()

    // Q2/Q3 option specific to last quadrant
    if (i == 4) {
      d3.select(elementID).append('option').text('Q2/Q3')
    }

    // add an option for each dim to menu
    for (let j = 0; j < dims.length; j++) {
      d3.select(elementID).append('option').text(dims[j])
    }

    for (let j = 0; j < opts.length; j++) {
      d3.select(disasterElementID).append('option').text(opts[j])
    }

    // rotate dims
    let firstElement = dims.shift()
    dims.push(firstElement)

    //select first option
    $(elementID)[0].selectedIndex = 0
    $(disasterElementID)[0].selectedIndex = 0
  }
}

maps.forEach((map, i) => {
  var tooltip = document.getElementById('tooltip' + i)
  var overlay = new Overlay({
    element: tooltip,
    offset: [10, 0],
    positioning: 'bottom-left'
  })
  map.addOverlay(overlay)

  function displayTooltip (evt) {
    var pixel = evt.pixel
    var feature = map.forEachFeatureAtPixel(pixel, function (feature) {
      return feature
    })
    tooltip.style.display = feature ? '' : 'none'
    if (feature) {
      overlay.setPosition(evt.coordinate)
      let [c1, c2] = splitObjectInHalf(clean(feature.get('data')))
      const tooltipContent =
        "<div style='white-space: nowrap'><pre style='display: inline-block; margin: 0; padding: 0; vertical-align: top; line-height: 1em;'>" +
        JSON.stringify(c1, null, 2).replace(/[{}]/g, '') +
        "</pre><pre style='display: inline-block; margin: 0; padding: 0; vertical-align: top; line-height: 1em;'>" +
        JSON.stringify(c2, null, 2).replace(/[{}]/g, '') +
        '</pre></div>'
      tooltip.innerHTML = tooltipContent
    }
  }

  //display tooltip here when we mouse over a circle
  map.on('pointermove', displayTooltip)
})

// Helper function for cleaning upa JSON object for the tooltip
function clean (obj) {
  for (var propName in obj) {
    if (
      obj[propName] === null ||
      obj[propName] === undefined ||
      obj[propName] === ''
    ) {
      delete obj[propName]
    }
  }
  return obj
}

function splitObjectInHalf (obj) {
  const entries = Object.entries(obj)
  const halfLength = Math.ceil(entries.length / 2)
  const firstHalf = entries.slice(0, halfLength)
  const secondHalf = entries.slice(halfLength)
  const firstObj = Object.fromEntries(firstHalf)
  const secondObj = Object.fromEntries(secondHalf)
  return [firstObj, secondObj]
}

function getFilteredQuadrantData (allData, i) {
  //filter allData by years
  let minYear = $('#fromSlider').val()
  let maxYear = $('#toSlider').val()
  let localData = allData.filter(obj => {
    return parseInt(obj['Year']) >= minYear
  })

  localData = localData.filter(obj => {
    return parseInt(obj['Year']) <= maxYear
  })

  // filter allData by disaster
  let disasterElementID = '#disaster-select' + i
  let disasterVal = $(disasterElementID).val()
  localData = localData.filter(obj => {
    return obj['Disaster Type'] == disasterVal
  })

  //filter by field
  let field = $('#select' + i).val()
  let fields = localData.map(obj => obj[field])

  return [field, localData]
}

//wire slider
function getMinMaxYear (objects) {
  let minYear = Number.MAX_SAFE_INTEGER
  let maxYear = Number.MIN_SAFE_INTEGER
  for (let i = 0; i < objects.length; i++) {
    const year = objects[i]['Year']
    if (year < minYear) {
      minYear = year
    }
    if (year > maxYear) {
      maxYear = year
    }
  }

  return [minYear, maxYear]
}

function refreshSlider () {
  let [min, max] = getMinMaxYear(csvData)
  // add slider wiring for min and max time
  $('#fromSlider').attr({
    max: max,
    min: min,
    val: min
  })

  $('#toSlider').attr({
    max: max,
    min: min,
    val: max
  })

  // set the text and values for the sliders
  $('#fromSlider').val(min)
  $('#toSlider').val(max)
  $('#fromSliderLabel').text(min)
  $('#toSliderLabel').text(max)
}

// generalize a refreshSliderDataMethod
$('#fromSlider').on('change', e => {
  csvData = csvDataSource.filter(obj => {
    return parseInt(obj['Year']) >= e.target.value
  })
  for (let i = 1; i < 5; i++) {
    refreshMaps(csvData, $('#select' + i).val(), i, visualTypeArray[i - 1])
  }
  $('#fromSliderLabel').text(e.target.value)
})

$('#toSlider').on('change', e => {
  csvData = csvDataSource.filter(obj => {
    return parseInt(obj['Year']) <= e.target.value
  })
  for (let i = 1; i < 5; i++) {
    refreshMaps(csvData, $('#select' + i).val(), i, visualTypeArray[i - 1])
  }
  $('#toSliderLabel').text(e.target.value)
})

//iniitilization the sliders and the maps when the page loads
refreshSlider()
for (let i = 1; i < 5; i++) {
  refreshMaps(csvData, $('#select' + i).val(), i, visualTypeArray[i - 1])
}
