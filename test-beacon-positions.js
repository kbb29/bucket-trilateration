//this is a script for experimenting with beacon positions
//you can change the beaconPoints array and see how the average and max errors change
//the errors are calculated in ml.runGridTest() by testing the beacon pattern against a number of random points
//    the random points are specified by the bounds and number of points passed to runGridTest()
//    each point is turned into a distance from each beacon,
//       which is then obfuscated to the appropriate bucket eg. [500,1000]
//    these buckets are then used to perform the multilateration 
//       to get an estimate of the original point and its error radius
//    each of these estimates is returned as a utils.Centroid

//if you get a lot of null values returned, try increasing numPoints in the MultiLat constructor
//  this will make things run slower though (mainly the time taken to contstruct the MultiLat)


const utils = require('./utils.js')
const plot  = require('./plot.js')
const multilat = require('./multilat.js')

const boundsCenter = new utils.Point(45, 45)
const searchBounds = utils.BoundsFromCenter(boundsCenter, 10000)
const testBounds = utils.BoundsFromCenter(boundsCenter, 3000)

var beaconPoints = utils.generateHexagonPoints(boundsCenter, 1300)
beaconPoints.push(boundsCenter)

const obfuscationBuckets = [[0, 500],[500, 1000],[1000, 2000],[2000, 5000],[5000, 10000],[10000, 20000],[20000, 50000],[50000, 100000],[100000, 200000],
[200000, 500000],[500000, 1000000],[1000000, 2000000]]

var calculateErrorStats = function(errors) {
    var maxE = 0;
    var nonNull = errors.filter(e => e !== null)
    var totE = nonNull.reduce((total, current) => total+current.err, 0)
    var maxE = nonNull.reduce((max, current) => Math.max(current.err, max), 0)
    return {maxError: maxE, avgError: totE / nonNull.length, totalCount: errors.length, nullCount: errors.length - nonNull.length}
}

const plotAllCentroids = function(searchBounds, beaconPoints, doPlot) {

    startt = Date.now()
    ml = new multilat.MultiLat(searchBounds, beaconPoints, obfuscationBuckets, {numPoints: 10000})
    initt = Date.now()
    centroids = [...ml.runGridTest(testBounds, 10000)]
    endt = Date.now()
    console.log(`init ${initt - startt}ms, grid ${endt - initt}ms`)

    if(doPlot) {
        console.log('plotting centroids')
        plot.drawCentroids(centroids, ml.beaconPoints)
    }

    return centroids  
}


console.log('calling plotAllCentroids()')
centroids = plotAllCentroids(searchBounds, beaconPoints, true)
es = calculateErrorStats(centroids)
console.log(JSON.stringify(es))
