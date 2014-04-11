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
  charm = require('charm')(),
  chrome = spawn(chromeExecutable, args);

charm.pipe(process.stdout);
charm.reset();

function poll () {
  request('http://localhost:9222/json', function (err, res, body) {
    if (err) setTimeout(poll, 100);
    else listen(JSON.parse(body));
  });
}

function listen (tabs) {
  var heapSize = 0,
      lastHeap = 0,
      i = 0,
      socketUrl = _.find(tabs, { url: PAGE }).webSocketDebuggerUrl,
      socket = new Socket(socketUrl);

  socket.onmessage = function (message) {
    var data = JSON.parse(message.data);
    if (data.params && data.params.record && data.params.record.usedHeapSizeDelta) {
      logHeap(data.params.record.usedHeapSizeDelta);
    }
  };
  socket.on('open', function () {
    socket.send(JSON.stringify({ id: 1, method: 'Timeline.start' }));
  });

  function logHeap (delta) {
    heapSize += delta;
  }

  function write () {
    gc();
    if (i > 50) {
      i = 0;
      charm.reset();
    }
    charm.position(0, ++i);
    var cols = Math.round((50 / 25e6) * heapSize);
    var colour = 'yellow';
    if (lastHeap > heapSize) colour = 'green';
    if (lastHeap < heapSize) colour = 'red';
    charm.background(colour);
    label = heapSize + ' (' + (heapSize - lastHeap) + ')';
    label = pad(label, cols + 20);
    charm.write(label);
    lastHeap = heapSize;
  }

  function gc () {
    socket.send(JSON.stringify({ id: ++i, method: 'HeapProfiler.collectGarbage' }));
  }

  setInterval(write, 500);
}

function pad (str, length) {
  var add = length - str.length;
  add = add > 0 ? add : 0;
  return str + (new Array(add)).join(' ');
}


poll();
