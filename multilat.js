// This file contains the class that performs the multilateration

const utils = require('./utils.js')
const plot  = require('./plot')


const GridPointGenerator = function(bounds, numPoints) {
    this.bounds = bounds
    this.numX = Math.floor(Math.sqrt(numPoints))
    this.numY = this.numX
    this.length = this.numX * this.numY

    this.incrLat = (this.bounds.top - this.bounds.bottom) / (this.numY - 1)
    this.incrLon = (this.bounds.right - this.bounds.left) / (this.numX - 1)
    this.nextIdx = 0
    return this
}

GridPointGenerator.prototype.at = function(idx) {
    x = idx % this.numX
    y = idx / this.numX
    
    lat = this.bounds.bottom + y*this.incrLat
    lon = this.bounds.left + x*this.incrLon
    return new utils.Point(lat, lon)
}

GridPointGenerator.prototype.nextPoint = function() {
    if(this.nextIdx >= this.length) { return null;  }
    
    return this.at(this.nextIdx++)
}

GridPointGenerator.prototype[Symbol.iterator] = function*() {
    for(i = 0 ; i < this.length ; i++) {
        yield this.at(i)
    }
}

GridPointGenerator.prototype.reset = function() {
    this.nextIdx = 0
}


const MappedGenerator = function(pointGen) {
    this.pointGen = pointGen
    return this
}
MappedGenerator.prototype.map = function* (mapper, thisArg) {
    this.pointGen.reset()
    while( null !== (np = this.pointGen.nextPoint() ) ) {
        yield mapper.call(thisArg, np)
    }
}
MappedGenerator.prototype.at = function(idx) {
    return this.pointGen.at(idx)
}


const RandomPointGenerator = function(bounds, numPoints) {
    this.bounds = bounds
    this.length = numPoints
    this.i = 0
    return this
}

RandomPointGenerator.prototype.nextPoint = function() {
    if(this.i >= this.length) {
        return null
    }
    let lat = Math.random() * (this.bounds.top - this.bounds.bottom) + this.bounds.bottom
    let lon = Math.random() * (this.bounds.right - this.bounds.left) + this.bounds.left
    this.i++
    return new utils.Point(lat, lon)
}

RandomPointGenerator.prototype.reset = function() {
    this.i = 0
}


const MultiLat = function(searchBounds, beaconPoints, limitBuckets, options) {
    options = options || {}
    let numPoints = options.numPoints || 100000
    this.beaconPoints = beaconPoints
    this.distanceBuckets = beaconPoints.map(x => new Array())
    this.grid = new GridPointGenerator(searchBounds, numPoints)
    this.obfuscationBuckets = limitBuckets
    this.cache = limitBuckets.map(lb => null)
    
    //console.log(this.beaconPoints)
    //console.log(this.distanceBuckets)

    for(n = 0 ; n < this.grid.length; n++) {
    //for(n in grid) {
    //grid.forEach((pt, n) => {
        for([beaconIdx, beaconPoint] of beaconPoints.entries()) {
            var dist = utils.myGCD(beaconPoint, this.grid.at(n))
            let db = this.distanceBuckets[beaconIdx]
            for([bucketIdx, bucket] of this.obfuscationBuckets.entries()) {
                if(dist >= bucket[0] && dist < bucket[1]) {
                    if(bucketIdx in db) {
                        db[bucketIdx].add(n)
                    } else {
                        db[bucketIdx] = new Set([n])
                    }
                }
            }
        }
    }
    return this
}

MultiLat.prototype.runGridTest = function(bounds, numPoints) {
    const pointGen = new RandomPointGenerator(bounds, numPoints)
    const testGen = new MappedGenerator(pointGen)
    let errors = testGen.map(pt => this.multilaterate(utils.simulateServiceDistances(pt, this.beaconPoints, this.obfuscationBuckets)))
    return errors
}


MultiLat.prototype.search = function(beaconBucketIndices) {
    //console.log('bbi', beaconBucketIndices)
    //console.log('t.db', this.distanceBuckets)
    
    matchingPointSets = beaconBucketIndices.map((bucketIdx,beaconIdx) => this.distanceBuckets[beaconIdx][bucketIdx])
    matchingPoints = intersection(matchingPointSets)
    return this.gridPointsFromIndices(matchingPoints)
}

MultiLat.prototype.gridPointsFromIndices = function*(indices) {
    //return [...indices].map(idx => this.grid[idx])
    for(idx of indices) {
        yield this.grid.at(idx)
    } 
}

MultiLat.prototype.gridPointsToCentroid = function(gridPoints) {
    gridPointsArr = [...gridPoints]
    if(gridPointsArr.length == 0) {
        return null
    }
    centroid = utils.findPointsCentroid(gridPointsArr)
    utils.calculateMaxErrorFromCentroid(centroid, gridPointsArr)
    return centroid
}

MultiLat.prototype.fetchFromCache = function(limitIndices) {
    var ptr = this.cache
    for(limitIndex of limitIndices) {
        if(ptr === null) {
            return null
        }
        ptr = ptr[limitIndex]
    }
    return ptr
}
MultiLat.prototype.insertIntoCache = function(limitIndices, obj) {
    var ptr = this.cache
    for(limitIndex of limitIndices.slice(0,-1)) {
        if(ptr[limitIndex] === null) {
            ptr[limitIndex] = this.obfuscationBuckets.map(li => null)
        }
        ptr = ptr[limitIndex]
    }
    
    ptr[limitIndices.slice(-1)[0]] = obj
}

MultiLat.prototype.beaconPointsEqual = function(beacons) {
    return beacons.length == this.beaconPoints.length && this.beaconPoints.every((bp,i) => bp.equalTo(beacons[i].point))
}

//this returns the beacons sorted in the same way as the beaconPoints with which the MultiLat was constructed
//this assumes that the beacons are the correct beacons, just in a different order
MultiLat.prototype.sortBeaconsForMultilaterate = function(beacons) {
    return this.beaconPoints.map(bp => beacons.find(b => bp.equalTo(b.point)))
}

MultiLat.prototype.multilaterate = function(beacons, options) {
    //START input validation
    //check here that beacon points are equal to this.beaconPoints.  Otherwise the results will be meaningless
    if(!this.beaconPointsEqual(beacons)) {
        if(beacons.length != this.beaconPoints.length) {
            throw `wrong number of beacons (${beacons.length}) passed to multilaterate.  should be the same as when MultiLat was constructed (${this.beaconPoints.length})`
        }
        //if the lengths are the same, it might just be a matter of ordering
        beacons = this.sortBeaconsForMultilaterate(beacons)
        if(!this.beaconPointsEqual(beacons)) {
            throw `the beacons points passed to multilaterate are different to the ones with which the MultiLat was constructed`
        }
    }
    limitIndices = beacons.map(b => this.obfuscationBuckets.findIndex(bucket => b.limits[0] == bucket[0] && b.limits[1] == bucket[1] ))
    if(limitIndices.some(li => li == -1)) {
        badIndex = limitIndices.findIndex(li => li == -1)
        throw `the beacons passed contain a limit bucket (${beacons[badIndex].limits}) that was not specified when MultiLat was constructed`
    }

    options = options || {}
    plotIntersection = options.plotIntersection
    nullHandler = options.nullHandler
    //END input validation

    var centroid = this.fetchFromCache(limitIndices)
    if(centroid !== null && !plotIntersection) {
        return centroid
    }
    
    //START actual multilateration
    let estimate = this.search(limitIndices)

    if(plotIntersection) {
        estimate = [...estimate]
    }
    
    centroid = this.gridPointsToCentroid(estimate)
    if(centroid === null && options.nullHandler) {
        centroid = nullHandler(beacons)
    }
    //END actual multilateration

    this.insertIntoCache(limitIndices, centroid)
    if(plotIntersection) {
        //console.log(estimate)
        plot.drawIntersection(beacons, plotIntersection.actual, estimate, centroid, plotIntersection.tag)
    }
    return centroid
}


function* intersection(sets) {
    //console.log(sets)
    sets.sort((a,b) => a.size - b.size) //sort the sets to make it go faster.  For speed, we want sets[0] to be the smallest of the sets
    //return new Set([...sets[0]].filter(elem => sets.slice(1).every(set => set.has(elem))))
    for(elem of sets[0]) {
        if(sets.slice(1).every(set => set.has(elem))) {
            yield elem
        }
    }
}


module.exports = { MultiLat }



