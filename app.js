
process.env.MODULE_DEBUG = (process.NODE_ENV == 'production' ? false : true);

var pmx     = require('pmx');
var pm2     = require('pm2');
var async   = require('async');
var pkg     = require('./package.json');
var debug   = require('debug')(pkg.name);

var conf    = pmx.initModule();

var Probe = pmx.probe();

var app_updated = Probe.counter({
  name : 'App updated'
});

function autoPull(cb) {
  pm2.list(function(err, procs) {

    async.forEachLimit(procs, 1, function(proc, next) {
      if (proc.pm2_env && proc.pm2_env.versioning) {
        debug('pull And Reload %s', proc.name);
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
            debug('App %s already at latest version', proc.name);
          return next();
        });
      }
      else next();
    }, cb);

  });
}

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
