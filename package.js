Package.describe({
  summary: "Subscription Manager for Iron Router"
});

Npm.depends({
  'blueimp-md5': '1.1.0'
});

Package.on_use(function (api, where) {
  api.export('SubscriptionManager', ['client']);
  api.use(['ejson'], ['client']);

  api.add_files([
    '.npm/package/node_modules/blueimp-md5/js/md5.js',
    'lib/subscriptionManager.js'
  ], 'client');
});