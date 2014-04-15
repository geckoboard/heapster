var exec = require('child_process').exec,
    http = require('http'),
    fs = require('fs'),
    assert = require('assert'),
    fixture = fs.readFileSync(__dirname + '/fixtures/fixture.html');

describe('heapster', function () {
  var server;
  before(function () {
    server = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'text/html' });
      res.end(fixture);
    }).listen(9223);
  });

  after(function () {
    server.close();
  });

  it('outputs the final heapsize and heap increase', function (done) {
    this.timeout(12e3);
    exec('./bin/heapster http://localhost:9223/', function (err, out) {
      assert.ok(out.match(/^Heap: \d{6}\nIncrease: \d{6}\n$/), out.split('\n').join(' ') + 'should be heap size and heap increase');
      done();
    });
  });
});
