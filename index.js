if (!process.argv[2]) {
  console.error('You must supply a page to profile');
  return;
}

var PAGE = process.argv[2],
  _ = require('lodash'),
  request = require('request'),
  Socket = require('ws'),
  chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  spawn = require('child_process').spawn,
  args = [
    PAGE,
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
  return _.find(tabs, { url: PAGE });
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
    if (data.id > 1) heapAfterGC.push(heapSize);
    if (heapAfterGC.length == 2) write();
  };

  socket.on('open', function () {
    socket.send(JSON.stringify({ id: ++i, method: 'Timeline.start' }));
  });

  function logHeap (delta) {
    heapSize += delta;
  }

  function write () {
    console.log(heapSize);
    console.log(heapAfterGC[0] - heapAfterGC[1]);
    chrome.kill();
    process.exit(0);
  }

  function gc () {
    socket.send(JSON.stringify({ id: ++i, method: 'HeapProfiler.collectGarbage' }));
  }


  setTimeout(gc, 5e3); // Ignore the first 5 seconds of spin up
  setTimeout(gc, 10e3); // Finish after 10 seconds
}

poll();
