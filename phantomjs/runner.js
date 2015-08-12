/*
* grunt-phantomcss
* https://github.com/micahgodbolt/grunt-phantomcss
*
* Copyright (c) 2013 Chris Gladd
* Copyright (c) since 2014 Anselm Hannemann
* Copyright (c) since 2015 Micah Godbolt
*
* Licensed under the MIT license.
*/

'use-strict';

// Parse arguments passed in from the grunt task
var args = JSON.parse(phantom.args[0]);

// Get node fileSystem module and define the separator module
var fs = require('fs');
var s = fs.separator;

// SlimerJS needs a fully-qualified path to the Node module.
var path = require(args.nodeModulesPath + s + 'path' + s + 'path');

// Get viewport arguments (width | height)
var viewportSize = {
  width: args.viewportSize[0],
  height: args.viewportSize[1]
};

// Messages are sent to the parent by appending them to the tempfile
var sendMessage = function() {
  fs.write(args.tempFile, JSON.stringify(Array.prototype.slice.call(arguments)) + '\n', 'a');
};

sendMessage('onLog', 'Initializing runner...');

// Initialise CasperJs
var phantomCSSPath = args.phantomCSSPath;

phantom.casperPath = phantomCSSPath + s + 'node_modules' + s + 'casperjs';

sendMessage('onLog', 'Casper path is ' + phantom.casperPath + '...');
sendMessage('onLog', 'Casper bootstrap path is ' + phantom.casperPath + s + 'bin' + s + 'bootstrap.js' + '...');

phantom.injectJs(phantom.casperPath + s + 'bin' + s + 'bootstrap.js');

sendMessage('onLog', 'Initializing Casper...');

var casper = require('casper').create({
  viewportSize: viewportSize,
  logLevel: args.logLevel,
  verbose: true
});

sendMessage('onLog', 'Loading PhantomCSS...');

// Require and initialise PhantomCSS module
var phantomcss = require(phantomCSSPath + s + 'phantomcss.js');

sendMessage('onLog', 'Initializing PhantomCSS...');

phantomcss.init({
  casper: casper,
  screenshotRoot: args.screenshots,
  failedComparisonsRoot: args.failures,
  libraryRoot: phantomCSSPath, // Give absolute path, otherwise PhantomCSS fails
  mismatchTolerance: args.mismatchTolerance, // defaults to 0.05

  onFail: function(test) {
    sendMessage('onFail', test);
  },
  onPass: function(test) {
    sendMessage('onPass', test);
  },
  onTimeout: function(test) {
    sendMessage('onTimeout', test);
  },
  onComplete: function(allTests, noOfFails, noOfErrors) {
    sendMessage('onComplete', allTests, noOfFails, noOfErrors);
  },
  fileNameGetter: function(root, filename) {
    var exists,
        name = phantomcss.pathToTest + args.screenshots + '/' + filename,
        stats;
    
    try {
      exists = fs.isFile(name + '.png');
    } catch (ex) {
      // When using SimerJS this call throws an error with the following result code when the file isn't found.
      if (ex.result === 2152857606) {
        exists = false;
      } else {
        //throw ex;
      }
    }
    
    if (exists) {
      return name + '.diff.png';
    } else {
      return name + '.png';
    }
  },
});

sendMessage('onLog', 'Starting casper...');

casper.start();

sendMessage('onLog', 'Casper started...');

// Run the test scenarios
args.test.forEach(function(testSuite) {
  sendMessage('onLog', 'Running test suite ' + testSuite + '...');
  
  phantom.casperTest = true;
  phantom.rootUrl = args.rootUrl;
  phantom.casper = casper;
  phantom.phantomcss = phantomcss;
  casper.then(function() {
    phantomcss.pathToTest = path.dirname(testSuite) + '/';
    sendMessage('onLog', 'Set pathToTest to ' + phantomcss.pathToTest + '...');
  });
  require(testSuite);
  casper.then(function() {
    sendMessage('onLog', 'Comparing session...');
    phantomcss.compareSession();
  })
  .then(function() {
    sendMessage('onLog', 'Test suite ' + testSuite + ' completed.');
    casper.test.done();
  });
});

// End tests
casper.run(function() {
  phantom.exit();
});
