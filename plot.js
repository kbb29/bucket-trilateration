var Mustache = require('mustache');
const fs = require('fs');
const { exec } = require("child_process");
const path = require('path')


var templateStr;
try {
    templateStr = fs.readFileSync(path.join(__dirname, 'map.mustache'), 'utf8')
    //console.log(templateStr)
  } catch (err) {
    console.error(err)
  }

var generateDonut = function(lat, lon, outerradius, innerradius, color) {
    return `L.donut([${lat}, ${lon}], {
        color: '${color}',
        fillColor: '${color}',
        fillOpacity: 0.4,
        radius: ${outerradius},
        innerRadius: ${innerradius}
    })`
}
var generateCircle = function(lat, lon, radius, options) {

    return `L.circle([${lat}, ${lon}], {
        color: '${options.color || "red"}',
        fillColor: '${options.color || "red"}',
        fillOpacity: ${options.opacity || "0.0"},
        radius: ${radius}
    })`
}

var generateMarker = function(lat, lon, title) {
    return `L.marker([${lat}, ${lon}], {title: '${title}'})`
}

var generateAddToFeaturesAndMap = function(featureCode) {
    return `features.push(${featureCode}.addTo(map));\n`
}

  var drawErrors = function(errors, beaconPoints, tag) {
    var circles = ""
    tag = tag || 'test'
    for (var beacon of errors) {
        circles += generateAddToFeaturesAndMap(generateCircle(beacon.point.lat, beacon.point.lon, beacon.dist, "red"))
    }

    var beaconJS = ""
    for (var bp of beaconPoints) {
       beaconJS += generateAddToFeaturesAndMap(generateMarker(bp.lat, bp.lon, 'beacon'))
    }
   
    var view = {
        features: circles + "\n" + beaconJS
    }
   var output = Mustache.render(templateStr, view);
    //console.log(output)

    var fn = `/tmp/map-${tag}.html`
    try {
        fs.writeFileSync(fn, output)
        //file written successfully
      } catch (err) {
        console.error(err)
      }
      
      exec(`xdg-open ${fn}`, (error, stdout, stderr) => {
          if (error) {
              console.log(`error: ${error.message}`);
              return;
          }
          if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
          }
          console.log(`stdout: ${stdout}`);
      });
}

var drawCircles = function(beacons, actual, preds) {
    var circles = ""
    for (var beacon of beacons) {
        circles += generateAddToFeaturesAndMap(generateCircle(beacon.point.lat, beacon.point.lon, beacon.dist, "red"))
    }

    var actualJS = `features.push(L.marker([${actual.lat}, ${actual.lon}], {title: 'actual'}).addTo(map))`
    var predictedJS = ""
    for (var pred of preds) {
        console.log('pred', pred)
       predictedJS += `features.push(L.marker([${pred[1].lat}, ${pred[1].lon}], {title: 'pred-${pred[0]}'}).addTo(map))\n`
    }
   
    var view = {
        features: circles + "\n" + actualJS + "\n" + predictedJS
    }
   var output = Mustache.render(templateStr, view);
    //console.log(output)

    try {
        fs.writeFileSync('/tmp/testmap.html', output)
        //file written successfully
      } catch (err) {
        console.error(err)
      }
      
      exec("xdg-open /tmp/testmap.html", (error, stdout, stderr) => {
          if (error) {
              console.log(`error: ${error.message}`);
              return;
          }
          if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
          }
          console.log(`stdout: ${stdout}`);
      });
}


var drawIntersection = function(beacons, actual, preds, centroid, tag) {
    var featureJS = ""
    for (var beacon of beacons) {
        //console.log(beacon)
        featureJS += generateAddToFeaturesAndMap(generateDonut(beacon.point.lat, beacon.point.lon, beacon.limits[1], beacon.limits[0], "red"))
        featureJS += generateAddToFeaturesAndMap(generateMarker(beacon.point.lat, beacon.point.lon, "kevin"))
    }

    if(actual != null) {
        featureJS += generateAddToFeaturesAndMap(generateMarker(actual.lat, actual.lon, 'actual'))
    }
    for (pred of preds) {
       featureJS += generateAddToFeaturesAndMap(generateMarker(pred.lat, pred.lon, 'pred'))
    }

    if(centroid !== null) {
        featureJS += generateAddToFeaturesAndMap(generateCircle(centroid.point.lat, centroid.point.lon, centroid.err, {color: 'blue', opacity: "0.1"}))
    }

    var view = {
        features: featureJS
    }

    var output = Mustache.render(templateStr, view);
    //console.log(output)

    tag = tag || 'test'
    const fn = `/tmp/map-${tag}.html`
    try {
        fs.writeFileSync(fn, output)
        //file written successfully
      } catch (err) {
        console.error(err)
      }
      
      exec(`xdg-open ${fn}`, (error, stdout, stderr) => {
          if (error) {
              console.log(`error: ${error.message}`);
              return;
          }
          if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
          }
          //console.log(`stdout: ${stdout}`);
      });
}

var drawCentroids = function(centroids, beaconPoints, tag) {
    var featureJS = ""
    for (var bp of beaconPoints) {
        //console.log(beacon)
        featureJS += generateAddToFeaturesAndMap(generateMarker(bp.lat, bp.lon, "kevin"))
    }

    for (const [n, pred] of centroids.filter(c => c !== null).entries()) {
        //var pred = centroids[n]
       //console.log('pred', pred)
       featureJS += generateAddToFeaturesAndMap(generateCircle(pred.point.lat, pred.point.lon, pred.err, {color: "blue", opacity: "0.0", title: `${n}`}))
       //featureJS += generateAddToFeaturesAndMap(generateMarker(pred.point.lat, pred.point.lon, 'centroid'))
    }

    var view = {
        features: featureJS
    }

    var output = Mustache.render(templateStr, view);
    //console.log(output)

    tag = tag || 'test'
    const fn = `/tmp/map-${tag}.html`
    try {
        fs.writeFileSync(fn, output)
        //file written successfully
      } catch (err) {
        console.error(err)
      }
      
      exec(`xdg-open ${fn}`, (error, stdout, stderr) => {
          if (error) {
              console.log(`error: ${error.message}`);
              return;
          }
          if (stderr) {
              console.log(`stderr: ${stderr}`);
              return;
          }
          //console.log(`stdout: ${stdout}`);
      });
}

module.exports = {drawCircles, drawErrors, drawIntersection, drawCentroids }