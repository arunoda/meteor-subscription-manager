/*
  Subscriptions Type
  expire
  limit
  dontExpire
*/

SubscriptionManager = function () {
  this.subscriptions = {};
  this.subscriptionsByName = {};
  this.currentSubscriptions = {};

  this._removeCurrentSubscriptions = false;
}

SubscriptionManager.prototype.add = function(subscriptionName /*, params*/) {
  var args = arguments;
  var hash = this._hashArgs(arguments);
  var sub = this.subscriptions[hash];
  
  if(!sub) {
    console.log('NEW SUBS', args);
    sub = new SubscriptionManager.Subscription(this, hash, subscriptionName, args);
    this.subscriptions[hash] = sub;
  }

  this._applyLimit(sub);
  this._applyExpire(sub);

  if(this._removeCurrentSubscriptions) {
    this.currentSubscriptions = {};
    this._removeCurrentSubscriptions = false;
  }
  this.currentSubscriptions[sub.hash] = sub;

  return sub;
};

SubscriptionManager.prototype.run = function() {
  var readyCallbacks = [];
  for(var hash in this.subscriptions) {
    var sub = this.subscriptions[hash];
    var handler = sub.subscriptionHandler = Meteor.subscribe.apply(Meteor, sub.args);
    readyCallbacks.push(handler);

    if(sub._expire) {
      console.log('EXPIRING...');
      //do no participate in future
      delete this.subscriptions[hash];
    }
  }

  this._removeCurrentSubscriptions = true;
  return {
    ready: function() {
      for(var lc=0; lc < readyCallbacks.length; lc++) {
        if(!readyCallbacks[lc].ready()) {
          return false;
        }
      }

      return true;
    }
  }
};

SubscriptionManager.prototype._applyLimit = function(sub) {
  //only handle subscriptions with _limit > 0
  if(!sub._limit || sub._limit < 0) return;
  var self = this;

  this.subscriptionsByName[sub.name] = this.subscriptionsByName[sub.name] || [];
  var subList = this.subscriptionsByName[sub.name];
  if(sub._limitApplied) {
    //readd subscription to the end of the list
    var index = subList.indexOf(sub);
    subList.splice(index, 1);
    subList.push(sub);
  } else {
    subList.push(sub);
    //check length
    var removeCount = subList.length - sub._limit;
    if(removeCount > 0) {
      var removedSubs = subList.splice(0, removeCount);
      removedSubs.forEach(function(removedSub) {
        self._deleteSubscription(removedSub);
      });
    }
    sub._limitApplied = true;
  }
};

SubscriptionManager.prototype._applyExpire = function(sub) {
  //only handles subscriptions with _expireMinutes > 0
  if(!sub._expireMinutes || sub._expireMinutes < 0) return;
  var self = this;
  var expireMillies = sub._expireMinutes * 1000 * 60;

  if(!sub._expireApplied) {
    sub._expireApplied = true;
  } else {
    clearTimeout(sub._expireHandler);
  }
  
  sub._expireHandler = setTimeout(expirationLogic, expireMillies);

  function expirationLogic() {
    sub._expireHandler = null;
    self._deleteSubscription(sub);

    //if this is not a current subscription stop subscribing
    if(sub.subscriptionHandler && !self.currentSubscriptions[sub.hash]) {
      sub.subscriptionHandler.stop();
    }
  }
};

SubscriptionManager.prototype._deleteSubscription = function(sub) {
  delete this.subscriptions[sub.hash];
  var index = this.subscriptionsByName[sub.name].indexOf(sub);
  if(index >= 0) {
    this.subscriptionsByName[sub.name].splice(index, 1);
  }

  if(sub.expireHandler) {
    clearTimeout(sub.expireHandler);
  }
};

SubscriptionManager.prototype._hashArgs = function(args) {
  var jsonString = JSON.stringify(args);
  var md5String = md5(jsonString);
  return md5String;
}

SubscriptionManager.Subscription = function(contex, hash, name, args) {
  this.contex = contex;
  this.name = name;
  this.hash = hash;
  this.args = args;

  this._limit = 0;
  this._expireMinutes = 0;
  this._expire = true;
}

SubscriptionManager.Subscription.prototype.limit = function(count) {
  this._limit = count;
  this.dontExpire();
  return this;
};

SubscriptionManager.Subscription.prototype.expireIn = function(minutes) {
  this._expireMinutes = minutes;
  this.dontExpire();
  return this;
};

SubscriptionManager.Subscription.prototype.dontExpire = function() {
  this._expire = false;
  return this;
};