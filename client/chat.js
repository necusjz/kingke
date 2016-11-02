import './chat.html';
var collection = require('../collection/message.js');
var Messages = collection.Messages;

Router.route('/chat', function() {
});

Template.messages.helpers({
  messages: function() {
    return Messages.find({}, { sort: { time: -1 } });
  }
});

var sendMessage = function() {
  var name = '陌生人';
  var message = document.getElementById('message');
  if (message.value !== '') {
    Messages.insert({
      name: name,
      message: message.value,
      time: Date.now(),
    });

    document.getElementById('message').value = '';
    message.value = '';
  }
};

Template.input.events = {
  'keydown input#message': function(event) {
    if (event.which === 13) {
      sendMessage();
    }
  }
};
