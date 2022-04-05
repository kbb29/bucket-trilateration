// This file contains general tools/classes for trilat 

// Requires the Mathjs library - http://mathjs.org/
var math = require('mathjs')
const { greatCircleDistance } = require("great-circle-distance");
const EARTH_RADIUS = 6371000
const EARTH_CIRCUM = EARTH_RADIUS * 2 * Math.PI


const Centroid = function(point, err) {
    this.point = point
    this.err = err
    return this
}

Centroid.prototype.add = function(pt) {
    this.point.lat += pt.lat
    this.point.lon += pt.lon

    return this
}

Centroid.prototype.divide_by = function(denom) {
    this.point.lat /= denom
    this.point.lon /= denom
}

Centroid.prototype.saveErrorIfGreater = function(newerr) {
    if (newerr > this.err) {
        this.err = newerr
    }
}

Centroid.prototype.toJSON = function() {
    return {point: this.point, error: this.err}
}

var Point = function(lat, lon) {
  this.lat  = lat
  this.lon  = lon 
  return this
}

Point.prototype.toJSON = function() {
    return [this.lat, this.lon]
}

Point.prototype.equalTo = function(other) {
    return this.lat == other.lat && this.lon == other.lon
}


var Beacon = function(lat, lon, limits) {
  this.point = new Point(lat, lon)
  this.limits = limits
  
  return this
}

var Bounds = function(bottom, top, left, right) {
    this.bottom = bottom
    this.top = top
    this.left = left
    this.right = right
    this.center = new Point((top + bottom)/2, (left + right)/2)

    return this
}

var BoundsFromCenter = function(center, width) {
    const rad = width/2
    const top = calculatePointAtBearingAndDistance(center, 0, rad)
    const bottom = calculatePointAtBearingAndDistance(center, 180, rad)
    const right = calculatePointAtBearingAndDistance(center, 90, rad)
    const left = calculatePointAtBearingAndDistance(center, 270, rad)
    
    return new Bounds(bottom.lat, top.lat, left.lon, right.lon)
}

var myGCD = function(pt1, pt2) {
    return 1000 * greatCircleDistance({lat1: pt1.lat, lng1: pt1.lon, lat2: pt2.lat, lng2: pt2.lon})
}

var getBoundsCenter = function(bounds) {
    return new Point((bounds.top + bounds.bottom)/2, (bounds.left + bounds.right)/2)
}

function getBoundsDiagonal(bounds) {
    return myGCD(new Point(bounds.top, bounds.left), new Point(bounds.bottom, bounds.right))
}

var mse = function(beacons, candidatePoint) {
    squaredErrors = [];
    for(var beacon of beacons) {
        gcd = myGCD(beacon.point, candidatePoint)
        //console.log(beacon, candidatePoint)
        //console.log(`gcd: ${gcd}, bd: ${beacon.dist}, error: ${gcd-beacon.dist}, se: ${(gcd - beacon.dist)**2}`);
        squaredErrors.push((gcd - beacon.dist)**2)
    }
    //console.log(squaredErrors);
    return math.mean(squaredErrors);
}                

var findExtremeBeacons = function(beacons) {
    var extremes = [beacons[0], beacons[0], beacons[0], beacons[0]]
    for(var beacon of beacons.slice(1)) {
        if(beacon.point.lat < extremes[0].point.lat) {
            extremes[0] = beacon
        }
        if(beacon.point.lat > extremes[1].point.lat) {
            extremes[1] = beacon
        }
        if(beacon.point.lon < extremes[2].point.lon) {
            extremes[2] = beacon
        }
        if(beacon.point.lon > extremes[3].point.lon) {
            extremes[3] = beacon
        }
    }
    return extremes;
}

var findBoundLimits = function(beacons) {
    var extremes = findExtremeBeacons(beacons)
    const ERROR_MARGIN = 1.5
    //do the southerly limit
    const bottom = extremes[0].point.lat - extremes[0].dist * ERROR_MARGIN * 360 / EARTH_CIRCUM
    //do the northerly limit
    const top = extremes[1].point.lat + extremes[1].dist * ERROR_MARGIN * 360 / EARTH_CIRCUM
    //do the easterly limit
    //calculate the cicumference of the earth at this latitude
    var circum = Math.cos(extremes[2].point.lat * Math.PI / 180) * EARTH_CIRCUM
    const left = extremes[2].point.lon - extremes[2].dist * ERROR_MARGIN * 360 / circum
    //do the westerly limit
    circum = Math.cos(extremes[3].point.lat * Math.PI / 180) * EARTH_CIRCUM
    const right = extremes[3].point.lon + extremes[3].dist * ERROR_MARGIN * 360 / circum
    return new Bounds(bottom, top, left, right)
}

var calculatePointAtBearingAndDistance = function(pt, bearing, distance) {

    const Ad = distance / EARTH_RADIUS
    const theta = bearing * Math.PI / 180; // Convert bearing to radian
    let lat = pt.lat * Math.PI / 180; // Current coords to radians
    let lon = pt.lon * Math.PI / 180;
  
    // Do the math magic
    lat = Math.asin(Math.sin(lat) * Math.cos(Ad) + Math.cos(lat) * Math.sin(Ad) * Math.cos(theta));
    lon += Math.atan2(Math.sin(theta) * Math.sin(Ad) * Math.cos(lat), Math.cos(Ad) - Math.sin(lat) * Math.sin(lat));
  
    // Coords back to degrees and return
    return new Point(lat * 180 / Math.PI, lon * 180 / Math.PI);
    
}

var findClosestBeacon = function(beacons) {
    var closPt = beacons.reduce(
        (closestBeacon, currentBeacon) => currentBeacon.limits[1] < closestBeacon.limits[1] ? currentBeacon : closestBeacon,
        beacons[0]
      );
    //console.log(`findCLosestPOint() returning ${closPt} ${closPt.point} ${closPt.point.lat}`)
    return closPt
} 

var findFurthestBeacon = function(beacons) {
    var farPt = beacons.reduce(
        (furthestBeacon, currentBeacon) => currentBeacon.limits[0] > furthestBeacon.limits[0] ? currentBeacon : furthestBeacon,
        beacons[0]
      );
    //console.log(`findCLosestPOint() returning ${closPt} ${closPt.point} ${closPt.point.lat}`)
    return farPt.point
}
const findPointsCentroid = function(points) {
    var centroid = points.reduce((centroid,pt) => centroid.add(pt), new Centroid(new Point(0,0), 0))
    centroid.divide_by(points.length)
    return centroid
}

const calculateMaxErrorFromCentroid = function(centroid, points) {
    points.forEach((pt) => centroid.saveErrorIfGreater(myGCD(centroid.point, pt)))
}

var findBeaconsCentroid = function(beacons) {
    return this.findPointsCentroid(beacons.map(b => b.point))
}

function generateTrianglePoints(center, radius, orientation) {
    orientation = orientation || 0.0
    //console.log(`generating triangle beacon pattern for ${JSON.stringify(center)} and ${radius}`)
    return [0,120,240].map(bearing => calculatePointAtBearingAndDistance(center, bearing + orientation, radius))
    //console.log(`generated triangle beacon pattern ${JSON.stringify(bps)}`)
}

function generateHexagonPoints(center, radius, orientation) {
    orientation = orientation || 0.0

    return generateTrianglePoints(center, radius, orientation).concat(generateTrianglePoints(center, radius, orientation+60))
}

const obfuscationFunc = function(distance, buckets) {
    for(bucket of buckets) {
        if (distance >= bucket[0] && distance < bucket[1]) {
            return bucket
        }
    }
    throw `distance ${distance} is too big.  Add more buckets?`
}

var simulateServiceDistances = function(pt, beaconPoints, obfuscationBuckets) {
    return beaconPoints.map(bp => new Beacon(bp.lat, bp.lon, obfuscationFunc( myGCD(bp, pt), obfuscationBuckets ) ) )
}


module.exports = { Beacon,
    Point, Bounds, Centroid, myGCD, findClosestBeacon, findFurthestBeacon, findBeaconsCentroid, findPointsCentroid, calculateMaxErrorFromCentroid, 
    findBoundLimits, calculatePointAtBearingAndDistance,
getBoundsCenter,
generateTrianglePoints,
generateHexagonPoints,
simulateServiceDistances,
getBoundsDiagonal,
BoundsFromCenter, mse }