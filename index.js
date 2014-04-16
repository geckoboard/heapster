
module.exports = function heapster (page, callback) {
  var _ = require('lodash'),
    request = require('request'),
    Socket = require('ws'),
    chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    spawn = require('child_process').spawn,
    args = [
      page,
      '--incognito',
      '--no-default-browser-check',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--start-maximized',
      '--remote-debugging-port=9222'
    ],
    chrome = spawn(chromeExecutable, args);

  function poll () {
    request('http://localhost:9222/json', function (err, res, body) {
      if (err || !findTab(body)) setTimeout(poll, 100);
      else listen(findTab(body));
    });
  }

  function findTab(body) {
    var tabs = JSON.parse(body);
    return _.find(tabs, { url: page });
  }

  function listen (tab) {
    var heapAfterGC = [],
        heapSize = 0,
        i = 0,
        socketUrl = tab.webSocketDebuggerUrl,
        socket = new Socket(socketUrl);

    socket.onmessage = function (message) {
      var data = JSON.parse(message.data);
      if (data.params && data.params.record && data.params.record.usedHeapSizeDelta) {
        logHeap(data.params.record.usedHeapSizeDelta);
      }
      if (data.id > 1) heapAfterGC.push(heapSize); // Sample heap size immediately after GC
      if (heapAfterGC.length == 2) write();
    };

    socket.on('open', function () {
      socket.send(JSON.stringify({ id: ++i, method: 'Timeline.start' }));
    });

    function logHeap (delta) {
      heapSize += delta;
    }

    function write () {
      chrome.kill();
      callback(null, {
        heap: heapSize,
        increase: heapAfterGC[0] - heapAfterGC[1]
      });
    }

    function gc () {
      socket.send(JSON.stringify({ id: ++i, method: 'HeapProfiler.collectGarbage' }));
    }


    setTimeout(gc, 5e3); // Ignore the first 5 seconds of spin up
    setTimeout(gc, 10e3); // Finish after 10 seconds
  }

  poll();
};
