const utils = require('./utils.js')
const plot  = require('./plot.js')
const multilat = require('./multilat.js')

const boundsCenter = new utils.Point(45, 45)
const searchBounds = utils.BoundsFromCenter(boundsCenter, 10000)

var beaconPoints = utils.generateTrianglePoints(boundsCenter, 1300)

//these are the obfuscation buckets defined by whatever service is returning the distance estimates
const obfuscationBuckets = [[0, 500],[500, 1000],[1000, 2000],[2000, 5000],[5000, 10000],[10000, 20000],[20000, 50000],[50000, 100000],[100000, 200000],
[200000, 500000],[500000, 1000000],[1000000, 2000000]]

ml = new multilat.MultiLat(searchBounds, beaconPoints, obfuscationBuckets)

//Make up some ranges, which in a real case would be returned from the service/api/whatever
beaconLimits = [[1000, 2000],[2000,5000],[1000, 2000]]
//construct beacon objects (which associate a lat and lon to a distance range)
//The beacons tell us what we actually know about the object.  ie it is:
//  between 1000m and 2000m from lat1,lon1
//  between 0m and 500m from lat2,lon2
//  ... etc
beacons = beaconPoints.map((bp, i) => new utils.Beacon(bp.lat, bp.lon, beaconLimits[i]))

//multilaterate.  returns a centroid, which is a lat,lon point with an error bound
centroid = ml.multilaterate(beacons)
console.log(`trilaterated to ${JSON.stringify(centroid)}`)

//if you want to examine the trilat details, you can tell multilaterate() to plot it by adding some options
centroid = ml.multilaterate(beacons, {plotIntersection: {tag: `example-intersect`}})
console.log(`trilaterated again to ${JSON.stringify(centroid)}`)

//now we try one that doesn't work - there is no overlap here, so it will return null
//you can change this behaviour by passing in a nullHandler in the options eg.
//    centroid = ml.multilaterate(beacons, {nullHandler: function(beacons) {return utils.Centroid(somelat, somelon, someradius)}})
beaconLimits = [[500, 1000],[500, 1000],[500, 1000]]
beacons = beaconPoints.map((bp, i) => new utils.Beacon(bp.lat, bp.lon, beaconLimits[i]))

centroid = ml.multilaterate(beacons, {plotIntersection: {tag: `example-intersect-fail`}})
console.log(`trilaterated without success to ${JSON.stringify(centroid)}`)

//And now a more complicated example - demonstrating the benefit of more beacons
//we need a new MulitLat Object as we are changing the beacon points
//constructing the MultiLat Object takes a while.  But afterwards, calls to multilaterate() are fast
var beaconPoints = utils.generateHexagonPoints(boundsCenter, 1300)
beaconPoints.push(boundsCenter)
ml = new multilat.MultiLat(searchBounds, beaconPoints, obfuscationBuckets)

//Make up some ranges, which in a real case would be returned from the service/api/whatever
beaconLimits = [[1000, 2000],[2000,5000],[1000, 2000],[1000, 2000],[1000, 2000],[500, 1000],[500,1000]]
beacons = beaconPoints.map((bp, i) => new utils.Beacon(bp.lat, bp.lon, beaconLimits[i]))

centroid = ml.multilaterate(beacons, {plotIntersection: {tag: `example-intersect-hex`}})
console.log(`trilaterated with hexagon to ${JSON.stringify(centroid)}`)