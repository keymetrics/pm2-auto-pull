
var pmx     = require('pmx');
var pm2     = require('pm2');
var async   = require('async');
var pkg     = require('./package.json');

var Probe = pmx.probe();

var app_updated = Probe.counter({
  name : 'Updates'
});

function autoPull(cb) {
  pm2.list(function(err, procs) {
    if (err) return console.error(err);

    async.forEachLimit(procs, 1, function(proc, next) {
      if (proc.pm2_env && proc.pm2_env.versioning) {
        pm2.pullAndReload(proc.name, function(err, meta) {
          if (meta) {
            var rev = meta.rev;

            app_updated.inc();

            if (rev)
              console.log('Successfully pulled [App name: %s] [Commit id: %s] [Repo: %s] [Branch: %s]',
                          proc.name,
                          rev.current_revision,
                          meta.procs[0].pm2_env.versioning.repo_path,
                          meta.procs[0].pm2_env.versioning.branch);
            else {
              // Backward compatibility
              console.log('App %s succesfully pulled', proc.name);
            }
          }
          if (err)
            console.log('App %s already at latest version', proc.name);
          return next();
        });
      }
      else next();
    }, cb);

  });
}

pmx.initModule({
  widget : {
    type             : 'generic',
    theme            : ['#111111', '#1B2228', '#807C7C', '#807C7C'],

    el : {
      probes  : true,
      actions : true
    },

    block : {
      actions : true,
      issues  : true,
      meta : true,
      cpu: true,
      mem: true
    }

    // Status
    // Green / Yellow / Red
  }
}, function(err, conf) {
  pm2.connect(function() {
    console.log('pm2-auto-pull module connected to pm2');

    var running = false;

    setInterval(function() {
      if (running == true) return false;

      running = true;
      autoPull(function() {
        running = false;
      });
    }, conf.interval || 30000);

  });
});
