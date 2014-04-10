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
    if (err) setTimeout(poll, 100);
    else listen(JSON.parse(body));
  });
}

function listen (tabs) {
  var socketUrl = _.find(tabs, { url: PAGE }).webSocketDebuggerUrl;

  var socket = new Socket(socketUrl);
  socket.onmessage = function (message) {
    var data = JSON.parse(message.data);
    if (data.params && data.params.record && data.params.record.usedHeapSizeDelta) {
      logHeap(data.params.record.usedHeapSizeDelta);
    }
  };
  socket.on('open', function () {
    socket.send(JSON.stringify({ id: 1, method: 'Timeline.start' }));
  });
}

function logHeap (delta) {
  console.log(delta);
}

poll();
